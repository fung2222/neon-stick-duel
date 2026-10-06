// node tests/anime-assassin.test.mjs — anime Assassin forms (pure math). The striking segment is the reverse-grip kodachi (strikeSeg:
// grip = wrist + forearm · DAGGER.grip, blade = grip + dir · [base, tip], dir = forearm angle + the RELATIVE blade angle ga / oa) or the
// rear knee (a3), with the visual spin (sy about pv, clip.spinPt) applied. It must sit inside the duel hitbox on the first active frame
// and on ≥ 60 % of the active frames (power chain applied), and on EVERY hit tick of the 8-hit ult. Plus: every pose solvable, blades
// inside the reverse-grip wrist limit, contact keys on the first active frame, low stances, hip-driven spins (a4 / s2 / ult) and the
// air2 forward flip, the off-hand guard, kunai released at the projectile spawn point, the SIX-LINK power chain (feet → hips → torso →
// shoulder → elbow → blade snap) in order, the 居合 ult finish (cuts 7 + 8 land after the blades are home, HELD), no snaps, solveInto
// equality, and a guard that every Assassin gameplay number is still the shipped one.
import assert from 'node:assert/strict';
import { solve, POSE_KEYS, RIG_SCALE, lerpPose } from '../js/rig/core.js';
import { evalChain, evalA, AKEYS, normSnap, copyA, CHAIN_LEAD, lerpA, spinPt } from '../js/anime/clip.js';
import { PROFILE, POSES, STANCE, FORMS, contactPose, STRIKE, strikeSeg, REL_MIN } from '../js/anime/assassin.js';
import { makeJ, solveInto } from '../js/anime/solve.js';
import { CLASSES, TUNE } from '../js/duel.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const SCALE = 1.2 * RIG_SCALE, C = CLASSES.assassin, TAU = Math.PI * 2;
const ev = (key, t, from = STANCE) => evalChain(PROFILE.moveKeys(key, C.moves[key]), t, from, {}, PROFILE.lead, true);
const segRect = (a, b, r) => { for (let i = 0; i <= 40; i++) { const k = i / 40, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k; if (x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3]) return true; } return false; };
/** striking segment in metres, spin applied (same math as AnimeFighter: strikeSeg in the rig plane, then the sy turn about pv) */
const limbSeg = (p, limb) => { const s = solve(p), o = { base: [0, 0, 0], tip: [0, 0, 0] }; strikeSeg(s, p, limb, o);
  const b = spinPt(o.base, p.sy || 0, p.pv || 0), t = spinPt(o.tip, p.sy || 0, p.pv || 0); return { b: [b[0] * SCALE, b[1] * SCALE], t: [t[0] * SCALE, t[1] * SCALE], s }; };
