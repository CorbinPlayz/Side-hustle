/** Items, market prices, gear, housing market and the neighbours who move in. All numbers live here so they are easy to balance.
 *  Pacing target: first purchase ~15 min, first plot + cabin around the 1 hour mark. */
export const FISH=[
  {id:"sardine",name:"Sardine",base:7,weight:34,color:0x9bb8d2,belly:0xeaf2f8,len:.6,shape:"slim"},
  {id:"perch",name:"Perch",base:12,weight:26,color:0x6a9a45,belly:0xe8dfa8,len:.7,shape:"deep",stripes:0x3f6a2a},
  {id:"bass",name:"Bass",base:22,weight:18,color:0x56795a,belly:0xe0e8cc,len:.95,shape:"std",stripes:0x34503a},
  {id:"trout",name:"Trout",base:36,weight:11,color:0xb5707a,belly:0xf5dfd3,len:1,shape:"std",spots:0x6b2f3a},
  {id:"puffer",name:"Pufferfish",base:60,weight:6,color:0xd6a65a,belly:0xfff1c8,len:.8,shape:"round"},
  {id:"tuna",name:"Tuna",base:90,weight:4,color:0x2f4f80,belly:0xd2dce8,len:1.5,shape:"torpedo"},
  {id:"koi",name:"Golden Koi",base:260,weight:1,color:0xffb52e,belly:0xfff0b0,len:1.1,shape:"deep",spots:0xff6a2a}
];
/** Things you pick up off the ground or get from trees. `find` says which spawner places them. */
export const GOODS=[
  {id:"shell",name:"Shell",base:2,kind:"find",find:"beach",color:0xf3c9b8},
  {id:"driftwood",name:"Driftwood",base:3,kind:"find",find:"beach",color:0xb59a74},
  {id:"bottle",name:"Old Bottle",base:5,kind:"find",find:"beach",color:0x6fd0a8},
  {id:"can",name:"Tin Can",base:3,kind:"find",find:"junk",color:0xb9bfc7},
  {id:"berries",name:"Wild Berries",base:5,kind:"find",find:"forage",color:0xb02e5e},
  {id:"mushroom",name:"Red Mushroom",base:9,kind:"find",find:"forage",color:0xd8392f},
  {id:"pearl",name:"Pearl",base:90,kind:"rare",find:"beach",color:0xfdf6ff},
  {id:"coin",name:"Old Coin",base:55,kind:"rare",find:"junk",color:0xffc83a},
  {id:"crystal",name:"Cave Crystal",base:120,kind:"rare",find:"junk",color:0x7ad8ff},
  {id:"glowcap",name:"Glowcap",base:70,kind:"rare",find:"forage",color:0x4fe8ff},
  {id:"pine_log",name:"Pine Log",base:14,kind:"wood"},
  {id:"oak_log",name:"Oak Log",base:24,kind:"wood"},
  {id:"necklace",name:"Shell Necklace",base:12,kind:"craft",color:0xf3c9b8},
  {id:"msgbottle",name:"Message in a Bottle",base:20,kind:"craft",color:0x6fd0a8},
  {id:"carving",name:"Wood Carving",base:48,kind:"craft",color:0xb59a74},
  {id:"stew",name:"Forager Stew",base:30,kind:"craft",color:0xd8392f},
  {id:"lamp",name:"Crystal Lamp",base:190,kind:"craft",color:0x7ad8ff}
];
/** Workbench recipes: turn raw finds into something worth about double. */
export const RECIPES=[
  {id:"necklace",needs:{shell:3}},{id:"msgbottle",needs:{bottle:1,driftwood:1}},{id:"carving",needs:{pine_log:2}},
  {id:"stew",needs:{berries:2,mushroom:1}},{id:"lamp",needs:{crystal:1,driftwood:1}}
];
/** Temporary boosts the travelling vendor sells. */
export const PERKS=[
  {id:"lucky",name:"Lucky bait",desc:"Your next 8 casts favour rare fish",cost:90},
  {id:"tonic",name:"Energy tonic",desc:"Run 30% faster for 3 minutes",cost:70},
  {id:"satchel",name:"Roomy satchel",desc:"+4 bag space for 6 minutes",cost:110}
];
export const ROLES=["buyer","jobs","vendor","trader"];
export const ROLE_INFO={buyer:{label:"Buyer",line:"I pay extra for the right goods."},jobs:{label:"Job giver",line:"I need a hand with something."},vendor:{label:"Vendor",line:"Rare odds and ends, today only."},trader:{label:"Trader",line:"I move the market. Ask me what's hot."}};
const JOB_ITEMS=["shell","driftwood","bottle","can","berries","mushroom","pine_log","oak_log","sardine","perch","bass"];
export const ALL=[...FISH,...GOODS];
export const byId=Object.fromEntries(ALL.map(f=>[f.id,f]));
/** One-off tools. You start with nothing. */
export const TOOLS=[
  {id:"rod",name:"Fishing rod",desc:"Cast at open water and catch fish worth more than anything on the beach.",cost:140},
  {id:"axe",name:"Axe",desc:"Fell trees for logs. Pine and oak both sell.",cost:210}
];
export const UPGRADES=[
  {id:"bag",name:"Bigger bag",desc:"Carry more per trip",costs:[90,260,640,1500],max:4,needs:null},
  {id:"bait",name:"Better bait",desc:"Fish bite sooner and rarer fish show up",costs:[140,420,1000],max:3,needs:"rod"},
  {id:"boots",name:"Quick boots",desc:"Walk and run faster",costs:[120,360,900],max:3,needs:null},
  {id:"axe2",name:"Sharp axe",desc:"Trees fall in fewer chops, extra logs",costs:[260,760],max:2,needs:"axe"}
];
export const BAG_CAP=[4,6,9,13,18];
/** Where the money goes. */
export const GOALS={plot:1200,boat:4200};
export const PLOT_COUNT=10;
export const catOf=id=>{const g=byId[id];if(!g)return "fish";if(g.kind==="wood")return "wood";if(g.kind==="craft")return "craft";if(!g.kind)return "fish";return g.find==="forage"?"forage":g.find==="junk"?"junk":"beach"};
export const CATS={
  fish:{label:"fish",up:"Fish festival in town! Fish prices are up for a while.",down:"A fish glut: prices for fish are down for a while."},
  wood:{label:"logs",up:"A big building project means logs are in demand.",down:"Too much timber around: log prices are down."},
  forage:{label:"forage",up:"Everyone wants a good stew. Berries and mushrooms are up.",down:"Foragers flooded the market: berries and mushrooms are down."},
  craft:{label:"crafted goods",up:"Collectors are paying well for handmade goods.",down:"Handmade goods are a drug on the market this week."},
  beach:{label:"beach finds",up:"Tourists are in. Shells and bottles are selling high.",down:"Quiet week for tourists. Beach finds are down."}
};
/** Where you sell changes the price: the village pays extra for wood and forage but less for fish. */
export const LOCATIONS={dock:{name:"Dock Market",fish:1.1,wood:1,forage:1,beach:1,junk:1,craft:1.05},village:{name:"Village Market",fish:.8,wood:1.3,forage:1.25,beach:.95,junk:1.15,craft:1.12}};
export const locMod=(id,loc)=>(LOCATIONS[loc]||LOCATIONS.dock)[catOf(id)];
export const OUTFITS=["baker","fisher","lumberjack","sailor","keeper","villager","farmer"];
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
    this.house={index:1,owners:{},npcs:[],recent:0,sinceNpc:0,log:[]};this.event=null;this.nextEvent=6;
    this.pieces=[];this.myPlot=null;this.playSeconds=0;this.stash=[];this.till=0;this.perk={lucky:0,tonic:0,satchel:0};this.deaths=0;
  }
  get capacity(){return BAG_CAP[this.up.bag]+(this.perk.satchel>0?4:0)}
  get speedMul(){return (1+this.up.boots*.14)*(this.perk.tonic>0?1.3:1)}
  /** $ per minute the fish tanks and gardens in your house earn while you play. */
  get homeRate(){const c=t=>this.pieces.filter(p=>p.t===t).length;return Math.min(c("tank"),4)*8+Math.min(c("garden"),4)*6}
  price(id,loc="dock"){return Math.max(1,Math.round(byId[id].base*this.mult[id]*locMod(id,loc)))}
  trend(id){const d=this.mult[id]-this.prev[id];return d>.012?1:d<-.012?-1:0}
  value(f,loc="dock"){return Math.max(1,Math.round(this.price(f.id,loc)*(f.w||1)))}
  /** Max neighbours: grows slowly with how rich the players are, never beyond 8. */
  get npcCap(){return Math.min(8,2+Math.floor(this.earned/900))}
  plotPrice(id){
    // each plot is a little different so the nicer ones cost a bit more
    const k=1+((id*37)%10)/50;
    return Math.round(GOALS.plot*this.house.index*k/10)*10;
  }
  /** One market tick (every 30 s). Prices follow slow, readable rules: they ease back to normal, drop when you flood a
   *  good, drift up when neighbours buy, and occasionally a town event pushes a whole category up or down for a few minutes. */
  tick(dt){
    const ev=[];this.timer+=dt;this.playSeconds+=dt;
    for(const k of ["tonic","satchel"])if(this.perk[k]>0)this.perk[k]=Math.max(0,this.perk[k]-dt);
    this.till=Math.min(this.homeRate*25,this.till+this.homeRate*dt/60);
    for(const f of ALL)this.supply[f.id]=Math.max(0,this.supply[f.id]-dt*.008);
    if(this.timer<30)return ev;
    this.timer=0;const n=this.house.npcs.length;
    // town events
    const E=this.event;
    if(E&&--E.left<=0){ev.push({type:"event",msg:`Prices for ${CATS[E.cat].label} are back to normal.`});this.event=null}
    else if(!E&&--this.nextEvent<=0){
      const cat=Object.keys(CATS)[(this.rand()*Object.keys(CATS).length)|0],up=this.rand()<.55;
      this.event={cat,mod:up?.3:-.25,left:8};this.nextEvent=14+((this.rand()*10)|0);
      ev.push({type:"event",msg:up?CATS[cat].up:CATS[cat].down});
    }
    for(const f of ALL){
      this.prev[f.id]=this.mult[f.id];
      this.supply[f.id]=Math.max(0,this.supply[f.id]-n*.01);
      let mv=0;for(const q of this.house.npcs)if(q.role==="trader"){const c=catOf(f.id);if(c===q.wants)mv+=.07;else if(c===q.dumps)mv-=.05}
      const target=1+(this.event&&catOf(f.id)===this.event.cat?this.event.mod:0)+n*.012+mv-this.supply[f.id]*.6;
      const step=(target-this.mult[f.id])*.22+(this.rand()-.5)*.03;
      this.mult[f.id]=Math.max(.55,Math.min(1.7,this.mult[f.id]+step));
    }
    const h=this.house;
    // housing market wobbles by itself, and drifts toward what the island earns
    h.index=Math.max(.8,h.index*(1+(this.rand()-.48)*.03));
    h.sinceNpc+=this.earned-(h._lastEarned||0);h._lastEarned=this.earned;
    const need=500+n*650;
    if(n<this.npcCap&&h.sinceNpc>=need){
      const free=[];for(let i=0;i<PLOT_COUNT;i++)if(!h.owners[i])free.push(i);
      // keep at least one plot open for the players
      if(free.length>1){
        const plot=free[(this.rand()*free.length)|0],name=NAMES.find(x=>!h.npcs.some(p=>p.name===x))||"Guest"+n;
        const npc={id:"n"+Date.now().toString(36)+n,name,plot,color:COLORS[n%COLORS.length],outfit:OUTFITS[(this.house.npcs.length+((this.rand()*3)|0))%OUTFITS.length],look:(this.rand()*1000)|0};
        this.giveRole(npc);h.npcs.push(npc);h.owners[plot]="npc:"+npc.id;h.sinceNpc=0;
        // every sale pushes the next one up harder than the last, but the neighbour cap keeps it from running away
        h.index*=1.07+n*.012;
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
  /** Every neighbour has a job in town: buyer, job giver, vendor or trader. Spread them out so all four turn up. */
  giveRole(npc){
    if(!npc.role){const count=r=>this.house.npcs.filter(q=>q.role===r).length;npc.role=[...ROLES].sort((a,b)=>count(a)-count(b))[0]}
    const cats=Object.keys(CATS);
    if(!npc.wants)npc.wants=cats[(this.rand()*cats.length)|0];
    if(!npc.dumps)npc.dumps=cats.filter(c=>c!==npc.wants)[(this.rand()*(cats.length-1))|0];
    if(npc.role==="vendor"&&!npc.stock)npc.stock=PERKS.map(p=>p.id).sort(()=>this.rand()-.5).slice(0,2);
    return npc;
  }
  count(id){return this.bag.filter(f=>f.id===id).length}
  /** ---- workbench */
  canCraft(r){return Object.entries(r.needs).every(([id,n])=>this.count(id)>=n)}
  craft(id){const r=RECIPES.find(x=>x.id===id);if(!r||!this.canCraft(r))return false;
    let net=1-Object.values(r.needs).reduce((a,b)=>a+b,0);if(this.bag.length+net>this.capacity)return false;
    for(const [it,n] of Object.entries(r.needs))for(let i=0;i<n;i++)this.bag.splice(this.bag.findIndex(f=>f.id===it),1);
    this.bag.push({id:r.id,w:1});this.save();return true}
  /** ---- chest: safe from lava */
  store(){let n=0;while(this.bag.length&&this.stash.length<40){this.stash.push(this.bag.shift());n++}this.save();return n}
  fetch(){let n=0;while(this.stash.length&&this.bag.length<this.capacity){this.bag.push(this.stash.shift());n++}this.save();return n}
  collectTill(){const t=Math.floor(this.till);if(t<1)return 0;this.till-=t;this.money+=t;this.earned+=t;this.save();return t}
  /** ---- neighbours */
  buyerSell(npc){let total=0;const keep=[];for(const f of this.bag){if(catOf(f.id)===npc.wants){total+=Math.round(this.value(f,"dock")*1.3);this.supply[f.id]+=.03}else keep.push(f)}
    const sold=this.bag.length-keep.length;this.bag=keep;this.money+=total;this.earned+=total;this.save();return {total,sold}}
  jobFor(npc){if(!npc.job){const id=JOB_ITEMS[(this.rand()*JOB_ITEMS.length)|0],qty=2+((this.rand()*3)|0);npc.job={id,qty,pay:Math.round(byId[id].base*qty*2.2/5)*5+10}}return npc.job}
  deliverJob(npc){const j=this.jobFor(npc);if(this.count(j.id)<j.qty)return false;
    for(let i=0;i<j.qty;i++)this.bag.splice(this.bag.findIndex(f=>f.id===j.id),1);
    this.money+=j.pay;this.earned+=j.pay;npc.job=null;this.save();return j.pay}
  buyPerk(npc,id){const p=PERKS.find(x=>x.id===id);if(!p||!(npc.stock||[]).includes(id)||this.money<p.cost)return false;
    this.money-=p.cost;if(id==="lucky")this.perk.lucky=8;else if(id==="tonic")this.perk.tonic=180;else this.perk.satchel=360;
    npc.stock=npc.stock.filter(x=>x!==id);this.save();return true}
  tips(){const rows=ALL.map(f=>({id:f.id,name:f.name,m:this.mult[f.id]})).sort((a,b)=>b.m-a.m);return {hot:rows.slice(0,3),cold:rows.slice(-3).reverse()}}
  addItem(id,w=1){if(this.bag.length>=this.capacity)return false;this.bag.push({id,w});return true}
  addFish(f){if(this.bag.length>=this.capacity)return false;this.bag.push(f);this.caught++;return true}
  sellAll(loc="dock"){
    let total=0;const counts={};
    for(const f of this.bag){total+=this.value(f,loc);counts[f.id]=(counts[f.id]||0)+1}
    for(const id in counts)this.supply[id]+=counts[id]*.07; // flooding the market pushes the price down
    this.money+=total;this.earned+=total;this.recentSale=total;this.bag=[];this.save();return total;
  }
  toolCost(id){const t=TOOLS.find(x=>x.id===id);return this.tools[id]?null:t.cost}
  /** Falling in lava: lose a fifth of your money and everything in the bag. */
  die(){const lost=Math.floor(this.money*.2),bagN=this.bag.length;this.money-=lost;this.bag=[];this.deaths=(this.deaths|0)+1;this.save();return {lost,bagN}}
  buyTool(id){const c=this.toolCost(id);if(c==null||this.money<c)return false;this.money-=c;this.tools[id]=true;this.save();return true}
  upgradeCost(id){const u=UPGRADES.find(x=>x.id===id),lv=this.up[id];if(lv>=u.max)return null;return u.costs[lv]}
  canUpgrade(id){const u=UPGRADES.find(x=>x.id===id);return !u.needs||this.tools[u.needs]}
  buy(id){const c=this.upgradeCost(id);if(c==null||this.money<c||!this.canUpgrade(id))return false;this.money-=c;this.up[id]++;this.save();return true}
  buyPlot(id){
    if(this.myPlot!=null||this.house.owners[id])return false;const c=this.plotPrice(id);if(this.money<c)return false;
    this.money-=c;this.myPlot=id;this.house.owners[id]="me";this.save();return true;
  }
  save(){try{localStorage.setItem(KEY,JSON.stringify({v:2,t:Date.now(),money:this.money,event:this.event,nextEvent:this.nextEvent,bag:this.bag,tools:this.tools,up:this.up,caught:this.caught,earned:this.earned,house:this.house,pieces:this.pieces,myPlot:this.myPlot,stash:this.stash,till:this.till,perk:this.perk,deaths:this.deaths,playSeconds:this.playSeconds,mult:this.mult,supply:this.supply}));return true}catch(e){return false}}
  load(){try{
    const s=JSON.parse(localStorage.getItem(KEY)||"null");if(!s||s.v!==2)return;
    this.money=s.money|0;this.bag=(s.bag||[]).filter(f=>byId[f.id]);Object.assign(this.tools,s.tools||{});Object.assign(this.up,s.up||{});
    this.caught=s.caught|0;this.earned=s.earned|0;this.pieces=Array.isArray(s.pieces)?s.pieces:[];this.myPlot=s.myPlot==null?null:s.myPlot;this.playSeconds=s.playSeconds||0;
    if(s.house)this.house={...this.house,...s.house};
    for(const id in (s.mult||{}))if(byId[id])this.mult[id]=s.mult[id],this.prev[id]=s.mult[id];
    for(const id in (s.supply||{}))if(byId[id])this.supply[id]=s.supply[id];
    this.stash=(s.stash||[]).filter(f=>byId[f.id]);this.till=s.till||0;Object.assign(this.perk,s.perk||{});this.deaths=s.deaths|0;
    this.house.npcs.forEach(n=>this.giveRole(n));
    this.event=s.event||null;if(s.nextEvent)this.nextEvent=s.nextEvent;this.loaded=true;
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
