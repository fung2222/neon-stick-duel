// NEON STICK DUEL v2 — pure fighting simulation (no DOM / three.js), unit-tested in tests/duel.test.mjs.
// Side-on 1D arena (x metres, y up). Free movement from an intent (in.mx -1..1, in.guard) plus buffered commands:
//   atk (combo chain / air combo) · s1 · s2 (cooldown skills) · ult (meter) · jump · dodge
// Systems: frame data (startup/active/recover), chain + skill cancel windows, juggles with decay + cap, knockdown,
// guard with chip + guard meter, super armour, invulnerability, projectiles / pillars / meteors, hit-stop, ult freeze.
import { CLASSES, classOf } from './classes.js';
export { CLASSES, CLASS_IDS, classOf } from './classes.js';

export const GAME_ID = 'neon-stick-duel';
export const DT = 1 / 60;
export const ARENA_HALF = 7.5;
export const TUNE = {
  roundTime: 60, gravity: 32, jumpV: 11.2, friction: 12, minGap: 0.6, backMul: 0.8,
  bodyH: 2.2, guardH: 1.65, halfW: 0.35,
  dodgeT: 0.3, dodgeV: 8.8, dodgeInv: 0.26, dodgeCd: 0.85, comboWindow: 0.32, bufferT: 0.2,
  ultDeal: 0.1, ultTake: 0.13, ultBlockDeal: 0.03, ultBlockTake: 0.05, ultFreeze: 0.8,
  chip: 0.1, chipUlt: 0.25, guardDrain: 0.3, guardRegen: 22, guardBreakStun: 1.0,
  downT: 0.55, riseT: 0.28, downInv: 0.9, jugCap: 6, prorate: 0.075, prorateMin: 0.42, prorateUlt: 0.6,
  djMul: 0.9, djMin: 0.1, djAir: true,            // double jump: 0.9 × jump speed (≈ 81 % height), not before 0.1 s of airtime; djAir = also out of an air attack's recovery
  turnDelay: 0.12,                   // grounded fighters stuck facing away (guard / block / hit) turn to the foe after this
  stopMin: 2 / 60, stopMax: 6 / 60,  // hit-stop 2–6 frames by hit strength
};
/** final boss tuning (only fighters whose class has `phases` use it; the four player classes never touch this) */
export const BOSS_TUNE = {
  parryStun: 0.26,      // Mirror Guard: stagger of a parried attacker (the counter's startup is 0.34 s → ~5 frames to have guard held / a dodge buffered)
  crushMul: 1.25, crushStun: 0.7,   // a skill / ult / projectile into Mirror Guard breaks it: +25 % damage, long stun
  shove: 7,             // phase transition: shockwave pushes a close opponent away (no damage)
  // poise: the big boss can't be juggled like a normal fighter — non-ult launches ×0.55, falls out after 3 juggle hits,
  // basic hit-stun ×0.8 (still stuns: every basic string still interrupts it; it just recovers sooner)
  launchMul: 0.7, jugCap: 4, stunMul: 0.8,
};
/** hit-stop (s) from hit strength: 2 frames for chip-light hits → 6 frames for heavy launchers / spikes / finishers */
export function hitStopOf(dmg, spec) {
  const heavy = (spec.launch || 0) >= 8 || !!spec.spike || (spec.kb || 0) >= 5;
  const k = Math.min(1, Math.max(0, (dmg - 25) / 75)) * 0.75 + (heavy ? 0.25 : 0) + (spec.kind === 'skill' ? 0.1 : 0);
  return Math.round((2 + 4 * Math.min(1, k))) / 60;
}

let PID = 1;
export function makeFighter(clsId, x, facing, o = {}) {
  const C = classOf(clsId);
  const hp = Math.round(C.hp * (o.hpMul || 1));
  return {
    cls: C.id, C, x, y: 0, vx: 0, vy: 0, facing, hp, maxHp: hp, st: 'idle', t: 0,
    mk: null, ticks: 0, connected: false, fired: 0, selfVyDone: false, seq: 0,
    comboN: 0, comboT: 0, airN: 0, cd: { s1: 0, s2: 0 }, ult: o.ult || 0, ultGain: o.ultGain || 1, gd: 100, gdT: 0,
    inv: 0, stunT: 0, jug: 0, jugCap: false, chain: 0, dodgeCd: 0, dodgeDir: 0, dj: false, djT: 9, airT: 0, faceT: 0,
    in: { mx: 0, guard: false }, buf: null, dmgMul: o.dmgMul || 1, scale: o.scale || 1, boss: !!o.boss,
    phase: C.phases ? 1 : 0, phaseN: 0, flashSeq: -1,   // boss only: current phase (1 → 2 once), number of flips (tests), telegraph flash done for seq
    stats: { hits: 0, dmg: 0, taken: 0, blocks: 0, evades: 0, maxCombo: 0, ults: 0, skills: 0 },
  };
}
export function makeDuel(clsA = 'sword', clsB = 'brawler', oa = {}, ob = {}) {
  return { a: makeFighter(clsA, -2.6, 1, oa), b: makeFighter(clsB, 2.6, -1, ob), projs: [], time: ob.time || TUNE.roundTime,   // ob.time: longer round for the final boss
    over: null, events: [], clock: 0, stop: 0, freeze: 0, freezeBy: null, overT: 0 };
}

