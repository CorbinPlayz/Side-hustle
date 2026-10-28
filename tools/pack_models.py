#!/usr/bin/env python3
"""Turns the downloaded asset packs (Kenney town kit + furniture, Quaternius Stylized Nature) into small .glb files for the game.
Usage: python3 tools/pack_models.py <folder with the unzipped packs> <output folder, e.g. public/world/models>
All three packs are CC0."""
import sys,os,json,struct,io,shutil,glob
from PIL import Image
src,out=sys.argv[1],sys.argv[2]
def pad4(b,p=b' '):
    return b+p*((4-len(b)%4)%4)
def write_glb(path,j,bin_):
    js=pad4(json.dumps(j,separators=(',',':')).encode())
    bin_=pad4(bin_,b'\0')
    os.makedirs(os.path.dirname(path),exist_ok=True)
    with open(path,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_)))
        f.write(struct.pack('<II',len(js),0x4E4F534A));f.write(js)
        f.write(struct.pack('<II',len(bin_),0x004E4942));f.write(bin_)
# ---- Kenney town kit: already GLB, copy as is
town=glob.glob(os.path.join(src,'*fantasy-town*','Models','GLB format','*.glb'))
for p in town:
    d=os.path.join(out,'k',os.path.basename(p));os.makedirs(os.path.dirname(d),exist_ok=True);shutil.copy(p,d)
tex=glob.glob(os.path.join(src,'*fantasy-town*','Models','GLB format','Textures'))[0]
shutil.copytree(tex,os.path.join(out,'k','Textures'),dirs_exist_ok=True)
print('town',len(town))
# ---- Kenney furniture: OBJ+MTL -> GLB with vertex colours (scaled to metres, centred, sitting on y=0)
FURN=['bedSingle','bedDouble','table','tableRound','tableCloth','chair','chairCushion','chairRounded','bench','benchCushion','stoolBar','lampRoundFloor','lampRoundTable','lampSquareFloor','pottedPlant','plantSmall1','plantSmall2','plantSmall3','rugRectangle','rugRound','rugSquare','bookcaseClosed','bookcaseOpen','sideTable','sideTableDrawers','cabinetBed','cabinetBedDrawer','desk','coatRack','radio','books','cardboardBoxClosed','cardboardBoxOpen','trashcan','kitchenStove','kitchenSink','kitchenCabinet','loungeSofa','pillow','kitchenFridge','washer','bathtub','toilet']
fdir=glob.glob(os.path.join(src,'*furniturePack*','Models'))[0]
def parse_mtl(p):
    m={};cur=None
    for ln in open(p,errors='ignore'):
        t=ln.split()
        if not t:continue
        if t[0]=='newmtl':cur=t[1];m[cur]=[1,1,1]
        elif t[0]=='Kd' and cur:m[cur]=[float(x) for x in t[1:4]]
    return m
