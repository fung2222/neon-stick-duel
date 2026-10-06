// 劍士 SWORDSMAN — anime pilot: kenjutsu forms on the HQ rig. Pure data + clip builders (node-tested).
// Stances: SEIGAN (chūdan, two hands, hanmi, back heel raised as in kendo) · bow stance 弓步 (thrusts / lunge: front knee
// over the toes, back leg straight) · horse stance 馬步 (guard, rising-dragon coil, ult wind-up: knees splayed out).
// Every strike = anticipation (slow coil) → explosive contact (on the first active frame) → whip through → settle with a
// small overshoot → held zanshin → back to seigan; feet → hips → torso → arm → blade via evalChain().
// Combo (frame windows unchanged from classes.js): a1 抜き打ち draw cut · a2 逆袈裟 rising cut · a3 回転斬り spinning cut ·
// a4 昇り突き rising thrust (the launcher; held finish). air1 空斬 · air2 兜割り falling cleave. s1 疾風突刺 iai dash ·
// s2 昇龍斬 corkscrew rising cut. ult 千刃斬: a seven-cut kata ending in a held rising finish.
import { form } from './clip.js';

const A0 = 0.075, TAU = Math.PI * 2;
export const STANCE = {
  px: 0.02, py: 0.84, pt: 0.05, sp: 0.06, ch: 0.04, tw: 0.38, ctw: -0.12, hd: -0.06, rr: 0,
  fFx: 0.36, fFy: A0, fBx: -0.38, fBy: A0, aF: 0, aB: 0,
  gx: 0.34, gy: 1.06, ga: 0.42, gw: 0.1, ox: 0.2, oy: 1.0, oh: 1,
  sy: 0, pv: 0, hF: 0, hB: 0.4, kF: 0, kB: 0, sh: 0,
  cF1: 0, cF2: 0, cB1: 0, cB2: 0, oa: 0, fr: 0, fs: 0, gs: 0, zz: 0,   // Mage-only channels (finger curls, focus, sigil, blink) stay 0
};
const P = (o) => ({ ...STANCE, ...o });
const AIR = { py: 0.95, fFx: 0.22, fFy: 0.42, fBx: -0.12, fBy: 0.3, aF: 0.3, aB: -0.4, hB: 0 };
const SPUN = P({ sy: -TAU });   // seigan after a full turn (≡ STANCE; snapshots are normalised)
// iai coil: blade "in the saya" line (back-down along the left hip), off hand on the koiguchi, weight low
const IAI = { px: -0.06, py: 0.72, sp: 0.3, ch: 0.08, hd: -0.2, tw: -0.32, ctw: -0.32, fFx: 0.34, fBx: -0.46, hB: 0.8, gx: 0.06, gy: 0.88, ga: -0.28, gw: -2.9, oh: 0, ox: 0.07, oy: 0.86 };   // blade back along the far side (yaw), so the draw sweeps horizontally

