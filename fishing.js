import * as THREE from "three";
import {mergeParts} from "./props.js";
import {rollFish} from "./economy.js";
import {heightAt} from "./terrain.js";
import {waveHeight} from "./water.js";

const SPLASH=[0xffffff,0xcfeeff,0x8fd0f5],COIN=[0xffd23a,0xffb52e,0xfff0a0];
function fishMesh(f,scale){
  const L=f.len,P=[],M=new THREE.Matrix4();
  const at=(x,y,z,sx,sy,sz,ry=0,rz=0)=>M.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,rz)),new THREE.Vector3(sx,sy,sz)).clone();
  if(f.round){
    P.push({geo:new THREE.IcosahedronGeometry(.42,1),color:f.color,m:at(0,0,0,1,1,1)},{geo:new THREE.IcosahedronGeometry(.3,0),color:f.belly,m:at(0,-.18,.1,1,.7,1)});
    for(let i=0;i<14;i++){const a=i*2.4,y=Math.cos(i*1.7)*.35;P.push({geo:new THREE.ConeGeometry(.05,.22,4),color:0xe8c37a,m:at(Math.cos(a)*.4,y,Math.sin(a)*.4,1,1,1)})}
  }else{
    P.push({geo:new THREE.IcosahedronGeometry(.5,1),color:f.color,m:at(0,0,0,L*1.1,.38*L+.1,.22*L+.05)});
    P.push({geo:new THREE.IcosahedronGeometry(.4,0),color:f.belly,m:at(0,-.08*L,0,L*.95,.22*L+.05,.2*L+.04)});
    P.push({geo:new THREE.ConeGeometry(.28*L,.5*L,4),color:f.color,m:M.compose(new THREE.Vector3(-.62*L,0,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,Math.PI/2)),new THREE.Vector3(1,.15,1)).clone()});
    P.push({geo:new THREE.ConeGeometry(.12*L,.3*L,4),color:f.color,m:at(0,.2*L+.05,0,1,1,.2)});
  }
  P.push({geo:new THREE.BoxGeometry(.1,.1,.05),color:0xffffff,m:at(.45*(f.round?.5:L),.05,.12,1,1,1)},{geo:new THREE.BoxGeometry(.05,.05,.06),color:0x111111,m:at(.47*(f.round?.5:L),.05,.14,1,1,1)});
  const mesh=new THREE.Mesh(mergeParts(P),new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.6}));
  mesh.scale.setScalar(scale);return mesh;
}

