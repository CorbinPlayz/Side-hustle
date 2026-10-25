import * as THREE from "three";
import {heightAt,slopeAt} from "./terrain.js";
import {fbm,hash2} from "./noise.js";

/** Merge coloured parts into one flat-shaded geometry (vertex colours baked). */
export function mergeParts(parts){
  const P=[],C=[];
  for(const part of parts){
    let g=part.geo.index?part.geo.toNonIndexed():part.geo.clone();
    g.applyMatrix4(part.m||new THREE.Matrix4());
    const pos=g.attributes.position,col=new THREE.Color(part.color);
    for(let i=0;i<pos.count;i++){P.push(pos.getX(i),pos.getY(i),pos.getZ(i));C.push(col.r,col.g,col.b)}
    g.dispose();
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute("position",new THREE.Float32BufferAttribute(P,3));
  out.setAttribute("color",new THREE.Float32BufferAttribute(C,3));
  out.computeVertexNormals();
  return out;
}
const M4=(x=0,y=0,z=0,sx=1,sy=1,sz=1,ry=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),ry),new THREE.Vector3(sx,sy,sz));

function windify(mat,uniforms,strength){
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uTime=uniforms.uTime;
    sh.vertexShader="uniform float uTime;\n"+sh.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      float sway=max(position.y,0.);
      #ifdef USE_INSTANCING
        float ph=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
      #else
        float ph=0.;
      #endif
      transformed.x+=sin(uTime*1.1+ph)*${strength.toFixed(3)}*sway*.012;
      transformed.z+=cos(uTime*.9+ph*1.3)*${strength.toFixed(3)}*sway*.008;`);
  };
}

export function buildForest(rand,uniforms){
  const group=new THREE.Group();
  // --- pine tree geometry
  const pine=[];
  pine.push({geo:new THREE.CylinderGeometry(.35,.5,3.2,6),color:0x8a6040,m:M4(0,1.6,0)});
  [[3.2,2.7,3.6,0x2f7d3c],[2.5,2.4,5.6,0x39903f],[1.7,2.1,7.5,0x47a447]].forEach(([r,h,y,c])=>pine.push({geo:new THREE.ConeGeometry(r,h*1.3,7),color:c,m:M4(0,y,0)}));
  const pineGeo=mergeParts(pine);
  // --- round tree
  const oak=[];
  oak.push({geo:new THREE.CylinderGeometry(.4,.6,3.4,6),color:0x946a45,m:M4(0,1.7,0)});
  [[2.8,4.6,0,0x5bb347],[2.2,6.1,.9,0x6cc455],[2.0,5.3,-1.1,0x52a840]].forEach(([r,y,x,c])=>oak.push({geo:new THREE.IcosahedronGeometry(r,0),color:c,m:M4(x,y,x*.3)}));
  const oakGeo=mergeParts(oak);
  // --- rocks
  const rockGeo=mergeParts([{geo:new THREE.DodecahedronGeometry(1,0),color:0x9a948a,m:M4(0,.3,0,1.2,.8,1)},{geo:new THREE.IcosahedronGeometry(.7,0),color:0x857f76,m:M4(.8,.1,.3)}]);
  const mkMat=()=>{const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9});return m};
  const pineMat=mkMat(),oakMat=mkMat();windify(pineMat,uniforms,1);windify(oakMat,uniforms,1.2);
  const trees=[],oaks=[],rocks=[],grass=[],flowers=[];
  for(let i=0;i<9000;i++){
    const x=(rand()-.5)*560,z=(rand()-.5)*560,h=heightAt(x,z);
    if(h<1.5)continue;
    const s=slopeAt(x,z);if(s>.75)continue;
    const dens=fbm(x*.02,z*.02,41,3);
    if(dens>.5&&rand()<.8&&trees.length+oaks.length<1900){
      const sc=.8+rand()*.9;(h>14||rand()<.55?trees:oaks).push([x,h-.3,z,sc,rand()*6.28]);
    }else if(rand()<.012&&rocks.length<160)rocks.push([x,h-.2,z,.6+rand()*1.8,rand()*6.28]);
  }
  for(let i=0;i<7000;i++){ // loose rocks on the beach
    const a=rand()*6.283,r=60+rand()*220,x=Math.cos(a)*r,z=Math.sin(a)*r,h=heightAt(x,z);
    if(h>-.3&&h<1.4&&rocks.length<260)rocks.push([x,h-.1,z,.4+rand()*1.1,rand()*6.28]);
  }
  for(let i=0;i<60000&&grass.length<26000;i++){
    const x=(rand()-.5)*420,z=(rand()-.5)*420,h=heightAt(x,z);
    if(h<2.2||slopeAt(x,z)>.55)continue;
    if(fbm(x*.05,z*.05,77,2)<.38)continue;
    grass.push([x,h-.05,z,.6+rand()*.8,rand()*6.28]);
    if(rand()<.06)flowers.push([x+rand(),h,z+rand(),rand()]);
  }
  function inst(geo,mat,list,colors,shadow=true){
    const im=new THREE.InstancedMesh(geo,mat,list.length);const m=new THREE.Matrix4(),c=new THREE.Color();
    list.forEach((o,i)=>{
      m.compose(new THREE.Vector3(o[0],o[1],o[2]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),o[4]),new THREE.Vector3(o[3],o[3]*(.9+hash2(i,3,5)*.3),o[3]));
      im.setMatrixAt(i,m);
      c.setHSL(0,0,.85+hash2(i,9,2)*.3);if(colors)c.copy(colors(o,i));
      im.setColorAt(i,c);
    });
    im.castShadow=shadow;im.receiveShadow=true;im.frustumCulled=false;im.instanceMatrix.needsUpdate=true;
    return im;
  }
  const pineIm=inst(pineGeo,pineMat,trees),oakIm=inst(oakGeo,oakMat,oaks);
  group.add(pineIm,oakIm,inst(rockGeo,mkMat(),rocks));
  group.userData.trees=[{kind:"pine_log",im:pineIm,list:trees},{kind:"oak_log",im:oakIm,list:oaks}];
  // grass blades: tall thin triangles, pixel-ish colours
  const blade=mergeParts([{geo:new THREE.ConeGeometry(.09,1,3),color:0xffffff,m:M4(0,.5,0)},{geo:new THREE.ConeGeometry(.08,.8,3),color:0xdfffd0,m:M4(.18,.4,.1)},{geo:new THREE.ConeGeometry(.08,.7,3),color:0xcff0bd,m:M4(-.16,.35,-.1)}]);
  const gMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1});windify(gMat,uniforms,2.2);
  const gm=inst(blade,gMat,grass,(o,i)=>new THREE.Color().setHSL(.27+hash2(i,4,4)*.05,.55,.38+hash2(i,6,1)*.14),false);gm.receiveShadow=false;
  group.add(gm);
  // pixel flowers: small cubes
  const fGeo=mergeParts([{geo:new THREE.BoxGeometry(.28,.28,.28),color:0xffffff,m:M4(0,.75,0)},{geo:new THREE.BoxGeometry(.06,.7,.06),color:0x3c8a3a,m:M4(0,.35,0)}]);
  const FC=[0xe86bd0,0xb26bff,0xffd23a,0xff6b6b,0xffffff];
  const fm=inst(fGeo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true}),flowers.map(f=>[f[0],f[1],f[2],.45,f[3]*6]),(o,i)=>new THREE.Color(FC[i%FC.length]),false);
  group.add(fm);
  return group;
}

/** A simple wooden fishing dock reaching out over the water from the shore point (x,z) heading outward along angle a. */
export function buildDock(x,z,a){
  const parts=[],len=16,w=3.4;
  for(let i=0;i<len;i++)parts.push({geo:new THREE.BoxGeometry(w,.22,.85),color:i%2?0xa87a4a:0xb98a56,m:M4(0,i*.0,i*.95+.2+0)});
  [0,5,10,15].forEach((k,j)=>{[-1,1].forEach(sd=>parts.push({geo:new THREE.CylinderGeometry(.18,.22,5,6),color:0x8a6540,m:M4(sd*(w/2-.1),-1.9,k+.5)}))});
  parts.push({geo:new THREE.BoxGeometry(.18,1.0,.18),color:0x8a6540,m:M4(-w/2,.6,len*.95)},{geo:new THREE.BoxGeometry(.18,1.0,.18),color:0x8a6540,m:M4(w/2,.6,len*.95)});
  const g=mergeParts(parts),mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9}));
  mesh.castShadow=mesh.receiveShadow=true;mesh.position.set(x,.55,z);mesh.rotation.y=a;
  return mesh;
}

function labelTexture(lines,w=512,h=192,bg="#2a3d5c",fg="#ffffff"){
  const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");
  g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle="#f08a3c";g.lineWidth=10;g.strokeRect(5,5,w-10,h-10);
  g.fillStyle=fg;g.textAlign="center";g.textBaseline="middle";
  lines.forEach((l,i)=>{g.font=(i===0?"700 76px":"600 44px")+" 'Alegreya',Georgia,serif";g.fillText(l,w/2,h*(lines.length===1?.5:.34+i*.34))});
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
/** Fish market stall: counter, striped awning, sign, crates and barrels. Faces +z in local space. */
export function buildStall(x,y,z,ry){
  const grp=new THREE.Group();
  const parts=[];
  parts.push({geo:new THREE.BoxGeometry(5,1.1,1.6),color:0xa87a4a,m:M4(0,.55,0)});
  parts.push({geo:new THREE.BoxGeometry(5.3,.14,1.9),color:0xc79a62,m:M4(0,1.15,0)});
  [[-2.5,-.7],[2.5,-.7],[-2.5,.8],[2.5,.8]].forEach(([px,pz])=>parts.push({geo:new THREE.CylinderGeometry(.1,.12,3.6,6),color:0x8a6540,m:M4(px,1.8,pz)}));
  parts.push({geo:new THREE.BoxGeometry(5.2,.16,.2),color:0x8a6540,m:M4(0,3.55,-.7)});
  // striped awning, slanted
  for(let i=0;i<10;i++)parts.push({geo:new THREE.BoxGeometry(.52,.1,2.4),color:i%2?0xf5f0e6:0xd8432f,m:new THREE.Matrix4().compose(new THREE.Vector3(-2.35+i*.52,3.7,.2),new THREE.Quaternion().setFromEuler(new THREE.Euler(.28,0,0)),new THREE.Vector3(1,1,1))});
  // crates and barrels
  parts.push({geo:new THREE.BoxGeometry(.9,.8,.9),color:0xb48a54,m:M4(-3.4,.4,.6,1,1,1,.3)},{geo:new THREE.BoxGeometry(.8,.7,.8),color:0x9c7444,m:M4(-3.3,1.15,.55,1,1,1,-.2)},{geo:new THREE.CylinderGeometry(.5,.45,1.1,8),color:0x6a5a4a,m:M4(3.5,.55,.5)});
  // fish on ice
  [[-1.3,0xaec7da],[-.6,0x6f9a4b],[.1,0xb5707a],[.9,0x34527d]].forEach(([fx,c],i)=>parts.push({geo:new THREE.IcosahedronGeometry(.28,0),color:c,m:M4(fx,1.32,.1,1.6,.6,.8,i)}));
  const body=new THREE.Mesh(mergeParts(parts),new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9}));
  body.castShadow=body.receiveShadow=true;grp.add(body);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.28),new THREE.MeshStandardMaterial({map:labelTexture(["MARKET","sell here, press E"]),roughness:.8}));
  sign.position.set(0,2.55,.95);sign.rotation.x=-.12;grp.add(sign);
  grp.position.set(x,y,z);grp.rotation.y=ry;
  return grp;
}

/** Forageable mushrooms (red, white dots) and rare glowcaps (cyan), scattered in the forest. */
export function buildMushrooms(rand){
  const cap=(c,dots)=>{
    const P=[{geo:new THREE.CylinderGeometry(.07,.1,.45,6),color:0xf2e8d0,m:M4(0,.22,0)},{geo:new THREE.SphereGeometry(.32,7,5,0,6.283,0,1.45),color:c,m:M4(0,.42,0)}];
    for(let i=0;i<dots;i++){const a=i*2.1;P.push({geo:new THREE.BoxGeometry(.09,.05,.09),color:0xffffff,m:M4(Math.cos(a)*.17,.64-i*.04,Math.sin(a)*.17)})}
    return mergeParts(P);
  };
  const defs=[{kind:"mushroom",geo:cap(0xd8392f,4),mat:new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.8})},
              {kind:"glowcap",geo:cap(0x4fe8ff,2),mat:new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,emissive:0x1ac8e8,emissiveIntensity:1.1,roughness:.5})}];
  const group=new THREE.Group(),out=[];
  const spots={mushroom:[],glowcap:[]};
  for(let i=0;i<30000&&spots.mushroom.length+spots.glowcap.length<190;i++){
    const x=(rand()-.5)*480,z=(rand()-.5)*480,h=heightAt(x,z);
    if(h<2.4||slopeAt(x,z)>.6||fbm(x*.02,z*.02,41,3)<.42)continue;
    (rand()<.12?spots.glowcap:spots.mushroom).push({x,y:h-.02,z,s:1+rand()*.9,ry:rand()*6.28,alive:true});
  }
  for(const d of defs){
    const list=spots[d.kind],im=new THREE.InstancedMesh(d.geo,d.mat,list.length),m=new THREE.Matrix4();
    list.forEach((o,i)=>{m.compose(new THREE.Vector3(o.x,o.y,o.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),o.ry),new THREE.Vector3(o.s,o.s,o.s));im.setMatrixAt(i,m);o.m=m.clone()});
    im.castShadow=true;im.frustumCulled=false;group.add(im);out.push({kind:d.kind,im,list});
  }
  group.userData.nodes=out;return group;
}
