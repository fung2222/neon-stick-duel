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
    escP: Math.max(0, k - 0.62) * 2.2, djP: lerp(0.25, 0.7, k), skillRate: lerp(0.35, 1.6, k), ultRate: lerp(0.4, 3, k), aggr: lerp(0.45, 0.8, k), antiAir: lerp(0.1, 0.8, k), jumpIn: Math.max(0, k - 0.6),
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
  if (C.phases) return bossThink(d, me, op, prof, mem, dt, rng, P);   // final boss brain (below)
  const gap = Math.abs(op.x - me.x), dirTo = Math.sign(op.x - me.x) || me.facing;
  const opM = moveOf(op), opVuln = op.st === 'stun' || (op.st === 'atk' && phaseOf(op) === 'rc' && opM && opM.kind !== 'basic');
  const hitConfirm = op.st === 'hit' || op.st === 'air' || op.st === 'stun';
  me.in.guard = false;
  if (grounded(me)) mem.djAsked = false;
  if (op.C.phases) { const r = vsBoss(d, me, op, prof, mem, dt, rng, P); if (r !== undefined) return r; }   // only against the boss: read its telegraphs

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
      // launcher → jump cancel → air combo (out of an air hit = double-jump extension, used sparingly)
      if (m.launch > 0 && me.connected && op.st === 'air' && mem.jcSeq !== me.seq) { mem.jcSeq = me.seq; if (rng() < P.jcP * (m.kind === 'air' ? 0.3 : 1) && cls !== 'mage') return 'jump'; }
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
    // double jump (once per airtime, near the apex): chase a juggled / jumping foe, clear a cross-up, or (mage) keep away
    if (!me.dj && !mem.djAsked && me.airT > 0.16 && me.vy < 2.5 && me.vy > -5) {
      mem.djAsked = true;   // one decision per airtime
      const chase = op.y > me.y + 0.4 && gap < 2.6, flee = cls === 'mage' && gap < 2.5, over = gap < 1.2 && op.y < 0.3;
      const closeIn = C.role !== 'ranged' && op.C.role === 'ranged' && gap > 2 && gap < 6;   // melee vs a kiting mage: carry the jump in
      if (rng() < (chase || flee || over || closeIn ? P.djP : P.djP * 0.25)) { if (flee) me.in.mx = -dirTo; return 'jump'; }
    }
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
    if ((mem.walkT || 0) <= 0) { me.in.mx = dirTo; if (gap > 2.4 && gap < 4.5 && rng() < dt * (op.C.role === 'ranged' ? P.jumpIn : 0.35)) return 'jump'; }   // vs a mage: jump-ins eat anti-airs — only skilled AI (which double-jumps through) commits
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

