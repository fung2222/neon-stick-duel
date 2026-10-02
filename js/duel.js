// NEON STICK DUEL — pure duel simulation (no DOM / three.js), unit-tested in tests/duel.test.mjs.
// 1D fighting axis x (metres), y up. Fighters always face each other. One-thumb command set:
//   jab (tap) · chargeStart / chargeRelease (hold) · jump (swipe up) · dashF / dashB (swipe sideways) · parry (swipe down)
export const GAME_ID = 'neon-stick-duel';
export const ARENA_HALF = 7;
export const TUNE = {
  hp: 100, roundTime: 60, walk: 2.3, approach: 1.15, minGap: 0.62, gravity: 30, jumpV: 10.5,
  dashDist: 3.0, dashTime: 0.22, dashInvuln: 0.18, dashCd: 0.45,
  parryWin: 0.26, parryRecover: 0.24, parryStun: 0.75,
  chargeMax: 0.9, chargeAuto: 1.6, comboWindow: 0.38, friction: 10,
};
// startup → active → recover (s); range measured from body centre along facing
export const MOVES = {
  jab:   { startup: 0.08, active: 0.09, recover: 0.17, range: 1.35, dmg: 6,  kb: 2.4, stun: 0.3,  lunge: 0.25 },
  jab2:  { startup: 0.08, active: 0.09, recover: 0.2,  range: 1.4,  dmg: 7,  kb: 2.8, stun: 0.32, lunge: 0.3 },
  kick:  { startup: 0.11, active: 0.11, recover: 0.32, range: 1.55, dmg: 11, kb: 6.5, stun: 0.5,  lunge: 0.4 },
  heavy: { startup: 0.12, active: 0.13, recover: 0.4,  range: 1.8,  dmg: 12, dmgCharge: 20, kb: 9, stun: 0.65, lunge: 0.9, hitsAir: true },
  dive:  { startup: 0.04, active: 0.5,  recover: 0.2,  range: 1.25, dmg: 10, kb: 5,  stun: 0.45, lunge: 0, hitsAir: true },
};
const COMBO = ['jab', 'jab2', 'kick'];

export function makeFighter(x, facing, hp = TUNE.hp) {
  return { x, y: 0, vx: 0, vy: 0, facing, hp, maxHp: hp, st: 'idle', t: 0, move: null, phase: null, hitDone: false,
    charge: 0, power: 0, combo: 0, comboT: 0, dashCd: 0, dashDir: 0, invuln: 0, stunT: 0, dived: false, seq: 0,
    stats: { hits: 0, dmg: 0, parries: 0, evades: 0, taken: 0 } };
}
export function makeDuel(enemyHp = TUNE.hp) {
  return { a: makeFighter(-2.6, 1), b: makeFighter(2.6, -1, enemyHp), time: TUNE.roundTime, over: null, events: [], clock: 0 };
}
export const actionable = (f) => f.st === 'idle' || f.st === 'walk';
export const airborne = (f) => f.y > 0.001 || f.st === 'jump' || f.st === 'dive';

function startMove(f, name) { f.st = 'attack'; f.move = name; f.phase = 'startup'; f.t = 0; f.hitDone = false; f.seq++; }

/** issue a command; returns true if accepted */
export function act(f, cmd) {
  if (f.st === 'ko' || f.st === 'win') return false;
  switch (cmd) {
    case 'jab': {
      if (f.st === 'jump') { if (f.dived) return false; f.dived = true; startMove(f, 'dive'); f.st = 'dive'; f.vy = Math.min(f.vy, 2); f.vx = f.facing * 7; return true; }
      const chain = f.st === 'attack' && COMBO.includes(f.move) && f.phase === 'recover' && f.combo < 2;
      if (!actionable(f) && !chain) return false;
      f.combo = chain || (f.comboT > 0 && f.combo < 2 && actionable(f)) ? f.combo + 1 : 0;
      startMove(f, COMBO[f.combo]); return true;
    }
    case 'chargeStart':
      if (!actionable(f)) return false; f.st = 'wind'; f.t = 0; f.charge = 0; f.seq++; return true;
    case 'chargeRelease':
      if (f.st !== 'wind') return false; f.power = Math.min(1, f.charge / TUNE.chargeMax); startMove(f, 'heavy'); return true;
    case 'jump':
      if (!actionable(f)) return false; f.st = 'jump'; f.t = 0; f.vy = TUNE.jumpV; f.dived = false; f.vx = f.facing * 1.5; return true;
    case 'dashF': case 'dashB':
      if (!actionable(f) || f.dashCd > 0) return false;
      f.st = 'dash'; f.t = 0; f.dashDir = cmd === 'dashF' ? f.facing : -f.facing; f.invuln = TUNE.dashInvuln; f.dashCd = TUNE.dashCd + TUNE.dashTime; return true;
    case 'parry':
      if (!actionable(f)) return false; f.st = 'parry'; f.t = 0; return true;
  }
  return false;
}