export const moveOf = (f) => (f.mk ? f.C.moves[f.mk] : null);
const total = (m) => m.t[0] + m.t[1] + m.t[2];
export const grounded = (f) => f.y <= 0.001 && f.vy <= 0;
export const actionable = (f) => (f.st === 'idle' || f.st === 'walk' || f.st === 'guard') && grounded(f);
export function phaseOf(f) {
  const m = moveOf(f); if (!m || f.st !== 'atk') return null;
  return f.t < m.t[0] ? 'su' : f.t < m.t[0] + m.t[1] ? 'ac' : 'rc';
}
const inWin = (w, t) => w && t >= w[0] && t <= w[1];
export function isInv(f) {
  if (f.inv > 0 || f.st === 'down' || f.st === 'rise' || f.st === 'phase' || f.jugCap) return true;
  const m = moveOf(f); return f.st === 'atk' && !!m && inWin(m.inv, f.t);
}
const isArmor = (f) => { const m = moveOf(f); return f.st === 'atk' && !!m && inWin(m.armor, f.t); };
const clampX = (x) => Math.max(-ARENA_HALF, Math.min(ARENA_HALF, x));
/** turn to face the opponent (no change when standing on the same spot) */
export function faceFoe(f, o) { if (Math.abs(o.x - f.x) > 0.02) f.facing = o.x > f.x ? 1 : -1; f.faceT = 0; }
export const facingAway = (f, o) => Math.abs(o.x - f.x) > 0.05 && Math.sign(o.x - f.x) !== f.facing;

/** queue a command (kept in a short input buffer so slightly early presses still come out) */
export function act(f, cmd) { if (f.st === 'ko' || f.st === 'win') return false; f.buf = { cmd, t: TUNE.bufferT }; return true; }

function startMove(d, f, key) {
  const m = f.C.moves[key];
  f.st = 'atk'; f.mk = key; f.t = 0; f.ticks = 0; f.connected = false; f.fired = 0; f.selfVyDone = false; f.seq++;
  d.events.push({ type: 'move', who: f, key, kind: m.kind });
}

function tryCmd(d, f, o, cmd) {
  if (d.over || f.st === 'ko' || f.st === 'win') return false;
  const C = f.C, m = moveOf(f), inMove = f.st === 'atk' && !!m;
  const T = inMove ? total(m) : 0;
  const chainOk = inMove && m.chain != null && f.t >= m.chain * T;
  const afterActive = inMove && f.t >= m.t[0] + (f.connected ? 0 : m.t[1]);
  const skillCancel = inMove && (m.kind === 'basic' || m.kind === 'air') && afterActive && f.t >= m.t[0];
  const act0 = actionable(f), inAir = f.st === 'jump';
  if (C.phases && cmd.startsWith('bm:')) {   // boss move command (classes.js: phase / cd / sub)
    const key = cmd.slice(3), bm = C.moves[key];
    if (!bm || bm.sub || (bm.phase && bm.phase !== f.phase) || (f.cd[key] || 0) > 0 || !grounded(f)) return false;
    if (!(act0 || skillCancel)) return false;
    faceFoe(f, o); startMove(d, f, key); if (bm.cd) f.cd[key] = bm.cd; f.comboN = 0; f.stats.skills++; return true;
  }
  switch (cmd) {
    case 'atk': {
      if (act0) {
        faceFoe(f, o);   // remap after a side switch (e.g. a buffered attack right on landing / out of guard)
        const idx = f.comboT > 0 && f.comboN < C.combo.length ? f.comboN : 0;
        startMove(d, f, C.combo[idx]); f.comboN = idx + 1; return true;
      }
      if (inMove && m.kind === 'basic' && chainOk && f.comboN < C.combo.length && grounded(f)) { startMove(d, f, C.combo[f.comboN]); f.comboN++; return true; }
      if ((inAir || (inMove && m.kind === 'air' && chainOk) || (inMove && m.kind !== 'air' && f.y > 0.3 && f.t >= T * 0.6)) && f.airN < C.airCombo.length) {
        startMove(d, f, C.airCombo[f.airN]); f.airN++; return true;
      }
      return false;
    }
    case 's1': case 's2': {
      const sm = C.moves[cmd];
      if (f.cd[cmd] > 0) return false;
      const air = !grounded(f);
      if (air && !sm.air) return false;
      if (!(act0 || inAir || skillCancel)) return false;
      if (act0 && grounded(f)) f.facing = o.x >= f.x ? 1 : -1;
      startMove(d, f, cmd); f.cd[cmd] = sm.cd; f.comboN = 0; f.stats.skills++; return true;
    }
    case 'ult': {
      if (f.ult < 100 || !grounded(f)) return false;
      if (C.moves.ult.phase && C.moves.ult.phase !== f.phase) return false;   // boss: ult only in its phase
      const fromSkill = inMove && m.kind === 'skill' && f.connected && f.t >= m.t[0] + m.t[1];
      if (!(act0 || skillCancel || fromSkill)) return false;
      if (act0) f.facing = o.x >= f.x ? 1 : -1;
      startMove(d, f, 'ult'); f.ult = 0; f.comboN = 0; f.stats.ults++;
      d.freeze = TUNE.ultFreeze; d.freezeBy = f;
      d.events.push({ type: 'ult', who: f, x: f.x, y: f.y });
      return true;
    }
    case 'jump': {
      if (!grounded(f)) {
        // double jump: once per airtime, from a jump or the recovery of an air attack, slightly lower than the first
        const airOk = f.st === 'jump' || (TUNE.djAir && inMove && m.kind === 'air' && f.t >= m.t[0] + m.t[1]);
        if (!airOk || f.dj || f.airT < TUNE.djMin || d.over) return false;
        f.dj = true; f.djT = 0; f.st = 'jump'; f.t = 0; f.mk = null; f.vy = TUNE.jumpV * TUNE.djMul;
        f.vx = Math.abs(f.in.mx) > 0.2 ? f.in.mx * f.C.walk * 1.05 : f.vx * 0.6;
        d.events.push({ type: 'jump', who: f, dbl: true, x: f.x, y: f.y });
        return true;
      }
      const jc = inMove && m.kind === 'basic' && m.launch > 0 && f.connected && f.t >= m.t[0] + m.t[1];
      if (!(act0 || jc)) return false;
      f.st = 'jump'; f.t = 0; f.vy = TUNE.jumpV; f.airN = 0; f.mk = null;
      f.vx = jc ? f.facing * 2.6 : f.in.mx * f.C.walk * 1.05;
      d.events.push({ type: 'jump', who: f, cancel: jc });
      return true;
    }
    case 'dodge': {
      if (!act0 || f.dodgeCd > 0) return false;
      f.st = 'dodge'; f.t = 0; f.mk = null;
      f.dodgeDir = Math.abs(f.in.mx) > 0.2 ? Math.sign(f.in.mx) : -f.facing;
      f.inv = TUNE.dodgeInv; f.dodgeCd = TUNE.dodgeCd + TUNE.dodgeT;
      d.events.push({ type: 'dodge', who: f });
      return true;
    }
  }
  return false;
}

