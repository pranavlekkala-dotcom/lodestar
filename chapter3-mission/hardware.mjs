import * as T from 'three';
import {createHardware as base,foldArrays,createChassis} from './shared/hardware.mjs';
import {block,screwRow,cable,plate} from './industrial.mjs';
export {foldArrays,createChassis};
let dishGeometry=null;
const M={led:new T.MeshStandardMaterial({color:'#73c9ab',emissive:'#3e7f70',emissiveIntensity:.25}),rail:new T.MeshStandardMaterial({color:'#91a6ae',metalness:.8,roughness:.3}),dark:new T.MeshStandardMaterial({color:'#152e39',metalness:.4,roughness:.55}),gold:new T.MeshStandardMaterial({color:'#a98543',metalness:.7,roughness:.4}),pcb:new T.MeshStandardMaterial({color:'#174f42',metalness:.2,roughness:.6}),cream:new T.MeshStandardMaterial({color:'#c7c9b4',roughness:.65}),copper:new T.MeshStandardMaterial({color:'#ad7041',metalness:.65,roughness:.4})};
function box(g,w,h,d,m,x=0,y=0,z=0){return block(g,[w,h,d],[x,y,z],m,.0018);}
const pinGeometry=new Map();
function pin(g,r,h,m,x,y,z){const key=r+'/'+h;if(!pinGeometry.has(key))pinGeometry.set(key,new T.CylinderGeometry(r,r,h,18));const a=new T.Mesh(pinGeometry.get(key),m);a.position.set(x,y,z);g.add(a);return a;}
export function slotPosition(id){return new T.Vector3(0,{solar:0,battery:-.105,computer:-.044,attitude:.051,relay:.117,antenna:.178,protection:-.153}[id]||0,0);}
export function createHardware(id,c){
 if(['solar','battery','computer','attitude'].includes(id)){
  const g=base(id,c);if(id==='battery'&&c.cellType==='light')g.scale.y=.58;
  if(id==='computer'&&c.memory==='ecc')for(const x of [-.05,.045])box(g,.026,.01,.018,M.gold,x,.015,.02);
  if(id==='attitude'&&c.pointing==='precision'){box(g,.035,.028,.035,M.dark,.06,.03,-.01);pin(g,.013,.012,M.gold,.06,.05,-.01);}
  return g;
 }
 const g=new T.Group();g.userData.hardwareId=id;g.name='CH3 '+id;
 if(id==='relay'){
  box(g,.168,.028,.086,M.rail);box(g,.155,.002,.076,M.gold,0,.016);
  for(let x=-.06;x<.061;x+=.012)box(g,.003,c.transmitter==='boost'?.024:.012,.048,M.dark,x,.024,-.015);
  for(const x of [-.061,.061]){const p=pin(g,.005,.012,M.gold,x,0,.049);p.rotation.x=Math.PI/2;}
  box(g,.05,.011,.009,c.transmitter==='eco'?M.pcb:M.copper,0,0,.048);
  screwRow(g,[[-.074,-.008,.045],[.074,-.008,.045]],M.dark,.0025);
  plate(g,'S-BAND / RELAY',[.066,.009],[0,-.007,.049],undefined,{font:42,background:'#b2bbb9',color:'#233542'});
 }else if(id==='antenna'){
  box(g,.04,.026,.032,M.dark,0,.012,-.01);
  if(c.antenna==='omni')for(const side of[-1,1]){const m=pin(g,.0012,.18,M.rail,side*.055,.095,0);m.rotation.z=side*.25;box(g,.015,.01,.018,M.gold,side*.055,.004,0);}
  else if(c.antenna==='patch'){
   box(g,.178,.128,.006,M.rail,0,.10,-.01);box(g,.163,.113,.002,M.cream,0,.10,-.005);
   for(const x of[-.047,0,.047])for(const y of[-.033,0,.033])box(g,.032,.023,.001,M.gold,x,.10+y,-.003);
   screwRow(g,[[-.081,.05,-.002],[.081,.05,-.002],[-.081,.15,-.002],[.081,.15,-.002]],M.dark,.0024);
   for(const side of[-1,1])pin(g,.005,.026,M.rail,side*.027,.025,-.012);
   cable(g,[[.035,.004,-.02],[.045,.025,-.025],[.012,.08,-.02]],M.copper,.0013);
  }else{
   const pts=[];for(let i=0;i<=20;i++){const r=i*.0065;pts.push(new T.Vector2(r,r*r/0.22));}
   const dish=new T.Mesh((dishGeometry??=new T.LatheGeometry(pts,48)),new T.MeshStandardMaterial({color:'#b3bdbb',metalness:.75,roughness:.32,side:T.DoubleSide}));dish.rotation.x=Math.PI/2;dish.position.set(0,.12,-.02);g.add(dish);
   box(g,.022,.10,.02,M.rail,0,.06,-.035);box(g,.012,.012,.08,M.gold,0,.12,.04);
  }
 }else if(id==='protection'){
  box(g,.17,.004,.085,M.pcb);
  if(c.isolator){box(g,.034,.010,.022,M.dark,-.052,.006,.012);box(g,.015,.002,.01,M.gold,-.052,.012,.012);}
  if(c.radioBackup){box(g,.06,.012,.045,M.rail,.035,.004,0);for(let x=.015;x<.06;x+=.009)box(g,.003,.004,.032,M.dark,x,.011,0);}
  if(c.antennaBackup){pin(g,.0011,.16,M.rail,.13,.08,-.062);cable(g,[[.073,.004,-.025],[.13,.004,-.062],[.13,.05,-.062]],M.copper,.0011);}
  if(c.heater)for(let x=-.07;x<.071;x+=.012)box(g,.002,.0006,.055,M.copper,x,-.003,0);
  for(let x=-.07;x<.071;x+=.014)box(g,.0008,.0004,.02,M.copper,x,.002,-.02);
  box(g,.003,.003,.004,M.led,.067,.005,.035);
 }
 return g;
}
