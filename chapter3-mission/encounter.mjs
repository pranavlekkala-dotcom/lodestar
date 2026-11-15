import {MARS,circularOrbit,transferState} from './shared/orbital.mjs';
import {SCENARIO} from './model.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
/** Samples the SAME simplified trajectory used by the forecast. No flight
 * simulator or renderer. Radial ascent is an authored smooth profile. */
export function sampleEncounter(p,time){
 const epoch=p.input.epochSeconds,t=Math.max(epoch,Math.min(time,p.insertionS)),endCoast=epoch+p.transfer.coast;
 const theta0=2*Math.PI/circularOrbit(600).period*epoch,n=2*Math.PI/p.orbit.period,w=2*Math.PI/MARS.rotationSeconds;
 let x,y,stage;
 if(t<=endCoast){const a=transferState(p.transfer,t-epoch);x=a.x*Math.cos(theta0)-a.y*Math.sin(theta0);y=a.x*Math.sin(theta0)+a.y*Math.cos(theta0);stage='Two-burn transfer';}
 else{const theta=theta0+Math.PI+n*(t-endCoast);x=p.orbit.radius*Math.cos(theta);y=p.orbit.radius*Math.sin(theta);stage=t<p.launchS?'Coast to launch window':'Capsule ascent';}
 const tau=Math.max(0,t-p.launchS),u=clamp(tau/SCENARIO.ascentSeconds),radius=MARS.radius+p.input.altitudeKm*u*u*(3-2*u);
 const angle=t<p.launchS?SCENARIO.surfaceLongitudeRad+w*t:SCENARIO.surfaceLongitudeRad+w*p.launchS+w*tau+.5*(n-w)*tau*tau/SCENARIO.ascentSeconds;
 if(t>=p.insertionS)stage='Nominal insertion encounter';
 return {timeS:t,stage,carrier:{x,y},capsule:{x:radius*Math.cos(angle),y:radius*Math.sin(angle)},separationKm:Math.hypot(x-radius*Math.cos(angle),y-radius*Math.sin(angle))};
}
export function visualEpoch(p,progress){const u=clamp(progress),epoch=p.input.epochSeconds,coastEnd=epoch+p.transfer.coast;return u<.3?epoch+p.transfer.coast*u/.3:u<.5?coastEnd+(p.launchS-coastEnd)*(u-.3)/.2:p.launchS+(p.insertionS-p.launchS)*(u-.5)/.5;}
export function encounterSVG(p){const r=MARS.radius*.085;return `<svg id="ch3-encounter" class="ch3-plot" style="height:380px" viewBox="-430 -365 860 730" role="img" aria-label="Accelerated reference encounter: the ship transfers to its selected orbit, then the existing surface ascent shuttle ascends"><defs><radialGradient id="encounter-world"><stop stop-color="#a69070"/><stop offset="1" stop-color="#34464c"/></radialGradient></defs><circle r="${r}" fill="url(#encounter-world)"/><circle r="${p.orbit.radius*.085}" fill="none" stroke="#8fb9ac" stroke-dasharray="7 10" stroke-width="2"/><circle data-vehicle="carrier" r="12" fill="none" stroke="#d5c294" stroke-width="4"/><circle data-vehicle="capsule" r="5" fill="#b4e0c6"/><text x="0" y="-10" text-anchor="middle" font-family="Arial" font-size="25" fill="#d4dfd0">VESPER</text><text x="0" y="25" text-anchor="middle" font-family="Arial" font-size="17" fill="#c0d1c9">Reference trajectory · time accelerated</text></svg>`;}
export function drawEncounter(svg,sample){for(const name of ['carrier','capsule']){const node=svg?.querySelector(`[data-vehicle="${name}"]`);if(node){node.setAttribute('cx',(sample[name].x*.085).toFixed(3));node.setAttribute('cy',(-sample[name].y*.085).toFixed(3));}}}
