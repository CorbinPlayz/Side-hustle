/* Match core: one room, two seats, authoritative simulation.
   Pure logic: the Durable Object (or a test) feeds it joins, messages, leaves and time. It never touches the network itself.
   A connection is { id, uid, name, level, att, send(obj), close() } where att comes from the server's own copy of the profile. */
import Sim from "../../public/js/sim.js";
import Data from "../../public/js/data.js";

const STEP=1/60,SNAP_MS=33,MAX_STEPS=6;
const MAPS=Object.keys(Sim.PRESETS),SCORES=[3,5,10],TIMES=[0,180,300,600];
function clamp1(v){v=+v||0;return v>1?1:(v<-1?-1:v)}
function blankInput(){return {f:0,r:0,jump:false,fire:false,fireL:false,reload:false,ads:false,use:false,useL:false,sw:-1,yaw:0,pitch:0}}
const r1=n=>Math.round(n*10)/10;

export class MatchCore{
  /** hooks: { report(uid,result)->Promise<result|null>, random()->[0,1) } */
  constructor(hooks){
    this.hooks=hooks||{};
    this.seats=[null,null];
    this.settings={map:"meadow",scoreLimit:5,timeLimit:300};
    this.phase="lobby";           // lobby | running
    this.M=null;this.inputs=[blankInput(),blankInput()];
    this.acc=0;this.sinceSnap=0;this.elapsed=0;this.netEv=[];this.lastW=["",""];
    this.rate=new Map();
  }
  rand(){return this.hooks.random?this.hooks.random():Math.random()}
  count(){return this.seats.filter(Boolean).length}
  broadcast(obj){for(const s of this.seats)if(s)s.send(obj)}
  lobbyMsg(){
    return {t:"lobby",settings:this.settings,seats:this.seats.map(s=>s?{name:s.name,level:s.level}:null),running:this.phase==="running"};
  }
  sendLobby(){
    this.seats.forEach((s,i)=>{if(s)s.send({...this.lobbyMsg(),you:i})});
  }
  fail(conn,text){conn.send({t:"error",error:text});conn.close()}

  join(conn,create){
    if(create&&this.count()>0)return this.fail(conn,"That room code is already in use. Try again.");
    if(!create&&this.count()===0)return this.fail(conn,"No room with that code. Check it and ask the host to keep the room open.");
    if(this.seats.some(s=>s&&s.uid===conn.uid))return this.fail(conn,"You are already in this room on another tab.");
    if(this.phase==="running")return this.fail(conn,"That match has already started.");
    const i=this.seats[0]?(this.seats[1]?-1:1):0;
    if(i<0)return this.fail(conn,"That room already has two players.");
    this.seats[i]=conn;conn.seat=i;
    this.sendLobby();
  }
  leave(conn){
    const i=this.seats.indexOf(conn);
    if(i<0)return;
    this.seats[i]=null;this.rate.delete(conn.id);
    if(this.phase==="running"){this.finish(i)}
    else if(i===0&&this.seats[1]){this.seats[0]=this.seats[1];this.seats[1]=null;this.seats[0].seat=0}
    this.sendLobby();
  }

  message(conn,m){
    if(!m||typeof m!=="object")return;
    const now=this.nowMs||0,w=this.rate.get(conn.id)||{t:now,n:0};
    if(now-w.t>1000){w.t=now;w.n=0}
    if(++w.n>150){this.rate.set(conn.id,w);return}
    this.rate.set(conn.id,w);
    const seat=conn.seat;
    switch(m.t){
      case"ping":conn.send({t:"pong",ts:m.ts});break;
      case"settings":
        if(seat!==0||this.phase!=="lobby")return;
        if(MAPS.includes(m.map))this.settings.map=m.map;
        if(SCORES.includes(m.scoreLimit|0))this.settings.scoreLimit=m.scoreLimit|0;
        if(TIMES.includes(m.timeLimit|0))this.settings.timeLimit=m.timeLimit|0;
        this.sendLobby();break;
      case"start":
        if(seat!==0||this.phase!=="lobby")return;
        if(this.count()<2){conn.send({t:"notice",text:"Waiting for an opponent."});return}
        this.start();break;
      case"in":{
        if(this.phase!=="running")return;
        const o=this.inputs[seat];
        o.f=clamp1(m.f);o.r=clamp1(m.r);o.jump=!!m.j;o.fire=!!m.fi;o.reload=!!m.rl;o.ads=!!m.ad;o.use=!!m.us;
        if(m.fl)o.fireL=true;
        if(m.ul)o.useL=true;
        if(m.sw===0||m.sw===1||m.sw===2)o.sw=m.sw;
        o.yaw=+m.y||0;o.pitch=+m.p||0;
        if(!isFinite(o.yaw))o.yaw=0;if(!isFinite(o.pitch))o.pitch=0;
        break}
    }
  }

