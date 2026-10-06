// node tests/boss.test.mjs — final boss 塔主・零 / 機械將軍 KAGE-SHŌGUN (HANDOFF §16 step 1): phases, answers, AI, balance
import assert from 'node:assert/strict';
import { makeDuel, step, act, DT, TUNE, BOSS_TUNE, CLASSES, CLASS_IDS, isInv, simulate } from '../js/duel.js';
import { BOSS_IDS } from '../js/classes.js';
import { aiThink, mulberry32 } from '../js/ai.js';
import { LADDER, ladderFoe, endlessFoe, isZeroFloor } from '../js/modes.js';
import { bossTable, LADDER_PLAYER_DIFF } from './boss.mjs';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const Z = CLASSES.shogun, M = Z.moves;
/** player `cls` at x=-gap/2 facing right vs the boss at +gap/2; boss HP ×hp */
function duel(cls = 'sword', gap = 2, { hp = 1, phase = 1 } = {}) {
  const d = makeDuel(cls, 'shogun', {}, { hpMul: hp, boss: true });
  d.a.x = -gap / 2; d.b.x = gap / 2; d.a.facing = 1; d.b.facing = -1; d.b.phase = phase; return d;
}
/** step `sec`, calling each(d, i) before every step; returns all events */
function run(d, sec, each) {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) { if (each) each(d, i); step(d, DT); evs.push(...d.events); d.events.length = 0; }
  return evs;
}
const hitsOn = (evs, f) => evs.filter((e) => e.type === 'hit' && e.who === f);
const startup = (k) => M[k].t[0];

test('shogun: boss-only class (not selectable), nodachi reach 1.6–1.8, long readable startups', () => {
  assert.deepEqual(CLASS_IDS, ['sword', 'mage', 'brawler', 'assassin']);
  assert.deepEqual(BOSS_IDS, ['shogun']); assert.equal(Z.selectable, false); assert.ok(Z.boss && Z.phases);
  assert.ok(Z.reach >= 1.6 && Z.reach <= 1.8, 'reach ' + Z.reach);
  for (const k of Z.combo) { assert.ok(M[k].box[1] >= 1.6 && M[k].box[1] <= 1.85, k + ' box ' + M[k].box[1]); assert.ok(startup(k) >= 0.18, k + ' startup'); }
  for (const [k, m] of Object.entries(M)) if (m.kind !== 'basic' && (m.box || m.fire)) assert.ok(m.t[0] >= 0.25 || m.parry, `${k} startup ${m.t[0]} < 0.25`);
  for (const k of ['iai', 'ten1', 'mirror']) assert.equal(M[k].phase, 1, k); for (const k of ['rain', 'glitch', 'ult']) assert.equal(M[k].phase, 2, k);
  assert.ok(M.iai.flash > 0 && M.iai.t[0] - M.iai.flash >= 0.18, 'iai flash precedes the cut by ≥ 0.18 s');
});

test('phase flips exactly once at 50 % HP (overflow clamps, no KO in phase 1), ult meter kept', () => {
  const d = duel('sword', 1.2, { hp: 1 }); const B = d.b; B.ult = 77; const line = Math.round(B.maxHp * Z.phases.at);
  B.hp = line + 30;
  d.a.cd.s1 = 0; act(d.a, 's1');   // Lunge 118 dmg: crosses the line
  let evs = run(d, 0.6);
  assert.equal(B.phase, 2); assert.equal(B.phaseN, 1); assert.equal(B.hp, line, 'clamped to the line');
  assert.ok(B.ult >= 77, 'ult kept ' + B.ult);
  assert.equal(evs.filter((e) => e.type === 'phase').length, 1);
  // one huge hit from full HP: still clamps to the line
  const d2 = duel('sword', 1.2); d2.b.hp = d2.b.maxHp; d2.a.dmgMul = 40; act(d2.a, 'atk'); run(d2, 0.4);
  assert.equal(d2.b.hp, Math.round(d2.b.maxHp * Z.phases.at)); assert.equal(d2.b.st, 'phase'); assert.equal(d2.b.phaseN, 1);
  // keep hitting down to 0 (and even healing back over the line): never flips again
  run(d, 2); B.hp = B.maxHp; d.a.dmgMul = 3; let phases = 0, ko = false;
  for (let i = 0; i < 40 && !d.over; i++) { d.a.x = d.b.x - 1.2; d.a.facing = 1; d.b.inv = 0; act(d.a, 'atk'); evs = run(d, 0.3, (dd) => { dd.b.in.guard = false; dd.b.buf = null; }); phases += evs.filter((e) => e.type === 'phase').length; ko = ko || evs.some((e) => e.type === 'ko'); }
  assert.equal(phases, 0); assert.equal(B.phaseN, 1); assert.ok(ko && B.hp === 0, 'boss KO in phase 2');
});

