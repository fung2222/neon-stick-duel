// AnimeFighter: cel-shaded anime renderer on the HQ rig. Same public API as HQFighter / StickFighter (setClass / update /
// flash / visible / joints / onHit / takeSwingCue) plus takeFx() (dust / ring cues for main.js).
// Pipeline per frame: sim state → keyed form (power-chain evalChain, crossfades, held poses) → additive springs (hips lead,
// chest + head lag, recoil, landing squash) → spin about the pivot foot → planted feet (IK, suri-ashi steps, heel lifts) →
// solve() → knee splay → skinned bones → verlet chains (coat panels collide with the legs, sash, ponytail, hair spikes).
import * as THREE from 'three';
import { HQFighter } from '../rig/hq-fighter.js';
import { solve, spring, SK, EASE, RIG_SCALE } from '../rig/core.js';
import { evalChain, evalA, lerpA, copyA, normSnap, spinPt, splayKnee, XE, wrapA } from './clip.js';
import { buildCharacter, frameMat, BODY } from './builder.js';
import { ANIME_CLASSES } from './configs.js';
import { FACE } from './toon.js';
import { CLASSES } from '../classes.js';
import { TUNE } from '../duel.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const B = Object.fromEntries(BODY.map((n, i) => [n, i]));
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(),
  _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _inv = new THREE.Matrix4(), UPV = new THREE.Vector3(0, 1, 0), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const A3 = () => [0, 0, 0];
const TAU = Math.PI * 2;

