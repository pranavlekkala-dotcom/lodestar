import {MARS,circularOrbit,hohmann,contactGeometry} from './shared/orbital.mjs';
import {assessDesign,DEFAULT,MODULES as KIT_MODULES} from './kit.mjs';

// Chapter 3 only. These functions create no renderer, controller, Chapter 2
// objectives or DOM. Published constants and authored scenario inputs are
// separated; this is not GMAT output or a certified rescue procedure.
export const BODY=MARS;
export const SCENARIO=Object.freeze({id:'lodestar-ch3-reference-v1',referenceBody:'mars-reference',parkingAltitudeKm:600,surfaceLongitudeRad:1.4,positionBoundKm:.25,ascentSeconds:480,insertionMinKm:280,insertionMaxKm:320,dryMassKg:80000,propellantKg:10000,ispSeconds:320,protectedReserveMps:180,terminalAllowanceMps:20,latestInsertionS:21600,interceptToleranceKm:5});
export const PREPARED_RELAY=DEFAULT;
export const MODULES=KIT_MODULES;
const PHASES=['signal','assembly','deployment','contact','report','planning','committed','rendezvous'];
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const finiteTime=t=>Number.isFinite(t)&&t>=0&&t<=SCENARIO.latestInsertionS;

export function createChapter3State({missionTimeS=0,planetName='Vesper',scenarioId=SCENARIO.id}={}){
 if(!finiteTime(missionTimeS)||scenarioId!==SCENARIO.id)throw RangeError('A supported Chapter 3 scenario and epoch are required.');
 return {schemaVersion:1,scenarioId,planetName,phase:'signal',missionTimeS,installed:[],relayTest:null,deployment:null,relayPackets:[],receivedPackets:[],forecast:null,outcome:null};
}
export function beginAssembly(state){requirePhase(state,'signal');return {...state,phase:'assembly'};}
function requirePhase(s,phase){if(s.phase!==phase||!PHASES.includes(s.phase))throw Error('Action unavailable in the current chapter stage.');}
export function installPreparedModule(state,moduleId){
 requirePhase(state,'assembly');if(!MODULES.includes(moduleId))throw RangeError('Unknown prepared module.');
 if(state.installed.includes(moduleId))return state;
 return {...state,installed:[...state.installed,moduleId],relayTest:null};
}
export function testPreparedRelay(state){
 requirePhase(state,'assembly');if(!MODULES.every(id=>state.installed.includes(id)))throw Error('Fit all five prepared modules before checking the configuration.');
 const result=assessDesign(PREPARED_RELAY,SCENARIO.parkingAltitudeKm,'nominal');
 return {...state,relayTest:{scenarioId:SCENARIO.id,profile:'prepared-status-relay',exercisePassed:result.missionReady,massKg:result.massKg,minChargeWh:result.minWh,capacityWh:result.capacityWh,poweredExercisePasses:result.deliveredPasses,scope:'Existing six-orbit educational power/mass exercise. Compatible radios and qualified interfaces are assumptions, not tested facts.'}};
}
export function acceptWorkshopRelay(state,workshop){
 requirePhase(state,'assembly');
 if(workshop.location!=='carried'||!MODULES.every(id=>workshop.installed?.includes(id))||workshop.test?.revision!==workshop.revision||workshop.test?.passed!==true)throw Error('Carry the completely fitted and currently checked relay.');
 const result=assessDesign(workshop.configuration,SCENARIO.parkingAltitudeKm);
 if(!result.missionReady)throw Error('The fitted design does not pass the current power/mass exercise.');
 return {...state,installed:[...MODULES],relayTest:{configuration:{...result.configuration},revision:workshop.revision,exercisePassed:true,dutySeconds:result.dutySeconds,massKg:result.massKg,capacityWh:result.capacityWh,minChargeWh:result.minWh,scope:'Shared educational power/mass exercise; compatible radios and qualified interfaces are assumed.'}};
}
export function authorizeDeployment(state){
 requirePhase(state,'assembly');if(!state.relayTest?.exercisePassed)throw Error('A current passing configuration exercise is required.');
 return {...state,phase:'deployment'};
}
export function deployRelay(state){
 requirePhase(state,'deployment');
 return {...state,phase:'contact',deployment:{timeS:state.missionTimeS,altitudeKm:SCENARIO.parkingAltitudeKm,model:'Co-orbiting circular reference; small dispenser impulse neglected.'}};
}

