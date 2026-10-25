import * as THREE from "three";
import {fbm} from "./noise.js";
export const WORLD={size:640,seed:7,waterY:0};
const R=250;
/** Forest island height: beach ring, rolling hills, a pond in the middle. Pure function so the server can reuse it later. */
export function heightAt(x,z){
  const r=Math.hypot(x,z),a=Math.atan2(z,x);
  const wob=(fbm(Math.cos(a)*1.6+5,Math.sin(a)*1.6+5,WORLD.seed,3)-.45)*120; // ragged coastline
  const rr=r-wob;
  let m=1-rr/R; // 1 at centre, 0 at coast
  m=Math.max(-1,m);
  let h=m>0?Math.pow(m,.75)*22:m*30;
  h+=(fbm(x*.012,z*.012,WORLD.seed+3,4)-.45)*16*Math.max(0,Math.min(1,m*3));
  h+=(fbm(x*.06,z*.06,WORLD.seed+9,2)-.5)*1.6*Math.max(0,Math.min(1,m*4));
  // pond
  const pd=Math.hypot(x-40,z+30);
  if(pd<46)h=Math.min(h,-1.5+Math.pow(pd/46,2)*(h+1.5));
  return h-1.2;
}
export function slopeAt(x,z){
  const e=1.2,hx=heightAt(x+e,z)-heightAt(x-e,z),hz=heightAt(x,z+e)-heightAt(x,z-e);
  return Math.hypot(hx,hz)/(2*e);
}
const C=(h)=>new THREE.Color(h);
const SAND=C(0xe6d79c),SAND2=C(0xd7c486),GRASS=C(0x7cc24d),GRASS2=C(0x4f9a3a),FOREST=C(0x2f7a39),ROCK=C(0x8b857a),SNOWY=C(0xf2f6fb);
export function buildTerrain(){
  const N=260,S=WORLD.size;
  const g=new THREE.PlaneGeometry(S,S,N,N);g.rotateX(-Math.PI/2);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,heightAt(p.getX(i),p.getZ(i)));
  const flat=g.toNonIndexed();flat.computeVertexNormals();
  const pos=flat.attributes.position,nor=flat.attributes.normal,col=new Float32Array(pos.count*3);
  const tmp=new THREE.Color();
  for(let i=0;i<pos.count;i+=3){
    const cx=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3,cy=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3,cz=(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;
    const ny=nor.getY(i),n=fbm(cx*.05,cz*.05,WORLD.seed+21,3);
    const jitter=(((cx*12.9898+cz*78.233)%1+1)%1-.5)*.06;
    if(cy<-.2)tmp.copy(SAND2).lerp(C(0xa89a6a),Math.min(1,-cy/6));
    else if(cy<1.6)tmp.copy(SAND).lerp(SAND2,n);
    else if(ny<.78)tmp.copy(ROCK).lerp(GRASS2,Math.max(0,ny-.6)*2);
    else{
      const t=Math.min(1,(cy-1.6)/16);
      tmp.copy(GRASS).lerp(GRASS2,t*.8+n*.4);
      if(n>.58&&cy>4)tmp.lerp(FOREST,.75);
      if(cy<3)tmp.lerp(SAND,Math.max(0,(3-cy)/6)*.4);
    }
    tmp.offsetHSL(0,0,jitter);
    for(let k=0;k<3;k++){col[(i+k)*3]=tmp.r;col[(i+k)*3+1]=tmp.g;col[(i+k)*3+2]=tmp.b}
  }
  flat.setAttribute("color",new THREE.BufferAttribute(col,3));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95,metalness:0});
  const mesh=new THREE.Mesh(flat,mat);mesh.receiveShadow=true;mesh.castShadow=false;
  return mesh;
}
