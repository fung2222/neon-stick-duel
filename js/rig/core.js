// HQ rig core — pure math (no three.js / DOM) so node tests can evaluate poses, IK and blade arcs.
// Body space: origin on the ground under the fighter, x = facing direction, y = up, z = toward the camera when facing +x.
// All lengths here are "rig units" (pre-scale); the renderer multiplies by the fighter scale (1.2 × boss size).
//
// Skeleton (hierarchy):  pelvis ─ lumbar ─ chest ─ neck ─ head
//                                         chest ─ shoulder.F/B ─ upperArm ─ forearm ─ hand (F hand holds the weapon)
//                        pelvis ─ hip.F/B ─ thigh ─ shin ─ foot
// Spine / neck / head are forward kinematics (angles); arms and legs are two-bone IK chains with joint limits:
// feet reach planted ground targets, the weapon hand reaches the keyed grip, the off hand reaches its target / the hilt.
//
// A pose is a flat object of numbers (see POSE_KEYS). Angles in radians; "pitch" angles are positive = bend FORWARD.
//   px py     pelvis position            pt  pelvis tilt         sp  lumbar bend      ch  chest bend
//   tw        pelvis twist (yaw; + = near hip forward)          ctw chest twist on top of tw (+ = weapon shoulder forward)
//   hd        head nod (neck takes 35 %, head 65 %)              rr  whole-body roll about the pelvis (+ = forward flip)
//   fFx fFy fBx fBy   ankle targets (front = near leg)          aF aB  foot pitch (+ = toes up)
//   gx gy     weapon grip   ga  blade pitch (0 = forward, π/2 = up)   gw  blade yaw (+ = tip toward the camera)
//   ox oy     off-hand target              oh  0..1 off hand on the hilt (two-handed grip)
/** HQ rig units → metres: fighter scale × RIG_SCALE (the HQ body matches the classic rig's height) */
export const RIG_SCALE = 1.08;
export const SK = {
  lumbar: 0.2, chest: 0.36, neck: 0.1, headR: 0.185, headUp: 0.15,
  shoulderDrop: 0.06, shoulderW: 0.165, hipDrop: 0.07, hipW: 0.095,
  ua: 0.36, fa: 0.34, th: 0.47, sh: 0.46, ankle: 0.075, footL: 0.24,
  blade: 1.18, bladeBase: 0.25,
};
export const LIMITS = {
  knee: [0.03, 2.55], elbow: [0.06, 2.6],           // inner bend (0 = straight)
  hip: [-1.2, 2.6],                                  // thigh angle from straight down (+ = forward / up)
  head: [-0.75, 0.75], spine: [-0.9, 1.1],
};
export const POSE_KEYS = ['px', 'py', 'pt', 'sp', 'ch', 'tw', 'ctw', 'hd', 'rr', 'fFx', 'fFy', 'fBx', 'fBy', 'aF', 'aB', 'gx', 'gy', 'ga', 'gw', 'ox', 'oy', 'oh'];
const GRIP_PIVOT = [0.05, 1.42];   // grips interpolate on arcs around this chest-level point (sword swings travel on circles)

