/* Lodestar · training simulation (water world), integrated into the main game (Nov 14, 2026).
   Remade from Tom's tutorial (rev 7): his water/wave shaders, sky, rocket and his tested flight/relay models
   (tom/*.mjs) are reused; the scene wiring, controls, terminal and all UI are rebuilt in the game's own style and
   run on the game's single renderer, camera and audio. Three checks: ship orbit, relay workshop, contact window. */
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { MARS, hohmann, circularOrbit, transferState, contactGeometry, formatDuration } from "./tom/orbital.mjs";
import { INSPECTION, evaluateInspection, nextContactOpportunity } from "./tom/exercise.mjs";
import { defaultDesign, assessDesign, designCost, CASE, WORKSHOP } from "./tom/design.mjs";
import { createChassis, createHardware, slotPosition, foldArrays } from "./tom/hardware.mjs";

export { assessDesign, defaultDesign, designCost, CASE, WORKSHOP, createChassis, createHardware, slotPosition, foldArrays, hohmann, circularOrbit, transferState, contactGeometry, formatDuration, MARS };

const seaWaves = `vec3 sea(vec2 q,float t){vec3 r=vec3(0.);vec2 d=normalize(vec2(.8,.6));float slow=dot(q,d)*.42-t*.52;r+=vec3(sin(slow),cos(slow)*d.x*.42,cos(slow)*d.y*.42)*.020;d=normalize(vec2(-.3,1.));slow=dot(q,d)*.75-t*.65+2.1;r+=vec3(sin(slow),cos(slow)*d.x*.75,cos(slow)*d.y*.75)*.008;d=normalize(vec2(1.,.43));float p=dot(q,d)*1.35-t*.8;r+=vec3(sin(p),cos(p)*d.x*1.35,cos(p)*d.y*1.35)*.008;d=normalize(vec2(-.67,1.));p=dot(q,d)*2.6-t*1.1+1.7;r+=vec3(sin(p),cos(p)*d.x*2.6,cos(p)*d.y*2.6)*.0035;d=normalize(vec2(.32,1.));p=dot(q,d)*4.4-t*1.45+3.2;r+=vec3(sin(p),cos(p)*d.x*4.4,cos(p)*d.y*4.4)*.0017;return r;}`;
const crestMotion = `uniform float sceneryTime;uniform float sceneryAmount;uniform mat4 sceneryWorldToLocal;uniform mat3 sceneryNormalToWorld;uniform mat3 sceneryWorldNormalToLocal;
vec3 crestDrift(vec3 w){float mask=smoothstep(5.,180.,w.y)*sceneryAmount;float a=w.x*.0012+w.z*.0015,b=w.x*.0011-w.z*.0008;float p=a-sceneryTime*.34,q=b-sceneryTime*.22;return vec3((cos(q)-cos(b))*24.,(sin(p)-sin(a))*45.+(sin(q)-sin(b))*18.,(cos(p)-cos(a))*75.)*mask;}
vec2 crestGradient(vec3 w){float mask=smoothstep(5.,180.,w.y)*sceneryAmount;float a=w.x*.0012+w.z*.0015,b=w.x*.0011-w.z*.0008;float p=cos(a-sceneryTime*.34)-cos(a),q=cos(b-sceneryTime*.22)-cos(b);return vec2(p*45.*.0012+q*18.*.0011,p*45.*.0015-q*18.*.0008)*mask;}`;

const TERM = new THREE.Vector3(0, 1.62, -7.2);   // floating terminal

