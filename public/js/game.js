/* Side Hustle glue: menus, online lobby, input, the match loop and the HUD.
   Modes: local (split-screen, one computer, simulated here) and online (the match server runs the simulation; this page sends inputs and draws snapshots). */
"use strict";
var $=function(i){return document.getElementById(i)};

/* ---------- state ---------- */
var mode="local";            // "local" | "online"
var seat=0;                  // online: which player I am (0 or 1)
var curScreen="";
var settings={map:"meadow",scoreLimit:5,timeLimit:300,vol:0.6,sens:0.8};
var lobbyInfo={seats:[null,null],running:false};
var wantCreate=false;
var matchStarted=false;
var viewReady=false;

var screens=["gate","armory","mode","online","join","menu","wait","match","results"];
function show(name){curScreen=name;screens.forEach(function(s){$("scr-"+s).hidden=(s!==name)})}
function meIdx(){return mode==="online"?seat:0}
function rar(r){return Data.RARITY[r]}

/* ---------- account, level and loadout ---------- */
function myProfile(){return Backend.profile}
function myLoadout(){var p=myProfile();return {att:Data.expandLoadout(p?p.lo:null,p?p.level:1)}}
function renderProfile(){
 var p=myProfile();if(!p)return;
 $("profile").hidden=false;$("pName").textContent=p.username;$("pLvl").textContent=p.level;
 var i=p.info;
 var nxt=null;
 Data.CATS.forEach(function(c,ci){c.opts.forEach(function(o,oi){var L=Data.ATT_LEVEL[ci][oi];if(L>p.level&&(!nxt||L<nxt.L))nxt={L:L,n:o.name}})});
 $("pNext").textContent=i.max?"Max level":(i.into+" / "+i.need+" XP"+(nxt?"  -  next unlock: "+nxt.n+" at level "+nxt.L:""));
 setTimeout(function(){$("pXp").style.width=(i.max?100:Math.round(i.into/i.need*100))+"%"},60);
 $("adminLink").hidden=!p.is_admin;
 $("signOut").hidden=!Backend.enabled;
}
$("signOut").onclick=function(){Backend.signOut().then(function(){location.href="login.html"})};

/* ---------- armory ---------- */
var arm={g:0,lo:null,prev:null};
var STAT_ROWS=[["Damage","damage",1,function(s){return s.damage*s.pellets},120],["Fire rate","fireRate",1,function(s){return s.fireRate},14],["Magazine","mag",1,function(s){return s.mag},80],
 ["Reload","reload",-1,function(s){return s.reload},5],["Hip spread","spread",-1,function(s){return s.spread},6],["Range","fo0",1,function(s){return s.fo0},120],["Move speed","move",1,function(s){return s.move},1.2],["Zoom","zoom",1,function(s){return s.zoom},6]];
function armAtt(g){return Data.expandLoadout(arm.lo,myProfile().level)[g]}
function openArmory(){
 var p=myProfile();arm.lo=Data.sanitizeLoadout(p.lo);arm.g=0;
 show("armory");
 if(!arm.prev&&window.THREE){try{arm.prev=View.preview($("gunCanvas"))}catch(e){arm.prev=null}}
 armRender();
}
function armRender(){
 var p=myProfile(),lvl=p.level,g=arm.g;
 var chips=$("gunChips");chips.textContent="";
 Data.GUNS.forEach(function(gun,i){
  var b=document.createElement("button");b.className="gchip";b.type="button";b.textContent=gun.name;b.setAttribute("aria-pressed",i===g);
  b.onclick=function(){arm.g=i;armRender()};chips.appendChild(b);
 });
 var att=armAtt(g),wp={g:g,r:0,att:att};
 if(arm.prev)arm.prev.set(wp);
 var base=Data.computeStats({g:g,r:0,att:[]}),cur=Data.computeStats(wp);
 var st=$("armStats");st.textContent="";
 STAT_ROWS.forEach(function(r){
  var v=r[3](cur),b0=r[3](base),d=b0?(v-b0)/b0:0,good=(d*r[2])>0.004,bad=(d*r[2])<-0.004;
  var l=document.createElement("span");l.textContent=r[0];
  var bar=document.createElement("div");bar.className="bar";var fill=document.createElement("i");fill.style.width=Math.min(100,v/r[4]*100)+"%";bar.appendChild(fill);
  var e=document.createElement("em");e.className=good?"up":(bad?"down":"");
  e.textContent=(r[1]==="zoom"?v.toFixed(1)+"x":v>=100?Math.round(v):v.toFixed(r[1]==="move"||r[1]==="fireRate"?1:(v<10?2:0)))+(Math.abs(d)>0.004?" "+(d>0?"+":"")+Math.round(d*100)+"%":"");
  st.appendChild(l);st.appendChild(bar);st.appendChild(e);
 });
 var list=$("catList");list.textContent="";
 Data.CATS.forEach(function(c,ci){
  var row=document.createElement("div");row.className="catrow";var h=document.createElement("h3");h.textContent=c.name;row.appendChild(h);
  var opts=document.createElement("div");opts.className="opts";
  function mk(label,sub,oi,color,locked,tip){
   var b=document.createElement("button");b.className="opt"+(locked?" locked":"");b.type="button";
   b.setAttribute("aria-pressed",arm.lo[g][ci]===oi);if(color)b.style.setProperty("--c",color);
   b.textContent=label;if(sub){var sm=document.createElement("small");sm.textContent=sub;b.appendChild(sm)}
   if(tip)b.title=tip;
   b.onclick=function(){if(locked)return;arm.lo[g][ci]=oi;armRender()};
   opts.appendChild(b);
  }
  mk("None","",-1,null,false,"");
  c.opts.forEach(function(o,oi){
   var L=Data.ATT_LEVEL[ci][oi],rr=Data.attRarity(L),locked=lvl<L;
   mk(o.name,locked?"Level "+L:Data.RARITY[rr].name,oi,Data.RARITY[rr].color,locked,Data.describeAttachment(ci,oi,rr).join(", ")+(locked?" (unlocks at level "+L+")":""));
  });
  row.appendChild(opts);list.appendChild(row);
 });
}
$("openArmory").onclick=openArmory;
$("armBack").onclick=function(){show("mode");renderProfile()};
$("armAll").onclick=function(){
 for(var i=0;i<arm.lo.length;i++)if(i!==arm.g)arm.lo[i]=arm.lo[arm.g].slice();
 armRender();toast0("Copied to all guns");
};
$("armSave").onclick=function(){
 var b=$("armSave");b.disabled=true;
 Backend.saveLoadout(arm.lo).then(function(){toast0("Loadout saved")}).catch(function(e){toast0(e.message)}).then(function(){b.disabled=false});
};
function toast0(t){
 var d=document.createElement("div");d.textContent=t;
 d.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#161c26;border:1px solid #3de0ff;padding:8px 16px;border-radius:6px;z-index:9;animation:fadeUp .25s both";
 document.body.appendChild(d);setTimeout(function(){d.remove()},1800);
}

