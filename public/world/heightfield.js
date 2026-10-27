import {fbm} from "./noise.js";
import {applyRavine} from "./ravine.js";
export const WORLD={size:640,seed:7,waterY:0};
const R=250;
/** Forest island height: beach ring, rolling hills, a pond in the middle. Pure function so the server can reuse it later. */
export function baseH(x,z){
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

export function heightAt(x,z){return applyRavine(x,z,baseH(x,z),baseH)}
