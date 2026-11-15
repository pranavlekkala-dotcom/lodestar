import {MARS,circularOrbit} from './orbital.mjs';
// Published reference quantities; CASE and WORKSHOP are authored training inputs.
export const REFERENCE=Object.freeze({solarFlux:586.2,cellEfficiency:.30,batteryWh:43,batterySpecificWhKg:168.8,computerMassKg:.024,computerActiveW:3.3*.045});
export const CASE=Object.freeze({passes:6,initialCharge:.65,reserve:.20,chargeEfficiency:.90,dischargeEfficiency:.90,pointingFactor:.80,baseMassKg:.75,baseLoadW:3,attitudeMassKg:.18,attitudeLoadW:1.2,radioMassKg:.25,radioActiveW:12,radioRxW:2,massLimitKg:2.1,contactSeconds:600,bitRate:8000});
export const WORKSHOP=Object.freeze({budget:12,panelSmall:1,panelLarge:2,battery:[0,3,5],computer:[0,1,3],pointing:2,relay:2});
export function defaultDesign(){return {panels:2,panelSize:'small',batteries:1,computers:1,attitude:true,radio:'relay',duty:'archive'};}
export function designCost(input){const c={...defaultDesign(),...input};return c.panels*(c.panelSize==='large'?WORKSHOP.panelLarge:WORKSHOP.panelSmall)+WORKSHOP.battery[c.batteries]+WORKSHOP.computer[c.computers]+(c.attitude?WORKSHOP.pointing:0)+(c.radio==='off'?0:WORKSHOP.relay);}
export function assessDesign(input,altitude=300,scenario='nominal'){
 const c={...defaultDesign(),...input};
 if(typeof c.attitude!=='boolean'||![0,2,4].includes(c.panels)||!['small','large'].includes(c.panelSize)||![0,1,2].includes(c.batteries)||![0,1,2].includes(c.computers)||!['off','listen','relay'].includes(c.radio)||!['brief','archive'].includes(c.duty)||!['nominal','panel_loss','computer_loss'].includes(scenario))throw RangeError('Unsupported training configuration');
 const orbit=circularOrbit(altitude),eclipseSeconds=orbit.period/Math.PI*Math.asin(MARS.radius/orbit.radius),sunSeconds=orbit.period-eclipseSeconds;
 const panelArea=c.panelSize==='large'?.04:.02,panelMass=c.panelSize==='large'?.15:.085;
 const perPanelW=panelArea*REFERENCE.solarFlux*REFERENCE.cellEfficiency*(c.attitude?CASE.pointingFactor:.15),generationW=c.panels*perPanelW;
 const capacityWh=c.batteries*REFERENCE.batteryWh,dutySeconds=c.duty==='brief'?60:600;
 const baseW=CASE.baseLoadW+c.computers*REFERENCE.computerActiveW+(c.attitude?CASE.attitudeLoadW:0),radioW=c.radio==='relay'?CASE.radioActiveW:c.radio==='listen'?CASE.radioRxW:0;
 const massKg=CASE.baseMassKg+c.panels*panelMass+c.batteries*REFERENCE.batteryWh/REFERENCE.batterySpecificWhKg+c.computers*REFERENCE.computerMassKg+(c.attitude?CASE.attitudeMassKg:0)+(c.radio==='off'?0:CASE.radioMassKg);
 const cost=designCost(c),budgetOK=cost<=WORKSHOP.budget;
 let energy=capacityWh*CASE.initialCharge,minWh=energy,generatedWh=0,consumedWh=0,curtailedWh=0,unservedWh=0,time=0,deliveredPasses=0;
 const history=[],samples=[{time:0,energyWh:energy,sun:false,pass:1}];
 for(let pass=0;pass<CASE.passes;pass++){
  const controllers=Math.max(0,c.computers-(scenario==='computer_loss'&&pass>=3?1:0));
  const panels=Math.max(0,c.panels-(scenario==='panel_loss'&&pass>=3?1:0));
  const canOperate=controllers>0&&c.attitude&&c.radio==='relay';let contactPowered=true;
  const idle=CASE.baseLoadW+controllers*REFERENCE.computerActiveW+(c.attitude?CASE.attitudeLoadW:0);
  function phase(seconds,sun){let t=0;while(t<seconds-1e-8){const dt=Math.min(30,seconds-t);let rf=0;
   if(!sun&&controllers>0&&c.radio!=='off'){if(t<dutySeconds)rf=CASE.radioRxW;else if(t<dutySeconds*2&&c.radio==='relay')rf=CASE.radioActiveW;}
   const load=idle+rf,g=sun?panels*perPanelW:0;generatedWh+=g*dt/3600;consumedWh+=load*dt/3600;
   const net=g-load;energy+=net*dt/3600*(net>=0?CASE.chargeEfficiency:1/CASE.dischargeEfficiency);
   if(energy>capacityWh){curtailedWh+=energy-capacityWh;energy=capacityWh;}
   if(energy<0){unservedWh-=energy;energy=0;if(!sun&&t<dutySeconds*2)contactPowered=false;}
   minWh=Math.min(minWh,energy);t+=dt;time+=dt;samples.push({time,energyWh:energy,sun,pass:pass+1});
  }}
  phase(eclipseSeconds,false);phase(sunSeconds,true);
  const delivered=canOperate&&contactPowered;if(delivered)deliveredPasses++;
  history.push({pass:pass+1,energyWh:energy,delivered,panels,controllers});
 }
 const canCommand=c.computers>0,canPoint=c.attitude,canRelay=c.radio==='relay'&&canCommand&&canPoint;
 const reserveWh=capacityWh*CASE.reserve,massOK=massKg<=CASE.massLimitKg,energyOK=capacityWh>0&&minWh>=reserveWh&&unservedWh===0;
 const problems=[];
 if(!canCommand)problems.push('A controller is required to run the contact plan.');
 if(!canPoint)problems.push('Pointing control is required by this relay configuration.');
 if(c.radio!=='relay')problems.push('The radio must receive and forward the message.');
 if(!budgetOK)problems.push(`You need ${cost-WORKSHOP.budget} fewer workshop credits. Trade hardware or radio time rather than fitting every upgrade.`);
 if(!massOK)problems.push(`Launch mass exceeds the allowance by ${((massKg-CASE.massLimitKg)*1000).toFixed(0)} g.`);
 if(!energyOK)problems.push(capacityWh===0?'No battery: the relay loses power in shadow.':unservedWh>0?'The battery runs out. Add solar area or storage, or send shorter packets.':'Battery falls below the 20% reserve. Add solar area or storage, or shorten radio time.');
 if(scenario==='computer_loss'&&deliveredPasses<6&&c.computers===1)problems.push('The primary controller failed after pass 3. With no backup, the last three reports were lost.');
 const missionReady=canRelay&&massOK&&energyOK&&budgetOK&&deliveredPasses===CASE.passes;
 return {configuration:c,scenario,altitude,cost,budgetOK,massKg,massOK,capacityWh,generationW,baseW,radioW,dutySeconds,minWh,reserveWh,endWh:energy,generatedWh,consumedWh,curtailedWh,unservedWh,history,samples,eclipseSeconds,sunSeconds,periodSeconds:orbit.period,canRelay,missionReady,energyOK,deliveredPasses,problems,mbitsPerContact:canRelay?CASE.bitRate*dutySeconds/1e6:0,dataMbits:CASE.bitRate*dutySeconds/1e6*deliveredPasses};
}