test('phase transition: invulnerable for transT, shoves a close foe, fires phase / phaseEnd events for the view', () => {
  const d = duel('brawler', 1.0); const B = d.b; B.hp = Math.round(B.maxHp * 0.5) + 5;
  act(d.a, 'atk'); let evs = run(d, 0.25);
  assert.equal(B.st, 'phase'); assert.ok(isInv(B)); const ph = evs.find((e) => e.type === 'phase'); assert.ok(ph && ph.who === B && ph.phase === 2);
  assert.ok(Math.abs(d.a.vx) > 3 || Math.abs(d.a.x - B.x) > 1.3, 'close foe shoved');
  // hammer it during the transition: no damage
  const hp = B.hp; let hits = 0;
  evs = run(d, Z.phases.transT - 0.35, (dd, i) => { if (i % 6 === 0) { dd.a.x = B.x - 1.0; dd.a.facing = 1; act(dd.a, i % 12 ? 'atk' : 's2'); dd.a.cd.s2 = 0; } });
  hits += hitsOn(evs, B).length; assert.equal(hits, 0); assert.equal(B.hp, hp); assert.ok(evs.filter((e) => e.type === 'move' && e.who === d.a).length >= 1, 'attacks were thrown');
  evs = run(d, 0.6); assert.equal(evs.filter((e) => e.type === 'phaseEnd').length, 1); assert.notEqual(B.st, 'phase');
});

test('phase-locked moves: phase 1 kit only in phase 1, phase 2 kit (incl. ult) only in phase 2', () => {
  const d = duel('sword', 3); d.b.ult = 100;
  for (const c of ['bm:rain', 'bm:glitch', 'ult']) { act(d.b, c); run(d, 0.05); assert.notEqual(d.b.st, 'atk', c + ' in phase 1'); d.b.buf = null; }
  act(d.b, 'bm:iai'); run(d, 0.05); assert.equal(d.b.mk, 'iai');
  const e = duel('sword', 3, { phase: 2 }); e.b.ult = 100;
  for (const c of ['bm:iai', 'bm:ten1', 'bm:mirror']) { act(e.b, c); run(e, 0.05); assert.notEqual(e.b.st, 'atk', c + ' in phase 2'); e.b.buf = null; }
  act(e.b, 'ult'); run(e, 0.05); assert.equal(e.b.mk, 'ult');
  // the four player classes can't call boss moves
  const f = duel('assassin', 3); act(f.a, 'bm:iai'); run(f, 0.05); assert.notEqual(f.a.st, 'atk');
});

