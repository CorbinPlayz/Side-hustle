/* Hub core: accounts, sessions, approval status, XP, loadouts, leaderboard and admin actions.
   Pure logic over a tiny SQL interface so it runs inside a Durable Object and in Node tests.
   db = { all(sql, ...params) -> rows[], run(sql, ...params) }. */
import Data from "../../public/js/data.js";

const USERNAME_RE=/^[A-Za-z0-9_]{3,16}$/;
const SESSION_MS=30*24*3600*1000;
const MAX_TRIES=5,TRY_WINDOW_MS=10*60*1000;
const MIN_MATCH_SECONDS=45;
const enc=new TextEncoder();

function b64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function b64url(bytes){return b64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function hex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function sha256(s){return hex(await crypto.subtle.digest("SHA-256",enc.encode(s)))}
async function pbkdf2(password,salt){
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:100000},key,256);
  return new Uint8Array(bits);
}
function same(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}
export class HubError extends Error{constructor(message,status){super(message);this.status=status||400}}

export class HubCore{
  constructor(db,opts){
    this.db=db;this.opts=opts||{};
    db.run(`CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL, salt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', is_admin INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
      kills INTEGER NOT NULL DEFAULT 0, deaths INTEGER NOT NULL DEFAULT 0, loadout TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS attempts(name TEXT PRIMARY KEY, n INTEGER NOT NULL, first INTEGER NOT NULL)`);
  }
  now(){return Date.now()}

  profile(u){
    if(!u)return null;
    let lo=[];try{lo=JSON.parse(u.loadout||"[]")}catch(e){lo=[]}
    return {id:u.id,username:u.username,status:u.status,is_admin:!!u.is_admin,xp:u.xp,wins:u.wins,losses:u.losses,kills:u.kills,deaths:u.deaths,loadout:Data.sanitizeLoadout(lo)};
  }
  /** The admin is whichever existing account has the id ADMIN_ID from wrangler.toml. Nobody else can ever be admin. */
  userById(id){
    const u=this.db.all("SELECT * FROM users WHERE id=?",id)[0]||null;
    if(u&&this.opts.adminId&&Number(this.opts.adminId)===u.id)return {...u,is_admin:1,status:"approved"};
    return u;
  }

  async register(username,password,code){
    username=String(username||"");password=String(password||"");
    if(this.opts.signupCode&&String(code||"")!==this.opts.signupCode)throw new HubError("That invite code is not right.",403);
    if(!USERNAME_RE.test(username))throw new HubError("Usernames are 3 to 16 letters, numbers or underscores.");
    if(password.length<8||password.length>72)throw new HubError("Passwords must be 8 to 72 characters.");
    if(this.db.all("SELECT id FROM users WHERE username=?",username).length)throw new HubError("That username is taken.",409);
        const admin=false;
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const hash=await pbkdf2(password,salt);
    this.db.run("INSERT INTO users(username,pass_hash,salt,status,is_admin,created_at) VALUES(?,?,?,?,?,?)",username,b64(hash),b64(salt),admin?"approved":"pending",admin?1:0,this.now());
    return this.login(username,password);
  }