const moveDmg = (f) => { const m = MOVES[f.move]; return Math.round(m.dmg + (m.dmgCharge || 0) * (f.move === 'heavy' ? f.power : 0)); };
export const guardBreak = (f) => f.move === 'heavy' && f.power >= 0.999;

function resolveHit(d, att, def) {
  const m = MOVES[att.move]; if (!m || att.phase !== 'active' || att.hitDone || def.st === 'ko') return;
  const dx = (def.x - att.x) * att.facing, dy = def.y - att.y;
  if (dx < -0.2 || dx > m.range + 0.25) return;
  if (!m.hitsAir && dy > 0.9) return;
  if (m.hitsAir && Math.abs(dy) > 1.7) return;
  att.hitDone = true;
  if (def.invuln > 0) { def.stats.evades++; d.events.push({ type: 'evade', who: def, x: def.x, y: def.y }); return; }
  if (def.st === 'parry' && def.t <= TUNE.parryWin && !guardBreak(att)) {
    def.stats.parries++; att.st = 'stun'; att.t = 0; att.stunT = TUNE.parryStun; att.move = null; att.vx = -att.facing * 3; att.combo = 0;
    d.events.push({ type: 'parry', who: def, att, x: (att.x + def.x) / 2, y: 1.3 }); return;
  }
  const dmg = moveDmg(att);
  def.hp = Math.max(0, def.hp - dmg); def.stats.taken += dmg; att.stats.hits++; att.stats.dmg += dmg;
  const heavy = att.move === 'heavy' || att.move === 'kick';
  if (def.st === 'wind') def.charge = 0;
  def.st = def.hp <= 0 ? 'ko' : 'hit'; def.t = 0; def.stunT = m.stun; def.vx = att.facing * m.kb * (def.hp <= 0 ? 1.6 : 1); def.move = null; def.combo = 0;
  if (def.y > 0.01 || def.hp <= 0) def.vy = Math.max(def.vy, def.hp <= 0 ? 6 : 3);
  d.events.push({ type: 'hit', who: def, att, dmg, heavy, breakGuard: guardBreak(att) && def.st !== 'ko', x: def.x, y: def.y + 1.3, ko: def.hp <= 0 });
  if (def.hp <= 0) d.events.push({ type: 'ko', who: def, att });
}

