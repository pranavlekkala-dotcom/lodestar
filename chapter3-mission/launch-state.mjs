// Pure interlocks. Animation completion, not clicking alone, advances each step.
export function createLaunchState(){return {stage:'await_payload',innerClosed:false,outerOpen:false,pressure:'cabin',deployed:false};}
const flow={stow:['await_payload','payload_stowed'],lift:['payload_stowed','rail_held'],mount:['rail_held','rail_mounted'],load:['rail_mounted','payload_loaded'],seal:['payload_loaded','sealed'],vent:['sealed','vented'],open:['vented','outer_open'],launch:['outer_open','deployed']};
export function advanceLaunch(state,action,{playerOutside=false}={}){
  const step=flow[action];if(!step||state.stage!==step[0])throw Error('Complete the previous airlock step first.');
  if(action==='seal'&&!playerOutside)throw Error('Leave the airlock before closing its inner hatch.');
  if(['vent','open','launch'].includes(action)&&!state.innerClosed)throw Error('The inner hatch must be sealed.');
  if(action==='open'&&state.pressure!=='vacuum')throw Error('Depressurize before opening the outer hatch.');
  if(action==='launch'&&!state.outerOpen)throw Error('Open the outer hatch before release.');
  return {...state,stage:step[1],innerClosed:action==='seal'||state.innerClosed,pressure:action==='vent'?'vacuum':state.pressure,outerOpen:action==='open'||state.outerOpen,deployed:action==='launch'||state.deployed};
}
export function launchReady(state){return state.stage==='sealed'&&state.innerClosed&&!state.outerOpen;}
