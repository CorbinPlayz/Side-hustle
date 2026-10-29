import * as THREE from "three";
import {makeCharacter,animateCharacter} from "./character.js";
/** Shared rooms: join a 5-letter code, see the other players (up to 6) and share one market.
 *  The Worker keeps the market, housing and neighbours; each player keeps their own money, bag and building. */
const HZ=15;
function tagTexture(name){
  const c=document.createElement("canvas");c.width=256;c.height=64;const g=c.getContext("2d");
  g.font="700 34px 'Fredoka',Georgia,sans-serif";const w=Math.min(240,g.measureText(name).width+30);
  g.fillStyle="rgba(30,18,50,.72)";g.beginPath();g.roundRect((256-w)/2,8,w,48,22);g.fill();
  g.fillStyle="#fff3df";g.textAlign="center";g.textBaseline="middle";g.fillText(name,128,33,w-20);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function joinRoom({code,host,eco,town,scene,hud,look,heightAt}){
  const api={code,connected:false,count:1,remotes:new Map(),update(){},close(){}};
  const remotes=api.remotes;let ws=null,myId=null,myKey=null,tries=0,closed=false,sendT=0,clock=0;
  // little badge showing the code; click to copy it
  const badge=document.createElement("button");badge.type="button";
  badge.style.cssText="position:fixed;top:12px;right:12px;z-index:40;font:700 15px 'Nunito',system-ui,sans-serif;color:#fff3df;background:rgba(30,18,50,.78);border:1.5px solid rgba(255,226,190,.4);border-radius:12px;padding:7px 12px;cursor:pointer;backdrop-filter:blur(6px)";
  const paint=txt=>{badge.textContent=txt||`Room ${code} · ${api.count}/6${api.connected?"":" · connecting..."}`};
  badge.title="Click to copy the room code";badge.onclick=async()=>{try{await navigator.clipboard.writeText(code);hud.toast("Room code copied: "+code,"#9ad4f0")}catch(e){hud.toast("Room code: "+code,"#9ad4f0")}};
  document.body.appendChild(badge);paint();
  const send=o=>{if(ws&&ws.readyState===1)try{ws.send(JSON.stringify(o));api.sent=(api.sent||0)+1}catch(e){api.err=String(e)}};
  const addRemote=p=>{
    if(p.id===myId||remotes.has(p.id))return;
    const mesh=makeCharacter(p.look&&Object.keys(p.look).length?p.look:undefined);mesh.position.set(p.x||0,p.y||0,p.z||0);
    const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tagTexture(p.name||"Player"),transparent:true,depthWrite:false}));tag.scale.set(1.8,.45,1);tag.position.y=2.45;mesh.add(tag);
    scene.add(mesh);remotes.set(p.id,{mesh,name:p.name,tx:p.x||0,ty:p.y||0,tz:p.z||0,yaw:p.yaw||0,vx:0,vz:0,first:true});
  };
  const dropRemote=id=>{const r=remotes.get(id);if(!r)return;scene.remove(r.mesh);remotes.delete(id)};
  const recount=()=>{api.count=remotes.size+1;paint()};
  function onMsg(m){
    if(m.t==="welcome"){myId=m.you;myKey="p:"+m.uid;api.connected=true;tries=0;
      eco.net={sold:(counts,total)=>send({t:"supply",counts,total}),plot:id=>send({t:"plotBuy",plot:id})};
      eco.applyMarket(m.market,myKey);town.refresh();
      for(const p of m.players)addRemote(p);recount();
      hud.toast(host?`Room ${code} is open. Share the code!`:`Joined room ${code}`,"#8ff0a6");
      // if I already own a plot from my save, tell the room
      if(eco.myPlot!=null&&!(m.market.house.owners||{})[eco.myPlot])send({t:"plotBuy",plot:eco.myPlot});
    }
    else if(m.t==="joined"){addRemote(m.p);recount();hud.toast(`${m.p.name} joined the island`,"#9ad4f0")}
    else if(m.t==="left"){const r=remotes.get(m.id);if(r)hud.toast(`${r.name} left`,"#c9b0d0");dropRemote(m.id);recount()}
    else if(m.t==="look"){const r=remotes.get(m.id);if(r){const p=r.mesh.position.clone();scene.remove(r.mesh);remotes.delete(m.id);addRemote({id:m.id,name:r.name,look:m.look,x:p.x,y:p.y,z:p.z,yaw:r.yaw});}}
    else if(m.t==="snap"){for(const p of m.players){if(p.id===myId)continue;let r=remotes.get(p.id);if(!r){addRemote(p);r=remotes.get(p.id);recount()}if(!r)continue;r.tx=p.x;r.ty=p.y;r.tz=p.z;r.yaw=p.yaw;if(r.first){r.first=false;r.mesh.position.set(p.x,p.y,p.z)}}}
    else if(m.t==="market"){eco.applyMarket(m.market,myKey);town.refresh()}
    else if(m.t==="news"){hud.toast(m.msg,"#9ad4f0")}
    else if(m.t==="plotDenied"){if(m.market){eco.applyMarket(m.market,myKey);town.refresh()}hud.toast("Someone else got that plot first.","#ff7b6b")}
    else if(m.t==="error"){hud.toast(m.error||"Couldn't join the room.","#ff7b6b");giveUp(true)}
  }
  function connect(){
    if(closed)return;
    try{ws=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}/ws/world/${code}`)}catch(e){return giveUp()}
    ws.onopen=()=>send({t:"hello",look});
    ws.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}onMsg(m)};
    ws.onclose=()=>{const was=api.connected;api.connected=false;eco.net=null;for(const id of [...remotes.keys()])dropRemote(id);recount();if(closed)return;
      if(was||tries<2){tries++;if(tries>6)return giveUp();paint(`Room ${code} · reconnecting...`);setTimeout(connect,Math.min(5000,600*tries))}else giveUp()};
    ws.onerror=()=>{};
  }
  function giveUp(quiet){closed=true;eco.net=null;try{ws&&ws.close()}catch(e){}badge.remove();for(const id of [...remotes.keys()])dropRemote(id);if(!quiet)hud.toast("Couldn't reach the room server, so you're playing solo. Rooms only work on the online version.","#ffc15a")}
  api.close=()=>giveUp(true);
  api.update=(dt,player,tool)=>{
    clock+=dt;sendT+=dt;
    if(sendT>=1/HZ){sendT=0;send({t:"pos",x:+player.x.toFixed(2),y:+(player.y-1.7).toFixed(2),z:+player.z.toFixed(2),yaw:+player.yaw.toFixed(3),tool:tool|0})}
    const k=Math.min(1,dt*10);
    for(const r of remotes.values()){
      const m=r.mesh,px=m.position.x,pz=m.position.z;
      m.position.x+=(r.tx-m.position.x)*k;m.position.z+=(r.tz-m.position.z)*k;
      const gy=heightAt?Math.max(heightAt(m.position.x,m.position.z),.15):r.ty;m.position.y+=((Math.abs(r.ty-gy)<3?gy:r.ty)-m.position.y)*Math.min(1,dt*14);
      const v=Math.hypot(m.position.x-px,m.position.z-pz)/Math.max(dt,1e-3);
      let da=(r.yaw+Math.PI)-m.rotation.y;da=Math.atan2(Math.sin(da),Math.cos(da));m.rotation.y+=da*Math.min(1,dt*10);
      animateCharacter(m,dt,Math.min(1.7,v/5),clock);
    }
  };
  connect();
  return api;
}
