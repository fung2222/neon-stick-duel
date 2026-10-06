// node tests/anime-mage.test.mjs — anime Mage forms (pure math). The Mage has no melee boxes, so the "blade in the hitbox"
// check becomes "the casting focus is where and when the projectile spawns": at every fire frame of classes.js the focus
// (hand + cast direction × fr, power chain + spin applied) sits on the duel's spawn point and faces the projectile's flight.
// Plus: every pose solvable, contact keys on the first active frame, blink fully stretched on the teleport frame, pillar /
// starfall cast forms, no snaps, spins end on whole turns, power-chain order, mudra hands, solveInto equality, and a
// guard that the Mage's gameplay numbers are still the shipped ones (visual-only change).
import assert from 'node:assert/strict';
import { solve, POSE_KEYS, RIG_SCALE, lerpPose } from '../js/rig/core.js';
import { evalChain, evalA, spinPt, AKEYS, normSnap, copyA, CHAIN_LEAD, lerpA } from '../js/anime/clip.js';
import { PROFILE, POSES, STANCE, FORMS, contactPose } from '../js/anime/mage.js';
import { makeJ, solveInto } from '../js/anime/solve.js';
import { CLASSES } from '../js/duel.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const SCALE = 1.2 * RIG_SCALE, C = CLASSES.mage;
const ev = (key, t, from = STANCE) => evalChain(PROFILE.moveKeys(key, C.moves[key]), t, from, {}, PROFILE.lead);
/** focus point + cast direction in rig units (spin about the pivot applied, like AnimeFighter.focusSeg / placeBones) */
const focus = (p) => { const s = solve(p), d = s.bladeDir, c = [0, 1, 2].map((i) => s.handF[i] + d[i] * p.fr), w = spinPt(c, p.sy, p.pv);
  const tipW = spinPt(c.map((v, i) => v + d[i] * 0.1), p.sy, p.pv); const dir = [tipW[0] - w[0], tipW[1] - w[1]], dl = Math.hypot(...dir); return { c: w, dir: [dir[0] / dl, dir[1] / dl], s }; };
export const report = { cast: {} };