// ---------------------------------------------------------------- every attack has a fair answer
const guardAll = (d) => { d.a.in.guard = true; };
test('answer: nodachi basics (a1 → a2 → a3) — guard', () => {
  const d = duel('sword', 1.6); let evs = [];
  for (const k of ['atk', 'atk', 'atk']) { act(d.b, k); evs.push(...run(d, 0.45, guardAll)); }
  assert.equal(hitsOn(evs, d.a).length, 0); assert.ok(evs.filter((e) => e.type === 'block' && e.who === d.a).length >= 2);
});
test('answer: Iai Judgement — guard it, or dodge on the flash (window ≥ 0.15 s), or jump before the flash', () => {
  for (const gap of [2.5, 4.5]) {
    const g = duel('mage', gap); act(g.b, 'bm:iai'); assert.equal(hitsOn(run(g, 1.3, guardAll), g.a).length, 0, 'guard @' + gap);
    const u = duel('mage', gap); act(u.b, 'bm:iai'); assert.equal(hitsOn(run(u, 1.3), u.a).length, 1, 'unanswered iai hits @' + gap);
  }
  // dodge any time from the flash +1 frame to the active frame (back or forward)
  const fl = M.iai.flash, su = M.iai.t[0];
  for (let at = fl + DT; at <= su - DT; at += 0.03) for (const dir of [-1, 1]) {
    const d = duel('sword', 3); act(d.b, 'bm:iai'); let done = false;
    const evs = run(d, 1.3, (dd) => { if (!done && dd.b.t >= at) { done = true; dd.a.in.mx = dir; act(dd.a, 'dodge'); } });
    assert.equal(hitsOn(evs, d.a).length, 0, `dodge at ${at.toFixed(2)} dir ${dir}`);
  }
  assert.ok(su - TUNE.dodgeInv + M.iai.t[1] - fl <= 0.03 && su - fl >= 0.15, 'dodge window opens on the flash and lasts ≥ 0.15 s');
  for (const at of [0.22, 0.3, 0.38]) { const d = duel('assassin', 3); act(d.b, 'bm:iai'); let done = false; const evs = run(d, 1.3, (dd) => { if (!done && dd.b.t >= at) { done = true; act(dd.a, 'jump'); } }); assert.equal(hitsOn(evs, d.a).length, 0, 'jump at ' + at); }
  // the flash event fires once per cut, before the active frames
  const d = duel('sword', 3); act(d.b, 'bm:iai'); const evs = run(d, 0.7); assert.equal(evs.filter((e) => e.type === 'flash').length, 1);
});
test('answer: Ten-Step Advance — the whole 3-step string can be guarded (no gaps that force a hit)', () => {
  for (const gap of [1.4, 2.2]) {
    const d = duel('brawler', gap); act(d.b, 'bm:ten1'); const evs = run(d, 2.2, guardAll);
    assert.equal(hitsOn(evs, d.a).length, 0, 'gap ' + gap); assert.ok(evs.filter((e) => e.type === 'block' && e.who === d.a).length >= 2, 'blocked the string');
    assert.ok(evs.some((e) => e.type === 'move' && e.key === 'ten3') || d.b.mk === null, 'string reached step 3');
  }
});
test('answer: Mirror Guard — don\'t swing into it; a parried basic gives time to guard the counter; skills break it', () => {
  const d0 = duel('sword', 1.4); act(d0.b, 'bm:mirror'); assert.equal(hitsOn(run(d0, 1.6), d0.a).length, 0, 'mirror alone deals no damage');
  // swing a basic into it → parried (stagger), then hold guard as soon as the stagger shows → Mirror Return is blocked
  const r2 = duel('sword', 1.4); act(r2.b, 'bm:mirror'); run(r2, 0.15); act(r2.a, 'atk');
  let got = false; const ev3 = [];
  for (let i = 0; i < 100; i++) { r2.a.in.guard = got; step(r2, DT); for (const e of r2.events) { ev3.push(e); if (e.type === 'parry') got = true; } r2.events.length = 0; }
  assert.ok(got, 'basic is parried');
  assert.equal(hitsOn(ev3, r2.a).length, 0, 'Mirror Return blocked after the stagger');
  assert.ok(M.mcut.t[0] - BOSS_TUNE.parryStun >= 4 / 60, 'counter startup leaves ≥ 4 frames after the stagger');
  // a skill into the mirror breaks it: boss staggered, +25 % damage
  const s = duel('sword', 1.4); act(s.b, 'bm:mirror'); run(s, 0.15); s.a.cd.s2 = 0; act(s.a, 's2'); const ev4 = run(s, 0.4);
  assert.ok(ev4.some((e) => e.type === 'crush'), 'skill crushes the mirror'); assert.ok(hitsOn(ev4, s.b).length >= 1);
  // a basic bolt is reflected back at the mage; guarding it is the answer
  const m = duel('mage', 3.2); act(m.b, 'bm:mirror'); run(m, 0.12); act(m.a, 'atk'); let refl = false;
  const ev5 = []; for (let i = 0; i < 120; i++) { m.a.in.guard = refl; step(m, DT); for (const e of m.events) { ev5.push(e); if (e.type === 'parry' && e.proj) refl = true; } m.events.length = 0; }
  assert.ok(refl, 'bolt reflected'); assert.equal(hitsOn(ev5, m.a).length, 0, 'reflected bolt guarded');
});
test('answer: Data-Blade Rain — markers ≥ 0.6 s; step into a gap or guard under a marker', () => {
  const blades = (d) => d.projs.filter((p) => p.key === 'dblade');
  const d = duel('sword', 4, { phase: 2 }); act(d.b, 'bm:rain'); run(d, M.rain.fire[0].at + 0.05);
  const bs = blades(d); assert.equal(bs.length, M.rain.fire[0].n);
  assert.ok(bs.every((p) => p.delay0 >= 0.6 && p.delay0 === M.rain.fire[0].delay + p.idx * M.rain.fire[0].step), 'telegraph ≥ 0.6 s');
  const under = bs.find((p) => Math.abs(p.x - d.a.x) < p.r + TUNE.halfW); assert.ok(under, 'standing still is never safe');
  const xs = bs.map((p) => p.x).sort((a, b) => a - b), gapW = xs[1] - xs[0] - 2 * (bs[0].r + TUNE.halfW);
  assert.ok(gapW >= 0.4, 'gaps wide enough to stand in: ' + gapW.toFixed(2));
  // walk to the nearest gap
  const mids = xs.slice(1).map((x, i) => (x + xs[i]) / 2), tgt = mids.reduce((a, b) => (Math.abs(b - d.a.x) < Math.abs(a - d.a.x) ? b : a));
  const evs = run(d, 2.0, (dd) => { dd.a.in.mx = Math.abs(tgt - dd.a.x) > 0.08 ? Math.sign(tgt - dd.a.x) : 0; });
  assert.equal(hitsOn(evs, d.a).length, 0, 'gap is safe');
  const g = duel('sword', 4, { phase: 2 }); act(g.b, 'bm:rain'); const ev2 = run(g, 2.0, guardAll);
  assert.equal(hitsOn(ev2, g.a).length, 0, 'guard under a marker'); assert.ok(ev2.some((e) => e.type === 'block' && e.who === g.a));
  const u = duel('sword', 4, { phase: 2 }); act(u.b, 'bm:rain'); assert.ok(hitsOn(run(u, 2.0), u.a).length >= 1, 'standing still gets hit');
  // close range: Rain opens with a back-slide out of reach
  const c = duel('brawler', 1.0, { phase: 2 }); act(c.b, 'bm:rain'); run(c, 0.4); assert.ok(Math.abs(c.b.x - c.a.x) > 2, 'back-slide');
});
test('answer: Glitch Step — decoys are harmless; only the last image is real; guard (auto-turn) or dodge it', () => {
  const d = duel('assassin', 4, { phase: 2 }); act(d.b, 'bm:glitch'); const evs = [];
  let tele = -1, decoyT = [];
  for (let i = 0; i < 90; i++) { step(d, DT); for (const e of d.events) { evs.push(e); if (e.type === 'proj' && e.p.key === 'decoy') decoyT.push(d.b.t); if (e.type === 'blink' && e.who === d.b) tele = d.b.t; } d.events.length = 0; }
  assert.equal(decoyT.length, 2, 'two decoys'); assert.ok(tele > Math.max(...decoyT), 'the real one appears last');
  assert.ok(Math.sign(d.b.x - d.a.x) === -1 || Math.abs(d.b.x - d.a.x) < 1.2, 'teleports behind / onto the player');
  assert.ok(M.glitch.t[0] - tele >= TUNE.turnDelay + 0.1, 'time to turn and guard after the real image appears');
  // decoys: standing on them never hurts (harmless, no collision)
  const z = duel('sword', 4, { phase: 2 }); act(z.b, 'bm:glitch'); let dmgByDecoy = 0;
  for (let i = 0; i < 18; i++) { for (const p of z.projs) if (p.key === 'decoy') { z.a.x = p.x; assert.ok(p.harmless && p.dmg === 0); } step(z, DT); for (const e of z.events) if (e.type === 'hit' && e.src === 'p:decoy') dmgByDecoy++; z.events.length = 0; }
  assert.equal(dmgByDecoy, 0);
  const g = duel('sword', 4, { phase: 2 }); act(g.b, 'bm:glitch'); assert.equal(hitsOn(run(g, 1.4, guardAll), g.a).length, 0, 'guard holds through the teleport');
  for (const at of [0.46, 0.52, 0.58]) { const o = duel('sword', 4, { phase: 2 }); act(o.b, 'bm:glitch'); let done = false; const ev = run(o, 1.4, (dd) => { if (!done && dd.b.t >= at) { done = true; act(dd.a, 'dodge'); } }); assert.equal(hitsOn(ev, o.a).length, 0, 'dodge at ' + at); }
  const u = duel('sword', 4, { phase: 2 }); act(u.b, 'bm:glitch'); assert.equal(hitsOn(run(u, 1.4), u.a).length, 1, 'unanswered: the real cut lands');
});
test('answer: Thousand Edges Mirrored (ult) — guard the dash, guard or dodge the finale', () => {
  const d = duel('brawler', 3, { phase: 2 }); d.b.ult = 100; act(d.b, 'ult'); const evs = run(d, 3.4, guardAll);
  assert.equal(hitsOn(evs, d.a).length, 0); assert.ok(evs.some((e) => e.type === 'move' && e.key === 'ultEnd'), 'finale played');
  const o = duel('brawler', 3, { phase: 2 }); o.b.ult = 100; act(o.b, 'ult'); let done = false;
  const ev2 = run(o, 3.4, (dd) => { if (dd.b.mk === 'ult') dd.a.in.guard = true; else dd.a.in.guard = false; if (!done && dd.b.mk === 'ultEnd' && dd.b.t >= M.ultEnd.t[0] - 0.12) { done = true; act(dd.a, 'dodge'); } });
  assert.equal(hitsOn(ev2, o.a).length, 0, 'dodge the finale'); assert.ok(M.ultEnd.t[0] >= 0.45, 'finale wind-up ≥ 0.45 s');
});

