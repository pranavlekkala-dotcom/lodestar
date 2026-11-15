import {MARS} from './shared/orbital.mjs';
export function conicAt(radius,speed,body=MARS){
 if(!(radius>0)||!(speed>=0)||!Number.isFinite(radius+speed))throw RangeError('Finite positive radius and nonnegative speed required');
 const energy=speed*speed/2-body.mu/radius,h=radius*speed,e=Math.abs(radius*speed*speed/body.mu-1),p=h*h/body.mu,periapsis=h===0?0:p/(1+e),escape=energy>=0;
 return {energy,e,p,periapsisKm:periapsis,periapsisAltitudeKm:periapsis-body.radius,apoapsisKm:escape?null:p/(1-e),escape,impact:periapsis<=body.radius};
}
// RK4 two-body propagation. Stops at a surface crossing, not at a fictional
// "gravity turns on" threshold. dt <= 2 s; convergence is tested separately.
export function propagate2D(position,velocity,seconds,{body=MARS,step=2,samples=0}={}){
 if(!Number.isFinite(seconds)||seconds<0||!Number.isFinite(step)||step<=0||step>10)throw RangeError('Invalid propagation interval');
 let y=[...position,...velocity],time=0,impact=false;const trail=[];
 const deriv=s=>{const r=Math.hypot(s[0],s[1]),k=-body.mu/r**3;return [s[2],s[3],s[0]*k,s[1]*k];};
 const add=(s,k,a)=>s.map((v,i)=>v+k[i]*a);let nextSample=0;
 while(time<seconds){if(Math.hypot(y[0],y[1])<=body.radius){impact=true;break;}const dt=Math.min(step,seconds-time),a=deriv(y),b=deriv(add(y,a,dt/2)),c=deriv(add(y,b,dt/2)),d=deriv(add(y,c,dt));y=y.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);time+=dt;if(samples&&time>=nextSample){trail.push({time,x:y[0],y:y[1]});nextSample+=Math.max(step,seconds/samples);}}
 if(Math.hypot(y[0],y[1])<=body.radius)impact=true;
 return {position:y.slice(0,2),velocity:y.slice(2),time,impact,trail};
}
