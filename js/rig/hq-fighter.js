// HQ fighter renderer: hierarchical skeleton (core.js) → smooth tapered-capsule body with rounded joints and light muscle
// shaping, neon rim light, coat + scarf on spring (verlet) cloth, blade on a two-bone-IK hand, planted feet (world-locked
// IK targets with procedural stepping: stride follows speed, no foot sliding), keyframed clips with easing + crossfades,
// secondary motion (hips lead / chest lags, head lag, hit recoil springs, landing squash), direction-aware hit reactions,
// sub-frame weapon trail that follows the real blade arc. Same public API as StickFighter (setClass / update / flash /
// visible / joints) plus onHit(e) and takeSwingCue(f). Per-class look + animation comes from a profile (rig/sword.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { solve, evalClip, lerpPose, copyPose, spring, SK, EASE, RIG_SCALE } from './core.js';
import { Ribbon } from '../stickman.js';
import { CLASSES } from '../classes.js';
import { TUNE } from '../duel.js';
import { PROFILE as SWORD } from './sword.js';

export const HQ_PROFILES = { sword: SWORD };
const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2] || 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const col = (c, k = 1) => new THREE.Color(c).multiplyScalar(k);
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _t = new THREE.Vector3();

// ------------------------------------------------------------------ geometry + materials
/** tapered capsule along +Y from 0 (radius r0) to L (radius r1), with a soft muscle bulge centred at `at` (0..1) */
function taperGeo(L, r0, r1, bulge = 0, at = 0.35, seg = 14) {
  const pts = [], cap = 6, n = 10;
  for (let i = 0; i <= cap; i++) { const a = -Math.PI / 2 + (i / cap) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
  for (let i = 1; i < n; i++) { const u = i / n, r = r0 + (r1 - r0) * u + bulge * Math.exp(-(((u - at) / 0.26) ** 2)); pts.push(new THREE.Vector2(r, u * L)); }
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r1, L + Math.sin(a) * r1)); }
  pts[0].x = 0; pts[pts.length - 1].x = 0;
  return new THREE.LatheGeometry(pts, seg);
}
/** lathe from a list of [radius, y] (closed at both ends) */
const latheGeo = (prof, seg = 18) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/** lit material with a fresnel neon rim (keeps the glowing stick-figure read while the body has real volume) */
function neonMat(opts, rim, rimK) {
  const m = new THREE.MeshStandardMaterial(opts);
  m.userData.rim = { value: col(rim, rimK) }; m.userData.rimBase = col(rim, rimK);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = m.userData.rim;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\n  totalEmissiveRadiance += uRim * (pow(rimF, 2.4) * 1.15);');
  };
  m.customProgramCacheKey = () => 'nsd-neonrim';
  return m;
}

