/* Side Hustle rendering (three.js r128). Builds the map, structures, chests, loot and gun models from the shared sim
   data, and draws one or two first-person views. Also owns particles, tracers, water ripples and sound. */
(function(root){
"use strict";
var T=root.THREE;
var Sim=root.Sim;
var Data=root.Data;

/* ---------- sound ---------- */
var Sfx=(function(){
 var ac=null,noise=null,master=1;
 function ctx(){
  if(ac)return ac;
  try{ac=new(root.AudioContext||root.webkitAudioContext)();
   var len=ac.sampleRate*0.7,buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);
   for(var i=0;i<len;i++)d[i]=Math.random()*2-1;
   noise=buf;
  }catch(e){ac=null}
  return ac;
 }
 function burst(dur,freq,q,vol,type,slide){
  var a=ctx();if(!a||vol<=0.001)return;
  try{
   var src=a.createBufferSource();src.buffer=noise;
   var f=a.createBiquadFilter();f.type=type||"lowpass";f.frequency.value=freq;f.Q.value=q||0.7;
   if(slide)f.frequency.exponentialRampToValueAtTime(Math.max(40,freq*slide),a.currentTime+dur);
   var g=a.createGain();g.gain.setValueAtTime(vol*master,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+dur);
   src.connect(f);f.connect(g);g.connect(a.destination);src.start();src.stop(a.currentTime+dur+0.02);
  }catch(e){}
 }
 function tone(freq,dur,vol,type,slide){
  var a=ctx();if(!a||vol<=0.001)return;
  try{
   var o=a.createOscillator(),g=a.createGain();o.type=type||"sine";o.frequency.setValueAtTime(freq,a.currentTime);
   if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),a.currentTime+dur);
   g.gain.setValueAtTime(vol*master,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+dur);
   o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+dur+0.02);
  }catch(e){}
 }
 // [noise duration, noise freq, noise vol, tone freq, tone duration]
 var CFG={pistol:[0.14,2600,0.4,170,0.1],revolver:[0.3,1500,0.6,80,0.22],smg:[0.08,3400,0.28,280,0.05],ar:[0.14,2200,0.4,130,0.1],
  shotgun:[0.3,1300,0.55,85,0.2],dmr:[0.22,1800,0.5,110,0.16],sniper:[0.5,1100,0.65,70,0.3],lmg:[0.12,2000,0.4,100,0.1]};
 return {
  volume:function(v){master=v},
  unlock:function(){ctx()},
  shot:function(id,vol,supp){
   var c=CFG[id]||CFG.ar,k=supp?0.3:1;
   burst(c[0]*(supp?0.7:1),c[1]*(supp?0.45:1),0.9,c[2]*vol*k,"lowpass",0.3);
   tone(c[3]*(supp?1.3:1),c[4],c[2]*0.55*vol*k,"square",0.4);
  },
  splash:function(vol){burst(0.35,1800,0.6,0.35*vol,"bandpass",0.4)},
  hit:function(){tone(1500,0.05,0.12,"square");tone(900,0.07,0.1,"square")},
  hurt:function(){tone(110,0.18,0.35,"sawtooth",0.5);burst(0.12,600,1,0.2,"lowpass")},
  kill:function(){tone(520,0.09,0.15,"triangle");setTimeout(function(){tone(780,0.16,0.15,"triangle")},90)},
  reload:function(){burst(0.05,4000,1,0.15,"highpass");setTimeout(function(){burst(0.06,3000,1,0.2,"highpass")},520)},
  empty:function(){tone(1200,0.03,0.1,"square")},
  swap:function(){burst(0.06,2500,1,0.15,"highpass");tone(300,0.05,0.08,"triangle")},
  chest:function(){tone(180,0.25,0.18,"sawtooth",0.6);burst(0.2,900,1,0.18,"lowpass");setTimeout(function(){tone(900,0.1,0.1,"triangle")},120)},
  pickup:function(r){
   var base=[520,600,700,820,980][r||0];
   tone(base,0.08,0.14,"triangle");setTimeout(function(){tone(base*1.5,0.12,0.14,"triangle")},70);
   if(r>=3)setTimeout(function(){tone(base*2,0.2,0.12,"triangle")},150);
  },
  heal:function(){tone(440,0.12,0.12,"sine");setTimeout(function(){tone(660,0.2,0.12,"sine")},100)}
 };
})();

/* ---------- helpers ---------- */
var dummy=null,tmpCol=null;
function lerp(a,b,t){return a+(b-a)*t}
function mix3(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]}
function inst(geo,material,n,shadow){
 var m=new T.InstancedMesh(geo,material,n);
 m.frustumCulled=false;m.castShadow=!!shadow;m.receiveShadow=false;
 return m;
}
function setI(mesh,i,x,y,z,sx,sy,sz,ry,rgb){
 dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,ry||0,0);dummy.updateMatrix();
 mesh.setMatrixAt(i,dummy.matrix);
 if(rgb){tmpCol.setRGB(rgb[0],rgb[1],rgb[2]);mesh.setColorAt(i,tmpCol)}
}
function finish(mesh){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}
function mat(hex,flat){return new T.MeshLambertMaterial({color:hex,flatShading:!!flat})}

var C={
 grassA:[0.33,0.66,0.2],grassB:[0.5,0.79,0.27],grassC:[0.26,0.56,0.2],
 dirt:[0.55,0.38,0.22],sand:[0.86,0.77,0.5],mud:[0.36,0.27,0.18],rock:[0.52,0.48,0.44]
};

/* ---------- view state ---------- */
var renderer=null,canvas=null,scene=null,sun=null,sunTarget=null,worldGroup=null,world=null;
var cams=[],guns=[],kick=[0,0],models=[],water=null,waterBase=null,waterIdx=null,clouds=[];
var tracers=[],particles=[],ripples=[];
var pstate=[{wading:false,t:0,flash:0},{wading:false,t:0,flash:0}];
var clock=0,lastW=0,lastH=0,waterFrame=0,lastShotSnd=[-1,-1];
var infos=[{ads:0,fovRatio:1,scoped:false},{ads:0,fovRatio:1,scoped:false}];
var lootGroup=null,lootMap={},chestMeshes=[],lootRef=null;
var BASE_FOV=75;

function init(canvasEl){
 canvas=canvasEl;
 if(!T)return "The 3D library did not load.";
 try{
  renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:"high-performance"});
 }catch(e){return "This browser could not start WebGL."}
 renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,1.5));
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=T.PCFSoftShadowMap;
 dummy=new T.Object3D();tmpCol=new T.Color();
 scene=new T.Scene();
 scene.background=new T.Color(0x8fd0ff);
 scene.fog=new T.Fog(0xcfeaff,90,340);

 scene.add(new T.HemisphereLight(0xd6ecff,0x6f9450,0.8));
 sun=new T.DirectionalLight(0xfff0cc,0.95);
 sun.position.set(60,90,40);
 sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);
 var sc=sun.shadow.camera;sc.left=-55;sc.right=55;sc.top=55;sc.bottom=-55;sc.near=10;sc.far=300;
 sun.shadow.bias=-0.0006;
 sunTarget=new T.Object3D();sun.target=sunTarget;
 scene.add(sun);scene.add(sunTarget);

 buildSky();
 for(var i=0;i<2;i++){
  var cam=new T.PerspectiveCamera(BASE_FOV,1,0.05,900);
  cam.rotation.order="YXZ";
  cam.layers.enable(1+i);          // own viewmodel
  cam.layers.enable(3+(1-i));      // the other player's body and gun
  cam.layers.enable(5);            // loot and chests (not on layer 0 so hidden from nothing; shared)
  scene.add(cam);cams.push(cam);
  var g=makeViewGun(i);cam.add(g.group);guns.push(g);
  models.push(makeCharacter(i===0?0x2f7de1:0xe8742a,3+i));
  scene.add(models[i].group);
 }
 for(var t=0;t<24;t++){
  var tm=new T.Mesh(new T.CylinderGeometry(0.03,0.03,1,4),new T.MeshBasicMaterial({color:0xfff2a8,transparent:true,opacity:0.9}));
  tm.visible=false;scene.add(tm);tracers.push({mesh:tm,life:0});
 }
 var pg=new T.SphereGeometry(0.08,5,4);
 for(var q=0;q<160;q++){
  var pm=new T.Mesh(pg,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1}));
  pm.visible=false;scene.add(pm);particles.push({mesh:pm,life:0,max:1,vx:0,vy:0,vz:0,g:9});
 }
 var rg=new T.RingGeometry(0.25,0.4,28);rg.rotateX(-Math.PI/2);
 for(var r=0;r<28;r++){
  var rm=new T.Mesh(rg,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.6,side:T.DoubleSide,depthWrite:false}));
  rm.visible=false;scene.add(rm);ripples.push({mesh:rm,life:0,max:1,size:2});
 }
 return null;
}

