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
import {makeCollider} from "./collide.js";
import {inLava,RAV,ravPoint} from "./ravine.js";
import {RECIPES,PERKS,ROLE_INFO,byId as ITEM_BY,CATS,catOf} from "./economy.js";
import {mulberry} from "./noise.js";
import {Pickups} from "./pickups.js";
import {Town,PLOT} from "./town.js";
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
const forest=await buildForest(rand,uniforms);scene.add(forest);
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
const solid=makeCollider(forest,[-1.9,0,1.9].map(o=>({x:stallPos.x+Math.cos(dockRot)*o,z:stallPos.z-Math.sin(dockRot)*o,r:1.15})));
const poi=new POIs({scene,rand:mulberry(WORLD.seed+5),pickups,fx,dockA,stallPos,avoid:(x,z)=>!!town.plotAt(x,z,8)});
town.clearCircle(forest,mushrooms,poi.cave.x,poi.cave.z,15);town.clearCircle(forest,mushrooms,poi.village.x,poi.village.z,26);town.clearCircle(forest,mushrooms,poi.lighthouse.x,poi.lighthouse.z,8);
const HINTS=[
  ()=>eco.tools.rod?"Aim at open water and click to cast. Click again when the float dips.":"You don't own a rod yet. Buy one at the market stall.",
  ()=>eco.tools.axe?"Face a tree and click to chop it. Keep clicking until it falls.":"You don't own an axe yet. Buy one at the market stall.",
  ()=>"Click to place, right-click to remove, scroll to change the piece, R to rotate, G toggles the snap grid.",
  ()=>"Walk up to things on the ground and press E to pick them up."
];
const TITLES=["Fishing","Logging","Building","Hands"];
const visibleTools=()=>[...(eco.tools.rod?[0]:[]),...(eco.tools.axe?[1]:[]),...(eco.myPlot!=null?[2]:[]),3];
function setTool(i){
  if(i===0&&!eco.tools.rod){hud.toast("You don't have a rod yet. Buy one at the market.","#ff7b6b");return}
  if(i===1&&!eco.tools.axe){hud.toast("You don't have an axe yet. Buy one at the market.","#ff7b6b");return}
  if(fishing.busy&&i!==0){hud.toast("Finish fishing first.");return}
  if(i===2&&eco.myPlot==null){hud.toast("Buy a house plot first. Look for a FOR SALE sign.","#ff7b6b");return}
  jobs.tool=i;hands.setTool(i);hud.select(i);if(i!==3)hands.equip&&hands.equip();builder.setActive(i===2);hud.hint(HINTS[i](),TITLES[i]);
}
function refreshMoney(){hud.money(eco.money,eco.bag.length,eco.capacity)}
refreshMoney();
jobs.tool=3;hands.setTool(3);hud.select(3);hud.slots(visibleTools(),3);
hud.hint(eco.loaded?"Welcome back. Space jumps, Shift toggles sprint. Press Tab any time to see where the landmarks are, and C to change how your character looks. Your progress was saved. Walk up to things on the ground and press E to pick them up, then sell them at the market stall.":"You start with nothing. Walk along the beach and press E to pick up shells, bottles and driftwood, then sell them at the market stall near the dock. WASD to move, Shift to run.","Side Hustle");
// camera: shots for review, or free fly
const q=new URLSearchParams(location.search),shot=q.get("shot"),FIXED=q.has("fixed");
if(q.has("lq")){renderer.shadowMap.enabled=false;renderer.setPixelRatio(1)}
const SHOTS={
  1:()=>({p:[dx-Math.cos(dockA)*14,6.5,dz-Math.sin(dockA)*14],look:[dx+Math.cos(dockA)*20,1,dz+Math.sin(dockA)*20]}),
  2:()=>({p:[-5,heightAt(-5,60)+2.6,60],look:[40,1,-30]}),
  3:()=>({p:[-60,40,150],look:[20,6,-40]}),
  4:()=>({p:[dx+Math.cos(dockA)*5,2.4,dz+Math.sin(dockA)*5+0],look:[dx-Math.cos(dockA)*30,5,dz-Math.sin(dockA)*30]})
};
const spawnAt=()=>{if(eco.myPlot!=null){const p=town.plots.find(q=>q.id===eco.myPlot),bed=eco.pieces.find(q=>q.t==="bed");if(p&&bed)return {x:p.x+bed.x+.9,z:p.z+bed.z,why:"your bed"};if(p)return {x:p.x,z:p.z+(PLOT/2)+2.5,why:"your house"}}return {x:dockPos.x+Math.cos(dockA)*(DOCK_LEN*.9),z:dockPos.z+Math.sin(dockA)*(DOCK_LEN*.9),why:"the dock"}};
const player={jy:0,vy:0,sprint:false,shiftDown:0,x:dockPos.x+Math.cos(dockA)*(DOCK_LEN*.9),z:dockPos.z+Math.sin(dockA)*(DOCK_LEN*.9),yaw:Math.atan2(-Math.cos(dockA),-Math.sin(dockA)),pitch:-.28,y:0};
/* resume where you left off: the last position is saved a few times a second and checked for safety before use */
const POS_KEY="sidehustle.pos";
{try{const q=JSON.parse(localStorage.getItem(POS_KEY)||"null");
  if(q&&[q.x,q.z,q.yaw].every(Number.isFinite)&&Math.abs(q.x)<(WORLD.size||600)/2&&Math.abs(q.z)<(WORLD.size||600)/2&&eco.loaded&&!q.dead){
    const h=heightAt(q.x,q.z);
    if(h>.5&&!inLava(q.x,q.z)&&!solid.blocked(q.x,q.z,.5)){player.x=q.x;player.z=q.z;player.yaw=q.yaw;player.pitch=Math.max(-1.2,Math.min(1.2,q.pitch||0))}
  }}catch(e){}}
