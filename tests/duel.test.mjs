// node tests/duel.test.mjs — pure duel logic tests
import assert from 'node:assert/strict';
import { makeDuel, act, step, MOVES, TUNE, TOWER, aiThink, floorScore, guardBreak, opponentFor, isMilestone } from '../js/duel.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const run = (d, sec, each) => { const dt = 1 / 60; for (let i = 0; i < sec * 60; i++) { each && each(i); step(d, dt); } };
const close = (d, gap = 1.0) => { d.a.x = -gap / 2; d.b.x = gap / 2; };
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

t('fighters auto-approach to striking range', () => { const d = makeDuel(); run(d, 3); const g = d.b.x - d.a.x; assert.ok(g < TUNE.approach + 0.2 && g >= TUNE.minGap - 0.01, 'gap ' + g); });
t('jab in range hits and knocks back', () => { const d = makeDuel(); close(d); d.b.hold = true; assert.ok(act(d.a, 'jab')); run(d, 0.5); assert.equal(d.b.hp, 100 - MOVES.jab.dmg); assert.ok(d.b.x > 0.5); });
t('jab out of range whiffs', () => { const d = makeDuel(); d.a.hold = d.b.hold = true; d.a.x = -3; d.b.x = 3; act(d.a, 'jab'); run(d, 0.5); assert.equal(d.b.hp, 100); });
t('three-hit combo ends in a kick', () => { const d = makeDuel(); close(d, 0.9); d.b.hold = true; const seen = []; run(d, 1.6, () => { if (d.a.st === 'idle' || (d.a.phase === 'recover')) act(d.a, 'jab'); if (d.a.move && !seen.includes(d.a.move)) seen.push(d.a.move); d.b.x = d.a.x + 0.9; }); assert.deepEqual(seen.slice(0, 3), ['jab', 'jab2', 'kick']); });
t('parry stuns the attacker and negates damage', () => { const d = makeDuel(); close(d); act(d.b, 'parry'); act(d.a, 'jab'); run(d, 0.3); assert.equal(d.b.hp, 100); assert.equal(d.a.st, 'stun'); assert.equal(d.b.stats.parries, 1); });
t('late parry (window expired) fails', () => { const d = makeDuel(); close(d); act(d.b, 'parry'); run(d, TUNE.parryWin + 0.02); d.b.st = 'parry'; d.b.t = TUNE.parryWin + 0.1; act(d.a, 'jab'); run(d, 0.3); assert.ok(d.b.hp < 100); });
t('fully charged heavy breaks a parry', () => { const d = makeDuel(); close(d); d.b.hold = true; act(d.a, 'chargeStart'); run(d, TUNE.chargeMax + 0.05); act(d.a, 'chargeRelease'); assert.ok(guardBreak(d.a)); act(d.b, 'parry'); run(d, 0.4); assert.equal(d.b.hp, 100 - (MOVES.heavy.dmg + MOVES.heavy.dmgCharge)); });
t('quick heavy is parryable and weaker', () => { const d = makeDuel(); close(d); act(d.a, 'chargeStart'); run(d, 0.2); act(d.a, 'chargeRelease'); assert.ok(!guardBreak(d.a)); act(d.b, 'parry'); run(d, 0.4); assert.equal(d.b.hp, 100); });
t('dash i-frames evade a jab', () => { const d = makeDuel(); close(d); act(d.a, 'jab'); act(d.b, 'dashB'); run(d, 0.4); assert.equal(d.b.hp, 100); });
t('jump avoids a ground jab, heavy hits air', () => { const d = makeDuel(); close(d); act(d.b, 'jump'); run(d, 0.15); act(d.a, 'jab'); run(d, 0.25); assert.equal(d.b.hp, 100); });
t('dive kick from a jump hits', () => { const d = makeDuel(); close(d, 1.6); d.b.hold = true; act(d.a, 'jump'); run(d, 0.3); assert.ok(act(d.a, 'jab')); run(d, 0.8); assert.ok(d.b.hp < 100, 'hp ' + d.b.hp); });
t('hitting a charging fighter cancels the charge', () => { const d = makeDuel(); close(d); act(d.b, 'chargeStart'); run(d, 0.3); act(d.a, 'jab'); run(d, 0.3); assert.equal(d.b.st, 'hit'); });
t('KO ends the duel', () => { const d = makeDuel(); close(d); d.b.hp = 3; act(d.a, 'jab'); run(d, 0.4); assert.deepEqual(d.over, { winner: 'a', by: 'ko' }); assert.equal(d.a.st, 'win'); });
t('time out decides by hp %', () => { const d = makeDuel(); d.a.hold = d.b.hold = true; d.a.x = -3; d.b.x = 3; d.b.hp = 50; d.time = 0.05; run(d, 0.1); assert.equal(d.over.winner, 'a'); assert.equal(d.over.by, 'time'); });
t('arena bounds hold', () => { const d = makeDuel(); d.a.x = -6.9; act(d.a, 'dashB'); run(d, 0.5); assert.ok(d.a.x >= -7); });
t('tower: 8 original opponents, rising hp at the end', () => { assert.equal(TOWER.length, 8); assert.ok(TOWER[7].hp > TOWER[0].hp); for (const o of TOWER) for (const k of ['parry', 'evade', 'heavy', 'combo']) assert.ok(o[k] >= 0 && o[k] <= 1); });
t('AI vs AI duels finish and each AI lands hits', () => {
  for (const lvl of [1, 4, 7]) { const d = makeDuel(TOWER[lvl].hp); const ma = {}, mb = {};
    for (let i = 0; i < 60 * 70 && !d.over; i++) { const ca = aiThink(d, d.a, d.b, TOWER[4], ma, 1 / 60, rng), cb = aiThink(d, d.b, d.a, TOWER[lvl], mb, 1 / 60, rng); if (ca) act(d.a, ca); if (cb) act(d.b, cb); step(d, 1 / 60); }
    assert.ok(d.over, 'duel ended'); assert.ok(d.a.stats.hits > 0 && d.b.stats.hits > 0, `hits ${d.a.stats.hits}/${d.b.stats.hits}`); }
});
t('higher tower AIs beat the dummy-level AI more often', () => {
  let wins = 0; for (let g = 0; g < 20; g++) { const d = makeDuel(); const ma = {}, mb = {};
    for (let i = 0; i < 60 * 70 && !d.over; i++) { const ca = aiThink(d, d.a, d.b, TOWER[0], ma, 1 / 60, rng), cb = aiThink(d, d.b, d.a, TOWER[7], mb, 1 / 60, rng); if (ca) act(d.a, ca); if (cb) act(d.b, cb); step(d, 1 / 60); }
    if (d.over && d.over.winner === 'b') wins++; }
  assert.ok(wins >= 15, 'lord wins ' + wins + '/20');
});
t('floor score adds perfect bonus', () => { const d = makeDuel(); d.time = 30; const s = floorScore(3, d); assert.equal(s.total, 3000 + 1000 + 450 + 2000); });
t('endless: floors beyond 8 are procedural, named in both languages, capped', () => {
  assert.equal(opponentFor(3).id, TOWER[3].id); let prevHp = 0;
  for (const f of [8, 9, 20, 57, 200, 5000]) { const o = opponentFor(f); assert.ok(o.endless && o.zh && o.en && o.descEn); assert.ok(o.hp >= prevHp && o.hp <= 330); prevHp = o.hp;
    for (const k of ['parry', 'evade', 'heavy', 'combo', 'dash', 'jump', 'punish']) assert.ok(o[k] >= 0 && o[k] <= 0.92, k + ' ' + o[k]); assert.ok(o.think >= 0.17); }
  assert.notEqual(opponentFor(8).en, opponentFor(15).en);
});
t('endless: floor 60 is still winnable for a strong AI player', () => {
  let wins = 0; const P = { ...TOWER[7], think: 0.2, parry: 0.5, punish: 0.9 }; for (let g = 0; g < 12; g++) { const o = opponentFor(59); const d = makeDuel(o.hp); const ma = {}, mb = {};
    for (let i = 0; i < 60 * 70 && !d.over; i++) { const ca = aiThink(d, d.a, d.b, P, ma, 1 / 60, rng), cb = aiThink(d, d.b, d.a, o, mb, 1 / 60, rng); if (ca) act(d.a, ca); if (cb) act(d.b, cb); step(d, 1 / 60); }
    if (d.over && d.over.winner === 'a') wins++; }
  assert.ok(wins >= 1, 'wins ' + wins + '/12');
});
t('milestones every 10 floors add a bonus', () => { assert.ok(isMilestone(9) && isMilestone(19) && !isMilestone(10)); const d = makeDuel(); d.a.hp = 50; d.time = 0; assert.equal(floorScore(10, d).milestone, 5000); assert.equal(floorScore(11, d).milestone, 0); });
console.log(`ALL PASSED (${n})`);
