// 影刃 ASSASSIN — anime phase 4: cyber kunoichi on the HQ rig. Pure data + clip builders (node-tested, tests/anime-assassin.test.mjs).
// Twin kodachi held in REVERSE GRIP (逆手): ga / oa are the lead / rear blade angles RELATIVE to the forearm (rig plane, kept in
// [0.9, 2π − 0.9] so a blade never swings through the forward-grip direction). Authored below as ABSOLUTE rig-plane angles (easier to
// aim at a hitbox) and converted once at load from the solved pose (toRel). The blade angle is the sixth link of the power chain:
// evalChain(…, fist = true) keeps ga AND oa exactly on time while the hands lead — the wrist snap lands last on both hands.
//   Stance: low 忍び crouch on the balls of the feet, lead blade laid along the forearm, rear blade guarding the face.
//   Footwork: 滑り足 sliding steps (a1, a2), clinch step (a3), hip-driven spins about the lead foot (a4, ult), back-skid (s1),
//   the burst lunge + 瞬身 teleport (s2), the vanish-step (ult).
// Combo (frame windows unchanged from classes.js): a1 逆手突 lead hammer-stab · a2 交叉斬 rear backhand diagonal (the hands
// alternate, the lead pulls back to guard) · a3 膝蹴 clinch + rear knee · a4 旋風斬 hip-driven spinning double cut, rising launcher.
// air1 十字斬 X-cut · air2 月輪 overhead axe that rolls into a forward flip (spike). s1 影步 back-skid with three alternating kunai
// flicks (each released at the spawn point). s2 瞬殺 coil → burst lunge → teleport behind → reverse-grip backstab with the back to
// the foe → spin to face. ult 死蓮: vanish-step → six alternating cuts with two whole spins → back-turned cut-through → 居合 sheathe:
// the last two hits land AFTER the blades go home (the click = the 160-damage hit), HELD with the eyes closed.
import { form } from './clip.js';
import { solve } from '../rig/core.js';

const A0 = 0.075, PI = Math.PI, H = PI / 2, TAU = PI * 2;
/** blade geometry along its direction from the grip (rig units): the fist centre sits GRIP past the wrist along the forearm */
export const DAGGER = { grip: 0.045, base: 0.06, tip: 0.44, handle: 0.075 };
export const STANCE = {
  px: 0.0, py: 0.74, pt: 0.1, sp: 0.22, ch: 0.08, tw: 0.5, ctw: -0.12, hd: -0.22, rr: 0,
  fFx: 0.4, fFy: A0, fBx: -0.42, fBy: A0, aF: 0, aB: 0,
  gx: 0.48, gy: 1.24, ga: -2.55, gw: 0, ox: 0.36, oy: 1.4, oh: 0,
  sy: 0, pv: 0, hF: 0.3, hB: 0.65, kF: -0.12, kB: 0.28, sh: 0,
  cF1: 1, cF2: 1, cB1: 1, cB2: 1, oa: -1.75, fr: 0, fs: 0, gs: 0, zz: 0,
};
const P = (o) => ({ ...STANCE, ...o });
const AIR = { py: 0.95, fFx: 0.22, fFy: 0.45, fBx: -0.1, fBy: 0.32, aF: 0.3, aB: -0.4, hF: 0, hB: 0, kF: 0, kB: 0 };

