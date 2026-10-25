import * as THREE from "three";
import {buildTerrain,heightAt,WORLD} from "./terrain.js";
import {buildSky,buildClouds,SUN_DIR,HAZE} from "./sky.js";
import {buildWater} from "./water.js";
import {buildForest,buildDock,buildStall,buildMushrooms} from "./props.js";
import {Pixels,Rings} from "./fx.js";
import {Economy} from "./economy.js";
import {createHud} from "./hud.js";
import {createHands} from "./hands.js";
import {Fishing} from "./fishing.js";
import {createPost} from "./post.js";
import {Jobs} from "./jobs.js";
import {mulberry} from "./noise.js";

const canvas=document.getElementById("c");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const FOG=.0016;
scene.fog=new THREE.FogExp2(HAZE,FOG);
const camera=new THREE.PerspectiveCamera(68,1,.1,3000);scene.add(camera);
const uniforms={uTime:{value:0}};
const rand=mulberry(WORLD.seed);

scene.add(buildSky());
const clouds=buildClouds(rand);scene.add(clouds);
scene.add(buildTerrain());
const water=buildWater(FOG);scene.add(water);
const forest=buildForest(rand,uniforms);scene.add(forest);
const mushrooms=buildMushrooms(rand);scene.add(mushrooms);
// dock: walk out from the island centre until we hit water
let dockA=1.2,dx=0,dz=0;
for(let r=60;r<400;r+=1){dx=Math.cos(dockA)*r;dz=Math.sin(dockA)*r;if(heightAt(dx,dz)<.2){break}}
const DOCK_LEN=16,DOCK_W=3.4;
const dockPos=new THREE.Vector3(dx-Math.cos(dockA)*3,.55,dz-Math.sin(dockA)*3),dockRot=Math.PI/2-dockA;
const dock=buildDock(dockPos.x,dockPos.z,dockRot);scene.add(dock);
function onDock(x,z){
  const px=x-dockPos.x,pz=z-dockPos.z,c=Math.cos(dockRot),s_=Math.sin(dockRot);
  const lx=px*c-pz*s_,lz=px*s_+pz*c;
  return Math.abs(lx)<DOCK_W/2+.1&&lz>-.4&&lz<DOCK_LEN*.95+.5;
}
// market stall beside the dock, facing the water
const sideX=Math.cos(dockA+Math.PI/2),sideZ=Math.sin(dockA+Math.PI/2);
let sx=dockPos.x+sideX*11-Math.cos(dockA)*2,sz=dockPos.z+sideZ*11-Math.sin(dockA)*2;
for(let i=0;i<30&&heightAt(sx,sz)<.7;i++){sx-=Math.cos(dockA)*1.5;sz-=Math.sin(dockA)*1.5}
const stallPos=new THREE.Vector3(sx,heightAt(sx,sz),sz);
const stall=buildStall(sx,stallPos.y-.05,sz,dockRot);scene.add(stall);

const hemi=new THREE.HemisphereLight(0xcfe6ff,0xa09060,1.35);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d2,3.1);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.4;
const sc=sun.shadow.camera;sc.left=-90;sc.right=90;sc.top=90;sc.bottom=-90;sc.near=1;sc.far=500;
scene.add(sun,sun.target);

const fx={pixels:new Pixels(scene),rings:new Rings(scene)};
const eco=new Economy(),hud=createHud(),hands=createHands(camera);
const fishing=new Fishing({scene,camera,hands,fx,hud,eco});fishing.onDock=onDock;
const jobs=new Jobs({camera,hands,fx,hud,eco,forest,mushrooms});
function setTool(i){if(fishing.busy&&i!==0){hud.toast("Finish fishing first.");return}jobs.tool=i;hands.setTool(i);hud.select(i);if(i===1)hud.hint("Walk up to a tree, face it and click when the marker is in the green. Hit it three times. Press E near mushrooms to pick them.","Logging");else hud.hint("Aim at open water and click to cast.","Fishing")}
function refreshMoney(){hud.money(eco.money,eco.bag.length,eco.capacity)}
refreshMoney();
hud.hint("Aim at open water and click to cast. Walk to the market stall and press E to sell. WASD to move, Shift to run, arrow keys to look.","Getting started");
// camera: shots for review, or free fly
const q=new URLSearchParams(location.search),shot=q.get("shot"),FIXED=q.has("fixed");
if(q.has("lq")){renderer.shadowMap.enabled=false;renderer.setPixelRatio(1)}
const SHOTS={
  1:()=>({p:[dx-Math.cos(dockA)*14,6.5,dz-Math.sin(dockA)*14],look:[dx+Math.cos(dockA)*20,1,dz+Math.sin(dockA)*20]}),
  2:()=>({p:[-5,heightAt(-5,60)+2.6,60],look:[40,1,-30]}),
  3:()=>({p:[-60,40,150],look:[20,6,-40]}),
  4:()=>({p:[dx+Math.cos(dockA)*5,2.4,dz+Math.sin(dockA)*5+0],look:[dx-Math.cos(dockA)*30,5,dz-Math.sin(dockA)*30]})
};
const player={x:dockPos.x+Math.cos(dockA)*(DOCK_LEN*.9),z:dockPos.z+Math.sin(dockA)*(DOCK_LEN*.9),yaw:Math.atan2(-Math.cos(dockA),-Math.sin(dockA)),pitch:-.28,y:0};
function placeSun(c){
  sun.position.copy(c).addScaledVector(SUN_DIR,260);sun.target.position.copy(c);sun.target.updateMatrixWorld();
}
const post=new URLSearchParams(location.search).has("nopost")?null:createPost(renderer);
if(!post){renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(post)post.resize(w,h,renderer.getPixelRatio())}
addEventListener("resize",resize);resize();

