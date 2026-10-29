/* World core (multiplayer foundation, not wired into the Worker yet).
   One room = one island = up to 6 players. The server owns the SHARED parts of the economy: market prices, supply, events,
   housing index, plot owners and neighbours. Each player keeps their own money, bag, tools and building on their own save.
   Pure logic like matchcore.mjs: the Durable Object feeds it joins, messages, leaves and time. */
import {Economy,byId,locMod,PLOT_COUNT} from "../../public/world/economy.js";

export const MAX_PLAYERS=6;
export class WorldCore{
  constructor(hooks={}){
    this.hooks=hooks;this.players=new Map();this.eco=new Economy(hooks.random||Math.random);this.eco.reset();
    this.sinceSnap=0;this.tickAcc=0;
  }
  get count(){return this.players.size}
  broadcast(o,except){for(const p of this.players.values())if(p.id!==except)p.conn.send(o)}
  /** conn: {id, uid, name, look, send(obj), close()} */
  join(conn){
    if(this.players.size>=MAX_PLAYERS){conn.send({t:"error",error:"This island is full (6 players)."});conn.close();return false}
    const p={id:conn.id,uid:conn.uid,name:conn.name,look:conn.look||{},x:0,y:0,z:0,yaw:0,tool:3,conn};
    this.players.set(conn.id,p);
    conn.send({t:"welcome",you:conn.id,uid:conn.uid,market:this.marketState(),players:this.publicPlayers()});
    this.broadcast({t:"joined",p:this.pub(p)},conn.id);return true;
  }
  leave(id){
    const p=this.players.get(id);if(!p)return;this.players.delete(id);
    // a leaving player's plot is released so the island does not fill up with ghosts
    const h=this.eco.house;for(const k in h.owners)if(h.owners[k]==="p:"+p.uid)delete h.owners[k];
    this.broadcast({t:"left",id});
  }
  pub(p){return {id:p.id,name:p.name,look:p.look,x:p.x,y:p.y,z:p.z,yaw:p.yaw,tool:p.tool}}
  publicPlayers(){return [...this.players.values()].map(p=>this.pub(p))}
  marketState(){const e=this.eco,names={};for(const p of this.players.values())names["p:"+p.uid]=p.name;
    return {mult:e.mult,prev:e.prev,supply:e.supply,event:e.event,names,house:{index:e.house.index,owners:e.house.owners,npcs:e.house.npcs}}}
  /** Messages from a player: pos (movement), sell (items + place), plot (claim a plot). Returns nothing; replies go over the connection. */
  message(id,m){
    const p=this.players.get(id);if(!p||!m||typeof m!=="object")return;
    if(m.t==="hello"){ // the player's look: small integers only
      const look={};if(m.look&&typeof m.look==="object")for(const k of Object.keys(m.look).slice(0,16)){const v=m.look[k];if(Number.isInteger(v)&&v>=0&&v<40)look[k]=v}
      p.look=look;this.broadcast({t:"look",id:p.id,look},p.id);return}
    if(m.t==="supply"){ // a player sold things: it moves the shared market and counts as island earnings
      const counts=m.counts&&typeof m.counts==="object"?m.counts:{};let any=false;
      for(const k of Object.keys(counts).slice(0,40)){if(!byId[k])continue;const n=Math.max(0,Math.min(40,+counts[k]||0));this.eco.supply[k]+=n*.07;any=true}
      this.eco.earned+=Math.max(0,Math.min(8000,+m.total||0));
      if(any)this.broadcast({t:"market",market:this.marketState()});return}
    if(m.t==="pos"){p.x=+m.x||0;p.y=+m.y||0;p.z=+m.z||0;p.yaw=+m.yaw||0;p.tool=m.tool|0}
    else if(m.t==="sell"){
      // client sends [{id,w}] and where it sells. The server prices it, so nobody can invent a price.
      const loc=m.loc==="village"?"village":"dock";let total=0;const counts={};
      for(const f of (Array.isArray(m.items)?m.items:[]).slice(0,40)){if(!byId[f.id])continue;const w=Math.max(.1,Math.min(3,+f.w||1));total+=this.eco.value({id:f.id,w},loc);counts[f.id]=(counts[f.id]||0)+1}
      for(const k in counts)this.eco.supply[k]+=counts[k]*.07;this.eco.earned+=total;
      p.conn.send({t:"sold",total});this.broadcast({t:"market",market:this.marketState()});
    }
    else if(m.t==="plot"){
      const i=m.plot|0,h=this.eco.house;
      if(i<0||i>=PLOT_COUNT||h.owners[i]||[...Object.values(h.owners)].includes("p:"+p.uid)){p.conn.send({t:"plotDenied",plot:i});return}
      p.conn.send({t:"plotPrice",plot:i,price:this.eco.plotPrice(i)}); // the client pays from its own wallet then confirms with plotBuy
    }
    else if(m.t==="plotBuy"){
      const i=m.plot|0,h=this.eco.house;if(i<0||i>=PLOT_COUNT||h.owners[i]||Object.values(h.owners).includes("p:"+p.uid)){p.conn.send({t:"plotDenied",plot:i,market:this.marketState()});return}
      h.owners[i]="p:"+p.uid;this.broadcast({t:"market",market:this.marketState()});
    }
  }
  /** Advance time: market tick every 30 s, position snapshots at ~15 Hz. */
  tick(dt){
    this.tickAcc+=dt;this.sinceSnap+=dt;
    const ev=this.eco.tick(dt);for(const e of ev)if(e.type!=="prices")this.broadcast({t:"news",msg:e.msg});
    if(ev.length)this.broadcast({t:"market",market:this.marketState()});
    if(this.sinceSnap>=.066){this.sinceSnap=0;this.broadcast({t:"snap",players:this.publicPlayers()})}
  }
}