const savePos=()=>{try{if(!player.dead)localStorage.setItem(POS_KEY,JSON.stringify({x:+player.x.toFixed(2),z:+player.z.toFixed(2),yaw:+player.yaw.toFixed(3),pitch:+player.pitch.toFixed(3),t:Date.now()}))}catch(e){}};
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
  if(/^Digit[1-4]$/.test(e.code)){const v=visibleTools()[+e.code.slice(5)-1];if(v!=null)setTool(v)}
  if(e.code==="KeyB")setTool(builder.active?3:2);
  if((e.code==="ShiftLeft"||e.code==="ShiftRight")&&!e.repeat){player.shiftDown=performance.now();player.sprint=!player.sprint}
  if(e.code==="Space"&&!e.repeat&&!hud.marketOpen&&player.jy===0&&!player.top)player.vy=7.2;
  if(e.code==="KeyC"&&!hud.marketOpen&&!builder.active){if(document.exitPointerLock)document.exitPointerLock();openCustomizer(()=>{eco.save();location.reload()})}
  if(e.code==="Tab"){e.preventDefault();landmarks()}
  if(builder.active){
    if(e.code==="KeyR")builder.rotate();
    if(e.code==="KeyG")builder.toggleSnap();
    if(e.code==="BracketRight")builder.cycle(1);
    if(e.code==="BracketLeft")builder.cycle(-1);
  }
  if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();});
