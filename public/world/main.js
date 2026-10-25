import * as THREE from "three";
import {buildTerrain,heightAt,WORLD} from "./terrain.js";
import {buildSky,buildClouds,SUN_DIR,HAZE} from "./sky.js";
import {buildWater} from "./water.js";
import {buildForest,buildDock,buildStall,buildMushrooms} from "./props.js";
import {Pixels,Rings} from "./fx.js";
import {Economy,byId as ITEMS} from "./economy.js";
import {createHud} from "./hud.js";
import {createHands} from "./hands.js";
import {Fishing} from "./fishing.js";
import {createPost} from "./post.js";
import {Jobs} from "./jobs.js";
import {mulberry} from "./noise.js";
import {Pickups} from "./pickups.js";
import {Town} from "./town.js";
import {Builder} from "./build.js";
import {POIs} from "./poi.js";
import {openCustomizer,loadLook} from "./customize.js";

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
const LOOK=loadLook();
const eco=new Economy(mulberry(Date.now()&0xffff)),hud=createHud(),hands=createHands(camera,LOOK);
const fishing=new Fishing({scene,camera,hands,fx,hud,eco});fishing.onDock=onDock;
const jobs=new Jobs({camera,hands,fx,hud,eco,forest,mushrooms});
const town=new Town({scene,eco,forest,mushrooms,stallPos,rand:mulberry(WORLD.seed+77),fx});
const pickups=new Pickups({scene,rand:mulberry(Date.now()&0xfffff),fx,avoid:(x,z)=>!!town.plotAt(x,z,4)||Math.hypot(x-stallPos.x,z-stallPos.z)<8||onDock(x,z)});
const builder=new Builder({scene,camera,eco,hud,town,fx});
const poi=new POIs({scene,rand:mulberry(WORLD.seed+5),pickups,fx,dockA,stallPos,avoid:(x,z)=>!!town.plotAt(x,z,8)});
town.clearCircle(forest,mushrooms,poi.cave.x,poi.cave.z,15);town.clearCircle(forest,mushrooms,poi.village.x,poi.village.z,26);town.clearCircle(forest,mushrooms,poi.lighthouse.x,poi.lighthouse.z,8);
const HINTS=[
  ()=>eco.tools.rod?"Aim at open water and click to cast. Click again when the float dips.":"You don't own a rod yet. Buy one at the market stall.",
  ()=>eco.tools.axe?"Face a tree and click to chop it. Keep clicking until it falls.":"You don't own an axe yet. Buy one at the market stall.",
  ()=>"Click to place, right-click to remove, scroll to change the piece, R to rotate, G toggles the snap grid.",
  ()=>"Walk up to things on the ground and press E to pick them up."
];
const TITLES=["Fishing","Logging","Building","Hands"];
function setTool(i){
  if(fishing.busy&&i!==0){hud.toast("Finish fishing first.");return}
  if(i===2&&eco.myPlot==null){hud.toast("Buy a house plot first. Look for a FOR SALE sign.","#ff7b6b");return}
  jobs.tool=i;hands.setTool(i);hud.select(i);builder.setActive(i===2);hud.hint(HINTS[i](),TITLES[i]);
}
function refreshMoney(){hud.money(eco.money,eco.bag.length,eco.capacity)}
refreshMoney();
jobs.tool=3;hands.setTool(3);hud.select(3);
hud.hint(eco.loaded?"Welcome back. Press Tab any time to see where the landmarks are, and C to change how your character looks. Your progress was saved. Walk up to things on the ground and press E to pick them up, then sell them at the market stall.":"You start with nothing. Walk along the beach and press E to pick up shells, bottles and driftwood, then sell them at the market stall near the dock. WASD to move, Shift to run.","Side Hustle");
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
addEventListener("keydown",e=>{if(window.__modal)return;keys[e.code]=true;
  if(e.code==="KeyE"&&!e.repeat)interact();
  if(e.code==="Escape"&&hud.marketOpen)closeMarket();
  if(e.code==="Digit1")setTool(0);
  if(e.code==="Digit2")setTool(1);
  if(e.code==="Digit3")setTool(2);
  if(e.code==="Digit4")setTool(3);
  if(e.code==="KeyC"&&!hud.marketOpen&&!builder.active){if(document.exitPointerLock)document.exitPointerLock();openCustomizer(()=>{eco.save();location.reload()})}
  if(e.code==="Tab"){e.preventDefault();landmarks()}
  if(builder.active){
    if(e.code==="KeyR")builder.rotate();
    if(e.code==="KeyG")builder.toggleSnap();
    if(e.code==="BracketRight")builder.cycle(1);
    if(e.code==="BracketLeft")builder.cycle(-1);
  }
  if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();});
