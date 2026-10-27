import * as THREE from "three";
import {heightAt,slopeAt} from "./terrain.js";
import {RAV,ravPoint,shelf,pathCenter} from "./ravine.js";
import {buildStall} from "./props.js";
import {cabin} from "./town.js";
import {makeCharacter,animateCharacter,defaultLook} from "./character.js";
const lam=(c,o={})=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:.9,...o});
const rockM=[lam(0x8a8a86),lam(0x77777a),lam(0x9a968c)];
function add(p,geo,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,shadow=true){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);o.castShadow=shadow;o.receiveShadow=true;p.add(o);return o}
function boulder(p,r,x,y,z,rand,sy=.8){const g=new THREE.IcosahedronGeometry(r,1);const pos=g.attributes.position;const kk=new Map();for(let i=0;i<pos.count;i++){const key=pos.getX(i).toFixed(3)+pos.getY(i).toFixed(3)+pos.getZ(i).toFixed(3);if(!kk.has(key))kk.set(key,1+(rand()-.5)*.24);const k=kk.get(key);pos.setXYZ(i,pos.getX(i)*k,pos.getY(i)*k,pos.getZ(i)*k)}g.computeVertexNormals();return add(p,g,rockM[(rand()*3)|0],x,y,z,rand()*3,rand()*3,rand()*3,1,sy,1)}
function flatSpot(cx,cz,r,maxRng){let lo=1e9,hi=-1e9,s=0;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const h=heightAt(cx+i*r/2,cz+j*r/2);lo=Math.min(lo,h);hi=Math.max(hi,h);s+=h}return {rng:hi-lo,mean:s/25,hi}}
const norm=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a};
/** Landmarks: lighthouse, shipwreck, waterfall cave, village with its own market. */
export class POIs{
  constructor({scene,rand,pickups,fx,dockA,stallPos,avoid}){
    Object.assign(this,{scene,rand,pickups,fx,dockA,stallPos,avoid});
    this.group=new THREE.Group();scene.add(this.group);this.blockers=[];this.embers=[];this.list=[];this.villagers=[];this.t=0;this.misty=[];
    this.coastPoint=(a)=>{for(let r=330;r>60;r-=1)if(heightAt(Math.cos(a)*r,Math.sin(a)*r)>.55)return r;return 200};
    this.lighthouse=this.buildLighthouse();this.wreck=this.buildWreck();this.cave=this.buildCave();this.village=this.buildVillage();
  }
  add(name,x,z,y){this.list.push({name,x,z,y})}
  buildLighthouse(){
    // the sharpest point of coast, far from the dock
    let best=null;for(let k=-14;k<=14;k++){const a=this.dockA+Math.PI+k*.06,r=this.coastPoint(a);if(!best||r>best.r)best={a,r}}
    const x=Math.cos(best.a)*(best.r-3),z=Math.sin(best.a)*(best.r-3),base=Math.max(heightAt(x,z),.8);
    const g=new THREE.Group();g.position.set(x,0,z);this.group.add(g);
    for(let i=0;i<9;i++){const a=i/9*6.283;boulder(g,1.8+this.rand()*1.4,Math.cos(a)*5.2,base-.6,Math.sin(a)*5.2,this.rand)}
    boulder(g,4.2,0,base-1.4,0,this.rand,.7);
    const H=22,seg=7,white=lam(0xf4f1ea),red=lam(0xc9382d);
    for(let i=0;i<seg;i++){const y0=base+1+i*(H/seg),r0=3.1-i*.2,r1=3.1-(i+1)*.2;add(g,new THREE.CylinderGeometry(r1,r0,H/seg+.02,9),i%2?red:white,0,y0+H/seg/2,0)}
    const top=base+1+H;
    add(g,new THREE.CylinderGeometry(3.7,3.2,.5,9),lam(0x3a3a40),0,top+.1,0);
    for(let i=0;i<9;i++){const a=i/9*6.283;add(g,new THREE.BoxGeometry(.12,1.1,.12),lam(0x3a3a40),Math.cos(a)*3.55,top+.8,Math.sin(a)*3.55)}
    add(g,new THREE.CylinderGeometry(3.6,3.6,.08,9),lam(0x3a3a40),0,top+1.35,0);
    add(g,new THREE.CylinderGeometry(1.9,1.9,2.2,9),lam(0xfff2b0,{emissive:0xffd96a,emissiveIntensity:1.3,transparent:true,opacity:.92}),0,top+1.5,0);
    add(g,new THREE.ConeGeometry(2.4,1.6,9),red,0,top+3.6,0);add(g,new THREE.SphereGeometry(.25,6,4),lam(0x3a3a40),0,top+4.5,0);
    add(g,new THREE.BoxGeometry(1.1,2,.3),lam(0x6b4a26),0,base+2,3.0);
    const L=new THREE.PointLight(0xfff0c0,40,60);L.position.set(0,top+1.5,0);g.add(L);this.beam=L;
    this.blockers.push({x,z,r:4.4});this.add("Lighthouse",x,z,top);
    // treasure washed up at the foot
    for(let i=0;i<5;i++){const a=i*1.4+.3,px=x+Math.cos(a)*6.5,pz=z+Math.sin(a)*6.5;if(heightAt(px,pz)>.1)this.pickups.addFixed(i%2?"pearl":"coin",px,heightAt(px,pz),pz,300)}
    return {x,z,top,base,door:{x:x,z:z+3.4}};
  }
  buildWreck(){
    const a=this.dockA-1.55,r=this.coastPoint(a)-2,x=Math.cos(a)*r,z=Math.sin(a)*r,y=heightAt(x,z);
    const g=new THREE.Group();g.position.set(x,y-.55,z);g.rotation.set(0,-a+Math.PI/2+.4,0);this.group.add(g);
    const ship=new THREE.Group();ship.rotation.set(.07,0,.3);ship.scale.setScalar(1.3);g.add(ship); // listing on the sand, bow up a bit
    const rand=this.rand,N=15,K=9,L=11;
    const woods=[0x7b5a38,0x6d4e31,0x8a6844,0x5f452c].map(c=>new THREE.Color(c));
    const hull=(scale,inner)=>{
      const rows=[];
      for(let i=0;i<=N;i++){const t=i/N,zz=(t-.5)*L;
        let w=2.15*Math.pow(Math.sin(Math.PI*(.1+.84*t)),.6)*(1-.88*Math.pow(t,4));w=Math.max(.12,w)*scale;
        const h=(1.55+1.1*Math.pow(t,3)+.25*(1-t))*scale,keel=(.55+.4*Math.sin(Math.PI*t))*scale;
        const row=[];for(let k=0;k<K;k++){const th=-Math.PI/2+k/(K-1)*Math.PI,c=Math.pow(Math.max(0,Math.cos(th)),.75);row.push(new THREE.Vector3(w*Math.sin(th),h*(1-c)-keel*.0+(inner?.12:0),zz))}
        rows.push(row)}
      return rows};
    const outer=hull(1,false),innerR=hull(.9,true);
    const pos=[],col=[];const tri=(a,b,c,colr)=>{for(const q of [a,b,c])pos.push(q.x,q.y,q.z);for(let i=0;i<3;i++)col.push(colr.r,colr.g,colr.b)};
    const shade=(c,k)=>c.clone().multiplyScalar(k);
    for(let i=0;i<N;i++)for(let k=0;k<K-1;k++){
      const t=i/N,broken=(t>.42&&t<.7&&k>4&&((i*7+k*3)%5<3))||(t>.78&&k>5&&(i%3===0));
      const c=shade(woods[(k+(i>>1))%4],.85+rand()*.3);
      if(!broken){tri(outer[i][k],outer[i+1][k],outer[i][k+1],c);tri(outer[i][k+1],outer[i+1][k],outer[i+1][k+1],c)}
      const ci=shade(woods[3],.8+rand()*.25);
      if(!broken){tri(innerR[i][k],innerR[i][k+1],innerR[i+1][k],ci);tri(innerR[i][k+1],innerR[i+1][k+1],innerR[i+1][k],ci)}
    }
    // stern transom and bow stem
    const tr=[outer[0][0],outer[0][K-1],innerR[0][K-1],innerR[0][0]];tri(outer[0][0],outer[0][K-1],outer[0][4],woods[1]);tri(outer[0][0],outer[0][4],outer[0][K-1],woods[1]);
    const gg=new THREE.BufferGeometry();gg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));gg.setAttribute("color",new THREE.Float32BufferAttribute(col,3));gg.computeVertexNormals();
    const hm=new THREE.Mesh(gg,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,side:THREE.DoubleSide}));hm.castShadow=hm.receiveShadow=true;ship.add(hm);
    // ribs showing through the broken side, a keel beam and gunwale rails
    const dark=lam(0x4a3522),mid=lam(0x6a4a30);
    for(let i=1;i<N-1;i+=2){const t=i/N;if(t<.38||t>.78)continue;for(let k=0;k<K-1;k++){const p0=innerR[i][k],p1=innerR[i][k+1],d=p1.clone().sub(p0),len=d.length();
      const m=add(ship,new THREE.BoxGeometry(.13,.13,len+.05),dark,(p0.x+p1.x)/2,(p0.y+p1.y)/2,(p0.z+p1.z)/2);m.lookAt(ship.localToWorld(p1.clone()));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.clone().normalize())}}
    add(ship,new THREE.BoxGeometry(.28,.3,L*.9),dark,0,-.02,0);
    // deck planks over the stern and a stern cabin with a broken roof
    for(let i=0;i<5;i++)add(ship,new THREE.BoxGeometry(2.5-i*.05,.1,.8),mid,0,1.05,-L/2+.8+i*.95,0,0,(rand()-.5)*.08);
    add(ship,new THREE.BoxGeometry(.18,1.6,2.8),mid,-1.55,1.9,-3.7);add(ship,new THREE.BoxGeometry(.18,1.3,2.8),mid,1.55,1.75,-3.7,0,0,.06);add(ship,new THREE.BoxGeometry(3.2,1.7,.18),mid,0,1.9,-5.1);
    for(let i=0;i<3;i++)add(ship,new THREE.BoxGeometry(3.4,.1,.8),dark,(rand()-.5)*.6,2.78+i*.02,-4.7+i*1.1,0,0,.12);
    add(ship,new THREE.BoxGeometry(.7,.9,.5),lam(0x5aa0c8,{emissive:0x153a55}),0,2.1,-5.2); // cabin window
    // mast stump, boom and a torn sail
    add(ship,new THREE.CylinderGeometry(.16,.24,5.6,7),mid,.1,3.5,.9,.08,0,.3);
    add(ship,new THREE.CylinderGeometry(.08,.1,4.2,6),mid,1.7,5.3,.5,0,0,Math.PI/2-.2);
    {const sg=new THREE.PlaneGeometry(3,3.4,5,6),sp=sg.attributes.position;for(let i=0;i<sp.count;i++){const yy=sp.getY(i);sp.setZ(i,Math.sin(sp.getX(i)*2+yy)*.25+(rand()-.5)*.1);if(yy<-.6&&rand()<.55)sp.setY(i,yy+rand()*1.1)}sg.computeVertexNormals();
     add(ship,sg,lam(0xe6dcc2,{side:THREE.DoubleSide}),.5,4.3,.6,.0,Math.PI/2-.2,.1)}
    // props: barrels, a chest, an anchor, a rudder, rope coil
    for(const [bx,bz,s] of [[.7,-1.4,1],[-.4,-2.4,.9]]){add(ship,new THREE.CylinderGeometry(.4*s,.34*s,.85*s,9),lam(0x8a5a30),bx,.55+.43*s,bz);for(const yy of [.25,.7])add(ship,new THREE.CylinderGeometry(.42*s,.42*s,.07,9),lam(0x3a3a40),bx,.55+yy*s,bz)}
    add(ship,new THREE.BoxGeometry(1,.6,.7),lam(0x7a4a28),.2,.7,2.3,0,.3,0);add(ship,new THREE.BoxGeometry(1.05,.18,.75),lam(0x5a3a20),.2,1.08,2.3,0,.3,0);add(ship,new THREE.BoxGeometry(.2,.2,.1),lam(0xe0b030),.2,.95,2.64,0,.3,0);
    {const an=new THREE.Group();add(an,new THREE.CylinderGeometry(.07,.07,1.6,6),lam(0x3a3a40),0,0,0);add(an,new THREE.TorusGeometry(.55,.07,5,10,Math.PI),lam(0x3a3a40),0,-.8,0,0,0,Math.PI);add(an,new THREE.BoxGeometry(.7,.1,.1),lam(0x3a3a40),0,.6,0);an.position.set(2.6,.5,3.8);an.rotation.set(.2,.4,1.1);g.add(an)}
    add(ship,new THREE.BoxGeometry(.12,1.8,1.1),mid,0,.6,-L/2-.3,0,0,.15);
    // sand piled against the hull
    for(let i=0;i<7;i++){const sa=i/7*6.28,m=add(g,new THREE.IcosahedronGeometry(1.8,1),lam(0xdcc98f),Math.cos(sa)*2.6,.1,Math.sin(sa)*5.5,0,0,0,1,.35,1,false)}
    this.blockers.push({x,z,r:2.4,oval:{a:g.rotation.y,hl:4.8,hw:1.8}});this.add("Shipwreck",x,z,y);
    const spots=[[0,0.5],[-.8,-1.5],[.5,2.6],[.2,-3.6],[1.2,-.6],[-1,1.8]];
    spots.forEach(([lx,lz],i)=>{const c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y),wx=x+lx*c+lz*s,wz=z-lx*s+lz*c;this.pickups.addFixed(["bottle","coin","pearl","bottle","coin","shell"][i],wx,Math.max(y,heightAt(wx,wz))+.12,wz,240)});
    return {x,z};
  }
  rockDome(R,hs,opts={}){
    // a hollow, flat-shaded rock shell. Optional doorway facing `face` (radians).
    const {nu=18,nv=8,face=null,door=.27,noise=.55,moss=true}=opts,rand=this.rand;
    const pos=[],col=[],ring=[];
    const grid=[];for(let j=0;j<=nv;j++){const row=[];const ph=j/nv*(Math.PI*.5*.98);for(let i=0;i<nu;i++){const th=i/nu*Math.PI*2,k=(j===nv?0:1)*(1+(rand()-.5)*noise*.5);const rr=R*Math.sin(ph)*(1+(rand()-.5)*noise*.4)+0;const yy=R*hs*Math.cos(ph)*(1+(rand()-.5)*noise*.3);row.push(new THREE.Vector3(Math.cos(th)*rr,yy-(j===nv?.4:0),Math.sin(th)*rr))}grid.push(row)}
    for(let i=0;i<nu;i++)grid[0][i].copy(grid[0][0]).y+=0; // single apex
    const greys=[0x8c8a84,0x7a7a7c,0x9a968a,0x6f6f72].map(c=>new THREE.Color(c)),mossC=new THREE.Color(0x5f8a4a);
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
      const i2=(i+1)%nu,a=grid[j][i],b=grid[j][i2],c=grid[j+1][i2],d=grid[j+1][i];
      const thc=(i+.5)/nu*Math.PI*2;
      if(face!==null&&j>=Math.floor(nv*.38)){let da=Math.atan2(Math.sin(thc-face),Math.cos(thc-face));if(Math.abs(da)<door*(1.3-j/nv*.5)+(j===nv-1?0:0))continue}
      const base=greys[(rand()*4)|0].clone().multiplyScalar(.82+rand()*.3);
      const up=(j<nv*.6)&&moss&&rand()<.55;if(up)base.lerp(mossC,.55);
      for(const [p,q,r2] of [[a,b,d],[b,c,d]])for(const v of [p,q,r2]){pos.push(v.x,v.y,v.z);col.push(base.r,base.g,base.b)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3));geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95,side:THREE.DoubleSide}));m.castShadow=m.receiveShadow=true;return m;
  }
  buildCave(){
    const R0=RAV,sh=shelf(),[cx0,cz0]=ravPoint(sh.u,sh.vc+1.7),y=heightAt(...ravPoint(sh.u,sh.vc)),x=cx0,z=cz0;
    const face=Math.atan2(-Math.cos(R0.th),Math.sin(R0.th)),back=face+Math.PI; // doorway looks out over the ravine
    const g=new THREE.Group();g.position.set(x,y,z);this.group.add(g);
    const R=4.9;
    g.add(this.rockDome(R,.66,{nu:20,nv:9,face,door:.27,noise:.45}));
    add(g,new THREE.CircleGeometry(R-.3,16),lam(0x3b3a3a),0,.06,0,-Math.PI/2,0,0,1,1,1,false);
    for(let i=0;i<12;i++){const a=i/12*6.283;if(Math.abs(norm(a-face))<.35)continue;boulder(g,.9+this.rand()*.8,Math.cos(a)*(R+.1),.1,Math.sin(a)*(R+.1),this.rand,.8)}
    for(const s2 of [-1,1]){const aa=face+s2*.34;boulder(g,1.05,Math.cos(aa)*(R-.5),1.2,Math.sin(aa)*(R-.5),this.rand,1.7)}
    boulder(g,1.1,Math.cos(face)*(R-.7),3.0,Math.sin(face)*(R-.7),this.rand,.65);
    for(let i=0;i<12;i++){const a=this.rand()*6.283,rr=this.rand()*R*.6;add(g,new THREE.ConeGeometry(.14+this.rand()*.12,.6+this.rand()*.7,5),lam(0x8a8680),Math.cos(a)*rr,R*.66*Math.cos(Math.asin(Math.min(.95,rr/R)))-.5,Math.sin(a)*rr,Math.PI,0,0)}
    const cm=lam(0x7ad8ff,{emissive:0x2a9ac8,emissiveIntensity:1.1,roughness:.2});
    for(let c=0;c<5;c++){const ca=back+(c-2)*.55,cr=R*.6;for(let q=0;q<3;q++)add(g,new THREE.ConeGeometry(.2+this.rand()*.12,.9+this.rand()*1.1,5),cm,Math.cos(ca)*cr+(this.rand()-.5)*.8,.5+this.rand()*.3,Math.sin(ca)*cr+(this.rand()-.5)*.8,(this.rand()-.5)*.6,0,(this.rand()-.5)*.6)}
    const L=new THREE.PointLight(0x5ad8ff,30,14);L.position.set(0,2.2,0);g.add(L);
    for(const s2 of [-1,1]){const aa=face+s2*.42,tx=Math.cos(aa)*(R+.9),tz=Math.sin(aa)*(R+.9);add(g,new THREE.CylinderGeometry(.07,.09,1.6,5),lam(0x5a3a1e),tx,.8,tz);add(g,new THREE.SphereGeometry(.24,6,5),lam(0xffa43a,{emissive:0xff8a1a,emissiveIntensity:1.8}),tx,1.75,tz);const tl=new THREE.PointLight(0xff9a3a,14,9);tl.position.set(tx,1.9,tz);g.add(tl)}
    this.blockers.push({x,z,ring:{r:R,half:1.1,face,gap:.33}});
    this.add("Lava ravine cave",x,z,y);
    // ---- lava floor, glowing and animated
    const lavaM=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},
      vertexShader:"varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
      fragmentShader:"varying vec3 vW;uniform float uTime;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}void main(){vec2 p=vW.xz*.35;float a=n(p+vec2(uTime*.08,0.))+.5*n(p*2.3-vec2(0.,uTime*.12))+.25*n(p*5.1+uTime*.05);a/=1.75;float crust=smoothstep(.42,.58,a);vec3 hot=mix(vec3(1.,.35,.04),vec3(1.,.82,.2),smoothstep(.3,.5,a));vec3 c=mix(hot*.95,vec3(.13,.05,.04),crust);gl_FragColor=vec4(c,1.);}"});
    this.lava=lavaM;
    {const [mx,mz]=ravPoint(R0.L/2,0),ly=R0.Yf+.18,seg=new THREE.Mesh(new THREE.PlaneGeometry(R0.L,R0.w0*2+.6),lavaM);seg.rotation.x=-Math.PI/2;seg.rotation.z=-R0.th;seg.position.set(mx,ly,mz);this.group.add(seg);
     for(const uu of [0,R0.L]){const [ex,ez]=ravPoint(uu,0),cap=new THREE.Mesh(new THREE.CircleGeometry(R0.w0+.3,14),lavaM);cap.rotation.x=-Math.PI/2;cap.position.set(ex,ly,ez);this.group.add(cap)}
     for(let i=0;i<4;i++){const [lx,lz]=ravPoint(8+i*18,0),pl=new THREE.PointLight(0xff6a1a,60,34);pl.position.set(lx,ly+3,lz);this.group.add(pl);this.glows=(this.glows||[]).concat(pl);this.embers.push(new THREE.Vector3(lx,ly,lz))}}
    // ---- waterfall pouring down the head wall into the lava (steam where they meet)
    {const wfM=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{uTime:{value:0}},
      vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:"varying vec2 vUv;uniform float uTime;float h(float n){return fract(sin(n)*43758.5);}void main(){float col=floor(vUv.x*9.);float s=h(col)*.6+.5;float f=fract(vUv.y*3.2*s+uTime*(1.1+h(col+3.)*.6));float streak=smoothstep(.0,.35,f)*.5+.35;float edge=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);vec3 c=mix(vec3(.45,.78,.95),vec3(1.),streak);gl_FragColor=vec4(c,(.65+.3*streak)*edge);}"});
     this.waterfall=wfM;const N=26,W=1.7,P=[],UV=[],I=[];
     for(let i=0;i<=N;i++){const t=1-i/N,d=R0.w0*.0+R0.w0+R0.ww*t+(t>.97?0:0);for(const sgn of [-1,1]){const [px,pz]=ravPoint(-d,sgn*W);const hh=heightAt(px,pz);const [ix,iz]=ravPoint(-d+.45,sgn*W);P.push(ix,hh+.22,iz);UV.push(sgn<0?0:1,i/N)}
      if(i<N){const k=i*2;I.push(k,k+1,k+2,k+1,k+3,k+2)}}
     const wg=new THREE.BufferGeometry();wg.setAttribute("position",new THREE.Float32BufferAttribute(P,3));wg.setAttribute("uv",new THREE.Float32BufferAttribute(UV,2));wg.setIndex(I);
     this.group.add(new THREE.Mesh(wg,wfM));
     // stream above the lip
     const [sx0,sz0]=ravPoint(-(R0.w0+R0.ww)-.2,0),[sx1,sz1]=ravPoint(-(R0.w0+R0.ww)-9,0);
     for(let i=0;i<=8;i++){const q=i/8,px=sx0+(sx1-sx0)*q,pz=sz0+(sz1-sz0)*q;add(this.group,new THREE.CylinderGeometry(1.7-q*.3,1.7-q*.3,.12,8),lam(0x59b4e2,{transparent:true,opacity:.85,roughness:.2}),px,heightAt(px,pz)+.08,pz,0,0,0,1,1,1,false)}
     const [fx,fz]=ravPoint(-R0.w0+1.5,0);this.misty.push(new THREE.Vector3(fx,R0.Yf+.5,fz));
    }
    // ---- warning signs where the path starts, and loot on the way down
    {const [sx,sz]=ravPoint(R0.pathU0+2,R0.w0+R0.ww+1.8),sg=new THREE.Group();sg.position.set(sx,heightAt(sx,sz),sz);sg.rotation.y=-R0.th+Math.PI/2;this.group.add(sg);
     add(sg,new THREE.BoxGeometry(.18,1.9,.18),lam(0x6b4a26),0,.95,0);add(sg,new THREE.BoxGeometry(2.2,.9,.14),lam(0xd8432f),0,1.9,0);add(sg,new THREE.BoxGeometry(1.9,.2,.16),lam(0xfff1b0),0,1.9,0)}
    const kinds=["crystal","glowcap","pearl","coin","crystal","glowcap","coin","pearl"];
    const drop=(u,v,k)=>{const [px,pz]=ravPoint(u,v),h=heightAt(px,pz);this.pickups.addFixed(kinds[(this.rand()*kinds.length)|0],px,h+.1,pz,k)};
    for(let i=0;i<7;i++){const u=R0.shelfU+2+i*((R0.pathU0-R0.shelfU-4)/6);drop(u,pathCenter(u)+(this.rand()-.5)*1.4,300+this.rand()*200)}
    for(let i=0;i<5;i++){const a=back+(i-2)*.5,rr=R*.5;this.pickups.addFixed(kinds[(this.rand()*kinds.length)|0],x+Math.cos(a)*rr,y+.1,z+Math.sin(a)*rr,260+this.rand()*200)}
    return {x,z,y};
  }
  buildVillage(){
    let spot=null;
    for(let k=0;k<8000&&!spot;k++){
      const a=this.rand()*6.283,r=40+this.rand()*110,cx=Math.cos(a)*r,cz=Math.sin(a)*r,f=flatSpot(cx,cz,34,3);
      if(f.mean>2.5&&f.mean<9&&f.rng<2.4&&Math.hypot(cx-this.stallPos.x,cz-this.stallPos.z)>110&&Math.hypot(cx-this.lighthouse.x,cz-this.lighthouse.z)>60&&!this.avoid(cx,cz))spot={x:cx,z:cz,y:f.hi+.1};
    }
    if(!spot){const a=2.6,cx=Math.cos(a)*120,cz=Math.sin(a)*120;spot={x:cx,z:cz,y:heightAt(cx,cz)+.1}}
    const {x,z,y}=spot,g=new THREE.Group();g.position.set(x,y,z);this.group.add(g);
    add(g,new THREE.CylinderGeometry(19,20,1.6,14),lam(0xb7a27a),0,-.75,0,0,0,0,1,1,1,false); // packed-earth square
    const cols=[0xe5654a,0x4a8be5,0xe5b84a,0x6bbf5a,0xb36be0,0xe56ba8];
    const houses=[];
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3,rr=14;const h=cabin(cols[i]);h.position.set(Math.cos(a)*rr,0,Math.sin(a)*rr);h.rotation.y=-a-Math.PI/2;g.add(h);
      this.blockers.push({x:x+Math.cos(a)*rr,z:z+Math.sin(a)*rr,r:4.3})}
    // well in the middle, market stall facing the square
    const well=new THREE.Group();add(well,new THREE.CylinderGeometry(1.2,1.3,1,10),rockM[0],0,.5,0);add(well,new THREE.CylinderGeometry(.9,.9,.1,10),lam(0x3a7aa8),0,.9,0);
    for(const s of [-1,1])add(well,new THREE.BoxGeometry(.14,1.8,.14),lam(0x6b4a26),s*1.0,1.8,0);add(well,new THREE.BoxGeometry(2.6,.14,1.1),lam(0x9a4a35),0,2.8,0,0,0,0);g.add(well);
    this.blockers.push({x,z,r:1.6});
    const stall=buildStall(0,0,0,0,["VILLAGE","wood & forage pay more"]);const sa=Math.PI*.9;stall.position.set(Math.cos(sa)*5.5,.05,Math.sin(sa)*5.5);stall.rotation.y=-sa+Math.PI/2+Math.PI;g.add(stall);
    const sp={x:x+Math.cos(sa)*5.5,z:z+Math.sin(sa)*5.5,y:y};
    // lamp posts
    for(let i=0;i<4;i++){const a=i/4*6.283+.8;add(g,new THREE.CylinderGeometry(.07,.09,2.6,6),lam(0x3a3a40),Math.cos(a)*9,1.3,Math.sin(a)*9);add(g,new THREE.SphereGeometry(.28,6,4),lam(0xfff1b0,{emissive:0xffd96a,emissiveIntensity:1.2}),Math.cos(a)*9,2.7,Math.sin(a)*9)}
    // villagers
    const keys=["baker","fisher","lumberjack","villager","farmer"];
    keys.forEach((k,i)=>{const c=makeCharacter(defaultLook(i*3+1),k);const a=i/5*6.283;c.position.set(x+Math.cos(a)*7,y,z+Math.sin(a)*7);this.scene.add(c);
      this.villagers.push({mesh:c,home:{x,z,y},target:null,wait:1+this.rand()*4})});
    this.blockers.push({x:sp.x,z:sp.z,r:3.2});
    this.add("Village",x,z,y);
    return {x,z,y,stall:sp};
  }
  /** True if a walker at (x,z) is inside a solid landmark. */
  blocked(x,z){
    for(const b of this.blockers){
      const dx=x-b.x,dz=z-b.z,d=Math.hypot(dx,dz);
      if(b.ring){if(d<b.ring.r+.9&&d>b.ring.r-1.2){if(Math.abs(norm(Math.atan2(dz,dx)-b.ring.face))>b.ring.gap)return true}}
      else if(b.oval){const c=Math.cos(-b.oval.a),s=Math.sin(-b.oval.a),lx=dx*c-dz*s,lz=dx*s+dz*c;if(Math.abs(lx)<b.oval.hw&&Math.abs(lz)<b.oval.hl)return true}
      else if(d<b.r)return true;
    }
    return false;
  }
  punchAt(x,z,dx,dz){
    const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;let best=null,bd=2.5;
    for(const v of this.villagers){const px=v.mesh.position.x-x,pz=v.mesh.position.z-z,d=Math.hypot(px,pz);if(d<bd&&(px*dx+pz*dz)/(d||1)>.45){bd=d;best=v}}
    if(best){best.stun=.9;best.kx=dx*6.5;best.kz=dz*6.5;best.mesh.userData.hit=.5;best.target=null;best.wait=1.6}
    return best;
  }
  update(dt){
    this.t+=dt;if(this.waterfall)this.waterfall.uniforms.uTime.value=this.t;if(this.lava)this.lava.uniforms.uTime.value=this.t;
    if(this.glows)this.glows.forEach((l,i)=>{l.intensity=55+Math.sin(this.t*1.7+i*2)*14});
    for(const e of this.embers)if(Math.random()<dt*6)this.fx.pixels.emit(new THREE.Vector3(e.x+(Math.random()-.5)*9,e.y,e.z+(Math.random()-.5)*9),1,[0xff7a1a,0xffc23a],{speed:.4,up:3.2,size:.12,life:1.6,gravity:-.3});
    for(const m of this.misty)if(Math.random()<dt*10)this.fx.pixels.emit(m,2,[0xffffff,0xcfeeff],{speed:1,up:1.6,size:.14,life:1.1,gravity:-.4});
    if(this.beam)this.beam.intensity=34+Math.sin(this.t*2)*8;
    for(const v of this.villagers){
      const m=v.mesh,p=m.position;let moving=false;
      if(v.stun>0){v.stun-=dt;const nx=p.x+v.kx*dt,nz=p.z+v.kz*dt;if(!this.blocked(nx,nz)){p.x=nx;p.z=nz}v.kx*=Math.max(0,1-dt*5);v.kz*=Math.max(0,1-dt*5);p.y=Math.max(heightAt(p.x,p.z),.15);animateCharacter(m,dt,0,this.t);continue}
      if(!v.target){v.wait-=dt;if(v.wait<=0){const a=this.rand()*6.283,r=3+this.rand()*13;v.target={x:v.home.x+Math.cos(a)*r,z:v.home.z+Math.sin(a)*r};if(this.blocked(v.target.x,v.target.z))v.target=null;else v.wait=0}}
      if(v.target){const dx=v.target.x-p.x,dz=v.target.z-p.z,d=Math.hypot(dx,dz);if(d<.4){v.target=null;v.wait=2+this.rand()*6}else{const nx=p.x+dx/d*1.5*dt,nz=p.z+dz/d*1.5*dt;if(this.blocked(nx,nz)){v.target=null;v.wait=1}else{p.x=nx;p.z=nz;m.rotation.y=Math.atan2(dx,dz);moving=true}}}
      p.y=Math.max(heightAt(p.x,p.z),.15);animateCharacter(m,dt,moving?1:0,this.t);
    }
  }
}
