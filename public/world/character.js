import * as THREE from "three";
/** Characters in the style of How to Fish: skinny, big goofy heads, bulging eyes, teeth. One model for players and neighbours.
 *  Players pick from PLAYER_OPTIONS; neighbours use NPC_OUTFITS, which players can't choose. */
export const SKINS=[0xf1c8a0,0xe3b186,0xc58c5e,0x9c6a42,0x6e4630,0xf7d7c4,0xbfe0a0];
export const HAIR_COLORS=[0x2a1c12,0x6a4326,0xc99a46,0xe8d28a,0xb4361f,0x1b1b1f,0xd9d9e6,0x2f6fd0,0xd04f9a];
export const TOP_COLORS=[0xd9473a,0x2f7fbf,0xe3b43a,0x4aa356,0x8a5ac4,0xe8e8e8,0x2a2f3a,0xe97ab0];
export const BOTTOM_COLORS=[0x394a6a,0x5a4630,0x2a2a2a,0x6a8a5a,0x8a3a3a,0xc9b890];
export const PLAYER_OPTIONS={
  hair:["Short","Spiky","Long","Mohawk","Bald","Bun"],
  hat:["None","Beanie","Cap","Straw hat","Bucket hat"],
  teeth:["Closed","Buck teeth","Big grin","Gap tooth"],
  top:["T-shirt","Tank top","Hoodie"],
  eyes:["Normal","Googly","Sleepy","Wide"],
  bottom:["Pants","Shorts"]
};
export const NPC_OUTFITS={
  baker:{top:0xf2f2f2,bottom:0x6a4a30,hat:"chef",apron:0xffffff},
  fisher:{top:0x3a6a8a,bottom:0x3a4a3a,hat:"straw",vest:0xe0b030},
  lumberjack:{top:0xb02a2a,bottom:0x2a3040,hat:"beanie",overalls:0x4a6aa0},
  sailor:{top:0xf6f6f6,bottom:0x1f2f5a,hat:"sailor",stripes:0x1f3f8a},
  keeper:{top:0x2f5a7a,bottom:0x2a2a2a,hat:"captain",vest:0xc9a040},
  villager:{top:0x8a6a3a,bottom:0x5a4630,hat:"none",apron:0xb8884a},
  farmer:{top:0xe0d090,bottom:0x4a6aa0,hat:"straw",overalls:0x6a8a3a}
};
const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:.85,...o});
const cache={};const M=(c,o)=>{const k=c+JSON.stringify(o||0);return cache[k]||(cache[k]=mat(c,o))};
function add(parent,geo,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);o.castShadow=true;parent.add(o);return o}
const cyl=(a,b,h,s=7)=>new THREE.CylinderGeometry(a,b,h,s);
const ico=(r,d=1)=>new THREE.IcosahedronGeometry(r,d);
export function defaultLook(i=0){return {skin:i%SKINS.length,hair:i%6,hairColor:(i*3)%HAIR_COLORS.length,hat:0,teeth:(i%3)+1,top:0,topColor:i%TOP_COLORS.length,bottom:i%2,bottomColor:i%BOTTOM_COLORS.length,eyes:0}}
/** look: player options as indices. npc: a key of NPC_OUTFITS, which overrides clothing.
 *  Chunky, friendly proportions: big round head, simple dot eyes, rosy cheeks, short thick limbs. Feet at y=0, about 1.95 tall. */
