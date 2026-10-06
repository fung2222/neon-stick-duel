// 拳師 BRAWLER — anime body (phase 3): a heavy cyber street martial artist, built on the same skeleton and skin accumulator as
// the Swordsman / Mage (js/anime/builder.js calls buildBrawler(ctx)). Procedural only, no external assets.
//   silhouette: broad V-torso (shoulder line half-width 0.272 vs the Swordsman's 0.232), big chest + traps, thick waist, arms
//   ×1.25 · TORN SLEEVELESS JACKET (dark red, open over the bare chest, ragged armholes, high popped collar, back skirt on
//   springs with a torn hem) · CYBERNETIC near arm (gunmetal plates, orange seam bands, glowing elbow ring, shoulder plate) ·
//   bare far arm with hand wraps · both fists in gauntlets with GLOWING KNUCKLE PLATES · thick sash belt + knot + 2 spring tails ·
//   baggy kung-fu trousers into ankle wraps · flat kung-fu shoes with a glowing sole · undercut (shaved sides, swept-back top) ·
//   HEADBAND with a cyber plate and two long spring tails · face: cyber-eye + scar (face atlas).
// Proportions: the skeleton is shared (6.5+ heads, legs = 50 % of the height); the head is a touch smaller (0.126) so the
// heavier body reads ~6.8 heads.
import * as THREE from 'three';
import { tube, shell, spike, smooth, loft } from './geo.js';

const TAU = Math.PI * 2;
export const BRAWLER_HR = 0.126;
/** fist (hand-local: +Y along the forearm toward the knuckles, −X = back of the hand when the twist is 0, origin = wrist) */
export const FIST = { len: 0.118, knuckle: 0.112 };

/**
 * ctx: { acc, B, bind, chain, chainW, pal, hm, HB, hr, headGeo, headPoint, M4, T, W1, neckAO } (from buildCharacter).
 * Returns { dispose() } (everything lives in the one skinned body mesh).
 */