export function nextSurfaceContact(afterS,packetSeconds=60){
 if(!finiteTime(afterS))throw RangeError('Invalid contact search epoch.');
 if(![60,600].includes(packetSeconds))throw RangeError('Unsupported packet duration.');
 const orbit=circularOrbit(SCENARIO.parkingAltitudeKm),n=2*Math.PI/orbit.period,w=2*Math.PI/BODY.rotationSeconds;
 for(let t=Math.ceil(afterS/5)*5;t<Math.min(afterS+orbit.period*2,SCENARIO.latestInsertionS-2*packetSeconds);t+=5){
  const a=contactGeometry(SCENARIO.parkingAltitudeKm,n*t,SCENARIO.surfaceLongitudeRad+w*t);
  const b=contactGeometry(SCENARIO.parkingAltitudeKm,n*(t+packetSeconds),SCENARIO.surfaceLongitudeRad+w*(t+packetSeconds));
  if(a.elevation>10&&b.elevation>10)return {receiveStartS:t,receiveEndS:t+packetSeconds,forwardStartS:t+packetSeconds,forwardEndS:t+packetSeconds*2,surfaceRangeKm:a.range,minEndpointElevationDeg:Math.min(a.elevation,b.elevation),scope:'Surface visibility checked. Carrier forwarding assumes the compatible prepared link to a co-orbiting carrier; a full RF link budget is not modeled.'};
 }
 return null;
}
export function receiveSurfaceReport(state,contact){
 requirePhase(state,'contact');const expected=nextSurfaceContact(state.missionTimeS+5,state.relayTest?.dutySeconds||60);
 if(!expected||!['receiveStartS','receiveEndS','forwardStartS','forwardEndS'].every(key=>contact?.[key]===expected[key]))throw Error('Contact does not match the current mission epoch and packet plan.');
 const packet={id:'survivor-status-1',frame:'body_fixed',latitudeDeg:0,longitudeEastDeg:SCENARIO.surfaceLongitudeRad*180/Math.PI,positionBoundKm:SCENARIO.positionBoundKm,sampleTimeS:contact.receiveStartS,source:'Survivor navigation report',ascent:{vehicleAlreadyOnSurface:true,profile:'prescribed-480s-insertion',minAltitudeKm:SCENARIO.insertionMinKm,maxAltitudeKm:SCENARIO.insertionMaxKm},latestInsertionS:SCENARIO.latestInsertionS};
 return {...state,missionTimeS:contact.receiveEndS,relayPackets:[packet],forwardOpportunity:{startS:contact.forwardStartS,endS:contact.forwardEndS}};
}
export function forwardReportToCarrier(state){
 requirePhase(state,'contact');if(!state.relayPackets.length||!state.forwardOpportunity)throw Error('The relay must receive a packet before forwarding it.');
 return {...state,phase:'report',missionTimeS:state.forwardOpportunity.endS,receivedPackets:state.relayPackets.map(packet=>({...packet,receivedTimeS:state.forwardOpportunity.endS}))};
}
export function crewKnowledge(state){
 return state.receivedPackets.length?{status:'report_received',report:structuredClone(state.receivedPackets[0])}:{status:'fragment_only',report:null};
}
export function acknowledgeReport(state){requirePhase(state,'report');if(!state.receivedPackets.length)throw Error('No report received aboard.');return {...state,phase:'planning'};}

