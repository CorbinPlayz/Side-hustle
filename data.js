/* Side Hustle game data: rarities, guns, attachment categories and the stat maths.
   Shared by the simulation, the HUD and the arsenal reference page, so the numbers shown to players are the real ones. */
(function(root){
"use strict";

/* Rarity scales both a gun's own stats and how strongly an attachment's effect applies. */
var RARITY=[
 {id:"common",   name:"Common",   color:"#c9d1dc",hex:0xc9d1dc,dmg:1.00,mag:1.00,reload:1.00,spread:1.00,att:0.70},
 {id:"uncommon", name:"Uncommon", color:"#4ade80",hex:0x4ade80,dmg:1.06,mag:1.08,reload:0.95,spread:0.95,att:0.85},
 {id:"rare",     name:"Rare",     color:"#4aa8ff",hex:0x4aa8ff,dmg:1.12,mag:1.16,reload:0.90,spread:0.90,att:1.00},
 {id:"epic",     name:"Epic",     color:"#b26bff",hex:0xb26bff,dmg:1.19,mag:1.25,reload:0.85,spread:0.84,att:1.20},
 {id:"legendary",name:"Legendary",color:"#ffb02e",hex:0xffb02e,dmg:1.27,mag:1.35,reload:0.80,spread:0.78,att:1.40}
];
/* Drop weights by place: ground loot, ordinary chests, and bunker chests. */
var WEIGHTS={ground:[52,27,13,6,2],chest:[30,31,22,13,4],bunker:[12,26,30,22,10]};

/* dmg per pellet, rate shots/s, mag rounds, reload s, spread degrees (hip), ads spread multiplier, bloom degrees per shot,
   bloomMax, bloomRec degrees/s, move speed multiplier, zoom (ads), fo0/fo1 damage falloff start/end metres, minMul damage at/after fo1, head multiplier */
var GUNS=[
 {id:"pistol",   name:"Pistol",          cls:"Sidearm", dmg:18,rate:5.5,auto:false,mag:12,reload:1.3,spread:1.5,ads:0.5, bloom:0.9, bloomMax:4,  bloomRec:9, move:1.00,zoom:1.25,fo0:22,fo1:60, minMul:0.55,head:1.8,pellets:1,w:6},
 {id:"revolver", name:"Revolver",        cls:"Sidearm", dmg:54,rate:1.6,auto:false,mag:6, reload:2.3,spread:0.7,ads:0.45,bloom:2.4, bloomMax:5,  bloomRec:7, move:1.00,zoom:1.3, fo0:35,fo1:85, minMul:0.6, head:1.7,pellets:1,w:8},
 {id:"smg",      name:"SMG",             cls:"SMG",     dmg:12,rate:13, auto:true, mag:30,reload:1.5,spread:2.2,ads:0.55,bloom:0.5, bloomMax:6,  bloomRec:10,move:1.04,zoom:1.3, fo0:14,fo1:38, minMul:0.5, head:1.5,pellets:1,w:12},
 {id:"ar",       name:"Assault Rifle",   cls:"Rifle",   dmg:20,rate:8.5,auto:true, mag:30,reload:2.0,spread:1.5,ads:0.4, bloom:0.55,bloomMax:5,  bloomRec:9, move:0.98,zoom:1.4, fo0:35,fo1:95, minMul:0.6, head:1.6,pellets:1,w:12},
 {id:"shotgun",  name:"Pump Shotgun",    cls:"Shotgun", dmg:12,rate:1.1,auto:false,mag:6, reload:2.6,spread:5.0,ads:0.7, bloom:1.5, bloomMax:4,  bloomRec:6, move:0.97,zoom:1.2, fo0:8, fo1:24, minMul:0.25,head:1.3,pellets:8,w:10},
 {id:"dmr",      name:"Marksman Rifle",  cls:"DMR",     dmg:38,rate:3.0,auto:false,mag:12,reload:2.1,spread:0.7,ads:0.35,bloom:1.1, bloomMax:4,  bloomRec:7, move:0.96,zoom:2.0, fo0:60,fo1:150,minMul:0.7, head:2.0,pellets:1,w:8},
 {id:"sniper",   name:"Bolt Sniper",     cls:"Sniper",  dmg:88,rate:0.9,auto:false,mag:5, reload:2.8,spread:0.45,ads:0.12,bloom:2.2,bloomMax:5,  bloomRec:6, move:0.92,zoom:3.0, fo0:110,fo1:230,minMul:0.85,head:2.0,pellets:1,w:5},
 {id:"lmg",      name:"Light Machine Gun",cls:"LMG",    dmg:17,rate:10, auto:true, mag:80,reload:4.6,spread:2.1,ads:0.5, bloom:0.4, bloomMax:7,  bloomRec:8, move:0.90,zoom:1.3, fo0:40,fo1:100,minMul:0.6, head:1.5,pellets:1,w:5}
];

/* Seven attachment categories, three options each. m: multipliers (1 = no change), except zoom/head which are additive.
   At nominal (Rare) strength; rarity rescales them: a Common is 70% of the effect, a Legendary 140%. */
var CATS=[
 {id:"optic",name:"Optic",abbr:"OP",opts:[
  {id:"reddot",name:"Red Dot",  m:{zoom:0.5,spread:0.85,ads:0.8}},
  {id:"holo",  name:"Holo Sight",m:{zoom:1.0,spread:0.78,ads:0.75}},
  {id:"scope", name:"4x Scope", m:{zoom:2.2,head:0.35,spread:1.05,move:0.96}}]},
 {id:"muzzle",name:"Muzzle",abbr:"MZ",opts:[
  {id:"suppressor",name:"Suppressor", m:{supp:true,dmg:0.94,falloff:1.12}},
  {id:"comp",      name:"Compensator",m:{bloom:0.5,spread:0.94}},
  {id:"choke",     name:"Choke",      m:{spread:0.62,bloom:1.1}}]},
 {id:"barrel",name:"Barrel",abbr:"BR",opts:[
  {id:"long", name:"Long Barrel", m:{falloff:1.5,dmg:1.05,move:0.96}},
  {id:"short",name:"Short Barrel",m:{spread:0.78,move:1.05,falloff:0.8}},
  {id:"heavy",name:"Heavy Barrel",m:{dmg:1.14,rate:0.92,bloom:0.9}}]},
 {id:"mag",name:"Magazine",abbr:"MG",opts:[
  {id:"ext", name:"Extended Mag",m:{mag:1.5,reload:1.12}},
  {id:"fast",name:"Fast Mag",    m:{reload:0.6}},
  {id:"drum",name:"Drum Mag",    m:{mag:2.1,reload:1.3,move:0.95}}]},
 {id:"grip",name:"Grip",abbr:"GR",opts:[
  {id:"vert",  name:"Vertical Grip",m:{bloom:0.55,spread:0.92}},
  {id:"angled",name:"Angled Grip",  m:{spread:0.76,ads:0.9}},
  {id:"ergo",  name:"Ergo Grip",    m:{reload:0.82,move:1.04,bloom:0.85}}]},
 {id:"stock",name:"Stock",abbr:"ST",opts:[
  {id:"light", name:"Light Stock", m:{move:1.08,spread:1.08,rate:1.05}},
  {id:"padded",name:"Padded Stock",m:{spread:0.84,bloom:0.78}},
  {id:"heavy", name:"Heavy Stock", m:{bloom:0.6,dmg:1.04,move:0.94}}]},
 {id:"ammo",name:"Ammo",abbr:"AM",opts:[
  {id:"hollow",name:"Hollow Point", m:{dmg:1.22,falloff:0.8}},
  {id:"ap",    name:"Armor Piercing",m:{dmg:1.1,falloff:1.25,head:0.2}},
  {id:"match", name:"Match Grade",  m:{spread:0.72,dmg:1.05,bloom:0.9}}]}
];

var ADDITIVE={zoom:1,head:1};
var LABEL={dmg:"damage",rate:"fire rate",mag:"magazine",reload:"reload time",spread:"hip spread",ads:"aimed spread",bloom:"bloom",move:"move speed",falloff:"effective range",zoom:"zoom",head:"headshot"};

function scaleMod(key,val,sc){return ADDITIVE[key]?val*sc:1+(val-1)*sc}

/** Final stats for a weapon: {g:gunIndex, r:rarity, att:[null|{o,r} x7]}. */
function computeStats(w){
 var g=GUNS[w.g],R=RARITY[w.r];
 var s={damage:g.dmg*R.dmg,fireRate:g.rate,mag:g.mag*R.mag,reload:g.reload*R.reload,spread:g.spread*R.spread,adsMul:g.ads,
  bloom:g.bloom,bloomMax:g.bloomMax,bloomRec:g.bloomRec,move:g.move,zoom:g.zoom,fo0:g.fo0,fo1:g.fo1,minMul:g.minMul,
  head:g.head,pellets:g.pellets,auto:g.auto,supp:false,name:g.name,gun:g.id};
 for(var c=0;c<CATS.length;c++){
  var a=w.att&&w.att[c];if(!a)continue;
  var m=CATS[c].opts[a.o].m,sc=RARITY[a.r].att;
  for(var k in m){
   if(k==="supp"){s.supp=true;continue}
   var f=scaleMod(k,m[k],sc);
   if(k==="dmg")s.damage*=f;else if(k==="rate")s.fireRate*=f;else if(k==="mag")s.mag*=f;else if(k==="reload")s.reload*=f;
   else if(k==="spread")s.spread*=f;else if(k==="ads")s.adsMul*=f;else if(k==="bloom")s.bloom*=f;else if(k==="move")s.move*=f;
   else if(k==="falloff"){s.fo0*=f;s.fo1*=f}else if(k==="zoom")s.zoom+=f;else if(k==="head")s.head+=f;
  }
 }
 s.mag=Math.max(1,Math.round(s.mag));
 s.reload=Math.max(0.4,s.reload);
 s.spread=Math.max(0.05,s.spread);
 s.fireRate=Math.max(0.5,s.fireRate);
 s.move=Math.max(0.75,Math.min(1.2,s.move));
 s.adsMul=Math.max(0.08,Math.min(1,s.adsMul));
 s.bloom=Math.max(0,s.bloom);
 return s;
}

/** Human-readable effect list for an attachment at a rarity, e.g. ["+22% damage","-20% effective range"]. */
function describeAttachment(c,o,r){
 var m=CATS[c].opts[o].m,sc=RARITY[r].att,out=[];
 for(var k in m){
  if(k==="supp"){out.push("silenced shots");continue}
  var v=scaleMod(k,m[k],sc);
  if(ADDITIVE[k]){out.push((v>=0?"+":"")+(k==="zoom"?v.toFixed(1)+"x":Math.round(v*100)+"%")+" "+LABEL[k]);continue}
  var pct=Math.round((v-1)*100);
  out.push((pct>=0?"+":"")+pct+"% "+LABEL[k]);
 }
 return out;
}

/** Weighted rarity roll. table is one of WEIGHTS.*; rnd returns [0,1). */
function rollRarity(table,rnd){
 var t=0,i;for(i=0;i<table.length;i++)t+=table[i];
 var x=rnd()*t;
 for(i=0;i<table.length;i++){x-=table[i];if(x<0)return i}
 return 0;
}
function rollGun(rnd,allowPistol){
 var t=0,i;for(i=0;i<GUNS.length;i++)t+=(i===0&&!allowPistol)?0:GUNS[i].w;
 var x=rnd()*t;
 for(i=0;i<GUNS.length;i++){var w=(i===0&&!allowPistol)?0:GUNS[i].w;x-=w;if(x<0)return i}
 return 3;
}
var HEAL=[30,40,55,70,100];


/* ---------- progression: XP, levels and attachment unlocks ---------- */
var MAX_LEVEL=30;
/* Level at which each attachment unlocks, [category][option]. The unlock level also sets its strength tier. */
var ATT_LEVEL=[[2,9,18],[4,12,21],[5,13,22],[3,10,19],[6,14,23],[7,15,24],[8,16,25]];
function attRarity(level){return level<=7?1:(level<=14?2:(level<=21?3:4))}
function attUnlockLevel(c,o){return ATT_LEVEL[c][o]}
/** XP needed to go from level n to n+1. */
function xpNeed(n){return 100+50*(n-1)}
/** Total XP at which a level begins. */
function xpAt(level){var t=0;for(var n=1;n<level;n++)t+=xpNeed(n);return t}
function levelInfo(xp){
 xp=Math.max(0,xp|0);var lv=1;
 while(lv<MAX_LEVEL&&xp>=xpAt(lv+1))lv++;
 var base=xpAt(lv),need=lv>=MAX_LEVEL?0:xpNeed(lv);
 return {level:lv,into:xp-base,need:need,xp:xp,max:lv>=MAX_LEVEL};
}
function matchXp(kills,won){return 40+30*Math.max(0,Math.min(10,kills|0))+(won?80:0)}
/** Loadout format: array of 8 arrays (one per gun) of 7 option indexes, -1 for none. */
function emptyLoadout(){var a=[];for(var g=0;g<GUNS.length;g++){var r=[];for(var c=0;c<CATS.length;c++)r.push(-1);a.push(r)}return a}
function sanitizeLoadout(lo){
 var out=emptyLoadout();
 if(!Array.isArray(lo))return out;
 for(var g=0;g<GUNS.length;g++)for(var c=0;c<CATS.length;c++){
  var v=lo[g]&&lo[g][c];v=(v===0||v===1||v===2)?v:-1;out[g][c]=v;
 }
 return out;
}
/** Turn a loadout into attachment objects for each gun, keeping only what the level has unlocked. */
function expandLoadout(lo,level){
 lo=sanitizeLoadout(lo);var out=[];
 for(var g=0;g<GUNS.length;g++){
  var att=[];
  for(var c=0;c<CATS.length;c++){
   var o=lo[g][c];
   att.push(o>=0&&level>=ATT_LEVEL[c][o]?{o:o,r:attRarity(ATT_LEVEL[c][o])}:null);
  }
  out.push(att);
 }
 return out;
}

var api={MAX_LEVEL:MAX_LEVEL,ATT_LEVEL:ATT_LEVEL,attRarity:attRarity,attUnlockLevel:attUnlockLevel,xpNeed:xpNeed,xpAt:xpAt,levelInfo:levelInfo,matchXp:matchXp,emptyLoadout:emptyLoadout,sanitizeLoadout:sanitizeLoadout,expandLoadout:expandLoadout,RARITY:RARITY,WEIGHTS:WEIGHTS,GUNS:GUNS,CATS:CATS,HEAL:HEAL,computeStats:computeStats,describeAttachment:describeAttachment,rollRarity:rollRarity,rollGun:rollGun};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.Data=api;
})(typeof window!=="undefined"?window:this);