function buildSky(){
 var g=new T.SphereGeometry(650,20,12),pos=g.attributes.position,cols=[],top=[0.2,0.52,0.92],hor=[0.82,0.93,1.0];
 for(var i=0;i<pos.count;i++){
  var t=Math.max(0,Math.min(1,pos.getY(i)/450));
  var c=mix3(hor,top,Math.pow(t,0.7));cols.push(c[0],c[1],c[2]);
 }
 g.setAttribute("color",new T.Float32BufferAttribute(cols,3));
 var sky=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false}));
 scene.add(sky);
 var sunBall=new T.Mesh(new T.SphereGeometry(18,16,12),new T.MeshBasicMaterial({color:0xfff4b0,fog:false}));
 sunBall.position.set(400,500,260);scene.add(sunBall);
 var cm=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.92,fog:false});
 var rnd=Sim.mulberry32(99);
 for(var k=0;k<11;k++){
  var grp=new T.Group();
  var n=3+Math.floor(rnd()*3);
  for(var j=0;j<n;j++){
   var s=new T.Mesh(new T.SphereGeometry(8+rnd()*8,10,8),cm);
   s.position.set((j-n/2)*13+rnd()*4,rnd()*3,rnd()*9);s.scale.y=0.55;grp.add(s);
  }
  grp.position.set((rnd()*2-1)*340,85+rnd()*45,(rnd()*2-1)*340);
  scene.add(grp);clouds.push(grp);
 }
}

/* ---------- shared primitives for guns, chests and loot ---------- */
var UB=null,UCY=null,matCache={};
function gmat(hex){
 var m=matCache[hex];
 if(!m){m=matCache[hex]=new T.MeshLambertMaterial({color:hex,flatShading:true})}
 return m;
}
function bmat(hex){
 var k="b"+hex,m=matCache[k];
 if(!m){m=matCache[k]=new T.MeshBasicMaterial({color:hex})}
 return m;
}
function prims(){
 if(UB)return;
 UB=new T.BoxGeometry(1,1,1);
 UCY=new T.CylinderGeometry(1,1,1,10);UCY.rotateX(Math.PI/2); // axis along z
}
/** Box primitive added to group g. */
function bx(g,w,h,d,hex,x,y,z,rx,basic){
 prims();
 var m=new T.Mesh(UB,basic?bmat(hex):gmat(hex));m.scale.set(w,h,d);m.position.set(x,y,z);if(rx)m.rotation.x=rx;g.add(m);return m;
}
/** Cylinder along z (or along x when alongX). */
function cy(g,r,len,hex,x,y,z,alongX,basic){
 prims();
 var m=new T.Mesh(UCY,basic?bmat(hex):gmat(hex));m.scale.set(r,r,len);m.position.set(x,y,z);if(alongX)m.rotation.y=Math.PI/2;g.add(m);return m;
}
function setLayer(obj,l){obj.traverse(function(o){o.layers.set(l)})}
function rarityHex(r){return Data.RARITY[r].hex}

/* ---------- gun models ---------- */
var DARK=0x2b2d33,STEEL=0x5b626d,WOOD=0x8a5a2b,BLACK=0x1b1c20;
/* rec:[w,h,d,zCenter]  bl barrel length  br barrel radius  mag:[w,h,d,z]  stock:[len,h] */
var GS=[
 {rec:[0.05,0.07,0.24,-0.06],bl:0,br:0.014,mag:[0.035,0.09,0.05,0.03],nomag:true,stock:null,handle:true,body:0x3b3f48},
 {rec:[0.05,0.08,0.15,-0.02],bl:0.24,br:0.02,mag:[0.04,0.06,0.04,-0.02],nomag:true,stock:null,handle:true,drum:true,body:0x6b6f78},
 {rec:[0.06,0.085,0.3,-0.1],bl:0.1,br:0.016,mag:[0.04,0.2,0.05,-0.08],stock:[0.18,0.04],handle:true,body:DARK},
 {rec:[0.065,0.1,0.4,-0.1],bl:0.26,br:0.016,mag:[0.045,0.15,0.07,-0.05],stock:[0.24,0.09],handle:true,hand:0.2,body:0x383c44},
 {rec:[0.07,0.09,0.24,-0.04],bl:0.5,br:0.02,mag:[0.04,0.06,0.06,-0.04],nomag:true,stock:[0.26,0.1],handle:true,tube:0.45,pump:true,body:0x4a4d55,wood:true},
 {rec:[0.065,0.1,0.42,-0.1],bl:0.34,br:0.016,mag:[0.045,0.12,0.06,-0.04],stock:[0.28,0.11],handle:true,hand:0.18,body:0x3e4350,wood:true},
 {rec:[0.065,0.1,0.34,-0.08],bl:0.52,br:0.017,mag:[0.04,0.08,0.06,-0.04],stock:[0.3,0.12],handle:true,bolt:true,body:0x45503f,wood:true},
 {rec:[0.08,0.12,0.44,-0.1],bl:0.34,br:0.02,mag:[0.1,0.14,0.14,-0.06],stock:[0.22,0.1],handle:true,hand:0.18,shield:true,body:0x3b4038}
];

