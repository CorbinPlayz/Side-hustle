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
  h+=(fbm(x*.31+9,z*.31+4,WORLD.seed+31,2)-.5)*.55*Math.max(0,Math.min(1,m*5)); // little lumps so the ground is not planar
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
const SAND=C(0xe9dca4),SAND2=C(0xd9c78c),WET=C(0xb9a672),DRY=C(0xf0e6b8);
const GRASSES=[C(0x86c94f),C(0x6fb847),C(0x9ad05a),C(0x5da63f),C(0xa4c850)],DEEP=C(0x2f7a39),MEAD=C(0xb4d65c),ROCK=C(0x8b857a),ROCK2=C(0xa39b8a),DIRT=C(0xa27a4c),DIRT2=C(0x8a6540);
export function buildTerrain(){
  const N=380,S=WORLD.size;
  const g=new THREE.PlaneGeometry(S,S,N,N);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,step=S/N;
  for(let i=0;i<p.count;i++){ // jitter the grid so triangles are not a regular lattice, then drop onto the height field
    let x=p.getX(i),z=p.getZ(i);
    if(Math.abs(x)<S/2-1&&Math.abs(z)<S/2-1){x+=(fbm(x*.9,z*.9,3,1)-.5)*step*.9;z+=(fbm(x*.9+7,z*.9+3,4,1)-.5)*step*.9}
    p.setXYZ(i,x,heightAt(x,z),z);
  }
  const flat=g.toNonIndexed();flat.computeVertexNormals();
  const pos=flat.attributes.position,nor=flat.attributes.normal,col=new Float32Array(pos.count*3);
  const tmp=new THREE.Color(),tmp2=new THREE.Color(),centers=new Float32Array(pos.count/3*2);
  for(let i=0;i<pos.count;i+=3){
    const cx=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3,cy=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3,cz=(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;
    centers[i/3*2]=cx;centers[i/3*2+1]=cz;
    const ny=nor.getY(i),n=fbm(cx*.05,cz*.05,WORLD.seed+21,3),n2=fbm(cx*.13+11,cz*.13,WORLD.seed+5,3),n3=fbm(cx*.4,cz*.4,WORLD.seed+8,2);
    const jitter=(((cx*12.9898+cz*78.233)%1+1)%1-.5)*.1;
    if(cy<-.25)tmp.copy(WET).lerp(C(0x8f8760),Math.min(1,-cy/5));
    else if(cy<.55)tmp.copy(WET).lerp(SAND2,Math.min(1,(cy+.25)/.8)); // damp sand at the waterline
    else if(cy<1.9)tmp.copy(SAND).lerp(DRY,n2).lerp(SAND2,n3*.5);
    else if(ny<.8){ // steep ground: layered rock
      const strata=Math.sin(cy*2.3+n*6)*.5+.5;tmp.copy(ROCK).lerp(ROCK2,strata);
      tmp.lerp(GRASSES[1],Math.max(0,ny-.62)*2.5);
    }else{
      // meadow: patches of different greens, dark forest floor where the woods are thick, pale dry grass on the high bits
      const gi=Math.min(4,Math.floor(n2*5));tmp.copy(GRASSES[gi]).lerp(GRASSES[(gi+2)%5],n3*.6);
      const t=Math.min(1,(cy-1.9)/16);tmp.lerp(DEEP,t*.55+Math.max(0,n-.5)*1.1);
      const dens=fbm(cx*.02,cz*.02,41,3);if(dens>.5)tmp.lerp(DEEP,Math.min(.6,(dens-.5)*2.2));
      if(n2>.64&&cy>3)tmp.lerp(MEAD,.7);
      tmp.lerp(SAND,Math.max(0,(3.2-cy)/3.2)*.5);
      if(n3>.78)tmp.lerp(DIRT,.5); // bare patches
    }
    tmp.offsetHSL((n3-.5)*.02,(n2-.5)*.08,jitter);
    for(let k=0;k<3;k++){col[(i+k)*3]=tmp.r;col[(i+k)*3+1]=tmp.g;col[(i+k)*3+2]=tmp.b}
  }
  flat.setAttribute("color",new THREE.BufferAttribute(col,3));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.97,metalness:0});
  const mesh=new THREE.Mesh(flat,mat);mesh.receiveShadow=true;mesh.castShadow=false;
  /** Wear dirt paths into the ground. segs: [[x0,z0,x1,z1],...], width in metres. */
  mesh.userData.paintPaths=(segs,width=1.7)=>{
    const c=flat.attributes.color,tri=centers.length/2;
    for(let t=0;t<tri;t++){
      const x=centers[t*2],z=centers[t*2+1];let best=1e9;
      for(const [x0,z0,x1,z1] of segs){const dx=x1-x0,dz=z1-z0,l2=dx*dx+dz*dz||1;let u=((x-x0)*dx+(z-z0)*dz)/l2;u=Math.max(0,Math.min(1,u));const d=Math.hypot(x-(x0+dx*u),z-(z0+dz*u));if(d<best)best=d}
      const edge=width*(.8+((t*2654435761>>>0)%100)/250);
      if(best<edge&&heightAt(x,z)>.9){
        const k=best<edge*.55?1:.6,mix=(t%3===0)?DIRT2:DIRT;
        for(let v=0;v<3;v++){const o=(t*3+v)*3;c.array[o]=c.array[o]*(1-k)+mix.r*k;c.array[o+1]=c.array[o+1]*(1-k)+mix.g*k;c.array[o+2]=c.array[o+2]*(1-k)+mix.b*k}
      }
    }
    c.needsUpdate=true;
  };
  return mesh;
}
