import {assessDesign,designCost,WORKSHOP,FIELDS as KIT_FIELDS,CHOICES,normalize} from './kit.mjs';
import {simulateRelay} from './relay-engine.mjs';
import {PREPARED_RELAY,MODULES} from './mission-model.mjs';

export const FIELDS=KIT_FIELDS;
export const choices=CHOICES;
export function createWorkshop(){return {version:2,revision:0,configuration:normalize(PREPARED_RELAY),installed:[],test:null,location:'bench'};}
export function moduleMatches(state,id,draft){return state.installed.includes(id)&&FIELDS[id].every(k=>state.configuration[k]===draft[k]);}
export function fitModule(state,id,draft){
 if(state.location!=='bench')throw Error('Return the relay to its service cradle before changing hardware.');
 if(!MODULES.includes(id))throw RangeError('Unknown module.');
 const configuration={...state.configuration};
 for(const key of FIELDS[id]){const value=draft[key]===undefined?configuration[key]:draft[key];if(!choices[key].includes(value))throw RangeError('Unsupported hardware option.');configuration[key]=value;}
 if(designCost(configuration)>WORKSHOP.budget)throw Error('Parts allowance exceeded. Choose a smaller array, fewer packs or a shorter radio plan.');
 return {...state,configuration,revision:state.revision+1,installed:[...new Set([...state.installed,id])],test:null};
}
export function checkWorkshop(state,operations={}){
 if(state.location!=='bench'||!MODULES.every(id=>state.installed.includes(id)))throw Error('Fit all seven modules before running the check.');
 const result=assessDesign(state.configuration,600,operations.fault||'nominal'),trial=simulateRelay(state.configuration,operations);
 return {...state,test:{revision:state.revision,passed:trial.kind==='success'&&result.energyOK&&result.massOK&&result.budgetOK,operations,trial:{kind:trial.kind,clipId:trial.clipId,reasonCode:trial.reasonCode,causes:trial.causes,stored:trial.stored,delivered:trial.delivered,minWh:trial.minWh,capacityWh:trial.capacityWh}}};
}
export function canCarry(state){return state.location==='bench'&&state.test?.revision===state.revision&&state.test?.passed===true&&MODULES.every(id=>state.installed.includes(id));}
export function canTrial(state){const r=assessDesign(state.configuration);return state.location==='bench'&&state.test?.revision===state.revision&&MODULES.every(id=>state.installed.includes(id))&&r.massOK&&r.budgetOK;}
export function carryRelay(state,{allowRisk=false}={}){if(!(allowRisk?canTrial(state):canCarry(state)))throw Error('Run a current check before this flight trial. Fit all modules and stay within mass and parts limits.');return {...state,location:'carried',riskAccepted:allowRisk&&!state.test.passed};}
export function returnRelay(state){return {...state,location:'bench'};}
export function restoreWorkshop(record){
 try{
  if(record?.version!==2||!Number.isInteger(record.revision)||record.revision<0||!Array.isArray(record.installed)||!record.installed.every(id=>MODULES.includes(id)))return createWorkshop();
  for(const [key,values] of Object.entries(choices))if(!values.includes(record.configuration?.[key]))return createWorkshop();
  if(designCost(record.configuration)>WORKSHOP.budget)return createWorkshop();
  const state={version:2,revision:record.revision,configuration:normalize(record.configuration),installed:[...new Set(record.installed)],test:null,location:'bench'};
  // Recompute a saved pass; storage never grants an unverified transport state.
  if(record.test?.revision===record.revision&&MODULES.every(id=>state.installed.includes(id)))return checkWorkshop(state,record.test.operations||{});
  return state;
 }catch{return createWorkshop();}
}