// ------------------------------------------------------------------ easing
export const EASE = {
  lin: (k) => k,
  inQuad: (k) => k * k, outQuad: (k) => 1 - (1 - k) * (1 - k),
  inCubic: (k) => k * k * k, outCubic: (k) => 1 - (1 - k) ** 3,
  inOutSine: (k) => 0.5 - 0.5 * Math.cos(Math.PI * k), outSine: (k) => Math.sin(k * Math.PI / 2),
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  outExpo: (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  outBack: (k) => { const c = 1.6; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** lerp two poses; grips travel on an arc around GRIP_PIVOT (radius + angle). Blade pitch is interpolated as authored
 *  (so a rising cut can sweep down-and-under), or the short way when wrap is set (crossfades from a snapshot). */
export function lerpPose(a, b, k, out = {}, wrap = false) {
  for (const q of POSE_KEYS) out[q] = a[q] + (b[q] - a[q]) * k;
  const ax = a.gx - GRIP_PIVOT[0], ay = a.gy - GRIP_PIVOT[1], bx = b.gx - GRIP_PIVOT[0], by = b.gy - GRIP_PIVOT[1];
  const ra = Math.hypot(ax, ay), rb = Math.hypot(bx, by);
  if (ra > 0.08 && rb > 0.08) {
    const aa = Math.atan2(ay, ax), ab = aa + wrapA(Math.atan2(by, bx) - aa), r = ra + (rb - ra) * k, an = aa + (ab - aa) * k;
    out.gx = GRIP_PIVOT[0] + Math.cos(an) * r; out.gy = GRIP_PIVOT[1] + Math.sin(an) * r;
  }
  out.ga = a.ga + (wrap ? wrapA(b.ga - a.ga) : b.ga - a.ga) * k;
  return out;
}
export const copyPose = (p, out = {}) => { for (const q of POSE_KEYS) out[q] = p[q]; return out; };

/**
 * evaluate a keyframed clip. keys = [{ t, p, e }] (p = pose or the string 'from' for the crossfade snapshot,
 * e = easing INTO that key). Times are seconds from the clip start.
 */
export function evalClip(keys, t, from, out = {}) {
  const P = (k) => (k.p === 'from' ? from : k.p);
  if (t <= keys[0].t) return copyPose(P(keys[0]), out);
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1.t) { const k0 = keys[i - 1], u = (t - k0.t) / Math.max(1e-6, k1.t - k0.t); return lerpPose(P(k0), P(k1), (EASE[k1.e] || EASE.inOutSine)(u), out, k0.p === 'from' || k1.p === 'from'); }
  }
  return copyPose(P(keys[keys.length - 1]), out);
}

// ------------------------------------------------------------------ IK
/**
 * two-bone IK in the x-y plane. root [x, y], target [x, y], lengths a, b; bend = +1 joint on the CCW side of root→target
 * (knees forward for a leg pointing down), -1 CW (elbows down / back). Joint limits clamp the inner bend angle
 * (lim = [min, max]); unreachable targets are approached with a soft straightening (no knee / elbow pop).
 * Returns { j: joint, e: end, bend, reach } (end may fall short of the target).
 */
export function ik2(root, target, a, b, bend, lim = [0.02, 2.6]) {
  let dx = target[0] - root[0], dy = target[1] - root[1];
  let d = Math.hypot(dx, dy) || 1e-5; const ux = dx / d, uy = dy / d;
  const maxD = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(lim[0]));   // straightest allowed
  const minD = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(lim[1]));   // most bent allowed
  // soft IK: ease into full extension over the last 4 % of the reach
  const soft = maxD * 0.96;
  if (d > soft) { const x = d - soft, w = maxD - soft; d = soft + w * (1 - Math.exp(-x / w)); }
  d = clamp(d, minD + 1e-5, maxD);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), A = Math.acos(cosA) * (bend >= 0 ? 1 : -1);
  const base = Math.atan2(uy, ux), ja = base + A;
  const j = [root[0] + Math.cos(ja) * a, root[1] + Math.sin(ja) * a];
  const e = [root[0] + ux * d, root[1] + uy * d];
  const cosB = clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1), inner = Math.PI - Math.acos(cosB);
  return { j, e, bend: inner, reach: d };
}

// ------------------------------------------------------------------ solve a full pose → joint positions (body space, rig units)
const rot = (p, c, ang) => { const s = Math.sin(ang), co = Math.cos(ang), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * co - y * s, c[1] + x * s + y * co, p[2] ?? 0]; };
const segEnd = (p, ang, len) => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len, p[2] ?? 0];   // ang from vertical, + = forward

/**
 * pose → skeleton. opts: { plantF, plantB } optional ankle targets that override the pose feet (planted feet, body space,
 * already in the rolled frame).
 * Returns joints (3D arrays [x, y, z]) + blade base/tip + useful angles.
 */
