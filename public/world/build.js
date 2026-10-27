import * as THREE from "three";
import {PLOT} from "./town.js";
const lam=(c,o={})=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:.85,...o});
const M={wood:lam(0xb98a56),dark:lam(0x7a5530),plaster:lam(0xefe3c8),roof:lam(0x9a4a35),glass:lam(0xa6dcf2,{transparent:true,opacity:.45,roughness:.1}),
  cloth:lam(0xd25b5b),cloth2:lam(0x4a7fc4),green:lam(0x3f9a45),pot:lam(0xc9703c),lamp:lam(0xfff1b0,{emissive:0xffd96a,emissiveIntensity:1.1}),rug:lam(0x4a9aa6),rug2:lam(0xf0d9a0),pillow:lam(0xf6f6f6)};
const B=(w,h,d,m,x,y,z,g)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b};
export const WALL_H=2.6;
/** type -> {name, cost, snap: "cell"|"edge"|"half", make()} */
export const PIECES=[
  {t:"floor",name:"Floor",cost:8,snap:"cell",make(){const g=new THREE.Group();B(2,.14,2,M.wood,0,.07,0,g);B(2,.02,.05,M.dark,0,.15,0,g);return g}},
  {t:"wall",name:"Wall",cost:14,snap:"edge",wall:1,make(){const g=new THREE.Group();B(2,WALL_H,.2,M.plaster,0,WALL_H/2,0,g);B(2,.25,.24,M.dark,0,.13,0,g);return g}},
  {t:"window",name:"Window",cost:20,snap:"edge",wall:1,make(){const g=new THREE.Group();
    B(2,.9,.2,M.plaster,0,.45,0,g);B(2,.7,.2,M.plaster,0,2.25,0,g);B(.5,1.0,.2,M.plaster,-.75,1.4,0,g);B(.5,1.0,.2,M.plaster,.75,1.4,0,g);
    B(1,.9,.04,M.glass,0,1.4,0,g);B(1.04,.05,.1,M.dark,0,1.88,0,g);B(1.04,.05,.1,M.dark,0,.93,0,g);B(.04,.9,.1,M.dark,0,1.4,0,g);return g}},
  {t:"door",name:"Doorway",cost:24,snap:"edge",wall:0,make(){const g=new THREE.Group();
    B(.55,WALL_H,.2,M.plaster,-.725,WALL_H/2,0,g);B(.55,WALL_H,.2,M.plaster,.725,WALL_H/2,0,g);B(1,.6,.2,M.plaster,0,2.3,0,g);
    const d=B(.9,1.95,.07,M.wood,-.45,.98,.5,g);d.rotation.y=-1.1;d.position.set(-.45+.0,.98,.18);return g}},
  {t:"roof",name:"Roof",cost:18,snap:"cell",make(){const g=new THREE.Group();B(2.3,.16,2.3,M.roof,0,WALL_H+.08,0,g);return g}},
  {t:"table",name:"Table",cost:45,snap:"half",make(){const g=new THREE.Group();B(1.3,.08,.85,M.wood,0,.78,0,g);for(const x of [-.55,.55])for(const z of [-.32,.32])B(.08,.74,.08,M.dark,x,.4,z,g);return g}},
  {t:"chair",name:"Chair",cost:25,snap:"half",make(){const g=new THREE.Group();B(.5,.06,.5,M.wood,0,.5,0,g);B(.5,.6,.06,M.wood,0,.82,-.22,g);for(const x of [-.2,.2])for(const z of [-.2,.2])B(.06,.5,.06,M.dark,x,.26,z,g);return g}},
  {t:"bed",name:"Bed",cost:110,snap:"half",make(){const g=new THREE.Group();B(1.1,.3,2.1,M.dark,0,.25,0,g);B(1,.2,1.9,M.cloth2,0,.5,0,g);B(.8,.14,.4,M.pillow,0,.66,-.7,g);B(1.1,.7,.1,M.dark,0,.65,-1.05,g);return g}},
  {t:"lamp",name:"Lamp",cost:40,snap:"half",make(){const g=new THREE.Group();B(.08,1.5,.08,M.dark,0,.75,0,g);B(.45,.35,.45,M.lamp,0,1.55,0,g);B(.4,.05,.4,M.dark,0,.03,0,g);return g}},
  {t:"plant",name:"Plant",cost:22,snap:"half",make(){const g=new THREE.Group();B(.4,.4,.4,M.pot,0,.2,0,g);const l=new THREE.Mesh(new THREE.IcosahedronGeometry(.38,0),M.green);l.position.set(0,.7,0);l.castShadow=true;g.add(l);return g}},
  {t:"chest",name:"Chest (safe storage)",cost:90,snap:"half",make(){const g=new THREE.Group();B(1.1,.6,.7,M.wood,0,.3,0,g);const lid=B(1.14,.22,.74,M.dark,0,.7,0,g);B(.14,.2,.06,lam(0xe8c24a),0,.55,.37,g);for(const x of [-.4,.4])B(.08,.64,.74,M.dark,x,.32,0,g);return g}},
  {t:"bench",name:"Workbench (crafting)",cost:130,snap:"half",make(){const g=new THREE.Group();B(1.5,.12,.8,M.wood,0,.85,0,g);for(const x of [-.65,.65])for(const z of [-.32,.32])B(.1,.82,.1,M.dark,x,.42,z,g);B(1.4,.06,.7,M.dark,0,.4,0,g);B(.1,.5,.1,lam(0x8a8a90),-.4,1.15,0,g);B(.35,.12,.12,lam(0x8a8a90),-.3,1.4,0,g);B(.3,.08,.2,lam(0xc9703c),.35,.93,0,g);return g}},
  {t:"tank",name:"Fish tank (earns money)",cost:260,snap:"half",make(){const g=new THREE.Group();B(1.3,.5,.7,M.dark,0,.25,0,g);B(1.2,.7,.6,lam(0x6fc4e8,{transparent:true,opacity:.5,roughness:.1}),0,.85,0,g);B(1.3,.06,.76,M.dark,0,1.22,0,g);B(.25,.12,.1,lam(0xffa52e),-.2,.9,0,g);B(.2,.1,.1,lam(0xff6a4a),.25,.7,.05,g);B(1.1,.05,.5,lam(0xe9dca4),0,.55,0,g);return g}},
  {t:"garden",name:"Herb garden (earns money)",cost:180,snap:"half",make(){const g=new THREE.Group();B(1.5,.3,.9,M.dark,0,.15,0,g);B(1.36,.12,.76,lam(0x5a3a22),0,.32,0,g);for(let i=0;i<6;i++){const l=new THREE.Mesh(new THREE.IcosahedronGeometry(.17,0),i%2?M.green:lam(0x6fbf4a));l.position.set(-.55+i*.22,.52,(i%2?.18:-.18));l.castShadow=true;g.add(l)}B(.12,.14,.12,lam(0xe86bd0),.3,.62,.2,g);return g}},
  {t:"gable",name:"Pitched roof",cost:30,snap:"cell",make(){const g=new THREE.Group();const sh=new THREE.Shape();sh.moveTo(-1.25,0);sh.lineTo(1.25,0);sh.lineTo(0,1.1);sh.closePath();const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:2.3,bevelEnabled:false}),M.roof);m.position.set(0,WALL_H,-1.15);m.castShadow=true;m.receiveShadow=true;g.add(m);return g}},
  {t:"rug",name:"Rug",cost:35,snap:"half",make(){const g=new THREE.Group();B(1.8,.03,1.2,M.rug,0,.16,0,g);B(1.4,.035,.8,M.rug2,0,.165,0,g);return g}}
];
export const byT=Object.fromEntries(PIECES.map(p=>[p.t,p]));
const R=PLOT/2;
export class Builder{
  constructor({scene,camera,eco,hud,town,fx}){
    Object.assign(this,{scene,camera,eco,hud,town,fx});
    this.active=false;this.sel=0;this.rot=0;this.snap=true;this.valid=false;this.pos=null;
    this.group=new THREE.Group();scene.add(this.group);this.meshes=[];this.ghost=null;
    this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.hit=new THREE.Vector3();
    this.load();
  }
  get plot(){return this.eco.myPlot==null?null:this.town.plots[this.eco.myPlot]}
  load(){for(const m of this.meshes)this.group.remove(m.mesh);this.meshes=[];for(const p of this.eco.pieces)this.addMesh(p)}
  addMesh(p){const d=byT[p.t];if(!d||!this.plot)return;const g=d.make();const pl=this.plot;g.position.set(pl.x+p.x,pl.y,pl.z+p.z);g.rotation.y=p.r;this.group.add(g);this.meshes.push({p,mesh:g})}
  setActive(on){
    this.active=on&&!!this.plot;
    if(this.ghost){this.scene.remove(this.ghost);this.ghost=null}
    this.ghostT=null;this.hud.buildPanel(null);
  }
  cycle(d){this.sel=(this.sel+d+PIECES.length)%PIECES.length;this.rot=0;this.ghostT=null}
  rotate(){this.rot+=this.snap?Math.PI/2:Math.PI/12;this.rot%=Math.PI*2}
  toggleSnap(){this.snap=!this.snap;this.hud.toast(this.snap?"Snap to grid on":"Free placement: pieces go exactly where you aim","#9ad4f0")}
  /** Where the aimed piece would go, in plot-local coordinates, snapped if snapping is on. */
  target(){
    const pl=this.plot,d=PIECES[this.sel];
    this.ray.setFromCamera({x:0,y:0},this.camera);this.plane.constant=-pl.y;
    if(!this.ray.ray.intersectPlane(this.plane,this.hit)||this.hit.distanceTo(this.camera.position)>16)return null;
    let x=this.hit.x-pl.x,z=this.hit.z-pl.z,r=this.rot;
    if(this.snap){
      if(d.snap==="cell"){x=Math.floor((x+R)/2)*2+1-R;z=Math.floor((z+R)/2)*2+1-R;r=0}
      else if(d.snap==="half"){x=Math.round(x*2)/2;z=Math.round(z*2)/2}
      else{ // edges: pick the nearest wall line
        const cx=Math.floor((x+R)/2)*2+1-R,cz=Math.floor((z+R)/2)*2+1-R;
        const ez=Math.round(z/2)*2,ex=Math.round(x/2)*2;
        if(Math.abs(z-ez)<Math.abs(x-ex)){x=cx;z=ez;r=0}else{x=ex;z=cz;r=Math.PI/2}
      }
    }
    return {x,z,r};
  }
  update(){
    if(!this.active)return;
    const d=PIECES[this.sel];
    if(this.ghostT!==d.t){if(this.ghost)this.scene.remove(this.ghost);this.ghost=d.make();this.ghost.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.55;o.castShadow=false}});this.scene.add(this.ghost);this.ghostT=d.t}
    const t=this.target();this.pos=t;
    if(!t){this.ghost.visible=false;this.valid=false}
    else{
      const pl=this.plot;this.ghost.visible=true;this.ghost.position.set(pl.x+t.x,pl.y,pl.z+t.z);this.ghost.rotation.y=t.r;
      const inside=Math.abs(t.x)<=R-.05&&Math.abs(t.z)<=R-.05;
      const dup=this.eco.pieces.some(p=>p.t===d.t&&Math.abs(p.x-t.x)<.01&&Math.abs(p.z-t.z)<.01&&Math.abs(p.r-t.r)<.01);
      this.valid=inside&&!dup&&this.eco.money>=d.cost&&this.eco.pieces.length<400;
      const col=this.valid?0x9dff9d:(this.eco.money<d.cost?0xffc27a:0xff7a7a);
      this.ghost.traverse(o=>{if(o.isMesh)o.material.emissive&&o.material.emissive.setHex(0).add(new THREE.Color(col).multiplyScalar(.35))});
    }
    this.hud.buildPanel({list:PIECES.map((p,i)=>({name:p.name,cost:p.cost,sel:i===this.sel})),snap:this.snap,money:this.eco.money});
  }
  place(){
    if(!this.active||!this.pos)return;const d=PIECES[this.sel];
    if(!this.valid){this.hud.toast(this.eco.money<d.cost?"Not enough money":"Can't place that here","#ff7b6b");return}
    const p={t:d.t,x:+this.pos.x.toFixed(3),z:+this.pos.z.toFixed(3),r:+this.pos.r.toFixed(4)};
    this.eco.money-=d.cost;this.eco.pieces.push(p);this.addMesh(p);this.eco.save();
    const pl=this.plot;this.fx.pixels.emit(new THREE.Vector3(pl.x+p.x,pl.y+.4,pl.z+p.z),8,[0xf2d9a0,0xffffff],{speed:1.6,up:2,size:.08});
  }
  /** Remove the piece you are aiming at and get most of the money back. */
  remove(){
    if(!this.active)return;
    this.ray.setFromCamera({x:0,y:0},this.camera);
    const objs=this.meshes.map(m=>m.mesh);const hit=this.ray.intersectObjects(objs,true)[0];
    if(!hit||hit.distance>14){this.hud.toast("Aim at a piece to remove it");return}
    let o=hit.object;while(o&&!objs.includes(o))o=o.parent;
    const i=this.meshes.findIndex(m=>m.mesh===o);if(i<0)return;
    const {p}=this.meshes[i];this.group.remove(o);this.meshes.splice(i,1);this.eco.pieces.splice(this.eco.pieces.indexOf(p),1);
    const back=Math.round(byT[p.t].cost*.7);this.eco.money+=back;this.eco.save();this.hud.toast(`Removed ${byT[p.t].name}, got back $${back}`,"#9ad4f0");
  }
  /** Solid walls and windows stop the player. */
  blocked(x,z){
    const pl=this.plot;if(!pl||!this.meshes.length)return false;
    const lx=x-pl.x,lz=z-pl.z;if(Math.abs(lx)>R+2||Math.abs(lz)>R+2)return false;
    for(const {p} of this.meshes){
      if(p.t!=="wall"&&p.t!=="window"&&p.t!=="door")continue;
      const dx=lx-p.x,dz=lz-p.z,c=Math.cos(p.r),s=Math.sin(p.r),al=dx*c-dz*s,ac=dx*s+dz*c;
      if(p.t==="door"){if(Math.abs(ac)<.35&&Math.abs(al)<1.05&&Math.abs(al)>.5)return true;continue}
      if(Math.abs(ac)<.38&&Math.abs(al)<1.08)return true;
    }
    return false;
  }
}
