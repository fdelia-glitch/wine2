// Procedural animation for the family rigs (identity rest rotations, so rest bone directions come from child offsets).
// HumanRig: idle / walk / run / sprint blend, jump, fall, land, climb, push, interact, celebrate, talk, look-at, blinking.
// DogRig: walk / trot / gallop (zoomies), sit, sniff, bark, pant, tail wag, springy ears.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const _q = Q(), _q2 = Q(), _v = V(), _v2 = V(), _m = new THREE.Matrix4();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class Spring { constructor(k = 60, d = 9) { this.x = 0; this.v = 0; this.k = k; this.d = d; }
  step(target, dt) { const a = (target - this.x) * this.k - this.v * this.d; this.v += a * dt; this.x += this.v * dt; return this.x; } }

class RigBase {
  constructor(root) {
    this.root = root;
    this.bones = {};
    root.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.rest = {};
    for (const [n, b] of Object.entries(this.bones)) this.rest[n] = b.position.clone();
    this.morphMeshes = [];
    root.traverse(o => { if (o.morphTargetDictionary) this.morphMeshes.push(o); });
    this.t = 0;
  }
  b(n) { return this.bones[n]; }
  // model-space rotation of a bone's parent (the root object is the model frame)
  parentModelQuat(bone, out) {
    out.identity();
    const chain = [];
    let p = bone.parent;
    while (p && p !== this.root) { chain.push(p); p = p.parent; }
    for (let i = chain.length - 1; i >= 0; i--) out.multiply(chain[i].quaternion);
    return out;
  }
  modelPos(bone, out) {
    // accumulate transforms from the root down (positions in the model frame)
    const chain = [];
    let p = bone;
    while (p && p !== this.root) { chain.push(p); p = p.parent; }
    out.set(0, 0, 0); const q = _q2.identity();
    for (let i = chain.length - 1; i >= 0; i--) {
      _v.copy(chain[i].position).applyQuaternion(q); out.add(_v); q.multiply(chain[i].quaternion);
    }
    return out;
  }
  restDir(name, child) { return this.rest[child].clone().normalize(); }
  // point bone `name` (whose child is `child`) along model-space direction `dir`, with optional twist about it
  aim(name, child, dir, twist = 0) {
    const bone = this.bones[name]; if (!bone) return;
    const rd = this.restDir(name, child);
    const qw = Q().setFromUnitVectors(rd, _v2.copy(dir).normalize());
    if (twist) qw.premultiply(Q().setFromAxisAngle(_v2, twist));
    const pq = this.parentModelQuat(bone, Q());
    bone.quaternion.copy(pq.invert().multiply(qw));
  }
  // set a bone's model-space orientation directly
  orient(name, qModel) {
    const bone = this.bones[name]; if (!bone) return;
    const pq = this.parentModelQuat(bone, Q());
    bone.quaternion.copy(pq.invert().multiply(qModel));
  }
  local(name, x, y, z, order = 'XYZ') { const b = this.bones[name]; if (b) b.quaternion.setFromEuler(new THREE.Euler(x, y, z, order)); }
  morph(name, v) {
    for (const m of this.morphMeshes) { const i = m.morphTargetDictionary[name]; if (i !== undefined) m.morphTargetInfluences[i] = v; }
  }
  // analytic two-bone IK in the model frame
  ik(upper, lower, end, target, pole) {
    const A = this.modelPos(this.bones[upper], V());
    const la = this.rest[lower].length(), lb = this.rest[end].length();
    const T = target.clone();
    const d = clamp(T.distanceTo(A), Math.abs(la - lb) + 1e-3, la + lb - 1e-3);
    const dir = T.clone().sub(A).normalize();
    const cosA = (la * la + d * d - lb * lb) / (2 * la * d);
    const ang = Math.acos(clamp(cosA, -1, 1));
    const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const K = A.clone().add(dir.clone().multiplyScalar(Math.cos(ang) * la)).add(side.multiplyScalar(Math.sin(ang) * la));
    const Tc = A.clone().add(dir.multiplyScalar(d));
    this.aim(upper, lower, K.clone().sub(A));
    this.aim(lower, end, Tc.sub(K));
  }
}