export function solve(p, opts = {}) {
  const roll = -(p.rr || 0);   // + rr = forward flip = clockwise in the x-y plane
  const P0 = [p.px, p.py, 0];
  const aP = clamp(p.pt, -0.6, 0.8), aL = aP + clamp(p.sp, LIMITS.spine[0], LIMITS.spine[1]), aC = aL + clamp(p.ch, -0.8, 0.8);
  const lumbar = segEnd(P0, aL * 0.6 + aP * 0.4, SK.lumbar), neckB = segEnd(lumbar, aC, SK.chest);
  const headAng = aC + clamp(p.hd, LIMITS.head[0], LIMITS.head[1]);
  const neckT = segEnd(neckB, aC * 0.65 + headAng * 0.35, SK.neck), headC = segEnd(neckT, headAng, SK.headUp);
  // twist: shoulders / hips rotate about the vertical axis (near side forward for + twist)
  const tw = p.tw, ctw = p.tw + p.ctw;
  const shC = segEnd(neckB, aC + Math.PI, SK.shoulderDrop);
  const shF = [shC[0] + Math.sin(ctw) * SK.shoulderW, shC[1], Math.cos(ctw) * SK.shoulderW];
  const shB = [shC[0] - Math.sin(ctw) * SK.shoulderW, shC[1], -Math.cos(ctw) * SK.shoulderW];
  const hC = segEnd(P0, aP + Math.PI, SK.hipDrop);
  const hipF = [hC[0] + Math.sin(tw) * SK.hipW, hC[1], Math.cos(tw) * SK.hipW];
  const hipB = [hC[0] - Math.sin(tw) * SK.hipW, hC[1], -Math.cos(tw) * SK.hipW];
  // weapon
  const grip = [p.gx, p.gy, shF[2] * 0.55];
  const bd = [Math.cos(p.ga) * Math.cos(p.gw), Math.sin(p.ga), Math.cos(p.ga) * Math.sin(p.gw)];
  const hilt = [grip[0] - bd[0] * 0.13, grip[1] - bd[1] * 0.13, grip[2] - bd[2] * 0.13];
  const oT = [p.ox + (hilt[0] - p.ox) * p.oh, p.oy + (hilt[1] - p.oy) * p.oh, shB[2] * (1 - p.oh) + hilt[2] * p.oh];
  let fF = [p.fFx, p.fFy, hipF[2]], fB = [p.fBx, p.fBy, hipB[2]];
  // roll the whole body about the pelvis (flips, knockdowns); planted feet are given in the rolled frame already
  const piv = [P0[0], P0[1] + 0.12];
  const R = (q) => (roll ? rot(q, piv, roll) : q);
  const J = { pelvis: R(P0), lumbar: R(lumbar), neckB: R(neckB), neckT: R(neckT), head: R(headC), shF: R(shF), shB: R(shB), hipF: R(hipF), hipB: R(hipB) };
  const gripR = R(grip), hiltR = R(hilt), oTR = R(oT);
  const bdR = roll ? [bd[0] * Math.cos(roll) - bd[1] * Math.sin(roll), bd[0] * Math.sin(roll) + bd[1] * Math.cos(roll), bd[2]] : bd;
  fF = opts.plantF || R(fF); fB = opts.plantB || R(fB);
  // keep the pelvis low enough for planted feet (no hyper-extended legs): shift the upper body down
  let drop = 0;
  const onGround = (f, planted) => planted || (f[1] <= SK.ankle + 0.012 && Math.abs(roll) < 0.05);
  for (const [h, f, on] of [[J.hipF, fF, onGround(fF, !!opts.plantF)], [J.hipB, fB, onGround(fB, !!opts.plantB)]]) {
    if (!on) continue; const maxL = (SK.th + SK.sh) * 0.975, dx = f[0] - h[0];
    if (Math.abs(dx) < maxL) { const hy = f[1] + Math.sqrt(maxL * maxL - dx * dx); if (h[1] > hy) drop = Math.max(drop, h[1] - hy); }
  }
  if (drop > 0) { drop = Math.min(drop, 0.35); for (const k in J) J[k] = [J[k][0], J[k][1] - drop, J[k][2]]; }
  // legs: knees forward (CCW of hip→ankle for a leg pointing down; mirrored by the roll automatically)
  const leg = (hip, ft) => { const r = ik2(hip, ft, SK.th, SK.sh, +1, LIMITS.knee); return { knee: [r.j[0], r.j[1], hip[2]], ankle: [r.e[0], r.e[1], hip[2]], bend: r.bend }; };
  const LF = leg(J.hipF, fF), LB = leg(J.hipB, fB);
  // arms: elbows down / back
  const arm = (sh, t) => { const r = ik2(sh, t, SK.ua, SK.fa, -1, LIMITS.elbow); return { elbow: [r.j[0], r.j[1], (sh[2] + t[2]) / 2], hand: [r.e[0], r.e[1], t[2]], bend: r.bend }; };
  const AF = arm(J.shF, gripR), AB = arm(J.shB, oTR);
  // the blade hangs from the hand that actually got there (hand may fall short of the keyed grip at full stretch)
  const hand = AF.hand;
  const base = [hand[0] + bdR[0] * SK.bladeBase, hand[1] + bdR[1] * SK.bladeBase, hand[2] + bdR[2] * SK.bladeBase];
  const tip = [hand[0] + bdR[0] * SK.blade, hand[1] + bdR[1] * SK.blade, hand[2] + bdR[2] * SK.blade];
  return {
    ...J, kneeF: LF.knee, ankleF: LF.ankle, kneeB: LB.knee, ankleB: LB.ankle, elbowF: AF.elbow, handF: AF.hand, elbowB: AB.elbow, handB: AB.hand,
    bladeDir: bdR, base, tip, grip: gripR, hilt: hiltR, roll, aC, headAng, drop, bends: { kF: LF.bend, kB: LB.bend, eF: AF.bend, eB: AB.bend },
  };
}