// -------------------------------------------------------------- projectiles / spawned effects
function spawnProj(d, f, o, key, extra = {}) {
  const s = f.C.projs[key];
  const p = { id: PID++, owner: f, key, cls: f.cls, ...s, ...extra, t: 0, hit: false, dead: false, srcKind: f.mk ? f.C.moves[f.mk].kind : null };
  p.x = extra.x ?? f.x + f.facing * 0.6;
  p.y = (extra.y ?? (f.y + s.y)) + (extra.dy || 0);
  p.vx = (s.v || 0) * f.facing; p.vy = s.vy || 0; p.dir = f.facing;
  d.projs.push(p); d.events.push({ type: 'proj', who: f, p });
  return p;
}
function fire(d, f, o, ev) {
  switch (ev.type) {
    case 'proj': spawnProj(d, f, o, ev.proj, { dy: ev.dy || 0 }); break;
    case 'blink': {
      const ox = f.x;
      let nx = f.x + f.facing * ev.dist;
      // cornered: no room behind → blink across to the far side of the opponent instead
      if (Math.abs(nx) > ARENA_HALF - 0.6 && Math.abs(clampX(nx) - f.x) < 2.5) nx = o.x + f.facing * 3.2;
      f.x = clampX(nx); f.facing = o.x >= f.x ? 1 : -1;
      if (ev.blast) spawnProj(d, f, o, ev.blast, { x: ox, y: f.y + 0.4 });
      d.events.push({ type: 'blink', who: f, from: ox, to: f.x, y: f.y });
      break;
    }
    case 'teleport': {
      const ox = f.x, gap = o.x - f.x, side = Math.sign(f.x - o.x) || -1;
      let nx;
      if (Math.abs(gap) <= ev.maxDist) {
        nx = ev.behind ? o.x - side * 0.85 : o.x + side * 0.85;
        if (Math.abs(nx) > ARENA_HALF - 0.1) nx = o.x + side * 0.85;   // no room behind (wall): appear in front
      } else nx = f.x + Math.sign(gap) * ev.maxDist;
      f.x = clampX(nx); f.y = Math.max(0, o.y * 0.5); f.facing = o.x >= f.x ? 1 : -1;
      d.events.push({ type: 'blink', who: f, from: ox, to: f.x, y: f.y, teleport: true });
      break;
    }
    case 'pillar': {
      const lead = o.st === 'walk' || o.st === 'dodge' ? o.vx * 0.3 : 0;   // aim slightly ahead of a moving target
      const dx = Math.max(-ev.maxDist, Math.min(ev.maxDist, o.x + lead - f.x));
      spawnProj(d, f, o, ev.proj, { x: clampX(f.x + dx), y: 0 });
      break;
    }
    case 'rain': {   // boss Data-Blade Rain: n telegraphed blades centred on the foe, dropping left → right (marker time = delay)
      const span = (ev.n - 1) * ev.gap;   // the foe stands under blade 2 (standing still is never safe); gaps of gap − 2 × (r + body half-width) between markers
      const x0 = Math.max(-ARENA_HALF + 0.4, Math.min(ARENA_HALF - 0.4 - span, o.x - 2 * ev.gap));
      for (let i = 0; i < ev.n; i++) spawnProj(d, f, o, ev.proj, { x: x0 + i * ev.gap, y: 0, delay: ev.delay + i * ev.step, idx: i, delay0: ev.delay + i * ev.step });
      break;
    }
    case 'decoy': {  // boss Glitch Step after-image: a harmless image near the foe (side 1 = between foe and boss, -1 = behind the foe)
      const s = f.C.projs.decoy, side = Math.sign(f.x - o.x) || f.facing, x = clampX(o.x + ev.side * side * ev.dist);
      const p = { id: PID++, owner: f, key: 'decoy', cls: f.cls, ...s, life: ev.life || s.life, life0: ev.life || s.life, t: 0, hit: false, dead: false, x, y: 0, vx: 0, vy: 0, dir: Math.sign(o.x - x) || 1, harmless: true };
      d.projs.push(p); d.events.push({ type: 'proj', who: f, p });
      break;
    }
    case 'meteors': {
      const offs = [-1.1, 0.8, -0.3, 1.3, 0.2, 0];
      for (let i = 0; i < ev.n; i++) {
        const last = i === ev.n - 1;
        spawnProj(d, f, o, ev.proj, { x: clampX(o.x + offs[i % offs.length]), y: 8 + i * 1.6, last, dmg: last ? 100 : f.C.projs[ev.proj].dmg, launch: last ? 9 : 5, r: last ? 1.3 : 1.0 });
      }
      break;
    }
  }
}