function stepFighter(f, o, dt) {
  f.t += dt; f.comboT = Math.max(0, f.comboT - dt); f.dashCd = Math.max(0, f.dashCd - dt); f.invuln = Math.max(0, f.invuln - dt);
  const gap = Math.abs(o.x - f.x);
  if (actionable(f) && f.y <= 0) f.facing = o.x >= f.x ? 1 : -1;
  switch (f.st) {
    case 'idle': case 'walk': {
      const want = f.hold ? 0 : gap > TUNE.approach + 0.05 ? 1 : 0;
      f.st = want ? 'walk' : 'idle'; f.vx = want ? f.facing * TUNE.walk * (f.walkMul || 1) : f.vx * Math.max(0, 1 - TUNE.friction * dt);
      break;
    }
    case 'attack': {
      const m = MOVES[f.move]; const t = f.t;
      if (t < m.startup) f.phase = 'startup';
      else if (t < m.startup + m.active) { if (f.phase !== 'active') f.vx = f.facing * m.lunge / Math.max(0.05, m.active); f.phase = 'active'; }
      else if (t < m.startup + m.active + m.recover) { if (f.phase === 'active') f.vx *= 0.2; f.phase = 'recover'; }
      else { f.st = 'idle'; f.move = null; f.phase = null; f.comboT = COMBO.includes(f.lastMove) ? TUNE.comboWindow : 0; }
      if (f.move) f.lastMove = f.move;
      if (f.phase !== 'active') f.vx *= Math.max(0, 1 - TUNE.friction * dt);
      break;
    }
    case 'wind': f.charge += dt; f.vx *= Math.max(0, 1 - TUNE.friction * dt); if (f.charge >= TUNE.chargeAuto) act(f, 'chargeRelease'); break;
    case 'jump': case 'dive':
      if (f.st === 'dive') { const m = MOVES.dive; f.phase = f.t < m.startup ? 'startup' : 'active'; }
      break;
    case 'dash': f.vx = f.dashDir * TUNE.dashDist / TUNE.dashTime; if (f.t >= TUNE.dashTime) { f.st = 'idle'; f.vx *= 0.15; } break;
    case 'parry': f.vx *= Math.max(0, 1 - TUNE.friction * dt); if (f.t >= TUNE.parryWin + TUNE.parryRecover) f.st = 'idle'; break;
    case 'hit': case 'stun': f.vx *= Math.max(0, 1 - 6 * dt); if (f.t >= f.stunT && f.y <= 0) { f.st = 'idle'; } break;
    case 'ko': f.vx *= Math.max(0, 1 - 3 * dt); break;
    case 'win': f.vx = 0; break;
  }
  // vertical physics
  if (f.y > 0 || f.vy > 0) {
    f.vy -= TUNE.gravity * dt; f.y += f.vy * dt;
    if (f.y <= 0) { f.y = 0; f.vy = 0; if (f.st === 'jump' || f.st === 'dive') { f.st = 'idle'; f.move = null; f.phase = null; f.landed = true; } }
  }
  f.x += f.vx * dt;
  f.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, f.x));
}

/** advance the duel by dt seconds; fills d.events (cleared by the caller) */
export function step(d, dt) {
  if (d.over) { stepFighter(d.a, d.b, dt); stepFighter(d.b, d.a, dt); return; }
  d.clock += dt; d.time = Math.max(0, d.time - dt);
  stepFighter(d.a, d.b, dt); stepFighter(d.b, d.a, dt);
  // no overlap on the ground (airborne fighters may cross over)
  if (d.a.y < 0.8 && d.b.y < 0.8) {
    const gap = d.b.x - d.a.x, s = Math.sign(gap) || 1;
    if (Math.abs(gap) < TUNE.minGap) {
      const push = (TUNE.minGap - Math.abs(gap)) / 2;
      d.a.x -= s * push; d.b.x += s * push;
      for (const f of [d.a, d.b]) f.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, f.x));
      if (Math.abs(d.b.x - d.a.x) < TUNE.minGap - 0.01) { // pinned at a wall: push the other one
        if (Math.abs(d.a.x) >= ARENA_HALF) d.b.x = d.a.x + s * TUNE.minGap; else d.a.x = d.b.x - s * TUNE.minGap;
      }
    }
  }
  resolveHit(d, d.a, d.b); resolveHit(d, d.b, d.a);
  if (d.a.st === 'ko' || d.b.st === 'ko') d.over = { winner: d.a.st === 'ko' ? (d.b.st === 'ko' ? 'draw' : 'b') : 'a', by: 'ko' };
  else if (d.time <= 0) {
    const pa = d.a.hp / d.a.maxHp, pb = d.b.hp / d.b.maxHp;
    d.over = { winner: pa > pb ? 'a' : pb > pa ? 'b' : 'draw', by: 'time' };
  }
  if (d.over) { const w = d.over.winner === 'a' ? d.a : d.over.winner === 'b' ? d.b : null; if (w && w.st !== 'ko') { w.st = 'win'; w.t = 0; } }
}

/** score for a cleared floor */
export function floorScore(floor, d) {
  const ms = isMilestone(floor - 1) ? 5000 : 0;
  const hpLeft = Math.round(d.a.hp / d.a.maxHp * 100), perfect = d.a.hp === d.a.maxHp;
  return { base: 1000 * floor, hp: hpLeft * 10, time: Math.round(d.time) * 15, perfect: perfect ? 2000 : 0, milestone: ms, get total() { return this.base + this.hp + this.time + this.perfect + this.milestone; } };
}

