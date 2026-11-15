import {Quaternion} from 'three';
import {MovementController} from './physics.mjs';
import {AstronautArms} from './arms.mjs';

/** Host-driven integration. This creates no renderer, DOM, input bindings or
 * animation loop. applyBodyPose must update the existing player/camera rig.
 * The host supplies world-space metre coordinates and a normalized basis. */
export class MovementIntegration {
  constructor({world,camera,scene,position,applyBodyPose,config={},arms,onEvent=()=>{},reduceMotion=false}){
    if(typeof applyBodyPose!=='function')throw Error('Supply the existing player rig applyBodyPose callback.');
    this.controller=new MovementController(world,config);if(position)this.controller.reset(position);
    this.camera=camera;this.arms=arms??(scene?new AstronautArms(scene):null);
    this.applyBodyPose=applyBodyPose;this.onEvent=onEvent;this.reduceMotion=reduceMotion;
    this.accumulator=0;this.time=0;this.paused=false;this.step=1/120;this.cameraPose={quaternion:new Quaternion()};
    this.applyBodyPose(this.controller.position,this.controller.velocity);
  }
  update(frameSeconds,input,basis){
    if(this.paused||!Number.isFinite(frameSeconds)||frameSeconds<=0)return this.controller;
    const dt=Math.min(frameSeconds,.05);this.time+=dt;this.accumulator+=dt;
    while(this.accumulator>=this.step-1e-10){this.controller.step(this.step,input,basis);this.accumulator-=this.step;}
    this.applyBodyPose(this.controller.position,this.controller.velocity);
    if(this.arms&&this.camera){
      this.camera.updateWorldMatrix?.(true,false);this.camera.getWorldQuaternion(this.cameraPose.quaternion);
      this.arms.update(dt,this.time,this.controller,this.cameraPose,basis,this.reduceMotion);
    }
    for(const event of this.controller.events.splice(0))this.onEvent(event);
    return this.controller;
  }
  pause(){this.paused=true;this.accumulator=0;this.controller.releaseAll();}
  resume(){this.paused=false;this.accumulator=0;}
  reset(position){
    this.controller.reset(position);this.accumulator=0;
    this.controller.world.lastBody?.copy(position);
    if(this.arms){this.arms.previousBodyPosition=null;for(const a of this.arms.arms||[]){a.initialized=false;a.poseInitialized=false;}}
    this.applyBodyPose(this.controller.position,this.controller.velocity);
  }
  get gripSockets(){return this.arms?.gripSockets||null;}
  dispose(){this.pause();this.arms?.root.removeFromParent?.();}
}
