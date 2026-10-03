// NEON STICK DUEL v2 — AI controller. Uses each class's whole kit; difficulty `diff` 0..1 scales reaction time,
// guard / dodge rates, combo completion, cancels (jump-cancel air combos, skill enders) and decision speed.
// Pure (no DOM). Call every sim step: aiThink(d, me, op, prof, mem, dt, rng) → sets me.in and returns a command or null.
import { moveOf, actionable, grounded, phaseOf, ARENA_HALF as ARENA } from './duel.js';

const lerp = (a, b, k) => a + (b - a) * k;
export function aiParams(diff) {
  const k = Math.max(0, Math.min(1, diff));
  return {
    react: lerp(0.4, 0.12, k), think: lerp(0.5, 0.14, k), guardP: lerp(0.08, 0.55, k), dodgeP: lerp(0.03, 0.22, k),
    comboP: lerp(0.4, 0.97, k), jcP: k > 0.45 ? Math.min(0.9, (k - 0.45) * 1.8) : 0, enderP: lerp(0.05, 0.75, k),
    escP: Math.max(0, k - 0.5) * 1.6, skillRate: lerp(0.35, 1.6, k), ultRate: lerp(0.4, 3, k), aggr: lerp(0.45, 0.8, k), antiAir: lerp(0.1, 0.8, k),
  };
}

function threatOf(d, me, op) {
  const gap = Math.abs(op.x - me.x);
  if (op.st === 'atk') {
    const m = moveOf(op);
    if (m && op.t < m.t[0] + m.t[1] * 0.6) {
      const reach = m.box ? Math.max(m.box[1], (m.vx || 0) * (m.t[0] + m.t[1]) * 0.6 + m.box[1]) : (m.fire ? 9 : 0);
      const tele = (m.fire || []).some((f) => f.type === 'teleport');   // teleport strikes threaten from range
      if (m.kind === 'ult' || tele || gap < reach + 0.7) return { key: 'm' + op.seq, ranged: !m.box, kind: m.kind, tele };
    }
  }
  for (const p of d.projs) {
    if (p.owner !== op || p.hit || p.dead) continue;
    const dist = (me.x - p.x) * Math.sign(p.vx || (me.x - p.x));
    if (p.delay > 0 && Math.abs(p.x - me.x) < 1.2) return { key: 'p' + p.id, ranged: true, pillar: true };
    if (p.vx && dist > 0 && dist < 3.2) return { key: 'p' + p.id, ranged: true };
    if (p.key === 'meteor' && Math.abs(p.x - me.x) < 1.6) return { key: 'p' + p.id, ranged: true, meteor: true };
  }
  return null;
}

