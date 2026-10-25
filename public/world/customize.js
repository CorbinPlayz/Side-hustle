import * as THREE from "three";
import {makeCharacter,SKINS,HAIR_COLORS,TOP_COLORS,BOTTOM_COLORS,PLAYER_OPTIONS,defaultLook} from "./character.js";
/** Character creator: a small preview you can spin, with buttons for every part. Saves into localStorage. */
const ROWS=[
  ["skin","Skin",SKINS.length,"c",SKINS],["hair","Hair style",PLAYER_OPTIONS.hair.length,"n",PLAYER_OPTIONS.hair],["hairColor","Hair colour",HAIR_COLORS.length,"c",HAIR_COLORS],
  ["hat","Hat",PLAYER_OPTIONS.hat.length,"n",PLAYER_OPTIONS.hat],["eyes","Eyes",PLAYER_OPTIONS.eyes.length,"n",PLAYER_OPTIONS.eyes],["teeth","Teeth",PLAYER_OPTIONS.teeth.length,"n",PLAYER_OPTIONS.teeth],
  ["top","Top",PLAYER_OPTIONS.top.length,"n",PLAYER_OPTIONS.top],["topColor","Top colour",TOP_COLORS.length,"c",TOP_COLORS],["bottom","Bottoms",PLAYER_OPTIONS.bottom.length,"n",PLAYER_OPTIONS.bottom],["bottomColor","Bottom colour",BOTTOM_COLORS.length,"c",BOTTOM_COLORS]
];
export const LOOK_KEY="sidehustle.look";
export function loadLook(){let l={...defaultLook(1),skin:1,topColor:1};try{l={...l,...JSON.parse(localStorage.getItem(LOOK_KEY)||"{}")}}catch(e){}return l}
export function openCustomizer(onSave){
  const look=loadLook();
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;inset:0;z-index:50;background:rgba(5,15,30,.7);display:flex;align-items:center;justify-content:center;font-family:'Alegreya Sans',system-ui,sans-serif;color:#fff";
  wrap.innerHTML=`<div style="background:rgba(24,40,68,.97);border:2px solid #f08a3c;border-radius:8px;padding:16px 18px;display:flex;gap:18px;max-width:94vw;max-height:94vh;overflow:auto;flex-wrap:wrap;justify-content:center">
   <canvas id="cvp" width="240" height="330" style="width:240px;height:330px;flex:none;border-radius:6px;background:#9ac8e8"></canvas>
   <div style="min-width:270px"><h2 style="margin:0 0 8px;font:700 26px Alegreya,serif;color:#ff9a4d">Your character</h2><div id="rows"></div>
   <p style="margin:12px 0 0;display:flex;gap:8px"><button id="rnd" style="${btn()}">Randomise</button><button id="ok" style="${btn()}">Save</button><button id="no" style="${btn()}">Cancel</button></p></div></div>`;
  document.body.appendChild(wrap);window.__modal=true;
  const rows=wrap.querySelector("#rows");
  const redraw=()=>{rows.innerHTML=ROWS.map(([k,label,n,kind,src],i)=>{
    const val=kind==="c"?`<span style="display:inline-block;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:#${src[look[k]%n].toString(16).padStart(6,"0")}"></span>`:src[look[k]%n];
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0"><span style="width:110px">${label}</span><button data-r="${i}" data-d="-1" style="${btn(1)}">‹</button><span style="min-width:96px;text-align:center">${val}</span><button data-r="${i}" data-d="1" style="${btn(1)}">›</button></div>`}).join("");
    rows.querySelectorAll("button").forEach(b=>b.onclick=()=>{const r=ROWS[b.dataset.r];look[r[0]]=(look[r[0]]+ +b.dataset.d+r[2])%r[2];redraw();rebuild()})};
  const cv=wrap.querySelector("#cvp"),r=new THREE.WebGLRenderer({canvas:cv,antialias:true});r.setSize(240,330,false);r.outputColorSpace=THREE.SRGBColorSpace;r.setClearColor(0xa8d4ee,1);
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xffffff,0x8a8a70,2.3));const dl=new THREE.DirectionalLight(0xffffff,2.4);dl.position.set(2,4,4);sc.add(dl);
  const cam=new THREE.PerspectiveCamera(32,240/330,.1,30);cam.position.set(0,1.2,4.4);cam.lookAt(0,1.0,0);
  let ch=null;const rebuild=()=>{if(ch)sc.remove(ch);ch=makeCharacter(look);sc.add(ch)};
  let alive=true,t=0;const loop=()=>{if(!alive)return;t+=.016;if(ch){ch.rotation.y=Math.sin(t*.7)*.7;ch.userData.head.rotation.z=Math.sin(t*1.3)*.05}r.render(sc,cam);requestAnimationFrame(loop)};
  const close=()=>{window.__modal=false;alive=false;r.dispose();wrap.remove()};
  wrap.querySelector("#no").onclick=close;
  wrap.querySelector("#ok").onclick=()=>{try{localStorage.setItem(LOOK_KEY,JSON.stringify(look))}catch(e){}close();onSave&&onSave(look)};
  wrap.querySelector("#rnd").onclick=()=>{for(const [k,,n] of ROWS)look[k]=(Math.random()*n)|0;redraw();rebuild()};
  redraw();rebuild();loop();
}
function btn(s){return `font:700 ${s?20:17}px 'Alegreya Sans',sans-serif;border:2px solid #f08a3c;background:#2c4b7a;color:#fff;border-radius:5px;padding:${s?"0 10px":"7px 12px"};cursor:pointer`}
