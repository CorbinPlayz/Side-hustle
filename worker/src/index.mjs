/* Duel Arena Worker. One deployment does everything:
   - serves the website files, but only to signed-in, approved players (the login page is the only public page)
   - account, loadout, leaderboard and admin API
   - runs each match on the server in a Durable Object (one object per room code)
   Needs the bindings in wrangler.toml: ASSETS, HUB, MATCH and the ADMIN_ID variable. */
import {DurableObject} from "cloudflare:workers";
import {HubCore,HubError} from "./hubcore.mjs";
import {MatchCore} from "./matchcore.mjs";
import Data from "../../public/js/data.js";

const COOKIE="duel_session";
const PUBLIC_PATHS=new Set(["/login.html","/css/style.css","/js/data.js","/js/backend.js","/js/site.js","/favicon.ico"]);
const SECURITY={"X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin","X-Frame-Options":"DENY",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()"};

function json(obj,status,extra){return new Response(JSON.stringify(obj),{status:status||200,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...SECURITY,...(extra||{})}})}
function getCookie(req,name){
  const c=req.headers.get("Cookie")||"";
  for(const part of c.split(";")){const i=part.indexOf("=");if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim()}
  return null;
}
function setCookie(token,maxAge){return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
/** Second lock on the admin API: if ADMIN_KEY is set (as a secret in the dashboard), every admin request must carry it. */
function sameKey(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function sameOrigin(req){
  const o=req.headers.get("Origin");
  return !o||o===new URL(req.url).origin;
}

/* ---------- Hub: accounts. One instance, SQLite storage. ---------- */
export class Hub extends DurableObject{
  constructor(ctx,env){
    super(ctx,env);
    const sql=ctx.storage.sql;
    this.core=new HubCore({
      all:(q,...p)=>sql.exec(q,...p).toArray(),
      run:(q,...p)=>{sql.exec(q,...p)}
    },{adminId:parseInt(env.ADMIN_ID,10)||0,signupCode:env.SIGNUP_CODE||""});
  }
  async invoke(method,args){
    try{return {ok:true,data:await this.core[method](...args)}}
    catch(e){if(e instanceof HubError)return {ok:false,error:e.message,status:e.status};console.error(e);return {ok:false,error:"Server error.",status:500}}
  }
}
async function hub(env,method,...args){
  const stub=env.HUB.get(env.HUB.idFromName("hub"));
  return stub.invoke(method,args);
}

/* ---------- Match: one room. ---------- */
export class Match extends DurableObject{
  constructor(ctx,env){
    super(ctx,env);
    this.env=env;this.nextId=1;this.timer=null;this.last=0;
    this.core=new MatchCore({
      report:async(uid,r)=>{const x=await hub(env,"recordMatch",uid,r);if(!x.ok||!x.data)return null;const d=x.data;return {gained:d.gained,before:Data.levelInfo(d.before),after:Data.levelInfo(d.after),counted:d.counted}}
    });
  }
  async fetch(request){
    if(request.headers.get("Upgrade")!=="websocket")return new Response("Expected a WebSocket",{status:426});
    const h=request.headers;
    let lo=[];try{lo=JSON.parse(h.get("x-duel-lo")||"[]")}catch(e){lo=[]}
    const level=Math.max(1,Math.min(Data.MAX_LEVEL,parseInt(h.get("x-duel-level"),10)||1));
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    server.accept();
    const conn={id:this.nextId++,uid:h.get("x-duel-uid"),name:h.get("x-duel-name")||"Player",level,
      att:null,
      send:o=>{try{server.send(JSON.stringify(o))}catch(e){}},
      close:()=>{try{server.close(1000,"closed")}catch(e){}}};
    conn.att=Data.expandLoadout(lo,level);   // attachments per gun, only what this player's level has unlocked
    const create=h.get("x-duel-create")==="1";
    server.addEventListener("message",ev=>{
      if(typeof ev.data!=="string"||ev.data.length>1500)return;
      let m;try{m=JSON.parse(ev.data)}catch(e){return}
      this.core.message(conn,m);this.ensureTimer();
    });
    const gone=()=>{this.core.leave(conn);this.ensureTimer()};
    server.addEventListener("close",gone);server.addEventListener("error",gone);
    this.core.join(conn,create);
    this.ensureTimer();
    return new Response(null,{status:101,webSocket:client});
  }
  ensureTimer(){
    const need=this.core.phase==="running";
    if(need&&!this.timer){
      this.last=Date.now();
      this.timer=setInterval(()=>{const n=Date.now();this.core.tick(n-this.last);this.last=n;if(this.core.phase!=="running"){clearInterval(this.timer);this.timer=null}},16);
    }else if(!need&&this.timer){clearInterval(this.timer);this.timer=null}
  }
}

/* ---------- Router ---------- */
async function readJson(req){try{return await req.json()}catch(e){return {}}}
function reply(r){return r.ok?json(r.data):json({error:r.error},r.status||400)}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    const token=getCookie(request,COOKIE);
    const who=async()=>{const r=await hub(env,"session",token);return r.ok?r.data:null};

    if(path==="/__diag"){
      // public self-check: shows what the asset store answers for the login page, without any login
      const probe=async(p)=>{try{const r=await env.ASSETS.fetch(new Request(new URL(p,url)));return {status:r.status,location:r.headers.get("location"),type:r.headers.get("content-type")}}catch(e){return {error:String(e)}}};
      return json({ok:true,path,loginHtml:await probe("/login.html"),login:await probe("/login"),root:await probe("/"),indexHtml:await probe("/index.html"),adminIdSet:(parseInt(env.ADMIN_ID,10)||0)>0});
    }
    if(path.startsWith("/api/")){
      if(request.method!=="GET"&&!sameOrigin(request))return json({error:"Bad origin."},403);
      if(path==="/api/register"&&request.method==="POST"){
        const b=await readJson(request),r=await hub(env,"register",b.username,b.password,b.code);
        if(!r.ok)return json({error:r.error},r.status||400);
        return json({profile:r.data.profile},200,{"Set-Cookie":setCookie(r.data.token,30*24*3600)});
      }
      if(path==="/api/login"&&request.method==="POST"){
        const b=await readJson(request),r=await hub(env,"login",b.username,b.password);
        if(!r.ok)return json({error:r.error},r.status||400);
        return json({profile:r.data.profile},200,{"Set-Cookie":setCookie(r.data.token,30*24*3600)});
      }
      if(path==="/api/logout"&&request.method==="POST"){
        await hub(env,"logout",token);
        return json({ok:true},200,{"Set-Cookie":setCookie("",0)});
      }
      const me=await who();
      if(path==="/api/me")return json({profile:me});
      if(!me)return json({error:"Sign in first."},401);
      if(me.status!=="approved"&&!path.startsWith("/api/admin"))return json({error:"Your account is not approved."},403);
      if(path==="/api/loadout"&&request.method==="POST"){const b=await readJson(request);return reply(await hub(env,"saveLoadout",me.id,b.loadout))}
      if(path==="/api/leaderboard"){return reply(await hub(env,"leaderboard",url.searchParams.get("sort"),parseInt(url.searchParams.get("limit"),10)||50))}
      if(path.startsWith("/api/admin")&&env.ADMIN_KEY){
        const k=request.headers.get("X-Admin-Key")||"";
        if(!sameKey(k,String(env.ADMIN_KEY)))return json({error:"Admin key needed.",needKey:true},401);
      }
      if(path==="/api/admin/users"){return reply(await hub(env,"adminList",me.id))}
      if(path==="/api/admin/status"&&request.method==="POST"){const b=await readJson(request);return reply(await hub(env,"adminSetStatus",me.id,b.id|0,b.status))}
      return json({error:"Not found."},404);
    }

    if(path.startsWith("/ws/")){
      if(request.headers.get("Upgrade")!=="websocket")return new Response("Expected a WebSocket",{status:426});
      const o=request.headers.get("Origin");
      if(o&&o!==url.origin)return new Response("Bad origin",{status:403});
      const me=await who();
      if(!me||me.status!=="approved")return new Response("Not allowed",{status:403});
      const code=path.slice(4).toUpperCase();
      if(!/^[A-Z2-9]{5}$/.test(code))return new Response("Bad code",{status:400});
      const stub=env.MATCH.get(env.MATCH.idFromName("room-"+code));
      const h=new Headers(request.headers);
      h.set("x-duel-uid",String(me.id));h.set("x-duel-name",me.username);h.set("x-duel-level",String(Data.levelInfo(me.xp).level));
      h.set("x-duel-lo",JSON.stringify(me.loadout));h.set("x-duel-create",url.searchParams.get("create")==="1"?"1":"0");
      return stub.fetch(new Request(request,{headers:h}));
    }

    // Website files: only the login page is public. Everything else needs an approved account.
    let allowed=PUBLIC_PATHS.has(path);
    let me=null;
    if(!allowed){
      me=await who();
      if(!me||me.status!=="approved"){
        const dest="/login.html?next="+encodeURIComponent(path==="/"?"/index.html":path.replace(/^\//,"")+url.search);
        return new Response(null,{status:302,headers:{Location:dest,"Cache-Control":"no-store",...SECURITY}});
      }
      if((path==="/admin.html"||path==="/admin")&&!me.is_admin)return new Response("Not found",{status:404,headers:SECURITY});
    }
    // serve the file exactly as named (html_handling is "none"), so / maps to index.html here
    const res=await env.ASSETS.fetch(path==="/"?new Request(new URL("/index.html",url),request):request);
    const out=new Response(res.body,res);
    for(const k in SECURITY)out.headers.set(k,SECURITY[k]);
    if(!allowed)out.headers.set("Cache-Control","private, no-store");
    return out;
  }
};