export function forecastRescue(state,{altitudeKm=300,launchOffsetS=0}={}){
 requirePhase(state,'planning');const report=crewKnowledge(state).report;
 if(!report)return {status:'needs_data',checks:[],input:null};
 if(!Number.isFinite(altitudeKm)||altitudeKm<200||altitudeKm>900||!Number.isFinite(launchOffsetS)||Math.abs(launchOffsetS)>3600)throw RangeError('Unsupported orbit or timing input.');
 const epoch=state.missionTimeS,transfer=hohmann(SCENARIO.parkingAltitudeKm,altitudeKm),orbit=circularOrbit(altitudeKm),n=2*Math.PI/orbit.period,w=2*Math.PI/BODY.rotationSeconds,A=SCENARIO.ascentSeconds;
 const theta0=2*Math.PI/circularOrbit(SCENARIO.parkingAltitudeKm).period*epoch,coastEnd=epoch+transfer.coast;
 // Prescribed ascent: angular rate ramps linearly from body rotation to n;
 // integrated sweep is (w+n)*A/2. Powered ascent feasibility remains assumed.
 const sweep=(w+n)*A/2;let recommendedLaunchS=null;
 for(let k=-4;k<30;k++){const t=(report.longitudeEastDeg*Math.PI/180+sweep-theta0-Math.PI-n*(A-coastEnd)+2*Math.PI*k)/(n-w);if(t>=coastEnd+60){recommendedLaunchS=t;break;}}
 if(recommendedLaunchS===null)return {status:'unavailable',checks:[],input:null};
 const launchS=recommendedLaunchS+launchOffsetS,insertionS=launchS+A;
 const carrierAngle=theta0+Math.PI+n*(insertionS-coastEnd),capsuleAngle=report.longitudeEastDeg*Math.PI/180+w*launchS+sweep;
 const nominalMissKm=2*orbit.radius*Math.abs(Math.sin(wrap(carrierAngle-capsuleAngle)/2));
 const availableDvMps=SCENARIO.ispSeconds*9.80665*Math.log((SCENARIO.dryMassKg+SCENARIO.propellantKg)/SCENARIO.dryMassKg);
 const remainingDvMps=availableDvMps-transfer.totalDv-SCENARIO.terminalAllowanceMps;
 const link=contactGeometry(altitudeKm,theta0+Math.PI+n*(launchS-coastEnd),report.longitudeEastDeg*Math.PI/180+w*launchS);
 const checks=[
  {id:'capsule_capability',pass:altitudeKm>=report.ascent.minAltitudeKm&&altitudeKm<=report.ascent.maxAltitudeKm,reason:'Chosen altitude must be within the reported insertion profile.'},
  {id:'intercept',pass:nominalMissKm+report.positionBoundKm<=SCENARIO.interceptToleranceKm,reason:'Same altitude also requires matching phase/time, including the reported position bound.'},
  {id:'reserve',pass:remainingDvMps>=SCENARIO.protectedReserveMps,reason:'Protect the authored reserve after the two burns and terminal allowance.'},
  {id:'deadline',pass:insertionS<=report.latestInsertionS,reason:'Reach insertion before the reported scenario reserve limit.'},
  {id:'command_visibility',pass:link.visible,reason:'The direct capsule-command link needs local line of sight; equipment compatibility is assumed.'}
 ];
 return {status:checks.every(c=>c.pass)?'modeled_checks_pass':'modeled_check_failed',scenarioId:SCENARIO.id,input:{epochSeconds:epoch,altitudeKm,launchOffsetS,packetId:report.id},launchS,recommendedLaunchS,insertionS,nominalMissKm,positionBoundKm:report.positionBoundKm,transfer,orbit,availableDvMps,remainingDvMps,checks,provenance:{engine:'analytic-two-body',gmatExecuted:false,ascent:'prescribed profile; powered ascent not verified',rendezvous:'nominal insertion encounter; docking not solved',rf:'geometry only; complete link budget not solved'}};
}
export function commitRescue(state,forecast){
 requirePhase(state,'planning');if(forecast.status!=='modeled_checks_pass'||forecast.scenarioId!==state.scenarioId||forecast.input?.epochSeconds!==state.missionTimeS)throw Error('A current passing modeled forecast is required.');
 const recomputed=forecastRescue(state,{altitudeKm:forecast.input.altitudeKm,launchOffsetS:forecast.input.launchOffsetS});
 if(recomputed.status!=='modeled_checks_pass'||recomputed.input.packetId!==forecast.input.packetId)throw Error('The forecast is stale or unsupported.');
 return {...state,phase:'committed',forecast:recomputed};
}
export function finishReferenceEncounter(state){
 requirePhase(state,'committed');return {...state,phase:'rendezvous',missionTimeS:state.forecast.insertionS,outcome:{label:'Nominal insertion rendezvous in the reference case',cargo:'deferred',crewTransferred:false,earthReturnSimulated:false}};
}