test('AI: phase 1 uses only the 「秩序」 kit, phase 2 only the 「崩壞」 kit, and every signature move shows up', () => {
  const P1 = new Set(['a1', 'a2', 'a3', 'iai', 'ten1', 'ten2', 'ten3', 'mirror', 'mcut']), P2 = new Set(['a1', 'a2', 'a3', 'rain', 'glitch', 'ult', 'ultEnd']);
  const seen = new Set();
  for (const cls of CLASS_IDS) for (let s = 0; s < 6; s++) {
    const foe = ladderFoe(9, cls), rng = mulberry32(31 + s * 17 + cls.length), d = makeDuel(cls, 'shogun', {}, foe), ma = {}, mb = {};
    for (let i = 0; i < 60 * 90 && !d.over; i++) {
      const ca = aiThink(d, d.a, d.b, { diff: 0.74 }, ma, DT, rng); if (ca) act(d.a, ca); const cb = aiThink(d, d.b, d.a, foe, mb, DT, rng); if (cb) act(d.b, cb);
      const ph = d.b.phase; step(d, DT);
      for (const e of d.events) if (e.type === 'move' && e.who === d.b) { assert.ok((ph === 1 ? P1 : P2).has(e.key), `${e.key} in phase ${ph}`); seen.add(e.key); }
      d.events.length = 0;
    }
  }
  for (const k of ['iai', 'ten1', 'mirror', 'rain', 'glitch', 'ult', 'ultEnd']) assert.ok(seen.has(k), 'never used ' + k);
});

