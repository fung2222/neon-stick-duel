// NEON STICK DUEL v2 — modes: 10-fight stage ladder (with two bosses), endless tower (capped curve, boss every 10 floors),
// trial caps for hub trial runs, scoring and save migration from v1. Pure (no DOM).
import { CLASS_IDS, CLASSES } from './classes.js';

export const TRIAL = { ladder: 3, endless: 3 };          // trial runs (hub ?trial=1): ladder fights 1–3, endless floors 1–3
export const LADDER = [
  { id: 'crow',    zh: '夜鴉',     en: 'NIGHT CROW',      cls: 'assassin', diff: 0.12, color: 0x3bff9a, desc: ['新手刺客 · 試下格擋同閃避', 'Rookie assassin · practise guard and dodge'] },
  { id: 'fist',    zh: '後巷鐵拳', en: 'ALLEY IRONFIST',  cls: 'brawler',  diff: 0.2,  color: 0xffa42b, desc: ['埋身硬拳 · 保持距離', 'Close-range bruiser · keep your distance'] },
  { id: 'adept',   zh: '霓虹術士', en: 'NEON ADEPT',      cls: 'mage',     diff: 0.28, color: 0xc77bff, desc: ['遠程法術 · 跳過飛彈貼身', 'Ranged caster · jump the bolts, get close'] },
  { id: 'ronin',   zh: '浪人七號', en: 'RONIN-07',        cls: 'sword',    diff: 0.36, color: 0x5ad8ff, desc: ['流浪劍客 · 小心突刺', 'Wandering blade · watch the lunge'] },
  { id: 'hammer',  zh: '重錘霸王', en: 'HAMMER KING',     cls: 'brawler',  diff: 0.45, color: 0xff4a1a, boss: true, hpMul: 1.55, dmgMul: 1.08, scale: 1.28, desc: ['頭目 · 霸體衝拳，等佢衝完先反擊', 'BOSS · armoured rush — punish after it'] },
  { id: 'witch',   zh: '風暴巫女', en: 'STORM WITCH',     cls: 'mage',     diff: 0.52, color: 0x9b6bff, desc: ['雷柱連發 · 唔好企定', 'Pillar spam · keep moving'] },
  { id: 'phantom', zh: '幻刃',     en: 'PHANTOM EDGE',    cls: 'assassin', diff: 0.6,  color: 0x2bffd0, desc: ['瞬殺繞背 · 留意身後', 'Teleport strikes · mind your back'] },
  { id: 'saint',   zh: '劍聖',     en: 'BLADE SAINT',     cls: 'sword',    diff: 0.68, color: 0xe8f6ff, desc: ['昇龍對空 · 唔好亂跳', 'Rising dragon anti-air · do not jump carelessly'] },
  { id: 'mirror',  zh: '鏡像分身', en: 'MIRROR SHADE',    cls: 'mirror',   diff: 0.74, color: 0xd8d8ff, desc: ['同你一樣嘅職業 · 鬥技術', 'Your own class · pure skill'] },
  { id: 'zero',    zh: '塔主・零', en: 'TOWER LORD ZERO', cls: 'shogun',   diff: 0.86, color: 0xff2440, boss: true, final: true, hpMul: 1.85, dmgMul: 1.1, ultGain: 1.35, scale: 1.34, desc: ['最終頭目 · 機械將軍，血量一半變第二型態', 'FINAL BOSS · the KAGE-SHŌGUN changes form at half HP'] },
];