/* ---------- navigation ---------- */
function leaveOnline(){
 stopMatch();matchStarted=false;wantCreate=false;lobbyInfo={seats:[null,null],running:false};
 DuelNet.close();mode="local";
}
$("btnLocal").onclick=function(){
 mode="local";$("toWait").textContent="Start match";
 $("menuNote").textContent="Split screen. Player 1: WASD move, mouse aim, click fire, right-click or Shift aim, E use, 1/2/Q switch, R reload, Space jump. Player 2: Up/Down move, Left/Right turn, comma and period strafe, Enter fire, ' aim, L use, K switch, Right Shift reload, / jump.";
 show("menu");
};
$("btnOnline").onclick=function(){show("online")};
$("onlineBack").onclick=function(){show("mode")};
$("btnCreate").onclick=startHostFlow;
$("btnJoin").onclick=function(){$("joinErr").textContent="";$("joinStatus").hidden=true;show("join");$("joinCode").focus()};
$("menuBack").onclick=function(){if(mode==="local")show("mode");else{leaveOnline();show("online")}};
$("joinBack").onclick=function(){leaveOnline();show("online")};
$("waitLeave").onclick=function(){leaveOnline();show("online")};
function startHostFlow(){
 mode="online";wantCreate=true;
 $("toWait").textContent="Create room";
 $("menuNote").textContent="WASD move, mouse aim, click fire, right-click or Shift aim, E loot, 1/2/Q or mouse wheel switch guns, R reload, Space jump. The match runs on the game server, so it does not matter whose connection is faster.";
 show("menu");
}
function readSettings(){
 settings.map=$("map").value;
 settings.scoreLimit=+$("scoreLimit").value;
 settings.timeLimit=+$("timeLimit").value;
 settings.vol=+$("vol").value/100;
 settings.sens=+$("sens").value/100;
}
$("sens").oninput=function(){settings.sens=+this.value/100};
$("toWait").onclick=function(){
 readSettings();
 View.Sfx.unlock();
 if(mode==="local")startLocalMatch();else createRoom();
};

/* ---------- online: lobby ---------- */
function setWait(text,ok){
 $("waitStatus").textContent=text;
 $("waitPulse").className="pulse"+(ok?" ok":"");
}
function describeSettings(s){
 return (MAPNAMES[s.map]||s.map)+", first to "+s.scoreLimit+", "+(s.timeLimit?s.timeLimit/60+" min limit":"no time limit");
}
function createRoom(){
 matchStarted=false;lobbyInfo={seats:[null,null],running:false};
 $("hostWait").hidden=false;$("waitCode").textContent="-----";$("waitErr").textContent="";
 $("startOnline").hidden=false;$("startOnline").disabled=true;
 setWait("Opening room...",false);
 show("wait");
 DuelNet.host({
  onConnect:function(code){
   $("waitCode").textContent=code;
   DuelNet.send({t:"settings",map:settings.map,scoreLimit:settings.scoreLimit,timeLimit:settings.timeLimit});
  },
  onMessage:onlineMsg,
  onClose:onlineClosed,
  onError:onlineFailed
 });
}
function onlineClosed(){
 if(matchStarted){endOnlineAbort("CONNECTION LOST","The connection to the game server dropped.")}
 else if(curScreen==="results"){$("rematch").disabled=true;$("rematch").textContent="Disconnected"}
 else{var wasJoin=!wantCreate;leaveOnline();$("joinErr").textContent="Disconnected from the room.";$("joinStatus").hidden=true;show(wasJoin?"join":"online")}
}
function onlineFailed(msg){
 if(matchStarted){endOnlineAbort("CONNECTION LOST",msg);return}
 var wasCreate=wantCreate;leaveOnline();$("joinStatus").hidden=true;
 if(wasCreate){show("online");toast0(msg)}else{$("joinErr").textContent=msg;show("join")}
}
$("startOnline").onclick=function(){if(!matchStarted&&lobbyInfo.seats[1])DuelNet.send({t:"start"})};
$("copyCode").onclick=function(){
 var c=$("waitCode").textContent;
 try{navigator.clipboard.writeText(c).then(function(){$("copyCode").textContent="Copied"},function(){})}catch(e){}
 setTimeout(function(){$("copyCode").textContent="Copy"},1500);
};

function joinRoom(code){
 mode="online";wantCreate=false;
 $("joinErr").textContent="";$("joinStatus").hidden=false;
 DuelNet.join(code,{
  onConnect:function(c){$("waitCode").textContent=c},
  onMessage:onlineMsg,
  onClose:onlineClosed,
  onError:onlineFailed
 });
}
$("joinCode").oninput=function(){this.value=DuelNet.normalizeCode(this.value)};
$("joinCode").onkeydown=function(e){if(e.key==="Enter")$("joinGo").click()};
$("joinGo").onclick=function(){
 var c=DuelNet.normalizeCode($("joinCode").value);
 if(c.length!==5){$("joinErr").textContent="Room codes are five characters.";return}
 View.Sfx.unlock();
 joinRoom(c);
};

