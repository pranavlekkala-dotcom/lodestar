import * as T from 'three';
const UP=new T.Vector3(0,1,0);
const sideQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,-1),new T.Vector3(0,-1,0),new T.Vector3(-1,0,0)));
// Palm up under the base; fingers point underneath the chassis, away from its cover.
const bottomQ=new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0));
function link(mesh,a,b){const v=b.clone().sub(a);mesh.position.copy(a).addScaledVector(v,.5);mesh.quaternion.setFromUnitVectors(UP,v.clone().normalize());mesh.scale.set(.045,v.length(),.041);}
/** Reposes the HOST'S actual hand meshes after its ordinary arm update.
 * No replacement glove, new sleeve cylinder or movement-controller mutation. */
export function poseCarryHands(host,carry,{rail=false}={}){
 if(host.posePayloadGrip){host.posePayloadGrip(carry,{rail});return true;}
 const rig=host.getMovement?.()?.arms;if(!rig?.arms?.length)return false;
 carry.updateWorldMatrix(true,false);host.cam.updateWorldMatrix(true,false);rig.root.visible=host.playing();
 // Payload carry changes glove rotation only. Keep the host wrist positions,
 // elbows, sleeve lengths and visibility exactly as its normal resting pose.
 if(!rail){
  const controller=host.getMovement?.()?.controller;
  if(rig.update&&controller?.hands&&controller?.shoulder){
   // Render the native relaxed pose, rather than a wall-grabbing pose, while
   // carrying. This proxy never changes the movement controller or its grips.
   const neutral=Object.create(controller);
   Object.defineProperties(neutral,{hands:{value:controller.hands.map(h=>({...h,anchor:null}))},contacts:{value:[false,false]},motionIntent:{value:new T.Vector3()},shoulder:{value:controller.shoulder.bind(controller)}});
   const rotation=host.cam.getWorldQuaternion(new T.Quaternion()),basis={right:new T.Vector3(1,0,0).applyQuaternion(rotation),up:new T.Vector3(0,1,0).applyQuaternion(rotation),forward:new T.Vector3(0,0,-1).applyQuaternion(rotation)};
   for(const arm of rig.arms)arm.initialized=false;
   rig.update(0,performance.now()/1000,neutral,host.cam,basis,true);
  }
  const axis=new T.Vector3(0,0,1).applyQuaternion(host.cam.getWorldQuaternion(new T.Quaternion()));
  for(const arm of rig.arms){const inward=new T.Quaternion().setFromAxisAngle(axis,-arm.side*Math.PI/4);arm.hand.group.quaternion.copy(arm.rotation).premultiply(inward);}
  return true;
 }
 const specs=rail?[{p:[-.48,-.10,.34],q:new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)),elbow:[-.60,-.50,-.45],curl:[.05,.10,.12]},{p:[.48,-.10,.34],q:new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)),elbow:[.60,-.50,-.45],curl:[.05,.10,.12]}]:[{p:[-.09,-.375,.175],q:bottomQ,elbow:[-.20,-.63,-.55],curl:[.02,.04,.07]},{p:[.25,.125,.19],q:sideQ,elbow:[.50,-.45,-.65],curl:[.12,.30,.38]}];
 for(let i=0;i<2;i++){const arm=rig.arms[i],s=specs[i],wrist=carry.localToWorld(new T.Vector3(...s.p)),q=carry.getWorldQuaternion(new T.Quaternion()).multiply(s.q),elbow=host.cam.localToWorld(new T.Vector3(...s.elbow));
  arm.hand.group.position.copy(wrist);arm.hand.group.quaternion.copy(q);arm.hand.group.scale.set(i===0?1:-1,1,1);arm.hand.group.visible=true;
  arm.upper.visible=true;arm.elbow.visible=true;arm.elbow.position.copy(elbow);const shoulder=host.cam.localToWorld(new T.Vector3(...(rail?(i===0?[-.7,-.8,-.1]:[.7,-.8,-.1]):(i===0?[-.5,-1.1,-.1]:[.45,-.75,-.05]))));link(arm.upper,shoulder,elbow);arm.upper.scale.x=.060;arm.upper.scale.z=.057;arm.forearm.visible=true;link(arm.forearm,elbow,wrist);arm.wristBand.visible=true;arm.wristBand.position.copy(wrist).lerp(elbow,.10);arm.wristBand.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),wrist.clone().sub(elbow).normalize());
  for(const f of arm.hand.fingers){f.root.rotation.z=f.isThumb?.72:f.spread;f.root.rotation.y=f.isThumb?-.28:0;f.joints.forEach((j,k)=>j.rotation.x=f.isThumb?.32:s.curl[k]);}
 }return true;
}
