/* Backend client: talks to the site's own /api (Cloudflare Worker). No third-party services.
   If /api is not there (opening the files locally or in a static preview) it falls back to a one-player demo mode. */
(function(root){
"use strict";
var Data=root.Data;
var DEMO_KEY="duel.demo.profile";
var B={enabled:false,profile:null};

function demoLoad(){
 var p=null;try{p=JSON.parse(localStorage.getItem(DEMO_KEY)||"null")}catch(e){}
 if(!p)p={id:0,username:"Player",status:"approved",is_admin:false,xp:0,wins:0,losses:0,kills:0,deaths:0,loadout:[]};
 return p;
}
function demoSave(p){try{localStorage.setItem(DEMO_KEY,JSON.stringify(p))}catch(e){}}
function decorate(p){
 if(!p)return p;
 p.info=Data.levelInfo(p.xp||0);p.level=p.info.level;
 p.lo=Data.sanitizeLoadout(p.loadout);
 return p;
}
function api(path,body){
 var o={credentials:"same-origin",headers:{}};
 if(body!==undefined){o.method="POST";o.headers["Content-Type"]="application/json";o.body=JSON.stringify(body)}
 return fetch(path,o).then(function(r){
  var ct=r.headers.get("content-type")||"";
  if(ct.indexOf("json")<0){var e=new Error("no-api");e.noApi=true;throw e}
  return r.json().then(function(j){
   if(!r.ok){var er=new Error(j&&j.error||"Something went wrong.");er.status=r.status;throw er}
   return j;
  });
 });
}
function state(p){return !p?"anon":p.status==="approved"?"ok":p.status}

/** Resolves to {state, profile}. state: "demo" | "anon" | "pending" | "blocked" | "ok". */
B.init=function(){
 return api("/api/me").then(function(r){
  B.enabled=true;B.profile=decorate(r.profile);
  return {state:state(r.profile),profile:B.profile};
 }).catch(function(e){
  if(e&&e.noApi||e instanceof TypeError){B.enabled=false;B.profile=decorate(demoLoad());return {state:"demo",profile:B.profile}}
  return {state:"anon",profile:null,error:e.message};
 });
};
B.refresh=B.init;
B.signUp=function(username,pw,code){
 return api("/api/register",{username:username,password:pw,code:code||""}).then(function(r){
  B.profile=decorate(r.profile);return {state:state(r.profile),profile:B.profile};
 });
};
B.signIn=function(username,pw){
 return api("/api/login",{username:username,password:pw}).then(function(r){
  B.profile=decorate(r.profile);return {state:state(r.profile),profile:B.profile};
 });
};
B.signOut=function(){
 if(!B.enabled){B.profile=null;return Promise.resolve()}
 return api("/api/logout",{}).then(function(){B.profile=null});
};
function newlyUnlocked(from,to){
 var out=[];
 Data.CATS.forEach(function(c,ci){c.opts.forEach(function(o,oi){
  var L=Data.ATT_LEVEL[ci][oi];if(L>from&&L<=to)out.push({c:ci,o:oi,level:L,name:o.name,cat:c.name});
 })});
 return out;
}
B.newlyUnlocked=newlyUnlocked;
/** Local (demo / split-screen) matches credit XP here; online matches get XP from the server's "end" message. */
B.reportLocal=function(kills,deaths,won){
 var before=B.profile?B.profile.info:Data.levelInfo(0);
 if(B.enabled)return Promise.resolve(null); // never self-report on a real account
 var p=demoLoad();kills=Math.max(0,Math.min(10,kills|0));
 p.xp+=Data.matchXp(kills,won);p.wins+=won?1:0;p.losses+=won?0:1;p.kills+=kills;p.deaths+=deaths|0;
 demoSave(p);decorate(p);B.profile=p;
 return Promise.resolve({gained:p.xp-before.xp,before:before,after:p.info,counted:true});
};
/** Apply an XP result from the server to the cached profile. */
B.applyXp=function(x){
 if(!x||!B.profile)return;
 B.profile.xp=(x.after&&x.after.xp!=null?x.after.xp:B.profile.xp+(x.gained||0));decorate(B.profile);
};
B.saveLoadout=function(lo){
 lo=Data.sanitizeLoadout(lo);
 if(!B.enabled){var p=demoLoad();p.loadout=lo;demoSave(p);B.profile=decorate(p);return Promise.resolve(B.profile)}
 return api("/api/loadout",{loadout:lo}).then(function(r){
  if(B.profile){B.profile.loadout=r.loadout||lo;decorate(B.profile)}return B.profile;
 });
};
B.leaderboard=function(sort,limit){
 if(!B.enabled){var p=demoLoad();return Promise.resolve([{username:p.username,xp:p.xp,wins:p.wins,kills:p.kills,deaths:p.deaths}])}
 return api("/api/leaderboard?sort="+encodeURIComponent(sort||"xp")+"&limit="+(limit||50));
};
B.admin={
 list:function(){return B.enabled?api("/api/admin/users"):Promise.resolve([])},
 setStatus:function(id,status){return api("/api/admin/status",{id:id,status:status})}
};
root.Backend=B;
})(window);