export class HumanRig extends RigBase {
  constructor(root, opts = {}) {
    super(root);
    this.o = opts;
    this.phase = 0; this.blink = 0; this.nextBlink = 2; this.talkT = 0;
    this.land = new Spring(90, 12); this.lean = 0; this.bank = 0; this.look = V(0, 0, 1); this.lookW = 0;
    this.expr = {}; this.cel = 0; this.armCur = {}; this.bendCur = {};
    const H = (n) => this.modelPos(this.bones[n], V());
    this.hip0 = H('hips').y;
    this.legLen = this.rest['shin_L'].length() + this.rest['foot_L'].length();
    this.footRest = { L: H('foot_L'), R: H('foot_R') };
    this.shoulderW = Math.abs(H('upperarm_L').x);
    this.scale = this.hip0 / 0.95;
  }

  update(dt, s) {
    this.t += dt;
    const sp = s.speed || 0;                 // horizontal speed m/s
    const run = sstep(2.2, 5.2, sp), sprint = sstep(6.2, 8.5, sp);
    const moving = sstep(0.15, 0.8, sp);
    const cadence = lerp(1.7, 2.9, run) + sprint * 0.5;
    this.phase += dt * cadence * Math.PI * (0.45 + 0.55 * moving) * (sp > 0.05 ? 1 : 0.2);
    const ph = this.phase;
    const air = s.grounded === false;
    const k = this.scale;
    // landing squash spring
    if (s.landed) this.land.v -= clamp(s.landed, 0, 14) * 0.9;
    const sq = this.land.step(0, dt);
    this.lean = damp(this.lean, clamp(sp * 0.035 + sprint * 0.12, 0, 0.35) * (air ? 0.4 : 1), 8, dt);
    this.bank = damp(this.bank, clamp(-(s.turn || 0) * sp * 0.03, -0.25, 0.25), 6, dt);
    const breath = Math.sin(this.t * 1.6) * 0.012;

    // ---- hips / spine ----
    const stride = lerp(0.28, 0.55, run) * k * moving + sprint * 0.12 * k;
    const bob = (Math.abs(Math.sin(ph)) - 0.5) * lerp(0.025, 0.06, run) * moving * k;
    const crouch = (s.crouch || 0) * 0.25 * k + (s.hipDrop || 0) * k;
    const hipY = this.rest['hips'].y + bob + sq * 0.12 * k - crouch - lerp(0, 0.05, run) * k;
    const hips = this.bones['hips'];
    hips.position.set(this.rest['hips'].x + Math.sin(ph) * 0.02 * moving * k, hipY, this.rest['hips'].z);
    hips.quaternion.setFromEuler(new THREE.Euler(this.lean * 0.4, Math.sin(ph) * 0.18 * moving, this.bank + Math.sin(ph) * 0.04 * moving));
    const spineTwist = -Math.sin(ph) * 0.22 * moving;
    this.local('spine1', this.lean * 0.4 + breath * 0.3 - sq * 0.4, spineTwist * 0.4, -this.bank * 0.3);
    this.local('spine2', this.lean * 0.3 + breath, spineTwist * 0.3, 0);
    this.local('chest', this.lean * 0.2 + breath * 1.5 - (s.celebrate ? 0.15 : 0), spineTwist * 0.3, 0);

    // ---- legs ----
    for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
      const p = ph + off;
      const rest = this.footRest[side];
      let fx = rest.x * 0.92, fz = rest.z, fy = rest.y;
      if (air) {
        const up = clamp(-(s.vy || 0) * 0.02, -0.15, 0.15);
        fz += (side === 'L' ? 0.12 : -0.08) * k; fy += (0.18 + up) * k * (side === 'L' ? 1 : 0.6);
      } else if (moving > 0.01) {
        fz += Math.cos(p) * stride * 0.5 * moving;
        fy += Math.max(0, Math.sin(p)) * lerp(0.08, 0.22, run) * k * moving;
      }
      fy -= crouch * 0.1;
      if (s.legPose && s.legPose[side]) { const [ox, oy, oz] = s.legPose[side]; fx += ox * (side === 'L' ? 1 : -1) * k; fy += oy * k; fz += oz * k; }
      const tgt = V(fx, air ? fy + hipY - this.rest['hips'].y : fy, fz);
      if (!air) tgt.y = Math.max(tgt.y, rest.y);
      this.ik('thigh_' + side, 'shin_' + side, 'foot_' + side, tgt, V(0, 0, 1));
      // feet stay flat, toe-off pitch while walking
      const pitch = air ? 0.35 : Math.sin(p) * 0.35 * moving * (Math.cos(p) < 0 ? 1 : 0.3);
      this.orient('foot_' + side, Q().setFromEuler(new THREE.Euler(pitch, 0, 0)));
    }