// -------------------------------------------------------------- hits
function overlapBox(att, def, box) {
  const dx = (def.x - att.x) * att.facing;
  if (dx + TUNE.halfW < box[0] || dx - TUNE.halfW > box[1]) return false;
  const h = def.st === 'guard' || def.st === 'block' ? TUNE.guardH : def.st === 'air' ? 1.4 : TUNE.bodyH;
  const y0 = att.y + box[2], y1 = att.y + box[3];
  return y1 >= def.y && y0 <= def.y + h;
}
function overlapProj(p, def) {
  if (Math.abs(p.x - def.x) > p.r + TUNE.halfW) return false;
  const h = def.st === 'guard' || def.st === 'block' ? TUNE.guardH : TUNE.bodyH;
  const y0 = p.y - (p.h ? 0 : p.r), y1 = p.y + (p.h || p.r);
  return y1 >= def.y && y0 <= def.y + h;
}

/** apply one hit. src = attacking fighter, spec = move / projectile data. Returns 'hit' | 'block' | 'evade' | 'armor' | null */
function applyHit(d, att, def, spec, srcX) {
  if (def.st === 'ko' || d.over) return null;
  if (isInv(def)) {
    if (def.st === 'dodge' || def.st === 'atk') { def.stats.evades++; d.events.push({ type: 'evade', who: def, x: def.x, y: def.y + 1.3 }); }
    return 'evade';
  }
  const isUlt = spec.kind === 'ult' || spec.ult;
  const dm = def.st === 'atk' ? moveOf(def) : null, stance = !!(dm && dm.parry && inWin(dm.parry, def.t));
  if (stance && !spec.key && (spec.kind === 'basic' || spec.kind === 'air') && (att.x - def.x) * def.facing >= -0.15) {
    // boss Mirror Guard: parry a basic / air melee hit from the front → attacker staggers, the boss counters
    const dir = Math.sign(att.x - def.x) || -def.facing;
    att.mk = null; att.comboN = 0; att.t = 0; att.vx = dir * 2.6;
    if (att.y > 0.05) { att.st = 'air'; att.vy = Math.max(att.vy, 4); att.jug++; } else { att.st = 'hit'; att.stunT = BOSS_TUNE.parryStun; }
    def.facing = dir; startMove(d, def, dm.counter);
    d.stop = Math.max(d.stop, 5 / 60);
    d.events.push({ type: 'parry', who: def, att, x: def.x + def.facing * 0.7, y: def.y + 1.3 });
    return 'parry';
  }
  if (stance && spec.key && spec.vx && (spec.srcKind === 'basic' || spec.srcKind === 'air') && (srcX - def.x) * def.facing >= -0.15) {
    // Mirror Guard vs a basic projectile (bolt / orb / thrown dagger) from the front: the mirror sends it back at the caster.
    // Skill projectiles (pillar, Phantom daggers…) and the meteors are not reflected — they break the mirror like a melee skill.
    d.stop = Math.max(d.stop, 3 / 60);
    d.events.push({ type: 'parry', who: def, att, proj: true, x: def.x + def.facing * 0.7, y: def.y + 1.3 });
    return 'reflect';
  }
  let dmg = spec.dmg * att.dmgMul;
  const guarding = (def.st === 'guard' || def.st === 'block') && grounded(def) && (srcX - def.x) * def.facing >= -0.15;
  if (guarding && !spec.unblockable) {
    const chip = Math.round(dmg * (isUlt ? TUNE.chipUlt : TUNE.chip));
    def.hp = Math.max(1, def.hp - chip); def.stats.taken += chip; def.stats.blocks++;
    if (bossPhase(d, def, att)) return 'block';
    def.gd -= dmg * TUNE.guardDrain; def.gdT = 1.0;
    def.st = 'block'; def.t = 0; def.stunT = Math.min(0.4, (spec.stun || 0.3) * 0.6);
    def.vx = Math.sign(def.x - srcX || -def.facing) * ((spec.kb || 1) * 0.6 + 1.2);
    if (!isUlt) { att.ult = Math.min(100, att.ult + dmg * TUNE.ultBlockDeal * att.ultGain); def.ult = Math.min(100, def.ult + dmg * TUNE.ultBlockTake * def.ultGain); }
    d.stop = Math.max(d.stop, TUNE.stopMin);
    d.events.push({ type: 'block', who: def, att, dmg: chip, x: def.x + def.facing * 0.4, y: def.y + 1.2 });
    if (def.gd <= 0) {
      def.gd = 55; def.st = 'stun'; def.t = 0; def.stunT = TUNE.guardBreakStun; def.vx = 0;
      d.events.push({ type: 'guardBreak', who: def, x: def.x, y: def.y + 1.3 });
    }
    return 'block';
  }
  const stunned = def.st === 'hit' || def.st === 'air' || def.st === 'stun';
  def.chain = stunned ? def.chain + 1 : 1;
  const scale = Math.max(isUlt ? TUNE.prorateUlt : TUNE.prorateMin, 1 - TUNE.prorate * (def.chain - 1));
  dmg = Math.max(1, Math.round(dmg * scale));
  const crush = stance;   // skill / ult / projectile into Mirror Guard: the mirror breaks
  if (crush) dmg = Math.round(dmg * BOSS_TUNE.crushMul);
  if (isArmor(def) && def.hp - dmg > 0) {
    dmg = Math.round(dmg * 0.8);
    def.hp -= dmg; def.stats.taken += dmg; att.stats.dmg += dmg; att.stats.hits++;
    att.ult = Math.min(100, att.ult + dmg * TUNE.ultDeal * att.ultGain); def.ult = Math.min(100, def.ult + dmg * TUNE.ultTake * def.ultGain);
    d.stop = Math.max(d.stop, 3 / 60); def.chain = 0;
    d.events.push({ type: 'armor', who: def, att, dmg, x: def.x, y: def.y + 1.3 });
    return 'armor';
  }
  def.hp = Math.max(0, def.hp - dmg);
  def.stats.taken += dmg; att.stats.dmg += dmg; att.stats.hits++;
  att.stats.maxCombo = Math.max(att.stats.maxCombo, def.chain);
  if (bossPhase(d, def, att)) {   // the hit crossed the boss's phase line: it still counts, then the transition takes over (no KO in phase 1)
    if (!isUlt) { att.ult = Math.min(100, att.ult + dmg * TUNE.ultDeal * att.ultGain); def.ult = Math.min(100, def.ult + dmg * TUNE.ultTake * def.ultGain); }
    const stop = Math.min(TUNE.stopMax, Math.max(TUNE.stopMin, hitStopOf(dmg, spec) + 2 / 60)); d.stop = Math.max(d.stop, stop);
    d.events.push({ type: 'hit', who: def, att, dmg, heavy: true, stop, kb: spec.kb || 1, spike: false, back: (att.x - def.x) * def.facing < 0, kind: spec.kind || (isUlt ? 'ult' : 'proj'), ult: isUlt, launch: 0,
      x: def.x, y: def.y + 1.3, chain: def.chain, ko: false, proj: spec.key || null, src: spec.key ? 'p:' + spec.key : att.mk, phase: true });
    return 'hit';
  }
  if (!isUlt) { att.ult = Math.min(100, att.ult + dmg * TUNE.ultDeal * att.ultGain); def.ult = Math.min(100, def.ult + dmg * TUNE.ultTake * def.ultGain); }
  const airborne = def.y > 0.05 || def.st === 'air';
  const kdir = Math.sign(def.x - srcX) || att.facing;
  const kb = (spec.kb || 1) / (def.C.weight || 1);
  def.mk = null; def.comboN = 0; def.t = 0; def.buf = null;
  if (def.hp <= 0) {
    def.st = 'ko'; def.vy = Math.max(7, spec.launch || 0); def.vx = kdir * Math.max(4, kb * 1.3);
  } else if (spec.spike && airborne) {
    def.st = 'air'; def.vy = spec.spike; def.vx = kdir * kb * 0.5; def.jug++;
  } else if ((spec.launch || 0) > 0 || airborne) {
    def.jug++;
    const decay = Math.max(0.35, 1 - 0.14 * (def.jug - 1)), poise = def.C.phases && !isUlt ? BOSS_TUNE.launchMul : 1;
    def.st = 'air'; def.vy = Math.max(spec.launch || 0, airborne ? 3.6 : 0) * decay * poise; def.vx = kdir * kb * 0.6;
    if (def.jug >= (def.C.phases ? BOSS_TUNE.jugCap : TUNE.jugCap)) def.jugCap = true;
  } else {
    def.st = 'hit'; def.stunT = (spec.stun || 0.3) * (def.C.phases && spec.kind === 'basic' ? BOSS_TUNE.stunMul : 1); def.vx = kdir * kb;
  }
  if (crush) { if (def.st === 'hit') def.stunT = Math.max(def.stunT, BOSS_TUNE.crushStun); d.events.push({ type: 'crush', who: def, att, x: def.x, y: def.y + 1.5 }); }
  if (att.st === 'atk' && att.y > 0.05 && moveOf(att)?.kind === 'air') att.vy = Math.max(att.vy, 3.4);
  const heavy = dmg >= 70 || (spec.launch || 0) >= 8 || !!spec.spike;
  const stop = Math.min(TUNE.stopMax, Math.max(TUNE.stopMin, hitStopOf(dmg, spec) + (def.hp <= 0 ? 2 / 60 : 0)));
  d.stop = Math.max(d.stop, stop);
  d.events.push({ type: 'hit', who: def, att, dmg, heavy, stop, kb: spec.kb || 1, spike: !!spec.spike, back: (att.x - def.x) * def.facing < 0, kind: spec.kind || (isUlt ? 'ult' : 'proj'), ult: isUlt, launch: spec.launch || 0,
    x: def.x, y: def.y + 1.3, chain: def.chain, ko: def.hp <= 0, proj: spec.key || null, src: spec.key ? 'p:' + spec.key : att.mk });
  if (def.hp <= 0) d.events.push({ type: 'ko', who: def, att, x: def.x, y: def.y + 1.2 });
  return 'hit';
}