test('ladder fight 10 = 塔主・零 (shogun), endless 30F / 60F … = echoes with capped curves', () => {
  const z = ladderFoe(9, 'sword'); assert.equal(LADDER[9].id, 'zero'); assert.equal(z.cls, 'shogun'); assert.ok(z.boss && z.final && z.time >= 90);
  for (const n of [9, 19, 39, 49]) assert.ok(CLASS_IDS.includes(endlessFoe(n).cls), 'floor ' + n);
  for (const n of [29, 59, 89]) { const f = endlessFoe(n); assert.ok(isZeroFloor(n) && f.cls === 'shogun' && f.boss); }
  const far = endlessFoe(30 * 400 - 1); assert.ok(far.diff <= 0.95 && far.hpMul <= 3.0 && far.dmgMul <= 1.3, 'capped');
});

test(`balance: ladder player (diff ${LADDER_PLAYER_DIFF}) wins fight 10 35–50 % first try for every class (400 fights each)`, () => {
  const res = bossTable(400);
  for (const c of CLASS_IDS) { const r = res[c]; assert.ok(r.win >= 0.35 && r.win <= 0.50, `${c} ${Math.round(r.win * 100)}%`); assert.equal(r.maxFlips, 1); assert.ok(r.timeouts <= 4, c + ' time-outs ' + r.timeouts); }
});

test('the four player classes are untouched by the boss code (golden fingerprint of 144 deterministic AI duels)', () => {
  // regenerate only on an intended 4-class gameplay change: node tests/boss.test.mjs --fingerprint
  let h = 2166136261 >>> 0; const mix = (s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const diff of [0.35, 0.7, 0.95]) for (const a of CLASS_IDS) for (const b of CLASS_IDS) for (let s = 0; s < 3; s++) {
    const rng = mulberry32(4242 + s * 101 + a.length * 7 + b.length), d = makeDuel(a, b), ma = {}, mb = {};
    const o = simulate(d, (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff }, ma, dt, rng); if (c) act(me, c); }, (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff }, mb, dt, rng); if (c) act(me, c); });
    mix(`${o && o.winner}|${d.clock.toFixed(4)}|${d.a.hp}|${d.b.hp}|${JSON.stringify(d.a.stats)}|${JSON.stringify(d.b.stats)};`);
  }
  if (process.argv.includes('--fingerprint')) console.log('     fingerprint', h.toString(16));
  assert.equal(h.toString(16), 'e6f4c012', 'same as v2.7 (4b7a8e2, before the boss)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
