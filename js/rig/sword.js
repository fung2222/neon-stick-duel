// HQ rig profile: 劍士 SWORDSMAN. Pure data + clip builders (no three.js) — tests/rig.test.mjs evaluates these in node.
// Poses are written as deltas over STANCE (rig units, see core.js POSE_KEYS). Every attack has four keys
// A (anticipation) · S (contact on the first active frame) · E (end of the arc) · F (follow-through); attackKeys() times them
// from the move's frame data, so changing frame data in classes.js retimes the animation automatically.
import { attackKeys, flurryKeys } from './core.js';

const A0 = 0.075;   // ankle height = foot on the ground
export const STANCE = {
  px: 0, py: 0.9, pt: 0.06, sp: 0.06, ch: 0.05, tw: 0.3, ctw: -0.15, hd: -0.1, rr: 0,
  fFx: 0.3, fFy: A0, fBx: -0.3, fBy: A0, aF: 0, aB: 0,
  gx: 0.4, gy: 1.1, ga: 0.9, gw: 0.15, ox: -0.14, oy: 0.98, oh: 0,
};
const P = (o) => ({ ...STANCE, ...o });
const AIR = { py: 0.95, fFx: 0.26, fFy: 0.4, fBx: -0.14, fBy: 0.28, aF: 0.3, aB: -0.4 };

