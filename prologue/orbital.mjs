/** Shared flight-math module. SI-consistent km/s dynamics; display converts Δv to m/s.
 * NASA Mars Fact Sheet values are intentionally used at their published precision.
 * Analytic two-body / coplanar / circular endpoints / impulsive burns.
 * No J2, atmosphere, other bodies, finite burns, flight safety or Earth transfer.
 * These are calculated teaching cases, NOT outputs of a GMAT run.
 */
export const MARS=Object.freeze({name:'Mars reference model',mu:42828,radius:3396.2,rotationSeconds:24.6229*3600,source:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'});
export const TAU=2*Math.PI;
export function circularOrbit(altitude,body=MARS){if(!Number.isFinite(altitude)||altitude<=0)throw RangeError('Positive altitude in km required');const radius=body.radius+altitude;return {radius,speed:Math.sqrt(body.mu/radius),period:TAU*Math.sqrt(radius**3/body.mu)};}
export function hohmann(initialAltitude,targetAltitude,body=MARS){
 const p=circularOrbit(initialAltitude,body),q=circularOrbit(targetAltitude,body),a=(p.radius+q.radius)/2;
 const v1=Math.sqrt(body.mu*(2/p.radius-1/a)),v2=Math.sqrt(body.mu*(2/q.radius-1/a));
 const burn1=(v1-p.speed)*1000,burn2=(q.speed-v2)*1000;
 return {initialAltitude,targetAltitude,r1:p.radius,r2:q.radius,a,b:Math.sqrt(p.radius*q.radius),e:Math.abs(p.radius-q.radius)/(p.radius+q.radius),burn1,burn2,totalDv:Math.abs(burn1)+Math.abs(burn2),coast:Math.PI*Math.sqrt(a**3/body.mu),initialPeriod:p.period,targetPeriod:q.period,body};
}
export function solveKepler(M,e){let E=M;for(let k=0;k<24;k++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-13)break;}return E;}
export function transferState(plan,time){const lower=plan.r2<plan.r1;const n=Math.sqrt(plan.body.mu/plan.a**3);const E=solveKepler((lower?Math.PI:0)+n*Math.max(0,Math.min(time,plan.coast)),plan.e);const orient=lower?-1:1;return {x:orient*plan.a*(Math.cos(E)-plan.e),y:orient*plan.b*Math.sin(E)};}
export function contactGeometry(altitude,orbitalAngle,surfaceAngle,body=MARS){
 const r=body.radius+altitude;
 const station=[body.radius*Math.cos(surfaceAngle),body.radius*Math.sin(surfaceAngle)];
 const satellite=[r*Math.cos(orbitalAngle),r*Math.sin(orbitalAngle)];
 const dx=satellite[0]-station[0],dy=satellite[1]-station[1],range=Math.hypot(dx,dy);
 const vertical=dx*Math.cos(surfaceAngle)+dy*Math.sin(surfaceAngle);
 const elevation=Math.asin(Math.max(-1,Math.min(1,vertical/range)))*180/Math.PI;
 return {station,satellite,range,elevation,visible:vertical>0};
}
export function formatDuration(seconds){const whole=Math.max(0,Math.round(seconds)),m=Math.floor(whole/60),s=whole%60;return `${m}m ${s.toString().padStart(2,'0')}s`;}
