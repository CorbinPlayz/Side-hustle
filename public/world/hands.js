import * as THREE from "three";
import {makeHand,SKINS,TOP_COLORS} from "./character.js";
/** First-person hands and fishing rod, parented to the camera. Everything is flat-shaded boxes in the game's low-poly style. */
export function createHands(camera,look={skin:1,topColor:1}){
  const g=new THREE.Group();camera.add(g);g.scale.setScalar(.78);g.position.set(.04,-.02,0);
  const SK=SKINS[look.skin%SKINS.length],SL=TOP_COLORS[look.topColor%TOP_COLORS.length];
  const wood=new THREE.MeshStandardMaterial({color:0xb08a52,flatShading:true,roughness:.8});
  const dark=new THREE.MeshStandardMaterial({color:0x3a3f48,flatShading:true,roughness:.6,metalness:.3});
  const cork=new THREE.MeshStandardMaterial({color:0xd9b27a,flatShading:true,roughness:1});
  const box=(w,h,d,m,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);return b};
  // rod group, pivoting at the right hand
  const rod=new THREE.Group();g.add(rod);rod.position.set(.26,-.24,-.5);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.006,.016,2.6,6),wood);shaft.rotation.x=Math.PI/2;shaft.position.set(0,0,-1.1);rod.add(shaft);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.3,6),cork);handle.rotation.x=Math.PI/2;handle.position.set(0,0,.1);rod.add(handle);
  const reel=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.04,8),dark);reel.rotation.z=Math.PI/2;reel.position.set(-.04,-.03,-.04);rod.add(reel);
  const tip=new THREE.Object3D();tip.position.set(0,0,-2.4);rod.add(tip);
  // right hand wraps the handle
  const rh=new THREE.Group();rod.add(rh);rh.position.set(0,0,.05);
  {const m=makeHand(SK,SL,1);m.scale.setScalar(.62);m.position.set(0,-.01,.04);m.rotation.set(.1,0,0);rh.add(m)}
  // left hand cranks the reel
  const lh=new THREE.Group();g.add(lh);lh.position.set(-.1,-.27,-.5);
  {const m=makeHand(SK,SL,-1);m.scale.setScalar(.62);m.rotation.set(.35,.2,0);lh.add(m)}
  // axe
  const axe=new THREE.Group();g.add(axe);axe.visible=false;
  const ah=new THREE.Mesh(new THREE.CylinderGeometry(.022,.026,.8,6),wood);ah.rotation.x=Math.PI/2;ah.position.set(0,0,-.3);axe.add(ah);
  {const sh=new THREE.Shape();sh.moveTo(0,-.1);sh.lineTo(.2,-.2);sh.lineTo(.26,.0);sh.lineTo(.2,.2);sh.lineTo(0,.1);sh.lineTo(-.04,0);sh.closePath();
   const eg=new THREE.ExtrudeGeometry(sh,{depth:.05,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:1});eg.translate(0,0,-.025);
   const blade=new THREE.Mesh(eg,new THREE.MeshStandardMaterial({color:0xcfd8e3,flatShading:true,roughness:.35,metalness:.5}));blade.rotation.set(0,-Math.PI/2,0);blade.scale.setScalar(.5);blade.position.set(0,.02,-.62);blade.castShadow=true;axe.add(blade);
   axe.add(box(.06,.1,.12,dark,0,0,-.52))}
  const axh=new THREE.Group();axe.add(axh);{const m=makeHand(SK,SL,1);m.scale.setScalar(.62);m.position.set(0,0,.05);axh.add(m)}
  const bare=new THREE.Group();g.add(bare);bare.visible=false;
  for(const s of [-1,1]){const hand=makeHand(SK,SL,s);hand.scale.setScalar(.62);hand.position.set(s*.2,-.3,-.55);hand.rotation.set(.45,-s*.12,0);bare.add(hand)}
  let tool=3;
  const ease=t=>t*t*(3-2*t),lerp=(a,b,t)=>a+(b-a)*t;
  const S={bob:0,reel:0,t:0,equip:1,punch:-1,punchHand:0,swingT:-1,prevSwing:0,sx:0,sy:0,lastYaw:null,lastPitch:null,air:0};
  const handL=bare.children[0],handR=bare.children[1];
  let tipWorld=new THREE.Vector3();
  const api={
    group:g,rod,tip,sprint:false,airborne:0,
    tipPos(){tip.getWorldPosition(tipWorld);return tipWorld},
    setVisible(v){g.visible=v},
    /** Switching tools lowers the old one and raises the new one. */
    setTool(i){tool=i;S.equip=0;bare.visible=i>=2;rod.visible=(i===0);lh.visible=(i===0);axe.visible=(i===1)},
    equip(){},
    swing(v){if(v>.95&&S.prevSwing<=.95&&S.swingT<0)S.swingT=0;S.prevSwing=v},
    punch(){if(S.punch<0){S.punch=0;S.punchHand=1-S.punchHand}},
    get punching(){return S.punch>=0},
    /** speed 0..1 walking, cast 0..1 swing progress, reeling 0/1, tension 0..1 */
    update(dt,speed,cast,reeling,tension,hide){
      S.t+=dt;const sp=api.sprint&&speed>.2?1.35:1;S.bob+=dt*(2+speed*7*sp);S.equip=Math.min(1,S.equip+dt*3.4);S.air=lerp(S.air,api.airborne>0?1:0,Math.min(1,dt*10));
      // weapon sway: hands lag a little behind where you look
      if(S.lastYaw===null){S.lastYaw=camera.rotation.y;S.lastPitch=camera.rotation.x}
      let dy=camera.rotation.y-S.lastYaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const dp=camera.rotation.x-S.lastPitch;S.lastYaw=camera.rotation.y;S.lastPitch=camera.rotation.x;
      S.sx=lerp(S.sx,Math.max(-.07,Math.min(.07,dy*1.1)),Math.min(1,dt*9));S.sy=lerp(S.sy,Math.max(-.05,Math.min(.05,-dp*1.1)),Math.min(1,dt*9));
      const walk=speed*(.55+.45*sp),bx=Math.sin(S.bob)*.014*(.25+walk)+S.sx*-1,by=Math.abs(Math.cos(S.bob))*.017*(.2+walk)+Math.sin(S.t*1.5)*.003-S.air*.04+S.sy;
      const drop=(1-ease(S.equip))*-.55-(hide?.8:0);
      const tilt=Math.sin(S.bob)*.03*walk*sp;
      if(tool>=2){
        // fists: ready stance, alternate punches
        if(S.punch>=0){S.punch+=dt/.34;if(S.punch>=1)S.punch=-1}
        const pose=(hand,side,isP,p)=>{
          let f=0,up=0,roll=0;
          if(isP&&p>=0){f=p<.28?-ease(p/.28)*.12:(p<.5?lerp(-.12,.5,ease((p-.28)/.22)):lerp(.5,0,ease((p-.5)/.5)));up=p<.5?.02:0;roll=(p>.28&&p<.6?.4:0)*-side}
          hand.position.set(side*.2+bx+(isP&&p>.28&&p<.6?-side*.12:0),-.3+by+drop+up+(isP?0:Math.sin(S.t*1.6+side)*.004),-.55-f);
          hand.rotation.set(.45-(isP&&p>=0?.45*Math.sin(Math.min(1,p)*Math.PI):0)+tilt,-side*.12+(isP&&p>=0?-side*.25*Math.sin(Math.min(1,p)*Math.PI):0),roll);
        };
        pose(handL,-1,S.punchHand===0,S.punch);pose(handR,1,S.punchHand===1,S.punch);
        bare.position.set(0,0,0);return;
      }
      if(tool===1){
        if(S.swingT>=0){S.swingT+=dt/.46;if(S.swingT>=1)S.swingT=-1}
        const p=S.swingT;let a=0,lift=0;
        if(p>=0){a=p<.3?-ease(p/.3)*.5:(p<.52?lerp(-.5,1.45,ease((p-.3)/.22)):lerp(1.45,0,ease((p-.52)/.48)));lift=p<.3?ease(p/.3)*.1:0}
        axe.position.set(.28+bx-(p>=0?a*.06:0),-.3+by+drop+lift-(p>=0&&a>0?a*.05:0),-.5+(p>=0?a*.08:0));
        axe.rotation.set(.55-a*1.3,-.1-(p>=0?a*.12:0),-.25+(p>=0?a*.3:0)+tilt);return;
      }
      // fishing rod
      const sw=cast>0?Math.sin(Math.min(1,cast)*Math.PI):0;
      const back=cast>0&&cast<.4?ease(cast/.4):(cast>=.4?1-ease(Math.min(1,(cast-.4)/.6)):0);
      rod.position.set(.26+bx,-.24+by+drop,-.5);
      rod.rotation.set(.45-sw*.75+back*.35+(reeling?.12:0)-tension*.2+Math.sin(S.t*1.1)*.012,.05,tilt);
      S.reel=reeling?S.reel+dt*11:S.reel;reel.rotation.x=S.reel;
      lh.position.set(-.1+Math.cos(S.reel)*.015*(reeling?1:0)+bx,-.27+Math.sin(S.reel)*.015*(reeling?1:0)+by+drop,-.5);
    }
  };
  return api;
}
