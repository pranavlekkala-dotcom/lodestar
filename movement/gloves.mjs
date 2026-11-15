import * as T from 'three';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
const fingerSpecs=[
  {x:-.029,y:.091,lengths:[.034,.026,.019],r:.0095,spread:.055},
  {x:-.009,y:.098,lengths:[.037,.028,.022],r:.0098,spread:.010},
  {x:.012,y:.095,lengths:[.035,.027,.020],r:.0092,spread:-.035},
  {x:.031,y:.085,lengths:[.028,.022,.017],r:.0080,spread:-.115},
  {x:-.037,y:.025,lengths:[.033,.028],r:.0124,spread:.88,thumb:true},
];
let sharedGeometry=null,sharedMaterials=null;

function makeRig(){
  const root=new T.Bone(),bones=[root],fingers=[];root.name='wrist';
  for(const [fi,spec]of fingerSpecs.entries()){
    let parent=root;const joints=[],ids=[];
    spec.lengths.forEach((length,j)=>{
      const b=new T.Bone();b.name=`${spec.thumb?'thumb':'finger'+fi}_${j}`;
      if(j===0){b.position.set(spec.x,spec.y,spec.thumb?.004:0);b.rotation.z=spec.spread;if(spec.thumb)b.rotation.y=-.24;}
      else b.position.y=spec.lengths[j-1];
      parent.add(b);ids.push(bones.length);bones.push(b);joints.push(b);parent=b;
    });
    fingers.push({joints,ids,spec,isThumb:!!spec.thumb,root:joints[0],spread:spec.spread});
  }
  root.updateMatrixWorld(true);
  const segments=[];
  for(const f of fingers){
    f.joints.forEach((bone,j)=>{
      const start=bone.getWorldPosition(new T.Vector3()),end=bone.localToWorld(new T.Vector3(0,f.spec.lengths[j],0));
      const delta=end.clone().sub(start),length=delta.length();
      segments.push({start,end,delta,length,lengthSq:length*length,r:f.spec.r*(1-j*.11),id:f.ids[j],next:f.ids[j+1]??f.ids[j],finger:f,ordinal:j});
    });
  }
  return{root,bones,fingers,segments};
}
function ellipsoid(x,y,z,rx,ry,rz){
  const a=Math.hypot(x/rx,y/ry,z/rz),b=Math.hypot(x/(rx*rx),y/(ry*ry),z/(rz*rz));
  return b<1e-9?-Math.min(rx,ry,rz):a*(a-1)/b;
}
function union(a,b,k=.007){const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
function segmentDistance(x,y,z,s){
  const t=clamp(((x-s.start.x)*s.delta.x+(y-s.start.y)*s.delta.y+(z-s.start.z)*s.delta.z)/s.lengthSq);
  return Math.hypot(x-s.start.x-t*s.delta.x,y-s.start.y-t*s.delta.y,z-s.start.z-t*s.delta.z)-s.r*(1-.11*t);
}
function field(x,y,z,segments){
  // Continuous palm, wrist, thenar pad, webbing and tapered digits. Unlike
  // separate capsules, the surface has no gaps between finger segments.
  let d=ellipsoid(x,y-.050,z,.045,.062,.0205);
  d=union(d,ellipsoid(x,y+.010,z,.028,.035,.0175),.011);
  d=union(d,ellipsoid(x+.030,y-.033,z-.002,.023,.035,.020),.011);
  d=union(d,ellipsoid(x-.027,y-.048,z,.017,.044,.018),.008);
  for(const s of segments)d=union(d,segmentDistance(x,y,z,s),s.ordinal===0?.0065:.0035);
  return d;
}
function buildSurface(segments){
  const step=.003,nx=55,ny=88,nz=27,min=[-.096,-.048,-.036];
  const values=new Float32Array(nx*ny*nz),gradients=new Float32Array(values.length*3);
  const index=(x,y,z)=>(y*nz+z)*nx+x;
  for(let y=0;y<ny;y++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)values[index(x,y,z)]=field(min[0]+x*step,min[1]+y*step,min[2]+z*step,segments);
  for(let y=1;y<ny-1;y++)for(let z=1;z<nz-1;z++)for(let x=1;x<nx-1;x++){
    const i=index(x,y,z)*3;
    gradients[i]=values[index(x+1,y,z)]-values[index(x-1,y,z)];
    gradients[i+1]=values[index(x,y+1,z)]-values[index(x,y-1,z)];
    gradients[i+2]=values[index(x,y,z+1)]-values[index(x,y,z-1)];
  }
  const positions=[],normals=[],uv=[],colors=[],skinIndices=[],skinWeights=[];
  const offsets=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
  function vertex(a,b){
    const t=a.v/(a.v-b.v);
    const p=a.p.clone().lerp(b.p,t),n=a.n.clone().lerp(b.n,t).normalize();
    return{p,n};
  }
  function emit(a,b,c){
    const cross=b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p));
    if(cross.dot(a.n.clone().add(b.n).add(c.n))<0)[b,c]=[c,b];
    for(const v of[a,b,c]){
      const p=v.p;positions.push(p.x,p.y,p.z);normals.push(v.n.x,v.n.y,v.n.z);uv.push((p.x+.096)/.164,(p.y+.048)/.264);
      let nearest=segments[0],best=Infinity;
      for(const s of segments){const d=segmentDistance(p.x,p.y,p.z,s);if(d<best){best=d;nearest=s;}}
      const s=nearest,t=clamp(p.clone().sub(s.start).dot(s.delta)/s.lengthSq);
      const progress=p.clone().sub(s.finger.joints[0].position).dot(s.finger.segmentsDirection||s.delta.clone().normalize());
      const palm=s.ordinal===0?1-ease((progress+.008)/.026):0;
      const next=s.next===s.id?0:ease((t-.74)/.26)*.5;
      skinIndices.push(0,s.id,s.next,0);skinWeights.push(palm,(1-palm)*(1-next),(1-palm)*next,0);
      // Lodestar crew glove (edited for the game): light grey fabric back, darker grey grip palm and fingertip pads,
      // slightly darker wrist; matches the ship's ivory/slate palette instead of near-black.
      const dorsal=clamp((-p.z-.003)/.013),palmSide=clamp((p.z-.002)/.012),tip=s.ordinal>=1?clamp((t+.35)*.7):0;
      let tone=.56+dorsal*.06-palmSide*.30-tip*palmSide*.06;
      if(p.y<.012)tone=Math.min(tone,.40);
      const knuckle=dorsal*Math.exp(-Math.pow((p.y-.094)/.014,2));tone-=knuckle*.10;
      colors.push(tone*.98,tone*.985,tone);
    }
  }
  for(let y=1;y<ny-2;y++)for(let z=1;z<nz-2;z++)for(let x=1;x<nx-2;x++){
    const ids=offsets.map(([dx,dy,dz])=>index(x+dx,y+dy,z+dz));
    const neg=ids.reduce((n,i)=>n+(values[i]<0),0);if(neg===0||neg===8)continue;
    const cube=offsets.map(([dx,dy,dz],corner)=>{const i=ids[corner];return{v:values[i],p:new T.Vector3(min[0]+(x+dx)*step,min[1]+(y+dy)*step,min[2]+(z+dz)*step),n:new T.Vector3(gradients[i*3],gradients[i*3+1],gradients[i*3+2])};});
    for(const tet of tets){
      const inside=tet.filter(i=>cube[i].v<0),outside=tet.filter(i=>cube[i].v>=0);
      if(!inside.length||!outside.length)continue;
      if(inside.length===1||outside.length===1){const one=inside.length===1?inside[0]:outside[0],others=inside.length===1?outside:inside;emit(...others.map(i=>vertex(cube[one],cube[i])));}
      else{const[a,b]=inside,[c,d]=outside,ac=vertex(cube[a],cube[c]),ad=vertex(cube[a],cube[d]),bc=vertex(cube[b],cube[c]),bd=vertex(cube[b],cube[d]);emit(ac,ad,bc);emit(ad,bd,bc);}
    }
  }
  // Adjacent tetrahedra share most vertices. Weld them before skinning so a
  // detailed silhouette does not repeatedly transform identical vertices.
  const unique=new Map(),indices=[],p2=[],n2=[],uv2=[],c2=[],si2=[],sw2=[];
  for(let i=0;i<positions.length/3;i++){
    const key=`${Math.round(positions[i*3]*1e6)},${Math.round(positions[i*3+1]*1e6)},${Math.round(positions[i*3+2]*1e6)}`;
    let id=unique.get(key);
    if(id===undefined){id=unique.size;unique.set(key,id);p2.push(...positions.slice(i*3,i*3+3));n2.push(...normals.slice(i*3,i*3+3));uv2.push(...uv.slice(i*2,i*2+2));c2.push(...colors.slice(i*3,i*3+3));si2.push(...skinIndices.slice(i*4,i*4+4));sw2.push(...skinWeights.slice(i*4,i*4+4));}
    indices.push(id);
  }
  const g=new T.BufferGeometry();g.setIndex(indices);
  g.setAttribute('position',new T.Float32BufferAttribute(p2,3));g.setAttribute('normal',new T.Float32BufferAttribute(n2,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv2,2));g.setAttribute('color',new T.Float32BufferAttribute(c2,3));
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si2,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw2,4));
  g.computeBoundingSphere();return g;
}

