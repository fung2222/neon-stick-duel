// 塔主・零 KAGE-SHŌGUN — boss forms on the HQ rig (HANDOFF §16 steps 2–3). Pure data + clip builders (node-tested:
// tests/anime-shogun.test.mjs). The body is js/anime/shogun-body.js; the interim look (js/anime/shogun-interim.js) stays as
// the fallback.
//
// Phase 1 秩序 ORDER — slow, perfect kenjutsu. SEIGAN held steep (the nodachi is 1.7× the Swordsman's katana, so the point
// rides above the foe's head instead of at the throat), feet in a long hanmi, breathing slow. Every strike is a long, still
// coil → one explosive cut on the first active frame → held zanshin. 居合裁き: the coil sinks into the iai crouch, the hand
// settles on the tsuka, the thumb pushes the koiguchi at the flash (the "tell"), then a one-handed screen-wide draw.
// 十歩詰め: suri-ashi (low sliding steps) between three cuts: kesa → gyaku-kesa → karatake from jōdan. 鏡受け: perfectly still,
// the blade vertical with its flat to the foe.
// Phase 2 崩壞 COLLAPSE — JŌDAN as the idle, the body glitches: the startup time stutters in bursts (never on the contact
// frame), a deterministic jitter + red after-images on idle / walk, and six data blades fanned behind the back that launch
// on the Data-Blade Rain fire frame and fall exactly where the sim's markers drop.
// Transition (sim st 'phase', 1.2 s): recoil (the off hand flies to the mask as it cracks) → hunched convulsion with the
// point dragging → the arms spread as the six blades unfold → rise into jōdan and hold.
import { form, evalA, wrapA } from './clip.js';
import { POSES as SW } from './sword.js';
import { NODACHI_K, SAYA, MASK } from './shogun-body.js';

const A0 = 0.075, TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const STANCE = {
  px: 0.0, py: 0.82, pt: 0.05, sp: 0.05, ch: 0.05, tw: 0.4, ctw: -0.12, hd: -0.05, rr: 0,
  fFx: 0.42, fFy: A0, fBx: -0.44, fBy: A0, aF: 0, aB: 0,
  gx: 0.3, gy: 1.04, ga: 0.92, gw: 0.06, ox: 0.2, oy: 1.0, oh: 1,
  sy: 0, pv: 0, hF: 0, hB: 0.3, kF: 0, kB: 0, sh: 0,
  cF1: 0, cF2: 0, cB1: 0, cB2: 0, oa: 0, fr: 0, fs: 0, gs: 0, zz: 0,
};
const P = (o) => ({ ...STANCE, ...o });
const SPUN = P({ sy: -TAU });
// 上段 jōdan: both hands above the forehead, the nodachi laid back over the head (phase-2 idle, the karatake wind-up)
const JODAN = P({ px: -0.03, py: 0.8, sp: -0.06, ch: -0.1, tw: 0.16, ctw: -0.1, hd: 0.0, fFx: 0.44, fBx: -0.46, hB: 0.35, gx: -0.02, gy: 1.9, ga: 2.75, gw: 0, oh: 0.9 });
// 八相 hassō: hands at the right cheek, blade upright and tipped back (kesa wind-up)
const HASSO = P({ px: -0.06, py: 0.8, sp: 0.0, ch: -0.04, tw: -0.1, ctw: -0.22, hd: -0.02, fFx: 0.4, fFy: 0.11, fBx: -0.46, hB: 0.25, gx: 0.06, gy: 1.72, ga: 2.05, gw: -0.15, oh: 0.95 });
// iai coil: blade still "in the saya" line (back-down along the left hip, via yaw), right hand on the tsuka at the koiguchi,
// left hand on the saya, weight sunk low over a long front leg
const IAI = { px: -0.08, py: 0.68, sp: 0.36, ch: 0.08, hd: -0.26, tw: -0.42, ctw: -0.34, fFx: 0.48, fBx: -0.56, hB: 0.85, gx: 0.04, gy: 0.86, ga: -0.3, gw: -2.9, oh: 0, ox: 0.05, oy: 0.84 };