export const POSES = {
  stance: STANCE,
  idle1: P({ py: 0.855, ch: 0.075, sp: 0.05, hd: -0.08, gy: 1.08, ga: 0.45 }),                 // breath in (chest rises, blade tip lifts)
  shuffle: P({ px: 0.08, fFx: 0.46, fBx: -0.3, py: 0.83, hB: 0.6 }),                         // suri-ashi: slide in, back foot follows
  walk: P({ py: 0.8, sp: 0.1, ch: 0.02, hd: -0.04, gx: 0.36, gy: 1.04, ga: 0.38, hB: 0.55 }),
  walkBack: P({ px: -0.04, py: 0.82, sp: 0.03, gx: 0.34, gy: 1.1, ga: 0.55, hB: 0.3 }),
  turn: P({ py: 0.86, sp: 0.08, tw: 0, ctw: 0, gx: 0.24, gy: 1.24, ga: 1.2, gw: 0, oh: 0.6, hF: 0.7, hB: 0.7 }),   // pivot on the balls of the feet
  guard: P({ px: -0.03, py: 0.76, sp: 0.02, ch: -0.02, tw: 0.6, ctw: 0, hd: 0.04, fFx: 0.44, fBx: -0.44, kB: 0.5, hB: 0, gx: 0.32, gy: 1.12, ga: 1.55, gw: 0.22, oh: 0, ox: 0.36, oy: 1.44 }),   // horse-ish, palm on the mune
  block: P({ px: -0.12, py: 0.72, sp: -0.05, ch: -0.18, tw: 0.5, ctw: 0, hd: 0.16, fFx: 0.4, fBx: -0.5, kB: 0.5, hB: 0, gx: 0.28, gy: 1.14, ga: 1.72, gw: 0.22, oh: 0, ox: 0.32, oy: 1.42 }),
  jump: P({ ...AIR, sp: 0.08, gx: 0.12, gy: 1.3, ga: 2.5, gw: -0.2, oh: 0, ox: -0.3, oy: 1.2 }),
  fall: P({ py: 0.95, fFx: 0.3, fFy: 0.2, fBx: -0.18, fBy: 0.12, aF: 0.15, aB: -0.3, hB: 0, gx: 0.36, gy: 1.2, ga: 0.9, oh: 0, ox: -0.3, oy: 1.15 }),
  land: P({ py: 0.64, sp: 0.36, ch: 0.12, hd: -0.2, fFx: 0.4, fBx: -0.38, kB: 0.35, hB: 0.6, gx: 0.5, gy: 0.88, ga: -0.3, gw: 0.3, oh: 0, ox: 0.32, oy: 0.36 }),   // three-point landing
  tuck: P({ py: 0.95, sp: 0.6, ch: 0.3, hd: 0.35, tw: 0, ctw: 0, fFx: 0.2, fFy: 0.72, fBx: 0.08, fBy: 0.62, aF: -0.3, aB: -0.3, hB: 0, gx: 0.3, gy: 1.0, ga: -2.6, gw: 0, oh: 0, ox: 0.26, oy: 1.0 }),
  dodge: P({ py: 0.6, sp: 0.6, ch: 0.25, hd: 0.3, tw: 0, ctw: 0, fFx: 0.25, fFy: 0.42, fBx: 0.05, fBy: 0.32, hB: 0, gx: 0.3, gy: 0.85, ga: -2.6, gw: 0, oh: 0, ox: 0.25, oy: 0.82 }),
  // directional hit reactions (scaled by hit strength in the animator)
  hitHigh: P({ px: -0.12, py: 0.86, hd: -0.7, ch: -0.35, sp: -0.15, tw: 0.1, ctw: -0.25, fBx: -0.46, hB: 0.6, gx: 0.15, gy: 1.35, ga: 1.8, gw: -0.2, oh: 0, ox: -0.35, oy: 1.45 }),
  hitMid: P({ px: -0.18, py: 0.78, hd: 0.4, ch: 0.1, sp: 0.4, tw: 0.25, ctw: 0.12, fBx: -0.46, gx: 0.28, gy: 0.95, ga: -0.4, gw: 0.3, oh: 0, ox: 0.15, oy: 1.0 }),
  hitBack: P({ px: 0.14, py: 0.82, hd: -0.4, sp: -0.2, ch: -0.3, tw: 0.3, fFx: 0.46, gx: 0.1, gy: 1.25, ga: 2.4, gw: -0.3, oh: 0, ox: -0.45, oy: 1.3 }),
  stagger: P({ px: -0.24, py: 0.74, hd: 0.35, ch: -0.3, sp: 0.12, tw: 0.7, ctw: 0.2, fBx: -0.56, kB: 0.4, hB: 0, gx: 0.08, gy: 1.25, ga: 2.2, gw: -0.4, oh: 0, ox: -0.5, oy: 1.45 }),
  airHit: P({ rr: -0.6, py: 0.95, sp: -0.22, ch: -0.2, hd: 0.32, fFx: 0.36, fFy: 0.38, fBx: 0.08, fBy: 0.18, aF: 0.4, aB: 0.2, hB: 0, gx: 0.1, gy: 1.62, ga: 2.3, oh: 0, ox: -0.46, oy: 1.62 }),
  spiked: P({ rr: 0.5, py: 0.95, sp: 0.35, ch: 0.2, hd: -0.4, fFx: 0.1, fFy: 0.15, fBx: -0.25, fBy: 0.3, hB: 0, gx: 0.3, gy: 1.7, ga: 2.2, oh: 0, ox: -0.2, oy: 1.75 }),
  down: P({ rr: -1.5, py: 0.02, px: 0, pt: 0, sp: -0.05, ch: 0, hd: 0.35, tw: 0.05, ctw: 0, fFx: 0.2, fFy: -0.74, fBx: 0, fBy: -0.8, aF: 0.6, aB: 0.6, hB: 0, gx: -0.3, gy: 1.3, ga: 2.8, gw: 0.4, oh: 0, ox: 0.3, oy: 1.35 }),
  downB: P({ rr: -1.32, py: 0.1, px: 0, pt: 0, sp: 0.05, ch: 0.05, hd: 0.2, tw: 0.05, ctw: 0, fFx: 0.3, fFy: -0.6, fBx: 0.1, fBy: -0.7, aF: 0.6, aB: 0.6, hB: 0, gx: -0.2, gy: 1.4, ga: 2.6, gw: 0.4, oh: 0, ox: 0.35, oy: 1.4 }),   // bounce
  ko: P({ rr: -1.52, py: 0.02, px: 0, pt: 0, sp: -0.08, ch: -0.05, hd: 0.5, tw: 0.1, ctw: 0, fFx: 0.3, fFy: -0.7, fBx: -0.05, fBy: -0.82, aF: 0.6, aB: 0.6, hB: 0, gx: -0.4, gy: 1.6, ga: 2.9, gw: 0.6, oh: 0, ox: 0.45, oy: 1.6 }),
  // tech roll (ukemi): backward roll over the shoulder → kneel → seigan
  rollB: P({ rr: -3.5, py: 0.5, sp: 0.62, ch: 0.3, hd: 0.45, tw: 0, ctw: 0, fFx: 0.22, fFy: 0.6, fBx: 0.12, fBy: 0.52, aF: -0.3, aB: -0.3, hB: 0, gx: 0.28, gy: 1.0, ga: 2.7, gw: 0, oh: 0, ox: 0.3, oy: 0.95 }),
  kneel: P({ rr: -TAU + 0.5, py: 0.5, sp: 0.35, ch: 0.12, hd: -0.3, fFx: 0.34, fFy: A0, fBx: -0.22, fBy: 0.1, hB: 0.9, kB: 0.2, gx: 0.42, gy: 0.82, ga: 0.3, oh: 0.6 }),
  stun: P({ py: 0.8, sp: -0.15, ch: -0.22, hd: 0.5, tw: 0.1, hB: 0, gx: 0.3, gy: 0.76, ga: -0.6, oh: 0, ox: -0.1, oy: 0.8 }),
  // win: chiburi (blood flick) → nōtō (sheathe) → zanshin
  win0: P({ py: 0.86, sp: 0.02, tw: 0.25, ctw: 0, gx: 0.28, gy: 1.42, ga: 1.25, gw: 0, oh: 0, ox: 0.08, oy: 0.88, hB: 0.2 }),
  chiburi: P({ py: 0.8, sp: 0.12, tw: 0.4, ctw: 0.25, hd: -0.12, gx: 0.6, gy: 0.98, ga: -0.55, gw: 0.25, oh: 0, ox: 0.08, oy: 0.88, hB: 0.3 }),
  noto0: P({ py: 0.86, sp: 0.06, tw: 0.2, ctw: -0.1, hd: -0.1, fFx: 0.3, fBx: -0.32, gx: 0.6, gy: 1.14, ga: -2.8, oh: 0, ox: 0.1, oy: 0.88, hB: 0.1, sh: 0 }),
  noto1: P({ py: 0.88, sp: 0.04, tw: 0.15, ctw: -0.12, hd: -0.08, fFx: 0.28, fBx: -0.3, gx: 0.14, gy: 0.98, ga: -2.8, oh: 0, ox: 0.1, oy: 0.9, hB: 0, sh: 1 }),
  win: P({ py: 0.9, sp: -0.02, ch: -0.04, tw: 0.12, ctw: -0.1, hd: -0.14, fFx: 0.22, fBx: -0.24, gx: 0.14, gy: 0.98, ga: -2.8, oh: 0, ox: 0.1, oy: 0.9, hB: 0, sh: 1 }),
};

