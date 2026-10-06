// 魔導士 MAGE — anime phase 2: techno-sorceress forms on the HQ rig. Pure data + clip builders (node-tested).
// Casting is martial: every spell is a palm / sword-finger technique from internal kung fu (taiji · bagua · xingyi) —
// grounded stance → weight shift → hips drive → shoulder → arm → palm, and the spell leaves the FOCUS (the floating
// holo-glyph ahead of the palm) exactly where and when classes.js spawns the projectile (tests/anime.test.mjs checks it).
//   Stance: 虛步 empty / cat stance — weight on the back leg, front heel lifted, casting palm forward, the off hand in a
//   sword-finger mudra (劍指) at the chest. Wind-ups coil (hips turn away, palm chambers at the hip), releases snap with a
//   slide-step or a stamp (dust), follow-throughs extend after the bolt and settle with a small overshoot, then a held beat.
// Combo (frame windows unchanged): a1 單推掌 single push palm (arcane bolt) · a2 穿掌 low piercing sword-fingers (twin bolt,
// the off hand rises as a crane guard) · a3 轉身雙推掌 bagua turning double palm (star orb: a full pivot, sink into horse
// stance, double palm push in a bow stance, held). air1 / air2 下按掌 diving press palms (the glyph is thrown ahead of the
// palm toward the floor, where the dive bolt spawns). s1 閃現 Blink: sword-finger seal at the lips → stretch-vanish → squash-
// reappear in a three-point landing. s2 雷柱 Thunder Pillar: 金雞獨立 golden rooster (knee up, sword fingers to the sky,
// ground sigil) → stamp into horse stance, sword fingers drive down at the foe, held while the pillar comes. ult 星隕天降
// Starfall: a taiji opening with a full turn, then 雙托天 both palms to the sky with a giant glyph — HELD — and a closing.
import { form } from './clip.js';

const A0 = 0.075, TAU = Math.PI * 2;
export const STANCE = {
  px: 0.0, py: 0.8, pt: 0.04, sp: 0.06, ch: 0.03, tw: 0.32, ctw: -0.08, hd: -0.04, rr: 0,
  fFx: 0.27, fFy: A0, fBx: -0.33, fBy: A0, aF: 0, aB: 0,
  gx: 0.3, gy: 1.1, ga: 0.12, gw: 0.12, ox: 0.18, oy: 1.2, oh: 0,
  sy: 0, pv: 0, hF: 0.45, hB: 0, kF: 0, kB: 0.12, sh: 0,
  cF1: 0.15, cF2: 0.3, cB1: 0, cB2: 1, oa: 0.1, fr: 0.14, fs: 1, gs: 0, zz: 0,
};
const P = (o) => ({ ...STANCE, ...o });
const AIR = { py: 0.95, fFx: 0.2, fFy: 0.42, fBx: -0.12, fBy: 0.3, aF: 0.3, aB: -0.4, hF: 0, hB: 0, kB: 0 };
const SPUN = P({ sy: -TAU });
const OPEN = { cF1: 0, cF2: 0 }, SWORD = { cF1: 0, cF2: 1 }, FIST = { cF1: 1, cF2: 1 };
const OOPEN = { cB1: 0, cB2: 0 }, OSWORD = { cB1: 0, cB2: 1 }, OFIST = { cB1: 1, cB2: 1 };