var MAPNAMES={meadow:"Meadow Pond",creek:"Riverside"};
function onlineMsg(m){
 switch(m.t){
  case"lobby":applyLobby(m);break;
  case"notice":toast0(m.text);break;
  case"error":onlineFailed(m.error||"The server refused the connection.");break;
  case"start":startOnlineMatch(m);break;
  case"s":applySnapshot(m);break;
  case"inv":applyInv(m);break;
  case"end":onlineEnd(m);break;
 }
}
function applyLobby(m){
 lobbyInfo={seats:m.seats,running:!!m.running};
 if(matchStarted)return;
 settings=Object.assign(settings,m.settings);
 seat=m.you|0;
 var opp=m.seats[1-seat],both=!!(m.seats[0]&&m.seats[1]);
 if(curScreen==="results"){ // after a match: the room is still open for a rematch
  $("rematch").disabled=!(seat===0&&both);
  $("rematch").textContent=!both?"Opponent left":(seat===0?"Rematch":"Waiting for host...");
  return;
 }
 $("joinStatus").hidden=true;
 $("hostWait").hidden=false;
 $("startOnline").hidden=seat!==0;$("startOnline").disabled=!both;
 $("waitErr").textContent="";
 if(!opp)setWait("Waiting for an opponent to enter the code...",false);
 else setWait(seat===0?"Opponent connected: "+opp.name+" (level "+opp.level+"). "+describeSettings(m.settings)+". Start when you are ready."
  :"Connected to "+opp.name+" (level "+opp.level+"). "+describeSettings(m.settings)+". Waiting for the host to start...",true);
 show("wait");
}
function clampAxis(v){v=+v||0;return v>1?1:(v<-1?-1:v)}
function endOnlineAbort(title,body){
 stopMatch();matchStarted=false;$("xpBox").hidden=true;
 $("resultTitle").textContent=title;$("resultBody").textContent=body;
 configureResults(true);
 DuelNet.close();
 show("results");
}

/* ---------- input ---------- */
var codes={},mouseDown=false,rmb=false,locked=false;
var latch={fire:false,use:false,sw:-1,force:false};
var running=false;
addEventListener("keydown",function(e){
 if(running&&["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Slash","Comma","Period","Quote"].indexOf(e.code)>-1)e.preventDefault();
 if(running&&!e.repeat){
  if(e.code==="KeyE"){latch.use=true;latch.force=true}
  if(e.code==="Digit1"){latch.sw=0;latch.force=true}
  if(e.code==="Digit2"){latch.sw=1;latch.force=true}
  if(e.code==="KeyQ"){latch.sw=2;latch.force=true}
  if(e.code==="KeyL"&&mode==="local")latch2.use=true;
  if(e.code==="KeyK"&&mode==="local")latch2.sw=2;
 }
 codes[e.code]=true;
});
addEventListener("keyup",function(e){codes[e.code]=false});
addEventListener("blur",function(){codes={};mouseDown=false;rmb=false});
var latch2={use:false,sw:-1};
var look={yaw:0,pitch:0},look2={yaw:0};
var canvasEl=$("gameCanvas");
canvasEl.addEventListener("contextmenu",function(e){e.preventDefault()});
canvasEl.addEventListener("mousedown",function(e){
 if(!running)return;
 if(!locked){try{var r=canvasEl.requestPointerLock();if(r&&r.catch)r.catch(function(){})}catch(err){}return}
 if(e.button===0){mouseDown=true;latch.fire=true;latch.force=true}
 if(e.button===2)rmb=true;
});
addEventListener("mouseup",function(e){if(e.button===0)mouseDown=false;if(e.button===2)rmb=false});
addEventListener("mousemove",function(e){
 if(!locked||!running)return;
 var fr=viewReady?View.info(primary).fovRatio:1;
 var k=0.0028*settings.sens*(0.35+0.65*fr);
 look.yaw-=e.movementX*k;
 look.pitch=Math.max(-1.45,Math.min(1.45,look.pitch-e.movementY*k));
});
var lastWheel=0;
addEventListener("wheel",function(e){
 if(!running||!locked)return;
 var n=performance.now();if(n-lastWheel<180)return;lastWheel=n;
 latch.sw=2;latch.force=true;
},{passive:true});
document.addEventListener("pointerlockchange",function(){
 locked=document.pointerLockElement===canvasEl;
 if(!locked){mouseDown=false;rmb=false}
});

function axis(neg,pos){return (codes[pos]?1:0)-(codes[neg]?1:0)}
function primaryInput(){
 return {
  f:axis("KeyS","KeyW"),r:axis("KeyA","KeyD"),
  jump:!!codes.Space,
  fire:mouseDown||(mode!=="local"&&!!codes.Enter),fireL:latch.fire,
  reload:!!codes.KeyR,
  ads:rmb||!!codes.ShiftLeft,
  use:!!codes.KeyE,useL:latch.use,sw:latch.sw,
  yaw:look.yaw,pitch:look.pitch
 };
}
function secondInput(){
 return {f:axis("ArrowDown","ArrowUp"),r:axis("Comma","Period"),jump:!!codes.Slash,fire:!!codes.Enter,reload:!!codes.ShiftRight,
  ads:!!codes.Quote,use:!!codes.KeyL,useL:latch2.use,sw:latch2.sw,yaw:look2.yaw,pitch:0};
}
function clearLatches(){latch.fire=false;latch.use=false;latch.sw=-1;latch2.use=false;latch2.sw=-1}
function applyLookKeys(dt){
 var turn=2.2*dt;
 if(mode==="local"){
  look2.yaw+=axis("ArrowRight","ArrowLeft")*turn;
 }else{
  look.yaw+=axis("ArrowRight","ArrowLeft")*turn;
  look.pitch=Math.max(-1.45,Math.min(1.45,look.pitch+axis("ArrowDown","ArrowUp")*turn));
 }
}