// ------------------------------------------------------------------ attack forms
const F = {
  // 抜き打ち Draw cut: coil into iai (blade in the saya line, hand on the koiguchi, front foot lifts) → stamp in, hips open,
  // one-handed horizontal draw at chest height sweeping far → near side; off hand pulls the saya back (saya-biki)
  a1: {
    A: P({ ...IAI, fFy: 0.1, py: 0.76 }),
    S: P({ px: 0.1, py: 0.78, sp: 0.14, ch: 0.06, hd: -0.12, tw: 0.56, ctw: 0.05, fFx: 0.52, fBx: -0.4, hB: 0.7, gx: 0.62, gy: 1.2, ga: -0.05, gw: -0.35, oh: 0, ox: -0.12, oy: 0.9 }),
    E: P({ px: 0.12, py: 0.77, sp: 0.15, ch: 0.06, hd: -0.12, tw: 0.62, ctw: 0.3, fFx: 0.52, fBx: -0.4, hB: 0.7, gx: 0.56, gy: 1.16, ga: -0.12, gw: 0.75, oh: 0, ox: -0.16, oy: 0.92 }),
    F: P({ px: 0.1, py: 0.78, sp: 0.14, hd: -0.1, tw: 0.58, ctw: 0.38, fFx: 0.52, fBx: -0.4, hB: 0.6, gx: 0.46, gy: 1.1, ga: -0.2, gw: 1.05, oh: 0, ox: 0.16, oy: 1.34 }),   // off hand up: guarding palm
  },
  // 逆袈裟 Rising cut: drop the blade low behind (left hand joins), back foot slides up (tsugi-ashi), hips reverse → diagonal
  // rising cut, finishing high (jōdan) — flows into the spin
  a2: {
    A: P({ px: 0.06, py: 0.75, sp: 0.24, ch: 0.08, hd: -0.12, tw: 0.62, ctw: 0.25, fFx: 0.48, fBx: -0.4, hB: 0.5, gx: 0.3, gy: 0.72, ga: -2.5, gw: 0.35, oh: 0.6, ox: 0.1, oy: 0.9 }),
    S: P({ px: 0.12, py: 0.8, sp: 0.1, ch: 0.02, hd: -0.08, tw: 0.15, ctw: -0.15, fFx: 0.5, fBx: -0.3, hB: 0.6, gx: 0.56, gy: 1.0, ga: 0.3, gw: -0.1, oh: 0.75 }),
    E: P({ px: 0.12, py: 0.84, sp: 0.02, ch: -0.04, tw: 0.02, ctw: -0.22, fFx: 0.5, fBx: -0.3, hB: 0.6, gx: 0.52, gy: 1.22, ga: 0.78, gw: -0.2, oh: 0.65 }),
    F: P({ px: 0.1, py: 0.86, sp: -0.02, ch: -0.05, tw: -0.05, ctw: -0.3, fFx: 0.48, fBx: -0.32, hB: 0.5, gx: 0.24, gy: 1.72, ga: 2.0, gw: -0.3, oh: 0.5 }),
  },
  // 回転斬り Spinning cut: pivot on the ball of the front foot, turn the back (face toward the camera mid-turn), blade lags
  // then whips through horizontally at waist height, landing in a wide bow stance; follow-through to the near side
  a3: {
    A: P({ sy: -3.3, pv: 0.42, px: 0.06, py: 0.8, sp: 0.1, ch: 0.02, tw: 0.0, ctw: 0.2, fFx: 0.42, fBx: -0.12, fBy: 0.16, hF: 0.9, hB: 0, gx: 0.2, gy: 1.2, ga: -0.05, gw: -1.3, oh: 0, ox: 0.3, oy: 1.2 }),
    S: P({ sy: -TAU - 0.3, pv: 0.42, px: 0.14, py: 0.74, sp: 0.16, ch: 0.04, hd: -0.1, tw: 0.3, ctw: 0.1, fFx: 0.5, fBx: -0.5, hF: 0, hB: 0.6, gx: 0.62, gy: 1.1, ga: -0.04, gw: -0.3, oh: 0, ox: -0.25, oy: 1.05 }),
    E: P({ sy: -TAU - 0.5, pv: 0.42, px: 0.16, py: 0.74, sp: 0.16, hd: -0.1, tw: 0.4, ctw: 0.25, fFx: 0.5, fBx: -0.5, hB: 0.6, gx: 0.56, gy: 1.08, ga: -0.1, gw: 0.55, oh: 0, ox: -0.3, oy: 1.05 }),
    F: P({ sy: -TAU - 0.35, pv: 0.42, px: 0.14, py: 0.76, sp: 0.14, tw: 0.42, ctw: 0.3, fFx: 0.5, fBx: -0.5, hB: 0.5, gx: 0.46, gy: 1.08, ga: -0.15, gw: 0.85, oh: 0, ox: 0.14, oy: 1.3 }),   // off hand guards the centre line
    R: SPUN,
  },
  // 昇り突き Rising thrust (launcher): chamber at the right hip, front foot lifts → stamp into a deep bow stance, two-handed
  // thrust angled up, the blade keeps lifting (the launch) and the finish is HELD (zanshin)
  a4: {
    A: P({ px: -0.08, py: 0.74, sp: 0.2, ch: 0.06, hd: -0.15, tw: -0.3, ctw: -0.2, fFx: 0.32, fFy: 0.12, fBx: -0.44, hB: 0.7, gx: 0.0, gy: 1.04, ga: 0.12, gw: 0, oh: 0.95 }),
    S: P({ px: 0.16, py: 0.72, sp: 0.14, ch: 0.02, hd: -0.18, tw: 0.25, ctw: 0.05, fFx: 0.6, fBx: -0.6, hB: 0, gx: 0.78, gy: 1.14, ga: 0.3, gw: 0, oh: 0.9 }),
    E: P({ px: 0.17, py: 0.76, sp: 0.06, ch: -0.06, hd: -0.05, tw: 0.3, ctw: 0.05, fFx: 0.6, fBx: -0.6, hB: 0, gx: 0.74, gy: 1.42, ga: 0.85, gw: 0, oh: 0.8 }),
    F: P({ px: 0.16, py: 0.8, sp: 0.02, ch: -0.08, hd: -0.02, tw: 0.32, ctw: 0.08, fFx: 0.6, fBx: -0.6, hB: 0, gx: 0.62, gy: 1.6, ga: 1.2, gw: 0.1, oh: 0.7 }),
    H: P({ px: 0.15, py: 0.79, sp: 0.03, ch: -0.06, hd: -0.03, tw: 0.32, ctw: 0.06, fFx: 0.6, fBx: -0.6, hB: 0, gx: 0.6, gy: 1.57, ga: 1.18, gw: 0.1, oh: 0.7 }),
  },
  air1: {
    A: P({ ...AIR, sp: -0.05, tw: -0.1, ctw: -0.3, gx: 0.04, gy: 1.7, ga: 2.5, gw: -0.3, oh: 0, ox: 0.15, oy: 1.25 }),
    S: P({ ...AIR, sp: 0.22, tw: 0.45, ctw: 0.1, gx: 0.58, gy: 1.18, ga: -0.1, gw: 0.1, oh: 0, ox: -0.3, oy: 1.1 }),
    E: P({ ...AIR, sp: 0.3, tw: 0.5, ctw: 0.3, gx: 0.48, gy: 0.84, ga: -0.85, gw: 0.3, oh: 0, ox: -0.32, oy: 1.1 }),
    F: P({ ...AIR, sp: 0.3, tw: 0.45, ctw: 0.3, gx: 0.34, gy: 0.76, ga: -1.2, gw: 0.35, oh: 0, ox: 0.14, oy: 1.44 }),   // off hand guards high
  },
  // 兜割り Falling cleave: two-handed jōdan overhead, the body rolls forward into a vertical chop
  air2: {
    A: P({ ...AIR, rr: -0.3, sp: -0.12, ch: -0.12, tw: 0, ctw: -0.1, gx: -0.1, gy: 1.86, ga: 2.8, gw: 0, oh: 0.85 }),
    S: P({ ...AIR, rr: 0.25, sp: 0.32, ch: 0.1, tw: 0.3, ctw: 0.1, gx: 0.56, gy: 1.04, ga: -0.45, gw: 0, oh: 0.75 }),
    E: P({ ...AIR, rr: 0.4, sp: 0.42, ch: 0.12, tw: 0.3, ctw: 0.12, gx: 0.46, gy: 0.62, ga: -1.25, gw: 0, oh: 0.6 }),
    F: P({ ...AIR, rr: 0.32, sp: 0.36, tw: 0.3, gx: 0.36, gy: 0.56, ga: -1.45, gw: 0, oh: 0.3 }),
  },
  // 疾風突刺 Gale Lunge: deep iai crouch, held for a beat (slow) → explosive one-handed draw-thrust in a flying bow stance,
  // the extension is held through the dash, then a braking skid
  s1: {
    A: P({ ...IAI, py: 0.66, sp: 0.42, hd: -0.3, tw: -0.4, ctw: -0.3, fFx: 0.42, fBx: -0.5, hB: 0.9 }),
    A2: P({ ...IAI, py: 0.64, sp: 0.44, hd: -0.32, tw: -0.42, ctw: -0.32, fFx: 0.42, fBx: -0.5, hB: 0.95 }),
    S: P({ px: 0.22, py: 0.66, sp: 0.5, ch: 0.12, hd: -0.5, tw: 0.6, ctw: 0.15, fFx: 0.72, fBx: -0.7, aB: -0.3, hB: 0.9, gx: 0.8, gy: 1.1, ga: -0.02, gw: 0.1, oh: 0, ox: -0.45, oy: 0.94 }),
    E: P({ px: 0.23, py: 0.66, sp: 0.52, ch: 0.12, hd: -0.52, tw: 0.62, ctw: 0.16, fFx: 0.72, fBx: -0.7, aB: -0.3, hB: 0.9, gx: 0.84, gy: 1.1, ga: -0.02, gw: 0.25, oh: 0, ox: -0.47, oy: 0.94 }),
    F: P({ px: 0.12, py: 0.7, sp: 0.36, hd: -0.3, tw: 0.5, ctw: 0.1, fFx: 0.64, fBx: -0.55, hB: 0.6, gx: 0.6, gy: 1.02, ga: -0.2, gw: 0.6, oh: 0, ox: 0.12, oy: 1.26 }),   // braking skid, guard palm up
  },
  // 昇龍斬 Rising Dragon: horse-stance coil (knees out, blade low behind) → corkscrew rising cut, one full turn in the air
  s2: {
    A: P({ px: 0, py: 0.66, sp: 0.3, ch: 0.1, hd: -0.2, tw: 0.7, ctw: -0.3, fFx: 0.44, fBx: -0.44, kF: -0.2, kB: 0.7, hB: 0, gx: 0.12, gy: 0.62, ga: -2.6, gw: -0.2, oh: 0.85 }),
    S: P({ pv: 0.3, py: 0.92, sp: 0.06, tw: 0.5, ctw: 0.2, fFx: 0.3, fFy: 0.32, fBx: -0.2, aF: 0.3, hB: 0, gx: 0.52, gy: 1.16, ga: 0.85, gw: 0.2, oh: 0.6 }),
    M: P({ sy: -Math.PI, pv: 0.3, py: 1.0, sp: 0.02, tw: 0.5, fFx: 0.26, fFy: 0.5, fBx: -0.08, fBy: 0.3, aF: 0.3, aB: -0.3, hB: 0, gx: 0.36, gy: 1.75, ga: 1.5, gw: 0.1, oh: 0.4 }),
    E: P({ sy: -TAU, pv: 0.3, py: 1.0, sp: -0.15, ch: -0.1, hd: 0.25, tw: 0.6, ctw: 0.3, fFx: 0.28, fFy: 0.5, fBx: -0.05, fBy: 0.22, aF: 0.4, aB: -0.4, hB: 0, gx: 0.25, gy: 2.0, ga: 1.65, gw: 0.1, oh: 0.3 }),
    F: P({ sy: -TAU, pv: 0.3, py: 0.98, sp: -0.1, ch: -0.08, hd: 0.2, tw: 0.5, ctw: 0.25, fFx: 0.28, fFy: 0.42, fBx: -0.1, fBy: 0.22, hB: 0, gx: 0.2, gy: 1.95, ga: 1.95, gw: 0.1, oh: 0 }),
  },
};
// 千刃斬 Thousand Edges kata: draw cut → kesa → gyaku-kesa → spin → thrust → overhead (karatake-wari) → held rising finish
const K = TAU;
const ULT = {
  A: P({ ...IAI, py: 0.66, kB: 0.4 }),
  W1: P({ px: 0.08, py: 0.82, tw: 0.2, ctw: -0.3, gx: 0.1, gy: 1.75, ga: 2.3, gw: -0.3, oh: 0.6 }),
  C1: P({ px: 0.12, py: 0.78, sp: 0.18, tw: 0.55, ctw: 0.1, fFx: 0.5, gx: 0.6, gy: 1.3, ga: -0.3, gw: 0.1, oh: 0.7 }),
  E1: P({ px: 0.12, py: 0.76, sp: 0.22, tw: 0.6, ctw: 0.25, fFx: 0.5, gx: 0.45, gy: 0.9, ga: -0.95, gw: 0.3, oh: 0.5 }),
  W3: P({ sy: -3.3, pv: 0.42, px: 0.06, py: 0.8, tw: 0, ctw: 0.2, fFx: 0.42, fBx: -0.12, fBy: 0.16, hF: 0.9, hB: 0, gx: 0.2, gy: 1.2, ga: -0.05, gw: -1.3, oh: 0, ox: 0.3, oy: 1.2 }),
  W4: P({ sy: -K, px: -0.04, py: 0.74, sp: 0.2, tw: -0.3, ctw: -0.2, fFx: 0.34, fBx: -0.46, gx: 0.0, gy: 1.04, ga: 0.12, gw: 0, oh: 0.95 }),
  W5: P({ sy: -K, py: 0.84, sp: -0.1, ch: -0.12, tw: 0.1, ctw: -0.1, gx: -0.05, gy: 1.9, ga: 2.7, gw: 0, oh: 0.9 }),
  C5: P({ sy: -K, px: 0.14, py: 0.72, sp: 0.3, ch: 0.1, hd: -0.15, tw: 0.3, fFx: 0.56, fBx: -0.52, hB: 0, gx: 0.6, gy: 1.15, ga: -0.4, gw: 0, oh: 0.8 }),
  E5: P({ sy: -K, px: 0.14, py: 0.7, sp: 0.36, tw: 0.3, fFx: 0.56, fBx: -0.52, hB: 0, gx: 0.5, gy: 0.75, ga: -1.2, gw: 0, oh: 0.7 }),
  W6: P({ sy: -K, py: 0.66, sp: 0.3, ch: 0.1, tw: 0.7, ctw: -0.3, fFx: 0.44, fBx: -0.44, kF: -0.2, kB: 0.7, hB: 0, gx: 0.15, gy: 0.6, ga: -2.7, gw: -0.2, oh: 0.85 }),
  C6: P({ sy: -K, px: 0.06, py: 0.84, sp: 0.06, tw: 0.4, ctw: 0.1, fFx: 0.46, fBx: -0.4, gx: 0.55, gy: 1.0, ga: 0.5, gw: 0.1, oh: 0.7 }),
  E6: P({ sy: -K, px: 0.06, py: 0.97, sp: -0.12, ch: -0.12, hd: 0.15, tw: 0.5, ctw: 0.2, fFx: 0.42, fBx: -0.38, hF: 0.5, hB: 0.6, gx: 0.34, gy: 2.0, ga: 1.62, gw: 0.1, oh: 0.4 }),
  Fz: P({ sy: -K, px: 0.05, py: 0.95, sp: -0.1, ch: -0.1, hd: 0.08, tw: 0.5, ctw: 0.2, fFx: 0.42, fBx: -0.38, hF: 0.3, hB: 0.5, gx: 0.26, gy: 2.0, ga: 1.78, gw: 0.1, oh: 0.2 }),
};
const shift = (p, sy) => ({ ...p, sy: (p.sy || 0) + sy });