export function makeCharacter(look,npc){
  const L={...defaultLook(0),...look},o=npc?NPC_OUTFITS[npc]:null;
  const skin=M(SKINS[L.skin%SKINS.length],{roughness:.9}),hair=M(HAIR_COLORS[L.hairColor%HAIR_COLORS.length]);
  const topC=o?o.top:TOP_COLORS[L.topColor%TOP_COLORS.length],botC=o?o.bottom:BOTTOM_COLORS[L.bottomColor%BOTTOM_COLORS.length];
  const top=M(topC),bot=M(botC),shoe=M(0x3a2a22),sole=M(0xe8e0d0),white=M(0xffffff,{roughness:.4}),dark=M(0x1a1620),mouthC=M(0x8a3a3a),blush=M(0xf08a8a);
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const shorts=!o&&L.bottom===1,tank=!o&&L.top===1,hood=!o&&L.top===2;
  // legs: short and thick, hip pivot at y .66
  const mk=side=>{const leg=new THREE.Group();leg.position.set(side*.13,.66,0);
    add(leg,cyl(.115,.1,.6,8),shorts?skin:bot,0,-.3,0);
    if(shorts)add(leg,cyl(.135,.13,.3,8),bot,0,-.15,0);
    add(leg,ico(.125,1),shoe,0,-.6,.05,0,0,0,1.02,.68,1.55);
    add(leg,new THREE.BoxGeometry(.2,.03,.3),sole,0,-.655,.06);
    body.add(leg);return leg};
  const legL=mk(-1),legR=mk(1);
  // torso: one rounded capsule, with a short neck
  add(body,new THREE.CapsuleGeometry(.235,.22,3,9),top,0,.98,0,0,0,0,1,1,.86);
  add(body,cyl(.1,.11,.12,8),skin,0,1.3,0);
  if(tank)add(body,cyl(.215,.2,.1,9),skin,0,1.27,0,0,0,0,1,1,.86);
  if(hood){add(body,ico(.2,1),top,0,1.3,-.14,0,0,0,1,.75,.7);add(body,new THREE.BoxGeometry(.26,.12,.05),top,0,.8,.2);for(const s of [-1,1])add(body,new THREE.BoxGeometry(.018,.16,.018),white,s*.05,1.18,.2)}
  if(o&&o.apron){add(body,new THREE.BoxGeometry(.36,.5,.05),M(o.apron),0,.93,.2);for(const s of [-1,1])add(body,new THREE.BoxGeometry(.05,.3,.03),M(o.apron),s*.1,1.2,.19,0,0,s*.15)}
  if(o&&o.overalls){const oc=M(o.overalls);add(body,new THREE.BoxGeometry(.32,.28,.05),oc,0,1.08,.2);add(body,cyl(.24,.2,.3,9),oc,0,.78,0,0,0,0,1,1,.88);for(const s of [-1,1])add(body,new THREE.BoxGeometry(.05,.34,.04),oc,s*.1,1.2,.18,.1,0,s*.16)}
  if(o&&o.vest)add(body,cyl(.24,.2,.44,9),M(o.vest),0,1.02,0,0,0,0,1.02,1,.9);
  if(o&&o.stripes)for(let i=0;i<3;i++)add(body,cyl(.238,.238,.05,9),M(o.stripes),0,.84+i*.15,0,0,0,0,1,1,.86);
  // arms: sleeve, forearm, round mitten
  const arm=side=>{const a=new THREE.Group();a.position.set(side*.31,1.2,0);
    add(a,cyl(.088,.078,.3,8),tank?skin:top,0,-.15,0);add(a,cyl(.07,.064,.26,8),skin,0,-.4,0);add(a,ico(.1,1),skin,0,-.57,.01);
    add(a,ico(.1,1),tank?skin:top,0,-.01,0);
    body.add(a);return a};
  const armL=arm(-1),armR=arm(1);
  // head: big and round, no jaw
  const head=new THREE.Group();head.position.set(0,1.62,0);head.scale.setScalar(1.32);body.add(head);
  add(head,ico(.25,2),skin,0,0,0,0,0,0,1,1.03,1);
  for(const s of [-1,1])add(head,ico(.05,0),skin,s*.245,-.01,0,0,0,0,.55,1,1); // ears
  add(head,ico(.034,1),skin,0,-.02,.247,0,0,0,1,.85,.9); // little nose
  for(const s of [-1,1])add(head,cyl(.045,.045,.012,8),blush,s*.145,-.07,.2,Math.PI/2-.35,s*.5,0); // rosy cheeks
  // eyes
  const es=L.eyes,ex=.092,ey=.04;
  for(const s of [-1,1]){
    if(es===1){ // googly: big white eyes with wandering pupils
      add(head,ico(.075,1),white,s*ex,ey+.01,.19);add(head,ico(.036,1),dark,s*ex+(s>0?-.012:.012),ey-.005,.255);
    }else if(es===2){ // sleepy: half-closed
      add(head,ico(.04,1),dark,s*ex,ey-.012,.222,0,0,0,.95,.55,.6);add(head,new THREE.BoxGeometry(.1,.035,.03),skin,s*ex,ey+.012,.232);
    }else{ // normal / wide
      const w=es===3?1.3:1;add(head,ico(.042*w,1),dark,s*ex,ey,.222,0,0,0,.8,1.3,.65);add(head,ico(.013*w,0),white,s*ex+.011,ey+.026*w,.248);if(es===3)add(head,ico(.007,0),white,s*ex-.012,ey-.018,.249);
    }
    add(head,new THREE.BoxGeometry(.09,.022,.025),hair,s*ex,ey+(es===1?.105:es===3?.1:.085),.225,0,0,s*(es===2?-.08:.1)); // brows
  }
  // mouth: a smile arc, an open grin or buck teeth
  const smile=(r,y)=>add(head,new THREE.TorusGeometry(r,.009,4,9,Math.PI),mouthC,0,y,.238,0,0,Math.PI);
  if(L.teeth===2){add(head,cyl(.085,.085,.02,10),mouthC,0,-.108,.226,Math.PI/2,0,0,1,1,.62);add(head,new THREE.BoxGeometry(.13,.028,.02),white,0,-.082,.238)}
  else smile(.06,-.075);
  if(L.teeth===1)for(const s of [-1,1])add(head,new THREE.BoxGeometry(.036,.06,.02),white,s*.019,-.128,.24);
  if(L.teeth===3)for(const s of [-1,1])add(head,new THREE.BoxGeometry(.034,.055,.02),white,s*.045,-.123,.238);
  // hair
  const hs=o?-1:L.hair;
  if(hs>=0&&hs!==4){
    add(head,new THREE.SphereGeometry(.272,10,7,0,Math.PI*2,0,Math.PI*.5),hair,0,.03,-.03,-.45,0,0,1,1.03,1.02);
    if(hs===1)for(let i=0;i<7;i++){const a=i/7*Math.PI*2;add(head,cyl(0,.05,.2,5),hair,Math.cos(a)*.15,.27,Math.sin(a)*.15,Math.sin(a)*.5,0,-Math.cos(a)*.5)}
    if(hs===2){add(head,cyl(.2,.13,.55,6),hair,0,-.2,-.16);}
    if(hs===3)for(let i=0;i<6;i++)add(head,cyl(0,.05,.22,5),hair,0,.27-Math.abs(i-2.5)*.03,-.17+i*.07,0,0,0);
    if(hs===5)add(head,ico(.1,0),hair,0,.34,-.05);
  }
  // hats
  const hatKey=o?o.hat:["none","beanie","cap","straw","bucket"][L.hat%5];
  const hm=M(o?(o.hat==="chef"?0xffffff:o.hat==="sailor"?0xf6f6f6:o.hat==="straw"?0xe0c070:o.hat==="captain"?0x1f3a5a:topC):TOP_COLORS[(L.topColor+2)%TOP_COLORS.length]);
  if(hatKey==="beanie")add(head,new THREE.SphereGeometry(.285,9,6,0,Math.PI*2,0,Math.PI*.46),M(o?o.top:TOP_COLORS[(L.topColor+3)%8]),0,.07,0),add(head,ico(.06,0),white,0,.34,0);
  if(hatKey==="cap"){add(head,new THREE.SphereGeometry(.28,9,6,0,Math.PI*2,0,Math.PI*.44),hm,0,.07,0);add(head,new THREE.BoxGeometry(.3,.025,.2),hm,0,.08,.28)}
  if(hatKey==="straw"){add(head,cyl(.5,.5,.03,12),M(0xe0c070),0,.2,0);add(head,cyl(.22,.26,.17,10),M(0xe0c070),0,.29,0);add(head,cyl(.265,.265,.04,10),M(0xb04a3a),0,.23,0)}
  if(hatKey==="bucket")add(head,cyl(.23,.34,.2,9),hm,0,.22,0);
  if(hatKey==="chef"){add(head,cyl(.24,.24,.1,9),white,0,.26,0);add(head,ico(.28,1),white,0,.4,0,0,0,0,1,.75,1)}
  if(hatKey==="sailor"){add(head,cyl(.3,.24,.12,9),white,0,.24,0);add(head,cyl(.3,.3,.03,9),M(0x1f3f8a),0,.2,0)}
  if(hatKey==="captain"){add(head,cyl(.28,.28,.14,10),hm,0,.26,0);add(head,new THREE.BoxGeometry(.4,.03,.26),hm,0,.2,.2);add(head,ico(.04,0),M(0xe0c050),0,.27,.28)}
  g.userData={legL,legR,armL,armR,head,body,phase:Math.random()*6};
  return g;
}
/** Walk/idle animation. speed 0..1 (use >1 for running). Smooths itself so starting and stopping looks natural. */
export function animateCharacter(g,dt,speed,t){
  const u=g.userData;u.sm=(u.sm??0)+(speed-(u.sm??0))*Math.min(1,dt*9);const k=u.sm;
  u.phase+=dt*(1.6+k*7.5);
  const s=Math.sin(u.phase),c=Math.cos(u.phase),amp=Math.min(1,k*1.3);
  u.legL.rotation.x=s*.8*amp;u.legR.rotation.x=-s*.8*amp;
  u.armL.rotation.x=-s*.9*amp+.05;u.armR.rotation.x=s*.9*amp+.05;
  u.armL.rotation.z=.06+(1-amp)*Math.sin(u.phase*.6)*.03;u.armR.rotation.z=-.06-(1-amp)*Math.sin(u.phase*.6)*.03;
  u.body.position.y=Math.abs(c)*.045*amp-(1-amp)*Math.sin(u.phase*.8)*.004;
  u.body.rotation.x=amp*.08;u.body.rotation.y=s*.12*amp;           // lean into the walk, twist the hips
  u.head.rotation.y=-s*.1*amp+Math.sin(u.phase*.35)*.12*(1-amp);    // look around when idle
  u.head.rotation.z=Math.sin(u.phase*.5)*.03;u.head.rotation.x=-amp*.06;
  if(u.hit>0){u.hit-=dt;const h=Math.max(0,u.hit)/.5;u.body.rotation.x=-.5*h;u.head.rotation.x=-.4*h;u.armL.rotation.x=-1.6*h;u.armR.rotation.x=-1.6*h;u.armL.rotation.z=.6*h;u.armR.rotation.z=-.6*h}
}
/** First-person hand and forearm, with the sleeve matching the character's top. Points along -z. */
export function makeHand(skinC,sleeveC,side=1){
  // few, chunky pieces: sleeve, wrist, palm, one finger block that can curl, and a thumb
  const g=new THREE.Group(),skin=M(skinC),sl=M(sleeveC);
  add(g,cyl(.052,.046,.3,6),sl,0,0,.2,Math.PI/2,0,0);
  add(g,cyl(.04,.038,.1,6),skin,0,0,.05,Math.PI/2,0,0);
  add(g,new THREE.BoxGeometry(.1,.05,.09),skin,0,0,-.03);
  const f=new THREE.Group();f.position.set(0,.006,-.078);g.add(f);
  add(f,new THREE.BoxGeometry(.1,.042,.08),skin,0,0,-.038);
  const t=new THREE.Group();t.position.set(side*.05,0,-.005);g.add(t);
  add(t,new THREE.BoxGeometry(.036,.04,.075),skin,side*.012,0,-.03,0,side*.5,0);
  g.userData={fingers:f,thumb:t,side};
  return g;
}