// ------------------------------------------------------------------ final boss: 機械將軍 KAGE-SHŌGUN (classes.js CLASSES.shogun)
// Phase 1 「秩序」 Order: holds the line just outside the foe's reach, draws Iai Judgement at mid range, walks the foe to the wall
// with Ten-Step Advance, waits in Mirror Guard when the foe presses in. Phase 2 「崩壞」 Collapse: thinks faster, Glitch Step
// cross-ups, Data-Blade Rain from range, Thousand Edges Mirrored on a full meter.
function bossThink(d, me, op, prof, mem, dt, rng, P) {
  const C = me.C, ph = me.phase, k = prof.diff ?? 0.5;
  const gap = Math.abs(op.x - me.x), dirTo = Math.sign(op.x - me.x) || me.facing;
  const opM = moveOf(op), opVuln = op.st === 'stun' || (op.st === 'atk' && phaseOf(op) === 'rc' && opM && opM.kind !== 'basic');
  const hitConfirm = op.st === 'hit' || op.st === 'air' || op.st === 'stun';
  me.in.guard = false;
  if (me.st === 'phase') { me.in.mx = 0; mem.guardT = 0; mem.react = null; return null; }
  // reactive defence (guard / back-dodge, decided once per threat after the reaction delay)
  const th = threatOf(d, me, op);
  if (th && th.key !== mem.threatKey) { mem.threatKey = th.key; mem.reactAt = mem.t + P.react * (0.7 + 0.6 * rng()); mem.react = th; }
  if (mem.react && mem.t >= mem.reactAt) {
    const r0 = mem.react; mem.react = null;
    if (th && th.key === r0.key && actionable(me)) {
      const r = rng();
      if (r < P.guardP * (r0.ranged ? 0.8 : 1)) mem.guardT = 0.3 + 0.22 * rng();
      else if (r < P.guardP + P.dodgeP * 0.5 && !r0.ranged && me.dodgeCd <= 0) { me.in.mx = -dirTo; return 'dodge'; }
    }
  }
  if (mem.guardT > 0) {
    mem.guardT -= dt;
    if (opVuln && gap < C.reach + 0.3) mem.guardT = 0;
    else if (me.st === 'guard' || me.st === 'block' || actionable(me)) { me.in.guard = true; me.in.mx = 0; return null; }
  }
  // attacking: continue the nodachi chain (the sim strings Ten-Step and the ult finale itself)
  if (me.st === 'atk') {
    me.in.mx = 0; const m = moveOf(me);
    if (!m || m.kind !== 'basic') return null;
    const T = m.t[0] + m.t[1] + m.t[2];
    if (m.chain != null && me.t >= m.chain * T && me.comboN < C.combo.length) {
      if (mem.decSeq !== me.seq) { mem.decSeq = me.seq; mem.go = (me.connected || gap < C.reach + 0.4) && rng() < (me.connected ? P.comboP : P.comboP * 0.45); }
      if (mem.go) return 'atk';
    }
    return null;
  }
  if (!actionable(me)) { me.in.mx = 0; return null; }
  if (ph === 2 && me.ult >= 100 && gap < 3.6 && op.st !== 'down' && op.st !== 'rise' && op.st !== 'dodge' && rng() < dt * P.ultRate * (hitConfirm || opVuln ? 3 : 1)) return 'ult';
  if (opVuln && gap < C.reach + 0.25 && rng() < dt * 10 * P.aggr) return 'atk';
  const can = (key) => (me.cd[key] || 0) <= 0;
  const want = (key, rate) => can(key) && rng() < dt * rate * P.skillRate;
  mem.cool = (mem.cool ?? 0) - dt;
  if (mem.walkT > 0) { mem.walkT -= dt; me.in.mx = mem.walkDir; } else me.in.mx = 0;
  if (ph === 1) {
    const pressing = (op.st === 'walk' && Math.sign(op.vx) === -dirTo) || (op.st === 'atk' && phaseOf(op) === 'su' && opM && opM.box);
    if (gap > 2.3 && gap < 5.3 && want('iai', 0.95)) return 'bm:iai';
    if (gap > 5.4) { if ((mem.walkT || 0) <= 0) me.in.mx = dirTo; return null; }
    if (gap < 2.8 && pressing && want('mirror', 1.6)) return 'bm:mirror';
    if (gap < 2.1 && want('ten1', 0.75)) return 'bm:ten1';
    if (mem.cool <= 0) {
      mem.cool = P.think * (0.75 + 0.6 * rng()); const r = rng();
      if (gap < C.reach + 0.15 && r < P.aggr * 0.75) return 'atk';
      if (gap > C.prefer + 0.4) { mem.walkT = 0.25 + 0.25 * rng(); mem.walkDir = dirTo; }          // close in slowly
      else if (gap < C.reach - 0.2 && r < 0.9) { mem.walkT = 0.2 + 0.15 * rng(); mem.walkDir = -dirTo; }   // step back to the nodachi's range
    }
    return null;
  }
  // phase 2 「崩壞」
  if (gap > 2.4 && want('glitch', 1.0)) return 'bm:glitch';
  if (gap > 1.4 && want('rain', 0.75)) return 'bm:rain';
  if (gap > C.reach + 0.2) { if ((mem.walkT || 0) <= 0) me.in.mx = dirTo; return null; }
  if (want('glitch', 0.3)) return 'bm:glitch';
  if (mem.cool <= 0) {
    mem.cool = P.think * (0.45 + 0.6 * rng());
    if (rng() < Math.min(0.92, P.aggr + 0.1 * k)) return 'atk';
    mem.walkT = 0.2; mem.walkDir = -dirTo;
  }
  return null;
}

/** ladder player vs the boss: reads its telegraphs. On a new boss move the player (after the reaction delay) answers with the
 *  move's fair answer with probability `read` (rises with skill), otherwise falls back to the normal AI (which often eats it).
 *  Answers: Iai → guard through / dodge on the flash / jump on the flash · Ten-Step → guard the string · Mirror Guard → don't
 *  hit it: back off and punish the recovery, or break it with a skill (casters keep shooting) · Mirror Return → hold guard ·
 *  Glitch Step → hold guard (auto-turn) or dodge as the real image appears · Data-Blade Rain → guard / step into a gap ·
 *  ult → guard the dash, dodge (or guard) the held overhead. Returns undefined to let the normal AI run. */