const keys={};
addEventListener("keydown",e=>{keys[e.code]=true;
  if(e.code==="KeyE"&&!e.repeat)interact();
  if(e.code==="Escape"&&hud.marketOpen)closeMarket();
  if(e.code==="Digit1")setTool(0);
  if(e.code==="Digit2")setTool(1);
  if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();});
addEventListener("keyup",e=>keys[e.code]=false);
let noLock=false;
const look=(mx,my,k)=>{player.yaw-=mx*k;player.pitch=Math.max(-1.4,Math.min(1.4,player.pitch-my*k))};
addEventListener("mousemove",e=>{if(hud.marketOpen)return;if(document.pointerLockElement===canvas)look(e.movementX,e.movementY,.0023);else if(noLock&&e.target===canvas)look(e.movementX,e.movementY,.0023)});
canvas.addEventListener("mousedown",e=>{
  if(shot||e.button!==0||hud.marketOpen)return;
  if(document.pointerLockElement!==canvas&&!noLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{noLock=true})}catch(err){noLock=true}}
  if(jobs.tool===0)fishing.press();else jobs.press(player.x,player.z);
});
addEventListener("mouseup",()=>fishing.release());
function closeMarket(){hud.closeMarket();eco.save()}
function nearStall(){return Math.hypot(player.x-stallPos.x,player.z-stallPos.z)<6.5}
function interact(){
  if(hud.marketOpen){closeMarket();return}
  if(!fishing.busy&&jobs.pickMushroom(player.x,player.z))return;
  if(nearStall()&&!fishing.busy){
    if(document.exitPointerLock)document.exitPointerLock();
    hud.openMarket(eco,(kind,v)=>{
      if(kind==="sold"){hud.toast(`Sold your catch for $${v}`,"#ffd23a");fx.pixels.emit(new THREE.Vector3(stallPos.x,stallPos.y+2,stallPos.z).addScaledVector(new THREE.Vector3(Math.sin(dockRot),0,Math.cos(dockRot)),1.2),40,[0xffd23a,0xffb52e,0xfff0a0],{speed:4,up:6,size:.22,life:1.3,gravity:10})}
      else hud.toast("Upgrade bought","#6ee08a");
      refreshMoney();
    });
  }
}

let last=performance.now(),t=0,frames=0;
function frame(now){
  const dt=FIXED?1/30:Math.min(.05,(now-last)/1000);last=now;t+=dt;
  uniforms.uTime.value=t;water.material.uniforms.uTime.value=t;
  clouds.children.forEach(c=>{c.position.x+=c.userData.speed*dt;if(c.position.x>900)c.position.x=-900});
  if(shot&&SHOTS[shot]){const s=SHOTS[shot]();camera.position.set(...s.p);camera.lookAt(...s.look)}
  else{
    player.yaw+=((keys.ArrowLeft?1:0)-(keys.ArrowRight?1:0))*1.8*dt;player.pitch=Math.max(-1.4,Math.min(1.4,player.pitch+((keys.ArrowUp?1:0)-(keys.ArrowDown?1:0))*1.4*dt));
    const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0),sp=(keys.ShiftLeft?9:5)*dt*(fishing.state==="reeling"?.3:1)*(hud.marketOpen?0:1);
    const mx=(-Math.sin(player.yaw)*f+Math.cos(player.yaw)*r)*sp,mz=(-Math.cos(player.yaw)*f-Math.sin(player.yaw)*r)*sp;
    const ok=(x,z)=>onDock(x,z)||heightAt(x,z)>-.9;
    if(ok(player.x+mx,player.z+mz)){player.x+=mx;player.z+=mz}else if(ok(player.x+mx,player.z)){player.x+=mx}else if(ok(player.x,player.z+mz)){player.z+=mz}
    fishing.walk=Math.min(1,Math.hypot(mx,mz)/(dt*9));
    let gh=Math.max(heightAt(player.x,player.z),.2);if(onDock(player.x,player.z))gh=Math.max(gh,.72);
    player.y+=(gh+1.7-player.y)*Math.min(1,dt*12);
    camera.position.set(player.x,player.y,player.z);camera.rotation.set(player.pitch,player.yaw,0,"YXZ");
  }
  camera.updateMatrixWorld(true);
  fishing.update(dt);jobs.update(dt,player.x,player.z);hands.swing(jobs.swing);fx.pixels.update(dt);fx.rings.update(dt);
  if(eco.tick(dt)){hud.toast("The market prices shifted.");if(hud.marketOpen&&hud._redraw)hud._redraw()}
  const mu=!fishing.busy&&!hud.marketOpen?jobs.nearestMushroom(player.x,player.z):null;
  hud.prompt(mu?(mu.n.kind==="glowcap"?"[E] Pick the glowing mushroom":"[E] Pick mushroom"):(!fishing.busy&&!hud.marketOpen&&nearStall()?"[E] Open the market":null));
  refreshMoney();
  placeSun(camera.position);
  if(post)post.render(scene,camera);else renderer.render(scene,camera);
  frames++;window.__frames=frames;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ready=true;window.__dev={jobs,player,fishing,eco,hud,camera,stallPos,dockPos,dockA,scene,
  advance(sec){for(let i=0;i<sec*30;i++){camera.position.set(player.x,player.y,player.z);camera.rotation.set(player.pitch,player.yaw,0,"YXZ");camera.updateMatrixWorld(true);fishing.update(1/30);jobs.update(1/30,player.x,player.z);fx.pixels.update(1/30);fx.rings.update(1/30)}}};
