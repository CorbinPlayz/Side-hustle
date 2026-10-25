import * as THREE from "three";
/** Low-poly fish: a tapered body built from cross-sections, a forked tail, fins and eyes. Faces are coloured per triangle (back, belly, stripes, spots). */
const SHAPES={ // H: body half-height, W: half-width, pk: where the body is deepest (0 nose .. 1 tail)
  slim:{H:.09,W:.07,pk:.45,tail:.2},deep:{H:.21,W:.09,pk:.42,tail:.24},std:{H:.15,W:.1,pk:.42,tail:.22},
  torpedo:{H:.13,W:.11,pk:.4,tail:.3},round:{H:.3,W:.3,pk:.5,tail:.1}
};
const SEG=12,RING=8;
const hash=(a,b,c)=>{const s=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;return s-Math.floor(s)};
export function fishGeometry(f){
  const S=SHAPES[f.shape||"std"],round=f.shape==="round";
  const pos=[],col=[];
  const back=new THREE.Color(f.color),belly=new THREE.Color(f.belly),mid=back.clone().lerp(belly,.5);
  const dark=new THREE.Color(f.stripes||f.color).multiplyScalar(f.stripes?1:.75),spot=new THREE.Color(f.spots||f.color);
  const fin=back.clone().multiplyScalar(.82);
  // body rings
  const rings=[];
  for(let i=0;i<=SEG;i++){
    const t=i/SEG,x=.5-t; // nose at +x
    const tp=Math.pow(t,Math.log(S.pk)/Math.log(.5)); // shift the deepest point
    let r=Math.pow(Math.sin(Math.PI*Math.min(.999,tp*.97+.015)),round?.55:.62);
    r*=1-(round?.3:.62)*Math.pow(t,3.2);
    if(t<.06)r*=.55+t*7; // blunt nose
    const ring=[];
    for(let k=0;k<RING;k++){const a=k/RING*Math.PI*2;ring.push(new THREE.Vector3(x,Math.cos(a)*S.H*r*(Math.cos(a)<0?.9:1),Math.sin(a)*S.W*r))}
    rings.push(ring);
  }
  const tri=(a,b,c,color)=>{for(const p of [a,b,c])pos.push(p.x,p.y,p.z);for(let i=0;i<3;i++)col.push(color.r,color.g,color.b)};
  const pick=(a,b,c)=>{
    const y=(a.y+b.y+c.y)/3,x=(a.x+b.x+c.x)/3;
    if(y<-S.H*.32)return belly;
    if(y<S.H*.08)return mid;
    if(f.stripes&&Math.floor((x+.5)*9)%2===0&&x<.32&&x>-.34)return dark;
    if(f.spots&&hash(Math.round(x*14),Math.round(y*40),Math.round((a.z+b.z+c.z)*20))>.72)return spot;
    return back;
  };
  for(let i=0;i<SEG;i++)for(let k=0;k<RING;k++){
    const a=rings[i][k],b=rings[i][(k+1)%RING],c=rings[i+1][(k+1)%RING],d=rings[i+1][k];
    tri(a,d,b,pick(a,d,b));tri(b,d,c,pick(b,d,c));
  }
  // nose cap and tail cap
  const nose=new THREE.Vector3(.5+.03,0,0);for(let k=0;k<RING;k++)tri(nose,rings[0][(k+1)%RING],rings[0][k],back);
  // forked tail
  const tx=-.5,tl=S.tail+.2,ty=S.H*(round?.9:1.5)+.05;
  const T=(x,y,z)=>new THREE.Vector3(x,y,z);
  for(const z of [-.012,.012]){
    const flip=z<0;
    const p=[T(tx+.02,.02,z),T(tx-tl,ty,z),T(tx-tl*.62,0,z),T(tx-tl,-ty,z),T(tx+.02,-.02,z)];
    if(flip){tri(p[0],p[2],p[1],fin);tri(p[0],p[3],p[2],fin)}else{tri(p[0],p[1],p[2],fin);tri(p[0],p[2],p[3],fin)}
  }
  // dorsal (top) and pectoral (sides) fins
  if(!round){
    const h=S.H*(f.shape==="torpedo"?1.1:1.35);
    for(const z of [-.01,.01]){const fl=z<0,a=T(.18,S.H*.78,z),b=T(-.18,S.H*.7,z),c=T(-.1,S.H+h*.55,z),d=T(.1,S.H*.95,z);
      if(fl){tri(a,c,d,fin);tri(a,b,c,fin)}else{tri(a,d,c,fin);tri(a,c,b,fin)}}
    for(const s of [-1,1]){const w=S.W*.9;const a=T(.22,-S.H*.3,s*w),b=T(.08,-S.H*.35,s*w),c=T(.02,-S.H*.9,s*(w+.1));
      if(s<0){tri(a,b,c,fin);tri(a,c,b,fin)}else{tri(a,c,b,fin);tri(a,b,c,fin)}}
  }else{
    // spikes and little fins on the pufferfish
    for(let i=0;i<22;i++){const u=hash(i,1,2)*6.283,v=hash(i,5,9)*2-1,rr=Math.sqrt(1-v*v)*S.H*.98;
      const p=T(Math.cos(u)*rr*.9,v*S.H,Math.sin(u)*rr),q=p.clone().multiplyScalar(1.28);
      const n=new THREE.Vector3(-p.z,0,p.x).normalize().multiplyScalar(.025);
      tri(p.clone().add(n),q,p.clone().sub(n),new THREE.Color(0xeed9a0));
    }
    for(const s of [-1,1]){const a=T(.12,-.02,s*S.W),b=T(.0,.06,s*(S.W+.1)),c=T(-.06,-.1,s*S.W);tri(a,b,c,fin);tri(a,c,b,fin)}
  }
  // eyes: a white square with a dark pupil on each side
  const ex=.5-.17,ey=S.H*.16*(round?1.4:1),ez=S.W*(round?.74:.5);
  for(const s of [-1,1]){
    const e=.034+(round?.016:0);
    const w=new THREE.Color(0xffffff),k=new THREE.Color(0x14171c);
    const A=(x,y,zz)=>T(ex+x,ey+y,s*(ez+zz));
    const quad=(h,zz,c)=>{const a=A(-h,-h,zz),b=A(h,-h,zz),cc=A(h,h,zz),d=A(-h,h,zz);if(s>0){tri(a,b,cc,c);tri(a,cc,d,c)}else{tri(a,cc,b,c);tri(a,d,cc,c)}};
    quad(e,.006,w);quad(e*.55,.011,k);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.computeVertexNormals();return g;
}
const MAT=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.5,metalness:.05,side:THREE.DoubleSide});
const cache=new Map();
export function fishMesh(f,scale=1){
  let g=cache.get(f.id);if(!g){g=fishGeometry(f);cache.set(f.id,g)}
  const m=new THREE.Mesh(g,MAT);m.scale.setScalar(scale*f.len*1.15);m.castShadow=false;return m;
}
