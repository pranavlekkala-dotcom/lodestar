import {coreConfig} from './config.mjs';
import {Box3,Vector3} from 'three';
// Call before the host builds its movement collision world. Return a manifest so
// the ship owner can review exactly what was replaced. No source GLB is edited.
export function prepareChapter3Room({scene,roomMeshes,interactables,layout,tagOf},override={}){
  const c=coreConfig(override),removed=[];if(!c.replaceRoomFurniture)return removed;
  const list=roomMeshes[c.roomId]||[];
  for(const o of [...list]){
    const tag=tagOf(o)?.name||o.name;
    if(/^shell_/.test(tag)||/^int_light/.test(tag))continue;
    o.visible=false;o.userData.gone=true;o.raycast=()=>{};removed.push(tag);list.splice(list.indexOf(o),1);
    if(o.userData.int&&interactables[o.userData.int])interactables[o.userData.int].disabled=true;
  }
  const r=layout.rooms.find(r=>r.id===c.roomId);
  if(r){r.name='Relay Laboratory';r.sub='CubeSat assembly · test · integration';
    // The received ship batches signs for EVERY room into one global mesh.
    // Its overall centre is outside this room, so clip individual label triangles.
    scene?.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||o.material?.name!=='labels')return;const g=o.geometry,p=g.attributes.position;if(!p)return;const indices=g.index?.array??Array.from({length:p.count},(_,i)=>i),keep=[],v=new Vector3(),a=new Vector3(),b=new Vector3(),d=new Vector3();let cut=0;
      for(let i=0;i<indices.length;i+=3){a.fromBufferAttribute(p,indices[i]);b.fromBufferAttribute(p,indices[i+1]);d.fromBufferAttribute(p,indices[i+2]);v.copy(a).add(b).add(d).multiplyScalar(1/3).applyMatrix4(o.matrixWorld);if(Math.abs(v.x-r.x)<r.w/2+.08&&Math.abs(v.z-r.z)<r.l/2+.08){cut++;continue;}keep.push(indices[i],indices[i+1],indices[i+2]);}
      if(cut){const replacement=g.clone();replacement.setIndex(keep);replacement.clearGroups();replacement.computeBoundingBox();replacement.computeBoundingSphere();replacement.computeBoundsTree?.();o.geometry=replacement;removed.push('legacy-label-triangles:'+cut);}
    });
    // Some legacy labels are merged under a structural parent. Remove only
    // their naming-material groups inside this room, preserving the hull.
    scene?.traverse(o=>{if(!o.isMesh||!o.visible)return;const materials=Array.isArray(o.material)?o.material:[o.material];if(!materials.some(m=>m?.name==='naming'))return;const center=new Box3().setFromObject(o).getCenter(new Vector3());if(Math.abs(center.x-r.x)>=r.w/2||Math.abs(center.z-r.z)>=r.l/2)return;
      if(Array.isArray(o.material))o.material=o.material.map(m=>{if(m?.name!=='naming')return m;const hidden=m.clone();hidden.visible=false;return hidden;});else{o.visible=false;o.userData.gone=true;o.raycast=()=>{};}removed.push('legacy-label:'+o.name);
    });
    layout.obstacles=layout.obstacles.filter(([a,b])=>{const x=(a[0]+b[0])/2,z=(a[2]+b[2])/2;return !(x>r.x-r.w/2&&x<r.x+r.w/2&&z>r.z-r.l/2&&z<r.z+r.l/2);});}
  return removed;
}
export function announce(id,text,detail={}){
  const payload={id,text,speaker:'LODESTAR',chapter:3,priority:'normal',...detail};
  document.dispatchEvent(new CustomEvent('lodestar:chapter3:announcement',{detail:payload}));
  return payload;
}