export const POSES = {
  ...SW,
  stance: STANCE,
  idle1: P({ py: 0.835, ch: 0.08, sp: 0.04, hd: -0.07, gy: 1.06, ga: 0.95 }),                  // slow breath: chest rises, the point lifts
  shuffle: P({ px: 0.06, fFx: 0.52, fBx: -0.36, py: 0.8, hB: 0.5 }),                          // suri-ashi in, back foot follows
  walk: P({ py: 0.79, sp: 0.08, ch: 0.03, gx: 0.32, gy: 1.02, ga: 0.86, hB: 0.45 }),
  walkBack: P({ px: -0.04, py: 0.81, sp: 0.03, gx: 0.28, gy: 1.08, ga: 1.02, hB: 0.25 }),
  turn: P({ py: 0.84, sp: 0.06, tw: 0, ctw: 0, gx: 0.2, gy: 1.3, ga: 1.45, gw: 0, oh: 0.6, hF: 0.6, hB: 0.6 }),
  guard: P({ px: -0.04, py: 0.75, sp: 0.02, ch: -0.02, tw: 0.62, ctw: 0, hd: 0.04, fFx: 0.46, fBx: -0.48, kB: 0.5, hB: 0, gx: 0.3, gy: 1.12, ga: 1.5, gw: 0.25, oh: 0, ox: 0.34, oy: 1.46 }),
  block: P({ px: -0.1, py: 0.72, sp: -0.04, ch: -0.16, tw: 0.52, ctw: 0, hd: 0.14, fFx: 0.42, fBx: -0.52, kB: 0.5, hB: 0, gx: 0.27, gy: 1.14, ga: 1.66, gw: 0.25, oh: 0, ox: 0.3, oy: 1.44 }),
  land: P({ py: 0.66, sp: 0.3, ch: 0.1, hd: -0.18, fFx: 0.44, fBx: -0.42, kB: 0.35, hB: 0.6, gx: 0.42, gy: 0.96, ga: -0.2, gw: 0.3, oh: 0, ox: 0.3, oy: 0.5 }),
  jodan: JODAN,
  jodan1: P({ ...JODAN, py: 0.815, ch: -0.07, gy: 1.93, ga: 2.7 }),                            // phase-2 breath (shallow, fast)
  walk2: P({ ...JODAN, py: 0.78, sp: 0.02, ch: -0.06, hB: 0.5 }),
  walkBack2: P({ ...JODAN, px: -0.06, py: 0.8, hB: 0.3 }),
  hasso: HASSO,
  // win (boss): chiburi → nōtō along the long saya → zanshin (the fighter's default win clip uses these names)
  win0: P({ py: 0.84, sp: 0.02, tw: 0.25, ctw: 0, gx: 0.26, gy: 1.42, ga: 1.3, gw: 0, oh: 0, ox: 0.08, oy: 0.88, hB: 0.2 }),
  chiburi: P({ py: 0.78, sp: 0.12, tw: 0.42, ctw: 0.25, hd: -0.12, gx: 0.6, gy: 1.04, ga: -0.45, gw: 0.25, oh: 0, ox: 0.08, oy: 0.88, hB: 0.3 }),
  noto0: P({ py: 0.84, sp: 0.06, tw: 0.2, ctw: -0.1, hd: -0.1, fFx: 0.32, fBx: -0.34, gx: 0.66, gy: 1.2, ga: -2.75, oh: 0, ox: 0.1, oy: 0.88, hB: 0.1, sh: 0 }),
  noto1: P({ py: 0.86, sp: 0.04, tw: 0.15, ctw: -0.12, hd: -0.08, fFx: 0.3, fBx: -0.32, gx: 0.14, gy: 0.98, ga: -2.75, oh: 0, ox: 0.1, oy: 0.9, hB: 0, sh: 1 }),
  win: P({ py: 0.88, sp: -0.02, ch: -0.04, tw: 0.12, ctw: -0.1, hd: -0.14, fFx: 0.24, fBx: -0.26, gx: 0.14, gy: 0.98, ga: -2.75, oh: 0, ox: 0.1, oy: 0.9, hB: 0, sh: 1 }),
};