export const POSES = {
  stance: STANCE,
  idle1: P({ py: 0.755, ch: 0.1, sp: 0.2, hd: -0.24, gy: 1.27, oy: 1.42, ga: -2.45 }),
  shuffle: P({ px: 0.07, fFx: 0.52, fBx: -0.34, py: 0.72, hF: 0.4, tw: 0.56, gx: 0.52 }),
  walk: P({ py: 0.72, sp: 0.26, hd: -0.24, gx: 0.5, gy: 1.22, ox: 0.38, oy: 1.38 }),
  walkBack: P({ px: -0.04, py: 0.75, sp: 0.18, gx: 0.46, gy: 1.28, ox: 0.34, oy: 1.42, hF: 0.4 }),
  turn: P({ py: 0.8, sp: 0.12, tw: 0, ctw: 0, gx: 0.32, gy: 1.34, ox: 0.24, oy: 1.38, hF: 0.7, hB: 0.7, kF: 0, kB: 0 }),
  // guard: 十字受け both blades crossed in front of the face, low stance
  guard: P({ px: -0.03, py: 0.7, sp: 0.16, ch: 0.04, tw: 0.46, ctw: 0, hd: -0.1, gx: 0.36, gy: 1.46, ga: -1.95, ox: 0.34, oy: 1.36, oa: -1.2 }),
  block: P({ px: -0.12, py: 0.67, sp: 0.06, ch: -0.12, tw: 0.42, ctw: 0, hd: 0.1, fBx: -0.5, gx: 0.32, gy: 1.46, ga: -1.95, ox: 0.3, oy: 1.36, oa: -1.2 }),
  jump: P({ ...AIR, sp: 0.1, gx: 0.34, gy: 1.4, ga: -2.4, ox: 0.2, oy: 1.46, oa: -1.7 }),
  fall: P({ py: 0.95, fFx: 0.3, fFy: 0.2, fBx: -0.18, fBy: 0.12, aF: 0.15, aB: -0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.38, gy: 1.28, ga: -2.2, ox: -0.18, oy: 1.2, oa: 2.2 }),
  land: P({ py: 0.58, sp: 0.46, ch: 0.14, hd: -0.25, fFx: 0.44, fBx: -0.42, kF: -0.2, kB: 0.4, hF: 0, hB: 0.6, gx: 0.42, gy: 0.4, ga: PI, ox: -0.16, oy: 1.08, oa: 2.4 }),   // three-point landing
  tuck: P({ py: 0.95, sp: 0.6, ch: 0.3, hd: 0.35, tw: 0, ctw: 0, fFx: 0.2, fFy: 0.72, fBx: 0.08, fBy: 0.62, aF: -0.3, aB: -0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.3, gy: 1.0, ga: -2.0, ox: 0.26, oy: 1.0, oa: -2.2 }),
  dodge: P({ py: 0.6, sp: 0.6, ch: 0.25, hd: 0.3, tw: 0, ctw: 0, fFx: 0.25, fFy: 0.42, fBx: 0.05, fBy: 0.32, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.3, gy: 0.85, ga: -2.0, ox: 0.25, oy: 0.82, oa: -2.2 }),
  hitHigh: P({ px: -0.12, py: 0.84, hd: -0.7, ch: -0.35, sp: -0.15, tw: 0.1, ctw: -0.25, fBx: -0.5, hF: 0, hB: 0.6, kB: 0.1, gx: 0.18, gy: 1.46, ga: -0.6, ox: -0.3, oy: 1.42, oa: 2.6 }),
  hitMid: P({ px: -0.18, py: 0.74, hd: 0.4, ch: 0.1, sp: 0.4, tw: 0.25, ctw: 0.12, fBx: -0.5, hF: 0, gx: 0.28, gy: 1.0, ga: -2.6, ox: 0.15, oy: 1.02, oa: -2.4 }),
  hitBack: P({ px: 0.14, py: 0.8, hd: -0.4, sp: -0.2, ch: -0.3, tw: 0.3, fFx: 0.48, hF: 0, gx: 0.1, gy: 1.3, ga: -1.2, ox: -0.4, oy: 1.3, oa: 1.4 }),
  stagger: P({ px: -0.24, py: 0.72, hd: 0.35, ch: -0.3, sp: 0.12, tw: 0.7, ctw: 0.2, fBx: -0.58, kB: 0.4, hF: 0, hB: 0, gx: 0.08, gy: 1.3, ga: -1.2, ox: -0.45, oy: 1.45, oa: 1.4 }),
  airHit: P({ rr: -0.6, py: 0.95, sp: -0.22, ch: -0.2, hd: 0.32, fFx: 0.36, fFy: 0.38, fBx: 0.08, fBy: 0.18, aF: 0.4, aB: 0.2, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.1, gy: 1.62, ga: -0.4, ox: -0.46, oy: 1.62, oa: 2.6 }),
  spiked: P({ rr: 0.5, py: 0.95, sp: 0.35, ch: 0.2, hd: -0.4, fFx: 0.1, fFy: 0.15, fBx: -0.25, fBy: 0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.3, gy: 1.7, ga: 0.4, ox: -0.2, oy: 1.75, oa: 2.8 }),
  down: P({ rr: -1.5, py: 0.02, px: 0, pt: 0, sp: -0.05, ch: 0, hd: 0.35, tw: 0.05, ctw: 0, fFx: 0.2, fFy: -0.74, fBx: 0, fBy: -0.8, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kF: 0, kB: 0, gx: -0.3, gy: 1.3, ga: 1.3, ox: 0.3, oy: 1.35, oa: 1.5 }),
  downB: P({ rr: -1.32, py: 0.1, px: 0, pt: 0, sp: 0.05, ch: 0.05, hd: 0.2, tw: 0.05, ctw: 0, fFx: 0.3, fFy: -0.6, fBx: 0.1, fBy: -0.7, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kF: 0, kB: 0, gx: -0.2, gy: 1.4, ga: 1.3, ox: 0.35, oy: 1.4, oa: 1.5 }),
  ko: P({ rr: -1.52, py: 0.02, px: 0, pt: 0, sp: -0.08, ch: -0.05, hd: 0.5, tw: 0.1, ctw: 0, fFx: 0.3, fFy: -0.7, fBx: -0.05, fBy: -0.82, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kF: 0, kB: 0, gx: -0.4, gy: 1.6, ga: 1.2, ox: 0.45, oy: 1.6, oa: 1.6 }),
  rollB: P({ rr: -3.5, py: 0.5, sp: 0.62, ch: 0.3, hd: 0.45, tw: 0, ctw: 0, fFx: 0.22, fFy: 0.6, fBx: 0.12, fBy: 0.52, aF: -0.3, aB: -0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.28, gy: 1.0, ga: -2.0, ox: 0.3, oy: 0.95, oa: -2.2 }),
  kneel: P({ rr: -TAU + 0.5, py: 0.5, sp: 0.38, ch: 0.12, hd: -0.3, fFx: 0.34, fFy: A0, fBx: -0.22, fBy: 0.1, hF: 0, hB: 0.9, kF: 0, kB: 0.2, gx: 0.44, gy: 0.36, ga: PI, ox: 0.2, oy: 1.1, oa: -1.8 }),
  stun: P({ py: 0.76, sp: -0.15, ch: -0.22, hd: 0.5, tw: 0.1, hF: 0, hB: 0, gx: 0.3, gy: 0.8, ga: -2.2, ox: -0.1, oy: 0.82, oa: -2.0 }),
  // win: 血振り chiburi flick → 納刀 both blades home at the lower back → 印 hand seal before the mask, standing tall
  winA: P({ py: 0.7, sp: 0.18, tw: 0.3, ctw: 0, gx: 0.34, gy: 1.52, ga: 1.9, ox: 0.3, oy: 1.48, oa: 1.2 }),
  winB: P({ py: 0.66, sp: 0.3, ch: 0.06, tw: 0.4, ctw: -0.1, hd: -0.1, fFx: 0.46, fBx: -0.46, gx: 0.62, gy: 0.9, ga: -2.2, ox: -0.3, oy: 0.98, oa: -2.0 }),
  winC: P({ py: 0.8, sp: 0.08, ch: 0.04, tw: 0.3, ctw: 0, hd: 0.02, fFx: 0.3, fBx: -0.34, hF: 0.1, hB: 0.3, kF: 0, kB: 0.15, gx: -0.12, gy: 0.82, ga: -2.3, ox: -0.16, oy: 0.86, oa: -2.0 }),
  winD: P({ py: 0.8, sp: 0.08, ch: 0.04, tw: 0.3, ctw: 0, hd: 0.06, fFx: 0.3, fBx: -0.34, hF: 0.1, hB: 0.3, kF: 0, kB: 0.15, gx: -0.12, gy: 0.82, ga: -2.3, ox: -0.16, oy: 0.86, oa: -2.0, sh: 1 }),
  win: P({ px: -0.02, py: 0.86, sp: 0.06, ch: 0.04, tw: 0.3, ctw: -0.05, hd: 0.02, fFx: 0.22, fBx: -0.26, hF: 0, hB: 0.2, kF: 0, kB: 0.1, gx: 0.34, gy: 1.42, ga: -1.4, ox: -0.06, oy: 0.86, oa: -2.0, sh: 1 }),
};

