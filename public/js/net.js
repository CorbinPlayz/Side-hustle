/* Side Hustle networking: a WebSocket to the match server (a Cloudflare Durable Object per room code).
   The server runs the match; this module only moves messages. */
(function(){
"use strict";
var ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
var ws=null,cb={},pingTimer=null,connectTimer=null,role=null,wasOpen=false;
var api={rtt:null,open:false,code:null};
var WSImpl=function(u){return new (window.__DuelWS||WebSocket)(u)};

function makeCode(){var s="";for(var i=0;i<5;i++)s+=ALPHABET.charAt(Math.floor(Math.random()*ALPHABET.length));return s}
function url(code,create){
  var base=(window.__DuelWSBase)||((location.protocol==="https:"?"wss://":"ws://")+location.host);
  return base+"/ws/"+code+(create?"?create=1":"");
}
function send(o){try{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))}catch(e){}}
function startPing(){stopPing();pingTimer=setInterval(function(){send({t:"ping",ts:Math.round(performance.now())})},2000)}
function stopPing(){clearInterval(pingTimer);pingTimer=null}
function fail(msg){clearTimeout(connectTimer);var f=cb.onError;if(f)f(msg)}

function open(code,create,tries){
  var sock;
  try{sock=WSImpl(url(code,create))}catch(e){fail("Could not open a connection.");return}
  ws=sock;wasOpen=false;
  connectTimer=setTimeout(function(){fail("Timed out connecting to the match server.")},12000);
  sock.onopen=function(){wasOpen=true;clearTimeout(connectTimer);api.open=true;api.code=code;startPing();if(cb.onConnect)cb.onConnect(code)};
  sock.onmessage=function(ev){
    var m;try{m=JSON.parse(ev.data)}catch(e){return}
    if(!m||typeof m!=="object")return;
    if(m.t==="pong"){api.rtt=Math.max(0,Math.round(performance.now()-m.ts));return}
    if(m.t==="error"&&create&&tries<6&&/in use|occupied|exists/i.test(m.error||"")){ // code collision: try another
      cb.__retry=true;try{sock.close()}catch(e){}
      return;
    }
    if(cb.onMessage)cb.onMessage(m);
  };
  sock.onclose=function(){
    if(ws!==sock)return;
    clearTimeout(connectTimer);stopPing();api.open=false;
    if(cb.__retry){cb.__retry=false;open(makeCode(),true,tries+1);return}
    if(wasOpen){if(cb.onClose)cb.onClose()}
    else fail(create?"Could not create a room. Are you signed in?":"Could not connect. Check the code and that you are signed in.");
  };
  sock.onerror=function(){};
}

/** Create a room with a fresh code. */
api.host=function(callbacks){api.close();cb=callbacks;role="host";open(makeCode(),true,0)};
/** Join a room by code. */
api.join=function(code,callbacks){api.close();cb=callbacks;role="guest";open(code,false,0)};
api.send=send;
api.role=function(){return role};
api.close=function(){
  clearTimeout(connectTimer);stopPing();
  var s=ws;ws=null;cb={};role=null;api.open=false;api.rtt=null;api.code=null;
  try{if(s)s.close()}catch(e){}
};
api.normalizeCode=function(s){return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5)};
window.DuelNet=api;
})();
