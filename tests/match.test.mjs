import {MatchCore} from "../worker/src/matchcore.mjs";
import Data from "../public/js/data.js";
const log=[];
function mk(id,uid,name){const c={id,uid,name,level:9,att:Data.expandLoadout((()=>{const l=Data.emptyLoadout();l[0][0]=0;return l})(),9),out:[],closed:false,send(o){this.out.push(o)},close(){this.closed=true}};return c}
const reports=[];
const core=new MatchCore({report:(uid,r)=>{reports.push([uid,r]);return Promise.resolve({gained:Data.matchXp(r.kills,r.won),before:0,after:1})}});
const a=mk(1,"u1","Alice"),b=mk(2,"u2","Bob"),c=mk(3,"u3","Cy");
core.join(c,false);console.log("join missing room:",c.out[0].error);
core.join(a,true);core.join(b,false);
console.log("lobby seats:",JSON.stringify(a.out.at(-1).seats),"a you",a.out.at(-1).you,"b you",b.out.at(-1).you);
const d=mk(4,"u4","Dan");core.join(d,false);console.log("third player:",d.out[0].error);
core.join(mk(5,"u1","Alice2"),true);
core.message(b,{t:"start"});console.log("guest start ignored:",core.phase);
core.message(a,{t:"settings",map:"creek",scoreLimit:3,timeLimit:0});console.log("settings:",JSON.stringify(core.settings));
core.message(a,{t:"start"});console.log("phase",core.phase,"start msg",a.out.find(m=>m.t==="start").seed>0, "att on pistol",JSON.stringify(core.M.players[1].slots[0].att[0]));
// run 3.5 s of freeze then walk and shoot
for(let i=0;i<260;i++)core.tick(16);
const st=core.M.players;
// teleport a in front of b to force a kill
const w=core.M.world;
function place(){const x=0,za=-25,zb=-40;st[0].x=x;st[0].z=za;st[0].y=w.height(x,za);st[1].x=x;st[1].z=zb;st[1].y=w.height(x,zb)}
let kills=0;
for(let round=0;round<30&&core.phase==="running";round++){
  if(!core.M)break;place();
  core.message(a,{t:"in",f:0,r:0,j:0,fi:0,rl:0,ad:0,us:0,y:0,p:Math.atan2((st[1].y+1.2)-(st[0].y+1.7),15)});
  for(let k=0;k<200&&core.M&&st[1].alive;k++){core.message(a,{t:"in",f:0,r:0,fi:1,fl:1,y:0,p:Math.atan2((st[1].y+1.2)-(st[0].y+1.7),15)});core.tick(16);place()}
  for(let k=0;k<200&&core.M;k++){core.message(a,{t:"in",f:0,r:0,fi:0,y:0,p:0});core.tick(16)}
}
console.log("phase after fight",core.phase);
await new Promise(r=>setTimeout(r,20));
const end=a.out.find(m=>m.t==="end");console.log("end msg",JSON.stringify(end),"reports",JSON.stringify(reports.map(r=>[r[0],r[1].kills,r[1].won,Math.round(r[1].seconds)>40])));
const snaps=a.out.filter(m=>m.t==="s");console.log("snapshots",snaps.length,"inv msgs b",b.out.filter(m=>m.t==="inv").length);
// leave mid-match forfeits
core.message(a,{t:"start"});
for(let i=0;i<300;i++)core.tick(16);
core.leave(b);await new Promise(r=>setTimeout(r,20));
console.log("after leave: phase",core.phase,"a got end left:",a.out.filter(m=>m.t==="end").at(-1).left,"a seat",core.seats.map(s=>s&&s.name));
