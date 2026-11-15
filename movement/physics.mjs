import { Vector3, Box3 } from 'three';

export const DEFAULTS = Object.freeze({
  reach: 0.95, armReach: 0.89, shoulderLean: 0.12, contactSlack: 0.055,
  impulse: 0.9, yankSoftSpeed: 3.2, pushOffImpulse: 4.5, strongMultiplier: 1.45,
  assistSpeed: 0.55, assistAcceleration: 0.55, drag: 0.003,
  maxSpeed: 5.5, cornerAssist: 2.4, brakeRate: 12, radius: 0.26,
  reachTime: 0.13, pullTime: 0.22, releaseTime: 0.18, recoveryTime: 0.18,
  pushOffCooldown: 0.55, pushOffSteeringLock: 0.45,
});
export const HEIGHT = 3.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

export function contactTangent(normal, basis, out = new Vector3()) {
  out.copy(basis.forward).addScaledVector(normal, -basis.forward.dot(normal));
  if (out.lengthSq() < .04) out.copy(basis.up).addScaledVector(normal, -basis.up.dot(normal));
  if (out.lengthSq() < .04) out.copy(basis.right).addScaledVector(normal, -basis.right.dot(normal));
  return out.normalize();
}

export function handReachTime(hand,config){return hand.reachDuration??config.reachTime;}

export function handContactBlend(hand, config) {
  const reach=handReachTime(hand,config);
  if (hand.state === 'reach' || hand.state === 'brace-reach') return smooth(hand.time / reach);
  if (hand.state === 'pull' || hand.state === 'brace') return 1;
  if (hand.state === 'release') return (hand.releaseStartBlend ?? 1) * (1 - smooth((hand.time - reach - config.pullTime) / config.releaseTime));
  if (hand.state === 'unplant') return (hand.releaseStartBlend ?? 1) * (1 - smooth(hand.time / config.releaseTime));
  return 0;
}

// Shared by animation and physics so an accepted anchor fits the actual arm.
export function contactWrist(anchor, basis, out = new Vector3()) {
  const tangent = anchor.tangent || contactTangent(anchor.normal, basis);
  return out.copy(anchor.point).addScaledVector(anchor.normal, .034).addScaledVector(tangent, -.065);
}

