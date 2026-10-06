// Ladder-style boss sim: a "ladder player" (the normal AI at the skill of the fight-9 foe, plus the boss-telegraph reads in ai.js)
// fights 塔主・零 TOWER LORD ZERO with the real fight-10 profile (ladderFoe(9)). One fight = one first try.
//   node tests/boss.mjs [fights=400] [playerDiff=0.74] [floor]     (floor = an endless tower floor instead of ladder fight 10)
import { makeDuel, simulate, act, CLASS_IDS, CLASSES } from '../js/duel.js';
import { aiThink, mulberry32 } from '../js/ai.js';
import { ladderFoe, endlessFoe, LADDER } from '../js/modes.js';

export const LADDER_PLAYER_DIFF = LADDER[8].diff;   // a player who reaches fight 10 just beat MIRROR SHADE (diff 0.74)
export function bossFight(cls, seed, playerDiff = LADDER_PLAYER_DIFF, foe = ladderFoe(9, cls)) {
  const rng = mulberry32(seed), d = makeDuel(cls, foe.cls, {}, foe), ma = {}, mb = {};
  const over = simulate(d, (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff: playerDiff }, ma, dt, rng); if (c) act(me, c); },
    (dd, me, op, dt) => { const c = aiThink(dd, me, op, foe, mb, dt, rng); if (c) act(me, c); });
  return { win: !!over && over.winner === 'a', t: d.clock, by: over ? over.by : 'none', phase: d.b.phase, phaseN: d.b.phaseN, bossHp: d.b.hp / d.b.maxHp, d };
}
export function bossTable(n = 400, playerDiff = LADDER_PLAYER_DIFF, foeOf = (cls) => ladderFoe(9, cls)) {
  const out = {};
  for (const cls of CLASS_IDS) {
    let w = 0, t = 0, to = 0, p2 = 0, flips = 0;
    for (let i = 0; i < n; i++) { const r = bossFight(cls, 7000 + i * 7919 + cls.length * 131, playerDiff, foeOf(cls)); w += r.win; t += r.t; to += r.by === 'time'; p2 += r.phase === 2; flips = Math.max(flips, r.phaseN); }
    out[cls] = { win: w / n, t: t / n, timeouts: to, reachedP2: p2 / n, maxFlips: flips, n };
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 400), pd = +(process.argv[3] || LADDER_PLAYER_DIFF), floor = process.argv[4] != null ? +process.argv[4] : null;
  const foeOf = floor != null ? () => endlessFoe(floor) : (cls) => ladderFoe(9, cls);
  const f0 = foeOf('sword');
  console.log(`${f0.zh} ${f0.en} (${f0.cls}, diff ${f0.diff.toFixed(2)}, hp ×${f0.hpMul.toFixed(2)}, dmg ×${f0.dmgMul.toFixed(2)}) vs ladder player diff ${pd}, ${n} fights per class`);
  const res = bossTable(n, pd, foeOf);
  for (const c of CLASS_IDS) { const r = res[c]; console.log(`${CLASSES[c].en.padEnd(10)} win ${(r.win * 100).toFixed(1)}%  avg ${r.t.toFixed(1)} s  time-outs ${r.timeouts}  reached phase 2 ${(r.reachedP2 * 100).toFixed(0)}%  max flips ${r.maxFlips}`); }
}
