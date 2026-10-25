/* Side Hustle simulation: terrain, structures, loot, player movement and hitscan combat.
   No rendering and no DOM, so the host, a guest (for movement prediction and loot mirroring) and the tests share it.
   Coordinates: x right, y up, z toward the viewer. yaw 0 looks down -z; forward = (-sin yaw, 0, -cos yaw). */
(function(root){
"use strict";
var Data=(typeof require!=="undefined"&&typeof module!=="undefined")?require("./data.js"):root.Data;

var HALF=90;          // the map is 180 m x 180 m
var WATER=0;          // water surface height
var EYE=1.7,BODY_H=1.85,PR=0.42;
var SPEED=7.2,GRAVITY=22,JUMP_V=7.6;
var USE_RANGE=2.4;
var CAT_N=7;

function mulberry32(a){
 return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
}
function smoothstep(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
function clamp(v,a,b){return v<a?a:(v>b?b:v)}
function r1(n){return Math.round(n*10)/10}

var PRESETS={
 meadow:{id:"meadow",name:"Meadow Pond",base:3.2,o:[0.7,1.9,0.3],pond:{x:12,z:-36,r:34},creek:null},
 creek:{id:"creek",name:"Riverside",base:3.2,o:[2.1,0.4,1.2],pond:null,creek:{amp:16,freq:0.034,phase:0,w:12}}
};

/** Build the deterministic world for a preset and seed. Every client builds the same one. */
function makeWorld(presetId,seed){
 var P=PRESETS[presetId]||PRESETS.meadow;
 var rnd=mulberry32((seed|0)||1);
 var spawns=[{x:-78,z:0,yaw:-Math.PI/2},{x:78,z:0,yaw:Math.PI/2}];
 var hills=[];
 for(var i=0;i<8;i++)hills.push({x:(rnd()*2-1)*72,z:(rnd()*2-1)*72,r:10+rnd()*10,a:1.4+rnd()*2.2});
 var flats=[];

 function rawH(x,z){
  var h=P.base+1.7*Math.sin(x*0.04+P.o[0])*Math.cos(z*0.034+P.o[1])+0.8*Math.sin(x*0.1+z*0.08+P.o[2])+0.3*Math.sin(x*0.23-z*0.19);
  for(var i=0;i<hills.length;i++){var q=hills[i],dx=x-q.x,dz=z-q.z;h+=q.a*Math.exp(-(dx*dx+dz*dz)/(q.r*q.r))}
  if(P.pond){ // carve a bowl so the pond always holds water, whatever the hills do
   var px=x-P.pond.x,pz=z-P.pond.z,pd=Math.hypot(px,pz),pw=smoothstep(P.pond.r,P.pond.r*0.35,pd);
   h=h*(1-pw)+(-3+3.6*(pd/P.pond.r)*(pd/P.pond.r))*pw;
  }
  if(P.creek){
   var cz=P.creek.amp*Math.sin(x*P.creek.freq+P.creek.phase),cd=Math.abs(z-cz),cw=smoothstep(P.creek.w,P.creek.w*0.3,cd);
   h=h*(1-cw)+(-1.25+1.6*(cd/P.creek.w)*(cd/P.creek.w))*cw;
  }
  return h;
 }
 function baseHeight(x,z){
  var d0=Math.hypot(x-spawns[0].x,z-spawns[0].z),d1=Math.hypot(x-spawns[1].x,z-spawns[1].z);
  var m=smoothstep(8,24,Math.min(d0,d1));
  return 1.8+(rawH(x,z)-1.8)*m;
 }
 function height(x,z){
  var h=baseHeight(x,z);
  for(var i=0;i<flats.length;i++){
   var f=flats[i],dx=Math.max(Math.abs(x-f.x)-f.hx,0),dz=Math.max(Math.abs(z-f.z)-f.hz,0);
   if(dx>9||dz>9)continue;
   var d=Math.hypot(dx,dz);
   if(d<9)h+=(f.y-h)*smoothstep(9,0,d);
  }
  return h;
 }
 function pathZ(x){var t=clamp((x+78)/156,0,1);return 8*Math.sin(Math.PI*t)}

 var world={preset:P,seed:seed|0,half:HALF,water:WATER,spawns:spawns,height:height,pathZ:pathZ,
  obstacles:[],trees:[],rocks:[],boxes:[],silos:[],chestSpots:[],buildings:[]};
 var sites=[];

 /* ----- structures ----- */
 function addBox(x0,x1,z0,z1,y0,y1,kind,solid,tint){
  if(x1-x0<0.02||z1-z0<0.02||y1-y0<0.02)return;
  world.boxes.push({x0:x0,x1:x1,z0:z0,z1:z1,y0:y0,y1:y1,kind:kind,solid:solid!==false,tint:tint==null?rnd():tint});
 }
 function siteOK(x,z,hx,hz,margin){
  if(Math.abs(x)+hx>HALF-12||Math.abs(z)+hz>HALF-12)return false;
  var need=26+Math.max(hx,hz);
  if(Math.hypot(x-spawns[0].x,z-spawns[0].z)<need||Math.hypot(x-spawns[1].x,z-spawns[1].z)<need)return false;
  var pts=[[0,0],[hx,hz],[-hx,hz],[hx,-hz],[-hx,-hz]],lo=1e9,hi=-1e9;
  for(var i=0;i<pts.length;i++){var h=baseHeight(x+pts[i][0],z+pts[i][1]);lo=Math.min(lo,h);hi=Math.max(hi,h)}
  if(lo<1.2||hi-lo>2.2)return false;
  for(var j=0;j<sites.length;j++){
   var s=sites[j];
   if(Math.abs(x-s.x)<hx+s.hx+margin&&Math.abs(z-s.z)<hz+s.hz+margin)return false;
  }
  return true;
 }
 function findSite(hx,hz,margin){
  for(var t=0;t<300;t++){
   var x=(rnd()*2-1)*(HALF-14),z=(rnd()*2-1)*(HALF-14);
   if(siteOK(x,z,hx,hz,margin))return {x:x,z:z};
  }
  return null;
 }
 function claim(x,z,hx,hz){
  var y=Math.max(1.2,baseHeight(x,z));
  flats.push({x:x,z:z,hx:hx+1.2,hz:hz+1.2,y:y});sites.push({x:x,z:z,hx:hx,hz:hz});
  return y;
 }
 var T=0.35;
 function wallBox(axis,fixed,a,b,ya,yb,kind){
  if(axis==="x")addBox(a,b,fixed-T/2,fixed+T/2,ya,yb,kind,true);else addBox(fixed-T/2,fixed+T/2,a,b,ya,yb,kind,true);
 }
 /** A wall along an axis with doors, windows and slits cut into it. */
 function runWall(axis,fixed,a,b,openings,y0,H,kind,doorH){
  openings.sort(function(p,q){return p.c-q.c});
  var cur=a;
  openings.forEach(function(o){
   var lo=o.c-o.w/2,hi=o.c+o.w/2;
   wallBox(axis,fixed,cur,lo,y0,y0+H,kind);
   if(o.type==="door"){wallBox(axis,fixed,lo,hi,y0+doorH,y0+H,kind)}
   else if(o.type==="slit"){wallBox(axis,fixed,lo,hi,y0,y0+1.3,kind);wallBox(axis,fixed,lo,hi,y0+1.85,y0+H,kind)}
   else{wallBox(axis,fixed,lo,hi,y0,y0+1.0,kind);wallBox(axis,fixed,lo,hi,y0+2.15,y0+H,kind)}
   cur=hi;
  });
  wallBox(axis,fixed,cur,b,y0,y0+H,kind);
 }
 /** Rectangular building. openings: {side:"N|S|E|W",off,w,type}. N is -z, S is +z, W is -x, E is +x. */
 function house(spec){
  var s=findSite(spec.w/2+1,spec.d/2+1,10);if(!s)return;
  var cx=s.x,cz=s.z,y=claim(cx,cz,spec.w/2+1,spec.d/2+1),H=spec.h,kind=spec.kind,doorH=spec.doorH||2.3;
  var bySide={N:[],S:[],E:[],W:[]};
  spec.openings.forEach(function(o){
   var side=o.side==="toCenter"?(cz>0?"N":"S"):o.side;
   var c=(side==="N"||side==="S")?cx+o.off:cz+o.off;
   bySide[side].push({c:c,w:o.w,type:o.type});
  });
  runWall("x",cz-spec.d/2,cx-spec.w/2-T/2,cx+spec.w/2+T/2,bySide.N,y,H,kind,doorH);
  runWall("x",cz+spec.d/2,cx-spec.w/2-T/2,cx+spec.w/2+T/2,bySide.S,y,H,kind,doorH);
  runWall("z",cx-spec.w/2,cz-spec.d/2+T/2,cz+spec.d/2-T/2,bySide.W,y,H,kind,doorH);
  runWall("z",cx+spec.w/2,cz-spec.d/2+T/2,cz+spec.d/2-T/2,bySide.E,y,H,kind,doorH);
  addBox(cx-spec.w/2-0.5,cx+spec.w/2+0.5,cz-spec.d/2-0.5,cz+spec.d/2+0.5,y+H,y+H+0.4,"roof:"+kind,true);
  addBox(cx-spec.w/2,cx+spec.w/2,cz-spec.d/2,cz+spec.d/2,y-0.4,y+0.05,"floor:"+kind,false);
  if(spec.partition){ // inner wall across the building with a doorway
   runWall("x",cz,cx-spec.w/2+T,cx+spec.w/2-T,[{c:cx+spec.partition,w:1.7,type:"door"}],y,H,kind,2.3);
  }
  (spec.crates||[]).forEach(function(c){addBox(cx+c[0]-0.65,cx+c[0]+0.65,cz+c[1]-0.65,cz+c[1]+0.65,y,y+1.3,"crate",true)});
  (spec.chests||[]).forEach(function(c){world.chestSpots.push({x:cx+c[0],z:cz+c[1],y:y,dx:c[2],dz:c[3],tier:spec.tier})});
  world.buildings.push({x:cx,z:cz,w:spec.w,d:spec.d,y:y,h:H,kind:kind});
 }
 var cabin={w:9,d:7,h:3.0,kind:"cabin",tier:"chest",
  openings:[{side:"toCenter",off:0,w:1.7,type:"door"},{side:"toCenter",off:3,w:1.6,type:"window"},{side:"W",off:0,w:1.6,type:"window"},{side:"E",off:0,w:1.6,type:"window"}],
  crates:[[-3.2,2.2]],chests:[[3.4,-2.4,-1,0.6]]};
 var barn={w:16,d:11,h:4.6,kind:"barn",tier:"chest",doorH:3.5,
  openings:[{side:"N",off:0,w:4.2,type:"door"},{side:"S",off:0,w:4.2,type:"door"},{side:"W",off:-2.5,w:1.8,type:"window"},{side:"E",off:2.5,w:1.8,type:"window"}],
  crates:[[-5.5,-3],[-5.5,-1.6],[5.5,3],[0,0]],chests:[[7,-4,-1,0],[-7,4,1,0]]};
 var bunker={w:12,d:8,h:2.7,kind:"bunker",tier:"bunker",partition:2.5,
  openings:[{side:"toCenter",off:-3.5,w:1.7,type:"door"},{side:"N",off:3,w:2.4,type:"slit"},{side:"S",off:-3,w:2.4,type:"slit"},{side:"W",off:0,w:2.4,type:"slit"},{side:"E",off:0,w:2.4,type:"slit"}],
  crates:[[4.5,2.2]],chests:[[-4.8,2.6,1,0],[4.9,-2.6,-1,0]]};
 house(barn);house(bunker);house(cabin);house(cabin);house(cabin);

 // silo landmark
 var ss=findSite(5,5,10);
 if(ss){
  var sy=claim(ss.x,ss.z,5,5);
  world.silos.push({x:ss.x,z:ss.z,y:sy,r:3.2,h:15});
  world.obstacles.push({x:ss.x,z:ss.z,r:3.2,y0:sy,y1:sy+15,kind:"silo"});
  [[4.4,0.5],[-4.0,-2.2],[0.4,4.6],[-1.5,-4.6]].forEach(function(c){addBox(ss.x+c[0]-0.65,ss.x+c[0]+0.65,ss.z+c[1]-0.65,ss.z+c[1]+0.65,sy,sy+1.3,"crate",true)});
 }
 // shipping container rows
 var colors=[0.1,0.35,0.6,0.85];
 for(var cg=0;cg<3;cg++){
  var cs=findSite(10,6,8);if(!cs)continue;
  var cy=claim(cs.x,cs.z,10,6),horizontal=rnd()<0.5;
  for(var k=0;k<3;k++){
   var ox=horizontal?(k-1)*6.6:(rnd()-0.5)*2,oz=horizontal?(rnd()-0.5)*2:(k-1)*6.6;
   var tintc=colors[Math.floor(rnd()*colors.length)];
   if(horizontal)addBox(cs.x+ox-3,cs.x+ox+3,cs.z+oz-1.25,cs.z+oz+1.25,cy,cy+2.6,"container",true,tintc);
   else addBox(cs.x+ox-1.25,cs.x+ox+1.25,cs.z+oz-3,cs.z+oz+3,cy,cy+2.6,"container",true,tintc);
  }
 }
 // ruined walls
 for(var rw=0;rw<5;rw++){
  var rs=findSite(6,6,6);if(!rs)continue;
  var ry=claim(rs.x,rs.z,6,6);
  addBox(rs.x-5,rs.x+1,rs.z-5.25,rs.z-4.75,ry,ry+2.3,"stone",true);
  addBox(rs.x-5.25,rs.x-4.75,rs.z-5,rs.z+1,ry,ry+1.7,"stone",true);
  addBox(rs.x+2,rs.x+5,rs.z+3.75,rs.z+4.25,ry,ry+2.0,"stone",true);
 }
 // crate stacks
 for(var cr=0;cr<8;cr++){
  var cq=findSite(2.2,2.2,5);if(!cq)continue;
  var qy=claim(cq.x,cq.z,2.2,2.2);
  addBox(cq.x-1.4,cq.x-0.1,cq.z-0.65,cq.z+0.65,qy,qy+1.3,"crate",true);
  addBox(cq.x+0.1,cq.x+1.4,cq.z-0.4,cq.z+0.9,qy,qy+1.3,"crate",true);
  if(rnd()<0.6)addBox(cq.x-0.9,cq.x+0.3,cq.z-0.5,cq.z+0.6,qy+1.3,qy+2.6,"crate",true);
 }

 /* ----- trees and rocks ----- */
 function inSite(x,z,m){
  for(var i=0;i<sites.length;i++){var s=sites[i];if(Math.abs(x-s.x)<s.hx+m&&Math.abs(z-s.z)<s.hz+m)return true}
  return false;
 }
 function farFromSpawns(x,z,d){return Math.hypot(x-spawns[0].x,z-spawns[0].z)>d&&Math.hypot(x-spawns[1].x,z-spawns[1].z)>d}
 function clear(x,z,d){
  for(var i=0;i<world.obstacles.length;i++){var o=world.obstacles[i];if(Math.hypot(x-o.x,z-o.z)<d+o.r)return false}
  return true;
 }
 var tries=0;
 while(world.trees.length<210&&tries++<4000){
  var x=(rnd()*2-1)*(HALF-4),z=(rnd()*2-1)*(HALF-4),s=0.8+rnd()*0.8,type=rnd()<0.55?0:1,tint=rnd();
  var h=height(x,z);
  if(h<0.9||!farFromSpawns(x,z,16)||Math.abs(z-pathZ(x))<3.5||inSite(x,z,3)||!clear(x,z,2.6))continue;
  world.trees.push({x:x,z:z,y:h,s:s,type:type,tint:tint});
  world.obstacles.push({x:x,z:z,r:0.5*s,y0:h,y1:h+8*s,kind:"tree"});
 }
 tries=0;
 while(world.rocks.length<44&&tries++<4000){
  var big=world.rocks.length<10;
  var rx=(rnd()*2-1)*(HALF-5),rz=(rnd()*2-1)*(HALF-5),rr=big?2.2+rnd()*1.4:0.6+rnd()*1.2,rt=rnd();
  var rh=height(rx,rz);
  if(rh<-0.3||!farFromSpawns(rx,rz,14)||Math.abs(rz-pathZ(rx))<(big?4.5:2.2)||inSite(rx,rz,rr+1)||!clear(rx,rz,1.2))continue;
  world.rocks.push({x:rx,z:rz,y:rh,r:rr,tint:rt,rot:rnd()*6.28});
  world.obstacles.push({x:rx,z:rz,r:rr*0.85,y0:rh,y1:rh+rr*1.4,kind:"rock"});
 }
 return world;
}

/* ---------- loot ---------- */
function boxAt(world,x,z){
 for(var i=0;i<world.boxes.length;i++){
  var b=world.boxes[i];
  if(b.solid&&x>b.x0-0.6&&x<b.x1+0.6&&z>b.z0-0.6&&z<b.z1+0.6&&b.y0<world.height(x,z)+1.8&&b.kind.indexOf("roof")!==0)return true;
 }
 return false;
}
function blankAtt(){var a=[];for(var i=0;i<CAT_N;i++)a.push(null);return a}
function packAtt(att){
 if(!att)return 0;
 return att.map(function(a){return a?[a.o,a.r]:0});
}
function unpackAtt(p){
 var out=blankAtt();
 if(p)for(var i=0;i<CAT_N;i++)out[i]=p[i]?{o:p[i][0],r:p[i][1]}:null;
 return out;
}

/** Generate the loot for a round: ground items, chest contents (hidden until opened) and mirrored spawn caches. */
function genLoot(world,seed){
 var rnd=mulberry32((seed|0)+99),id=1,items=[],chests=[];
 function mk(kind,a,b,r,x,z,active){
  var it={id:id++,kind:kind,a:a,b:b,r:r,x:x,y:world.height(x,z),z:z,active:active!==false,att:null};
  items.push(it);return it;
 }
 function rollOne(table,mode,x,z,active){
  var x0=rnd(),kind;
  if(mode==="chest0")kind=x0<0.7?"gun":"med";
  else if(mode==="chestN")kind=x0<0.45?"gun":"med";
  else kind=x0<0.45?"gun":"med";
  var r=Data.rollRarity(table,rnd);
  if(kind==="gun")return mk("gun",Data.rollGun(rnd,true),0,r,x,z,active);
  return mk("med",0,0,r,x,z,active);
 }
 world.chestSpots.forEach(function(sp){
  var tier=sp.tier==="bunker"?Data.WEIGHTS.bunker:Data.WEIGHTS.chest;
  var n=sp.tier==="bunker"?3:(rnd()<0.5?2:3),ch={x:sp.x,z:sp.z,y:sp.y,dx:sp.dx,dz:sp.dz,tier:sp.tier,opened:false,items:[]};
  for(var i=0;i<n;i++)ch.items.push(rollOne(tier,i===0?"chest0":"chestN",sp.x,sp.z,false));
  chests.push(ch);
 });
 // mirrored caches in front of each spawn, so the opening minute is fair
 var dirx=world.spawns[0].x<0?1:-1;
 for(var c=0;c<4;c++){
  var ox=world.spawns[0].x+dirx*(9+rnd()*10),oz=(rnd()*2-1)*12;
  var it0=rollOne(Data.WEIGHTS.ground,c===0?"ground":"ground",ox,oz);
  var m2=mk(it0.kind,it0.a,it0.b,it0.r,-ox,-oz);
  m2.y=world.height(m2.x,m2.z);
 }
 var placed=0,tries=0;
 while(placed<30&&tries++<400){
  var x=(rnd()*2-1)*(HALF-6),z=(rnd()*2-1)*(HALF-6);
  if(world.height(x,z)<0.8||boxAt(world,x,z))continue;
  var near=false;
  for(var i=0;i<items.length;i++)if(Math.hypot(items[i].x-x,items[i].z-z)<4){near=true;break}
  if(near)continue;
  rollOne(Data.WEIGHTS.ground,"ground",x,z);placed++;
 }
 return {items:items,chests:chests,nextId:id};
}
function chestIndex(loot,ch){return loot.chests.indexOf(ch)}
function openChest(loot,ch){
 ch.opened=true;
 var n=ch.items.length,px=-ch.dz,pz=ch.dx;
 ch.items.forEach(function(it,i){
  var off=(i-(n-1)/2)*0.85;
  it.x=ch.x+ch.dx*1.1+px*off;it.z=ch.z+ch.dz*1.1+pz*off;it.active=true;
 });
}
/** Mirror a loot event from the host. Events: ["t",id,player] taken, ["d",id,kind,a,b,r,x,y,z,att] dropped, ["c",chestIndex] opened. */
function applyLootEvent(loot,e){
 if(e[0]==="t"){
  for(var i=0;i<loot.items.length;i++)if(loot.items[i].id===e[1]){loot.items[i].active=false;break}
 }else if(e[0]==="d"){
  loot.items.push({id:e[1],kind:e[2],a:e[3],b:e[4],r:e[5],x:e[6],y:e[7],z:e[8],active:true,att:e[9]?unpackAtt(e[9]):null});
  if(e[1]>=loot.nextId)loot.nextId=e[1]+1;
 }else if(e[0]==="c"){
  var ch=loot.chests[e[1]];if(ch)openChest(loot,ch);
 }
}
/** Nearest thing a player could use: {type:"item"|"chest",obj,dist} or null. */
function nearestUsable(loot,x,z){
 var best=null,bd=USE_RANGE,i;
 for(i=0;i<loot.items.length;i++){
  var it=loot.items[i];if(!it.active)continue;
  var d=Math.hypot(it.x-x,it.z-z);if(d<bd){bd=d;best={type:"item",obj:it,dist:d}}
 }
 for(i=0;i<loot.chests.length;i++){
  var c=loot.chests[i];if(c.opened)continue;
  var d2=Math.hypot(c.x-x,c.z-z);if(d2<bd){bd=d2;best={type:"chest",obj:c,dist:d2}}
 }
 return best;
}

/* ---------- weapons and players ---------- */
function makeWeapon(g,r,att,ammo){
 var w={g:g,r:r,att:att||blankAtt()};
 w.st=Data.computeStats(w);
 w.ammo=ammo==null?w.st.mag:Math.min(ammo,w.st.mag);
 return w;
}
function packWeapon(w){return w?[w.g,w.r,packAtt(w.att),w.ammo]:0}
function unpackWeapon(p){return p?makeWeapon(p[0],p[1],unpackAtt(p[2]),p[3]):null}
function curWeapon(p){return p.slots[p.cur]}
/** Attachments a player's lobby loadout puts on gun g. lo = {r:attachmentRarity, byGun:{gunIndex:[option|-1 x7]}}. */
function loadoutAtt(lo,g){
 var att=blankAtt();
 if(lo&&lo.att&&lo.att[g]){ // per-attachment strength, from the progression system (Data.expandLoadout)
  lo.att[g].forEach(function(a,c){if(a&&c<CAT_N)att[c]={o:a.o|0,r:Math.max(0,Math.min(4,a.r|0))}});
  return att;
 }
 if(!lo||!lo.byGun)return att;
 var row=lo.byGun[g];if(!row)return att;
 var r=Math.max(0,Math.min(4,lo.r|0));
 for(var c=0;c<CAT_N;c++){var o=row[c];if(o>=0&&o<3)att[c]={o:o|0,r:r}}
 return att;
}
function newGun(p,g,r){return makeWeapon(g,r,loadoutAtt(p.lo,g))}
function resetInventory(p){p.slots=[newGun(p,0,0),null];p.cur=0}

function makePlayer(idx,world,lo){
 var sp=world.spawns[idx];
 var p={idx:idx,lo:lo||null,x:sp.x,y:world.height(sp.x,sp.z),z:sp.z,vx:0,vz:0,vy:0,yaw:sp.yaw,pitch:0,
  hp:100,score:0,alive:true,deadT:0,reloading:false,reloadT:0,fireCd:0,heat:0,heatT:0,ads:0,
  fireHeld:false,useHeld:false,grounded:true,swimming:false,wading:false,speed:0,invDirty:true};
 resetInventory(p);
 return p;
}
function respawn(world,p){
 var sp=world.spawns[p.idx];
 p.x=sp.x;p.z=sp.z;p.y=world.height(sp.x,sp.z);p.vx=p.vz=p.vy=0;p.yaw=sp.yaw;p.pitch=0;
 p.hp=100;p.alive=true;p.reloading=false;p.reloadT=0;p.fireCd=0;p.heat=0;p.heatT=0;p.ads=0;p.grounded=true;p.swimming=false;
 resetInventory(p);p.invDirty=true;
}
function depthAt(world,x,z){return world.water-world.height(x,z)}

/** Move a player one tick. Shared by the host sim and a guest's local prediction. inp.mul scales speed (weapon and aiming). */
function movePlayer(world,p,inp,dt){
 var s=Math.sin(p.yaw),c=Math.cos(p.yaw);
 var f=inp.f||0,r=inp.r||0;
 var wx=-s*f+c*r,wz=-c*f-s*r;
 var len=Math.hypot(wx,wz);if(len>1){wx/=len;wz/=len}
 var depth=depthAt(world,p.x,p.z);
 p.wading=depth>0.25;p.swimming=depth>1.3;
 var speed=SPEED*(inp.mul||1);
 if(p.swimming)speed*=0.55;else if(p.wading)speed*=1-0.4*Math.min(1,depth/1.3);
 var accel=p.grounded||p.swimming?14:3;
 var k=Math.min(1,dt*accel);
 p.vx+=(wx*speed-p.vx)*k;p.vz+=(wz*speed-p.vz)*k;
 p.x+=p.vx*dt;p.z+=p.vz*dt;
 var lim=world.half-1;
 p.x=clamp(p.x,-lim,lim);p.z=clamp(p.z,-lim,lim);
 var i;
 for(i=0;i<world.obstacles.length;i++){
  var o=world.obstacles[i],dx=p.x-o.x,dz=p.z-o.z,rr=PR+o.r,d2=dx*dx+dz*dz;
  if(d2<rr*rr){var d=Math.sqrt(d2)||0.0001,push=rr-d;p.x+=dx/d*push;p.z+=dz/d*push}
 }
 for(i=0;i<world.boxes.length;i++){
  var b=world.boxes[i];
  if(!b.solid||p.x<b.x0-PR||p.x>b.x1+PR||p.z<b.z0-PR||p.z>b.z1+PR)continue;
  if(p.y+BODY_H<=b.y0||p.y+0.35>=b.y1)continue;
  var cx=clamp(p.x,b.x0,b.x1),cz=clamp(p.z,b.z0,b.z1),bx=p.x-cx,bz=p.z-cz,bd=Math.hypot(bx,bz);
  if(bd>0.0001){if(bd<PR){var pu=PR-bd;p.x+=bx/bd*pu;p.z+=bz/bd*pu}}
  else{ // centre is inside the box: leave by the nearest face
   var l=p.x-b.x0,rgt=b.x1-p.x,t=p.z-b.z0,bt=b.z1-p.z,m=Math.min(l,rgt,t,bt);
   if(m===l)p.x=b.x0-PR;else if(m===rgt)p.x=b.x1+PR;else if(m===t)p.z=b.z0-PR;else p.z=b.z1+PR;
  }
 }
 var ground=world.height(p.x,p.z);
 if(p.swimming){
  var target=world.water-1.25;
  p.y+=(target-p.y)*Math.min(1,dt*6);p.vy=0;p.grounded=false;
 }else{
  if(inp.jump&&p.grounded){p.vy=JUMP_V;p.grounded=false}
  if(!p.grounded){
   p.vy-=GRAVITY*dt;p.y+=p.vy*dt;
   if(p.y<=ground){p.y=ground;p.vy=0;p.grounded=true}
  }else{
   p.y=ground; // stay glued to the terrain while walking
  }
 }
 p.speed=Math.hypot(p.vx,p.vz);
}

/* ---------- combat ---------- */
function dirOf(yaw,pitch){var cp=Math.cos(pitch);return [-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp]}

function rayBox(ox,oy,oz,dx,dy,dz,b,maxT){
 var tmin=0,tmax=maxT;
 var o=[ox,oy,oz],d=[dx,dy,dz],lo=[b.x0,b.y0,b.z0],hi=[b.x1,b.y1,b.z1];
 for(var i=0;i<3;i++){
  if(Math.abs(d[i])<1e-9){if(o[i]<lo[i]||o[i]>hi[i])return -1}
  else{
   var t1=(lo[i]-o[i])/d[i],t2=(hi[i]-o[i])/d[i];
   if(t1>t2){var tmp=t1;t1=t2;t2=tmp}
   if(t1>tmin)tmin=t1;if(t2<tmax)tmax=t2;
   if(tmin>tmax)return -1;
  }
 }
 return tmin;
}

/** Ray against the world and the listed targets. kind: 0 miss, 1 ground, 2 tree, 3 rock, 4 water, 5 player, 6 structure. */
function trace(world,ox,oy,oz,dx,dy,dz,maxT,targets){
 var best={t:maxT,kind:0,idx:-1,head:false};
 var L2=dx*dx+dz*dz,i;
 if(L2>1e-9){
  for(i=0;i<world.obstacles.length;i++){
   var o=world.obstacles[i];
   var cx=ox-o.x,cz=oz-o.z;
   var a=L2,b=2*(cx*dx+cz*dz),c=cx*cx+cz*cz-o.r*o.r;
   var disc=b*b-4*a*c;if(disc<0)continue;
   var t=(-b-Math.sqrt(disc))/(2*a);
   if(t<0||t>=best.t)continue;
   var y=oy+dy*t;
   if(y<o.y0-0.2||y>o.y1)continue;
   best={t:t,kind:o.kind==="tree"?2:3,idx:-1,head:false};
  }
  for(var j=0;j<targets.length;j++){
   var p=targets[j];if(!p||!p.alive)continue;
   var px=ox-p.x,pz=oz-p.z,R=0.45;
   var b2=2*(px*dx+pz*dz),c2=px*px+pz*pz-R*R,d2=b2*b2-4*a*c2;
   if(d2<0)continue;
   var t2=(-b2-Math.sqrt(d2))/(2*a);
   if(t2<0||t2>=best.t)continue;
   var y2=oy+dy*t2;
   if(y2<p.y||y2>p.y+BODY_H)continue;
   best={t:t2,kind:5,idx:p.idx,head:y2>p.y+BODY_H-0.4};
  }
 }
 for(i=0;i<world.boxes.length;i++){
  var bx=world.boxes[i];if(!bx.solid)continue;
  var tb=rayBox(ox,oy,oz,dx,dy,dz,bx,best.t);
  if(tb>=0&&tb<best.t)best={t:tb,kind:6,idx:-1,head:false};
 }
 // terrain / water: march, then refine
 var limit=Math.min(best.t,maxT);
 for(var tt=0.4;tt<limit;tt+=(tt<40?0.6:1.2)){
  var mx=ox+dx*tt,mz=oz+dz*tt,my=oy+dy*tt,g=world.height(mx,mz);
  if(my<=g||(g<world.water&&my<=world.water)){
   var water=g<world.water&&my<=world.water&&my>g;
   best={t:Math.max(0.2,tt-0.3),kind:water?4:1,idx:-1,head:false};
   break;
  }
 }
 return best;
}

function startReload(p){
 var w=curWeapon(p);
 if(p.reloading||w.ammo>=w.st.mag)return;
 p.reloading=true;p.reloadT=w.st.reload;
}
function falloff(st,dist){
 if(dist<=st.fo0)return 1;
 if(dist>=st.fo1)return st.minMul;
 return 1+(st.minMul-1)*((dist-st.fo0)/(st.fo1-st.fo0));
}
function fire(m,shooter){
 var w=curWeapon(shooter),st=w.st;
 var victim=m.players[1-shooter.idx];
 var moving=Math.min(1,shooter.speed/7);
 var spread=st.spread*(1+moving*0.5)*(shooter.grounded?1:1.6);
 spread*=1-shooter.ads*(1-st.adsMul);
 spread+=shooter.heat;
 var ox=shooter.x,oy=shooter.y+EYE,oz=shooter.z;
 var dmgTotal=0,head=false,hitAny=false;
 for(var i=0;i<st.pellets;i++){
  var ang=Math.random()*6.2832,rad=spread*Math.sqrt(Math.random())*Math.PI/180;
  var yaw=shooter.yaw+Math.cos(ang)*rad,pitch=shooter.pitch+Math.sin(ang)*rad;
  var d=dirOf(yaw,pitch);
  var r=trace(m.world,ox,oy,oz,d[0],d[1],d[2],240,[victim]);
  var ex=ox+d[0]*r.t,ey=oy+d[1]*r.t,ez=oz+d[2]*r.t;
  m.events.push(["s",shooter.idx,r1(ox),r1(oy),r1(oz),r1(ex),r1(ey),r1(ez),r.kind,st.supp?1:0,w.g]);
  if(r.kind===5){
   hitAny=true;
   var dmg=st.damage*falloff(st,r.t)*(r.head?st.head:1);
   dmgTotal+=dmg;if(r.head)head=true;
  }
 }
 shooter.heat=Math.min(st.bloomMax,shooter.heat+st.bloom);shooter.heatT=0.12;
 if(hitAny&&victim.alive){
  victim.hp-=dmgTotal;
  m.events.push(["h",victim.idx,Math.round(dmgTotal),head?1:0]);
  if(victim.hp<=0){
   victim.hp=0;victim.alive=false;victim.deadT=2.2;shooter.score++;
   m.events.push(["k",shooter.idx]);
  }
 }
}

/* ---------- inventory actions ---------- */
function dropItem(m,p,kind,a,b,r,att){
 var fx=-Math.sin(p.yaw)*0.9,fz=-Math.cos(p.yaw)*0.9;
 var x=p.x+fx,z=p.z+fz;
 var it={id:m.loot.nextId++,kind:kind,a:a,b:b,r:r,x:x,y:m.world.height(x,z),z:z,active:true,att:att||null};
 m.loot.items.push(it);
 m.events.push(["d",it.id,kind,a,b,r,r1(it.x),r1(it.y),r1(it.z),packAtt(att)]);
}
function interact(m,p){
 var u=nearestUsable(m.loot,p.x,p.z);
 if(!u)return;
 if(u.type==="chest"){
  openChest(m.loot,u.obj);
  m.events.push(["c",chestIndex(m.loot,u.obj)]);
  return;
 }
 var it=u.obj;
 if(it.kind==="med"){
  if(p.hp>=100)return;
  p.hp=Math.min(100,p.hp+Data.HEAL[it.r]);
 }else if(it.kind==="att"){
  var w=curWeapon(p),old=w.att[it.a];
  w.att[it.a]={o:it.b,r:it.r};
  w.st=Data.computeStats(w);w.ammo=Math.min(w.ammo,w.st.mag);
  if(old)dropItem(m,p,"att",it.a,old.o,old.r,null);
  p.invDirty=true;
 }else{
  var nw=newGun(p,it.a,it.r);
  if(!p.slots[1]){p.slots[1]=nw;p.cur=1}
  else{
   var oldW=curWeapon(p);
   p.slots[p.cur]=nw;
   dropItem(m,p,"gun",oldW.g,0,oldW.r,null);
  }
  p.reloading=false;p.fireCd=0.35;p.ads=0;p.invDirty=true;
 }
 it.active=false;
 m.events.push(["t",it.id,p.idx]);
}

/* ---------- match ---------- */
function newRound(m){
 m.round++;
 m.loot=genLoot(m.world,m.world.seed*7+m.round);
 m.players.forEach(function(p){respawn(m.world,p)});
 m.events.push(["r",m.round]);
}
function createMatch(world,settings,loadouts){
 var lo=loadouts||[null,null];
 var m={world:world,settings:settings,players:[makePlayer(0,world,lo[0]),makePlayer(1,world,lo[1])],
  timeLeft:settings.timeLimit,events:[],frozen:0,over:false,round:0,loot:null};
 m.loot=genLoot(world,world.seed*7+1);m.round=1;
 return m;
}
/** Advance the match. inputs: [{f,r,jump,fire,fireL,reload,ads,use,useL,sw,yaw,pitch}, ...]. */
function step(m,inputs,dt){
 if(m.over)return;
 if(m.frozen>0){m.frozen-=dt;return}
 if(m.settings.timeLimit>0)m.timeLeft-=dt;
 for(var i=0;i<2;i++){
  var p=m.players[i],inp=inputs[i]||{};
  if(!p.alive){p.deadT-=dt;p.vx*=0.9;p.vz*=0.9;continue}
  p.yaw=inp.yaw||0;p.pitch=clamp(inp.pitch||0,-1.45,1.45);
  var w=curWeapon(p),st=w.st;
  // weapon switching
  if(inp.sw>=0&&inp.sw!=null){
   var target=inp.sw===2?1-p.cur:inp.sw;
   if(target!==p.cur&&p.slots[target]){p.cur=target;p.reloading=false;p.fireCd=0.35;p.ads=0;p.invDirty=true;w=curWeapon(p);st=w.st}
  }
  // use / pick up
  var usePressed=(inp.use&&!p.useHeld)||inp.useL;p.useHeld=!!inp.use;
  if(usePressed){interact(m,p);w=curWeapon(p);st=w.st}
  // aiming and spread recovery
  var wantAds=!!inp.ads&&!p.reloading;
  p.ads+=((wantAds?1:0)-p.ads)*Math.min(1,dt*9);
  if(p.heatT>0)p.heatT-=dt;else p.heat=Math.max(0,p.heat-st.bloomRec*dt);
  inp.mul=st.move*(1-0.3*p.ads);
  movePlayer(m.world,p,inp,dt);
  if(p.reloading){p.reloadT-=dt;if(p.reloadT<=0){p.reloading=false;w.ammo=st.mag;p.invDirty=true}}
  p.fireCd=Math.max(0,p.fireCd-dt);
  if(inp.reload)startReload(p);
  var pressed=(inp.fire&&!p.fireHeld)||inp.fireL;
  var want=st.auto?(inp.fire||inp.fireL):pressed;
  p.fireHeld=!!inp.fire;
  if(want&&p.fireCd<=0&&!p.reloading){
   if(w.ammo<=0)startReload(p);
   else{w.ammo--;p.fireCd=1/st.fireRate;fire(m,p);if(w.ammo<=0)startReload(p)}
  }
 }
 var dead=m.players.filter(function(p){return !p.alive});
 if(dead.length&&dead.every(function(p){return p.deadT<=0})){
  if(m.players[0].score>=m.settings.scoreLimit||m.players[1].score>=m.settings.scoreLimit){m.over=true;return}
  newRound(m);
  m.frozen=2;
 }
 if(m.settings.timeLimit>0&&m.timeLeft<=0)m.over=true;
}

var api={HALF:HALF,WATER:WATER,EYE:EYE,BODY_H:BODY_H,PRESETS:PRESETS,makeWorld:makeWorld,genLoot:genLoot,applyLootEvent:applyLootEvent,
 nearestUsable:nearestUsable,openChest:openChest,makeWeapon:makeWeapon,packWeapon:packWeapon,unpackWeapon:unpackWeapon,packAtt:packAtt,unpackAtt:unpackAtt,
 curWeapon:curWeapon,loadoutAtt:loadoutAtt,makePlayer:makePlayer,movePlayer:movePlayer,depthAt:depthAt,trace:trace,dirOf:dirOf,createMatch:createMatch,step:step,
 startReload:startReload,mulberry32:mulberry32,smoothstep:smoothstep,falloff:falloff};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.Sim=api;
})(typeof window!=="undefined"?window:this);
