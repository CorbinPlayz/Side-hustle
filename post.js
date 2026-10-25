import * as THREE from "three";
/** Small post pipeline: scene -> HDR target -> bright pass + blur (bloom) -> tone map, vignette, gentle colour grade. */
export function createPost(renderer){
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));
  const cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const scn=new THREE.Scene();scn.add(quad);
  const type=THREE.HalfFloatType;
  let W=2,H=2;
  const sceneRT=new THREE.WebGLRenderTarget(W,H,{type,samples:4});
  const mk=()=>new THREE.WebGLRenderTarget(2,2,{type,depthBuffer:false});
  const half=mk(),q1=mk(),q2=mk();
  const vs="varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
  const bright=new THREE.ShaderMaterial({uniforms:{t:{value:null},th:{value:.9}},vertexShader:vs,depthTest:false,depthWrite:false,
    fragmentShader:`varying vec2 vUv;uniform sampler2D t;uniform float th;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=smoothstep(th,th+.8,l);gl_FragColor=vec4(c*k,1.);}`});
  const blur=new THREE.ShaderMaterial({uniforms:{t:{value:null},d:{value:new THREE.Vector2()}},vertexShader:vs,depthTest:false,depthWrite:false,
    fragmentShader:`varying vec2 vUv;uniform sampler2D t;uniform vec2 d;void main(){
      vec3 c=texture2D(t,vUv).rgb*.227;
      c+=(texture2D(t,vUv+d*1.38).rgb+texture2D(t,vUv-d*1.38).rgb)*.3162;
      c+=(texture2D(t,vUv+d*3.23).rgb+texture2D(t,vUv-d*3.23).rgb)*.0703;
      gl_FragColor=vec4(c,1.);}`});
  const comp=new THREE.ShaderMaterial({uniforms:{s:{value:null},b:{value:null},exposure:{value:1.1},bloom:{value:.55}},vertexShader:vs,depthTest:false,depthWrite:false,
    fragmentShader:`varying vec2 vUv;uniform sampler2D s,b;uniform float exposure,bloom;
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){
        vec3 c=texture2D(s,vUv).rgb+texture2D(b,vUv).rgb*bloom;
        c=aces(c*exposure);
        float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.14);          // a touch more colour
        c=pow(c,vec3(.97));c=mix(c,c*c*(3.-2.*c),.18);                        // gentle contrast curve
        vec2 q=vUv-.5;c*=1.-dot(q,q)*.55;                                      // vignette
        c=pow(c,vec3(1./2.2));
        gl_FragColor=vec4(c,1.);}`});
  function pass(mat,target){quad.material=mat;renderer.setRenderTarget(target);renderer.render(scn,cam)}
  return {
    resize(w,h,pr){
      W=Math.max(2,Math.floor(w*pr));H=Math.max(2,Math.floor(h*pr));
      sceneRT.setSize(W,H);half.setSize(Math.max(2,W>>1),Math.max(2,H>>1));q1.setSize(Math.max(2,W>>2),Math.max(2,H>>2));q2.setSize(q1.width,q1.height);
    },
    render(scene,camera){
      renderer.setRenderTarget(sceneRT);renderer.render(scene,camera);
      bright.uniforms.t.value=sceneRT.texture;pass(bright,half);
      blur.uniforms.t.value=half.texture;blur.uniforms.d.value.set(1/half.width,0);pass(blur,q1);
      blur.uniforms.t.value=q1.texture;blur.uniforms.d.value.set(0,1/q1.height);pass(blur,q2);
      blur.uniforms.t.value=q2.texture;blur.uniforms.d.value.set(1.5/q2.width,0);pass(blur,q1);
      blur.uniforms.t.value=q1.texture;blur.uniforms.d.value.set(0,1.5/q1.height);pass(blur,q2);
      comp.uniforms.s.value=sceneRT.texture;comp.uniforms.b.value=q2.texture;pass(comp,null);
    }
  };
}