addEventListener("keyup",e=>{keys[e.code]=false;if((e.code==="ShiftLeft"||e.code==="ShiftRight")&&performance.now()-player.shiftDown>320)player.sprint=false});
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
  if(jobs.tool===0)fishing.press();else if(jobs.tool===1)jobs.press(player.x,player.z);else if(jobs.tool===2)builder.place();else if(jobs.tool===3)punch();
});
addEventListener("mouseup",()=>fishing.release());
const OUCH=["Ow!","Hey! What was that for?","Ouch!","Watch it!","Rude!","Oof!"];
function punch(){
  if(hands.punching||hud.marketOpen)return;
  hands.punch();
  setTimeout(()=>{
    const d=camera.getWorldDirection(new THREE.Vector3());
    const hit=town.punchAt(player.x,player.z,d.x,d.z)||poi.punchAt(player.x,player.z,d.x,d.z);
    if(hit){const p=hit.mesh.position;fx.pixels.emit(new THREE.Vector3(p.x,p.y+1.7,p.z),16,[0xffffff,0xffe08a,0xff9a4d],{speed:3.4,up:3,size:.12,life:.6});hud.toast(OUCH[(Math.random()*OUCH.length)|0],"#ff9a4d")}
  },110);
}
function closeMarket(){hud.closeMarket();eco.save()}
function nearStall(){return Math.hypot(player.x-stallPos.x,player.z-stallPos.z)<6.5}
function lookDir(){const d=camera.getWorldDirection(new THREE.Vector3());return d}
function nearbyPickup(){const d=lookDir();return pickups.nearest(player.x,player.z,d.x,d.z)}
function openMarket(loc="dock"){
  if(document.exitPointerLock)document.exitPointerLock();
  hud.openMarket(eco,(kind,v)=>{
    if(kind==="sold"){hud.toast(`Sold everything for $${v}`,"#ffd23a");fx.pixels.emit(new THREE.Vector3(stallPos.x,stallPos.y+2,stallPos.z).addScaledVector(new THREE.Vector3(Math.sin(dockRot),0,Math.cos(dockRot)),1.2),40,[0xffd23a,0xffb52e,0xfff0a0],{speed:4,up:6,size:.22,life:1.3,gravity:10})}
    else{hud.toast(v==="rod"?"You bought a rod! Cast at open water.":v==="axe"?"You bought an axe! Chop a tree.":"Bought.","#6ee08a");if(v==="rod"||v==="axe")setTool(v==="rod"?0:1)}
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
const FURN=["chest","bed","bench","tank","garden"];
function nearFurn(){if(eco.myPlot==null)return null;const pl=town.plots[eco.myPlot];let b=null,bd=3;for(const p of eco.pieces){if(!FURN.includes(p.t))continue;const d=Math.hypot(pl.x+p.x-player.x,pl.z+p.z-player.z);if(d<bd){bd=d;b=p}}return b}
const nm=id=>(ITEM_BY[id]||{name:id}).name;
function openHome(p){
  const stashTxt=()=>{const c={};eco.stash.forEach(f=>c[f.id]=(c[f.id]||0)+1);return Object.entries(c).map(([k,v])=>`${nm(k)} x${v}`).join(", ")||"empty"};
  if(p.t==="chest")hud.dialog(()=>({title:"Chest",sub:`Anything in here survives a fall into lava. Stash ${eco.stash.length}/40: ${stashTxt()}`,rows:[
    {t:"Store your bag",small:`Move ${eco.bag.length} item(s) in`,btn:"Store",off:!eco.bag.length||eco.stash.length>=40,act:()=>{const n=eco.store();hud.toast(`Stored ${n} item(s)`,"#9ad4f0");refreshMoney()}},
    {t:"Take items back",small:`Bag has room for ${eco.capacity-eco.bag.length}`,btn:"Take",off:!eco.stash.length||eco.bag.length>=eco.capacity,act:()=>{const n=eco.fetch();hud.toast(`Took ${n} item(s)`,"#9ad4f0");refreshMoney()}}]}));
  else if(p.t==="bed")hud.dialog(()=>({title:"Bed",sub:"Sleeping saves your game. If you ever fall in lava you wake up in this bed.",rows:[
    {t:"Sleep",small:"Saves and sets this as home",btn:"Sleep",act:()=>{eco.save();hud.flash();hud.saved();hud.toast("Slept well. Progress saved, home set.","#6ee08a")}}]}));
  else if(p.t==="bench")hud.dialog(()=>({title:"Workbench",sub:"Turn raw finds into goods worth about double. Needs the items in your bag.",rows:RECIPES.map(r=>({t:`${nm(r.id)} (sells ~$${eco.price(r.id)})`,small:"Needs "+Object.entries(r.needs).map(([k,n])=>`${n} ${nm(k)} (${eco.count(k)})`).join(", "),btn:"Make",off:!eco.canCraft(r),act:()=>{if(eco.craft(r.id)){hud.toast(`Made ${nm(r.id)}`,"#ffd23a");refreshMoney()}else hud.toast("Bag too full or missing items","#ff7b6b")}}))}));
  else hud.dialog(()=>({title:p.t==="tank"?"Fish tank":"Herb garden",sub:`Your tanks and gardens earn about $${eco.homeRate} a minute while you play (up to 4 of each). Come back and collect.`,rows:[
    {t:`Collect $${Math.floor(eco.till)}`,small:`Fills up to $${Math.floor(eco.homeRate*25)}`,btn:"Collect",off:eco.till<1,act:()=>{const t=eco.collectTill();hud.toast(`Collected $${t}`,"#ffd23a");refreshMoney()}}]}));
}
function openNpc(n){
  const info=ROLE_INFO[n.role]||ROLE_INFO.buyer,cat=c=>CATS[c]?CATS[c].label:c;
  const sub=`${info.label}. "${info.line}"`;
  if(n.role==="buyer")hud.dialog(()=>{const mine=eco.bag.filter(f=>catOf(f.id)===n.wants).length;return {title:n.name,sub:sub+` Today I want ${cat(n.wants)} and pay 30% over the dock price.`,rows:[{t:`Sell my ${cat(n.wants)}`,small:`${mine} in your bag`,btn:"Sell",off:!mine,act:()=>{const r=eco.buyerSell(n);hud.toast(`${n.name} paid $${r.total} for ${r.sold} item(s)`,"#ffd23a");refreshMoney()}}]}});
  else if(n.role==="jobs")hud.dialog(()=>{const j=eco.jobFor(n);return {title:n.name,sub,rows:[{t:`Bring me ${j.qty} x ${nm(j.id)}`,small:`You have ${eco.count(j.id)}. I'll pay $${j.pay}, well over the market price.`,btn:"Hand over",off:eco.count(j.id)<j.qty,act:()=>{const p=eco.deliverJob(n);if(p){hud.toast(`${n.name} paid you $${p}`,"#6ee08a");refreshMoney()}}}]}});
  else if(n.role==="vendor")hud.dialog(()=>({title:n.name,sub:sub+" Stock changes when I restock.",rows:[...(n.stock||[]).map(id=>{const p=PERKS.find(x=>x.id===id);return {t:p.name,small:p.desc,btn:"$"+p.cost,off:eco.money<p.cost,act:()=>{if(eco.buyPerk(n,id)){hud.toast(`Got ${p.name}`,"#6ee08a");refreshMoney()}}}}),...((n.stock||[]).length?[]:[{t:"Sold out",small:"Check back later"}])]}));
  else hud.dialog(()=>{const t=eco.tips(),f=r=>r.map(x=>`${x.name} ${x.m>=1?"+":""}${Math.round((x.m-1)*100)}%`).join(", ");return {title:n.name,sub:sub+` I'm buying up ${cat(n.wants)} and dumping ${cat(n.dumps)}, which moves their prices.`,rows:[{t:"Highest prices right now",small:f(t.hot)},{t:"Lowest prices right now",small:f(t.cold)}]}});
}
const G0=id=>(ITEMS[id]&&ITEMS[id].color)||0xffffff;
function interact(){
  if(hud.marketOpen){closeMarket();return}
  if(fishing.busy)return;
  const pk=nearbyPickup();
  if(pk){
    const id=pk.id;
    if(eco.addItem(id)){hands.grab(G0(id));pickups.take(pk);const G=ITEMS[id];hud.toast(`Picked up ${G.name} (worth about $${eco.price(id)})`,G.kind==="rare"?"#4fe8ff":"#ffd23a")}
    else hud.toast("Bag full! Sell at the market stall.","#ff7b6b");
    return;
  }
  if(jobs.pickMushroom(player.x,player.z)){hands.grab(0xd8392f);return}
  const fu=nearFurn();if(fu){openHome(fu);return}
  const np=town.nearestNpc(player.x,player.z,3.2);if(np){openNpc(np);return}
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
      else if(eco.buyPlot(sp.id)){town.refresh();builder.load();hud.toast("You bought a plot! Press B to build.","#6ee08a");setTool(2);refreshMoney()}
      else hud.toast(`That plot costs $${eco.plotPrice(sp.id).toLocaleString()}. Land gets pricier as neighbours move in!`,"#ff7b6b");
    }else if(owner==="me")hud.toast("This is your plot. Press B to build.");
    else hud.toast("A neighbour lives here.");
  }
}

let last=performance.now(),t=0,frames=0;
function frame(now){
  const dt=FIXED?1/30:Math.min(.05,(now-last)/1000);last=now;t+=dt;
  uniforms.uTime.value=t;water.material.uniforms.uTime.value=t;
  clouds.children.forEach(c=>{c.position.x+=c.userData.speed*dt;if(c.position.x>900)c.position.x=-900});
  if(window.__cam){camera.position.set(...window.__cam.slice(0,3));camera.lookAt(...window.__cam.slice(3))}
  else if(shot&&SHOTS[shot]){const s=SHOTS[shot]();camera.position.set(...s.p);camera.lookAt(...s.look)}
  else{
    player.yaw+=((keys.ArrowLeft?1:0)-(keys.ArrowRight?1:0))*1.8*dt;player.pitch=Math.max(-1.4,Math.min(1.4,player.pitch+((keys.ArrowUp?1:0)-(keys.ArrowDown?1:0))*1.4*dt));
    const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0),sp=((player.sprint||keys.ShiftLeft)?9.5:5)*eco.speedMul*dt*(fishing.state==="reeling"?.3:1)*(hud.marketOpen?0:1);
    const mx=(-Math.sin(player.yaw)*f+Math.cos(player.yaw)*r)*sp,mz=(-Math.cos(player.yaw)*f-Math.sin(player.yaw)*r)*sp;
    const ok=(x,z)=>(onDock(x,z)||heightAt(x,z)>-.9)&&!builder.blocked(x,z)&&!poi.blocked(x,z)&&!solid.blocked(x,z);
    if(ok(player.x+mx,player.z+mz)){player.x+=mx;player.z+=mz}else if(ok(player.x+mx,player.z)){player.x+=mx}else if(ok(player.x,player.z+mz)){player.z+=mz}
    fishing.walk=Math.min(1,Math.hypot(mx,mz)/(dt*9*eco.speedMul));
    if(!f&&!r&&player.sprint&&!keys.ShiftLeft){player.idle=(player.idle||0)+dt;if(player.idle>.35)player.sprint=false}else player.idle=0;
    player.moving=Math.hypot(mx,mz)>1e-4;
    let gh=Math.max(heightAt(player.x,player.z),.2);if(onDock(player.x,player.z))gh=Math.max(gh,.72);const pp=town.plotAt(player.x,player.z);if(pp)gh=Math.max(gh,pp.y);gh+=window.__fly||0;
    if(player.top){const L=poi.lighthouse,dx=player.x-L.x,dz=player.z-L.z,r=Math.hypot(dx,dz)||1,rr=Math.max(1.8,Math.min(3.1,r));player.x=L.x+dx/r*rr;player.z=L.z+dz/r*rr;gh=L.top+.2}
    if(!player.dead&&inLava(player.x,player.z)&&gh<RAV.Yf+1.3){player.dead=1;const r=eco.die(),sp=spawnAt();hud.toast(`You fell in the lava! Lost $${r.lost} and ${r.bagN} item${r.bagN===1?"":"s"}. Back at ${sp.why}.`,"#ff5a3a");fx.pixels.emit(new THREE.Vector3(player.x,gh+1,player.z),50,[0xff7a1a,0xffc23a,0x222222],{speed:5,up:7,size:.25,life:1.2});player.x=sp.x;player.z=sp.z;player.vy=0;player.jy=0;gh=Math.max(heightAt(sp.x,sp.z),.2);player.y=gh+1.7;setTimeout(()=>{player.dead=0},600)}
    player.y+=(gh+1.7-player.y)*Math.min(1,dt*(player.top?4:12));
    // jumping: simple gravity on top of the ground height
    if(player.jy>0||player.vy>0){player.vy-=22*dt;player.jy+=player.vy*dt;if(player.jy<=0){player.jy=0;player.vy=0}}
    const sprintNow=(player.sprint||keys.ShiftLeft)&&player.moving;
    camera.fov+=((sprintNow?74:68)-camera.fov)*Math.min(1,dt*6);camera.updateProjectionMatrix();
    camera.position.set(player.x,player.y+player.jy,player.z);camera.rotation.set(player.pitch,player.yaw,0,"YXZ");
  }
  hud.slots(visibleTools(),jobs.tool);
  camera.updateMatrixWorld(true);
  fishing.update(dt);jobs.update(dt,player.x,player.z);pickups.update(dt,player.x,player.z);town.update(dt);poi.update(dt);builder.update();hands.swing(jobs.swing);hands.sprint=(player.sprint||keys.ShiftLeft)&&player.moving;hands.airborne=player.jy;fx.pixels.update(dt);fx.rings.update(dt);
  for(const ev of eco.tick(dt)){
    if(ev.type==="prices"){town.refresh();if(hud.marketOpen&&hud._redraw)hud._redraw()}
    else{hud.toast(ev.msg,ev.type==="npc"?"#ffb36b":"#9ad4f0");town.refresh()}
  }
  let pr=null;
  if(!fishing.busy&&!hud.marketOpen&&jobs.tool!==2){
    const pk=nearbyPickup(),mu=jobs.nearestMushroom(player.x,player.z),sp=town.nearestSign(player.x,player.z);
    if(pk)pr=`[E] Pick up ${ITEMS[pk.id].name}`;
    else if(mu)pr=mu.n.kind==="glowcap"?"[E] Pick the glowing mushroom":"[E] Pick mushroom";
    else if(nearFurn())pr="[E] Use "+({chest:"chest",bed:"bed",bench:"workbench",tank:"fish tank",garden:"garden"})[nearFurn().t];
    else if(town.nearestNpc(player.x,player.z,3.2)){const q=town.nearestNpc(player.x,player.z,3.2);pr=`[E] Talk to ${q.name} (${(ROLE_INFO[q.role]||{}).label})`}
    else if(nearStall())pr="[E] Open the market";
    else if(nearVillage())pr="[E] Village market (pays extra for wood and forage)";
    else if(nearLightDoor()||player.top)pr=player.top?"[E] Climb down":"[E] Climb the lighthouse";
    else if(sp){const o=eco.house.owners[sp.id];pr=!o?(eco.myPlot==null?`[E] Buy this plot for $${eco.plotPrice(sp.id).toLocaleString()}`:"For sale"):o==="me"?"Your plot. Press B to build":null}
  }
  hud.prompt(pr);
  refreshMoney();
  placeSun(camera.position);
  if(post)post.render(scene,camera);else renderer.render(scene,camera);
  frames++;window.__frames=frames;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ready=true;window.__H=heightAt;window.__R={p:ravPoint};window.__dev={hands,openNpc,openHome,solid,poi,town,builder,pickups,jobs,player,fishing,eco,hud,camera,stallPos,dockPos,dockA,scene,
  advance(sec){for(let i=0;i<sec*30;i++){camera.position.set(player.x,player.y,player.z);camera.rotation.set(player.pitch,player.yaw,0,"YXZ");camera.updateMatrixWorld(true);fishing.update(1/30);jobs.update(1/30,player.x,player.z);pickups.update(1/30,player.x,player.z);town.update(1/30);poi.update(1/30);fx.pixels.update(1/30);fx.rings.update(1/30)}}};

// autosave: every 8 seconds, when the tab is hidden, and when it closes
setInterval(savePos,1000);
setInterval(()=>{if(eco.save())hud.saved()},3000);
addEventListener("beforeunload",()=>{savePos();eco.save()});
addEventListener("pagehide",()=>{savePos();eco.save()});
document.addEventListener("visibilitychange",()=>{if(document.hidden){savePos();eco.save()}});