/** Build a gun model for weapon wp = {g,r,att}. Returns {group,muzzleZ,sightY,flashZ,supp}. Barrel points along -z. */
function buildGun(wp){
 var S=GS[wp.g],R=Data.RARITY[wp.r],att=wp.att||[];
 var grp=new T.Group(),i;
 var rw=S.rec[0],rh=S.rec[1],rd=S.rec[2],rz=S.rec[3],top=rh/2;
 var bo=att[2]?att[2].o:-1,front=rz-rd/2;
 var blen=S.bl*(bo===0?1.4:bo===1?0.65:1)+(bo===0?0.05:0);
 var br=S.br*(bo===2?1.7:1);
 // receiver, with the rarity accent strip along the top
 bx(grp,rw,rh,rd,S.body,0,0,rz);
 bx(grp,rw*0.55,0.012,rd*0.75,R.hex,0,top+0.005,rz,0,true);
 if(S.bl>0||bo>=0){cy(grp,br,Math.max(0.02,blen),STEEL,0,0.012,front-blen/2+0.001)}
 if(S.hand)bx(grp,rw*0.95,rh*0.8,S.hand,S.wood?WOOD:0x30343b,0,-0.006,front-S.hand/2+0.02);
 if(S.tube){cy(grp,0.02,S.tube,STEEL,0,-0.05,front-S.tube/2+0.04);bx(grp,0.06,0.05,0.14,WOOD,0,-0.05,front-0.2)}
 if(S.shield)cy(grp,0.034,0.2,0x2a2b2e,0,0.012,front-0.16);
 if(S.bolt){bx(grp,0.05,0.016,0.016,STEEL,0.045,0.02,rz+0.03);bx(grp,0.015,0.015,0.015,STEEL,0.072,0.02,rz+0.03)}
 if(S.drum)cy(grp,0.042,0.075,STEEL,0,0.0,rz+0.01);
 if(S.pump===undefined&&false)bx(grp,0.01,0.01,0.01,0,0,0,0);
 // pistol grip
 if(S.handle){bx(grp,0.045,0.13,0.06,S.wood?WOOD:0x24262b,0,-rh/2-0.06,rz+rd/2-0.03,0.2)}
 // base magazine
 var mo=att[3]?att[3].o:-1;
 var mg=S.mag,mH=mg[1],mW=mg[0],mD=mg[2],mZ=mg[3];
 if(mo===0)mH*=1.5;
 if(mo===2){
  cy(grp,0.075,mW*1.6,0x34373d,0,-rh/2-0.09,mZ,true);
  bx(grp,mW*1.6+0.004,0.016,0.016,R.hex,0,-rh/2-0.09,mZ+0.075,0,true);
 }else if(!S.nomag||mo>=0){
  bx(grp,mW,mH,mD,0x25272c,0,-rh/2-mH/2,mZ,0.08);
  if(mo===1)bx(grp,mW+0.006,0.02,mD+0.006,0xff9a1a,0,-rh/2-0.03,mZ,0.08);
  if(mo===0)bx(grp,mW+0.006,0.012,mD+0.006,R.hex,0,-rh/2-mH+0.01,mZ,0.08,true);
 }
 // stock
 var so=att[5]?att[5].o:-1,sx0=rz+rd/2;
 if(so>=0){
  var sLen=so===1?0.24:(so===0?0.2:0.28);
  if(so===0){bx(grp,0.012,0.05,sLen,STEEL,0.02,0.01,sx0+sLen/2);bx(grp,0.012,0.05,sLen,STEEL,-0.02,0.01,sx0+sLen/2);bx(grp,0.05,0.07,0.02,0x2a2c31,0,0,sx0+sLen)}
  else if(so===1){bx(grp,0.045,0.09,sLen,0x34373d,0,-0.005,sx0+sLen/2);bx(grp,0.05,0.11,0.035,0xd0702a,0,-0.005,sx0+sLen)}
  else{bx(grp,0.06,0.13,sLen,0x30333a,0,-0.01,sx0+sLen/2);bx(grp,0.065,0.14,0.04,0x1d1e22,0,-0.01,sx0+sLen)}
  bx(grp,0.052,0.01,sLen*0.6,rarityHex(att[5].r),0,top-0.01,sx0+sLen/2,0,true);
 }else if(S.stock){
  bx(grp,rw*0.8,S.stock[1],S.stock[0],S.wood?WOOD:0x2a2c31,0,-0.01,sx0+S.stock[0]/2);
 }
 // grip
 var go=att[4]?att[4].o:-1,gz=front-(S.bl>0.15?0.12:0.05);
 if(go===0){bx(grp,0.035,0.11,0.035,0x25272c,0,-rh/2-0.055,gz);bx(grp,0.038,0.01,0.038,rarityHex(att[4].r),0,-rh/2-0.11,gz,0,true)}
 else if(go===1){bx(grp,0.035,0.11,0.04,0x25272c,0,-rh/2-0.05,gz-0.02,-0.8);bx(grp,0.038,0.01,0.038,rarityHex(att[4].r),0,-rh/2-0.1,gz-0.05,-0.8,true)}
 else if(go===2){bx(grp,0.045,0.1,0.06,0x2f4a3a,0,-rh/2-0.05,gz,0.25);bx(grp,0.048,0.01,0.05,rarityHex(att[4].r),0,-rh/2-0.1,gz+0.01,0.25,true)}
 // ammo band on the receiver
 var ao=att[6]?att[6].o:-1;
 if(ao>=0){
  var ac=[0xd9463a,0x3a6bd6,0xe8c34a][ao];
  bx(grp,rw+0.008,rh*0.5,0.03,ac,0,0,rz+rd*0.28);
  if(ao===1)bx(grp,rw+0.01,rh*0.5,0.012,0x1b1c20,0,0,rz+rd*0.28+0.02);
 }
 // muzzle device
 var muzzle=front-blen,flashZ=muzzle-0.05,supp=false;
 var mzo=att[1]?att[1].o:-1;
 if(mzo===0){cy(grp,br+0.014,0.2,0x1e1f22,0,0.012,muzzle-0.09);bx(grp,br*2+0.034,0.01,0.012,rarityHex(att[1].r),0,0.012+br+0.014,muzzle-0.05,0,true);muzzle-=0.19;flashZ=muzzle;supp=true}
 else if(mzo===1){cy(grp,br*1.8,0.05,0x7a5b2c,0,0.012,muzzle-0.015);bx(grp,br*3.8,0.008,0.012,rarityHex(att[1].r),0,0.012,muzzle-0.03,0,true);muzzle-=0.05;flashZ=muzzle-0.03}
 else if(mzo===2){cy(grp,br*1.5,0.07,0x5a4a3a,0,0.012,muzzle-0.03);cy(grp,br*0.9,0.03,0x1b1c20,0,0.012,muzzle-0.075);muzzle-=0.08;flashZ=muzzle-0.03}
 // optic or iron sights
 var oo=att[0]?att[0].o:-1,sightY;
 var oz=rz-rd*0.1;
 if(oo===0){
  bx(grp,0.04,0.012,0.06,0x1b1c20,0,top+0.006,oz);bx(grp,0.035,0.045,0.01,0x1b1c20,0,top+0.034,oz+0.025);bx(grp,0.03,0.03,0.005,0xff4444,0,top+0.04,oz-0.022,0,true);
  bx(grp,0.02,0.004,0.06,rarityHex(att[0].r),0,top+0.059,oz,0,true);
  sightY=top+0.042;
 }else if(oo===1){
  bx(grp,0.045,0.012,0.08,0x1b1c20,0,top+0.006,oz);bx(grp,0.008,0.06,0.07,0x1b1c20,0.022,top+0.04,oz);bx(grp,0.008,0.06,0.07,0x1b1c20,-0.022,top+0.04,oz);
  bx(grp,0.05,0.01,0.075,0x1b1c20,0,top+0.073,oz);bx(grp,0.036,0.05,0.004,0x66e6ff,0,top+0.04,oz-0.03,0,true);
  bx(grp,0.05,0.004,0.02,rarityHex(att[0].r),0,top+0.079,oz,0,true);
  sightY=top+0.045;
 }else if(oo===2){
  cy(grp,0.03,0.24,0x23252a,0,top+0.05,oz);cy(grp,0.036,0.04,0x2f3238,0,top+0.05,oz-0.1);cy(grp,0.034,0.04,0x2f3238,0,top+0.05,oz+0.1);
  bx(grp,0.02,0.04,0.03,0x1b1c20,0,top+0.02,oz+0.05);bx(grp,0.02,0.04,0.03,0x1b1c20,0,top+0.02,oz-0.05);
  cy(grp,0.026,0.004,0x6ad0ff,0,top+0.05,oz-0.121,false,true);
  bx(grp,0.016,0.006,0.1,rarityHex(att[0].r),0,top+0.086,oz,0,true);
  sightY=top+0.05;
 }else{
  bx(grp,0.008,0.02,0.01,0x15161a,0,top+0.01,front-0.02);bx(grp,0.03,0.014,0.012,0x15161a,0,top+0.007,rz+rd/2-0.02);
  sightY=top+0.018;
 }
 return {group:grp,muzzleZ:muzzle,sightY:sightY,flashZ:flashZ,supp:supp};
}

function wpKey(wp){
 if(!wp)return "-";
 var a=wp.att||[],s=wp.g+"|"+wp.r+"|";
 for(var i=0;i<7;i++)s+=(a[i]?a[i].o+":"+a[i].r:"-")+",";
 return s;
}
function wpStats(wp){
 if(!wp)return null;
 if(wp.st)return wp.st;
 if(wp._st&&wp._k===wpKey(wp))return wp._st;
 wp._k=wpKey(wp);wp._st=Data.computeStats(wp);return wp._st;
}

/** The first-person gun held by camera i (layer 1+i). */
function makeViewGun(idx){
 var holder=new T.Group();
 var flash=new T.Mesh(new T.SphereGeometry(0.07,8,6),new T.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0.95}));
 flash.visible=false;
 var o={group:holder,flash:flash,key:null,model:null,sightY:0.06,layer:1+idx};
 o.set=function(wp){
  var k=wpKey(wp);
  if(k===o.key)return;o.key=k;
  if(o.model){holder.remove(o.model);o.model=null}
  if(!wp)return;
  var b=buildGun(wp);
  o.model=b.group;o.sightY=b.sightY;
  flash.position.set(0,0.012,b.flashZ);flash.scale.setScalar(b.supp?0.01:1);
  b.group.add(flash);
  holder.add(b.group);
  setLayer(holder,o.layer);
 };
 return o;
}

function box(w,h,d,hex){var m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(hex,true));m.castShadow=true;return m}