/** boss phase line: the first time HP reaches phases.at × max HP the boss enters the invulnerable 'phase' transition and phase 2.
 *  Overflow damage does not carry (HP clamps to the line), the ult meter is kept, a close foe is shoved away.
 *  View hook: event { type: 'phase', who, phase: 2 } now and { type: 'phaseEnd' } when it ends; f.st === 'phase', f.t = time into it. */
function bossPhase(d, f, o) {
  const P = f.C.phases; if (!P || f.phase !== 1) return false;
  const line = Math.round(f.maxHp * P.at); if (f.hp > line) return false;
  f.hp = line; f.phase = 2; f.phaseN++;
  f.st = 'phase'; f.t = 0; f.mk = null; f.buf = null; f.comboN = 0; f.chain = 0; f.jug = 0; f.jugCap = false; f.vx = 0; f.stunT = P.transT;
  if (Math.abs(o.x - f.x) < 3.2 && o.st !== 'ko' && o.st !== 'down' && o.st !== 'rise') {   // shockwave: knocks a close foe back out of its move (no damage)
    o.mk = null; o.comboN = 0; o.t = 0; o.buf = null; o.vx = (Math.sign(o.x - f.x) || -f.facing) * BOSS_TUNE.shove;
    if (o.y > 0.05) { o.st = 'air'; o.vy = Math.max(o.vy, 4); } else { o.st = 'hit'; o.stunT = 0.32; }
  }
  d.events.push({ type: 'phase', who: f, phase: 2, x: f.x, y: f.y });
  return true;
}

