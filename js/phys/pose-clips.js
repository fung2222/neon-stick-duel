// Hidden pose clips for Landfall-style active ragdoll.
// Authored for face = +1 (facing right); faceFacing() mirrors lateral channels.
// Ragdoll motors follow sampled joint targets — do not hand-tune angles in driveRagdoll.

export const JKEYS = [
  'hipF', 'hipB', 'knF', 'knB', 'ankF', 'ankB',
  'shF', 'shB', 'elF', 'elB', 'neck', 'wrF', 'wrB',
];

const ease = {
  linear: (u) => u,
  inOutSine: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
  outCubic: (u) => 1 - (1 - u) ** 3,
  inCubic: (u) => u * u * u,
  outBack: (u) => {
    const c = 1.2;
    return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
  },
};

function lerp(a, b, u) {
  return a + (b - a) * u;
}

export function blankPose() {
  const p = {};
  for (const k of JKEYS) p[k] = 0;
  return p;
}

export function copyPose(src, out = blankPose()) {
  for (const k of JKEYS) out[k] = src[k] ?? 0;
  return out;
}

export function lerpPose(a, b, u, out = blankPose()) {
  for (const k of JKEYS) out[k] = lerp(a[k] ?? 0, b[k] ?? 0, u);
  return out;
}

/** Mirror a face=+1 authored pose for the fighter's facing. */
export function facePose(src, face = 1, out = blankPose()) {
  copyPose(src, out);
  if (face < 0) {
    // lateral / swing channels flip with facing
    out.shF *= -1;
    out.shB *= -1;
    out.neck *= -1;
    out.wrF *= -1;
    out.wrB *= -1;
    out.hipF *= -1;
    out.hipB *= -1;
    out.ankF *= -1;
    out.ankB *= -1;
  }
  return out;
}

/** Evaluate keyed clip. keys: [{ t, p, e? }] — p is pose object. */
export function evalClip(keys, t, out = blankPose()) {
  if (!keys?.length) return out;
  if (t <= keys[0].t) return copyPose(keys[0].p, out);
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1.t) {
      const k0 = keys[i - 1];
      const u = (t - k0.t) / Math.max(1e-6, k1.t - k0.t);
      const e = ease[k1.e] || ease.inOutSine;
      return lerpPose(k0.p, k1.p, e(u), out);
    }
  }
  return copyPose(keys[keys.length - 1].p, out);
}

export function clipDuration(keys) {
  return keys?.length ? keys[keys.length - 1].t : 0;
}

// —— Authored poses (face = +1). Tuned so chamber/thrust read in silhouette. ——

/** Raised fighting guard — fists up, elbows bent (not hanging). */
export const POSE_GUARD = {
  hipF: 0.1, hipB: -0.06, knF: 0.28, knB: 0.25, ankF: 0.04, ankB: 0.04,
  shF: -1.05, shB: -0.75, elF: 1.35, elB: 1.25, neck: 0, wrF: 0.05, wrB: 0.05,
};

/** High guard (block). */
export const POSE_GUARD_HIGH = {
  ...POSE_GUARD,
  shF: -1.4, shB: -1.25, elF: 1.7, elB: 1.55,
  hipF: 0.16, hipB: 0.05, knF: 0.4, knB: 0.38,
};

/** Punch chamber — lead fist behind torso, elbow cocked. */
export const POSE_PUNCH_WINDUP = {
  ...POSE_GUARD,
  hipF: 0.04, hipB: -0.04, knF: 0.35, knB: 0.3,
  shF: -1.9, shB: -1.15, elF: 2.25, elB: 1.55,
  neck: 0.15, wrF: 0.25, wrB: 0,
};

/** Punch extend — lead arm forward, elbow open. */
export const POSE_PUNCH_THRUST = {
  ...POSE_GUARD,
  hipF: 0.18, hipB: -0.08, knF: 0.32, knB: 0.28,
  shF: 2.25, shB: -0.75, elF: 0.15, elB: 1.35,
  neck: -0.15, wrF: -0.15, wrB: 0,
};

/** Hit reaction (soft). */
export const POSE_HIT = {
  hipF: 0.35, hipB: 0.2, knF: 0.7, knB: 0.65, ankF: 0.1, ankB: 0.1,
  shF: 0.6, shB: -0.4, elF: 1.1, elB: 1.0,
  neck: 0.25, wrF: 0.2, wrB: -0.2,
};

// —— Clips ——

/** Idle stand (held guard). */
export const CLIP_STAND = [
  { t: 0, p: POSE_GUARD },
];

/**
 * Kung-fu punch clip (seconds).
 * Timeline: settle → chamber hold → snap thrust → hold extend → recover guard.
 */
export const CLIP_PUNCH = [
  { t: 0.00, p: POSE_GUARD, e: 'inOutSine' },
  { t: 0.28, p: POSE_PUNCH_WINDUP, e: 'outCubic' },   // arrive chamber
  { t: 0.38, p: POSE_PUNCH_WINDUP, e: 'linear' },      // hold readable windup
  { t: 0.50, p: POSE_PUNCH_THRUST, e: 'outBack' },     // snap thrust
  { t: 0.62, p: POSE_PUNCH_THRUST, e: 'linear' },      // hold extend (hit window)
  { t: 0.88, p: POSE_GUARD, e: 'inOutSine' },          // recover
];

/** Hit window inside CLIP_PUNCH (thrust hold). */
export const PUNCH_HIT = { start: 0.48, end: 0.64 };

/** Impulse once when clip crosses this time. */
export const PUNCH_IMPULSE_AT = 0.50;

export const CLIP_HIT = [
  { t: 0.00, p: POSE_HIT },
  { t: 0.22, p: POSE_HIT },
  { t: 0.40, p: POSE_GUARD, e: 'inOutSine' },
];

/** Label punch phase from clip time (for debug / shots). */
export function punchPhaseAt(t) {
  if (t < 0.38) return 'windup';
  if (t < 0.62) return 'thrust';
  if (t < clipDuration(CLIP_PUNCH)) return 'recover';
  return null;
}