// A union of one-metre cells. Only its exposed boundary becomes a wall:
// doorways and intersections never contain overlapping room end caps.
export class LabWorld {
  constructor() {
    this.cells = new Set();
    const rect = (x0, x1, z0, z1) => {
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.cells.add(`${x},${z}`);
    };
    rect(0, 2, -17, 5);       // straight translation tunnel
    rect(-6, 8, -10, -8);    // crossing
    rect(-6, -4, -10, 2);    // return tunnel
    rect(-6, 2, 0, 2);       // loop connection
    rect(6, 8, -14, -6);     // short transfer bay
    this.surfaces = [];
    this.walls = [];
    this.solids = [];
    for (const key of this.cells) {
      const [x, z] = key.split(',').map(Number);
      this.addSurface('y', 0, x, x + 1, z, z + 1, [0, 1, 0], 'deck');
      this.addSurface('y', HEIGHT, x, x + 1, z, z + 1, [0, -1, 0], 'overhead');
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (this.cells.has(`${x + dx},${z + dz}`)) continue;
        const axis = dx ? 'x' : 'z';
        const value = dx ? x + (dx > 0 ? 1 : 0) : z + (dz > 0 ? 1 : 0);
        const t0 = dx ? z : x;
        const s = this.addSurface(axis, value, 0, HEIGHT, t0, t0 + 1, [-dx, 0, -dz], 'wall');
        this.walls.push(s);
        const min = dx ? new Vector3(Math.min(value,value+dx*.14), 0, z) : new Vector3(x, 0, Math.min(value,value+dz*.14));
        const max = dx ? new Vector3(Math.max(value,value+dx*.14), HEIGHT, z + 1) : new Vector3(x + 1, HEIGHT, Math.max(value,value+dz*.14));
        this.solids.push(new Box3(min, max));
      }
    }
  }
  addSurface(axis, value, a0, a1, b0, b1, normal, kind) {
    const s = { axis, value, a0, a1, b0, b1, normal: new Vector3(...normal), kind, id: this.surfaces.length };
    this.surfaces.push(s); return s;
  }
  closestPoint(s, p, out = new Vector3()) {
    if (s.axis === 'x') return out.set(s.value, clamp(p.y, s.a0 + .035, s.a1 - .035), clamp(p.z, s.b0 + .035, s.b1 - .035));
    if (s.axis === 'z') return out.set(clamp(p.x, s.b0 + .035, s.b1 - .035), clamp(p.y, s.a0 + .035, s.a1 - .035), s.value);
    return out.set(clamp(p.x, s.a0 + .035, s.a1 - .035), s.value, clamp(p.z, s.b0 + .035, s.b1 - .035));
  }
  contains(p, margin = 0) {
    if (p.y < margin || p.y > HEIGHT - margin) return false;
    return this.cells.has(`${Math.floor(p.x)},${Math.floor(p.z)}`);
  }
  nearestDistance(p) {
    let min = Infinity;
    const q = new Vector3();
    for (const s of this.surfaces) min = Math.min(min, this.closestPoint(s, p, q).distanceTo(p));
    return min;
  }
  // A close surface can still be behind a partition at a tunnel corner.
  // Slab intersection rejects that contact without relying on render meshes.
  segmentClear(from, to) {
    for (const box of this.solids) {
      let enter = 0, exit = 1, intersects = true;
      for (const axis of ['x', 'y', 'z']) {
        const delta = to[axis] - from[axis];
        if (Math.abs(delta) < 1e-9) {
          if (from[axis] < box.min[axis] || from[axis] > box.max[axis]) { intersects = false; break; }
        } else {
          let a = (box.min[axis] - from[axis]) / delta, b = (box.max[axis] - from[axis]) / delta;
          if (a > b) [a, b] = [b, a];
          enter = Math.max(enter, a); exit = Math.min(exit, b);
          if (enter > exit) { intersects = false; break; }
        }
      }
      if (intersects && exit > 1e-5 && enter < 1 - 1e-5) return false;
    }
    return true;
  }
  // Iterated sphere/box contacts plus fixed substeps prevent tunnelling.
  // Only velocity into a contact is removed; tangential momentum survives.
  collide(position, velocity, radius) {
    let impact = 0;
    const q = new Vector3(), d = new Vector3();
    for (let pass = 0; pass < 4; pass++) {
      let touched = false;
      for (const box of this.solids) {
        if (position.x < box.min.x - radius || position.x > box.max.x + radius || position.z < box.min.z - radius || position.z > box.max.z + radius) continue;
        box.clampPoint(position, q); d.subVectors(position, q);
        const len = d.length();
        if (len >= radius) continue;
        if (len < 1e-8) {
          const exits = [
            [position.x - box.min.x, new Vector3(-1, 0, 0)], [box.max.x - position.x, new Vector3(1, 0, 0)],
            [position.z - box.min.z, new Vector3(0, 0, -1)], [box.max.z - position.z, new Vector3(0, 0, 1)],
          ].sort((a, b) => a[0] - b[0]);
          d.copy(exits[0][1]); position.addScaledVector(d, radius + exits[0][0] + 1e-5);
        } else {
          d.multiplyScalar(1 / len); position.addScaledVector(d, radius - len + 1e-5);
        }
        const vn = velocity.dot(d);
        if (vn < 0) { impact = Math.max(impact, -vn); velocity.addScaledVector(d, -vn); }
        touched = true;
      }
      if (position.y < radius) { impact = Math.max(impact, -velocity.y); position.y = radius; velocity.y = Math.max(0, velocity.y); touched = true; }
      if (position.y > HEIGHT - radius) { impact = Math.max(impact, velocity.y); position.y = HEIGHT - radius; velocity.y = Math.min(0, velocity.y); touched = true; }
      if (!touched) break;
    }
    return impact;
  }
}

