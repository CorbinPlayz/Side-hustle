import {DatabaseSync} from "node:sqlite";
import {HubCore,HubError} from "../worker/src/hubcore.mjs";
import Data from "../public/js/data.js";
let fails=0;
function ok(c,m){if(!c){fails++;console.log("FAIL",m)}else console.log("ok  ",m)}
async function throws(p,status,m){try{await p;ok(false,m+" (did not throw)")}catch(e){ok(e instanceof HubError&&(!status||e.status===status),m+" -> "+e.message)}}
const sqlite=new DatabaseSync(":memory:");
const db={all:(q,...p)=>sqlite.prepare(q).all(...p),run:(q,...p)=>{sqlite.prepare(q).run(...p)}};
let hub=new HubCore(db,{adminId:0,signupCode:""});
const adm0=await hub.register("boss","password1");
ok(!adm0.profile.is_admin&&adm0.profile.status==="pending","with ADMIN_ID unset nobody is admin");
hub=new HubCore(db,{adminId:adm0.profile.id,signupCode:""});
const adm=await hub.login("boss","password1");
ok(adm.profile.is_admin&&adm.profile.status==="approved","account whose id is ADMIN_ID is an approved admin");
const imp=await hub.register("Imposter","password1");ok(imp.profile.status==="pending"&&!imp.profile.is_admin,"others start pending");
await throws(hub.register("Boss","password1"),409,"duplicate username");
await throws(hub.register("x","password1"),400,"short username");
await throws(hub.register("goodname","short"),400,"short password");
// a second registration of the admin name can never claim admin: use a fresh hub where an admin exists
ok(!(await hub.login("Imposter","password1")).profile.is_admin,"nobody else is admin");
// login/session
await throws(hub.login("Imposter","wrongpass1"),401,"bad password");
const l=await hub.login("imposter","password1");ok(l.token.length>30,"login with different case works");
const s=await hub.session(l.token);ok(s&&s.username==="Imposter"&&!("pass_hash" in s),"session returns profile without hash");
ok((await hub.session("bad"))===null,"bad token rejected");
// throttle
for(let i=0;i<5;i++)try{await hub.login("Nobody","xxxxxxxx1")}catch(e){}
await throws(hub.login("Nobody","xxxxxxxx1"),429,"throttled after 5 failures");
// approval gates
await throws(Promise.resolve().then(()=>hub.saveLoadout(imp.profile.id,Data.emptyLoadout())),403,"pending user cannot save loadout");
ok(hub.recordMatch(imp.profile.id,{kills:3,deaths:1,won:true,seconds:100})===null,"pending user gets no XP");
// admin actions
const pend=hub.adminList(adm.profile.id);ok(pend.length===2,"admin lists users");
await throws(Promise.resolve().then(()=>hub.adminList(imp.profile.id)),404,"non-admin cannot list");
await throws(Promise.resolve().then(()=>hub.adminSetStatus(imp.profile.id,adm.profile.id,"blocked")),404,"non-admin cannot change status");
await throws(Promise.resolve().then(()=>hub.adminSetStatus(adm.profile.id,adm.profile.id,"blocked")),0,"admin cannot block self");
hub.adminSetStatus(adm.profile.id,imp.profile.id,"approved");
ok((await hub.session(l.token)).status==="approved","approved player now passes");
// loadout and match
const lo=Data.emptyLoadout();lo[0][0]=2;
ok(hub.saveLoadout(imp.profile.id,lo).loadout[0][0]===2,"loadout saved");
await throws(Promise.resolve().then(()=>hub.saveLoadout(imp.profile.id,[[9]])),400,"bad loadout rejected");
ok(hub.recordMatch(imp.profile.id,{kills:3,deaths:1,won:true,seconds:100}).gained===Data.matchXp(3,true),"XP computed on server: "+Data.matchXp(3,true));
ok(hub.recordMatch(imp.profile.id,{kills:3,deaths:1,won:true,seconds:10}).gained===0,"matches under 45 s give no XP");
ok(hub.recordMatch(imp.profile.id,{kills:99,deaths:0,won:false,seconds:100}).gained===Data.matchXp(10,false),"kills capped at 10");
// leaderboard
const lb=hub.leaderboard("xp",10);ok(lb.length===2&&lb[0].username==="Imposter","leaderboard ranks approved by xp");
// block kills sessions
hub.adminSetStatus(adm.profile.id,imp.profile.id,"blocked");
ok((await hub.session(l.token))===null,"blocked player's sessions are deleted");
await throws(Promise.resolve().then(()=>hub.adminSetStatus(adm.profile.id,adm.profile.id,"approved")),0,"admin account not editable");
// invite code
const inv=new HubCore(new DatabaseSync(":memory:").constructor===DatabaseSync?(()=>{const s=new DatabaseSync(":memory:");return {all:(q,...p)=>s.prepare(q).all(...p),run:(q,...p)=>{s.prepare(q).run(...p)}}})():null,{signupCode:"letmein"});
await throws(inv.register("player1","password1","nope"),403,"wrong invite code refused");
ok((await inv.register("player1","password1","letmein")).profile.status==="pending","right invite code accepted");
console.log(fails?fails+" FAILED":"all hub tests passed");process.exit(fails?1:0);
