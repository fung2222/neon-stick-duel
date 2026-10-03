// DPS / TTK sanity table straight from the frame data.  node tests/dps.mjs
// Basic chain: each hit cancels into the next at `chain` × its total time; the last hit plays out fully.
// Projectile damage is used for casters. No proration, no guard: this is the theoretical ceiling.
import { CLASSES, CLASS_IDS } from '../js/classes.js';
const tot = (m) => m.t[0] + m.t[1] + m.t[2];
const dmgOf = (C, m) => {
  if (m.multi) return m.multi * m.dmg + ((m.last && m.last.dmg) || m.dmg) - m.dmg;
  if (m.dmg) return m.dmg;
  let s = 0; for (const f of m.fire || []) { const p = C.projs[f.proj || f.blast]; if (!p) continue; s += f.type === 'meteors' ? (f.n - 1) * p.dmg + 100 : p.dmg; }
  return s;
};
const hp = CLASS_IDS.map((c) => CLASSES[c].hp), avgHp = hp.reduce((a, b) => a + b) / hp.length;
console.log(`| Class | HP | Basic chain (per hit) | Chain dmg | Chain time | Chain DPS | Skill 1 | Skill 2 | Ult | TTK vs ${Math.round(avgHp)} HP (chain loop) |`);
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const id of CLASS_IDS) {
  const C = CLASSES[id], keys = C.combo; let d = 0, t = 0; const per = [];
  keys.forEach((k, i) => { const m = C.moves[k], x = dmgOf(C, m); per.push(x); d += x; t += i < keys.length - 1 ? tot(m) * (m.chain || 1) : tot(m); });
  const dps = d / t;
  console.log(`| ${C.en} | ${C.hp} | ${per.join(' / ')} | ${d} | ${t.toFixed(2)} s | ${dps.toFixed(0)} | ${dmgOf(C, C.moves.s1)} (cd ${C.moves.s1.cd}s) | ${dmgOf(C, C.moves.s2)} (cd ${C.moves.s2.cd}s) | ${dmgOf(C, C.moves.ult)} | ${(avgHp / dps).toFixed(1)} s |`);
}
