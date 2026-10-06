// Anime animation layer on top of the HQ rig math (pure, no three.js → node-tested in tests/anime.test.mjs).
// Adds channels to the HQ pose:   sy  whole-body spin (yaw) about a vertical axis at x = pv (spinning cuts, corkscrews)
//                                 pv  spin pivot x (rig units; usually the front foot = pivot on the ball of the foot)
//                                 hF hB  heel lift 0..1 (ball-of-foot pivots, kendo back heel)
//                                 kF kB  knee splay (rad) — rotates the knee about the hip→ankle axis (horse stance: knees out)
//                                 sh  sheath 0..1 (win flourish: the renderer slides the blade into the saya)
// Clips ("forms") are key lists timed from the move's frame data, so the contact key always lands on the first active
// frame and balance never changes. The POWER CHAIN: feet lead the hips, the hips lead the torso, the torso leads the arm
// and blade — evalChain() samples each channel group slightly ahead in time, so every strike starts in the feet.
import { POSE_KEYS, lerpPose, EASE } from '../rig/core.js';

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

export function copyA(p, out = {}) { for (const q of AKEYS) out[q] = p[q] ?? 0; return out; }
/** lerp all channels; grips travel on arcs (core lerpPose); wrap = blade angle the short way (state crossfades) */
export function lerpA(a, b, k, out = {}, wrap = false) {
  lerpPose(a, b, k, out, wrap);
  for (const q of XKEYS) { const x = a[q] ?? 0, y = b[q] ?? 0; out[q] = x + (y - x) * k; }
  return out;
}
/** normalise a snapshot so crossfades never unwind a full spin / roll (−2π ≡ 0) */
export function normSnap(p) { p.sy = wrapA(p.sy || 0); p.rr = wrapA(p.rr || 0); return p; }
/** keyed clip: keys [{ t, p, e }] (p = pose | 'from'); e = easing into the key */
export function evalA(keys, t, from, out = {}) {
  const P = (k) => (k.p === 'from' ? from : k.p);
  if (t <= keys[0].t) return copyA(P(keys[0]), out);
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1.t) { const k0 = keys[i - 1], u = (t - k0.t) / Math.max(1e-6, k1.t - k0.t); return lerpA(P(k0), P(k1), (XE[k1.e] || XE.inOutSine)(u), out, k0.p === 'from' || k1.p === 'from'); }
  }
  return copyA(P(keys[keys.length - 1]), out);
}
export const FEET = ['fFx', 'fFy', 'fBx', 'fBy', 'aF', 'aB', 'hF', 'hB', 'kF', 'kB'];
export const HIPS = ['px', 'py', 'pt', 'tw', 'pv'];
export const TORSO = ['sp', 'ch', 'ctw', 'hd'];
const _f = {}, _h = {}, _t = {};
/** power chain: feet sample `lead`×2 ahead, hips ×1.3, torso ×0.6, arm + blade + spin + roll exactly at t (contact unchanged).
 *  The lead ramps in over the first 2·lead seconds so a clip still starts exactly at the crossfade snapshot. */
export function evalChain(keys, t, from, out = {}, lead = 0.028) {
  evalA(keys, t, from, out);
  if (lead <= 0) return out;
  const r = clamp(t / (2 * lead), 0, 1);
  evalA(keys, t + lead * 2 * r, from, _f); evalA(keys, t + lead * 1.3 * r, from, _h); evalA(keys, t + lead * 0.6 * r, from, _t);
  for (const q of FEET) out[q] = _f[q]; for (const q of HIPS) out[q] = _h[q]; for (const q of TORSO) out[q] = _t[q];
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
