// 拳師 BRAWLER — anime phase 3: cyber street martial artist on the HQ rig. Pure data + clip builders (node-tested).
// Kung fu / karate mechanics, not boxing pantomime: every strike runs the SIX-LINK POWER CHAIN feet → hips → torso → shoulder →
// elbow (the IK hand target, lead 0.18) → fist (the corkscrew roll, exactly on time: chambered palm-up 仰拳 → palm-down at impact,
// or a vertical 日字 fist), with an EXHALE SNAP (kiai face, breath puff, chest squash kick) on the contact frame.
//   Stance: 子午馬 half-horse guard — wide and low, knees splayed out, weight 60 % back, lead fist forward at chin height (問手),
//   rear fist guarding the chin (護手). Low stances everywhere: horse 馬步 (s2 / ult finish / a4 coil), bow 弓步 (a2 / s1),
//   cat 虛步 / golden rooster 金雞獨立 (a3 / s2 wind-ups).
//   Footwork entries: 寸步 sliding step (a1), rear-foot pivot into a bow stance (a2), 震腳 stamp-step (a3, s2, ult finish: dust +
//   double shockwave), the knee-drive rise (a4), the flying bow-stance glide (s1).
// Combo (frame windows unchanged from classes.js): a1 刺拳 sliding-step jab · a2 弓步衝拳 rear cross in a bow stance (lead fist pulls
// back to the chin: push–pull) · a3 頂心肘 stamping heart-piercing elbow (the "hook" is thrown as a short hooking elbow, the rear
// fist braces the lead fist) · a4 沖天炮 knee-drive rising uppercut from a horse-stance sink (launcher; finish HELD). air1 飛膝 flying
// knee with a clinch pull · air2 鐵鎚 double hammer fist. s1 火箭衝拳 rocket punch: the cyber arm chambers far back at the hip, held,
// then a flying bow-stance glide with a corkscrew punch and a braking skid. s2 震地拳 golden rooster → 震腳 stomp into a deep horse
// stance, both hammer fists into the floor (big shockwave). ult 百裂拳: six 日字 chain punches while stepping in → hooking elbow →
// rising knee → 震腳 stomp + horse-stance cross, HELD (the finishing pose).
import { form } from './clip.js';

const A0 = 0.075, PI = Math.PI, H = PI / 2;
export const STANCE = {
  px: 0.0, py: 0.79, pt: 0.06, sp: 0.08, ch: 0.06, tw: 0.42, ctw: -0.06, hd: -0.1, rr: 0,
  fFx: 0.4, fFy: A0, fBx: -0.42, fBy: A0, aF: 0, aB: 0,
  gx: 0.44, gy: 1.37, ga: H, gw: 0, ox: 0.27, oy: 1.31, oh: 0,
  sy: 0, pv: 0, hF: 0.1, hB: 0, kF: -0.1, kB: 0.34, sh: 0,
  cF1: 1, cF2: 1, cB1: 1, cB2: 1, oa: H, fr: 0, fs: 0, gs: 0, zz: 0,   // fists (no finger bones); focus / sigil / blink channels stay 0
};
const P = (o) => ({ ...STANCE, ...o });
const AIR = { py: 0.95, fFx: 0.2, fFy: 0.42, fBx: -0.12, fBy: 0.3, aF: 0.3, aB: -0.4, hF: 0, hB: 0, kF: 0, kB: 0 };
const HORSE = { fFx: 0.5, fBx: -0.48, kF: -0.28, kB: 0.62, hF: 0, hB: 0 };

