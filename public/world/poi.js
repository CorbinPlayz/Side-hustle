import * as THREE from "three";
import {heightAt,slopeAt} from "./terrain.js";
import {buildStall} from "./props.js";
import {cabin} from "./town.js";
import {makeCharacter,animateCharacter,defaultLook} from "./character.js";
const lam=(c,o={})=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:.9,...o});
const rockM=[lam(0x8a8a86),lam(0x77777a),lam(0x9a968c)];
function add(p,geo,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,shadow=true){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);o.castShadow=shadow;o.receiveShadow=true;p.add(o);return o}
function boulder(p,r,x,y,z,rand,sy=.8){const g=new THREE.IcosahedronGeometry(r,1);const pos=g.attributes.position;const kk=new Map();for(let i=0;i<pos.count;i++){const key=pos.getX(i).toFixed(3)+pos.getY(i).toFixed(3)+pos.getZ(i).toFixed(3);if(!kk.has(key))kk.set(key,1+(rand()-.5)*.24);const k=kk.get(key);pos.setXYZ(i,pos.getX(i)*k,pos.getY(i)*k,pos.getZ(i)*k)}g.computeVertexNormals();return add(p,g,rockM[(rand()*3)|0],x,y,z,rand()*3,rand()*3,rand()*3,1,sy,1)}
function flatSpot(cx,cz,r,maxRng){let lo=1e9,hi=-1e9,s=0;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const h=heightAt(cx+i*r/2,cz+j*r/2);lo=Math.min(lo,h);hi=Math.max(hi,h);s+=h}return {rng:hi-lo,mean:s/25,hi}}
const norm=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a};
/** Landmarks: lighthouse, shipwreck, waterfall cave, village with its own market. */
export class POIs{
  constructor({scene,rand,pickups,fx,dockA,stallPos,avoid}){
    Object.assign(this,{scene,rand,pickups,fx,dockA,stallPos,avoid});
    this.group=new THREE.Group();scene.add(this.group);this.blockers=[];this.list=[];this.villagers=[];this.t=0;this.misty=[];
    this.coastPoint=(a)=>{for(let r=330;r>60;r-=1)if(heightAt(Math.cos(a)*r,Math.sin(a)*r)>.55)return r;return 200};
    this.lighthouse=this.buildLighthouse();this.wreck=this.buildWreck();this.cave=this.buildCave();this.village=this.buildVillage();
  }
  add(name,x,z,y){this.list.push({name,x,z,y})}
  buildLighthouse(){
    // the sharpest point of coast, far from the dock
    let best=null;for(let k=-14;k<=14;k++){const a=this.dockA+Math.PI+k*.06,r=this.coastPoint(a);if(!best||r>best.r)best={a,r}}
    const x=Math.cos(best.a)*(best.r-3),z=Math.sin(best.a)*(best.r-3),base=Math.max(heightAt(x,z),.8);
    const g=new THREE.Group();g.position.set(x,0,z);this.group.add(g);
    for(let i=0;i<9;i++){const a=i/9*6.283;boulder(g,1.8+this.rand()*1.4,Math.cos(a)*5.2,base-.6,Math.sin(a)*5.2,this.rand)}
    boulder(g,4.2,0,base-1.4,0,this.rand,.7);
    const H=22,seg=7,white=lam(0xf4f1ea),red=lam(0xc9382d);
    for(let i=0;i<seg;i++){const y0=base+1+i*(H/seg),r0=3.1-i*.2,r1=3.1-(i+1)*.2;add(g,new THREE.CylinderGeometry(r1,r0,H/seg+.02,9),i%2?red:white,0,y0+H/seg/2,0)}
    const top=base+1+H;
    add(g,new THREE.CylinderGeometry(3.7,3.2,.5,9),lam(0x3a3a40),0,top+.1,0);
    for(let i=0;i<9;i++){const a=i/9*6.283;add(g,new THREE.BoxGeometry(.12,1.1,.12),lam(0x3a3a40),Math.cos(a)*3.55,top+.8,Math.sin(a)*3.55)}
    add(g,new THREE.CylinderGeometry(3.6,3.6,.08,9),lam(0x3a3a40),0,top+1.35,0);
    add(g,new THREE.CylinderGeometry(1.9,1.9,2.2,9),lam(0xfff2b0,{emissive:0xffd96a,emissiveIntensity:1.3,transparent:true,opacity:.92}),0,top+1.5,0);
    add(g,new THREE.ConeGeometry(2.4,1.6,9),red,0,top+3.6,0);add(g,new THREE.SphereGeometry(.25,6,4),lam(0x3a3a40),0,top+4.5,0);
    add(g,new THREE.BoxGeometry(1.1,2,.3),lam(0x6b4a26),0,base+2,3.0);
    const L=new THREE.PointLight(0xfff0c0,40,60);L.position.set(0,top+1.5,0);g.add(L);this.beam=L;
    this.blockers.push({x,z,r:4.4});this.add("Lighthouse",x,z,top);
    // treasure washed up at the foot
    for(let i=0;i<5;i++){const a=i*1.4+.3,px=x+Math.cos(a)*6.5,pz=z+Math.sin(a)*6.5;if(heightAt(px,pz)>.1)this.pickups.addFixed(i%2?"pearl":"coin",px,heightAt(px,pz),pz,300)}
    return {x,z,top,base,door:{x:x,z:z+3.4}};
  }
  buildWreck(){
    const a=this.dockA-1.55,r=this.coastPoint(a)-2,x=Math.cos(a)*r,z=Math.sin(a)*r,y=heightAt(x,z);
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=-a+Math.PI/2+.4;this.group.add(g);
    const wood=[lam(0x7a5a38),lam(0x6a4c30),lam(0x8a6a44)],plank=()=>wood[(this.rand()*3)|0];
    add(g,new THREE.BoxGeometry(1,.35,9),wood[1],0,.1,0,.08,0,.05); // keel
    for(let i=0;i<9;i++){const z0=-4+i,w=1.4+Math.sin(i/8*Math.PI)*1.5;
      for(const s of [-1,1]){if(this.rand()<.18)continue;add(g,new THREE.BoxGeometry(.18,1.1+this.rand()*.5,1),plank(),s*w*.5,.75,z0,0,0,-s*.35)}
      add(g,new THREE.BoxGeometry(w*.9,.14,.8),plank(),0,.12,z0);
      if(i%2===0)for(const s of [-1,1])add(g,new THREE.BoxGeometry(.14,1.9,.14),wood[0],s*w*.52,1.0,z0,0,0,-s*.38);
    }
    add(g,new THREE.BoxGeometry(.5,.5,2.4),wood[0],0,1.4,-4.6,-.5,0,0); // bow
    add(g,new THREE.CylinderGeometry(.14,.2,6,6),wood[0],.3,3,.4,.0,0,.5); // snapped mast
    add(g,new THREE.PlaneGeometry(2.4,3),lam(0xe9dfc8,{side:THREE.DoubleSide}),1.4,3.4,.4,0,.4,.5);
    add(g,new THREE.TorusGeometry(.5,.07,5,10),lam(0xb8473a),-1.6,.5,2.5,Math.PI/2,0,0);
    this.blockers.push({x,z,r:2.4,oval:{a:g.rotation.y,hl:4.6,hw:1.6}});this.add("Shipwreck",x,z,y);
    const spots=[[0,0],[-.8,-2],[.8,2.2],[0,3.5],[1.6,-1.2],[-1.4,1.2]];
    spots.forEach(([lx,lz],i)=>{const c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y),wx=x+lx*c+lz*s,wz=z-lx*s+lz*c;this.pickups.addFixed(["bottle","coin","pearl","bottle","coin","shell"][i],wx,Math.max(y,heightAt(wx,wz))+.12,wz,240)});
    return {x,z};
  }
  buildCave(){
    // a hill inland: boulder dome with a doorway, a cliff behind it and a waterfall into a pool
    let spot=null;
    for(let k=0;k<6000&&!spot;k++){
      const a=this.rand()*6.283,r=60+this.rand()*130,cx=Math.cos(a)*r,cz=Math.sin(a)*r,f=flatSpot(cx,cz,12,2);
      if(f.mean>7&&f.mean<16&&f.rng<1.6&&Math.hypot(cx-this.stallPos.x,cz-this.stallPos.z)>70&&!this.avoid(cx,cz))spot={x:cx,z:cz,y:f.hi};
    }
    if(!spot){const a=.5;spot={x:Math.cos(a)*150,z:Math.sin(a)*150,y:heightAt(Math.cos(a)*150,Math.sin(a)*150)}}
    const {x,z,y}=spot,face=Math.atan2(this.stallPos.z-z,this.stallPos.x-x); // doorway faces the market
    const g=new THREE.Group();g.position.set(x,y,z);this.group.add(g);
    const R=4.6,n=15;
    for(let i=0;i<n;i++){const a=i/n*6.283;if(Math.abs(norm(a-face))<.62)continue;
      boulder(g,2.1+this.rand()*.7,Math.cos(a)*R,1.1,Math.sin(a)*R,this.rand,1.45);boulder(g,1.8+this.rand()*.6,Math.cos(a+.2)*(R-.4),3.2,Math.sin(a+.2)*(R-.4),this.rand,1)}
    for(let i=0;i<5;i++){const a=i/5*6.283;boulder(g,2.3,Math.cos(a)*1.9,4.4,Math.sin(a)*1.9,this.rand,.9)}
    // arch over the doorway
    for(const s of [-1,1]){const a=face+s*.5;boulder(g,1.2,Math.cos(a)*R,1.5,Math.sin(a)*R,this.rand,1.9)}
    boulder(g,1.3,Math.cos(face)*R,4.2,Math.sin(face)*R,this.rand,.7);
    // cliff behind with waterfall
    const back=face+Math.PI,cd=11,bx=Math.cos(back)*cd,bz=Math.sin(back)*cd;
    const cliff=add(g,new THREE.BoxGeometry(22,15,5),rockM[1],bx,7.2,bz,0,-back+Math.PI/2,0);
    for(let i=0;i<9;i++){const t=(i/8-.5)*20,tx=Math.cos(back+Math.PI/2)*t,tz=Math.sin(back+Math.PI/2)*t;boulder(g,2.4+this.rand()*1.6,bx+tx,14.5+this.rand()*1.2,bz+tz,this.rand,.9);boulder(g,2.2,bx+tx*1.02-Math.cos(back)*2.2,1.5+this.rand()*3,bz+tz*1.02-Math.sin(back)*2.2,this.rand,1.4)}
    const lat=5.5,fd=cd-2.6;
    const fx0=Math.cos(back)*fd+Math.cos(back+Math.PI/2)*lat,fz0=Math.sin(back)*fd+Math.sin(back+Math.PI/2)*lat;
    const wfM=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{uTime:{value:0}},
      vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:"varying vec2 vUv;uniform float uTime;float h(float n){return fract(sin(n)*43758.5);}void main(){float col=floor(vUv.x*9.);float s=h(col)*.6+.5;float f=fract(vUv.y*3.2*s+uTime*(1.1+h(col+3.)*.6));float streak=smoothstep(.0,.35,f)*.5+.35;float edge=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);vec3 c=mix(vec3(.45,.78,.95),vec3(1.),streak);gl_FragColor=vec4(c,(.6+.3*streak)*edge);}"});
    this.waterfall=wfM;const wf=new THREE.Mesh(new THREE.PlaneGeometry(3,14.4),wfM);wf.position.set(fx0,7.4,fz0);wf.lookAt(new THREE.Vector3(fx0+Math.cos(face)*10,7.4,fz0+Math.sin(face)*10));g.add(wf);
    const px0=fx0+Math.cos(face)*2.6,pz0=fz0+Math.sin(face)*2.6;
    add(g,new THREE.CircleGeometry(3.4,10),lam(0x4aa8d8,{transparent:true,opacity:.88,roughness:.2}),px0,.14,pz0,-Math.PI/2,0,0,1,1,1,false);
    this.misty.push(new THREE.Vector3(x+px0-Math.cos(face)*1.2,y+.4,z+pz0-Math.sin(face)*1.2));
    // glow inside
    const L=new THREE.PointLight(0x5ad8ff,28,13);L.position.set(0,2,0);g.add(L);
    for(let i=0;i<6;i++){const a=i*1.05+.5,rr=2.6+this.rand()*.6;add(g,new THREE.ConeGeometry(.22,.9+this.rand()*.6,5),lam(0x7ad8ff,{emissive:0x2a9ac8,emissiveIntensity:1}),Math.cos(a)*rr,.45,Math.sin(a)*rr,(this.rand()-.5)*.5,0,(this.rand()-.5)*.5)}
    // the walls stop you, the doorway does not
    this.blockers.push({x,z,ring:{r:R,half:1.1,face,gap:.4}});this.blockers.push({x:x+bx,z:z+bz,r:9});
    this.add("Waterfall cave",x,z,y);
    const inner=[[0,0],[1.6,1.1],[-1.4,1.5],[.4,-2],[-2,-.6]];
    inner.forEach(([lx,lz],i)=>{this.pickups.addFixed(i<3?"crystal":"glowcap",x+lx,Math.max(y,heightAt(x+lx,z+lz))+.1,z+lz,i<3?420:300)});
    return {x,z,y};
  }
  buildVillage(){
    let spot=null;
    for(let k=0;k<8000&&!spot;k++){
      const a=this.rand()*6.283,r=40+this.rand()*110,cx=Math.cos(a)*r,cz=Math.sin(a)*r,f=flatSpot(cx,cz,34,3);
      if(f.mean>2.5&&f.mean<9&&f.rng<2.4&&Math.hypot(cx-this.stallPos.x,cz-this.stallPos.z)>110&&Math.hypot(cx-this.lighthouse.x,cz-this.lighthouse.z)>60&&!this.avoid(cx,cz))spot={x:cx,z:cz,y:f.hi+.1};
    }
    if(!spot){const a=2.6,cx=Math.cos(a)*120,cz=Math.sin(a)*120;spot={x:cx,z:cz,y:heightAt(cx,cz)+.1}}
    const {x,z,y}=spot,g=new THREE.Group();g.position.set(x,y,z);this.group.add(g);
    add(g,new THREE.CylinderGeometry(19,20,1.6,14),lam(0xb7a27a),0,-.75,0,0,0,0,1,1,1,false); // packed-earth square
    const cols=[0xe5654a,0x4a8be5,0xe5b84a,0x6bbf5a,0xb36be0,0xe56ba8];
    const houses=[];
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3,rr=14;const h=cabin(cols[i]);h.position.set(Math.cos(a)*rr,0,Math.sin(a)*rr);h.rotation.y=-a-Math.PI/2;g.add(h);
      this.blockers.push({x:x+Math.cos(a)*rr,z:z+Math.sin(a)*rr,r:4.3})}
    // well in the middle, market stall facing the square
    const well=new THREE.Group();add(well,new THREE.CylinderGeometry(1.2,1.3,1,10),rockM[0],0,.5,0);add(well,new THREE.CylinderGeometry(.9,.9,.1,10),lam(0x3a7aa8),0,.9,0);
    for(const s of [-1,1])add(well,new THREE.BoxGeometry(.14,1.8,.14),lam(0x6b4a26),s*1.0,1.8,0);add(well,new THREE.BoxGeometry(2.6,.14,1.1),lam(0x9a4a35),0,2.8,0,0,0,0);g.add(well);
    this.blockers.push({x,z,r:1.6});
    const stall=buildStall(0,0,0,0,["VILLAGE","wood & forage pay more"]);const sa=Math.PI*.9;stall.position.set(Math.cos(sa)*5.5,.05,Math.sin(sa)*5.5);stall.rotation.y=-sa+Math.PI/2+Math.PI;g.add(stall);
    const sp={x:x+Math.cos(sa)*5.5,z:z+Math.sin(sa)*5.5,y:y};
    // lamp posts
    for(let i=0;i<4;i++){const a=i/4*6.283+.8;add(g,new THREE.CylinderGeometry(.07,.09,2.6,6),lam(0x3a3a40),Math.cos(a)*9,1.3,Math.sin(a)*9);add(g,new THREE.SphereGeometry(.28,6,4),lam(0xfff1b0,{emissive:0xffd96a,emissiveIntensity:1.2}),Math.cos(a)*9,2.7,Math.sin(a)*9)}
    // villagers
    const keys=["baker","fisher","lumberjack","villager","farmer"];
    keys.forEach((k,i)=>{const c=makeCharacter(defaultLook(i*3+1),k);const a=i/5*6.283;c.position.set(x+Math.cos(a)*7,y,z+Math.sin(a)*7);this.scene.add(c);
      this.villagers.push({mesh:c,home:{x,z,y},target:null,wait:1+this.rand()*4})});
    this.blockers.push({x:sp.x,z:sp.z,r:3.2});
    this.add("Village",x,z,y);
    return {x,z,y,stall:sp};
  }
  /** True if a walker at (x,z) is inside a solid landmark. */
  blocked(x,z){
    for(const b of this.blockers){
      const dx=x-b.x,dz=z-b.z,d=Math.hypot(dx,dz);
      if(b.ring){if(d<b.ring.r+.9&&d>b.ring.r-1.2){if(Math.abs(norm(Math.atan2(dz,dx)-b.ring.face))>b.ring.gap)return true}}
      else if(b.oval){const c=Math.cos(-b.oval.a),s=Math.sin(-b.oval.a),lx=dx*c-dz*s,lz=dx*s+dz*c;if(Math.abs(lx)<b.oval.hw&&Math.abs(lz)<b.oval.hl)return true}
      else if(d<b.r)return true;
    }
    return false;
  }
  update(dt){
    this.t+=dt;if(this.waterfall)this.waterfall.uniforms.uTime.value=this.t;
    for(const m of this.misty)if(Math.random()<dt*10)this.fx.pixels.emit(m,2,[0xffffff,0xcfeeff],{speed:1,up:1.6,size:.14,life:1.1,gravity:-.4});
    if(this.beam)this.beam.intensity=34+Math.sin(this.t*2)*8;
    for(const v of this.villagers){
      const m=v.mesh,p=m.position;let moving=false;
      if(!v.target){v.wait-=dt;if(v.wait<=0){const a=this.rand()*6.283,r=3+this.rand()*13;v.target={x:v.home.x+Math.cos(a)*r,z:v.home.z+Math.sin(a)*r};if(this.blocked(v.target.x,v.target.z))v.target=null;else v.wait=0}}
      if(v.target){const dx=v.target.x-p.x,dz=v.target.z-p.z,d=Math.hypot(dx,dz);if(d<.4){v.target=null;v.wait=2+this.rand()*6}else{const nx=p.x+dx/d*1.5*dt,nz=p.z+dz/d*1.5*dt;if(this.blocked(nx,nz)){v.target=null;v.wait=1}else{p.x=nx;p.z=nz;m.rotation.y=Math.atan2(dx,dz);moving=true}}}
      p.y=Math.max(heightAt(p.x,p.z),.15);animateCharacter(m,dt,moving?1:0,this.t);
    }
  }
}
