// node tests/anime-shogun.test.mjs — anime KAGE-SHŌGUN forms (pure math, HANDOFF §16 steps 2–4). Nodachi = solve tip ×
// NODACHI_K about the grip, then scaled by the fight-10 ladder scale (1.34) so the tip lands on the sim's 1.8–2.4 m boxes.
// Contact keys on the first active frame; data blades launch on the Rain fire frame; mask tile calm/focus (phase 1) →
// broken/flare (phase 2); gameplay guard against the shipped boss table.
import assert from 'node:assert/strict';
import { solve, RIG_SCALE } from '../js/rig/core.js';
import { evalChain, evalA, AKEYS, normSnap, copyA, CHAIN_LEAD, lerpA, spinPt } from '../js/anime/clip.js';
import { PROFILE, POSES, STANCE, FORMS, ULT_FORMS, contactPose, nodachi, maskTile, corruptK, warpT, dataBlades, dbSlots, DB, transitionKeys, TRANSITION } from '../js/anime/shogun.js';
import { NODACHI_K, MASK, SAYA } from '../js/anime/shogun-body.js';
import { animeCfg, SHOGUN_INTERIM, ANIME_CLASSES } from '../js/anime/configs.js';
import { makeJ, solveInto } from '../js/anime/solve.js';
import { CLASSES, TUNE } from '../js/duel.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const BOSS_SCALE = 1.34, SCALE = 1.2 * RIG_SCALE * BOSS_SCALE, C = CLASSES.shogun, TAU = Math.PI * 2;
const ev = (key, t, from = STANCE) => evalChain(PROFILE.moveKeys(key, C.moves[key]), t, from, {}, PROFILE.lead);
const segRect = (a, b, r) => { for (let i = 0; i <= 40; i++) { const k = i / 40, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k; if (x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3]) return true; } return false; };
/** nodachi segment in metres (spin + NODACHI_K + ladder scale) — same math as AnimeFighter with bladeK */
const blade = (p) => { const J = makeJ(); solveInto(p, null, null, J); nodachi(J, NODACHI_K);
  const b = spinPt(J.base, p.sy || 0, p.pv || 0), t = spinPt(J.tip, p.sy || 0, p.pv || 0);
  return { b: [b[0] * SCALE, b[1] * SCALE], t: [t[0] * SCALE, t[1] * SCALE] }; };
