// Anime animation layer on top of the HQ rig math (pure, no three.js → node-tested in tests/anime.test.mjs).
// Adds channels to the HQ pose:   sy  whole-body spin (yaw) about a vertical axis at x = pv (spinning cuts, corkscrews)
//                                 pv  spin pivot x (rig units; usually the front foot = pivot on the ball of the foot)
//                                 hF hB  heel lift 0..1 (ball-of-foot pivots, kendo back heel)
//                                 kF kB  knee splay (rad) — rotates the knee about the hip→ankle axis (horse stance: knees out)
//                                 sh  sheath 0..1 (win flourish: the renderer slides the blade into the saya)
// Clips ("forms") are key lists timed from the move's frame data, so the contact key always lands on the first active
// frame and balance never changes. The POWER CHAIN: feet lead the hips, the hips lead the torso, the torso leads the arm
// and blade — evalChain() samples each channel group slightly ahead in time, so every strike starts in the feet.
import { POSE_KEYS, EASE } from '../rig/core.js';

export const XKEYS = ['sy', 'pv', 'hF', 'hB', 'kF', 'kB', 'sh'];
export const AKEYS = [...POSE_KEYS, ...XKEYS];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const XE = {
  ...EASE,
  coil: (k) => 1 - (1 - k) ** 3,                         // slow settle into the wind-up
  snap: (k) => k * k * k,                                 // explosive release into contact
  whip: (k) => (k >= 1 ? 1 : 1 - 2 ** (-9 * k)),          // fast out of the contact, decelerating
  settle: (k) => { const c = 1.15; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; },   // settle with a small overshoot
  hold: (k) => k,
};

/** a pose buffer with every channel present from the start (fixed object shape → V8 keeps fast double fields, so
 *  writing poses every frame does not allocate) */
export function blankA() {
  return { px: 0.5, py: 0.5, pt: 0.5, sp: 0.5, ch: 0.5, tw: 0.5, ctw: 0.5, hd: 0.5, rr: 0.5, fFx: 0.5, fFy: 0.5, fBx: 0.5, fBy: 0.5, aF: 0.5, aB: 0.5,
    gx: 0.5, gy: 0.5, ga: 0.5, gw: 0.5, ox: 0.5, oy: 0.5, oh: 0.5, sy: 0.5, pv: 0.5, hF: 0.5, hB: 0.5, kF: 0.5, kB: 0.5, sh: 0.5 };
}
// copy / lerp are generated with every channel unrolled as a named property access: the call sites stay monomorphic,
// V8 keeps the doubles unboxed, and the per-frame pose maths allocates nothing (keyed loops over AKEYS boxed every value).
const gen = (body) => new Function('a', 'b', 'k', 'out', 'GP0', 'GP1', 'wrapA', 'wrap', body);
const COPY = gen(AKEYS.map((q) => `out.${q} = a.${q} === undefined ? 0 : a.${q};`).join('\n') + '\nreturn out;');
const LERP = gen(AKEYS.map((q) => `out.${q} = a.${q} + (b.${q} - a.${q}) * k;`).join('\n') + `
  const ax = a.gx - GP0, ay = a.gy - GP1, bx = b.gx - GP0, by = b.gy - GP1;
  const ra = Math.sqrt(ax * ax + ay * ay), rb = Math.sqrt(bx * bx + by * by);
  if (ra > 0.08 && rb > 0.08) {
    const aa = Math.atan2(ay, ax), ab = aa + wrapA(Math.atan2(by, bx) - aa), r = ra + (rb - ra) * k, an = aa + (ab - aa) * k;
    out.gx = GP0 + Math.cos(an) * r; out.gy = GP1 + Math.sin(an) * r;
  }
  out.ga = a.ga + (wrap ? wrapA(b.ga - a.ga) : b.ga - a.ga) * k;
  return out;`);
const GP0 = 0.05, GP1 = 1.42;   // = core GRIP_PIVOT: grips interpolate on arcs around this chest-level point
export function copyA(p, out = blankA()) { return COPY(p, null, 0, out); }
/** lerp all channels (same maths as core lerpPose: grips travel on arcs; wrap = blade angle the short way for crossfades).
 *  Both poses must carry every channel (tests/anime.test.mjs checks all authored poses). */
