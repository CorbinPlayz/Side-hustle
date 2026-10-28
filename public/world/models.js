import * as THREE from "three";
/** Tiny glTF/GLB reader (no external loader needed): meshes, node transforms, PBR colours, embedded textures, vertex colours.
 *  Models are cached; use model(name) for a clone or parts(name) to get flattened geometry for instancing. */
const BASE=new URL("./models/",import.meta.url).href;
const cache=new Map(),imgCache=new Map();
const COMP={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const NUM={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function parseGLB(buf){
  const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x46546C67)throw new Error("not a glb");
  let off=12,json=null,bin=null;
  while(off<buf.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);const chunk=buf.slice(off+8,off+8+len);
    if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(chunk));else if(type===0x004E4942)bin=chunk;off+=8+len}
  return {json,bin};
}
function readAccessor(json,bins,i){
  const a=json.accessors[i],bv=json.bufferViews[a.bufferView],T=COMP[a.componentType],n=NUM[a.type],buf=bins[bv.buffer||0];
  const base=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride;
  if(!stride||stride===n*T.BYTES_PER_ELEMENT)return new T(buf,base,a.count*n);
  const out=new T(a.count*n),src=new DataView(buf);
  for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const o=base+k*stride+c*T.BYTES_PER_ELEMENT;out[k*n+c]=T===Float32Array?src.getFloat32(o,true):T===Uint16Array?src.getUint16(o,true):T===Uint32Array?src.getUint32(o,true):T===Uint8Array?src.getUint8(o):src.getInt16(o,true)}
  return out;
}
async function imageTexture(key,getBlob){
  if(imgCache.has(key))return imgCache.get(key);
  const p=(async()=>{const bmp=await createImageBitmap(await getBlob());const t=new THREE.Texture(bmp);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;t.anisotropy=4;return t})();
  imgCache.set(key,p);return p;
}
async function build(json,bins,url){
  const textures=[];
  for(let i=0;i<(json.textures||[]).length;i++){
    const im=json.images[json.textures[i].source],bv=im.bufferView!=null?json.bufferViews[im.bufferView]:null;
    if(bv){const bytes=new Uint8Array(bins[bv.buffer||0],bv.byteOffset||0,bv.byteLength),key=url+"#"+i+":"+bv.byteLength+":"+bytes[bv.byteLength>>1]+bytes[bv.byteLength>>2];
      textures.push(await imageTexture(key,()=>new Blob([bytes],{type:im.mimeType||"image/png"})))}
    else textures.push(await imageTexture(new URL(im.uri,url).href,async()=>(await fetch(new URL(im.uri,url).href)).blob()));
  }
  const mats=(json.materials||[]).map(m=>{
    const p=m.pbrMetallicRoughness||{},c=p.baseColorFactor||[1,1,1,1];
    const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(c[0],c[1],c[2],THREE.LinearSRGBColorSpace),roughness:p.roughnessFactor??.9,metalness:Math.min(.2,p.metallicFactor??0),flatShading:false});
    if(p.baseColorTexture)mat.map=textures[p.baseColorTexture.index];
    if(m.alphaMode==="MASK")mat.alphaTest=m.alphaCutoff??.5;else if(m.alphaMode==="BLEND"){mat.transparent=true;mat.opacity=c[3]}
    if(m.doubleSided)mat.side=THREE.DoubleSide;
    if(m.emissiveFactor)mat.emissive=new THREE.Color(...m.emissiveFactor);
    mat.name=m.name||"";return mat});
  const defMat=new THREE.MeshStandardMaterial({color:0xcccccc,roughness:.9});
  const meshes=(json.meshes||[]).map(m=>m.primitives.map(pr=>{
    const g=new THREE.BufferGeometry(),at=pr.attributes;
    g.setAttribute("position",new THREE.BufferAttribute(readAccessor(json,bins,at.POSITION),3));
    if(at.NORMAL)g.setAttribute("normal",new THREE.BufferAttribute(readAccessor(json,bins,at.NORMAL),3));
    if(at.TEXCOORD_0)g.setAttribute("uv",new THREE.BufferAttribute(readAccessor(json,bins,at.TEXCOORD_0),2));
    let vc=false;if(at.COLOR_0){const a=json.accessors[at.COLOR_0],raw=readAccessor(json,bins,at.COLOR_0),n=NUM[a.type];let f=raw;
      if(raw.constructor!==Float32Array){const d=raw.constructor===Uint8Array?255:65535;f=new Float32Array(raw.length);for(let i=0;i<raw.length;i++)f[i]=raw[i]/d}
      g.setAttribute("color",new THREE.BufferAttribute(f,n));vc=true}
    if(pr.indices!=null){const idx=readAccessor(json,bins,pr.indices);g.setIndex(new THREE.BufferAttribute(idx instanceof Uint8Array?Uint16Array.from(idx):idx,1))}
    if(!at.NORMAL)g.computeVertexNormals();
    let mat=pr.material!=null?mats[pr.material]:defMat;if(vc){mat=mat.clone();mat.vertexColors=true}
    return {g,mat};
  }));
  const root=new THREE.Group();root.name=url.split("/").pop();
  const addNode=(ni,parent)=>{const n=json.nodes[ni],o=new THREE.Group();o.name=n.name||"";
    if(n.matrix)o.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale)}
    if(n.mesh!=null)for(const {g,mat} of meshes[n.mesh]){const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;o.add(m)}
    parent.add(o);(n.children||[]).forEach(c=>addNode(c,o))};
  const sc=json.scenes[json.scene||0];sc.nodes.forEach(n=>addNode(n,root));
  root.updateMatrixWorld(true);return root;
}
async function loadOne(name){
  const url=BASE+name+".glb",r=await fetch(url);if(!r.ok)throw new Error("missing model "+name);
  const {json,bin}=parseGLB(await r.arrayBuffer());return build(json,[bin],url);
}
/** Load a list of model names (files in models/). Missing ones are skipped and reported. */
export async function loadModels(names){
  const miss=[];await Promise.all([...new Set(names)].map(async n=>{if(cache.has(n))return;try{cache.set(n,await loadOne(n))}catch(e){miss.push(n);console.error("model "+n+": "+e.message)}}));
  return miss;
}
export const hasModel=n=>cache.has(n);
/** A fresh copy you can place in the scene. Geometry and materials are shared. */
export function model(name,{shadow=true}={}){const m=cache.get(name);if(!m)return null;const c=m.clone(true);c.traverse(o=>{if(o.isMesh){o.castShadow=shadow;o.receiveShadow=true}});return c}
/** Flattened meshes (world matrices baked into cloned geometry) for building InstancedMeshes. */
export function parts(name){const m=cache.get(name);if(!m)return [];const out=[];m.updateMatrixWorld(true);
  m.traverse(o=>{if(o.isMesh){const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);out.push({geometry:g,material:o.material})}});return out}
export function size(name){const m=cache.get(name);if(!m)return null;return new THREE.Box3().setFromObject(m)}
