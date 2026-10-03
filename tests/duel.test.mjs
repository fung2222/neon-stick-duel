// node tests/duel.test.mjs — pure simulation, AI, modes, balance sanity
import assert from 'node:assert/strict';
import { makeDuel, step, act, DT, TUNE, CLASSES, CLASS_IDS, isInv, simulate, moveOf } from '../js/duel.js';
import { aiThink, mulberry32 } from '../js/ai.js';
import { LADDER, ladderFoe, endlessFoe, isBossFloor, fightScore, migrateSave, TRIAL } from '../js/modes.js';
import { matrix } from './balance.mjs';

let passed = 0, failed = 0;
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n     ', e.message); } };
const run = (d, sec, each) => { for (let i = 0; i < Math.round(sec / DT); i++) { each && each(i); step(d, DT); d.events.length = 0; } };
const close = (d, gap = 1.0) => { d.a.x = -gap / 2; d.b.x = gap / 2; };
const tap = (d, f, cmd, sec = 0.02) => { act(f, cmd); run(d, sec); };

test('four classes with combo 3-4, two skills with cooldowns, ultimate', () => {
  assert.deepEqual(CLASS_IDS, ['sword', 'mage', 'brawler', 'assassin']);
  for (const id of CLASS_IDS) {
    const C = CLASSES[id];
    assert.ok(C.combo.length >= 3 && C.combo.length <= 4, id + ' combo');
    assert.ok(C.moves.s1.cd > 0 && C.moves.s2.cd > 0, id + ' cds');
    assert.equal(C.moves.ult.kind, 'ult');
    assert.ok(C.zh && C.en && C.outfit.weapon);
  }
  assert.equal(CLASSES.mage.moves.s1.tag, 'escape'); assert.equal(CLASSES.assassin.moves.s1.tag, 'escape');
  assert.equal(CLASSES.sword.moves.s1.tag, 'closer'); assert.equal(CLASSES.brawler.moves.s1.tag, 'closer'); assert.equal(CLASSES.assassin.moves.s2.tag, 'closer');
});
test('ranged per-hit damage < melee per-hit damage', () => {
  const ranged = Object.values(CLASSES.mage.projs).filter((p) => !p.ult && p.v).map((p) => p.dmg);
  const melee = ['sword', 'brawler'].flatMap((c) => CLASSES[c].combo.map((k) => CLASSES[c].moves[k].dmg));
  assert.ok(Math.max(...ranged) < Math.max(...melee) && avg(ranged) < avg(melee), `${avg(ranged)} vs ${avg(melee)}`);
});
test('free movement: no auto-forward; walk both ways; back-walk slower', () => {
  const d = makeDuel('sword', 'brawler'); const x0 = d.a.x;
  run(d, 1); assert.equal(d.a.x, x0, 'idle fighter stays put');
  d.a.in.mx = 1; run(d, 0.5); const fwd = d.a.x - x0; assert.ok(fwd > 1.2, 'walks forward ' + fwd);
  d.a.in.mx = -1; const x1 = d.a.x; run(d, 0.5); const back = x1 - d.a.x; assert.ok(back > 0.8 && back < fwd, 'backs off slower ' + back);
});
test('tapping attack chains the full basic combo (each class)', () => {
  for (const id of CLASS_IDS) {
    const d = makeDuel(id, 'brawler', {}, { hpMul: 10 }); close(d, 1.0); const seen = [];
    for (let i = 0; i < 120; i++) { if (i % 6 === 0) act(d.a, 'atk'); step(d, DT); for (const e of d.events) if (e.type === 'move' && e.who === d.a) seen.push(e.key); d.events.length = 0; }
    assert.deepEqual(seen.slice(0, CLASSES[id].combo.length), CLASSES[id].combo, id + ' ' + seen.join(','));
  }
});
test('melee combo lands and the finisher launches (juggle)', () => {
  const d = makeDuel('brawler', 'sword', {}, { hpMul: 10 }); close(d, 1.0); let launched = false;
  for (let i = 0; i < 120; i++) { if (i % 5 === 0) act(d.a, 'atk'); step(d, DT); if (d.b.st === 'air') launched = true; d.events.length = 0; }
  assert.ok(d.b.stats.taken > 150 && launched, 'taken ' + d.b.stats.taken);
});
test('launcher → jump cancel → air combo hits an airborne foe', () => {
  const d = makeDuel('sword', 'brawler', {}, { hpMul: 10 }); close(d, 1.0); let airHits = 0, jumped = false;
  for (let i = 0; i < 200; i++) {
    const m = moveOf(d.a);
    if (!jumped && m && m.launch && d.a.connected) { act(d.a, 'jump'); jumped = true; }
    else if (i % 5 === 0 && (!jumped || d.a.y > 0.2)) act(d.a, 'atk');
    step(d, DT); for (const e of d.events) if (e.type === 'hit' && e.who === d.b && (e.src || '').startsWith('air')) airHits++; d.events.length = 0;
  }
  assert.ok(jumped && airHits >= 1, 'air hits ' + airHits);
});
test('cancel window: basic attack cancels into a skill', () => {
  const d = makeDuel('sword', 'brawler', {}, { hpMul: 10 }); close(d, 1.0); act(d.a, 'atk'); let cancelled = false;
  for (let i = 0; i < 40; i++) { if (d.a.mk === 'a1' && d.a.connected) act(d.a, 's2'); step(d, DT); if (d.a.mk === 's2' && !cancelled) cancelled = true; d.events.length = 0; }
  assert.ok(cancelled);
});
test('skills go on cooldown', () => {
  const d = makeDuel('brawler', 'sword'); tap(d, d.a, 's1'); assert.ok(d.a.cd.s1 > 5);
  run(d, 1.2); assert.equal(act(d.a, 's1') && (run(d, 0.05), d.a.mk === 's1'), false);
});
test('gap-closers cover distance; escapes create distance', () => {
  for (const [id, key, min] of [['sword', 's1', 3.5], ['brawler', 's1', 3.5]]) { const d = makeDuel(id, 'mage'); const x0 = d.a.x; tap(d, d.a, key); run(d, 0.6); assert.ok(d.a.x - x0 > min, `${id} ${key} ${d.a.x - x0}`); }
  { const d = makeDuel('assassin', 'mage'); tap(d, d.a, 's2'); run(d, 0.3); assert.ok(Math.abs(d.a.x - d.b.x) < 1.2, 'phantom strike teleports next to the foe'); }
  { const d = makeDuel('mage', 'brawler'); close(d, 1.0); const g0 = Math.abs(d.a.x - d.b.x); tap(d, d.a, 's1'); run(d, 0.2); assert.ok(Math.abs(d.a.x - d.b.x) > g0 + 3, 'blink'); }
  { const d = makeDuel('assassin', 'brawler'); close(d, 1.0); tap(d, d.a, 's1'); run(d, 0.5); assert.ok(Math.abs(d.a.x - d.b.x) > 3.2, 'shadow step backs off'); }
});
test('mage blink in a corner crosses over instead of hugging the wall', () => {
  const d = makeDuel('mage', 'brawler'); d.a.x = -7.3; d.b.x = -6.3; tap(d, d.a, 's1'); run(d, 0.1); assert.ok(d.a.x > d.b.x + 2, 'x ' + d.a.x);
});
test('projectiles fly and hit; pillar and meteors work', () => {
  const d = makeDuel('mage', 'sword'); d.b.x = 3; tap(d, d.a, 'atk'); run(d, 0.8); assert.ok(d.b.hp < d.b.maxHp, 'bolt hit');
  const d2 = makeDuel('mage', 'sword'); tap(d2, d2.a, 's2'); run(d2, 0.9); assert.ok(d2.b.hp < d2.b.maxHp && d2.b.stats.taken >= 100, 'pillar');
  const d3 = makeDuel('mage', 'sword'); d3.a.ult = 100; tap(d3, d3.a, 'ult'); run(d3, 3); assert.ok(d3.b.stats.taken > 250, 'meteors ' + d3.b.stats.taken);
});
test('ultimate: needs a full meter, freezes time, is invulnerable, deals big damage', () => {
  for (const id of CLASS_IDS) {
    const d = makeDuel(id, 'brawler', {}, { hpMul: 10 }); close(d, 1.2);
    tap(d, d.a, 'ult'); assert.notEqual(d.a.mk, 'ult', 'no meter → no ult');
    d.a.ult = 100; act(d.a, 'ult'); step(d, DT); assert.ok(d.freeze > 0 && d.a.mk === 'ult', id + ' freeze');
    run(d, 0.85); assert.ok(isInv(d.a), id + ' invulnerable');
    run(d, 2.5); assert.ok(d.b.stats.taken >= 250, id + ' ult dmg ' + d.b.stats.taken); assert.equal(d.a.ult < 30, true);
  }
});
test('ult meter charges by dealing and taking damage', () => {
  const d = makeDuel('brawler', 'sword', {}, { hpMul: 10 }); close(d, 1.0);
  for (let i = 0; i < 60; i++) { if (i % 5 === 0) act(d.a, 'atk'); step(d, DT); d.events.length = 0; }
  assert.ok(d.a.ult > 10 && d.b.ult > d.a.ult, `${d.a.ult} / ${d.b.ult}`);
});
test('guard blocks with chip damage; guard meter can break', () => {
  const d = makeDuel('brawler', 'sword'); close(d, 1.0); d.b.in.guard = true; run(d, 0.05);
  tap(d, d.a, 'atk', 0.4); assert.ok(d.b.stats.blocks === 1 && d.b.stats.taken < 10, 'chip ' + d.b.stats.taken);
  let broke = false; for (let i = 0; i < 1200 && !broke; i++) { if (i % 5 === 0) act(d.a, 'atk'); step(d, DT); for (const e of d.events) if (e.type === 'guardBreak') broke = true; d.events.length = 0; d.a.x = d.b.x - 1; }
  assert.ok(broke, 'guard break');
});
test('dodge: i-frames make attacks whiff', () => {
  const d = makeDuel('brawler', 'sword'); close(d, 1.0); act(d.a, 'atk'); run(d, 0.03); d.b.in.mx = 1; act(d.b, 'dodge'); run(d, 0.3);
  assert.equal(d.b.stats.taken, 0);
});
test('jump avoids a ground bolt; knockdown gives wake-up invulnerability', () => {
  const d = makeDuel('mage', 'sword'); d.b.x = 4; tap(d, d.a, 'atk'); run(d, 0.3); act(d.b, 'jump'); run(d, 0.8); assert.equal(d.b.stats.taken, 0);
  const d2 = makeDuel('brawler', 'sword', {}, { hpMul: 10 }); close(d2, 1); for (let i = 0; i < 150; i++) { if (i % 5 === 0) act(d2.a, 'atk'); step(d2, DT); d2.events.length = 0; if (d2.b.st === 'down') break; }
  assert.equal(d2.b.st, 'down'); assert.ok(isInv(d2.b));
});
test('juggle cap stops infinite air combos', () => {
  const d = makeDuel('assassin', 'brawler', {}, { hpMul: 10 }); d.b.st = 'air'; d.b.y = 2; d.b.vy = 4; d.b.jug = TUNE.jugCap; d.b.jugCap = true; assert.ok(isInv(d.b));
});
test('KO and time-out decide the fight', () => {
  const d = makeDuel('brawler', 'sword'); close(d, 1); d.b.hp = 1; tap(d, d.a, 'atk', 0.4); assert.deepEqual(d.over, { winner: 'a', by: 'ko' });
  const d2 = makeDuel('sword', 'sword'); d2.b.hp -= 10; d2.time = 0.05; run(d2, 0.2); assert.equal(d2.over.by, 'time'); assert.equal(d2.over.winner, 'a');
});
test('arena bounds', () => { const d = makeDuel('sword', 'brawler'); d.a.in.mx = -1; run(d, 6); assert.ok(d.a.x >= -7.5); });
test('ladder: 10 fights, bosses at 5 and 10, mirror uses the player class; difficulty rises', () => {
  assert.equal(LADDER.length, 10); assert.ok(LADDER[4].boss && LADDER[9].boss);
  assert.equal(ladderFoe(8, 'mage').cls, 'mage');
  for (let i = 1; i < 10; i++) assert.ok(LADDER[i].diff > LADDER[i - 1].diff);
});
test('endless tower never ends, difficulty capped, boss every 10 floors', () => {
  const f = [0, 9, 10, 50, 500, 5000].map(endlessFoe);
  assert.ok(f.every((x) => CLASS_IDS.includes(x.cls) && x.zh && x.en));
  assert.ok(f[5].diff <= 1 && f[5].hpMul <= 2.1 && f[5].dmgMul <= 1.3);
  assert.ok(isBossFloor(9) && endlessFoe(9).boss && !endlessFoe(10).boss);
  assert.ok(endlessFoe(30).diff > endlessFoe(3).diff);
});
test('endless floor 60 is winnable by a strong AI', () => {
  let wins = 0;
  for (let s = 0; s < 10; s++) {
    const foe = endlessFoe(60), rng = mulberry32(s + 9); const d = makeDuel('brawler', foe.cls, {}, foe); const ma = {}, mb = {};
    simulate(d, (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff: 1 }, ma, dt, rng); if (c) act(me, c); }, (dd, me, op, dt) => { const c = aiThink(dd, me, op, foe, mb, dt, rng); if (c) act(me, c); });
    if (d.over && d.over.winner === 'a') wins++;
  }
  assert.ok(wins >= 2, 'wins ' + wins);
});
test('harder AI beats easier AI', () => {
  let wins = 0;
  for (let s = 0; s < 20; s++) {
    const rng = mulberry32(s * 3 + 1); const d = makeDuel('sword', 'sword'); const ma = {}, mb = {};
    simulate(d, (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff: 0.95 }, ma, dt, rng); if (c) act(me, c); }, (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff: 0.15 }, mb, dt, rng); if (c) act(me, c); });
    if (d.over && d.over.winner === 'a') wins++;
  }
  assert.ok(wins >= 15, 'wins ' + wins);
});
test('trial caps and scoring', () => {
  assert.deepEqual(TRIAL, { ladder: 3, endless: 3 });
  const d = makeDuel('sword', 'mage'); const s = fightScore(3, d, true); assert.ok(s.perfect === 2000 && s.boss === 3000 && s.total > 8000);
});
test('v1 save migration (lap → floor, ver 2) keeps progress', () => {
  const mem = new Map(); const store = { get: (k) => mem.has(k) ? mem.get(k) : null, set: (k, v) => mem.set(k, String(v)), remove: (k) => mem.delete(k), getNum: (k, d = 0) => mem.has(k) ? +mem.get(k) : d, setNum: (k, v) => mem.set(k, String(v)) };
  store.setNum('floor', 3); store.setNum('lap', 1); store.setNum('bestFloor', 11); store.setNum('best', 12345);
  assert.equal(migrateSave(store), true); assert.equal(store.getNum('floor'), 11); assert.equal(store.get('lap'), null); assert.equal(store.getNum('ver'), 2); assert.equal(store.getNum('bestFloor'), 11); assert.equal(store.getNum('best'), 12345);
  assert.equal(migrateSave(store), false);
});
test('balance: every matchup 35–65 % at diff 0.7 (60 fights each)', () => {
  const res = matrix(60, 0.7);
  for (const [k, r] of Object.entries(res)) { const [a, b] = k.split(':'); if (a === b) continue; const p = r.wa / r.n; assert.ok(p >= 0.35 && p <= 0.65, `${k} ${Math.round(p * 100)}%`); }
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