export class MovementController {
  constructor(world, options = {}) {
    this.world = world;
    this.config = { ...DEFAULTS, ...options };
    this.position = new Vector3(); this.velocity = new Vector3();
    this.motionIntent = new Vector3();
    this.events = []; this.hands = [-1, 1].map(side => ({ side, state: 'idle', time: 0, anchor: null, curl: .30 }));
    this.reset();
  }
  reset(position = new Vector3(.53, 1.58, 3.8)) {
    this.position.copy(position); this.velocity.set(0, 0, 0);
    this.hands.forEach(h => { h.state = 'idle'; h.time = 0; h.anchor = null; h.releaseStartBlend = 1; h.reachDuration=this.config.reachTime; });
    this.cooldown = 0; this.preferredSide = -1; this.stroke = null;
    this.stats = { distance: 0, strokes: 0, pushOffs: 0, peakSpeed: 0, time: 0 };
    this.events.length = 0; this.wallGap = this.world.nearestDistance(this.position);
    this.contacts = [null, null]; this.isBraced = false; this.autoBraced=false; this.contactRefresh = 0;
    this.contactMemory = 0; this.motionIntent.set(0,0,0);
    this.pushWasDown = false; this.pushOffCooldown = 0; this.pushOffLock = 0;
  }
  releaseAll() {
    this.stroke = null; this.isBraced = false;this.autoBraced=false;
    this.pushWasDown = false;
    for (const h of this.hands) { h.state = 'idle'; h.anchor = null; h.time = 0; }
  }
  shoulder(side, basis, anchor=null, blend=1) {
    const p=this.position.clone().addScaledVector(basis.right,side*.19).addScaledVector(basis.up,-.22).addScaledVector(basis.forward,-.015);
    if(anchor){const delta=contactWrist(anchor,basis).sub(p),distance=delta.length();
      const lean=Math.min(this.config.shoulderLean,Math.max(0,distance-this.config.armReach+.015))*blend;
      if(distance>0&&lean>0)p.addScaledVector(delta,lean/distance);
    }
    return p;
  }
  reachDuration(){return Math.max(.05,this.config.reachTime/(1+this.velocity.length()*.26));}
  findContact(side, basis, direction) {
    const shoulder = this.shoulder(side, basis);
    const reachDirection=direction.clone();
    // Catch ahead of existing drift before reversing it. Reaching behind a
    // fast-moving body would miss the wall before the hand could plant.
    if(this.velocity.lengthSq()>.16)reachDirection.multiplyScalar(.35).addScaledVector(this.velocity.clone().normalize(),.65).normalize();
    const leadDistance=.25+Math.min(.22,this.velocity.length()*.040);
    const probes=[shoulder,this.position,shoulder.clone().addScaledVector(reachDirection,.14),shoulder.clone().addScaledVector(reachDirection,leadDistance)];
    const fast=Math.min(1,this.velocity.length()/3);
    let best = null, score = Infinity;
    const point = new Vector3();
    for (const s of this.world.nearSurfaces?.(this.position,this.config.reach+.35,{basis})||this.world.surfaces) {
      // A side wall belongs to its near-side arm. Never reach the left arm
      // across the chest to animate a perfectly reachable right-hand wall.
      const lateralNormal = s.normal.dot(basis.right);
      if (Math.abs(lateralNormal) > .55 && side !== -Math.sign(lateralNormal)) continue;
      // Contact must be on the inward side of the hull, not through a partition.
      for(const probe of probes){
      this.world.closestPoint(s, probe, point);
      const cameraSide = this.position.clone().sub(point).dot(s.normal);
      if (cameraSide < .025 || cameraSide > this.config.reach+.005) continue;
      const distance = point.distanceTo(shoulder);
      if (point.distanceTo(this.position)>this.config.reach+.005)continue;
      const candidate={point:point.clone(),normal:s.normal.clone(),tangent:contactTangent(s.normal,basis),surfaceId:s.id,surface:s,kind:s.kind,side};
      const wrist=contactWrist(candidate,basis),reachedShoulder=this.shoulder(side,basis,candidate);
      if(wrist.distanceTo(reachedShoulder)>this.config.armReach-.002)continue;
      const toward = point.clone().sub(shoulder).normalize();
      // The left arm favours the left wall, but either hand may reach a valid surface.
      const sidePenalty = Math.max(0, -toward.dot(basis.right) * side) * .25;
      const behindPenalty = Math.max(0, -toward.dot(basis.forward)) * .18;
      const leadError=Math.abs(point.clone().sub(shoulder).dot(reachDirection)-leadDistance);
      const stable=this.contacts?.[side===-1?0:1]?.surfaceId===s.id?-.035:0;
      const cost=distance+sidePenalty+behindPenalty+fast*leadError*.9+stable;
      if (cost < score && this.world.segmentClear(shoulder,reachedShoulder)&&this.world.segmentClear(reachedShoulder,wrist)) {
        score = cost;
        best=candidate;
      }
      }
    }
    return best;
  }
  anchorReachable(h, basis) {
    if (!h.anchor) return false;
    if(this.world.isContactValid&&!this.world.isContactValid(h.anchor))return false;
    const base=this.shoulder(h.side,basis),shoulder=this.shoulder(h.side,basis,h.anchor),wrist=contactWrist(h.anchor,basis);
    return shoulder.distanceTo(wrist)<this.config.armReach+this.config.contactSlack&&this.position.distanceTo(h.anchor.point)<this.config.reach+this.config.contactSlack&&this.world.segmentClear(base,shoulder)&&this.world.segmentClear(shoulder,wrist);
  }
  beginStroke(basis, direction, strong, automatic = false) {
    const order = this.preferredSide < 0 ? [0, 1] : [1, 0];
    const options = [];
    for (const index of order) {
      if (!['idle','recover'].includes(this.hands[index].state)) continue;
      const anchor = this.findContact(this.hands[index].side, basis, direction);
      if (!anchor) continue;
      options.push({index,anchor,distance:this.shoulder(this.hands[index].side,basis).distanceTo(anchor.point)});
    }
    options.sort((a,b)=>a.distance-b.distance);
    for (const {index,anchor} of options) {
      const push = direction.clone();
      const intoWall = push.dot(anchor.normal);
      if (intoWall < 0) push.addScaledVector(anchor.normal, -intoWall);
      if (push.lengthSq() < .03) { if(automatic)continue; push.copy(anchor.normal); }
      push.normalize();
      const h = this.hands[index];
      h.state = 'reach'; h.time = 0; h.anchor = anchor; h.releaseStartBlend = 1;h.reachDuration=this.reachDuration();
      this.stroke = { index, direction: push, strong, automatic, started: false };
      this.preferredSide = -h.side;
      return true;
    }
    return false;
  }
  beginPushOff(basis) {
    const options=[];
    for(let index=0;index<this.hands.length;index++){
      const h=this.hands[index],planted=!!h.anchor&&handContactBlend(h,this.config)>.94&&this.anchorReachable(h,basis);
      const anchor=planted?h.anchor:this.findContact(h.side,basis,basis.forward);
      if(anchor)options.push({index,anchor,planted,distance:this.shoulder(h.side,basis).distanceTo(anchor.point)});
    }
    options.sort((a,b)=>a.distance-b.distance);
    if(!options.length)return false;
    const {index,anchor,planted}=options[0];
    // Keep an already planted palm in place. Other hands blend out instead of
    // snapping when C interrupts a yank or an RMB catch.
    for(let i=0;i<this.hands.length;i++)if(i!==index&&this.hands[i].anchor){
      const h=this.hands[i];h.releaseStartBlend=handContactBlend(h,this.config);h.state='unplant';h.time=0;
    }
    const h=this.hands[index];h.anchor=anchor;h.state='reach';h.reachDuration=this.reachDuration();h.time=planted?h.reachDuration:0;h.releaseStartBlend=1;
    this.stroke={index,direction:anchor.normal.clone(),strong:true,automatic:false,pushOff:true,started:false};
    this.isBraced=false;this.pushOffCooldown=this.config.pushOffCooldown;
    return true;
  }
  step(dt, input, basis) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    const cfg = this.config;
    this.stats.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.pushOffCooldown=Math.max(0,this.pushOffCooldown-dt);this.pushOffLock=Math.max(0,this.pushOffLock-dt);
    const pushPressed=!!input.pushOff&&!this.pushWasDown;this.pushWasDown=!!input.pushOff;
    if(pushPressed&&this.pushOffCooldown<=0)this.beginPushOff(basis);
    const direction = input.direction?.lengthSq() > .001 ? input.direction.clone().normalize() : basis.forward.clone();
    const moving = !!input.direction && input.direction.lengthSq() > .001;
    const driving=!this.stroke?.pushOff&&this.pushOffLock<=0;
    // A directly blocked approach plants and catches, instead of silently
    // refusing the wall or manufacturing a rebound. Hatch rims off to the
    // side do not trigger this straight-ahead catch.
    const frontCatch=input.auto&&moving&&this.contacts.some(a=>{if(!a?.normal||direction.dot(a.normal)>-.95)return false;const offset=a.point.clone().sub(this.position);return offset.addScaledVector(direction,-offset.dot(direction)).length()<.38;});
    const bracing=(!!input.brace||frontCatch)&&driving;this.autoBraced=!!frontCatch&&!input.brace&&bracing;
    this.motionIntent.copy(moving&&driving?direction:new Vector3());
    this.contactMemory=Math.max(0,this.contactMemory-dt);
    if(this.hands.some(h=>h.state==='pull'||h.state==='brace'))this.contactMemory=.55;