export const POSES = {
  stance: STANCE,
  idle1: P({ py: 0.812, ch: 0.07, sp: 0.05, hd: -0.06, gy: 1.13, ga: 0.18, fs: 1.06, oy: 1.23 }),       // breath in (chest rises, the focus brightens)
  shuffle: P({ px: 0.06, fFx: 0.35, fBx: -0.27, py: 0.79, hF: 0.2, tw: 0.4, gx: 0.34 }),            // weight shifts forward, back foot follows
  walk: P({ py: 0.79, sp: 0.08, hd: -0.03, gx: 0.32, gy: 1.08, ga: 0.08, hF: 0.15 }),
  walkBack: P({ px: -0.04, py: 0.81, sp: 0.03, gx: 0.3, gy: 1.14, ga: 0.3, hF: 0.3 }),
  turn: P({ py: 0.84, sp: 0.08, tw: 0, ctw: 0, gx: 0.22, gy: 1.2, ga: 0.7, gw: 0, hF: 0.7, hB: 0.7 }),
  // guard: horse-ish stance, palm forward at face height — the focus opens into a shield glyph; off hand braces behind it
  guard: P({ px: -0.03, py: 0.74, sp: 0.02, ch: -0.02, tw: 0.55, ctw: 0, hd: 0.04, fFx: 0.38, fBx: -0.4, kB: 0.45, hF: 0, hB: 0, gx: 0.3, gy: 1.3, ga: 0.02, gw: 0, ...OPEN, ox: 0.22, oy: 1.2, oa: 0.25, ...OSWORD, fr: 0.16, fs: 1.55 }),
  block: P({ px: -0.12, py: 0.7, sp: -0.05, ch: -0.15, tw: 0.5, ctw: 0, hd: 0.12, fFx: 0.36, fBx: -0.48, kB: 0.45, hF: 0, hB: 0, gx: 0.27, gy: 1.32, ga: 0.15, gw: 0, ...OPEN, ox: 0.2, oy: 1.22, oa: 0.3, ...OSWORD, fr: 0.18, fs: 1.85 }),
  jump: P({ ...AIR, sp: 0.06, gx: 0.18, gy: 1.36, ga: 1.1, gw: 0, ...OPEN, ox: -0.22, oy: 1.25, oa: 0.8, ...OOPEN }),
  fall: P({ py: 0.95, fFx: 0.3, fFy: 0.2, fBx: -0.18, fBy: 0.12, aF: 0.15, aB: -0.3, hF: 0, hB: 0, gx: 0.34, gy: 1.22, ga: 0.4, ...OPEN, ox: -0.28, oy: 1.18, oa: 1.0, ...OOPEN }),
  land: P({ py: 0.62, sp: 0.36, ch: 0.12, hd: -0.2, fFx: 0.4, fBx: -0.38, kB: 0.35, hF: 0, hB: 0.6, gx: 0.12, gy: 1.2, ga: 1.1, ox: 0.32, oy: 0.36, oa: -1.5, ...OOPEN }),   // three-point landing
  tuck: P({ py: 0.95, sp: 0.6, ch: 0.3, hd: 0.35, tw: 0, ctw: 0, fFx: 0.2, fFy: 0.72, fBx: 0.08, fBy: 0.62, aF: -0.3, aB: -0.3, hF: 0, hB: 0, gx: 0.3, gy: 1.0, ga: -1.2, ...FIST, ox: 0.26, oy: 1.0, ...OFIST, fs: 0.7 }),
  dodge: P({ py: 0.6, sp: 0.6, ch: 0.25, hd: 0.3, tw: 0, ctw: 0, fFx: 0.25, fFy: 0.42, fBx: 0.05, fBy: 0.32, hF: 0, hB: 0, gx: 0.3, gy: 0.85, ga: -1.2, ...FIST, ox: 0.25, oy: 0.82, ...OFIST, fs: 0.7 }),
  // directional hit reactions (scaled by hit strength in the animator)
  hitHigh: P({ px: -0.12, py: 0.86, hd: -0.7, ch: -0.35, sp: -0.15, tw: 0.1, ctw: -0.25, fBx: -0.46, hF: 0, hB: 0.6, gx: 0.15, gy: 1.35, ga: 1.4, ...OPEN, ox: -0.35, oy: 1.45, oa: 1.2, ...OOPEN, fs: 0.8 }),
  hitMid: P({ px: -0.18, py: 0.78, hd: 0.4, ch: 0.1, sp: 0.4, tw: 0.25, ctw: 0.12, fBx: -0.46, hF: 0, gx: 0.28, gy: 0.95, ga: -0.6, cF1: 0.5, cF2: 0.6, ox: 0.15, oy: 1.0, oa: -1.0, cB1: 0.5, cB2: 0.6, fs: 0.8 }),
  hitBack: P({ px: 0.14, py: 0.82, hd: -0.4, sp: -0.2, ch: -0.3, tw: 0.3, fFx: 0.46, hF: 0, gx: 0.1, gy: 1.25, ga: 1.8, ...OPEN, ox: -0.45, oy: 1.3, oa: 1.4, ...OOPEN, fs: 0.8 }),
  stagger: P({ px: -0.24, py: 0.74, hd: 0.35, ch: -0.3, sp: 0.12, tw: 0.7, ctw: 0.2, fBx: -0.56, kB: 0.4, hF: 0, hB: 0, gx: 0.08, gy: 1.25, ga: 1.9, ...OPEN, ox: -0.5, oy: 1.45, oa: 1.5, ...OOPEN, fs: 0.75 }),
  airHit: P({ rr: -0.6, py: 0.95, sp: -0.22, ch: -0.2, hd: 0.32, fFx: 0.36, fFy: 0.38, fBx: 0.08, fBy: 0.18, aF: 0.4, aB: 0.2, hF: 0, hB: 0, gx: 0.1, gy: 1.62, ga: 2.0, ...OPEN, ox: -0.46, oy: 1.62, oa: 2.0, ...OOPEN, fs: 0.75 }),
  spiked: P({ rr: 0.5, py: 0.95, sp: 0.35, ch: 0.2, hd: -0.4, fFx: 0.1, fFy: 0.15, fBx: -0.25, fBy: 0.3, hF: 0, hB: 0, gx: 0.3, gy: 1.7, ga: 2.0, ...OPEN, ox: -0.2, oy: 1.75, oa: 2.0, ...OOPEN, fs: 0.75 }),
  down: P({ rr: -1.5, py: 0.02, px: 0, pt: 0, sp: -0.05, ch: 0, hd: 0.35, tw: 0.05, ctw: 0, fFx: 0.2, fFy: -0.74, fBx: 0, fBy: -0.8, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kB: 0, gx: -0.3, gy: 1.3, ga: 2.8, cF1: 0.4, cF2: 0.5, ox: 0.3, oy: 1.35, oa: 0, cB1: 0.4, cB2: 0.5, fs: 0.6 }),
  downB: P({ rr: -1.32, py: 0.1, px: 0, pt: 0, sp: 0.05, ch: 0.05, hd: 0.2, tw: 0.05, ctw: 0, fFx: 0.3, fFy: -0.6, fBx: 0.1, fBy: -0.7, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kB: 0, gx: -0.2, gy: 1.4, ga: 2.6, cF1: 0.4, cF2: 0.5, ox: 0.35, oy: 1.4, oa: 0, cB1: 0.4, cB2: 0.5, fs: 0.6 }),   // bounce
  ko: P({ rr: -1.52, py: 0.02, px: 0, pt: 0, sp: -0.08, ch: -0.05, hd: 0.5, tw: 0.1, ctw: 0, fFx: 0.3, fFy: -0.7, fBx: -0.05, fBy: -0.82, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kB: 0, gx: -0.4, gy: 1.6, ga: 2.9, cF1: 0.3, cF2: 0.4, ox: 0.45, oy: 1.6, oa: 0, cB1: 0.3, cB2: 0.4, fs: 0.4 }),
  // tech roll: backward roll over the shoulder → kneel (one palm on the floor) → stance
  rollB: P({ rr: -3.5, py: 0.5, sp: 0.62, ch: 0.3, hd: 0.45, tw: 0, ctw: 0, fFx: 0.22, fFy: 0.6, fBx: 0.12, fBy: 0.52, aF: -0.3, aB: -0.3, hF: 0, hB: 0, kB: 0, gx: 0.28, gy: 1.0, ga: 1.2, ...FIST, ox: 0.3, oy: 0.95, ...OFIST, fs: 0.6 }),
  kneel: P({ rr: -TAU + 0.5, py: 0.5, sp: 0.35, ch: 0.12, hd: -0.3, fFx: 0.34, fFy: A0, fBx: -0.22, fBy: 0.1, hF: 0, hB: 0.9, kB: 0.2, gx: 0.36, gy: 0.9, ga: 0.2, ...OPEN, ox: 0.4, oy: 0.3, oa: -1.5, ...OOPEN }),
  stun: P({ py: 0.8, sp: -0.15, ch: -0.22, hd: 0.5, tw: 0.1, hF: 0, hB: 0, gx: 0.3, gy: 0.76, ga: -0.9, cF1: 0.5, cF2: 0.6, ox: -0.1, oy: 0.8, oa: -1.2, cB1: 0.5, cB2: 0.6, fs: 0.5 }),
  // win: gather both palms → flourish (the focus spins out and back) → final: cat stance, sword fingers by the cheek, fist on the hip
  winA: P({ py: 0.76, sp: 0.02, ch: -0.06, tw: 0.25, ctw: 0, hd: 0.08, kB: 0.3, hF: 0, gx: 0.18, gy: 1.52, ga: 1.5, gw: 0, ...OPEN, ox: 0.1, oy: 1.5, oa: 1.5, ...OOPEN, fr: 0.2, fs: 1.6, gs: 0.6 }),
  winB: P({ px: 0.04, py: 0.78, sp: 0.1, tw: 0.5, ctw: 0.2, hd: -0.08, hF: 0.2, gx: 0.56, gy: 1.08, ga: -0.25, gw: 0.4, ...OPEN, ox: -0.02, oy: 1.02, oa: -1.4, ...OFIST, fr: 0.22, fs: 1.9, gs: 0.3 }),
  win: P({ px: -0.02, py: 0.82, sp: 0.0, ch: -0.02, tw: 0.42, ctw: -0.1, hd: -0.12, fFx: 0.24, fBx: -0.3, hF: 0.55, gx: 0.2, gy: 1.42, ga: 1.25, gw: 0.25, ...SWORD, ox: -0.03, oy: 1.0, oa: -1.4, ...OFIST, fr: 0.2, fs: 0.95 }),
};

