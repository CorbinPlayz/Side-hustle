/** Fish, market prices, upgrades and the player's wallet. Prices drift on their own and fall when you flood the market. */
export const FISH=[
  {id:"sardine",name:"Sardine",base:12,weight:34,color:0xaec7da,belly:0xe8f0f6,len:.55,pull:.55},
  {id:"perch",name:"Perch",base:22,weight:26,color:0x6f9a4b,belly:0xe2d8a0,len:.7,pull:.7},
  {id:"bass",name:"Bass",base:40,weight:18,color:0x5e7f5a,belly:0xdfe6c8,len:.95,pull:.9},
  {id:"trout",name:"Trout",base:62,weight:11,color:0xb5707a,belly:0xf1d9cf,len:1,pull:1.05},
  {id:"puffer",name:"Pufferfish",base:95,weight:6,color:0xd6a65a,belly:0xfff1c8,len:.8,pull:1.2,round:true},
  {id:"tuna",name:"Tuna",base:140,weight:4,color:0x34527d,belly:0xcfd9e6,len:1.5,pull:1.45},
  {id:"koi",name:"Golden Koi",base:420,weight:1,color:0xffb52e,belly:0xfff0b0,len:1.1,pull:1.7}
];
export const GOODS=[
  {id:"pine_log",name:"Pine Log",base:16,kind:"wood"},
  {id:"oak_log",name:"Oak Log",base:26,kind:"wood"},
  {id:"mushroom",name:"Red Mushroom",base:30,kind:"forage"},
  {id:"glowcap",name:"Glowcap",base:150,kind:"forage"}
];
export const ALL=[...FISH,...GOODS];
export const byId=Object.fromEntries(ALL.map(f=>[f.id,f]));
const KEY="sidehustle.save.v1";
export const UPGRADES=[
  {id:"rod",name:"Sturdy rod",desc:"Wider sweet spot when reeling",costs:[150,450,1100],max:3},
  {id:"bait",name:"Better bait",desc:"Fish bite sooner, rarer fish show up",costs:[120,380,900],max:3},
  {id:"axe",name:"Sharp axe",desc:"Wider sweet spot and bigger log yield",costs:[140,420,1000],max:3},
  {id:"bag",name:"Bigger bag",desc:"Carry more fish",costs:[100,300,800],max:3}
];
export class Economy{
  constructor(){
    this.money=0;this.bag=[];this.up={rod:0,bait:0,bag:0,axe:0};this.caught=0;this.earned=0;
    this.mult={};this.prev={};this.supply={};this.timer=0;this.day=1;
    ALL.forEach(f=>{this.mult[f.id]=.9+Math.random()*.25;this.prev[f.id]=this.mult[f.id];this.supply[f.id]=0});
    this.load();
  }
  get capacity(){return 8+this.up.bag*6}
  price(id){return Math.max(1,Math.round(byId[id].base*this.mult[id]))}
  trend(id){const d=this.mult[id]-this.prev[id];return d>.02?1:d<-.02?-1:0}
  /** Sale value of one caught fish at the current price; heavier fish pay more. */
  value(f){return Math.max(1,Math.round(this.price(f.id)*f.w))}
  tick(dt){
    this.timer+=dt;
    for(const f of ALL)this.supply[f.id]=Math.max(0,this.supply[f.id]-dt*.012); // market recovers slowly
    if(this.timer>=18){
      this.timer=0;
      for(const f of ALL){
        this.prev[f.id]=this.mult[f.id];
        const pull=(1-this.mult[f.id])*.18,noise=(Math.random()+Math.random()-1)*.28,bump=Math.random()<.06?(Math.random()<.5?.45:-.3):0;
        this.mult[f.id]=Math.max(.45,Math.min(2.2,this.mult[f.id]+pull+noise+bump-this.supply[f.id]*.5));
      }
      this.save();return true;
    }
    return false;
  }
  addItem(id){if(this.bag.length>=this.capacity)return false;this.bag.push({id,w:1});this.save();return true}
  addFish(f){if(this.bag.length>=this.capacity)return false;this.bag.push(f);this.caught++;this.save();return true}
  sellAll(){
    let total=0;const counts={};
    for(const f of this.bag){total+=this.value(f);counts[f.id]=(counts[f.id]||0)+1}
    for(const id in counts)this.supply[id]+=counts[id]*.05; // flooding the market pushes the price down
    this.money+=total;this.earned+=total;this.bag=[];this.save();return total;
  }
  upgradeCost(id){const u=UPGRADES.find(x=>x.id===id),lv=this.up[id];return lv>=u.max?null:u.costs[lv]}
  buy(id){const c=this.upgradeCost(id);if(c==null||this.money<c)return false;this.money-=c;this.up[id]++;this.save();return true}
  save(){try{localStorage.setItem(KEY,JSON.stringify({money:this.money,bag:this.bag,up:this.up,caught:this.caught,earned:this.earned}))}catch(e){}}
  load(){try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s){this.money=s.money|0;this.bag=Array.isArray(s.bag)?s.bag.filter(f=>byId[f.id]):[];Object.assign(this.up,s.up||{});this.caught=s.caught|0;this.earned=s.earned|0}}catch(e){}}
  reset(){this.money=0;this.bag=[];this.up={rod:0,bait:0,bag:0,axe:0};this.caught=0;this.earned=0;this.save()}
}
/** Pick a species. Better bait shifts weight toward the rare end. */
export function rollFish(baitLevel,rand=Math.random){
  const ws=FISH.map((f,i)=>f.weight*Math.pow(1+baitLevel*.55,i*.5));
  let r=rand()*ws.reduce((a,b)=>a+b,0);
  for(let i=0;i<FISH.length;i++){r-=ws[i];if(r<=0)return FISH[i]}
  return FISH[0];
}