function makeCharacter(shirt,layer){
 var g=new T.Group();
 var body=box(0.56,0.74,0.32,shirt);body.position.y=1.08;g.add(body);
 var head=new T.Mesh(new T.SphereGeometry(0.21,10,8),mat(0xf0c39a,false));head.position.y=1.65;head.castShadow=true;g.add(head);
 var cap=box(0.46,0.13,0.46,0x2a2f3a);cap.position.y=1.82;g.add(cap);
 var brim=box(0.4,0.04,0.22,0x2a2f3a);brim.position.set(0,1.77,-0.3);g.add(brim);
 function limb(w,h,d,hex,px,py){var p=new T.Group();p.position.set(px,py,0);var m=box(w,h,d,hex);m.position.y=-h/2;p.add(m);g.add(p);return p}
 var legL=limb(0.22,0.72,0.24,0x3a4a6b,-0.14,0.72),legR=limb(0.22,0.72,0.24,0x3a4a6b,0.14,0.72);
 var armL=limb(0.17,0.62,0.17,shirt,-0.37,1.4);
 var armR=limb(0.17,0.62,0.17,shirt,0.37,1.4);
 // the held gun: a rotated mount so the barrel (-z in model space) follows the arm (-y)
 var mount=new T.Group();mount.rotation.x=-Math.PI/2;mount.position.set(0,-0.5,0);armR.add(mount);
 g.rotation.order="YXZ";
 setLayer(g,layer);
 return {group:g,legL:legL,legR:legR,armR:armR,armL:armL,head:head,mount:mount,gunKey:null,gunModel:null,layer:layer,phase:0,fall:0};
}
function setModelGun(m,wp){
 var k=wpKey(wp);
 if(k===m.gunKey)return;m.gunKey=k;
 if(m.gunModel){m.mount.remove(m.gunModel);m.gunModel=null}
 if(!wp)return;
 var b=buildGun(wp);
 b.group.scale.setScalar(1.1);
 b.group.traverse(function(o){if(o.isMesh)o.castShadow=false});
 m.gunModel=b.group;m.mount.add(b.group);setLayer(b.group,m.layer);
}

/* ---------- world ---------- */
function nearBuilding(w,x,z,m){
 for(var i=0;i<w.buildings.length;i++){
  var b=w.buildings[i];
  if(Math.abs(x-b.x)<b.w/2+m&&Math.abs(z-b.z)<b.d/2+m)return b;
 }
 return null;
}
function terrainColor(w,x,z,h,rnd){
 var n=0.5+0.5*Math.sin(x*0.21+Math.sin(z*0.13)*2)*Math.sin(z*0.17+1.3)+0.12*(rnd()-0.5);
 var col=mix3(C.grassA,C.grassB,Math.max(0,Math.min(1,n)));
 col=mix3(col,C.grassC,Math.max(0,Math.min(1,(Math.sin(x*0.07+z*0.05)*0.5+0.5)*0.55)));
 var dxh=w.height(x+1.2,z)-w.height(x-1.2,z),dzh=w.height(x,z+1.2)-w.height(x,z-1.2);
 var slope=Math.hypot(dxh,dzh)/2.4;
 if(slope>0.45)col=mix3(col,C.rock,Math.min(1,(slope-0.45)*2.2));
 var dp=Math.abs(z-w.pathZ(x));
 if(Math.abs(x)<80&&dp<2.6)col=mix3(col,C.dirt,Math.max(0,Math.min(1,(2.6-dp)/1.4))*(0.85+0.15*rnd()));
 if(nearBuilding(w,x,z,2.2))col=mix3(col,C.dirt,0.75);
 if(h<0.7)col=mix3(col,C.sand,Math.max(0,Math.min(1,(0.7-h)/0.55)));
 if(h<-0.1)col=mix3(col,C.mud,Math.max(0,Math.min(1,(-0.1-h)/0.9)));
 return col;
}

var BOX_COL={
 cabin:[0.56,0.37,0.2],barn:[0.64,0.2,0.16],bunker:[0.56,0.57,0.57],
 "roof:cabin":[0.34,0.2,0.15],"roof:barn":[0.42,0.43,0.46],"roof:bunker":[0.4,0.41,0.42],
 "floor:cabin":[0.45,0.32,0.19],"floor:barn":[0.5,0.38,0.24],"floor:bunker":[0.42,0.42,0.43],
 crate:[0.72,0.54,0.3],stone:[0.52,0.5,0.47]
};
var CONT=[[0.16,0.36,0.62],[0.7,0.2,0.15],[0.2,0.5,0.3],[0.82,0.62,0.15],[0.45,0.45,0.5]];

function buildWorld(w){
 if(!renderer)return;
 if(worldGroup)scene.remove(worldGroup);
 clearLoot();
 world=w;worldGroup=new T.Group();scene.add(worldGroup);
 var rnd=Sim.mulberry32((w.seed|0)+1234);
 var S=w.half*2,seg=150;

 // terrain
 var tg=new T.PlaneGeometry(S,S,seg,seg);tg.rotateX(-Math.PI/2);
 var tp=tg.attributes.position,tc=[];
 for(var i=0;i<tp.count;i++){
  var x=tp.getX(i),z=tp.getZ(i),h=w.height(x,z);
  tp.setY(i,h);
  var c=terrainColor(w,x,z,h,rnd);tc.push(c[0],c[1],c[2]);
 }
 tg.setAttribute("color",new T.Float32BufferAttribute(tc,3));
 tg.computeVertexNormals();
 var terrain=new T.Mesh(tg,new T.MeshLambertMaterial({vertexColors:true}));
 terrain.receiveShadow=true;worldGroup.add(terrain);

 // water: vertex colors fade from clear turquoise at the shore to deep blue
 var wg=new T.PlaneGeometry(S,S,80,80);wg.rotateX(-Math.PI/2);
 var wp=wg.attributes.position,wc=[],idx=[],base=[];
 for(var k=0;k<wp.count;k++){
  var wx=wp.getX(k),wz=wp.getZ(k),d=Math.max(0,w.water-w.height(wx,wz));
  var col=mix3([0.42,0.82,0.84],[0.1,0.36,0.68],Math.min(1,d/2.6));
  wc.push(col[0],col[1],col[2]);
  wp.setY(k,w.water);
  if(d>-1.2){idx.push(k);base.push(wx,wz)}
 }
 wg.setAttribute("color",new T.Float32BufferAttribute(wc,3));
 water=new T.Mesh(wg,new T.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:0.8,shininess:100,specular:0xbbddff,side:T.DoubleSide,depthWrite:false}));
 water.renderOrder=2;worldGroup.add(water);waterIdx=idx;waterBase=base;

 // trees
 var nt=w.trees.length,pines=[],oaks=[];
 w.trees.forEach(function(t){(t.type===0?pines:oaks).push(t)});
 var trunk=new T.CylinderGeometry(0.2,0.3,1,6);trunk.translate(0,0.5,0);
 var trunks=inst(trunk,mat(0xffffff,true),Math.max(1,nt),true);
 var pa=new T.ConeGeometry(1.7,3.0,7);pa.translate(0,1.5,0);
 var pb=new T.ConeGeometry(1.15,2.5,7);pb.translate(0,1.25,0);
 var pineA=inst(pa,mat(0xffffff,true),Math.max(1,pines.length),true),pineB=inst(pb,mat(0xffffff,true),Math.max(1,pines.length),true);
 var oa=new T.IcosahedronGeometry(1.8,1),ob=new T.IcosahedronGeometry(1.2,1);
 var oakA=inst(oa,mat(0xffffff,true),Math.max(1,oaks.length),true),oakB=inst(ob,mat(0xffffff,true),Math.max(1,oaks.length),true);
 w.trees.forEach(function(t,i){
  setI(trunks,i,t.x,t.y-0.1,t.z,t.s,2.7*t.s,t.s,0,mix3([0.38,0.25,0.14],[0.5,0.34,0.2],t.tint));
 });
 pines.forEach(function(t,i){
  var g=mix3([0.1,0.42,0.22],[0.2,0.58,0.3],t.tint);
  setI(pineA,i,t.x,t.y+1.5*t.s,t.z,t.s,t.s,t.s,t.tint*6,g);
  setI(pineB,i,t.x,t.y+3.9*t.s,t.z,t.s,t.s,t.s,t.tint*6,mix3(g,[0.3,0.7,0.35],0.25));
 });
 oaks.forEach(function(t,i){
  var autumn=t.tint>0.86;
  var g=autumn?mix3([0.92,0.6,0.15],[0.85,0.35,0.12],(t.tint-0.86)*7):mix3([0.28,0.68,0.18],[0.45,0.8,0.22],t.tint);
  setI(oakA,i,t.x,t.y+3.9*t.s,t.z,t.s,t.s*0.9,t.s,t.tint*6,g);
  setI(oakB,i,t.x+0.9*t.s,t.y+4.6*t.s,t.z+0.4*t.s,t.s,t.s,t.s,0,mix3(g,[1,1,0.5],0.1));
 });
 [trunks,pineA,pineB,oakA,oakB].forEach(function(m){finish(m);worldGroup.add(m)});

 // rocks
 var rg=new T.DodecahedronGeometry(1,0);
 var rocks=inst(rg,mat(0xffffff,true),Math.max(1,w.rocks.length),true);
 w.rocks.forEach(function(r,i){
  var gr=0.62+r.tint*0.2;
  setI(rocks,i,r.x,r.y+r.r*0.28,r.z,r.r,r.r*0.8,r.r*0.92,r.rot,[gr,gr*0.97,gr*0.92]);
 });
 finish(rocks);worldGroup.add(rocks);

 buildStructures(w);
 buildFish(w);

 // bushes, flowers, grass tufts (visual only, own seeded RNG)
 function land(minH,pathD){
  for(var a=0;a<40;a++){
   var px=(rnd()*2-1)*(w.half-2),pz=(rnd()*2-1)*(w.half-2),ph=w.height(px,pz);
   if(ph<minH)continue;
   if(Math.abs(px)<80&&Math.abs(pz-w.pathZ(px))<pathD)continue;
   if(nearBuilding(w,px,pz,3))continue;
   return {x:px,z:pz,h:ph};
  }
  return null;
 }
 var bg=new T.IcosahedronGeometry(0.9,1);
 var bushes=inst(bg,mat(0xffffff,true),140,true),bn=0;
 for(var b=0;b<140;b++){
  var bp=land(0.7,2.2);if(!bp)continue;
  var bs=0.7+rnd()*0.8;
  setI(bushes,bn++,bp.x,bp.h+0.35*bs,bp.z,bs*1.2,bs*0.8,bs*1.2,rnd()*6,mix3([0.18,0.5,0.2],[0.32,0.68,0.25],rnd()));
 }
 bushes.count=bn;finish(bushes);worldGroup.add(bushes);

 var fg=new T.IcosahedronGeometry(0.11,0);
 var flowers=inst(fg,new T.MeshLambertMaterial({color:0xffffff}),600,false),fn=0;
 var fcols=[[0.95,0.25,0.25],[1,0.85,0.2],[0.98,0.98,0.95],[0.95,0.5,0.8],[0.6,0.4,0.95],[1,0.6,0.2]];
 for(var f=0;f<600;f++){
  var fp=land(0.8,1.6);if(!fp)continue;
  var cc=fcols[Math.floor(rnd()*fcols.length)];
  setI(flowers,fn++,fp.x,fp.h+0.28,fp.z,1,1,1,0,cc);
 }
 flowers.count=fn;finish(flowers);worldGroup.add(flowers);

 var tg2=new T.ConeGeometry(0.07,0.65,3);tg2.translate(0,0.32,0);
 var tufts=inst(tg2,new T.MeshLambertMaterial({color:0xffffff}),4200,false),un=0;
 for(var u=0;u<4200;u++){
  var up=land(0.75,1.3);if(!up)continue;
  var us=0.7+rnd()*0.9;
  setI(tufts,un++,up.x,up.h-0.02,up.z,us,us*(0.7+rnd()*0.8),us,rnd()*6,mix3([0.25,0.58,0.15],[0.58,0.84,0.3],rnd()));
 }
 tufts.count=un;finish(tufts);worldGroup.add(tufts);
}