/* ---------- match runtime ---------- */
var lastT=0,acc=0,M=null,world=null;
var remoteInput=newInput();
var rp=[newRend(),newRend()];       // renderable players
var fxQueue=[],netEv=[],views=[0],primary=0;
var lastSend=0,lastInputSend=0,lastInputBits="";
var gs={tl:0,fz:0,snapAt:0,round:1};        // guest: latest snapshot info
var gTarget=[null,null],pred=null,gAds=0;
var gLoot=null,ginv={slots:[null,null],cur:0},wCache=[null,null],lastWKey=["",""];
var FIXED=1/60;

function newInput(){return {f:0,r:0,jump:false,fire:false,fireL:false,reload:false,ads:false,use:false,useL:false,sw:-1,yaw:0,pitch:0}}
function newRend(){
 return {x:0,y:0,z:0,yaw:0,pitch:0,alive:true,speed:0,swimming:false,wading:false,grounded:true,reloading:false,
  hp:100,ammo:0,score:0,ads:0,weapon:null};
}
function randomSeed(){return (Math.random()*1e9)|0||1}
function curLoot(){return mode==="online"?gLoot:M.loot}

function ensureView(){
 if(viewReady)return true;
 var err=View.init(canvasEl);
 if(err){
  $("resultTitle").textContent="3D NOT AVAILABLE";
  $("resultBody").textContent=err+" Try a different browser, or turn on hardware acceleration.";
  configureResults(true);show("results");
  return false;
 }
 viewReady=true;buildHud();return true;
}

/* ---------- HUD ---------- */
function buildHud(){
 for(var i=0;i<2;i++){
  $("v"+i).innerHTML=
   '<div class="topline"><span class="lbl" id="lbl'+i+'">P'+(i+1)+'</span><span class="hpwrap"><span class="hpfill" id="hp'+i+'"></span></span><b class="hpnum" id="hpn'+i+'">100</b><span class="score" id="score'+i+'">0</span></div>'+
   '<div class="scope" id="scope'+i+'" hidden><i></i><i></i></div>'+
   '<div class="cross" id="cross'+i+'"><i></i><i></i><i></i><i></i><b class="hitm" id="hm'+i+'"></b></div>'+
   '<div class="dmg" id="dmg'+i+'"></div><div class="uw" id="uw'+i+'"></div>'+
   '<div class="prompt" id="prompt'+i+'" hidden><b></b><span></span><em></em></div>'+
   '<div class="toasts" id="toasts'+i+'"></div>'+
   '<div class="inv"><div class="slots" id="slots'+i+'"></div><div class="pips" id="pips'+i+'"></div><div class="ammo" id="ammo'+i+'"></div></div>'+
   (i===0?'<div class="ping" id="ping0"></div>':'')+
   '<div class="banner" id="banner'+i+'" hidden></div>';
 }
}
var hudKey=["",""],promptKey=["",""];
function beginRuntime(viewList,primaryIdx){
 views=viewList;primary=primaryIdx;
 running=true;lastT=0;acc=0;fxQueue.length=0;netEv=[];lastSend=0;lastInputSend=0;lastInputBits="";
 mouseDown=false;rmb=false;clearLatches();hudKey=["",""];promptKey=["",""];
 ["hm","dmg","uw"].forEach(function(p){for(var i=0;i<2;i++)$(p+i).classList.remove("on")});
 $("v1").hidden=viewList.length<2;
 $("banner0").hidden=true;$("banner1").hidden=true;
 $("toasts0").textContent="";$("toasts1").textContent="";
 $("ping0").textContent="";
 View.Sfx.volume(settings.vol);
 show("match");
 requestAnimationFrame(frame);
}
function stopMatch(){
 running=false;
 if(document.exitPointerLock&&document.pointerLockElement)try{document.exitPointerLock()}catch(e){}
}

function startLocalMatch(){
 if(!ensureView())return;
 mode="local";matchStarted=true;
 world=Sim.makeWorld(settings.map,randomSeed());
 View.buildWorld(world);
 M=Sim.createMatch(world,{timeLimit:settings.timeLimit,scoreLimit:settings.scoreLimit},[myLoadout(),myLoadout()]);
 M.frozen=3;
 look.yaw=world.spawns[0].yaw;look.pitch=0;look2.yaw=world.spawns[1].yaw;
 syncFromSim();
 beginRuntime([0,1],0);
}
function startOnlineMatch(m){
 if(!ensureView())return;
 mode="online";matchStarted=true;
 settings=Object.assign(settings,m.settings);
 $("xpBox").hidden=true;
 world=Sim.makeWorld(settings.map,m.seed);
 View.buildWorld(world);
 M=null;
 rp=[newRend(),newRend()];
 for(var i=0;i<2;i++){
  var sp=world.spawns[i];rp[i].x=sp.x;rp[i].z=sp.z;rp[i].y=world.height(sp.x,sp.z);rp[i].yaw=sp.yaw;
 }
 gLoot=Sim.genLoot(world,world.seed*7+1);gs={tl:settings.timeLimit,fz:3,snapAt:0,round:1};
 ginv={slots:[Sim.makeWeapon(0,0,Sim.loadoutAtt(myLoadout(),0)),null],cur:0};gAds=0;wCache=[null,null];
 rp[1-seat].weapon=Sim.makeWeapon(0,0);rp[seat].weapon=ginv.slots[0];
 pred=Sim.makePlayer(seat,world);
 gTarget=[null,null];
 look.yaw=world.spawns[seat].yaw;look.pitch=0;
 beginRuntime([seat],seat);
}