/** blade segment only (cheap enough for sub-frame trail sampling): needs the full solve because the hand is IK-limited */
export function bladeOf(p) { const s = solve(p); return { base: s.base, tip: s.tip, hand: s.handF }; }

/** a simple damped spring (scalar): x follows target with angular freq w and damping ratio z */
export function spring(s, target, dt, w = 18, z = 0.7) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let i = 0; i < n; i++) { const a = w * w * (target - s.x) - 2 * z * w * s.v; s.v += a * h; s.x += s.v * h; }
  return s.x;
}

/** standard attack clip from four key poses and the move's frame data [startup, active, recover]:
 *  snapshot → A anticipation (½ startup, decelerating) → S contact (end of startup, accelerating: the blade meets the
 *  target on the first active frame) → E end of the arc (end of active) → F follow-through (40 % of recovery) → stance. */
export function attackKeys(t, P, stance) {
  const [su, ac, rc] = t, T = su + ac + rc;
  return [{ t: 0, p: 'from' }, { t: su * 0.5, p: P.A, e: 'outQuad' }, { t: su, p: P.S, e: 'inQuad' }, { t: su + ac, p: P.E, e: 'outSine' },
    { t: su + ac + rc * 0.4, p: P.F, e: 'outQuad' }, { t: T + 0.05, p: P.R || stance, e: 'inOutSine' }];
}
/** multi-hit flurry (ultimates): alternate two contact / end pairs per tick, a finisher pose on the last tick */
export function flurryKeys(t, n, P, stance) {
  const [su, ac, rc] = t, T = su + ac + rc, dt = ac / n, keys = [{ t: 0, p: 'from' }, { t: su * 0.6, p: P.A, e: 'outQuad' }];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1, a = last ? P.LS : i % 2 ? P.S2 : P.S1, b = last ? P.LE : i % 2 ? P.E2 : P.E1;
    keys.push({ t: su + i * dt, p: a, e: i ? 'inQuad' : 'inCubic' }, { t: su + i * dt + dt * (last ? 0.9 : 0.6), p: b, e: 'outSine' });
  }
  keys.push({ t: su + ac + rc * 0.4, p: P.F, e: 'outQuad' }, { t: T + 0.05, p: stance, e: 'inOutSine' });
  return keys;
}
