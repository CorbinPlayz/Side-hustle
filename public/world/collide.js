/** Circle colliders for trees, rocks and the stall, kept in a coarse grid so lookups are cheap. Felled trees (o.gone) stop blocking. */
const CELL=8;
export function makeCollider(forest,extra=[]){
  const grid=new Map(),key=(i,j)=>i*100003+j;
  const put=(c,i,j)=>{const k=key(i,j);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(c)};
  const add=c=>{const r=c.r+.1;for(let i=Math.floor((c.x-r)/CELL);i<=Math.floor((c.x+r)/CELL);i++)for(let j=Math.floor((c.z-r)/CELL);j<=Math.floor((c.z+r)/CELL);j++)put(c,i,j)};
  for(const g of forest.userData.trees||[])for(const o of g.list)add({x:o[0],z:o[2],r:.55*o[3]+.12,o});
  for(const o of forest.userData.rocks||[])add({x:o[0],z:o[2],r:.85*o[3],o});
  for(const c of extra)add(c);
  return {
    add,
    /** true when a body of radius `pr` at (x,z) would overlap something solid */
    blocked(x,z,pr=.38){
      const a=grid.get(key(Math.floor(x/CELL),Math.floor(z/CELL)));if(!a)return false;
      for(const c of a){if(c.o&&c.o.gone)continue;const d=pr+c.r;const dx=x-c.x,dz=z-c.z;if(dx*dx+dz*dz<d*d)return true}
      return false;
    }
  };
}