function syncFromSim(){
 for(var i=0;i<2;i++){
  var p=M.players[i],r=rp[i],w=Sim.curWeapon(p);
  r.x=p.x;r.y=p.y;r.z=p.z;r.yaw=p.yaw;r.pitch=p.pitch;r.alive=p.alive;r.speed=p.speed;
  r.swimming=p.swimming;r.wading=p.wading;r.grounded=p.grounded;r.reloading=p.reloading;
  r.hp=p.hp;r.ammo=w.ammo;r.score=p.score;r.ads=p.ads;r.weapon=w;
 }
 // the local player(s) look wherever the mouse or turn keys say, even while frozen
 rp[0].yaw=look.yaw;rp[0].pitch=look.pitch;rp[1].yaw=look2.yaw
}

function frame(now){
 if(!running)return;
 if(!lastT)lastT=now;
 var dt=Math.min(0.05,(now-lastT)/1000);lastT=now;
 applyLookKeys(dt);

 if(mode==="online"){
  onlineUpdate(dt,now);
 }else{
  acc+=dt;
  var guard=0;
  while(acc>=FIXED&&guard++<6){
   Sim.step(M,[primaryInput(),secondInput()],FIXED);
   clearLatches();
   acc-=FIXED;
   drainSimEvents();
   if(M.over){break}
  }
  syncFromSim();
  if(M.over){endMatch();return}
 }

 updateHud(dt);
 View.render(dt,{players:rp,views:views,events:fxQueue,me:primary,loot:curLoot()});
 postRender();
 requestAnimationFrame(frame);
}

function drainSimEvents(){
 var ev=M.events;if(!ev.length)return;
 for(var i=0;i<ev.length;i++){
  var e=ev[i];
  fxQueue.push(e);hudEvent(e);
 }
 ev.length=0;
}

/* ---------- online: snapshots, prediction, interpolation ---------- */
function applyInv(m){
 ginv={slots:[Sim.unpackWeapon(m.s[0]),Sim.unpackWeapon(m.s[1])],cur:m.c|0};
}
function applySnapshot(m){
 if(!running||!world)return;
 gs.tl=m.tl;gs.fz=m.fz||0;gs.snapAt=performance.now();
 if(m.w){for(var q=0;q<2;q++)if(m.w[q]){wCache[q]=Sim.makeWeapon(m.w[q][0],m.w[q][1],Sim.unpackAtt(m.w[q][2]));rp[q].weapon=wCache[q]}}
 for(var i=0;i<2;i++){
  var a=m.p[i],r=rp[i];
  gTarget[i]={x:a[0],y:a[1],z:a[2],yaw:a[3],pitch:a[4],speed:a[10],flags:a[11]};
  r.hp=a[5];r.score=a[6];r.ammo=a[8];r.reloading=!!a[9];
  var wasAlive=r.alive;r.alive=!!a[7];
  if(i!==seat){ // the opponent: interpolated toward the target each frame
   r.swimming=!!(a[11]&1);r.wading=!!(a[11]&2);r.grounded=!!(a[11]&4);r.speed=a[10];
   if(!wasAlive&&r.alive){r.x=a[0];r.y=a[1];r.z=a[2]}
  }else{
   // reconcile prediction with the authoritative position
   var ex=a[0]-pred.x,ey=a[1]-pred.y,ez=a[2]-pred.z,err=Math.hypot(ex,ez);
   if(!r.alive||(!wasAlive&&r.alive)||err>4||Math.abs(ey)>3){pred.x=a[0];pred.y=a[1];pred.z=a[2];pred.vx=pred.vz=pred.vy=0}
   else if(pred.speed<0.5){pred.x+=ex*0.3;pred.z+=ez*0.3;pred.y+=ey*0.3}
   else if(err>1.6){pred.x+=ex*0.3;pred.z+=ez*0.3}
  }
 }
 if(m.ev)m.ev.forEach(function(e){
  if(e[0]==="r"){
   gs.round=e[1];gLoot=Sim.genLoot(world,world.seed*7+e[1]);
   ginv={slots:[Sim.makeWeapon(0,0,Sim.loadoutAtt(myLoadout(),0)),null],cur:0};gAds=0;
  }else if(e[0]==="t"||e[0]==="d"||e[0]==="c"){
   Sim.applyLootEvent(gLoot,e);
  }
  fxQueue.push(e);hudEvent(e);
 });
}
function lerpAngle(a,b,k){var d=Math.atan2(Math.sin(b-a),Math.cos(b-a));return a+d*k}
function ownWeapon(){return ginv.slots[ginv.cur]||ginv.slots[0]||rp[seat].weapon}
function onlineUpdate(dt,now){
 var inp=primaryInput();
 var w=ownWeapon(),st=w?Data.computeStats(w):null;
 var me=rp[seat];
 var wantAds=inp.ads&&!me.reloading&&me.alive;
 gAds+=((wantAds?1:0)-gAds)*Math.min(1,dt*9);
 inp.mul=(st?st.move:1)*(1-0.3*gAds);
 // predict own movement
 pred.yaw=look.yaw;
 if(me.alive&&gs.fz<=0)Sim.movePlayer(world,pred,inp,dt);
 me.x=pred.x;me.y=pred.y;me.z=pred.z;me.yaw=look.yaw;me.pitch=look.pitch;
 me.speed=pred.speed;me.swimming=pred.swimming;me.wading=pred.wading;me.grounded=pred.grounded;
 me.ads=gAds;me.weapon=w;
 // interpolate the opponent
 var t=gTarget[1-seat],o=rp[1-seat];
 if(t){
  var k=Math.min(1,dt*18);
  o.x+=(t.x-o.x)*k;o.y+=(t.y-o.y)*k;o.z+=(t.z-o.z)*k;
  o.yaw=lerpAngle(o.yaw,t.yaw,k);o.pitch+=(t.pitch-o.pitch)*k;
  if(Math.hypot(t.x-o.x,t.z-o.z)>6){o.x=t.x;o.y=t.y;o.z=t.z}
 }
 // send input at ~30 Hz, immediately when buttons change or a tap was latched
 var bits=[inp.f,inp.r,inp.jump?1:0,inp.fire?1:0,inp.reload?1:0,inp.ads?1:0,inp.use?1:0].join();
 if(now-lastInputSend>=33||bits!==lastInputBits||latch.force){
  lastInputSend=now;lastInputBits=bits;
  DuelNet.send({t:"in",f:inp.f,r:inp.r,j:inp.jump?1:0,fi:inp.fire?1:0,rl:inp.reload?1:0,ad:inp.ads?1:0,us:inp.use?1:0,
   fl:latch.fire?1:0,ul:latch.use?1:0,sw:latch.sw,y:Math.round(look.yaw*1000)/1000,p:Math.round(look.pitch*1000)/1000});
  latch.fire=false;latch.use=false;latch.sw=-1;latch.force=false;
 }
}

