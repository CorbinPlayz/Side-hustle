import * as THREE from "three";
import {heightAt,WORLD} from "./terrain.js";
import {SUN_DIR,HAZE} from "./sky.js";
/** Faceted sea: vertices wobble in the shader, flat normals come from screen derivatives, foam hugs the shore. */
export function buildWater(fogDensity){
  const S=1800,N=300;
  const g=new THREE.PlaneGeometry(S,S,N,N);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,shore=new Float32Array(p.count);
  for(let i=0;i<p.count;i++){
    const h=heightAt(p.getX(i),p.getZ(i));
    shore[i]=Math.max(0,Math.min(1,-h/9));
  }
  g.setAttribute("aShore",new THREE.BufferAttribute(shore,1));
  const mat=new THREE.ShaderMaterial({
    transparent:true,
    uniforms:{uTime:{value:0},uSun:{value:SUN_DIR},uHaze:{value:HAZE},uFog:{value:fogDensity},
      uShallow:{value:new THREE.Color(0x2fb4cc)},uDeep:{value:new THREE.Color(0x15479a)},uSky:{value:new THREE.Color(0x8fc4f0)}},
    vertexShader:`attribute float aShore;varying vec3 vW;varying float vShore;uniform float uTime;
      void main(){
        vec3 p=position;
        float w=.34*sin(p.x*.11+uTime*.9)+.26*sin(p.z*.16+uTime*.7)+.16*sin((p.x+p.z)*.3+uTime*1.5)+.08*sin((p.x-p.z)*.55+uTime*2.1);
        p.y+=w*mix(.35,1.,aShore);
        vec4 wp=modelMatrix*vec4(p,1.);vW=wp.xyz;vShore=aShore;
        gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader:`varying vec3 vW;varying float vShore;uniform vec3 uSun,uHaze,uShallow,uDeep,uSky;uniform float uTime,uFog;
      float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));if(n.y<0.)n=-n;
        vec3 v=normalize(cameraPosition-vW);
        float fres=pow(1.-max(dot(n,v),0.),3.);
        vec3 base=mix(uShallow,uDeep,smoothstep(0.,.75,vShore));
        float facet=h21(floor(vW.xz*.4)+floor(n.xz*60.))*.06;
        base+=facet;
        vec3 c=mix(base,uSky,fres*.45);c*=.82+.3*max(dot(n,normalize(uSun)),0.);
        vec3 r=reflect(-normalize(uSun),n);
        c+=vec3(1.,.93,.75)*pow(max(dot(r,v),0.),160.)*1.1;
        float shoreLine=vShore+.035*sin(uTime*1.2+vW.x*.5+vW.z*.35);
        float foam=smoothstep(.07,.0,shoreLine)*.9+smoothstep(.015,.0,abs(fract(vShore*9.-uTime*.12)-.5)-.47)*.0;
        foam*=.7+.3*h21(floor(vW.xz*.8));
        c=mix(c,vec3(1.),clamp(foam,0.,1.));
        float d=length(cameraPosition-vW);float f=1.-exp(-d*d*uFog*uFog*.55);
        c=mix(c,uHaze,clamp(f,0.,1.));
        gl_FragColor=vec4(c,mix(.82,1.,clamp(vShore*3.,0.,1.)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  mat.extensions={derivatives:true};
  const m=new THREE.Mesh(g,mat);m.position.y=WORLD.waterY;m.renderOrder=1;
  return m;
}

/** Same wave formula as the shader, so bobbers and boats sit on the visible surface. */
export function waveHeight(x,z,t){
  const h=heightAt(x,z),shore=Math.max(0,Math.min(1,-h/9));
  const w=.34*Math.sin(x*.11+t*.9)+.26*Math.sin(z*.16+t*.7)+.16*Math.sin((x+z)*.3+t*1.5)+.08*Math.sin((x-z)*.55+t*2.1);
  return WORLD.waterY+w*(.35+.65*shore);
}
