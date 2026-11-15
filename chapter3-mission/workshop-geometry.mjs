import * as THREE from 'three';
import {createModuleStores} from './storage.mjs';
import {createChassis,createHardware,foldArrays,slotPosition} from './hardware.mjs';
import {coreConfig} from './config.mjs';
import {DEFAULT as PREPARED_RELAY} from './kit.mjs';
import {block,plate,screwRow,cable,industrialMaterials} from './industrial.mjs';
export const BENCH=Object.freeze({...coreConfig().bench,width:2.94,depth:.88});
export function createWorkshopGeometry(scene,config={}){
 const b={...coreConfig(config).bench,width:2.94,depth:.88},root=new THREE.Group();root.name='CH3 / Relay laboratory fitted workbench';root.position.fromArray(b.position);root.rotation.y=Math.PI/2;scene.add(root);
 const m=industrialMaterials(scene),colliders=[],targets=[],stations={};
 const box=(p,size,pos,mat=m.dark,solid=false)=>{const mesh=block(p,size,pos,mat);if(solid)colliders.push(mesh);return mesh;};
 const target=(id,size,pos)=>{const t=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({visible:false}));t.position.fromArray(pos);t.userData.workshopId=id;root.add(t);targets.push(t);};
 box(root,[2.96,.085,.90],[0,0,0],m.white,true);box(root,[2.79,.010,.74],[0,.049,.015],m.mat);
 box(root,[2.96,.12,.06],[0,-.09,.42],m.slate);box(root,[2.83,.014,.016],[0,-.04,.456],m.orange);
 plate(root,'LODESTAR / RELAY INTEGRATION',[1.26,.075],[-.63,-.105,.455]);
 for(const x of [-1.24,1.24]){box(root,[.38,.71,.67],[x,-.40,-.035],m.white,true);box(root,[.40,.055,.72],[x,-.78,-.035],m.dark);for(const y of [-.21,-.43,-.65]){box(root,[.32,.19,.025],[x,y,.314],m.slate);box(root,[.13,.014,.019],[x,y+.043,.335],m.steel);}}
 // A backed, bolted service panel replaces the floating signs.
 box(root,[2.92,1.30,.09],[0,.77,-.60],m.slate,true);
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#192e3b';ctx.fillRect(0,0,1024,512);ctx.strokeStyle='#29414d';ctx.lineWidth=1;for(let i=0;i<1024;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();}for(let i=0;i<512;i+=32){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(1024,i);ctx.stroke();}ctx.strokeStyle='#496473';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(68,140+i*70);ctx.lineTo(170+i*28,140+i*70);ctx.lineTo(220+i*28,185+i*55);ctx.lineTo(690,185+i*55);ctx.stroke();}const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;const panelMat=m.dark.clone();panelMat.color.set('#c9d0d3');panelMat.map=tx;box(root,[2.78,1.17,.025],[0,.77,-.541],panelMat);
 plate(root,'RELAY LABORATORY',[1.93,.15],[-.26,1.23,-.519],undefined,{font:66});plate(root,'ASSEMBLY / POWER / COMMUNICATIONS',[1.93,.075],[-.26,1.09,-.519],undefined,{font:40});
 for(const x of [-1.38,1.38])box(root,[.025,1.15,.025],[x,.77,-.511],m.steel);
 screwRow(root,[[-1.38,.22,-.491],[-1.38,1.32,-.491],[1.38,.22,-.491],[1.38,1.32,-.491]],m.steel,.009);
 for(let i=0;i<3;i++){const x=.99,y=.90-i*.25;box(root,[.40,.19,.035],[x,y,-.505],m.slate);plate(root,['POWER BUS / 28 V','ESD / GROUNDED','TEST PORT / READY'][i],[.36,.07],[x,y+.045,-.482],undefined,{font:33});for(let j=0;j<5;j++)box(root,[.035,.014,.004],[x-.12+j*.06,y-.043,-.482],j<4?m.led:m.orange);}
 for(const x of [-1.1,1.08])cable(root,[[x,.20,-.49],[x,.12,-.47],[x-.09,.075,-.29]],m.rubber,.008);
 box(root,[.63,.045,.44],[-.35,.081,.07],m.slate);for(const x of [-.54,-.16]){box(root,[.052,.14,.22],[x,.15,.07],m.steel);box(root,[.042,.017,.21],[x,.229,.07],m.rubber);}
 const assembly=new THREE.Group();assembly.name='CH3 / actual relay in restraint';assembly.position.set(-.35,.51,.07);assembly.scale.setScalar(b.scale);root.add(assembly);assembly.add(createChassis());
 const specs=[['solar','01 / ARRAYS',-1.10,.06],['battery','02 / POWER',-.94,-.30],['computer','03 / FLIGHT',.28,-.28],['attitude','04 / POINTING',.72,-.28],['protection','07 / SAFETY',1.16,-.28],['relay','05 / RADIO',1.16,.09],['antenna','06 / ANTENNA',.28,.09]];
 for(const[id,label,x,z]of specs){const w=id==='solar'?.52:.38,d=.25,tray=new THREE.Group();tray.position.set(x,.072,z);root.add(tray);const base=box(tray,[w,.018,d],[0,0,0],m.slate);box(tray,[w-.025,.008,d-.028],[0,.013,0],m.rubber);for(const side of [-1,1])box(tray,[.012,.025,d],[side*(w-.012)/2,.015,0],m.steel);plate(tray,label,[w-.018,.042],[0,.022,d/2+.025],[-Math.PI/2,0,0],{font:36});const part=createHardware(id,PREPARED_RELAY);part.scale.setScalar(id==='solar'?.70:1.05);if(id==='solar'){part.rotation.x=-Math.PI/2;foldArrays(part,1.1);}part.position.set(x,.12,z);root.add(part);target(id,[w+.035,.23,.32],[x,.17,z]);stations[id]={base,part,position:new THREE.Vector3(x,.26,z)};}
 const terminal=new THREE.Group();terminal.position.set(.70,.27,.30);terminal.rotation.x=-.38;root.add(terminal);box(root,[.045,.18,.06],[.70,.15,.27],m.steel);box(terminal,[.43,.23,.034],[0,0,0],m.slate);box(terminal,[.385,.18,.004],[0,0,.020],m.dark);plate(terminal,'CONFIGURE / E',[.36,.055],[0,0,.024],undefined,{color:'#78d6e7'});screwRow(terminal,[[-.194,-.095,.020],[.194,-.095,.020],[-.194,.095,.020],[.194,.095,.020]],m.steel,.004);target('solar',[.49,.33,.20],[.70,.27,.30]);
 const preview=new THREE.Group();preview.name='CH3 / selected module inspection';root.add(preview);
 createModuleStores(root,m,colliders);
 const light=new THREE.PointLight('#d2e0eb',.45,3.5,2);light.position.set(0,1.28,.6);root.add(light);root.updateMatrixWorld(true);
 return {root,assembly,preview,stations,targets,colliders,light,obstacles:[[[b.position[0]-.50,-1.7,b.position[2]-1.51],[b.position[0]+.48,b.position[1]+.08,b.position[2]+1.51]],[[b.position[0]+4.44,-1.7,b.position[2]-1.29],[b.position[0]+4.84,1.35,b.position[2]+1.29]]],mount(id,configuration){const g=id==='attitude'&&!configuration.attitude?new THREE.Group():createHardware(id,configuration);g.position.copy(slotPosition(id));if(id==='solar')foldArrays(g,1.12);assembly.add(g);return g;}};
}