export class Fishing{
  constructor({scene,camera,hands,fx,hud,eco}){
    Object.assign(this,{scene,camera,hands,fx,hud,eco});
    this.state="idle";this.t=0;this.held=false;this.time=0;
    const bob=new THREE.Group();
    bob.add(new THREE.Mesh(new THREE.SphereGeometry(.16,8,6,0,6.283,0,1.571),new THREE.MeshStandardMaterial({color:0xf2f2f2,flatShading:true})));
    const top=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6,0,6.283,1.571,1.571),new THREE.MeshStandardMaterial({color:0xe5372d,flatShading:true}));bob.add(top);
    const stick=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.3,4),new THREE.MeshStandardMaterial({color:0xffd23a}));stick.position.set(0,.22,0);bob.add(stick);
    bob.visible=false;scene.add(bob);this.bobber=bob;
    const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(14*3),3));
    this.line=new THREE.Line(lg,new THREE.LineBasicMaterial({color:0xf4f4f4}));this.line.frustumCulled=false;this.line.visible=false;scene.add(this.line);
    this.target=new THREE.Vector3();this.from=new THREE.Vector3();this.pop=null;this.fish=null;
    this.reel={tension:.3,progress:0,zoneC:.5,hw:.15,p:[Math.random()*9,Math.random()*9,Math.random()*9],splashT:0,fail:0};
  }
  get busy(){return this.state!=="idle"}
  press(){
    this.held=true;
    if(this.hud.marketOpen)return;
    const s=this.state;
    if(s==="idle")this.cast();
    else if(s==="waiting"){this.hud.toast("Too early. Wait for the float to dip.");this.reset()}
    else if(s==="bite")this.hook();
  }
  release(){this.held=false}
  cast(){
    const d=new THREE.Vector3();this.camera.getWorldDirection(d);
    const o=this.camera.getWorldPosition(new THREE.Vector3());
    if(d.y>=-.02){this.hud.toast("Aim lower, at open water.");return}
    const k=-o.y/d.y,p=o.clone().addScaledVector(d,k);
    const dist=Math.hypot(p.x-o.x,p.z-o.z);
    if(dist<4||dist>55||heightAt(p.x,p.z)>-.5||(this.onDock&&this.onDock(p.x,p.z))){this.hud.toast(dist>55?"Too far. Aim closer.":dist<4?"Too close. Aim farther out.":"Aim at open water.");return}
    this.target.copy(p);this.state="casting";this.t=0;this.hud.hint("");
  }
  reset(){this.state="idle";this.bobber.visible=false;this.line.visible=false;this.hud.bite(false);this.hud.reel(false);this.t=0}
  hook(){
    this.hud.bite(false);this.hud.hint("");
    this.fish=rollFish(this.eco.up.bait);
    this.fishW=Math.round((.5+Math.random()*1.4)*10)/10;
    const r=this.reel;r.tension=.35;r.progress=.12;r.hw=.14+this.eco.up.rod*.035-this.fish.pull*.025;r.fail=0;r.zoneC=.5;
    r.p=[Math.random()*9,Math.random()*9,Math.random()*9];
    this.state="reeling";this.t=0;
    this.fx.rings.start(this.bobber.position.x,this.bobber.position.y,this.bobber.position.z,3.2,.9);
    this.fx.pixels.emit(this.bobber.position,26,SPLASH,{speed:3.5,up:6,size:.16});
  }
  update(dt){
    this.time+=dt;this.t+=dt;
    const s=this.state,hands=this.hands,b=this.bobber;
    let cast=0,reeling=false,tension=0;
    if(s==="casting"){
      const T=.55;cast=Math.min(1,this.t/T);
      if(this.t>=T){ // release the float
        this.state="flying";this.t=0;this.from.copy(hands.tipPos());b.visible=true;b.position.copy(this.from);this.line.visible=true;
      }
    }else if(s==="flying"){
      const D=.8,k=Math.min(1,this.t/D),dist=Math.hypot(this.target.x-this.from.x,this.target.z-this.from.z);
      b.position.set(this.from.x+(this.target.x-this.from.x)*k,this.from.y+(this.target.y-this.from.y)*k+Math.sin(k*Math.PI)*(3+dist*.12),this.from.z+(this.target.z-this.from.z)*k);
      cast=1-Math.min(1,this.t*2);
      if(k>=1){
        this.state="waiting";this.t=0;this.wait=(2.2+Math.random()*5.5)/(1+this.eco.up.bait*.3);
        this.fx.rings.start(b.position.x,0,b.position.z,2.4,1.2);this.fx.pixels.emit(new THREE.Vector3(b.position.x,0,b.position.z),22,SPLASH,{speed:2.4,up:5,size:.14});
        this.hud.hint("Wait for the float to dip, then click.","Fishing");
      }
    }else if(s==="waiting"||s==="bite"){
      const y=waveHeight(b.position.x,b.position.z,this.time)+.06;
      if(s==="waiting"){
        b.position.y=y+Math.sin(this.time*2.3)*.025;
        if(this.t>=this.wait){this.state="bite";this.t=0;this.hud.bite(true);this.hud.hint("");
          this.fx.rings.start(b.position.x,y,b.position.z,2.6,.9);this.fx.pixels.emit(new THREE.Vector3(b.position.x,y,b.position.z),14,SPLASH,{speed:2,up:4,size:.12})}
        else if(Math.random()<dt*.5)this.fx.rings.start(b.position.x,y,b.position.z,1.1,1.3); // idle ripples
      }else{
        b.position.y=y-.18-Math.abs(Math.sin(this.time*14))*.12;
        if(Math.random()<dt*7)this.fx.rings.start(b.position.x,y,b.position.z,1.8,.7);
        if(this.t>1.5){this.hud.bite(false);this.hud.toast("It got away.");this.reset()}
      }
    }else if(s==="reeling"){
      reeling=this.held;const r=this.reel,f=this.fish;
      r.tension+=(this.held?.62:-.5)*dt;
      const n=Math.sin(this.time*1.9+r.p[0])+.6*Math.sin(this.time*3.3+r.p[1])+.35*Math.sin(this.time*6.1+r.p[2]);
      r.tension+=n*.17*f.pull*dt*2.2;
      r.zoneC=.5+.2*Math.sin(this.time*.55*f.pull+r.p[2])*Math.min(1,f.pull);
      r.tension=Math.max(0,Math.min(1.05,r.tension));
      const inZone=Math.abs(r.tension-r.zoneC)<r.hw;
      r.progress+=(inZone?.27:-.13)*dt;r.progress=Math.max(0,r.progress);
      tension=r.tension;
      // float tugs toward the shore as the fish tires, and thrashes
      const tw=hands.tipPos(),k=Math.min(1,r.progress);
      b.position.x+=(tw.x+(this.target.x-tw.x)*(1-k)*.9-b.position.x)*dt*1.5;b.position.z+=(tw.z+(this.target.z-tw.z)*(1-k)*.9-b.position.z)*dt*1.5;
      b.position.y=waveHeight(b.position.x,b.position.z,this.time)+.05;
      r.splashT-=dt;if(r.splashT<=0){r.splashT=.18+Math.random()*.25;this.fx.pixels.emit(new THREE.Vector3(b.position.x,b.position.y,b.position.z),6,SPLASH,{speed:2,up:3,size:.1});this.fx.rings.start(b.position.x,b.position.y,b.position.z,1.5,.7)}
      this.hud.reel(true,{name:"Something big...",lo:Math.max(0,r.zoneC-r.hw),hi:Math.min(1,r.zoneC+r.hw),tension:r.tension,progress:r.progress});
      if(r.tension>=1.03){this.hud.toast("The line snapped!","#ff7b6b");this.hud.reel(false);this.reset()}
      else if(r.progress>=1){this.land()}
    }else if(s==="landing"){
      const p=this.pop,k=Math.min(1,this.t/.75);
      const o=this.camera.getWorldPosition(new THREE.Vector3()),d=this.camera.getWorldDirection(new THREE.Vector3());
      const end=o.clone().addScaledVector(d,2.6);end.y-=.3;
      if(k<1){
        p.mesh.position.lerpVectors(p.start,end,k);p.mesh.position.y+=Math.sin(k*Math.PI)*2.2;
        p.mesh.rotation.set(0,this.time*8,Math.sin(this.time*20)*.4);
      }else{
        p.mesh.position.copy(end);p.mesh.position.y+=Math.sin(this.time*3)*.04;p.mesh.rotation.set(0,Math.PI/2+this.camera.rotation.y*0,Math.sin(this.time*18)*.15*Math.max(0,1.4-this.t));
      }
      if(this.t>1.7){this.scene.remove(p.mesh);p.mesh.geometry.dispose();this.pop=null;this.reset()}
    }
    // line from rod tip to float
    if(this.line.visible){
      const a=hands.tipPos(),pos=this.line.geometry.attributes.position,bp=b.position;
      const taut=s==="reeling"?this.reel.tension:.1;
      for(let i=0;i<14;i++){const u=i/13;
        pos.setXYZ(i,a.x+(bp.x-a.x)*u,a.y+(bp.y+.2-a.y)*u-Math.sin(u*Math.PI)*(1-taut)*Math.min(3,Math.hypot(bp.x-a.x,bp.z-a.z)*.07),a.z+(bp.z-a.z)*u)}
      pos.needsUpdate=true;
      if(s==="landing")this.line.visible=false;
    }
    hands.update(dt,this.walk||0,cast,reeling,tension,this.hideRod);
  }
  land(){
    const f=this.fish,eco=this.eco;this.hud.reel(false);
    const entry={id:f.id,w:this.fishW};
    const mesh=fishMesh(f,.75+this.fishW*.25);this.scene.add(mesh);
    this.pop={mesh,start:this.bobber.position.clone()};
    this.state="landing";this.t=0;this.bobber.visible=false;
    this.fx.rings.start(this.bobber.position.x,this.bobber.position.y,this.bobber.position.z,3.4,1);
    this.fx.pixels.emit(this.bobber.position,34,SPLASH,{speed:4,up:7,size:.18});
    const ok=eco.addFish(entry);
    const val=eco.value(entry);
    setTimeout(()=>{
      const o=this.camera.getWorldPosition(new THREE.Vector3()),d=this.camera.getWorldDirection(new THREE.Vector3());
      this.fx.pixels.emit(o.clone().addScaledVector(d,2.8),ok?28:0,COIN,{speed:2.4,up:3.2,size:.07,life:1.2,gravity:7});
    },750);
    this.hud.toast(ok?`Caught a ${f.name} (${this.fishW} kg), worth about $${val}`:`Bag full! Sell at the market. The ${f.name} swims away.`,ok?"#ffd23a":"#ff7b6b");
    this.hud.hint("Click to cast again. Take your fish to the market stall near the dock and press E.","Nice catch");
    setTimeout(()=>{if(this.state==="idle")this.hud.hint("Aim at open water and click to cast. Press E at the market stall to sell.","Fishing")},7000);
  }
}