  throttled(name){
    const r=this.db.all("SELECT n,first FROM attempts WHERE name=?",name.toLowerCase())[0];
    if(!r)return false;
    if(this.now()-r.first>TRY_WINDOW_MS){this.db.run("DELETE FROM attempts WHERE name=?",name.toLowerCase());return false}
    return r.n>=MAX_TRIES;
  }
  failed(name){
    const k=name.toLowerCase(),r=this.db.all("SELECT n FROM attempts WHERE name=?",k)[0];
    if(r)this.db.run("UPDATE attempts SET n=n+1 WHERE name=?",k);else this.db.run("INSERT INTO attempts(name,n,first) VALUES(?,1,?)",k,this.now());
  }
  async login(username,password){
    username=String(username||"");password=String(password||"");
    if(username.length>32||password.length>72)throw new HubError("Wrong username or password.",401);
    if(this.throttled(username))throw new HubError("Too many tries. Wait ten minutes and try again.",429);
    const u0=this.db.all("SELECT * FROM users WHERE username=?",username)[0],u=u0&&this.userById(u0.id);
    const salt=u?unb64(u.salt):new Uint8Array(16);
    const hash=await pbkdf2(password,salt);
    if(!u||!same(hash,unb64(u.pass_hash))){this.failed(username);throw new HubError("Wrong username or password.",401)}
    this.db.run("DELETE FROM attempts WHERE name=?",username.toLowerCase());
    this.db.run("DELETE FROM sessions WHERE expires<?",this.now());
    const token=b64url(crypto.getRandomValues(new Uint8Array(32)));
    this.db.run("INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)",await sha256(token),u.id,this.now()+SESSION_MS);
    return {token,profile:this.profile(u)};
  }
  async session(token){
    if(!token||typeof token!=="string"||token.length>80)return null;
    const s=this.db.all("SELECT user_id,expires FROM sessions WHERE token_hash=?",await sha256(token))[0];
    if(!s||s.expires<this.now())return null;
    const u=this.userById(s.user_id);
    if(!u||u.status==="blocked")return u?this.profile(u):null;
    return this.profile(u);
  }
  async logout(token){if(token)this.db.run("DELETE FROM sessions WHERE token_hash=?",await sha256(String(token)))}

  saveLoadout(uid,lo){
    const u=this.userById(uid);
    if(!u||u.status!=="approved")throw new HubError("Account not approved.",403);
    if(!Array.isArray(lo)||lo.length!==8||lo.some(r=>!Array.isArray(r)||r.length!==7||r.some(v=>![-1,0,1,2].includes(v))))throw new HubError("Bad loadout.");
    this.db.run("UPDATE users SET loadout=? WHERE id=?",JSON.stringify(lo),uid);
    return this.profile(this.userById(uid));
  }

  /** Called by the match server with authoritative results. */
  recordMatch(uid,r){
    const u=this.userById(uid);
    if(!u||u.status!=="approved")return null;
    const kills=Math.max(0,Math.min(10,r.kills|0)),deaths=Math.max(0,Math.min(10,r.deaths|0)),won=!!r.won;
    const before=u.xp;
    if((r.seconds||0)<MIN_MATCH_SECONDS)return {gained:0,before,after:before,counted:false};
    const gained=Data.matchXp(kills,won);
    this.db.run("UPDATE users SET xp=xp+?, wins=wins+?, losses=losses+?, kills=kills+?, deaths=deaths+? WHERE id=?",gained,won?1:0,won?0:1,kills,deaths,uid);
    return {gained,before,after:before+gained,counted:true};
  }
  leaderboard(sort,limit){
    const col=sort==="wins"?"wins":(sort==="kills"?"kills":"xp");
    limit=Math.max(1,Math.min(100,limit|0||50));
    return this.db.all(`SELECT username,xp,wins,kills,deaths FROM users WHERE (status='approved' OR id=?) ORDER BY ${col} DESC, xp DESC, username LIMIT ?`,this.opts.adminId|0,limit);
  }

  requireAdmin(id){
    const a=this.userById(id);
    if(!a||!a.is_admin||a.status!=="approved")throw new HubError("Not found.",404);
    return a;
  }
  adminList(actor){
    this.requireAdmin(actor);
    return this.db.all("SELECT id,username,status,is_admin,xp,wins,created_at FROM users ORDER BY created_at DESC").map(r=>this.opts.adminId&&Number(this.opts.adminId)===r.id?{...r,status:"approved",is_admin:true}:{...r,is_admin:!!r.is_admin});
  }
  adminSetStatus(actor,target,status){
    this.requireAdmin(actor);
    if(!["pending","approved","blocked"].includes(status))throw new HubError("Bad status.");
    if(actor===target)throw new HubError("You cannot change your own access.");
    const t=this.userById(target);
    if(!t)throw new HubError("No such player.",404);
    if(t.is_admin)throw new HubError("The admin account cannot be changed here.");
    this.db.run("UPDATE users SET status=? WHERE id=?",status,target);
    if(status==="blocked")this.db.run("DELETE FROM sessions WHERE user_id=?",target);
    return this.profile(this.userById(target));
  }
}