export class AnimeFighter extends HQFighter {
  constructor(scene) {
    super(scene);
    this.cues = []; this.cueOut = [];
    this.kpA = {}; this.snapA = {}; this._p = {}; this._t1 = {}; this._t2 = {}; this._lp = {}; this.rolled = null;
    this.Jw = { hip: new THREE.Vector3(), head: new THREE.Vector3(), neck: new THREE.Vector3(), handF: new THREE.Vector3(), handB: new THREE.Vector3(), footF: new THREE.Vector3(), footB: new THREE.Vector3(), tip: new THREE.Vector3(), base: new THREE.Vector3() };
    this.caps = Array.from({ length: 4 }, () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 }));
    this.kneeF = A3(); this.kneeB = A3(); this.sp0 = A3(); this.sp1 = A3();
  }
  resetAnim() {
    super.resetAnim();
    this.kp = null; this.fxSeq = -1; this.fxT = 0; this.blockN = 0; this.blinkT = 2; this.hitPoses = null; this.lastPose = null;
    if (this.chainSt) for (const c of this.chainSt) c.ok = false;
  }

  setClass(clsId, color = null, scale = 1) {
    const C = CLASSES[clsId], cfg = ANIME_CLASSES[clsId]; if (!C || !cfg) return;
    const hex = color ?? C.color;
    if (this.cls === clsId && this.colorHex === hex && this.scaleK === scale) return;
    this.disposeParts(); this.cls = clsId; this.C = C; this.cfg = cfg; this.prof = cfg.anim; this.colorHex = hex; this.scaleK = scale; this.scale = 1.2 * RIG_SCALE * scale;
    this.keysCache = {};
    const accent = hex === C.color ? cfg.palette.trim : hex;
    const ch = this.char = buildCharacter({ ...cfg, palette: { ...cfg.palette, trim: accent, hairTie: accent, rim: accent } });
    for (const b of ch.bones) this.rig.add(b);
    this.rig.add(ch.body, ch.outline, ch.weapon);
    this.parts = [ch.body, ch.outline, ch.weapon, ...ch.bones]; this.blade = ch.weapon;
    this.c = new THREE.Color(hex); this.trail.setColor(this.c.clone().lerp(new THREE.Color(1, 1, 1), 0.2)); this.ring.material.color.copy(this.c);
    // chains: rest positions / rotations relative to their anchor bone (from the bind pose)
    const bindQ = (m) => new THREE.Quaternion().setFromRotationMatrix(m);
    this.chainSt = ch.chains.map((c) => {
      const Ma = ch.bind[c.anchor], inv = Ma.clone().invert(), qa = bindQ(Ma).invert();
      return {
        c, ok: false, anchor: ch.bones[c.anchor], bones: c.bones.map((i) => ch.bones[i]),
        rest: c.pts.map((p) => p.clone().applyMatrix4(inv)), restQ: c.bones.map((i) => qa.clone().multiply(bindQ(ch.bind[i]))),
        p: c.pts.map(() => new THREE.Vector3()), o: c.pts.map(() => new THREE.Vector3()), r: c.pts.map(() => new THREE.Vector3()), rl: c.pts.map(() => new THREE.Vector3()),
        stiff: c.stiff, len: c.pts.slice(1).map((p, i) => p.distanceTo(c.pts[i])),
      };
    });
    this.rolled = { ...this.prof.stance, rr: -TAU };
    this.resetAnim();
    this.visible = this.vis;
  }
  disposeParts() {
    for (const p of this.parts) this.rig.remove(p);
    this.parts = []; this.mesh = {}; this.ribbons = [];
    if (this.char) { this.char.dispose(); this.char = null; }
    this.blade = null; this.chainSt = null;
  }
  /** triangle / draw-call budget of this fighter (for the perf report) */
  stats() {
    const t = this.char ? this.char.tris : { body: 0, weapon: 0, face: 0 };
    return { unique: t.body + t.weapon + t.face, drawn: 2 * t.body + 2 * t.weapon + t.face, calls: 5, bones: this.char ? this.char.bones.length : 0 };
  }
  takeFx() { const o = this.cueOut; o.length = 0; for (const c of this.cues) o.push(c); this.cues.length = 0; return o; }
  cue(type, x, y, k = 1) { if (this.cues.length < 8) this.cues.push({ type, x, y, k, c: this.c }); }

  onHit(e) {
    super.onHit(e);
    const st = this.prof.stance, V0 = this.prof.poses[this.hitV] || this.prof.poses.hitMid;
    this.hitPoses = { k: lerpA(st, V0, this.hitK, {}), r: lerpA(st, V0, this.hitK * 0.7, {}) };
  }

  // ---------------------------------------------------------------- state machine → keyed pose (anime forms)
  keysFor(f) {
    const k = f.mk; if (this.keysCache[k] !== undefined) return this.keysCache[k];
    return (this.keysCache[k] = this.prof.moveKeys(k, this.C.moves[k]) || null);
  }
  keyed(f, dt, t) {
    const Pz = this.prof.poses, st = this.prof.stance, out = this._p;
    let id = this.stateOf(f);
    if (f.st === 'block' && id === this.id && f.t + 1e-6 < this.lastFt) id = 'block:' + (++this.blockN);
    if (id !== this.id) { normSnap(copyA(this.kp ? this.kpA : st, this.snapA)); this.snap = this.snapA; this.id = id; this.stT = 0; }
    else this.stT += dt;
    this.lastFt = f.t;
    const S = this.snapA, T = this.stT, xf = (pose, dur, e = 'inOutSine') => lerpA(S, pose, XE[e](clamp(T / dur, 0, 1)), out, true);
    let rrAdd = 0;
    switch (f.st) {
      case 'atk': { const keys = this.keysFor(f); if (keys) evalChain(keys, f.t, S, out, this.prof.lead); else xf(st, 0.15); break; }
      case 'idle': {
        const w = 0.5 - 0.5 * Math.cos(t * TAU / 2.8), ph = t % 6.5;   // breath + an occasional suri-ashi shuffle (in → hold → back)
        const sh = ph < 3.8 ? 0 : ph < 4.15 ? EASE.inOutSine((ph - 3.8) / 0.35) : ph < 5.0 ? 1 : ph < 5.4 ? 1 - EASE.inOutSine((ph - 5.0) / 0.4) : 0;
        lerpA(st, Pz.idle1, w, this._t1); lerpA(this._t1, Pz.shuffle, sh, this._t2); xf(this._t2, 0.22); break;
      }
      case 'walk': xf(Math.sign(f.vx) === f.facing ? Pz.walk : Pz.walkBack, 0.12); break;
      case 'guard': xf(Pz.guard, 0.09, 'outQuad'); break;
      case 'block': evalA(this.blockKeys || (this.blockKeys = [{ t: 0, p: 'from' }, { t: 0.045, p: Pz.block, e: 'outQuad' }, { t: 0.24, p: Pz.guard, e: 'inOutSine' }]), f.t, S, out); break;
      case 'jump': {
        if (f.djT < 0.42) { xf(Pz.tuck, 0.08, 'outQuad'); const k = f.djT / 0.42; rrAdd = TAU * EASE.inOutSine(k); if (k > 0.8) lerpA(out, Pz.fall, (k - 0.8) / 0.2, out); }
        else { lerpA(Pz.fall, Pz.jump, clamp((f.vy + 3) / 9, 0, 1), this._t1); xf(this._t1, 0.12); }
        break;
      }
      case 'dodge': {
        const fw = Math.sign(f.dodgeDir) === f.facing ? 1 : -1, k = clamp(f.t / TUNE.dodgeT, 0, 1);
        xf(Pz.dodge, 0.05, 'outQuad'); lerpA(out, st, clamp((k - 0.75) / 0.25, 0, 1), out); rrAdd = fw * TAU * EASE.inOutSine(k); break;
      }
      case 'hit': {
        const H = this.hitPoses || { k: Pz.hitMid, r: Pz.hitMid }, su = Math.max(0.12, f.stunT || 0.3);
        evalA([{ t: 0, p: 'from' }, { t: 0.045, p: H.k, e: 'whip' }, { t: su * 0.6, p: H.r, e: 'outSine' }, { t: su + 0.08, p: st, e: 'inOutSine' }], f.t, S, out); break;
      }
      case 'air': case 'koAir': {
        const base = this.lastHitSpike && f.vy < 0 ? Pz.spiked : Pz.airHit;
        xf(base, 0.08, 'outQuad'); if (base === Pz.airHit) out.rr = clamp(-0.9 + 0.045 * f.vy, -1.35, -0.35); break;
      }
      case 'ko': if (f.y > 0.3) xf(Pz.airHit, 0.1); else xf(Pz.ko, 0.22, 'outQuad'); break;
      case 'down': evalA(this.downKeys || (this.downKeys = [{ t: 0, p: 'from' }, { t: 0.1, p: Pz.down, e: 'inQuad' }, { t: 0.18, p: Pz.downB, e: 'outQuad' }, { t: 0.3, p: Pz.down, e: 'inQuad' }]), T, S, out); break;
      case 'rise': evalA(this.riseKeys || (this.riseKeys = [{ t: 0, p: 'from' }, { t: 0.1, p: Pz.rollB, e: 'inQuad' }, { t: 0.2, p: Pz.kneel, e: 'outQuad' }, { t: TUNE.riseT + 0.06, p: this.rolled, e: 'outSine' }]), f.t, S, out); break;
      case 'stun': xf(Pz.stun, 0.15); out.ch += Math.sin(t * 9) * 0.12; out.hd += Math.sin(t * 6.3) * 0.18; out.px += Math.sin(t * 4.1) * 0.03; break;
      case 'win': evalA(this.winKeys || (this.winKeys = [{ t: 0, p: 'from' }, { t: 0.22, p: Pz.win0, e: 'coil' }, { t: 0.36, p: Pz.chiburi, e: 'snap' }, { t: 0.75, p: Pz.chiburi, e: 'hold' },
        { t: 1.15, p: Pz.noto0, e: 'inOutSine' }, { t: 1.85, p: Pz.noto1, e: 'inCubic' }, { t: 2.25, p: Pz.win, e: 'settle' }]), f.t, S, out); break;
      default: xf(st, 0.15);
    }
    this.kp = true; copyA(out, this.kpA);
    return rrAdd;
  }

  // ---------------------------------------------------------------- planted feet (suri-ashi: low sliding steps, heel lifts)
  footTargets(f, p, dt, grounded, baseY) {
    const s = this.scale, skid = Math.abs(f.vx) > 6, out = this._feet || (this._feet = { F: A3(), B: A3() }), stp = this.prof.step || {};
    const walk = f.st === 'walk', atk = f.st === 'atk', idle = f.st === 'idle';
    const tol = walk ? 0.12 : atk ? 0.1 : idle ? 0.05 : f.st === 'hit' || f.st === 'block' || f.st === 'stun' ? 0.13 : 0.2;
    const dur = walk ? clamp((stp.durWalk || 0.22) - Math.abs(f.vx) * 0.025, 0.13, 0.22) : atk ? 0.075 : 0.12;
    const lead = walk ? f.vx * dur * 0.6 : atk ? f.vx * 0.04 : f.vx * 0.05;
    const lift = walk ? (stp.liftWalk || 0.05) : atk ? 0.05 : (stp.lift || 0.04);
    const gy = baseY + 0.075 * s, spinning = Math.abs(wrapA(p.sy || 0)) > 0.06;
    const want = this._want || (this._want = {}), err = this._err || (this._err = {});
    for (const side of ['F', 'B']) {
      const ft = this.feet[side], lx = p['f' + side + 'x'], ly = p['f' + side + 'y'];
      want[side] = grounded && !skid && !spinning && Math.abs(p.rr) < 0.05 && ly <= SK.ankle + 0.03 && this.turnT >= 0.5;
      if (!want[side]) { ft.planted = false; ft.step = null; continue; }
      const wpos = this.rig.localToWorld(_v.set(lx, SK.ankle, 0)), dx = wpos.x + lead;
      if (!ft.planted && !ft.step) { ft.w.set(wpos.x, gy, 0); ft.planted = true; }
      ft.target = dx; err[side] = Math.abs(dx - ft.w.x);
    }
    if (!this.feet.F.step && !this.feet.B.step) {
      let pick = null, best = 0;
      for (const q of ['F', 'B']) if (want[q] && this.feet[q].planted && err[q] > tol && err[q] > best) { best = err[q]; pick = q; }
      if (pick) { const ft = this.feet[pick]; ft.step = { k: 0, from: ft.w.x, dur, lift }; ft.planted = false; }
    }
    const res = this._res || (this._res = { F: null, B: null });
    for (const side of ['F', 'B']) {
      const ft = this.feet[side]; if (!want[side]) { res[side] = null; continue; }
      if (ft.step) {
        ft.step.k += dt / ft.step.dur; const k = Math.min(1, ft.step.k), e = EASE.inOutSine(k);
        ft.w.set(ft.step.from + (ft.target - ft.step.from) * e, gy + Math.sin(Math.PI * k) * ft.step.lift * s, 0);
        if (k >= 1) { ft.step = null; ft.planted = true; ft.w.y = gy; if (atk && Math.abs(f.vx) > 1) this.cue('slide', ft.w.x, baseY); }
      }
      const l = this.rig.worldToLocal(_v.copy(ft.w)), h = p['h' + side] || 0;
      out[side][0] = l.x - 0.04 * (1 - Math.cos(h * 0.5)); out[side][1] = l.y + 0.15 * Math.sin(h * 0.5); out[side][2] = 0;   // heel lift: pivot on the ball of the foot
      res[side] = out[side];
    }
    this.stepK = this.feet.F.step ? this.feet.F.step.k : this.feet.B.step ? this.feet.B.step.k : -1;
    return res;
  }

  // ---------------------------------------------------------------- per-frame update
  update(f, dt, t, baseY, frozen = false, shake = 0) {
    if (!this.char) return;
    const s = this.scale, rdt = frozen ? 0 : dt, P = this.prof.poses;
    const yawT = f.facing > 0 ? 0 : Math.PI;
    if (this.lastFacing === 0) { this.yaw = yawT; this.lastFacing = f.facing; this.turnT = 1; }
    if (f.facing !== this.lastFacing) { this.lastFacing = f.facing; this.turnT = 0; this.yaw0 = this.yaw; }
    if (this.turnT < 1) { this.turnT = Math.min(1, this.turnT + rdt / 0.14); let d = yawT - this.yaw0; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw = this.yaw0 + d * EASE.inOutSine(this.turnT); }
    else this.yaw = yawT;
    this.group.position.set(f.x + (shake ? (Math.random() - 0.5) * shake : 0), baseY + f.y, 0);
    this.group.rotation.y = this.yaw;
    const grounded = f.y <= 0.001;
    if (!frozen) {
      if (this.wasAir && grounded) { this.sp.sq.v -= 1.4 * clamp(Math.abs(this.prevVy) / 12, 0.3, 1.2); this.landT = 0; if (Math.abs(this.prevVy) > 7) this.cue('stamp', f.x, baseY, 0.8); }
      this.wasAir = !grounded; this.prevVy = f.vy; this.landT += dt;
    }
    let p = this._lp, rrAdd;
    if (frozen && this.lastPose) { rrAdd = this.lastRr; }
    else { rrAdd = this.keyed(f, rdt, t); copyA(this._p, p); this.lastPose = true; this.lastRr = rrAdd; this.fxCues(f); }
    const q = this._q || (this._q = {}); copyA(p, q); p = q;
    if (this.landT < 0.2 && (f.st === 'idle' || f.st === 'walk' || f.st === 'guard')) lerpA(p, P.land, Math.sin(Math.PI * Math.min(1, this.landT / 0.2)) * 0.7, p);
    if (this.turnT < 1) lerpA(p, P.turn, Math.sin(Math.PI * this.turnT) * 0.6, p);
    const sp = this.sp;
    spring(sp.rx, 0, rdt, 13, 0.45); spring(sp.rc, 0, rdt, 15, 0.4); spring(sp.rh, 0, rdt, 18, 0.38); spring(sp.sq, 0, rdt, 15, 0.5);
    const bobT = f.st === 'walk' ? (this.stepK >= 0 ? 0.02 * Math.sin(Math.PI * this.stepK) - 0.014 : -0.016) : 0;   // suri-ashi: very little bob
    spring(sp.bob, bobT, rdt, 24, 0.8);
    p.px += sp.rx.x; p.ch += sp.rc.x; p.hd += sp.rh.x; p.py += sp.sq.x + sp.bob.x;
    const twT = p.tw + p.ctw; if (!this.lastFacingInit) { sp.tw.x = twT; sp.head.x = p.pt + p.sp + p.ch + p.hd; this.lastFacingInit = true; }
    spring(sp.tw, twT, rdt, 30, 0.85); p.ctw = sp.tw.x - p.tw;
    const aC = p.pt + p.sp + p.ch; spring(sp.head, aC + p.hd, rdt, 22, 0.7); p.hd = sp.head.x - aC;
    p.rr = (p.rr || 0) + rrAdd;
    // spin about the pivot foot (vertical axis at x = pv): rig rotation + offset so the pivot stays put
    const sy = wrapA(p.sy || 0), pv = p.pv || 0;
    this.rig.scale.setScalar(s); this.rig.rotation.set(0, sy, 0);
    this.rig.position.set(s * pv * (1 - Math.cos(sy)), this.rig.position.y, s * pv * Math.sin(sy));
    this.group.updateMatrixWorld(true);
    // sheath flourish: the grip goes to the koiguchi (computed from the pelvis frame) — first solve for the pelvis
    if (p.sh > 0 && this.char.sheath) { const J0 = solve(p); this.sheathAt(J0, p, this._sh || (this._sh = {})); const k = clamp(p.sh / 0.15, 0, 1); p.gx += (this._sh.gx - p.gx) * k; p.gy += (this._sh.gy - p.gy) * k; p.ox += (this._sh.mx - p.ox) * k; p.oy += (this._sh.my - p.oy) * k; }
    const plants = this.footTargets(f, p, rdt, grounded, baseY);
    const J = solve(p, { plantF: plants.F, plantB: plants.B });
    J.kneeF = splayKnee(J.hipF, J.kneeF, J.ankleF, p.kF || 0, this.kneeF); J.kneeB = splayKnee(J.hipB, J.kneeB, J.ankleB, p.kB || 0, this.kneeB);
    let lift = 0;
    if (grounded) { const lo = Math.min(J.head[1] - 0.15, J.kneeF[1] - 0.06, J.kneeB[1] - 0.06, J.ankleF[1] - 0.075, J.ankleB[1] - 0.075, J.pelvis[1] - 0.1, J.handF[1] - 0.05, J.handB[1] - 0.05); if (lo < 0) lift = -lo; }
    this.rig.position.y = lift * s;
    this.placeBones(J, p, sy);
    this.group.updateMatrixWorld(true);
    // world joints for FX + contact points (preallocated)
    const W = (a, o) => this.rig.localToWorld(o.set(a[0], a[1], a[2] || 0)), Jw = this.Jw;
    W(J.pelvis, Jw.hip); W(J.head, Jw.head); W(J.neckB, Jw.neck); W(J.handF, Jw.handF); W(J.handB, Jw.handB); W(J.ankleF, Jw.footF); W(J.ankleB, Jw.footB);
    this.bladeWorld(J, Jw);
    this.joints = Jw;
    if (rdt > 0) { if (this.lastTipW) this.tipVel.subVectors(Jw.tip, this.lastTipW).divideScalar(rdt); (this.lastTipW || (this.lastTipW = new THREE.Vector3())).copy(Jw.tip); }
    // springs: coat panels (collide with the legs), sash tails, ponytail, hair spikes
    this.legCaps(J);
    this.stepChains(frozen ? 0 : dt, t);
    this.group.updateMatrixWorld(true);
    this.trailUpdate(f, rdt, J, p);
    // face: blink / fierce while attacking / hurt; hit flash + invulnerability shimmer
    this.flashT = Math.max(0, this.flashT - dt);
    const hurt = f.st === 'hit' || f.st === 'air' || f.st === 'koAir' || f.st === 'ko' || f.st === 'down' || f.st === 'stun' || this.flashT > 0;
    this.blinkT -= rdt; if (this.blinkT < -0.11) this.blinkT = 2.4 + ((t * 7.3) % 1.6);
    const fr = hurt ? FACE.hurt : f.st === 'atk' || f.st === 'dodge' ? FACE.fierce : (this.blinkT < 0 || (f.st === 'win' && p.sh > 0.6)) ? FACE.blink : FACE.neutral;
    this.char.faceTex.offset.x = fr * 0.25;
    const U = this.char.U, inv = (f.inv > 0 && f.st !== 'dodge' && f.st !== 'down') ? 0.78 + Math.sin(t * 40) * 0.2 : 1;
    U.uFlash.value = this.flashT > 0 ? 0.6 * (this.flashT / 0.11) : 0; U.uDim.value = inv;
    // shadow, guard hex, ult ring
    this.shadow.position.set(f.x, baseY + 0.015, 0); const sc = Math.max(0.3, 1 - f.y * 0.22) * s; this.shadow.scale.set(sc * 1.1, sc, 1);
    const guard = f.st === 'guard' || f.st === 'block';
    this.shield.visible = guard && this.vis; this.shield.material.opacity = f.st === 'block' ? 0.75 : 0.3;
    this.shield.position.set(f.x + f.facing * 0.6 * s, baseY + f.y + 1.15 * s, 0); this.shield.scale.setScalar(s * (f.st === 'block' ? 1.15 : 1)); this.shield.rotation.x += dt * 1.5;
    const ready = f.ult >= 100 && f.st !== 'ko';
    this.ring.visible = ready && this.vis; this.ring.position.set(f.x, baseY + 0.03, 0); this.ring.material.opacity = 0.35 + Math.sin(t * 6) * 0.2; this.ring.scale.setScalar(s * (1 + Math.sin(t * 6) * 0.05));
  }
  /** FX cues authored on form keys (stamp / slide / ring / skid), fired once when the move time crosses the key */
  fxCues(f) {
    if (f.st !== 'atk' || !f.mk) { this.fxSeq = -1; return; }
    const keys = this.keysFor(f); if (!keys) return;
    if (this.fxSeq !== f.seq) { this.fxSeq = f.seq; this.fxT = -1; }
    for (const k of keys) if (k.fx && k.t > this.fxT && k.t <= f.t) {
      const J = this.Jw, base = this.group.position.y - f.y;
      if (k.fx === 'stamp') this.cue('stamp', J.footF.x || f.x, base, 1);
      else if (k.fx === 'slide' || k.fx === 'skid') this.cue('slide', (k.fx === 'skid' ? J.footF.x : J.footB.x) || f.x, base, k.fx === 'skid' ? 1.2 : 0.7);
      else if (k.fx === 'ring') this.cue('ring', f.x, this.group.position.y + 1.05 * this.scale, 1);
    }
    this.fxT = f.t;
  }
  /** koiguchi (saya mouth) + blade direction in rig space, from the pelvis frame */
  sheathAt(J, p, out) {
    frameMat(J.pelvis, J.lumbar, p.tw, _m);
    _v.copy(this.char.sheath.mouth).applyMatrix4(_m); _w.copy(this.char.sheath.dir).transformDirection(_m);
    out.mx = _v.x; out.my = _v.y; out.mz = _v.z; out.dx = _w.x; out.dy = _w.y; out.dz = _w.z;
    out.gx = _v.x - _w.x * 0.08; out.gy = _v.y - _w.y * 0.08;
    return out;
  }
  bladeWorld(J, Jw) {
    this.rig.localToWorld(Jw.tip.set(J.tip[0], J.tip[1], J.tip[2])); this.rig.localToWorld(Jw.base.set(J.base[0], J.base[1], J.base[2]));
  }

  // ---------------------------------------------------------------- bones
  setBone(i, a, b, twist) { const bone = this.char.bones[i]; frameMat(a, b, twist, _m); _m.decompose(bone.position, bone.quaternion, _s); }
  placeBones(J, p, sy) {
    const twH = p.tw, twC = p.tw + p.ctw, b = this._bt || (this._bt = { h: A3(), hd: A3(), hb: A3(), ft: A3() });
    this.setBone(B.pelvis, J.pelvis, J.lumbar, twH);
    this.setBone(B.chest, J.lumbar, J.neckB, twC);
    this.setBone(B.neck, J.neckB, J.neckT, twC * 0.5);
    b.h[0] = J.head[0] * 2 - J.neckT[0]; b.h[1] = J.head[1] * 2 - J.neckT[1]; b.h[2] = J.head[2] || 0;
    this.setBone(B.head, J.head, b.h, -0.62 * Math.cos(this.yaw + sy) + twC * 0.3);   // 3/4 view: the face turns toward the camera
    this.setBone(B.uaF, J.shF, J.elbowF, 0); this.setBone(B.faF, J.elbowF, J.handF, 0);
    const bd = J.bladeDir; b.hd[0] = J.handF[0] + bd[0]; b.hd[1] = J.handF[1] + bd[1]; b.hd[2] = J.handF[2] + bd[2];
    this.setBone(B.handF, J.handF, b.hd, 0);
    this.setBone(B.uaB, J.shB, J.elbowB, 0); this.setBone(B.faB, J.elbowB, J.handB, 0);
    b.hb[0] = J.handB[0] * 2 - J.elbowB[0]; b.hb[1] = J.handB[1] * 2 - J.elbowB[1]; b.hb[2] = J.handB[2];
    this.setBone(B.handB, J.handB, b.hb, 0);
    this.setBone(B.thF, J.hipF, J.kneeF, 0); this.setBone(B.shinF, J.kneeF, J.ankleF, 0);
    this.setBone(B.thB, J.hipB, J.kneeB, 0); this.setBone(B.shinB, J.kneeB, J.ankleB, 0);
    for (const [side, an, pitch] of [['F', J.ankleF, p.aF], ['B', J.ankleB, p.aB]]) {
      const planted = this.feet[side].planted || this.feet[side].step, h = p['h' + side] || 0;
      const a = (planted ? -h * 0.5 : pitch - h * 0.3) + J.roll;
      b.ft[0] = an[0] + Math.cos(a); b.ft[1] = an[1] + Math.sin(a); b.ft[2] = an[2];
      this.setBone(B['foot' + side], an, b.ft, 0);
    }
    // katana at the weapon hand (or sliding into the saya during the win flourish)
    const w = this.char.weapon;
    if (p.sh > 0 && this.char.sheath) {
      const S = this.sheathAt(J, p, this._sh2 || (this._sh2 = {})), k = EASE.inOutSine(clamp(p.sh / 0.15, 0, 1)), d = 0.08 + (1 - p.sh) * 0.62;
      b.hd[0] = S.mx - S.dx * d; b.hd[1] = S.my - S.dy * d; b.hd[2] = S.mz - S.dz * d;
      const ax = J.handF[0] + (b.hd[0] - J.handF[0]) * k, ay = J.handF[1] + (b.hd[1] - J.handF[1]) * k, az = J.handF[2] + (b.hd[2] - J.handF[2]) * k;
      const dx = bd[0] + (S.dx - bd[0]) * k, dy = bd[1] + (S.dy - bd[1]) * k, dz = bd[2] + (S.dz - bd[2]) * k;
      frameMat([ax, ay, az], [ax + dx, ay + dy, az + dz], 0, _m);
    } else frameMat(J.handF, b.hd, 0, _m);
    _m.decompose(w.position, w.quaternion, _s);
  }

  // ---------------------------------------------------------------- spring chains (verlet in world space)
  legCaps(J) {
    const s = this.scale, C = this.caps;
    const set = (c, a, b2, r) => { this.rig.localToWorld(c.a.set(a[0], a[1], a[2] || 0)); this.rig.localToWorld(c.b.set(b2[0], b2[1], b2[2] || 0)); c.r = r * s; };
    set(C[0], J.hipF, J.kneeF, 0.1); set(C[1], J.kneeF, J.ankleF, 0.075); set(C[2], J.hipB, J.kneeB, 0.1); set(C[3], J.kneeB, J.ankleB, 0.075);
  }
  stepChains(dt, t) {
    if (!this.chainSt) return;
    const s = this.scale; _inv.copy(this.rig.matrixWorld).invert();
    for (const st of this.chainSt) {
      const M = st.anchor.matrixWorld, n = st.p.length;
      for (let i = 0; i < n; i++) st.r[i].copy(st.rest[i]).applyMatrix4(M);
      if (!st.ok || st.p[0].distanceToSquared(st.r[0]) > 2.25) { for (let i = 0; i < n; i++) { st.p[i].copy(st.r[i]); st.o[i].copy(st.r[i]); } st.ok = true; }
      if (dt > 0) {
        const steps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 120)))), h = dt / steps, c = st.c, drag = Math.pow(c.drag, h * 60);
        for (let k = 0; k < steps; k++) {
          st.p[0].copy(st.r[0]); st.o[0].copy(st.r[0]);
          for (let i = 1; i < n; i++) {
            const p = st.p[i], o = st.o[i];
            _v.subVectors(p, o).multiplyScalar(drag); o.copy(p); p.add(_v);
            p.y -= c.grav * h * h * s;
            p.x += Math.sin(t * 5.3 + i * 1.7 + (c.ang || 0) * 3) * 0.25 * h * h * s;   // light flutter
            const kq = 1 - Math.pow(1 - st.stiff[i], h * 60); p.lerp(st.r[i], kq);
          }
          for (let it = 0; it < 2; it++) for (let i = 1; i < n; i++) {
            const a = st.p[i - 1], p = st.p[i], L = st.len[i - 1] * s; _v.subVectors(p, a); const d = _v.length() || 1e-6; p.copy(a).addScaledVector(_v, L / d);
            if (c.collide) for (const cap of this.caps) this.pushOut(p, cap);
          }
        }
      }
      // bones: shortest-arc rotation from the rest direction (relative to the anchor) to the simulated segment
      for (let i = 0; i < n; i++) st.rl[i].copy(st.p[i]).applyMatrix4(_inv);
      for (let i = 0; i < st.bones.length; i++) {
        const bone = st.bones[i];
        _q.copy(st.anchor.quaternion).multiply(st.restQ[i]);
        _w.copy(UPV).applyQuaternion(_q); _u.subVectors(st.rl[i + 1], st.rl[i]).normalize();
        _q2.setFromUnitVectors(_w, _u); bone.quaternion.copy(_q2).multiply(_q); bone.position.copy(st.rl[i]);
      }
    }
  }
  pushOut(p, cap) {
    _c.subVectors(cap.b, cap.a); const L2 = _c.lengthSq() || 1e-6; const k = clamp(_d.subVectors(p, cap.a).dot(_c) / L2, 0, 1);
    _d.copy(cap.a).addScaledVector(_c, k); _v.subVectors(p, _d); const d = _v.length();
    if (d < cap.r && d > 1e-6) p.copy(_d).addScaledVector(_v, cap.r / d);
  }

  // ---------------------------------------------------------------- sub-frame trail along the real (spinning) blade arc
  trailUpdate(f, dt, J, p) {
    const m = f.st === 'atk' && f.mk ? this.C.moves[f.mk] : null, samples = this._smp || (this._smp = []);
    samples.length = 0;
    if (m && dt > 0 && (m.box || m.kind === 'ult')) {
      const [su, ac, rc] = m.t, on0 = su * 0.4, on1 = su + ac + rc * 0.45, keys = this.keysFor(f);
      if (this.trailSeq !== f.seq) { this.trailSeq = f.seq; this.prevT = Math.max(0, f.t - dt); this.prevRoot.copy(this.group.position); }
      const t0 = Math.max(this.prevT, on0), t1 = Math.min(f.t, on1);
      if (keys && t1 > t0) {
        const s = this.scale, ly = this.rig.position.y, tp = this._tp || (this._tp = {});
        evalChain(keys, f.t, this.snapA, tp, this.prof.lead); const now = solve(tp);
        const offB = [J.base[0] - now.base[0], J.base[1] - now.base[1], J.base[2] - now.base[2]], offT = [J.tip[0] - now.tip[0], J.tip[1] - now.tip[1], J.tip[2] - now.tip[2]];
        const n = clamp(Math.ceil((t1 - t0) / (1 / 300)), 1, 24);
        for (let i = 1; i <= n; i++) {
          const tt = t0 + (t1 - t0) * i / n; evalChain(keys, tt, this.snapA, tp, this.prof.lead); const q = solve(tp), k = (tt - this.prevT) / Math.max(1e-6, f.t - this.prevT);
          const dx = (this.prevRoot.x - this.group.position.x) * (1 - k), dy = (this.prevRoot.y - this.group.position.y) * (1 - k), sy = wrapA(tp.sy || 0), pv = tp.pv || 0;
          const toW = (src, off) => { spinPt([src[0] + off[0], src[1] + off[1], src[2] + off[2]], sy, pv, this.sp0); const v = this.group.localToWorld(new THREE.Vector3(this.sp0[0] * s, this.sp0[1] * s + ly, this.sp0[2] * s)); v.x += dx; v.y += dy; return v; };
          samples.push({ b: toW(q.base, offB), t: toW(q.tip, offT) });
        }
      }
      this.prevT = f.t; this.prevRoot.copy(this.group.position);
    } else if (f.st !== 'atk') this.trailSeq = -1;
    this.trail.update(dt, samples);
  }
}
