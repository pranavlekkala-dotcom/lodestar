import * as T from 'three';
import {block,plate,screwRow,cable} from './industrial.mjs';
import {createHardware,foldArrays} from './hardware.mjs';
import {DEFAULT} from './kit.mjs';

/** Restrained flight spares, with enclosed cases and visible mounting hardware. */
export function createModuleStores(parent,m,colliders){
 const root=new T.Group();root.name='CH3 / fitted flight-spares cabinet';root.position.set(0,.06,4.64);root.rotation.y=Math.PI;parent.add(root);
 const box=(size,pos,mat=m.slate)=>block(root,size,pos,mat,.008);
 const back=box([2.52,2.13,.35],[0,.18,0]);colliders.push(back);
 // Extruded frame, floor feet and recessed equipment bay.
 for(const x of [-1.23,1.23]){box([.065,2.20,.42],[x,.18,.015],m.white);box([.16,.18,.35],[x,-.99,.01],m.dark);box([.16,.035,.38],[x,-1.08,.01],m.rubber);}
 for(const y of [-.89,-.22,.45,1.27])box([2.53,.045,.43],[0,y,.025],m.steel);
 box([.045,2.10,.40],[.10,.18,.025],m.white);
 box([2.40,.16,.035],[0,1.15,.204],m.dark);
 plate(root,'RELAY / FLIGHT SPARES',[2.26,.12],[0,1.15,.225]);
 for(const x of [-1.14,1.14])screwRow(root,[[x,-.80,.239],[x,1.15,.239]],m.dark,.009);
 const yRows=[-.56,.11,.78];
 // Sealed cases sit in runners: gaskets, hinges, captive fasteners and recessed pulls.
 yRows.forEach((y,i)=>{
  box([1.11,.53,.034],[-.55,y,.205],m.rubber);
  box([1.055,.478,.035],[-.55,y,.23],m.white);
  box([.43,.10,.016],[-.55,y+.10,.253],m.dark);
  box([.31,.022,.035],[-.55,y+.10,.275],m.steel);
  for(const x of [-1.04,-.065]){box([.032,.10,.027],[x,y,.256],m.steel);box([.016,.044,.01],[x,y,.275],m.orange);}
  for(const x of [-.92,-.18])box([.10,.024,.035],[x,y+.224,.252],m.steel);
  plate(root,['01 / BATTERY CARTRIDGES','02 / FLIGHT ELECTRONICS','03 / RADIO & FEED SPARES'][i],[.94,.063],[-.55,y-.13,.253]);
  screwRow(root,[[-1.04,y-.204,.255],[-.065,y-.204,.255],[-1.04,y+.204,.255],[-.065,y+.204,.255]],m.dark,.005);
 });
 // Right-hand display bays: each component is bolted to a backing tray, not hung in air.
 const glass=new T.MeshPhysicalMaterial({color:'#8cb4ca',transparent:true,opacity:.09,roughness:.18,metalness:0,depthWrite:false});
 yRows.forEach((y,i)=>{
  box([1.06,.54,.018],[.68,y,.182],m.dark);
  box([.95,.024,.20],[.68,y-.245,.16],m.steel);
  for(const x of [.20,1.16])box([.025,.51,.07],[x,y,.213],m.steel);
  const bracket=new T.Group();bracket.position.set(.68,y-.04,i===2?.27:.235);root.add(bracket);
  let part;
  if(i===2){part=createHardware('solar',{...DEFAULT,panels:2});part.scale.setScalar(1.12);foldArrays(part,.12);}
  else if(i===1){part=createHardware('computer',DEFAULT);part.rotation.x=Math.PI/2;part.scale.setScalar(2.35);}
  else{part=createHardware('relay',DEFAULT);part.rotation.x=.30;part.scale.setScalar(2.35);}
  bracket.add(part);
  for(const x of [.48,.88]){box([.026,.08,.08],[x,y-.14,.205],m.rubber);screwRow(root,[[x,y-.14,.251]],m.steel,.005);}
  plate(root,['S-BAND TRANSCEIVER','FLIGHT COMPUTER','SOLAR ARRAY / FOLDED'][i],[.96,.052],[.68,y+.214,.252]);
  box([1.06,.012,.006],[.68,y-.259,.252],m.led);const fill=new T.PointLight('#c3def0',.08,.9,2);fill.position.set(.68,y+.17,.54);root.add(fill);
  box([1.04,.51,.004],[.68,y,.29],glass);
  for(const x of [.19,1.17])screwRow(root,[[x,y-.238,.295],[x,y+.238,.295]],m.dark,.005);
 });
 cable(root,[[1.16,-.76,.17],[1.16,-.80,.10],[1.10,-.84,.08]],m.rubber,.009);
 box([2.38,.065,.04],[0,-.92,.19],m.dark);
 return root;
}
