import * as THREE from 'three';

// Illustrative teaching hardware. Dimensions and details are not flight drawings.
const material = (color, metalness=.2, roughness=.5) => new THREE.MeshStandardMaterial({color,metalness,roughness});
const M = {
 rail:material('#b9c6ca',.8,.27), dark:material('#26353e',.65,.32), black:material('#111c24',.15,.62),
 white:material('#d8dfdf',.35,.48), gold:material('#bda46a',.72,.34), pcb:material('#174e49',.35,.47),
 cell:material('#172d54',.6,.23), cellAlt:material('#233b66',.55,.28), ceramic:material('#e5ddc3',.08,.5),
 copper:material('#b58a58',.65,.38), cable:material('#1b242b',.15,.65), amber:material('#c8833b',.4,.4),
 led:new THREE.MeshStandardMaterial({color:'#6ec5af',emissive:'#3a9c87',emissiveIntensity:.45,roughness:.5})
};
const geometryCache=new Map(),labelCache=new Map();
function boxGeometry(w,h,d){
 const key=`b/${w}/${h}/${d}`;if(geometryCache.has(key))return geometryCache.get(key);
 const r=Math.min(.0018,w*.12,h*.12,d*.22),s=new THREE.Shape();
 s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
 const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.0001,d-2*r),bevelEnabled:true,bevelSize:r*.35,bevelThickness:r,bevelSegments:2,curveSegments:3,steps:1});g.translate(0,0,-d/2+r);geometryCache.set(key,g);return g;
}
function cylinderGeometry(r,h,n=24){const key=`c/${r}/${h}/${n}`;if(!geometryCache.has(key))geometryCache.set(key,new THREE.CylinderGeometry(r,r,h,n));return geometryCache.get(key);}
function mesh(g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);return o;}
function box(w,h,d,m,x=0,y=0,z=0){return mesh(boxGeometry(w,h,d),m,x,y,z);}
function cylinder(r,h,m,x=0,y=0,z=0,n=24){return mesh(cylinderGeometry(r,h,n),m,x,y,z);}
const dummy=new THREE.Object3D();
function batch(g,m,poses){
 const o=new THREE.InstancedMesh(g,m,poses.length);
 poses.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.rotation.set(p[3]||0,p[4]||0,p[5]||0);dummy.scale.set(1,1,1);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);});
 o.instanceMatrix.needsUpdate=true;return o;
}
function bolts(points){return batch(cylinderGeometry(.0021,.0018,8),M.dark,points.map(p=>[...p,Math.PI/2]));}
function label(text,w=.064,h=.014){
 let m=labelCache.get(text);if(!m){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#d7e0dd';ctx.fillRect(0,0,512,128);ctx.fillStyle='#273b43';ctx.font='600 42px sans-serif';ctx.fillText(text,24,79);ctx.fillRect(24,103,200,3);for(let i=0;i<18;i++)ctx.fillRect(355+i*6,30,2+(i%3),65);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;m=new THREE.MeshStandardMaterial({map:t,roughness:.6,metalness:.1});labelCache.set(text,m);}
 const key=`label/${w}/${h}`;if(!geometryCache.has(key))geometryCache.set(key,new THREE.PlaneGeometry(w,h));return mesh(geometryCache.get(key),m);
}
function wire(points,m=M.cable,r=.0011){const key='w/'+r+'/'+points.flat().join(',');if(!geometryCache.has(key)){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));geometryCache.set(key,new THREE.TubeGeometry(curve,20,r,6,false));}return mesh(geometryCache.get(key),m);}

export function createChassis(){
 const g=new THREE.Group();g.name='Lodestar service chassis';
 // Open service face, rear skin, corner extrusions and cartridge guides.
 g.add(box(.193,.316,.005,M.dark,0,0,-.057));
 g.add(box(.176,.294,.0014,M.gold,0,0,-.053));
 for(const x of [-.105,.105])for(const z of [-.057,.057]){
  g.add(box(.012,.34,.012,M.rail,x,0,z));g.add(box(.003,.306,.013,M.dark,x+(x<0?.004:-.004),0,z));
 }
 for(const y of [-.165,.165]){
  g.add(box(.223,.011,.123,M.rail,0,y));g.add(box(.184,.003,.092,M.dark,0,y+(y<0?.007:-.007)));
  g.add(box(.19,.004,.006,M.white,0,y,.064));
 }
 for(const y of [-.142,-.069,.014,.095]){
  g.add(box(.185,.003,.099,M.dark,0,y));
  for(const x of [-.086,.086]){g.add(box(.006,.012,.099,M.rail,x,y+.004));g.add(box(.003,.003,.086,M.gold,x,y+.009,.005));}
 }
 // Removable side skin: raised ribs and recessed fasteners.
 g.add(box(.004,.27,.1,M.white,-.109,0,0));
 const ribs=[];for(let y=-.115;y<.13;y+=.023)ribs.push([-.112,y,0,0,0,0]);g.add(batch(boxGeometry(.002,.003,.08),M.rail,ribs));
 const screws=[];for(const x of [-.105,.105])for(const y of [-.145,-.075,0,.075,.145])screws.push([x,y,.065]);g.add(bolts(screws));
 const vents=[];for(let x=-.07;x<=.071;x+=.014)vents.push([x,-.153,.065]);g.add(batch(boxGeometry(.007,.0025,.001),M.black,vents));
 const tag=label('LODESTAR / R-06',.076,.017);tag.position.set(0,.147,.064);g.add(tag);
 g.add(box(.032,.006,.002,M.black,.055,-.13,.064));g.add(box(.004,.002,.003,M.led,.048,-.13,.066));
 g.add(wire([[-.079,-.13,-.045],[-.079,-.04,-.042],[-.075,.08,-.042],[-.035,.12,-.042]],M.amber));
 return g;
}