    // ---- arms ----
    const armDown = (side, swing, spread, bendAmt, fwd = 0) => {
      const sx = side === 'L' ? 1 : -1;
      const ua = V(sx * spread, -1, swing + fwd).normalize();
      this.aim('upperarm_' + side, 'forearm_' + side, ua);
      const fa = ua.clone().applyAxisAngle(V(1, 0, 0), -bendAmt).add(V(-sx * 0.08, 0, 0)).normalize();
      this.aim('forearm_' + side, 'hand_' + side, fa);
      this.aim('hand_' + side, 'middle1_' + side, fa.clone().add(V(0, 0, 0.05)).normalize());
    };
    const swingA = lerp(0.35, 0.9, run) * moving;
    for (const [side, off] of [['L', Math.PI], ['R', 0]]) {
      const p = ph + off;
      let swing = Math.cos(p) * swingA, bend = lerp(0.15, 1.4, run) * (0.5 + 0.5 * moving) + 0.12, spread = 0.16 + run * 0.12, fwd = 0;
      if (air) { swing = 0.2; spread = 0.7 + Math.min(0.4, Math.max(0, s.vy || 0) * 0.04); bend = 0.6; }
      if (s.action === 'push') { swing = 1.4; spread = 0.15; bend = 0.35; }
      if (s.action === 'interact') { swing = side === 'R' ? 1.1 : 0.1; bend = side === 'R' ? 0.5 : 0.2; }
      if (s.action === 'climb') { const c = Math.sin(this.t * 6 + off); swing = 0.3; spread = 0.25; fwd = 0; bend = 0.8; this.aim('upperarm_' + side, 'forearm_' + side, V((side === 'L' ? 1 : -1) * 0.3, 0.8 + c * 0.3, 0.5).normalize()); this.aim('forearm_' + side, 'hand_' + side, V(0, 0.6, 0.9).normalize()); continue; }
      if (s.celebrate || s.action === 'celebrate') { const c = Math.sin(this.t * 10 + off) * 0.2; this.aim('upperarm_' + side, 'forearm_' + side, V((side === 'L' ? 1 : -1) * 0.45, 1, 0.1 + c).normalize()); this.aim('forearm_' + side, 'hand_' + side, V((side === 'L' ? 1 : -1) * 0.2, 1, 0.2).normalize()); continue; }
      if (s.action === 'talk' && side === 'R') { swing = 0.45 + Math.sin(this.t * 3) * 0.2; bend = 1.2; }
      if (s.armPose && s.armPose[side]) {
        // explicit pose: model-space upper-arm direction (x mirrored per side) + elbow bend toward the front
        const [dx, dy, dz, bnd] = s.armPose[side]; const sx = side === 'L' ? 1 : -1;
        const want = V(dx * sx, dy, dz).normalize();
        const cur = this.armCur[side] || (this.armCur[side] = want.clone());
        cur.lerp(want, 1 - Math.exp(-14 * (s.dt || 1 / 60))).normalize();
        this.bendCur[side] = damp(this.bendCur[side] ?? bnd, bnd, 14, s.dt || 1 / 60);
        this.aim('upperarm_' + side, 'forearm_' + side, cur);
        const f = V(0, 0.35, 1).normalize(); let ax = cur.clone().cross(f); if (ax.lengthSq() < 1e-4) ax.set(1, 0, 0); ax.normalize();
        const fa = cur.clone().applyAxisAngle(ax, this.bendCur[side]);
        this.aim('forearm_' + side, 'hand_' + side, fa);
        this.aim('hand_' + side, 'middle1_' + side, fa);
        this.fingers(side, s.fist ? 1.2 : 0.35);
        continue;
      }
      this.armCur[side] = null; this.bendCur[side] = undefined;
      armDown(side, swing, spread, bend, fwd);
      this.fingers(side, air ? 0.2 : lerp(0.35, 0.8, run));
    }