  start(){
    const seed=((this.rand()*1e9)|0)||1;
    const world=Sim.makeWorld(this.settings.map,seed);
    this.M=Sim.createMatch(world,{timeLimit:this.settings.timeLimit,scoreLimit:this.settings.scoreLimit},
      [{att:this.seats[0].att},{att:this.seats[1].att}]);
    this.M.frozen=3;
    this.inputs=[blankInput(),blankInput()];
    this.acc=0;this.sinceSnap=0;this.elapsed=0;this.netEv=[];this.lastW=["",""];
    this.phase="running";
    this.broadcast({t:"start",settings:this.settings,seed,names:this.seats.map(s=>s.name),levels:this.seats.map(s=>s.level)});
  }

  /** Advance real time by dtMs. Call every ~16 ms while a match is running. */
  tick(dtMs){
    this.nowMs=(this.nowMs||0)+dtMs;
    if(this.phase!=="running")return;
    dtMs=Math.min(dtMs,100);
    this.acc+=dtMs/1000;this.sinceSnap+=dtMs;this.elapsed+=dtMs/1000;
    let guard=0;
    while(this.acc>=STEP&&guard++<MAX_STEPS){
      Sim.step(this.M,this.inputs,STEP);
      for(const o of this.inputs){o.fireL=false;o.useL=false;o.sw=-1}
      this.acc-=STEP;
      const ev=this.M.events;
      if(ev.length){for(const e of ev)this.netEv.push(e);ev.length=0}
      if(this.M.over)break;
    }
    if(this.sinceSnap>=SNAP_MS||this.M.over){this.sinceSnap=0;this.snapshot()}
    if(this.M.over)this.finish(-1);
  }

  snapshot(){
    const M=this.M,wmsg=[0,0];
    const msg={t:"s",
      p:M.players.map((p,i)=>{
        const w=Sim.curWeapon(p),k=p.cur+"|"+w.g+"|"+w.r+"|"+JSON.stringify(Sim.packAtt(w.att));
        if(k!==this.lastW[i]){this.lastW[i]=k;wmsg[i]=[w.g,w.r,Sim.packAtt(w.att)]}
        return [r1(p.x),r1(p.y),r1(p.z),Math.round(p.yaw*1000)/1000,Math.round(p.pitch*1000)/1000,
          Math.max(0,Math.round(p.hp)),p.score,p.alive?1:0,w.ammo,p.reloading?1:0,r1(p.speed),
          (p.swimming?1:0)|(p.wading?2:0)|(p.grounded?4:0)];
      }),
      tl:Math.round(M.timeLeft*10)/10,fz:M.frozen>0?Math.round(M.frozen*10)/10:0};
    if(wmsg[0]||wmsg[1])msg.w=wmsg;
    if(this.netEv.length){msg.ev=this.netEv;this.netEv=[]}
    this.broadcast(msg);
    M.players.forEach((p,i)=>{
      if(p.invDirty){
        p.invDirty=false;
        const s=this.seats[i];
        if(s)s.send({t:"inv",s:[Sim.packWeapon(p.slots[0]),Sim.packWeapon(p.slots[1])],c:p.cur});
      }
    });
  }

  /** End the match. leaver = seat index that disconnected, or -1 for a normal finish. */
  finish(leaver){
    if(this.phase!=="running")return;
    const M=this.M,scores=[M.players[0].score,M.players[1].score],seconds=this.elapsed;
    this.phase="lobby";
    const seats=this.seats.slice();
    // the leaver's seat is already empty; keep their account id for the report
    const results=[0,1].map(i=>{
      const won=leaver>=0?i!==leaver:scores[i]>scores[1-i];
      return {kills:scores[i],deaths:scores[1-i],won,seconds};
    });
    const uids=this._uids||[null,null];
    for(let i=0;i<2;i++){
      const conn=seats[i];
      if(!conn)continue;
      const done=xp=>conn.send({t:"end",s:scores,xp:xp||null,left:leaver>=0});
      const p=this.hooks.report?this.hooks.report(conn.uid,results[i]):null;
      Promise.resolve(p).then(done,()=>done(null));
    }
    this.M=null;this.netEv=[];
    this.sendLobby();
  }
}
export {blankInput,Data};