/* ---------- HUD ---------- */
function slotOf(idx){
 if(mode==="local")return idx;
 return idx===primary?0:-1;
}
function setBanner(slot,text,ms){
 var b=$("banner"+slot);b.textContent=text;b.hidden=false;
 clearTimeout(b._t);b._t=setTimeout(function(){b.hidden=true},ms||1600);
}
function flash(id,ms){
 var el=$(id);el.classList.add("on");
 clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove("on")},ms);
}
function toast(slot,text,color){
 var box=$("toasts"+slot),d=document.createElement("div");
 d.textContent=text;if(color)d.style.borderColor=color;if(color)d.style.color=color;
 box.appendChild(d);
 while(box.children.length>4)box.removeChild(box.firstChild);
 setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},2600);
}
function itemName(it){
 var R=rar(it.r).name;
 if(it.kind==="gun")return R+" "+Data.GUNS[it.a].name;
 if(it.kind==="att")return R+" "+Data.CATS[it.a].opts[it.b].name;
 return R+" Medkit";
}
function findItem(id){
 var L=curLoot();if(!L)return null;
 for(var i=0;i<L.items.length;i++)if(L.items[i].id===id)return L.items[i];
 return null;
}
function hudEvent(e){
 if(e[0]==="h"){
  var victim=e[1],shooter=1-victim;
  var vs=slotOf(victim),ss=slotOf(shooter);
  if(vs>=0){flash("dmg"+vs,120);View.Sfx.hurt()}
  if(ss>=0){var hm=$("hm"+ss);hm.classList.toggle("head",!!e[3]);flash("hm"+ss,160);if(mode!=="local")View.Sfx.hit()}
 }else if(e[0]==="k"){
  var killer=e[1],kv=slotOf(killer),dv=slotOf(1-killer);
  if(mode==="local"){setBanner(kv,"POINT FOR PLAYER "+(killer+1),1800);setBanner(dv,"ELIMINATED",1800)}
  else{
   if(kv>=0)setBanner(0,"OPPONENT ELIMINATED",1800);
   if(dv>=0)setBanner(0,"YOU WERE ELIMINATED",1800);
  }
  View.Sfx.kill();
 }else if(e[0]==="r"){
  views.forEach(function(v,s){setBanner(s,"ROUND "+e[1],1800)});
 }else if(e[0]==="t"){
  var s2=slotOf(e[2]),it=findItem(e[1]);
  if(s2>=0&&it){
   var col=rar(it.r).color;
   if(it.kind==="med"){toast(s2,"Medkit used +"+Data.HEAL[it.r]+" HP",col);View.Sfx.heal()}
   else{toast(s2,(it.kind==="gun"?"Picked up ":"Equipped ")+itemName(it),col);View.Sfx.pickup(it.r)}
  }else if(it&&mode!=="local"){View.Sfx.swap()}
 }else if(e[0]==="c"){
  View.Sfx.chest();
 }
}