const limbAt = (key, keys, t) => { const L = STRIKE[key]; if (L !== 'auto') return L; let li = 0; for (const k of keys) { if (k.t > t + 0.02) break; if (k.limb != null) li = k.limb; } return li; };
const boxOf = (m) => [m.box[0], m.box[1] + TUNE.halfW, m.box[2], m.box[3]];
// shipped gameplay numbers (classes.js at 9652861) — the anime pass must not change a single one
const SHIPPED = {"hp":1000,"walk":3.45,"weight":0.85,"reach":1.35,"prefer":1.3,"color":3932058,"trim":16722794,"combo":["a1","a2","a3","a4"],"airCombo":["air1","air2"],"moves":{"a1":{"kind":"basic","stop":0.05,"stun":0.3,"kb":1.6,"launch":0,"name":["逆手刺","Reverse stab"],"t":[0.05,0.06,0.14],"dmg":34,"box":[0,1.35,0.6,2],"vx":2.8,"chain":0.38,"pose":["asA0","asA1","asA1f"]},"a2":{"kind":"basic","stop":0.05,"stun":0.3,"kb":1.6,"launch":0,"name":["交叉斬","Cross cut"],"t":[0.05,0.06,0.14],"dmg":36,"box":[0,1.35,0.6,2],"vx":2.8,"chain":0.38,"pose":["asB0","asB1","asB1f"]},"a3":{"kind":"basic","stop":0.05,"stun":0.34,"kb":1.6,"launch":0,"name":["膝撞","Knee"],"t":[0.06,0.07,0.16],"dmg":40,"box":[0,1.2,0.4,1.7],"vx":3,"chain":0.4,"pose":["asC0","asC1","asC1f"]},"a4":{"kind":"basic","stop":0.05,"stun":0.32,"kb":1.6,"launch":0,"name":["旋刃","Blade spin"],"t":[0.07,0.16,0.3],"dmg":30,"box":[-0.6,1.45,0.3,2.3],"vx":2,"multi":2,"last":{"dmg":34,"launch":9,"stun":0.6,"stop":0.08},"chain":0.4,"pose":["asD0","asSpin","asD1f"]},"air1":{"kind":"air","air":true,"stop":0.05,"stun":0.3,"kb":1.2,"launch":3.2,"name":["空刃","Air cut"],"t":[0.04,0.08,0.12],"dmg":33,"box":[-0.2,1.4,-0.5,1.8],"chain":0.42,"pose":["airA0","asAir","airA1f"]},"air2":{"kind":"air","air":true,"stop":0.07,"stun":0.3,"kb":2,"launch":0,"name":["墜刃","Drop blade"],"t":[0.05,0.1,0.2],"dmg":44,"box":[-0.2,1.4,-0.9,1.5],"spike":-13,"pose":["airB0","asDrop","airB1f"]},"s1":{"kind":"skill","stop":0.08,"stun":0.45,"kb":3,"launch":0,"name":["影步飛刀","Shadow Step"],"tag":"escape","t":[0.08,0.18,0.22],"dmg":0,"inv":[0,0.22],"vx":-15,"vxT":[0,0.2],"cd":5,"air":true,"fire":[{"at":0.12,"type":"proj","proj":"dagger"},{"at":0.18,"type":"proj","proj":"dagger","dy":0.25},{"at":0.24,"type":"proj","proj":"dagger","dy":-0.2}],"pose":["asB0","asThrow","asA1f"]},"s2":{"kind":"skill","stop":0.1,"stun":0.55,"kb":4,"launch":0,"name":["瞬殺","Phantom Strike"],"tag":"closer","t":[0.17,0.1,0.3],"dmg":104,"box":[-0.2,1.4,0.4,2.1],"inv":[0,0.16],"cd":7,"fire":[{"at":0.15,"type":"teleport","behind":true,"maxDist":7}],"pose":["blink0","asA1","asA1f"]},"ult":{"kind":"ult","stop":0.06,"stun":0.5,"kb":0.6,"launch":0,"unblockable":false,"name":["死蓮","Death Lotus"],"t":[0.14,1,0.45],"dmg":36,"box":[-1.2,1.6,0,2.6],"multi":8,"last":{"dmg":160,"kb":8,"launch":9,"stun":0.9,"stop":0.16},"inv":[0,1.6],"fire":[{"at":0.1,"type":"teleport","behind":false,"maxDist":9}],"pose":["ult0","asSpin","asD1f"]}},"projs":{"dagger":{"dmg":32,"v":14,"life":0.45,"r":0.3,"y":1.35,"kb":1.4,"stun":0.3}}};
export const report = { strike: {}, chain: {} };
const allPoses = () => { const all = { ...POSES }; for (const [k, m] of Object.entries(FORMS)) for (const [q, p] of Object.entries(m)) all[k + '.' + q] = p; return all; };

