import * as THREE from 'three';
import {createHardware,foldArrays,slotPosition} from './hardware.mjs';
import {assessDesign,designCost,WORKSHOP,CASE,FIELDS,FAULTS,normalize} from './kit.mjs';
import {MODULES} from './kit.mjs';
import {createWorkshop,restoreWorkshop,fitModule,checkWorkshop,moduleMatches,canCarry,canTrial,carryRelay,returnRelay} from './workshop-state.mjs';
import {createWorkshopGeometry,BENCH} from './workshop-geometry.mjs';
import {styles} from './workshop-styles.mjs';
import {coreConfig} from './config.mjs';
import {createPayloadFinish} from './payload-detail.mjs';
import {poseCarryHands} from './carry-grip.mjs';
import {announce} from './integration.mjs';
import {cycleFocus} from './focus.mjs';

const STORE='lodestar.chapter3.mission.v5';
const LABELS={solar:'Solar arrays',battery:'Battery storage',computer:'Flight computer',attitude:'Pointing control',relay:'Relay radio',antenna:'Antenna',protection:'Protection',review:'Hardware check'};
const LESSONS={antenna:'Gain concentrates a radio beam. A high-gain antenna needs more accurate pointing; a wide-angle antenna tolerates larger errors.',protection:'An isolator, spare radio, spare antenna and heater help different failures. Each costs parts and mass.',solar:'Arrays supply power in sunlight. Batteries must cover the time in shadow.',battery:'Stored energy keeps the receiver, computer and pointing system running during eclipse.',computer:'A controller follows the contact plan and stores received packets. A backup uses more parts.',attitude:'Reaction wheels change orientation, not the orbit. The kit also includes attitude sensors.',relay:'A receiver hears the astronaut. Store-and-forward receives a packet, saves it, then sends it to the ship.'};
const EXPLAIN={antenna:'Small does not always mean bad. A low-gain antenna can recover the same precise packet by using a slower receive profile. It takes longer.',protection:'Protection is selective: an isolator handles a short, a spare radio handles a radio fault, and a heater draws extra power to protect a cold battery.',solar:'More collecting area makes more power, but consumes parts and adds mass. Small arrays leave room in the allowance for more storage.',battery:'A second pack increases capacity, not solar generation. It helps through darkness, but costs mass and parts.',computer:'A backup can tolerate one controller failure in this authored fault case. It does not create extra solar energy.',attitude:'Without pointing, this kit cannot keep its arrays and antenna oriented for the relay task.',relay:'Short status packets use less radio time. A longer recording carries more data but draws power for longer.'};
const ease=t=>t*t*(3-2*t),clamp=x=>Math.max(0,Math.min(1,x));

/** Chapter 3 component, mounted by the host before its existing movement setup.
 * No renderer for the 3D scene, player controller, Chapter 2 objectives or RAF.
 * Host: scene,cam,pos,vel,keys, getMovement(), playing(), modalOpen(),
 * openModal(),closeModal(),modalVisible(), requestLook(), registerSolids(). */