/** keys for a move. FX cues ride on keys: stamp (dust + ground ring at the front foot), slide (dust at the back foot),
 *  ring (air ring around the body), skid (braking dust), sink (dropping into horse stance: smaller dust ring under the body). */
export function moveKeys(key, m) {
  const t = m.t, f = F[key];
  switch (key) {
    case 'a1': return form(t, [['s', 0.55, f.A, 'coil'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.75, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a2': return form(t, [['s', 0.55, f.A, 'coil'], ['a', 0, f.S, 'snap', 'slide'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.75, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a3': return form(t, [['s', 0.5, f.A, 'inQuad'], ['a', 0, f.S, 'outQuad', 'stamp'], ['a', 1, f.E, 'whip', 'ring'], ['r', 0.45, f.F, 'settle'], ['r', 0.7, f.F, 'hold'], ['x', 0.05, f.R, 'inOutSine']]);
    case 'a4': return form(t, [['s', 0.55, f.A, 'coil'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 1, f.E, 'outQuad', 'ring'], ['r', 0.3, f.F, 'settle'], ['r', 0.82, f.H, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'air1': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, POSES.fall, 'inOutSine']]);
    case 'air2': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap'], ['a', 1, f.E, 'whip', 'ring'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, POSES.fall, 'inOutSine']]);
    case 's1': return form(t, [['s', 0.5, f.A, 'coil'], ['s', 0.86, f.A2, 'hold'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 0.12, f.S, 'hold', 'ring'], ['a', 1, f.E, 'hold'], ['r', 0.4, f.F, 'settle', 'skid'], ['r', 0.7, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 's2': return form(t, [['s', 0.6, f.A, 'coil', 'sink'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 0.5, f.M, 'lin', 'ring'], ['a', 1, f.E, 'outQuad'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, SPUN, 'inOutSine']]);
    case 'ult': return ultKeys(m);
    default: return null;
  }
}
function ultKeys(m) {
  const [su, ac, rc] = m.t, n = m.multi || 7, dt = ac / n, T = su + ac + rc, k = [{ t: 0, p: 'from' }];
  const at = (i, o) => su + i * dt + o, push = (t, p, e, fx) => k.push({ t, p, e, fx: fx || null });
  const a1 = F.a1, a2 = F.a2, a3 = F.a3, a4 = F.a4;
  push(su * 0.6, ULT.A, 'coil');
  push(at(0, 0), a1.S, 'snap', 'stamp'); push(at(0, dt * 0.55), a1.E, 'whip');
  push(at(1, -dt * 0.35), ULT.W1, 'coil'); push(at(1, 0), ULT.C1, 'snap'); push(at(1, dt * 0.55), ULT.E1, 'whip');
  push(at(2, -dt * 0.35), a2.A, 'coil'); push(at(2, 0), a2.S, 'snap', 'slide'); push(at(2, dt * 0.55), a2.E, 'whip');
  push(at(3, -dt * 0.45), ULT.W3, 'inQuad'); push(at(3, 0), a3.S, 'outQuad', 'ring'); push(at(3, dt * 0.55), a3.E, 'whip');
  push(at(4, -dt * 0.35), ULT.W4, 'coil'); push(at(4, 0), shift(a4.S, -K), 'snap', 'stamp'); push(at(4, dt * 0.55), shift(a4.E, -K), 'whip');
  push(at(5, -dt * 0.35), ULT.W5, 'coil'); push(at(5, 0), ULT.C5, 'snap', 'stamp'); push(at(5, dt * 0.55), ULT.E5, 'whip');
  push(at(6, -dt * 0.4), ULT.W6, 'coil', 'sink'); push(at(6, 0), ULT.C6, 'snap', 'ring'); push(su + ac, ULT.E6, 'outQuad');
  push(su + ac + rc * 0.3, ULT.Fz, 'settle'); push(su + ac + rc * 0.85, ULT.Fz, 'hold'); push(T + 0.05, SPUN, 'inOutSine');
  k.sort((a, b) => a.t - b.t);
  return k;
}
/** the key that lands on the first active frame (contact) — tests assert it sits exactly at startup */
export const contactPose = (key) => (key === 'ult' ? F.a1.S : F[key] && F[key].S);
export const FORMS = F;
export const PROFILE = {
  id: 'sword', stance: STANCE, poses: POSES, moveKeys, airMoves: ['air1', 'air2'],
  step: { lift: 0.04, liftWalk: 0.045, durWalk: 0.2 },   // suri-ashi: low sliding steps
  lead: 0.028,                                             // power-chain lead (s)
};