export const POSES = {
  stance: STANCE,
  idle1: P({ px: 0.035, py: 0.885, ch: 0.075, hd: -0.08, gx: 0.42, gy: 1.08, ga: 0.86, ox: -0.12, oy: 0.96 }),       // weight on the front foot + breath
  walk: P({ sp: 0.12, ch: 0.03, gx: 0.38, gy: 1.06, ga: 0.78, ox: -0.06, oy: 0.95 }),
  walkBack: P({ px: -0.03, sp: 0.0, ch: 0.0, hd: -0.05, gx: 0.4, gy: 1.14, ga: 1.0 }),
  turn: P({ py: 0.84, sp: 0.1, tw: 0, ctw: 0, gx: 0.3, gy: 1.12, ga: 1.2, gw: 0 }),
  guard: P({ py: 0.83, px: -0.04, sp: 0.03, ch: -0.02, tw: 0.15, ctw: 0.05, hd: 0.06, gx: 0.36, gy: 1.2, ga: 1.62, gw: 0.25, ox: 0.38, oy: 1.48, fFx: 0.36, fBx: -0.36 }),
  block: P({ py: 0.8, px: -0.11, sp: -0.04, ch: -0.16, tw: 0.1, ctw: 0.0, hd: 0.18, gx: 0.3, gy: 1.24, ga: 1.78, gw: 0.25, ox: 0.33, oy: 1.5, fFx: 0.34, fBx: -0.4 }),
  jump: P({ ...AIR, sp: 0.05, gx: 0.15, gy: 1.32, ga: 2.4, gw: -0.2, ox: -0.32, oy: 1.25 }),
  fall: P({ py: 0.95, fFx: 0.3, fFy: 0.18, fBx: -0.2, fBy: 0.12, aF: 0.15, aB: -0.3, gx: 0.38, gy: 1.22, ga: 1.05, ox: -0.32, oy: 1.15 }),
  land: P({ py: 0.74, sp: 0.24, ch: 0.1, hd: -0.25, fFx: 0.32, fBx: -0.3, gx: 0.45, gy: 0.95, ga: 0.6, ox: -0.25, oy: 0.85 }),
  tuck: P({ py: 0.95, sp: 0.55, ch: 0.25, hd: 0.3, tw: 0, ctw: 0, fFx: 0.22, fFy: 0.74, fBx: 0.1, fBy: 0.64, aF: -0.3, aB: -0.3, gx: 0.32, gy: 1.06, ga: 2.5, gw: 0, ox: 0.26, oy: 1.02 }),
  dodge: P({ py: 0.6, sp: 0.6, ch: 0.25, hd: 0.3, tw: 0, ctw: 0, fFx: 0.25, fFy: 0.42, fBx: 0.05, fBy: 0.32, gx: 0.3, gy: 0.85, ga: 2.6, gw: 0, ox: 0.25, oy: 0.82 }),
  // hit reactions (scaled by hit strength in the animator)
  hitHigh: P({ hd: -0.62, ch: -0.3, sp: -0.12, px: -0.1, py: 0.88, tw: 0.05, ctw: -0.2, gx: 0.2, gy: 1.32, ga: 1.55, ox: -0.4, oy: 1.34 }),
  hitMid: P({ hd: 0.38, ch: -0.12, sp: 0.3, px: -0.17, py: 0.82, tw: 0.2, ctw: 0.1, gx: 0.32, gy: 0.98, ga: 0.55, ox: 0.12, oy: 1.0 }),
  hitBack: P({ hd: -0.38, sp: 0.4, ch: 0.22, px: 0.13, py: 0.84, gx: 0.28, gy: 1.04, ga: 0.35, ox: -0.42, oy: 1.25 }),
  stagger: P({ hd: 0.3, ch: -0.32, sp: 0.12, px: -0.22, py: 0.76, tw: 0.35, ctw: 0.2, fBx: -0.42, gx: 0.12, gy: 1.2, ga: 1.9, gw: -0.3, ox: -0.45, oy: 1.42 }),
  airHit: P({ rr: -0.6, py: 0.95, sp: -0.22, ch: -0.2, hd: 0.32, fFx: 0.36, fFy: 0.38, fBx: 0.08, fBy: 0.18, aF: 0.4, aB: 0.2, gx: 0.1, gy: 1.62, ga: 2.3, ox: -0.46, oy: 1.62 }),
  spiked: P({ rr: 0.5, py: 0.95, sp: 0.35, ch: 0.2, hd: -0.4, fFx: 0.1, fFy: 0.15, fBx: -0.25, fBy: 0.3, gx: 0.3, gy: 1.7, ga: 2.2, ox: -0.2, oy: 1.75 }),
  down: P({ rr: -1.5, py: 0.02, px: 0, pt: 0, sp: -0.05, ch: 0.0, hd: 0.35, tw: 0.05, ctw: 0, fFx: 0.2, fFy: -0.74, fBx: 0.0, fBy: -0.8, aF: 0.6, aB: 0.6, gx: -0.3, gy: 1.3, ga: 2.8, gw: 0.4, ox: 0.3, oy: 1.35 }),
  ko: P({ rr: -1.52, py: 0.02, px: 0, pt: 0, sp: -0.08, ch: -0.05, hd: 0.5, tw: 0.1, ctw: 0, fFx: 0.3, fFy: -0.7, fBx: -0.05, fBy: -0.82, aF: 0.6, aB: 0.6, gx: -0.4, gy: 1.6, ga: 2.9, gw: 0.6, ox: 0.45, oy: 1.6 }),
  sit: P({ rr: -0.75, py: 0.06, sp: 0.55, ch: 0.3, hd: 0.25, tw: 0.1, ctw: 0, fFx: 0.42, fFy: -0.4, fBx: 0.32, fBy: -0.48, gx: 0.1, gy: 0.9, ga: 2.4, ox: 0.4, oy: 0.82 }),
  crouch: P({ py: 0.6, sp: 0.5, ch: 0.2, hd: -0.2, fFx: 0.32, fBx: -0.14, gx: 0.42, gy: 0.8, ga: 0.6, ox: 0.2, oy: 0.72 }),
  stun: P({ py: 0.8, sp: -0.15, ch: -0.22, hd: 0.5, tw: 0.1, gx: 0.3, gy: 0.76, ga: -0.6, ox: -0.1, oy: 0.8 }),
  win: P({ py: 0.93, sp: -0.06, ch: -0.06, hd: -0.18, tw: 0.1, ctw: 0, gx: 0.14, gy: 2.08, ga: 1.57, gw: 0, ox: -0.26, oy: 0.95, fFx: 0.24, fBx: -0.26 }),
  win0: P({ py: 0.84, sp: 0.2, tw: -0.2, ctw: -0.3, gx: -0.1, gy: 1.0, ga: -2.6, gw: 0.3, ox: 0.2, oy: 1.1 }),
};

