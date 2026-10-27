import {ALL,UPGRADES,TOOLS,GOALS,LOCATIONS,CATS,byId} from "./economy.js";
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Alegreya:wght@500;700&family=Alegreya+Sans:wght@400;500;700&display=swap');
#hud{position:fixed;inset:0;pointer-events:none;font-family:'Alegreya Sans',system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.55)}
#hud *{box-sizing:border-box}
.hbox{border:2px solid #f08a3c;background:rgba(32,52,84,.82);border-radius:6px;padding:8px 12px;max-width:340px;font-size:17px;line-height:1.3}
.hbox h4{margin:0 0 2px;font:700 19px 'Alegreya',serif;color:#ff9a4d}
#hint{position:absolute;left:14px;top:14px;transition:opacity .4s}
#money{position:absolute;left:18px;bottom:20px;display:flex;flex-direction:column;gap:6px}
#money b{display:inline-block;font:700 26px 'Alegreya',serif;border:2px solid #fff;border-radius:4px;padding:2px 10px;background:rgba(10,20,40,.35);width:max-content;min-width:64px;transition:transform .15s}
#money b.pop{transform:scale(1.18)}
#money span{font-size:15px;opacity:.9}
#bar{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:10px}
.slot{width:72px;height:72px;border:2px solid rgba(255,255,255,.25);border-radius:6px;background:rgba(10,20,40,.35);position:relative;display:flex;align-items:center;justify-content:center;font-size:13px}
.slot i{position:absolute;left:6px;top:2px;font-style:normal;font-size:14px;opacity:.8}
.slot.sel{border-color:#fff;background:rgba(40,70,120,.5)}
.slot em{font-style:normal;position:absolute;bottom:-20px;width:100%;text-align:center;font-size:14px}
.slot svg{width:52px;height:52px}
#cross{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);opacity:.85}
#prompt{position:absolute;left:50%;top:62%;transform:translateX(-50%);text-align:center;font-size:20px;display:none}
#bite{position:absolute;left:50%;top:36%;transform:translateX(-50%);font:700 64px 'Alegreya',serif;color:#ffd23a;display:none;animation:bump .25s ease-out infinite alternate}
@keyframes bump{from{transform:translateX(-50%) scale(.95)}to{transform:translateX(-50%) scale(1.12)}}
#reel{position:absolute;left:50%;bottom:130px;transform:translateX(-50%);width:min(420px,80vw);display:none}
#reel .name{text-align:center;font:700 20px 'Alegreya',serif;margin-bottom:6px}
.track{position:relative;height:22px;border:2px solid #fff;border-radius:4px;background:rgba(10,20,40,.55);overflow:hidden}
.zone{position:absolute;top:0;bottom:0;background:rgba(95,220,120,.75)}
.mark{position:absolute;top:-2px;bottom:-2px;width:6px;margin-left:-3px;background:#fff;box-shadow:0 0 6px #fff}
.prog{height:8px;margin-top:6px;border:2px solid #fff;border-radius:4px;background:rgba(10,20,40,.55);overflow:hidden}
.prog i{display:block;height:100%;width:0;background:#ffd23a}
#chop{position:absolute;left:50%;bottom:130px;transform:translateX(-50%);width:min(360px,76vw);display:none;text-align:center}
#chop .name{font:700 20px 'Alegreya',serif;margin-bottom:6px}
#chop small{display:block;margin-top:6px;font-size:15px}
#reel small{display:block;text-align:center;margin-top:6px;font-size:15px;opacity:.9}
#toasts{position:absolute;right:16px;top:16px;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.toast{background:rgba(10,20,40,.7);border:1px solid rgba(255,255,255,.4);border-radius:5px;padding:5px 12px;font-size:17px;animation:tin .25s both}
@keyframes tin{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
#market{position:fixed;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;background:rgba(5,15,30,.45)}
#market .panel{width:min(760px,94vw);max-height:92vh;overflow:auto;background:rgba(24,40,68,.96);border:2px solid #f08a3c;border-radius:8px;padding:18px 20px;text-shadow:none}
#market h2{margin:0 0 4px;font:700 28px 'Alegreya',serif;color:#ff9a4d}
#market .sub{opacity:.8;margin-bottom:12px}
#market .cols{display:grid;grid-template-columns:1.25fr 1fr;gap:20px}
@media(max-width:640px){#market .cols{grid-template-columns:1fr}}
#market table{width:100%;border-collapse:collapse;font-size:16px}
#market td{padding:3px 6px}
#market td{padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.12)}
#market td:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums}
.up{color:#6ee08a}.down{color:#ff7b6b}.flat{color:#aab}
#market button{font:700 17px 'Alegreya Sans',sans-serif;border:2px solid #f08a3c;background:#2c4b7a;color:#fff;border-radius:5px;padding:7px 12px;cursor:pointer}
#market button:disabled{opacity:.45;cursor:not-allowed}
#market button:hover:not(:disabled){background:#3b6197}
.urow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.12)}
.urow div small{display:block;opacity:.75;font-size:14px}
#bpanel{position:absolute;right:14px;top:70px;width:210px;display:none;background:rgba(32,52,84,.85);border:2px solid #f08a3c;border-radius:6px;padding:8px 10px;font-size:16px}
#bpanel .row{display:flex;justify-content:space-between;padding:2px 6px;border-radius:3px}
#bpanel .row.sel{background:#f08a3c;color:#1b2740;text-shadow:none;font-weight:700}
#bpanel small{display:block;opacity:.85;margin-top:6px;line-height:1.3;font-size:14px}
#saved{position:absolute;right:16px;bottom:14px;font-size:14px;opacity:0;transition:opacity .5s}
#fade{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .3s}
`;
const ICON={
  rod:`<svg viewBox="0 0 52 52"><path d="M8 46 L40 8" stroke="#c9d6e6" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="38" r="5" fill="#8fa3bb"/><path d="M40 8 q8 12 2 30" stroke="#e8f0ff" stroke-width="1.5" fill="none"/></svg>`,
  axe:`<svg viewBox="0 0 52 52"><path d="M12 44 L36 12" stroke="#c9a46a" stroke-width="4" stroke-linecap="round"/><path d="M30 8 q14 2 14 14 q-8 -2 -14 6z" fill="#cfd8e3"/></svg>`,
  build:`<svg viewBox="0 0 52 52"><path d="M8 26 L26 10 L44 26" stroke="#f08a3c" stroke-width="4" fill="none" stroke-linejoin="round"/><rect x="13" y="26" width="26" height="16" fill="#c9a46a"/><rect x="22" y="31" width="8" height="11" fill="#6b4a26"/></svg>`,
  bait:`<svg viewBox="0 0 52 52"><path d="M12 36 q14 -26 30 -14 q-6 20 -30 14z" fill="#6fd070"/><path d="M12 36 l-6 6" stroke="#6fd070" stroke-width="3"/></svg>`
};
export function createHud(){
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  const root=document.createElement("div");root.id="hud";
  root.innerHTML=`<div id="hint" class="hbox"></div><div id="toasts"></div><div id="cross"></div>
  <div id="bite">!</div><div id="chop"><div class="name" id="cName">Chop</div><div class="prog"><i id="cProg"></i></div><small id="cHits"></small></div><div id="prompt" class="hbox"></div>
  <div id="reel"><div class="name" id="rName"></div><div class="track"><div class="zone" id="rZone"></div><div class="mark" id="rMark"></div></div><div class="prog"><i id="rProg"></i></div><small>Hold the mouse to reel. Let go to ease off. Keep the marker in the green.</small></div>
  <div id="money"><b id="mMoney">$0</b><span id="mBag"></span></div>
  <div id="bar"></div><div id="bpanel"></div><div id="saved">Progress saved</div>`;
  document.body.appendChild(root);
  const market=document.createElement("div");market.id="market";document.body.appendChild(market);
  const fade=document.createElement("div");fade.id="fade";document.body.appendChild(fade);
  const $=id=>root.querySelector("#"+id);
  const bar=$("bar");
  const SLOT={0:["Rod",ICON.rod],1:["Axe",ICON.axe],2:["Build",ICON.build],3:["Hands",""]};
  let slotKey="",selTool=3;
  let hintT=0,lastMoney=0;
  const api={
    hint(text,title){const h=$("hint");h.style.opacity=text?1:0;h.innerHTML=(title?`<h4>${title}</h4>`:"")+(text||"")},
    money(n,bag,cap){const b=$("mMoney");b.textContent="$"+n.toLocaleString();if(n!==lastMoney){b.classList.add("pop");setTimeout(()=>b.classList.remove("pop"),180);lastMoney=n}$("mBag").textContent=`Bag ${bag}/${cap}`},
    toast(t,color){const d=document.createElement("div");d.className="toast";d.textContent=t;if(color)d.style.borderColor=color;$("toasts").appendChild(d);while($("toasts").children.length>4)$("toasts").firstChild.remove();setTimeout(()=>d.remove(),3600)},
    prompt(t){const p=$("prompt");p.style.display=t?"block":"none";if(t)p.textContent=t},
    bite(on){$("bite").style.display=on?"block":"none"},
    reel(on,o){const r=$("reel");r.style.display=on?"block":"none";if(!on)return;
      $("rName").textContent=o.name;$("rZone").style.left=(o.lo*100)+"%";$("rZone").style.width=((o.hi-o.lo)*100)+"%";$("rMark").style.left=(o.tension*100)+"%";$("rProg").style.width=(o.progress*100)+"%"},
    chop(on,o){const c=$("chop");c.style.display=on?"block":"none";if(!on)return;$("cName").textContent=o.name;$("cProg").style.width=(o.pos*100)+"%";$("cHits").textContent=o.text},
    buildPanel(o){const p=$("bpanel");if(!o){p.style.display="none";return}p.style.display="block";
      p.innerHTML=o.list.map(r=>`<div class="row${r.sel?" sel":""}"><span>${r.name}</span><span>$${r.cost}</span></div>`).join("")+`<small>Click: place &nbsp; Right-click: remove<br>Scroll or [ ]: change piece<br>R: rotate &nbsp; G: snap is <b>${o.snap?"ON":"OFF"}</b></small>`},
    saved(){const e=$("saved");e.style.opacity=.9;clearTimeout(api._st);api._st=setTimeout(()=>e.style.opacity=0,1400)},
    /** Only show tools you actually have. list = tool ids in key order (1, 2, 3...). */
    slots(list,sel){const key=list.join(",")+"|"+sel;if(key===slotKey)return;slotKey=key;
      bar.innerHTML=list.map((t,i)=>`<div class="slot${t===sel?" sel":""}"><i>${i+1}</i>${SLOT[t][1]}<em>${SLOT[t][0]}</em></div>`).join("")},
    select(i){selTool=i},
    flash(){fade.style.opacity=.35;setTimeout(()=>fade.style.opacity=0,60)},
    marketOpen:false,
    openMarket(eco,onChange,loc="dock"){
      api.marketOpen=true;market.style.display="flex";
      const draw=()=>{
        const rows=ALL.map(f=>{const t=eco.trend(f.id),n=eco.bag.filter(x=>x.id===f.id).length;
          return `<tr><td>${f.name}</td><td>$${eco.price(f.id,loc)}</td><td class="${t>0?"up":t<0?"down":"flat"}">${t>0?"▲":t<0?"▼":"–"}</td><td>${n?"x"+n:""}</td></tr>`}).join("");
        const total=eco.bag.reduce((a,f)=>a+eco.value(f,loc),0);
        const tools=TOOLS.map(t=>{const c=eco.toolCost(t.id);return `<div class="urow"><div><b>${t.name}</b><small>${t.desc}</small></div><button data-tool="${t.id}" ${c==null||eco.money<c?"disabled":""}>${c==null?"Owned":"$"+c}</button></div>`}).join("");
        const ups=UPGRADES.map(u=>{const c=eco.upgradeCost(u.id),ok=eco.canUpgrade(u.id);
          return `<div class="urow"><div><b>${u.name}</b> (${eco.up[u.id]}/${u.max})<small>${ok?u.desc:"Needs the "+(u.needs==="rod"?"fishing rod":"axe")}</small></div><button data-up="${u.id}" ${c==null||eco.money<c||!ok?"disabled":""}>${c==null?"Maxed":"$"+c}</button></div>`}).join("");
        const goals=`<div class="urow"><div><b>House plot</b><small>${eco.myPlot!=null?"You own plot "+(eco.myPlot+1)+". Press B to build.":"Look for a FOR SALE sign. Prices rise as neighbours move in: now about $"+eco.plotPrice(0).toLocaleString()}</small></div><span>${eco.myPlot!=null?"Owned":""}</span></div><div class="urow"><div><b>Boat</b><small>Opens the next island. Coming soon.</small></div><span>$${GOALS.boat.toLocaleString()}</span></div>`;
        market.innerHTML=`<div class="panel"><h2>${LOCATIONS[loc].name}</h2><div class="sub">${eco.event?"<b style=\"color:#ffd23a\">News:</b> "+(eco.event.mod>0?CATS[eco.event.cat].up:CATS[eco.event.cat].down)+"<br>":""}Prices ease back to normal and drop when you flood the market with one thing. ${loc==="village"?"The village pays extra for logs and forage, less for fish. ":"The dock pays a bit extra for fish. "}You have $${eco.money.toLocaleString()}.</div>
        <div class="cols"><div><table>${rows}</table><p style="margin:12px 0 0"><button id="sellAll" ${eco.bag.length?"":"disabled"}>Sell all (${eco.bag.length}) for $${total}</button></p></div>
        <div><h3 style="margin:0 0 6px;font:700 20px Alegreya,serif">Tools</h3>${tools}<h3 style="margin:12px 0 6px;font:700 20px Alegreya,serif">Upgrades</h3>${ups}<h3 style="margin:12px 0 6px;font:700 20px Alegreya,serif">Goals</h3>${goals}</div></div>
        <p style="margin:14px 0 0;text-align:right"><button id="mClose">Close (E)</button></p></div>`;
        market.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{if(eco.buyTool(b.dataset.tool)){onChange("bought",b.dataset.tool);draw()}});
        market.querySelector("#sellAll").onclick=()=>{const t=eco.sellAll(loc);onChange("sold",t);draw()};
        market.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{if(eco.buy(b.dataset.up)){onChange("bought",b.dataset.up);draw()}});
        market.querySelector("#mClose").onclick=api.closeMarket;
      };
      draw();api._redraw=draw;
    },
    /** Simple talk/use panel. build() returns {title,sub,rows:[{t,small,btn,off,act}]} and is re-run after every click. */
    dialog(build){
      api.marketOpen=true;market.style.display="flex";
      const draw=()=>{const s=build();
        market.innerHTML=`<div class="panel" style="width:min(520px,94vw)"><h2>${s.title}</h2><div class="sub">${s.sub||""}</div>${s.rows.map((r,i)=>`<div class="urow"><div><b>${r.t}</b><small>${r.small||""}</small></div>${r.btn?`<button data-r="${i}" ${r.off?"disabled":""}>${r.btn}</button>`:""}</div>`).join("")}<p style="margin:14px 0 0;text-align:right"><button id="dClose">Close (E)</button></p></div>`;
        market.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{s.rows[+b.dataset.r].act();draw()});
        market.querySelector("#dClose").onclick=api.closeMarket};
      draw();api._redraw=draw},
    closeMarket(){api.marketOpen=false;market.style.display="none"}
  };
  return api;
}