export function mountCubeSatWorkshop(host,{storage,enabled=true,config={}}={}){
 const settings=coreConfig(config),BENCH=settings.bench;let missionEpoch=()=>0;
 let persistence=storage;try{if(persistence===undefined)persistence=globalThis.localStorage;}catch{}
 // The director starts a new checkpoint on a page load. Retain choices only;
 // fitted hardware and a prior check belong to the previous physical mission.
 let state=createWorkshop();try{const saved=restoreWorkshop(JSON.parse(persistence?.getItem(STORE)||'null'));state={...state,configuration:saved.configuration};}catch{}
 let draft={...state.configuration},selected='solar',testCase='nominal',animation=null,open=false,clock=0,disposed=false,message='',carry=null,aim=null;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const geometry=createWorkshopGeometry(host.scene,settings),parts=new Map(),ray=new THREE.Raycaster(),forward=new THREE.Vector3(),target=new THREE.Vector3();
 for(const id of state.installed)parts.set(id,geometry.mount(id,state.configuration));
 host.registerSolids?.(geometry.colliders,geometry.obstacles);
 const finish=createPayloadFinish(geometry.assembly);let testing=null,pickup=null;
 if(state.test?.passed)finish.cover(1);
 const style=document.createElement('style');style.textContent=styles;document.head.append(style);
 // Project an AR surface with the existing camera. A flat DOM hit surface avoids
 // browser hit-testing/scroll bugs with a deeply transformed CSS3D hierarchy.
 const projector=document.createElement('div');projector.id='ch3-projector';projector.hidden=true;document.body.append(projector);
 const surface=document.createElement('section');surface.className='ch3-surface';surface.setAttribute('role','dialog');surface.setAttribute('aria-modal','true');surface.setAttribute('aria-label','CubeSat relay workshop');projector.append(surface);surface.style.position='absolute';
 const prompt=document.createElement('div');prompt.id='ch3-prompt';prompt.hidden=true;document.body.append(prompt);
 const carryBadge=document.createElement('div');carryBadge.id='ch3-carry';carryBadge.hidden=true;document.body.append(carryBadge);
 let width=0,height=0,parallaxX=0,parallaxY=0;
 const saves=()=>{try{persistence?.setItem(STORE,JSON.stringify(state));}catch{}};
 const emit=(type,detail={})=>document.dispatchEvent(new CustomEvent('lodestar:chapter3:'+type,{detail:structuredClone({revision:state.revision,configuration:state.configuration,...detail})}));
 function showMessage(text){message=text;const el=surface.querySelector('.ch3-msg');if(el){el.textContent=text;el.hidden=!text;}}
 function setRacks(){for(const [id,station]of Object.entries(geometry.stations))station.part.visible=!state.installed.includes(id)&&(!open||id!==selected);}
 function setCandidate(){
  if(animation)return;
  geometry.preview.clear();geometry.preview.visible=open&&selected!=='review'&&state.location==='bench'&&!moduleMatches(state,selected,draft);
  if(!geometry.preview.visible){setRacks();return;}
  const module=selected==='attitude'&&!draft.attitude?new THREE.Group():createHardware(selected,draft);if(selected==='solar')foldArrays(module,.75);
  geometry.preview.add(module);geometry.preview.position.set(-1.08,.80,.78);geometry.preview.rotation.set(.12,.3,0);geometry.preview.scale.setScalar(BENCH.scale*(selected==='solar'?1:1.65));
  // Fit even the widest array into its inspection area; installed hardware keeps its real game scale.
  geometry.root.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(geometry.preview);
  if(!bounds.isEmpty()){const camera=host.cam.clone();camera.position.fromArray(BENCH.inspectionEye);camera.lookAt(new THREE.Vector3(...BENCH.inspectionTarget));camera.updateMatrixWorld(true);let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);loX=Math.min(loX,p.x);hiX=Math.max(hiX,p.x);loY=Math.min(loY,p.y);hiY=Math.max(hiY,p.y);}const width=(hiX-loX)*innerWidth/2,height=(hiY-loY)*innerHeight/2,fit=Math.min(1,Math.min(340,innerWidth*.27)/Math.max(1,width),270/Math.max(1,height));geometry.preview.scale.multiplyScalar(fit*.96);}
  setRacks();
 }
 function select(id){if(animation||testing)return;selected=id;draft={...state.configuration};message='';setCandidate();render();}
 function controls(key,entries){return `<div class="ch3-options">${entries.map(([value,title,note])=>`<button type="button" data-option="${key}" data-value="${value}" aria-pressed="${draft[key]===value}">${title}<small>${note}</small></button>`).join('')}</div>`;}
 function optionPane(){
  const heading=t=>'<div class="ch3-subtitle">'+t+'</div>';
  if(selected==='solar')return controls('panels',[[0,'No arrays','Stored power only'],[2,'Two panels','Compact collecting area'],[4,'Four panels','More collecting area']])+heading('Panel size')+controls('panelSize',[['small','Small','0.02 m² each'],['large','Large','0.04 m² each']]);
  if(selected==='battery')return controls('batteries',[[1,'One cartridge','Lower mass'],[2,'Two cartridges','More stored energy']])+heading('Cell capacity')+controls('cellType',[['light','Light pack','8 Wh per pack · 1 part each'],['standard','Standard pack','43 Wh per pack · 3/5 parts']]);
  if(selected==='computer')return controls('computers',[[1,'Primary controller','1 part'],[2,'Primary + backup','3 parts']])+heading('Data protection')+controls('memory',[['basic','Standard storage','Rejects corrupt navigation packets'],['ecc','Protected memory','+1 part · survives this memory fault']]);
  if(selected==='attitude')return controls('attitude',[[true,'Sensors + wheels','Controlled pointing'],[false,'No pointing kit','Large attitude errors']])+heading('Pointing quality')+controls('pointing',[['basic','Basic sensors','Lower mass and load'],['precision','Precision tracker','+2 parts · smaller fault residual']]);
  if(selected==='antenna')return controls('antenna',[['omni','Wide-angle whips','2 dBi · broad coverage'],['patch','Patch array','8 dBi · 1 part'],['dish','High-gain dish','16 dBi · 3 parts · narrow beam']]);
  if(selected==='protection')return controls('isolator',[[false,'No isolator','A short can trip the shared bus'],[true,'Array isolator','1 part · isolates a failed branch']])+controls('radioBackup',[[false,'One radio','No RF spare'],[true,'Spare radio','+3 parts · survives a radio fault']])+controls('antennaBackup',[[false,'One feed','No spare antenna'],[true,'Spare whips','+2 parts · fallback low-gain feed']])+controls('heater',[[false,'Passive battery','No heater load'],[true,'Battery heater','+1 part · extra 0.8 W load']]);
  return '<p class="ch3-note">Store-and-forward relay · surface → CubeSat → Lodestar</p>'+controls('transmitter',[['eco','1 W RF','8 W electrical draw'],['standard','4 W RF','12 W electrical draw'],['boost','8 W RF','24 W draw · +2 parts']])+controls('duty',[['brief','Essential status','Small rescue packet bundle'],['archive','Bulk recording','Adds a large optional recording']])+'<details><summary>Receive-only diagnostic</summary><p>A relay needs a transmitter. Receive-only is available for a deliberate failure trial.</p>'+controls('radio',[['listen','Receive only','Stores packets but cannot send them'],['relay','Store + forward','Required for a rescue relay']])+'</details>';

 }
 function reviewPane(){
 const r=assessDesign(state.configuration,600,testCase),trial=state.test?.trial;
 const metric=(ok,value,note)=>'<div class="ch3-check '+(ok?'good':'bad')+'"><strong>'+value+'</strong><span>'+note+'</span></div>';
 const causes=r.problems.length?r.problems:(trial&&trial.kind!=='success'?trial.causes:[]);
 const condition='<section class="ch3-test-condition"><label for="ch3-fault">Test conditions</label><select id="ch3-fault">'+Object.entries(FAULTS).map(([id,name])=>'<option value="'+id+'" '+(id===testCase?'selected':'')+'>'+name+'</option>').join('')+'</select><small>The selected condition also applies when this kit is deployed.</small></section>';
 return condition+'<div class="ch3-checks">'+metric(r.energyOK,(Math.round(r.minWh/r.capacityWh*100)||0)+'%','lowest battery · endurance reserve 20%')+metric(r.massOK,r.massKg.toFixed(2)+' kg','payload allowance '+CASE.massLimitKg+' kg')+metric(r.budgetOK,r.cost+' / '+WORKSHOP.budget,'parts allowance')+metric(trial?.kind==='success',trial?trial.kind.replaceAll('_',' '):'Not tested','predicted report delivery')+'</div><div class="ch3-result" role="status">'+(trial?(state.test.passed?'Check passed. Ready to carry to the airlock.':causes.slice(0,2).join(' ')||'Check failed. Revise this configuration.'):'Run the check to see what this kit can deliver.')+'</div><details><summary>NASA resources and model</summary><p>Sunlight charges storage; eclipse and radio use draw it down. Antenna gain, pointing, range and bit rate determine whether complete packets decode. Hardware ratings, parts, faults and tolerances are authored game inputs. The check combines a six-orbit endurance exercise and one contact rehearsal; it is not flight qualification.</p><p><a href="https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/" target="_blank" rel="noopener">NASA communications</a> · <a href="https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/" target="_blank" rel="noopener">NASA power</a></p></details>';
 }
 function render(){
  if(!open)return;
  const reviewing=selected==='review',pending=!reviewing&&!moduleMatches(state,selected,draft),candidate={...state.configuration,...(!reviewing?Object.fromEntries(Object.keys(draft).filter(k=>(FIELDS[selected]||[]).includes(k)).map(k=>[k,draft[k]])): {})},cost=designCost(candidate),r=assessDesign(candidate,600);
  surface.innerHTML=`<header class="ch3-head"><div><div class="ch3-eyebrow">LODESTAR / RELAY LAB</div><h1 class="ch3-title">Configure CubeSat relay</h1></div><button class="ch3-close" type="button" data-action="close">Close · E</button></header><nav class="ch3-progress" aria-label="Assembly stages">${[...MODULES,'review'].map((id,i)=>`<button type="button" data-step="${id}" aria-current="${id===selected?'step':'false'}" data-fitted="${state.installed.includes(id)}" ${animation||testing?'disabled':''}>${String(i+1).padStart(2,'0')}<br>${id==='review'?'Check':LABELS[id].split(' ')[0]}</button>`).join('')}</nav><main class="ch3-main"><div class="ch3-section"><span class="ch3-number">${String([...MODULES,'review'].indexOf(selected)+1).padStart(2,'0')}</span><h2>${LABELS[selected]}</h2></div>${reviewing?reviewPane():`<p>${LESSONS[selected]}</p>${optionPane()}<p class="ch3-explain">${EXPLAIN[selected]}</p>`}</main><div class="ch3-budget"><span class="${cost>WORKSHOP.budget?'bad':'good'}">Planned kit ${cost} / ${WORKSHOP.budget} parts</span><span class="${r.massOK?'':'bad'}">${r.massKg.toFixed(2)} kg</span><span>${state.installed.length} / ${MODULES.length} fitted</span></div><div class="ch3-msg" role="status" ${message?'':'hidden'}>${message}</div><footer class="ch3-footer"><span class="ch3-status" aria-live="polite">${testing?'Running hardware check…':animation?'Aligning and seating module…':reviewing?(state.test?.passed?'Ready for transport':'Test the fitted hardware'):pending?'Preview · not installed':'Fitted in service cradle'}</span>${reviewing?`<button type="button" class="ch3-secondary" data-action="check" ${animation||testing||state.installed.length<MODULES.length?'disabled':''}>Run check</button><button type="button" class="ch3-primary" data-action="carry" ${canTrial(state)&&!testing?'':'disabled'}>${canCarry(state)?'Take relay':'Take for trial'}</button>`:`<button type="button" class="ch3-primary" data-action="install" ${animation||testing||!pending||cost>WORKSHOP.budget?'disabled':''}>${pending?'Select & install':'Installed'}</button><button type="button" class="ch3-secondary" data-action="next" ${animation||testing?'disabled':''}>Next →</button>`}</footer>`;
  surface.dataset.module=selected;surface.dataset.fitted=state.installed.length;surface.dataset.revision=state.revision;surface.dataset.test=state.test?.passed?'pass':state.test?'fail':'unchecked';
  for(const sel of surface.querySelectorAll('select'))sel.disabled=!!testing||!!animation;
  for(const button of surface.querySelectorAll('[data-option]'))button.disabled=!!animation||!!testing||state.location!=='bench';
  positionSurface();
 }
 function beginInstall(){
  if(animation||testing||selected==='review')return;
  finish.cover(0);
  let next;try{next=fitModule(state,selected,draft);}catch(e){showMessage(e.message);return;}
  const id=selected,old=parts.get(id);if(old){old.removeFromParent();parts.delete(id);}
  const part=geometry.preview.children[0];if(!part)return;
  // Preserve the viewed module's actual world pose; this object becomes the installed part.
  host.scene.updateMatrixWorld(true);geometry.assembly.attach(part);
  const startPosition=part.position.clone(),startQuaternion=part.quaternion.clone(),startScale=part.scale.clone();
  animation={id,next,part,startPosition,startQuaternion,startScale,started:performance.now(),duration:reduce?.08:settings.timings.fit};
  message='';render();emit('installation-started',{module:id});
 }
 function finishInstall(){const a=animation;state=a.next;parts.set(a.id,a.part);animation=null;saves();setCandidate();render();emit('module-installed',{module:a.id,installed:state.installed});}
 function take(){
  if(testing)return;const needsCover=!state.test?.passed;try{state=carryRelay(state,{allowRisk:!canCarry(state)});}catch(e){showMessage(e.message);return;}
  close();carry=new THREE.Group();carry.name='CH3 / two-hand payload carry';host.cam.add(carry);carry.position.set(0,-.46,-1.0);carry.rotation.set(-.42,0,0);   /* Lodestar: held low and upright, out of the way of the view */
  host.scene.updateMatrixWorld(true);carry.attach(geometry.assembly);
  pickup={sealing:needsCover,started:performance.now(),position:geometry.assembly.position.clone(),quaternion:geometry.assembly.quaternion.clone(),scale:geometry.assembly.scale.clone()};
  host.setPayloadCarrying?.(true);foldArrays(parts.get('solar'),1.48);saves();emit('relay-picked-up');announce('relay-carry','CubeSat secured. Take it to the airlock staging cradle.');
 }
 function putBack(){
  if(state.location!=='carried')return;
  carry.removeFromParent();carry=null;pickup=null;host.setPayloadCarrying?.(false);geometry.root.add(geometry.assembly);geometry.assembly.position.set(-.35,.51,.07);geometry.assembly.rotation.set(0,0,0);geometry.assembly.scale.setScalar(BENCH.scale);foldArrays(parts.get('solar'),1.12);
  state=returnRelay(state);saves();emit('relay-returned');
 }
 function openAt(id='solar'){
  if(!enabled||!host.playing()||host.modalOpen()||state.location!=='bench')return false;
  open=true;prompt.hidden=true;host.openModal();host.vel.set(0,0,0);host.getMovement()?.pause();for(const key in host.keys)host.keys[key]=false;
  host.inspectAt?.(BENCH.inspectionEye,BENCH.inspectionTarget);
  projector.hidden=false;document.body.classList.add('ch3-control-open');select(id);surface.querySelector('button')?.focus({preventScroll:true});emit('workshop-opened');return true;
 }
 function close(){if(!open)return;open=false;projector.hidden=true;document.body.classList.remove('ch3-control-open');geometry.preview.visible=false;setRacks();host.endInspection?.();host.closeModal();host.getMovement()?.resume();host.requestLook?.();emit('workshop-closed');}
 const click=e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.step){select(button.dataset.step);return;}
  if(button.dataset.option){const key=button.dataset.option,value=button.dataset.value;draft[key]=['attitude','isolator','radioBackup','antennaBackup','heater'].includes(key)?value==='true':['panels','batteries','computers'].includes(key)?Number(value):value;message='';setCandidate();render();return;}
  const action=button.dataset.action;if(action==='close')close();else if(action==='next')select([...MODULES,'review'][[...MODULES,'review'].indexOf(selected)+1]);else if(action==='install')beginInstall();else if(action==='check'){try{if(testing)return;const next=checkWorkshop(state,{fault:testCase,epochS:missionEpoch()});finish.cover(0);testing={started:performance.now(),next};render();emit('relay-test-started');host.playChapterSound?.('test-start');}catch(error){showMessage(error.message);}}else if(action==='carry')take();
 };
 surface.addEventListener('click',click);
 surface.addEventListener('change',e=>{if(e.target.id==='ch3-fault'){testCase=e.target.value;state={...state,test:null};finish.cover(0);saves();render();}});
 surface.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
 surface.addEventListener('pointermove',e=>{const b=surface.getBoundingClientRect();parallaxX=clamp((e.clientX-b.left)/b.width)-.5;parallaxY=clamp((e.clientY-b.top)/b.height)-.5;});
 const keydown=e=>{
  if(!enabled||!host.playing())return;
  if(open){if(e.code==='Tab'){cycleFocus(surface,e);return;}if(['KeyE','Escape'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();close();}return;}
  if(e.code==='KeyE'&&aim&&!host.modalOpen()){e.preventDefault();e.stopImmediatePropagation();if(state.location==='carried')putBack();else openAt(aim);}
 };
 window.addEventListener('keydown',keydown,true);
 function positionSurface(){
  if(!open)return;
  surface.style.left='auto';surface.style.right='2.2vw';surface.style.top='50%';
  surface.style.transform=`translateY(-50%) perspective(1600px) rotateX(${reduce?0:-parallaxY*.8}deg) rotateY(${reduce?0:parallaxX*1.2}deg)`;
 }
 function update(dt){
  if(disposed)return;clock=performance.now()/1000;geometry.root.visible=host.playing();geometry.light.visible=geometry.root.visible;
  if(open&&!host.modalVisible())close();
  if(testing){const u=clamp((performance.now()-testing.started)/1000/settings.timings.test);finish.lights(u,testing.next.test.passed);if(u>.72&&testing.next.test.passed)finish.cover(ease(clamp((u-.72)/.28)));if(u>=1){state=testing.next;testing=null;finish.idle();saves();render();emit('relay-tested',{passed:state.test.passed});host.playChapterSound?.(state.test.passed?'test-pass':'test-fail');}}
  if(pickup){const u=ease(clamp((performance.now()-pickup.started)/1000/settings.timings.pickup));if(pickup.sealing)finish.cover(u);geometry.assembly.position.copy(pickup.position).lerp(new THREE.Vector3(),u);geometry.assembly.quaternion.slerpQuaternions(pickup.quaternion,new THREE.Quaternion(),u);geometry.assembly.scale.copy(pickup.scale).lerp(new THREE.Vector3(BENCH.scale,BENCH.scale,BENCH.scale),u);if(u>=1)pickup=null;}
  if(carry&&!pickup){carry.position.y=-.46+Math.sin(clock*1.5)*.004;carry.rotation.z=Math.sin(clock*1.1)*.004;}
  if(carry)poseCarryHands(host,carry);

  if(animation){const a=animation;const t=clamp((performance.now()-a.started)/1000/a.duration),rotationT=ease(clamp(t/.35)),slideT=ease(clamp((t-.35)/.65)),from=a.startPosition.clone(),slot=slotPosition(a.id),entry=slot.clone().add(new THREE.Vector3(0,0,.23));
   a.part.quaternion.slerpQuaternions(a.startQuaternion,new THREE.Quaternion(),rotationT);a.part.scale.copy(a.startScale).lerp(new THREE.Vector3(1,1,1),rotationT);
   if(t<.35)a.part.position.copy(from).lerp(entry,ease(t/.35));else a.part.position.copy(entry).lerp(slot,slideT);
   if(a.id==='solar')foldArrays(a.part,.75+.37*ease(t));if(t>=1)finishInstall();
  }else if(open&&selected!=='review'&&!reduce){geometry.preview.rotation.y=.3+Math.sin(clock*.55)*.20;geometry.preview.rotation.z=Math.sin(clock*.7)*.035;geometry.preview.position.y=.80+Math.sin(clock*1.1)*.015;}
  prompt.hidden=true;aim=null;
  if(enabled&&host.playing()&&!open&&!host.modalOpen()&&(!host.roomId||host.roomId()===settings.roomId)){
   host.cam.getWorldDirection(forward);geometry.root.localToWorld(target.set(-.35,.51,.07));
   if(host.cam.position.distanceTo(target)<3.4&&forward.dot(target.sub(host.cam.position).normalize())>.8){
    ray.setFromCamera(new THREE.Vector2(),host.cam);const hits=ray.intersectObjects(geometry.targets,false);aim=hits[0]?.object.userData.workshopId||'solar';prompt.hidden=false;prompt.innerHTML=`<kbd>E</kbd>${state.location==='carried'?'Return relay to cradle':'Configure CubeSat relay'}`;
   }
  }
  carryBadge.hidden=state.location!=='carried'||!host.playing();carryBadge.textContent='CUBESAT / SECURED · AIRLOCK STAGING';
  if(open)positionSurface();
 }
 setCandidate();
 return {root:geometry.root,colliders:geometry.colliders,obstacles:geometry.obstacles,update,open:openAt,close,
  reset({configuration=null}={}){
   close();animation=null;testing=null;pickup=null;finish.cover(0);finish.idle();host.setPayloadCarrying?.(false);carry?.removeFromParent();carry=null;
   geometry.root.add(geometry.assembly);geometry.assembly.position.set(-.35,.51,.07);geometry.assembly.rotation.set(0,0,0);geometry.assembly.scale.setScalar(BENCH.scale);geometry.assembly.visible=true;
   for(const part of parts.values())part.removeFromParent();parts.clear();
   // Also discard an uncommitted in-flight installation, retaining the chassis.
   for(const child of [...geometry.assembly.children])if(child.userData.hardwareId)child.removeFromParent();
   state=createWorkshop();if(configuration)state.configuration=normalize(configuration);draft={...state.configuration};selected='solar';message='';testCase='nominal';saves();setCandidate();emit('workshop-reset');
  },
  setMissionEpochProvider(fn){missionEpoch=typeof fn==='function'?fn:()=>0;if(state.test&&(state.test.operations?.epochS||0)!==missionEpoch()){state={...state,test:null};finish.cover(0);saves();}},get assembly(){return geometry.assembly;},get isOpen(){return open;},get state(){return structuredClone(state);},get carrying(){return state.location==='carried';},setEnabled(value){enabled=!!value;if(!enabled)close();},
  releaseForDeployment(parent,{preserveWorld=false}={}){if(state.location!=='carried')throw Error('Carry the checked relay to the airlock staging cradle first.');host.scene.updateMatrixWorld(true);if(preserveWorld)parent.attach(geometry.assembly);else{parent.add(geometry.assembly);geometry.assembly.position.set(0,0,0);geometry.assembly.rotation.set(0,0,0);geometry.assembly.scale.setScalar(BENCH.scale);}carry.removeFromParent();carry=null;pickup=null;host.setPayloadCarrying?.(false);state={...state,location:'dispenser'};saves();emit('relay-staged');return geometry.assembly;},
  dispose(){if(disposed)return;close();disposed=true;window.removeEventListener('keydown',keydown,true);projector.remove();prompt.remove();carryBadge.remove();style.remove();geometry.root.removeFromParent();carry?.removeFromParent();}
 };
}


