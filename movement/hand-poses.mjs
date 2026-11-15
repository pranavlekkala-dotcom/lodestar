import { handContactBlend,handReachTime } from './physics.mjs';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

// Each digit has its own timing and joint targets. Contact poses are shallow
// enough for flat cabin panels; full relaxed flexion happens away from them.
export function handPose(hand,config,time,ready=false){
  const contact=handContactBlend(hand,config),reach=handReachTime(hand,config),relaxed=[.38,.46,.54,.61,.36];
  const jointTargets=[],spreads=[];
  for(let finger=0;finger<5;finger++){
    const thumb=finger===4;
    let plant=contact;
    if(hand.state==='reach'||hand.state==='brace-reach'){const delay=finger*.011*reach/config.reachTime;plant=smooth((hand.time-delay)/(reach-delay));}
    if(hand.state==='unplant')plant=(hand.releaseStartBlend??1)*(1-smooth((hand.time-(3-Math.min(finger,3))*.012)/config.releaseTime));
    const idle=relaxed[finger]+Math.sin(time*.73+finger*.68+hand.side)*.009;
    const prepare=ready?idle*.62:idle;
    const grip=hand.state==='pull'?Math.sin(clamp((hand.time-reach)/config.pullTime)*Math.PI)*.020:0;
    const roots=mix(prepare,thumb?.024:.018+finger*.003,plant);
    jointTargets.push(thumb?[roots*.70,mix(prepare*.9,.035+grip,plant)]:[
      roots*.70,
      mix(prepare*1.12,.035+grip+finger*.003,plant),
      mix(prepare*.80,.022+grip*.5,plant),
    ]);
    spreads.push(mix(1,1.15,Math.sin(plant*Math.PI*.5)));
  }
  return{joints:jointTargets,spreads,thumbYaw:mix(-.42,-.17,contact),thumbSpread:mix(.88,.80,contact),wristFlex:(1-contact)*Math.sin(time*.82+hand.side)*.022};
}

export function springJoint(value,velocity,target,dt,frequency=23){
  const difference=value-target,term=velocity+frequency*difference,decay=Math.exp(-frequency*dt);
  return{value:target+(difference+term*dt)*decay,velocity:(velocity-frequency*term*dt)*decay};
}