// -------------------------------------------------------------- fighter step
function stepFighter(d, f, o, dt, pend) {
  f.t += dt; f.djT += dt;
  f.comboT = Math.max(0, f.comboT - dt); f.inv = Math.max(0, f.inv - dt); f.dodgeCd = Math.max(0, f.dodgeCd - dt);
  for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);   // s1 / s2 (+ the boss's per-move cooldowns)
  f.gdT = Math.max(0, f.gdT - dt); if (f.gdT <= 0 && f.st !== 'guard' && f.st !== 'block') f.gd = Math.min(100, f.gd + TUNE.guardRegen * dt);
  if (f.buf && pend) { f.buf.t -= dt; if (tryCmd(d, f, o, f.buf.cmd)) { d.events.push({ type: 'cmd', who: f, cmd: f.buf.cmd }); f.buf = null; } else if (f.buf.t <= 0) f.buf = null; }
  const fr = Math.max(0, 1 - TUNE.friction * dt);
  switch (f.st) {
    case 'idle': case 'walk': case 'guard': {
      if (!grounded(f)) { f.st = 'jump'; break; }
      if (f.in.guard && !d.over) { if (f.st !== 'guard') { f.st = 'guard'; f.t = 0; } f.vx *= fr; break; }
      f.facing = o.x >= f.x ? 1 : -1;
      const mx = d.over ? 0 : f.in.mx;
      if (Math.abs(mx) > 0.2) {
        const back = Math.sign(mx) !== f.facing;
        if (f.st !== 'walk') { f.st = 'walk'; f.t = 0; }
        f.vx = mx * f.C.walk * (back ? TUNE.backMul : 1);
      } else { if (f.st !== 'idle') { f.st = 'idle'; f.t = 0; } f.vx *= fr; }
      break;
    }
    case 'block': f.vx *= fr; if (f.t >= f.stunT) { f.st = f.in.guard ? 'guard' : 'idle'; f.t = 0; } break;
    case 'jump': {
      const target = f.in.mx * f.C.walk * 1.05;
      if (Math.abs(f.in.mx) > 0.2) f.vx += (target - f.vx) * Math.min(1, dt * 3);
      break;
    }
    case 'atk': {
      const m = moveOf(f), [su, ac] = m.t, T = total(m), t = f.t;
      const w = m.vxT || [0, su + ac];
      if (m.vx && t >= w[0] && t <= w[1]) f.vx = f.facing * m.vx; else if (grounded(f)) f.vx *= fr;
      if (m.selfVy && !f.selfVyDone && t >= su) { f.vy = m.selfVy; f.selfVyDone = true; }
      if (m.kind === 'air' && t < su + ac && f.vy < -1.5) f.vy = -1.5;   // brief air hang while swinging
      if (m.fire) m.fire.forEach((ev, i) => { if (!(f.fired & (1 << i)) && t >= ev.at) { f.fired |= 1 << i; fire(d, f, o, ev); } });
      if (m.flash && f.flashSeq !== f.seq && t >= m.flash) { f.flashSeq = f.seq; d.events.push({ type: 'flash', who: f, key: f.mk, x: f.x + f.facing * 0.6, y: f.y + 1.2 }); }   // boss telegraph
      if (m.box && t >= su && t < su + ac && pend) {
        const n = m.multi || 1;
        if (n === 1) { if (!f.connected) pend.push({ att: f, def: o, m, last: true, key: f.mk, seq: f.seq }); }
        else {
          const i = Math.min(n - 1, Math.floor((t - su) / (ac / n)));
          if (f.ticks <= i) { f.ticks = i + 1; pend.push({ att: f, def: o, m, last: i === n - 1, key: f.mk, seq: f.seq }); }
        }
      }
      if (t >= T && m.follow && !d.over) { startMove(d, f, m.follow); break; }   // boss strings (Ten-Step, ult → finale)
      if (t >= T) {
        const k = m.kind; f.mk = null; f.t = 0;
        if (!grounded(f)) f.st = 'jump';
        else { f.st = 'idle'; faceFoe(f, o); if (k === 'basic' && f.comboN < f.C.combo.length) f.comboT = TUNE.comboWindow; else f.comboN = 0; }
      }
      break;
    }
    case 'dodge': f.vx = f.dodgeDir * TUNE.dodgeV * (1 - f.t / TUNE.dodgeT * 0.5); if (f.t >= TUNE.dodgeT) { f.st = 'idle'; f.t = 0; f.vx *= 0.2; faceFoe(f, o); } break;
    case 'hit': case 'stun': f.vx *= Math.max(0, 1 - 7 * dt); if (f.t >= f.stunT && grounded(f)) { f.st = 'idle'; f.t = 0; f.chain = 0; } break;
    case 'air': break;
    case 'down': f.vx *= Math.max(0, 1 - 8 * dt); if (f.t >= TUNE.downT) { f.st = 'rise'; f.t = 0; faceFoe(f, o); } break;
    case 'rise': f.vx = 0; if (f.t >= TUNE.riseT) { f.st = 'idle'; f.t = 0; f.chain = 0; f.inv = Math.max(f.inv, 0.12); } break;
    case 'ko': f.vx *= Math.max(0, 1 - (grounded(f) ? 5 : 0.5) * dt); break;
    case 'phase': f.vx *= fr; if (f.t >= f.stunT && grounded(f)) { f.st = 'idle'; f.t = 0; f.inv = Math.max(f.inv, 0.15); faceFoe(f, o); d.events.push({ type: 'phaseEnd', who: f, phase: f.phase, x: f.x, y: f.y }); } break;
    case 'win': f.vx = 0; break;
  }
  // vertical physics
  if (f.y > 0 || f.vy > 0) {
    const g = TUNE.gravity * (f.st === 'air' ? 1 + 0.07 * f.jug : 1);
    f.vy -= g * dt; f.y += f.vy * dt;
    if (f.y <= 0) {
      f.y = 0; const vy = f.vy; f.vy = 0;
      if (f.st === 'air') { f.st = 'down'; f.t = 0; f.inv = TUNE.downInv; f.vx *= 0.3; f.jug = 0; f.jugCap = false; d.events.push({ type: 'land', who: f, hard: true, vy }); }
      else if (f.st === 'jump') { f.st = 'idle'; f.t = 0; f.airN = 0; if (!d.over) faceFoe(f, o); d.events.push({ type: 'land', who: f }); }
      else if (f.st === 'atk' && moveOf(f)?.kind === 'air') { f.st = 'idle'; f.t = 0; f.mk = null; f.airN = 0; f.vx *= 0.3; if (!d.over) faceFoe(f, o); d.events.push({ type: 'land', who: f }); }
      else if (f.st === 'atk') { f.airN = 0; }
      else if (f.st === 'hit' || f.st === 'stun') { f.airN = 0; }
    }
  }
  if (grounded(f) && f.st !== 'jump') f.airN = f.st === 'atk' && moveOf(f)?.kind === 'air' ? f.airN : 0;
  f.x = clampX(f.x + f.vx * dt);
  // airtime + double-jump reset
  if (grounded(f)) { f.airT = 0; f.dj = false; } else f.airT += dt;
  // auto-face: grounded and stuck facing away (guarding / blocking / in hit-stun) → turn after TUNE.turnDelay.
  // Attacks never turn mid-move (they turn as they recover, above); airborne fighters turn on landing.
  if (grounded(f) && !d.over && (f.st === 'guard' || f.st === 'block' || f.st === 'hit' || f.st === 'stun') && facingAway(f, o)) {
    f.faceT += dt; if (f.faceT >= TUNE.turnDelay) faceFoe(f, o);
  } else if (!facingAway(f, o)) f.faceT = 0;
}