export const POSES = {
  stance: STANCE,
  idle1: P({ py: 0.805, ch: 0.09, sp: 0.07, hd: -0.12, gy: 1.4, oy: 1.34, ga: H + 0.08 }),                    // breath in: chest rises, fists lift
  shuffle: P({ px: 0.06, fFx: 0.48, fBx: -0.36, py: 0.78, hF: 0.25, tw: 0.48, gx: 0.48 }),                   // a short probing half-step in
  walk: P({ py: 0.77, sp: 0.1, hd: -0.12, gx: 0.46, gy: 1.36, ox: 0.28, oy: 1.32, hF: 0.15 }),
  walkBack: P({ px: -0.04, py: 0.79, sp: 0.05, gx: 0.42, gy: 1.42, ox: 0.25, oy: 1.36, hF: 0.25 }),
  turn: P({ py: 0.82, sp: 0.08, tw: 0, ctw: 0, gx: 0.3, gy: 1.42, ox: 0.2, oy: 1.4, hF: 0.7, hB: 0.7, kF: 0, kB: 0 }),   // pivot on the balls of the feet
  // guard: 鐵橋 iron bridge — both forearms up in front of the face / chest in a horse-ish stance
  guard: P({ px: -0.03, py: 0.72, sp: 0.06, ch: 0.0, tw: 0.5, ctw: 0, hd: 0.0, ...HORSE, fFx: 0.44, fBx: -0.44, gx: 0.38, gy: 1.46, ga: H, ox: 0.32, oy: 1.3, oa: H }),
  block: P({ px: -0.12, py: 0.69, sp: -0.02, ch: -0.14, tw: 0.46, ctw: 0, hd: 0.14, ...HORSE, fFx: 0.42, fBx: -0.5, gx: 0.34, gy: 1.46, ga: H, ox: 0.3, oy: 1.32, oa: H }),
  jump: P({ ...AIR, sp: 0.06, gx: 0.32, gy: 1.48, ga: H, ox: 0.2, oy: 1.42, oa: H }),
  fall: P({ py: 0.95, fFx: 0.3, fFy: 0.2, fBx: -0.18, fBy: 0.12, aF: 0.15, aB: -0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.38, gy: 1.3, ga: 0.6, ox: -0.22, oy: 1.18, oa: 1.2 }),
  land: P({ py: 0.6, sp: 0.42, ch: 0.14, hd: -0.22, fFx: 0.42, fBx: -0.4, kF: -0.2, kB: 0.4, hF: 0, hB: 0.6, gx: 0.38, gy: 0.4, ga: H, ox: -0.12, oy: 1.0, oa: 1.2 }),   // three-point landing: lead fist on the floor
  tuck: P({ py: 0.95, sp: 0.6, ch: 0.3, hd: 0.35, tw: 0, ctw: 0, fFx: 0.2, fFy: 0.72, fBx: 0.08, fBy: 0.62, aF: -0.3, aB: -0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.3, gy: 1.0, ox: 0.26, oy: 1.0 }),
  dodge: P({ py: 0.6, sp: 0.6, ch: 0.25, hd: 0.3, tw: 0, ctw: 0, fFx: 0.25, fFy: 0.42, fBx: 0.05, fBy: 0.32, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.3, gy: 0.85, ox: 0.25, oy: 0.82 }),
  // directional hit reactions (scaled by hit strength in the animator)
  hitHigh: P({ px: -0.12, py: 0.84, hd: -0.7, ch: -0.35, sp: -0.15, tw: 0.1, ctw: -0.25, fBx: -0.5, hF: 0, hB: 0.6, kB: 0.1, gx: 0.18, gy: 1.5, ga: 1.8, ox: -0.3, oy: 1.45, oa: 1.6 }),
  hitMid: P({ px: -0.18, py: 0.76, hd: 0.4, ch: 0.1, sp: 0.4, tw: 0.25, ctw: 0.12, fBx: -0.5, hF: 0, gx: 0.28, gy: 1.0, ga: 1.0, ox: 0.15, oy: 1.02, oa: 1.0 }),
  hitBack: P({ px: 0.14, py: 0.8, hd: -0.4, sp: -0.2, ch: -0.3, tw: 0.3, fFx: 0.48, hF: 0, gx: 0.1, gy: 1.3, ga: 2.0, ox: -0.4, oy: 1.3, oa: 2.0 }),
  stagger: P({ px: -0.24, py: 0.72, hd: 0.35, ch: -0.3, sp: 0.12, tw: 0.7, ctw: 0.2, fBx: -0.58, kB: 0.4, hF: 0, hB: 0, gx: 0.08, gy: 1.3, ga: 2.0, ox: -0.45, oy: 1.45, oa: 2.0 }),
  airHit: P({ rr: -0.6, py: 0.95, sp: -0.22, ch: -0.2, hd: 0.32, fFx: 0.36, fFy: 0.38, fBx: 0.08, fBy: 0.18, aF: 0.4, aB: 0.2, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.1, gy: 1.62, ga: 2.0, ox: -0.46, oy: 1.62, oa: 2.0 }),
  spiked: P({ rr: 0.5, py: 0.95, sp: 0.35, ch: 0.2, hd: -0.4, fFx: 0.1, fFy: 0.15, fBx: -0.25, fBy: 0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.3, gy: 1.7, ga: 2.0, ox: -0.2, oy: 1.75, oa: 2.0 }),
  down: P({ rr: -1.5, py: 0.02, px: 0, pt: 0, sp: -0.05, ch: 0, hd: 0.35, tw: 0.05, ctw: 0, fFx: 0.2, fFy: -0.74, fBx: 0, fBy: -0.8, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kF: 0, kB: 0, gx: -0.3, gy: 1.3, ga: 2.8, ox: 0.3, oy: 1.35, oa: 0 }),
  downB: P({ rr: -1.32, py: 0.1, px: 0, pt: 0, sp: 0.05, ch: 0.05, hd: 0.2, tw: 0.05, ctw: 0, fFx: 0.3, fFy: -0.6, fBx: 0.1, fBy: -0.7, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kF: 0, kB: 0, gx: -0.2, gy: 1.4, ga: 2.6, ox: 0.35, oy: 1.4, oa: 0 }),   // bounce
  ko: P({ rr: -1.52, py: 0.02, px: 0, pt: 0, sp: -0.08, ch: -0.05, hd: 0.5, tw: 0.1, ctw: 0, fFx: 0.3, fFy: -0.7, fBx: -0.05, fBy: -0.82, aF: 0.6, aB: 0.6, hF: 0, hB: 0, kF: 0, kB: 0, gx: -0.4, gy: 1.6, ga: 2.9, ox: 0.45, oy: 1.6, oa: 0 }),
  // tech roll: backward roll over the shoulder → kneel (lead fist on the floor) → stance
  rollB: P({ rr: -3.5, py: 0.5, sp: 0.62, ch: 0.3, hd: 0.45, tw: 0, ctw: 0, fFx: 0.22, fFy: 0.6, fBx: 0.12, fBy: 0.52, aF: -0.3, aB: -0.3, hF: 0, hB: 0, kF: 0, kB: 0, gx: 0.28, gy: 1.0, ga: 1.2, ox: 0.3, oy: 0.95 }),
  kneel: P({ rr: -PI * 2 + 0.5, py: 0.5, sp: 0.35, ch: 0.12, hd: -0.3, fFx: 0.34, fFy: A0, fBx: -0.22, fBy: 0.1, hF: 0, hB: 0.9, kF: 0, kB: 0.2, gx: 0.42, gy: 0.36, ga: H, ox: 0.2, oy: 1.1 }),
  stun: P({ py: 0.78, sp: -0.15, ch: -0.22, hd: 0.5, tw: 0.1, hF: 0, hB: 0, gx: 0.3, gy: 0.8, ga: 1.2, ox: -0.1, oy: 0.82, oa: 1.2 }),
  // win: 收功 sink into a horse stance with both fists chambered → one slow exhaled punch (held) → 抱拳禮 fist-to-fist salute, standing tall
  winA: P({ py: 0.66, sp: 0.06, ch: 0.04, tw: 0.42, ctw: 0, hd: -0.05, ...HORSE, gx: 0.02, gy: 1.0, ga: PI, ox: -0.04, oy: 1.0, oa: PI }),
  winB: P({ px: 0.06, py: 0.66, sp: 0.12, tw: 0.2, ctw: -0.4, hd: -0.1, ...HORSE, gx: 0.02, gy: 1.0, ga: PI, ox: 0.9, oy: 1.26, oa: 0 }),
  win: P({ px: -0.02, py: 0.9, sp: 0.1, ch: 0.04, tw: 0.25, ctw: -0.05, hd: 0.08, fFx: 0.2, fBx: -0.22, hF: 0, hB: 0, kF: 0, kB: 0.1, gx: 0.36, gy: 1.32, ga: H, ox: 0.36, oy: 1.34, oa: H }),
};