function hudState(v){
 var r=rp[v];
 if(mode==="online"){
  return {slots:ginv.slots,cur:ginv.cur,hp:r.hp,ammo:r.ammo,reloading:r.reloading};
 }
 var p=M.players[v];
 return {slots:p.slots,cur:p.cur,hp:p.hp,ammo:Sim.curWeapon(p).ammo,reloading:p.reloading};
}
function wKey(w){
 if(!w)return "-";
 var s=w.g+"."+w.r+".";
 for(var i=0;i<7;i++)s+=(w.att&&w.att[i]?w.att[i].o+":"+w.att[i].r:"-")+",";
 return s;
}
function renderSlots(slot,hs){
 var key=hs.cur+"|"+wKey(hs.slots[0])+"|"+wKey(hs.slots[1]);
 if(key===hudKey[slot])return;hudKey[slot]=key;
 var box=$("slots"+slot);box.textContent="";
 hs.slots.forEach(function(w,i){
  var d=document.createElement("div");d.className="slot"+(i===hs.cur?" cur":"");
  if(w){
   var c=rar(w.r).color;
   d.style.setProperty("--c",c);
   d.textContent=(i+1)+"  "+Data.GUNS[w.g].name;
  }else{d.textContent=(i+1)+"  empty";d.classList.add("empty")}
  box.appendChild(d);
 });
 var cw=hs.slots[hs.cur],pips=$("pips"+slot);pips.textContent="";
 if(!cw)return;
 Data.CATS.forEach(function(c,ci){
  var a=cw.att[ci],s=document.createElement("span");s.className="pip"+(a?" on":"");s.textContent=c.abbr;
  if(a){s.style.setProperty("--c",rar(a.r).color);s.title=c.opts[a.o].name+" ("+rar(a.r).name+")"}
  else s.title=c.name+": empty";
  pips.appendChild(s);
 });
}
function pickPrompt(slot,v){
 var p=rp[v],el=$("prompt"+slot);
 var key=(mode==="local"&&v===1)?"L":"E";
 var u=p.alive&&(mode==="online"?gs.fz<=0:M.frozen<=0)?Sim.nearestUsable(curLoot(),p.x,p.z):null;
 var hs=hudState(v);
 var k="",title="",sub="",warn="",col="#e6ebf2";
 if(u&&u.type==="chest"){title="["+key+"] Open chest";sub=u.obj.tier==="bunker"?"Bunker cache: better odds":"Supply chest";k="c"+u.obj.x+u.obj.z}
 else if(u){
  var it=u.obj;col=rar(it.r).color;
  k="i"+it.id+"|"+hs.cur+"|"+Math.round(hs.hp>=100?1:0)+"|"+wKey(hs.slots[hs.cur])+"|"+wKey(hs.slots[1-hs.cur]);
  if(it.kind==="med"){
   if(hs.hp>=100){title="Medkit";sub="Health is full";warn=""}
   else{title="["+key+"] Use "+itemName(it);sub="+"+Data.HEAL[it.r]+" HP"}
  }else if(it.kind==="gun"){
   var st=Data.computeStats({g:it.a,r:it.r,att:it.att}),cw=hs.slots[hs.cur];
   title="["+key+"] "+itemName(it);
   sub=st.damage.toFixed(0)+(st.pellets>1?"x"+st.pellets:"")+" dmg  /  "+st.fireRate.toFixed(1)+" per sec  /  "+st.mag+" rounds"+(it.att&&it.att.some(Boolean)?"  /  has attachments":"");
   warn=!hs.slots[1-hs.cur]?"Goes to slot "+(2-hs.cur):"Replaces your "+(cw?rar(cw.r).name+" "+Data.GUNS[cw.g].name:"gun");
  }else{
   var cwa=hs.slots[hs.cur],old=cwa?cwa.att[it.a]:null,cat=Data.CATS[it.a];
   title="["+key+"] "+itemName(it);
   sub=cat.name+": "+Data.describeAttachment(it.a,it.b,it.r).join(", ");
   warn=old?("Replaces "+rar(old.r).name+" "+cat.opts[old.o].name):"For your "+(cwa?Data.GUNS[cwa.g].name:"gun");
  }
 }
 if(k!==promptKey[slot]){
  promptKey[slot]=k;
  if(!title){el.hidden=true}
  else{
   el.hidden=false;el.children[0].textContent=title;el.children[0].style.color=col;
   el.children[1].textContent=sub;el.children[2].textContent=warn;
   el.style.borderColor=col;
  }
 }
}
function pad2(n){return (n<10?"0":"")+n}
function updateHud(){
 var tl,fz;
 if(mode==="online"){tl=gs.tl;fz=gs.fz}else{tl=M.timeLeft;fz=M.frozen}
 views.forEach(function(v,slot){
  var p=rp[v],hs=hudState(v);
  $("hp"+slot).style.width=Math.max(0,hs.hp)+"%";
  $("hp"+slot).classList.toggle("low",hs.hp>0&&hs.hp<=25);
  $("hp"+slot).style.background=hs.hp>50?"#4ade80":(hs.hp>25?"#facc15":"#f87171");
  $("hpn"+slot).textContent=Math.max(0,Math.ceil(hs.hp));
  $("score"+slot).textContent=p.score;
  $("lbl"+slot).textContent=mode==="local"?("P"+(v+1)):"YOU";
  var cw=hs.slots[hs.cur];
  var mag=cw?(mode==="online"?Data.computeStats(cw).mag:cw.st.mag):0;
  $("ammo"+slot).textContent=hs.reloading?"RELOADING":(cw?hs.ammo+" / "+mag:"");
  renderSlots(slot,hs);
  pickPrompt(slot,v);
  $("uw"+slot).classList.toggle("on",p.y+Sim.EYE<world.water);
 });
 var other=rp[1-primary];
 var line=mode==="local"?(rp[0].score+"  -  "+rp[1].score):(rp[primary].score+"  -  "+other.score);
 var t="";
 if(settings.timeLimit>0){var s=Math.max(0,Math.floor(tl));t="   "+pad2(Math.floor(s/60))+":"+pad2(s%60)}
 $("clock").textContent=line+t;
 var c=$("count");
 if(fz>0){c.hidden=false;c.textContent=String(Math.ceil(fz))}else c.hidden=true;
 if(mode!=="local")$("ping0").textContent=DuelNet.rtt==null?"ping --":"ping "+DuelNet.rtt+" ms";
 $("lockHint").hidden=locked;
}
function postRender(){
 views.forEach(function(v,slot){
  var inf=View.info(v);
  $("scope"+slot).hidden=!inf.scoped;
  $("cross"+slot).style.opacity=inf.scoped?0:String(1-inf.ads*0.8);
 });
}