export function createTraining(host) {
  const { renderer, cam, $ } = host;
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#b8b9b6"); scene.fog = new THREE.FogExp2("#b8b9b6", .00012);
  scene.add(new THREE.HemisphereLight("#e6e5df", "#7d827d", .9));
  const sun = new THREE.DirectionalLight("#f1f0e8", .55); sun.position.set(-110, 170, 80); scene.add(sun);
  const near = new THREE.DirectionalLight("#e7e7df", .6); near.position.set(7, 15, -3); scene.add(near);
  const time = { value: 0 }, amount = { value: 1 };
  const T = { scene, ready: false, active: false, pos: new THREE.Vector3(0, 1.65, 0), vel: new THREE.Vector3(), yaw: 0, pitch: -.02, step: 0,
    term: false, lesson: 0, done: [false, false, false], alt: 300, rehearse: -1, design: defaultDesign(), scenario: "nominal", contact: { t: 0, angle: .9, sent: false, anim: -1 },
    glide: { k: 0, on: false, from: new THREE.Vector3(), q0: new THREE.Quaternion(), p: new THREE.Vector3(), q: new THREE.Quaternion() }, prompt: "", onExit: null, lines: host.lines };

  // ---- water (Tom's reflective shallows), sand floor, distant crests, sky, rocket
  const sandTex = new THREE.TextureLoader().load("train_sand.jpg"); sandTex.colorSpace = THREE.SRGBColorSpace; sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  const waterShader = { uniforms: { color: { value: new THREE.Color("#929c9c") }, tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() }, time, sandTex: { value: sandTex } },
    vertexShader: seaWaves + `uniform mat4 textureMatrix;uniform float time;varying vec4 vReflect;varying vec3 vWorld;void main(){vec3 p=position;vec4 base=modelMatrix*vec4(p,1.);float fade=1.-smoothstep(35.,200.,length(base.xz));p.z+=sea(base.xz,time).x*fade;vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;vReflect=textureMatrix*vec4(p,1.);gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: seaWaves + `uniform sampler2D tDiffuse;uniform sampler2D sandTex;uniform float time;varying vec4 vReflect;varying vec3 vWorld;void main(){vec2 q=vWorld.xz;float dist=length(cameraPosition-vWorld);float fade=1.-smoothstep(25.,180.,dist);vec3 slope=sea(q,time);vec3 n=normalize(vec3(-slope.y*fade,1.,-slope.z*fade));vec3 eye=normalize(cameraPosition-vWorld);float fresnel=.0204+.9796*pow(1.-max(dot(eye,n),0.),5.);vec2 uv=vReflect.xy/max(vReflect.w,.0001);vec3 viewNormal=(viewMatrix*vec4(n,0.)).xyz;uv+=viewNormal.xy*.014*fade;vec3 refl=texture2D(tDiffuse,clamp(uv,vec2(.001),vec2(.999))).rgb;vec3 floorColor=texture2D(sandTex,q/6.+n.xz*.35).rgb*vec3(.78,.80,.79);vec3 col=mix(floorColor,refl,clamp(fresnel*.9+.10,0.,1.));vec3 light=normalize(vec3(-.55,.8,.4));float spec=pow(max(dot(reflect(-light,n),eye),0.),130.);col+=vec3(.85,.87,.86)*spec*.12;col=mix(col,vec3(.49,.51,.51),1.-exp(-dist*.00028));gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}` };
  const waterGeo = new THREE.PlaneGeometry(14500, 14500, 200, 200), wp = waterGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) for (const a of ["X", "Y"]) { const v = wp["get" + a](i) / 7250; wp["set" + a](i, Math.sign(v) * Math.pow(Math.abs(v), 2.7) * 7250); }
  const water = new Reflector(waterGeo, { textureWidth: 1024, textureHeight: 640, clipBias: .003, multisample: 2, shader: waterShader });
  water.rotation.x = -Math.PI / 2; water.position.y = .18; scene.add(water);

  // ---- terminal: a floating holo panel in the game's style, over a glowing pad
  const tcv = document.createElement("canvas"); tcv.width = 1024; tcv.height = 600; const ttex = new THREE.CanvasTexture(tcv); ttex.colorSpace = THREE.SRGBColorSpace;
  const term = new THREE.Group(); term.position.copy(TERM); scene.add(term);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: ttex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })); term.add(panel);
  const pad = new THREE.Group(); pad.position.set(TERM.x, .22, TERM.z + .2); scene.add(pad);
  for (const [r, o] of [[.95, .55], [1.25, .3]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 8, 96), new THREE.MeshBasicMaterial({ color: 0x5fe3ff, transparent: true, opacity: o, toneMapped: false })); ring.rotation.x = Math.PI / 2; pad.add(ring); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(.85, 64), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: .25, toneMapped: false })); disc.rotation.x = -Math.PI / 2; pad.add(disc);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x5fe3ff, transparent: true, opacity: .06, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); beam.position.y = .6; pad.add(beam);
  function drawTerm() {
    const g = tcv.getContext("2d"), W = 1024, H = 600; g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(6,22,40,.82)"; g.fillRect(8, 8, W - 16, H - 16); g.strokeStyle = "#5fe3ff"; g.lineWidth = 3; g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = "#5fe3ff"; for (const [x, y] of [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]]) { g.fillRect(x - (x > 500 ? 40 : 0), y - (y > 300 ? 6 : 0), 40, 6); g.fillRect(x - (x > 500 ? 6 : 0), y - (y > 300 ? 40 : 0), 6, 40); }
    g.fillStyle = "rgba(95,227,255,.14)"; g.fillRect(8, 8, W - 16, 96);
    g.font = "600 30px 'IBM Plex Mono', monospace"; g.fillStyle = "#8fb8c6"; g.fillText("LODESTAR · FLIGHT SCHOOL", 44, 66);
    g.font = "600 74px 'Barlow Condensed', sans-serif"; g.fillStyle = "#e9fbff"; g.fillText(T.done.every(Boolean) ? "ASSESSMENT COMPLETE" : "FINAL ASSESSMENT", 44, 210);
    g.font = "500 32px 'IBM Plex Mono', monospace";
    ["SHIP ORBIT", "RELAY WORKSHOP", "CONTACT WINDOW"].forEach((n, i) => { g.fillStyle = T.done[i] ? "#6dffb0" : "#cfe9f1"; g.fillText(`${T.done[i] ? "✓" : "0" + (i + 1)}  ${n}`, 60, 300 + i * 62); });
    g.font = "600 34px 'IBM Plex Mono', monospace"; g.fillStyle = "#ffb347"; g.fillText(T.done.every(Boolean) ? "E · BEGIN THE MISSION" : "E · CONNECT", 44, 540);
    for (let y = 8; y < H - 8; y += 4) { g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(8, y, W - 16, 1); }
    ttex.needsUpdate = true;
  }

  // ---- assets (loaded once, in the background while the intro film plays)
  T.load = async () => {
    if (T.loading) return T.loading;
    return T.loading = (async () => {
      const [skyTxt] = await Promise.all([fetch("train_sky.hdr.gz.txt").then(r => r.text())]);
      const bin = Uint8Array.from(atob(skyTxt.trim()), c => c.charCodeAt(0));
      const raw = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      const url = URL.createObjectURL(new Blob([raw]));
      const sky = await new RGBELoader().loadAsync(url); URL.revokeObjectURL(url); sky.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(sky).texture; pm.dispose();
      const sg = new THREE.SphereGeometry(14500, 64, 32), uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      const skyMat = new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, depthWrite: false, fog: false }); skyMat.color.setRGB(.72, .72, .72);
      T.dome = new THREE.Mesh(sg, skyMat); T.dome.renderOrder = -100; scene.add(T.dome);
      const props = await host.loadGLB("train_props.glb", "train"); props.scene.updateMatrixWorld(true);
      const lander = new THREE.Group(), rocks = new THREE.Group(), ms = []; props.scene.traverse(o => { if (o.isMesh) ms.push(o); });
      for (const o of ms) { const m = o.matrixWorld.clone(); const L = o.name.startsWith("lander_"); (L ? lander : rocks).add(o); o.matrix.copy(m); o.matrix.decompose(o.position, o.quaternion, o.scale);
        for (const mt of Array.isArray(o.material) ? o.material : [o.material]) { mt.envMapIntensity = .8; if (L && /off-white thermal/.test(mt.name)) { mt.map = null; mt.color.set("#c2c5bf"); mt.metalness = .08; mt.roughness = .58; } else if (L && /brushed structural/.test(mt.name)) { mt.map = null; mt.color.set("#9fa5a5"); mt.roughness = .38; } if (mt.metalness > .4) mt.roughness = Math.max(.3, mt.roughness); } }
      lander.position.set(52, 0, -350); scene.add(lander, rocks); T.rocket = lander;
      const waves = await host.loadGLB("train_waves.glb", "train"); scene.add(waves.scene); waves.scene.updateMatrixWorld(true);
      waves.scene.traverse(o => { if (!o.isMesh) return; const m = o.material = o.material.clone(); m.envMapIntensity = .8; m.color.multiplyScalar(.45); m.transparent = true; m.depthWrite = false; m.alphaTest = .02;
        const n2w = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), w2l = o.matrixWorld.clone().invert();
        m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { sceneryTime: time, sceneryAmount: amount, sceneryWorldToLocal: { value: w2l }, sceneryNormalToWorld: { value: n2w }, sceneryWorldNormalToLocal: { value: n2w.clone().invert() } });
          sh.vertexShader = crestMotion + "\nvarying float vWaveHeight;varying vec3 vWavePosition;\n" + sh.vertexShader;
          sh.vertexShader = sh.vertexShader.replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvec3 staticWorld=(modelMatrix*vec4(position,1.)).xyz;vec2 gradient=crestGradient(staticWorld);vec3 rollingNormal=normalize(sceneryNormalToWorld*objectNormal);rollingNormal.xz-=gradient*rollingNormal.y;objectNormal=normalize(sceneryWorldNormalToLocal*rollingNormal);");
          sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvec3 originalWorld=(modelMatrix*vec4(transformed,1.)).xyz;vWavePosition=originalWorld+crestDrift(originalWorld);transformed=(sceneryWorldToLocal*vec4(vWavePosition,1.)).xyz;vWaveHeight=vWavePosition.y;");
          sh.fragmentShader = "varying float vWaveHeight;varying vec3 vWavePosition;\n" + sh.fragmentShader;
          sh.fragmentShader = sh.fragmentShader.replace("#include <alphatest_fragment>", "diffuseColor.a *= smoothstep(.2,28.,vWaveHeight)*smoothstep(.5,.82,-vWavePosition.z/max(1.,length(vWavePosition.xz)));\n#include <alphatest_fragment>"); };
        m.customProgramCacheKey = () => "lodestar-rolling-crests"; });
      drawTerm(); renderer.compile(scene, cam); T.ready = true;
    })().catch(e => { console.error("training assets", e); T.ready = true; });
  };

  // ---- enter / leave
  T.enter = () => { T.active = true; T.pos.set(0, 1.65, 0); T.vel.set(0, 0, 0); T.yaw = 0; T.pitch = -.03; T.glide.k = 0; T.glide.on = false; drawTerm(); host.say("mc", 0); };
  T.viewpoint = () => { cam.position.set(0, 1.65, 0); cam.rotation.set(-.015, -.045, 0, "YXZ"); };   // the film's fixed viewpoint (the transition starts from it)

  // ---- per-frame
  const fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ");
  T.update = (dt, keys, look) => {
    time.value += dt; if (T.dome) T.dome.rotation.y += dt * .0015;
    pad.children[0].material.opacity = .45 + .15 * Math.sin(time.value * 2); beam.material.opacity = .05 + .03 * Math.sin(time.value * 1.3);
    term.position.y = TERM.y + Math.sin(time.value * .8) * .03; term.lookAt(T.pos.x, term.position.y, T.pos.z);
    T.yaw = look.yaw; T.pitch = Math.max(-1.2, Math.min(1.2, look.pitch));
    if (!T.term) {   // walk in the shallows (WASD), gentle step bob, stay inside the training area
      fwd.set(-Math.sin(T.yaw), 0, -Math.cos(T.yaw)); rgt.set(-fwd.z, 0, fwd.x); const acc = new THREE.Vector3();
      if (keys.KeyW || keys.ArrowUp) acc.add(fwd); if (keys.KeyS || keys.ArrowDown) acc.sub(fwd); if (keys.KeyD || keys.ArrowRight) acc.add(rgt); if (keys.KeyA || keys.ArrowLeft) acc.sub(rgt);
      if (acc.lengthSq()) acc.normalize().multiplyScalar(keys.ShiftLeft ? 4.6 : 2.8);
      T.vel.lerp(acc, Math.min(1, dt * 6)); T.pos.addScaledVector(T.vel, dt);
      const r = Math.hypot(T.pos.x, T.pos.z); if (r > 38) T.pos.multiplyScalar(38 / r);
      const dT = Math.hypot(T.pos.x - TERM.x, T.pos.z - TERM.z); if (dT < .9) { T.pos.x = TERM.x + (T.pos.x - TERM.x) / dT * .9; T.pos.z = TERM.z + (T.pos.z - TERM.z) / dT * .9; }
      const sp = T.vel.length(); T.step += sp * dt * 1.9; const bob = Math.sin(T.step * Math.PI) * .025 * Math.min(1, sp / 2);
      if (sp > .4 && Math.floor(T.step) !== T._lastStep) { T._lastStep = Math.floor(T.step); host.splash(); }
      cam.position.set(T.pos.x, 1.65 + bob, T.pos.z); e.set(T.pitch, T.yaw, 0); cam.quaternion.setFromEuler(e);
    }
    // glide to / from the terminal
    const G = T.glide; G.k = Math.max(0, Math.min(1, G.k + (G.on ? dt : -dt) * 2.2));
    if (G.k > 0) { const s = G.k * G.k * (3 - 2 * G.k); e.set(T.pitch, T.yaw, 0); q.setFromEuler(e); cam.position.set(T.pos.x, 1.65, T.pos.z).lerp(G.p, s); cam.quaternion.copy(q).slerp(G.q, s); }
    if (T.rehearse >= 0) { T.rehearse += dt / 3.2; if (T.rehearse >= 1) { T.rehearse = -1; lessonDone(0); } renderLesson(); }
    if (T.contact.anim >= 0) { const C = T.contact; C.anim += dt / 2.4; const k = Math.min(1, C.anim); C.t = C.t0 + (C.t1 - C.t0) * k; C.angle = C.a0 + (C.a1 - C.a0) * k; if (C.anim >= 1) C.anim = -1; renderLesson(); }
    if (T.preview) { T.preview.root.rotation.y += dt * .5; T.preview.r.render(T.preview.scene, T.preview.cam); }
    // prompt
    const d = cam.position.distanceTo(TERM); const look2 = new THREE.Vector3(); cam.getWorldDirection(look2);
    const facing = look2.dot(TERM.clone().sub(cam.position).normalize()) > .82;
    T.prompt = !T.term && d < 3.2 && facing ? (T.done.every(Boolean) ? "Begin the mission" : "Open the flight terminal") : "";
  };
  T.interact = () => {
    if (T.term) return closeTerminal();
    if (!T.prompt) return;
    if (T.done.every(Boolean)) return finish();
    openTerminal();
  };

  // ---- the terminal window (the game's holo panel)
  function openTerminal() {
    T.term = true; host.beep(1600, .03, .03, "square"); host.openWin("Flight training", "SIMULATION · FINAL ASSESSMENT", "✦");
    const n = new THREE.Vector3(T.pos.x - TERM.x, 0, T.pos.z - TERM.z).normalize(); T.glide.p.copy(TERM).addScaledVector(n, 1.55); T.glide.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(T.glide.p, TERM, new THREE.Vector3(0, 1, 0))); T.glide.on = true;
    if (!T.greeted) { T.greeted = true; host.say("mc", 1); }
    T.lesson = T.done.findIndex(x => !x); if (T.lesson < 0) T.lesson = 2; renderLesson();
  }
  function closeTerminal() { T.term = false; T.glide.on = false; host.closeWin(); disposePreview(); drawTerm(); }
  function lessonDone(i) {
    if (T.done[i]) return; T.done[i] = true; host.beep(880, .06, .05); host.beep(1320, .08, .04, "sine", .07); host.say("mc", 2 + i); drawTerm();
    if (T.done.every(Boolean)) { setTimeout(() => host.say("mc", 5), 4500); }
  }
  T.lessonDone = lessonDone;
  function finish() { if (T.leaving) return; T.leaving = true; if (T.term) closeTerminal(); disposePreview(); T.onExit && T.onExit(); }
  T.finish = finish;

  function tabs() {
    return `<div class="hsteps tr-tabs">${["SHIP ORBIT", "RELAY WORKSHOP", "CONTACT WINDOW"].map((t, i) => `<div class="${T.done[i] ? "done" : ""} ${i === T.lesson ? "on" : ""}" data-l="${i}" style="cursor:pointer">${T.done[i] ? "✓" : i + 1} · ${t}</div>`).join("")}</div>`;
  }
  function bindTabs(b) { b.querySelectorAll(".tr-tabs div").forEach(d => d.onclick = () => { T.lesson = +d.dataset.l; host.beep(1200, .03, .03, "square"); renderLesson(); }); }
  function renderLesson() {
    const b = $("scrBody"); if (!T.term) return;
    if (T.lesson !== 1) disposePreview();
    if (T.lesson === 0) renderOrbit(b); else if (T.lesson === 1) renderRelay(b); else renderContact(b);
  }

  // ---- lesson 1: move the ship to a lower orbit for a sharper view, within the engine budget (Tom's inspection case)
  function renderOrbit(b) {
    const E = evaluateInspection(T.alt), P = E.transfer, R = MARS.radius, k = 95 / (R + 1000), r0 = (R + INSPECTION.startAltitudeKm) * k, r1 = (R + T.alt) * k, rp = R * k;
    let dot = ""; if (T.rehearse >= 0) { const s = transferState(P, P.coast * Math.min(1, T.rehearse)); dot = `<circle cx="${s.x * k}" cy="${-s.y * k}" r="4.5" class="trdot"/>`; }
    const a = P.a * k, bb = P.b * k, lower = T.alt < INSPECTION.startAltitudeKm;
    b.innerHTML = tabs() + `<div class="hnav"><div>
      <div class="hk">Position the ship</div><h3 class="trh">Closer reveals more detail.</h3>
      <p class="trp">You are in a ${INSPECTION.startAltitudeKm} km orbit. Pick a lower orbit to photograph the surface: aim for at least ${INSPECTION.minImageScale}× detail without using more than ${INSPECTION.maxDvMps} m/s of engine effort.</p>
      <div class="hk" style="margin-top:12px">Target height</div><div class="tralt">${T.alt} <small>km</small></div>
      <input type="range" id="trAlt" min="150" max="1000" step="10" value="${T.alt}" class="trrange">
      <div class="trchips">${[200, 300, 400, 1000].map(v => `<button type="button" class="htg trc${v === T.alt ? " on" : ""}" data-v="${v}">${v} km</button>`).join("")}</div>
    </div><div>
      <svg viewBox="-150 -115 300 230" class="horb" style="height:230px"><circle r="${rp}" fill="#5a4a3c" opacity=".85"/><circle r="${r0}" class="o" stroke-dasharray="4 4"/><circle r="${r1}" class="b" style="stroke-width:1.5"/>
        <ellipse cx="${(lower ? 1 : -1) * 0}" rx="${a}" ry="${bb}" class="t" transform="translate(${(lower ? -1 : 1) * P.e * a * (lower ? -1 : 1) * 0} 0)" opacity=".0"/>
        <path d="M ${r0} 0 A ${a} ${bb} 0 0 ${lower ? 1 : 0} ${-r1} 0" class="t"/>${dot}<circle cx="${r0}" r="4" fill="#5aa0e6"/><text x="${r0 + 6}" y="-8">Start ${INSPECTION.startAltitudeKm} km</text><text x="${-r1 - 6}" y="-8" text-anchor="end">Target ${T.alt} km</text></svg>
      <div class="hstats"><div><span class="hk">Engine effort</span><b class="${E.budgetOK ? "trok" : "trbad"}">${P.totalDv.toFixed(1)} m/s</b></div><div><span class="hk">Ground detail</span><b class="${E.detailOK ? "trok" : "trbad"}">${E.imageScale.toFixed(1)}×</b></div><div><span class="hk">Coast between burns</span><b>${formatDuration(P.coast)}</b></div></div>
      <div class="hsci"><div class="hk">Science · two burns</div><p>Burn 1 (${P.burn1.toFixed(1)} m/s) slows you onto an ellipse that dips to the new height; half an orbit later burn 2 (${P.burn2.toFixed(1)} m/s) makes the orbit circular again. Lower orbits are faster: one lap now takes ${(P.targetPeriod / 60).toFixed(1)} minutes.</p><code>v = √(μ/r)     T = 2π√(r³/μ)</code></div>
    </div></div>
    <div class="hfoot"><span class="hhint">${T.done[0] ? "Transfer rehearsed. Next: build a relay." : E.accepted ? "Both targets met. Rehearse the transfer." : !E.detailOK ? "Not enough detail yet: go lower." : "Too much engine effort: don't go that low."}</span><button type="button" class="hbtn" id="trGo" ${E.accepted && T.rehearse < 0 ? "" : "disabled"}>${T.done[0] ? "REHEARSE AGAIN" : "REHEARSE TRANSFER"}</button></div>`;
    bindTabs(b);
    $("trAlt").oninput = ev => { T.alt = +ev.target.value; renderLesson(); };
    b.querySelectorAll(".trc").forEach(c => c.onclick = () => { T.alt = +c.dataset.v; host.beep(1100, .02, .03, "square"); renderLesson(); });
    $("trGo").onclick = () => { T.rehearse = 0; host.noise(80, 400, .8, .05, 1); };
  }

  // ---- lesson 2: relay workshop (Tom's design model): fit within credits and mass, keep 20% battery through every shadow
  const OPT = { panels: [[0, "None"], [2, "2 panels"], [4, "4 panels"]], panelSize: [["small", "Small"], ["large", "Large"]], batteries: [[0, "None"], [1, "1 cell"], [2, "2 cells"]],
    computers: [[0, "None"], [1, "Primary"], [2, "+ Backup"]], attitude: [[false, "Off"], [true, "On"]], radio: [["off", "Off"], ["listen", "Listen"], ["relay", "Relay"]], duty: [["brief", "Short"], ["archive", "Full archive"]] };
  const OPT_NAME = { panels: "Solar panels", panelSize: "Panel size", batteries: "Battery", computers: "Flight computer", attitude: "Pointing control", radio: "Radio", duty: "Packets per pass" };
  function renderRelay(b) {
    const A = assessDesign(T.design, 300, T.scenario), c = A.configuration, cap = Math.max(A.capacityWh, 1e-6), lowPct = A.capacityWh ? A.minWh / A.capacityWh * 100 : 0;
    const rows = Object.keys(OPT).map(k => `<div class="trrow"><span>${OPT_NAME[k]}</span><div>${OPT[k].map(([v, l]) => `<button type="button" class="htg tro${c[k] === v ? " on" : ""}" data-k="${k}" data-v="${String(v)}">${l}</button>`).join("")}</div></div>`).join("");
    const S = A.samples, tmax = S[S.length - 1].time, W = 300, H = 90, pts = S.map(s => `${(s.time / tmax * W).toFixed(1)},${(H - (A.capacityWh ? s.energyWh / cap : 0) * H).toFixed(1)}`).join(" ");
    let shade = "", prev = null; for (const s of S) { if (!s.sun && prev && prev.sun !== s.sun) shade += `<rect x="${prev.time / tmax * W}" y="0" width="${A.eclipseSeconds / tmax * W}" height="${H}" fill="rgba(95,227,255,.07)"/>`; prev = s; }
    b.innerHTML = tabs() + `<div class="trgrid"><div><div class="hk">Build a relay that survives six passes</div><div class="trrows">${rows}</div>
        <div class="hk" style="margin-top:8px">What if something fails?</div><div class="trchips">${[["nominal", "Normal"], ["panel_loss", "Lose a panel"], ["computer_loss", "Lose the computer"]].map(([v, l]) => `<button type="button" class="htg trs${T.scenario === v ? " on" : ""}" data-v="${v}">${l}</button>`).join("")}</div></div>
      <div><div class="trprev" id="trPrev"></div>
        <div class="hstats"><div><span class="hk">Credits</span><b class="${A.budgetOK ? "trok" : "trbad"}">${A.cost} / ${WORKSHOP.budget}</b></div><div><span class="hk">Mass</span><b class="${A.massOK ? "trok" : "trbad"}">${A.massKg.toFixed(2)} kg</b></div><div><span class="hk">Lowest battery</span><b class="${A.energyOK ? "trok" : "trbad"}">${Math.round(lowPct)}%</b></div></div>
        <svg viewBox="0 -6 300 104" class="trchart">${shade}<line x1="0" x2="300" y1="${H * .8}" y2="${H * .8}" stroke="#ffb347" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="#5fe3ff" stroke-width="2"/><text x="2" y="${H * .8 - 3}" style="font-size:9px">20% reserve</text></svg>
        <div class="trrep">Reports delivered <b>${A.deliveredPasses} / ${CASE.passes}</b> · ${A.dataMbits.toFixed(1)} Mbit</div></div></div>
      <div class="hfoot"><span class="hhint ${A.problems.length ? "trbadT" : ""}">${A.problems[0] || (A.missionReady ? (T.scenario === "nominal" ? "Design passes: every report delivered, battery never below 20%." : "Even with this failure, every report gets through.") : "")}</span>
        <button type="button" class="hbtn" id="trTest" ${A.missionReady && T.scenario === "nominal" && !T.done[1] ? "" : "disabled"}>${T.done[1] ? "DESIGN APPROVED ✓" : "APPROVE DESIGN"}</button></div>`;
    bindTabs(b);
    b.querySelectorAll(".tro").forEach(btn => btn.onclick = () => { const k = btn.dataset.k, v0 = btn.dataset.v; T.design[k] = v0 === "true" ? true : v0 === "false" ? false : isNaN(+v0) ? v0 : +v0; host.beep(1100, .02, .03, "square"); renderLesson(); });
    b.querySelectorAll(".trs").forEach(btn => btn.onclick = () => { T.scenario = btn.dataset.v; renderLesson(); });
    $("trTest").onclick = () => lessonDone(1);
    buildPreview($("trPrev"), c);
  }
  function buildPreview(box, c) {
    if (!T.preview) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xdff4ff, 0x203038, 1.4)); const k = new THREE.DirectionalLight(0xffffff, 1.6); k.position.set(1, 2, 2); sc.add(k);
      if (scene.environment) sc.environment = scene.environment;
      const cm = new THREE.PerspectiveCamera(32, 1, .01, 10); cm.position.set(.55, .25, .75); cm.lookAt(0, 0, 0);
      T.preview = { r, scene: sc, cam: cm, root: new THREE.Group(), key: "" }; sc.add(T.preview.root);
    }
    const P = T.preview; if (!P.r.domElement.isConnected) box.appendChild(P.r.domElement);
    const w = box.clientWidth || 300, h = box.clientHeight || 180; P.r.setSize(w, h, false); P.r.domElement.style.width = "100%"; P.r.domElement.style.height = "100%"; P.cam.aspect = w / h; P.cam.updateProjectionMatrix();
    const key = JSON.stringify(c); if (P.key === key) return; P.key = key;
    P.root.clear(); P.root.add(createChassis());
    const ids = [c.panels ? "solar" : null, c.batteries ? "battery" : null, c.computers ? "computer" : null, c.attitude ? "attitude" : null, c.radio !== "off" ? "relay" : null].filter(Boolean);
    for (const id of ids) { const m = createHardware(id, c); m.position.copy(slotPosition(id)); if (id === "solar") foldArrays(m, 0); P.root.add(m); }
  }
  function disposePreview() { if (!T.preview) return; T.preview.r.domElement.remove(); }

  // ---- lesson 3: contact window (Tom's geometry): wait until the relay is above the station's horizon, then send
  function renderContact(b) {
    const C = T.contact, alt = 300, om = 2 * Math.PI / MARS.rotationSeconds, sAng = om * C.t, G = contactGeometry(alt, C.angle, sAng), R = MARS.radius, k = 90 / (R + alt * 3);
    const st = [Math.cos(sAng) * R * k, -Math.sin(sAng) * R * k], sat = [Math.cos(C.angle) * (R + alt * 3) * k, -Math.sin(C.angle) * (R + alt * 3) * k];
    const ok = G.visible && G.elevation > 5;
    b.innerHTML = tabs() + `<div class="hnav"><div><div class="hk">Catch a contact window</div><h3 class="trh">Only above the horizon.</h3>
        <p class="trp">The relay can only hear the ground station while it is above that station's horizon. Wait for the next pass, then send the practice packet while the line of sight is clear.</p>
        <div class="hstats" style="grid-template-columns:1fr 1fr"><div><span class="hk">Elevation</span><b class="${ok ? "trok" : "trbad"}">${G.elevation.toFixed(0)}°</b></div><div><span class="hk">Range</span><b>${Math.round(G.range)} km</b></div></div>
        <div class="hk" style="margin-top:10px">Mission clock</div><div class="tralt" style="font-size:22px">${formatDuration(C.t)}</div></div>
      <div><svg viewBox="-120 -120 240 240" class="horb" style="height:240px"><circle r="${R * k}" fill="#5a4a3c" opacity=".85"/><circle r="${(R + alt * 3) * k}" class="o"/>
        <line x1="${st[0]}" y1="${st[1]}" x2="${sat[0]}" y2="${sat[1]}" stroke="${G.visible ? "#6dffb0" : "#ff5a6a"}" stroke-dasharray="${G.visible ? "0" : "4 4"}" stroke-width="1.6"/>
        <circle cx="${st[0]}" cy="${st[1]}" r="4" fill="#ffb347"/><circle cx="${sat[0]}" cy="${sat[1]}" r="4.5" fill="#5fe3ff"/><text x="${st[0] + 6}" y="${st[1] + 12}">station</text><text x="${sat[0] + 6}" y="${sat[1] - 6}">relay</text></svg>
        <div class="hsci"><div class="hk">Science · line of sight</div><p>A radio link needs a clear straight line. The planet blocks it whenever the relay is below the station's horizon; both the relay's orbit and the planet's spin move the window.</p></div></div></div>
      <div class="hfoot"><span class="hhint">${C.sent ? "Packet received. Training complete." : ok ? "Line of sight is clear: send it." : "Out of view: wait for the next pass."}</span>
        <div><button type="button" class="hbtn" id="trWait" ${C.anim >= 0 || ok ? "disabled" : ""}>WAIT FOR NEXT PASS</button> <button type="button" class="hbtn" id="trSend" ${ok && !C.sent ? "" : "disabled"}>SEND PACKET</button></div></div>`;
    bindTabs(b);
    $("trWait").onclick = () => { const n = nextContactOpportunity(alt, C.angle, C.t); Object.assign(C, { t0: C.t, t1: n.missionSeconds, a0: C.angle, a1: n.orbitalAngle, anim: 0 }); host.beep(700, .1, .04); };
    $("trSend").onclick = () => { C.sent = true; host.beep(1800, .04, .04, "square"); host.noise(4000, 2000, .3, .04, 3); lessonDone(2); };
  }
  return T;
}
