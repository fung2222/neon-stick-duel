// 影刃 ASSASSIN — anime body (phase 4): a cyber kunoichi, built on the same skeleton and skin accumulator as the other classes
// (js/anime/builder.js calls buildAssassin(ctx)). Procedural only, no external assets.
//   silhouette: slim athletic bodysuit (dark slate) with teal side / abdomen panels and a painted gunmetal chest plate with a glowing
//   emerald edge · both shoulders armoured (rounded plates, glowing rims) · vambraces + gloved fists · thigh plates, knee pads, shin
//   greaves · split-toe TABI boots with a glowing sole · belt with a pouch and TWO KODACHI SCABBARDS crossed at the lower back ·
//   gunmetal MASK over the lower face (eyes visible, glowing vents) · emerald SCARF wrapped at the neck with a back knot and two long
//   spring tails · high PONYTAIL (4-bone chain, crimson glowing tie), sharp asymmetric bangs + long side locks · twin kodachi on
//   their own bones (reverse grip in the hands, or seated in the scabbards: the renderer slides them home on `sh`).
// Proportions: shared skeleton (legs = 50 % of the height); head radius 0.127 → ≈ 6.8 heads; Mage-like narrow shoulder line
// (half-width 0.184), waist 0.1, hips 0.166.
import * as THREE from 'three';
import { tube, shell, spike, smooth, loft } from './geo.js';

const TAU = Math.PI * 2;
export const ASSASSIN_HR = 0.127;
/** scabbards (pelvis-local = bind − (0, 1, 0); the bind pelvis frame has no rotation): mouth + unit blade direction (into the saya).
 *  Worn crossed and nearly horizontal at the lower back; each hand draws its own blade from its own hip. */
const nrm3 = (v) => { const l = Math.hypot(...v); return v.map((q) => q / l); };
export const SHEATH = {
  F: { mouth: [-0.122, 0.07, 0.135], dir: nrm3([-0.16, -0.38, -1]) },
  B: { mouth: [-0.14, 0.07, -0.135], dir: nrm3([-0.16, -0.38, 1]) },
};
export const SAYA_L = 0.43;

/**
 * ctx: { acc, B, bind, chain, chainW, pal, hm, HB, hr, headGeo, headPoint, M4, T, W1, addBone, neckAO } (from buildCharacter).
 * Returns { daggers: { F, B } (bone ids), dispose() }.
 */
