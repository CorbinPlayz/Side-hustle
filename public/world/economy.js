/** Items, market prices, gear, housing market and the neighbours who move in. All numbers live here so they are easy to balance.
 *  Pacing target: first purchase ~15 min, first plot + cabin around the 1 hour mark. */
export const FISH=[
  {id:"sardine",name:"Sardine",base:9,weight:34,color:0x9bb8d2,belly:0xeaf2f8,len:.6,shape:"slim"},
  {id:"perch",name:"Perch",base:16,weight:26,color:0x6a9a45,belly:0xe8dfa8,len:.7,shape:"deep",stripes:0x3f6a2a},
  {id:"bass",name:"Bass",base:30,weight:18,color:0x56795a,belly:0xe0e8cc,len:.95,shape:"std",stripes:0x34503a},
  {id:"trout",name:"Trout",base:48,weight:11,color:0xb5707a,belly:0xf5dfd3,len:1,shape:"std",spots:0x6b2f3a},
  {id:"puffer",name:"Pufferfish",base:75,weight:6,color:0xd6a65a,belly:0xfff1c8,len:.8,shape:"round"},
  {id:"tuna",name:"Tuna",base:110,weight:4,color:0x2f4f80,belly:0xd2dce8,len:1.5,shape:"torpedo"},
  {id:"koi",name:"Golden Koi",base:320,weight:1,color:0xffb52e,belly:0xfff0b0,len:1.1,shape:"deep",spots:0xff6a2a}
];
/** Things you pick up off the ground or get from trees. `find` says which spawner places them. */
export const GOODS=[
  {id:"shell",name:"Shell",base:3,kind:"find",find:"beach",color:0xf3c9b8},
  {id:"driftwood",name:"Driftwood",base:4,kind:"find",find:"beach",color:0xb59a74},
  {id:"bottle",name:"Old Bottle",base:6,kind:"find",find:"beach",color:0x6fd0a8},
  {id:"can",name:"Tin Can",base:4,kind:"find",find:"junk",color:0xb9bfc7},
  {id:"berries",name:"Wild Berries",base:7,kind:"find",find:"forage",color:0xb02e5e},
  {id:"mushroom",name:"Red Mushroom",base:13,kind:"find",find:"forage",color:0xd8392f},
  {id:"pearl",name:"Pearl",base:110,kind:"rare",find:"beach",color:0xfdf6ff},
  {id:"coin",name:"Old Coin",base:65,kind:"rare",find:"junk",color:0xffc83a},
  {id:"glowcap",name:"Glowcap",base:90,kind:"rare",find:"forage",color:0x4fe8ff},
  {id:"pine_log",name:"Pine Log",base:20,kind:"wood"},
  {id:"oak_log",name:"Oak Log",base:34,kind:"wood"}
];
export const ALL=[...FISH,...GOODS];
export const byId=Object.fromEntries(ALL.map(f=>[f.id,f]));
/** One-off tools. You start with nothing. */
export const TOOLS=[
  {id:"rod",name:"Fishing rod",desc:"Cast at open water and catch fish worth more than anything on the beach.",cost:110},
  {id:"axe",name:"Axe",desc:"Fell trees for logs. Pine and oak both sell.",cost:170}
];
export const UPGRADES=[
  {id:"bag",name:"Bigger bag",desc:"Carry more per trip",costs:[70,230,620,1500],max:4,needs:null},
  {id:"bait",name:"Better bait",desc:"Fish bite sooner and rarer fish show up",costs:[140,420,1000],max:3,needs:"rod"},
  {id:"boots",name:"Quick boots",desc:"Walk and run faster",costs:[120,360,900],max:3,needs:null},
  {id:"axe2",name:"Sharp axe",desc:"Trees fall in fewer chops, extra logs",costs:[260,760],max:2,needs:"axe"}
];
export const BAG_CAP=[4,8,14,22,32];
/** Where the money goes. */
export const GOALS={plot:850,boat:2600};
export const PLOT_COUNT=10;
const KEY="sidehustle.save.v2";
const NAMES=["Maya","Theo","June","Otis","Priya","Leo","Nina","Hank","Sade","Wren"];
const COLORS=[0xe5654a,0x4a8be5,0xe5b84a,0x6bbf5a,0xb36be0,0xe56ba8,0x4ac4c4,0xe58a3c];
export class Economy{
  constructor(rand=Math.random){
    this.rand=rand;this.fresh();
    ALL.forEach(f=>{this.mult[f.id]=.92+rand()*.2;this.prev[f.id]=this.mult[f.id];this.supply[f.id]=0});
    this.load();
  }
  fresh(){
    this.money=0;this.bag=[];this.tools={rod:false,axe:false};this.up={bag:0,bait:0,boots:0,axe2:0};
    this.caught=0;this.earned=0;this.mult={};this.prev={};this.supply={};this.timer=0;
    // housing: price index, neighbours, plots (id -> owner). owner "me", "npc:<n>" or absent.
    this.house={index:1,owners:{},npcs:[],recent:0,sinceNpc:0,log:[]};
    this.pieces=[];this.myPlot=null;this.playSeconds=0;
  }
  get capacity(){return BAG_CAP[this.up.bag]}
  get speedMul(){return 1+this.up.boots*.14}
  price(id){return Math.max(1,Math.round(byId[id].base*this.mult[id]))}
  trend(id){const d=this.mult[id]-this.prev[id];return d>.02?1:d<-.02?-1:0}
  value(f){return Math.max(1,Math.round(this.price(f.id)*(f.w||1)))}
  /** Max neighbours: grows slowly with how rich the players are, never beyond 8. */
  get npcCap(){return Math.min(8,2+Math.floor(this.earned/900))}
  plotPrice(id){
    // each plot is a little different so the nicer ones cost a bit more
    const k=1+((id*37)%10)/50;
    return Math.round(GOALS.plot*this.house.index*k/10)*10;
  }
  /** One market tick (every 18 s): prices drift, neighbours buy goods, housing moves. Returns events to show. */
  tick(dt){
    const ev=[];this.timer+=dt;this.playSeconds+=dt;
    for(const f of ALL)this.supply[f.id]=Math.max(0,this.supply[f.id]-dt*.012);
    if(this.timer<18)return ev;
    this.timer=0;const n=this.house.npcs.length;
    for(const f of ALL){
      this.prev[f.id]=this.mult[f.id];
      // neighbours eat into the supply of everything, so a busy town keeps prices a bit higher
      this.supply[f.id]=Math.max(0,this.supply[f.id]-n*.012);
      const pull=(1-this.mult[f.id])*.18,noise=(this.rand()+this.rand()-1)*.24,bump=this.rand()<.05?(this.rand()<.5?.4:-.28):0;
      this.mult[f.id]=Math.max(.45,Math.min(2.1,this.mult[f.id]+pull+noise+bump-this.supply[f.id]*.5+n*.004));
    }
    const h=this.house;
    // housing market wobbles by itself, and drifts toward what the island earns
    h.index=Math.max(.8,h.index*(1+(this.rand()-.48)*.03));
    h.sinceNpc+=this.earned-(h._lastEarned||0);h._lastEarned=this.earned;
    const need=300+n*420;
    if(n<this.npcCap&&h.sinceNpc>=need){
      const free=[];for(let i=0;i<PLOT_COUNT;i++)if(!h.owners[i])free.push(i);
      // keep at least one plot open for the players
      if(free.length>1){
        const plot=free[(this.rand()*free.length)|0],name=NAMES.find(x=>!h.npcs.some(p=>p.name===x))||"Guest"+n;
        const npc={id:"n"+Date.now().toString(36)+n,name,plot,color:COLORS[n%COLORS.length]};
        h.npcs.push(npc);h.owners[plot]="npc:"+npc.id;h.sinceNpc=0;
        // every sale pushes the next one up harder than the last, but the neighbour cap keeps it from running away
        h.index*=1.09+n*.018;
        ev.push({type:"npc",npc,msg:`${name} bought a plot and moved in. Land prices jumped.`});
      }
    }
    // when nobody is making money, someone may sell up
    else if(n>0&&this.rand()<.04&&this.earned-(h._lastSale||0)<50){
      const k=(this.rand()*n)|0,npc=h.npcs[k];h.npcs.splice(k,1);delete h.owners[npc.plot];h.index=Math.max(.85,h.index*.95);h._lastSale=this.earned;
      ev.push({type:"npcleave",npc,msg:`${npc.name} sold up and left. Land got cheaper.`});
    }
    this.save();ev.push({type:"prices"});return ev;
  }
  addItem(id,w=1){if(this.bag.length>=this.capacity)return false;this.bag.push({id,w});return true}
  addFish(f){if(this.bag.length>=this.capacity)return false;this.bag.push(f);this.caught++;return true}
  sellAll(){
    let total=0;const counts={};
    for(const f of this.bag){total+=this.value(f);counts[f.id]=(counts[f.id]||0)+1}
    for(const id in counts)this.supply[id]+=counts[id]*.05; // flooding the market pushes the price down
    this.money+=total;this.earned+=total;this.recentSale=total;this.bag=[];this.save();return total;
  }
  toolCost(id){const t=TOOLS.find(x=>x.id===id);return this.tools[id]?null:t.cost}
  buyTool(id){const c=this.toolCost(id);if(c==null||this.money<c)return false;this.money-=c;this.tools[id]=true;this.save();return true}
  upgradeCost(id){const u=UPGRADES.find(x=>x.id===id),lv=this.up[id];if(lv>=u.max)return null;return u.costs[lv]}
  canUpgrade(id){const u=UPGRADES.find(x=>x.id===id);return !u.needs||this.tools[u.needs]}
  buy(id){const c=this.upgradeCost(id);if(c==null||this.money<c||!this.canUpgrade(id))return false;this.money-=c;this.up[id]++;this.save();return true}
  buyPlot(id){
    if(this.myPlot!=null||this.house.owners[id])return false;const c=this.plotPrice(id);if(this.money<c)return false;
    this.money-=c;this.myPlot=id;this.house.owners[id]="me";this.save();return true;
  }
  save(){try{localStorage.setItem(KEY,JSON.stringify({v:2,t:Date.now(),money:this.money,bag:this.bag,tools:this.tools,up:this.up,caught:this.caught,earned:this.earned,house:this.house,pieces:this.pieces,myPlot:this.myPlot,playSeconds:this.playSeconds,mult:this.mult,supply:this.supply}));return true}catch(e){return false}}
  load(){try{
    const s=JSON.parse(localStorage.getItem(KEY)||"null");if(!s||s.v!==2)return;
    this.money=s.money|0;this.bag=(s.bag||[]).filter(f=>byId[f.id]);Object.assign(this.tools,s.tools||{});Object.assign(this.up,s.up||{});
    this.caught=s.caught|0;this.earned=s.earned|0;this.pieces=Array.isArray(s.pieces)?s.pieces:[];this.myPlot=s.myPlot==null?null:s.myPlot;this.playSeconds=s.playSeconds||0;
    if(s.house)this.house={...this.house,...s.house};
    for(const id in (s.mult||{}))if(byId[id])this.mult[id]=s.mult[id],this.prev[id]=s.mult[id];
    for(const id in (s.supply||{}))if(byId[id])this.supply[id]=s.supply[id];
    this.loaded=true;
  }catch(e){}}
  reset(){this.fresh();ALL.forEach(f=>{this.mult[f.id]=1;this.prev[f.id]=1;this.supply[f.id]=0});this.save()}
}
/** Pick a species. Better bait shifts weight toward the rare end. */
export function rollFish(baitLevel,rand=Math.random){
  const ws=FISH.map((f,i)=>f.weight*Math.pow(1+baitLevel*.55,i*.5));
  let r=rand()*ws.reduce((a,b)=>a+b,0);
  for(let i=0;i<FISH.length;i++){r-=ws[i];if(r<=0)return FISH[i]}
  return FISH[0];
}
