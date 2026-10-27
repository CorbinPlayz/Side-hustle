import * as THREE from "three";
import {fbm} from "./noise.js";
import {WORLD,baseH,slopeAt,heightAt} from "./heightfield.js";
import {ravCoords,RAV,onPath} from "./ravine.js";
export {WORLD,slopeAt,heightAt};
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
    const rc=ravCoords(cx,cz),inR=rc.d<RAV.w0+RAV.ww+.5;
    if(inR&&rc.d<RAV.w0+.3)tmp.set(0x2b2422).lerp(C(0x4a3a30),n3); // basalt floor
    else if(ny>.88&&onPath(cx,cz,-.3)&&cy>RAV.Yf+1)tmp.set(0x8f7a58).lerp(C(0x75633f),n3);
    else if(cy<-.25)tmp.copy(WET).lerp(C(0x8f8760),Math.min(1,-cy/5));
    else if(cy<.55)tmp.copy(WET).lerp(SAND2,Math.min(1,(cy+.25)/.8)); // damp sand at the waterline
    else if(cy<1.9)tmp.copy(SAND).lerp(DRY,n2).lerp(SAND2,n3*.5);
    else if(ny<.8){ // steep ground: layered rock
      const strata=Math.sin(cy*1.7+n*6)*.5+.5;tmp.copy(ROCK).lerp(ROCK2,strata*.7).multiplyScalar(.9);
      tmp.lerp(GRASSES[1],Math.max(0,ny-.62)*2.5);
      if(inR){const dd=cy-RAV.Yf;tmp.multiplyScalar(.75+n3*.25);if(dd<4)tmp.lerp(C(0x3a2a24),1-dd/4);else if(dd>10)tmp.lerp(GRASSES[3],.18)}
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