// ------------------------------------------------------------------ attack forms (F[move] = named key poses; ga / oa absolute here)
const F = {
  // 逆手突 Reverse hammer-stab (lead blade): sink back, the lead fist rises beside the head with the blade laid along the forearm →
  // 滑り足 slide in, hips snap, the fist drives forward-down and the wrist turns the blade out into a downward stab; rear blade guards
  a1: {
    A: P({ px: -0.03, py: 0.73, sp: 0.18, tw: 0.32, ctw: -0.3, fFx: 0.38, fFy: 0.095, aF: 0.12, hF: 0.1, kB: 0.34, gx: 0.24, gy: 1.56, ga: -1.45, ox: 0.34, oy: 1.4, oa: -1.75 }),
    S: P({ px: 0.12, py: 0.69, sp: 0.34, ch: 0.1, hd: -0.3, tw: 0.66, ctw: 0.22, fFx: 0.54, fBx: -0.4, hF: 0.15, hB: 0.75, kB: 0.25, gx: 0.66, gy: 1.3, ga: -0.95, ox: 0.36, oy: 1.42, oa: -1.75 }),
    E: P({ px: 0.14, py: 0.68, sp: 0.36, ch: 0.1, hd: -0.3, tw: 0.7, ctw: 0.26, fFx: 0.54, fBx: -0.4, hF: 0.15, hB: 0.78, kB: 0.25, gx: 0.7, gy: 1.2, ga: -1.05, ox: 0.36, oy: 1.42, oa: -1.75 }),
    F: P({ px: 0.1, py: 0.71, sp: 0.28, hd: -0.26, tw: 0.56, ctw: 0.04, fFx: 0.52, fBx: -0.42, hF: 0.2, hB: 0.7, kB: 0.28, gx: 0.54, gy: 1.24, ga: -2.0, ox: 0.36, oy: 1.4, oa: -1.75 }),
  },
  // 交叉斬 Cross cut (rear blade): the hips coil open, the rear fist chambers high by the rear ear (blade pointing back) → the rear
  // heel pivots, hips + shoulders turn through, the fist sweeps diagonally down across the body with the blade trailing along the
  // forearm (edge out); the lead blade pulls back to guard the face (the hands alternate)
  a2: {
    A: P({ px: -0.02, py: 0.72, sp: 0.2, tw: 0.7, ctw: 0.12, fFx: 0.44, fBx: -0.44, hF: 0.2, hB: 0.5, kB: 0.36, gx: 0.6, gy: 1.3, ga: -1.3, ox: 0.06, oy: 1.6, oa: 2.6 }),
    S: P({ px: 0.14, py: 0.68, sp: 0.32, ch: 0.08, hd: -0.28, tw: -0.05, ctw: -0.42, fFx: 0.58, fBx: -0.48, hF: 0.15, hB: 0.85, kF: -0.08, kB: 0.1, gx: 0.34, gy: 1.42, ga: -1.7, ox: 0.6, oy: 1.12, oa: 2.3 }),
    E: P({ px: 0.16, py: 0.67, sp: 0.34, ch: 0.08, hd: -0.28, tw: -0.1, ctw: -0.45, fFx: 0.58, fBx: -0.48, hF: 0.15, hB: 0.88, kF: -0.08, kB: 0.1, gx: 0.33, gy: 1.42, ga: -1.7, ox: 0.62, oy: 0.98, oa: 2.5 }),
    F: P({ px: 0.1, py: 0.7, sp: 0.28, hd: -0.26, tw: 0.2, ctw: -0.25, fFx: 0.56, fBx: -0.46, hF: 0.2, hB: 0.7, kB: 0.2, gx: 0.4, gy: 1.36, ga: -2.0, ox: 0.5, oy: 1.18, oa: 2.9 }),
  },
  // 膝蹴 Clinch knee (rear knee): both fists reach out and hook the foe's collar (blades along the forearms) → pull down while the
  // rear knee drives up into the body, the support heel rises
  a3: {
    A: P({ px: 0.0, py: 0.74, sp: 0.16, tw: 0.36, ctw: 0, fFx: 0.42, fBx: -0.4, hF: 0.4, hB: 0.6, gx: 0.6, gy: 1.54, ga: -2.2, ox: 0.54, oy: 1.5, oa: -2.0 }),
    S: P({ px: 0.12, py: 0.86, sp: 0.06, ch: -0.02, hd: -0.18, tw: 0.2, ctw: 0.05, fFx: 0.4, fBx: 0.3, fBy: 0.62, aB: -0.5, hF: 0.6, hB: 0, kF: 0, kB: 0, gx: 0.62, gy: 1.3, ga: -2.4, ox: 0.58, oy: 1.24, oa: -2.2 }),
    E: P({ px: 0.13, py: 0.87, sp: 0.04, ch: -0.02, hd: -0.18, tw: 0.18, ctw: 0.05, fFx: 0.4, fBx: 0.34, fBy: 0.7, aB: -0.6, hF: 0.65, hB: 0, kF: 0, kB: 0, gx: 0.6, gy: 1.2, ga: -2.4, ox: 0.56, oy: 1.16, oa: -2.2 }),
    F: P({ px: 0.08, py: 0.76, sp: 0.16, hd: -0.22, tw: 0.4, ctw: -0.05, fFx: 0.42, fBx: -0.36, hF: 0.3, hB: 0.6, gx: 0.52, gy: 1.3, ga: -2.4, ox: 0.4, oy: 1.38, oa: -1.8 }),
  },
  // 旋風斬 Whirlwind cut (launcher, 2 ticks): wind the hips back → a whole hip-driven turn about the lead foot with both blades swept
  // out wide (tick 1 lead, tick 2 the rear blade rising) → rises on the toes, blades high; the finish is HELD
  a4: {
    A: P({ px: -0.02, py: 0.64, sp: 0.36, ch: 0.12, hd: -0.2, tw: 0.75, ctw: 0.25, fFx: 0.42, fBx: -0.46, hF: 0.5, hB: 0.6, kF: -0.2, kB: 0.4, sy: 0.55, pv: 0.4, gx: 0.12, gy: 1.2, ga: -2.6, ox: 0.08, oy: 1.32, oa: -2.0 }),
    S: P({ px: 0.06, py: 0.7, sp: 0.2, ch: 0.06, hd: -0.2, tw: 0.4, ctw: -0.1, fFx: 0.42, fBx: -0.42, hF: 0.6, hB: 0.6, kF: -0.1, kB: 0.25, sy: -0.75, pv: 0.4, gx: 0.66, gy: 1.26, ga: 2.3, ox: -0.32, oy: 1.2, oa: -2.6 }),
    M: P({ px: 0.06, py: 0.78, sp: 0.12, ch: 0.0, hd: -0.12, tw: 0.4, ctw: -0.1, fFx: 0.42, fBx: -0.42, hF: 0.7, hB: 0.7, kF: 0, kB: 0.15, sy: -0.75 - PI, pv: 0.4, gx: 0.6, gy: 1.36, ga: 2.4, ox: -0.36, oy: 1.4, oa: 0.4 }),
    E: P({ px: 0.08, py: 0.88, sp: 0.02, ch: -0.06, hd: 0.06, tw: 0.3, ctw: -0.2, fFx: 0.42, fBx: -0.36, hF: 0.85, hB: 0.85, kF: 0, kB: 0.05, sy: -TAU - 0.35, pv: 0.4, gx: 0.3, gy: 1.7, ga: 2.0, ox: 0.5, oy: 1.86, oa: 2.4 }),
    H: P({ px: 0.08, py: 0.86, sp: 0.04, ch: -0.05, hd: 0.06, tw: 0.32, ctw: -0.18, fFx: 0.42, fBx: -0.36, hF: 0.8, hB: 0.8, kF: 0, kB: 0.05, sy: -TAU, pv: 0.4, gx: 0.32, gy: 1.68, ga: 2.0, ox: 0.48, oy: 1.82, oa: 2.4 }),
  },
  // 十字斬 Air X-cut: both fists crossed high, blades back → both arms sweep down-forward, the blades crossing
  air1: {
    A: P({ ...AIR, sp: -0.05, tw: 0.3, ctw: 0, gx: 0.26, gy: 1.72, ga: 2.3, ox: 0.18, oy: 1.68, oa: 2.6 }),
    S: P({ ...AIR, px: 0.05, sp: 0.2, ch: 0.08, hd: -0.18, tw: 0.4, ctw: 0.05, gx: 0.62, gy: 1.2, ga: -1.6, ox: 0.52, oy: 1.08, oa: -1.85 }),
    E: P({ ...AIR, px: 0.06, sp: 0.24, ch: 0.08, hd: -0.18, tw: 0.42, ctw: 0.06, gx: 0.58, gy: 0.98, ga: -1.95, ox: 0.46, oy: 0.9, oa: -2.15 }),
    F: P({ ...AIR, sp: 0.12, tw: 0.35, gx: 0.42, gy: 1.3, ga: -2.4, ox: 0.28, oy: 1.42, oa: -1.8 }),
  },
  // 月輪 Moon-wheel axe (spike): lean back with both blades overhead → the overhead axe cut drives the body into a forward flip,
  // completed through the recovery (a whole turn of rr; the end key carries rr = 2π so the flip never unwinds)
  air2: {
    A: P({ ...AIR, rr: -0.35, sp: -0.14, ch: -0.12, hd: 0.1, tw: 0.1, ctw: 0, fFy: 0.55, fBy: 0.42, gx: 0.12, gy: 1.86, ga: 2.4, ox: 0.04, oy: 1.82, oa: 2.6 }),
    S: P({ ...AIR, rr: 0.7, sp: 0.4, ch: 0.12, hd: -0.2, tw: 0.3, ctw: 0.1, fFy: 0.6, fBy: 0.5, gx: 0.56, gy: 1.15, ga: -0.9, ox: 0.5, oy: 1.08, oa: -1.05 }),
    E: P({ ...AIR, rr: 1.9, sp: 0.55, ch: 0.2, hd: -0.2, tw: 0.2, ctw: 0.05, fFx: 0.12, fFy: 0.7, fBx: 0.0, fBy: 0.6, gx: 0.45, gy: 0.98, ga: -1.4, ox: 0.4, oy: 0.94, oa: -1.5 }),
    F: P({ ...AIR, rr: TAU - 0.35, sp: 0.3, ch: 0.1, hd: -0.1, gx: 0.4, gy: 1.2, ga: -2.2, ox: 0.3, oy: 1.3, oa: -1.9 }),
  },
  // 影步 Shadow step: drop into a low back-skid; three alternating kunai flicks, each hand reaching the spawn point exactly on its
  // release (lead .12 / rear .18 / lead .24), the other hand cocked by the shoulder
  s1: {
    A: P({ px: -0.06, py: 0.62, sp: 0.42, ch: 0.12, hd: -0.3, tw: 0.3, ctw: -0.2, fFx: 0.44, fBx: -0.5, kF: -0.15, kB: 0.45, hF: 0.2, hB: 0.6, gx: 0.2, gy: 1.3, ga: -2.4, ox: 0.18, oy: 1.36, oa: -2.0 }),
    S: P({ px: -0.08, py: 0.6, sp: 0.44, ch: 0.12, hd: -0.32, tw: 0.35, ctw: -0.3, fFx: 0.46, fBx: -0.5, kF: -0.15, kB: 0.45, hF: 0.2, hB: 0.6, gx: 0.1, gy: 1.36, ga: -2.4, ox: 0.22, oy: 1.38, oa: -2.0 }),
    T1: P({ px: -0.06, py: 0.6, sp: 0.46, ch: 0.12, hd: -0.32, tw: 0.62, ctw: 0.2, fFx: 0.46, fBx: -0.5, kF: -0.15, kB: 0.45, hF: 0.2, hB: 0.6, gx: 0.46, gy: 1.04, ga: -0.6, ox: 0.06, oy: 1.4, oa: 2.4 }),
    T2: P({ px: -0.06, py: 0.6, sp: 0.44, ch: 0.12, hd: -0.32, tw: 0.15, ctw: -0.4, fFx: 0.46, fBx: -0.5, kF: -0.15, kB: 0.45, hF: 0.2, hB: 0.6, gx: 0.12, gy: 1.36, ga: 2.2, ox: 0.46, oy: 1.24, oa: -0.4 }),
    T3: P({ px: -0.04, py: 0.6, sp: 0.5, ch: 0.14, hd: -0.32, tw: 0.62, ctw: 0.2, fFx: 0.46, fBx: -0.5, kF: -0.15, kB: 0.45, hF: 0.2, hB: 0.6, gx: 0.46, gy: 0.89, ga: -0.8, ox: 0.1, oy: 1.4, oa: 2.4 }),
    F: P({ px: -0.02, py: 0.66, sp: 0.34, ch: 0.1, hd: -0.28, tw: 0.5, ctw: -0.1, fFx: 0.44, fBx: -0.46, kF: -0.12, kB: 0.35, hF: 0.25, hB: 0.65, gx: 0.42, gy: 1.2, ga: -2.4, ox: 0.32, oy: 1.38, oa: -1.8 }),
  },
  // 瞬殺 Phantom strike: coil low, both blades swept back → burst lunge → 瞬身 teleport behind the foe (the renderer leaves a trail of
  // after-images) → lands already back-turned (sy = π) and drives the rear blade backward past the hip into the foe → spins to face
  s2: {
    A: P({ px: -0.06, py: 0.58, sp: 0.5, ch: 0.14, hd: -0.32, tw: 0.4, ctw: -0.1, fFx: 0.46, fBx: -0.52, kF: -0.15, kB: 0.45, hF: 0.4, hB: 0.7, gx: 0.06, gy: 0.98, ga: -2.8, ox: -0.04, oy: 1.04, oa: -2.6 }),
    D: P({ px: 0.22, py: 0.64, sp: 0.62, ch: 0.16, hd: -0.38, tw: 0.4, ctw: 0, fFx: 0.66, fBx: -0.66, aB: -0.3, kF: -0.1, kB: 0.2, hF: 0.2, hB: 0.95, gx: -0.12, gy: 1.08, ga: PI - 0.3, ox: -0.22, oy: 1.0, oa: PI - 0.2 }),
    T: P({ px: -0.04, py: 0.6, sp: 0.42, ch: 0.12, hd: -0.3, tw: 0.3, ctw: -0.1, fFx: 0.44, fBx: -0.48, kF: -0.15, kB: 0.4, hF: 0.3, hB: 0.6, sy: PI, pv: 0, gx: 0.36, gy: 1.3, ga: -2.4, ox: 0.18, oy: 1.1, oa: -2.0 }),
    S: P({ px: -0.06, py: 0.62, sp: 0.36, ch: 0.1, hd: -0.2, tw: 0.15, ctw: -0.45, fFx: 0.42, fBx: -0.46, kF: -0.12, kB: 0.35, hF: 0.3, hB: 0.6, sy: PI, pv: 0, gx: 0.38, gy: 1.32, ga: -2.2, ox: -0.12, oy: 0.9, oa: PI - 0.12 }),
    E: P({ px: -0.07, py: 0.61, sp: 0.38, ch: 0.1, hd: -0.2, tw: 0.1, ctw: -0.5, fFx: 0.42, fBx: -0.46, kF: -0.12, kB: 0.35, hF: 0.3, hB: 0.6, sy: PI, pv: 0, gx: 0.38, gy: 1.32, ga: -2.2, ox: -0.16, oy: 0.92, oa: PI - 0.06 }),
    R: P({ sy: TAU, pv: 0.0, py: 0.7, gx: 0.44, gy: 1.26, ox: 0.34, oy: 1.4 }),
  },
};
// 死蓮 Death Lotus: crouch → vanish-step (zz) → six alternating cuts, spinning (two whole turns) → back-turned cut-through → 居合:
// the hands carry both blades home to the lower-back scabbards while the last two hits land (sh = 1 exactly on the 160-damage click),
// HELD with the head bowed → turn to face
const ULT = {
  A: P({ py: 0.62, sp: 0.4, ch: 0.12, hd: -0.3, tw: 0.42, ctw: 0, fFx: 0.44, fBx: -0.48, kF: -0.15, kB: 0.45, gx: 0.34, gy: 1.36, ga: -1.9, ox: 0.32, oy: 1.32, oa: -1.2 }),
  V: P({ py: 0.66, sp: 0.5, ch: 0.14, hd: -0.34, tw: 0.42, ctw: 0, fFx: 0.5, fBx: -0.5, kF: -0.1, kB: 0.3, gx: 0.2, gy: 1.2, ga: -2.6, ox: 0.1, oy: 1.16, oa: -2.4, zz: 1 }),
  W0: P({ py: 0.62, sp: 0.42, ch: 0.12, hd: -0.3, tw: 0.6, ctw: 0.1, fFx: 0.46, fBx: -0.48, kF: -0.15, kB: 0.45, gx: 0.2, gy: 0.92, ga: -2.6, ox: 0.3, oy: 1.38, oa: -1.7, zz: -0.35 }),
  C0: P({ px: 0.06, py: 0.72, sp: 0.24, ch: 0.04, hd: -0.2, tw: 0.62, ctw: 0.25, fFx: 0.5, fBx: -0.44, kB: 0.3, hB: 0.8, gx: 0.6, gy: 1.5, ga: 2.0, ox: 0.32, oy: 1.38, oa: -1.7 }),
  W1: P({ px: 0.06, py: 0.68, sp: 0.3, ch: 0.06, hd: -0.2, tw: 0.4, ctw: 0, fFx: 0.48, fBx: -0.44, hF: 0.6, hB: 0.6, sy: -PI, pv: 0.45, gx: 0.66, gy: 1.3, ga: 2.4, ox: -0.3, oy: 1.28, oa: -2.4 }),
  C1: P({ px: 0.08, py: 0.68, sp: 0.3, ch: 0.06, hd: -0.24, tw: -0.05, ctw: -0.4, fFx: 0.5, fBx: -0.46, hF: 0.4, hB: 0.8, sy: -TAU, pv: 0.45, gx: 0.34, gy: 1.42, ga: -1.7, ox: 0.62, oy: 1.12, oa: 2.35 }),
  W2: P({ px: 0.08, py: 0.7, sp: 0.26, hd: -0.24, tw: 0.3, ctw: -0.3, fFx: 0.5, fBx: -0.46, hF: 0.3, hB: 0.7, sy: -TAU, pv: 0.45, gx: 0.12, gy: 1.58, ga: 2.6, ox: 0.4, oy: 1.3, oa: -1.6 }),
  C2: P({ px: 0.1, py: 0.68, sp: 0.32, ch: 0.06, hd: -0.26, tw: 0.66, ctw: 0.24, fFx: 0.52, fBx: -0.44, hF: 0.2, hB: 0.8, sy: -TAU, pv: 0.45, gx: 0.62, gy: 1.08, ga: 2.4, ox: 0.34, oy: 1.42, oa: -1.7 }),
  W3: P({ px: 0.1, py: 0.68, sp: 0.3, ch: 0.06, hd: -0.2, tw: 0.4, ctw: 0, fFx: 0.5, fBx: -0.44, hF: 0.6, hB: 0.6, sy: -3 * PI, pv: 0.45, gx: 0.66, gy: 1.3, ga: 2.4, ox: -0.3, oy: 1.28, oa: -2.4 }),
  C3: P({ px: 0.12, py: 0.68, sp: 0.3, ch: 0.06, hd: -0.24, tw: -0.05, ctw: -0.4, fFx: 0.52, fBx: -0.46, hF: 0.4, hB: 0.8, sy: -4 * PI, pv: 0.45, gx: 0.34, gy: 1.42, ga: -1.7, ox: 0.62, oy: 1.12, oa: 2.35 }),
  W4: P({ px: 0.12, py: 0.74, sp: 0.16, ch: 0.0, hd: -0.16, tw: 0.4, ctw: 0, fFx: 0.52, fBx: -0.44, hF: 0.5, hB: 0.6, sy: -4 * PI, pv: 0.45, gx: 0.3, gy: 1.72, ga: 2.2, ox: 0.24, oy: 1.68, oa: 2.5 }),
  C4: P({ px: 0.14, py: 0.66, sp: 0.36, ch: 0.08, hd: -0.26, tw: 0.45, ctw: 0.05, fFx: 0.54, fBx: -0.46, hF: 0.2, hB: 0.8, sy: -4 * PI, pv: 0.45, gx: 0.6, gy: 1.06, ga: -1.7, ox: 0.5, oy: 0.98, oa: -1.95 }),
  W5: P({ px: 0.12, py: 0.6, sp: 0.44, ch: 0.12, hd: -0.3, tw: 0.42, ctw: 0, fFx: 0.52, fBx: -0.48, kF: -0.15, kB: 0.45, hF: 0.4, hB: 0.7, sy: -4 * PI, pv: 0.45, gx: 0.3, gy: 1.3, ga: -1.9, ox: 0.26, oy: 1.24, oa: -1.3 }),
  C5: P({ px: 0.1, py: 0.6, sp: 0.4, ch: 0.1, hd: -0.2, tw: 0.15, ctw: -0.45, fFx: 0.5, fBx: -0.5, kF: -0.15, kB: 0.4, hF: 0.3, hB: 0.6, sy: -5 * PI, pv: 0.45, gx: 0.42, gy: 1.3, ga: -2.2, ox: -0.12, oy: 0.92, oa: PI - 0.12 }),
  Z0: P({ px: 0.08, py: 0.66, sp: 0.3, ch: 0.08, hd: -0.05, tw: 0.3, ctw: 0, fFx: 0.48, fBx: -0.46, kF: -0.12, kB: 0.35, hF: 0.2, hB: 0.5, sy: -5 * PI, pv: 0.45, gx: -0.1, gy: 0.86, ga: -2.4, ox: -0.14, oy: 0.88, oa: -2.2 }),
  K6: P({ px: 0.08, py: 0.67, sp: 0.28, ch: 0.08, hd: 0.08, tw: 0.3, ctw: 0, fFx: 0.48, fBx: -0.46, kF: -0.12, kB: 0.35, hF: 0.2, hB: 0.5, sy: -5 * PI, pv: 0.45, gx: -0.11, gy: 0.85, ga: -2.4, ox: -0.15, oy: 0.87, oa: -2.2, sh: 0.6 }),
  K7: P({ px: 0.08, py: 0.68, sp: 0.26, ch: 0.08, hd: 0.14, tw: 0.3, ctw: 0, fFx: 0.48, fBx: -0.46, kF: -0.12, kB: 0.35, hF: 0.2, hB: 0.5, sy: -5 * PI, pv: 0.45, gx: -0.12, gy: 0.84, ga: -2.4, ox: -0.16, oy: 0.86, oa: -2.2, sh: 1 }),
  Hz: P({ px: 0.08, py: 0.68, sp: 0.26, ch: 0.08, hd: 0.16, tw: 0.3, ctw: 0, fFx: 0.48, fBx: -0.46, kF: -0.12, kB: 0.35, hF: 0.2, hB: 0.5, sy: -5 * PI, pv: 0.45, gx: -0.12, gy: 0.84, ga: -2.4, ox: -0.16, oy: 0.86, oa: -2.2, sh: 1 }),
  R: P({ px: 0.04, py: 0.72, sy: -6 * PI, pv: 0.45, gx: 0.44, gy: 1.26, ox: 0.34, oy: 1.4 }),
};
const SPUN = P({ sy: -TAU }), SPUN2 = P({ sy: TAU }), SPUN6 = P({ sy: -6 * PI }), FALL_FLIP = { ...POSES.fall, rr: TAU };