test('every Assassin pose has all channels and solves; closed fists on the handles; grounded feet reach the floor; head above pelvis', () => {
  for (const [name, p] of Object.entries(allPoses())) {
    for (const q of AKEYS) assert.ok(Number.isFinite(p[q]), name + ' missing ' + q);
    for (const q of ['cF1', 'cF2', 'cB1', 'cB2']) assert.equal(p[q], 1, name + ' ' + q + ': closed fist');
    for (const q of ['oh', 'gw', 'fr', 'fs', 'gs']) assert.equal(p[q], 0, name + ' ' + q + ' unused (0)');
    assert.ok(p.sh >= 0 && p.sh <= 1, name + ' sheathe weight in [0, 1]');
    const s = solve(p);
    for (const [k, v] of Object.entries(s.bends)) assert.ok(v >= 0 && v <= 2.65, `${name} ${k} bend ${v.toFixed(2)}`);
    if (p.fFy <= 0.08 && p.fBy <= 0.08 && !p.rr) for (const [an, t] of [[s.ankleF, [p.fFx, p.fFy]], [s.ankleB, [p.fBx, p.fBy]]]) assert.ok(Math.hypot(an[0] - t[0], an[1] - t[1]) < 0.025, `${name}: foot reaches the floor (${Math.hypot(an[0] - t[0], an[1] - t[1]).toFixed(3)})`);
    if (Math.abs(p.rr % TAU) < 0.3) assert.ok(s.head[1] > s.pelvis[1] + 0.4, name + ' head above pelvis');
  }
});
test('逆手 reverse grip: every blade angle is forearm-relative inside the wrist limit [REL_MIN, 2π − REL_MIN] (never a forward grip)', () => {
  const bad = []; for (const [n, p] of Object.entries(allPoses())) for (const q of ['ga', 'oa']) if (!(p[q] >= REL_MIN - 1e-9 && p[q] <= TAU - REL_MIN + 1e-9)) bad.push(n + '.' + q + '=' + p[q].toFixed(2));
  assert.ok(!bad.length, bad.join(' '));
  // and the chain never interpolates through the forbidden sector (keys all live in one sector → the lerp stays inside; ≤ 0.02 settle overshoot)
  for (const [key, m] of Object.entries(C.moves)) for (let t = 0; t < m.t[0] + m.t[1] + m.t[2]; t += 0.004) { const p = ev(key, t); for (const q of ['ga', 'oa']) assert.ok(p[q] >= REL_MIN - 0.02 && p[q] <= TAU - REL_MIN + 0.02, `${key} t=${t.toFixed(3)} ${q}=${p[q].toFixed(2)}`); }
});
test('forms: every Assassin move has a form, keys sorted, contact key exactly on the first active frame', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    const keys = PROFILE.moveKeys(key, m); assert.ok(keys, key + ' has a form');
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i].t >= keys[i - 1].t, key + ' keys sorted');
    const s = keys.find((k) => k.p === contactPose(key)); assert.ok(s && Math.abs(s.t - m.t[0]) < 1e-9, key + ' contact at startup end');
  }
});
const REACH = { a1: 0.7, a2: 0.6, a3: 0.4, a4: 0.5, air1: 0.4, air2: 0.3, s2: 0.5, ult: 0.4 };
test('striking blade / knee inside the hitbox on the first active frame and ≥ 60 % of active frames (spin + power chain applied)', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    if (!m.box) continue;
    const keys = PROFILE.moveKeys(key, m), [su, ac] = m.t, box = boxOf(m);
    let first = false, any = 0, n = 0, reach = 0;
    for (let i = 0; i <= 10; i++) {
      const t = su + ac * i / 10, { b, t: tp } = limbSeg(ev(key, t), limbAt(key, keys, t));
      const hit = segRect(b, tp, box); if (i === 0) first = hit; any += hit; n++; reach = Math.max(reach, tp[0], b[0]);
    }
    report.strike[key] = { limb: STRIKE[key], first, pct: Math.round(any / n * 100), reach: +reach.toFixed(2) };
  }
  const bad = Object.entries(report.strike).filter(([k, r]) => !r.first || r.pct < 60 || r.reach < Math.min(C.moves[k].box[1], 1.5) * REACH[k]);
  assert.ok(!bad.length, 'outside the hitbox / short: ' + JSON.stringify(Object.fromEntries(bad)));
});
test('ult 死蓮: a key on every one of the 8 sim hit ticks; six alternating cuts (snap keys, L/R/L/R/L/R) inside the box, then 居合 — ticks 7 + 8 land with the blades going home (zan, sheathe 0.6 → 1, click)', () => {
  const m = C.moves.ult, [su, ac, rc] = m.t, n = m.multi, dt = ac / n, keys = PROFILE.moveKeys('ult', m), box = boxOf(m), limbs = [];
  assert.equal(n, 8);
  for (let i = 0; i < 6; i++) {
    const t = su + i * dt, k = keys.find((q) => Math.abs(q.t - t) < 1e-9 && q.e === 'snap'); assert.ok(k, 'ult cut ' + i + ' has a snap key on its tick');
    const li = limbAt('ult', keys, t); limbs.push(li);
    const { b, t: tp } = limbSeg(ev('ult', t), li); assert.ok(segRect(b, tp, box), `ult cut ${i} (limb ${li}) inside the box: ${b.map((v) => v.toFixed(2))} → ${tp.map((v) => v.toFixed(2))}`);
  }
  assert.deepEqual(limbs, [0, 1, 0, 1, 0, 1], 'the hands alternate'); report.ultLimbs = limbs;
  const k6 = keys.find((q) => Math.abs(q.t - (su + 6 * dt)) < 1e-9), k7 = keys.find((q) => Math.abs(q.t - (su + 7 * dt)) < 1e-9);
  assert.ok(k6 && k6.fx === 'zan' && k6.p.sh >= 0.5, 'tick 7: zan, blades half home');
  assert.ok(k7 && k7.fx.includes('zan') && k7.fx.includes('click') && k7.p.sh === 1, 'tick 8 (the 160 hit): zan + click, blades fully home');
  assert.ok(Math.abs(ev('ult', su + 7 * dt).sh - 1) < 1e-9, 'sheathed exactly on the last tick');
  assert.ok(ev('ult', su + 5.5 * dt).sh === 0, 'blades still drawn between cut 6 and the sheathe');
  const hz = keys.find((q) => q.p === FORMS.ult.Hz); assert.ok(hz && hz.e === 'hold' && hz.t - k7.t >= 0.1 && hz.t <= su + ac + rc, 'held finish ≥ 0.1 s inside the move');
  for (let t = k7.t; t <= hz.t; t += 0.01) assert.ok(ev('ult', t).sh === 1, 'blades stay home through the held finish');
  report.ultHold = +(hz.t - k7.t).toFixed(3);
});
test('hip-driven spins and the flip: a4 a whole turn (cuts on the way round), s2 back to the foe on the backstab then spin to face, ult ≥ 2 whole turns ending back-turned, air2 rolls into a forward flip', () => {
  const syAt = (key, t) => ev(key, t).sy;
  const a4 = C.moves.a4, a4k = PROFILE.moveKeys('a4', a4), a4sy = a4k.filter((k) => k.p !== 'from').map((k) => k.p.sy);
  assert.ok(Math.max(...a4sy) - Math.min(...a4sy) >= TAU, 'a4 turns ≥ 2π'); assert.ok(Math.abs(syAt('a4', a4.t[0])) > 0.5, 'a4 already turning on contact');
  const s2 = C.moves.s2; assert.ok(Math.abs(Math.abs(syAt('s2', s2.t[0])) - Math.PI) < 1e-6, 's2 backstab with the back to the foe (sy = π)');
  assert.ok(Math.abs(PROFILE.moveKeys('s2', s2).at(-1).p.sy - TAU) < 1e-9, 's2 spins on round to face (2π)');
  const u = C.moves.ult, usy = PROFILE.moveKeys('ult', u).filter((k) => k.p !== 'from').map((k) => k.p.sy);
  assert.ok(Math.max(...usy) - Math.min(...usy) >= 4 * Math.PI, 'ult ≥ two whole turns');
  assert.ok(Math.abs(Math.abs(syAt('ult', u.t[0] + 7 * u.t[1] / 8)) % TAU - Math.PI) < 1e-6, 'iaido finish with the back to the foe');
  const a2 = C.moves.air2, rr = PROFILE.moveKeys('air2', a2).filter((k) => k.p !== 'from').map((k) => k.p.rr);
  assert.ok(Math.max(...rr) >= TAU - 0.01 && Math.min(...rr) < 0, 'air2: lean back, then a full forward flip');
});
test('low stances: 忍び crouch guard, deep lunges on the s2 / ult contact, three-point landing', () => {
  const width = (p) => p.fFx - p.fBx;
  assert.ok(STANCE.py <= 0.76 && width(STANCE) >= 0.8 && STANCE.hB > 0.5, 'guard: low, wide, on the balls of the feet');
  for (const [nm, p] of [['s2.S', FORMS.s2.S], ['s2.T', FORMS.s2.T], ['ult.C5', FORMS.ult.C5], ['ult.W5', FORMS.ult.W5], ['a4.A', FORMS.a4.A]]) assert.ok(p.py <= 0.66 && width(p) >= 0.85, nm + ': deep low stance');
  const l = solve(POSES.land); assert.ok(POSES.land.py <= 0.6 && l.handF[1] < 0.5, 'three-point landing (lead fist on the floor)');
});
test('off-hand guard: on every single-blade grounded strike the other fist stays up by the face', () => {
  for (const [key, off] of [['a1', 'B'], ['a2', 'F'], ['s2', 'F']]) {
    const s = solve(FORMS[key].S), h = s['hand' + off], sh = s['sh' + off];
    report.guard = report.guard || {}; report.guard[key] = +(h[1] - s.head[1]).toFixed(2);
    assert.ok(h[1] > sh[1] - 0.05 && h[1] > s.head[1] - 0.35, `${key}: off hand up by the face (${h.map((v) => v.toFixed(2))} vs head ${s.head.map((v) => v.toFixed(2))})`);
  }
});
test('s1 影步: three kunai flicks alternate hands (lead / rear / lead) and each releases at the projectile spawn point', () => {
  const S = SCALE, m = C.moves.s1; report.throws = [];
  m.fire.forEach((fr, i) => { const s = solve(ev('s1', fr.at)), hand = i === 1 ? s.handB : s.handF, tx = 0.6 / S, ty = (1.35 + (fr.dy || 0)) / S, d = Math.hypot(hand[0] - tx, hand[1] - ty);
    report.throws.push(+d.toFixed(3)); assert.ok(d < 0.12, `kunai ${i + 1}: hand ${d.toFixed(3)} rig from the spawn point`); });
});
test('six-link power chain on the grounded blade strikes: feet → hips → torso → shoulder → elbow → blade snap peak in order', () => {
  const links = [['feet', ['fFx', 'fBx', 'hB', 'hF', 'fFy', 'kB', 'kF'], 'feet'], ['hips', ['tw', 'px', 'py'], 'hips'], ['torso', ['sp', 'ch'], 'torso'], ['shoulder', ['ctw'], 'shoulder']];
  const arm = { a1: 'F', a2: 'B' };
  for (const key of Object.keys(arm)) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m), dt = 1 / 4000, peak = {}, A = FORMS[key].A, S = FORMS[key].S;
    const kA = keys.find((k) => k.p === A).t, kS = keys.find((k) => k.p === S).t, H = arm[key];
    const peakOf = (f, off) => { const t0 = Math.max(0, kA - off), t1 = kS - off; let pt = 0, pv = -1, prev = f(ev(key, t0)); for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) { const v = f(ev(key, t)), sp = Math.abs(v - prev) / dt; if (sp > pv) { pv = sp; pt = t; } prev = v; } return +(pt * 1000).toFixed(1); };
    for (const [name, ch, li] of links) {
      let best = null, travel = 0; for (const q of ch) { const tr = Math.abs(S[q] - A[q]); if (tr > travel) { travel = tr; best = q; } }
      if (travel >= 0.05) peak[name] = peakOf((p) => p[best], CHAIN_LEAD[li] * PROFILE.lead);
    }
    const bk = 'e' + H; if (Math.abs(solve(S).bends[bk] - solve(A).bends[bk]) >= 0.05) peak.elbow = peakOf((p) => solve(p).bends[bk], CHAIN_LEAD.arm * PROFILE.lead);
    const rq = H === 'F' ? 'ga' : 'oa'; if (Math.abs(S[rq] - A[rq]) >= 0.05) peak.blade = peakOf((p) => p[rq], 0);
    report.chain[key] = peak;
    const seq = [...links.map(([n]) => n), 'elbow', 'blade'].map((n) => peak[n]).filter((v) => v !== undefined);
    assert.ok(seq.length >= 5, key + ': at least 5 links move ' + JSON.stringify(peak));
    for (let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1] - 0.3, `${key}: chain out of order ${JSON.stringify(peak)}`);
    assert.ok(peak.blade !== undefined && peak.blade >= Math.max(...seq) - 0.3, key + ': the blade snap lands last');
  }
  const keys = PROFILE.moveKeys('a2', C.moves.a2), t = C.moves.a2.t[0] - 0.01, plain = evalA(keys, t, STANCE, {}), ch = evalChain(keys, t, STANCE, {}, PROFILE.lead, true);
  assert.ok(Math.abs(ch.oa - plain.oa) < 1e-12 && Math.abs(ch.ga - plain.ga) < 1e-12 && Math.abs(ch.ox - plain.ox) > 1e-4, 'blade roll on time, the arm leads');
});
test('cues: every strike exhales or slides on contact; s2 / ult have the dash cues; a4 / air2 ring; win sheathes', () => {
  for (const key of ['a1', 'a2', 'a3', 'a4', 'air1', 'air2', 's2']) { const k = PROFILE.moveKeys(key, C.moves[key]).find((q) => q.p === contactPose(key)); assert.ok(k.fx && k.fx.includes('exhale'), key + ' exhales on contact'); }
  assert.ok(PROFILE.moveKeys('s2', C.moves.s2).some((k) => k.fx === 'slide'), 's2 burst lunge slides');
  for (const key of ['a4', 'air2']) assert.ok(PROFILE.moveKeys(key, C.moves[key]).some((k) => k.fx === 'ring'), key + ' ring');
  assert.equal(POSES.win.sh, 1); assert.equal(POSES.winD.sh, 1);
});
test('no snaps: an ε step never jumps any joint (from idle and from the a3 follow-through)', () => {
  const J = ['handF', 'handB', 'elbowF', 'elbowB', 'kneeF', 'kneeB', 'ankleF', 'ankleB', 'head'];
  for (const key of Object.keys(C.moves)) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m);
    for (const from of [POSES.idle1, normSnap(copyA(evalA(PROFILE.moveKeys('a3', C.moves.a3), 0.3, STANCE)))]) {
      let maxJ = 0;
      for (let t = 0; t < m.t[0] + m.t[1] + m.t[2] + 0.1; t += 1 / 960) {
        const a = solve(evalChain(keys, t, from, {}, PROFILE.lead, true)), b = solve(evalChain(keys, t + 1e-6, from, {}, PROFILE.lead, true));
        for (const j of J) maxJ = Math.max(maxJ, Math.hypot(b[j][0] - a[j][0], b[j][1] - a[j][1]) * SCALE);
      }
      assert.ok(maxJ < 0.002, `${key}: continuous joint paths (max ε-jump ${maxJ.toFixed(5)} m)`);
    }
  }
});
test('allocation-free solveInto matches core solve exactly on every Assassin form (planted feet, rolls)', () => {
  const J = makeJ(); let n = 0, maxE = 0;
  const cmp = (p, opts) => { const a = solve(p, opts), b = solveInto(p, opts.plantF || null, opts.plantB || null, J); n++;
    for (const k of ['pelvis', 'head', 'shF', 'shB', 'kneeF', 'ankleF', 'kneeB', 'ankleB', 'elbowF', 'handF', 'elbowB', 'handB', 'bladeDir', 'base', 'tip'])
      for (let i = 0; i < 3; i++) maxE = Math.max(maxE, Math.abs((a[k][i] ?? 0) - b[k][i])); };
  for (const [key, m] of Object.entries(C.moves)) { const keys = PROFILE.moveKeys(key, m), T = m.t[0] + m.t[1] + m.t[2] + 0.3;
    for (let t = 0; t <= T; t += 0.01) { const p = evalChain(keys, t, STANCE, {}, PROFILE.lead, true); cmp(p, {}); cmp(p, { plantF: [p.fFx + 0.05, 0.075, 0.1], plantB: [p.fBx - 0.04, 0.075, -0.1] }); } }
  for (const p of Object.values(POSES)) cmp(p, {});
  for (const [a, b] of [[POSES.stance, POSES.jump], [POSES.guard, POSES.rollB], [STANCE, POSES.win]]) for (let k = 0; k <= 1; k += 0.1) { const x = lerpPose(a, b, k, {}, false), y = lerpA(a, b, k); for (const q of POSE_KEYS) maxE = Math.max(maxE, Math.abs(x[q] - y[q])); }
  report.solveIntoSamples = n; report.solveIntoMaxErr = maxE; assert.ok(maxE < 1e-9, 'max deviation ' + maxE);
  // strikeSeg on a solveInto J writes the same segment as on a solve() result
  const p = ev('a2', C.moves.a2.t[0]), s = solve(p), o1 = { base: [0, 0, 0], tip: [0, 0, 0] }, o2 = { base: [0, 0, 0], tip: [0, 0, 0] };
  strikeSeg(s, p, 1, o1); strikeSeg(solveInto(p, null, null, J), p, 1, o2); for (let i = 0; i < 3; i++) assert.ok(Math.abs(o1.tip[i] - o2.tip[i]) < 1e-9);
});
test('gameplay untouched: every Assassin number (frame data, boxes, dmg, kb, launch, stun, stop, vx, vxT, inv, multi, last, fire, cd, chain, projectiles, combo, hp, walk) is the shipped value', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(C.moves)), SHIPPED.moves);
  assert.deepEqual(JSON.parse(JSON.stringify(C.projs)), SHIPPED.projs);
  for (const k of ['hp', 'walk', 'weight', 'reach', 'prefer', 'color', 'trim']) assert.equal(C[k], SHIPPED[k], k);
  assert.deepEqual(C.combo, SHIPPED.combo); assert.deepEqual(C.airCombo, SHIPPED.airCombo);
  assert.deepEqual(C.moves.ult.t, [0.14, 1, 0.45]); assert.equal(C.moves.ult.multi, 8); assert.deepEqual(C.moves.s2.box, [-0.2, 1.4, 0.4, 2.1]);
});
console.log(JSON.stringify(report));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