// ------------------------------------------------------------------ attack forms (F[move] = named key poses)
const F = {
  // 單推掌 Single push palm (arcane bolt): coil — weight back, hips turn away, the casting palm chambers palm-up at the hip while the
  // off hand reaches forward to measure → slide-step, hips snap forward, the palm drives out (the bolt leaves the glyph) while the
  // off hand pulls back to the hip as a fist (push–pull) → the arm completes the extension after the bolt → settle, held
  a1: {
    A: P({ px: -0.05, py: 0.76, sp: 0.1, ch: 0.04, hd: -0.06, tw: -0.08, ctw: -0.12, fFx: 0.26, fFy: 0.1, fBx: -0.36, hF: 0, hB: 0, kB: 0.2, gx: 0.04, gy: 0.98, ga: 1.35, gw: 0, ...OPEN, ox: 0.34, oy: 1.2, oa: 0, ...OOPEN, fr: 0.1, fs: 0.8 }),
    S: P({ px: 0.08, py: 0.76, sp: 0.12, ch: 0.04, hd: -0.08, tw: 0.5, ctw: 0.06, fFx: 0.42, fBx: -0.36, hF: 0, hB: 0.5, kB: 0.1, gx: 0.3, gy: 1.0, ga: 0.0, gw: 0, ...OPEN, ox: -0.04, oy: 1.0, oa: -1.5, ...OFIST, fr: 0.11, fs: 1.2 }),
    E: P({ px: 0.1, py: 0.76, sp: 0.13, ch: 0.04, hd: -0.08, tw: 0.55, ctw: 0.1, fFx: 0.42, fBx: -0.36, hF: 0, hB: 0.5, kB: 0.1, gx: 0.54, gy: 1.02, ga: 0.02, gw: 0, ...OPEN, ox: -0.06, oy: 1.0, oa: -1.5, ...OFIST, fr: 0.12, fs: 1.05 }),
    F: P({ px: 0.08, py: 0.78, sp: 0.1, hd: -0.06, tw: 0.48, ctw: 0.04, fFx: 0.42, fBx: -0.36, hF: 0, hB: 0.3, kB: 0.1, gx: 0.48, gy: 1.06, ga: 0.08, gw: 0.05, ...OPEN, ox: 0.04, oy: 1.1, oa: -0.6, cB1: 0.4, cB2: 1, fr: 0.13, fs: 1 }),
  },
  // 穿掌 Piercing palm (twin bolt): the palm circles down-back (cloud hands), hips reverse, the back foot slides up, the off hand rises
  // above the head (crane guard) → low piercing sword-fingers at the bolt height
  a2: {
    A: P({ px: 0.02, py: 0.72, sp: 0.18, ch: 0.06, hd: -0.1, tw: 0.02, ctw: -0.22, fFx: 0.36, fBx: -0.28, hF: 0, hB: 0.2, kB: 0.25, gx: 0.12, gy: 0.84, ga: -0.6, gw: 0, ...OPEN, ox: 0.1, oy: 1.6, oa: 1.3, ...OOPEN, fr: 0.1, fs: 0.85 }),
    S: P({ px: 0.1, py: 0.74, sp: 0.14, ch: 0.05, hd: -0.12, tw: 0.46, ctw: 0.1, fFx: 0.46, fBx: -0.3, hF: 0, hB: 0.55, kB: 0.1, gx: 0.3, gy: 0.885, ga: -0.03, gw: 0, ...SWORD, ox: 0.08, oy: 1.62, oa: 1.4, ...OOPEN, fr: 0.11, fs: 1.1 }),
    E: P({ px: 0.12, py: 0.74, sp: 0.14, ch: 0.05, hd: -0.12, tw: 0.5, ctw: 0.12, fFx: 0.46, fBx: -0.3, hF: 0, hB: 0.55, kB: 0.1, gx: 0.55, gy: 0.9, ga: 0.0, gw: 0, ...SWORD, ox: 0.08, oy: 1.6, oa: 1.4, ...OOPEN, fr: 0.12, fs: 1.0 }),
    F: P({ px: 0.1, py: 0.76, sp: 0.12, hd: -0.08, tw: 0.46, ctw: 0.06, fFx: 0.46, fBx: -0.3, hF: 0, hB: 0.35, gx: 0.48, gy: 0.96, ga: 0.06, gw: 0.05, ...SWORD, ox: 0.15, oy: 1.32, oa: 0.4, ...OSWORD, fr: 0.13, fs: 1 }),
  },
  // 轉身雙推掌 Bagua turning double palm (star orb): pivot a full turn on the ball of the front foot holding the ball (抱球: casting
  // palm under, off palm over — the glyph swells between them), sink into a horse stance, then step into a bow stance and push
  // with both palms at orb height; the push is HELD
  a3: {
    A: P({ sy: -3.2, pv: 0.27, px: 0.02, py: 0.74, sp: 0.1, ch: 0.02, tw: 0.1, ctw: 0.1, fFx: 0.28, fBx: -0.12, fBy: 0.15, hF: 0.9, hB: 0, kB: 0, gx: 0.12, gy: 0.92, ga: 1.5, gw: 0, ...OPEN, ox: 0.14, oy: 1.24, oa: -1.5, ...OOPEN, fr: 0.13, fs: 1.4 }),
    A2: P({ sy: -TAU + 0.22, pv: 0.27, px: 0.0, py: 0.66, sp: 0.14, ch: 0.04, hd: -0.08, tw: 0.2, ctw: -0.05, fFx: 0.36, fBx: -0.4, hF: 0, hB: 0, kF: -0.15, kB: 0.5, gx: 0.14, gy: 1.0, ga: 1.2, gw: 0, ...OPEN, ox: 0.16, oy: 1.26, oa: -1.4, ...OOPEN, fr: 0.13, fs: 1.6 }),
    S: P({ sy: -TAU, pv: 0.27, px: 0.12, py: 0.7, sp: 0.14, ch: 0.04, hd: -0.1, tw: 0.3, ctw: 0.0, fFx: 0.48, fBx: -0.44, hF: 0, hB: 0, kF: 0, kB: 0.2, gx: 0.3, gy: 1.04, ga: 0.0, gw: 0, ...OPEN, ox: 0.28, oy: 1.1, oa: 0.05, ...OOPEN, fr: 0.12, fs: 1.75 }),
    E: P({ sy: -TAU, pv: 0.27, px: 0.14, py: 0.7, sp: 0.15, ch: 0.04, hd: -0.1, tw: 0.32, ctw: 0.02, fFx: 0.48, fBx: -0.44, hF: 0, hB: 0, kB: 0.2, gx: 0.52, gy: 1.06, ga: 0.02, gw: 0, ...OPEN, ox: 0.48, oy: 1.12, oa: 0.05, ...OOPEN, fr: 0.13, fs: 1.3 }),
    F: P({ sy: -TAU, pv: 0.27, px: 0.13, py: 0.71, sp: 0.13, ch: 0.03, hd: -0.08, tw: 0.32, ctw: 0.0, fFx: 0.48, fBx: -0.44, hF: 0, hB: 0, kB: 0.2, gx: 0.49, gy: 1.08, ga: 0.05, gw: 0, ...OPEN, ox: 0.45, oy: 1.14, oa: 0.08, ...OOPEN, fr: 0.13, fs: 1.1 }),
    H: P({ sy: -TAU, pv: 0.27, px: 0.12, py: 0.72, sp: 0.12, ch: 0.03, hd: -0.08, tw: 0.32, ctw: 0.0, fFx: 0.48, fBx: -0.44, hF: 0, hB: 0, kB: 0.2, gx: 0.47, gy: 1.09, ga: 0.06, gw: 0, ...OPEN, ox: 0.43, oy: 1.15, oa: 0.08, ...OOPEN, fr: 0.13, fs: 1.05 }),
  },
  // 下按掌 Diving press palm (dive bolt): chamber the palm by the ear, knees tucked → the body pitches forward and the palm presses
  // down-forward; the glyph is thrown ahead of the palm (fr) to where the bolt spawns, aimed along its flight
  air1: {
    A: P({ ...AIR, sp: -0.06, ch: -0.06, tw: 0, ctw: -0.25, gx: 0.04, gy: 1.52, ga: 1.0, gw: 0, ...OPEN, ox: 0.25, oy: 1.15, oa: 0, ...OSWORD, fr: 0.12, fs: 0.9 }),
    S: P({ ...AIR, rr: 0.3, py: 0.72, sp: 0.32, ch: 0.12, hd: -0.2, tw: 0.4, ctw: 0.1, fFx: 0.12, fFy: 0.42, fBx: -0.3, fBy: 0.36, gx: 0.254, gy: 0.594, ga: -0.55, gw: 0, ...OPEN, ox: -0.12, oy: 1.12, oa: 1.0, ...OFIST, fr: 0.5, fs: 1.15 }),
    E: P({ ...AIR, rr: 0.34, py: 0.72, sp: 0.36, ch: 0.12, hd: -0.2, tw: 0.42, ctw: 0.12, fFx: 0.12, fFy: 0.42, fBx: -0.3, fBy: 0.36, gx: 0.29, gy: 0.56, ga: -0.55, gw: 0, ...OPEN, ox: -0.14, oy: 1.12, oa: 1.0, ...OFIST, fr: 0.36, fs: 1.0 }),
    F: P({ ...AIR, rr: 0.25, py: 0.88, sp: 0.24, ch: 0.08, tw: 0.35, ctw: 0.1, gx: 0.28, gy: 0.82, ga: -0.4, gw: 0, ...OPEN, ox: 0.1, oy: 1.3, oa: 0.3, ...OSWORD, fr: 0.16, fs: 1 }),
  },
  // second dive press: the other way round — the off palm leads up, legs scissor, then the casting palm hammers down
  air2: {
    A: P({ ...AIR, rr: -0.2, sp: -0.12, ch: -0.1, tw: 0.1, ctw: -0.15, fFx: 0.3, fFy: 0.36, fBx: -0.2, fBy: 0.46, gx: -0.02, gy: 1.6, ga: 1.4, gw: 0, ...OPEN, ox: 0.3, oy: 1.4, oa: 0.4, ...OOPEN, fr: 0.12, fs: 0.95 }),
    S: P({ ...AIR, rr: 0.3, py: 0.72, sp: 0.36, ch: 0.12, hd: -0.22, tw: 0.3, ctw: 0.1, fFx: 0.3, fFy: 0.3, fBx: -0.22, fBy: 0.46, gx: 0.254, gy: 0.594, ga: -0.55, gw: 0, ...OPEN, ox: -0.1, oy: 1.2, oa: 1.2, ...OOPEN, fr: 0.5, fs: 1.2 }),
    E: P({ ...AIR, rr: 0.36, py: 0.72, sp: 0.4, ch: 0.12, hd: -0.22, tw: 0.3, ctw: 0.12, fFx: 0.3, fFy: 0.3, fBx: -0.22, fBy: 0.46, gx: 0.29, gy: 0.56, ga: -0.55, gw: 0, ...OPEN, ox: -0.12, oy: 1.2, oa: 1.2, ...OOPEN, fr: 0.36, fs: 1.0 }),
    F: P({ ...AIR, rr: 0.3, py: 0.88, sp: 0.26, ch: 0.08, tw: 0.3, ctw: 0.1, gx: 0.26, gy: 0.82, ga: -0.4, gw: 0, ...OPEN, ox: 0.05, oy: 1.32, oa: 0.6, ...OOPEN, fr: 0.16, fs: 1 }),
  },
  // 閃現 Blink: sword-finger seal raised to the lips, knees dip → stretch-vanish into a line of light (zz 1) on the teleport frame →
  // reappear squashed into a three-point landing (off palm on the floor) → settle
  s1: {
    A: P({ py: 0.72, sp: 0.12, ch: 0.06, hd: -0.12, tw: 0.2, ctw: -0.1, kB: 0.25, hF: 0.2, gx: 0.16, gy: 1.4, ga: 1.45, gw: 0, ...SWORD, ox: 0.13, oy: 1.28, oa: 1.2, ...OOPEN, fr: 0.1, fs: 1.2, zz: 0.25 }),
    S: P({ py: 0.76, sp: 0.04, ch: -0.02, hd: -0.05, tw: 0.2, ctw: -0.1, kB: 0.1, hF: 0.6, hB: 0.6, gx: 0.14, gy: 1.46, ga: 1.5, gw: 0, ...SWORD, ox: 0.12, oy: 1.32, oa: 1.2, ...OOPEN, fr: 0.1, fs: 0.6, zz: 1 }),
    R: P({ px: 0.06, py: 0.5, sp: 0.5, ch: 0.16, hd: -0.3, tw: 0.35, ctw: 0.05, fFx: 0.36, fBx: -0.3, kB: 0.35, hF: 0, hB: 0.8, gx: -0.12, gy: 1.12, ga: 2.4, gw: 0, ...OPEN, ox: 0.36, oy: 0.2, oa: -1.5, ...OOPEN, fr: 0.14, fs: 1.3, zz: -0.3 }),
    F: P({ px: 0.04, py: 0.58, sp: 0.4, ch: 0.12, hd: -0.25, tw: 0.35, fFx: 0.36, fBx: -0.3, kB: 0.3, hF: 0, hB: 0.7, gx: 0.0, gy: 1.16, ga: 1.8, gw: 0, ...OPEN, ox: 0.34, oy: 0.3, oa: -1.5, ...OOPEN, fr: 0.14, fs: 1.1, zz: 0 }),
  },
  // 雷柱 Thunder Pillar: 金雞獨立 golden rooster — knee up, sword fingers to the sky (the glyph gathers overhead, ground sigil opens)
  // → stamp into a horse stance and drive the sword fingers down at the foe; held while the pillar comes down
  s2: {
    A: P({ px: -0.02, py: 0.86, sp: -0.04, ch: -0.08, hd: 0.16, tw: 0.15, ctw: -0.05, fFx: 0.12, fFy: 0.5, aF: -0.3, fBx: -0.1, hF: 0, hB: 0, kB: 0, gx: 0.08, gy: 1.86, ga: 1.5, gw: 0, ...SWORD, ox: 0.16, oy: 0.98, oa: -1.5, ...OOPEN, fr: 0.2, fs: 1.45, gs: 0.6 }),
    B: P({ px: 0.06, py: 0.66, sp: 0.24, ch: 0.06, hd: -0.12, tw: 0.42, ctw: 0.08, fFx: 0.42, fBx: -0.4, hF: 0, hB: 0, kF: -0.2, kB: 0.55, gx: 0.42, gy: 1.04, ga: -0.45, gw: 0, ...SWORD, ox: -0.05, oy: 0.96, oa: -1.5, ...OFIST, fr: 0.15, fs: 1.15, gs: 1 }),
    S: P({ px: 0.065, py: 0.66, sp: 0.25, ch: 0.06, hd: -0.12, tw: 0.43, ctw: 0.09, fFx: 0.42, fBx: -0.4, hF: 0, hB: 0, kF: -0.2, kB: 0.55, gx: 0.44, gy: 1.03, ga: -0.47, gw: 0, ...SWORD, ox: -0.05, oy: 0.96, oa: -1.5, ...OFIST, fr: 0.15, fs: 1.1, gs: 1 }),
    F: P({ px: 0.06, py: 0.67, sp: 0.24, ch: 0.06, hd: -0.12, tw: 0.42, ctw: 0.08, fFx: 0.42, fBx: -0.4, hF: 0, hB: 0, kF: -0.2, kB: 0.5, gx: 0.43, gy: 1.04, ga: -0.45, gw: 0, ...SWORD, ox: -0.04, oy: 0.97, oa: -1.5, ...OFIST, fr: 0.15, fs: 1.05, gs: 0.6 }),
  },
};
// 星隕天降 Starfall: taiji opening — arms sweep wide and low while turning (full turn), rise through a horse stance → 雙托天 both palms
// to the sky, a giant glyph above (held through the meteors) → closing: palms press down, the sigil fades
const ULT = {
  W1: P({ sy: -Math.PI, pv: 0.0, py: 0.7, sp: 0.16, ch: 0.04, hd: -0.05, tw: 0.2, ctw: 0, fFx: 0.32, fBx: -0.34, hF: 0.4, hB: 0.4, kB: 0.2, gx: 0.34, gy: 0.82, ga: -1.2, gw: 0.4, ...OPEN, ox: -0.12, oy: 0.86, oa: -1.6, ...OOPEN, fr: 0.14, fs: 1.3, gs: 0.5 }),
  W2: P({ sy: -TAU + 0.25, pv: 0.0, py: 0.66, sp: 0.06, ch: -0.06, hd: 0.12, tw: 0.3, ctw: 0, fFx: 0.4, fBx: -0.4, hF: 0, hB: 0, kF: -0.2, kB: 0.5, gx: 0.3, gy: 1.42, ga: 1.2, gw: 0, ...OPEN, ox: -0.02, oy: 1.42, oa: 1.2, ...OOPEN, fr: 0.25, fs: 2.0, gs: 0.9 }),
  C: P({ sy: -TAU, pv: 0.0, py: 0.66, sp: -0.02, ch: -0.16, hd: 0.36, tw: 0.3, ctw: 0, fFx: 0.4, fBx: -0.4, hF: 0, hB: 0, kF: -0.2, kB: 0.5, gx: 0.12, gy: 1.95, ga: 1.57, gw: 0, ...OPEN, ox: 0.06, oy: 1.95, oa: 1.57, ...OOPEN, fr: 0.45, fs: 3.2, gs: 1.2 }),
  S: P({ sy: -TAU, pv: 0.0, py: 0.66, sp: -0.03, ch: -0.17, hd: 0.38, tw: 0.3, ctw: 0, fFx: 0.4, fBx: -0.4, hF: 0, hB: 0, kF: -0.2, kB: 0.5, gx: 0.12, gy: 1.97, ga: 1.57, gw: 0, ...OPEN, ox: 0.06, oy: 1.97, oa: 1.57, ...OOPEN, fr: 0.47, fs: 3.3, gs: 1.2 }),
  H: P({ sy: -TAU, pv: 0.0, py: 0.67, sp: -0.02, ch: -0.15, hd: 0.34, tw: 0.3, ctw: 0, fFx: 0.4, fBx: -0.4, hF: 0, hB: 0, kF: -0.2, kB: 0.5, gx: 0.12, gy: 1.95, ga: 1.57, gw: 0, ...OPEN, ox: 0.06, oy: 1.95, oa: 1.57, ...OOPEN, fr: 0.45, fs: 3.0, gs: 1.1 }),
  D: P({ sy: -TAU, pv: 0.0, py: 0.72, sp: 0.1, ch: 0.04, hd: -0.06, tw: 0.3, ctw: 0, fFx: 0.38, fBx: -0.38, hF: 0, hB: 0, kB: 0.3, gx: 0.3, gy: 0.96, ga: -1.5, gw: 0, ...OPEN, ox: 0.26, oy: 0.97, oa: -1.5, ...OOPEN, fr: 0.14, fs: 1.0, gs: 0.3 }),
};

