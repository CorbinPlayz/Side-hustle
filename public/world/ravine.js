/** The ravine: a deep cut through the central hills with lava at the bottom, a waterfall at its head and a cliff path down to a cave ledge. Pure maths so terrain, props and gameplay all agree on it. */
export const RAV={x0:-40,z0:-40,th:.785,L:70,w0:6,ww:11,Yf:2.5,pathU0:62,pathU1:30,shelfU:13,tcShelf:.62,tcEnd:.62};
const ux=Math.cos(RAV.th),uz=Math.sin(RAV.th),vx=-uz,vz=ux;
const clamp=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));
const sm=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
/** u along the ravine (0 at the head), v across (+ is the cave side), d distance from the ravine's centre line (a capsule). */
export function ravCoords(x,z){const dx=x-RAV.x0,dz=z-RAV.z0,u=dx*ux+dz*uz,v=dx*vx+dz*vz,uc=clamp(u,0,RAV.L);return {u,v,d:Math.hypot(u-uc,v)}}
export function ravPoint(u,v){return [RAV.x0+ux*u+vx*v,RAV.z0+uz*u+vz*v]}
export const inRavine=(x,z,pad=0)=>ravCoords(x,z).d<RAV.w0+RAV.ww+pad;
/** true when standing here means standing in lava */
export function inLava(x,z){return ravCoords(x,z).d<RAV.w0+.6&&true}
const pathT=u=>RAV.tcEnd+(1-RAV.tcEnd)*sm((u-RAV.pathU1)/(RAV.pathU0-RAV.pathU1));
const pathW=u=>1.6+2.2*clamp((RAV.pathU1-u)/6+.5,0,1);
export function applyRavine(x,z,h0,base){
  const {u,v,d}=ravCoords(x,z),R=RAV;
  if(d>R.w0+R.ww+3)return h0;
  const t=clamp((d-R.w0)/R.ww,0,1),s=sm(t);
  let h=Math.min(h0,R.Yf+(h0-R.Yf)*s);
  if(v>0&&u>R.shelfU-4&&u<R.pathU0+5){
    const tc=pathT(u),vc=R.w0+tc*R.ww,pw=pathW(u),dv=Math.abs(v-vc);
    const w=(1-sm((dv-pw)/1.3))*sm((u-(R.shelfU-4))/3)*(1-sm((u-R.pathU0)/4));
    if(w>0){const [cx,cz]=ravPoint(u,vc),hb=base(cx,cz),Hc=R.Yf+(hb-R.Yf)*sm(tc);h=h*(1-w)+Hc*w}
  }
  return h;
}
/** shelf centre: where the cave sits */
export function shelf(){const R=RAV,u=(R.shelfU+R.pathU1)/2-1,vc=R.w0+R.tcShelf*R.ww;return {u,vc}}
export function onPath(x,z,pad=0){const {u,v}=ravCoords(x,z),R=RAV;if(v<=0||u<R.shelfU-3||u>R.pathU0+3)return false;return Math.abs(v-(R.w0+pathT(u)*R.ww))<pathW(u)+pad}
export const pathCenter=u=>RAV.w0+pathT(u)*RAV.ww;