const boxOf = (m) => [m.box[0], m.box[1] + TUNE.halfW, m.box[2], m.box[3]];
const SHIPPED = {"hp":1000,"walk":2.55,"weight":1.3,"reach":1.75,"prefer":2.4,"color":16720960,"trim":16765656,"combo":["a1","a2","a3"],"airCombo":[],"phases":{"at":0.5,"transT":1.2,"names":[["秩序","ORDER"],["崩壞","COLLAPSE"]]},"moves":{"a1":{"kind":"basic","stop":0.05,"stun":0.32,"kb":1.6,"launch":0,"name":["袈裟斬","Kesa Cut"],"t":[0.2,0.08,0.28],"dmg":48,"box":[0,1.8,0.4,2.1],"vx":2,"chain":0.5,"pose":["swA0","swA1","swA1f"]},"a2":{"kind":"basic","stop":0.05,"stun":0.32,"kb":1.6,"launch":0,"name":["逆袈裟","Rising Kesa"],"t":[0.18,0.08,0.28],"dmg":52,"box":[0,1.8,0.4,2.2],"vx":2,"chain":0.5,"pose":["swB0","swB1","swB1f"]},"a3":{"kind":"basic","stop":0.07,"stun":0.45,"kb":3.2,"launch":0,"name":["唐竹割","Karatake Split"],"t":[0.26,0.1,0.42],"dmg":66,"box":[0,1.75,0.2,2.4],"vx":1.6,"pose":["swD0","swD1","swD1f"]},"iai":{"kind":"skill","stop":0.1,"stun":0.6,"kb":5,"launch":0,"callout":true,"name":["居合裁き","Iai Judgement"],"phase":1,"t":[0.62,0.08,0.55],"flash":0.42,"dmg":120,"box":[0.2,5.6,0.1,1.55],"cd":4.5,"pose":["swC0","lunge","swC1f"]},"ten1":{"kind":"skill","stop":0.08,"stun":0.36,"kb":3.4,"launch":0,"callout":true,"name":["十歩詰め","Ten-Step Advance"],"phase":1,"t":[0.3,0.08,0.14],"dmg":46,"box":[0,1.85,0.3,2.1],"vx":3.4,"vxT":[0.04,0.36],"cd":6,"follow":"ten2","pose":["swA0","swA1","swA1f"]},"ten2":{"kind":"skill","stop":0.08,"stun":0.36,"kb":3.4,"launch":0,"callout":false,"name":["十歩詰め・二","Ten-Step II"],"sub":true,"t":[0.26,0.08,0.14],"dmg":46,"box":[0,1.85,0.3,2.1],"vx":3.4,"vxT":[0.02,0.32],"follow":"ten3","pose":["swB0","swB1","swB1f"]},"ten3":{"kind":"skill","stop":0.1,"stun":0.5,"kb":7,"launch":0,"callout":false,"name":["十歩詰め・終","Ten-Step Finale"],"sub":true,"t":[0.3,0.1,0.5],"dmg":66,"box":[0,1.95,0.2,2.2],"vx":3.6,"vxT":[0.02,0.38],"pose":["swD0","swD1","swD1f"]},"mirror":{"kind":"skill","stop":0.08,"stun":0.45,"kb":3,"launch":0,"callout":true,"name":["鏡受け","Mirror Guard"],"phase":1,"t":[0.1,0.95,0.42],"dmg":0,"parry":[0.08,1.05],"counter":"mcut","cd":6.5,"pose":["guard","guard","guard"]},"mcut":{"kind":"skill","stop":0.1,"stun":0.55,"kb":5,"launch":0,"callout":true,"name":["鏡返し","Mirror Return"],"sub":true,"t":[0.34,0.1,0.4],"dmg":100,"box":[-0.2,2,0.2,2.3],"pose":["swC0","swC1","swC1f"]},"rain":{"kind":"skill","stop":0.08,"stun":0.45,"kb":3,"launch":0,"callout":true,"name":["數據刃雨","Data-Blade Rain"],"phase":2,"t":[0.45,0.1,0.5],"dmg":0,"vx":-4.2,"vxT":[0.02,0.3],"cd":7,"fire":[{"at":0.4,"type":"rain","proj":"dblade","n":6,"gap":1.8,"delay":0.6,"step":0.13}],"pose":["swD0","dragon","swD1f"]},"glitch":{"kind":"skill","stop":0.09,"stun":0.5,"kb":4,"launch":0,"callout":true,"name":["故障步","Glitch Step"],"phase":2,"t":[0.62,0.1,0.42],"dmg":88,"box":[-0.2,1.9,0.3,2.2],"inv":[0,0.4],"cd":5,"fire":[{"at":0.04,"type":"decoy","side":-1,"dist":2.1,"life":0.34},{"at":0.18,"type":"decoy","side":1,"dist":1.15,"life":0.3},{"at":0.36,"type":"teleport","behind":true,"maxDist":9}],"pose":["blink0","swA1","swA1f"]},"ult":{"kind":"ult","stop":0.06,"stun":0.5,"kb":0.6,"launch":0,"unblockable":false,"name":["千刃斬・鏡","Thousand Edges Mirrored"],"phase":2,"t":[0.26,0.81,0.14],"dmg":28,"box":[-0.6,2.3,0,2.6],"vx":19.5,"vxT":[0.22,0.42],"multi":7,"last":{"dmg":40,"kb":1.5,"stun":0.6},"inv":[0,1],"follow":"ultEnd","pose":["ult0","ultSword","swD1f"]},"ultEnd":{"kind":"ult","stop":0.12,"stun":0.9,"kb":8,"launch":7,"unblockable":false,"name":["千刃斬・鏡　終之型","Mirrored Finale"],"sub":true,"callout":true,"t":[0.5,0.1,0.6],"dmg":140,"box":[-0.3,2.4,0,2.8],"pose":["swD0","swD1","swD1f"]}},"projs":{"dblade":{"dmg":62,"v":0,"life":0.14,"r":0.32,"y":0,"h":3,"kb":2.2,"stun":0.42,"stop":0.06},"decoy":{"dmg":0,"v":0,"life":0.32,"r":0.4,"y":0,"harmless":true}}};
export const report = { strike: {}, chain: {} };
const allPoses = () => { const all = { ...POSES }; for (const [k, m] of Object.entries(FORMS)) for (const [q, p] of Object.entries(m)) all[k + '.' + q] = p;
  for (const [q, p] of Object.entries(ULT_FORMS.C.reduce((o, p, i) => (o['ult.C' + i] = p, o), {}))) all[q] = p;
  for (const [q, p] of Object.entries(TRANSITION)) all['trans.' + q] = p; return all; };

