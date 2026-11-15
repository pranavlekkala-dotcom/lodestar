// From Tom's Lodestar training package (tutorial rev 7, commit 80f6d065), used unchanged inside the integrated game.
import {MARS,TAU,circularOrbit,hohmann} from './orbital.mjs';

// Authored teaching objectives, separate from the published physical constants.
export const INSPECTION=Object.freeze({startAltitudeKm:600,minImageScale:1.8,maxDvMps:170});
export function evaluateInspection(altitudeKm){
 const transfer=hohmann(INSPECTION.startAltitudeKm,altitudeKm);
 const imageScale=INSPECTION.startAltitudeKm/altitudeKm;
 const budgetOK=transfer.totalDv<=INSPECTION.maxDvMps;
 const detailOK=imageScale>=INSPECTION.minImageScale;
 return {transfer,imageScale,budgetOK,detailOK,accepted:budgetOK&&detailOK};
}
export function nextContactOpportunity(altitudeKm,orbitalAngle,missionSeconds){
 const n=TAU/circularOrbit(altitudeKm).period,omega=TAU/MARS.rotationSeconds;
 const relative=((orbitalAngle-omega*missionSeconds+Math.PI)%TAU+TAU)%TAU-Math.PI;
 const advance=((-.15-relative)%TAU+TAU)%TAU/(n-omega);
 return {advance,missionSeconds:missionSeconds+advance,orbitalAngle:orbitalAngle+n*advance};
}