export function buildBrawler(ctx) {
  const { acc, B, bind, chain, chainW, pal, hm, HB, hr, headGeo, headPoint, M4, T, W1, neckAO } = ctx;
  const rb = (g, k, rx, ry, rz) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x / rx, y / ry, z / rz) || 1; p.setXYZ(i, x * (1 - k) + x / r * k, y * (1 - k) + y / r * k, z * (1 - k) + z / r * k); } g.computeVertexNormals(); return g; };

  // ---------------------------------------------------------------- torso: one loft. Broad shoulder line, big chest / pecs, traps, thick
  // waist. The jacket is painted on the loft (open at the front over the bare chest); pec underline + centre line get baked AO
  const R0 = (y, f, b, w, n = 2.2, x = 0) => ({ y, f, b, w, n, x });
  const torso = [R0(0.85, 0, 0, 0), R0(0.866, 0.066, 0.076, 0.102), R0(0.9, 0.102, 0.122, 0.162, 2.3), R0(0.96, 0.108, 0.126, 0.178, 2.4), R0(1.03, 0.104, 0.112, 0.17, 2.3),
    R0(1.1, 0.1, 0.098, 0.156, 2.3), R0(1.17, 0.104, 0.094, 0.158, 2.3, 0.004), R0(1.25, 0.122, 0.1, 0.176, 2.4, 0.008), R0(1.32, 0.146, 0.11, 0.204, 2.5, 0.012),
    R0(1.36, 0.16, 0.114, 0.218, 2.5, 0.014), R0(1.405, 0.168, 0.118, 0.236, 2.7, 0.014), R0(1.46, 0.16, 0.122, 0.262, 3.0, 0.012), R0(1.51, 0.142, 0.12, 0.274, 3.4, 0.01),
    R0(1.55, 0.114, 0.108, 0.246, 3.1, 0.006), R0(1.585, 0.086, 0.088, 0.176, 2.6, 0.004), R0(1.61, 0.064, 0.066, 0.1, 2.1, 0.004), R0(1.624, 0, 0, 0)];
  const open = (l) => 0.05 + Math.max(0, l.y - 1.12) * 0.42;          // jacket opening half-width (V widening to the collar)
  const chest = (l) => l.x > 0 && l.y > 1.1 && l.y < 1.6 && Math.abs(l.z) < open(l);
  const edge = (l) => l.x > 0.02 && l.y > 1.08 && l.y < 1.6 && Math.abs(Math.abs(l.z) - open(l)) < 0.014;   // glowing jacket edge
  const tornHem = (l) => l.y < 1.105 + 0.012 * Math.sin(l.z * 90 + 1.3);   // jacket bottom edge (torn) above the belt
  acc.add(loft(torso, 20), M4(), {
    part: 'torso',
    colorFn: (l) => (l.y < 1.035 ? pal.pants : l.y < 1.1 ? pal.sash : chest(l) ? pal.skin : edge(l) ? pal.trim : tornHem(l) ? pal.jacketDark : pal.jacket),
    glowFn: (l) => (edge(l) ? 0.55 : 0),
    aoFn: (l) => (chest(l) ? Math.max(0.8 * smooth(0.026, 0, Math.abs(l.y - 1.345 - 0.05 * Math.abs(l.z))) * smooth(0.0, 0.035, Math.abs(l.z)), 0.5 * smooth(0.012, 0, Math.abs(l.z)) * smooth(1.12, 1.3, l.y) * smooth(1.36, 1.3, l.y),
      0.45 * smooth(0.01, 0, Math.min(Math.abs(l.y - 1.25), Math.abs(l.y - 1.19))) * smooth(0.065, 0.02, Math.abs(l.z)), 0.4 * smooth(0.04, 0.075, Math.abs(l.z)) * smooth(1.32, 1.2, l.y)) : 0),   // pecs, sternum, abs, obliques
    weights: (v) => { const k = smooth(1.04, 1.2, v.y); const w = [[B.chest, k], [B.pelvis, 1 - k]];
      if (v.y > 1.38 && Math.abs(v.z) > 0.13) { const s = smooth(0.13, 0.26, Math.abs(v.z)) * smooth(1.38, 1.5, v.y) * 0.55; w[0][1] *= 1 - s; w.push([v.z > 0 ? B.uaF : B.uaB, s]); } return w; },
  });
  // high popped jacket collar (open at the front), glowing top edge, ragged back
  {
    const cv = (v) => (v < 0.34 ? v * 0.24 : 0.08 + (v - 1 / 3) * 1.38);
    const cg = shell((u, v) => { const a = 0.75 + u * (TAU - 1.5), w = cv(v); return [0.004 + Math.cos(a) * (0.088 + (1 - w) * 0.03), 1.648 - w * 0.085 + 0.008 * Math.cos(a), Math.sin(a) * (0.104 + (1 - w) * 0.036)]; },
      (u) => { const a = 0.75 + u * (TAU - 1.5); return [Math.cos(a), 0.15, Math.sin(a)]; }, 14, 3, 0.014);
    acc.add(cg, M4(), { part: 'collar', colorFn: (l) => (l.y > 1.64 + 0.008 * Math.cos(Math.atan2(l.z, l.x)) ? pal.trim : pal.jacket), glowFn: (l) => (l.y > 1.64 + 0.008 * Math.cos(Math.atan2(l.z, l.x)) ? 0.6 : 0),
      weights: (v) => { const k = smooth(1.58, 1.68, v.y) * 0.4; return [[B.chest, 1 - k], [B.neck, k]]; } });
  }
  // torn armholes: ragged fabric shards hanging over the deltoid edge (both sides)
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
    const a = -0.9 + i * 0.85, g = spike(0.05 + (i % 2) * 0.02, 0.022, 0.006, 4); g.rotateZ(Math.PI); g.rotateX(s * (0.35 + 0.1 * i));
    acc.add(g, T(Math.cos(a) * 0.09 + 0.01, 1.565 - 0.02 * Math.abs(Math.sin(a)), s * (0.235 + 0.02 * Math.cos(a))), { part: 'torso', color: pal.jacket, weights: () => [[B.chest, 0.6], [s > 0 ? B.uaF : B.uaB, 0.4]], line: 0.7 });
  }
  // thick neck + traps, then the head
  acc.add(tube([{ y: 1.55, rx: 0 }, { y: 1.565, rx: 0.056, rz: 0.062, x: 0.004 }, { y: 1.62, rx: 0.052, rz: 0.056, x: 0.008 }, { y: 1.66, rx: 0.048, rz: 0.051, x: 0.008 }, { y: 1.695, rx: 0.044, rz: 0.046, x: 0.008 }, { y: 1.72, rx: 0 }], 10), M4(),
    { part: 'neck', color: pal.skin, aoFn: neckAO, weights: (v) => { const a = smooth(1.56, 1.61, v.y), b = smooth(1.66, 1.71, v.y); return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, b]]; } });
  acc.add(headGeo(hr, 22, 18, 1), hm, { part: 'head', color: pal.skin, weights: W1(B.head) });

  // ---------------------------------------------------------------- arms ×1.25: near = CYBER prosthetic, far = bare skin + hand wraps
  const ARM = [[1.628, 0], [1.614, 0.06], [1.592, 0.084], [1.552, 0.097], [1.5, 0.096, 0.004], [1.43, 0.09, 0.012], [1.35, 0.083, 0.012], [1.27, 0.072, 0.006], [1.2, 0.064],
    [1.155, 0.061], [1.135, 0.062], [1.12, 0.064], [1.08, 0.071], [1.04, 0.073, 0.004], [0.98, 0.068], [0.93, 0.061], [0.895, 0.057], [0.88, 0.056], [0.85, 0.055], [0.82, 0.052], [0.8, 0.046], [0.788, 0]];
  for (const side of ['F', 'B']) {
    const z = side === 'F' ? 0.165 : -0.165, ua = B['ua' + side], fa = B['fa' + side], cyber = side === 'F';
    const rings = ARM.map(([y, r, x = 0]) => ({ y, rx: r * 0.96, rz: r, z: z * (y > 1.42 ? 1 + (y - 1.42) * 0.62 : 1), x }));
    const band = (l) => (l.y < 1.145 && l.y > 1.128) || (l.y < 0.9 && l.y > 0.882) || (l.y < 1.44 && l.y > 1.425);   // cyber: glowing seam bands (elbow ring, wrist, biceps)
    const wrap = (l) => l.y < 1.0 && l.y > 0.8 && (Math.floor((l.y - 0.8) / 0.033) % 2 === 0);
    acc.add(tube(rings, 12), M4(), {
      part: 'arms',
      colorFn: cyber ? (l) => (l.y > 1.575 ? pal.jacket : band(l) ? pal.trim : l.y > 1.2 ? pal.metal : pal.metalDark) : (l) => (l.y > 1.575 ? pal.jacket : l.y > 1.0 ? pal.skin : wrap(l) ? pal.wrap : pal.wrapDark),
      glowFn: cyber ? (l) => (band(l) ? 0.75 : 0) : () => 0,
      shine: cyber ? 0.45 : 0,
      weights: (v) => { const k = smooth(1.09, 1.2, v.y); const w = [[ua, k], [fa, 1 - k]]; if (v.y > 1.5) { const s = smooth(1.5, 1.62, v.y) * 0.4; w[0][1] *= 1 - s; w.push([B.chest, s]); } if (v.y < 0.83) { const s = smooth(0.83, 0.8, v.y) * 0.5; w[1][1] *= 1 - s; w.push([B['hand' + side], s]); } return w; },
    });
  }
  // cyber shoulder plate (near side) over the deltoid, with a glowing edge
  {
    const z = 0.165 * 1.13, r = 0.112, cy = 1.53;
    const pg = shell((u, v) => { const ph = -1.35 + u * 2.7, th = 0.12 + v * 1.2; return [Math.sin(ph) * Math.sin(th) * r * 1.02, cy + Math.cos(th) * r * 0.78, z + 0.01 + Math.cos(ph) * Math.sin(th) * r]; },
      (u, v) => { const ph = -1.35 + u * 2.7, th = 0.12 + v * 1.2; return [Math.sin(ph) * Math.sin(th), Math.cos(th), Math.cos(ph) * Math.sin(th)]; }, 10, 4, 0.012);
    acc.add(pg, M4(), { part: 'arms', colorFn: (l) => (l.y < cy - r * 0.2 ? pal.trim : pal.metal), glowFn: (l) => (l.y < cy - r * 0.2 ? 0.65 : 0), shine: 0.5, weights: () => [[B.uaF, 0.7], [B.chest, 0.3]] });
  }
  // ---------------------------------------------------------------- fists: rounded gauntlet fist + glowing knuckle plate + thumb + cuff
  for (const side of ['F', 'B']) {
    const hb = B['hand' + side], Mh = bind[hb], th = side === 'F' ? -1 : 1, cyber = side === 'F';
    const fist = rb(new THREE.BoxGeometry(0.09, FIST.len, 0.108, 3, 3, 3), 0.5, 0.05, 0.066, 0.06); fist.translate(0.004, FIST.len * 0.5 + 0.004, 0);
    acc.add(fist, Mh, { part: 'hands', colorFn: (l) => (cyber ? pal.metalDark : (l.y < 0.05 ? pal.wrap : pal.skin)), shine: cyber ? 0.4 : 0, weights: W1(hb) });
    // knuckle plate: back of the hand + across the knuckle row (the striking face), glowing
    const kp = rb(new THREE.BoxGeometry(0.03, 0.07, 0.1, 1, 2, 3), 0.35, 0.02, 0.04, 0.056); kp.translate(-0.038, 0.082, 0);
    acc.add(kp, Mh, { part: 'hands', colorFn: (l) => (l.y > 0.1 || l.x < -0.045 ? pal.trim : pal.metal), glowFn: (l) => (l.y > 0.1 || l.x < -0.045 ? 0.9 : 0.1), shine: 0.5, weights: W1(hb), line: 0.8 });
    // thumb folded across the front of the fingers (palm side, +X)
    const tb = tube([{ y: -0.004, rx: 0 }, { y: 0, rx: 0.018, rz: 0.02 }, { y: 0.045, rx: 0.016, rz: 0.017 }, { y: 0.058, rx: 0 }], 6);
    tb.rotateX(-th * 1.35); tb.translate(0.04, 0.05, th * 0.044);
    acc.add(tb, Mh, { part: 'hands', color: cyber ? pal.metalDark : pal.skin, weights: W1(hb) });
    // gauntlet cuff at the wrist, flared, glowing rim
    const cf = tube([{ y: -0.05, rx: 0 }, { y: -0.048, rx: 0.06, rz: 0.064 }, { y: -0.005, rx: 0.062, rz: 0.066 }, { y: 0.004, rx: 0.066, rz: 0.07 }, { y: 0.016, rx: 0.066, rz: 0.07 }, { y: 0.02, rx: 0 }], 10);
    acc.add(cf, Mh, { part: 'hands', colorFn: (l) => (l.y > 0.0 ? pal.trim : pal.metal), glowFn: (l) => (l.y > 0.0 ? 0.7 : 0), shine: 0.4, weights: (v, l) => { const k = smooth(-0.045, 0.0, l.y); return [[hb, k], [B['fa' + side], 1 - k]]; } });
  }

  // ---------------------------------------------------------------- legs: baggy kung-fu trousers → ankle wraps → flat shoes with a glowing sole
  for (const side of ['F', 'B']) {
    const z = side === 'F' ? 0.1 : -0.1, th = B['th' + side], sh = B['shin' + side];
    const rings = [[1.0, 0], [0.99, 0.072], [0.95, 0.106], [0.88, 0.116, 0.004], [0.78, 0.114, 0.008], [0.66, 0.104, 0.006], [0.56, 0.094], [0.48, 0.088], [0.42, 0.09, -0.004], [0.33, 0.089, -0.01],
      [0.25, 0.08, -0.008], [0.2, 0.068, -0.004], [0.172, 0.056], [0.16, 0.052], [0.11, 0.05], [0.06, 0.049], [0.02, 0.048], [-0.02, 0.046], [-0.035, 0]]
      .map(([y, r, x = 0]) => ({ y, rx: r, rz: r * 0.95, z, x }));
    acc.add(tube(rings, 12), M4(), {
      part: 'legs', colorFn: (l) => (l.y > 0.166 ? pal.pants : l.y > 0.15 ? pal.wrapDark : (Math.floor((l.y + 0.02) / 0.045) % 2 ? pal.wrap : pal.wrapDark)),
      weights: (v) => { const k = smooth(0.42, 0.51, v.y); const w = [[th, k], [sh, 1 - k]]; if (v.y > 0.93) { const s = smooth(0.93, 1.0, v.y) * 0.45; w[0][1] *= 1 - s; w.push([B.pelvis, s]); } return w; },
    });
    // trouser side seam stripe (glowing amber line down the outside of each leg — the legs read against the night city)
    // kung-fu shoe (foot-local: +Y toward the toe, +X down): flat, rounded toe, glowing sole edge
    const bf = tube([{ y: -0.06, rx: 0, x: 0.036 }, { y: -0.052, rx: 0.03, rz: 0.038, x: 0.042 }, { y: -0.03, rx: 0.04, rz: 0.048, x: 0.038 }, { y: 0.02, rx: 0.043, rz: 0.05, x: 0.036 },
      { y: 0.08, rx: 0.036, rz: 0.054, x: 0.044 }, { y: 0.14, rx: 0.029, rz: 0.052, x: 0.05 }, { y: 0.185, rx: 0.022, rz: 0.044, x: 0.054 }, { y: 0.21, rx: 0, x: 0.056 }], 10);
    acc.add(bf, bind[B['foot' + side]], { part: 'boots', colorFn: (l) => (l.x > 0.068 ? pal.trim : pal.shoes), glowFn: (l) => (l.x > 0.068 ? 0.5 : 0), weights: W1(B['foot' + side]) });
  }
  // ---------------------------------------------------------------- sash belt (thick, two-tone) + knot on the near hip + 2 spring tails
  {
    const sg = shell((u, v) => { const a = u * TAU * 0.999; return [Math.cos(a) * 0.118 + 0.002, 1.1 - v * 0.072, Math.sin(a) * 0.176]; }, (u) => { const a = u * TAU; return [Math.cos(a), 0, Math.sin(a)]; }, 20, 1, 0.014);
    acc.add(sg, M4(), { part: 'belt', colorFn: (l) => (Math.abs(l.y - 1.064) > 0.026 ? pal.sashEdge : pal.sash), glowFn: (l) => (Math.abs(l.y - 1.064) > 0.026 ? 0.35 : 0), weights: W1(B.pelvis) });
    const knot = rb(new THREE.BoxGeometry(0.06, 0.07, 0.07, 1, 1, 1), 0.6, 0.035, 0.04, 0.04); knot.rotateZ(0.4);
    acc.add(knot, T(0.07, 1.06, 0.15), { part: 'belt', color: pal.sash, weights: W1(B.pelvis) });
    for (let i = 0; i < 2; i++) {
      const L = 0.34 - i * 0.07, x0 = 0.06 - i * 0.035, z0 = 0.17 + i * 0.012, n = 3, pts = [];
      for (let k = 0; k <= n; k++) pts.push([x0 - 0.015 * (k / n), 1.04 - L * (k / n), z0 + 0.015 * k]);
      const ids = chain('sash' + i, B.pelvis, pts, { stiff: [0, 0.15, 0.08, 0.04], drag: 0.9, grav: 7, collide: true });
      const tg = shell((u, v) => [x0 + (u - 0.5) * 0.06 - 0.015 * v, 1.04 - L * v, z0 + 0.015 * 3 * v], () => [0, 0, 1], 2, 6, 0.01);
      acc.add(tg, M4(), { part: 'belt', colorFn: (l) => (1.04 - l.y > L * 0.9 ? pal.sashEdge : pal.sash), glowFn: (l) => (1.04 - l.y > L * 0.9 ? 0.5 : 0), weights: (v) => chainW(ids, (1.04 - v.y) / L) });
    }
  }
  // ---------------------------------------------------------------- jacket back skirt on springs: open at the front, torn hem, collides with the legs
  {
    const gap = 1.05, nCh = 5, L = 0.36, y0 = 1.1, n = 3;
    const angs = Array.from({ length: nCh }, (_, i) => gap + 0.12 + (TAU - 2 * gap - 0.24) * (i / (nCh - 1)));
    const torn = (a) => 1 - 0.13 * (0.5 + 0.5 * Math.sin(a * 7.3)) - 0.06 * (0.5 + 0.5 * Math.sin(a * 17.1 + 1));   // ragged hem length factor
    const rad = (a, v) => { const fl = 0.055 * v; return [(0.128 + fl) * Math.cos(a) - 0.01 * v, (0.182 + fl * 1.15) * Math.sin(a)]; };
    const ids = [];
    for (const a of angs) {
      const pts = []; for (let k = 0; k <= n; k++) { const v = k / n, [x, z] = rad(a, v); pts.push([x, y0 - L * torn(a) * v, z]); }
      ids.push(chain('jacket', B.pelvis, pts, { stiff: [0, 0.2, 0.11, 0.06], drag: 0.92, grav: 6, collide: true, ang: a }));
    }
    const vmap = (v) => (v < 0.8 ? v * 0.93 / 0.8 : 0.93 + (v - 0.8) * 0.35);   // last row thin: crisp glowing hem
    const surf = (u, v) => { const a = gap + u * (TAU - 2 * gap), vv = vmap(v), [x, z] = rad(a, vv); return [x, y0 - L * torn(a) * vv, z]; };
    const nrm = (u) => { const a = gap + u * (TAU - 2 * gap); return [Math.cos(a), 0.15, Math.sin(a)]; };
    const cg = shell(surf, nrm, 18, 5, 0.012);
    const angOf = (q) => { let a = Math.atan2(q.z / 1.15, q.x); if (a < 0) a += TAU; return Math.min(TAU - gap, Math.max(gap, a)); };
    const vOf = (q) => Math.max(0, Math.min(1, (y0 - q.y) / (L * torn(angOf(q)))));
    acc.add(cg, M4(), {
      part: 'jacket', colorFn: (l) => { const v = vOf(l); if (v > 0.92) return pal.trim; const a = angOf(l), [x, z] = rad(a, v); return Math.hypot(l.x, l.z / 1.15) >= Math.hypot(x, z / 1.15) - 0.0005 ? pal.jacket : pal.lining; },
      glowFn: (l) => (vOf(l) > 0.92 ? 0.55 : 0),
      weights: (q) => {
        const a = angOf(q), t = vOf(q); let i = angs.findIndex((x) => x > a); let w;
        if (i < 0) w = [[ids[nCh - 1], 1]]; else if (i === 0) w = [[ids[0], 1]]; else { const k = (a - angs[i - 1]) / (angs[i] - angs[i - 1]); w = [[ids[i - 1], 1 - k], [ids[i], k]]; }
        const out = []; for (const [ch, wa] of w) for (const [b, wb] of chainW(ch, t)) out.push([b, wa * wb]);
        if (t < 0.1) { const s = 1 - t / 0.1; for (const o of out) o[1] *= 1 - s * 0.7; out.push([B.pelvis, s * 0.7]); }
        return out;
      },
    });
  }

  // ---------------------------------------------------------------- hair: undercut — shaved sides (dark stubble cap), swept-back spiky top on
  // springs, two loose strands over the brow; headband with a glowing cyber plate + two long spring tails
  const hk = hr / 0.118, capR = hr + 0.008;
  const capPt = (dx, dy, dz, grow = 1) => { const p = headPoint(dx, dy, dz, capR); return [(p[0] * 1.05 - 0.008) * grow, (p[1] * 1.05 + 0.01) * grow, p[2] * 1.07 * grow]; };
  {
    const cap = headGeo(capR, 20, 14); cap.scale(1.05, 1.05, 1.07); cap.translate(-0.008, 0.01, 0);
    acc.add(cap, hm, { part: 'hair', colorFn: (l) => (l.y > 0.05 * hk ? pal.hair : pal.stubble), shine: 0.3, weights: W1(B.head), line: 1,
      keep: (c) => !(c.x > 0.02 * hk && c.y < 0.06 * hk) && !(c.y < -0.05 * hk && c.x > -0.08 * hk) && c.y > -0.11 * hk });
    // the long top (undercut): a raised, swept-back mass sitting on the shaved sides with a crisp lower edge
    const mass = headGeo(capR, 20, 14); mass.scale(1.1, 1.2, 1.0); mass.translate(-0.02, 0.0, 0);
    acc.add(mass, hm, { part: 'hair', color: pal.hair, shine: 1, weights: W1(B.head), line: 1, keep: (c) => c.y > 0.05 * hk + Math.max(0, -c.x) * 0.25 && c.x > -0.12 * hk });
    const spikes = [];
    // swept-back top: rows of broad spikes from the front hairline up and back over the crown
    const top = [[0.75, 0.62, 0], [0.72, 0.66, 0.35], [0.72, 0.66, -0.35], [0.35, 0.92, 0.18], [0.35, 0.92, -0.2], [0.0, 1, 0.05], [-0.35, 0.92, 0.22], [-0.35, 0.92, -0.2], [-0.7, 0.68, 0.06], [-0.6, 0.62, 0.4], [-0.6, 0.62, -0.4]];
    for (const [x, y, z] of top) { const l = Math.hypot(x, y, z); spikes.push({ at: [(x / l * 0.1 - 0.012) * hk, (y / l * 0.1 + 0.04) * hk, (z / l * 0.085) * hk], dir: [-1 + x * 0.2, 0.42 + y * 0.22, z * 0.45], L: 0.13 + 0.04 * (x > 0.5 ? 1 : 0), w: 0.05, d: 0.03, s: 0.3 }); }
    // two loose strands falling over the brow (they bounce on every punch)
    for (const s of [0.35, -0.05]) spikes.push({ at: [0.085 * hk, 0.075 * hk, s * 0.1 * hk], dir: [0.7, -1, s * 0.6 + 0.25], L: 0.1, w: 0.016, d: 0.01, s: 0.22 });
    for (const sp of spikes) {
      const d = new THREE.Vector3(...sp.dir).normalize(), root = new THREE.Vector3(...sp.at).add(new THREE.Vector3(...HB)), tip = root.clone().addScaledVector(d, sp.L);
      const ids = chain('hair', B.head, [root.toArray(), tip.toArray()], { stiff: [0, sp.s], drag: 0.86, grav: 2, collide: false, sh: true });
      acc.add(spike(sp.L, sp.w, sp.d, 4), bind[ids[0]], { part: 'hair', color: pal.hair, shine: 1, weights: W1(ids[0]), line: 0.85 });
    }
  }
  // headband: a band over the cap just above the brows (polar angle band), cyber plate on the forehead, knot at the back + 2 tails
  {
    const th0 = 1.15, th1 = 1.32, a0 = 0.0, tilt = (ph) => 0.1 * (1 - Math.cos(ph));   // over the brow ridge, dipping toward the nape
    const pt = (u, v) => { const ph = a0 + u * TAU, thv = th0 + (th1 - th0) * v + tilt(ph), s = Math.sin(thv); return capPt(s * Math.cos(ph), Math.cos(thv), s * Math.sin(ph), 1.035); };
    const hb = shell((u, v) => pt(u * 0.9999, v), (u, v) => { const p = pt(u * 0.9999, v); const l = Math.hypot(p[0] + 0.008, p[1] - 0.01, p[2]) || 1; return [(p[0] + 0.008) / l, (p[1] - 0.01) / l, p[2] / l]; }, 24, 1, 0.016);
    const plate = (l) => { const a = Math.atan2(l.z, l.x); return Math.abs(a) < 0.55; };
    acc.add(hb, hm, { part: 'headband', colorFn: (l) => (plate(l) ? pal.metal : pal.band), glowFn: (l) => (plate(l) && Math.abs(Math.atan2(l.z, l.x)) < 0.3 ? 0.85 : 0), shine: 0.3, weights: W1(B.head), line: 0.9 });
    // glowing slit on the plate (a thin bar, stands proud)
    const pp = capPt(Math.sin(1.235), Math.cos(1.235), 0, 1.075); const bar = rb(new THREE.BoxGeometry(0.012, 0.012, 0.07, 1, 1, 2), 0.3, 0.008, 0.008, 0.04);
    bar.rotateZ(-0.35); acc.add(bar, hm.clone().multiply(T(...pp)), { part: 'headband', color: pal.trim, glow: 0.95, weights: W1(B.head), line: 0.5 });
    // knot + two long tails from the back of the head (3-bone spring chains, flat ribbons)
    const kp = capPt(-Math.sin(1.47), Math.cos(1.47), 0, 1.06);
    const knot = rb(new THREE.BoxGeometry(0.04, 0.04, 0.05, 1, 1, 1), 0.6, 0.024, 0.024, 0.03);
    acc.add(knot, hm.clone().multiply(T(kp[0] - 0.01, kp[1], kp[2])), { part: 'headband', color: pal.band, weights: W1(B.head) });
    for (let i = 0; i < 2; i++) {
      const L = 0.44 - i * 0.09, zs = i ? -0.03 : 0.03, n = 3, root = new THREE.Vector3(kp[0] - 0.02, kp[1] - 0.005, kp[2] + zs).add(new THREE.Vector3(...HB));
      // hanging curve: leaves the knot back-and-down, bends toward vertical (the springs swing it on every step and punch)
      const at = (v) => new THREE.Vector3(root.x - L * (0.62 * v - 0.18 * v * v), root.y - L * (0.5 * v + 0.38 * v * v), root.z + zs * 3.5 * v);
      const pts = []; for (let k = 0; k <= n; k++) pts.push(at(k / n).toArray());
      const ids = chain('band' + i, B.head, pts, { stiff: [0, 0.08, 0.04, 0.025], drag: 0.9, grav: 5, collide: false, tail: true, sh: true });
      const vOf = (q) => { let best = 0, bd = 1e9; for (let k = 0; k <= 24; k++) { const d = at(k / 24).distanceToSquared(q); if (d < bd) { bd = d; best = k / 24; } } return best; };
      const tg = shell((u, v) => { const p = at(v), w = 0.046 * (1 - 0.3 * v); return [p.x + (u - 0.5) * w * 0.3, p.y + (u - 0.5) * w * 0.9, p.z + 0.002]; }, () => [0, 0, 1], 1, 8, 0.008);
      acc.add(tg, M4(), { part: 'headband', colorFn: (l) => (vOf(l) > 0.86 ? pal.trim : pal.band), glowFn: (l) => (vOf(l) > 0.86 ? 0.6 : 0), weights: (v) => chainW(ids, vOf(v)), line: 0.8 });
    }
  }
  return { dispose() {} };
}