// ------------------------------------------------------------------ weapon trail that follows the actual blade arc
class ArcTrail {
  constructor(scene, max = 72) {
    this.max = max; this.s = []; this.life = 0.13;
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(max * 2 * 3); this.al = new Float32Array(max * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uC: { value: new THREE.Color(1, 1, 1) }, uO: { value: 0.85 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uO; varying float vA; void main(){ vec3 c = mix(uC, vec3(1.0), smoothstep(0.75, 1.0, vA) * 0.6); gl_FragColor = vec4(c * vA * uO, 1.0); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; scene.add(this.mesh);
  }
  setColor(c) { this.mat.uniforms.uC.value.copy(c); }
  /** samples: [{ b, t }] oldest → newest, all from this frame */
  update(dt, samples) {
    for (const s of this.s) s.age += dt;
    for (let i = 0; i < samples.length; i++) this.s.unshift({ b: samples[i].b.clone(), t: samples[i].t.clone(), age: (samples.length - 1 - i) / Math.max(1, samples.length) * dt });
    while (this.s.length > this.max || (this.s.length && this.s[this.s.length - 1].age > this.life)) this.s.pop();
    const m = this.s.length;
    for (let i = 0; i < this.max; i++) {
      const s = this.s[Math.min(i, m - 1)], k = i * 6;
      if (!s) { this.al[i * 2] = this.al[i * 2 + 1] = 0; continue; }
      this.pos[k] = s.b.x; this.pos[k + 1] = s.b.y; this.pos[k + 2] = s.b.z; this.pos[k + 3] = s.t.x; this.pos[k + 4] = s.t.y; this.pos[k + 5] = s.t.z;
      const a = i < m ? Math.max(0, 1 - s.age / this.life) ** 1.4 : 0; this.al[i * 2] = a * 0.08; this.al[i * 2 + 1] = a;
    }
    const g = this.mesh.geometry.attributes; g.position.needsUpdate = true; g.aA.needsUpdate = true;
    this.mesh.visible = m > 1;
  }
  clear() { this.s.length = 0; this.mesh.visible = false; }
}

// ------------------------------------------------------------------ fighter
export class HQFighter {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.rig = new THREE.Group(); this.group.add(this.rig);
    this.trail = new ArcTrail(scene); this.ribbons = []; this.parts = []; this.mesh = {};
    this.joints = {}; this.flashT = 0; this.yaw = 0; this.cls = null; this.vis = true;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring);
    this.shield = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.62, 6), new THREE.MeshBasicMaterial({ color: 0x9ffcff, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shield.add(new THREE.Mesh(new THREE.CircleGeometry(0.52, 6), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.shield.rotation.y = Math.PI / 2; scene.add(this.shield);
    this.resetAnim();
  }
  resetAnim() {
    this.id = ''; this.snap = null; this.kp = null; this.stT = 0; this.lastFt = 0; this.lastFacing = 0; this.turnT = 1;
    this.sp = { head: { x: 0, v: 0 }, tw: { x: 0, v: 0 }, rx: { x: 0, v: 0 }, rc: { x: 0, v: 0 }, rh: { x: 0, v: 0 }, sq: { x: 0, v: 0 }, bob: { x: 0, v: 0 } };
    this.feet = { F: { w: new THREE.Vector3(), planted: false, step: null }, B: { w: new THREE.Vector3(), planted: false, step: null } };
    this.hitN = 0; this.hitV = 'hitMid'; this.hitK = 1; this.hitAlt = 0; this.wasAir = false; this.landT = 1; this.prevVy = 0;
    this.lastFacingInit = false; this.cueSeq = -1; this.trailSeq = -1; this.prevT = 0; this.prevRoot = new THREE.Vector3(); this.lastTip = null; this.tipVel = new THREE.Vector3();
  }

  setClass(clsId, color = null, scale = 1) {
    const C = CLASSES[clsId], prof = HQ_PROFILES[clsId]; if (!C || !prof) return;
    if (this.cls === clsId && this.colorHex === (color ?? C.color) && this.scaleK === scale) return;
    this.disposeParts(); this.cls = clsId; this.C = C; this.prof = prof; this.colorHex = color ?? C.color; this.scaleK = scale; this.scale = 1.2 * RIG_SCALE * scale;
    this.keysCache = {}; this.resetAnim();
    const c = new THREE.Color(this.colorHex); this.c = c; this.trail.setColor(c.clone().lerp(new THREE.Color(1, 1, 1), 0.15));
    const M = this.m = {
      body: neonMat({ color: col(c, 0.32), emissive: c, emissiveIntensity: 0.42, roughness: 0.36, metalness: 0.35 }, c, 1.25),
      bodyB: neonMat({ color: col(c, 0.2), emissive: c, emissiveIntensity: 0.22, roughness: 0.42, metalness: 0.35 }, c, 0.8),
      cloth: neonMat({ color: C.cloth, emissive: C.cloth, emissiveIntensity: 0.5, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide }, c, 0.35),
      trim: new THREE.MeshStandardMaterial({ color: C.trim, emissive: C.trim, emissiveIntensity: 0.75, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: 0xd8e2ff, emissive: c, emissiveIntensity: 0.12, roughness: 0.2, metalness: 0.95 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x17131f, roughness: 0.5, metalness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: col(c, 1.5), toneMapped: false }),
      eye: new THREE.MeshBasicMaterial({ color: col(0xffffff, 1.3), toneMapped: false }),
      scarf: new THREE.MeshStandardMaterial({ color: col(c, 0.5), emissive: c, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }),
    };
    const add = (name, geo, mat) => { const m = new THREE.Mesh(geo, mat); this.rig.add(m); this.parts.push(m); this.mesh[name] = m; return m; };
    // torso: pelvis bowl, abdomen, rib cage (flattened front-to-back), neck, head + visor
    add('pelvis', latheGeo([[0, -0.1], [0.095, -0.085], [0.125, -0.02], [0.118, 0.05], [0.1, 0.1], [0, 0.11]]), M.body);
    add('abdomen', taperGeo(SK.lumbar, 0.098, 0.112, 0.004, 0.5), M.body);
    add('chest', latheGeo([[0, -0.03], [0.108, -0.01], [0.125, 0.08], [0.15, 0.2], [0.165, 0.28], [0.155, 0.335], [0.1, 0.375], [0, 0.385]]), M.body);
    add('neck', taperGeo(SK.neck + 0.04, 0.05, 0.042), M.body);
    add('head', new THREE.SphereGeometry(SK.headR, 26, 18), M.body);
    add('jaw', new THREE.SphereGeometry(SK.headR * 0.72, 18, 12), M.body);
    add('visor', new RoundedBoxGeometry(0.06, 0.05, 0.25, 2, 0.02), M.eye);
    // arms (near arm brighter, far arm dimmer like the classic rig) + deltoids + hands
    const ua = taperGeo(SK.ua, 0.062, 0.047, 0.012, 0.38), fa = taperGeo(SK.fa, 0.05, 0.036, 0.009, 0.25);
    add('uaF', ua, M.body); add('faF', fa, M.body); add('uaB', ua, M.bodyB); add('faB', fa, M.bodyB);
    const delt = new THREE.SphereGeometry(0.07, 14, 10); add('deltF', delt, M.body); add('deltB', delt, M.bodyB);
    const hand = new RoundedBoxGeometry(0.085, 0.105, 0.075, 2, 0.03); add('handF', hand, M.body); add('handB', hand, M.bodyB);
    // legs + feet
    const th = taperGeo(SK.th, 0.088, 0.058, 0.014, 0.3), sh = taperGeo(SK.sh, 0.058, 0.038, 0.012, 0.22);
    add('thF', th, M.body); add('shF', sh, M.body); add('thB', th, M.bodyB); add('shB', sh, M.bodyB);
    const foot = new RoundedBoxGeometry(SK.footL, 0.075, 0.105, 2, 0.03); add('footF', foot, M.dark); add('footB', foot, M.dark);
    const sole = new THREE.BoxGeometry(SK.footL * 0.9, 0.012, 0.09); add('soleF', sole, M.glow); add('soleB', sole, M.glow);
    // outfit: coat over the torso, flared skirt, collar, belt, spring tails + scarf
    const O = this.prof.outfit; this.coat = !!O.coat;
    if (O.coat) {
      add('coat', latheGeo([[0, -0.2], [0.14, -0.19], [0.15, 0.0], [0.142, 0.18], [0.172, 0.36], [0.182, 0.47], [0.15, 0.53], [0.08, 0.555]], 20), M.cloth);
      const sk = new THREE.CylinderGeometry(0.15, 0.2, 0.34, 20, 1, true); sk.translate(0, -0.17, 0); add('skirt', sk, M.cloth);
      add('skirtHem', new THREE.TorusGeometry(0.2, 0.014, 6, 24), M.trim);
      add('collar', new THREE.TorusGeometry(0.105, 0.03, 8, 22), M.trim);
      add('belt', new THREE.TorusGeometry(0.128, 0.022, 6, 22), M.trim);
      const s = this.scale;
      for (let i = 0; i < (O.tails || 2); i++) this.ribbons.push({ r: new Ribbon(this.scene, 6, 0.14 * s, 0.2 * s, M.cloth, { taper: 0.25, grav: 7, drag: 0.92 }), at: 'tail', z: i ? -0.06 : 0.06 });
    }
    if (O.scarf) { const s = this.scale; this.ribbons.push({ r: new Ribbon(this.scene, 7, 0.11 * s, 0.075 * s, M.scarf, { taper: 0.5, grav: 2.6, drag: 0.93 }), at: 'scarf', z: -0.04, wind: 2.0 }); add('scarfRing', new THREE.TorusGeometry(0.075, 0.032, 8, 20), M.trim); }
    // weapon: blade (local +Y = blade direction, origin at the grip)
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.24, 10), M.dark); handle.position.y = -0.06; g.add(handle);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.trim); pommel.position.y = -0.19; g.add(pommel);
    const guard = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.035, 0.06, 2, 0.012), M.trim); guard.position.y = 0.07; g.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.052, 1.0, 0.012), M.metal); blade.position.y = 0.59; g.add(blade);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.98, 0.017), M.glow); edge.position.set(0.028, 0.59, 0); g.add(edge);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.1, 4), M.metal); tip.position.y = 1.14; g.add(tip);
    this.rig.add(g); this.parts.push(g); this.blade = g;
    this.ring.material.color.copy(c);
    for (const rb of this.ribbons) rb.r.ok = false;
    this.visible = this.vis;
  }
  disposeParts() {
    for (const p of this.parts) this.rig.remove(p);
    this.parts = []; this.mesh = {}; for (const rb of this.ribbons) rb.r.dispose(this.scene); this.ribbons = [];
    if (this.m) for (const k in this.m) this.m[k].dispose();
    this.blade = null;
  }
  flash() { this.flashT = 0.11; }
  set visible(v) {
    this.vis = v; this.group.visible = v; this.shadow.visible = v; for (const rb of this.ribbons) rb.r.visible = v;
    if (!v) { this.trail.clear(); this.ring.visible = false; this.shield.visible = false; }
  }
  get visible() { return this.vis; }

  /** direction-aware hit reaction (called by main for every hit this fighter takes) */
  onHit(e) {
    const m = e.att && e.src && e.att.C.moves[e.src];
    const k = clamp(0.55 + (e.dmg || 40) / 140 + (e.kb || 1) / 12, 0.6, 1.35);
    let v = 'hitMid';
    if (e.back) v = 'hitBack';
    else if (e.heavy || (e.kb || 0) >= 2.4 || (e.dmg || 0) >= 58) v = 'stagger';
    else if (m && m.box && m.box[3] >= 1.95 && m.box[2] >= 0.45) { v = this.hitAlt ? 'hitMid' : 'hitHigh'; this.hitAlt ^= 1; }
    this.hitV = v; this.hitK = k; this.hitN++; this.lastHitSpike = !!e.spike;
    const dir = e.back ? -1 : 1;   // +1: pushed backwards
    this.sp.rx.v -= dir * 1.6 * k; this.sp.rc.v -= dir * 7 * k; this.sp.rh.v -= dir * (v === 'hitHigh' ? 16 : 9) * k;
    this.flash();
  }
  /** swing sound cue: the moment the blade starts accelerating (after the anticipation key), once per move */
  takeSwingCue(f) {
    if (f.st !== 'atk' || !f.mk || this.cueSeq === f.seq) return null;
    const m = this.C.moves[f.mk]; if (f.t < m.t[0] * 0.45) return null;
    this.cueSeq = f.seq; return m;
  }

  // ---------------------------------------------------------------- animation state machine → keyed pose
  stateOf(f) {
    if (f.st === 'atk' && f.mk) return 'atk:' + f.seq;
    if (f.st === 'jump') return f.djT < 0.42 ? 'flip' : 'jump';
    if (f.st === 'hit') return 'hit:' + this.hitN;
    if (f.st === 'ko') return f.y > 0.3 ? 'koAir' : 'ko';
    return f.st;
  }
  keysFor(f) {
    const k = f.mk; if (this.keysCache[k] !== undefined) return this.keysCache[k];
    return (this.keysCache[k] = this.prof.moveKeys(k, this.C.moves[k]) || null);
  }
  keyed(f, dt, t) {
    const Pz = this.prof.poses, st = this.stance = this.prof.stance;
    let id = this.stateOf(f);
    if (f.st === 'block' && id === this.id && f.t + 1e-6 < this.lastFt) id = 'block:' + Math.random();   // a new block restarts the clip
    if (id !== this.id) { this.snap = this.kp ? copyPose(this.kp) : copyPose(st); this.id = id; this.stT = 0; }
    else this.stT += dt;
    this.lastFt = f.t;
    const S = this.snap, T = this.stT, xf = (pose, dur, e = 'inOutSine') => lerpPose(S, pose, EASE[e](clamp(T / dur, 0, 1)), {}, true);
    let p, rrAdd = 0;
    switch (f.st) {
      case 'atk': {
        const keys = this.keysFor(f);
        p = keys ? evalClip(keys, f.t, S) : xf(st, 0.15);
        break;
      }
      case 'idle': {
        const w = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 2.6);   // slow weight shift between the feet + breath
        p = xf(lerpPose(st, Pz.idle1, w), 0.2); break;
      }
      case 'walk': {
        const fwd = Math.sign(f.vx) === f.facing;
        p = xf(fwd ? Pz.walk : Pz.walkBack, 0.12); break;
      }
      case 'guard': p = xf(Pz.guard, 0.08, 'outQuad'); break;
      case 'block': p = evalClip([{ t: 0, p: 'from' }, { t: 0.045, p: Pz.block, e: 'outQuad' }, { t: Math.max(0.2, f.stunT), p: Pz.guard, e: 'inOutSine' }], f.t, S); break;
      case 'jump': {
        if (f.djT < 0.42) {   // double-jump somersault
          p = xf(Pz.tuck, 0.08, 'outQuad'); const k = f.djT / 0.42; rrAdd = Math.PI * 2 * EASE.inOutSine(k);
          if (k > 0.8) p = lerpPose(p, Pz.fall, (k - 0.8) / 0.2);
        } else p = xf(lerpPose(Pz.fall, Pz.jump, clamp((f.vy + 3) / 9, 0, 1)), 0.12);
        break;
      }
      case 'dodge': {
        const fw = Math.sign(f.dodgeDir) === f.facing ? 1 : -1, k = clamp(f.t / TUNE.dodgeT, 0, 1);
        p = lerpPose(xf(Pz.dodge, 0.05, 'outQuad'), st, clamp((k - 0.75) / 0.25, 0, 1)); rrAdd = fw * Math.PI * 2 * EASE.inOutSine(k);
        break;
      }
      case 'hit': {
        const V0 = Pz[this.hitV] || Pz.hitMid, Vk = lerpPose(st, V0, this.hitK), Vr = lerpPose(st, V0, this.hitK * 0.7), su = Math.max(0.12, f.stunT || 0.3);
        p = evalClip([{ t: 0, p: 'from' }, { t: 0.05, p: Vk, e: 'outQuad' }, { t: su * 0.6, p: Vr, e: 'outSine' }, { t: su + 0.08, p: st, e: 'inOutSine' }], f.t, S);
        break;
      }
      case 'air': case 'koAir': {
        const base = this.lastHitSpike && f.vy < 0 ? Pz.spiked : Pz.airHit;
        p = xf(base, 0.08, 'outQuad'); if (base === Pz.airHit) p.rr = clamp(-0.9 + 0.045 * f.vy, -1.35, -0.35);
        break;
      }
      case 'ko': p = f.y > 0.3 ? xf(Pz.airHit, 0.1) : xf(Pz.ko, 0.22, 'outQuad'); break;
      case 'down': p = xf(Pz.down, 0.12, 'outQuad'); break;
      case 'rise': p = evalClip([{ t: 0, p: 'from' }, { t: 0.1, p: Pz.sit, e: 'outQuad' }, { t: 0.2, p: Pz.crouch, e: 'inOutSine' }, { t: TUNE.riseT + 0.06, p: st, e: 'outSine' }], f.t, S); break;
      case 'stun': p = xf(Pz.stun, 0.15); p.ch += Math.sin(t * 9) * 0.12; p.hd += Math.sin(t * 6.3) * 0.18; p.px += Math.sin(t * 4.1) * 0.03; break;
      case 'win': p = evalClip([{ t: 0, p: 'from' }, { t: 0.25, p: Pz.win0, e: 'outQuad' }, { t: 0.7, p: Pz.win, e: 'outBack' }], f.t, S); break;
      default: p = xf(st, 0.15);
    }
    this.kp = copyPose(p, this.kp || {});
    return { p, rrAdd };
  }

  // ---------------------------------------------------------------- planted feet (world-locked IK targets, procedural steps)
  footTargets(f, p, dt, grounded, baseY) {
    const s = this.scale, skid = Math.abs(f.vx) > 6, out = {};
    const walk = f.st === 'walk', atk = f.st === 'atk';
    const tol = walk ? 0.13 : atk ? 0.11 : f.st === 'hit' || f.st === 'block' || f.st === 'stun' ? 0.13 : 0.2;
    const dur = walk ? clamp(0.24 - Math.abs(f.vx) * 0.03, 0.13, 0.22) : atk ? 0.08 : 0.11;
    const lead = walk ? f.vx * dur * 0.6 : atk ? f.vx * 0.04 : f.vx * 0.05;
    const lift = walk ? 0.11 : atk ? 0.07 : 0.06;
    const gy = baseY + 0.075 * s;
    const want = {}, err = {};
    for (const side of ['F', 'B']) {
      const ft = this.feet[side], lx = p['f' + side + 'x'], ly = p['f' + side + 'y'];
      want[side] = grounded && !skid && Math.abs(p.rr) < 0.05 && ly <= SK.ankle + 0.03 && this.turnT >= 0.5;
      if (!want[side]) { ft.planted = false; ft.step = null; continue; }
      const wpos = this.rig.localToWorld(_t.set(lx, SK.ankle, 0)); const dx = wpos.x + lead;
      if (!ft.planted && !ft.step) { ft.w.set(wpos.x, gy, 0); ft.planted = true; }
      ft.target = dx; err[side] = Math.abs(dx - ft.w.x);
    }
    // one foot steps at a time (the one that lags most); the other stays planted
    const stepping = (this.feet.F.step ? 1 : 0) + (this.feet.B.step ? 1 : 0);
    if (!stepping) {
      const cand = ['F', 'B'].filter((q) => want[q] && this.feet[q].planted && err[q] > tol).sort((a, b) => err[b] - err[a]);
      if (cand.length) { const ft = this.feet[cand[0]]; ft.step = { k: 0, from: ft.w.x, dur, lift }; ft.planted = false; }
    }
    for (const side of ['F', 'B']) {
      const ft = this.feet[side]; if (!want[side]) { out[side] = null; continue; }
      if (ft.step) {
        ft.step.k += dt / ft.step.dur; const k = Math.min(1, ft.step.k), e = EASE.inOutSine(k);
        ft.w.set(ft.step.from + (ft.target - ft.step.from) * e, gy + Math.sin(Math.PI * k) * ft.step.lift * s, 0);
        if (k >= 1) { ft.step = null; ft.planted = true; ft.w.y = gy; }
      }
      const l = this.rig.worldToLocal(_t.copy(ft.w)); out[side] = [l.x, l.y, 0];
    }
    this.stepK = this.feet.F.step ? this.feet.F.step.k : this.feet.B.step ? this.feet.B.step.k : -1;
    return out;
  }

  // ---------------------------------------------------------------- per-frame update
  update(f, dt, t, baseY, frozen = false, shake = 0) {
    if (!this.C || !this.blade) return;
    const s = this.scale, rdt = frozen ? 0 : dt;
    // facing: fast eased turn (never a snap); feet re-step after the turn
    const yawT = f.facing > 0 ? 0 : Math.PI;
    if (this.lastFacing === 0) { this.yaw = yawT; this.lastFacing = f.facing; this.turnT = 1; }
    if (f.facing !== this.lastFacing) { this.lastFacing = f.facing; this.turnT = 0; this.yaw0 = this.yaw; }
    if (this.turnT < 1) { this.turnT = Math.min(1, this.turnT + rdt / 0.14); let d = yawT - this.yaw0; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw = this.yaw0 + d * EASE.inOutSine(this.turnT); }
    else this.yaw = yawT;
    this.group.position.set(f.x + (shake ? (Math.random() - 0.5) * shake : 0), baseY + f.y, 0);
    this.group.rotation.y = this.yaw;
    this.rig.scale.setScalar(s);
    const grounded = f.y <= 0.001;
    if (!frozen) {
      // landing squash + land pose blend
      if (this.wasAir && grounded) { this.sp.sq.v -= 1.4 * clamp(Math.abs(this.prevVy) / 12, 0.3, 1.2); this.landT = 0; }
      this.wasAir = !grounded; this.prevVy = f.vy; this.landT += dt;
    }
    let { p, rrAdd } = frozen && this.lastPose ? { p: copyPose(this.lastPose.p), rrAdd: this.lastPose.rrAdd } : this.keyed(f, rdt, t);
    if (!frozen) this.lastPose = { p: copyPose(p), rrAdd };
    // additive layers
    p = { ...p };
    if (this.landT < 0.2 && (f.st === 'idle' || f.st === 'walk' || f.st === 'guard')) p = lerpPose(p, this.prof.poses.land, Math.sin(Math.PI * Math.min(1, this.landT / 0.2)) * 0.7);
    if (this.turnT < 1) p = lerpPose(p, this.prof.poses.turn, Math.sin(Math.PI * this.turnT) * 0.6);
    const sp = this.sp;
    spring(sp.rx, 0, rdt, 13, 0.45); spring(sp.rc, 0, rdt, 15, 0.4); spring(sp.rh, 0, rdt, 18, 0.38); spring(sp.sq, 0, rdt, 15, 0.5);
    const bobT = f.st === 'walk' ? (this.stepK >= 0 ? 0.028 * Math.sin(Math.PI * this.stepK) - 0.018 : -0.022) : 0;
    spring(sp.bob, bobT, rdt, 24, 0.8);
    p.px += sp.rx.x; p.ch += sp.rc.x; p.hd += sp.rh.x; p.py += sp.sq.x + sp.bob.x;
    // secondary motion: chest twist lags the hips (hips lead the strike), head lags the chest
    const twT = p.tw + p.ctw; if (!this.lastFacingInit) { sp.tw.x = twT; sp.head.x = p.pt + p.sp + p.ch + p.hd; this.lastFacingInit = true; }
    spring(sp.tw, twT, rdt, 30, 0.85); p.ctw = sp.tw.x - p.tw;
    const aC = p.pt + p.sp + p.ch; spring(sp.head, aC + p.hd, rdt, 22, 0.7); p.hd = sp.head.x - aC;
    p.rr = (p.rr || 0) + rrAdd;
    // feet + solve
    const plants = this.footTargets(f, p, rdt, grounded, baseY);
    const J = solve(p, { plantF: plants.F, plantB: plants.B });
    // never sink into the floor while rolling / lying
    let lift = 0;
    if (grounded) { const lows = [J.head[1] - SK.headR, J.kneeF[1] - 0.06, J.kneeB[1] - 0.06, J.ankleF[1] - 0.075, J.ankleB[1] - 0.075, J.pelvis[1] - 0.1, J.handF[1] - 0.05, J.handB[1] - 0.05]; const lo = Math.min(...lows); if (lo < 0) lift = -lo; }
    this.rig.position.y = lift * s;
    this.place(J, p);
    this.group.updateMatrixWorld(true);
    // world joints for FX + contact points
    const W = (a) => this.rig.localToWorld(V(a));
    const tipW = W(J.tip), baseW = W(J.base);
    this.joints = { hip: W(J.pelvis), head: W(J.head), neck: W(J.neckB), handF: W(J.handF), handB: W(J.handB), footF: W(J.ankleF), footB: W(J.ankleB), tip: tipW, base: baseW };
    if (rdt > 0) { if (this.lastTip) this.tipVel.subVectors(tipW, this.lastTip).divideScalar(rdt); this.lastTip = tipW.clone(); }
    // cloth (springy verlet strips): coat tails from the back of the skirt, scarf from the back of the neck
    const wind = new THREE.Vector3(-f.facing * 2 - f.vx * 1.6, -f.vy * 0.4, 0);
    for (const rb of this.ribbons) {
      let a;
      if (rb.at === 'tail') a = this.rig.localToWorld(V([J.pelvis[0] - 0.16, J.pelvis[1] - 0.12, rb.z]));
      else a = this.rig.localToWorld(V([J.neckB[0] - 0.09, J.neckB[1] + 0.02, rb.z]));
      const ww = wind.clone().multiplyScalar(rb.wind || 1); ww.x += Math.sin(t * 3 + rb.z * 40) * 1.2;
      rb.r.update(a, frozen ? 0.0001 : dt, ww);
    }
    this.trailUpdate(f, rdt, J, p);
    // hit flash (white-hot rim + emissive) / invulnerability shimmer
    this.flashT = Math.max(0, this.flashT - dt);
    const fl = this.flashT > 0 ? 1 + 2.6 * (this.flashT / 0.11) : 1, inv = (f.inv > 0 && f.st !== 'dodge' && f.st !== 'down') ? 0.55 + Math.sin(t * 40) * 0.35 : 1;
    this.m.body.emissiveIntensity = 0.42 * fl * inv; this.m.bodyB.emissiveIntensity = 0.22 * fl * inv;
    for (const k of ['body', 'bodyB']) this.m[k].userData.rim.value.copy(this.m[k].userData.rimBase).multiplyScalar(this.flashT > 0 ? 2.2 : 1).lerp(new THREE.Color(1, 1, 1), this.flashT > 0 ? 0.5 : 0);
    // shadow, guard hex, ult ring
    this.shadow.position.set(f.x, baseY + 0.015, 0); const sc = Math.max(0.3, 1 - f.y * 0.22) * s; this.shadow.scale.set(sc * 1.1, sc, 1);
    const guard = f.st === 'guard' || f.st === 'block';
    this.shield.visible = guard && this.vis; this.shield.material.opacity = f.st === 'block' ? 0.9 : 0.4;
    this.shield.position.set(f.x + f.facing * 0.6 * s, baseY + f.y + 1.15 * s, 0); this.shield.scale.setScalar(s * (f.st === 'block' ? 1.15 : 1)); this.shield.rotation.x += dt * 1.5;
    const ready = f.ult >= 100 && f.st !== 'ko';
    this.ring.visible = ready && this.vis; this.ring.position.set(f.x, baseY + 0.03, 0); this.ring.material.opacity = 0.35 + Math.sin(t * 6) * 0.2; this.ring.scale.setScalar(s * (1 + Math.sin(t * 6) * 0.05));
  }

  /** sub-frame blade samples between the previous and this frame's move time, so the trail follows the real arc */
  trailUpdate(f, dt, J, p) {
    const m = f.st === 'atk' && f.mk ? this.C.moves[f.mk] : null;
    const samples = [];
    if (m && dt > 0 && (m.box || m.kind === 'ult')) {
      const [su, ac, rc] = m.t, on0 = su * 0.45, on1 = su + ac + rc * 0.45, keys = this.keysFor(f);
      if (this.trailSeq !== f.seq) { this.trailSeq = f.seq; this.prevT = Math.max(0, f.t - dt); this.prevRoot.copy(this.group.position); }
      const t0 = Math.max(this.prevT, on0), t1 = Math.min(f.t, on1);
      if (keys && t1 > t0) {
        const pure = (tt) => solve(evalClip(keys, tt, this.snap));
        const now = pure(f.t), offB = [J.base[0] - now.base[0], J.base[1] - now.base[1], J.base[2] - now.base[2]], offT = [J.tip[0] - now.tip[0], J.tip[1] - now.tip[1], J.tip[2] - now.tip[2]];
        const n = clamp(Math.ceil((t1 - t0) / (1 / 300)), 1, 24);
        for (let i = 1; i <= n; i++) {
          const tt = t0 + (t1 - t0) * i / n, q = pure(tt), k = (tt - this.prevT) / Math.max(1e-6, f.t - this.prevT);
          const dx = (this.prevRoot.x - this.group.position.x) * (1 - k), dy = (this.prevRoot.y - this.group.position.y) * (1 - k);
          const b = this.rig.localToWorld(V([q.base[0] + offB[0], q.base[1] + offB[1], q.base[2] + offB[2]])); b.x += dx; b.y += dy;
          const tp = this.rig.localToWorld(V([q.tip[0] + offT[0], q.tip[1] + offT[1], q.tip[2] + offT[2]])); tp.x += dx; tp.y += dy;
          samples.push({ b, t: tp });
        }
      }
      this.prevT = f.t; this.prevRoot.copy(this.group.position);
    } else if (f.st !== 'atk') this.trailSeq = -1;
    this.trail.update(dt, samples);
  }

  // ---------------------------------------------------------------- mesh placement (rig units, the rig group carries the scale)
  orient(mesh, a, b, twist = 0, sx = 1, sz = 1) {
    _y.set(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)); const len = _y.length() || 1e-5; _y.divideScalar(len);
    _z.copy(ZAX); _x.crossVectors(_y, _z); if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0); _x.normalize(); _z.crossVectors(_x, _y).normalize();
    _m.makeBasis(_x, _y, _z); mesh.quaternion.setFromRotationMatrix(_m);
    if (twist) mesh.quaternion.multiply(_q.setFromAxisAngle(UP, twist));
    mesh.position.set(a[0], a[1], a[2] || 0); mesh.scale.set(sx, 1, sz);
    return len;
  }
  place(J, p) {
    const M = this.mesh, twH = p.tw, twC = p.tw + p.ctw;
    this.orient(M.pelvis, J.pelvis, J.lumbar, twH, 0.82, 1.05);
    this.orient(M.abdomen, J.pelvis, J.lumbar, (twH + twC) / 2, 0.85, 1);
    this.orient(M.chest, J.lumbar, J.neckB, twC, 0.72, 1);
    this.orient(M.neck, [J.neckB[0], J.neckB[1], 0], J.neckT);
    // head: oriented along neck → head centre; visor on the face
    this.orient(M.head, J.head, [J.head[0] + (J.head[0] - J.neckT[0]), J.head[1] + (J.head[1] - J.neckT[1]), 0], 0, 0.96, 0.9);
    M.head.position.set(J.head[0], J.head[1], 0);
    const hy = [J.head[0] - J.neckT[0], J.head[1] - J.neckT[1]], hl = Math.hypot(hy[0], hy[1]) || 1, ux = hy[0] / hl, uy = hy[1] / hl, fx = uy, fy = -ux;   // face direction ⟂ head axis
    M.jaw.position.set(J.head[0] + fx * 0.05 - ux * 0.07, J.head[1] + fy * 0.05 - uy * 0.07, 0); M.jaw.quaternion.copy(M.head.quaternion); M.jaw.scale.set(0.9, 0.8, 0.85);
    M.visor.position.set(J.head[0] + fx * 0.135 + ux * 0.015, J.head[1] + fy * 0.135 + uy * 0.015, 0); M.visor.quaternion.copy(M.head.quaternion);
    // arms
    this.orient(M.uaF, J.shF, J.elbowF); this.orient(M.faF, J.elbowF, J.handF);
    this.orient(M.uaB, J.shB, J.elbowB); this.orient(M.faB, J.elbowB, J.handB);
    M.deltF.position.set(...J.shF); M.deltB.position.set(...J.shB);
    const bd = J.bladeDir;
    this.orient(M.handF, J.handF, [J.handF[0] + bd[0], J.handF[1] + bd[1], J.handF[2] + bd[2]]);
    this.orient(M.handB, J.handB, [J.handB[0] * 2 - J.elbowB[0], J.handB[1] * 2 - J.elbowB[1], J.handB[2]]);
    // legs + feet (flat on the floor when planted; toe pitch from the pose in the air)
    this.orient(M.thF, J.hipF, J.kneeF); this.orient(M.shF, J.kneeF, J.ankleF);
    this.orient(M.thB, J.hipB, J.kneeB); this.orient(M.shB, J.kneeB, J.ankleB);
    for (const [side, an, pitch] of [['F', J.ankleF, p.aF], ['B', J.ankleB, p.aB]]) {
      const ft = M['foot' + side], so = M['sole' + side], a = (this.feet[side].planted || this.feet[side].step ? 0 : pitch) + J.roll;
      const ca = Math.cos(a), sa = Math.sin(a);
      ft.position.set(an[0] + ca * 0.06 + sa * 0.035, an[1] + sa * 0.06 - ca * 0.035, an[2]); ft.rotation.set(0, 0, a);
      so.position.set(an[0] + ca * 0.06 + sa * 0.075, an[1] + sa * 0.06 - ca * 0.075, an[2]); so.rotation.set(0, 0, a);
    }
    // outfit
    if (this.coat) {
      const ld = [J.lumbar[0] - J.pelvis[0], J.lumbar[1] - J.pelvis[1]], ll = Math.hypot(ld[0], ld[1]) || 1;
      const cb = [J.pelvis[0] - ld[0] / ll * 0.05, J.pelvis[1] - ld[1] / ll * 0.05, 0];
      this.orient(M.coat, cb, J.neckB, twC, 0.78, 1.04); M.coat.scale.y = Math.hypot(J.neckB[0] - cb[0], J.neckB[1] - cb[1]) / 0.555 * 0.95 + 0.05;
      const mk = [(J.kneeF[0] + J.kneeB[0]) / 2, (J.kneeF[1] + J.kneeB[1]) / 2], spread = Math.abs(J.kneeF[0] - J.kneeB[0]);
      const sd = [mk[0] - J.pelvis[0], mk[1] - J.pelvis[1]]; const sl = Math.hypot(sd[0], sd[1]) || 1;
      this.orient(M.skirt, [J.pelvis[0], J.pelvis[1] - 0.02, 0], [J.pelvis[0] - sd[0] / sl, J.pelvis[1] - sd[1] / sl - 0.02, 0], twH, 1 + spread * 0.9, 1.05);   // local -Y (the hanging cylinder) points at the knees
      const hem = [J.pelvis[0] + sd[0] / sl * 0.34, J.pelvis[1] - 0.02 + sd[1] / sl * 0.34, 0];
      M.skirtHem.position.set(...hem); M.skirtHem.quaternion.setFromUnitVectors(ZAX, _t.set(sd[0] / sl, sd[1] / sl, 0)); M.skirtHem.scale.set(1 + spread * 0.9, 1.05, 1);
      const cd = _t.set(J.neckB[0] - J.lumbar[0], J.neckB[1] - J.lumbar[1], 0).normalize();
      M.collar.position.set(J.neckB[0] - cd.x * 0.02, J.neckB[1] - cd.y * 0.02, 0); M.collar.quaternion.setFromUnitVectors(ZAX, cd);
      M.belt.position.set(J.pelvis[0] + ld[0] / ll * 0.06, J.pelvis[1] + ld[1] / ll * 0.06, 0); M.belt.quaternion.setFromUnitVectors(ZAX, _t.set(ld[0] / ll, ld[1] / ll, 0)); M.belt.scale.set(0.86, 1.06, 1);
    }
    if (M.scarfRing) { const nd = _t.set(J.neckT[0] - J.neckB[0], J.neckT[1] - J.neckB[1], 0).normalize(); M.scarfRing.position.set(J.neckB[0] + nd.x * 0.04, J.neckB[1] + nd.y * 0.04, 0); M.scarfRing.quaternion.setFromUnitVectors(ZAX, nd); }
    // blade from the weapon hand
    this.orient(this.blade, J.handF, [J.handF[0] + bd[0], J.handF[1] + bd[1], J.handF[2] + bd[2]]);   // flat of the blade toward the camera
  }
}
