// node tests/anime.test.mjs — anime Swordsman forms (pure math): contact keys on the first active frame, blade inside the
// hitbox on the active frames (with the power-chain lead AND the spin about the pivot applied), poses solvable, no snaps,
// knee splay keeps bone lengths, spins finish on a whole turn.
import assert from 'node:assert/strict';
import { solve, SK, POSE_KEYS, RIG_SCALE } from '../js/rig/core.js';
import { evalChain, evalA, spinPt, splayKnee, AKEYS, XE, normSnap, copyA } from '../js/anime/clip.js';
import { PROFILE, POSES, STANCE, FORMS, contactPose } from '../js/anime/sword.js';
import { CLASSES, TUNE } from '../js/duel.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const SCALE = 1.2 * RIG_SCALE;
const segRect = (a, b, r) => { for (let i = 0; i <= 40; i++) { const k = i / 40, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k; if (x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3]) return true; } return false; };
const blade = (p) => { const s = solve(p); const b = spinPt(s.base, p.sy, p.pv), t = spinPt(s.tip, p.sy, p.pv); return { b: [b[0] * SCALE, b[1] * SCALE], t: [t[0] * SCALE, t[1] * SCALE] }; };
const C = CLASSES.sword;
export const report = {};

test('every anime pose has all channels and solves (feet reach the floor when grounded, head above pelvis upright)', () => {
  const all = { ...POSES }; for (const [k, m] of Object.entries(FORMS)) for (const [q, p] of Object.entries(m)) all[k + '.' + q] = p;
  for (const [name, p] of Object.entries(all)) {
    for (const q of AKEYS) assert.ok(Number.isFinite(p[q]), name + ' missing ' + q);
    const s = solve(p);
    for (const [k, v] of Object.entries(s.bends)) assert.ok(v >= 0 && v <= 2.65, `${name} ${k} bend ${v.toFixed(2)}`);
    if (p.fFy <= 0.08 && p.fBy <= 0.08 && !p.rr) for (const [an, t] of [[s.ankleF, [p.fFx, p.fFy]], [s.ankleB, [p.fBx, p.fBy]]]) assert.ok(Math.hypot(an[0] - t[0], an[1] - t[1]) < 0.025, `${name}: foot reaches the floor (${Math.hypot(an[0] - t[0], an[1] - t[1]).toFixed(3)})`);
    if (Math.abs(p.rr) < 0.3) assert.ok(s.head[1] > s.pelvis[1] + 0.45, name + ' head above pelvis');
  }
});
test('forms: contact key exactly on the first active frame, keys sorted, every move of the class has a form', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    const keys = PROFILE.moveKeys(key, m); assert.ok(keys, key + ' has a form');
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i].t >= keys[i - 1].t, key + ' keys sorted');
    const s = keys.find((k) => k.p === contactPose(key)); assert.ok(s && Math.abs(s.t - m.t[0]) < 1e-9, key + ' contact at startup end');
  }
});
test('blade inside the hitbox on the first active frame and ≥ 60 % of active frames (power chain + spin applied)', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    if (!m.box) continue;
    const keys = PROFILE.moveKeys(key, m), [su, ac] = m.t, box = [m.box[0], m.box[1] + TUNE.halfW, m.box[2], m.box[3]];
    let first = false, any = 0, n = 0, reach = 0;
    for (let i = 0; i <= 10; i++) {
      const t = su + ac * i / 10, p = evalChain(keys, t, STANCE, {}, PROFILE.lead), { b, t: tp } = blade(p);
      const hit = segRect(b, tp, box); if (i === 0) first = hit; any += hit; n++; reach = Math.max(reach, tp[0], b[0]);
    }
    report[key] = { first, pct: Math.round(any / n * 100), reach: +reach.toFixed(2) };
  }
  const bad = Object.entries(report).filter(([k, r]) => !r.first || r.pct < 60 || r.reach < Math.min(C.moves[k].box[1], 1.5) * 0.85);
  assert.ok(!bad.length, 'outside the hitbox: ' + JSON.stringify(Object.fromEntries(bad)));
});
test('no snaps: an ε step never jumps the blade (combo chained from every other move\'s follow-through too)', () => {
  for (const key of Object.keys(C.moves)) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m);
    for (const from of [POSES.idle1, normSnap(copyA(evalA(PROFILE.moveKeys('a3', C.moves.a3), 0.3, STANCE)))]) {
      let maxJump = 0;
      for (let t = 0; t < m.t[0] + m.t[1] + m.t[2] + 0.1; t += 1 / 960) {   // ε = 1 µs: a real snap shows up as a jump ≫ 1 mm
        const a = blade(evalChain(keys, t, from, {}, PROFILE.lead)).t, b = blade(evalChain(keys, t + 1e-6, from, {}, PROFILE.lead)).t;
        maxJump = Math.max(maxJump, Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      assert.ok(maxJump < 0.002, `${key}: continuous blade path (max ε-jump ${maxJump.toFixed(5)} m)`);
    }
  }
  for (const e of Object.values(XE)) { assert.ok(Math.abs(e(0)) < 1e-9 && Math.abs(e(1) - 1) < 1e-6); }
});
test('spins end on a whole turn; snapshots normalise (no unwinding); knee splay keeps bone lengths', () => {
  for (const key of ['a3', 's2', 'ult']) { const keys = PROFILE.moveKeys(key, C.moves[key]), last = keys[keys.length - 1].p; assert.ok(Math.abs(Math.sin(last.sy)) < 1e-9 && Math.abs(Math.cos(last.sy) - 1) < 1e-9, key + ' ends facing forward'); }
  const p = normSnap({ sy: -Math.PI * 2, rr: -Math.PI * 2 + 0.1 }); assert.ok(Math.abs(p.sy) < 1e-9 && Math.abs(p.rr - 0.1) < 1e-9);
  const h = [0, 0.9, 0.1], k = [0.2, 0.5, 0.1], a = [0.1, 0.08, 0.1], o = splayKnee(h, k, a, 1.1);
  assert.ok(Math.abs(Math.hypot(o[0] - h[0], o[1] - h[1], o[2] - h[2]) - Math.hypot(k[0] - h[0], k[1] - h[1])) < 1e-9 && Math.abs(Math.hypot(o[0] - a[0], o[1] - a[1], o[2] - a[2]) - Math.hypot(k[0] - a[0], k[1] - a[1])) < 1e-9);
});
console.log(JSON.stringify(report));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