export function createGloveGeometry(){return buildSurface(makeRig().segments);}

function materials(){
  if(sharedMaterials)return sharedMaterials;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#c5c5bf';ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=2)for(let x=0;x<256;x+=2){const f=((x*37+y*73+x*y)%21)/21;ctx.fillStyle=`rgba(20,24,22,${.08+f*.12})`;ctx.fillRect(x,y,(x+y)%4===0?2:1,1);}
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(3,3);map.anisotropy=4;
  sharedMaterials={
    glove:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,map,roughness:.82,metalness:.025}),
    leather:new T.MeshStandardMaterial({color:0xb4b8b3,map,roughness:.72,metalness:.02}),
    edge:new T.MeshStandardMaterial({color:0x3a4448,roughness:.88,side:T.DoubleSide}),
    stitch:new T.LineBasicMaterial({color:0x7d827c,transparent:true,opacity:.45}),
    cuff:new T.MeshStandardMaterial({color:0x46525c,map,roughness:.86,side:T.DoubleSide}),
    accent:new T.MeshStandardMaterial({color:0xc0662d,roughness:.6}),
  };return sharedMaterials;
}
function roundedPatch(w,h){
  const r=Math.min(w,h)*.22,s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  return new T.ExtrudeGeometry(s,{depth:.0012,bevelEnabled:true,bevelSize:.0008,bevelThickness:.0008,bevelSegments:2,steps:1,curveSegments:4});
}