// ------------------------------------------------------------------ attacks (A / S / E / F)
const M = {
  // 橫斬 Slash: high wind-up behind the head → diagonal cut through the chest; hips open first, front foot steps in
  a1: {
    A: P({ px: -0.05, py: 0.88, sp: -0.04, ch: -0.06, hd: -0.04, tw: -0.12, ctw: -0.32, gx: 0.02, gy: 1.78, ga: 2.3, gw: -0.35, ox: 0.15, oy: 1.2 }),
    S: P({ px: 0.08, py: 0.86, sp: 0.15, ch: 0.08, tw: 0.52, ctw: 0.02, fFx: 0.42, gx: 0.54, gy: 1.38, ga: 0.32, gw: 0.12, ox: -0.22, oy: 1.04 }),
    E: P({ px: 0.12, py: 0.83, sp: 0.2, ch: 0.12, tw: 0.56, ctw: 0.32, fFx: 0.44, gx: 0.52, gy: 0.98, ga: -0.6, gw: 0.3, ox: -0.3, oy: 1.05 }),
    F: P({ px: 0.1, py: 0.82, sp: 0.22, ch: 0.12, tw: 0.48, ctw: 0.38, fFx: 0.44, gx: 0.38, gy: 0.8, ga: -0.95, gw: 0.45, ox: -0.3, oy: 1.0 }),
  },
  // 回斬 Back-slash: from the low follow-through, sweep back up across the body (blade yaws around), hips reverse
  a2: {
    A: P({ px: 0.08, py: 0.83, sp: 0.2, tw: 0.55, ctw: 0.3, fFx: 0.42, gx: 0.34, gy: 0.8, ga: -0.95, gw: 0.5, ox: -0.25, oy: 1.0 }),
    S: P({ px: 0.1, py: 0.85, sp: 0.12, ch: 0.04, tw: -0.05, ctw: -0.25, fFx: 0.44, gx: 0.62, gy: 1.12, ga: 0.25, gw: -0.15, ox: -0.3, oy: 1.08 }),
    E: P({ px: 0.09, py: 0.87, sp: 0.06, ch: 0.0, tw: -0.22, ctw: -0.34, fFx: 0.44, gx: 0.54, gy: 1.3, ga: 0.65, gw: -0.45, ox: -0.28, oy: 1.1 }),
    F: P({ px: 0.05, py: 0.88, sp: 0.02, tw: -0.25, ctw: -0.3, fFx: 0.42, gx: 0.22, gy: 1.72, ga: 1.9, gw: -0.55, ox: -0.25, oy: 1.05 }),
  },
  // 突刺 Thrust: draw back (off hand guides forward), then drive from the back leg — hips, chest, arm in that order
  a3: {
    A: P({ px: -0.1, py: 0.86, sp: -0.05, tw: -0.35, ctw: -0.25, fBx: -0.36, gx: -0.05, gy: 1.2, ga: 0.05, gw: 0, ox: 0.4, oy: 1.32 }),
    S: P({ px: 0.16, py: 0.8, sp: 0.32, ch: 0.08, hd: -0.3, tw: 0.6, ctw: 0.15, fFx: 0.66, fBx: -0.32, aB: -0.2, gx: 0.78, gy: 1.22, ga: 0.0, gw: 0, ox: -0.36, oy: 1.0 }),
    E: P({ px: 0.18, py: 0.79, sp: 0.34, ch: 0.08, hd: -0.32, tw: 0.62, ctw: 0.18, fFx: 0.66, fBx: -0.32, aB: -0.2, gx: 0.84, gy: 1.2, ga: -0.04, gw: 0, ox: -0.38, oy: 0.98 }),
    F: P({ px: 0.14, py: 0.82, sp: 0.26, hd: -0.2, tw: 0.5, ctw: 0.1, fFx: 0.62, gx: 0.62, gy: 1.12, ga: -0.12, gw: 0, ox: -0.3, oy: 0.98 }),
  },
  // 挑斬 Rising cut (launcher): crouch with the blade low behind (two hands) → sweep under and up, rise onto the toes
  a4: {
    A: P({ px: -0.04, py: 0.74, sp: 0.3, ch: 0.12, hd: -0.25, tw: -0.25, ctw: -0.3, fFx: 0.38, fBx: -0.36, gx: 0.05, gy: 0.64, ga: -2.8, gw: -0.2, oh: 0.85 }),
    S: P({ px: 0.06, py: 0.84, sp: 0.1, ch: 0.02, tw: 0.45, ctw: 0.15, fFx: 0.42, gx: 0.55, gy: 0.92, ga: 0.55, gw: 0.2, oh: 0.6 }),
    E: P({ px: 0.05, py: 0.98, sp: -0.08, ch: -0.1, hd: 0.1, tw: 0.55, ctw: 0.25, fFx: 0.42, aB: -0.35, gx: 0.4, gy: 1.75, ga: 1.6, gw: 0.1, oh: 0.3 }),
    F: P({ px: 0.03, py: 0.96, sp: -0.12, ch: -0.1, hd: 0.15, tw: 0.5, ctw: 0.2, fFx: 0.4, aB: -0.3, gx: 0.22, gy: 1.95, ga: 1.95, gw: 0.1, oh: 0 }),
  },
  // 空斬 Air slash
  air1: {
    A: P({ ...AIR, sp: -0.05, tw: -0.1, ctw: -0.3, gx: 0.05, gy: 1.72, ga: 2.4, gw: -0.3, ox: 0.1, oy: 1.3 }),
    S: P({ ...AIR, sp: 0.2, tw: 0.45, ctw: 0.1, gx: 0.58, gy: 1.2, ga: 0.0, gw: 0.1, ox: -0.3, oy: 1.1 }),
    E: P({ ...AIR, sp: 0.3, tw: 0.5, ctw: 0.3, gx: 0.5, gy: 0.86, ga: -0.8, gw: 0.3, ox: -0.32, oy: 1.1 }),
    F: P({ ...AIR, sp: 0.3, tw: 0.45, ctw: 0.3, gx: 0.35, gy: 0.76, ga: -1.15, gw: 0.35, ox: -0.3, oy: 1.05 }),
  },
  // 落斬 Falling cleave (spike): two-handed overhead, body rolls forward into the chop
  air2: {
    A: P({ ...AIR, rr: -0.25, sp: -0.1, ch: -0.1, tw: 0, ctw: -0.1, gx: -0.08, gy: 1.86, ga: 2.7, gw: 0, oh: 0.8 }),
    S: P({ ...AIR, rr: 0.22, sp: 0.3, ch: 0.1, tw: 0.3, ctw: 0.1, gx: 0.56, gy: 1.06, ga: -0.45, gw: 0, oh: 0.7 }),
    E: P({ ...AIR, rr: 0.38, sp: 0.4, ch: 0.12, tw: 0.3, ctw: 0.12, gx: 0.48, gy: 0.64, ga: -1.25, gw: 0, oh: 0.6 }),
    F: P({ ...AIR, rr: 0.32, sp: 0.36, tw: 0.3, gx: 0.38, gy: 0.56, ga: -1.45, gw: 0, oh: 0.3 }),
  },
  // 疾風突刺 Gale Lunge: deep coil, then a full-body extension that skids along the floor
  s1: {
    A: P({ px: -0.12, py: 0.74, sp: 0.25, hd: -0.3, tw: -0.45, ctw: -0.3, fFx: 0.42, fBx: -0.4, gx: -0.1, gy: 1.16, ga: 0.12, gw: 0, ox: 0.36, oy: 1.2 }),
    S: P({ px: 0.2, py: 0.7, sp: 0.55, ch: 0.12, hd: -0.55, tw: 0.65, ctw: 0.1, fFx: 0.72, fBx: -0.66, aB: -0.3, gx: 0.82, gy: 1.1, ga: -0.02, gw: 0, ox: -0.46, oy: 0.96 }),
    E: P({ px: 0.21, py: 0.7, sp: 0.56, ch: 0.12, hd: -0.55, tw: 0.66, ctw: 0.12, fFx: 0.72, fBx: -0.66, aB: -0.3, gx: 0.86, gy: 1.1, ga: -0.04, gw: 0, ox: -0.48, oy: 0.96 }),
    F: P({ px: 0.15, py: 0.74, sp: 0.42, hd: -0.35, tw: 0.5, ctw: 0.05, fFx: 0.66, fBx: -0.55, gx: 0.6, gy: 1.04, ga: -0.15, gw: 0, ox: -0.36, oy: 0.96 }),
  },
  // 昇龍斬 Rising Dragon: low crouch → corkscrew upward cut, knees tucked as the body leaves the floor
  s2: {
    A: P({ px: -0.02, py: 0.72, sp: 0.32, ch: 0.12, hd: -0.25, tw: -0.3, ctw: -0.35, gx: 0.15, gy: 0.6, ga: -2.6, gw: -0.2, oh: 0.8 }),
    S: P({ py: 0.95, sp: 0.08, tw: 0.5, ctw: 0.2, fFx: 0.3, fFy: 0.34, aF: 0.3, gx: 0.5, gy: 1.2, ga: 0.9, gw: 0.2, oh: 0.5 }),
    E: P({ py: 1.0, sp: -0.15, ch: -0.1, hd: 0.25, tw: 0.6, ctw: 0.3, fFx: 0.28, fFy: 0.5, fBx: -0.05, fBy: 0.2, aF: 0.4, aB: -0.4, gx: 0.25, gy: 2.0, ga: 1.65, gw: 0.1, oh: 0.3 }),
    F: P({ py: 0.98, sp: -0.1, ch: -0.08, hd: 0.2, tw: 0.5, ctw: 0.25, fFx: 0.28, fFy: 0.42, fBx: -0.1, fBy: 0.22, gx: 0.2, gy: 1.95, ga: 1.95, gw: 0.1, oh: 0 }),
  },
};
// 千刃斬 Thousand Edges: a flurry of alternating cuts that sweep around the body (blade yaw), finished by a rising cut
const ULT = {
  A: P({ py: 0.82, sp: -0.1, ch: -0.15, hd: 0.2, tw: -0.4, ctw: -0.4, gx: -0.2, gy: 1.5, ga: 2.9, gw: -0.5, ox: 0.3, oy: 1.4 }),
  S1: M.a1.S, E1: P({ ...M.a1.E, gw: 0.9 }),
  S2: M.a2.S, E2: P({ ...M.a2.E, gw: -0.9 }),
  LS: M.a4.S, LE: M.a4.E, F: M.a4.F,
};

/** attack clip keys for a move (null = no HQ animation for this move → the animator falls back to a generic swing) */
export function moveKeys(key, move) {
  if (key === 'ult') return flurryKeys(move.t, move.multi || 7, ULT, STANCE);
  const k = M[key]; if (!k) return null;
  return attackKeys(move.t, k, STANCE);
}
export const MOVES = M;
export const PROFILE = {
  id: 'sword', weapon: 'blade', stance: STANCE, poses: POSES, moveKeys,
  outfit: { coat: true, tails: 2, scarf: true },
  airMoves: ['air1', 'air2'],
};
