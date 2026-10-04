(function(root){
  'use strict';
  const G=60,SOFTENING=6;
  class OrbitWorld{
    constructor(){this.bodies=[];this.time=0;this.collisions=0;this.escaped=0;this.nextId=1;this.events=[];}
    clear(){this.bodies=[];this.time=0;this.collisions=0;this.escaped=0;this.events=[];this.nextId=1;}
    add({x,y,vx=0,vy=0,mass=100,kind='planet',color='#9fafff',fixed=false}){
      if(![x,y,vx,vy,mass].every(Number.isFinite)||mass<=0||!['planet','star','asteroid'].includes(kind))throw new Error('天体参数无效');
      if(this.bodies.length>=80)throw new Error('这个小宇宙最多容纳 80 个天体');
      const radius=kind==='star'?Math.max(13,Math.cbrt(mass)*.82):kind==='asteroid'?Math.max(2.5,Math.cbrt(mass)*.65):Math.max(4,Math.cbrt(mass)*1.25);
      const b={id:this.nextId++,x,y,vx:fixed?0:vx,vy:fixed?0:vy,mass,kind,color,fixed,radius,trail:[]};this.bodies.push(b);return b;
    }
    orbit(x,y,options={}){
      const anchor=this.bodies.filter(b=>b.kind==='star').sort((a,b)=>b.mass-a.mass)[0];if(!anchor)throw new Error('先放一颗恒星，再为它添加环绕的行星');
      const dx=x-anchor.x,dy=y-anchor.y,r=Math.hypot(dx,dy);if(r<anchor.radius+20)throw new Error('离恒星太近了，请放远一点');
      const speed=Math.sqrt(G*anchor.mass*r*r/Math.pow(r*r+SOFTENING*SOFTENING,1.5));return this.add({...options,x,y,vx:anchor.vx-dy/r*speed,vy:anchor.vy+dx/r*speed});
    }
    acceleration(){const n=this.bodies.length,ax=new Float64Array(n),ay=new Float64Array(n);for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=this.bodies[i],b=this.bodies[j],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy+SOFTENING*SOFTENING,force=G/(d2*Math.sqrt(d2));ax[i]+=dx*force*b.mass;ay[i]+=dy*force*b.mass;ax[j]-=dx*force*a.mass;ay[j]-=dy*force*a.mass;}return{ax,ay};}
    merge(){for(let i=0;i<this.bodies.length;i++)for(let j=i+1;j<this.bodies.length;j++){const a=this.bodies[i],b=this.bodies[j];if(Math.hypot(a.x-b.x,a.y-b.y)>a.radius+b.radius)continue;
      const mass=a.mass+b.mass,fixed=a.fixed||b.fixed,heavy=a.mass>=b.mass?a:b,anchor=a.fixed?a:b.fixed?b:heavy;
      const merged={...heavy,id:this.nextId++,mass,x:fixed?anchor.x:(a.x*a.mass+b.x*b.mass)/mass,y:fixed?anchor.y:(a.y*a.mass+b.y*b.mass)/mass,vx:fixed?0:(a.vx*a.mass+b.vx*b.mass)/mass,vy:fixed?0:(a.vy*a.mass+b.vy*b.mass)/mass,fixed,radius:Math.cbrt(a.radius**3+b.radius**3),trail:heavy.trail.slice(-400)};
      this.events.push({x:merged.x,y:merged.y,radius:merged.radius,color:merged.color,age:0});if(this.events.length>50)this.events.shift();this.bodies[i]=merged;this.bodies.splice(j,1);this.collisions++;j--;}
    }
    step(dt=1/120){if(!Number.isFinite(dt)||dt<=0||dt>.05)throw new Error('模拟步长无效');this.merge();let a=this.acceleration();for(let i=0;i<this.bodies.length;i++){const b=this.bodies[i];if(b.fixed)continue;b.vx+=a.ax[i]*dt/2;b.vy+=a.ay[i]*dt/2;b.x+=b.vx*dt;b.y+=b.vy*dt;}a=this.acceleration();for(let i=0;i<this.bodies.length;i++){const b=this.bodies[i];if(!b.fixed){b.vx+=a.ax[i]*dt/2;b.vy+=a.ay[i]*dt/2;}}
      this.merge();this.time+=dt;for(const e of this.events)e.age+=dt;this.events=this.events.filter(e=>e.age<1.5);const remaining=this.bodies.filter(b=>b.fixed||Math.hypot(b.x,b.y)<6000);this.escaped+=this.bodies.length-remaining.length;this.bodies=remaining;
    }
    recordTrails(){for(const b of this.bodies){if(b.fixed)continue;b.trail.push({x:b.x,y:b.y});if(b.trail.length>720)b.trail.shift();}}
    preset(scene){if(!['solar','binary','collision','empty'].includes(scene))throw new Error('未知场景');this.clear();
      if(scene==='solar'){this.add({x:0,y:0,mass:14000,kind:'star',color:'#ffd18a',fixed:true});for(const [r,m,c,angle] of [[110,18,'#a8d1ff',-.9],[190,38,'#ffac98',2.6],[285,65,'#a69fff',.4],[385,90,'#72ddc4',-2.2]])this.orbit(Math.cos(angle)*r,Math.sin(angle)*r,{mass:m,color:c});}
      if(scene==='binary'){const speed=Math.sqrt(G*6500/(2*190));this.add({x:-95,y:0,vy:-speed,mass:6500,kind:'star',color:'#ffd18a'});this.add({x:95,y:0,vy:speed,mass:6500,kind:'star',color:'#a8c8ff'});this.add({x:0,y:-360,vx:Math.sqrt(G*13000/360),mass:25,color:'#b29fff'});}
      if(scene==='collision'){this.add({x:-170,y:0,vx:46,mass:420,color:'#91b9ff'});this.add({x:170,y:0,vx:-46,mass:420,color:'#ffb19a'});this.add({x:0,y:-200,vx:25,mass:16,kind:'asteroid',color:'#a0b4c1'});}
    }
  }
  root.OrbitWorld=OrbitWorld;if(typeof module!=='undefined')module.exports={OrbitWorld,G};
})(typeof window!=='undefined'?window:globalThis);