/* ---------- results ---------- */
function resultText(p1,p2){
 if(mode==="local")return {title:p1===p2?"DRAW":(p1>p2?"PLAYER 1 WINS":"PLAYER 2 WINS"),body:"Final score "+p1+" - "+p2+"."};
 var me=meIdx(),mine=me===0?p1:p2,theirs=me===0?p2:p1;
 return {title:mine===theirs?"DRAW":(mine>theirs?"YOU WIN":"YOU LOSE"),body:"Final score "+mine+" - "+theirs+" (you - opponent)."};
}
function configureResults(aborted){
 $("toMenu").hidden=false;$("rematch").hidden=false;$("rematch").disabled=false;
 if(aborted){$("toMenu").textContent="Back to menu";$("rematch").hidden=true;return}
 if(mode==="local"){$("toMenu").textContent="Change settings";$("rematch").textContent="Rematch"}
 else{
  $("toMenu").textContent="Leave room";
  var both=!!(lobbyInfo.seats[0]&&lobbyInfo.seats[1]);
  $("rematch").textContent=!both?"Opponent left":(seat===0?"Rematch":"Waiting for host...");
  $("rematch").disabled=!(seat===0&&both);
 }
}
function showXp(res){
 var box=$("xpBox");box.hidden=false;
 var b=res.before,a=res.after,fill=$("xpFill");
 $("xpGain").textContent="0";$("xpLvl").textContent=b.level;$("lvlUp").hidden=true;$("unlList").textContent="";$("burst").textContent="";
 fill.style.transition="none";fill.style.width=(b.max?100:Math.round(b.into/b.need*100))+"%";
 var t0=null,dur=1100;
 function tick(t){if(t0==null)t0=t;var k=Math.min(1,(t-t0)/dur);$("xpGain").textContent=Math.round(res.gained*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(tick)}
 requestAnimationFrame(tick);
 function finalW(){return (a.max?100:Math.round(a.into/a.need*100))+"%"}
 setTimeout(function(){
  fill.style.transition="width 1s cubic-bezier(.2,.8,.2,1)";
  if(a.level>b.level){
   fill.style.width="100%";
   setTimeout(function(){
    fill.style.transition="none";fill.style.width="0%";$("xpLvl").textContent=a.level;
    var l=$("lvlUp");l.hidden=false;l.textContent="LEVEL UP: "+b.level+" to "+a.level;burst();
    res.unlocked.forEach(function(u,i){var li=document.createElement("li");li.style.animationDelay=(i*120)+"ms";li.textContent="Unlocked: "+u.name+" ("+u.cat+")";$("unlList").appendChild(li)});
    setTimeout(function(){fill.style.transition="width 1s cubic-bezier(.2,.8,.2,1)";fill.style.width=finalW()},60);
   },1050);
  }else fill.style.width=finalW();
 },150);
}
function burst(){
 var box=$("burst"),cols=["#3de0ff","#ff6b4a","#ffd23a","#4ade80","#b26bff"];
 for(var i=0;i<36;i++){
  var p=document.createElement("i"),a=Math.random()*6.283,d=80+Math.random()*160;
  p.style.background=cols[i%cols.length];p.style.setProperty("--dx",Math.cos(a)*d+"px");p.style.setProperty("--dy",(Math.sin(a)*d-40)+"px");p.style.setProperty("--r",(Math.random()*720-360)+"deg");
  p.style.animationDelay=(Math.random()*120)+"ms";box.appendChild(p);
 }
 setTimeout(function(){box.textContent=""},1700);
}
function reportLocal(mine,theirs){
 $("xpBox").hidden=true;
 Backend.reportLocal(mine,theirs,mine>theirs).then(function(res){if(res){res.unlocked=Backend.newlyUnlocked(res.before.level,res.after.level);showXp(res)}});
}
function endMatch(){
 stopMatch();matchStarted=false;
 var p1=M.players[0].score,p2=M.players[1].score;
 var r=resultText(p1,p2);
 $("resultTitle").textContent=r.title;$("resultBody").textContent=r.body;
 reportLocal(p1,p2);
 configureResults(false);
 show("results");
}
function onlineEnd(m){
 stopMatch();matchStarted=false;
 var r=resultText(m.s[0],m.s[1]);
 if(m.left){r.title="OPPONENT LEFT";r.body="The other player disconnected. "+(m.s[seat]>m.s[1-seat]?"You win by forfeit.":"The match was counted as a forfeit.")}
 $("resultTitle").textContent=r.title;$("resultBody").textContent=r.body;
 $("xpBox").hidden=true;
 var x=m.xp;
 if(x&&x.counted===false){$("resultBody").textContent+=" Matches under 45 seconds do not earn XP."}
 else if(x&&x.before&&x.after){x.unlocked=Backend.newlyUnlocked(x.before.level,x.after.level);Backend.applyXp(x);showXp(x)}
 configureResults(false);
 show("results");
}
$("toMenu").onclick=function(){
 if(mode==="local")show("menu");
 else{leaveOnline();show("mode");renderProfile()}
};
$("rematch").onclick=function(){
 if(mode==="local")startLocalMatch();
 else if(seat===0)DuelNet.send({t:"start"});
};

/* ---------- boot: check the account, then handle deep links (?host=1, ?local=1, ?join=CODE) ---------- */
function gate(title,text,showBtn,spin){
 $("gateTitle").textContent=title;$("gateText").textContent=text;$("gateBtn").hidden=!showBtn;$("gateRing").style.display=spin?"block":"none";show("gate");
}
function enter(){
 renderProfile();show("mode");
 var qs=new URLSearchParams(location.search);
 if(qs.get("host")){startHostFlow()}
 else if(qs.get("local")){$("btnLocal").click()}
 else if(qs.get("join")){
  var code=DuelNet.normalizeCode(qs.get("join"));
  $("joinCode").value=code;show("join");
  if(code.length===5)joinRoom(code);
 }
}
var gatePoll=null;
Backend.init().then(function(r){
 if(r.state==="demo"||r.state==="ok"){enter();return}
 if(r.state==="anon"){location.replace("login.html?next="+encodeURIComponent("play.html"+location.search));return}
 if(r.state==="blocked"){gate("ACCESS REMOVED","An admin has blocked this account.",false,false);return}
 gate("WAITING FOR APPROVAL","An admin needs to approve your account before you can play. Your user ID is "+(r.profile?r.profile.id:"?")+". This page checks again every few seconds.",false,true);
 gatePoll=setInterval(function(){Backend.refresh().then(function(x){if(x.state==="ok"){clearInterval(gatePoll);enter()}else if(x.state==="blocked"){clearInterval(gatePoll);gate("ACCESS REMOVED","An admin has blocked this account.",false,false)}})},5000);
}).catch(function(){location.replace("login.html")});