// ---------------------------------------------------------------- tower opponents (original characters)
export const TOWER = [
  { id: 'dummy',   zh: '練習木人',   en: 'TRAINING DUMMY', color: 0xff6b9a, hp: 60,  walk: 0.6, think: 0.9,  parry: 0.0,  evade: 0.0,  heavy: 0.0,  combo: 0.2, dash: 0.0, jump: 0.0,  punish: 0.1, desc: '慢吞吞 · 學下基本功', descEn: 'Slow and steady · learn the basics' },
  { id: 'brawler', zh: '後巷打仔',   en: 'ALLEY BRAWLER',  color: 0xffc22b, hp: 90,  walk: 1.0, think: 0.55, parry: 0.08, evade: 0.05, heavy: 0.25, combo: 0.6, dash: 0.2, jump: 0.05, punish: 0.3, desc: '亂咁揮拳 · 鍾意連打', descEn: 'Wild swings · loves combos' },
  { id: 'stalker', zh: '霓虹刺客',   en: 'NEON STALKER',   color: 0xa66bff, hp: 90,  walk: 1.2, think: 0.4,  parry: 0.12, evade: 0.35, heavy: 0.1,  combo: 0.5, dash: 0.6, jump: 0.2,  punish: 0.45, desc: '衝刺閃避 · 神出鬼沒', descEn: 'Dashes and dodges · hard to pin down' },
  { id: 'hammer',  zh: '重錘工人',   en: 'HAMMER HAND',    color: 0xff5a2b, hp: 130, walk: 0.8, think: 0.5,  parry: 0.1,  evade: 0.05, heavy: 0.7,  combo: 0.2, dash: 0.1, jump: 0.0,  punish: 0.3, desc: '慢但痛 · 留意佢儲力', descEn: 'Slow but painful · watch the charge' },
  { id: 'volt',    zh: '雷光拳',     en: 'VOLT FIST',      color: 0xf4ff3b, hp: 110, walk: 1.3, think: 0.3,  parry: 0.2,  evade: 0.2,  heavy: 0.2,  combo: 0.85, dash: 0.4, jump: 0.15, punish: 0.6, desc: '快拳三連 · 唔好硬食', descEn: 'Lightning triple jabs · never trade blows' },
  { id: 'mirror',  zh: '鏡像分身',   en: 'MIRROR SHADE',   color: 0xe8e8ff, hp: 110, walk: 1.1, think: 0.3,  parry: 0.3,  evade: 0.25, heavy: 0.35, combo: 0.6, dash: 0.35, jump: 0.25, punish: 0.6, mirror: true, desc: '模仿你嘅招式', descEn: 'Copies your moves' },
  { id: 'ironwall',zh: '鐵壁守衛',   en: 'IRONWALL',       color: 0x3bff8a, hp: 140, walk: 0.9, think: 0.35, parry: 0.5,  evade: 0.1,  heavy: 0.3,  combo: 0.5, dash: 0.2, jump: 0.05, punish: 0.7, desc: '擅長格擋 · 用滿蓄力破防', descEn: 'Parry expert · break it with a full charge' },
  { id: 'lord',    zh: '塔主・零',   en: 'TOWER LORD ZERO', color: 0xff2bd6, hp: 170, walk: 1.3, think: 0.22, parry: 0.38, evade: 0.3,  heavy: 0.4,  combo: 0.8, dash: 0.5, jump: 0.25, punish: 0.85, desc: '集大成 · 最後一戰', descEn: 'Master of all styles' },
];

/**
 * AI controller. Call every frame: returns a command string or null. `mem` is per-fighter scratch state.
 * Reactive defence is decided once per opposing attack (seq), offence on a think timer.
 */
