import {WorldCore} from "../worker/src/worldcore.mjs";
let bad=0;const ok=(c,m)=>{if(!c){console.log("FAIL",m);bad++}};
const mk=(id)=>{const log=[];return {id,uid:id,name:"P"+id,send:o=>log.push(o),close:()=>log.push({closed:1}),log}};
const w=new WorldCore(),cs=[1,2,3,4,5,6,7].map(mk);
cs.forEach(c=>w.join(c));
ok(w.count===6,"max 6 players");ok(cs[6].log.some(m=>m.t==="error"),"7th player rejected");
w.message(1,{t:"pos",x:5,y:1,z:2,yaw:1,tool:0});w.tick(.1);
ok(cs[1].log.some(m=>m.t==="snap"&&m.players.find(p=>p.id===1&&p.x===5)),"positions broadcast");
const before=w.eco.mult.sardine;w.message(1,{t:"sell",loc:"dock",items:Array(20).fill({id:"sardine",w:1})});
ok(cs[0].log.find(m=>m.t==="sold").total>0,"server prices a sale");ok(w.eco.supply.sardine>0,"sale adds supply");
w.message(1,{t:"sell",items:[{id:"nope",w:1}]});ok(cs[0].log.filter(m=>m.t==="sold").pop().total===0,"unknown items ignored");
w.message(2,{t:"plotBuy",plot:3});ok(w.eco.house.owners[3]==="p:2","plot claimed");
w.message(3,{t:"plotBuy",plot:3});ok(w.eco.house.owners[3]==="p:2","plot cannot be stolen");
w.leave(2);ok(!w.eco.house.owners[3],"plot freed when owner leaves");
for(let i=0;i<40;i++)w.tick(1);ok(cs[0].log.some(m=>m.t==="market"),"market updates are pushed");
{ // looks and shared supply
  const w2=new WorldCore(),a=mk(11),b=mk(12);w2.join(a);w2.join(b);
  w2.message(11,{t:"hello",look:{skin:2,hair:3,bad:"x",big:999}});
  ok(b.log.some(m=>m.t==="look"&&m.look.skin===2&&m.look.hair===3&&m.look.bad===undefined&&m.look.big===undefined),"look is sanitised and shared");
  const sup=w2.eco.supply.sardine;w2.message(11,{t:"supply",counts:{sardine:3,nope:5},total:120});
  ok(w2.eco.supply.sardine>sup&&b.log.filter(m=>m.t==="market").length>0,"a sale in one client moves the shared market");
  ok(a.log.find(m=>m.t==="welcome").uid==11,"welcome carries my uid");
  w2.message(11,{t:"plotBuy",plot:1});w2.message(11,{t:"plotBuy",plot:2});
  ok(w2.eco.house.owners[1]==="p:11"&&!w2.eco.house.owners[2],"one plot per player");
  ok(w2.marketState().names["p:11"]==="P11","market state names the owners");
}
console.log(bad?"world tests FAILED":"world tests passed");process.exit(bad?1:0);