const RIVALS = {
  sword: [['劍客', 'BLADE'], ['武士', 'DUELIST'], ['斬鐵', 'STEELCUT']],
  mage: [['術士', 'ADEPT'], ['咒師', 'HEXER'], ['星占', 'ASTRAL']],
  brawler: [['拳手', 'FIST'], ['鐵臂', 'IRONARM'], ['重拳', 'HEAVY']],
  assassin: [['刺客', 'BLADE-RUNNER'], ['影子', 'SHADE'], ['夜梟', 'NIGHT OWL']],
};
const PREFIX = [['暗影', 'SHADOW'], ['超載', 'OVERDRIVE'], ['鉻鋼', 'CHROME'], ['幻象', 'PHANTOM'], ['等離子', 'PLASMA'], ['虛空', 'VOID'], ['極光', 'AURORA'], ['零式', 'ZERO-TYPE']];
const HUES = [0.95, 0.12, 0.75, 0.05, 0.16, 0.55, 0.33, 0.88];
export const capCurve = (n, start, cap, tau) => start + (cap - start) * (1 - Math.exp(-Math.max(0, n) / tau));
const hash = (n) => { let x = (n + 1) * 2654435761 >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
export const isBossFloor = (floor) => (floor + 1) % 10 === 0;
export const isMilestone = isBossFloor;

/** foe profile for the ladder (stage 0..9). playerCls resolves the mirror match. */
export function ladderFoe(stage, playerCls = 'sword') {
  const L = LADDER[Math.max(0, Math.min(LADDER.length - 1, stage))];
  const cls = L.cls === 'mirror' ? playerCls : L.cls;
  return { ...L, cls, mode: 'ladder', stage, hpMul: L.hpMul || 1, dmgMul: L.dmgMul || 1, ultGain: L.ultGain || 1, scale: L.scale || 1 };
}

/** foe profile for any endless floor (0-based). Never ends; the curve is capped so it stays winnable. */
export function endlessFoe(floor) {
  const n = Math.max(0, floor | 0), boss = isBossFloor(n);
  let k = hash(n) % 4; if (n > 0 && CLASS_IDS[k] === endlessCls(n - 1)) k = (k + 1) % 4;
  const cls = CLASS_IDS[k], R = RIVALS[cls][hash(n + 77) % 3], pre = PREFIX[Math.floor(n / 10) % PREFIX.length];
  const hue = (HUES[n % HUES.length] + n * 0.037) % 1;
  return {
    id: 'endless-' + n, mode: 'endless', floor: n, cls, boss,
    zh: boss ? `${pre[0]}${R[0]}王` : `${pre[0]}${R[0]}`, en: boss ? `${pre[1]} ${R[1]} KING` : `${pre[1]} ${R[1]}`,
    desc: boss ? ['頭目樓層 · 血厚手重', 'Boss floor · tougher and harder-hitting'] : [`無盡第 ${n + 1} 層 · ${CLASSES[cls].zh}`, `Endless floor ${n + 1} · ${CLASSES[cls].en}`],
    color: hslHex(hue, 1, 0.6),
    diff: capCurve(n, 0.18, 0.95, 16) + (boss ? 0.04 : 0),
    hpMul: 1 + Math.min(0.5, n * 0.015) + (boss ? 0.55 : 0),
    dmgMul: 1 + Math.min(0.22, n * 0.007) + (boss ? 0.06 : 0),
    ultGain: boss ? 1.25 : 1, scale: boss ? 1.28 : 1,
  };
}
function endlessCls(n) { let k = hash(n) % 4; if (n > 0 && CLASS_IDS[k] === endlessCls(n - 1)) k = (k + 1) % 4; return CLASS_IDS[k]; }
function hslHex(h, s, l) { const a = s * Math.min(l, 1 - l); const f = (n) => { const k = (n + h * 12) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return (f(0) << 16) | (f(8) << 8) | f(4); }

/** score for a won fight. level = 1-based ladder stage or endless floor */
export function fightScore(level, d, boss = false) {
  const a = d.a, hpPct = Math.round(a.hp / a.maxHp * 100), perfect = a.hp === a.maxHp;
  const base = 1000 * level, hp = hpPct * 10, time = Math.round(d.time) * 15, combo = a.stats.maxCombo * 60;
  const bonus = (perfect ? 2000 : 0) + (boss ? 3000 : 0);
  return { base, hp, time, combo, perfect: perfect ? 2000 : 0, boss: boss ? 3000 : 0, total: base + hp + time + combo + bonus };
}

/** v1 → v2 save migration. store = cyber-kit createStore. v1 keys: floor, lap, runScore, bestFloor, best, muted. */
export function migrateSave(store) {
  const ver = store.getNum('ver', 1);
  if (ver >= 2) return false;
  const lap = store.getNum('lap', 0);
  if (lap > 0) store.setNum('floor', store.getNum('floor', 0) + lap * 8);
  store.remove('lap');
  if (store.get('cls') == null) store.set('cls', 'sword');
  store.setNum('ver', 2);
  return true;
}
