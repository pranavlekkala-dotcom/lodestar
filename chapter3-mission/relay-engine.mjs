import {properties,ANTENNAS} from './kit.mjs';
import {MARS,circularOrbit,contactGeometry} from './shared/orbital.mjs';
import {conicAt} from './conics.mjs';
import {RF,PACKETS,linkBudget,contactPass} from './rf.mjs';
export {RF,PACKETS,linkBudget,contactPass};
export function simulateRelay(input,{fault='nominal',epochS=0,contactOffsetS=0,forwardRate=null,robustReceive=false,initialWh=null}={}){
 const p=properties(input,fault),c=p.configuration,peak=contactPass(epochS),rate=forwardRate??(c.duty==='archive'?2000000:8000);
 if(!Number.isFinite(contactOffsetS)||Math.abs(contactOffsetS)>2400||![256,1000,8000,2000000].includes(rate)||typeof robustReceive!=='boolean')throw RangeError('Unsupported communications operation');
 const orbit=circularOrbit(600),n=2*Math.PI/orbit.period,w=2*Math.PI/MARS.rotationSeconds,start=Math.max(epochS,peak.timeS-30+contactOffsetS),operations={fault,epochS,contactOffsetS,forwardRate:rate,robustReceive};
 if(fault==='insertion_error'){const trajectory=conicAt(orbit.radius,orbit.speed-.3);return {kind:'impact',clipId:'relay_impact',reasonCode:'unsafe_insertion',causes:['The off-nominal pre-deployment insertion orbit intersects the surface. This is not a power or radio failure.'],configuration:c,operations,trajectory,stored:[],delivered:[],report:null,startS:start,endS:start,packetResults:[],scope:'Authored insertion-maneuver rehearsal, not a 300 m/s dispenser impulse.'};}
 if(initialWh!==null&&(!Number.isFinite(initialWh)||initialWh<0||initialWh>p.capacityWh+1e-8))throw RangeError('Initial storage must fit the current battery capacity');
 const antenna=ANTENNAS[p.antenna],pointLoss=12*(p.pointingErrorDeg/antenna.beamDeg)**2,sunAngle=n*contactPass(0).timeS-Math.PI;
 const isSun=t=>{const a=n*t-sunAngle;return orbit.radius*Math.cos(a)>=0||Math.abs(orbit.radius*Math.sin(a))>=MARS.radius;};
 const specs=PACKETS.map(q=>({...q,bits:q.duration*q.rate}));if(c.duty==='archive')specs.push({id:'recording',duration:540,rate:2000000,bits:1080000000,label:'Optional bulk recording'});
 const packetResults=specs.map(q=>({...q,rx:false,tx:false,minRxMarginDb:Infinity,minTxMarginDb:Infinity,rxSeconds:0,txSeconds:0}));
 let energy=initialWh??p.capacityWh*.65,minWh=energy,unservedWh=0,brownout=false,time=epochS;const samples=[];
 function interval(to,phase,q=null,packetRate=0){let valid=true;
  while(time<to-1e-8){const dt=Math.min(2,to-time),sun=isSun(time),rf=phase==='receive'?2:phase==='forward'&&c.radio==='relay'?p.radio.dcW:0,net=(sun?p.generationW:0)-p.baseW-rf,needed=Math.max(0,-net)*dt/3600/.9,powered=p.busOK&&energy+1e-10>=needed;
   energy+=net*dt/3600*(net>=0?.9:1/.9);energy=Math.min(p.capacityWh,energy);if(energy<0){unservedWh-=energy;energy=0;brownout=true;}minWh=Math.min(minWh,energy);
   if(q){const geometry=contactGeometry(600,n*time,1.4+w*time),rx=phase==='receive',budget=linkBudget({rangeKm:rx?geometry.range:RF.carrierRangeKm,txW:rx?(q.id==='recording'?5:RF.surfaceRfW):p.radio.rfW,txGainDbi:rx?RF.surfaceGainDbi:antenna.gainDbi,rxGainDbi:rx?antenna.gainDbi:RF.carrierGainDbi,rate:packetRate,pointingLossDb:pointLoss,extraLossDb:p.antennaLossDb});
    valid&&=powered&&p.controllers>0&&p.radioOK&&p.busOK&&budget.decodes&&(rx?geometry.visible:c.radio==='relay')&&(q.id!=='navigation'||p.integrityOK);
    if(rx){q.minRxMarginDb=Math.min(q.minRxMarginDb,budget.marginDb);q.rxSeconds+=dt;}else{q.minTxMarginDb=Math.min(q.minTxMarginDb,budget.marginDb);q.txSeconds+=dt;}
   }
   if(!samples.length||time-samples.at(-1).timeS>=30)samples.push({timeS:time,energyWh:energy,sun,phase});time+=dt;
  }return valid;
 }
 interval(start,'coast');
 for(const q of packetResults){const packetRate=robustReceive&&q.id==='navigation'?1000:q.rate;q.rx=interval(time+q.bits/packetRate,'receive',q,packetRate);}
 const receiveEndS=time,forwardDeadline=time+900;
 for(const q of packetResults){if(!q.rx||c.radio!=='relay'){q.tx=false;continue;}const packetRate=['beacon','coarse','ascent'].includes(q.id)?Math.min(rate,q.rate):rate,duration=q.bits/packetRate,remaining=forwardDeadline-time,complete=duration<=remaining+1e-8;q.tx=interval(time+Math.min(duration,Math.max(0,remaining)),'forward',q,packetRate)&&complete;if(remaining<=0)q.tx=false;}
 const stored=packetResults.filter(q=>q.rx).map(q=>q.id),delivered=packetResults.filter(q=>q.tx).map(q=>q.id);
 let report=null;if(delivered.includes('navigation')||delivered.includes('coarse'))report={id:delivered.includes('navigation')?'precise-report':'coarse-report',latitudeDeg:0,longitudeEastDeg:1.4*180/Math.PI,positionBoundKm:delivered.includes('navigation')?.25:12,frame:'body_fixed',sampleTimeS:start,receivedTimeS:time,source:delivered.includes('navigation')?'Validated precise navigation packet':'Validated coarse search-region packet',ascent:delivered.includes('ascent')?{vehicleAlreadyOnSurface:true,minAltitudeKm:280,maxAltitudeKm:320,profile:'prescribed-480s-insertion'}:null,latestInsertionS:21600};
 const full=delivered.includes('navigation')&&delivered.includes('ascent'),causes=[];
 if(p.controllers<=0)causes.push('The primary controller failed; no backup can execute the contact plan.');if(!p.busOK)causes.push('An array short tripped the shared bus; no isolator is fitted.');if(!p.radioOK)causes.push('The primary radio failed without a spare.');if(p.antennaLossDb)causes.push('A damaged antenna/feed has no working spare.');if(c.radio!=='relay')causes.push('Receive-only mode stores data but never forwards it.');if(brownout)causes.push('The battery emptied during the scheduled coast/contact sequence.');if(!p.integrityOK)causes.push('The precise navigation packet failed its integrity check and was rejected.');
 if(!stored.includes('navigation')&&!causes.length)causes.push('The chosen pass, antenna gain or pointing cannot close the precise navigation receive link.');if(stored.includes('navigation')&&!delivered.includes('navigation')&&!causes.length)causes.push('The forwarding rate needs more link margin. Lower the rate or improve the antenna/pointing.');
 if(fault==='panel_loss')causes.push('One solar panel is unavailable; the remaining generation and storage were used.');if(fault==='radio_loss'&&c.radioBackup)causes.push('The spare radio carried the traffic after the primary failed.');if(fault==='computer_loss'&&c.computers>1)causes.push('The backup controller continued the contact plan.');if(fault==='array_short'&&c.isolator)causes.push('The isolator disconnected the shorted array branch and preserved the bus.');if(fault==='antenna_damage'&&c.antennaBackup)causes.push('The spare low-gain feed replaced the damaged antenna.');if(fault==='memory_corruption'&&c.memory==='ecc')causes.push('Protected memory retained a valid navigation packet in this authored fault case.');
 if(full)causes.unshift('All required navigation and ascent packets reached the ship.');if(c.duty==='archive'&&!delivered.includes('recording'))causes.push('The optional bulk recording was not delivered; essential rescue packets are evaluated separately.');
 const kind=full?'success':report?'partial':stored.length?'stored_only':'no_contact';
 const reasonCode=full?'report_complete':!p.busOK?'bus_short':p.controllers<=0?'controller_failed':!p.radioOK?'radio_failed':p.antennaLossDb?'antenna_failed':brownout?'brownout':!p.integrityOK?'integrity_rejected':fault==='pointing_loss'?'pointing_failed':report?'coarse_only':stored.length?'forward_failed':'contact_failed';
 return {kind,clipId:full?'relay_success':'relay_no_forward',reasonCode,causes,configuration:c,operations,stored,delivered,packetResults,report,startS:start,receiveEndS,endS:time,capacityWh:p.capacityWh,minWh,endWh:energy,unservedWh,samples,peakElevationDeg:peak.elevation,pointingErrorDeg:p.pointingErrorDeg,scope:'Authored RF values, packet-bit/time continuity, parallel-ray eclipse and power model. No GMAT execution or flight qualification.'};
}