    // ---- head, eyes, face ----
    const lookT = s.lookAt ? 1 : 0;
    this.lookW = damp(this.lookW, lookT, 4, dt);
    let yaw = 0, pitch = -this.lean * 0.6;
    if (s.lookAt) {
      const hp = this.modelPos(this.bones['head'], V());
      const d = s.lookAt.clone().sub(hp);
      yaw = clamp(Math.atan2(d.x, d.z), -1.1, 1.1); pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.5, 0.6);
    }
    yaw *= this.lookW; pitch = lerp(-this.lean * 0.6, pitch, this.lookW);
    this.local('neck', pitch * 0.4, yaw * 0.4 - spineTwist * 0.3, 0);
    this.local('head', pitch * 0.6 + Math.sin(this.t * 0.7) * 0.02, yaw * 0.6, Math.sin(this.t * 0.5) * 0.02);
    const eyeY = s.lookAt ? clamp(yaw * 0.3, -0.35, 0.35) : Math.sin(this.t * 0.37) * 0.08;
    this.local('eye_L', pitch * 0.2, eyeY, 0); this.local('eye_R', pitch * 0.2, eyeY, 0);

    // blinking
    this.nextBlink -= dt;
    if (this.nextBlink < 0) { this.blink = 0.16; this.nextBlink = 1.8 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt);
    const bl = this.blink > 0 ? Math.sin((1 - this.blink / 0.16) * Math.PI) : 0;
    // talking: jaw and lip shapes from a simple syllable oscillator
    let jaw = 0, lo = 0, le = 0;
    if (s.talking) {
      this.talkT += dt;
      const syl = Math.abs(Math.sin(this.talkT * 11.3)) * (0.55 + 0.45 * Math.sin(this.talkT * 3.1));
      jaw = syl * 0.45; lo = Math.max(0, Math.sin(this.talkT * 5.7)) * 0.4; le = Math.max(0, Math.cos(this.talkT * 7.9)) * 0.35;
    }
    const e = s.expression || 'neutral';
    const W = { smile: 0, grin: 0, browUp: 0, browDown: 0, browSad: 0, frown: 0, surprise: 0, squint: 0 };
    if (e === 'happy') { W.smile = 0.8; W.browUp = 0.2; }
    if (e === 'grin') { W.grin = 0.9; W.squint = 0.3; }
    if (e === 'surprised') { W.surprise = 0.8; }
    if (e === 'worried') { W.browSad = 0.8; W.frown = 0.3; }
    if (e === 'determined') { W.browDown = 0.6; W.smile = 0.2; }
    if (s.celebrate) { W.grin = 1; }
    for (const [k2, v] of Object.entries(W)) { this.expr[k2] = damp(this.expr[k2] || 0, v, 6, dt); this.morph(k2, this.expr[k2]); }
    this.morph('blinkL', Math.max(bl, this.expr.squint * 0.3)); this.morph('blinkR', Math.max(bl, this.expr.squint * 0.3));
    this.morph('jawOpen', jaw + (air && (s.vy || 0) > 4 ? 0.2 : 0)); this.morph('lipsO', lo); this.morph('lipsE', le);
  }

  fingers(side, curl) {
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      for (let i = 1; i <= 3; i++) this.local(`${f}${i}_${side}`, 0, 0, (side === 'L' ? -1 : 1) * curl * (i === 1 ? 0.5 : 0.8));
    }
    this.local(`thumb2_${side}`, 0, 0, (side === 'L' ? -1 : 1) * curl * 0.3);
  }
}