// ---------------------------------------------------------------- absolute → relative blade angles (once, from the solved pose)
const af = (s, side) => (side === 'F' ? Math.atan2(s.handF[1] - s.elbowF[1], s.handF[0] - s.elbowF[0]) : Math.atan2(s.handB[1] - s.elbowB[1], s.handB[0] - s.elbowB[0]));
const mod = (a) => ((a % TAU) + TAU) % TAU;
/** reverse-grip wrist limit: the blade never comes closer than REL_MIN to the forearm line (that would read as a forward grip) */
export const REL_MIN = 0.95;
const wrist = (r) => (r < REL_MIN ? REL_MIN : r > TAU - REL_MIN ? TAU - REL_MIN : r);
/** convert a pose's authored absolute blade angles (pre-roll) to forearm-relative ones in [REL_MIN, 2π − REL_MIN] */
function toRel(p) { const s = solve(p), rr = p.rr || 0; p.ga = wrist(mod(p.ga - rr - af(s, 'F'))); p.oa = wrist(mod(p.oa - rr - af(s, 'B'))); }
const seen = new Set();
for (const p of [...Object.values(POSES), ...Object.values(F).flatMap((m) => Object.values(m)), ...Object.values(ULT), SPUN, SPUN2, SPUN6, FALL_FLIP]) if (!seen.has(p)) { seen.add(p); toRel(p); }