// ------------------------------------------------------------------ attack forms (F[move] = named key poses)
const F = {
  // 刺拳 Sliding-step jab (lead fist): settle back, the front foot unweights → 寸步 slide, hips snap forward, lead shoulder rolls in,
  // the vertical guard fist corkscrews to palm-down at full reach; the rear fist never leaves the chin
  a1: {
    A: P({ px: -0.03, py: 0.77, sp: 0.06, tw: 0.3, ctw: -0.14, fFx: 0.38, fFy: 0.095, aF: 0.12, hF: 0, kB: 0.38, gx: 0.36, gy: 1.35, ga: H, ox: 0.27, oy: 1.33, oa: H }),
    S: P({ px: 0.1, py: 0.77, sp: 0.16, ch: 0.06, hd: -0.14, tw: 0.62, ctw: 0.22, fFx: 0.52, fBx: -0.38, hF: 0, hB: 0.35, kB: 0.25, gx: 0.92, gy: 1.4, ga: 0.14, ox: 0.27, oy: 1.38, oa: H }),
    E: P({ px: 0.12, py: 0.77, sp: 0.17, ch: 0.06, hd: -0.14, tw: 0.66, ctw: 0.26, fFx: 0.52, fBx: -0.38, hF: 0, hB: 0.35, kB: 0.25, gx: 0.98, gy: 1.41, ga: 0.0, ox: 0.27, oy: 1.38, oa: H }),
    F: P({ px: 0.08, py: 0.78, sp: 0.12, hd: -0.12, tw: 0.5, ctw: 0.04, fFx: 0.5, fBx: -0.4, hF: 0, hB: 0.2, kB: 0.3, gx: 0.6, gy: 1.38, ga: 0.7, ox: 0.27, oy: 1.34, oa: H }),
  },
  // 弓步衝拳 Bow-stance cross (rear fist): hips coil back, the rear fist chambers palm-up at the hip while the lead hand measures →
  // the rear heel pivots, the back leg straightens into a bow stance, hips + shoulders square through, the fist corkscrews palm-down;
  // the lead fist pulls back to the chin (push–pull)
  a2: {
    A: P({ px: -0.02, py: 0.75, sp: 0.08, tw: 0.64, ctw: 0.05, fFx: 0.44, fBx: -0.44, hF: 0, hB: 0, kB: 0.42, gx: 0.64, gy: 1.36, ga: 0.9, ox: -0.02, oy: 1.0, oa: PI }),
    S: P({ px: 0.14, py: 0.73, sp: 0.2, ch: 0.06, hd: -0.14, tw: -0.05, ctw: -0.42, fFx: 0.56, fBx: -0.5, hF: 0, hB: 0.65, kF: -0.08, kB: 0.05, gx: 0.3, gy: 1.4, ga: H, ox: 0.94, oy: 1.36, oa: 0.12 }),
    E: P({ px: 0.16, py: 0.73, sp: 0.21, ch: 0.06, hd: -0.14, tw: -0.1, ctw: -0.45, fFx: 0.56, fBx: -0.5, hF: 0, hB: 0.68, kF: -0.08, kB: 0.05, gx: 0.29, gy: 1.4, ga: H, ox: 1.0, oy: 1.37, oa: 0.0 }),
    F: P({ px: 0.1, py: 0.75, sp: 0.14, hd: -0.12, tw: 0.15, ctw: -0.25, fFx: 0.54, fBx: -0.48, hF: 0, hB: 0.4, kB: 0.2, gx: 0.36, gy: 1.38, ga: H, ox: 0.56, oy: 1.34, oa: 0.8 }),
  },
  // 頂心肘 Stamping heart-piercing elbow (lead elbow): the lead knee lifts (weight on the back leg), the lead arm folds with the fist at
  // the chest, the shoulder coils back → 震腳 stamp-step into a horse stance, the elbow point drives forward at chest height, the rear
  // fist braces the lead fist
  a3: {
    A: P({ px: -0.04, py: 0.82, sp: 0.04, ch: 0.04, tw: 0.22, ctw: -0.28, fFx: 0.24, fFy: 0.24, aF: 0.2, fBx: -0.36, hF: 0, hB: 0, kF: 0, kB: 0.25, gx: 0.12, gy: 1.32, ga: H, ox: 0.2, oy: 1.36, oa: H }),
    S: P({ px: 0.16, py: 0.68, sp: 0.18, ch: 0.05, hd: -0.12, tw: 0.72, ctw: 0.3, fFx: 0.58, fBx: -0.4, kF: -0.16, kB: 0.5, hF: 0, hB: 0, gx: 0.43, gy: 1.32, ga: 0.3, ox: 0.38, oy: 1.28, oa: H }),
    E: P({ px: 0.19, py: 0.67, sp: 0.2, ch: 0.05, hd: -0.12, tw: 0.78, ctw: 0.34, fFx: 0.58, fBx: -0.4, kF: -0.16, kB: 0.5, hF: 0, hB: 0, gx: 0.47, gy: 1.32, ga: 0.2, ox: 0.42, oy: 1.28, oa: H }),
    F: P({ px: 0.14, py: 0.7, sp: 0.14, hd: -0.1, tw: 0.6, ctw: 0.14, fFx: 0.56, fBx: -0.42, kF: -0.14, kB: 0.45, hF: 0, hB: 0, gx: 0.46, gy: 1.36, ga: 0.8, ox: 0.3, oy: 1.34, oa: H }),
  },
  // 沖天炮 Knee-drive rising uppercut (rear fist, launcher): sink into a horse stance with the rear fist chambered low by the hip → the legs
  // drive up, the rear heel pivots, the hips turn through and the fist rises under the chin line → rises overhead on the toes; HELD
  a4: {
    A: P({ px: -0.02, py: 0.63, sp: 0.3, ch: 0.12, hd: -0.16, tw: 0.62, ctw: 0.1, ...HORSE, fFx: 0.46, fBx: -0.46, gx: 0.36, gy: 1.2, ga: H, ox: 0.04, oy: 0.86, oa: PI * 0.85 }),
    S: P({ px: 0.12, py: 0.86, sp: 0.06, ch: -0.04, hd: -0.05, tw: 0.0, ctw: -0.36, fFx: 0.5, fBx: -0.42, kF: 0, kB: 0.1, hF: 0, hB: 0.7, gx: 0.3, gy: 1.46, ga: H, ox: 0.6, oy: 1.38, oa: H }),
    E: P({ px: 0.14, py: 0.92, sp: -0.06, ch: -0.1, hd: 0.14, tw: -0.08, ctw: -0.4, fFx: 0.5, fBx: -0.42, kF: 0, kB: 0.05, hF: 0.35, hB: 0.85, gx: 0.3, gy: 1.48, ga: H, ox: 0.5, oy: 1.94, oa: H }),
    F: P({ px: 0.13, py: 0.9, sp: -0.04, ch: -0.08, hd: 0.12, tw: -0.06, ctw: -0.38, fFx: 0.5, fBx: -0.42, kF: 0, kB: 0.05, hF: 0.25, hB: 0.8, gx: 0.3, gy: 1.46, ga: H, ox: 0.48, oy: 1.9, oa: H }),
    H: P({ px: 0.12, py: 0.89, sp: -0.03, ch: -0.07, hd: 0.1, tw: -0.05, ctw: -0.37, fFx: 0.5, fBx: -0.42, kF: 0, kB: 0.05, hF: 0.2, hB: 0.78, gx: 0.31, gy: 1.45, ga: H, ox: 0.47, oy: 1.88, oa: H }),
  },
  // 飛膝 Flying knee: knee tucked, fists high → the lead knee drives forward-up while both fists pull down (clinch pull), the rear leg
  // extends back for the counter-balance
  air1: {
    A: P({ ...AIR, sp: -0.05, tw: 0.3, ctw: 0, fFx: 0.12, fFy: 0.5, gx: 0.34, gy: 1.62, ga: H, ox: 0.24, oy: 1.6, oa: H }),
    S: P({ ...AIR, px: 0.06, sp: 0.14, ch: 0.06, hd: -0.12, tw: 0.4, ctw: 0.05, fFx: 0.28, fFy: 0.72, aF: -0.5, fBx: -0.32, fBy: 0.26, gx: 0.62, gy: 1.3, ga: H, ox: 0.56, oy: 1.28, oa: H }),
    E: P({ ...AIR, px: 0.07, sp: 0.16, ch: 0.06, hd: -0.12, tw: 0.42, ctw: 0.06, fFx: 0.3, fFy: 0.78, aF: -0.5, fBx: -0.34, fBy: 0.24, gx: 0.6, gy: 1.24, ga: H, ox: 0.54, oy: 1.22, oa: H }),
    F: P({ ...AIR, sp: 0.08, tw: 0.35, gx: 0.42, gy: 1.42, ga: H, ox: 0.28, oy: 1.4, oa: H }),
  },
  // 鐵鎚 Double hammer fist (spike): both fists clasped overhead, the body leans back → rolls forward, the hammer smashes down
  air2: {
    A: P({ ...AIR, rr: -0.25, sp: -0.12, ch: -0.12, tw: 0.1, ctw: 0, gx: 0.06, gy: 1.95, ga: H, ox: 0.0, oy: 1.92, oa: H }),
    S: P({ ...AIR, rr: 0.25, sp: 0.32, ch: 0.1, hd: -0.15, tw: 0.3, ctw: 0.1, gx: 0.58, gy: 1.02, ga: H, ox: 0.54, oy: 1.0, oa: H }),
    E: P({ ...AIR, rr: 0.38, sp: 0.4, ch: 0.12, hd: -0.18, tw: 0.3, ctw: 0.12, gx: 0.5, gy: 0.64, ga: H, ox: 0.46, oy: 0.62, oa: H }),
    F: P({ ...AIR, rr: 0.3, sp: 0.34, tw: 0.3, gx: 0.42, gy: 0.62, ga: H, ox: 0.38, oy: 0.6, oa: H }),
  },
  // 火箭衝拳 Rocket punch: the cyber arm chambers far back at the hip (palm up), shoulder coiled, the guard hand aims; HELD (charge) →
  // a flying bow-stance glide, the fist corkscrews out at head height, extension held through the dash → braking skid
  s1: {
    A: P({ px: -0.08, py: 0.66, sp: 0.34, ch: 0.1, hd: -0.25, tw: 0.15, ctw: -0.4, fFx: 0.44, fBx: -0.52, kF: -0.15, kB: 0.5, hF: 0, hB: 0, gx: -0.1, gy: 0.86, ga: PI, ox: 0.38, oy: 1.28, oa: H }),
    A2: P({ px: -0.09, py: 0.64, sp: 0.36, ch: 0.1, hd: -0.27, tw: 0.13, ctw: -0.42, fFx: 0.44, fBx: -0.52, kF: -0.15, kB: 0.52, hF: 0, hB: 0, gx: -0.12, gy: 0.85, ga: PI, ox: 0.38, oy: 1.28, oa: H }),
    S: P({ px: 0.22, py: 0.68, sp: 0.44, ch: 0.12, hd: -0.4, tw: 0.7, ctw: 0.35, fFx: 0.74, fBx: -0.7, aB: -0.3, hF: 0, hB: 0.9, kF: 0, kB: 0.1, gx: 1.0, gy: 1.26, ga: 0.0, ox: 0.4, oy: 1.32, oa: H }),
    E: P({ px: 0.23, py: 0.68, sp: 0.45, ch: 0.12, hd: -0.42, tw: 0.72, ctw: 0.36, fFx: 0.74, fBx: -0.7, aB: -0.3, hF: 0, hB: 0.9, kF: 0, kB: 0.1, gx: 1.04, gy: 1.26, ga: 0.0, ox: 0.4, oy: 1.32, oa: H }),
    F: P({ px: 0.12, py: 0.7, sp: 0.3, hd: -0.28, tw: 0.5, ctw: 0.1, fFx: 0.64, fBx: -0.55, hF: 0, hB: 0.6, kF: -0.1, kB: 0.3, gx: 0.62, gy: 1.34, ga: 0.6, ox: 0.32, oy: 1.34, oa: H }),
  },
  // 震地拳 Quake slam: 金雞獨立 golden rooster — lead knee high, both fists overhead → drop → 震腳 stomp into a deep horse stance, both
  // hammer fists into the floor (the shockwave), held through the active window, then rise to guard
  s2: {
    A: P({ px: -0.02, py: 0.88, sp: -0.06, ch: -0.1, hd: 0.12, tw: 0.3, ctw: 0, fFx: 0.16, fFy: 0.56, aF: -0.2, fBx: -0.18, hF: 0, hB: 0, kF: 0, kB: 0.05, gx: 0.16, gy: 1.96, ga: H, ox: 0.02, oy: 1.9, oa: H }),
    B: P({ px: 0.04, py: 0.74, sp: 0.2, ch: 0.06, hd: -0.05, tw: 0.45, ctw: 0.05, fFx: 0.44, fFy: 0.15, aF: 0, fBx: -0.4, hF: 0, hB: 0, kF: -0.1, kB: 0.4, gx: 0.46, gy: 1.6, ga: H, ox: 0.34, oy: 1.55, oa: H }),
    S: P({ px: 0.1, py: 0.55, sp: 0.62, ch: 0.2, hd: -0.2, tw: 0.55, ctw: 0.1, ...HORSE, fFx: 0.52, fBx: -0.48, kF: -0.3, kB: 0.65, gx: 0.62, gy: 0.42, ga: H, ox: 0.5, oy: 0.44, oa: H }),
    F: P({ px: 0.06, py: 0.7, sp: 0.26, ch: 0.08, hd: -0.12, tw: 0.5, ctw: 0.0, ...HORSE, fFx: 0.48, fBx: -0.46, gx: 0.44, gy: 1.2, ga: H, ox: 0.3, oy: 1.22, oa: H }),
  },
};
// 百裂拳 Hundred Fists: chamber both fists at the hips → six 日字 chain punches (vertical fists, rolling over each other on the centre line)
// stepping in → 擺肘 hooking elbow → 提膝 rising knee (clinch pull) → 震腳 stomp + horse-stance cross — HELD finishing pose
const ULT = {
  A: P({ py: 0.68, sp: 0.12, tw: 0.42, ctw: 0, ...HORSE, fFx: 0.46, fBx: -0.46, gx: 0.02, gy: 1.0, ga: PI, ox: -0.02, oy: 1.0, oa: PI }),
  CF: P({ px: 0.08, py: 0.74, sp: 0.14, hd: -0.12, tw: 0.36, ctw: 0.12, fFx: 0.5, fBx: -0.4, hF: 0, hB: 0.3, kF: -0.1, kB: 0.3, gx: 0.9, gy: 1.3, ga: H, ox: 0.3, oy: 1.26, oa: H }),
  CB: P({ px: 0.09, py: 0.74, sp: 0.15, hd: -0.12, tw: 0.2, ctw: -0.12, fFx: 0.5, fBx: -0.4, hF: 0, hB: 0.4, kF: -0.1, kB: 0.3, gx: 0.34, gy: 1.3, ga: H, ox: 0.88, oy: 1.24, oa: H }),
  MF: P({ px: 0.08, py: 0.75, sp: 0.13, hd: -0.12, tw: 0.3, ctw: 0.0, fFx: 0.5, fBx: -0.4, hF: 0, hB: 0.35, kF: -0.1, kB: 0.3, gx: 0.58, gy: 1.36, ga: H, ox: 0.6, oy: 1.22, oa: H }),   // fists crossing
  W6: P({ px: 0.06, py: 0.76, sp: 0.06, tw: 0.24, ctw: -0.28, fFx: 0.42, fBx: -0.4, hF: 0, hB: 0, kF: -0.1, kB: 0.3, gx: 0.12, gy: 1.32, ga: H, ox: 0.24, oy: 1.34, oa: H }),
  E6: P({ px: 0.16, py: 0.7, sp: 0.18, hd: -0.12, tw: 0.72, ctw: 0.3, fFx: 0.56, fBx: -0.4, kF: -0.16, kB: 0.5, hF: 0, hB: 0, gx: 0.43, gy: 1.32, ga: 0.3, ox: 0.38, oy: 1.28, oa: H }),
  W7: P({ px: 0.1, py: 0.8, sp: 0.02, tw: 0.4, ctw: 0, fFx: 0.48, fBx: -0.3, hF: 0, hB: 0.5, kF: 0, kB: 0.1, gx: 0.6, gy: 1.6, ga: H, ox: 0.52, oy: 1.58, oa: H }),
  K7: P({ px: 0.16, py: 0.84, sp: 0.12, ch: 0.06, hd: -0.12, tw: 0.3, ctw: 0, fFx: 0.48, fBx: 0.16, fBy: 0.46, aB: -0.4, hF: 0.3, hB: 0, kF: 0, kB: 0, gx: 0.56, gy: 1.22, ga: H, ox: 0.5, oy: 1.2, oa: H }),
  W8: P({ px: 0.06, py: 0.82, sp: 0.04, tw: 0.62, ctw: 0.1, fFx: 0.26, fFy: 0.28, aF: 0.15, fBx: -0.36, hF: 0, hB: 0, kF: 0, kB: 0.2, gx: 0.36, gy: 1.36, ga: H, ox: -0.02, oy: 1.0, oa: PI }),
  C8: P({ px: 0.12, py: 0.6, sp: 0.2, ch: 0.06, hd: -0.16, tw: 0.08, ctw: -0.56, ...HORSE, fFx: 0.54, fBx: -0.5, kF: -0.3, kB: 0.66, gx: 0.02, gy: 1.0, ga: PI, ox: 0.96, oy: 1.24, oa: 0.06 }),
  E8: P({ px: 0.13, py: 0.59, sp: 0.21, ch: 0.06, hd: -0.16, tw: 0.04, ctw: -0.58, ...HORSE, fFx: 0.54, fBx: -0.5, kF: -0.3, kB: 0.66, gx: 0.0, gy: 1.0, ga: PI, ox: 1.0, oy: 1.25, oa: 0.0 }),
  Hz: P({ px: 0.12, py: 0.6, sp: 0.2, ch: 0.06, hd: -0.15, tw: 0.05, ctw: -0.57, ...HORSE, fFx: 0.54, fBx: -0.5, kF: -0.3, kB: 0.66, gx: 0.01, gy: 1.0, ga: PI, ox: 0.98, oy: 1.25, oa: 0.02 }),
};
/** which limb strikes (AnimeFighter.fistSeg): 0 lead fist · 1 rear fist · 2 lead elbow · 3 rear elbow · 4 lead knee · 5 rear knee · 6 lead
 *  foot · 'auto' = per key (`limb` tags on the ult flurry) */
