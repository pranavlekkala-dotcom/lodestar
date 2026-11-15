import * as T from 'three';
import {coreConfig} from './config.mjs';
import {advanceLaunch,createLaunchState,launchReady} from './launch-state.mjs';
import {announce} from './integration.mjs';
import {block,plate,screwRow,industrialMaterials,cable} from './industrial.mjs';
import {foldArrays} from './shared/hardware.mjs';
import {poseCarryHands} from './carry-grip.mjs';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const flatQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,1),new T.Vector3(1,0,0),new T.Vector3(0,1,0)));
function doorHalf(side,radius,depth){
 const polygon=Array.from({length:8},(_,i)=>{const a=Math.PI/8+i*Math.PI/4;return [radius*Math.cos(a),radius*Math.sin(a)];}),points=[];
 for(let i=0;i<8;i++){const a=polygon[i],b=polygon[(i+1)%8],inside=a[0]*side>=0,next=b[0]*side>=0;if(inside)points.push(a);if(inside!==next){const t=-a[0]/(b[0]-a[0]);points.push([0,a[1]+(b[1]-a[1])*t]);}}
 const shape=new T.Shape(points.map(p=>new T.Vector2(...p))),g=new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:.008,bevelThickness:.007,bevelSegments:2});g.translate(0,0,-depth/2);return g;
}
export function mountRelayAirlock(host,workshop,{config={},onLoaded=()=>{},onReady=()=>{},onDeployed=()=>{},emit=()=>{}}={}){
 const c=coreConfig(config),a=c.airlock,root=new T.Group();root.name='CH3 / airlock payload integration';host.scene.add(root);
 const controlPoint=host.airlockDoors?.controlPoint;if(controlPoint){a.button=[...controlPoint];a.buttonEye=[controlPoint[0]-1.0,controlPoint[1],controlPoint[2]-.15];}
 const m=industrialMaterials(host.scene),solids=[],targets=[],anchors=[];
 let state=createLaunchState(),job=null,relay=null,railCarry=null,active=true,aim=null,disposed=false;
 const box=(parent,size,pos,mat=m.dark,solid=false)=>{const o=block(parent,size,pos,mat);if(solid)solids.push(o);return o;};
 function target(action,position,size){const o=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial({visible:false}));o.position.fromArray(position);root.add(o);o.userData.launchAction=action;targets.push(o);}
 // Staging cabinet uses the station's ivory/slate finish and actual support pads.
 const staging=new T.Group();staging.position.fromArray(a.cradle);root.add(staging);
 box(staging,[.78,.065,.61],[0,-.415,0],m.white,true);box(staging,[.66,.72,.48],[0,-.81,.015],m.slate,true);box(staging,[.69,.055,.52],[0,-1.19,.015],m.steel);
 for(const x of [-.29,.29]){box(staging,[.06,.13,.40],[x,-.34,0],m.steel);box(staging,[.046,.018,.36],[x,-.267,0],m.rubber);}
 for(const y of [-.68,-.96]){box(staging,[.59,.23,.024],[0,y,-.24],m.white);box(staging,[.16,.02,.025],[0,y+.06,-.261],m.steel);}
 plate(staging,'PAYLOAD / STAGING',[.64,.075],[0,-.46,-.311],[0,Math.PI,0],{font:39});
 const stagedPayload=new T.Group();stagedPayload.rotation.y=Math.PI;staging.add(stagedPayload);target('stow',a.cradle,[.91,.80,.80]);
 // Rail cassette: paired guide extrusions, captive fasteners, retaining latch.
 const rail=new T.Group();rail.name='Removable rail cassette';rail.position.fromArray(a.rack);rail.rotation.x=-Math.PI/2;root.add(rail);
 box(rail,[1.72,.038,.57],[0,-.058,0],m.slate);
 for(const z of [-.225,.225]){box(rail,[1.68,.068,.052],[0,0,z],m.steel);box(rail,[1.54,.012,.025],[.03,.040,z],m.rubber);box(rail,[1.52,.008,.009],[.03,.050,z+.029],m.orange);}
 for(const x of [-.65,-.22,.22,.65])box(rail,[.05,.026,.45],[x,-.02,0],m.steel);
 box(rail,[.13,.14,.42],[-.76,.025,0],m.dark);box(rail,[.045,.08,.28],[-.66,.077,0],m.orange);
 const latch=box(rail,[.035,.14,.40],[.72,.047,0],m.steel);box(latch,[.05,.025,.15],[0,.085,0],m.orange);
 const boltStrip=new T.Group();boltStrip.rotation.x=-Math.PI/2;rail.add(boltStrip);screwRow(boltStrip,[-.65,-.22,.22,.65].flatMap(x=>[[x,-.225,.055],[x,.225,.055]]),m.dark,.006);
 const rack=new T.Group();rack.position.set(a.rack[0],a.rack[1],a.rack[2]+.18);root.add(rack);box(rack,[1.92,.74,.08],[0,0,0],m.slate);
 for(const x of [-.81,.81]){box(rack,[.11,.62,.12],[x,0,-.07],m.white);box(rack,[.20,.035,.23],[x,-.29,-.12],m.steel);}
 plate(rack,'RAIL CASSETTE / RELEASE',[1.58,.085],[0,.31,-.049],[0,Math.PI,0],{font:37});target('lift',a.rack,[1.70,.80,.60]);
 // A restrained floor mount, not a glowing floating pedestal.
 const socket=new T.Group();socket.position.fromArray(a.mount);root.add(socket);
 for(const x of [-.53,.53]){box(socket,[.17,.94,.17],[x,-.69,0],m.white,true);box(socket,[.33,.045,.66],[x,-1.185,0],m.slate,true);box(socket,[.25,.09,.52],[x,-.17,0],m.steel);box(socket,[.055,.13,.10],[x,-.19,.27],m.orange);}
 box(socket,[1.17,.10,.11],[0,-.57,0],m.slate);cable(socket,[[-.53,-.45,0],[-.60,-.70,0],[-.6,-1.15,.13]],m.rubber,.014);
 target('mount',a.mount,[1.9,1.25,.75]);target('load',[a.mount[0],a.mount[1]+.2,a.mount[2]],[1.60,.65,.80]);
 // Split octagonal pressure leaf fits the existing structural rim; it retracts into the wall.
 const shutter=new T.Group();shutter.position.set(a.innerX,.14,a.origin[2]);shutter.rotation.y=-Math.PI/2;root.add(shutter);const leaves=[];
 for(const side of [-1,1]){const leaf=new T.Group();shutter.add(leaf);const shell=new T.Mesh(doorHalf(side,1.445,.11),m.slate);leaf.add(shell);const skin=new T.Mesh(doorHalf(side,1.395,.025),m.white);skin.position.z=.069;leaf.add(skin);box(leaf,[.018,2.55,.012],[side*.022,0,.092],m.orange);box(leaf,[.24,.065,.055],[side*.58,.02,.11],m.steel);box(leaf,[.12,.024,.064],[side*.58,.02,.148],m.dark);plate(leaf,side<0?'AIRLOCK':'PRESSURE',[.77,.084],[side*.54,.50,.089],undefined,{font:42});screwRow(leaf,[[side*.84,.65,.093],[side*.84,-.65,.093],[side*.3,1.02,.093],[side*.3,-1.02,.093]],m.steel,.012);leaf.position.x=side*1.65;leaves.push({leaf,side});}
 // Production host supplies the original moving exterior hatch and wall switch.
 const outerFallback=new T.Group();outerFallback.position.set(a.outerX,.14,a.origin[2]);outerFallback.rotation.y=-Math.PI/2;root.add(outerFallback);outerFallback.visible=!host.airlockDoors;
 if(!host.airlockDoors){const geo=new T.CylinderGeometry(1.03,1.03,.12,48);geo.rotateX(Math.PI/2);outerFallback.add(new T.Mesh(geo,m.white));}
 if(!controlPoint){const plateGroup=new T.Group();plateGroup.position.fromArray(a.button);plateGroup.rotation.y=-Math.PI/2;root.add(plateGroup);box(plateGroup,[.16,.24,.06],[0,0,0],m.slate);box(plateGroup,[.05,.08,.03],[0,.02,.045],m.orange);}
 target('seal',a.button,[.36,.43,.38]);
 host.registerSolids?.(solids,[]);host.setAirlockBarrier?.(()=>state.innerClosed||job?.type==='seal'?{x:a.innerX,z:a.origin[2],r:1.3}:null);
 const prompt=document.createElement('div');prompt.className='ch3-airlock-prompt';prompt.hidden=true;document.body.append(prompt);
 const messages={stow:'Set CubeSat on staging cradle',lift:'Release launcher rail from wall rack',mount:'Mount rail in launch stand',load:'Slide CubeSat into launcher',seal:'Close inner airlock hatch'},actions={await_payload:'stow',payload_stowed:'lift',rail_held:'mount',rail_mounted:'load',payload_loaded:'seal'};
 function begin(type,duration,done){if(job)return;job={type,started:performance.now(),duration,done};host.playChapterSound?.(type);emit('airlock-action-started',{action:type});}
 function act(action){if(job||actions[state.stage]!==action)return;
  if(action==='stow'){if(!workshop.carrying)return;onLoaded();relay=workshop.releaseForDeployment(stagedPayload,{preserveWorld:true});begin('stow',c.timings.load,()=>{state=advanceLaunch(state,'stow');announce('rail-unrack','Payload secure. Release the launcher rail from the wall rack.');});job.p=relay.position.clone();job.q=relay.quaternion.clone();}
  if(action==='lift'){railCarry=new T.Group();host.cam.add(railCarry);railCarry.position.set(-.03,-.22,-1.08);railCarry.rotation.y=.14;host.scene.updateMatrixWorld(true);railCarry.attach(rail);begin('lift',c.timings.railLift,()=>{state=advanceLaunch(state,'lift');announce('rail-mount','Mount the rail on the launch stand.');});job.p=rail.position.clone();job.q=rail.quaternion.clone();}
  if(action==='mount'){host.scene.updateMatrixWorld(true);root.attach(rail);railCarry.removeFromParent();railCarry=null;begin('mount',c.timings.railMount,()=>{state=advanceLaunch(state,'mount');announce('relay-load','Rail locked. Load the CubeSat from the staging cradle.');});job.p=rail.position.clone();job.q=rail.quaternion.clone();}
  if(action==='load'){const anchor=new T.Group();anchor.position.fromArray(a.mount);anchor.position.y+=.20;root.add(anchor);anchors.push(anchor);host.scene.updateMatrixWorld(true);anchor.attach(relay);begin('load',c.timings.load,()=>{state=advanceLaunch(state,'load');announce('leave-airlock','Payload restrained. Leave the airlock and use the hatch control outside.');emit('payload-loaded');});job.p=relay.position.clone();job.q=relay.quaternion.clone();}
  if(action==='seal'){if(host.pos.x>a.innerX-.45){announce('exit-first','Leave the airlock before sealing it. The hatch control is outside.');return;}begin('seal',c.timings.hatch,()=>{state=advanceLaunch(state,'seal',{playerOutside:true});announce('launch-ready','CubeSat is ready for launch. Go to the control center.');onReady();});}
 }
 function launch(){if(!launchReady(state)||job)throw Error('Complete the rail, restraint and inner hatch checks first.');announce('launch-sequence','Inner hatch sealed. Depressurizing launch bay; opening the outer hatch.');begin('vent',1.1,()=>{state=advanceLaunch(state,'vent');begin('outer',c.timings.hatch,()=>{state=advanceLaunch(state,'open');begin('launch',c.timings.launch,()=>{state=advanceLaunch(state,'launch');relay.visible=false;onDeployed();announce('relay-deployed','CubeSat release confirmed. Ready to begin the surface contact.');});});});}
 function goal(){const action=actions[state.stage];if(!action)return null;return {action,point:({stow:a.cradle,lift:a.rack,mount:a.mount,load:a.mount,seal:a.button})[action],eye:({stow:a.approach,lift:a.railEye,mount:a.mountEye,load:a.mountEye,seal:a.buttonEye})[action],title:messages[action],yaw:action==='seal'?-Math.PI/2:Math.PI};}
 const ray=new T.Raycaster();function update(){if(disposed)return;prompt.hidden=true;aim=null;root.visible=host.playing();
  if(job){const u=smooth((performance.now()-job.started)/1000/job.duration);if(['stow','lift','load'].includes(job.type)){const o=job.type==='lift'?rail:relay;o.position.copy(job.p).lerp(new T.Vector3(),u);o.quaternion.slerpQuaternions(job.q,job.type==='load'?flatQ:new T.Quaternion(),u);}if(job.type==='mount'){rail.position.copy(job.p).lerp(new T.Vector3(...a.mount),u);rail.quaternion.slerpQuaternions(job.q,new T.Quaternion(),u);}if(job.type==='seal')for(const{leaf,side}of leaves)leaf.position.x=side*1.65*(1-u);if(job.type==='outer'){host.airlockDoors?.setOuterOpen(u);outerFallback.position.z=a.origin[2]+2.5*u;}if(job.type==='launch'){relay.position.x=8*u;if(u>.35){const solar=relay.children.find(o=>o.userData?.hardwareId==='solar');if(solar)foldArrays(solar,1.48*(1-smooth((u-.35)/.5)));}}if(u>=1){const done=job.done;job=null;done();}}
  if(railCarry)poseCarryHands(host,railCarry,{rail:true});
  if(!active||!host.playing()||host.modalOpen()||job)return;const g=goal();if(!g||g.action==='stow'&&!workshop.carrying)return;host.cam.updateMatrixWorld(true);root.updateMatrixWorld(true);ray.setFromCamera(new T.Vector2(),host.cam);const hit=ray.intersectObjects(targets,false).find(h=>h.object.userData.launchAction===g.action&&h.distance<3);if(hit){aim=g.action;prompt.hidden=false;prompt.innerHTML='<kbd>E</kbd> '+messages[aim];}
 }
 const key=e=>{if(e.code==='KeyE'&&aim&&!job&&!host.modalOpen()){e.preventDefault();e.stopImmediatePropagation();act(aim);}};window.addEventListener('keydown',key,true);
 function reset(){job=null;relay=null;railCarry?.removeFromParent();railCarry=null;for(const a of anchors)a.removeFromParent();anchors.length=0;state=createLaunchState();root.add(rail);rail.position.fromArray(a.rack);rail.rotation.set(-Math.PI/2,0,0);outerFallback.position.z=a.origin[2];host.airlockDoors?.reset();for(const{leaf,side}of leaves)leaf.position.x=side*1.65;}
 return {root,update,launch,reset,goal,get ready(){return launchReady(state);},get busy(){return !!job;},get state(){return {...state};},setEnabled(v){active=!!v;},dispose(){disposed=true;window.removeEventListener('keydown',key,true);root.removeFromParent();prompt.remove();host.setAirlockBarrier?.(null);}};
}