/** which segment strikes (strikeSeg): 0 lead blade · 1 rear blade · 4 lead knee · 5 rear knee · 'auto' = per key (`limb` tags) */
export const STRIKE = { a1: 0, a2: 1, a3: 5, a4: 'auto', air1: 0, air2: 0, s1: 0, s2: 1, ult: 'auto' };
/** the striking segment written into J.base / J.tip (rig units, J from solve / solveInto): blade = grip (fist centre) + dir · [base,
 *  tip] with dir = forearm angle + the relative blade angle; knee = thigh → past the kneecap (same as the Brawler) */
export function strikeSeg(J, p, limb, out = J) {
  if (limb === 4 || limb === 5) {
    const a = limb === 4 ? J.hipF : J.hipB, b = limb === 4 ? J.kneeF : J.kneeB;
    for (let i = 0; i < 3; i++) { const d = b[i] - a[i]; out.base[i] = a[i] + d * 0.68; out.tip[i] = a[i] + d * 1.14; }
    return out;
  }
  const h = limb === 1 ? J.handB : J.handF, e = limb === 1 ? J.elbowB : J.elbowF, rel = limb === 1 ? p.oa : p.ga;
  let fx = h[0] - e[0], fy = h[1] - e[1]; const fl = Math.sqrt(fx * fx + fy * fy) || 1; fx /= fl; fy /= fl;
  const a = Math.atan2(fy, fx) + rel, dx = Math.cos(a), dy = Math.sin(a), gx = h[0] + fx * DAGGER.grip, gy = h[1] + fy * DAGGER.grip;
  out.base[0] = gx + dx * DAGGER.base; out.base[1] = gy + dy * DAGGER.base; out.base[2] = h[2];
  out.tip[0] = gx + dx * DAGGER.tip; out.tip[1] = gy + dy * DAGGER.tip; out.tip[2] = h[2];
  return out;
}