function solar(c){
 const root=new THREE.Group(),w=c.panelSize==='large'?.20:.13,h=c.panelSize==='large'?.32:.245;
 for(const side of [-1,1]){
  if(!c.panels)continue;const wing=new THREE.Group();wing.position.set(side*.116,0,-.045);wing.userData.foldSide=side;root.add(wing);
  const count=c.panels/2;
  for(let k=0;k<count;k++){
   const x=side*(w/2+.01+k*(w+.012));
   wing.add(box(w+.012,h+.012,.006,M.rail,x));wing.add(box(w+.005,h+.005,.006,M.black,x,0,.003));
   const cells=[],alternate=[],bus=[];const cols=4,rows=6,cw=(w-.012)/cols,ch=(h-.016)/rows;
   for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
    const p=[x-w/2+.006+cw*(i+.5),-h/2+.008+ch*(j+.5),.007];((i+j)%3?cells:alternate).push(p);
    for(const a of [-1,1])bus.push([p[0]+a*cw*.26,p[1],.0085]);
   }
   wing.add(batch(boxGeometry(cw-.002,ch-.002,.0016),M.cell,cells));wing.add(batch(boxGeometry(cw-.002,ch-.002,.0016),M.cellAlt,alternate));
   wing.add(batch(boxGeometry(.00055,ch-.002,.0003),M.rail,bus));
   const connections=[];for(let j=0;j<rows;j++)connections.push([x,-h/2+.008+ch*(j+.5),.0087]);wing.add(batch(boxGeometry(w-.01,.0006,.0003),M.copper,connections));
   wing.add(bolts([[x-w/2,-h/2,.008],[x+w/2,-h/2,.008],[x-w/2,h/2,.008],[x+w/2,h/2,.008]]));
   wing.add(box(.014,h*.48,.002,M.dark,x,0,-.005));
  }
  for(const y of [-.075,.075]){
   wing.add(cylinder(.007,.028,M.dark,0,y,0));wing.add(cylinder(.004,.034,M.rail,0,y,0));
  }
  wing.add(wire([[0,-.06,.004],[side*.018,-.04,.008],[side*.045,-.03,.005]],M.amber,.0013));
 }
 return root;
}
function battery(c){
 const root=new THREE.Group();
 for(let i=0;i<c.batteries;i++){
  const y=(i-(c.batteries-1)/2)*.033,pack=new THREE.Group();pack.position.y=y;root.add(pack);
  pack.add(box(.17,.028,.087,M.white));pack.add(box(.158,.025,.081,M.dark,0,.001,.002));
  pack.add(box(.166,.002,.083,M.rail,0,.015));
  const slots=[];for(let x=-.066;x<.07;x+=.016)slots.push([x,.016,.007]);pack.add(batch(boxGeometry(.009,.0015,.049),M.black,slots));
  pack.add(box(.175,.029,.006,M.rail,0,0,.045));
  pack.add(box(.047,.009,.008,M.black,0,.001,.052));pack.add(box(.037,.004,.003,M.rail,0,.003,.057));
  pack.add(box(.011,.016,.006,M.amber,-.069,0,.05));pack.add(box(.004,.004,.002,M.led,.072,.006,.05));
  pack.add(box(.025,.015,.006,M.gold,.056,0,-.046));
  const tag=label('43 Wh',.044,.009);tag.position.set(.041,-.007,.049);pack.add(tag);
  pack.add(bolts([[-.078,-.009,.049],[.078,-.009,.049],[-.078,.009,.049],[.078,.009,.049]]));
 }
 return root;
}
function computer(c){
 const root=new THREE.Group();
 for(let i=0;i<c.computers;i++){
  const y=i*.027,card=new THREE.Group();card.position.y=y;root.add(card);
  card.add(box(.171,.0035,.089,M.pcb));
  for(const x of [-.079,.079]){card.add(box(.006,.012,.091,M.rail,x,-.003));}
  card.add(box(.04,.008,.033,M.black,-.015,.006,0));card.add(box(.031,.001,.023,M.rail,-.015,.011,0));
  const chips=[],pads=[];for(let k=0;k<8;k++){const x=(k%4)*.026-.045,z=k<4?-.032:.029;chips.push([x,.005,z]);for(let p=0;p<4;p++)pads.push([x-.007+p*.004,.004,z+.006]);}
  card.add(batch(boxGeometry(.016,.005,.011),M.black,chips));card.add(batch(boxGeometry(.002,.002,.003),M.gold,pads));
  const traces=[];for(let k=0;k<9;k++)traces.push([-.061+k*.015,.0025,-.009]);card.add(batch(boxGeometry(.0008,.0003,.03),M.copper,traces));
  card.add(box(.133,.012,.009,M.dark,0,.003,-.044));
  const contacts=[];for(let x=-.06;x<.061;x+=.006)contacts.push([x,.007,-.049]);card.add(batch(boxGeometry(.002,.003,.002),M.gold,contacts));
  card.add(box(.172,.016,.004,M.rail,0,-.002,.048));
  const tag=label(i?'BACKUP / OBC':'PRIMARY / OBC',.061,.009);tag.position.set(0,-.001,.051);card.add(tag);
  for(const x of [-.079,.079])for(const z of [-.034,.034])card.add(cylinder(.0025,.013,M.gold,x,-.007,z,12));
 }
 return root;
}
function attitude(){
 const root=new THREE.Group();root.add(box(.169,.004,.088,M.pcb,0,-.022));
 const positions=[[-.049,.002,0],[0,.012,0],[.049,.002,0]];
 positions.forEach((p,i)=>{const wheel=new THREE.Group();wheel.position.set(...p);if(i===0)wheel.rotation.z=Math.PI/2;if(i===2)wheel.rotation.x=Math.PI/2;
  wheel.add(cylinder(.022,.018,M.dark));wheel.add(cylinder(.018,.019,M.rail));wheel.add(cylinder(.007,.022,M.gold));root.add(wheel);
  root.add(box(.04,.004,.059,M.rail,p[0],-.016,0));
 });
 root.add(box(.02,.016,.02,M.black,.063,.012,.028));root.add(box(.013,.001,.013,M.cell,.063,.021,.028));
 root.add(wire([[-.064,-.017,.028],[-.045,-.01,.035],[.02,-.01,.036],[.067,-.017,.031]],M.amber));
 const tag=label('ADCS / 3 AXIS',.062,.009);tag.position.set(0,-.017,.046);root.add(tag);return root;
}
function relay(){
 const root=new THREE.Group();root.add(box(.168,.028,.086,M.rail));root.add(box(.155,.002,.076,M.gold,0,.016));
 const fins=[];for(let x=-.06;x<=.061;x+=.012)fins.push([x,.021,-.016]);root.add(batch(boxGeometry(.003,.01,.048),M.dark,fins));
 root.add(box(.164,.023,.005,M.dark,0,0,.046));
 for(const x of [-.061,.061]){const connector=cylinder(.005,.012,M.gold,x,.003,.053);connector.rotation.x=Math.PI/2;root.add(connector);}
 const tag=label('RF / STORE + FORWARD',.086,.011);tag.position.set(0,-.002,.05);root.add(tag);
 // A distinct, hinged planar antenna and two slender receiving elements.
 root.add(box(.033,.035,.023,M.dark,0,.036,-.014));
 const hinge=cylinder(.008,.046,M.rail,0,.059,-.014);hinge.rotation.z=Math.PI/2;root.add(hinge);
 const panel=new THREE.Group();panel.position.set(0,.127,-.016);panel.rotation.x=-.18;root.add(panel);
 panel.add(box(.178,.128,.006,M.rail));panel.add(box(.163,.113,.002,M.ceramic,0,0,.005));
 const patches=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)patches.push([x*.047,y*.033,.007]);panel.add(batch(boxGeometry(.032,.023,.0008),M.gold,patches));
 panel.add(bolts([[-.081,-.055,.007],[.081,-.055,.007],[-.081,.055,.007],[.081,.055,.007]]));
 for(const side of [-1,1]){
  const mast=new THREE.Group();mast.position.set(side*.079,.019,-.027);mast.rotation.z=-side*.19;
  mast.add(cylinder(.0035,.012,M.dark,0,.006));mast.add(cylinder(.0011,.18,M.rail,0,.097,0,8));mast.add(cylinder(.0018,.007,M.dark,0,.19,0,8));root.add(mast);
 }
 root.add(wire([[.06,.017,-.036],[.042,.036,-.04],[.012,.06,-.03],[0,.1,-.023]],M.cable,.0016));
 return root;
}
export function createHardware(id,c){const g=id==='solar'?solar(c):id==='battery'?battery(c):id==='computer'?computer(c):id==='attitude'?attitude():relay();g.name=id+' module';g.userData.hardwareId=id;return g;}
export function slotPosition(id){return new THREE.Vector3(0,{solar:0,battery:-.105,computer:-.044,attitude:.051,relay:.117}[id]||0,0);}
export function foldArrays(group,amount){group.traverse(o=>{if(o.userData.foldSide)o.rotation.y=o.userData.foldSide*amount;});}
export function previewScale(id,c){return id==='solar'?(c.panels===4?(c.panelSize==='large'?.76:1.05):1.3):id==='battery'?2.7:id==='computer'?2.8:id==='attitude'?2.3:1.6;}
