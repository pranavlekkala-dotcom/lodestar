// Claude integration: change these values or supply overrides at mount time.
// Coordinates refer to the received November 14 station, not a universal layout.
export const CORE_CONFIG=Object.freeze({
  planetName:'Vesper', roomId:'equipment', airlockRoomId:'airlock',
  bench:{position:[-12.65,-.80,-7.5],eye:[-10.05,.35,-7.5],yaw:Math.PI/2,scale:2.05,
    inspectionEye:[-10.05,.43,-7.25],inspectionTarget:[-12.6,-.15,-8.12]},
  airlock:{origin:[11.85,0,29],innerX:9.25,outerX:14.25,
    cradle:[10.05,-.28,30.05],rack:[11.6,-.05,30.24],mount:[12,-.35,29],button:[8.82,.25,30.24],
    approach:[9.75,.18,29],railEye:[11.6,.18,28.85],mountEye:[10.7,.18,29],buttonEye:[8.1,.25,30.24]},
  flight:{point:[0,-.25,40.10],eye:[0,.18,38.35],yaw:Math.PI},
  palette:{cyan:'#55ddff',blue:'#0b2236',green:'#61ffb3',amber:'#ffbb69',red:'#ff6f7d'},
  timings:{fit:1.65,test:4.2,cover:1.0,pickup:.65,railLift:.9,railMount:1.2,load:1.2,hatch:1.1,launch:3.4},
  replaceRoomFurniture:true, demoTravel:false
});
export function coreConfig(override={}){
  return {...CORE_CONFIG,...override,bench:{...CORE_CONFIG.bench,...override.bench},airlock:{...CORE_CONFIG.airlock,...override.airlock},flight:{...CORE_CONFIG.flight,...override.flight},palette:{...CORE_CONFIG.palette,...override.palette},timings:{...CORE_CONFIG.timings,...override.timings}};
}


