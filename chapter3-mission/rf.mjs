import {properties,normalize,ANTENNAS} from './kit.mjs';
import {MARS,circularOrbit,contactGeometry} from './shared/orbital.mjs';
import {conicAt} from './conics.mjs';
export const RF=Object.freeze({frequencyGHz:2.2,surfaceRfW:.1,surfaceGainDbi:6,carrierGainDbi:2,carrierRangeKm:60,systemTemperatureK:500,lossDb:3,requiredEbNoDb:5});
export const PACKETS=Object.freeze([{id:'beacon',duration:8,rate:256,label:'Identity / distress beacon'},{id:'coarse',duration:12,rate:1000,label:'Coarse search region (±12 km)'},{id:'navigation',duration:30,rate:8000,label:'Precise navigation fix (±250 m)'},{id:'ascent',duration:10,rate:1000,label:'Ascent shuttle capability and launch limits'}]);
export function linkBudget({rangeKm,txW,txGainDbi,rxGainDbi,rate,pointingLossDb=0,extraLossDb=0}){
 if(!(rangeKm>0&&txW>0&&rate>0)||![rangeKm,txW,txGainDbi,rxGainDbi,rate,pointingLossDb,extraLossDb].every(Number.isFinite))throw RangeError('Finite RF inputs required');
 const fsplDb=92.45+20*Math.log10(rangeKm)+20*Math.log10(RF.frequencyGHz),rxDbm=10*Math.log10(txW*1000)+txGainDbi+rxGainDbi-fsplDb-RF.lossDb-pointingLossDb-extraLossDb;
 const noiseDensityDbmHz=-228.6+10*Math.log10(RF.systemTemperatureK)+30,cn0DbHz=rxDbm-noiseDensityDbmHz,ebNoDb=cn0DbHz-10*Math.log10(rate),marginDb=ebNoDb-RF.requiredEbNoDb;
 return {fsplDb,rxDbm,noiseDensityDbmHz,cn0DbHz,ebNoDb,marginDb,decodes:marginDb>=0};
}
export function contactPass(afterS=0){
 if(!Number.isFinite(afterS)||afterS<0)throw RangeError('Invalid contact epoch');
 const orbit=circularOrbit(600),n=2*Math.PI/orbit.period,w=2*Math.PI/MARS.rotationSeconds;let peak=null,previous=null,rising=false;
 for(let t=afterS+5;t<afterS+orbit.period*2;t+=5){const g=contactGeometry(600,n*t,1.4+w*t);if(previous!==null&&g.elevation>previous)rising=true;if(rising&&peak&&g.elevation<previous&&previous>10)return peak;if(rising)peak={timeS:t,...g};previous=g.elevation;}
 return null;
}
