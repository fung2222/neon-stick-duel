// node tests/rig.test.mjs — HQ rig (pure math): IK + joint limits, clip timing, blade ↔ hitbox alignment at active frames
import assert from 'node:assert/strict';
import { ik2, solve, evalClip, lerpPose, LIMITS, SK, POSE_KEYS, EASE, RIG_SCALE } from '../js/rig/core.js';
import { PROFILE, POSES, STANCE, MOVES } from '../js/rig/sword.js';
import { CLASSES, TUNE } from '../js/duel.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const SCALE = 1.2 * RIG_SCALE;   // fighter scale × HQ rig scale (rig units → metres)
const segRect = (a, b, r) => {   // does segment a→b (2D) touch rectangle r = [x0, x1, y0, y1]?
  for (let i = 0; i <= 40; i++) { const k = i / 40, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k; if (x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3]) return true; }
  return false;
};

test('two-bone IK reaches reachable targets and respects joint limits', () => {
  for (let i = 0; i < 400; i++) {
    const a = 0.47, b = 0.46, t = [Math.cos(i) * (0.2 + (i % 9) * 0.1), -0.2 - (i % 7) * 0.12];
    const r = ik2([0, 0], t, a, b, +1, LIMITS.knee);
    assert.ok(r.bend >= LIMITS.knee[0] - 1e-6 && r.bend <= LIMITS.knee[1] + 1e-6, 'bend ' + r.bend);
    const d = Math.hypot(t[0], t[1]);
    if (d < (a + b) * 0.9 && d > 0.3) assert.ok(Math.hypot(r.e[0] - t[0], r.e[1] - t[1]) < 1e-6, 'reached');
    assert.ok(Math.abs(Math.hypot(r.j[0], r.j[1]) - a) < 1e-9 && Math.abs(Math.hypot(r.e[0] - r.j[0], r.e[1] - r.j[1]) - b) < 1e-9, 'bone lengths kept');
  }
  // knees bend forward, elbows bend down/back
  const leg = ik2([0, 0.9], [0.1, 0.1], 0.47, 0.46, +1); assert.ok(leg.j[0] > 0.1, 'knee forward');
  const arm = ik2([0, 1.4], [0.4, 1.1], 0.36, 0.34, -1); assert.ok(arm.j[1] < 1.4 - 0.05, 'elbow below the shoulder line');
});
test('every HQ pose solves with planted feet, no hyper-extension, limbs inside limits', () => {
  const all = { ...POSES }; for (const [k, m] of Object.entries(MOVES)) for (const q of 'ASEF') all[k + '.' + q] = m[q];
  for (const [name, p] of Object.entries(all)) {
    for (const q of POSE_KEYS) assert.ok(Number.isFinite(p[q]), name + ' missing ' + q);
    const s = solve(p);
    for (const [k, v] of Object.entries(s.bends)) assert.ok(v >= 0 && v <= 2.65, `${name} ${k} bend ${v.toFixed(2)}`);
    const ground = p.fFy <= 0.08 && p.fBy <= 0.08 && !p.rr;
    if (ground) {
      for (const [h, an, t] of [[s.hipF, s.ankleF, [p.fFx, p.fFy]], [s.hipB, s.ankleB, [p.fBx, p.fBy]]]) {
        assert.ok(Math.hypot(an[0] - t[0], an[1] - t[1]) < 0.02, `${name}: foot reaches its ground target (${Math.hypot(an[0] - t[0], an[1] - t[1]).toFixed(3)})`);
      }
    }
    // head above the pelvis when upright
    if (!p.rr) assert.ok(s.head[1] > s.pelvis[1] + 0.5, name + ' head above pelvis');
  }
});
test('attack clips: keys follow the frame data (contact pose exactly on the first active frame)', () => {
  const C = CLASSES.sword;
  for (const [key, m] of Object.entries(C.moves)) {
    const keys = PROFILE.moveKeys(key, m); assert.ok(keys, key + ' has HQ keys');
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i].t >= keys[i - 1].t, key + ' keys sorted');
    if (key !== 'ult') { const s = keys.find((k) => k.p === MOVES[key].S); assert.ok(Math.abs(s.t - m.t[0]) < 1e-9, key + ' S at startup end'); }
  }
});
test('blade lines up with the hitbox on the active frames (every Swordsman melee move)', () => {
  const C = CLASSES.sword;
  for (const [key, m] of Object.entries(C.moves)) {
    if (!m.box) continue;
    const keys = PROFILE.moveKeys(key, m), [su, ac] = m.t;
    const box = [m.box[0], m.box[1] + TUNE.halfW, m.box[2], m.box[3]];
    let first = false, any = 0, n = 0, reach = 0;
    for (let i = 0; i <= 10; i++) {
      const t = su + ac * i / 10, p = evalClip(keys, t, STANCE), s = solve(p);
      const a = [s.base[0] * SCALE, s.base[1] * SCALE], b = [s.tip[0] * SCALE, s.tip[1] * SCALE];
      const hit = segRect(a, b, box); if (i === 0) first = hit; any += hit; n++; reach = Math.max(reach, b[0]);
    }
    assert.ok(first, `${key}: blade inside the hitbox on the first active frame`);
    assert.ok(any / n >= 0.6, `${key}: blade inside the hitbox for ${Math.round(any / n * 100)} % of the active frames`);
    assert.ok(reach >= Math.min(m.box[1], 1.5) * 0.85, `${key}: tip reach ${reach.toFixed(2)} vs box ${m.box[1]}`);
  }
});
test('crossfades and easing are continuous (no snaps)', () => {
  const C = CLASSES.sword;
  for (const key of ['a1', 'a2', 'a3', 'a4', 's1']) {
    const keys = PROFILE.moveKeys(key, C.moves[key]); let maxJump = 0;
    for (let t = 0; t < 0.8; t += 1 / 480) {   // continuity: an ε step never moves the blade tip noticeably (no snaps between keys)
      const a = solve(evalClip(keys, t, POSES.idle1)).tip, b = solve(evalClip(keys, t + 1e-4, POSES.idle1)).tip;
      maxJump = Math.max(maxJump, Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    assert.ok(maxJump < 0.02, `${key}: continuous blade path (max ε-jump ${maxJump.toFixed(4)})`);
  }
  for (const e of Object.values(EASE)) { assert.ok(Math.abs(e(0)) < 1e-9 && Math.abs(e(1) - 1) < 1e-9); }
  const mid = lerpPose(POSES.stance, POSES.guard, 0.5); assert.ok(mid.py < POSES.stance.py && mid.py > POSES.guard.py);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