addEventListener("keyup",e=>keys[e.code]=false);
let noLock=false;
const look=(mx,my,k)=>{player.yaw-=mx*k;player.pitch=Math.max(-1.4,Math.min(1.4,player.pitch-my*k))};
addEventListener("mousemove",e=>{if(hud.marketOpen||window.__modal)return;if(document.pointerLockElement===canvas)look(e.movementX,e.movementY,.0023);else if(noLock&&e.target===canvas)look(e.movementX,e.movementY,.0023)});
addEventListener("contextmenu",e=>e.preventDefault());
addEventListener("wheel",e=>{if(builder.active)builder.cycle(e.deltaY>0?1:-1)},{passive:true});
canvas.addEventListener("mousedown",e=>{
  if(shot||hud.marketOpen||window.__modal)return;
  if(e.button===2){if(builder.active)builder.remove();return}
  if(e.button!==0)return;
  if(document.pointerLockElement!==canvas&&!noLock){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{noLock=true})}catch(err){noLock=true}}
  if(jobs.tool===0)fishing.press();else if(jobs.tool===1)jobs.press(player.x,player.z);else if(jobs.tool===2)builder.place();
});
addEventListener("mouseup",()=>fishing.release());
function closeMarket(){hud.closeMarket();eco.save()}
function nearStall(){return Math.hypot(player.x-stallPos.x,player.z-stallPos.z)<6.5}
function lookDir(){const d=camera.getWorldDirection(new THREE.Vector3());return d}
function nearbyPickup(){const d=lookDir();return pickups.nearest(player.x,player.z,d.x,d.z)}
function openMarket(loc="dock"){
  if(document.exitPointerLock)document.exitPointerLock();
  hud.openMarket(eco,(kind,v)=>{
    if(kind==="sold"){hud.toast(`Sold everything for $${v}`,"#ffd23a");fx.pixels.emit(new THREE.Vector3(stallPos.x,stallPos.y+2,stallPos.z).addScaledVector(new THREE.Vector3(Math.sin(dockRot),0,Math.cos(dockRot)),1.2),40,[0xffd23a,0xffb52e,0xfff0a0],{speed:4,up:6,size:.22,life:1.3,gravity:10})}
    else{hud.toast(v==="rod"?"You bought a rod! Press 1, then cast at open water.":v==="axe"?"You bought an axe! Press 2 and chop a tree.":"Bought.","#6ee08a");if(v==="rod"||v==="axe")setTool(v==="rod"?0:1)}
    refreshMoney();
  },loc);
}
function nearVillage(){return Math.hypot(player.x-poi.village.stall.x,player.z-poi.village.stall.z)<6}
function nearLightDoor(){return Math.hypot(player.x-poi.lighthouse.door.x,player.z-poi.lighthouse.door.z)<4}
function landmarks(){
  const rows=poi.list.map(p=>{const dx=p.x-player.x,dz=p.z-player.z,d=Math.round(Math.hypot(dx,dz));let rel=Math.atan2(-dx,-dz)-player.yaw;rel=Math.atan2(Math.sin(rel),Math.cos(rel));
    const dir=Math.abs(rel)<.5?"ahead":Math.abs(rel)>2.6?"behind you":rel>0?"to your left":"to your right";return `${p.name}: ${d} m, ${dir}`});
  rows.push(`Dock market: ${Math.round(Math.hypot(stallPos.x-player.x,stallPos.z-player.z))} m`);
  hud.hint(rows.join("<br>"),"Landmarks (Tab)");
}
function interact(){
  if(hud.marketOpen){closeMarket();return}
  if(fishing.busy)return;
  const pk=nearbyPickup();
  if(pk){
    const id=pk.id;
    if(eco.addItem(id)){pickups.take(pk);const G=ITEMS[id];hud.toast(`Picked up ${G.name} (worth about $${eco.price(id)})`,G.kind==="rare"?"#4fe8ff":"#ffd23a")}
    else hud.toast("Bag full! Sell at the market stall.","#ff7b6b");
    return;
  }
  if(jobs.pickMushroom(player.x,player.z))return;
  if(nearStall()){openMarket();return}
  if(nearVillage()){openMarket("village");return}
  if(nearLightDoor()||player.top){
    if(player.top){const d=poi.lighthouse.door;player.x=d.x;player.z=d.z+1.5;player.top=false;hud.toast("Back on the ground.")}
    else{player.top=true;player.x=poi.lighthouse.x+2.6;player.z=poi.lighthouse.z;hud.toast("What a view! Press E to climb down.","#9ad4f0")}
    return;
  }
  const sp=town.nearestSign(player.x,player.z);
  if(sp){
    const owner=eco.house.owners[sp.id];
    if(!owner){
      if(eco.myPlot!=null)hud.toast("You already own a plot.");
      else if(eco.buyPlot(sp.id)){town.refresh();builder.load();hud.toast("You bought a plot! Press 3 to start building.","#6ee08a");setTool(2);refreshMoney()}
      else hud.toast(`That plot costs $${eco.plotPrice(sp.id).toLocaleString()}. Land gets pricier as neighbours move in!`,"#ff7b6b");
    }else if(owner==="me")hud.toast("This is your plot. Press 3 to build.");
    else hud.toast("A neighbour lives here.");
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
    const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0),sp=(keys.ShiftLeft?9:5)*eco.speedMul*dt*(fishing.state==="reeling"?.3:1)*(hud.marketOpen?0:1);
    const mx=(-Math.sin(player.yaw)*f+Math.cos(player.yaw)*r)*sp,mz=(-Math.cos(player.yaw)*f-Math.sin(player.yaw)*r)*sp;
    const ok=(x,z)=>(onDock(x,z)||heightAt(x,z)>-.9)&&!builder.blocked(x,z)&&!poi.blocked(x,z);
    if(ok(player.x+mx,player.z+mz)){player.x+=mx;player.z+=mz}else if(ok(player.x+mx,player.z)){player.x+=mx}else if(ok(player.x,player.z+mz)){player.z+=mz}
    fishing.walk=Math.min(1,Math.hypot(mx,mz)/(dt*9*eco.speedMul));
    let gh=Math.max(heightAt(player.x,player.z),.2);if(onDock(player.x,player.z))gh=Math.max(gh,.72);const pp=town.plotAt(player.x,player.z);if(pp)gh=Math.max(gh,pp.y);gh+=window.__fly||0;
    if(player.top){const L=poi.lighthouse,dx=player.x-L.x,dz=player.z-L.z,r=Math.hypot(dx,dz)||1,rr=Math.max(1.8,Math.min(3.1,r));player.x=L.x+dx/r*rr;player.z=L.z+dz/r*rr;gh=L.top+.2}
    player.y+=(gh+1.7-player.y)*Math.min(1,dt*(player.top?4:12));
    camera.position.set(player.x,player.y,player.z);camera.rotation.set(player.pitch,player.yaw,0,"YXZ");
  }
  camera.updateMatrixWorld(true);
  fishing.update(dt);jobs.update(dt,player.x,player.z);pickups.update(dt,player.x,player.z);town.update(dt);poi.update(dt);builder.update();hands.swing(jobs.swing);fx.pixels.update(dt);fx.rings.update(dt);
  for(const ev of eco.tick(dt)){
    if(ev.type==="prices"){town.refresh();if(hud.marketOpen&&hud._redraw)hud._redraw()}
    else{hud.toast(ev.msg,ev.type==="npc"?"#ffb36b":"#9ad4f0");town.refresh()}
  }
  let pr=null;
  if(!fishing.busy&&!hud.marketOpen&&jobs.tool!==2){
    const pk=nearbyPickup(),mu=jobs.nearestMushroom(player.x,player.z),sp=town.nearestSign(player.x,player.z);
    if(pk)pr=`[E] Pick up ${ITEMS[pk.id].name}`;
    else if(mu)pr=mu.n.kind==="glowcap"?"[E] Pick the glowing mushroom":"[E] Pick mushroom";
    else if(nearStall())pr="[E] Open the market";
    else if(nearVillage())pr="[E] Village market (pays extra for wood and forage)";
    else if(nearLightDoor()||player.top)pr=player.top?"[E] Climb down":"[E] Climb the lighthouse";
    else if(sp){const o=eco.house.owners[sp.id];pr=!o?(eco.myPlot==null?`[E] Buy this plot for $${eco.plotPrice(sp.id).toLocaleString()}`:"For sale"):o==="me"?"Your plot. Press 3 to build":null}
  }
  hud.prompt(pr);
  refreshMoney();
  placeSun(camera.position);
  if(post)post.render(scene,camera);else renderer.render(scene,camera);
  frames++;window.__frames=frames;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ready=true;window.__dev={poi,town,builder,pickups,jobs,player,fishing,eco,hud,camera,stallPos,dockPos,dockA,scene,
  advance(sec){for(let i=0;i<sec*30;i++){camera.position.set(player.x,player.y,player.z);camera.rotation.set(player.pitch,player.yaw,0,"YXZ");camera.updateMatrixWorld(true);fishing.update(1/30);jobs.update(1/30,player.x,player.z);pickups.update(1/30,player.x,player.z);town.update(1/30);poi.update(1/30);fx.pixels.update(1/30);fx.rings.update(1/30)}}};

// autosave: every 8 seconds, when the tab is hidden, and when it closes
setInterval(()=>{if(eco.save())hud.saved()},8000);
addEventListener("beforeunload",()=>eco.save());
document.addEventListener("visibilitychange",()=>{if(document.hidden)eco.save()});
