/* Shared page helpers: nav account chip, scroll reveal, count-up numbers and toasts. */
(function(root){
"use strict";
var Site={};
Site.reveal=function(){
 var els=document.querySelectorAll(".reveal:not(.in)");
 if(!("IntersectionObserver" in root)){[].forEach.call(els,function(e){e.classList.add("in")});return}
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{threshold:0.12,rootMargin:"0px 0px -6% 0px"});
 [].forEach.call(els,function(e){io.observe(e)});
};
Site.countUp=function(el,to,ms,fmt){
 ms=ms||1200;var t0=null;fmt=fmt||function(v){return String(Math.round(v))};
 if(root.matchMedia&&root.matchMedia("(prefers-reduced-motion: reduce)").matches){el.textContent=fmt(to);return}
 function step(t){
  if(t0==null)t0=t;var k=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-k,3);
  el.textContent=fmt(to*e);if(k<1)requestAnimationFrame(step);
 }
 requestAnimationFrame(step);
};
Site.toast=function(text){
 var d=document.createElement("div");d.className="toast";d.textContent=text;document.body.appendChild(d);
 setTimeout(function(){d.remove()},2600);
};
Site.esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
/** Fill #navUser with the signed-in player (or a sign-in link). Resolves with Backend.init()'s result. */
Site.nav=function(){
 var box=document.getElementById("navUser");
 return root.Backend.init().then(function(r){
  if(box){
   if(r.profile&&(r.state==="ok"||r.state==="demo")){
    box.innerHTML='<span class="lvl">'+r.profile.level+'</span><a href="world.html">'+Site.esc(r.profile.username)+'</a>'+(r.profile.is_admin?'<a href="admin.html">admin</a>':'');
   }else box.innerHTML='<a class="btn" href="login.html">Sign in</a>';
  }
  return r;
 });
};
root.Site=Site;
})(window);