function buildStructures(w){
 var n=w.boxes.length;
 var bm=inst(new T.BoxGeometry(1,1,1),new T.MeshLambertMaterial({color:0xffffff}),Math.max(1,n),true);
 bm.receiveShadow=true;
 w.boxes.forEach(function(b,i){
  var col=BOX_COL[b.kind]||[0.6,0.6,0.6];
  if(b.kind==="container")col=CONT[Math.floor(b.tint*CONT.length)%CONT.length];
  var v=0.92+0.16*b.tint;
  dummy.position.set((b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2);
  dummy.scale.set(b.x1-b.x0,b.y1-b.y0,b.z1-b.z0);dummy.rotation.set(0,0,0);dummy.updateMatrix();
  bm.setMatrixAt(i,dummy.matrix);tmpCol.setRGB(col[0]*v,col[1]*v,col[2]*v);bm.setColorAt(i,tmpCol);
 });
 finish(bm);worldGroup.add(bm);

 // grain silos
 w.silos.forEach(function(s){
  var body=new T.Mesh(new T.CylinderGeometry(s.r,s.r,s.h,16),mat(0xb9c1c9,false));
  body.position.set(s.x,s.y+s.h/2,s.z);body.castShadow=true;body.receiveShadow=true;worldGroup.add(body);
  var cap=new T.Mesh(new T.ConeGeometry(s.r+0.2,2.2,16),mat(0x8a3a30,false));
  cap.position.set(s.x,s.y+s.h+1.1,s.z);cap.castShadow=true;worldGroup.add(cap);
  var band=new T.Mesh(new T.CylinderGeometry(s.r+0.06,s.r+0.06,0.4,16),mat(0x7d858e,false));
  band.position.set(s.x,s.y+s.h*0.5,s.z);worldGroup.add(band);
  var band2=band.clone();band2.position.y=s.y+s.h*0.2;worldGroup.add(band2);
 });
}


/* ---------- fish: ambient life in deep water ---------- */
var fishes=[],fishBody=null,fishTail=null;
function buildFish(w){
 fishes=[];fishBody=fishTail=null;
 var rnd=Sim.mulberry32((w.seed|0)+777),spots=[];
 for(var x=-w.half+8;x<w.half-8;x+=5)for(var z=-w.half+8;z<w.half-8;z+=5){
  if(w.water-w.height(x,z)>1.1)spots.push([x,z]);
 }
 for(var i=0;i<16&&spots.length;i++){
  var sp=spots.splice(Math.floor(rnd()*spots.length),1)[0],r=1+rnd()*2.4;
  for(;r>0.4;r-=0.3){
   var ok=true;
   for(var k=0;k<8;k++){var a=k*0.785;if(w.water-w.height(sp[0]+Math.cos(a)*r,sp[1]+Math.sin(a)*r)<0.7){ok=false;break}}
   if(ok)break;
  }
  if(r<=0.4)continue;
  fishes.push({cx:sp[0],cz:sp[1],r:r,a:rnd()*6.28,sp:0.5+rnd()*0.5,dir:rnd()<0.5?1:-1,depth:0.35+rnd()*0.4,sz:0.7+rnd()*0.6,
   hue:rnd(),jump:-1,next:6+rnd()*14,ph:rnd()*6});
 }
 if(!fishes.length)return;
 var bg=new T.SphereGeometry(0.5,8,6),tg=new T.ConeGeometry(0.3,0.5,4);
 tg.rotateZ(Math.PI/2);
 fishBody=inst(bg,new T.MeshLambertMaterial({color:0xffffff}),fishes.length,false);
 fishTail=inst(tg,new T.MeshLambertMaterial({color:0xffffff}),fishes.length,false);
 fishes.forEach(function(f,i){
  var c=f.hue<0.5?[0.95,0.55,0.18]:(f.hue<0.8?[0.78,0.84,0.9]:[0.95,0.35,0.3]);
  tmpCol.setRGB(c[0],c[1],c[2]);fishBody.setColorAt(i,tmpCol);fishTail.setColorAt(i,tmpCol);
 });
 worldGroup.add(fishBody);worldGroup.add(fishTail);
}
function fishTick(dt){
 if(!fishBody||!world)return;
 dummy.rotation.order="YZX";
 for(var i=0;i<fishes.length;i++){
  var f=fishes[i];
  f.a+=f.dir*f.sp*dt/Math.max(0.6,f.r);
  var x=f.cx+Math.cos(f.a)*f.r,z=f.cz+Math.sin(f.a)*f.r;
  var yaw=Math.atan2(-Math.cos(f.a)*f.dir,-Math.sin(f.a)*f.dir),y=world.water-f.depth,pitch=0;
  f.next-=dt;
  if(f.jump<0&&f.next<=0){f.jump=0;f.next=9+Math.random()*16}
  if(f.jump>=0){
   f.jump+=dt/0.85;
   var u=f.jump,h=Math.sin(Math.min(1,u)*Math.PI);
   y=world.water-f.depth+h*(f.depth+1.0);pitch=Math.cos(Math.min(1,u)*Math.PI)*0.9;
   if(u>=1){f.jump=-1;splash(x,z,false,0.25)}
  }
  var wig=Math.sin(clock*7*f.sp+f.ph);
  dummy.position.set(x,y,z);dummy.scale.set(0.5*f.sz,0.17*f.sz,0.17*f.sz);dummy.rotation.set(0,yaw,pitch);dummy.updateMatrix();fishBody.setMatrixAt(i,dummy.matrix);
  var bx2=Math.cos(yaw),bz2=-Math.sin(yaw);
  dummy.position.set(x-bx2*0.27*f.sz,y+pitch*-0.0,z-bz2*0.27*f.sz);dummy.scale.set(0.5*f.sz,0.3*f.sz,0.14*f.sz);dummy.rotation.set(0,yaw+wig*0.5,pitch);dummy.updateMatrix();fishTail.setMatrixAt(i,dummy.matrix);
 }
 fishBody.instanceMatrix.needsUpdate=true;fishTail.instanceMatrix.needsUpdate=true;
}

/* ---------- chests and loot ---------- */
function clearLoot(){
 if(lootGroup&&scene)scene.remove(lootGroup);
 lootGroup=new T.Group();if(scene)scene.add(lootGroup);
 lootMap={};chestMeshes=[];lootRef=null;
}
function makeChest(ch){
 var g=new T.Group();
 var bunker=ch.tier==="bunker";
 var wood=bunker?0x4a5058:0x7a4c22,band=bunker?0x2a2e33:0x3b3d42,trim=bunker?0xe08a24:0xcaa64a;
 bx(g,1.0,0.5,0.62,wood,0,0.25,0);
 bx(g,1.04,0.5,0.06,band,0,0.25,0.18);bx(g,1.04,0.5,0.06,band,0,0.25,-0.18);
 var lid=new T.Group();lid.position.set(0,0.5,-0.31);g.add(lid);
 bx(lid,1.0,0.16,0.62,wood,0,0.08,0.31);
 bx(lid,1.04,0.17,0.06,band,0,0.085,0.49);bx(lid,1.04,0.17,0.06,band,0,0.085,0.13);
 bx(lid,0.1,0.14,0.04,trim,0,0.0,0.63);
 bx(g,0.12,0.12,0.04,trim,0,0.46,0.32);
 g.position.set(ch.x,ch.y,ch.z);g.rotation.y=Math.atan2(ch.dx,ch.dz);
 g.traverse(function(o){if(o.isMesh){o.castShadow=true;o.layers.set(5)}});
 g.layers.set(5);
 return {group:g,lid:lid,open:0,ch:ch};
}
/** Small icon for an attachment pickup: the part itself, in a mini model. */
function buildAttIcon(c,o,r){
 var g=new T.Group(),R=Data.RARITY[r],rc=R.hex;
 if(c===0){
  if(o===0){bx(g,0.1,0.03,0.14,BLACK,0,0,0);bx(g,0.08,0.11,0.02,BLACK,0,0.07,0.05);bx(g,0.06,0.06,0.01,0xff4444,0,0.08,-0.04,0,true)}
  else if(o===1){bx(g,0.12,0.03,0.16,BLACK,0,0,0);bx(g,0.02,0.12,0.14,BLACK,0.05,0.07,0);bx(g,0.02,0.12,0.14,BLACK,-0.05,0.07,0);bx(g,0.12,0.02,0.14,BLACK,0,0.14,0);bx(g,0.08,0.1,0.01,0x66e6ff,0,0.07,-0.05,0,true)}
  else{cy(g,0.06,0.42,0x23252a,0,0.06,0);cy(g,0.07,0.06,0x34373d,0,0.06,-0.18);cy(g,0.07,0.06,0x34373d,0,0.06,0.18);cy(g,0.055,0.01,0x6ad0ff,0,0.06,-0.22,false,true)}
 }else if(c===1){
  if(o===0){cy(g,0.05,0.4,0x1e1f22,0,0.04,0)}
  else if(o===1){cy(g,0.08,0.12,0x7a5b2c,0,0.06,0);bx(g,0.18,0.015,0.02,BLACK,0,0.06,0)}
  else{cy(g,0.07,0.16,0x5a4a3a,0,0.06,0);cy(g,0.04,0.08,BLACK,0,0.06,-0.12)}
 }else if(c===2){
  var L=o===0?0.5:(o===1?0.22:0.4),Rr=o===2?0.07:0.04;
  cy(g,Rr,L,STEEL,0,0.05,0);cy(g,Rr*1.2,0.04,0x2a2c31,0,0.05,-L/2);cy(g,Rr*1.2,0.04,0x2a2c31,0,0.05,L/2);
 }else if(c===3){
  if(o===2){cy(g,0.14,0.14,0x34373d,0,0.14,0,true);cy(g,0.1,0.16,0x25272c,0,0.14,0,true)}
  else{var h=o===0?0.34:0.24;bx(g,0.09,h,0.14,0x25272c,0,h/2+0.02,0,0.12);if(o===1)bx(g,0.1,0.05,0.15,0xff9a1a,0,0.08,0,0.12)}
 }else if(c===4){
  if(o===0)bx(g,0.07,0.26,0.07,0x25272c,0,0.15,0);
  else if(o===1)bx(g,0.07,0.26,0.08,0x25272c,0,0.15,0,-0.8);
  else bx(g,0.09,0.22,0.12,0x2f4a3a,0,0.13,0,0.25);
 }else if(c===5){
  if(o===0){bx(g,0.025,0.1,0.4,STEEL,0.04,0.1,0);bx(g,0.025,0.1,0.4,STEEL,-0.04,0.1,0);bx(g,0.12,0.12,0.03,0x2a2c31,0,0.1,0.2)}
  else if(o===1){bx(g,0.09,0.16,0.42,0x34373d,0,0.1,0);bx(g,0.11,0.18,0.06,0xd0702a,0,0.1,0.22)}
  else{bx(g,0.12,0.22,0.46,0x30333a,0,0.13,0);bx(g,0.13,0.24,0.06,0x1d1e22,0,0.13,0.24)}
 }else{
  var ac=[0xd9463a,0x3a6bd6,0xe8c34a][o];
  for(var i=-1;i<=1;i++){cy(g,0.035,0.16,0xc79a3d,i*0.09,0.05,0);cy(g,0.035,0.06,ac,i*0.09,0.05,-0.11)}
 }
 bx(g,0.28,0.014,0.014,rc,0,-0.04,0.0,0,true);
 return g;
}
function buildMed(r){
 var g=new T.Group();
 bx(g,0.4,0.26,0.28,0xf2f2f0,0,0.13,0);bx(g,0.22,0.06,0.285,0xd93a3a,0,0.14,0);bx(g,0.06,0.28,0.285,0xd93a3a,0,0.14,0);
 bx(g,0.42,0.02,0.3,rarityHex(r),0,0.27,0,0,true);
 return g;
}
function buildLootMesh(it){
 var g=new T.Group(),model,scale=1;
 if(it.kind==="gun"){model=buildGun({g:it.a,r:it.r,att:it.att}).group;scale=1.45}
 else if(it.kind==="att"){model=buildAttIcon(it.a,it.b,it.r);scale=1.5}
 else{model=buildMed(it.r);scale=1.3}
 model.scale.setScalar(scale);
 var spin=new T.Group();spin.add(model);g.add(spin);
 var rc=rarityHex(it.r);
 var ring=new T.Mesh(new T.RingGeometry(0.42,0.52,28),new T.MeshBasicMaterial({color:rc,transparent:true,opacity:0.85,side:T.DoubleSide,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=0.04;g.add(ring);
 var beam=null;
 if(it.r>=2){
  beam=new T.Mesh(new T.CylinderGeometry(0.07,0.07,2.6,8,1,true),new T.MeshBasicMaterial({color:rc,transparent:true,opacity:0.22,side:T.DoubleSide,depthWrite:false}));
  beam.position.y=1.3;g.add(beam);
 }
 g.traverse(function(o){o.layers.set(5)});
 g.position.set(it.x,it.y,it.z);
 return {group:g,spin:spin,item:it,t0:Math.random()*6};
}
function syncLoot(loot,dt){
 if(!lootGroup)clearLoot();
 if(loot!==lootRef){
  // a new loot table (new round or new match): rebuild everything
  lootGroup.children.slice().forEach(function(c){lootGroup.remove(c)});
  lootMap={};chestMeshes=[];lootRef=loot;
  if(loot)loot.chests.forEach(function(ch){var cm=makeChest(ch);lootGroup.add(cm.group);chestMeshes.push(cm)});
 }
 if(!loot)return;
 var seen={};
 loot.items.forEach(function(it){
  if(!it.active)return;
  seen[it.id]=true;
  var e=lootMap[it.id];
  if(!e){e=lootMap[it.id]=buildLootMesh(it);lootGroup.add(e.group)}
  e.group.position.set(it.x,it.y,it.z);
  e.spin.position.y=0.5+Math.sin(clock*2+e.t0)*0.07;
  e.spin.rotation.y=clock*1.1+e.t0;
 });
 for(var id in lootMap){
  if(!seen[id]){lootGroup.remove(lootMap[id].group);delete lootMap[id]}
 }
 chestMeshes.forEach(function(cm){
  var target=cm.ch.opened?-1.9:0;
  cm.open+=(target-cm.open)*Math.min(1,dt*7);
  cm.lid.rotation.x=cm.open;
 });
}

/* ---------- effects ---------- */
function spawnParticles(x,y,z,n,hex,speed,up,size,grav){
 var made=0;
 for(var i=0;i<particles.length&&made<n;i++){
  var p=particles[i];if(p.life>0)continue;
  var a=Math.random()*6.283,s=speed*(0.4+Math.random()*0.8);
  p.mesh.position.set(x,y,z);p.mesh.scale.setScalar(size*(0.6+Math.random()*0.8));
  p.mesh.material.color.setHex(hex);p.mesh.material.opacity=1;p.mesh.visible=true;
  p.vx=Math.cos(a)*s;p.vz=Math.sin(a)*s;p.vy=up*(0.5+Math.random()*0.8);p.g=grav;
  p.life=p.max=0.5+Math.random()*0.4;made++;
 }
}
function spawnRipple(x,z,size){
 for(var i=0;i<ripples.length;i++){
  var r=ripples[i];if(r.life>0)continue;
  r.mesh.position.set(x,world.water+0.04,z);r.mesh.visible=true;r.life=r.max=1.1;r.size=size;
  r.mesh.scale.setScalar(0.3);r.mesh.material.opacity=0.6;return;
 }
}
function splash(x,z,big,vol){
 var y=world.water+0.05;
 spawnParticles(x,y,z,big?16:7,0xe6f6ff,big?3.2:1.8,big?6.5:3.6,big?0.09:0.07,14);
 spawnRipple(x,z,big?3.4:1.8);if(big)spawnRipple(x,z,2.2);
 Sfx.splash(vol);
}
var UP=null,Vtmp=null,Qtmp=null;
function addTracer(ax,ay,az,bx2,by,bz,hex){
 var tr=null;for(var i=0;i<tracers.length;i++)if(tracers[i].life<=0){tr=tracers[i];break}
 if(!tr)return;
 if(!UP){UP=new T.Vector3(0,1,0);Vtmp=new T.Vector3();Qtmp=new T.Quaternion()}
 Vtmp.set(bx2-ax,by-ay,bz-az);var len=Vtmp.length();if(len<0.5)return;Vtmp.divideScalar(len);
 tr.mesh.position.set((ax+bx2)/2,(ay+by)/2,(az+bz)/2);
 Qtmp.setFromUnitVectors(UP,Vtmp);tr.mesh.quaternion.copy(Qtmp);tr.mesh.scale.set(1,len,1);
 tr.mesh.material.color.setHex(hex||0xfff2a8);
 tr.mesh.visible=true;tr.mesh.material.opacity=0.85;tr.life=0.09;
}

/** Handle one simulation event. me = index of the player whose view is primary (for volume). */
function handleEvent(e,players,me,split){
 if(e[0]==="s"){
  var o=e[1],sp=players[o];
  var yaw=sp?sp.yaw:0,rx=Math.cos(yaw),rz=-Math.sin(yaw);
  var dx=e[5]-e[2],dy=e[6]-e[3],dz=e[7]-e[4],dl=Math.hypot(dx,dy,dz)||1;
  var supp=e[9]===1,gi=e[10]|0,gun=Data.GUNS[gi]||Data.GUNS[3];
  var ax=e[2]+rx*0.28+dx/dl*0.7,ay=e[3]-0.18+dy/dl*0.7,az=e[4]+rz*0.28+dz/dl*0.7;
  if(!supp||gun.id==="sniper")addTracer(ax,ay,az,e[5],e[6],e[7],supp?0xcfd8e6:0xfff2a8);
  var kind=e[8],ix=e[5],iy=e[6],iz=e[7];
  if(kind===1)spawnParticles(ix,iy,iz,6,0x7a5a34,2.2,3.2,0.08,12);
  else if(kind===2)spawnParticles(ix,iy,iz,6,0xa5733f,2.4,3.4,0.07,12);
  else if(kind===3)spawnParticles(ix,iy,iz,6,0xc9c4bc,3,3.6,0.05,12);
  else if(kind===4)splash(ix,iz,false,0.5);
  else if(kind===5)spawnParticles(ix,iy,iz,7,0xff5a3c,2.4,3,0.07,10);
  else if(kind===6)spawnParticles(ix,iy,iz,7,0xd8cdb8,2.8,3.4,0.05,12);
  var near=split||o===me;
  if(near){kick[o]=Math.min(0.1,kick[o]+0.025+gun.dmg*0.0006*(gun.pellets>1?3:1));pstate[o].flash=0.05}
  var dist=sp?Math.hypot(sp.x-players[me].x,sp.z-players[me].z):0;
  if(clock-lastShotSnd[o]>0.04){lastShotSnd[o]=clock;Sfx.shot(gun.id,near?1:1/(1+dist/14),supp)}
 }
}

/* ---------- per-frame ---------- */
function updateModel(i,p,dt){
 var m=models[i],g=m.group;
 g.position.set(p.x,p.y,p.z);
 g.rotation.y=p.yaw;
 var mov=Math.min(1,p.speed/7);
 m.phase+=dt*(6+p.speed*1.1);
 var sw=Math.sin(m.phase)*0.85*mov;
 m.legL.rotation.x=sw;m.legR.rotation.x=-sw;
 m.armR.rotation.x=1.35+p.pitch;
 m.armL.rotation.x=1.1+p.pitch*0.6;
 m.head.rotation.x=p.pitch*0.5;
 m.fall+=((p.alive?0:1)-m.fall)*Math.min(1,dt*6);
 g.rotation.x=m.fall*1.45;
 g.position.y=p.y-(p.swimming?0.15:0)+m.fall*0.12;
 setModelGun(m,p.weapon);
}
function waterTick(dt){
 if(!water)return;
 var pos=water.geometry.attributes.position,t=clock;
 for(var i=0;i<waterIdx.length;i++){
  var x=waterBase[i*2],z=waterBase[i*2+1];
  pos.setY(waterIdx[i],world.water+0.07*Math.sin(x*0.45+t*1.4)+0.05*Math.sin(z*0.6+t*1.9)+0.03*Math.sin((x+z)*1.2+t*2.6));
 }
 pos.needsUpdate=true;
 if((waterFrame++&3)===0)water.geometry.computeVertexNormals();
}
function stepFx(dt){
 var i;
 for(i=0;i<tracers.length;i++){var tr=tracers[i];if(tr.life>0){tr.life-=dt;tr.mesh.material.opacity=Math.max(0,tr.life/0.09)*0.85;if(tr.life<=0)tr.mesh.visible=false}}
 for(i=0;i<particles.length;i++){
  var p=particles[i];if(p.life<=0)continue;
  p.life-=dt;p.vy-=p.g*dt;
  var m=p.mesh;m.position.x+=p.vx*dt;m.position.y+=p.vy*dt;m.position.z+=p.vz*dt;
  var gh=Math.max(world.height(m.position.x,m.position.z),world.water);
  if(m.position.y<gh&&p.vy<0){p.life=0}
  m.material.opacity=Math.max(0,p.life/p.max);
  if(p.life<=0)m.visible=false;
 }
 for(i=0;i<ripples.length;i++){
  var r=ripples[i];if(r.life<=0)continue;
  r.life-=dt;var k=1-r.life/r.max;
  r.mesh.scale.setScalar(0.3+k*r.size);r.mesh.material.opacity=0.6*(1-k);
  if(r.life<=0)r.mesh.visible=false;
 }
 for(i=0;i<clouds.length;i++){clouds[i].position.x+=dt*1.2;if(clouds[i].position.x>380)clouds[i].position.x=-380}
}

/**
 * Draw a frame.
 * st: {players:[{x,y,z,yaw,pitch,alive,speed,swimming,wading,reloading,grounded,ads,weapon:{g,r,att,st?}}],
 *      views:[idx] or [0,1], events:[...], me:idx, loot}
 */
function render(dt,st){
 if(!renderer||!world)return;
 clock+=dt;
 var players=st.players,split=st.views.length>1,w=canvas.clientWidth,h=canvas.clientHeight;
 if(w!==lastW||h!==lastH){renderer.setSize(w,h,false);lastW=w;lastH=h}
 st.events.forEach(function(e){handleEvent(e,players,st.me,split)});
 st.events.length=0;
 syncLoot(st.loot,dt);

 for(var i=0;i<2;i++){
  var p=players[i];
  updateModel(i,p,dt);
  var ps=pstate[i];
  if(p.wading&&!ps.wading&&p.speed>1.2)splash(p.x,p.z,true,(split||i===st.me)?1:0.5);
  ps.wading=p.wading;
  if(p.wading&&p.speed>1){ps.t-=dt;if(ps.t<=0){ps.t=0.2;spawnRipple(p.x,p.z,2.0);spawnParticles(p.x,world.water+0.05,p.z,2,0xe6f6ff,1.4,2.4,0.05,12)}}
  guns[i].set(p.weapon);
  ps.flash=Math.max(0,ps.flash-dt);
  guns[i].flash.visible=ps.flash>0;
  kick[i]=Math.max(0,kick[i]-dt*0.35);
 }
 waterTick(dt);fishTick(dt);stepFx(dt);

 // sun shadow follows the primary view(s)
 var fx=0,fz=0;st.views.forEach(function(v){fx+=players[v].x;fz+=players[v].z});fx/=st.views.length;fz/=st.views.length;
 sunTarget.position.set(fx,0,fz);sun.position.set(fx+60,90,fz+40);

 renderer.setScissorTest(split);
 st.views.forEach(function(v,slot){
  var p=players[v],cam=cams[v],g=guns[v];
  var vw=split?Math.floor(w/2):w,vx=split?slot*vw:0;
  var wst=wpStats(p.weapon),zoom=wst?wst.zoom:1.3;
  var ads=p.alive?Math.max(0,Math.min(1,p.ads||0)):0;
  var zf=1+(zoom-1)*ads;
  cam.fov=BASE_FOV/zf;
  cam.aspect=vw/Math.max(1,h);cam.updateProjectionMatrix();
  var inf=infos[v];inf.ads=ads;inf.fovRatio=1/zf;inf.scoped=ads>0.88&&zoom>=3&&p.alive;
  var bob=p.grounded&&p.alive?Math.sin(clock*9)*0.04*Math.min(1,p.speed/7)*(1-ads*0.85):0;
  if(p.swimming)bob=Math.sin(clock*2.2)*0.05;
  var eye=p.alive?Sim.EYE+bob:0.5;
  cam.position.set(p.x,p.y+eye,p.z);
  cam.rotation.set(p.alive?p.pitch:-0.2,p.yaw,p.alive?0:0.6);
  var sway=Math.sin(clock*9)*0.012*Math.min(1,p.speed/7)*(1-ads);
  var hipX=0.27,hipY=-0.26,hipZ=-0.5,adsY=-g.sightY-0.0,adsZ=-0.42;
  var gx=lerp(hipX,0,ads)+sway,gy=lerp(hipY,adsY,ads)+Math.abs(sway)*0.5+(p.reloading?-0.14:0),gz=lerp(hipZ,adsZ,ads)+kick[v];
  g.group.position.set(gx,gy,gz);
  g.group.rotation.set(kick[v]*3+(p.reloading?-0.5:0),0,p.reloading?0.45:0);
  g.group.visible=p.alive&&!inf.scoped;
  renderer.setViewport(vx,0,vw,h);renderer.setScissor(vx,0,vw,h);
  renderer.render(scene,cam);
 });
}


/** Spinning 3D gun preview for the armory and the landing page. */
function preview(cv,opts){
 opts=opts||{};
 var rd=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
 rd.setPixelRatio(Math.min(root.devicePixelRatio||1,2));
 var sc=new T.Scene(),cam=new T.PerspectiveCamera(32,1,0.05,30);
 sc.add(new T.HemisphereLight(0xffffff,0x55657a,1.05));
 var dl=new T.DirectionalLight(0xffffff,0.9);dl.position.set(2,3,2.5);sc.add(dl);
 var holder=new T.Group(),slot=new T.Group();holder.add(slot);sc.add(holder);
 var halo=new T.Mesh(new T.RingGeometry(0.62,0.66,48),new T.MeshBasicMaterial({color:0x3de0ff,transparent:true,opacity:0.5,side:T.DoubleSide}));
 halo.position.z=-0.5;sc.add(halo);
 cam.position.set(0,0.16,1.7);cam.rotation.x=-0.08;
 var key=null,model=null,age=1,t=0,drag=0,down=false,lx=0,raf=0,last=0,alive=true,lw=0,lh=0;
 function pointer(e){if(!down)return;drag+=(e.clientX-lx)*0.012;lx=e.clientX}
 cv.addEventListener("pointerdown",function(e){down=true;lx=e.clientX});
 addEventListener("pointerup",function(){down=false});
 addEventListener("pointermove",pointer);
 var api={
  set:function(wp){
   var k=wpKey(wp);if(k===key)return;key=k;
   if(model)slot.remove(model);model=null;age=0;
   if(!wp)return;
   var b=buildGun(wp);model=b.group;model.position.z=-(b.muzzleZ+0.32)/2;
   var sc2=wp.g===6||wp.g===7?0.8:(wp.g<2?1.5:1.05);model.scale.setScalar(sc2);model.position.z*=sc2;
   slot.add(model);halo.material.color.setHex(rarityHex(wp.r));
  },
  dispose:function(){alive=false;cancelAnimationFrame(raf);try{rd.dispose()}catch(e){}}
 };
 function frame(now){
  if(!alive)return;
  if(!cv.isConnected){raf=requestAnimationFrame(frame);return}
  var dt=Math.min(0.05,(now-(last||now))/1000);last=now;t+=dt;age=Math.min(1,age+dt*2.4);
  var w=cv.clientWidth,h=cv.clientHeight;
  if(w&&h&&(w!==lw||h!==lh)){rd.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();lw=w;lh=h}
  var ease=1-Math.pow(1-age,3),pop=0.6+0.4*ease+Math.sin(age*Math.PI)*0.06;
  holder.rotation.y=(opts.spin===false?0.5:t*0.7)+drag;
  holder.rotation.x=Math.sin(t*0.9)*0.06;
  holder.position.y=Math.sin(t*1.4)*0.02;
  slot.scale.setScalar(pop);
  halo.rotation.z=t*0.4;halo.scale.setScalar(0.9+0.1*Math.sin(t*1.7)+(1-ease)*0.5);
  if(w&&h)rd.render(sc,cam);
  raf=requestAnimationFrame(frame);
 }
 raf=requestAnimationFrame(frame);
 return api;
}

function info(v){return infos[v]||infos[0]}
function dispose(){
 if(renderer){try{renderer.dispose()}catch(e){}}
}

root.View={preview:preview,init:init,buildWorld:buildWorld,render:render,dispose:dispose,info:info,Sfx:Sfx,get ready(){return !!renderer}};
})(window);
