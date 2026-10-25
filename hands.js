import * as THREE from "three";
/** First-person hands and fishing rod, parented to the camera. Everything is flat-shaded boxes in the game's low-poly style. */
export function createHands(camera){
  const g=new THREE.Group();camera.add(g);g.scale.setScalar(.78);g.position.set(.04,-.02,0);
  const skin=new THREE.MeshStandardMaterial({color:0xe3b186,flatShading:true,roughness:.9});
  const sleeve=new THREE.MeshStandardMaterial({color:0x2f6f8f,flatShading:true,roughness:.9});
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
  rh.add(box(.075,.07,.09,skin,0,0,0),box(.085,.05,.04,skin,0,-.02,-.055),box(.07,.07,.2,sleeve,.015,-.05,.14));
  // left hand cranks the reel
  const lh=new THREE.Group();g.add(lh);lh.position.set(-.1,-.27,-.5);
  lh.add(box(.065,.065,.085,skin,0,0,0),box(.065,.065,.2,sleeve,-.015,-.045,.14));
  // axe
  const axe=new THREE.Group();g.add(axe);axe.visible=false;
  const ah=new THREE.Mesh(new THREE.CylinderGeometry(.022,.026,.8,6),wood);ah.rotation.x=Math.PI/2;ah.position.set(0,0,-.3);axe.add(ah);
  axe.add(box(.05,.2,.34,new THREE.MeshStandardMaterial({color:0xcfd8e3,flatShading:true,roughness:.4,metalness:.4}),0,.05,-.62),box(.06,.1,.12,dark,0,.0,-.5));
  const axh=new THREE.Group();axe.add(axh);axh.add(box(.075,.07,.09,skin,0,0,.05),box(.07,.07,.2,sleeve,.01,-.04,.19));
  let tool=0;
  const state={bob:0,cast:0,reel:0,tension:0,t:0,swing:0};
  let tipWorld=new THREE.Vector3();
  return {
    group:g,rod,tip,
    tipPos(){tip.getWorldPosition(tipWorld);return tipWorld},
    setVisible(v){g.visible=v},
    setTool(i){tool=i;rod.visible=(i===0);lh.visible=(i===0);axe.visible=(i===1)},
    swing(v){state.swing=v},
    /** speed 0..1 walking, cast 0..1 swing progress, reeling 0/1, tension 0..1 */
    update(dt,speed,cast,reeling,tension,hide){
      state.t+=dt;state.bob+=dt*(2+speed*7);
      if(tool===1){const bx2=Math.sin(state.bob)*.012*(.3+speed),by2=Math.abs(Math.cos(state.bob))*.014*(.3+speed),sw=state.swing;axe.position.set(.28+bx2-sw*.1,-.3+by2-(hide?.8:0)+sw*.06,-.5+sw*.05);axe.rotation.set(.55-sw*1.5,-.1,-.25+sw*.35);return}
      const bx=Math.sin(state.bob)*.012*(.3+speed),by=Math.abs(Math.cos(state.bob))*.014*(.3+speed);
      // cast swing: rod goes back then forward
      const sw=cast>0?Math.sin(Math.min(1,cast)*Math.PI):0;
      const lift=cast>0?(cast<.35?-cast/.35:-(1-(cast-.35)/.65)):0; // back then forward
      rod.position.set(.26+bx,-.24+by-(hide?.8:0),-.5);
      rod.rotation.set(.45-sw*.7+(lift<0?-lift*.5:0)+(reeling?.12:0)-tension*.18,.05,0);
      state.reel=reeling?state.reel+dt*11:state.reel;
      reel.rotation.x=state.reel;
      lh.position.set(-.1+Math.cos(state.reel)*.015*(reeling?1:0),-.27+Math.sin(state.reel)*.015*(reeling?1:0)-(hide?.8:0),-.5);
    }
  };
}