function vsBoss(d, me, op, prof, mem, dt, rng, P) {
  const k = Math.max(0, Math.min(1, prof.diff ?? 0.5)), read = lerp(0.3, 0.92, k);
  const C = me.C, m = moveOf(op), gap = Math.abs(op.x - me.x), dirTo = Math.sign(op.x - me.x) || me.facing;
  const key = op.st === 'atk' && m ? 'm' + op.seq : null;
  if (key && key !== mem.bKey) { mem.bKey = key; mem.bAt = mem.t + P.react * (0.7 + 0.6 * rng()); mem.bDone = false; if (!(mem.bPlan && mem.bPlan.keep)) mem.bPlan = null; }
  if (key && !mem.bDone && mem.t >= mem.bAt) { mem.bDone = true; const pl = planVsBoss(op.mk, m, me, op, gap, rng, read, k); if (pl) mem.bPlan = pl; }
  // Data-Blade Rain: a marker under me → guard it out or step into the gap (one decision per blade)
  for (const p of d.projs) {
    if (p.owner !== op || p.key !== 'dblade' || p.dead || p.hit || !(p.delay > 0) || Math.abs(p.x - me.x) > p.r + 0.4) continue;
    if (mem.bladeId === p.id) break;
    mem.bladeId = p.id;
    if (mem.bPlan && mem.bPlan.blade) break;
    if (rng() < read) mem.bPlan = rng() < 0.55 || !grounded(me) ? { type: 'guard', blade: p, keep: true } : { type: 'step', blade: p, keep: true, dir: me.x <= p.x ? -1 : 1 };
    break;
  }
  const pl = mem.bPlan; if (!pl) return undefined;
  if (pl.blade) { if (pl.blade.dead || pl.blade.hit || pl.blade.passed) { mem.bPlan = null; return undefined; } }
  else if (!pl.keep && 'm' + op.seq !== mem.bKey) { mem.bPlan = null; return undefined; }
  if (pl.done && pl.done(op)) { mem.bPlan = null; return undefined; }
  const free = actionable(me) || me.st === 'guard' || me.st === 'block';
  switch (pl.type) {
    case 'guard': me.in.guard = true; me.in.mx = 0; return null;   // also held through hit-stun / stagger, so it is up on the first free frame
    case 'step': {   // walk out of the marker toward the nearer gap
      if (Math.abs(pl.blade.x - me.x) > pl.blade.r + 0.4) { me.in.mx = 0; return null; }
      if (free && me.st !== 'guard') { me.in.mx = pl.dir; return null; }
      return undefined;
    }
    case 'dodge': case 'jump': {
      if (op.st !== 'atk' || 'm' + op.seq !== mem.bKey) { mem.bPlan = null; return undefined; }
      if (op.t >= pl.at) {
        mem.bPlan = null;
        if (actionable(me) && (pl.type === 'jump' || me.dodgeCd <= 0)) { me.in.mx = pl.type === 'jump' ? 0 : pl.dir * dirTo; return pl.type; }
        me.in.guard = true; return null;
      }
      me.in.mx = 0; return free ? null : undefined;   // wait for the flash (don't walk into it, don't attack)
    }
    case 'wait': {   // Mirror Guard: stay out of it, then punish the recovery (normal AI punish logic)
      if (gap < 2.3 && free) { me.in.mx = -dirTo; return null; }
      me.in.mx = 0; return free ? null : undefined;
    }
    case 'skill': mem.bPlan = null; return pl.cmd;
  }
  return undefined;
}
function planVsBoss(mk, m, me, op, gap, rng, read, k) {
  if (rng() >= read) return null;   // misread: the normal AI handles it
  const C = me.C, su = m.t[0], end = m.t[0] + m.t[1] + 0.03, r = rng();
  const until = (t) => (o) => !(o.st === 'atk' && o.mk === mk) || o.t > t;
  switch (mk) {
    case 'iai': if (gap > m.box[1] + 0.6) return null;
      return r < 0.45 ? { type: 'guard', done: until(end) } : r < 0.75 ? { type: 'dodge', at: su - 0.12, dir: 1 } : { type: 'jump', at: su - 0.31 };
    case 'ten1': return { type: 'guard', keep: true, done: (o) => !(o.st === 'atk' && /^ten/.test(o.mk)) || (o.mk === 'ten3' && o.t > o.C.moves.ten3.t[0] + o.C.moves.ten3.t[1] + 0.02) };
    case 'mirror': {
      if (C.role === 'ranged') return null;   // bolts break the mirror: keep shooting
      const sk = C.id === 'sword' ? (me.cd.s1 <= 0 && gap > 1.2 && gap < 4.6 ? 's1' : me.cd.s2 <= 0 && gap < 1.6 ? 's2' : null)
        : C.id === 'brawler' ? (me.cd.s2 <= 0 && gap < 2.1 ? 's2' : me.cd.s1 <= 0 && gap > 1.2 && gap < 5 ? 's1' : null)
        : C.id === 'assassin' ? (me.cd.s2 <= 0 && gap < 6.5 ? 's2' : null) : null;
      if (sk && r < 0.55) return { type: 'skill', cmd: sk };
      return { type: 'wait', done: (o) => !(o.st === 'atk' && o.mk === 'mirror') || o.t > o.C.moves.mirror.parry[1] };
    }
    case 'mcut': return { type: 'guard', done: until(end) };
    case 'glitch': return r < 0.55 ? { type: 'guard', done: until(end) } : { type: 'dodge', at: su - 0.12, dir: 1 };
    case 'ult': return { type: 'guard', keep: true, done: (o) => !(o.st === 'atk' && o.mk === 'ult') };
    case 'ultEnd': return r < 0.5 ? { type: 'guard', done: until(end) } : { type: 'dodge', at: su - 0.12, dir: 1 };
  }
  return null;
}

/** seeded RNG for deterministic sims */
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
