const canvas=document.querySelector('#sandbox'),ctx=canvas.getContext('2d',{alpha:false});
const world=new SandWorld(canvas.width,canvas.height),image=ctx.createImageData(canvas.width,canvas.height);
const materials=[{id:1,name:'沙子',color:'#e7bf74',desc:'堆起一座小山；沙地排水更快'},{id:2,name:'水',color:'#639cde',desc:'适量滋养植物，积水太久会淹死它们'},{id:3,name:'石头',color:'#9699af',desc:'不透水，筑坝或给池塘铺底'},{id:8,name:'泥土',color:'#826044',desc:'吸收雨水，变深色；饱和后会积水'},{id:6,name:'种子',color:'#b9d77a',desc:'落地遇水或湿土发芽，避开深水'},{id:9,name:'雨云',color:'#b2bfce',desc:'持续下雨；记得留出排水的路'},{id:10,name:'草',color:'#79ba68',desc:'湿土上蔓延；持续被淹会枯黄'},{id:4,name:'火',color:'#f08b58',desc:'烧掉树林，试试用水救回来'},{id:5,name:'木头',color:'#a77f5e',desc:'搭桥或引导火势；树也能长出木头'},{id:0,name:'橡皮',color:'#576172',desc:'留一点空白'}];
let selected=6,paused=false,drawing=false,last=null,erasing=false,touched=false,raining=false;
const colors=[[17,22,32],[231,191,116],[99,156,222],[150,153,175],[246,132,67],[167,127,94],[185,215,122],[90,163,97],[130,96,68],[178,191,206],[121,186,104],[107,88,71],[160,126,63],[139,120,64]];
const palette=document.querySelector('#materials');
for(const m of materials){const b=document.createElement('button');b.className='material';b.style.setProperty('--swatch',m.color);b.dataset.type=m.id;b.innerHTML=`<span class="swatch"></span>${m.name}`;b.addEventListener('click',()=>select(m.id));palette.append(b);}
function select(type){selected=type;for(const b of palette.children){const active=Number(b.dataset.type)===type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);}const m=materials.find(m=>m.id===type);document.querySelector('#material-label').textContent=`${m.name} · ${m.desc}`;}
select(6);
const size=document.querySelector('#size');size.addEventListener('input',()=>document.querySelector('#size-value').textContent=size.value);
function point(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(world.width-1,Math.floor((e.clientX-r.left)/r.width*world.width))),y:Math.max(0,Math.min(world.height-1,Math.floor((e.clientY-r.top)/r.height*world.height)))};}
function paint(p){const type=erasing?0:selected,r=Number(size.value);if(last){const length=Math.hypot(p.x-last.x,p.y-last.y),n=Math.max(1,Math.ceil(length/Math.max(1,r/2)));for(let a=1;a<=n;a++)world.brush(Math.round(last.x+(p.x-last.x)*a/n),Math.round(last.y+(p.y-last.y)*a/n),r,type);}else world.brush(p.x,p.y,r,type);last=p;touched=true;document.querySelector('#hint').style.opacity='0';}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);drawing=true;erasing=e.button===2;last=null;paint(point(e));});
canvas.addEventListener('pointermove',e=>{if(drawing)paint(point(e));});
function release(){drawing=false;last=null;erasing=false;}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
function toggle(){paused=!paused;document.querySelector('#pause').textContent=paused?'▶ 继续':'Ⅱ 暂停';document.querySelector('#status').textContent=paused?'时间停住了':'正在流动';}
document.querySelector('#pause').addEventListener('click',toggle);
document.querySelector('#clear').addEventListener('click',()=>{if(touched&&!window.confirm('清空当前沙盘？可以先保存画面。'))return;world.clear();release();touched=false;setRain(false);document.querySelector('#hint').style.opacity='1';document.querySelector('#story').textContent='画一块泥土地，撒下种子，再给它一点水。';});
document.querySelector('#save').addEventListener('click',()=>{render();canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`沙间-${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select,button')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();toggle();}if(/^[0-9]$/.test(e.key)){const n=Number(e.key);select(materials[n===0?9:n-1].id);}});
function render(){let count=0,green=0;for(let i=0;i<world.cells.length;i++){const t=world.cells[i],color=colors[t],j=i*4;const v=t===1?((i*17)%13)-6:[3,7,8,10].includes(t)?((i*7)%13)-6:t===4?Math.floor(Math.random()*45):0;let r=color[0]+v,g=color[1]+v,b=color[2]+v;
  if(t===1||t===8){const wet=world.moisture[i]/48;r*=1-wet*.38;g*=1-wet*.3;b*=1-wet*.12;}
  if(t===7||t===10){const exposure=t===7?(world.plantById.get(world.owner[i])?.flood||0):world.flood[i],stress=Math.min(1,Math.max(0,(exposure-(t===7?180:120))/(t===7?420:300)));r+=(173-r)*stress;g+=(133-g)*stress;b+=(57-b)*stress;}
  image.data[j]=r;image.data[j+1]=g;image.data[j+2]=b;image.data[j+3]=255;if(t)count++;if(t===7||t===10)green++;}ctx.putImageData(image,0,0);document.querySelector('#count').textContent=`${count.toLocaleString()} 颗粒子 · ${green.toLocaleString()} 点绿意`;if(!paused){const stressed=world.plants.filter(p=>!p.dead&&p.flood>=180).length;document.querySelector('#status').textContent=stressed?`${stressed} 棵树积水中，试着排水`:'正在流动';}}
function setRain(value){raining=value;const b=document.querySelector('#rain');b.textContent=value?'☁ 下雨：开':'☁ 下雨：关';b.setAttribute('aria-pressed',value);}
document.querySelector('#rain').addEventListener('click',()=>setRain(!raining));
function scene(kind,initial=false){
  if(!initial&&touched&&!window.confirm('切换场景会替换当前沙盘，继续吗？可以先保存画面。'))return;
  world.clear();release();touched=false;setRain(false);if(paused)toggle();
  const ground=x=>kind==='dam'?166:Math.round(148+Math.sin(x/24)*5+(x>126&&x<194?14:0));
  for(let x=0;x<world.width;x++)for(let y=ground(x);y<world.height;y++)world.put(x,y,y>175?3:8);
  if(kind==='dam'){
    for(let x=20;x<140;x++)for(let y=120;y<166;y++)world.put(x,y,2);
    for(let x=140;x<146;x++)for(let y=95;y<166;y++)world.put(x,y,3);
    for(let x=145;x<270;x++)world.put(x,165,10);
    document.querySelector('#story').textContent='用橡皮在石坝上开一个缺口。水会渗进泥土；如果草地持续被淹，草会枯黄。';select(0);
  }else{
    for(const x of [32,70,106,215,251,288]){
      const y=ground(x)-1;world.put(x,y,6);world.put(x-1,y,2);world.put(x+1,y,2);
    }
    // A stone-lined pond keeps its water while rain can soak into surrounding soil.
    for(let x=133;x<=187;x++){const bottom=ground(x)-1;world.put(x,bottom,3);if(x===133||x===187)for(let y=152;y<bottom;y++)world.put(x,y,3);}
    for(let x=134;x<187;x++)for(let y=153;y<ground(x)-1;y++)world.put(x,y,2);
    for(let x=116;x<126;x++)world.put(x,ground(x)-1,10);
    if(kind==='wildfire'){
      for(let n=0;n<420;n++)world.step();
      // Start the fire away from the pond so the player has time to intervene.
      let ignited=false;for(let y=80;y<160&&!ignited;y++)for(let x=26;x<39;x++)if(world.cells[y*world.width+x]===5){world.cells[y*world.width+x]=4;world.life[y*world.width+x]=90;ignited=true;break;}
      document.querySelector('#story').textContent='左侧树林起火了：画水浇灭，或用橡皮切出隔离带。也可以播种重建。';select(2);
    }else{
      for(let x=45;x<100;x++)for(let y=20;y<27;y++)if((x-72)*(x-72)/800+(y-23)*(y-23)/16<1)world.put(x,y,9);
      document.querySelector('#story').textContent='雨水渗进土里，湿土也能让种子发芽。树和草泡水太久会枯死：试着开渠排水。';select(6);
    }
  }
  document.querySelector('#hint').style.opacity='0';render();
}
for(const kind of ['oasis','dam','wildfire'])document.querySelector('#'+kind).addEventListener('click',()=>scene(kind));
scene('oasis',true);
let previous=0,accumulator=0;
function frame(time){accumulator+=Math.min(80,time-previous);previous=time;if(drawing&&last)world.brush(last.x,last.y,Number(size.value),erasing?0:selected);let steps=0;while(accumulator>=1000/60&&steps<5){if(!paused){if(raining)for(let n=0;n<2;n++)if(Math.random()<.45)world.put(Math.floor(Math.random()*world.width),0,2);world.step();}accumulator-=1000/60;steps++;}render();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
