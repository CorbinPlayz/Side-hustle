
// In-page stand-in for the Cloudflare match server: runs the REAL MatchCore inside the browser.
(function(){
var cores={};
function core(code){
  if(cores[code])return cores[code];
  var MC=window.__mkCore();
  var c=new MC({random:Math.random,report:function(uid,r){
    var Data=window.Data;window.__reports=(window.__reports||[]);window.__reports.push([uid,r]);
    return Promise.resolve({gained:Data.matchXp(r.kills,r.won),before:Data.levelInfo(0),after:Data.levelInfo(Data.matchXp(r.kills,r.won)),counted:true});
  }});
  cores[code]=c;
  setInterval(function(){if(c.phase==="running")c.tick(16)},16);
  return c;
}
window.__cores=cores;
var nid=1;
window.__DuelWS=function(url){
  var self=this,m=/\/ws\/([A-Z0-9]{5})(\?create=1)?/.exec(url);
  self.readyState=0;var code=m[1],create=!!m[2],c=core(code);
  window.__lastUrl=url;
  var conn={id:nid++,uid:"u"+nid,name:"Tester",level:1,att:window.Data.expandLoadout(null,1),
    send:function(o){setTimeout(function(){if(self.onmessage)self.onmessage({data:JSON.stringify(o)})},0)},
    close:function(){self.readyState=3;setTimeout(function(){if(self.onclose)self.onclose({})},0)}};
  self.send=function(d){c.message(conn,JSON.parse(d))};
  self.close=function(){if(self.readyState!==3){self.readyState=3;c.leave(conn)}};
  setTimeout(function(){c.join(conn,create);self.readyState=1;if(self.onopen)self.onopen({});
    if(create&&!window.__noBot){ // the opponent
      var bot={id:nid++,uid:"bot",name:"Botty",level:3,att:window.Data.expandLoadout(null,1),send:function(){},close:function(){}};
      setTimeout(function(){c.join(bot,false);window.__bot=bot},300);
    }
  },20);
};
})();
