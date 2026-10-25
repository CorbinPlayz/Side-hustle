import * as THREE from "three";
/** Chunky square particles (splashes, coins, blood-style pops) and expanding water rings. */
export class Pixels{
  constructor(scene,max=900){
    this.max=max;this.i=0;
    this.mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({toneMapped:true}),max);
    this.mesh.frustumCulled=false;this.mesh.count=max;
    this.p=new Float32Array(max*3);this.v=new Float32Array(max*3);this.life=new Float32Array(max);this.max_life=new Float32Array(max);this.size=new Float32Array(max);this.grav=new Float32Array(max);
    const m=new THREE.Matrix4(),c=new THREE.Color(0xffffff);
    for(let k=0;k<max;k++){m.makeScale(0,0,0);this.mesh.setMatrixAt(k,m);this.mesh.setColorAt(k,c)}
    scene.add(this.mesh);this._m=new THREE.Matrix4();this._c=new THREE.Color();
  }
  emit(pos,n,colors,{speed=5,up=4,size=.2,life=.9,gravity=14,spread=1}={}){
    for(let k=0;k<n;k++){
      const i=this.i++%this.max,a=Math.random()*6.283,s=speed*(.3+Math.random()*.7)*spread;
      this.p[i*3]=pos.x;this.p[i*3+1]=pos.y;this.p[i*3+2]=pos.z;
      this.v[i*3]=Math.cos(a)*s;this.v[i*3+1]=up*(.5+Math.random()*.8);this.v[i*3+2]=Math.sin(a)*s;
      this.life[i]=this.max_life[i]=life*(.6+Math.random()*.6);this.size[i]=size*(.6+Math.random()*.8);this.grav[i]=gravity;
      this.mesh.setColorAt(i,this._c.set(colors[(Math.random()*colors.length)|0]));
    }
    this.mesh.instanceColor.needsUpdate=true;
  }
  update(dt){
    const m=this._m;let any=false;
    for(let i=0;i<this.max;i++){
      if(this.life[i]<=0)continue;
      this.life[i]-=dt;any=true;
      if(this.life[i]<=0){m.makeScale(0,0,0);this.mesh.setMatrixAt(i,m);continue}
      this.v[i*3+1]-=this.grav[i]*dt;
      this.p[i*3]+=this.v[i*3]*dt;this.p[i*3+1]+=this.v[i*3+1]*dt;this.p[i*3+2]+=this.v[i*3+2]*dt;
      const k=Math.min(1,this.life[i]/this.max_life[i]*2),s=this.size[i]*k;
      m.makeScale(s,s,s);m.setPosition(this.p[i*3],this.p[i*3+1],this.p[i*3+2]);this.mesh.setMatrixAt(i,m);
    }
    if(any)this.mesh.instanceMatrix.needsUpdate=true;
  }
}
export class Rings{
  constructor(scene,n=14){
    this.items=[];
    const g=new THREE.RingGeometry(.82,1,24);g.rotateX(-Math.PI/2);
    for(let i=0;i<n;i++){
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
      m.visible=false;m.renderOrder=3;scene.add(m);this.items.push({m,t:1,dur:1,max:2});
    }
    this.n=0;
  }
  start(x,y,z,max=2.2,dur=1.1){
    const it=this.items[this.n++%this.items.length];
    it.t=0;it.dur=dur;it.max=max;it.m.position.set(x,y+.04,z);it.m.visible=true;
  }
  update(dt){
    for(const it of this.items){
      if(!it.m.visible)continue;
      it.t+=dt/it.dur;
      if(it.t>=1){it.m.visible=false;continue}
      const s=.2+it.t*it.max;it.m.scale.set(s,1,s);it.m.material.opacity=(1-it.t)*.8;
    }
  }
}
