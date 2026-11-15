import {circularOrbit,MARS} from './shared/orbital.mjs';
// All component ratings, budgets and fault magnitudes are authored game inputs.
// NASA resources support the subsystem relationships, not these kit specifications.
export const WORKSHOP=Object.freeze({budget:14});
export const CASE=Object.freeze({massLimitKg:2.45,reserve:.20,passes:6});
export const DEFAULT=Object.freeze({panels:2,panelSize:'small',batteries:2,cellType:'standard',computers:1,memory:'basic',attitude:true,pointing:'basic',radio:'relay',transmitter:'standard',duty:'brief',antenna:'patch',isolator:true,radioBackup:false,antennaBackup:false,heater:false});
export const MODULES=Object.freeze(['solar','battery','computer','attitude','relay','antenna','protection']);
export const FIELDS=Object.freeze({solar:['panels','panelSize'],battery:['batteries','cellType'],computer:['computers','memory'],attitude:['attitude','pointing'],relay:['radio','transmitter','duty'],antenna:['antenna'],protection:['isolator','radioBackup','antennaBackup','heater']});
export const CHOICES=Object.freeze({panels:[0,2,4],panelSize:['small','large'],batteries:[1,2],cellType:['light','standard'],computers:[1,2],memory:['basic','ecc'],attitude:[false,true],pointing:['basic','precision'],radio:['listen','relay'],transmitter:['eco','standard','boost'],duty:['brief','archive'],antenna:['omni','patch','dish'],isolator:[false,true],radioBackup:[false,true],antennaBackup:[false,true],heater:[false,true]});
export const ANTENNAS=Object.freeze({omni:{gainDbi:2,beamDeg:120,cost:0,mass:.04,label:'Wide-angle whips'},patch:{gainDbi:8,beamDeg:65,cost:1,mass:.10,label:'Patch array'},dish:{gainDbi:16,beamDeg:18,cost:3,mass:.20,label:'High-gain dish'}});
export const RADIOS=Object.freeze({eco:{rfW:1,dcW:8,cost:0},standard:{rfW:4,dcW:12,cost:0},boost:{rfW:8,dcW:24,cost:2}});
export const FAULTS=Object.freeze({nominal:'Nominal operations',panel_loss:'One panel fails',battery_wear:'Battery health drops',computer_loss:'Primary controller fails',radio_loss:'Primary radio fails',antenna_damage:'Antenna/feed damaged',pointing_loss:'Pointing error',array_short:'Array circuit short',memory_corruption:'Navigation packet fails integrity',cold_soak:'Cold battery capacity loss',insertion_error:'Unsafe insertion rehearsal'});
export function normalize(input={}){const c={...DEFAULT,...input};for(const[key,values]of Object.entries(CHOICES))if(!values.includes(c[key]))throw RangeError('Unsupported kit option: '+key);return c;}
export function designCost(input){const c=normalize(input);return c.panels*(c.panelSize==='large'?2:1)+(c.cellType==='light'?c.batteries: c.batteries===2?5:3)+(c.computers===2?3:1)+(c.memory==='ecc'?1:0)+(c.attitude?2:0)+(c.pointing==='precision'?2:0)+2+RADIOS[c.transmitter].cost+ANTENNAS[c.antenna].cost+(c.isolator?1:0)+(c.radioBackup?3:0)+(c.antennaBackup?2:0)+(c.heater?1:0);}
export function properties(input,fault='nominal'){
 const c=normalize(input);if(!Object.hasOwn(FAULTS,fault))throw RangeError('Unknown fault case');
 const controllers=c.computers-(fault==='computer_loss'?1:0),short=fault==='array_short'&&!c.isolator;
 let panels=Math.max(0,c.panels-(['panel_loss','array_short'].includes(fault)?1:0));if(short)panels=0;
 let health=fault==='battery_wear'?.45:1;if(fault==='cold_soak')health*=c.heater?.9:.45;
 const capacityWh=c.batteries*(c.cellType==='light'?8:43)*health;
 const massKg=.75+c.panels*(c.panelSize==='large'?.15:.085)+c.batteries*(c.cellType==='light'?8:43)/168.8+c.computers*.024+(c.attitude?.18:0)+(c.pointing==='precision'?.08:0)+.25+ANTENNAS[c.antenna].mass+(c.isolator?.04:0)+(c.radioBackup?.08:0)+(c.antennaBackup?.035:0)+(c.heater?.025:0)+(c.memory==='ecc'?.02:0);
 const pointingErrorDeg=!c.attitude?75:fault==='pointing_loss'?(c.pointing==='precision'?8:35):(c.pointing==='precision'?.5:2);
 const antennaFailed=fault==='antenna_damage',antenna=antennaFailed&&c.antennaBackup?'omni':c.antenna;
 const generationW=short?0:panels*(c.panelSize==='large'?.04:.02)*586.2*.30*(c.attitude?(fault==='pointing_loss'?.35:.80):.15);
 const baseW=3+Math.max(0,controllers)*.1485+(c.attitude?1.2:0)+(c.pointing==='precision'?.35:0)+(c.memory==='ecc'?.1:0)+(c.radioBackup?.15:0)+(c.heater?.8:0);
 return {configuration:c,capacityWh,massKg,cost:designCost(c),generationW,baseW,controllers,panels,pointingErrorDeg,antenna,antennaLossDb:antennaFailed&&!c.antennaBackup?40:0,radioOK:fault!=='radio_loss'||c.radioBackup,busOK:!short,integrityOK:fault!=='memory_corruption'||c.memory==='ecc',radio:RADIOS[c.transmitter]};
}
export function assessDesign(input,altitude=600,fault='nominal'){
 const p=properties(input,fault),c=p.configuration,orbit=circularOrbit(altitude),eclipseSeconds=orbit.period/Math.PI*Math.asin(MARS.radius/orbit.radius),sunSeconds=orbit.period-eclipseSeconds;
 let energy=p.capacityWh*.65,minWh=energy,unservedWh=0;const history=[],duration=c.duty==='brief'?60:600;
 for(let pass=0;pass<6;pass++){
  const phases=[[eclipseSeconds,0,p.baseW,false],[sunSeconds,p.generationW,p.baseW,true]];
  for(const[seconds,generation,base,sun]of phases){let t=0;while(t<seconds){const dt=Math.min(10,seconds-t);const radio=!sun?(t<duration?2:t<duration*2?p.radio.dcW:0):0;const net=generation-base-radio;energy+=net*dt/3600*(net>=0?.9:1/.9);energy=Math.min(p.capacityWh,energy);if(energy<0){unservedWh-=energy;energy=0;}minWh=Math.min(minWh,energy);t+=dt;}}
  history.push({pass:pass+1,energyWh:energy});
 }
 const reserveWh=p.capacityWh*.2,energyOK=minWh>=reserveWh&&unservedWh===0,massOK=p.massKg<=CASE.massLimitKg,budgetOK=p.cost<=WORKSHOP.budget,canRelay=p.controllers>0&&p.radioOK&&p.busOK&&c.radio==='relay';
 const problems=[];if(!energyOK)problems.push(unservedWh>0?'Power runs out in the eclipse exercise. Add collecting area/storage or shorten radio time.':'Battery drops below the 20% planning reserve.');if(!massOK)problems.push('Payload mass exceeds the kit allowance.');if(!budgetOK)problems.push('Parts allowance exceeded.');if(p.controllers<=0)problems.push('No surviving flight controller.');if(!p.radioOK)problems.push('The primary radio failed and no spare is fitted.');if(!p.busOK)problems.push('The array short trips the unprotected bus.');if(c.radio!=='relay')problems.push('Receive-only mode cannot forward a report.');if(p.antennaLossDb>0)problems.push('The damaged antenna feed has no working spare.');if(!p.integrityOK)problems.push('The navigation packet is rejected by its integrity check.');
 return {...p,altitude,fault,minWh,reserveWh,endWh:energy,unservedWh,history,eclipseSeconds,sunSeconds,periodSeconds:orbit.period,energyOK,massOK,budgetOK,canRelay,missionReady:problems.length===0,problems,dutySeconds:duration,scenario:fault};
}
