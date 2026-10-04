/* A small original cellular sandbox: each cell moves at most once per tick. */
(function(root){
  const WATER_UNIT=48,SOIL_CAPACITY=48,SAND_CAPACITY=48;
  const WATER_PERMEABLE=new Set([6,7,9,10,12,13]); // Seeds, leaves, clouds, grass and litter.
  class SandWorld {
    constructor(width=320,height=180,random=Math.random){this.width=width;this.height=height;this.random=random;this.cells=new Uint8Array(width*height);this.life=new Uint8Array(width*height);this.moved=new Uint8Array(width*height);this.moisture=new Uint8Array(width*height);this.flood=new Uint16Array(width*height);this.owner=new Uint32Array(width*height);this.tick=0;this.plants=[];this.plantById=new Map();this.nextPlantId=1;}
    clear(){this.cells.fill(0);this.life.fill(0);this.moisture.fill(0);this.flood.fill(0);this.owner.fill(0);this.plants=[];this.plantById.clear();this.nextPlantId=1;}
    put(x,y,type){if(x<0||y<0||x>=this.width||y>=this.height)return;const i=y*this.width+x;if(type===0||this.cells[i]===0){this.cells[i]=type;this.life[i]=type===4?40+Math.floor(this.random()*50):0;this.moisture[i]=0;this.flood[i]=0;this.owner[i]=0;}}
    brush(x,y,radius,type){for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=this.width||ny<0||ny>=this.height||dx*dx+dy*dy>radius*radius)continue;if(type===0||type===3||type===5||type===8||this.random()<(type===6?.012:.45)){const old=this.cells[ny*this.width+nx];if(type===3&&old!==3)this.put(nx,ny,0);else if((type===5||type===8)&&[1,2,6,9,12,13].includes(old))this.put(nx,ny,0);this.put(nx,ny,type);}}}
    move(a,b){for(const data of [this.cells,this.life,this.moisture,this.flood,this.owner]){const t=data[b];data[b]=data[a];data[a]=t;}this.moved[a]=this.moved[b]=1;}
    nearbyCell(x,y,radius,matches){const w=this.width,h=this.height,queue=[y*w+x],seen=new Set(queue);for(let n=0;n<queue.length;n++){const i=queue[n],cx=i%w,cy=Math.floor(i/w);if(matches(i,cx,cy))return i;for(const [dx,dy] of [[0,1],[0,-1],[-1,0],[1,0]]){const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=w||ny<0||ny>=h||Math.abs(nx-x)>radius||Math.abs(ny-y)>radius)continue;const j=ny*w+nx;if(this.cells[j]===3||seen.has(j))continue;seen.add(j);queue.push(j);}}return -1;}
    nearbyWater(x,y,radius=2){return this.nearbyCell(x,y,radius,i=>this.cells[i]===2);}
    nearbyMoisture(x,y){return this.nearbyCell(x,y,2,(i,nx,ny)=>ny>=y&&[1,8].includes(this.cells[i])&&this.moisture[i]>=24);}
    isFlooded(x,y){let water=0,above=0;for(let dy=-2;dy<=0;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<this.width&&ny>=0&&this.cells[ny*this.width+nx]===2){water++;if(dy<0)above++;}}return water>=4&&above>=2;}
    waterBelow(x,y){let ny=y+1;while(ny<this.height&&WATER_PERMEABLE.has(this.cells[ny*this.width+x]))ny++;return ny<this.height?ny*this.width+x:-1;}
    hydrology(){
      // Stored moisture travels through porous ground. Rock is impermeable.
      const w=this.width,h=this.height,c=this.cells,m=this.moisture;
      for(let y=h-1;y>=0;y--)for(let x=0;x<w;x++){const i=y*w+x,t=c[i];if((t!==1&&t!==8)||!m[i])continue;
        const rate=t===1?8:2;
        if(y===h-1)m[i]=Math.max(0,m[i]-rate);
        else {const j=this.waterBelow(x,y),below=j<0?-1:c[j];if(below===1||below===8){const capacity=below===1?SAND_CAPACITY:SOIL_CAPACITY,transfer=Math.min(rate,m[i],Math.max(0,capacity-m[j]));m[i]-=transfer;m[j]+=transfer;}else if(below===0&&m[i]>=WATER_UNIT){this.put(x,Math.floor(j/w),2);m[i]-=WATER_UNIT;this.moved[j]=1;}}
        if(this.tick%24===0)for(const dx of [-1,1]){if(x+dx<0||x+dx>=w)continue;const j=i+dx;if((c[j]===1||c[j]===8)&&m[i]>m[j]+12){const capacity=c[j]===1?SAND_CAPACITY:SOIL_CAPACITY,transfer=Math.min(2,Math.floor((m[i]-m[j])/2),Math.max(0,capacity-m[j]));m[i]-=transfer;m[j]+=transfer;}}
        const surface=y===0||![1,8].includes(c[i-w]);if(this.tick%(surface?60:240)===0&&m[i])m[i]--;
      }
    }
    plantCell(p,x,y,type){if(x<0||x>=this.width||y<0||y>=this.height)return;const i=y*this.width+x;if(this.cells[i]!==0)return;this.put(x,y,type);this.owner[i]=p.id;p.parts.push(i);}
    wither(p){for(const i of p.parts)if(this.owner[i]===p.id){if(this.cells[i]===5)this.cells[i]=11;else if(this.cells[i]===7)this.cells[i]=12;this.owner[i]=0;}p.dead=true;this.plantById.delete(p.id);}
    grow(){
      const w=this.width,c=this.cells;
      this.plants=this.plants.filter(p=>{if(c[p.root]===5&&this.owner[p.root]===p.id&&!p.dead)return true;this.plantById.delete(p.id);return false;});
      for(const p of this.plants){
        p.flood=Math.max(0,p.flood+(this.isFlooded(p.x,p.y)?8:-16));
        if(p.flood>=600){this.wither(p);continue;}
        if(p.done||p.flood>=180)continue;
        if(c[p.tip]!==5){p.done=true;continue;}
        if(p.height<p.target){
          const y=p.y-p.height-1,x=p.x+Math.round(Math.sin((p.height+1)/7)*1.2);
          if(y<1||x<1||x>=w-1){p.height=p.target;continue;}
          const j=y*w+x;if(c[j]!==0&&c[j]!==7&&c[j]!==10){p.height=p.target;continue;}
          const previousX=p.tip%w;
          if(c[j]===7||c[j]===10)this.put(x,y,0);
          for(let bx=Math.min(x,previousX);bx<=Math.max(x,previousX);bx++)this.plantCell(p,bx,y,5);
          p.tip=j;p.height++;
          if(p.height>5&&p.height%5===0){const dir=p.height%10===0?-1:1;for(let d=1;d<=3;d++)this.plantCell(p,x+dir*d,y-d,5);}
        }else{
          // Expand a finite crown gradually instead of filling the screen with leaves.
          const cx=p.tip%w,cy=Math.floor(p.tip/w)-2,r=++p.crown;
          for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r&&(dx*dx+dy*dy>(r-1)*(r-1)||r===1)&&this.random()<.86)this.plantCell(p,cx+dx,cy+dy,7);
          if(r>=p.radius)p.done=true;
        }
      }
    }
    step(){const w=this.width,h=this.height,c=this.cells;this.moved.fill(0);this.tick++;if(this.tick%6===0)this.hydrology();if(this.tick%8===0)this.grow();for(let y=h-1;y>=0;y--){const reverse=(y+this.tick)%2;for(let k=0;k<w;k++){const x=reverse?w-1-k:k,i=y*w+x,t=c[i];if(!t||this.moved[i]||t===3||t===5||t===7||t===8||t===11||t===13)continue;
      if(t===9){if(y+1<h&&c[i+w]===0&&this.random()<.0025){this.put(x,y+1,2);this.moved[i+w]=1;}continue;}
      if(t===10){this.flood[i]=Math.max(0,this.flood[i]+(this.isFlooded(x,y)?1:-2));if(this.flood[i]>=420){c[i]=13;continue;}if(this.flood[i]<120&&this.tick%20===0&&(this.nearbyWater(x,y,3)>=0||this.nearbyMoisture(x,y)>=0)){for(const dx of [-1,1]){const nx=x+dx;if(nx<0||nx>=w||y+1>=h)continue;const j=i+dx;if(c[j]===0&&(c[j+w]===8||c[j+w]===1)&&this.random()<.16){this.put(nx,y,10);this.moved[j]=1;}}}continue;}
      if(t===6&&y+1<h&&[1,3,5,8,10,11,13].includes(c[i+w])){const water=this.nearbyWater(x,y),soil=this.nearbyMoisture(x,y);if((water>=0||soil>=0)&&this.plants.length<256&&!this.isFlooded(x,y)){if(water>=0)this.put(water%w,Math.floor(water/w),0);else this.moisture[soil]-=16;const p={id:this.nextPlantId++,root:i,tip:i,x,y,height:0,target:14+Math.floor(this.random()*18),crown:0,radius:5+Math.floor(this.random()*6),done:false,dead:false,flood:0,parts:[i]};c[i]=5;this.owner[i]=p.id;this.plants.push(p);this.plantById.set(p.id,p);this.moved[i]=1;continue;}}
      if(t===4){let wet=false;for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const j=ny*w+nx;if(c[j]===2){wet=true;}else if([5,6,7,10,11,12,13].includes(c[j])&&this.random()<.09){c[j]=4;this.life[j]=55+Math.floor(this.random()*40);this.moved[j]=1;}}
        if(wet||this.life[i]===0){c[i]=0;this.life[i]=0;continue;}this.life[i]--;if(y>0){const dir=this.random()<.5?-1:1;for(const dx of [0,dir,-dir]){if(x+dx>=0&&x+dx<w&&c[i-w+dx]===0&&!this.moved[i-w+dx]){this.move(i,i-w+dx);break;}}}continue;}
      const dir=this.random()<.5?-1:1;
      // Thin vegetation shares a cell with flowing water conceptually: preserve the
      // covering and route water to the first cell beneath it, never through rock.
      if(t===2){let absorbed=false;const below=this.waterBelow(x,y),targets=[below,x>0?i-1:-1,x+1<w?i+1:-1];for(const j of targets){if(j<0)continue;const ground=c[j];if((ground===1||ground===8)&&this.moisture[j]+WATER_UNIT<=(ground===1?SAND_CAPACITY:SOIL_CAPACITY)){this.moisture[j]+=WATER_UNIT;this.put(x,y,0);absorbed=true;break;}}if(absorbed)continue;
        if(below>=0&&below!==i+w&&!this.moved[below]&&(c[below]===0||c[below]===4)){if(c[below]===4)this.put(x,Math.floor(below/w),0);this.move(i,below);continue;}
      }
      const canMove=j=>!this.moved[j]&&(c[j]===0||c[j]===4||((t===1||t===6)&&c[j]===2));
      if(y+1<h){let moved=false;for(const dx of [0,dir,-dir]){const nx=x+dx,j=i+w+dx;if(t===2&&dx!==0&&(c[i+w]===3||(nx>=0&&nx<w&&c[i+dx]===3)))continue;if(nx>=0&&nx<w&&canMove(j)){if(t===2&&c[j]===4)this.put(nx,y+1,0);this.move(i,j);moved=true;break;}}if(moved)continue;}
      if(t===2){for(const dx of [dir,-dir]){const nx=x+dx,j=i+dx;if(nx>=0&&nx<w&&!this.moved[j]&&c[j]===0){this.move(i,j);break;}}}
    }}}
  }
  root.SandWorld=SandWorld;
  if(typeof module!=='undefined')module.exports={SandWorld};
})(typeof window!=='undefined'?window:globalThis);
