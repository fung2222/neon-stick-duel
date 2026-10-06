// node tests/anime-brawler.test.mjs — anime Brawler forms (pure math). The "blade" of the Brawler is the striking limb (AnimeFighter.fistSeg:
// lead / rear fist = wrist → past the knuckles, elbow = upper arm → past the elbow point, knee = thigh → past the kneecap); it must sit
// inside the duel hitbox on the first active frame and on ≥ 60 % of the active frames (power chain applied), and on EVERY hit tick of
// the 9-hit ult. Plus: every pose solvable, contact keys on the first active frame, low stances, chambered fists on the wind-ups,
// off-hand guard on contact, the SIX-LINK power chain (feet → hips → torso → shoulder → elbow → fist roll) in order, exhale / quake
// cues, a held ult finish, no snaps, solveInto equality, and a guard that every Brawler gameplay number is still the shipped one.
import assert from 'node:assert/strict';
import { solve, POSE_KEYS, RIG_SCALE, lerpPose } from '../js/rig/core.js';
import { evalChain, evalA, AKEYS, normSnap, copyA, CHAIN_LEAD, lerpA } from '../js/anime/clip.js';
import { PROFILE, POSES, STANCE, FORMS, contactPose, STRIKE } from '../js/anime/brawler.js';
import { makeJ, solveInto } from '../js/anime/solve.js';
import { CLASSES, TUNE } from '../js/duel.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const SCALE = 1.2 * RIG_SCALE, C = CLASSES.brawler;
const ev = (key, t, from = STANCE) => evalChain(PROFILE.moveKeys(key, C.moves[key]), t, from, {}, PROFILE.lead, true);
const segRect = (a, b, r) => { for (let i = 0; i <= 40; i++) { const k = i / 40, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k; if (x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3]) return true; } return false; };
/** the striking segment (metres), same table as AnimeFighter.fistSeg */
const SEG = { 0: ['elbowF', 'handF', 0.85, 1.42], 1: ['elbowB', 'handB', 0.85, 1.42], 2: ['handF', 'elbowF', 0.62, 1.22], 3: ['handB', 'elbowB', 0.62, 1.22], 4: ['hipF', 'kneeF', 0.68, 1.14], 5: ['hipB', 'kneeB', 0.68, 1.14], 6: ['kneeF', 'ankleF', 0.9, 1.35] };
const limbSeg = (p, limb) => { const s = solve(p), [ja, jb, k0, k1] = SEG[limb], a = s[ja], b = s[jb]; return { b: [0, 1].map((i) => (a[i] + (b[i] - a[i]) * k0) * SCALE), t: [0, 1].map((i) => (a[i] + (b[i] - a[i]) * k1) * SCALE), s }; };
/** limb at time t: the move's STRIKE entry, or for 'auto' the last key tagged with a limb that started ≤ t + 0.02 (AnimeFighter.limbOf) */
const limbAt = (key, keys, t) => { const L = STRIKE[key]; if (L !== 'auto') return L; let li = 0; for (const k of keys) { if (k.t > t + 0.02) break; if (k.limb != null) li = k.limb; } return li; };
// shipped gameplay numbers (classes.js at 6e8e3a9) — the anime pass must not change a single one
const SHIPPED = {"hp":1080,"walk":2.85,"color":16742938,"trim":16769357,"combo":["a1","a2","a3","a4"],"moves":{"a1":{"kind":"basic","stop":0.05,"stun":0.32,"kb":1.6,"launch":0,"name":["刺拳","Jab"],"t":[0.06,0.07,0.16],"dmg":42,"box":[0,1.3,0.8,2],"vx":2,"chain":0.4,"pose":["brA0","brA1","brA1f"]},"a2":{"kind":"basic","stop":0.05,"stun":0.32,"kb":1.6,"launch":0,"name":["直拳","Cross"],"t":[0.07,0.07,0.18],"dmg":48,"box":[0,1.35,0.8,2],"vx":2.4,"chain":0.4,"pose":["brB0","brB1","brB1f"]},"a3":{"kind":"basic","stop":0.05,"stun":0.38,"kb":2.2,"launch":0,"name":["勾拳","Hook"],"t":[0.09,0.08,0.22],"dmg":60,"box":[0,1.35,0.6,2.1],"vx":2.6,"chain":0.42,"pose":["brC0","brC1","brC1f"]},"a4":{"kind":"basic","stop":0.09,"stun":0.6,"kb":1.2,"launch":10,"name":["昇天拳","Uppercut"],"t":[0.11,0.09,0.36],"dmg":84,"box":[-0.1,1.3,0.3,2.8],"vx":2,"chain":0.4,"pose":["brD0","brD1","brD1f"]},"air1":{"kind":"air","air":true,"stop":0.05,"stun":0.3,"kb":1.2,"launch":3.2,"name":["空中拳","Air punch"],"t":[0.05,0.09,0.15],"dmg":44,"box":[-0.1,1.3,-0.4,1.8],"chain":0.45,"pose":["airA0","brAir","airA1f"]},"air2":{"kind":"air","air":true,"stop":0.09,"stun":0.3,"kb":2,"launch":0,"name":["鐵鎚擊","Hammer fist"],"t":[0.08,0.1,0.26],"dmg":64,"box":[-0.2,1.4,-1,1.4],"spike":-14,"pose":["airB0","brHammer","airB1f"]},"s1":{"kind":"skill","stop":0.1,"stun":0.55,"kb":7,"launch":0,"name":["火箭衝拳","Rocket Rush"],"tag":"closer","t":[0.15,0.24,0.34],"dmg":118,"box":[0,1.4,0.6,2.1],"vx":20,"vxT":[0.13,0.39],"armor":[0.1,0.33],"cd":6.5,"pose":["brB0","rocket","brB1f"]},"s2":{"kind":"skill","stop":0.1,"stun":0.6,"kb":3,"launch":8.5,"name":["震地拳","Quake Slam"],"tag":"aoe","t":[0.2,0.12,0.38],"dmg":112,"box":[-2.3,2.3,-0.2,1.1],"groundOnly":true,"cd":7,"pose":["quake0","quake","quakef"]},"ult":{"kind":"ult","stop":0.06,"stun":0.5,"kb":0.6,"launch":0,"unblockable":false,"name":["百裂拳","Hundred Fists"],"t":[0.12,1.1,0.5],"dmg":34,"box":[-0.3,1.8,0,2.6],"vx":13,"vxT":[0.1,0.33],"armor":[0,0.3],"multi":9,"last":{"dmg":170,"kb":9,"launch":9,"stun":0.9,"stop":0.18},"inv":[0,1.72],"pose":["ult0","ultFists","brD1f"]}}};
export const report = { strike: {}, chain: {} };