def srgb2lin(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
n=0
for name in FURN:
    p=os.path.join(fdir,name+'.obj')
    if not os.path.exists(p):continue
    mats=parse_mtl(os.path.join(fdir,name+'.mtl'));V=[];N=[];cur=[1,1,1];pos=[];nor=[];col=[]
    for ln in open(p,errors='ignore'):
        t=ln.split()
        if not t:continue
        if t[0]=='v':V.append([float(x) for x in t[1:4]])
        elif t[0]=='vn':N.append([float(x) for x in t[1:4]])
        elif t[0]=='usemtl':cur=mats.get(t[1],[1,1,1])
        elif t[0]=='f':
            idx=[x.split('/') for x in t[1:]]
            for k in range(1,len(idx)-1):
                for q in (idx[0],idx[k],idx[k+1]):
                    pos.append(V[int(q[0])-1]);ni=int(q[2])-1 if len(q)>2 and q[2] else None
                    nor.append(N[ni] if ni is not None else [0,1,0]);col.append(cur)
    if not pos:continue
    xs=[v[0] for v in pos];ys=[v[1] for v in pos];zs=[v[2] for v in pos]
    cx,cz,y0=(min(xs)+max(xs))/2,(min(zs)+max(zs))/2,min(ys);S=.2
    P=b''.join(struct.pack('<3f',(v[0]-cx)*S,(v[1]-y0)*S,(v[2]-cz)*S) for v in pos)
    Nn=b''.join(struct.pack('<3f',*v) for v in nor)
    C=b''.join(struct.pack('<4f',srgb2lin(c[0]),srgb2lin(c[1]),srgb2lin(c[2]),1) for c in col)
    mn=[min((v[0]-cx)*S for v in pos),min((v[1]-y0)*S for v in pos),min((v[2]-cz)*S for v in pos)]
    mx=[max((v[0]-cx)*S for v in pos),max((v[1]-y0)*S for v in pos),max((v[2]-cz)*S for v in pos)]
    cnt=len(pos);binb=P+Nn+C
    j={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':name}],
       'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'COLOR_0':2},'material':0}]}],
       'materials':[{'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.85}}],
       'buffers':[{'byteLength':len(binb)}],
       'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(P)},{'buffer':0,'byteOffset':len(P),'byteLength':len(Nn)},{'buffer':0,'byteOffset':len(P)+len(Nn),'byteLength':len(C)}],
       'accessors':[{'bufferView':0,'componentType':5126,'count':cnt,'type':'VEC3','min':mn,'max':mx},{'bufferView':1,'componentType':5126,'count':cnt,'type':'VEC3'},{'bufferView':2,'componentType':5126,'count':cnt,'type':'VEC4'}]}
    write_glb(os.path.join(out,'f',name+'.glb'),j,binb);n+=1
print('furniture',n)
# ---- Quaternius nature: gltf + bin + png -> single GLB, base-colour textures shrunk to 512px, normal maps dropped
NAT=['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3','Bush_Common','Bush_Common_Flowers','Mushroom_Common','Flower_3_Group','Flower_4_Group','Flower_3_Single','Fern_1','Plant_1_Big','Pebble_Round_1','Pebble_Round_3','Pebble_Square_1','Pebble_Square_3','Pine_5','CommonTree_5','Clover_1','Grass_Common_Tall','Grass_Common_Short','Grass_Wispy_Tall','DeadTree_4']
ndir=glob.glob(os.path.join(src,'*Stylized.Nature*','glTF'))[0];tdir=os.path.join(os.path.dirname(ndir),'Textures')
n=0
for name in NAT:
    p=os.path.join(ndir,name+'.gltf')
    if not os.path.exists(p):continue
    j=json.load(open(p));bins=[open(os.path.join(ndir,b['uri']),'rb').read() for b in j['buffers']]
    blob=bytearray(bins[0]);views=list(j['bufferViews'])
    used=[]
    for m in j['materials']:
        m.pop('normalTexture',None)
        bt=m.get('pbrMetallicRoughness',{}).get('baseColorTexture')
        if bt:used.append(bt['index'])
    tex_map={};new_tex=[];new_img=[]
    for ti in sorted(set(used)):
        im=j['images'][j['textures'][ti]['source']];f=os.path.join(tdir,im['uri'])
        img=Image.open(f).convert('RGBA');img.thumbnail((512,512))
        b=io.BytesIO();img.save(b,'PNG',optimize=True);data=b.getvalue()
        while len(blob)%4:blob.append(0)
        views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob+=data
        new_img.append({'bufferView':len(views)-1,'mimeType':'image/png'});new_tex.append({'source':len(new_img)-1,'sampler':0});tex_map[ti]=len(new_tex)-1
    for m in j['materials']:
        bt=m.get('pbrMetallicRoughness',{}).get('baseColorTexture')
        if bt:bt['index']=tex_map[bt['index']]
    j['bufferViews']=views;j['images']=new_img;j['textures']=new_tex;j['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
    j['buffers']=[{'byteLength':len(blob)}]
    write_glb(os.path.join(out,'n',name+'.glb'),j,bytes(blob));n+=1
print('nature',n)
