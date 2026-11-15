import * as T from 'three';

/** Contact adapter for an existing Three.js game. It owns no ship geometry,
 * renderer, camera, input listeners, animation loop, or body physics. Supply
 * the host's collision meshes and its existing movement/clearance callbacks.
 * Use simple static collision meshes; skinned and instanced render assets need
 * separate collision proxies. All controller coordinates are world metres. */
export class MeshSurfaceWorld {
  constructor({colliders,moveBody,visualCollide,canGrab=mesh=>mesh.userData.zeroGGrabbable!==false,dynamic=()=>true}){
    if(!Array.isArray(colliders)||!colliders.length)throw Error('Provide existing collision meshes.');
    if(typeof moveBody!=='function'||typeof visualCollide!=='function')throw Error('Host moveBody and visualCollide callbacks are required.');
    this.bodyMover=moveBody;this.visualMover=visualCollide;this.canGrab=canGrab;
    this.material=new T.MeshBasicMaterial({side:T.DoubleSide});
    this.entries=colliders.map(owner=>{
      if(!owner.isMesh||owner.isSkinnedMesh||owner.isInstancedMesh)throw Error('Use ordinary static collision meshes, not skinned/instanced render assets.');
      const proxy=new T.Mesh(owner.geometry,this.material);proxy.matrixAutoUpdate=false;
      if(!owner.geometry.boundingSphere)owner.geometry.computeBoundingSphere();
      return{owner,proxy,matrix:new Array(16).fill(NaN),dynamic:!!dynamic(owner),sphere:new T.Sphere()};
    });
    // (edited for the game) performance: static meshes are synced once; only meshes that can move are re-checked,
    // and every query only tests the meshes whose bounds are within reach (was: all ~1,500 meshes, ~5 ms per frame)
    this.synced=false;this.dynamicEntries=this.entries.filter(e=>e.dynamic);
    this.proxies=this.entries.map(e=>e.proxy);this.owners=new Map(this.entries.map(e=>[e.proxy,e]));
    this.ray=new T.Raycaster();this.revision=0;this.cache=null;
    this.directions=[];
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)this.directions.push(new T.Vector3(x,y,z).normalize());
  }
  sync(){
    const list=this.synced?this.dynamicEntries:this.entries;this.synced=true;
    for(const e of list){
      e.owner.updateWorldMatrix(true,false);
      const m=e.owner.matrixWorld.elements;
      if(m.some((x,i)=>x!==e.matrix[i])){e.matrix=Array.from(m);e.proxy.matrixWorld.copy(e.owner.matrixWorld);e.sphere.copy(e.owner.geometry.boundingSphere).applyMatrix4(e.owner.matrixWorld);this.revision++;}
    }
  }
  near(center,radius){const out=[];for(const e of this.entries)if(e.sphere.distanceToPoint(center)<=radius)out.push(e.proxy);return out;}
  cast(from,direction,far,list=this.proxies){
    this.ray.set(from,direction);this.ray.near=.001;this.ray.far=far;
    return this.ray.intersectObjects(list,false)[0]||null;
  }
  nearSurfaces(position,reach=1.3,{basis}={}){
    this.sync();const forward=basis?.forward;
    if(this.cache&&this.cache.revision===this.revision&&reach<=this.cache.reach&&position.distanceToSquared(this.cache.position)<.0009&&(!forward||this.cache.forward&&forward.dot(this.cache.forward)>.995))return this.cache.surfaces;
    const directions=[...this.directions];
    if(basis)for(const axis of[basis.forward,basis.right,basis.up]){directions.push(axis.clone(),axis.clone().negate());}
    const found=new Map(),list=this.near(position,reach+.05);
    for(const direction of directions){
      const hit=list.length?this.cast(position,direction,reach+.03,list):null;if(!hit)continue;
      const entry=this.owners.get(hit.object),owner=entry.owner;
      // A non-grabbable obstacle still blocks the ray: never query a useful
      // handhold through a decorative panel or an already closed hatch.
      if(!this.canGrab(owner)||!hit.face)continue;
      const id=owner.uuid+':'+hit.faceIndex;if(found.has(id))continue;
      const attr=owner.geometry.getAttribute('position'),face=hit.face;
      const points=[face.a,face.b,face.c].map(i=>new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(owner.matrixWorld));
      const triangle=new T.Triangle(...points),normal=triangle.getNormal(new T.Vector3());
      if(normal.dot(position.clone().sub(hit.point))<0)normal.negate();
      found.set(id,{id,kind:owner.userData.zeroGKind||'surface',normal,triangle,owner,matrix:Array.from(owner.matrixWorld.elements)});
    }
    const surfaces=[...found.values()];
    this.cache={position:position.clone(),forward:forward?.clone(),reach,revision:this.revision,surfaces};
    return surfaces;
  }
  closestPoint(surface,position,out=new T.Vector3()){return surface.triangle.closestPointToPoint(position,out);}
  segmentClear(from,to){
    const direction=to.clone().sub(from),length=direction.length();if(length<1e-7)return true;
    this.sync();const list=this.near(from.clone().lerp(to,.5),length/2+.05);
    return !list.length||!this.cast(from,direction.multiplyScalar(1/length),Math.max(.001,length-.008),list);
  }
  nearestDistance(position){
    const p=new T.Vector3();let nearest=Infinity;
    for(const s of this.nearSurfaces(position,1.6))nearest=Math.min(nearest,this.closestPoint(s,position,p).distanceTo(position));
    return nearest;
  }
  isContactValid(anchor){
    const s=anchor.surface;if(!s?.owner)return false;
    s.owner.updateWorldMatrix(true,false);
    return s.matrix.every((v,i)=>Math.abs(v-s.owner.matrixWorld.elements[i])<1e-6)&&this.canGrab(s.owner);
  }
  moveBody(position,velocity,dt,radius,config){return this.bodyMover(position,velocity,dt,radius,config)||0;}
  collide(position,velocity,radius){return this.visualMover(position,velocity,radius)||0;}
  dispose(){this.material.dispose();this.cache=null;}
}
