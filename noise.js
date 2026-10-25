/* Small deterministic noise helpers shared by the world builder. */
export function hash2(x,y,seed){
  let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(seed|0,1274126177))|0;
  h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;
  return (h>>>0)/4294967295;
}
function sm(t){return t*t*(3-2*t)}
export function vnoise(x,y,seed){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const a=hash2(xi,yi,seed),b=hash2(xi+1,yi,seed),c=hash2(xi,yi+1,seed),d=hash2(xi+1,yi+1,seed);
  const u=sm(xf),v=sm(yf);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
export function fbm(x,y,seed,oct=4){
  let s=0,amp=.5,f=1;
  for(let i=0;i<oct;i++){s+=amp*vnoise(x*f,y*f,seed+i*17);amp*=.5;f*=2.03}
  return s; // 0..~0.94
}
export function mulberry(seed){
  let a=seed>>>0;
  return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296};
}