    // Gentle game assistance redirects existing momentum when entering a
    // bend. It preserves speed and does not manufacture an empty-air pull.
    if(input.auto&&moving&&driving&&!bracing&&cfg.assistSpeed>0&&cfg.cornerAssist>0){
      const speed=this.velocity.length(),near=this.contacts.some(Boolean)||this.wallGap<1.05||this.contactMemory>0;
      if(near&&speed>.08&&this.velocity.dot(direction)/speed>-.70){
        const target=direction.clone().multiplyScalar(speed);
        this.velocity.lerp(target,1-Math.exp(-cfg.cornerAssist*dt));
        if(this.velocity.lengthSq()>1e-8)this.velocity.setLength(speed);
      }
    }

    // Assisted translation is an explicit game aid, not propulsion from "swimming".
    // It never clamps existing coasting momentum to the much lower assist speed.
    if (moving && driving && cfg.assistSpeed > 0 && !bracing) {
      const along = this.velocity.dot(direction);
      const remaining = cfg.assistSpeed - along;
      if (remaining > 0) this.velocity.addScaledVector(direction, Math.min(remaining, cfg.assistAcceleration * dt));
    }

    if (bracing) {
      if (this.stroke) {
        const h = this.hands[this.stroke.index];
        // An already planted hand can catch immediately; do not jump back to
        // the idle pose or apply another pull while switching to the brake.
        if (h.state === 'pull') { h.state = 'brace'; h.time = handReachTime(h,cfg); }
        else if (h.state === 'reach') h.state = 'brace-reach';
        else { h.releaseStartBlend = handContactBlend(h,cfg); h.state = 'unplant'; h.time = 0; }
        this.stroke = null;
      }
      let planted = false;
      for (const h of this.hands) {
        if (h.state === 'unplant') continue;
        if (h.state !== 'brace' && h.state !== 'brace-reach') {
          const anchor = this.findContact(h.side, basis, direction);
          if (anchor) { h.anchor = anchor; h.state = 'brace-reach'; h.time = 0; h.reachDuration=this.reachDuration(); }
        }
        if (!this.anchorReachable(h, basis)) {
          if (h.anchor) { h.releaseStartBlend = handContactBlend(h,cfg); h.state = 'unplant'; h.time = 0; }
          else h.state = 'idle';
          continue;
        }
        h.time += dt;
        if (h.state === 'brace-reach' && h.time >= handReachTime(h,cfg)) {
          h.state = 'brace'; this.events.push({ type: 'catch', side: h.side });
        }
        if (h.state === 'brace') planted = true;
      }
      this.isBraced = planted;
      if (planted) this.velocity.multiplyScalar(Math.exp(-cfg.brakeRate * dt));
    } else {
      this.isBraced = false;
      for (const h of this.hands) if (h.state === 'brace' || h.state === 'brace-reach') {
        h.releaseStartBlend = handContactBlend(h,cfg); h.state = 'unplant'; h.time = 0;
      }
      if (driving && !this.stroke && (input.pull || (input.auto && moving)) && this.cooldown <= 0) {
        if(!this.beginStroke(basis,direction,input.strong,!!input.auto))this.cooldown=.04;
      }
    }

