import * as T from 'three';
export function createPayloadFinish(assembly){
  const face=new T.Group();face.name='CubeSat sliding service cover';assembly.add(face);
  const cover=new T.Mesh(new T.BoxGeometry(.227,.346,.009),new T.MeshStandardMaterial({color:'#263e4c',metalness:.42,roughness:.47}));face.add(cover);
  const c=document.createElement('canvas');c.width=1024;c.height=1536;const x=c.getContext('2d');
  x.scale(2,2);x.fillStyle='#102b40';x.fillRect(0,0,512,768);x.strokeStyle='#4dd9ff';x.lineWidth=6;x.strokeRect(25,25,462,718);
  x.strokeStyle='#416171';for(let y=520;y<625;y+=18){x.beginPath();x.moveTo(60,y);x.lineTo(450,y);x.stroke();}
  x.fillStyle='#50dcff';x.beginPath();x.moveTo(255,110);x.lineTo(345,268);x.lineTo(255,227);x.lineTo(165,268);x.closePath();x.fill();
  x.fillStyle='#effbff';x.textAlign='center';x.font='600 64px monospace';x.fillText('CUBESAT',256,355);x.font='26px monospace';x.fillStyle='#91c7d7';x.fillText('LODESTAR / RELAY 03',256,407);x.font='20px monospace';x.fillText('SURFACE — ORBIT — HOME',256,682);
  const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=8;const art=new T.Mesh(new T.PlaneGeometry(.217,.336),new T.MeshStandardMaterial({map:tx,metalness:.20,roughness:.56}));art.position.z=.0047;face.add(art);
  face.position.set(0,.38,.071);face.visible=false;
  const lamps=[];for(let i=0;i<6;i++){const m=new T.MeshStandardMaterial({color:'#28485a',emissive:'#55ddff',emissiveIntensity:.06,roughness:.22});const l=new T.Mesh(new T.BoxGeometry(.009,.013,.005),m);l.position.set(.102,.11-i*.038,.067);assembly.add(l);lamps.push(l);}
  return {face,lamps,cover(amount){face.visible=amount>0;face.position.y=.38*(1-amount);},lights(time,passed){for(let i=0;i<lamps.length;i++){const m=lamps[i].material;const on=time<.62?((Math.floor(time*26)%6)===i||time>.35&&i<Math.floor((time-.35)*24)):time<.9;const color=time<.62?'#55ddff':passed?'#61ffb3':'#ff6f7d';m.color.set(on?color:'#28485a');m.emissive.set(color);m.emissiveIntensity=on?2.3:.035;}},idle(){for(const l of lamps){l.material.color.set('#28485a');l.material.emissiveIntensity=.035;}}};
}