export function createGlove(side){
  const rig=makeRig(),m=materials();
  if(!sharedGeometry)sharedGeometry=buildSurface(rig.segments);
  const group=new T.Group(),skin=new T.SkinnedMesh(sharedGeometry,m.glove);skin.add(rig.root);skin.bind(new T.Skeleton(rig.bones));skin.frustumCulled=false;group.add(skin);
  for(const f of rig.fingers){
    f.joints.forEach((bone,j)=>{
      if(j>1)return;
      const w=f.spec.r*(j?1.23:1.45),h=f.spec.lengths[j]*.49;
      const patch=new T.Mesh(roundedPatch(w,h),m.leather);patch.position.set(0,f.spec.lengths[j]*.46,-f.spec.r*(1-j*.11)-.0004);bone.add(patch);
    });
  }
  // Stitched back-of-hand panels and web seams; no circular toy-like palm pad.
  function backZ(x,y){
    let low=-.036,high=0;
    for(let i=0;i<13;i++){const middle=(low+high)*.5;if(field(x,y,middle,rig.segments)>0)low=middle;else high=middle;}
    return(low+high)*.5-.0008;
  }
  // Reinforcement follows the curved knuckles instead of floating over the hand.
  for(const center of[-.024,0,.024]){
    const ps=[],ids=[],uvs=[],nu=5,nv=12;
    for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){
      const y=.023+v/nv*.057,halfWidth=.007*(.82+.18*Math.sin(v/nv*Math.PI)),x=center+(u/nu*2-1)*halfWidth;
      ps.push(x,y,backZ(x,y));
      uvs.push(u/nu,v/nv);
      if(u<nu&&v<nv){const i=v*(nu+1)+u;ids.push(i,i+nu+1,i+1,i+1,i+nu+1,i+nu+2);}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(ps,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(ids);geo.computeVertexNormals();
    const panel=new T.Mesh(geo,m.leather);group.add(panel);
  }
  const stitchPoints=[];
  for(const x of[-.031,-.017,-.007,.007,.017,.031])for(let y=.025;y<.079;y+=.005)stitchPoints.push(x,y,backZ(x,y)-.0005,x,y+.002,backZ(x,y+.002)-.0005);
  const seam=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(stitchPoints,3)),m.stitch);group.add(seam);
  const cuff=new T.Mesh(new T.CylinderGeometry(.030,.033,.043,28,3,true),m.cuff);cuff.position.y=-.027;cuff.scale.z=.73;group.add(cuff);
  // closed back end so you never look into the glove (edited for the game)
  const cap=new T.Mesh(new T.CircleGeometry(.033,28),m.capMat||(m.capMat=new T.MeshStandardMaterial({color:0x56657a,roughness:.9,side:T.DoubleSide})));cap.rotation.x=Math.PI/2;cap.position.y=-.0485;cap.scale.y=.73;group.add(cap);
  const closure=new T.Mesh(roundedPatch(.046,.020),m.edge);closure.position.set(0,-.026,-.025);group.add(closure);
  for(const x of[-.020,.020]){const p=new T.Mesh(new T.BoxGeometry(.002,.017,.002),m.accent);p.position.set(x,-.026,-.026);group.add(p);}
  group.scale.x=-side;
  const grip=new T.Object3D();grip.name=side===1?'RightGrip':'LeftGrip';grip.position.set(0,.055,.030);grip.scale.x=-side;group.add(grip);
  return{group,fingers:rig.fingers,skin,grip};
}