export class DogRig extends RigBase {
  constructor(root) {
    super(root);
    this.phase = 0;
    this.ears = { L: new Spring(55, 5), R: new Spring(55, 5) };
    this.tail = new Spring(40, 4); this.wag = 0; this.pant = 0;
    this.footRest = {};
    for (const n of ['fpaw_L', 'fpaw_R', 'hpaw_L', 'hpaw_R']) this.footRest[n] = this.modelPos(this.bones[n], V());
    this.prevHead = V();
  }
  update(dt, s) {
    this.t += dt;
    const sp = s.speed || 0;
    const trot = sstep(1.5, 3.5, sp), gallop = sstep(5.5, 8, sp);
    const moving = sstep(0.1, 0.6, sp);
    this.phase += dt * Math.PI * (lerp(2.2, 3.4, trot) + gallop * 1.2) * (sp > 0.05 ? 1 : 0);
    const ph = this.phase;
    const air = s.grounded === false;
    const act = s.action, u = s.u || 0;
    const sit = (act === 'sit' || act === 'beg' || act === 'howl') ? 1 : 0;
    this.sit = damp(this.sit || 0, sit, 6, dt);
    this.lie = damp(this.lie || 0, act === 'sleep' ? 1 : 0, 4, dt);
    this.dig = damp(this.dig || 0, act === 'dig' ? 1 : 0, 10, dt);
    this.beg = damp(this.beg || 0, act === 'beg' ? 1 : 0, 6, dt);
    const shake = act === 'shake' ? Math.sin(u * 45) * 0.45 * Math.max(0, 1 - u / 1.2) : 0;
    const hips = this.bones['hips'];
    const bob = Math.sin(ph * 2) * lerp(0.008, 0.03, trot) * moving + gallop * Math.sin(ph) * 0.03;
    hips.position.set(this.rest['hips'].x, this.rest['hips'].y + bob - this.sit * 0.18 - this.lie * 0.2 + this.dig * 0.03, this.rest['hips'].z - this.sit * 0.05);
    hips.quaternion.setFromEuler(new THREE.Euler(-this.sit * 0.55 - this.beg * 0.35 + this.dig * 0.12 + gallop * Math.sin(ph) * 0.12, 0, (s.turn || 0) * -0.05 * sp + shake));
    this.local('spine', gallop * Math.cos(ph) * 0.1 + this.sit * 0.15, Math.sin(ph) * 0.05 * moving, 0);
    this.local('chest', this.sit * 0.25 - gallop * Math.cos(ph) * 0.1, Math.sin(ph) * 0.05 * moving, 0);
    // legs: diagonal pairs for walk/trot, bound for gallop
    const legs = [['fpaw_L', 'fupper_L', 'flower_L', 0], ['fpaw_R', 'fupper_R', 'flower_R', Math.PI], ['hpaw_L', 'hupper_L', 'hlower_L', Math.PI], ['hpaw_R', 'hupper_R', 'hlower_R', 0]];
    const stride = lerp(0.1, 0.22, trot) + gallop * 0.12;
    for (const [paw, up, lo, off] of legs) {
      const front = paw[0] === 'f';
      let p = ph + (gallop > 0.5 ? (front ? 0 : Math.PI * 0.8) + (off ? 0.3 : 0) : off);
      const r = this.footRest[paw];
      const t = V(r.x, r.y, r.z);
      if (moving > 0.01) { t.z += Math.cos(p) * stride * moving; t.y += Math.max(0, Math.sin(p)) * lerp(0.05, 0.12, trot) * moving; }
      if (air) { t.z += front ? 0.12 : -0.14; t.y += 0.1; }
      if (front && this.dig > 0.01) { const sd = paw.endsWith('L') ? 0 : Math.PI; t.z += (0.06 + Math.sin(u * 30 + sd) * 0.07) * this.dig; t.y += Math.max(0, Math.cos(u * 30 + sd)) * 0.07 * this.dig; }
      if (front && this.beg > 0.01) { t.y += 0.16 * this.beg; t.z += 0.02 * this.beg; }
      if (this.lie > 0.01) { t.z = lerp(t.z, r.z + (front ? 0.12 : 0.1), this.lie); t.y = lerp(t.y, r.y + (front ? 0 : 0.02), this.lie); }
      if (!front && this.sit > 0.01) { t.z = lerp(t.z, r.z + 0.1, this.sit); t.y = lerp(t.y, r.y, this.sit); }
      if (this.beg < 0.01 || !front) t.y = Math.max(t.y, r.y);
      const hock = front ? null : 'hhock_' + paw.slice(-1);
      if (front) this.ik(up, lo, paw, t, V(0, 0, -1));
      else {
        // treat thigh + shin as the IK pair, keep the hock parallel to the upper leg for a dog-like zigzag
        this.ik(up, lo, hock, t.clone().add(V(0, 0.07, -0.03)), V(0, 0, 1));
        this.aim(hock, paw, t.clone().sub(this.modelPos(this.bones[hock], V())));
      }
    }
    // head: look/sniff/bark, tilt when curious
    const sniff = (act === 'sniff' ? 1 : 0) + this.dig * 0.8;
    const howl = act === 'howl' ? 1 : 0;
    this.howl = damp(this.howl || 0, howl, 5, dt);
    this.local('neck', -0.1 + sniff * 0.55 + gallop * 0.15 - this.howl * 0.8 + this.lie * 0.35, (s.lookYaw || 0) * 0.4, 0);
    this.local('head', sniff * 0.3 + Math.sin(this.t * 1.3) * 0.03 + (s.bark ? -0.2 : 0) - this.howl * 0.4, (s.lookYaw || 0) * 0.5, (s.tilt || 0) * 0.4 + Math.sin(this.t * 0.6) * 0.04 - shake * 1.2);
    const barkOpen = s.bark ? Math.max(0, Math.sin(this.t * 30)) : 0;
    this.pant = damp(this.pant, act === 'hold' || act === 'sleep' ? 0 : (sp > 2 || s.happy) ? 1 : 0.4, 3, dt);
    this.local('jaw', 0.12 * this.pant + Math.sin(this.t * 14) * 0.05 * this.pant + barkOpen * 0.4 + this.howl * 0.35, 0, 0);
    // springy ears driven by head acceleration
    const hp = this.modelPos(this.bones['head'], V());
    const vel = hp.clone().sub(this.prevHead).divideScalar(Math.max(dt, 1e-3)); this.prevHead.copy(hp);
    for (const sd of ['L', 'R']) {
      const e = this.ears[sd].step(clamp(-vel.y * 0.25 + sp * 0.04 + gallop * 0.5 + Math.abs(shake) * 2.5, -0.8, 1.4), dt);
      this.local('ear1_' + sd, -e * 0.6, 0, (sd === 'L' ? 1 : -1) * (e * 0.5 + barkOpen * 0.2));
      this.local('ear2_' + sd, -e * 0.4, 0, 0);
    }
    // tail: wag speed/amplitude from happiness, streams out when running
    const happy = act === 'sleep' ? 0 : (s.happy || this.dig > 0.5) ? 1 : 0.4;
    this.wag += dt * (8 + 10 * happy);
    const w = Math.sin(this.wag) * (0.35 + 0.35 * happy) * (1 - gallop * 0.6);
    const lift = this.tail.step(0.3 + happy * 0.3 - gallop * 0.4, dt);
    this.local('tail1', -lift, w * 0.5, 0); this.local('tail2', -0.2, w * 0.6, 0); this.local('tail3', -0.1, w * 0.7, 0); this.local('tail4', 0, w * 0.8, 0);
  }
}
