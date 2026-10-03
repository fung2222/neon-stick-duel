// AI-vs-AI balance sim for every class matchup.  node tests/balance.mjs [fights=200] [diff=0.7]
import { makeDuel, simulate, CLASS_IDS, CLASSES } from '../js/duel.js';
import { aiThink, mulberry32 } from '../js/ai.js';

export function runMatch(ca, cb, diff, seed) {
  const rng = mulberry32(seed);
  const swap = seed % 2 === 1;   // alternate sides
  const d = swap ? makeDuel(cb, ca) : makeDuel(ca, cb);
  const ma = {}, mb = {};
  const over = simulate(d, (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff }, ma, dt, rng); if (c) me.buf = { cmd: c, t: 0.2 }; },
    (dd, me, op, dt) => { const c = aiThink(dd, me, op, { diff }, mb, dt, rng); if (c) me.buf = { cmd: c, t: 0.2 }; });
  const w = over ? over.winner : 'draw';
  const winA = swap ? w === 'b' : w === 'a', winB = swap ? w === 'a' : w === 'b';
  return { winA, winB, t: d.clock, by: over ? over.by : 'none', A: swap ? d.b : d.a, B: swap ? d.a : d.b };
}
export function matrix(n = 200, diff = 0.7) {
  const res = {};
  for (const a of CLASS_IDS) for (const b of CLASS_IDS) {
    if (res[b + ':' + a]) { const r = res[b + ':' + a]; res[a + ':' + b] = { wa: r.wb, wb: r.wa, t: r.t, to: r.to, n }; continue; }
    let wa = 0, wb = 0, tt = 0, to = 0;
    for (let i = 0; i < n; i++) { const r = runMatch(a, b, diff, 1000 + i * 7919 + a.length * 31 + b.length); wa += r.winA; wb += r.winB; tt += r.t; to += r.by === 'time'; }
    res[a + ':' + b] = { wa, wb, t: tt / n, to, n };
  }
  return res;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 200), diff = +(process.argv[3] || 0.7);
  const res = matrix(n, diff);
  const pad = (s, k = 10) => String(s).padEnd(k);
  console.log(`AI vs AI, ${n} fights per matchup, diff ${diff} (row = class, value = row win %; avg fight time s; time-outs)`);
  console.log(pad('') + CLASS_IDS.map((c) => pad(CLASSES[c].en)).join(''));
  for (const a of CLASS_IDS) console.log(pad(CLASSES[a].en) + CLASS_IDS.map((b) => { const r = res[a + ':' + b]; return pad(`${Math.round(r.wa / n * 100)}% ${r.t.toFixed(0)}s${r.to ? ' ' + r.to + 't' : ''}`); }).join(''));
  for (const a of CLASS_IDS) { let w = 0, k = 0; for (const b of CLASS_IDS) if (b !== a) { w += res[a + ':' + b].wa; k += n; } console.log(`${pad(CLASSES[a].en)} overall vs others: ${(w / k * 100).toFixed(1)}%`); }
}
