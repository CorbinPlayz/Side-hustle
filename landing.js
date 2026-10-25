/* Landing page: renders the arsenal, attachment and rarity tables straight from data.js so the numbers always match the game. */
(function(){
"use strict";
var D=window.Data,$=function(i){return document.getElementById(i)};
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}

/* hero readout */
(function(){
 var rows=[["map",'<span class="v">180 x 180 m</span> <span class="k">2 presets</span>'],
  ["guns",'<span class="v">'+D.GUNS.length+'</span> <span class="k">pistol to LMG</span>'],
  ["attach",'<span class="v">'+D.CATS.length+' x 3</span> <span class="k">categories x options</span>'],
  ["rarity",'<span class="c">'+D.RARITY.map(function(r){return r.name.toLowerCase()}).join(" / ")+'</span>'],
  ["netcode",'<span class="h">webrtc</span> <span class="k">host-authoritative</span>'],
  ["tracking",'<span class="g">none</span>']];
 $("readout").innerHTML='<span class="k">$</span> <span class="v">duel-arena --info</span>\n'+rows.map(function(r){return '<span class="k">'+(r[0]+"          ").slice(0,10)+'</span>'+r[1]}).join("\n");
})();

/* arsenal */
(function(){
 var t=$("gunTable"),head="<tr><th>Gun</th><th>Class</th><th>Damage</th><th>Fire rate</th><th>Magazine</th><th>Reload</th><th>Full damage to</th><th>Zoom</th></tr>";
 var maxDps=0;D.GUNS.forEach(function(g){maxDps=Math.max(maxDps,g.dmg*g.pellets)});
 var rows=D.GUNS.map(function(g){
  var dmg=g.dmg+(g.pellets>1?" x "+g.pellets:"");
  var w=Math.max(4,Math.round(g.dmg*g.pellets/maxDps*70));
  return "<tr><td>"+g.name+"</td><td>"+g.cls+"</td><td><div class=\"bar-cell\"><i style=\"width:"+w+"px\"></i><span>"+dmg+"</span></div></td><td>"+g.rate+"/s "+(g.auto?"auto":"semi")+"</td><td>"+g.mag+"</td><td>"+g.reload.toFixed(1)+" s</td><td>"+g.fo0+" m</td><td>"+g.zoom+"x</td></tr>";
 });
 t.innerHTML=head+rows.join("");
})();

/* attachments */
var attR=2;
function renderCats(){
 var box=$("cats");box.textContent="";
 D.CATS.forEach(function(c,ci){
  var card=el("div","cat"),h=el("h3",null,c.name);h.appendChild(el("b",null,c.abbr));card.appendChild(h);
  c.opts.forEach(function(o,oi){
   var d=el("div","opt");d.appendChild(el("strong",null,o.name));
   var p=el("p");
   D.describeAttachment(ci,oi,attR).forEach(function(line,i){
    if(i)p.appendChild(document.createTextNode("  /  "));
    var good=/^\+/.test(line),bad=/^-/.test(line);
    // for "reload time" and "bloom" and "spread" a minus is good
    var invert=/(reload time|spread|bloom)/.test(line);
    var cls=(good&&!invert)||(bad&&invert)?"up":((bad&&!invert)||(good&&invert)?"down":"");
    p.appendChild(el("span",cls,line));
   });
   d.appendChild(p);card.appendChild(d);
  });
  box.appendChild(card);
 });
}
(function(){
 var chips=$("attChips");
 D.RARITY.forEach(function(r,i){
  var b=el("button","chip",r.name);b.type="button";b.style.setProperty("--c",r.color);b.setAttribute("aria-pressed",i===attR);
  b.onclick=function(){attR=i;[].forEach.call(chips.children,function(x,j){x.setAttribute("aria-pressed",j===i)});renderCats()};
  chips.appendChild(b);
 });
 renderCats();
})();

/* rarity */
(function(){
 var box=$("rarCards");
 function pct(table,i){var t=0;table.forEach(function(v){t+=v});return Math.round(table[i]/t*100)+"%"}
 D.RARITY.forEach(function(r,i){
  var c=el("div","rcard");c.style.setProperty("--c",r.color);c.appendChild(el("h3",null,r.name));
  var dl=el("dl");
  function row(k,v){dl.appendChild(el("dt",null,k));dl.appendChild(el("dd",null,v))}
  function sgn(v){var p=Math.round((v-1)*100);return (p>0?"+":"")+p+"%"}
  row("Gun damage",sgn(r.dmg));row("Magazine",sgn(r.mag));row("Reload time",sgn(r.reload));row("Spread",sgn(r.spread));
  row("Attachment power",Math.round(r.att*100)+"%");row("Medkit heal","+"+D.HEAL[i]+" HP");
  dl.appendChild(el("hr"));
  row("Ground drop",pct(D.WEIGHTS.ground,i));row("Chest drop",pct(D.WEIGHTS.chest,i));row("Bunker drop",pct(D.WEIGHTS.bunker,i));
  c.appendChild(dl);box.appendChild(c);
 });
})();

/* motion: 3D hero gun cycling through the arsenal, count-up stats, scroll reveals, account chip */
(function(){
 Site.nav();
 Site.reveal();
 [].forEach.call(document.querySelectorAll(".stat b"),function(b){
  var done=false;
  function go(){if(done)return;done=true;Site.countUp(b,+b.dataset.n,1300)}
  if("IntersectionObserver" in window){var io=new IntersectionObserver(function(es){if(es[0].isIntersecting){go();io.disconnect()}});io.observe(b)}else go();
 });
 var cv=document.getElementById("heroGun");
 if(!cv||!window.THREE||!window.View||!View.preview)return;
 var pv;try{pv=View.preview(cv)}catch(e){return}
 var seq=[[3,3,[1,1,2,3,1,1,2]],[6,4,[2,1,1,1,0,1,1]],[4,2,[0,0,0,0,0,0,0]],[7,3,[0,1,0,2,2,2,0]],[2,4,[1,0,1,1,1,1,1]],[5,2,[2,2,0,0,2,0,2]],[1,1,[0,0,0,0,0,0,0]],[0,0,[0,0,0,0,0,0,0]]];
 var i=0;
 function show(){
  var s=seq[i%seq.length],att=s[2].map(function(o,c){return s[1]>=2&&(c<=s[1]+1)&&o>=0?{o:o,r:Math.min(4,Math.max(1,s[1]))}:null});
  var wp={g:s[0],r:s[1],att:att},R=D.RARITY[s[1]],G=D.GUNS[s[0]];
  pv.set(wp);
  var n=document.getElementById("heroName");n.textContent=R.name+" "+G.name;n.parentNode.parentNode.parentNode.style.setProperty("--c",R.color);
  document.getElementById("heroSub").textContent=" "+G.cls+" / "+att.filter(Boolean).length+" attachments";
  i++;
 }
 show();setInterval(show,3600);
})();

/* entry */
$("joinForm").onsubmit=function(e){
 e.preventDefault();
 var c=$("code").value.replace(/[^a-z0-9]/gi,"").toUpperCase();
 if(c.length!==5){$("code").focus();return}
 location.href="play.html?join="+encodeURIComponent(c);
};
$("code").oninput=function(){this.value=this.value.replace(/[^a-z0-9]/gi,"").toUpperCase()};
$("createRoom").onclick=function(){location.href="play.html?host=1"};
})();