export function aiThink(d, me, op, prof, mem, dt, rng = Math.random) {
  if (d.over || me.st === 'ko' || me.st === 'win') return null;
  mem.cool = (mem.cool ?? prof.think) - dt;
  if (me.st === 'wind') { mem.chargeT = (mem.chargeT || 0) - dt; if (mem.chargeT <= 0) return 'chargeRelease'; return null; }
  const gap = Math.abs(op.x - me.x);
  // defence: opponent began a threatening action
  const threat = (op.st === 'attack' && op.phase === 'startup') || op.st === 'wind' || op.st === 'dive';
  if (threat && op.seq !== mem.seenSeq && gap < 3.2) {
    mem.seenSeq = op.seq;
    if (op.st === 'wind' && gap < 1.6 && rng() < prof.punish) return 'jab';         // interrupt the charge
    const r = rng();
    if (op.st !== 'wind' && r < prof.parry) return 'parry';
    if (r < prof.parry + prof.evade) return rng() < 0.5 ? 'dashB' : 'jump';
  }
  // punish a stunned / recovering opponent
  if ((op.st === 'stun' || (op.st === 'attack' && op.phase === 'recover')) && gap < 1.6 && actionable(me) && rng() < prof.punish * dt * 8) return 'jab';
  if (me.st === 'attack' && me.phase === 'recover' && me.move !== 'heavy' && me.move !== mem.comboMove && gap < 1.6) { mem.comboMove = me.move; if (rng() < prof.combo) return 'jab'; }
  if (me.st === 'jump' && !me.dived && me.vy < 3 && gap < 2.4) return 'jab';
  if (mem.cool > 0 || !actionable(me)) return null;
  mem.cool = prof.think * (0.6 + rng() * 0.8);
  if (prof.mirror && mem.lastSeen && rng() < 0.6) { const c = mem.lastSeen; mem.lastSeen = null; if (c === 'chargeStart') mem.chargeT = 0.5 + rng() * 0.5; return c; }
  if (gap <= MOVES.jab.range + 0.1) {
    if (rng() < prof.heavy) { mem.chargeT = 0.25 + rng() * (prof.id === 'ironwall' || prof.id === 'lord' ? 0.9 : 0.6); return 'chargeStart'; }
    return 'jab';
  }
  if (gap < 4.5) { const r = rng(); if (r < prof.dash * 0.5) return 'dashF'; if (r < prof.dash * 0.5 + prof.jump) return 'jump'; }
  return null;
}

// ---------------------------------------------------------------- endless floors (beyond the 8 authored opponents)
const PREFIX = [['暗影', 'SHADOW'], ['超載', 'OVERDRIVE'], ['鉻鋼', 'CHROME'], ['幻象', 'PHANTOM'], ['等離子', 'PLASMA'], ['虛空', 'VOID'], ['極光', 'AURORA'], ['零式', 'ZERO-TYPE']];
const HUES = [0.95, 0.12, 0.75, 0.05, 0.16, 0.55, 0.33, 0.88];
const lerpCap = (n, start, cap, tau = 14) => start + (cap - start) * (1 - Math.exp(-Math.max(0, n) / tau));
/** opponent profile for any floor index (0-based). 0..7 = authored tower, 8+ = procedural remix with a capped difficulty curve. */
export function opponentFor(floor) {
  if (floor < TOWER.length) return { ...TOWER[floor], floor };
  const e = floor - TOWER.length;                     // 0,1,2… endless step
  const base = TOWER[1 + (e % (TOWER.length - 1))];   // cycle archetypes 2F..8F
  const pre = PREFIX[Math.floor(e / (TOWER.length - 1)) % PREFIX.length];
  const k = (cap, tau) => lerpCap(e, 0, cap, tau);
  const clamp01 = (v) => Math.max(0, Math.min(0.92, v));
  const hue = (HUES[e % HUES.length] + e * 0.037) % 1;
  return {
    ...base, floor, id: base.id, endless: true, mirror: base.mirror,
    zh: `${pre[0]}${base.zh}`, en: `${pre[1]} ${base.en}`,
    desc: `無盡第 ${e + 1} 戰 · ${base.desc}`, descEn: `Endless bout ${e + 1} · ${base.descEn}`,
    color: hslHex(hue, 1, 0.6),
    hp: Math.round(Math.min(330, 150 + e * 6)),                      // capped HP
    walk: Math.min(1.5, base.walk + k(0.4, 10)),
    think: Math.max(0.17, base.think - k(0.18, 12)),                  // faster decisions, floor 0.17 s
    parry: clamp01(Math.max(base.parry, 0.15) + k(0.3, 16)), evade: clamp01(base.evade + k(0.2, 16)),
    heavy: clamp01(base.heavy + k(0.15, 20)), combo: clamp01(base.combo + k(0.2, 12)),
    dash: clamp01(base.dash + k(0.2, 16)), jump: clamp01(base.jump + k(0.1, 16)), punish: clamp01(base.punish + k(0.3, 12)),
  };
}
function hslHex(h, s, l) { const a = s * Math.min(l, 1 - l); const f = (n) => { const k = (n + h * 12) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return (f(0) << 16) | (f(8) << 8) | f(4); }
/** every 10 floors = milestone (theme shift + bonus) */
export const isMilestone = (floor) => (floor + 1) % 10 === 0;
