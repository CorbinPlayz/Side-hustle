import * as THREE from "three";
import {model,hasModel} from "./models.js";
/** Cabin built from Kenney fantasy-town wall/roof pieces on a 3x3 grid of 2 m cells (door faces +z). Returns null if models are missing. */
export const HOUSE_MODELS=["k/wall-wood","k/wall-wood-door","k/wall-wood-window-glass","k/wall-wood-window-shutters","k/wall-wood-corner","k/roof-high-gable","k/roof-high-gable-end","k/roof-high-gable-top","k/chimney","k/chimney-base","k/chimney-top","k/planks","k/pillar-wood","k/lantern"];
const S=2;
export function cabinK(color=0xe5654a){
  if(!hasModel("k/wall-wood")||!hasModel("k/roof-high-gable"))return null;
  const g=new THREE.Group();
  const put=(n,x,y,z,ry=0,sx=S,sy=S,sz=S)=>{const m=model(n);if(!m)return null;m.position.set(x,y,z);m.rotation.y=ry;m.scale.set(sx,sy,sz);g.add(m);return m};
  // edge directions: outward normal -> rotation so the piece's +x face points out
  const dirs=[{rot:-Math.PI/2,dx:0,dz:1},{rot:Math.PI/2,dx:0,dz:-1},{rot:0,dx:1,dz:0},{rot:Math.PI,dx:-1,dz:0}];
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
    for(const d of dirs){
      const edge=(d.dz&&j===d.dz)||(d.dx&&i===d.dx);if(!edge)continue;
      let n="k/wall-wood";
      if(d.dz===1)n=i===0?"k/wall-wood-door":"k/wall-wood-window-glass";
      else if(d.dx&&j===0)n="k/wall-wood-window-shutters";
      put(n,i*S,0,j*S,d.rot);
    }
  }
  // corner posts
  for(const sx of [-1,1])for(const sz of [-1,1])put("k/pillar-wood",sx*1.5*S,-.12*S,sz*1.5*S,0,S*1.1,S*.98,S*1.1);
  // foundation slab and gable fills (open triangles under the roof ends)
  const stone=new THREE.MeshStandardMaterial({color:0x8d877c,flatShading:true,roughness:.9}),wallM=new THREE.MeshStandardMaterial({color:0x6b4a32,flatShading:true,roughness:.9,side:THREE.DoubleSide});
  const slab=new THREE.Mesh(new THREE.BoxGeometry(6.5,.3,6.5),stone);slab.position.y=.08;slab.receiveShadow=slab.castShadow=true;g.add(slab);
  const sh=new THREE.Shape();sh.moveTo(-3,0);sh.lineTo(3,0);sh.lineTo(0,2.0);sh.closePath();
  for(const sx of [-1,1]){const t=new THREE.Mesh(new THREE.ShapeGeometry(sh),wallM);t.rotation.y=Math.PI/2;t.position.set(sx*2.97,S-.05,0);t.castShadow=true;g.add(t)}
  // roof: one gable, ridge along x, with overhang
  put("k/roof-high-gable",0,S*.98,0,0,3.35*S/1.1,S*1.0,3.55*S/1.1);
  return g;
}
