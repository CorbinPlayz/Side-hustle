import {Economy,RECIPES,byId} from "../public/world/economy.js";
import {inLava,ravPoint,RAV} from "../public/world/ravine.js";
import {heightAt} from "../public/world/heightfield.js";
let bad=0;const ok=(c,m)=>{if(!c){console.log("FAIL",m);bad++}};
const e=new Economy(()=>.5);e.reset();
e.money=1000;e.bag=[{id:"shell",w:1},{id:"shell",w:1},{id:"shell",w:1}];
ok(e.craft("necklace"),"craft necklace");ok(e.bag.length===1&&e.bag[0].id==="necklace","crafting consumes inputs");
ok(!e.craft("lamp"),"cannot craft without items");
e.bag=[{id:"coin",w:1},{id:"pearl",w:1}];ok(e.store()===2&&e.stash.length===2&&e.bag.length===0,"chest stores");
const m0=e.money,d=e.die();ok(e.money===m0-Math.floor(m0*.2)&&d.lost===200,"lava costs 20%");ok(e.stash.length===2,"stash survives lava");
ok(e.fetch()===2&&e.bag.length===2,"fetch from chest");
e.bag=[{id:"shell",w:1}];e.die();ok(e.bag.length===0,"lava empties bag");
e.pieces=[{t:"tank",x:0,z:0,r:0},{t:"garden",x:1,z:1,r:0}];ok(e.homeRate===14,"home rate");
e.till=0;e.tick(60);ok(Math.floor(e.till)===14,"till accrues $14/min");ok(e.collectTill()===14&&e.till<1,"collect till");
// neighbours
const n=e.giveRole({id:"a",name:"A"});ok(["buyer","jobs","vendor","trader"].includes(n.role)&&n.wants,"npc gets a role");
const j=e.jobFor(n);ok(j.qty>=2&&j.pay>byId[j.id].base*j.qty,"job pays above market");
e.bag=Array.from({length:j.qty},()=>({id:j.id,w:1}));e.capacity>=j.qty||(e.up.bag=2);ok(e.deliverJob(n)===j.pay,"deliver job");
n.role="buyer";n.wants="beach";e.bag=[{id:"shell",w:1},{id:"driftwood",w:1},{id:"pine_log",w:1}];const r=e.buyerSell(n);ok(r.sold===2&&r.total>=5,"buyer takes only wanted category");
n.role="vendor";n.stock=["tonic"];e.money=100;ok(e.buyPerk(n,"tonic")&&e.perk.tonic>0&&e.speedMul>1.25,"vendor perk");
// ravine geometry
const [x,z]=ravPoint(30,0);ok(inLava(x,z)&&heightAt(x,z)<RAV.Yf+.5,"ravine floor is lava");
const [px,pz]=ravPoint(70,-20);ok(!inLava(px,pz),"outside is safe");
console.log(bad?"economy2 FAILED":"economy2 tests passed");process.exit(bad?1:0);