// ------------------------------------------------------------------ attack forms (A = wind-up, S = contact = first active
// frame, E = end of the active window, F = follow-through / zanshin). Contact poses keep the hands close and the long blade
// steep so the point lands at the hitbox edge (nodachi reach = the sim's box; tests check every active frame).
const F = {
  // 袈裟斬り Kesa: rise into hassō on a lifted front foot (slow) → stamp, hips open, the blade falls on the diagonal from the
  // right shoulder; whips through low-left (waki), off hand rises to guard the centre line
  a1: {
    A: HASSO,
    S: P({ px: 0.08, py: 0.78, sp: 0.16, ch: 0.06, hd: -0.12, tw: 0.5, ctw: 0.12, fFx: 0.54, fBx: -0.42, hB: 0.6, gx: 0.36, gy: 1.52, ga: -0.92, gw: 0.04, oh: 0.85 }),
    E: P({ px: 0.1, py: 0.76, sp: 0.22, ch: 0.08, hd: -0.14, tw: 0.6, ctw: 0.26, fFx: 0.54, fBx: -0.42, hB: 0.6, gx: 0.36, gy: 1.3, ga: -1.0, gw: 0.12, oh: 0.6 }),
    F: P({ px: 0.08, py: 0.76, sp: 0.2, ch: 0.04, hd: -0.12, tw: 0.62, ctw: 0.36, fFx: 0.54, fBx: -0.42, hB: 0.5, gx: 0.26, gy: 1.2, ga: -0.6, gw: -1.5, oh: 0, ox: 0.2, oy: 1.4 }),
  },
  // 逆袈裟 Gyaku-kesa: the blade drops low behind (the left hand joins), back foot slides up (tsugi-ashi) → rising diagonal,
  // finishing high in hassō (flows into the split)
  a2: {
    A: P({ px: 0.04, py: 0.74, sp: 0.26, ch: 0.08, hd: -0.12, tw: 0.66, ctw: 0.3, fFx: 0.5, fBx: -0.42, hB: 0.5, gx: 0.04, gy: 0.98, ga: -0.42, gw: -2.6, oh: 0.7 }),
    S: P({ px: 0.1, py: 0.8, sp: 0.1, ch: 0.02, hd: -0.08, tw: 0.18, ctw: -0.14, fFx: 0.52, fBx: -0.32, hB: 0.55, gx: 0.22, gy: 0.88, ga: 0.68, gw: -0.08, oh: 0.8 }),
    E: P({ px: 0.1, py: 0.82, sp: 0.04, ch: -0.02, tw: 0.04, ctw: -0.22, fFx: 0.52, fBx: -0.32, hB: 0.55, gx: 0.24, gy: 0.94, ga: 0.95, gw: -0.16, oh: 0.7 }),
    F: P({ px: 0.06, py: 0.84, sp: -0.02, ch: -0.05, tw: -0.04, ctw: -0.26, fFx: 0.5, fBx: -0.34, hB: 0.45, gx: 0.08, gy: 1.7, ga: 2.1, gw: -0.2, oh: 0.85 }),
  },
  // 唐竹割り Karatake-wari: jōdan held on the toes (a beat of stillness) → the vertical split, both hands, deep stamp; the point
  // stops a hand above the floor; settle into gedan and hold
  a3: {
    A: P({ ...JODAN, py: 0.86, hB: 0.6, gy: 1.96, ga: 2.6 }),
    S: P({ px: 0.12, py: 0.74, sp: 0.3, ch: 0.1, hd: -0.16, tw: 0.3, ctw: 0.04, fFx: 0.58, fBx: -0.54, hB: 0, gx: 0.34, gy: 1.6, ga: -1.0, gw: 0, oh: 0.9 }),
    E: P({ px: 0.13, py: 0.7, sp: 0.38, ch: 0.12, hd: -0.2, tw: 0.3, ctw: 0.06, fFx: 0.58, fBx: -0.54, hB: 0, gx: 0.34, gy: 1.4, ga: -1.15, gw: 0, oh: 0.85 }),
    F: P({ px: 0.12, py: 0.7, sp: 0.36, ch: 0.1, hd: -0.18, tw: 0.32, ctw: 0.06, fFx: 0.58, fBx: -0.54, hB: 0, gx: 0.38, gy: 1.06, ga: -0.62, gw: 0, oh: 0.85 }),
  },
  // 居合裁き Iai Judgement: sink into the iai crouch (slow), held; the thumb breaks the koiguchi at the flash; one-handed
  // horizontal draw at hip height across the whole screen, saya pulled back (saya-biki); long held zanshin, arm extended
  iai: {
    A: P({ ...IAI }),
    A2: P({ ...IAI, py: 0.66, sp: 0.4, hd: -0.3, gx: 0.07, gy: 0.87, ox: 0.02, oy: 0.83 }),   // koiguchi o kiru (the tell)
    S: P({ px: 0.2, py: 0.66, sp: 0.42, ch: 0.1, hd: -0.38, tw: 0.62, ctw: 0.1, fFx: 0.74, fBx: -0.7, aB: -0.3, hB: 0.9, gx: 0.66, gy: 0.84, ga: -0.1, gw: -0.3, oh: 0, ox: -0.3, oy: 0.84 }),
    E: P({ px: 0.22, py: 0.66, sp: 0.44, ch: 0.1, hd: -0.4, tw: 0.66, ctw: 0.32, fFx: 0.74, fBx: -0.7, aB: -0.3, hB: 0.9, gx: 0.62, gy: 0.82, ga: -0.12, gw: 0.65, oh: 0, ox: -0.36, oy: 0.86 }),
    F: P({ px: 0.18, py: 0.68, sp: 0.36, ch: 0.06, hd: -0.3, tw: 0.62, ctw: 0.42, fFx: 0.74, fBx: -0.7, aB: -0.2, hB: 0.8, gx: 0.5, gy: 0.92, ga: -0.08, gw: 1.25, oh: 0, ox: -0.38, oy: 0.88 }),
  },
  // 十歩詰め Ten-Step: suri-ashi in a low stance between three cuts (kesa → gyaku-kesa → karatake)
  ten1: {
    A: P({ ...HASSO, py: 0.76, sp: 0.1, fFy: A0 }),
    S: P({ px: 0.1, py: 0.74, sp: 0.22, ch: 0.06, hd: -0.14, tw: 0.5, ctw: 0.12, fFx: 0.56, fBx: -0.46, hB: 0.6, gx: 0.38, gy: 1.48, ga: -0.92, gw: 0.04, oh: 0.85 }),
    E: P({ px: 0.12, py: 0.72, sp: 0.28, ch: 0.08, hd: -0.16, tw: 0.6, ctw: 0.26, fFx: 0.56, fBx: -0.46, hB: 0.6, gx: 0.38, gy: 1.3, ga: -1.0, gw: 0.12, oh: 0.6 }),
    F: P({ px: 0.08, py: 0.72, sp: 0.26, ch: 0.06, hd: -0.14, tw: 0.62, ctw: 0.32, fFx: 0.56, fBx: -0.46, hB: 0.6, gx: 0.22, gy: 1.18, ga: -0.8, gw: -0.9, oh: 0.6 }),
  },
  ten2: {
    A: P({ px: 0.04, py: 0.72, sp: 0.28, ch: 0.08, hd: -0.14, tw: 0.66, ctw: 0.3, fFx: 0.52, fBx: -0.46, hB: 0.6, gx: 0.04, gy: 0.98, ga: -0.42, gw: -2.6, oh: 0.75 }),
    S: P({ px: 0.12, py: 0.76, sp: 0.14, ch: 0.04, hd: -0.1, tw: 0.2, ctw: -0.14, fFx: 0.56, fBx: -0.36, hB: 0.6, gx: 0.22, gy: 0.84, ga: 0.68, gw: -0.08, oh: 0.8 }),
    E: P({ px: 0.12, py: 0.78, sp: 0.08, ch: 0.0, tw: 0.06, ctw: -0.22, fFx: 0.56, fBx: -0.36, hB: 0.6, gx: 0.24, gy: 0.9, ga: 0.92, gw: -0.16, oh: 0.7 }),
    F: P({ px: 0.06, py: 0.8, sp: 0.0, ch: -0.06, tw: 0.08, ctw: -0.16, fFx: 0.54, fBx: -0.4, hB: 0.5, gx: -0.02, gy: 1.86, ga: 2.6, gw: 0, oh: 0.9 }),   // straight up into jōdan
  },
  ten3: {
    A: P({ ...JODAN, py: 0.84, hB: 0.6, gy: 1.98, ga: 2.62 }),
    S: P({ px: 0.14, py: 0.72, sp: 0.32, ch: 0.1, hd: -0.18, tw: 0.32, ctw: 0.04, fFx: 0.62, fBx: -0.58, hB: 0, gx: 0.36, gy: 1.6, ga: -0.96, gw: 0, oh: 0.9 }),
    E: P({ px: 0.15, py: 0.68, sp: 0.4, ch: 0.12, hd: -0.22, tw: 0.32, ctw: 0.06, fFx: 0.62, fBx: -0.58, hB: 0, gx: 0.36, gy: 1.4, ga: -1.12, gw: 0, oh: 0.85 }),
    F: P({ px: 0.14, py: 0.68, sp: 0.38, ch: 0.1, hd: -0.2, tw: 0.34, ctw: 0.06, fFx: 0.62, fBx: -0.58, hB: 0, gx: 0.4, gy: 1.04, ga: -0.6, gw: 0, oh: 0.85 }),
  },
  // 鏡受け Mirror Guard: the blade upright in front of the face, the flat turned to the foe; horse stance; perfectly still
  mirror: {
    S: P({ px: -0.05, py: 0.73, sp: 0.03, ch: -0.04, tw: 0.76, ctw: 0, hd: 0.02, fFx: 0.48, fBx: -0.48, kF: -0.15, kB: 0.55, hB: 0, gx: 0.3, gy: 1.16, ga: 1.57, gw: 1.35, oh: 0, ox: 0.3, oy: 1.46 }),
  },
  // 鏡返し Mirror Return: the edge turns from the mirror (wrist roll, the blade lifts into hassō) → kesa down through the attacker
  mcut: {
    A: P({ px: -0.06, py: 0.76, sp: 0.0, ch: -0.06, tw: 0.2, ctw: -0.2, hd: 0.0, fFx: 0.46, fBx: -0.48, kB: 0.3, hB: 0.2, gx: 0.12, gy: 1.62, ga: 1.95, gw: -0.2, oh: 0.9 }),
    S: P({ px: 0.12, py: 0.74, sp: 0.2, ch: 0.08, hd: -0.12, tw: 0.56, ctw: 0.16, fFx: 0.58, fBx: -0.46, hB: 0.5, gx: 0.4, gy: 1.58, ga: -0.88, gw: 0.06, oh: 0.85 }),
    E: P({ px: 0.14, py: 0.72, sp: 0.26, ch: 0.1, hd: -0.14, tw: 0.64, ctw: 0.3, fFx: 0.58, fBx: -0.46, hB: 0.5, gx: 0.38, gy: 1.32, ga: -1.0, gw: 0.14, oh: 0.6 }),
    F: P({ px: 0.1, py: 0.74, sp: 0.22, ch: 0.06, hd: -0.12, tw: 0.64, ctw: 0.36, fFx: 0.58, fBx: -0.46, hB: 0.5, gx: 0.26, gy: 1.2, ga: -0.6, gw: -1.5, oh: 0, ox: 0.2, oy: 1.4 }),
  },
  // 數據刃雨 Data-Blade Rain: slide back, the point to the sky (the six blades flare and launch on the fire frame) → plunge the
  // point into the roof (the rain falls where the markers are)
  rain: {
    A: P({ py: 0.88, sp: -0.12, ch: -0.16, hd: 0.22, tw: 0.2, ctw: 0, fFx: 0.36, fBx: -0.38, hB: 0, gx: 0.14, gy: 2.02, ga: 1.62, gw: 0.1, oh: 0, ox: -0.34, oy: 1.6 }),
    S: P({ px: 0.06, py: 0.7, sp: 0.42, ch: 0.12, hd: -0.26, tw: 0.3, fFx: 0.46, fBx: -0.48, kB: 0.4, hB: 0, gx: 0.4, gy: 1.18, ga: -1.0, gw: 0, oh: 0.85 }),
    E: P({ px: 0.06, py: 0.68, sp: 0.44, ch: 0.12, hd: -0.28, tw: 0.3, fFx: 0.46, fBx: -0.48, kB: 0.4, hB: 0, gx: 0.4, gy: 1.16, ga: -1.0, gw: 0, oh: 0.85 }),
  },
  // 故障步 Glitch Step: a crouched take-off (the body vanishes 0.03–0.36 s), reappears behind the foe in a low crouch, the
  // blade low behind → one fast rising-to-falling kesa
  glitch: {
    A0: P({ px: -0.04, py: 0.66, sp: 0.36, ch: 0.1, hd: -0.25, tw: 0.2, ctw: -0.1, fFx: 0.42, fBx: -0.5, hB: 0.8, gx: 0.2, gy: 1.0, ga: 0.4, gw: 0, oh: 0.8 }),
    A: P({ px: -0.06, py: 0.68, sp: 0.3, ch: 0.06, hd: -0.2, tw: -0.2, ctw: -0.26, fFx: 0.44, fFy: 0.1, fBx: -0.52, hB: 0.6, gx: 0.06, gy: 1.7, ga: 2.1, gw: -0.15, oh: 0.95 }),
    S: P({ px: 0.1, py: 0.76, sp: 0.18, ch: 0.06, hd: -0.12, tw: 0.5, ctw: 0.12, fFx: 0.56, fBx: -0.44, hB: 0.6, gx: 0.38, gy: 1.5, ga: -0.92, gw: 0.04, oh: 0.85 }),
    E: P({ px: 0.12, py: 0.74, sp: 0.24, ch: 0.08, hd: -0.14, tw: 0.6, ctw: 0.26, fFx: 0.56, fBx: -0.44, hB: 0.6, gx: 0.38, gy: 1.3, ga: -1.0, gw: 0.12, oh: 0.6 }),
    F: P({ px: 0.08, py: 0.74, sp: 0.22, ch: 0.04, hd: -0.12, tw: 0.62, ctw: 0.36, fFx: 0.56, fBx: -0.44, hB: 0.5, gx: 0.26, gy: 1.2, ga: -0.6, gw: -1.5, oh: 0, ox: 0.2, oy: 1.4 }),
  },
  // 終之型 Final Form: jōdan held overhead (the window to dodge through) → the great split, quake
  ultEnd: {
    A: P({ ...JODAN, py: 0.88, sp: -0.12, ch: -0.14, hd: 0.08, hB: 0.7, gy: 2.0, ga: 2.55 }),
    S: P({ px: 0.16, py: 0.7, sp: 0.36, ch: 0.12, hd: -0.2, tw: 0.32, ctw: 0.04, fFx: 0.66, fBx: -0.6, hB: 0, gx: 0.42, gy: 1.62, ga: -0.86, gw: 0, oh: 0.9 }),
    E: P({ px: 0.17, py: 0.66, sp: 0.44, ch: 0.14, hd: -0.24, tw: 0.32, ctw: 0.06, fFx: 0.66, fBx: -0.6, hB: 0, gx: 0.4, gy: 1.34, ga: -1.08, gw: 0, oh: 0.85 }),
    F: P({ px: 0.16, py: 0.66, sp: 0.42, ch: 0.12, hd: -0.22, tw: 0.34, ctw: 0.06, fFx: 0.66, fBx: -0.6, hB: 0, gx: 0.44, gy: 1.06, ga: -0.6, gw: 0, oh: 0.85 }),
  },
};
// 千刃斬・鏡 Thousand Edges · Mirror: seven cuts on the seven hit ticks (one contact key per tick), the dash during the first
// three; ends wound up for the Final Form (ultEnd follows)
const ULT = {
  A: P({ ...IAI, py: 0.64, kB: 0.4 }),
  C: [
    F.iai.S,                                                                                                               // 1 draw
    P({ px: 0.12, py: 0.74, sp: 0.2, tw: 0.5, ctw: 0.12, fFx: 0.6, fBx: -0.5, hB: 0.6, gx: 0.38, gy: 1.5, ga: -0.86, gw: 0.04, oh: 0.85 }),   // 2 kesa
    P({ px: 0.12, py: 0.78, sp: 0.12, tw: 0.2, ctw: -0.14, fFx: 0.6, fBx: -0.4, hB: 0.6, gx: 0.24, gy: 0.88, ga: 0.7, gw: -0.08, oh: 0.8 }),    // 3 gyaku-kesa
    P({ px: 0.14, py: 0.72, sp: 0.18, ch: 0.04, tw: 0.4, ctw: 0.1, fFx: 0.6, fBx: -0.56, hB: 0.6, gx: 0.56, gy: 1.12, ga: -0.1, gw: -0.5, oh: 0 , ox: -0.3, oy: 1.1 }),   // 4 horizontal (yaw sweep)
    P({ px: 0.16, py: 0.7, sp: 0.26, ch: 0.08, tw: 0.3, ctw: 0.04, fFx: 0.64, fBx: -0.6, hB: 0, gx: 0.72, gy: 1.12, ga: 0.2, gw: 0, oh: 0.9 }),            // 5 thrust
    P({ px: 0.12, py: 0.72, sp: 0.3, ch: 0.1, tw: 0.3, ctw: 0.04, fFx: 0.6, fBx: -0.56, hB: 0, gx: 0.36, gy: 1.58, ga: -0.95, gw: 0, oh: 0.9 }),           // 6 karatake
    P({ px: 0.1, py: 0.8, sp: 0.08, tw: 0.24, ctw: -0.14, fFx: 0.58, fBx: -0.42, hB: 0.6, gx: 0.24, gy: 0.88, ga: 0.7, gw: -0.1, oh: 0.8 }),               // 7 rising
  ],
  E: [
    P({ ...F.iai.E }),
    P({ px: 0.12, py: 0.72, sp: 0.26, tw: 0.6, ctw: 0.26, fFx: 0.6, fBx: -0.5, hB: 0.6, gx: 0.36, gy: 1.38, ga: -1.0, gw: 0.12, oh: 0.6 }),
    P({ px: 0.12, py: 0.8, sp: 0.06, tw: 0.06, ctw: -0.22, fFx: 0.6, fBx: -0.4, hB: 0.6, gx: 0.26, gy: 0.94, ga: 0.95, gw: -0.16, oh: 0.7 }),
    P({ px: 0.14, py: 0.72, sp: 0.18, tw: 0.5, ctw: 0.3, fFx: 0.6, fBx: -0.56, hB: 0.6, gx: 0.5, gy: 1.1, ga: -0.12, gw: 0.6, oh: 0, ox: -0.34, oy: 1.12 }),
    P({ px: 0.17, py: 0.7, sp: 0.26, ch: 0.06, tw: 0.32, fFx: 0.64, fBx: -0.6, hB: 0, gx: 0.74, gy: 1.2, ga: 0.32, gw: 0, oh: 0.85 }),
    P({ px: 0.13, py: 0.7, sp: 0.36, ch: 0.12, tw: 0.3, fFx: 0.6, fBx: -0.56, hB: 0, gx: 0.36, gy: 1.42, ga: -0.98, gw: 0, oh: 0.85 }),
    P({ px: 0.1, py: 0.82, sp: 0.02, tw: 0.06, ctw: -0.22, fFx: 0.58, fBx: -0.42, hB: 0.6, gx: 0.26, gy: 0.94, ga: 0.95, gw: -0.16, oh: 0.7 }),
  ],
  W: [null, HASSO, P({ px: 0.04, py: 0.72, sp: 0.26, tw: 0.66, ctw: 0.3, fFx: 0.56, fBx: -0.46, hB: 0.5, gx: 0.04, gy: 1.16, ga: -0.42, gw: -2.6, oh: 0.7 }),
    P({ px: 0.02, py: 0.74, sp: 0.12, tw: -0.2, ctw: -0.3, fFx: 0.56, fBx: -0.5, hB: 0.6, gx: 0.06, gy: 1.12, ga: -0.1, gw: -2.4, oh: 0, ox: 0.3, oy: 1.2 }),
    P({ px: -0.06, py: 0.72, sp: 0.2, tw: -0.3, ctw: -0.2, fFx: 0.5, fBx: -0.56, hB: 0.6, gx: 0.0, gy: 1.06, ga: 0.15, gw: 0, oh: 0.95 }),
    P({ ...JODAN, py: 0.82, gy: 1.94, ga: 2.6 }),
    P({ px: 0.04, py: 0.68, sp: 0.3, tw: 0.66, ctw: 0.3, fFx: 0.56, fBx: -0.46, hB: 0.5, gx: 0.04, gy: 1.2, ga: -0.42, gw: -2.6, oh: 0.7 })],
  Fz: P({ ...JODAN, py: 0.84, gy: 1.96, ga: 2.62 }),
};

