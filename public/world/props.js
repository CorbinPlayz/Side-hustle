import * as THREE from "three";
import {heightAt,slopeAt} from "./terrain.js";
import {fbm,hash2} from "./noise.js";
import {inRavine} from "./ravine.js";
import {HOUSE_MODELS} from "./houses.js";
import {loadModels,hasModel,parts,size,model} from "./models.js";

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

export function buildForestProcedural(rand,uniforms,opts={}){
  const group=new THREE.Group();
  // shared helpers: nudge vertices by a position hash (so shared corners move together) and darken low / lighten high
  const lump=(g,amt)=>{const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const k=(a)=>hash2(Math.round(x*50)+a,Math.round(y*50)+a*3,Math.round(z*50)-a)-.5;p.setXYZ(i,x+k(1)*amt,y+k(2)*amt,z+k(3)*amt)}g.computeVertexNormals();return g};
  const grade=(g,y0,y1,lo,hi)=>{const p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i++){const t=Math.max(0,Math.min(1,(p.getY(i)-y0)/(y1-y0))),f=lo+(hi-lo)*t;c.setXYZ(i,c.getX(i)*f,c.getY(i)*f,c.getZ(i)*f)}return g};
  // --- pine tree: flared trunk, five ragged tiers
  const pine=[];
  pine.push({geo:new THREE.CylinderGeometry(.3,.62,3.4,7),color:0x6e4a2e,m:M4(0,1.7,0)});
  pine.push({geo:new THREE.CylinderGeometry(.5,.8,.5,7),color:0x5e3f27,m:M4(0,.2,0)});
  [[3.4,2.6,2.7,0x27703a],[2.9,2.4,4.0,0x2f7f3c],[2.3,2.2,5.3,0x378e40],[1.7,2.0,6.5,0x40a046],[1.05,1.8,7.6,0x4db04c]].forEach(([r,h,y,c],i)=>pine.push({geo:new THREE.ConeGeometry(r,h*1.25,i%2?7:8),color:c,m:M4(0,y,0,1,1,1,i*.7)}));
  const pineGeo=grade(lump(mergeParts(pine),.22),0,9,.78,1.12);
  // --- oak: stout trunk with a bough, clustered lumpy crown
  const oak=[];
  oak.push({geo:new THREE.CylinderGeometry(.38,.66,3.6,7),color:0x7d5636,m:M4(0,1.8,0)});
  oak.push({geo:new THREE.CylinderGeometry(.14,.24,1.6,5),color:0x7d5636,m:new THREE.Matrix4().compose(new THREE.Vector3(.55,3.5,0),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.7),new THREE.Vector3(1,1,1))});
  [[2.7,4.8,0,0,0x4fa843],[2.1,6.2,.9,.4,0x62bb4e],[2.0,5.4,-1.3,-.5,0x4a9c40],[1.7,5.6,1.5,-.9,0x58b049],[1.6,6.9,-.5,.5,0x76cc5a],[1.5,4.3,.4,1.3,0x429238]].forEach(([r,y,x,z,c])=>oak.push({geo:new THREE.IcosahedronGeometry(r,1),color:c,m:M4(x,y,z)}));
  const oakGeo=grade(lump(mergeParts(oak),.3),2.5,8.5,.8,1.14);
  // --- rocks
  const rockGeo=grade(lump(mergeParts([{geo:new THREE.DodecahedronGeometry(1,1),color:0x9a948a,m:M4(0,.3,0,1.25,.8,1)},{geo:new THREE.DodecahedronGeometry(.62,0),color:0x7f796f,m:M4(.85,.05,.3)},{geo:new THREE.DodecahedronGeometry(.4,0),color:0xaaa397,m:M4(-.8,0,-.4)}]),.16),-.3,1.1,.75,1.15);
  const mkMat=()=>{const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9});return m};
  const pineMat=mkMat(),oakMat=mkMat();windify(pineMat,uniforms,1);windify(oakMat,uniforms,1.2);
  const trees=[],oaks=[],rocks=[],grass=[],flowers=[];
  for(let i=0;i<9000;i++){
    const x=(rand()-.5)*560,z=(rand()-.5)*560,h=heightAt(x,z);
    if(h<1.5||inRavine(x,z,3))continue;
    const s=slopeAt(x,z);if(s>.75)continue;
    const dens=fbm(x*.02,z*.02,41,3);
    if(dens>.5&&rand()<.8&&trees.length+oaks.length<1900){
      const sc=.8+rand()*.9;(h>14||rand()<.55?trees:oaks).push([x,h-.3,z,sc,rand()*6.28]);
    }else if(rand()<.012&&rocks.length<160)rocks.push([x,h-.2,z,.6+rand()*1.8,rand()*6.28]);
  }
  for(let i=0;i<7000;i++){ // loose rocks on the beach
    const a=rand()*6.283,r=60+rand()*220,x=Math.cos(a)*r,z=Math.sin(a)*r,h=heightAt(x,z);
    if(h>-.3&&h<1.4&&rocks.length<260&&!inRavine(x,z,3))rocks.push([x,h-.1,z,.4+rand()*1.1,rand()*6.28]);
  }
  for(let i=0;i<90000&&grass.length<36000;i++){
    const x=(rand()-.5)*420,z=(rand()-.5)*420,h=heightAt(x,z);
    if(h<2.2||slopeAt(x,z)>.55||inRavine(x,z,2))continue;
    const patch=fbm(x*.05,z*.05,77,2);if(patch<.34)continue;
    const clump=fbm(x*.35,z*.35,12,2); // grass grows in clumps with bare gaps between
    if(clump<.36&&rand()<.8)continue;
    grass.push([x,h-.05,z,(.55+rand()*.9)*(.7+patch*.6),rand()*6.28]);
    if(rand()<.05)flowers.push([x+rand(),h,z+rand(),rand()]);
  }
  if(opts.noTrees){trees.length=0;oaks.length=0;rocks.length=0;flowers.length=0}
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
  group.userData.trees=[{kind:"pine_log",im:pineIm,list:trees},{kind:"oak_log",im:oakIm,list:oaks}];group.userData.rocks=rocks;group.userData.grassIm={im:null,list:grass};
  // grass tuft: several bent blades, dark at the root and bright at the tip
  const tuft=(()=>{const P=[],Cc=[],blades=[[0,0,1,.0],[.14,.05,.8,1.2],[-.13,.04,.9,2.3],[.05,-.14,.65,3.6],[-.07,.13,.75,4.7],[.2,-.08,.5,5.5]];
    for(const [ox,oz,hh,ang] of blades){const ca=Math.cos(ang),sa=Math.sin(ang),w=.075,lean=.18*hh;
      const pt=(x,y,z)=>[ox+x*ca-z*sa+ (sa*lean*(y>.5?1:0)),y*hh,oz+x*sa+z*ca+(-ca*lean*(y>.5?1:0))];
      const tri=[pt(-w,0,0),pt(w,0,0),pt(0,1,0)],cl=[[.55,.62,.5],[.55,.62,.5],[1.15,1.15,1.05]];
      for(let k=0;k<3;k++){P.push(...tri[k]);Cc.push(...cl[k])}
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(P,3));g.setAttribute("color",new THREE.Float32BufferAttribute(Cc,3));g.computeVertexNormals();return g})();
  const blade=tuft;
  const gMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,side:THREE.DoubleSide});windify(gMat,uniforms,2.2);
  const gm=inst(blade,gMat,grass,(o,i)=>new THREE.Color().setHSL(.23+hash2(i,4,4)*.1,.6,.36+hash2(i,6,1)*.16),false);gm.receiveShadow=false;
  group.add(gm);group.userData.grassIm.im=gm;
  // pixel flowers: small cubes
  const fGeo=mergeParts([{geo:new THREE.BoxGeometry(.34,.08,.12),color:0xffffff,m:M4(0,.78,0)},{geo:new THREE.BoxGeometry(.12,.08,.34),color:0xffffff,m:M4(0,.78,0)},{geo:new THREE.BoxGeometry(.12,.1,.12),color:0xffd23a,m:M4(0,.82,0)},{geo:new THREE.BoxGeometry(.05,.75,.05),color:0x3c8a3a,m:M4(0,.37,0)}]);
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
export function buildStall(x,y,z,ry,label=["MARKET","sell here, press E"]){
  const grp=new THREE.Group();
  const parts=[];
  const K=hasModel("k/stall-red");
  if(!K)parts.push({geo:new THREE.BoxGeometry(5,1.1,1.6),color:0xa87a4a,m:M4(0,.55,0)});
  if(!K)parts.push({geo:new THREE.BoxGeometry(5.3,.14,1.9),color:0xc79a62,m:M4(0,1.15,0)});
  if(!K)[[-2.5,-.7],[2.5,-.7],[-2.5,.8],[2.5,.8]].forEach(([px,pz])=>parts.push({geo:new THREE.CylinderGeometry(.1,.12,3.6,6),color:0x8a6540,m:M4(px,1.8,pz)}));
  if(!K)parts.push({geo:new THREE.BoxGeometry(5.2,.16,.2),color:0x8a6540,m:M4(0,3.55,-.7)});
  // striped awning, slanted
  if(!K)for(let i=0;i<10;i++)parts.push({geo:new THREE.BoxGeometry(.52,.1,2.4),color:i%2?0xf5f0e6:0xd8432f,m:new THREE.Matrix4().compose(new THREE.Vector3(-2.35+i*.52,3.7,.2),new THREE.Quaternion().setFromEuler(new THREE.Euler(.28,0,0)),new THREE.Vector3(1,1,1))});
  // crates and barrels
  parts.push({geo:new THREE.BoxGeometry(.9,.8,.9),color:0xb48a54,m:M4(-3.4,.4,.6,1,1,1,.3)},{geo:new THREE.BoxGeometry(.8,.7,.8),color:0x9c7444,m:M4(-3.3,1.15,.55,1,1,1,-.2)},{geo:new THREE.CylinderGeometry(.5,.45,1.1,8),color:0x6a5a4a,m:M4(3.5,.55,.5)});
  // fish on ice
  [[-1.3,0xaec7da],[-.6,0x6f9a4b],[.1,0xb5707a],[.9,0x34527d]].forEach(([fx,c],i)=>parts.push({geo:new THREE.IcosahedronGeometry(.28,0),color:c,m:M4(fx,1.32,.1,1.6,.6,.8,i)}));
  const body=new THREE.Mesh(mergeParts(parts),new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9}));
  body.castShadow=body.receiveShadow=true;grp.add(body);
  if(K)for(const x of [-1.5,1.5]){const m=model("k/stall-red");m.scale.setScalar(3.4);m.position.set(x,0,-.2);m.rotation.y=Math.PI;grp.add(m)}
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.28),new THREE.MeshStandardMaterial({map:labelTexture(label),roughness:.8}));
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
    if(h<2.4||slopeAt(x,z)>.6||inRavine(x,z,3)||fbm(x*.02,z*.02,41,3)<.42)continue;
    (rand()<.12?spots.glowcap:spots.mushroom).push({x,y:h-.02,z,s:1+rand()*.9,ry:rand()*6.28,alive:true});
  }
  for(const d of defs){
    const list=spots[d.kind],im=new THREE.InstancedMesh(d.geo,d.mat,list.length),m=new THREE.Matrix4();
    list.forEach((o,i)=>{m.compose(new THREE.Vector3(o.x,o.y,o.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),o.ry),new THREE.Vector3(o.s,o.s,o.s));im.setMatrixAt(i,m);o.m=m.clone()});
    im.castShadow=true;im.frustumCulled=false;group.add(im);out.push({kind:d.kind,im,list});
  }
  group.userData.nodes=out;return group;
}