export function aiThink(d, me, op, prof, mem, dt, rng = Math.random) {
  if (d.over || me.st === 'ko' || me.st === 'win') { me.in.mx = 0; me.in.guard = false; return null; }
  const P = mem.P || (mem.P = aiParams(prof.diff ?? 0.5));
  const C = me.C, cls = C.id;
  mem.t = (mem.t || 0) + dt;
  const gap = Math.abs(op.x - me.x), dirTo = Math.sign(op.x - me.x) || me.facing;
  const opM = moveOf(op), opVuln = op.st === 'stun' || (op.st === 'atk' && phaseOf(op) === 'rc' && opM && opM.kind !== 'basic');
  const hitConfirm = op.st === 'hit' || op.st === 'air' || op.st === 'stun';
  me.in.guard = false;

  // ---- reactive defence (decided once per threat, after a human-like reaction delay)
  const th = threatOf(d, me, op);
  if (th && th.key !== mem.threatKey) { mem.threatKey = th.key; mem.reactAt = mem.t + P.react * (0.7 + 0.6 * rng()); mem.react = th; }
  if (mem.react && mem.t >= mem.reactAt) {
    const r0 = mem.react; mem.react = null;
    // casters mid-volley can cancel a basic into Blink to escape a melee threat (escape-cancel)
    const mvNow = moveOf(me);
    if (th && th.key === r0.key && cls === 'mage' && !r0.ranged && me.st === 'atk' && mvNow && mvNow.kind === 'basic' && me.cd.s1 <= 0 && rng() < P.escP) return 's1';
    if (th && th.key === r0.key && actionable(me)) {
      const r = rng();
      if (r0.tele && r0.kind !== 'ult') {
        // teleport strike appears behind you: guarding the front is useless → blink / dodge / hop instead
        if (r < P.guardP + P.dodgeP) {
          if (cls === 'mage' && me.cd.s1 <= 0) return 's1';
          if (rng() < 0.5 && me.dodgeCd <= 0) { me.in.mx = dirTo; return 'dodge'; }
          me.in.mx = -dirTo; return 'jump';
        }
      }
      else if (r0.pillar || r0.meteor) { if (r < P.dodgeP + P.guardP * 0.6) { me.in.mx = -dirTo * (rng() < 0.5 ? 1 : -1); return 'dodge'; } }
      else if (r0.ranged && C.role !== 'ranged') {
        // melee vs projectiles: roll through, hop over or guard
        if (r < P.dodgeP + 0.06 && me.dodgeCd <= 0) { me.in.mx = dirTo; return 'dodge'; }
        if (r < P.dodgeP + 0.22) { me.in.mx = dirTo; return 'jump'; }
        if (r < P.dodgeP + 0.22 + P.guardP * 0.6) mem.guardT = 0.25;
      }
      else if (r < P.guardP) { mem.guardT = 0.28 + 0.25 * rng(); }
      else if (r < P.guardP + P.dodgeP) {
        if (cls === 'mage' && me.cd.s1 <= 0 && !r0.ranged) return 's1';
        if (r0.ranged && rng() < 0.5) return 'jump';
        me.in.mx = -dirTo; return 'dodge';
      }
    }
  }
  if (mem.guardT > 0) {
    mem.guardT -= dt;
    if (opVuln && gap < C.reach + 0.3) mem.guardT = 0;   // punish out of guard
    else if (me.st === 'guard' || me.st === 'block' || actionable(me)) { me.in.guard = true; me.in.mx = 0; return null; }
  }

  // ---- while attacking: continue the chain, cancel into skills / jump / ult
  if (me.st === 'atk') {
    me.in.mx = 0;
    const m = moveOf(me); if (!m) return null;
    const T = m.t[0] + m.t[1] + m.t[2];
    if (m.kind === 'ult') return null;
    if ((m.kind === 'basic' || m.kind === 'air') && m.chain != null && me.t >= m.chain * T) {
      // launcher → jump cancel → air combo
      if (m.launch > 0 && me.connected && op.st === 'air' && mem.jcSeq !== me.seq) { mem.jcSeq = me.seq; if (rng() < P.jcP && cls !== 'mage') return 'jump'; }
      if (hitConfirm && me.ult >= 100 && grounded(me) && mem.ultSeq !== me.seq) { mem.ultSeq = me.seq; if (rng() < 0.4 + 0.5 * (prof.diff ?? 0.5)) return 'ult'; }
      const list = m.kind === 'air' ? C.airCombo : C.combo, n = m.kind === 'air' ? me.airN : me.comboN;
      if (mem.decSeq !== me.seq) {
        mem.decSeq = me.seq;
        const ranged = cls === 'mage';
        const ok = ranged ? gap < 8 : (me.connected || gap < C.reach + 0.4);
        mem.go = ok && rng() < (me.connected || ranged ? P.comboP : P.comboP * 0.4);
        mem.ender = hitConfirm && rng() < P.enderP;
      }
      if (n >= list.length || !mem.go) {
        // combo ender: cancel the last hit into a skill
        if (mem.ender && grounded(me) && me.connected && mem.endSeq !== me.seq) {
          mem.endSeq = me.seq;
          const sk = enderSkill(me, op, gap); if (sk) return sk;
        }
        return null;
      }
      return 'atk';
    }
    return null;
  }

  // ---- airborne (own jump): steer and air-attack
  if (me.st === 'jump') {
    me.in.mx = cls === 'mage' ? -dirTo * 0.6 : dirTo;
    if (cls === 'mage' && me.cd.s1 <= 0 && gap < 1.8 && rng() < dt * 3) return 's1';
    const near = cls === 'mage' ? gap < 6 : gap < 1.9 && Math.abs(op.y - me.y) < 1.8;
    if (near && rng() < dt * (4 + 10 * (prof.diff ?? 0.5))) return 'atk';
    return null;
  }
  if (!actionable(me)) { me.in.mx = 0; return null; }

  // ---- ultimate
  if (me.ult >= 100 && op.st !== 'down' && op.st !== 'rise' && op.st !== 'dodge') {
    const inR = cls === 'mage' ? gap < 9 : cls === 'assassin' ? gap < 8 : gap < C.reach + 1.6;
    if (inR && rng() < dt * P.ultRate * (hitConfirm || opVuln ? 3 : 1)) return 'ult';
  }

  // ---- punish
  if (opVuln && gap < C.reach + 0.2 && rng() < dt * 10 * P.aggr) return 'atk';

  // cornered with the opponent close: hop over them
  const toWall = ARENA - Math.abs(me.x), wallBehind = Math.sign(me.x) === -dirTo;
  if (toWall < 1.2 && wallBehind && gap < 2.2 && rng() < dt * (0.6 + 2 * (prof.diff ?? 0.5))) {
    if (cls === 'mage' && me.cd.s1 <= 0) return 's1';
    me.in.mx = dirTo; return 'jump';
  }
  mem.cool = (mem.cool ?? 0) - dt;
  const skill = (k, rate) => me.cd[k] <= 0 && rng() < dt * rate * P.skillRate;
  if (mem.walkT > 0) { mem.walkT -= dt; me.in.mx = mem.walkDir; }
  else me.in.mx = 0;

  if (cls === 'mage') {
    const k = prof.diff ?? 0.5;   // low-skill mages fire less often (keeps easy mages beatable)
    if (gap < 2.6 && (op.st === 'walk' || op.st === 'atk' || gap < 1.8)) {
      if (skill('s1', 6)) return 's1';
      if (gap < 1.3 && mem.cool <= 0) { mem.cool = P.think; return rng() < 0.5 ? 'atk' : 'jump'; }
      me.in.mx = toWall > 1.0 ? -dirTo : 0; return null;
    }
    if (gap > 7.6) { me.in.mx = dirTo; return null; }
    if (op.st === 'air' && op.y > 0.4 && skill('s2', 2.5)) return 's2';
    if (skill('s2', 0.9)) return 's2';
    if (gap < 3.6 && (mem.walkT || 0) <= 0 && toWall > 1.5) { mem.walkT = 0.3 + 0.3 * rng(); mem.walkDir = -dirTo; }
    if (mem.cool <= 0) { mem.cool = P.think * (0.5 + rng()); if (rng() < P.aggr * (0.6 + 0.4 * k) + 0.1) return 'atk'; mem.walkT = 0.25; mem.walkDir = rng() < 0.5 ? -dirTo : dirTo * 0.5; }
    return null;
  }

  // melee + hybrid
  const reach = C.reach;
  if (gap > reach + 0.25) {
    if (cls === 'assassin') {
      if (gap > 2.2 && gap < 6.5 && skill('s2', 0.9)) return 's2';
      if (gap > 3.0 && gap < 6 && skill('s1', 0.3)) return 's1';   // throw from range (backs off further)
    } else if (gap > 2.2 && gap < (cls === 'brawler' ? 5 : 4.8) && skill('s1', op.C.role === 'ranged' ? 1.6 : 0.8)) return 's1';
    if (cls === 'sword' && op.y > 1 && gap < 2.4 && me.cd.s2 <= 0 && rng() < dt * 6 * P.antiAir) return 's2';
    if ((mem.walkT || 0) <= 0) { me.in.mx = dirTo; if (gap > 2.4 && gap < 4.5 && rng() < dt * 0.35) return 'jump'; }
    return null;
  }
  // in range
  if (cls === 'sword' && op.y > 0.8 && me.cd.s2 <= 0 && rng() < dt * 10 * P.antiAir) return 's2';
  if (cls === 'brawler' && gap < 2 && skill('s2', 0.5)) return 's2';
  if (cls === 'assassin' && gap < 1.6 && op.st === 'atk' && skill('s1', 1.5)) return 's1';
  if (mem.cool <= 0) {
    mem.cool = P.think * (0.5 + rng());
    const r = rng();
    if (r < P.aggr) return 'atk';
    if (r < P.aggr + 0.12) { mem.walkT = 0.2 + 0.2 * rng(); mem.walkDir = -dirTo; return null; }
    if (r < P.aggr + 0.2) { mem.guardT = 0.25; return null; }
  }
  return null;
}

function enderSkill(me, op, gap) {
  const c = me.C.id;
  if (c === 'sword') return me.cd.s2 <= 0 ? 's2' : me.cd.s1 <= 0 ? 's1' : null;
  if (c === 'brawler') return me.cd.s2 <= 0 && gap < 2 ? 's2' : me.cd.s1 <= 0 ? 's1' : null;
  if (c === 'assassin') return me.cd.s1 <= 0 ? 's1' : null;
  if (c === 'mage') return me.cd.s2 <= 0 ? 's2' : null;
  return null;
}

/** seeded RNG for deterministic sims */
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