/** keys for a move — timings straight from the boss frame data (CLASSES.shogun.moves[key].t). FX cues ride on keys: stamp ·
 *  slide · sink · ring · quake · exhale · click (joined with '+'). */
export function moveKeys(key, m) {
  const t = m.t, f = F[key];
  switch (key) {
    case 'a1': return form(t, [['s', 0.62, f.A, 'coil'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 1, f.E, 'whip'], ['r', 0.42, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.06, STANCE, 'inOutSine']]);
    case 'a2': return form(t, [['s', 0.6, f.A, 'coil'], ['a', 0, f.S, 'snap', 'slide'], ['a', 1, f.E, 'whip'], ['r', 0.42, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.06, STANCE, 'inOutSine']]);
    case 'a3': return form(t, [['s', 0.42, f.A, 'coil'], ['s', 0.86, f.A, 'hold'], ['a', 0, f.S, 'snap', 'stamp+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.4, f.F, 'settle'], ['r', 0.82, f.F, 'hold'], ['x', 0.08, STANCE, 'inOutSine']]);
    // the coil sinks for 0.3 su, held (breathing out) to the flash (0.42 s ≈ 0.68 su) where the thumb breaks the koiguchi
    case 'iai': { const fl = (m.flash ?? 0.42) / t[0];
      return form(t, [['s', 0.3, f.A, 'coil', 'sink'], ['s', fl - 0.06, f.A, 'hold'], ['s', fl, f.A2, 'outQuad', 'click'], ['s', 0.96, f.A2, 'hold'],
        ['a', 0, f.S, 'snap', 'stamp+ring'], ['a', 1, f.E, 'whip'], ['r', 0.35, f.F, 'settle'], ['r', 0.88, f.F, 'hold'], ['x', 0.08, STANCE, 'inOutSine']]); }
    case 'ten1': return form(t, [['s', 0.5, f.A, 'coil', 'slide'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 1, f.E, 'whip'], ['r', 0.6, f.F, 'settle']]);
    case 'ten2': return form(t, [['s', 0.5, f.A, 'coil', 'slide'], ['a', 0, f.S, 'snap', 'slide'], ['a', 1, f.E, 'whip'], ['r', 0.7, f.F, 'outQuad']]);
    case 'ten3': return form(t, [['s', 0.4, f.A, 'coil', 'slide'], ['s', 0.84, f.A, 'hold'], ['a', 0, f.S, 'snap', 'stamp+exhale'], ['a', 1, f.E, 'whip', 'ring'], ['r', 0.35, f.F, 'settle'], ['r', 0.85, f.F, 'hold'], ['x', 0.08, STANCE, 'inOutSine']]);
    case 'mirror': return form(t, [['s', 1, f.S, 'outQuad', 'sink'], ['a', 1, f.S, 'hold'], ['r', 0.55, POSES.guard, 'inOutSine'], ['x', 0.06, STANCE, 'inOutSine']]);
    case 'mcut': return form(t, [['s', 0.55, f.A, 'coil'], ['s', 0.8, f.A, 'hold'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 1, f.E, 'whip'], ['r', 0.4, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.06, STANCE, 'inOutSine']]);
    case 'rain': { const fire = (m.fire && m.fire[0] ? m.fire[0].at : 0.4) / t[0];
      return form(t, [['s', 0.45, f.A, 'coil', 'ring'], ['s', fire, f.A, 'hold'], ['a', 0, f.S, 'snap', 'quake'], ['a', 1, f.E, 'hold'], ['r', 0.7, f.E, 'hold'], ['x', 0.06, STANCE, 'inOutSine']]); }
    case 'glitch': { const tp = (m.fire || []).find((q) => q.type === 'teleport'), u = (tp ? tp.at : 0.36) / t[0];
      return form(t, [['s', 0.05, f.A0, 'outQuad', 'sink'], ['s', u, f.A0, 'hold'], ['s', u + 0.12, f.A, 'outQuad', 'stamp'], ['s', 0.9, f.A, 'hold'], ['a', 0, f.S, 'snap'], ['a', 1, f.E, 'whip'], ['r', 0.42, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.06, STANCE, 'inOutSine']]); }
    case 'ult': return ultKeys(m);
    case 'ultEnd': return form(t, [['s', 0.3, f.A, 'coil', 'sink'], ['s', 0.92, f.A, 'hold'], ['a', 0, f.S, 'snap', 'quake+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.4, f.F, 'settle'], ['r', 0.85, f.F, 'hold'], ['x', 0.1, STANCE, 'inOutSine']]);
    default: return null;
  }
}
function ultKeys(m) {
  const [su, ac] = m.t, n = m.multi || 7, dt = ac / n, k = [{ t: 0, p: 'from' }], fx = ['stamp+ring', 'stamp', 'slide', 'ring', 'stamp', 'stamp', 'ring'];
  const push = (t, p, e, f) => k.push({ t, p, e, fx: f || null });
  push(su * 0.62, ULT.A, 'coil', 'sink');
  for (let i = 0; i < n; i++) {
    const t0 = su + i * dt, ci = i % ULT.C.length;
    if (i > 0) push(t0 - dt * 0.42, ULT.W[ci], 'coil');
    push(t0, ULT.C[ci], 'snap', fx[ci]); push(t0 + dt * 0.5, ULT.E[ci], 'whip');
  }
  push(su + ac + m.t[2] * 0.8, ULT.Fz, 'settle');   // ultEnd follows from here (its own jōdan coil)
  k.sort((a, b) => a.t - b.t);
  return k;
}
/** the key that lands on the first active frame (contact); the ult's first tick = the draw */
export const contactPose = (key) => (key === 'ult' ? ULT.C[0] : F[key] && F[key].S);
export const FORMS = F;
export const ULT_FORMS = ULT;

// ------------------------------------------------------------------ phase 2 glitch: time warp + jitter
/** move time as rendered: phase 1 = exact. Phase 2 = the startup stutters (time holds, then jumps) in deterministic bursts,
 *  never later than su − 0.04 s, so the contact frame (and everything after it) is exact. Monotonic, ≤ t. */
export function warpT(t, m, phase, seq = 0) {
  if (phase !== 2 || !m) return t;
  const su = m.t[0], lim = su - 0.04; if (t <= 0.02 || t >= lim) return t;
  const q = 1 / 18, b = Math.floor(t / q), h = hash(b * 7.3 + seq * 1.7);
  if (h < 0.45) return t;                               // smooth stretch
  const held = b * q + (h < 0.75 ? 0 : q * 0.35);       // freeze on the step (a dropped frame)
  return Math.min(t, held);
}
export const hash = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** idle / walk jitter in phase 2: short bursts (~1 in 4 windows of 1/12 s) of a few cm offsets on the hips / chest / head */
export function jitter(T, out) {
  const w = Math.floor(T * 12), h = hash(w), on = h > 0.76 ? 1 : 0;
  out.px = on * (hash(w + 0.3) - 0.5) * 0.09; out.ch = on * (hash(w + 0.6) - 0.5) * 0.18; out.hd = on * (hash(w + 0.9) - 0.5) * 0.4; out.on = on;
  return out;
}

// ------------------------------------------------------------------ phase transition (sim st 'phase', f.t 0 → transT)
const RECOIL = P({ px: -0.14, py: 0.84, sp: -0.2, ch: -0.32, hd: 0.55, tw: 0.3, ctw: -0.3, fFx: 0.4, fBx: -0.5, hB: 0.6, gx: 0.3, gy: 1.12, ga: -0.55, gw: 0.4, oh: 0, ox: 0.22, oy: 1.66 });
const CLUTCH = P({ px: -0.06, py: 0.66, sp: 0.55, ch: 0.25, hd: -0.55, tw: 0.2, ctw: -0.1, fFx: 0.42, fBx: -0.5, kF: -0.1, kB: 0.4, hB: 0.7, gx: 0.36, gy: 0.92, ga: -1.2, gw: 0.25, oh: 0, ox: 0.2, oy: 1.42 });
const HUNCH = P({ px: -0.02, py: 0.62, sp: 0.62, ch: 0.32, hd: -0.35, tw: 0.24, ctw: 0.05, fFx: 0.46, fBx: -0.52, kF: -0.15, kB: 0.5, hB: 0.8, gx: 0.42, gy: 0.86, ga: -1.15, gw: 0.3, oh: 0, ox: 0.16, oy: 1.3 });
const SPREAD = P({ px: 0.0, py: 0.84, sp: -0.18, ch: -0.28, hd: 0.3, tw: 0.42, ctw: 0.25, fFx: 0.5, fBx: -0.5, kF: -0.15, kB: 0.45, hB: 0, gx: 0.56, gy: 1.32, ga: -0.4, gw: 0.9, oh: 0, ox: -0.42, oy: 1.38 });
export const TRANSITION = { RECOIL, CLUTCH, HUNCH, SPREAD };
export const transitionKeys = (T = 1.2) => [{ t: 0, p: 'from' }, { t: T * 0.1, p: RECOIL, e: 'snap' }, { t: T * 0.24, p: CLUTCH, e: 'outQuad' }, { t: T * 0.5, p: HUNCH, e: 'inOutSine' },
  { t: T * 0.66, p: SPREAD, e: 'snap' }, { t: T * 0.86, p: JODAN, e: 'settle' }, { t: T, p: JODAN, e: 'hold' }];
/** 0 → 1 over the transition: the corruption (mask crack, outline + seams to red) — starts at the crack (0.25 s) */
export const corruptK = (phase, st, ft, T = 1.2) => (phase !== 2 ? 0 : st === 'phase' ? smooth(0.2, 0.75, ft / T) : 1);
/** mask tile: calm (phase 1) · focus (phase 1 strike / iai flash) · broken (phase 2) · flare (phase 2 strike / roar) */
export function maskTile(phase, st, ft, T = 1.2) {
  if (phase !== 2) return st === 'atk' ? MASK.focus : MASK.calm;
  if (st === 'phase') {
    const u = ft / T; if (u < 0.2) return MASK.focus;
    if (u < 0.45) return hash(Math.floor(ft * 30)) > 0.5 ? MASK.broken : MASK.calm;   // the crack flickers in
    return u > 0.66 && u < 0.86 ? MASK.flare : MASK.broken;                              // roar as the blades unfold
  }
  return st === 'atk' ? MASK.flare : MASK.broken;
}

// ------------------------------------------------------------------ the six data blades (world space, one InstancedMesh)
export const DB = { n: 6, len: 0.62, top: 7.4, fall: 0.22, stuck: 0.5, ret: 0.45 };
export const dbSlots = () => Array.from({ length: DB.n }, () => ({ mode: 0, t: 0, x: 0, y: 0, a: 0, px: 0, d: 0, d0: 0.6, lx: 0, ly: 0, la: 0 }));
const lerp = (a, b, k) => a + (b - a) * k;
/** fan slot i in world space: behind the shoulders, tips out like wings. c = { x, y (floor), facing, s (rig → world), T, flare } */
function fanSlot(i, c, o) {
  const f = c.facing, s = c.s, fl = c.flare || 0;
  const th = Math.PI / 2 - f * (-0.62 + i * 0.36) * (1 + 0.18 * fl) + Math.sin(c.T * 1.6 + i * 1.1) * 0.04;   // from forward-up to back-down
  const r = (0.5 + 0.08 * fl) * s, cx = c.x - f * 0.3 * s, cy = c.y + (1.4 + 0.2 * fl) * s + Math.sin(c.T * 2.1 + i * 0.9) * 0.025 * s;
  o.x = cx + Math.cos(th) * r; o.y = cy + Math.sin(th) * r; o.z = -0.32 * s; o.a = th; return o;
}
const _fs = { x: 0, y: 0, z: 0, a: 0 };
/** advance the six blades one frame and write their poses to out[i] = { x, y, z, a (blade +Y angle in the screen plane), roll,
 *  k (size 0..1) }. c = { phase, st, ft (sim f.t), mk, x, y, facing, s, T (clock), dt, projs: dblade projectiles of this boss
 *  by idx (or null), cloak }. Pure apart from `slots` (per-blade state). */
export function dataBlades(c, slots, out) {
  const p2 = c.phase === 2, trans = c.st === 'phase', T = c.T, s = c.s, ko = c.st === 'ko' || c.st === 'down';
  c.flare = c.st === 'atk' && c.mk === 'rain' ? smooth(0, 0.3, c.ft) : 0;
  for (let i = 0; i < DB.n; i++) {
    const sl = slots[i], o = out[i], pr = c.projs ? c.projs[i] : null; sl.t += c.dt;
    fanSlot(i, c, _fs);
    // state: launched while the sim has this blade's marker; stuck after it lands; then it re-forms in the fan
    if (pr && !pr.dead && pr.delay > 0) { if (sl.mode !== 1) { sl.mode = 1; sl.t = 0; sl.lx = o.x || _fs.x; sl.ly = o.y || _fs.y; sl.la = o.a || _fs.a; } sl.px = pr.x; sl.d = pr.delay; sl.d0 = pr.delay0 || 0.6; }
    else if (sl.mode === 1) { sl.mode = 2; sl.t = 0; }
    else if (sl.mode === 2 && sl.t > DB.stuck) { sl.mode = 3; sl.t = 0; }
    else if (sl.mode === 3 && sl.t > DB.ret) sl.mode = 0;
    o.roll = 0; o.z = _fs.z;
    if (sl.mode === 1) {   // flight to the apex above the marker, then the drop in the last DB.fall s (tip lands on the marker at delay 0)
      const tf = Math.max(0.2, sl.d0 - DB.fall), e = sl.d0 - sl.d, len = DB.len * s, ground = c.y + len * 0.88;
      if (sl.d > DB.fall) {
        const u = clamp(e / tf, 0, 1), k = 1 - (1 - u) ** 3, ax = sl.px, ay = c.y + DB.top + len, mx = (sl.lx + ax) / 2, my = Math.max(sl.ly, ay) + 1.6;
        o.x = (1 - k) * (1 - k) * sl.lx + 2 * (1 - k) * k * mx + k * k * ax; o.y = (1 - k) * (1 - k) * sl.ly + 2 * (1 - k) * k * my + k * k * ay;
        o.a = lerp(sl.la, sl.la + wrapA(-Math.PI / 2 - sl.la), smooth(0, 0.8, u)); o.roll = u * TAU; o.z = lerp(sl.lz ?? _fs.z, 0, k);
      } else {
        const fall = 1 - sl.d / DB.fall; o.x = sl.px; o.y = ground + (1 - fall * fall) * (DB.top + len - (ground - c.y)); o.a = -Math.PI / 2; o.z = 0;
      }
      o.k = 1;
    } else if (sl.mode === 2) {   // planted, then dissolves (shrinks into the floor)
      const len = DB.len * s; o.x = sl.px; o.y = c.y + len * 0.88 - smooth(0.25, DB.stuck, sl.t) * len * 0.5; o.a = -Math.PI / 2; o.z = 0; o.k = 1 - smooth(0.3, DB.stuck, sl.t);
    } else {
      o.x = _fs.x; o.y = _fs.y; o.a = _fs.a;
      let k = p2 && !ko ? 1 : 0;
      if (trans) { const u = (c.ft - 0.42 - 0.07 * i) / 0.32; k = u <= 0 ? 0 : u >= 1 ? 1 : 1 + 0.25 * Math.sin(Math.PI * u) - 0.25 * (1 - u) * 0; k = Math.min(1.25, u <= 0 ? 0 : u < 1 ? smooth(0, 1, u) * (1 + 0.2 * Math.sin(Math.PI * u)) : 1);
        const fold = 1 - smooth(0, 1, u); o.a = lerp(_fs.a, Math.PI / 2 + c.facing * 0.15, fold); o.x = lerp(_fs.x, c.x - c.facing * 0.3 * s, fold); o.y = lerp(_fs.y, c.y + 1.4 * s, fold); }
      if (sl.mode === 3) k *= smooth(0, DB.ret, sl.t);
      o.k = k;
    }
    if (c.cloak && sl.mode !== 1 && sl.mode !== 2) o.k = 0;
    sl.lz = o.z;
  }
  return out;
}

// ------------------------------------------------------------------ the nodachi: the rig solves a katana-length blade; scale
// it about the grip (the weapon mesh is katanaGeo × NODACHI_K along the blade)
export function nodachi(J, k = NODACHI_K) {
  const h = J.handF; for (let i = 0; i < 3; i++) { J.tip[i] = h[i] + (J.tip[i] - h[i]) * k; J.base[i] = h[i] + (J.base[i] - h[i]) * k; } return J;
}

export const PROFILE = {
  id: 'shogun', stance: STANCE, poses: POSES, moveKeys, airMoves: [],
  step: { lift: 0.025, liftWalk: 0.03, liftAtk: 0.02, durWalk: 0.24 },   // suri-ashi: the feet barely leave the floor
  lead: 0.034,                                                            // heavier body: a longer power chain
  bladeK: NODACHI_K, ghosts: true, ghostN: 8, ghostTrail: false, snapTurn: true, boss: true,
  sheath: SAYA,
  warpT, jitter, maskTile, corruptK, transitionKeys, dataBlades, dbSlots,
};