export const STRIKE = { a1: 0, a2: 1, a3: 2, a4: 1, air1: 4, air2: 0, s1: 0, s2: 0, ult: 'auto' };

/** keys for a move. FX cues ride on keys (several joined with '+'): stamp / slide / skid / ring / sink (dust + rings, as the other
 *  classes), quake (震腳: thick dust + double shockwave + camera thump; quakeX = big), exhale (kiai: breath puff + chest squash) */
export function moveKeys(key, m) {
  const t = m.t, f = F[key];
  switch (key) {
    case 'a1': return form(t, [['s', 0.55, f.A, 'coil'], ['a', 0, f.S, 'snap', 'slide+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a2': return form(t, [['s', 0.55, f.A, 'coil'], ['a', 0, f.S, 'snap', 'stamp+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a3': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'quake+exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['r', 0.8, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'a4': return form(t, [['s', 0.55, f.A, 'coil', 'sink'], ['a', 0, f.S, 'snap', 'stamp+exhale'], ['a', 1, f.E, 'outQuad', 'ring'], ['r', 0.3, f.F, 'settle'], ['r', 0.82, f.H, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'air1': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'exhale'], ['a', 1, f.E, 'whip'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, POSES.fall, 'inOutSine']]);
    case 'air2': return form(t, [['s', 0.5, f.A, 'coil'], ['a', 0, f.S, 'snap', 'exhale'], ['a', 1, f.E, 'whip', 'ring'], ['r', 0.45, f.F, 'settle'], ['x', 0.05, POSES.fall, 'inOutSine']]);
    case 's1': return form(t, [['s', 0.5, f.A, 'coil', 'sink'], ['s', 0.86, f.A2, 'hold'], ['a', 0, f.S, 'snap', 'stamp+exhale'], ['a', 0.12, f.S, 'hold', 'ring'], ['a', 1, f.E, 'hold'], ['r', 0.4, f.F, 'settle', 'skid'], ['r', 0.7, f.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 's2': return form(t, [['s', 0.55, f.A, 'coil'], ['s', 0.9, f.B, 'inQuad'], ['a', 0, f.S, 'snap', 'quakeX+exhale'], ['a', 1, f.S, 'hold'], ['r', 0.5, f.F, 'settle'], ['r', 0.85, f.F, 'hold'], ['x', 0.06, STANCE, 'inOutSine']]);
    case 'ult': return ultKeys(m);
    default: return null;
  }
}
function ultKeys(m) {
  const [su, ac, rc] = m.t, n = m.multi || 9, dt = ac / n, T = su + ac + rc, k = [{ t: 0, p: 'from', limb: 0 }];
  const at = (i, o) => su + i * dt + o, push = (t, p, e, fx, limb) => k.push({ t, p, e, fx: fx || null, limb: limb ?? null });
  push(su * 0.6, ULT.A, 'coil', 'sink', 0);
  for (let i = 0; i < 6; i++) {   // chain punches: lead, rear, lead … each one rolls over the other on the centre line
    const lead = i % 2 === 0, C = lead ? ULT.CF : ULT.CB;
    if (i) push(at(i, -dt * 0.45), ULT.MF, 'inQuad', null, lead ? 0 : 1);
    push(at(i, 0), C, 'snap', i === 0 ? 'stamp+exhale' : i === 3 ? 'slide+exhale' : i % 2 ? 'slide' : null, lead ? 0 : 1);
    push(at(i, dt * 0.3), C, 'hold', null, lead ? 0 : 1);
  }
  push(at(6, -dt * 0.45), ULT.W6, 'coil', null, 2); push(at(6, 0), ULT.E6, 'snap', 'quake+exhale', 2);
  push(at(7, -dt * 0.5), ULT.W7, 'inOutSine', null, 5); push(at(7, 0), ULT.K7, 'snap', 'exhale', 5);
  push(at(8, -dt * 0.55), ULT.W8, 'coil', null, 1); push(at(8, 0), ULT.C8, 'snap', 'quakeX+exhale', 1); push(su + ac, ULT.E8, 'outQuad', 'ring', 1);
  push(su + ac + rc * 0.3, ULT.Hz, 'settle', null, 1); push(su + ac + rc * 0.85, ULT.Hz, 'hold', null, 1); push(T + 0.08, STANCE, 'inOutSine', null, 0);
  k.sort((a, b) => a.t - b.t);
  return k;
}
/** the key that lands on the first active frame (contact) — tests assert it sits exactly at startup */
export const contactPose = (key) => (key === 'ult' ? ULT.CF : F[key] && F[key].S);
export const FORMS = { ...F, ult: ULT };
/** win: 收功 sink + chamber → one slow exhaled punch (held) → 抱拳禮 salute */
export const winKeys = (Pz) => [{ t: 0, p: 'from' }, { t: 0.35, p: Pz.winA, e: 'coil' }, { t: 0.6, p: Pz.winB, e: 'snap' }, { t: 1.1, p: Pz.winB, e: 'hold' }, { t: 1.7, p: Pz.win, e: 'settle' }];
export const PROFILE = {
  id: 'brawler', stance: STANCE, poses: POSES, moveKeys, winKeys, airMoves: ['air1', 'air2'],
  step: { lift: 0.05, liftWalk: 0.06, durWalk: 0.24 },     // heavier, planted steps
  lead: 0.03,                                              // power-chain lead (s)
  fist: true, strike: STRIKE,                              // contact segment = the striking fist / elbow / knee; fist roll on time (6th link)
};
