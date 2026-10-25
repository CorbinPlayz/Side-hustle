import * as THREE from "three";
const WOOD=[0xb98a56,0x8a6540,0xd9b27a],LEAF=[0x4a9d3c,0x6cc455,0x2f7a39];
const CHIP=[0xf0d9a8,0xc99a5b];
/** Logging (axe timing minigame) and mushroom foraging, both selling at the same market. */
export class Jobs{
  constructor({camera,hands,fx,hud,eco,forest,mushrooms}){
    Object.assign(this,{camera,hands,fx,hud,eco});
    this.trees=forest.userData.trees;this.nodes=mushrooms.userData.nodes;
    this.felled=[];this.falling=[];this.t=0;this.tool=0;this.target=null;this.hits=0;this.lastHit=0;this.swing=0;this.regrow=[];
    this._m=new THREE.Matrix4();this._v=new THREE.Vector3();this._d=new THREE.Vector3();
  }
  fwd(){return this.camera.getWorldDirection(this._d).clone()}
  nearestTree(px,pz){
    const f=this.fwd();let best=null,bd=1e9;
    for(const g of this.trees){
      for(let i=0;i<g.list.length;i++){
        const o=g.list[i];if(o.gone)continue;
        const dx=o[0]-px,dz=o[2]-pz,d=Math.hypot(dx,dz);
        if(d<4.6&&d<bd){const dot=(dx*f.x+dz*f.z)/(d||1)/Math.max(.001,Math.hypot(f.x,f.z));if(dot>.55){bd=d;best={g,i,o,d}}}
      }
    }
    return best;
  }
  nearestMushroom(px,pz){
    const f=this.fwd();let best=null,bd=1e9;
    for(const n of this.nodes)for(let i=0;i<n.list.length;i++){
      const o=n.list[i];if(!o.alive)continue;
      const dx=o.x-px,dz=o.z-pz,d=Math.hypot(dx,dz);
      if(d<3.4&&d<bd){const dot=(dx*f.x+dz*f.z)/(d||1)/Math.max(.001,Math.hypot(f.x,f.z));if(dot>.5){bd=d;best={n,i,o,d}}}
    }
    return best;
  }
  pickMushroom(px,pz){
    const t=this.nearestMushroom(px,pz);if(!t)return false;
    const {n,i,o}=t,id=n.kind,ok=this.eco.addItem(id);
    if(!ok){this.hud.toast("Bag full! Sell at the market.","#ff7b6b");return true}
    o.alive=false;this._m.makeScale(0,0,0);n.im.setMatrixAt(i,this._m);n.im.instanceMatrix.needsUpdate=true;
    this.regrow.push({t:this.t+100,kind:"m",n,i});
    const glow=id==="glowcap";
    this.fx.pixels.emit(new THREE.Vector3(o.x,o.y+.4,o.z),glow?22:12,glow?[0x4fe8ff,0xbff6ff,0xffffff]:[0xd8392f,0xffffff,0xf2e8d0],{speed:2.4,up:4,size:.09});
    this.hud.toast(glow?"Found a rare Glowcap!":"Picked a mushroom",glow?"#4fe8ff":"#ff9a8a");
    return true;
  }
  /** Click with the axe equipped: chop the tree in front of you. No timing, just keep chopping. */
  press(px,pz){
    if(this.tool!==1||this.hud.marketOpen)return;
    if(!this.eco.tools.axe){this.hud.toast("You need an axe. Buy one at the market.","#ff7b6b");return}
    this.swing=1;
    const tg=this.nearestTree(px,pz);
    if(!tg){this.hud.toast("Walk up to a tree and face it.");return}
    this.hud.hint("");
    if(this.target!==tg.o){this.target=tg.o;this.hits=0}
    const hp=new THREE.Vector3(tg.o[0],tg.o[1]+1.8,tg.o[2]);
    this.hits++;this.lastHit=this.t;
    this.fx.pixels.emit(hp,14,CHIP,{speed:3.2,up:4.2,size:.13});
    if(this.hits>=this.need){this.fell(tg,px,pz);this.target=null;this.hits=0}
  }
  get need(){return 4-this.eco.up.axe2}
  fell(tg,px,pz){
    const {g,i,o}=tg;o.gone=true;
    const away=new THREE.Vector3(o[0]-px,0,o[2]-pz).normalize();
    const m0=new THREE.Matrix4();g.im.getMatrixAt(i,m0);
    this.falling.push({g,i,o,m0,away,t:0});
    const n=2+((Math.random()*2)|0)+this.eco.up.axe2;let got=0;
    for(let k=0;k<n;k++)if(this.eco.addItem(g.kind))got++;
    this.hud.toast(got?`Timber! +${got} ${g.kind==="oak_log"?"oak":"pine"} log${got>1?"s":""}`:"Bag full! The logs are left behind.",got?"#ffd23a":"#ff7b6b");
    this.regrow.push({t:this.t+90,kind:"t",g,i,o,m0});
  }
  update(dt,px,pz){
    this.t+=dt;
    // falling trees
    for(let k=this.falling.length-1;k>=0;k--){
      const f=this.falling[k];f.t+=dt;const u=Math.min(1,f.t/1.1),ang=u*u*1.45;
      const axis=new THREE.Vector3(0,1,0).cross(f.away).normalize();
      const pivot=new THREE.Vector3(f.o[0],f.o[1],f.o[2]);
      const R=new THREE.Matrix4().makeTranslation(pivot.x,pivot.y,pivot.z).multiply(new THREE.Matrix4().makeRotationAxis(axis,ang)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
      this._m.copy(R).multiply(f.m0);f.g.im.setMatrixAt(f.i,this._m);f.g.im.instanceMatrix.needsUpdate=true;
      if(f.t>1.1){
        this.fx.pixels.emit(new THREE.Vector3(f.o[0]+f.away.x*5,f.o[1]+.4,f.o[2]+f.away.z*5),26,[...LEAF,...WOOD],{speed:3.6,up:3.4,size:.2,life:1.1});
        this._m.makeScale(0,0,0);f.g.im.setMatrixAt(f.i,this._m);f.g.im.instanceMatrix.needsUpdate=true;this.falling.splice(k,1);
      }
    }
    // regrowth
    for(let k=this.regrow.length-1;k>=0;k--){
      const r=this.regrow[k];if(this.t<r.t)continue;
      if(r.kind==="t"){r.g.im.setMatrixAt(r.i,r.m0);r.g.im.instanceMatrix.needsUpdate=true;r.o.gone=false}
      else{r.n.im.setMatrixAt(r.i,r.n.list[r.i].m);r.n.im.instanceMatrix.needsUpdate=true;r.n.list[r.i].alive=true}
      this.regrow.splice(k,1);
    }
    this.swing=Math.max(0,this.swing-dt*3.2);
    if(this.target&&this.t-this.lastHit>6){this.target=null;this.hits=0}
    if(this.tool===1&&!this.hud.marketOpen&&this.eco.tools.axe){
      const tg=this.nearestTree(px,pz);
      if(tg)this.hud.chop(true,{name:tg.g.kind==="oak_log"?"Oak tree":"Pine tree",pos:(tg.o===this.target?this.hits:0)/this.need,text:`Click to chop (${tg.o===this.target?this.hits:0}/${this.need})`});
      else this.hud.chop(false);
    }else this.hud.chop(false);
  }
}