test('every Brawler pose has all channels and solves; fists (no finger / focus / sigil / blink channels in use); grounded feet reach the floor; head above pelvis', () => {
  const all = { ...POSES }; for (const [k, m] of Object.entries(FORMS)) for (const [q, p] of Object.entries(m)) all[k + '.' + q] = p;
  for (const [name, p] of Object.entries(all)) {
    for (const q of AKEYS) assert.ok(Number.isFinite(p[q]), name + ' missing ' + q);
    for (const q of ['cF1', 'cF2', 'cB1', 'cB2']) assert.equal(p[q], 1, name + ' ' + q + ': closed fist');
    for (const q of ['oh', 'sh', 'gw', 'fr', 'fs', 'gs', 'zz', 'sy']) assert.equal(p[q], 0, name + ' ' + q + ' unused (0)');
    const s = solve(p);
    for (const [k, v] of Object.entries(s.bends)) assert.ok(v >= 0 && v <= 2.65, `${name} ${k} bend ${v.toFixed(2)}`);
    if (p.fFy <= 0.08 && p.fBy <= 0.08 && !p.rr) for (const [an, t] of [[s.ankleF, [p.fFx, p.fFy]], [s.ankleB, [p.fBx, p.fBy]]]) assert.ok(Math.hypot(an[0] - t[0], an[1] - t[1]) < 0.025, `${name}: foot reaches the floor (${Math.hypot(an[0] - t[0], an[1] - t[1]).toFixed(3)})`);
    if (Math.abs(p.rr) < 0.3) assert.ok(s.head[1] > s.pelvis[1] + 0.45, name + ' head above pelvis');
  }
});
test('forms: every Brawler move has a form, keys sorted, contact key exactly on the first active frame', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    const keys = PROFILE.moveKeys(key, m); assert.ok(keys, key + ' has a form');
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i].t >= keys[i - 1].t, key + ' keys sorted');
    const s = keys.find((k) => k.p === contactPose(key)); assert.ok(s && Math.abs(s.t - m.t[0]) < 1e-9, key + ' contact at startup end');
  }
});
// minimum horizontal reach of the striking surface (× min(box x1, 1.5 m)): straight punches reach far, elbows / knees / uppercut / hammer are close-range
const REACH = { a1: 0.85, a2: 0.85, s1: 0.85, ult: 0.6, a3: 0.45, a4: 0.45, air1: 0.4, air2: 0.4, s2: 0.4 };
test('striking limb (fist / elbow / knee) inside the hitbox on the first active frame and ≥ 60 % of active frames (power chain applied)', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    const keys = PROFILE.moveKeys(key, m), [su, ac] = m.t, box = [m.box[0], m.box[1] + TUNE.halfW, m.box[2], m.box[3]];
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
test('ult Hundred Fists: a contact key on each of the 9 sim hit ticks (su + i·ac/9), the tagged limb inside the box on every tick: 6 chain punches → elbow → knee → stomp-punch', () => {
  const m = C.moves.ult, [su, ac] = m.t, n = m.multi, dt = ac / n, keys = PROFILE.moveKeys('ult', m), box = [m.box[0], m.box[1] + TUNE.halfW, m.box[2], m.box[3]], limbs = [];
  for (let i = 0; i < n; i++) {
    const t = su + i * dt, k = keys.find((q) => Math.abs(q.t - t) < 1e-9 && q.e === 'snap'); assert.ok(k, 'ult hit ' + i + ' has a snap key on its tick');
    const li = limbAt('ult', keys, t); limbs.push(li);
    const { b, t: tp } = limbSeg(ev('ult', t), li); assert.ok(segRect(b, tp, box), `ult hit ${i} (limb ${li}) inside the box: ${b.map((v) => v.toFixed(2))} → ${tp.map((v) => v.toFixed(2))}`);
  }
  assert.deepEqual(limbs, [0, 1, 0, 1, 0, 1, 2, 5, 1], 'chain punches L/R ×3, lead elbow, rear knee, rear stomp-punch');
  report.ultLimbs = limbs;
});
test('low stances: 子午馬 guard, horse stance on the slam / ult finish / a4 coil, bow stance on the cross and the rocket; golden rooster on the s2 wind-up', () => {
  const width = (p) => p.fFx - p.fBx;
  assert.ok(STANCE.py <= 0.8 && width(STANCE) >= 0.75 && STANCE.kB > 0.2, 'guard: low and wide, rear knee splayed');
  for (const [nm, p] of [['s2.S', FORMS.s2.S], ['ult.C8', FORMS.ult.C8], ['a4.A', FORMS.a4.A]]) assert.ok(p.py <= 0.64 && width(p) >= 0.9 && p.kF < 0 && p.kB > 0.5, nm + ': deep horse stance, knees out');
  for (const [nm, p] of [['a2.S', FORMS.a2.S], ['s1.S', FORMS.s1.S]]) { const s = solve(p); assert.ok(width(p) >= 1.0 && p.hB > 0.5 && s.bends.kF > s.bends.kB, nm + ': bow stance (front knee bent, back leg long, rear heel up)'); }
  const r = FORMS.s2.A; assert.ok(r.fFy > 0.4 && r.gy > 1.8 && r.oy > 1.8, 's2.A: golden rooster, knee high, fists overhead');
});
test('chambered fists on the wind-ups (palm up at the hip) and the off hand guarding the chin on contact', () => {
  for (const [key, hand, roll] of [['a2', 'handB', 'oa'], ['a4', 'handB', 'oa'], ['s1', 'handF', 'ga']]) {
    const A = FORMS[key].A, s = solve(A), sh = hand === 'handF' ? s.shF : s.shB;
    assert.ok(s[hand][1] < sh[1] - 0.15 && A[roll] >= Math.PI * 0.8, `${key}.A: striking fist chambered low, palm up (${s[hand].map((v) => v.toFixed(2))}, roll ${A[roll].toFixed(2)})`);
  }
  for (const [key, off] of [['a1', 'B'], ['a2', 'F'], ['a4', 'F'], ['s1', 'B'], ['ult', 'B']]) {
    const p = key === 'ult' ? FORMS.ult.CF : FORMS[key].S, s = solve(p), h = s['hand' + off], sh = s['sh' + off];
    assert.ok(h[1] > sh[1] && h[1] > s.head[1] - 0.3 && h[0] > s.head[0] - 0.02, `${key}: off hand up in front of the chin (${h.map((v) => v.toFixed(2))} vs head ${s.head.map((v) => v.toFixed(2))})`);
  }
  // straight punches really are straight: the striking elbow is nearly locked on contact and locked at full extension
  for (const [nm, p, e, max] of [['a1.S', FORMS.a1.S, 'eF', 0.55], ['a1.E', FORMS.a1.E, 'eF', 0.4], ['a2.S', FORMS.a2.S, 'eB', 0.55], ['a2.E', FORMS.a2.E, 'eB', 0.4], ['s1.S', FORMS.s1.S, 'eF', 0.55], ['s1.E', FORMS.s1.E, 'eF', 0.4],
    ['ult.CF', FORMS.ult.CF, 'eF', 0.55], ['ult.CB', FORMS.ult.CB, 'eB', 0.55], ['ult.C8', FORMS.ult.C8, 'eB', 0.55], ['ult.E8', FORMS.ult.E8, 'eB', 0.4]]) {
    const b = solve(p).bends[e]; report.elbow = report.elbow || {}; report.elbow[nm] = +b.toFixed(2); assert.ok(b <= max, `${nm}: straight punch, elbow bend ${b.toFixed(2)} ≤ ${max}`);
  }
});
test('six-link power chain on the grounded strikes: feet → hips → torso → shoulder → elbow → fist (corkscrew roll, on time) peak in order', () => {
  const links = [['feet', ['fFx', 'fBx', 'hB', 'hF', 'fFy', 'kB', 'kF'], 'feet'], ['hips', ['tw', 'px', 'py'], 'hips'], ['torso', ['sp', 'ch'], 'torso'], ['shoulder', ['ctw'], 'shoulder']];
  const arm = { a1: 'F', a2: 'B', a3: 'F', a4: 'B', s1: 'F', s2: 'F' };
  for (const key of Object.keys(arm)) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m), dt = 1 / 4000, peak = {}, A = key === 's2' ? FORMS.s2.B : FORMS[key].A2 || FORMS[key].A, S = FORMS[key].S;
    const kA = keys.find((k) => k.p === A).t, kS = keys.find((k) => k.p === S).t, H = arm[key];
    const peakOf = (f, off) => { const t0 = Math.max(0, kA - off), t1 = kS - off; let pt = 0, pv = -1, prev = f(ev(key, t0)); for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) { const v = f(ev(key, t)), sp = Math.abs(v - prev) / dt; if (sp > pv) { pv = sp; pt = t; } prev = v; } return +(pt * 1000).toFixed(1); };
    for (const [name, ch, li] of links) {
      let best = null, travel = 0; for (const q of ch) { const tr = Math.abs(S[q] - A[q]); if (tr > travel) { travel = tr; best = q; } }
      if (travel >= 0.05) peak[name] = peakOf((p) => p[best], CHAIN_LEAD[li] * PROFILE.lead);
    }
    const bk = 'e' + H; if (Math.abs(solve(S).bends[bk] - solve(A).bends[bk]) >= 0.05) peak.elbow = peakOf((p) => solve(p).bends[bk], CHAIN_LEAD.arm * PROFILE.lead);
    const rq = H === 'F' ? 'ga' : 'oa'; if (Math.abs(S[rq] - A[rq]) >= 0.05) peak.fist = peakOf((p) => p[rq], 0);
    report.chain[key] = peak;
    const seq = [...links.map(([n]) => n), 'elbow', 'fist'].map((n) => peak[n]).filter((v) => v !== undefined);
    assert.ok(seq.length >= (key === 's2' ? 4 : 5), key + ': at least 5 links move (4 on the slam) ' + JSON.stringify(peak));
    for (let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1] - 0.3, `${key}: chain out of order ${JSON.stringify(peak)}`);
    if (key !== 's2') assert.ok(peak.fist !== undefined && peak.fist >= Math.max(...seq) - 0.3, key + ': the fist snap lands last');
  }
});
test('exhale snap + 震腳: every grounded strike exhales on contact; a3 / s2 / ult finish stamp with a quake; the ult finish is HELD', () => {
  for (const key of ['a1', 'a2', 'a3', 'a4', 'air1', 'air2', 's1', 's2']) { const k = PROFILE.moveKeys(key, C.moves[key]).find((q) => q.p === contactPose(key)); assert.ok(k.fx && k.fx.includes('exhale'), key + ' exhales on contact'); }
  for (const key of ['a3', 's2']) assert.ok(PROFILE.moveKeys(key, C.moves[key]).find((q) => q.p === contactPose(key)).fx.includes('quake'), key + ' 震腳 quake');
  const m = C.moves.ult, T = m.t, keys = PROFILE.moveKeys('ult', m), last = keys.find((k) => Math.abs(k.t - (T[0] + 8 * T[1] / 9)) < 1e-9 && k.e === 'snap');
  assert.ok(last.fx.includes('quakeX') && last.fx.includes('exhale') && last.limb === 1, 'ult last hit: big quake + exhale, rear fist');
  const H = keys.filter((k) => k.p === FORMS.ult.Hz); assert.ok(H.length === 2 && H[1].t - H[0].t >= 0.1 && H[1].e === 'hold', 'ult held finish ≥ 0.1 s'); assert.ok(H[1].t <= T[0] + T[1] + T[2], 'held inside the move');
  const a4 = PROFILE.moveKeys('a4', C.moves.a4).filter((k) => k.p === FORMS.a4.H); assert.ok(a4.length && a4[0].e === 'hold', 'a4 rising finish held');
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
test('allocation-free solveInto matches core solve exactly on every Brawler form (planted feet, rolls)', () => {
  const J = makeJ(); let n = 0, maxE = 0;
  const cmp = (p, opts) => { const a = solve(p, opts), b = solveInto(p, opts.plantF || null, opts.plantB || null, J); n++;
    for (const k of ['pelvis', 'head', 'shF', 'shB', 'kneeF', 'ankleF', 'kneeB', 'ankleB', 'elbowF', 'handF', 'elbowB', 'handB', 'bladeDir', 'base', 'tip'])
      for (let i = 0; i < 3; i++) maxE = Math.max(maxE, Math.abs((a[k][i] ?? 0) - b[k][i])); };
  for (const [key, m] of Object.entries(C.moves)) { const keys = PROFILE.moveKeys(key, m), T = m.t[0] + m.t[1] + m.t[2] + 0.3;
    for (let t = 0; t <= T; t += 0.01) { const p = evalChain(keys, t, STANCE, {}, PROFILE.lead, true); cmp(p, {}); cmp(p, { plantF: [p.fFx + 0.05, 0.075, 0.1], plantB: [p.fBx - 0.04, 0.075, -0.1] }); } }
  for (const p of Object.values(POSES)) cmp(p, {});
  for (const [a, b] of [[POSES.stance, POSES.jump], [POSES.guard, POSES.rollB], [STANCE, POSES.win]]) for (let k = 0; k <= 1; k += 0.1) { const x = lerpPose(a, b, k, {}, false), y = lerpA(a, b, k); for (const q of POSE_KEYS) maxE = Math.max(maxE, Math.abs(x[q] - y[q])); }
  report.solveIntoSamples = n; report.solveIntoMaxErr = maxE; assert.ok(maxE < 1e-9, 'max deviation ' + maxE);
});
test('fist chain variant: the fist roll (ga / oa) is exactly on time, the hand targets keep the arm lead; Swordsman / Mage chain unchanged', () => {
  const keys = PROFILE.moveKeys('a2', C.moves.a2), t = C.moves.a2.t[0] - 0.01;
  const plain = evalA(keys, t, STANCE, {}), fist = evalChain(keys, t, STANCE, {}, PROFILE.lead, true), old = evalChain(keys, t, STANCE, {}, PROFILE.lead);
  assert.ok(Math.abs(fist.oa - plain.oa) < 1e-12 && Math.abs(fist.ga - plain.ga) < 1e-12, 'roll on time');
  assert.ok(Math.abs(fist.ox - plain.ox) > 1e-4 && Math.abs(old.oa - plain.oa) > 1e-6, 'arm leads; the default chain still leads oa');
});
test('gameplay untouched: every Brawler number (frame data, boxes, dmg, kb, launch, stun, stop, vx, vxT, armor, inv, multi, last, cd, chain, combo, hp, walk) is the shipped value', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(C.moves)), SHIPPED.moves);
  for (const k of ['hp', 'walk', 'color', 'trim']) assert.equal(C[k], SHIPPED[k], k);
  assert.deepEqual(C.combo, SHIPPED.combo);
  assert.deepEqual(C.moves.ult.t, [0.12, 1.1, 0.5]); assert.equal(C.moves.ult.multi, 9); assert.deepEqual(C.moves.s1.box, [0, 1.4, 0.6, 2.1]);
});
console.log(JSON.stringify(report));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
