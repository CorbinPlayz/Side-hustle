(function(){
var T={};
function V3(x,y,z){this.x=x||0;this.y=y||0;this.z=z||0}
V3.prototype.set=function(x,y,z){this.x=x;this.y=y;this.z=z;return this};
V3.prototype.setScalar=function(s){this.x=this.y=this.z=s;return this};
V3.prototype.length=function(){return Math.hypot(this.x,this.y,this.z)};
V3.prototype.divideScalar=function(s){this.x/=s;this.y/=s;this.z/=s;return this};
V3.prototype.copy=function(o){this.x=o.x;this.y=o.y;this.z=o.z;return this};
T.Vector3=V3;
T.Quaternion=function(){this.x=this.y=this.z=0;this.w=1};
T.Quaternion.prototype.setFromUnitVectors=function(){return this};
T.Quaternion.prototype.copy=function(){return this};
T.Color=function(h){this.r=this.g=this.b=0};
T.Color.prototype.setHex=function(){return this};T.Color.prototype.setRGB=function(r,g,b){this.r=r;this.g=g;this.b=b;return this};
function Layers(){this.mask=1}
Layers.prototype.set=function(l){this.mask=1<<l};Layers.prototype.enable=function(l){this.mask|=1<<l};Layers.prototype.test=function(o){return (this.mask&o.mask)!==0};
function Euler(){this.x=this.y=this.z=0;this.order="XYZ"}
Euler.prototype.set=function(x,y,z){this.x=x;this.y=y;this.z=z};
function O3(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion=new T.Quaternion();this.layers=new Layers();this.children=[];this.visible=true;this.matrix={};this.castShadow=false;this.receiveShadow=false}
O3.prototype.add=function(c){this.children.push(c);return this};
O3.prototype.remove=function(c){var i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1)};
O3.prototype.traverse=function(f){f(this);this.children.forEach(function(c){c.traverse(f)})};
O3.prototype.updateMatrix=function(){};
T.Object3D=O3;T.Group=function(){O3.call(this)};T.Group.prototype=Object.create(O3.prototype);
T.Scene=function(){O3.call(this);this.background=null;this.fog=null};T.Scene.prototype=Object.create(O3.prototype);
T.Fog=function(){};
function Attr(arr,n){this.array=arr;this.itemSize=n;this.count=arr.length/n;this.needsUpdate=false}
Attr.prototype.getX=function(i){return this.array[i*this.itemSize]};Attr.prototype.getY=function(i){return this.array[i*this.itemSize+1]};Attr.prototype.getZ=function(i){return this.array[i*this.itemSize+2]};
Attr.prototype.setY=function(i,v){this.array[i*this.itemSize+1]=v};
T.Float32BufferAttribute=function(a,n){return new Attr(new Float32Array(a),n)};
function Geo(verts){this.attributes={position:new Attr(new Float32Array(verts),3)}}
Geo.prototype.rotateX=function(a){var p=this.attributes.position.array,c=Math.cos(a),s=Math.sin(a);for(var i=0;i<p.length;i+=3){var y=p[i+1],z=p[i+2];p[i+1]=y*c-z*s;p[i+2]=y*s+z*c}return this};
Geo.prototype.rotateZ=function(){return this};
Geo.prototype.translate=function(x,y,z){var p=this.attributes.position.array;for(var i=0;i<p.length;i+=3){p[i]+=x;p[i+1]+=y;p[i+2]+=z}return this};
Geo.prototype.setAttribute=function(n,a){this.attributes[n]=a};
Geo.prototype.computeVertexNormals=function(){T._normals=(T._normals||0)+1};
T.PlaneGeometry=function(w,h,sw,sh){var v=[];for(var j=0;j<=sh;j++)for(var i=0;i<=sw;i++)v.push(-w/2+w*i/sw,h/2-h*j/sh,0);Geo.call(this,v)};T.PlaneGeometry.prototype=Object.create(Geo.prototype);
["Box","Cylinder","Cone","Sphere","Icosahedron","Dodecahedron","Ring"].forEach(function(n){T[n+"Geometry"]=function(){var v=[];for(var i=0;i<60;i++)v.push(Math.sin(i),Math.cos(i*1.3)*5,Math.sin(i*2.1));Geo.call(this,v)};T[n+"Geometry"].prototype=Object.create(Geo.prototype)});
["MeshLambertMaterial","MeshBasicMaterial","MeshPhongMaterial"].forEach(function(n){T[n]=function(o){o=o||{};for(var k in o)this[k]=o[k];this.opacity=o.opacity==null?1:o.opacity;this.color=new T.Color()}});
T.Mesh=function(g,m){O3.call(this);this.geometry=g;this.material=m};T.Mesh.prototype=Object.create(O3.prototype);
T.Mesh.prototype.clone=function(){var m=new T.Mesh(this.geometry,this.material);m.position=new V3(this.position.x,this.position.y,this.position.z);return m};
T.InstancedMesh=function(g,m,n){T.Mesh.call(this,g,m);this.count=n;this.instanceMatrix={needsUpdate:false};this.instanceColor=null;this._set=0};T.InstancedMesh.prototype=Object.create(T.Mesh.prototype);
T.InstancedMesh.prototype.setMatrixAt=function(i){if(i>=this.count&&this.count>0&&this._max==null){}this._set++};
T.InstancedMesh.prototype.setColorAt=function(){if(!this.instanceColor)this.instanceColor={needsUpdate:false}};
T.HemisphereLight=function(){O3.call(this)};T.HemisphereLight.prototype=Object.create(O3.prototype);
T.DirectionalLight=function(){O3.call(this);this.shadow={mapSize:{set:function(){}},camera:{left:0,right:0,top:0,bottom:0,near:0,far:0},bias:0};this.target=null};T.DirectionalLight.prototype=Object.create(O3.prototype);
T.PerspectiveCamera=function(f,a){O3.call(this);this.aspect=a;this.updateProjectionMatrix=function(){}};T.PerspectiveCamera.prototype=Object.create(O3.prototype);
T.PCFSoftShadowMap=1;T.BackSide=1;T.DoubleSide=2;
T.WebGLRenderer=function(o){this.shadowMap={enabled:false};this.log={renders:0,views:[],size:null};var self=this;
 this.setPixelRatio=function(){};this.setSize=function(w,h){self.log.size=[w,h]};this.setScissorTest=function(b){self.scissor=b};
 this.setViewport=function(x,y,w,h){self.vp=[x,y,w,h]};this.setScissor=function(){};
 this.render=function(s,c){self.log.renders++;self.log.views.push(self.vp);self.log.lastCam=c.position;if(self.log.views.length>8)self.log.views.shift()};this.dispose=function(){};window.__renderer=this};
window.THREE=T;
})();