export function buildAssassin(ctx) {
  const { acc, B, bind, chain, chainW, pal, hm, HB, hr, headGeo, headPoint, M4, T, W1, addBone, neckAO } = ctx;
  const rb = (g, k, rx, ry, rz) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x / rx, y / ry, z / rz) || 1; p.setXYZ(i, x * (1 - k) + x / r * k, y * (1 - k) + y / r * k, z * (1 - k) + z / r * k); } g.computeVertexNormals(); return g; };
  const hk = hr / 0.118;

  // ---------------------------------------------------------------- torso: one loft (bodysuit) — narrow shoulders, bust, slim waist, hips
  const R0 = (y, f, b, w, n = 2.2, x = 0) => ({ y, f, b, w, n, x });
  const torso = [R0(0.85, 0, 0, 0), R0(0.866, 0.056, 0.07, 0.098), R0(0.9, 0.088, 0.112, 0.15, 2.3), R0(0.96, 0.092, 0.118, 0.166, 2.4), R0(1.03, 0.084, 0.098, 0.146, 2.3),
    R0(1.1, 0.074, 0.077, 0.112), R0(1.165, 0.07, 0.07, 0.1), R0(1.24, 0.084, 0.074, 0.112, 2.2, 0.004), R0(1.31, 0.106, 0.082, 0.13, 2.3, 0.008),
    R0(1.37, 0.124, 0.086, 0.144, 2.4, 0.012), R0(1.42, 0.114, 0.09, 0.156, 2.6, 0.012), R0(1.47, 0.1, 0.092, 0.172, 2.8, 0.01), R0(1.51, 0.092, 0.088, 0.184, 3.0, 0.008),
    R0(1.545, 0.076, 0.078, 0.162, 2.8, 0.006), R0(1.575, 0.058, 0.06, 0.114, 2.4, 0.004), R0(1.598, 0.044, 0.046, 0.066, 2, 0.004), R0(1.61, 0, 0, 0)];
  const ang = (l) => Math.atan2(l.z, l.x - 0.006);
  const plate = (l) => l.y > 1.305 && l.y < 1.5 && l.x > 0.0 && Math.abs(ang(l)) < 1.05;                      // chest plate (painted, gunmetal)
  const plateEdge = (l) => plate(l) && (l.y < 1.32 || Math.abs(ang(l)) > 0.93);
  const abs = (l) => l.y > 1.1 && l.y < 1.305 && l.x > 0.03 && Math.abs(ang(l)) < 0.6;                         // abdomen panel
  const side = (l) => l.y > 1.085 && l.y < 1.31 && Math.abs(ang(l)) > 1.2 && Math.abs(ang(l)) < 1.95;        // side panels (seen in a fight)
  const seam = (l) => l.x > 0.04 && Math.abs(l.z) < 0.006 && l.y > 1.1 && l.y < 1.31;
  acc.add(loft(torso, 18), M4(), {
    part: 'torso',
    colorFn: (l) => (plateEdge(l) ? pal.trim : plate(l) ? pal.armor : seam(l) ? pal.trim : abs(l) || side(l) ? pal.panel : pal.suit),
    glowFn: (l) => (plateEdge(l) ? 0.7 : seam(l) ? 0.55 : 0), shine: 0,
    aoFn: (l) => (l.x > 0 && l.y > 1.28 && l.y < 1.32 && Math.abs(ang(l)) < 1.0 ? 0.35 : 0),
    weights: (v) => { const k = smooth(1.04, 1.2, v.y); const w = [[B.chest, k], [B.pelvis, 1 - k]];
      if (v.y > 1.4 && Math.abs(v.z) > 0.11) { const s = smooth(0.11, 0.19, Math.abs(v.z)) * smooth(1.4, 1.5, v.y) * 0.5; w[0][1] *= 1 - s; w.push([v.z > 0 ? B.uaF : B.uaB, s]); } return w; },
  });
  // neck: bodysuit collar → skin (mostly hidden by the scarf + mask)
  acc.add(tube([{ y: 1.54, rx: 0 }, { y: 1.555, rx: 0.04, rz: 0.044, x: 0.004 }, { y: 1.6, rx: 0.039, rz: 0.042, x: 0.006 }, { y: 1.64, rx: 0.037, rz: 0.04, x: 0.008 },
    { y: 1.7, rx: 0.034, rz: 0.036, x: 0.008 }, { y: 1.72, rx: 0 }], 10), M4(), {
    part: 'neck', colorFn: (l) => (l.y < 1.64 ? pal.suit : pal.skin), aoFn: (l) => (l.y > 1.64 ? neckAO(l) : 0),
    weights: (v) => { const a = smooth(1.55, 1.6, v.y), b = smooth(1.66, 1.71, v.y); return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, b]]; } });
  acc.add(headGeo(hr, 22, 18, 1), hm, { part: 'head', color: pal.skin, weights: W1(B.head) });

  // ---------------------------------------------------------------- mask: gunmetal shell over the lower face (nose bridge → under the chin,
  // ear to ear), glowing top edge + two vent slits on each cheek
  {
    const r = hr * 1.05, P = [0, 0, 0];
    const surf = (u, v) => { const ph = -2.05 + 4.1 * u, t0 = 1.97 + 0.05 * ph * ph, th = t0 + (2.93 - t0) * v; return headPoint(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), r, [0, 0, 0], 1); };
    const nf = (u, v) => { const p = surf(u, v); headPoint(0, 0, 0, r, P, 1); const d = [p[0] + 0.008, p[1] - 0.012, p[2]], l = Math.hypot(...d) || 1; return d.map((q) => q / l); };
    const mg = shell(surf, nf, 18, 5, 0.008);
    const uv = (l) => { const ph = Math.atan2(l.z / 0.93, l.x + 0.008); return ph; };
    const vent = (l) => { const ph = Math.abs(uv(l)); return ph > 0.75 && ph < 1.25 && l.y < -0.035 * hk && l.y > -0.075 * hk && (Math.floor((l.y + 1) / (0.011 * hk)) % 2 === 0); };
    const topEdge = (l) => { const ph = uv(l), t0 = 1.97 + 0.05 * ph * ph, d = Math.hypot(l.x + 0.008, (l.y - 0.012) / 1.15, l.z / 0.93) || 1, th = Math.acos(Math.max(-1, Math.min(1, ((l.y - 0.012) / 1.15) / d))); return th < t0 + 0.07; };
    acc.add(mg, hm, { part: 'mask', colorFn: (l) => (topEdge(l) ? pal.trim : vent(l) ? pal.trim : pal.mask), glowFn: (l) => (topEdge(l) ? 0.55 : vent(l) ? 0.8 : 0), shine: 0.35, weights: W1(B.head), line: 0.9 });
  }

  // ---------------------------------------------------------------- shoulder plates (both), rounded, glowing lower rim
  for (const s of [1, -1]) {
    const z = s * 0.165 * 1.12, r = 0.088, cy = 1.53;
    const pg = shell((u, v) => { const ph = -1.35 + u * 2.7, th = 0.12 + v * 1.25; return [Math.sin(ph) * Math.sin(th) * r * 1.02, cy + Math.cos(th) * r * 0.8, z + s * (0.008 + Math.cos(ph) * Math.sin(th) * r)]; },
      (u, v) => { const ph = -1.35 + u * 2.7, th = 0.12 + v * 1.25; return [Math.sin(ph) * Math.sin(th), Math.cos(th), s * Math.cos(ph) * Math.sin(th)]; }, 9, 4, 0.011);
    acc.add(pg, M4(), { part: 'armor', colorFn: (l) => (l.y < cy - r * 0.2 ? pal.trim : pal.armor), glowFn: (l) => (l.y < cy - r * 0.2 ? 0.6 : 0), shine: 0.5, weights: () => [[s > 0 ? B.uaF : B.uaB, 0.7], [B.chest, 0.3]] });
  }

  // ---------------------------------------------------------------- arms: bodysuit sleeves → armoured vambraces (ring bulge) → gloved fists
  const ARM = [[1.605, 0], [1.594, 0.042], [1.572, 0.06], [1.535, 0.066], [1.48, 0.062, 0.003], [1.4, 0.056, 0.006], [1.31, 0.051, 0.005], [1.22, 0.045], [1.15, 0.042],
    [1.1, 0.045], [1.07, 0.048], [1.05, 0.054], [1.035, 0.056], [0.97, 0.052], [0.9, 0.047], [0.875, 0.048], [0.862, 0.04], [0.848, 0.037], [0.83, 0.0345], [0.81, 0.032], [0.79, 0.027], [0.782, 0]];
  const vam = (l) => l.y < 1.05 && l.y > 0.868;
  for (const sd of ['F', 'B']) {
    const z = sd === 'F' ? 0.165 : -0.165, ua = B['ua' + sd], fa = B['fa' + sd];
    const rings = ARM.map(([y, r, x = 0]) => ({ y, rx: r * 1.0, rz: r * 1.12, z: z * (y > 1.45 ? 1 + (y - 1.45) * 0.35 : 1), x }));
    acc.add(tube(rings, 10), M4(), {
      part: 'arms', colorFn: (l) => (l.y < 0.88 && l.y > 0.866 ? pal.trim : vam(l) ? (l.y > 1.035 ? pal.trim : pal.armor) : l.y < 0.866 ? pal.glove : pal.suit),
      glowFn: (l) => ((l.y < 0.88 && l.y > 0.866) || (vam(l) && l.y > 1.035) ? 0.6 : 0), shine: 0.15,
      weights: (v) => { const k = smooth(1.09, 1.2, v.y); const w = [[ua, k], [fa, 1 - k]]; if (v.y > 1.5) { const s = smooth(1.5, 1.6, v.y) * 0.4; w[0][1] *= 1 - s; w.push([B.chest, s]); } if (v.y < 0.83) { const s = smooth(0.83, 0.8, v.y) * 0.5; w[1][1] *= 1 - s; w.push([B['hand' + sd], s]); } return w; },
    });
    // gloved fist (hand-local: +Y along the forearm, origin = wrist) wrapped around the kodachi handle + knuckle guard + thumb
    const hb = B['hand' + sd], Mh = bind[hb], th = sd === 'F' ? -1 : 1;
    const fist = rb(new THREE.BoxGeometry(0.072, 0.092, 0.082, 2, 3, 2), 0.66, 0.04, 0.052, 0.046); fist.translate(0.003, 0.05, 0);
    acc.add(fist, Mh, { part: 'hands', color: pal.glove, weights: W1(hb) });
    const kp = rb(new THREE.BoxGeometry(0.018, 0.05, 0.074, 1, 2, 2), 0.35, 0.012, 0.03, 0.04); kp.translate(-0.032, 0.062, 0);
    acc.add(kp, Mh, { part: 'hands', colorFn: (l) => (l.x < -0.039 ? pal.trim : pal.armor), glowFn: (l) => (l.x < -0.039 ? 0.7 : 0), shine: 0.4, weights: W1(hb), line: 0.8 });
    const tb = tube([{ y: -0.004, rx: 0 }, { y: 0, rx: 0.014, rz: 0.016 }, { y: 0.036, rx: 0.012, rz: 0.013 }, { y: 0.046, rx: 0 }], 5);
    tb.rotateX(-th * 1.35); tb.translate(0.032, 0.04, th * 0.034);
    acc.add(tb, Mh, { part: 'hands', color: pal.glove, weights: W1(hb) });
  }

  // ---------------------------------------------------------------- legs: suit → thigh plate (outer-front), knee pad, shin greave, wraps; tabi
  for (const sd of ['F', 'B']) {
    const z = sd === 'F' ? 0.09 : -0.09, zs = Math.sign(z), th = B['th' + sd], sh = B['shin' + sd];
    const rings = [[1.0, 0], [0.99, 0.058], [0.95, 0.087], [0.88, 0.089, 0.004], [0.78, 0.083, 0.006], [0.69, 0.075, 0.004], [0.6, 0.067], [0.53, 0.06], [0.5, 0.06, 0.006], [0.47, 0.059, 0.008], [0.44, 0.056, 0.004],
      [0.4, 0.056, -0.002], [0.35, 0.059, -0.006], [0.27, 0.057, -0.006], [0.19, 0.049], [0.11, 0.042], [0.04, 0.039], [-0.012, 0.038], [-0.03, 0]]
      .map(([y, r, x = 0]) => ({ y, rx: r * 1.05, rz: r * 0.97, z, x }));
    const la = (l) => Math.atan2((l.z - z) * zs, l.x);   // 0 = front, + = outer side
    const thighP = (l) => l.y > 0.64 && l.y < 0.86 && la(l) > 0.25 && la(l) < 1.7;
    const knee = (l) => l.y > 0.43 && l.y < 0.54 && Math.abs(la(l)) < 1.1;
    const greave = (l) => l.y > 0.13 && l.y < 0.38 && Math.abs(la(l)) < 1.25;
    const wrap = (l) => l.y < 0.12 && l.y > -0.005;
    const legW = (v) => { const k = smooth(0.42, 0.51, v.y); const w = [[th, k], [sh, 1 - k]]; if (v.y > 0.93) { const s = smooth(0.93, 1.0, v.y) * 0.45; w[0][1] *= 1 - s; w.push([B.pelvis, s]); } return w; };
    acc.add(tube(rings, 10), M4(), {
      part: 'legs',
      colorFn: (l) => (thighP(l) ? (l.y < 0.656 ? pal.trim : pal.armor) : knee(l) ? pal.armor : greave(l) ? (l.y > 0.366 ? pal.trim : pal.armor) : wrap(l) ? (Math.floor((l.y + 0.01) / 0.03) % 2 ? pal.wrap : pal.boots) : pal.suit),
      glowFn: (l) => ((thighP(l) && l.y < 0.656) || (greave(l) && l.y > 0.366) ? 0.6 : 0), shine: 0.1, weights: legW,
    });
    // split-toe tabi (foot-local: +Y toward the toe, +X down): four-toe lobe (lateral) + big toe (medial), glowing sole edge
    const lat = sd === 'F' ? 1 : -1;
    const bf = tube([{ y: -0.058, rx: 0, x: 0.034 }, { y: -0.05, rx: 0.027, rz: 0.031, x: 0.04 }, { y: -0.028, rx: 0.035, rz: 0.039, x: 0.038 }, { y: 0.02, rx: 0.038, rz: 0.041, x: 0.036 },
      { y: 0.08, rx: 0.033, rz: 0.042, x: 0.042 }, { y: 0.13, rx: 0.027, rz: 0.039, x: 0.048 }, { y: 0.16, rx: 0.022, rz: 0.026, x: 0.051, z: lat * 0.012 }, { y: 0.182, rx: 0.014, rz: 0.017, x: 0.053, z: lat * 0.013 }, { y: 0.19, rx: 0, x: 0.054, z: lat * 0.013 }], 8);
    acc.add(bf, bind[B['foot' + sd]], { part: 'boots', colorFn: (l) => (l.x > 0.066 ? pal.trim : pal.boots), glowFn: (l) => (l.x > 0.066 ? 0.55 : 0), weights: W1(B['foot' + sd]) });
    const bt = tube([{ y: 0.125, rx: 0, x: 0.05, z: -lat * 0.022 }, { y: 0.135, rx: 0.017, rz: 0.015, x: 0.05, z: -lat * 0.024 }, { y: 0.19, rx: 0.016, rz: 0.014, x: 0.052, z: -lat * 0.026 }, { y: 0.204, rx: 0, x: 0.054, z: -lat * 0.026 }], 6);
    acc.add(bt, bind[B['foot' + sd]], { part: 'boots', colorFn: (l) => (l.x > 0.064 ? pal.trim : pal.boots), glowFn: (l) => (l.x > 0.064 ? 0.5 : 0), weights: W1(B['foot' + sd]) });
  }

  // ---------------------------------------------------------------- belt + buckle + pouch + the two crossed scabbards (all on the pelvis)
  {
    const bg = shell((u, v) => { const a = u * TAU * 0.999; return [Math.cos(a) * 0.104 + 0.002, 1.088 - v * 0.04, Math.sin(a) * 0.158]; }, (u) => { const a = u * TAU; return [Math.cos(a), 0, Math.sin(a)]; }, 20, 1, 0.012);
    acc.add(bg, M4(), { part: 'belt', color: pal.belt, weights: W1(B.pelvis) });
    const bk = rb(new THREE.BoxGeometry(0.018, 0.04, 0.05, 1, 2, 2), 0.45, 0.012, 0.024, 0.03);
    acc.add(bk, T(0.108, 1.068, 0.0), { part: 'belt', colorFn: (l) => (l.x > 0.006 ? pal.trim : pal.armor), glowFn: (l) => (l.x > 0.006 ? 0.8 : 0), shine: 0.4, weights: W1(B.pelvis), line: 0.7 });
    const pouch = rb(new THREE.BoxGeometry(0.05, 0.06, 0.035, 1, 1, 1), 0.55, 0.03, 0.036, 0.022); pouch.rotateY(-0.5);
    acc.add(pouch, T(0.04, 1.035, 0.16), { part: 'belt', color: pal.belt, weights: W1(B.pelvis) });
    for (const sd of ['F', 'B']) {
      const S = SHEATH[sd], m = new THREE.Matrix4().compose(new THREE.Vector3(S.mouth[0], S.mouth[1] + 1, S.mouth[2]), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...S.dir)), new THREE.Vector3(1, 1, 1));
      const sg = tube([{ y: -0.004, rx: 0 }, { y: 0, rx: 0.019, rz: 0.011 }, { y: 0.02, rx: 0.02, rz: 0.012 }, { y: 0.024, rx: 0.017, rz: 0.0105 }, { y: SAYA_L * 0.7, rx: 0.016, rz: 0.0095 },
        { y: SAYA_L - 0.02, rx: 0.014, rz: 0.009 }, { y: SAYA_L, rx: 0.011, rz: 0.008 }, { y: SAYA_L + 0.006, rx: 0 }], 6);
      acc.add(sg, m, { part: 'saya', colorFn: (l) => (l.y < 0.021 ? pal.trim : l.y > SAYA_L - 0.022 ? pal.accent : pal.saya), glowFn: (l) => (l.y < 0.021 ? 0.75 : l.y > SAYA_L - 0.022 ? 0.5 : 0), shine: 0.4, weights: W1(B.pelvis), line: 0.8 });
    }
  }

  // ---------------------------------------------------------------- scarf: thick wrap around the neck, knot at the back, two long spring tails
  {
    const wg = shell((u, v) => { const a = u * TAU * 0.999, R = 0.07 + 0.024 * Math.sin(Math.PI * v); return [Math.cos(a) * R * 1.05 + 0.006, 1.565 + v * 0.105 - 0.012 * Math.cos(a), Math.sin(a) * R * 1.12]; },
      (u, v) => { const a = u * TAU; return [Math.cos(a), 0.3 * (v - 0.5), Math.sin(a)]; }, 18, 3, 0.022);
    const fold = (l) => Math.abs(l.y - 1.62 + 0.012 * Math.cos(Math.atan2(l.z, l.x))) < 0.006;
    acc.add(wg, M4(), { part: 'scarf', colorFn: (l) => (fold(l) ? pal.scarfDark : pal.scarf), aoFn: (l) => (fold(l) ? 0.4 : 0), weights: (v) => { const k = smooth(1.58, 1.68, v.y) * 0.45; return [[B.chest, 1 - k], [B.neck, k]]; } });
    const knot = rb(new THREE.BoxGeometry(0.05, 0.05, 0.06, 1, 1, 1), 0.6, 0.03, 0.03, 0.036); knot.rotateZ(0.3);
    acc.add(knot, T(-0.098, 1.6, -0.01), { part: 'scarf', color: pal.scarf, weights: () => [[B.chest, 0.6], [B.neck, 0.4]] });
    for (let i = 0; i < 2; i++) {
      const L = 0.64 - i * 0.13, zs = i ? -0.026 : 0.026, n = 4, root = new THREE.Vector3(-0.112, 1.592 - i * 0.01, zs);
      const at = (v) => new THREE.Vector3(root.x - L * (0.5 * v - 0.12 * v * v), root.y - L * (0.62 * v + 0.3 * v * v), root.z + zs * 2.5 * v);
      const pts = []; for (let k = 0; k <= n; k++) pts.push(at(k / n).toArray());
      const ids = chain('scarf' + i, B.chest, pts, { stiff: [0, 0.07, 0.04, 0.025, 0.018], drag: 0.9, grav: 5, collide: true, tail: true, sh: true });
      const vOf = (q) => { let best = 0, bd = 1e9; for (let k = 0; k <= 32; k++) { const d = at(k / 32).distanceToSquared(q); if (d < bd) { bd = d; best = k / 32; } } return best; };
      const tg = shell((u, v) => { const p = at(v), q = at(Math.min(1, v + 0.02)).sub(at(Math.max(0, v - 0.02))).normalize(), w = 0.088 * (1 - 0.2 * v); return [p.x - q.y * (u - 0.5) * w, p.y + q.x * (u - 0.5) * w, p.z + 0.002]; }, () => [0, 0, 1], 1, 10, 0.009);
      acc.add(tg, M4(), { part: 'scarf', colorFn: (l) => { const v = vOf(l); return v > 0.9 ? pal.trim : v > 0.86 ? pal.accent : pal.scarf; }, glowFn: (l) => { const v = vOf(l); return v > 0.9 ? 0.7 : v > 0.86 ? 0.35 : 0; },
        weights: (v) => chainW(ids, vOf(v)), line: 0.85 });
    }
  }

  // ---------------------------------------------------------------- hair: cap, sharp asymmetric bangs, long side locks framing the mask, a few
  // nape spikes, HIGH PONYTAIL on a 4-bone chain with a crimson glowing tie
  {
    const capR = hr + 0.01;
    const cap = headGeo(capR, 18, 14); cap.scale(1.07, 1.06, 1.09); cap.translate(-0.01, 0.012, 0);
    acc.add(cap, hm, { part: 'hair', color: pal.hair, shine: 0.8, weights: W1(B.head), line: 1,
      keep: (c) => !(c.x > 0.015 * hk && c.y < 0.06 * hk) && c.y > -0.13 * hk && !(c.x > -0.035 * hk && c.y < -0.025 * hk) });
    const spikes = [];
    const BL = [0.12, 0.15, 0.11, 0.165, 0.13, 0.1, 0.085];
    for (let i = 0; i < 7; i++) { const u = i / 6 - 0.5, z = u * 0.21; spikes.push({ at: [0.076 * hk, 0.1 * hk, z * hk], dir: [0.6, -1, u * 0.8 - 0.3], L: BL[i], w: 0.038, d: 0.016, s: 0.32 }); }
    for (const s of [-1, 1]) spikes.push({ at: [0.05 * hk, 0.045 * hk, s * 0.115 * hk], dir: [0.16, -1, s * 0.12], L: 0.21, w: 0.026, d: 0.016, s: 0.24 });
    for (const [x, y, z] of [[-1, -0.3, 0.06], [-1, -0.3, -0.06], [-0.85, -0.5, 0.35], [-0.85, -0.5, -0.35], [-0.95, 0.2, 0.25], [-0.95, 0.2, -0.25]]) { const l = Math.hypot(x, y, z);
      spikes.push({ at: [(x / l * 0.095 - 0.01) * hk, (y / l * 0.095 + 0.02) * hk, (z / l * 0.1) * hk], dir: [x * 0.6, -1, z * 0.8], L: 0.075, w: 0.034, d: 0.026, s: 0.3 }); }
    for (const sp of spikes) {
      const d = new THREE.Vector3(...sp.dir).normalize(), root = new THREE.Vector3(...sp.at).add(new THREE.Vector3(...HB)), tip = root.clone().addScaledVector(d, sp.L);
      const ids = chain('hair', B.head, [root.toArray(), tip.toArray()], { stiff: [0, sp.s], drag: 0.86, grav: 2.5, collide: false, sh: true });
      acc.add(spike(sp.L, sp.w, sp.d, 4), bind[ids[0]], { part: 'hair', color: pal.hair, shine: 1, weights: W1(ids[0]), line: 0.85 });
    }
    // high ponytail: tie (crimson glow) on the back of the crown, a full lock that tapers to a point, 4 springy bones
    const P0 = new THREE.Vector3(-0.098 * hk, 0.11 * hk, 0).add(new THREE.Vector3(...HB)), n = 4, L = 0.56, dir = new THREE.Vector3(-0.6, -0.8, 0).normalize();
    const pts = []; for (let k = 0; k <= n; k++) pts.push(P0.clone().addScaledVector(dir, L * k / n).toArray());
    const ids = chain('tail', B.head, pts, { stiff: [0, 0.11, 0.06, 0.035, 0.022], drag: 0.9, grav: 5, collide: false, tail: true, sh: true });
    const tm = new THREE.Matrix4().compose(P0, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1));
    const rings = [{ y: -0.024, rx: 0 }, { y: -0.016, rx: 0.026, rz: 0.026 }, { y: 0.018, rx: 0.026, rz: 0.026 }, { y: 0.03, rx: 0.044, rz: 0.04 }];
    for (let k = 1; k <= 10; k++) { const u = k / 10; rings.push({ y: 0.03 + (L - 0.03) * u, rx: 0.05 * (1 - u * 0.86) * (1 + 0.22 * Math.sin(u * 3.2)), rz: 0.04 * (1 - u * 0.8), x: 0.022 * Math.sin(u * 2.6) }); }
    rings.push({ y: L + 0.035, rx: 0 });
    const tie = (l) => l.y < 0.02 && l.y > -0.016;
    acc.add(tube(rings, 7), tm, { part: 'hair', colorFn: (l) => (tie(l) ? pal.accent : pal.hair), glowFn: (l) => (tie(l) ? 0.75 : 0), weights: (v, l) => chainW(ids, Math.max(0, l.y) / L), line: 0.9, shine: 1 });
  }

  // ---------------------------------------------------------------- twin kodachi on their own bones (local +Y = blade direction from the
  // grip centre; +X = cutting edge): wrapped handle, crimson pommel gem, round guard with a glowing ring, flat blade with a glowing edge
  const daggers = {};
  for (const sd of ['F', 'B']) {
    const z = sd === 'F' ? 0.165 : -0.165, M = new THREE.Matrix4().makeRotationZ(Math.PI).setPosition(0, 0.76, z);   // bind: hanging below the hand
    const id = daggers[sd] = addBone('dagger' + sd, M), W = W1(id);
    acc.add(tube([{ y: -0.082, rx: 0 }, { y: -0.078, rx: 0.012, rz: 0.011 }, { y: 0.03, rx: 0.013, rz: 0.0115 }, { y: 0.034, rx: 0 }], 6), M, {
      part: 'kodachi', colorFn: (l) => (Math.floor((l.y + 0.09) / 0.018) % 2 ? pal.wrap : pal.saya), weights: W, line: 0.6 });
    const gem = new THREE.OctahedronGeometry(0.014, 0); gem.scale(1, 1.3, 1); gem.translate(0, -0.088, 0);
    acc.add(gem, M, { part: 'kodachi', color: pal.accent, glow: 0.8, weights: W, line: 0.5 });
    const gd = new THREE.CylinderGeometry(0.026, 0.026, 0.008, 10, 1); gd.translate(0, 0.038, 0);
    acc.add(gd, M, { part: 'kodachi', colorFn: (l) => (Math.hypot(l.x, l.z) > 0.02 ? pal.trim : pal.armor), glowFn: (l) => (Math.hypot(l.x, l.z) > 0.02 ? 0.7 : 0), weights: W, line: 0.6 });
    const n = 10, R = 6, P = [], I = [], y0 = 0.043, L = 0.44, w = 0.034, sp = 0.0068, sori = 0.014;
    const prof = [[w * 0.55, 0], [w * 0.2, sp], [-w * 0.45, sp * 0.9], [-w * 0.5, 0], [-w * 0.45, -sp * 0.9], [w * 0.2, -sp]];
    for (let k = 0; k <= n; k++) { const u = k / n, y = y0 + (L - y0) * u, cx = -sori * u * u, tp = k === n ? 0.25 : 1 - 0.18 * u; for (let j = 0; j < R; j++) { const [px, pz] = prof[j]; P.push(cx + px * tp, y, pz * tp); } }
    for (let k = 0; k < n; k++) for (let j = 0; j < R; j++) { const a = k * R + j, b = k * R + (j + 1) % R, c = a + R, d = b + R; I.push(a, b, c, b, d, c); }
    const tip = P.length / 3; P.push(-sori - w * 0.15, L + 0.03, 0); for (let j = 0; j < R; j++) I.push(n * R + j, n * R + (j + 1) % R, tip);
    const base = P.length / 3; P.push(0, y0 - 0.002, 0); for (let j = 0; j < R; j++) I.push(base, (j + 1) % R, j);
    const blg = new THREE.BufferGeometry(); blg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); blg.setIndex(I); blg.computeVertexNormals();
    const edge = (l) => { const u = (l.y - y0) / (L - y0), cx = -sori * u * u; return l.x - cx > w * 0.3 || l.y > L - 0.01; };
    acc.add(blg, M, { part: 'kodachi', colorFn: (l) => (edge(l) ? pal.trim : pal.metal), glowFn: (l) => (edge(l) ? 0.95 : 0.06), shine: 0.8, weights: W, line: 0.65 });
  }
  return { daggers, dispose() {} };
}
