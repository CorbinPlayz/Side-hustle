import * as THREE from "three";
import {heightAt,slopeAt} from "./terrain.js";
import {byId} from "./economy.js";
/** Things lying around to pick up: shells and bottles on the beach, junk and coins inland, berry bushes in the woods. They respawn somewhere new. */
const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:.8,...o});
function build(id){
  const g=new THREE.Group(),G=byId[id];
  const add=(geo,m,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;g.add(o);return o};
  if(id==="shell"){add(new THREE.ConeGeometry(.2,.1,7),mat(G.color),0,.05,0);add(new THREE.ConeGeometry(.12,.06,7),mat(0xfff0e6),0,.1,0)}
  else if(id==="driftwood"){add(new THREE.CylinderGeometry(.07,.09,.9,5),mat(0xa08a68),0,.08,0,0,0,Math.PI/2);add(new THREE.CylinderGeometry(.04,.05,.35,5),mat(0x8d7858),.15,.12,.1,0,0,1.2)}
  else if(id==="bottle"){add(new THREE.CylinderGeometry(.08,.08,.28,6),mat(G.color,{transparent:true,opacity:.85}),0,.1,0,0,0,Math.PI/2);add(new THREE.CylinderGeometry(.03,.04,.16,6),mat(G.color,{transparent:true,opacity:.85}),.2,.1,0,0,0,Math.PI/2)}
  else if(id==="can"){add(new THREE.CylinderGeometry(.08,.08,.16,8),mat(G.color,{metalness:.5,roughness:.4}),0,.08,0,.2,0,.15);add(new THREE.CylinderGeometry(.06,.06,.02,8),mat(0xe35a4a),0,.17,0,.2,0,.15)}
  else if(id==="coin"){add(new THREE.CylinderGeometry(.16,.16,.03,10),mat(G.color,{metalness:.7,roughness:.3,emissive:0x6a4a00}),0,.17,0,Math.PI/2.4,0,0)}
  else if(id==="pearl"){add(new THREE.ConeGeometry(.22,.1,7),mat(0xe8d8e0),0,.05,0);add(new THREE.IcosahedronGeometry(.1,1),mat(0xffffff,{emissive:0x9a8aa8,roughness:.2}),0,.14,0)}
  else if(id==="crystal"){const cm=mat(G.color,{emissive:0x2a8ab0,emissiveIntensity:.9,roughness:.2});add(new THREE.ConeGeometry(.1,.55,5),cm,0,.28,0);add(new THREE.ConeGeometry(.07,.38,5),cm,.12,.19,.05,0,0,-.4);add(new THREE.ConeGeometry(.07,.32,5),cm,-.1,.16,-.05,0,0,.5)}
  else if(id==="glowcap"){const cm=mat(G.color,{emissive:0x1aa8c8,emissiveIntensity:1});add(new THREE.CylinderGeometry(.04,.05,.2,6),mat(0xe8f6f8),0,.1,0);add(new THREE.SphereGeometry(.16,8,5,0,6.283,0,1.57),cm,0,.22,0)}
  else if(id==="berries"){
    add(new THREE.IcosahedronGeometry(.42,0),mat(0x2f8a3a),0,.3,0).scale.set(1,.7,1);
    for(let i=0;i<7;i++){const a=i*2.4;add(new THREE.IcosahedronGeometry(.07,0),mat(0xc22f66,{emissive:0x300010}),Math.cos(a)*.34,.3+Math.sin(i*1.3)*.14,Math.sin(a)*.34)}
  }
  return g;
}
const SPAWN={
  shell:{n:26,zone:"beach"},driftwood:{n:14,zone:"beach"},bottle:{n:12,zone:"beach"},pearl:{n:3,zone:"beach"},
  can:{n:26,zone:"junk"},coin:{n:4,zone:"junk"},berries:{n:26,zone:"woods"}
};
const ZONES={
  beach:(h)=>h>.12&&h<1.1,
  junk:(h)=>h>2&&h<9,
  woods:(h)=>h>4&&h<18
};
export class Pickups{
  constructor({scene,rand,fx,avoid}){
    Object.assign(this,{scene,rand,fx,avoid:avoid||(()=>false)});
    this.items=[];this.t=0;this.respawn=[];
    this.group=new THREE.Group();scene.add(this.group);
    for(const id in SPAWN)for(let i=0;i<SPAWN[id].n;i++)this.spawn(id);
  }
  spot(zone){
    for(let k=0;k<500;k++){
      const a=this.rand()*6.283,r=40+this.rand()*230,x=Math.cos(a)*r,z=Math.sin(a)*r,h=heightAt(x,z);
      if(ZONES[zone](h)&&slopeAt(x,z)<(zone==="beach"?.5:.4)&&!this.avoid(x,z))return [x,h,z];
    }
    return null;
  }
  spawn(id){
    const p=this.spot(SPAWN[id].zone);if(!p)return;
    const mesh=build(id);mesh.position.set(p[0],p[1],p[2]);mesh.rotation.y=this.rand()*6.283;this.group.add(mesh);
    this.items.push({id,x:p[0],y:p[1],z:p[2],mesh,bob:this.rand()*6});
  }
  nearest(px,pz,fx,fz,range=3.2){
    let best=null,bd=1e9;const fl=Math.hypot(fx,fz)||1;
    for(const it of this.items){
      const dx=it.x-px,dz=it.z-pz,d=Math.hypot(dx,dz);
      if(d<range&&d<bd&&(d<1.1||(dx*fx+dz*fz)/(d*fl)>.35)){bd=d;best=it}
    }
    return best;
  }
  /** A pickup that always comes back in the same place, for landmarks. */
  addFixed(id,x,y,z,secs=240){
    const mesh=build(id);mesh.position.set(x,y,z);mesh.rotation.y=this.rand()*6.283;this.group.add(mesh);
    this.items.push({id,x,y,z,mesh,bob:0,fixed:{x,y,z,secs}});
  }
  take(it){
    this.items.splice(this.items.indexOf(it),1);this.group.remove(it.mesh);
    this.respawn.push({id:it.id,at:this.t+(it.fixed?it.fixed.secs:60+this.rand()*80),fixed:it.fixed});
    const c=byId[it.id].color;this.fx.pixels.emit(new THREE.Vector3(it.x,it.y+.3,it.z),it.id==="pearl"||it.id==="coin"?24:10,[c,0xffffff],{speed:2.2,up:3.2,size:.09});
  }
  update(dt,px,pz){
    this.t+=dt;
    for(let i=this.respawn.length-1;i>=0;i--)if(this.t>=this.respawn[i].at){const r=this.respawn[i];if(r.fixed)this.addFixed(r.id,r.fixed.x,r.fixed.y,r.fixed.z,r.fixed.secs);else this.spawn(r.id);this.respawn.splice(i,1)}
    for(const it of this.items){
      if(it.id==="coin"||it.id==="pearl"||it.id==="crystal"){
        it.mesh.rotation.y+=dt*1.2;
        if(Math.hypot(it.x-px,it.z-pz)<40&&Math.random()<dt*1.4)this.fx.pixels.emit(new THREE.Vector3(it.x,it.y+.35,it.z),1,[0xffffff,0xfff2a8],{speed:.5,up:1.4,size:.06,life:.8,gravity:-1});
      }
    }
  }
}
