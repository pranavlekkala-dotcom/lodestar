import * as T from 'three';
import { contactWrist, contactTangent, handContactBlend } from './physics.mjs';
import { createGlove } from './gloves.mjs';
import { handPose, springJoint } from './hand-poses.mjs';

const UP = new T.Vector3(0, 1, 0);
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const sphere = new T.SphereGeometry(1, 16, 10);
const ringGeo = new T.TorusGeometry(1, .065, 6, 28);
const sleeveGeo = new T.LatheGeometry([
  [-.50,.84],[-.44,.98],[-.36,1],[-.29,.94],[-.22,1.025],[-.16,.92],[-.09,.98],
  [0,.90],[.08,.96],[.16,.87],[.23,.92],[.30,.84],[.37,.87],[.44,.80],[.50,.77]
].map(([y,r])=>new T.Vector2(r,y)),20);

function fabricTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d5c9'; ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=2) for(let x=0;x<128;x+=2) {
    const n = ((x * 73 + y * 47 + (x*y)%31) % 19) - 9;
    ctx.fillStyle = `rgba(${n>0?'255,255,255':'54,55,49'},${Math.abs(n)*.007})`;
    ctx.fillRect(x,y,1,2);
  }
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(2,2);
  return tex;
}

function mesh(geo,mat,parent,pos,scale) {
  const m=new T.Mesh(geo,mat);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);parent.add(m);return m;
}

const capGeo = new T.CircleGeometry(1, 20);
function link(parent, material) {
  const m=mesh(sleeveGeo,material,parent,null,[.047,.1,.045]);
  // end caps: the lathe sleeve is an open tube (edited for the game)
  for (const [y,r] of [[-.5,.84],[.5,.77]]) { const c=new T.Mesh(capGeo,material); c.rotation.x=Math.PI/2; c.position.y=y; c.scale.setScalar(r); m.add(c); }
  return m;
}
function placeLink(m,a,b,radiusA,radiusB) {
  const v=new T.Vector3().subVectors(b,a),len=v.length();
  m.position.copy(a).addScaledVector(v,.5);m.quaternion.setFromUnitVectors(UP,v.normalize());
  m.scale.set(radiusA,len,radiusB);
}