    if (this.stroke) {
      const stroke = this.stroke, h = this.hands[stroke.index];
      const reach=handReachTime(h,cfg);
      const previousTime = h.time;
      h.time += dt;
      if ((!this.anchorReachable(h, basis) || (stroke.automatic && !moving)) && h.state !== 'release') {
        h.releaseStartBlend = handContactBlend(h,cfg);
        h.state = 'release'; h.time = reach + cfg.pullTime;
      }
      const endPull = reach + cfg.pullTime;
      if (h.time >= reach && previousTime < endPull && h.state !== 'release') {
        if(stroke.pushOff){
          // One committed kick after planting, never continuous C thrust.
          // Cancel inward normal speed, then launch away while retaining the
          // existing tangential coast. Release the hand as the body departs.
          const inward=Math.min(0,this.velocity.dot(stroke.direction));
          this.velocity.addScaledVector(stroke.direction,cfg.pushOffImpulse-inward);
          stroke.started=true;this.stats.pushOffs++;this.pushOffLock=cfg.pushOffSteeringLock;
          this.events.push({type:'pushOff',side:h.side});
          h.state='release';h.releaseStartBlend=1;h.time=endPull;
        }else{
          h.state = 'pull';
          if (!stroke.started) {
            stroke.started=true;this.stats.strokes++;
            const along=Math.max(0,this.velocity.dot(stroke.direction)),soft=cfg.yankSoftSpeed;
            const scale=stroke.automatic&&soft>0?1/(1+Math.pow(along/soft,4)):1;
            stroke.impulseBudget=cfg.impulse*(stroke.strong?cfg.strongMultiplier:1)*scale;
            this.events.push({type:'grip',side:h.side,strong:stroke.strong});
          }
          // A short additive yank, integrated exactly over the contact phase.
          // No cruise target removes momentum earned by a previous stroke.
          const a = clamp((previousTime - reach) / cfg.pullTime, 0, 1);
          const b = clamp((h.time - reach) / cfg.pullTime, 0, 1);
          const integral = .5 * (Math.cos(a * Math.PI) - Math.cos(b * Math.PI));
          const boost=stroke.impulseBudget;
          this.velocity.addScaledVector(stroke.direction, boost * integral);
        }
      }
      if (h.time >= endPull) h.state = 'release';
      if (h.time >= endPull + cfg.releaseTime) {
        h.state = 'recover'; h.time = 0; h.anchor = null;
        this.stroke = null; this.cooldown = cfg.recoveryTime;
      }
    }
    for (const h of this.hands) {
      if (h.state === 'unplant') {
        h.time += dt;
        if (h.time >= cfg.releaseTime) { h.state = 'recover'; h.anchor = null; h.time = 0; }
      } else if (h.state === 'recover') { h.time += dt; if (h.time > .25) { h.state = 'idle'; h.time = 0; } }
    }

    this.velocity.multiplyScalar(Math.exp(-cfg.drag * dt));
    if (this.velocity.length() > cfg.maxSpeed) this.velocity.setLength(cfg.maxSpeed);
    const old = this.position.clone();
    let impact;
    if(this.world.moveBody)impact=this.world.moveBody(this.position,this.velocity,dt,cfg.radius,this.pushOffLock>0?{...cfg,cornerAssist:0}:cfg);
    else{this.position.addScaledVector(this.velocity,dt);impact=this.world.collide(this.position,this.velocity,cfg.radius);}
    if (impact > .35 && this.cooldown <= 0) { this.events.push({ type: 'impact', speed: impact }); this.cooldown = .09; }
    this.stats.distance += old.distanceTo(this.position);
    this.stats.peakSpeed = Math.max(this.stats.peakSpeed, this.velocity.length());

    // Refresh proximity at 20 Hz; all contact forces are still checked per step.
    this.contactRefresh -= dt;
    if (this.contactRefresh <= 0) {
      this.contacts = this.hands.map(h => this.findContact(h.side, basis, direction));
      this.wallGap = this.world.nearestDistance(this.position);
      this.contactRefresh = .05;
    }
  }
}