test('every Mage pose has all channels (incl. mudra / focus / sigil / blink) and solves; grounded feet reach the floor; upright head above pelvis', () => {
  const all = { ...POSES }; for (const [k, m] of Object.entries(FORMS)) for (const [q, p] of Object.entries(m)) all[k + '.' + q] = p;
  for (const [name, p] of Object.entries(all)) {
    for (const q of AKEYS) assert.ok(Number.isFinite(p[q]), name + ' missing ' + q);
    for (const q of ['cF1', 'cF2', 'cB1', 'cB2']) assert.ok(p[q] >= 0 && p[q] <= 1, `${name} ${q} curl in [0, 1]`);
    assert.ok(p.fr > 0.05 && p.fr < 0.7 && p.fs > 0.2 && p.fs <= 3.4, name + ' focus reach / scale sane');
    const s = solve(p);
    for (const [k, v] of Object.entries(s.bends)) assert.ok(v >= 0 && v <= 2.65, `${name} ${k} bend ${v.toFixed(2)}`);
    if (p.fFy <= 0.08 && p.fBy <= 0.08 && !p.rr) for (const [an, t] of [[s.ankleF, [p.fFx, p.fFy]], [s.ankleB, [p.fBx, p.fBy]]]) assert.ok(Math.hypot(an[0] - t[0], an[1] - t[1]) < 0.025, `${name}: foot reaches the floor (${Math.hypot(an[0] - t[0], an[1] - t[1]).toFixed(3)})`);
    if (Math.abs(p.rr) < 0.3) assert.ok(s.head[1] > s.pelvis[1] + 0.45, name + ' head above pelvis');
  }
});
test('forms: every Mage move has a form, keys sorted, contact key exactly on the first active frame', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    const keys = PROFILE.moveKeys(key, m); assert.ok(keys, key + ' has a form');
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i].t >= keys[i - 1].t, key + ' keys sorted');
    const s = keys.find((k) => k.p === contactPose(key)); assert.ok(s && Math.abs(s.t - m.t[0]) < 1e-9, key + ' contact at startup end');
  }
});
test('projectiles leave the focus: at each fire frame the glyph is ≤ 0.12 rig units (≈ 16 cm) from the duel spawn point and faces the flight', () => {
  for (const [key, m] of Object.entries(C.moves)) for (const f of m.fire || []) {
    if (f.type !== 'proj') continue;
    const pr = C.projs[f.proj], sp = [0.6 / SCALE, pr.y / SCALE], { c, dir } = focus(ev(key, f.at));
    const v = [pr.v, pr.vy || 0], vl = Math.hypot(...v), d = Math.hypot(c[0] - sp[0], c[1] - sp[1]), al = (dir[0] * v[0] + dir[1] * v[1]) / vl;
    report.cast[key] = { at: f.at, dist: +d.toFixed(3), align: +al.toFixed(2) };
    assert.ok(d <= 0.12, `${key}: focus ${c.map((x) => x.toFixed(2))} vs spawn ${sp.map((x) => x.toFixed(2))} (${d.toFixed(3)})`);
    assert.ok(al > 0.75, `${key}: cast direction ${dir.map((x) => x.toFixed(2))} vs flight ${v} (cos ${al.toFixed(2)})`);
  }
});
test('blink / pillar / starfall: stretched to a line on the teleport frame, sword-finger pillar strike down-forward with the sigil, palms-to-sky glyph overhead and HELD', () => {
  const b = C.moves.s1.fire[0]; assert.equal(b.type, 'blink'); const pb = ev('s1', b.at); assert.ok(pb.zz >= 0.95, 's1 zz ' + pb.zz);
  assert.ok(Math.abs(ev('s1', 0).zz) < 0.02 && Math.abs(ev('s1', C.moves.s1.t.reduce((a, x) => a + x) + 0.1).zz) < 0.02, 's1 starts / ends unstretched');
  const pf = C.moves.s2.fire[0], p2 = ev('s2', pf.at), f2 = focus(p2); report.cast.s2 = { at: pf.at, dir: f2.dir.map((x) => +x.toFixed(2)), gs: +p2.gs.toFixed(2) };
  assert.ok(f2.dir[0] > 0.2 && f2.dir[1] < -0.3, 's2 casts down-forward ' + f2.dir); assert.ok(p2.cF1 < 0.2 && p2.cF2 > 0.8, 's2 sword fingers'); assert.ok(p2.gs > 0.5, 's2 ground sigil');
  const uf = C.moves.ult.fire[0], pu = ev('ult', uf.at), fu = focus(pu); report.cast.ult = { at: uf.at, dir: fu.dir.map((x) => +x.toFixed(2)), fs: +pu.fs.toFixed(2) };
  assert.ok(fu.dir[1] > 0.8 && fu.c[1] > fu.s.head[1], 'ult glyph overhead, casting up'); assert.ok(pu.fs >= 2 && pu.gs >= 1, 'ult big glyph + sigil');
  const T = C.moves.ult.t, keys = PROFILE.moveKeys('ult', C.moves.ult), H = keys.filter((k) => k.p === FORMS.ult.H);
  assert.ok(H.length === 2 && H[1].t - H[0].t >= 0.1 && H[1].e === 'hold', 'ult held pose ≥ 0.1 s'); assert.ok(H[1].t <= T[0] + T[1] + T[2], 'held inside the move');
});
test('no snaps: an ε step never jumps the focus or the off hand (from idle and from the a3 follow-through)', () => {
  for (const key of Object.keys(C.moves)) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m);
    for (const from of [POSES.idle1, normSnap(copyA(evalA(PROFILE.moveKeys('a3', C.moves.a3), 0.3, STANCE)))]) {
      let maxJ = 0;
      for (let t = 0; t < m.t[0] + m.t[1] + m.t[2] + 0.1; t += 1 / 960) {
        const p = evalChain(keys, t, from, {}, PROFILE.lead), q = evalChain(keys, t + 1e-6, from, {}, PROFILE.lead), a = focus(p), b = focus(q);
        maxJ = Math.max(maxJ, Math.hypot(b.c[0] - a.c[0], b.c[1] - a.c[1]) * SCALE, Math.hypot(b.s.handB[0] - a.s.handB[0], b.s.handB[1] - a.s.handB[1]) * SCALE);
      }
      assert.ok(maxJ < 0.002, `${key}: continuous focus / off-hand path (max ε-jump ${maxJ.toFixed(5)} m)`);
    }
  }
});
test('spins end on a whole turn', () => {
  for (const key of Object.keys(C.moves)) { const keys = PROFILE.moveKeys(key, C.moves[key]), last = keys[keys.length - 1].p; assert.ok(Math.abs(Math.sin(last.sy)) < 1e-9 && Math.abs(Math.cos(last.sy) - 1) < 1e-9, key + ' ends facing forward'); }
});
test('allocation-free solveInto matches core solve exactly on every Mage form (planted feet, rolls)', () => {
  const J = makeJ(); let n = 0, maxE = 0;
  const cmp = (p, opts) => { const a = solve(p, opts), b = solveInto(p, opts.plantF || null, opts.plantB || null, J); n++;
    for (const k of ['pelvis', 'head', 'shF', 'shB', 'kneeF', 'ankleF', 'kneeB', 'ankleB', 'elbowF', 'handF', 'elbowB', 'handB', 'bladeDir', 'base', 'tip'])
      for (let i = 0; i < 3; i++) maxE = Math.max(maxE, Math.abs((a[k][i] ?? 0) - b[k][i])); };
  for (const [key, m] of Object.entries(C.moves)) { const keys = PROFILE.moveKeys(key, m), T = m.t[0] + m.t[1] + m.t[2] + 0.3;
    for (let t = 0; t <= T; t += 0.01) { const p = evalChain(keys, t, STANCE, {}, PROFILE.lead); cmp(p, {}); cmp(p, { plantF: [p.fFx + 0.05, 0.075, 0.1], plantB: [p.fBx - 0.04, 0.075, -0.1] }); } }
  for (const p of Object.values(POSES)) cmp(p, {});
  for (const [a, b] of [[POSES.stance, POSES.jump], [POSES.guard, POSES.rollB], [STANCE, POSES.win]]) for (let k = 0; k <= 1; k += 0.1) { const x = lerpPose(a, b, k, {}, false), y = lerpA(a, b, k); for (const q of POSE_KEYS) maxE = Math.max(maxE, Math.abs(x[q] - y[q])); }
  report.solveIntoSamples = n; report.solveIntoMaxErr = maxE; assert.ok(maxE < 1e-9, 'max deviation ' + maxE);
});
test('power chain on the grounded casts: feet → hips → torso → shoulder → hands peak in order; the off hand counter-pulls (mudra / guard) on the release', () => {
  const links = [['feet', ['fFx', 'fBx', 'hB', 'fFy'], 'feet'], ['hips', ['tw', 'px'], 'hips'], ['torso', ['sp', 'ch'], 'torso'], ['shoulder', ['ctw'], 'shoulder'], ['hands', ['gx', 'gy'], 'arm']];
  report.chain = {};
  for (const key of ['a1', 'a2', 'a3', 's2']) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m), dt = 1 / 4000, peak = {}, A = FORMS[key].A2 || FORMS[key].A, S = key === 's2' ? FORMS[key].B : FORMS[key].S;
    const kA = keys.find((k) => k.p === A).t, kS = keys.find((k) => k.p === S).t;
    for (const [name, ch, li] of links) {
      const off = CHAIN_LEAD[li] * PROFILE.lead, t0 = Math.max(0, kA - off), t1 = kS - off;
      let best = null, travel = 0; for (const q of ch) { const tr = Math.abs(S[q] - A[q]); if (tr > travel) { travel = tr; best = q; } }
      if (travel < 0.05) continue;
      let pt = 0, pv = -1, prev = evalChain(keys, t0, STANCE, {}, PROFILE.lead)[best];
      for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) { const v = evalChain(keys, t, STANCE, {}, PROFILE.lead)[best], sp = Math.abs(v - prev) / dt; if (sp > pv) { pv = sp; pt = t; } prev = v; }
      peak[name] = +(pt * 1000).toFixed(1);
    }
    report.chain[key] = peak;
    const seq = links.map(([n]) => peak[n]).filter((v) => v !== undefined);
    assert.ok(seq.length >= 3, key + ': at least 3 links move in the cast ' + JSON.stringify(peak));
    for (let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1] - 0.3, `${key}: chain out of order ${JSON.stringify(peak)}`);
  }
  { const s3 = solve(FORMS.a3.S); assert.ok(s3.handB[0] > s3.pelvis[0] + 0.15 && FORMS.a3.S.cB1 + FORMS.a3.S.cB2 < 0.5, 'a3.S: double palm (both palms open, pushing)'); }
  for (const key of ['a1', 'a2']) { const p = FORMS[key].S, s = solve(p); assert.ok((s.handB[0] < s.handF[0] - 0.25 && s.handB[1] > s.pelvis[1] - 0.05) || s.handB[1] > s.shB[1], `${key}.S: off hand counter-pulls (behind the casting palm, at the hip or higher) or rises as a crane guard, hand ${s.handB.map((v) => v.toFixed(2))}`); }
  assert.ok(STANCE.cB1 === 0 && STANCE.cB2 === 1, 'stance off hand holds the sword-finger mudra');
});
test('gameplay untouched: Mage frame data, fire times, projectiles and invulnerability are the shipped values', () => {
  const want = { a1: [0.13, 0.05, 0.28], a2: [0.12, 0.05, 0.28], a3: [0.18, 0.05, 0.5], air1: [0.08, 0.05, 0.18], air2: [0.08, 0.05, 0.22], s1: [0.04, 0.06, 0.16], s2: [0.22, 0.05, 0.3], ult: [0.3, 0.1, 0.7] };
  for (const [k, t] of Object.entries(want)) assert.deepEqual(C.moves[k].t, t, k + ' frame data');
  const at = { a1: 0.13, a2: 0.12, a3: 0.18, air1: 0.08, air2: 0.08, s2: 0.2, ult: 0.28 }; for (const [k, v] of Object.entries(at)) assert.equal(C.moves[k].fire[0].at, v, k + ' fire time');
  assert.deepEqual(C.moves.ult.inv, [0, 1.1]); for (const k of Object.keys(C.moves)) assert.ok(!C.moves[k].box, k + ' has no melee box');
  assert.deepEqual([C.projs.bolt.v, C.projs.bolt.y, C.projs.bolt2.y, C.projs.orb.y, C.projs.airbolt.y, C.projs.airbolt.vy], [11, 1.3, 1.15, 1.35, 0.2, -7]);
});
console.log(JSON.stringify(report));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
