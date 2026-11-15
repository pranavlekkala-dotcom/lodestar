import * as T from 'three';
/** Adapt the RECEIVED station copy. Original maps, frame, wheel and bolts survive.
 * The production owner can supply its own door methods instead of this adapter. */
export function stationAirlockAdapter({scene,outerMeshes=[],interactables={}}){
 const door=new T.Group();door.name='CH3 / original outer hatch moving leaf';scene.add(door);
 const bounds=new T.Box3();outerMeshes.forEach(o=>bounds.expandByObject(o));const center=bounds.isEmpty()?new T.Vector3(14.3,.14,29):bounds.getCenter(new T.Vector3());center.y=.14;center.z=29;
 door.position.set(center.x,center.y,center.z+1.10);door.updateMatrixWorld(true);
 for(const mesh of outerMeshes){
  if(!mesh.geometry||Array.isArray(mesh.material))continue;
  const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),pos=g.getAttribute('position'),keep=[],move=[],p=new T.Vector3();
  for(let i=0;i<pos.count;i+=3){let y=0,z=0;for(let k=0;k<3;k++){p.fromBufferAttribute(pos,i+k).applyMatrix4(mesh.matrixWorld);y+=p.y/3;z+=p.z/3;}const leaf=mesh.material.name!=='bluegreen'&&Math.hypot(y-center.y,z-center.z)<1.09;(leaf?move:keep).push(i,i+1,i+2);}
  const subset=ids=>{const out=new T.BufferGeometry();for(const[name,a]of Object.entries(g.attributes)){const data=new a.array.constructor(ids.length*a.itemSize);ids.forEach((i,j)=>{for(let k=0;k<a.itemSize;k++)data[j*a.itemSize+k]=a.array[i*a.itemSize+k];});out.setAttribute(name,new T.BufferAttribute(data,a.itemSize,a.normalized));}out.computeBoundingSphere();return out;};
  if(move.length){const geo=subset(move);for(const key of ['position','normal']){const src=geo.getAttribute(key);if(!src)continue;const dst=new Float32Array(src.count*3);for(let i=0;i<src.count;i++){dst[i*3]=src.getX(i);dst[i*3+1]=src.getY(i);dst[i*3+2]=src.getZ(i);}geo.setAttribute(key,new T.BufferAttribute(dst,3));}const leaf=new T.Mesh(geo,mesh.material);leaf.geometry.applyMatrix4(mesh.matrixWorld);door.add(leaf);leaf.position.copy(door.position).negate();leaf.raycast=()=>{};}
  if(keep.length){mesh.geometry=subset(keep);try{mesh.geometry.computeBoundsTree();}catch{}}else{mesh.visible=false;mesh.userData.gone=true;mesh.raycast=()=>{};}
 }
 const control=interactables.int_light_eva_right,box=new T.Box3();control?.meshes.forEach(o=>box.expandByObject(o));if(control)control.def={...control.def,kind:'ch3hatch'};const controlPoint=box.isEmpty()?null:box.getCenter(new T.Vector3()).toArray();
 return {controlPoint,setOuterOpen(t){door.rotation.y=-Math.PI*.51*t;},reset(){door.rotation.y=0;},dispose(){door.removeFromParent();}};
}