export function lerpA(a, b, k, out = blankA(), wrap = false) { return LERP(a, b, k, out, GP0, GP1, wrapA, wrap); }
/** normalise a snapshot so crossfades never unwind a full spin / roll (−2π ≡ 0) */
export function normSnap(p) { p.sy = wrapA(p.sy || 0); p.rr = wrapA(p.rr || 0); return p; }
/** keyed clip: keys [{ t, p, e }] (p = pose | 'from'); e = easing into the key */
export function evalA(keys, t, from, out = blankA()) {
  if (t <= keys[0].t) return copyA(keys[0].p === 'from' ? from : keys[0].p, out);
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1.t) { const k0 = keys[i - 1], u = (t - k0.t) / Math.max(1e-6, k1.t - k0.t); return lerpA(k0.p === 'from' ? from : k0.p, k1.p === 'from' ? from : k1.p, (XE[k1.e] || XE.inOutSine)(u), out, k0.p === 'from' || k1.p === 'from'); }
  }
  const kl = keys[keys.length - 1]; return copyA(kl.p === 'from' ? from : kl.p, out);
}
export const FEET = ['fFx', 'fFy', 'fBx', 'fBy', 'aF', 'aB', 'hF', 'hB', 'kF', 'kB'];
export const HIPS = ['px', 'py', 'pt', 'tw', 'pv'];
export const TORSO = ['sp', 'ch', 'ctw', 'hd'];
const _f = blankA(), _h = blankA(), _t = blankA();
const CHAIN = new Function('f', 'h', 't', 'out', [...FEET.map((q) => `out.${q} = f.${q};`), ...HIPS.map((q) => `out.${q} = h.${q};`), ...TORSO.map((q) => `out.${q} = t.${q};`)].join('\n'));
/** power chain: feet sample `lead`×2 ahead, hips ×1.3, torso ×0.6, arm + blade + spin + roll exactly at t (contact unchanged).
 *  The lead ramps in over the first 2·lead seconds so a clip still starts exactly at the crossfade snapshot. */
export function evalChain(keys, t, from, out = blankA(), lead = 0.028) {
  evalA(keys, t, from, out);
  if (lead <= 0) return out;
  const r = clamp(t / (2 * lead), 0, 1);
  evalA(keys, t + lead * 2 * r, from, _f); evalA(keys, t + lead * 1.3 * r, from, _h); evalA(keys, t + lead * 0.6 * r, from, _t);
  CHAIN(_f, _h, _t, out);
  return out;
}
/** build a form from frame data: list of [phase, u, pose, ease, fx] with phase s (startup) · a (active) · r (recovery) ·
 *  x (seconds after the move ends) · t (absolute seconds). The key with phase 'a', u 0 is the contact = first active frame. */
export function form(mt, list) {
  const [su, ac, rc] = mt, T = su + ac + rc;
  const at = (ph, u) => (ph === 's' ? su * u : ph === 'a' ? su + ac * u : ph === 'r' ? su + ac + rc * u : ph === 'x' ? T + u : u);
  const keys = [{ t: 0, p: 'from' }];
  for (const [ph, u, p, e, fx] of list) keys.push({ t: at(ph, u), p, e: e || 'inOutSine', fx: fx || null, ph, u });
  keys.sort((a, b) => a.t - b.t);
  return keys;
}
/** rotate a rig-space point about the spin axis (vertical, x = pv) — same convention as three's rotation.y */
export function spinPt(p, sy, pv, out = [0, 0, 0]) {
  if (!sy) { out[0] = p[0]; out[1] = p[1]; out[2] = p[2] || 0; return out; }
  const c = Math.cos(sy), s = Math.sin(sy), x = p[0] - pv, z = p[2] || 0;
  out[0] = pv + x * c + z * s; out[1] = p[1]; out[2] = -x * s + z * c; return out;
}
/** knee splay: rotate the knee about the hip→ankle axis by `ang` (Rodrigues); bone lengths are preserved */
export function splayKnee(hip, knee, ankle, ang, out = [0, 0, 0]) {
  if (!ang) { out[0] = knee[0]; out[1] = knee[1]; out[2] = knee[2]; return out; }
  let ax = ankle[0] - hip[0], ay = ankle[1] - hip[1], az = (ankle[2] || 0) - (hip[2] || 0); const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
  const vx = knee[0] - hip[0], vy = knee[1] - hip[1], vz = (knee[2] || 0) - (hip[2] || 0), c = Math.cos(ang), s = Math.sin(ang), d = ax * vx + ay * vy + az * vz;
  const cx = ay * vz - az * vy, cy = az * vx - ax * vz, cz = ax * vy - ay * vx;
  out[0] = hip[0] + vx * c + cx * s + ax * d * (1 - c); out[1] = hip[1] + vy * c + cy * s + ay * d * (1 - c); out[2] = (hip[2] || 0) + vz * c + cz * s + az * d * (1 - c);
  return out;
}