test('every Shogun pose has all channels and solves; grounded feet reach the floor; head above pelvis', () => {
  for (const [name, p] of Object.entries(allPoses())) {
    for (const q of AKEYS) assert.ok(Number.isFinite(p[q]), name + ' missing ' + q);
    const s = solve(p);
    for (const [k, v] of Object.entries(s.bends)) assert.ok(v >= 0 && v <= 2.65, `${name} ${k} bend ${v.toFixed(2)}`);
    if (p.fFy <= 0.08 && p.fBy <= 0.08 && !p.rr) for (const [an, t] of [[s.ankleF, [p.fFx, p.fFy]], [s.ankleB, [p.fBx, p.fBy]]]) assert.ok(Math.hypot(an[0] - t[0], an[1] - t[1]) < 0.03, `${name}: foot reaches the floor (${Math.hypot(an[0] - t[0], an[1] - t[1]).toFixed(3)})`);
    if (Math.abs(p.rr % TAU) < 0.3) assert.ok(s.head[1] > s.pelvis[1] + 0.4, name + ' head above pelvis');
  }
});
test('forms: every boss move has a form, keys sorted, contact key exactly on the first active frame', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    const keys = PROFILE.moveKeys(key, m); assert.ok(keys, key + ' has a form');
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i].t >= keys[i - 1].t, key + ' keys sorted');
    if (key === 'mirror') { const s = keys.find((k) => k.p === contactPose(key)); assert.ok(s && Math.abs(s.t - m.t[0]) < 1e-9, 'mirror contact at startup end'); continue; }
    if (key === 'rain') { const fire = m.fire[0].at; assert.ok(keys.some((k) => Math.abs(k.t - fire) < 1e-9 || (k.t <= fire && keys.find((q) => q.t > fire))), 'rain holds through fire'); continue; }
    const s = keys.find((k) => k.p === contactPose(key)); assert.ok(s && Math.abs(s.t - m.t[0]) < 1e-9, key + ' contact at startup end');
  }
});
test('nodachi inside the hitbox on the first active frame and ≥ 60 % of active frames (NODACHI_K + ladder scale 1.34)', () => {
  for (const [key, m] of Object.entries(C.moves)) {
    if (!m.box) continue;
    const keys = PROFILE.moveKeys(key, m), [su, ac] = m.t, box = boxOf(m);
    let first = false, any = 0, n = 0, reach = 0;
    for (let i = 0; i <= 10; i++) {
      const t = su + ac * i / 10, { b, t: tp } = blade(ev(key, t));
      const hit = segRect(b, tp, box); if (i === 0) first = hit; any += hit; n++; reach = Math.max(reach, tp[0], b[0]);
    }
    report.strike[key] = { first, pct: Math.round(any / n * 100), reach: +reach.toFixed(2) };
  }
  // Iai is a screen-wide draw (box to 5.6 m); the visual tip only needs to clear ~1.5 m into the zone
  const bad = Object.entries(report.strike).filter(([k, r]) => !r.first || r.pct < 60 || r.reach < Math.min(C.moves[k].box[1], 1.5) * 0.7);
  assert.ok(!bad.length, 'outside the hitbox / short: ' + JSON.stringify(Object.fromEntries(bad)));
});
test('ult 千刃斬・鏡: a snap key on every one of the 7 sim hit ticks with the nodachi inside the box', () => {
  const m = C.moves.ult, [su, ac] = m.t, n = m.multi, dt = ac / n, keys = PROFILE.moveKeys('ult', m), box = boxOf(m);
  assert.equal(n, 7);
  for (let i = 0; i < n; i++) {
    const t = su + i * dt, k = keys.find((q) => Math.abs(q.t - t) < 1e-9 && q.e === 'snap'); assert.ok(k, 'ult cut ' + i + ' has a snap key on its tick');
    const { b, t: tp } = blade(ev('ult', t)); assert.ok(segRect(b, tp, box), `ult cut ${i} inside the box: ${b.map((v) => v.toFixed(2))} → ${tp.map((v) => v.toFixed(2))}`);
  }
  assert.ok(PROFILE.moveKeys('ultEnd', C.moves.ultEnd), 'ultEnd form exists');
});
test('居合 flash: coil held to the flash, koiguchi click cue, then the draw on the first active frame', () => {
  const m = C.moves.iai, keys = PROFILE.moveKeys('iai', m), fl = m.flash;
  const click = keys.find((k) => k.fx && k.fx.includes('click')); assert.ok(click && Math.abs(click.t - fl) < 1e-9, 'click on the flash');
  const contact = keys.find((k) => k.p === contactPose('iai')); assert.ok(contact && Math.abs(contact.t - m.t[0]) < 1e-9 && contact.fx && contact.fx.includes('stamp'), 'draw on contact');
  // still in the coil just before the flash
  const pre = ev('iai', fl - 0.05); assert.ok(pre.py < 0.72 && pre.oh === 0, 'iai still sunk one-handed before the flash');
});
test('data blades: fan in phase 2, unfold on the transition, launch on the Rain fire frame and fall onto the markers', () => {
  const slots = dbSlots(), out = Array.from({ length: DB.n }, () => ({ x: 0, y: 0, z: 0, a: 0, roll: 0, k: 0 }));
  const c = { phase: 1, st: 'idle', ft: 0, mk: null, x: 0, y: 0, facing: 1, s: BOSS_SCALE, T: 1, dt: 1 / 60, projs: [null, null, null, null, null, null], cloak: false };
  dataBlades(c, slots, out); assert.ok(out.every((o) => o.k === 0), 'phase 1: blades hidden');
  c.phase = 2; dataBlades(c, slots, out); assert.ok(out.every((o) => o.k > 0.9), 'phase 2 idle: full fan');
  c.st = 'phase'; c.ft = 0.55; for (const sl of slots) { sl.mode = 0; sl.t = 0; }
  dataBlades(c, slots, out); assert.ok(out.some((o) => o.k > 0.2) && out.some((o) => o.k < 0.9), 'transition unfolds the fan over time');
  // Rain: six markers delay 0.6, 0.73, … — blades enter flight mode 1 and track the marker x
  c.st = 'atk'; c.mk = 'rain'; c.ft = 0.4; c.phase = 2;
  for (let i = 0; i < 6; i++) c.projs[i] = { x: 1.5 + i * 1.8, delay: 0.6 - i * 0.0, delay0: 0.6, dead: false };
  for (const sl of slots) { sl.mode = 0; sl.t = 0; }
  dataBlades(c, slots, out);
  assert.ok(slots.every((sl) => sl.mode === 1), 'Rain fire: every blade launched');
  assert.ok(out.every((o) => o.k === 1), 'launched blades at full size');
  // drop in the last 0.22 s: tip lands on the marker
  for (let i = 0; i < 6; i++) c.projs[i].delay = 0.05;
  dataBlades(c, slots, out);
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(out[i].x - c.projs[i].x) < 0.01 && out[i].a < -1.4, `blade ${i} falling onto marker`);
});
test('mask state: calm / focus in phase 1, broken / flare in phase 2; corruption ramps through the transition', () => {
  assert.equal(maskTile(1, 'idle', 0), MASK.calm); assert.equal(maskTile(1, 'atk', 0.1), MASK.focus);
  assert.equal(maskTile(2, 'idle', 0), MASK.broken); assert.equal(maskTile(2, 'atk', 0.1), MASK.flare);
  assert.equal(corruptK(1, 'idle', 0), 0); assert.equal(corruptK(2, 'idle', 0), 1);
  const mid = corruptK(2, 'phase', 0.5, 1.2); assert.ok(mid > 0.2 && mid < 0.9, 'transition mid corruption ' + mid);
  const keys = transitionKeys(1.2); assert.ok(keys.length >= 5 && keys.at(-1).t === 1.2);
});
test('phase-2 warpT: contact frame exact, startup may stutter, never later than su − 0.04, monotonic ≤ t', () => {
  for (const key of ['glitch', 'rain', 'ult', 'a1']) {
    const m = C.moves[key], su = m.t[0], T = su + m.t[1] + m.t[2];
    assert.equal(warpT(su, m, 2, 0), su); assert.equal(warpT(su + 0.05, m, 2, 1), su + 0.05);
    assert.equal(warpT(0.3, m, 1, 0), 0.3);   // phase 1: identity
    let prev = 0;
    for (let t = 0; t <= su; t += 1 / 60) { const w = warpT(t, m, 2, 7); assert.ok(w <= t + 1e-12 && w <= su - 0.04 + 1e-9 || t >= su - 0.04, 'warp bound'); assert.ok(w + 1e-12 >= prev, 'monotonic'); prev = w; }
  }
});
test('iai flash cue + rain fire + glitch teleport times match the sim frame data', () => {
  assert.equal(C.moves.iai.flash, 0.42);
  assert.equal(C.moves.rain.fire[0].at, 0.4); assert.equal(C.moves.rain.fire[0].n, 6);
  const tp = C.moves.glitch.fire.find((f) => f.type === 'teleport'); assert.equal(tp.at, 0.36);
  assert.ok(Math.abs(SAYA.L - 1.24) < 1e-9 && NODACHI_K === 1.27);
  assert.equal(PROFILE.bladeK, NODACHI_K); assert.ok(PROFILE.boss && PROFILE.ghosts);
});
test('config: real shogun is the default for fight 10; interim kept as fallback', () => {
  const cfg = animeCfg('shogun'); assert.equal(cfg.build, 'shogun'); assert.ok(!cfg.interim); assert.equal(cfg.weapon.type, 'nodachi');
  assert.equal(ANIME_CLASSES.shogun.build, 'shogun'); assert.ok(SHOGUN_INTERIM.interim); assert.equal(SHOGUN_INTERIM.id, 'shogun');
  // fallback path: animeCfg returns interim when the real entry is missing
  const saved = ANIME_CLASSES.shogun; delete ANIME_CLASSES.shogun;
  try { assert.equal(animeCfg('shogun'), SHOGUN_INTERIM); } finally { ANIME_CLASSES.shogun = saved; }
});
test('power chain on grounded nodachi cuts: feet → hips → torso → shoulder → hands → blade in order', () => {
  const links = [['feet', ['fFx', 'fBx', 'hB', 'fFy'], 'feet'], ['hips', ['tw', 'px'], 'hips'], ['torso', ['sp', 'ch'], 'torso'], ['shoulder', ['ctw'], 'shoulder'], ['hands', ['gx', 'gy'], 'arm'], ['blade', ['ga', 'gw'], null]];
  for (const key of ['a1', 'a2', 'a3', 'mcut']) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m), su = m.t[0], dt = 1 / 4000, peak = {}, A = FORMS[key].A2 || FORMS[key].A, S = FORMS[key].S;
    if (!A || !S) continue;
    const kA = keys.find((k) => k.p === A).t;
    for (const [name, ch, li] of links) {
      const off = li ? CHAIN_LEAD[li] * PROFILE.lead : 0, t0 = Math.max(0, kA - off), t1 = su - off;
      let best = null, travel = 0; for (const q of ch) { const tr = Math.abs(S[q] - A[q]); if (tr > travel) { travel = tr; best = q; } }
      if (travel < 0.06) continue;
      let pt = 0, pv = -1, prev = evalChain(keys, t0, STANCE, {}, PROFILE.lead)[best];
      for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) { const v = evalChain(keys, t, STANCE, {}, PROFILE.lead)[best], sp = Math.abs(v - prev) / dt; if (sp > pv) { pv = sp; pt = t; } prev = v; }
      peak[name] = +(pt * 1000).toFixed(1);
    }
    report.chain[key] = peak;
    const seq = links.map(([n]) => peak[n]).filter((v) => v !== undefined);
    assert.ok(seq.length >= 4, key + ': at least 4 links ' + JSON.stringify(peak));
    for (let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1] - 0.5, `${key}: chain out of order ${JSON.stringify(peak)}`);
  }
});
test('no snaps: an ε step never jumps the nodachi tip (from idle)', () => {
  for (const key of ['a1', 'a2', 'a3', 'iai', 'ten1', 'glitch', 'ultEnd']) {
    const m = C.moves[key], keys = PROFILE.moveKeys(key, m); let maxJump = 0;
    for (let t = 0; t < m.t[0] + m.t[1] + m.t[2]; t += 1 / 480) {
      const a = blade(evalChain(keys, t, STANCE, {}, PROFILE.lead)).t, b = blade(evalChain(keys, t + 1e-6, STANCE, {}, PROFILE.lead)).t;
      maxJump = Math.max(maxJump, Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    assert.ok(maxJump < 0.003, `${key}: continuous tip (max ε-jump ${maxJump.toFixed(5)} m)`);
  }
});
test('gameplay untouched: every Shogun number (frame data, boxes, dmg, phases, projectiles, combo) is the shipped value', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(C.moves)), SHIPPED.moves);
  assert.deepEqual(JSON.parse(JSON.stringify(C.projs)), SHIPPED.projs);
  assert.deepEqual(JSON.parse(JSON.stringify(C.phases)), SHIPPED.phases);
  for (const k of ['hp', 'walk', 'weight', 'reach', 'prefer', 'color', 'trim']) assert.equal(C[k], SHIPPED[k], k);
  assert.deepEqual(C.combo, SHIPPED.combo); assert.deepEqual(C.airCombo, SHIPPED.airCombo);
});

console.log(JSON.stringify(report));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