function stepProjs(d, dt) {
  for (const p of d.projs) {
    if (p.dead) continue;
    p.t += dt;
    if (p.harmless) { p.life -= dt; if (p.life <= 0) { d.events.push({ type: 'projEnd', p }); p.dead = true; } continue; }   // boss decoys: never collide
    if (p.delay > 0) { p.delay -= dt; if (p.delay <= 0) d.events.push({ type: 'pillar', who: p.owner, p }); continue; }
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const def = p.owner === d.a ? d.b : d.a;
    const armed = p.key !== 'meteor' || p.y <= 1.4;
    if (!p.hit && !p.passed && armed && !d.over && overlapProj(p, def)) {
      const r = applyHit(d, p.owner, def, p, p.vx ? p.x - Math.sign(p.vx) : p.owner.x);
      if (r === 'hit' || r === 'block' || r === 'armor') { p.hit = true; if (!p.h) p.dead = true; d.events.push({ type: 'projHit', p, res: r }); }
      else if (r === 'evade') p.passed = true;   // dodged through: the projectile flies on harmlessly
      else if (r === 'reflect') { p.owner = def; p.cls = def.cls; p.vx = -p.vx; p.dir = -p.dir; p.life = Math.max(p.life, 1.0); p.reflected = true; p.srcKind = 'reflect'; }
    }
    if (p.life <= 0 || Math.abs(p.x) > ARENA_HALF + 2 || (p.y <= 0 && p.vy < 0)) { if (!p.dead) d.events.push({ type: 'projEnd', p }); p.dead = true; }
  }
  if (d.projs.length > 24 || d.projs.some((p) => p.dead)) d.projs = d.projs.filter((p) => !p.dead);
}

