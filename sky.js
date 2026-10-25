import * as THREE from "three";
export const SUN_DIR=new THREE.Vector3(.55,.42,.35).normalize();
export const HAZE=new THREE.Color(0xc4dcec);
export function buildSky(){
  const mat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{uSun:{value:SUN_DIR},uHaze:{value:HAZE},uTop:{value:new THREE.Color(0x3f86d6)},uMid:{value:new THREE.Color(0x8cc0ec)},uTime:{value:0}},
    vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vDir;uniform vec3 uSun,uHaze,uTop,uMid;
      void main(){
        vec3 d=normalize(vDir);float h=clamp(d.y,0.,1.);
        vec3 c=mix(uHaze,uMid,smoothstep(0.,.18,h));c=mix(c,uTop,smoothstep(.15,.8,h));
        float s=max(dot(d,normalize(uSun)),0.);
        c+=vec3(1.,.82,.55)*pow(s,6.)*.35+vec3(1.,.95,.8)*pow(s,400.)*3.;
        if(d.y<0.)c=mix(uHaze,uHaze*.9,clamp(-d.y*4.,0.,1.));
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const m=new THREE.Mesh(new THREE.SphereGeometry(1500,32,16),mat);m.renderOrder=-10;m.frustumCulled=false;
  return m;
}
/** Low-poly clouds: squashed icosahedrons drifting slowly. */
export function buildClouds(rand){
  const grp=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:1,emissive:0xe8f0ff,emissiveIntensity:.75,fog:false});
  for(let c=0;c<22;c++){
    const cl=new THREE.Group(),n=3+Math.floor(rand()*4);
    for(let i=0;i<n;i++){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),mat);
      m.scale.set(18+rand()*20,7+rand()*6,14+rand()*12);m.position.set((i-n/2)*18+rand()*8,rand()*5,rand()*10);m.rotation.y=rand()*3;
      cl.add(m);
    }
    const a=rand()*Math.PI*2,r=300+rand()*500;
    cl.position.set(Math.cos(a)*r,130+rand()*70,Math.sin(a)*r);cl.userData.speed=.6+rand()*1.2;grp.add(cl);
  }
  return grp;
}