/** keys for a move. FX cues ride on keys (several joined with '+'): stamp / slide / skid / ring / sink (as the other classes),
 *  exhale (kiai), zan (居合: the delayed cuts flash on the foe), click (the blades seat in the scabbards) */
export function moveKeys(key, m) {
  const t = m.t, f = F[key];
  switch (key) {
    case 'a1': return form(t, [['s', 0.55, f.A, 'coil'], ['a', 0, f.S, 'snap', 'slide+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a2': return form(t, [['s', 0.55, f.A, 'coil'], ['a', 0, f.S, 'snap', 'slide+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a3': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'stamp+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a4': { const k = form(t, [['s', 0.55, f.A, 'coil', 'sink'], ['a', 0, f.S, 'snap', 'exhale'], ['a', 0.5, f.M, 'hold', 'ring'], ['a', 1, f.E, 'outQuad'], ['r', 0.3, f.H, 'settle'], ['r', 0.82, f.H, 'hold'], ['x', 0.05, SPUN, 'inOutSine']]);
      for (const q of k) q.limb = q.p === f.M || q.p === f.E ? 1 : 0; return k; }
    case 'air1': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, POSES.fall, 'inOutSine']]);
    case 'air2': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'exhale'], ['a', 1, f.E, 'hold', 'ring'], ['r', 0.6, f.F, 'outSine'], ['x', 0.05, FALL_FLIP, 'inOutSine']]);
    case 's1': return form(t, [['s', 0.5, f.A, 'coil', 'skid'], ['a', 0, f.S, 'outQuad'], ['t', 0.1, f.S, 'hold'], ['t', 0.12, f.T1, 'snap'], ['t', 0.16, f.T2, 'inQuad'], ['t', 0.18, f.T2, 'hold'],
      ['t', 0.22, f.T1, 'inQuad'], ['t', 0.24, f.T3, 'snap', 'skid'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 's2': return form(t, [['s', 0.5, f.A, 'coil', 'sink'], ['t', 0.14, f.D, 'inQuad', 'slide'], ['t', 0.152, f.T, 'hold'], ['a', 0, f.S, 'snap', 'skid+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.3, f.E, 'hold'],
      ['r', 0.75, f.R, 'inOutSine'], ['x', 0.05, SPUN2, 'inOutSine']]);
    case 'ult': return ultKeys(m);
    default: return null;
  }
}
function ultKeys(m) {
  const [su, ac, rc] = m.t, n = m.multi || 8, dt = ac / n, T = su + ac + rc, k = [{ t: 0, p: 'from', limb: 0 }];
  const at = (i, o) => su + i * dt + o, push = (t, p, e, fx, limb) => k.push({ t, p, e, fx: fx || null, limb: limb ?? null });
  push(0.06, ULT.A, 'coil', 'sink', 0); push(0.1, ULT.V, 'inQuad', null, 0); push(0.12, ULT.W0, 'outQuad', 'stamp', 0);
  const C = [ULT.C0, ULT.C1, ULT.C2, ULT.C3, ULT.C4, ULT.C5], W = [null, ULT.W1, ULT.W2, ULT.W3, ULT.W4, ULT.W5];
  for (let i = 0; i < 6; i++) {
    const limb = i % 2;
    if (i) push(at(i, -dt * 0.45), W[i], i === 1 || i === 3 ? 'inQuad' : 'coil', null, limb);
    push(at(i, 0), C[i], 'snap', i === 0 ? 'exhale' : i === 5 ? 'skid+exhale' : i % 2 ? 'slide' : null, limb);
    push(at(i, dt * 0.25), C[i], 'hold', null, limb);
  }
  push(at(6, -dt * 0.5), ULT.Z0, 'inOutSine', null, 1);
  push(at(6, 0), ULT.K6, 'inOutSine', 'zan', 1);
  push(at(7, 0), ULT.K7, 'inQuad', 'zan+click', 1);
  push(su + ac + rc * 0.5, ULT.Hz, 'hold', null, 1);
  push(su + ac + rc * 0.92, ULT.R, 'inOutSine', null, 0); push(T + 0.06, SPUN6, 'inOutSine', null, 0);
  k.sort((a, b) => a.t - b.t);
  return k;
}
/** the key that lands on the first active frame (contact) — tests assert it sits exactly at startup */
export const contactPose = (key) => (key === 'ult' ? ULT.C0 : F[key] && F[key].S);
export const FORMS = { ...F, ult: ULT };
/** win: 血振り chiburi → 納刀 sheathe at the lower back → 印 seal */
export const winKeys = (Pz) => [{ t: 0, p: 'from' }, { t: 0.3, p: Pz.winA, e: 'coil' }, { t: 0.5, p: Pz.winB, e: 'snap' }, { t: 0.9, p: Pz.winB, e: 'hold' }, { t: 1.25, p: Pz.winC, e: 'inOutSine' },
  { t: 1.55, p: Pz.winD, e: 'inQuad' }, { t: 2.05, p: Pz.win, e: 'settle' }];
export const PROFILE = {
  id: 'assassin', stance: STANCE, poses: POSES, moveKeys, winKeys, airMoves: ['air1', 'air2'],
  step: { lift: 0.04, liftWalk: 0.05, durWalk: 0.18 },     // quick light steps
  lead: 0.024,                                             // power-chain lead (s): fast hands
  fist: true, strike: STRIKE, seg: strikeSeg,              // blades on time (6th link); contact segment = the striking blade / knee
  daggers: true, snapTurn: true, ghosts: true,             // twin kodachi + scabbards, teleports snap the facing, after-images
};