/** advance by dt (call with fixed DT); fills d.events (cleared by the caller) */
export function step(d, dt = DT) {
  if (d.freeze > 0) { d.freeze -= dt; if (d.freeze <= 0) d.freezeBy = null; return; }
  if (d.stop > 0) { d.stop -= dt; return; }
  if (d.over) { d.overT += dt; stepFighter(d, d.a, d.b, dt, null); stepFighter(d, d.b, d.a, dt, null); stepProjs(d, dt); return; }
  d.clock += dt; d.time = Math.max(0, d.time - dt);
  const pend = [];
  stepFighter(d, d.a, d.b, dt, pend); stepFighter(d, d.b, d.a, dt, pend);
  // no overlap on the ground (airborne fighters may cross over)
  const A = d.a, Bf = d.b;
  if (A.y < 1.0 && Bf.y < 1.0 && A.st !== 'down' && Bf.st !== 'down') {
    const gap = Bf.x - A.x, s = Math.sign(gap) || 1;
    if (Math.abs(gap) < TUNE.minGap) {
      const push = (TUNE.minGap - Math.abs(gap)) / 2;
      A.x = clampX(A.x - s * push); Bf.x = clampX(Bf.x + s * push);
      if (Math.abs(Bf.x - A.x) < TUNE.minGap - 0.01) { if (Math.abs(A.x) >= ARENA_HALF) Bf.x = A.x + s * TUNE.minGap; else A.x = Bf.x - s * TUNE.minGap; }
    }
  }
  // melee hits: decide all overlaps first (simultaneous hits trade), then apply
  const hits = pend.filter((p) => p.att.st === 'atk' && p.att.seq === p.seq && (!p.m.groundOnly || p.def.y < 0.3) && overlapBox(p.att, p.def, p.m.box));
  for (const h of hits) {
    const spec = h.last && h.m.last ? { ...h.m, ...h.m.last } : h.m;
    const r = applyHit(d, h.att, h.def, spec, h.att.x);
    if (r) h.att.connected = true;
  }
  stepProjs(d, dt);
  if (A.st === 'ko' || Bf.st === 'ko') d.over = { winner: A.st === 'ko' ? (Bf.st === 'ko' ? 'draw' : 'b') : 'a', by: 'ko' };
  else if (d.time <= 0) {
    const pa = A.hp / A.maxHp, pb = Bf.hp / Bf.maxHp;
    d.over = { winner: pa > pb ? 'a' : pb > pa ? 'b' : 'draw', by: 'time' };
  }
  if (d.over) {
    const w = d.over.winner === 'a' ? A : d.over.winner === 'b' ? Bf : null;
    for (const f of [A, Bf]) { f.in.mx = 0; f.in.guard = false; f.buf = null; }
    if (w && w.st !== 'ko') { w.st = 'win'; w.t = 0; w.mk = null; }
  }
}

/** run a duel to the end with two controllers (used by tests + balance sim) */
export function simulate(d, ctrlA, ctrlB, maxT = 200) {
  let t = 0;
  while (!d.over && t < maxT) { ctrlA && ctrlA(d, d.a, d.b, DT); ctrlB && ctrlB(d, d.b, d.a, DT); step(d, DT); d.events.length = 0; t += DT; }
  return d.over;
}