/** keys for a move. FX cues ride on keys: stamp (dust + ground ring at the front foot), slide (dust at the back foot), ring
 *  (air ring), sink (dropping into a horse stance), gust (the spell's backwash blows the cape / hair / skirt back) */
export function moveKeys(key, m) {
  const t = m.t, f = F[key];
  switch (key) {
    case 'a1': return form(t, [['s', 0.6, f.A, 'coil'], ['a', 0, f.S, 'snap', 'slide'], ['a', 0.02, f.S, 'hold', 'gust'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a2': return form(t, [['s', 0.58, f.A, 'coil'], ['a', 0, f.S, 'snap', 'slide'], ['a', 0.02, f.S, 'hold', 'gust'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a3': return form(t, [['s', 0.42, f.A, 'inQuad', 'ring'], ['s', 0.8, f.A2, 'coil', 'sink'], ['a', 0, f.S, 'snap', 'stamp'], ['a', 0.02, f.S, 'hold', 'gust'], ['a', 1, f.E, 'whip'], ['r', 0.3, f.F, 'settle'], ['r', 0.82, f.H, 'hold'], ['x', 0.06, SPUN, 'inOutSine']]);
    case 'air1': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'gust'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, POSES.fall, 'inOutSine']]);
    case 'air2': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'gust'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, POSES.fall, 'inOutSine']]);
    case 's1': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap'], ['a', 0.6, f.R, 'outQuad', 'stamp'], ['r', 0.5, f.F, 'settle'], ['x', 0.06, STANCE, 'inOutSine']]);
    case 's2': return form(t, [['s', 0.55, f.A, 'coil'], ['s', 0.91, f.B, 'snap', 'stamp'], ['a', 0, f.S, 'hold', 'gust'], ['a', 1, f.S, 'hold'], ['r', 0.5, f.F, 'settle'], ['r', 0.85, f.F, 'hold'], ['x', 0.06, STANCE, 'inOutSine']]);
    case 'ult': return form(t, [['s', 0.35, ULT.W1, 'coil', 'ring'], ['s', 0.72, ULT.W2, 'inOutSine', 'sink'], ['s', 0.93, ULT.C, 'snap', 'stamp'], ['a', 0, ULT.S, 'hold', 'gust'], ['a', 1, ULT.S, 'hold', 'ring'],
      ['r', 0.55, ULT.H, 'settle'], ['r', 0.72, ULT.H, 'hold'], ['r', 0.95, ULT.D, 'inOutSine'], ['x', 0.08, SPUN, 'inOutSine']]);
    default: return null;
  }
}
/** the key that lands on the first active frame (contact) — tests assert it sits exactly at startup */
export const contactPose = (key) => (key === 'ult' ? ULT.S : F[key] && F[key].S);
export const FORMS = { ...F, ult: ULT };
/** win: gather → flourish (focus spins out) → final pose */
export const winKeys = (Pz) => [{ t: 0, p: 'from' }, { t: 0.3, p: Pz.winA, e: 'coil' }, { t: 0.5, p: Pz.winB, e: 'snap' }, { t: 0.95, p: Pz.winB, e: 'hold' }, { t: 1.5, p: Pz.win, e: 'settle' }];
export const PROFILE = {
  id: 'mage', stance: STANCE, poses: POSES, moveKeys, winKeys, airMoves: ['air1', 'air2'],
  step: { lift: 0.05, liftWalk: 0.055, durWalk: 0.21 },
  lead: 0.03,                                              // power-chain lead (s)
  focus: true,                                             // casting focus instead of a blade: trail + cast point = the glyph ahead of the palm
};
