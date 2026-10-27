import * as THREE from "three";
import {heightAt,slopeAt} from "./terrain.js";
import {PLOT_COUNT,GOALS} from "./economy.js";
import {makeCharacter,animateCharacter,defaultLook} from "./character.js";
export const PLOT=16; // metres per side (8 x 8 grid cells of 2 m)
const lam=(c,o={})=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:.85,...o});
const box=(w,h,d,m,x,y,z,parent)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.castShadow=true;b.receiveShadow=true;if(parent)parent.add(b);return b};
/** Finds flat spots near the market for house plots. */
export function findPlots(stall,rand){
  const out=[];
  const flat=(cx,cz)=>{let lo=1e9,hi=-1e9,sum=0;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const h=heightAt(cx+i*PLOT/4,cz+j*PLOT/4);lo=Math.min(lo,h);hi=Math.max(hi,h);sum+=h}return {rng:hi-lo,mean:sum/25,hi}};
  for(const relax of [0,1,2]){
    for(let k=0;k<4000&&out.length<PLOT_COUNT;k++){
      const a=rand()*6.283,r=26+rand()*(70+relax*50),cx=stall.x+Math.cos(a)*r,cz=stall.z+Math.sin(a)*r;
      const f=flat(cx,cz);
      if(f.rng>1.3+relax*.7||f.mean<1.6||f.mean>14)continue;
      if(out.some(p=>Math.hypot(p.x-cx,p.z-cz)<PLOT+7))continue;
      if(Math.hypot(cx-stall.x,cz-stall.z)<20)continue;
      out.push({id:out.length,x:Math.round(cx),z:Math.round(cz),y:f.hi+.05});
    }
    if(out.length>=PLOT_COUNT)break;
  }
  // number them by distance so plot 0 is the nearest to the market
  out.sort((p,q)=>Math.hypot(p.x-stall.x,p.z-stall.z)-Math.hypot(q.x-stall.x,q.z-stall.z));out.forEach((p,i)=>p.id=i);
  return out;
}
function signTexture(lines,bg="#8a5a2a"){
  const c=document.createElement("canvas");c.width=256;c.height=128;const g=c.getContext("2d");
  g.fillStyle=bg;g.fillRect(0,0,256,128);g.strokeStyle="#f2d9a0";g.lineWidth=6;g.strokeRect(5,5,246,118);
  g.fillStyle="#fff6df";g.textAlign="center";
  lines.forEach((l,i)=>{g.font=(l.size||40)+"px Georgia,serif";g.fillText(l.t,128,l.y)});
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function cabin(color){
  const g=new THREE.Group(),wall=lam(0xc9a066),log=lam(0xb08a52),dark=lam(0x7a5a34),trim=lam(color),roof=lam(0x7a3b2a),roof2=lam(0x8a4632),stone=lam(0x8d877c),glass=lam(0xa8dcf2,{emissive:0x335566});
  box(6.4,.5,6.4,stone,0,.15,0,g);box(6,.12,6,lam(0x8a6a44),0,.42,0,g);
  const W=(w,h,d,x,y,z)=>box(w,h,d,wall,x,y,z,g);
  W(6,2.6,.2,0,1.8,-2.9);W(.2,2.6,6,-2.9,1.8,0);W(.2,2.6,6,2.9,1.8,0);
  W(2.3,2.6,.2,-1.85,1.8,2.9);W(2.3,2.6,.2,1.85,1.8,2.9);W(1.4,.7,.2,0,2.85,2.9);
  // log bands, corner posts, window frames
  for(const y of [.95,1.55,2.15,2.75]){box(6.1,.1,.08,log,0,y+.3,-3.02,g);box(.08,.1,6.1,log,-3.02,y+.3,0,g);box(.08,.1,6.1,log,3.02,y+.3,0,g);box(2.3,.1,.08,log,-1.85,y+.3,3.02,g);box(2.3,.1,.08,log,1.85,y+.3,3.02,g)}
  for(const sx of [-1,1])for(const sz of [-1,1])box(.34,2.8,.34,dark,sx*2.95,1.8,sz*2.95,g);
  box(1.5,.14,.5,trim,0,2.62,3.05,g);box(.14,2.2,.14,dark,-.78,1.6,3.0,g);box(.14,2.2,.14,dark,.78,1.6,3.0,g);
  for(const x of [-1.9,1.9]){box(.95,.8,.1,glass,x,2.0,3.0,g);box(1.1,.1,.16,trim,x,2.5,3.02,g);box(1.1,.1,.16,trim,x,1.55,3.02,g);box(.07,.8,.12,dark,x,2.0,3.04,g)}
  for(const z of [-1.2,1.2]){box(.1,.8,.95,glass,-2.96,2.0,z,g);box(.1,.8,.95,glass,2.96,2.0,z,g)}
  // gable triangles front and back
  const sh=new THREE.Shape();sh.moveTo(-3.2,0);sh.lineTo(3.2,0);sh.lineTo(0,1.7);sh.closePath();
  for(const s of [-1,1]){const tri=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.18,bevelEnabled:false}),wall);tri.rotation.y=Math.PI/2;tri.position.set(s*2.95-.09,3.1,0);tri.castShadow=true;g.add(tri);box(.1,.5,.7,glass,s*3.06,3.7,0,g)} // gable ends sit on the short sides, under the ridge
  // roof with overhang, ridge and a chimney
  const r1=box(7,.2,3.9,roof,0,4.0,-1.65,g);r1.rotation.x=-.5;const r2=box(7,.2,3.9,roof2,0,4.0,1.65,g);r2.rotation.x=.5;
  box(7.1,.22,.34,lam(0x5a2a1d),0,4.85,0,g);box(.8,2.2,.8,stone,1.9,4.4,-1.2,g);box(1,.14,1,dark,1.9,5.55,-1.2,g);
  return g;
}
export class Town{
  constructor({scene,eco,forest,mushrooms,stallPos,rand,fx}){
    Object.assign(this,{scene,eco,stallPos,rand,fx});
    this.plots=findPlots(stallPos,rand);
    this.group=new THREE.Group();scene.add(this.group);
    this.views=new Map();this.npcViews=new Map();this.t=0;
    this.clear(forest,mushrooms);
    for(const p of this.plots){
      const v={plot:p,group:new THREE.Group(),sign:null,kind:null,tex:null};v.group.position.set(p.x,0,p.z);this.group.add(v.group);
      // lawn pad and corner posts
      const R=PLOT/2*Math.SQRT2,pad=new THREE.Mesh(new THREE.CylinderGeometry(R,R+3.2,2.4,4,1),lam(0x7cbc4a));pad.rotation.y=Math.PI/4;pad.position.set(0,p.y-1.2,0);pad.receiveShadow=true;v.group.add(pad); // sloped skirt so it blends into the hill
      for(const sx of [-1,1])for(const sz of [-1,1])box(.22,1.1,.22,lam(0x8a5a2a),sx*PLOT/2,p.y+.5,sz*PLOT/2,v.group);
      this.views.set(p.id,v);
    }
    this.refresh();
  }
  /** Fell trees and pick mushrooms inside the plots so there is room to build. */
  clear(forest,mushrooms){
    const m=new THREE.Matrix4().makeScale(0,0,0),inside=(x,z)=>this.plots.some(p=>Math.abs(x-p.x)<PLOT/2+2.5&&Math.abs(z-p.z)<PLOT/2+2.5);
    for(const g of forest.userData.trees){let ch=false;g.list.forEach((o,i)=>{if(inside(o[0],o[2])){o.gone=true;g.im.setMatrixAt(i,m);ch=true}});if(ch)g.im.instanceMatrix.needsUpdate=true}
    {const G=forest.userData.grassIm;if(G&&G.im){G.list.forEach((o,i)=>{if(inside(o[0],o[2]))G.im.setMatrixAt(i,m)});G.im.instanceMatrix.needsUpdate=true}}
    for(const n of mushrooms.userData.nodes){let ch=false;n.list.forEach((o,i)=>{if(inside(o.x,o.z)){o.alive=false;n.im.setMatrixAt(i,m);ch=true}});if(ch)n.im.instanceMatrix.needsUpdate=true}
  }
  clearCircle(forest,mushrooms,cx,cz,r){
    const m=new THREE.Matrix4().makeScale(0,0,0),inside=(x,z)=>Math.hypot(x-cx,z-cz)<r;
    {const G=forest.userData.grassIm;if(G&&G.im){G.list.forEach((o,i)=>{if(Math.hypot(o[0]-cx,o[2]-cz)<r*.78)G.im.setMatrixAt(i,m)});G.im.instanceMatrix.needsUpdate=true}}
    for(const g of forest.userData.trees){let ch=false;g.list.forEach((o,i)=>{if(inside(o[0],o[2])){o.gone=true;g.im.setMatrixAt(i,m);ch=true}});if(ch)g.im.instanceMatrix.needsUpdate=true}
    for(const n of mushrooms.userData.nodes){let ch=false;n.list.forEach((o,i)=>{if(inside(o.x,o.z)){o.alive=false;n.im.setMatrixAt(i,m);ch=true}});if(ch)n.im.instanceMatrix.needsUpdate=true}
  }
  plotAt(x,z,pad=0){return this.plots.find(p=>Math.abs(x-p.x)<=PLOT/2+pad&&Math.abs(z-p.z)<=PLOT/2+pad)}
  nearestSign(px,pz,range=5){let b=null,bd=range;for(const p of this.plots){const d=Math.hypot(p.x-PLOT/2+1.2-px,p.z+PLOT/2+.6-pz);if(d<bd){bd=d;b=p}}return b}
  setSign(v,lines,bg){
    if(!v.sign){
      v.sign=new THREE.Group();const post=box(.18,1.8,.18,lam(0x6b4a26),0,.9,0,v.sign);
      const board=new THREE.Mesh(new THREE.PlaneGeometry(1.7,.85),new THREE.MeshBasicMaterial({}));board.position.set(0,1.75,.12);v.sign.add(board);
      const back=board.clone();back.rotation.y=Math.PI;back.position.z=-.12;v.sign.add(back);v.board=[board,back];
      v.sign.position.set(-PLOT/2+1.2,v.plot.y,PLOT/2+.6);v.group.add(v.sign);
    }
    const t=signTexture(lines,bg);v.board.forEach(b=>{if(b.material.map)b.material.map.dispose();b.material.map=t;b.material.needsUpdate=true});
  }
  /** Sync the lots with who owns them. Cheap, so it is called after any market tick. */
  refresh(){
    const h=this.eco.house;
    for(const p of this.plots){
      const v=this.views.get(p.id),owner=h.owners[p.id];
      const key=owner||("free:"+this.eco.plotPrice(p.id));
      if(v.kind===key)continue;v.kind=key;
      if(v.house){v.group.remove(v.house);v.house=null}
      if(!owner)this.setSign(v,[{t:"FOR SALE",y:52,size:42},{t:"$"+this.eco.plotPrice(p.id).toLocaleString(),y:106,size:50}]);
      else if(owner==="me")this.setSign(v,[{t:"YOUR PLOT",y:78,size:38}],"#2f6f8f");
      else{
        const npc=h.npcs.find(n=>"npc:"+n.id===owner);
        this.setSign(v,[{t:npc?npc.name:"Neighbour",y:78,size:44}],"#6a3a2a");
        v.house=cabin(npc?npc.color:0xe5654a);v.house.position.set(0,p.y,0);v.house.rotation.y=Math.PI;v.group.add(v.house);
      }
    }
    // neighbours
    const live=new Set(h.npcs.map(n=>n.id));
    for(const [id,nv] of this.npcViews)if(!live.has(id)){this.scene.remove(nv.mesh);this.npcViews.delete(id)}
    for(const n of h.npcs){
      if(this.npcViews.has(n.id))continue;
      const p=this.plots[n.plot],mesh=makeCharacter(defaultLook(n.look||0),n.outfit||"villager");mesh.position.set(p.x+1,p.y,p.z+5);this.scene.add(mesh);
      this.npcViews.set(n.id,{mesh,home:p,target:null,wait:1+this.rand()*3,phase:this.rand()*6,going:false,visit:20+this.rand()*60});
    }
  }
  nearestNpc(x,z,range=3.2){let b=null,bd=range;for(const [id,nv] of this.npcViews){const d=Math.hypot(nv.mesh.position.x-x,nv.mesh.position.z-z);if(d<bd){const n=this.eco.house.npcs.find(q=>q.id===id);if(n){bd=d;b=n}}}return b}
  /** Fists: returns the neighbour you hit, if any, and knocks them back. */
  punchAt(x,z,dx,dz){
    const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;let best=null,bd=2.5;
    for(const nv of this.npcViews.values()){const px=nv.mesh.position.x-x,pz=nv.mesh.position.z-z,d=Math.hypot(px,pz);if(d<bd&&(px*dx+pz*dz)/(d||1)>.45){bd=d;best=nv}}
    if(best){best.stun=.9;best.kx=dx*6.5;best.kz=dz*6.5;best.mesh.userData.hit=.5;best.target=null;best.wait=1.6}
    return best;
  }
  update(dt){
    this.t+=dt;
    for(const nv of this.npcViews.values()){
      const m=nv.mesh,pos=m.position;nv.visit-=dt;
      if(nv.stun>0){nv.stun-=dt;pos.x+=nv.kx*dt;pos.z+=nv.kz*dt;nv.kx*=Math.max(0,1-dt*5);nv.kz*=Math.max(0,1-dt*5);pos.y=Math.max(heightAt(pos.x,pos.z),.15);animateCharacter(m,dt,0,this.t);continue}
      if(!nv.target){
        nv.wait-=dt;
        if(nv.wait<=0){
          if(nv.visit<=0){nv.target=new THREE.Vector3(this.stallPos.x+(this.rand()-.5)*4,0,this.stallPos.z+(this.rand()-.5)*4);nv.going=true;nv.visit=70+this.rand()*90}
          else{const a=this.rand()*6.283,r=3+this.rand()*9;nv.target=new THREE.Vector3(nv.home.x+Math.cos(a)*r,0,nv.home.z+Math.sin(a)*r);nv.going=false}
        }
      }
      let moving=false;
      if(nv.target){
        const dx=nv.target.x-pos.x,dz=nv.target.z-pos.z,d=Math.hypot(dx,dz);
        if(d<.4){nv.target=null;nv.wait=nv.going?5+this.rand()*5:2+this.rand()*6;if(nv.going){nv.going=false;nv.visit=Math.max(nv.visit,1);nv.back=true}}
        else{const sp=1.6*dt;pos.x+=dx/d*sp;pos.z+=dz/d*sp;m.rotation.y=Math.atan2(dx,dz);moving=true}
      }
      if(nv.back&&!nv.target){nv.back=false;nv.target=new THREE.Vector3(nv.home.x+(this.rand()-.5)*6,0,nv.home.z+(this.rand()-.5)*6)}
      pos.y=Math.max(heightAt(pos.x,pos.z),.15);
      animateCharacter(m,dt,moving?1:0,this.t);
    }
  }
}