export class AstronautArms {
  constructor(scene) {
    this.root=new T.Group();scene.add(this.root);
    this.previousBodyPosition=null;
    const sleeveMap=fabricTexture();
    this.materials={
      // Lodestar flight suit (edited for the game): slate-blue sleeves, orange wrist trim; double-sided so the
      // open sleeve ends never look hollow up close.
      sleeve:new T.MeshStandardMaterial({color:0x56657a,map:sleeveMap,roughness:.9,side:T.DoubleSide}),
      upper:new T.MeshStandardMaterial({color:0x4e5c70,map:sleeveMap,roughness:.92,side:T.DoubleSide}),
      cuff:new T.MeshStandardMaterial({color:0xc0662d,roughness:.6}),
    };
    this.arms=[-1,1].map(side=>{
      const hand=createGlove(side);this.root.add(hand.group);
      const upper=link(this.root,this.materials.upper),forearm=link(this.root,this.materials.sleeve);
      const elbow=mesh(sphere,this.materials.sleeve,this.root,null,[.051,.049,.050]);
      const wristBand=mesh(ringGeo,this.materials.cuff,this.root,null,[.036,.036,.036]);
      const fingerSprings=hand.fingers.map(f=>f.joints.map(()=>({value:0,velocity:0})));
      const a={side,hand,upper,forearm,elbow,wristBand,wrist:new T.Vector3(),rotation:new T.Quaternion(),initialized:false,curl:.30,fingerSprings,poseInitialized:false};return a;
    });
    this.gripSockets={left:this.arms[0].hand.grip,right:this.arms[1].hand.grip};
  }
  update(dt,time,controller,camera,basis,reduceMotion=false) {
    const rotation=camera.quaternion;
    const bodyDelta=this.previousBodyPosition?controller.position.clone().sub(this.previousBodyPosition):new T.Vector3();
    this.previousBodyPosition=controller.position.clone();
    // camera-space velocity, smoothed: relaxed hands trail slightly behind motion and turns (edited for the game)
    const invQ=rotation.clone().invert(),camVel=controller.velocity.clone().applyQuaternion(invQ);
    this.lag=this.lag||new T.Vector3();this.lag.lerp(camVel,damp(3,dt));
    const yaw=Math.atan2(2*(rotation.w*rotation.y+rotation.x*rotation.z),1-2*(rotation.y*rotation.y+rotation.x*rotation.x));
    this.turn=T.MathUtils.lerp(this.turn||0,dt>0?T.MathUtils.clamp(((yaw-(this.lastYaw??yaw)+Math.PI*3)%(Math.PI*2)-Math.PI)/dt,-4,4):0,damp(6,dt));this.lastYaw=yaw;
    for(let i=0;i<this.arms.length;i++) {
      const arm=this.arms[i],h=controller.hands[i],side=arm.side;
      const pose=handPose(h,controller.config,time,!!controller.contacts[i]&&controller.motionIntent.lengthSq()>.001);
      // Relaxed, alive rest pose (edited for the game): lower and slightly inward, each hand floating on its own slow,
      // uneven rhythm, trailing a little behind accelerations and turns instead of sticking straight forward.
      const life=reduceMotion?0:1,ph=time*.62+side*1.9,cl=v=>T.MathUtils.clamp(v,-.06,.06);
      const fx=Math.sin(ph)*.011+Math.sin(ph*2.31+.7)*.004,fy=Math.sin(ph*.83+1.1)*.014+Math.sin(ph*1.77)*.005,fz=Math.cos(ph*.57)*.009;
      const local=new T.Vector3(side*.225+life*fx-cl(this.lag.x*.018)+cl(this.turn*.012),-.300+life*fy-cl(this.lag.y*.02),-.385+life*fz-cl(this.lag.z*.022));
      const rest=local.applyQuaternion(rotation).add(controller.position);
      const rp=life*(Math.sin(ph*.9+.4)*.07),ry=life*(Math.sin(ph*.71)*.06),rr=life*(Math.cos(ph*.66+1)*.07);
      const restQ=rotation.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(-1.42+rp-cl(this.lag.z*.03),-side*.30+ry,-side*.20+rr))).multiply(new T.Quaternion().setFromAxisAngle(UP,Math.PI));
      restQ.multiply(new T.Quaternion().setFromEuler(new T.Euler(pose.wristFlex,side*pose.wristFlex*.7,0)));
      let target=rest,goalQ=restQ,curl=controller.contacts[i] ? .29 : .48,blend=0;arm.blendNow=0;
      if(h.anchor) {
        blend=handContactBlend(h,controller.config);
        const z=h.anchor.normal.clone().negate();
        const y=h.anchor.tangent?.clone()||contactTangent(h.anchor.normal,basis);
        y.normalize();const x=new T.Vector3().crossVectors(y,z).normalize();y.crossVectors(z,x).normalize();
        const contactQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
        const wristPoint=contactWrist(h.anchor,basis);
        arm.blendNow=blend;target=rest.clone().lerp(wristPoint,blend);goalQ=restQ.clone().slerp(contactQ,blend);curl=T.MathUtils.lerp(curl,.025,blend);
      }
      if(!arm.initialized){arm.wrist.copy(target);arm.rotation.copy(goalQ);arm.initialized=true;}
      else arm.wrist.addScaledVector(bodyDelta,1-blend);
      const rate=blend>.96?40:23;
      arm.wrist.lerp(target,damp(rate,dt));arm.rotation.slerp(goalQ,damp(24,dt));
      arm.curl=T.MathUtils.lerp(arm.curl,curl,damp(20,dt));
      if(blend<.95) {
        // A relaxed hand also needs hull clearance. Correct the visual rig,
        // without changing player position or manufacturing a physical push.
        for(const [localPoint,radius] of [[new T.Vector3(0,.065,0),.046],[new T.Vector3(0,.175,.014),.024]]) {
          const point=localPoint.applyQuaternion(arm.rotation).add(arm.wrist),before=point.clone();
          controller.world.collide(point,new T.Vector3(),radius);
          arm.wrist.add(point.sub(before));
        }
      }
      // Never let a hand come into the camera's face (edited for the game): planted or not, the palm stays a natural
      // distance in front of the eyes; inside that, it slides forward along the view.
      {const toW=arm.wrist.clone().sub(controller.position),ahead=toW.dot(basis.forward),near=.26;
        if(ahead<near&&toW.length()<.42)arm.wrist.addScaledVector(basis.forward,near-ahead);
        // each hand keeps to its own side of the view, planted or not, so two hands on one small panel sit side by
        // side instead of crossing into each other (visual only; the physics contact is unchanged)
        const x=arm.wrist.clone().sub(controller.position).dot(basis.right),minX=.11;
        if(x*side<minX)arm.wrist.addScaledVector(basis.right,side*minX-x);}
      const shoulder=controller.shoulder(side,basis,h.anchor,blend);
      const toWrist=arm.wrist.clone().sub(shoulder); const distance=toWrist.length();
      // Two-bone IK with an outward/downward elbow pole, no detached wrists.
      const reach=controller.config.armReach+(h.anchor?controller.config.contactSlack:0);
      const extension=Math.max(.74,Math.min(reach,distance+.01));
      const upperLength=extension*.523,lowerLength=extension*.477,maxReach=upperLength+lowerLength-.002;
      if(distance>maxReach)arm.wrist.copy(shoulder).addScaledVector(toWrist,maxReach/distance);
      const line=arm.wrist.clone().sub(shoulder),d=Math.max(.05,line.length());line.normalize();
      const along=(upperLength*upperLength-lowerLength*lowerLength+d*d)/(2*d);
      const height=Math.sqrt(Math.max(.0001,upperLength*upperLength-along*along));
      const pole=basis.right.clone().multiplyScalar(side*.78).addScaledVector(basis.up,-.88).addScaledVector(basis.forward,-.10);
      pole.addScaledVector(line,-pole.dot(line)).normalize();
      const elbow=shoulder.clone().addScaledVector(line,along).addScaledVector(pole,height);
      // Keep the elbow pole inside the room at close wall/ceiling contacts.
      controller.world.collide(elbow,new T.Vector3(),.067);
      placeLink(arm.upper,shoulder,elbow,.061,.057);
      placeLink(arm.forearm,elbow,arm.wrist,.045,.041);
      arm.elbow.position.copy(elbow);
      // first-person view (edited for the game): upper arms and elbows sit beside the player and are never drawn; a
      // forearm that would pass through the camera is hidden for that moment instead of filling the screen
      arm.upper.visible=false;arm.elbow.visible=false;
      {const c=controller.position,ab=arm.wrist.clone().sub(elbow),t=Math.max(0,Math.min(1,c.clone().sub(elbow).dot(ab)/Math.max(1e-6,ab.lengthSq())));
        const near=elbow.clone().addScaledVector(ab,t).distanceTo(c)<.14;arm.forearm.visible=!near;arm.wristBand.visible=!near;}
      arm.hand.group.position.copy(arm.wrist);arm.hand.group.quaternion.copy(arm.rotation);
      arm.wristBand.position.copy(arm.wrist).lerp(elbow,.12);
      arm.wristBand.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),arm.wrist.clone().sub(elbow).normalize());
      for(let f=0;f<arm.hand.fingers.length;f++){
        const finger=arm.hand.fingers[f];finger.root.rotation.z=finger.isThumb?pose.thumbSpread:finger.spread*pose.spreads[f];
        if(finger.isThumb)finger.root.rotation.y=pose.thumbYaw;
        const idle=(1-(arm.blendNow||0))*(reduceMotion?0:1)*(Math.sin(time*.9+f*1.3+side*2.1)*.07+Math.sin(time*2.3+f*.7)*.025);
        finger.joints.forEach((joint,k)=>{const state=arm.fingerSprings[f][k],target=pose.joints[f][k]+idle*(k?.8:1);if(!arm.poseInitialized){state.value=target;state.velocity=0;}else Object.assign(state,springJoint(state.value,state.velocity,target,dt,26-f*1.2));joint.rotation.x=state.value;});
      }
      arm.poseInitialized=true;
    }
  }
}