/** The forest built from the Quaternius Stylized Nature kit (models/nature). Falls back to the procedural one if the models cannot load. */
export async function buildForest(rand,uniforms){
  const names=[...HOUSE_MODELS,"k/stall-red","k/tree","k/tree-high","k/tree-high-round","k/tree-crooked","k/rock-large","k/rock-small","k/rock-wide","n/Rock_Medium_1","n/Rock_Medium_2","n/Rock_Medium_3","n/Pebble_Round_1","n/Pebble_Round_3","n/Pebble_Square_1","n/Fern_1","n/Flower_3_Group","n/Flower_4_Group"];
  let miss;try{miss=await loadModels(names)}catch(e){miss=names}
  if(miss.length>5){console.warn("models missing, procedural forest",miss);return buildForestProcedural(rand,uniforms)}
  const group=buildForestProcedural(rand,uniforms,{noTrees:true});
  const CHUNK=96,up=new THREE.Vector3(0,1,0);
  const place=(variants,list,{target,shadow=true,wind=0,kind,jitter=.25})=>{
    variants=variants.filter(v=>hasModel(v));if(!variants.length||!list.length)return [];
    const buckets=new Map();
    list.forEach((o,k)=>{const v=variants[Math.abs(k*7+((o[0]*13)|0))%variants.length];const key=v+"|"+Math.floor(o[0]/CHUNK)+"|"+Math.floor(o[2]/CHUNK);let b=buckets.get(key);if(!b)buckets.set(key,b={v,list:[]});b.list.push(o)});
    const out=[];
    for(const {v,list:l} of buckets.values()){
      const bb=size(v),s0=target/bb.max.y,ps=parts(v),ims=ps.map(({geometry,material})=>{
        const mat=material.clone();if(wind)windify(mat,uniforms,wind);
        const im=new THREE.InstancedMesh(geometry,mat,l.length);im.castShadow=shadow;im.receiveShadow=true;im.frustumCulled=false;return im});
      const mm=new THREE.Matrix4(),q=new THREE.Quaternion();
      l.forEach((o,i)=>{const s=s0*o[3]*(1+(hash2(i,o[0]|0,2)-.5)*jitter);q.setFromAxisAngle(up,o[4]);
        mm.compose(new THREE.Vector3(o[0],o[1]-bb.min.y*s,o[2]),q,new THREE.Vector3(s,s*(.92+hash2(i,5,o[2]|0)*.16),s));ims.forEach(im=>im.setMatrixAt(i,mm))});
      ims.forEach(im=>{im.instanceMatrix.needsUpdate=true;group.add(im)});
      const multi={ims,setMatrixAt:(i,m)=>ims.forEach(x=>x.setMatrixAt(i,m)),instanceMatrix:{set needsUpdate(v){ims.forEach(x=>x.instanceMatrix.needsUpdate=v)}}};
      out.push({kind,im:multi,ims,list:l});
    }
    return out;
  };
  const trees=[],oaks=[],rocks=[],pebbles=[],ferns=[],flowers=[];
  for(let i=0;i<9000;i++){
    const x=(rand()-.5)*560,z=(rand()-.5)*560,h=heightAt(x,z);
    if(h<1.5||inRavine(x,z,3))continue;
    const s=slopeAt(x,z);if(s>.75)continue;
    const dens=fbm(x*.02,z*.02,41,3);
    if(dens>.5&&rand()<.8&&trees.length+oaks.length<1500){(h>14||rand()<.55?trees:oaks).push([x,h-.15,z,.8+rand()*.6,rand()*6.28])}
    else if(rand()<.012&&rocks.length<160)rocks.push([x,h-.1,z,.8+rand()*1.6,rand()*6.28]);
    else if(dens>.35&&rand()<.03&&ferns.length<140)ferns.push([x,h,z,.8+rand()*.8,rand()*6.28]);
  }
  for(let i=0;i<7000;i++){
    const a=rand()*6.283,r=60+rand()*220,x=Math.cos(a)*r,z=Math.sin(a)*r,h=heightAt(x,z);
    if(h>-.3&&h<1.4&&rocks.length+pebbles.length<420&&!inRavine(x,z,3))(rand()<.3?rocks:pebbles).push([x,h-.05,z,.5+rand()*.9,rand()*6.28]);
  }
  for(let i=0;i<40000&&flowers.length<420;i++){
    const x=(rand()-.5)*420,z=(rand()-.5)*420,h=heightAt(x,z);
    if(h<2.4||slopeAt(x,z)>.5||inRavine(x,z,2)||fbm(x*.05,z*.05,77,2)<.4)continue;
    flowers.push([x,h-.02,z,.8+rand()*.5,rand()*6.28]);
  }
  const tg=[...place(["k/tree-high","k/tree-high","k/tree"],trees,{target:9,kind:"pine_log",wind:.7}),...place(["k/tree-high-round","k/tree","k/tree-crooked","k/tree-high-round"],oaks,{target:7.5,kind:"oak_log",wind:.9})];
  group.userData.trees=tg;
  group.userData.rockGroups=[...place(["n/Rock_Medium_1","n/Rock_Medium_2","n/Rock_Medium_3"],rocks,{target:1.6,shadow:true}),...place(["n/Pebble_Round_1","n/Pebble_Round_3","n/Pebble_Square_1"],pebbles,{target:.5,shadow:false})];
  place(["n/Fern_1"],ferns,{target:.9,wind:1.4,shadow:false});
  place(["n/Flower_3_Group","n/Flower_4_Group"],flowers,{target:.55,wind:1.6,shadow:false});
  group.userData.rocks=rocks.map(o=>{const c=[o[0],o[1],o[2],o[3]*.62,o[4]];Object.defineProperty(c,"gone",{get:()=>o.gone});return c});
  return group;
}
