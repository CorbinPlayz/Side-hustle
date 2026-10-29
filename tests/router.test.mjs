// Runs the real Worker router in Node with a fake Cloudflare environment (no workerd needed).
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {fileURLToPath} from "node:url";
import path from "node:path";
const here=path.dirname(fileURLToPath(import.meta.url)),src=path.join(here,"../worker/src");
mkdirSync(path.join(here,".tmp"),{recursive:true});
let code=readFileSync(path.join(src,"index.mjs"),"utf8").replace('import {DurableObject} from "cloudflare:workers";','class DurableObject{constructor(c,e){this.ctx=c;this.env=e}}');
code=code.replace(/\.\/(hubcore|matchcore|worldcore)\.mjs/g,"../../worker/src/$1.mjs").replace("../../public/js/data.js","../../public/js/data.js");
writeFileSync(path.join(here,".tmp/index.mjs"),code);
const mod=await import(path.join(here,".tmp/index.mjs"));
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log("FAIL",m)}else console.log("ok  ",m)};
const sq=new DatabaseSync(":memory:");
const ctx={storage:{sql:{exec:(q,...p)=>{const st=sq.prepare(q);const rows=/^\s*select/i.test(q)?st.all(...p):(st.run(...p),[]);return {toArray:()=>rows}}}}};
const env={ADMIN_ID:"0",SIGNUP_CODE:""};
let hubObj=new mod.Hub(ctx,env);
env.HUB={idFromName:n=>n,get:()=>hubObj};
env.ASSETS={fetch:async r=>new Response("ASSET "+new URL(r.url).pathname,{status:200})};
const B="https://duel.example";
async function go(p,{method="GET",body,cookie,origin}={}){
  const h={};if(cookie)h.Cookie=cookie;if(body){h["Content-Type"]="application/json"}if(origin)h.Origin=origin;
  const r=await mod.default.fetch(new Request(B+p,{method,headers:h,body:body?JSON.stringify(body):undefined,redirect:"manual"}),env);
  const sc=r.headers.get("Set-Cookie");let j=null;try{j=await r.clone().json()}catch(e){}
  return {r,status:r.status,j,cookie:sc?sc.split(";")[0]:null,setCookie:sc,text:await r.clone().text().catch(()=>"")};
}
// anonymous visitors
let a=await go("/");ok(a.status===302&&a.r.headers.get("Location").startsWith("/login.html"),"anon / -> login redirect");
a=await go("/js/game.js");ok(a.status===302,"anon cannot fetch game code");
a=await go("/world.html?room=ABCDE");ok(a.r.headers.get("Location")==="/login.html?next=world.html%3Froom%3DABCDE","redirect keeps next=world.html?room=ABCDE");
a=await go("/play.html");ok(a.status===404,"Dual Arenas pages are hidden by default");
a=await go("/login.html");ok(a.status===200,"login page is public");
a=await go("/js/backend.js");ok(a.status===200,"backend.js public (needed by login)");
a=await go("/api/me");ok(a.j.profile===null,"anon /api/me -> null profile");
a=await go("/api/leaderboard");ok(a.status===401,"anon API refused");
a=await go("/ws/ABCDE");ok(a.status===404,"old arena socket hidden while arenas are off");
// register admin
a=await go("/api/register",{method:"POST",body:{username:"owner",password:"password1"}});
ok(a.status===200&&!a.j.profile.is_admin,"registering never makes you admin");
env.ADMIN_ID=String(a.j.profile.id);hubObj=new mod.Hub(ctx,env);   // owner sets ADMIN_ID and redeploys
a=await go("/api/login",{method:"POST",body:{username:"owner",password:"password1"}});
ok(a.j.profile.is_admin&&a.j.profile.status==="approved","after ADMIN_ID is set the owner is admin");
ok(/HttpOnly/.test(a.setCookie)&&/Secure/.test(a.setCookie)&&/SameSite=Lax/.test(a.setCookie),"cookie is HttpOnly, Secure, SameSite");
const adminCookie=a.cookie;
a=await go("/",{cookie:adminCookie});ok(a.status===200&&a.text.includes("ASSET /"),"admin can load site");
a=await go("/admin.html",{cookie:adminCookie});ok(a.status===200,"admin can load admin.html");
// a player
a=await go("/api/register",{method:"POST",body:{username:"Player1",password:"password1"}});
const pc=a.cookie;ok(a.j.profile.status==="pending","player starts pending");
a=await go("/",{cookie:pc});ok(a.status===302,"pending player is redirected away from the site");
a=await go("/world.html",{cookie:pc});ok(a.status===302,"pending player cannot load the game");
a=await go("/api/leaderboard",{cookie:pc});ok(a.status===403,"pending player cannot call the API");
a=await go("/ws/ABCDE",{cookie:pc});ok(a.status===404||a.status===403,"pending player cannot open a match socket");
a=await go("/admin.html",{cookie:pc});ok(a.status===302,"pending player cannot see admin.html");
a=await go("/api/admin/users",{cookie:pc});ok(a.status===403||a.status===404,"pending player cannot use admin API");
// approve
a=await go("/api/admin/users",{cookie:adminCookie});ok(a.j.length===2,"admin lists 2 users");
const pid=a.j.find(u=>u.username==="Player1").id;
a=await go("/api/admin/status",{method:"POST",cookie:pc,body:{id:pid,status:"approved"}});ok(a.status!==200,"player cannot approve self");
a=await go("/api/admin/status",{method:"POST",cookie:adminCookie,body:{id:pid,status:"approved"},origin:"https://evil.example"});ok(a.status===403,"cross-origin POST refused (CSRF)");
a=await go("/api/admin/status",{method:"POST",cookie:adminCookie,body:{id:pid,status:"approved"},origin:B});ok(a.status===200,"admin approves player");
a=await go("/",{cookie:pc});ok(a.status===200,"approved player can load the site");
a=await go("/admin.html",{cookie:pc});ok(a.status===404,"approved player gets 404 on admin.html");
a=await go("/api/admin/users",{cookie:pc});ok(a.status===404,"approved player gets 404 on admin API");
const lo=Array.from({length:8},()=>Array(7).fill(-1));lo[0][0]=1;
a=await go("/api/loadout",{method:"POST",cookie:pc,body:{loadout:lo}});ok(a.status===200&&a.j.loadout[0][0]===1,"approved player saves loadout");
a=await go("/api/leaderboard?sort=xp",{cookie:pc});ok(a.status===404,"leaderboard hidden while arenas are off");
a=await go("/api/admin/arenas",{method:"POST",cookie:adminCookie,origin:B,body:{on:true,code:"nope"}});ok(a.status===403,"wrong arenas code refused");
a=await go("/api/admin/arenas",{method:"POST",cookie:pc,origin:B,body:{on:true,code:"10242010"}});ok(a.status===404,"player cannot flip arenas");
a=await go("/api/admin/arenas",{method:"POST",cookie:adminCookie,origin:B,body:{on:true,code:"10242010"}});ok(a.status===200&&a.j.on===true,"admin turns Dual Arenas on with the code");
a=await go("/play.html",{cookie:pc});ok(a.status===200,"play.html served when arenas are on");
a=await go("/api/leaderboard?sort=xp",{cookie:pc});ok(a.status===200&&Array.isArray(a.j),"leaderboard works when arenas are on");
a=await go("/api/admin/arenas",{method:"POST",cookie:adminCookie,origin:B,body:{on:false,code:"10242010"}});ok(a.status===200&&a.j.on===false,"admin hides Dual Arenas again");
a=await go("/play.html",{cookie:pc});ok(a.status===404,"play.html hidden again");
// block
a=await go("/api/admin/status",{method:"POST",cookie:adminCookie,body:{id:pid,status:"blocked"}});
a=await go("/",{cookie:pc});ok(a.status===302,"blocked player is locked out immediately");
a=await go("/api/logout",{method:"POST",cookie:adminCookie});ok(/Max-Age=0/.test(a.setCookie),"logout clears cookie");
a=await go("/",{cookie:adminCookie});ok(a.status===302,"session is gone after logout");
console.log(fails?fails+" FAILED":"all router tests passed");process.exit(fails?1:0);
