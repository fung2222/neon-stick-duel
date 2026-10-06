// 魔導士 MAGE — anime body (phase 2): a female netrunner / techno-sorceress, built on the same skeleton and skin accumulator as
// the Swordsman (js/anime/builder.js calls buildMage(ctx) instead of the samurai body). Procedural only, no external assets.
//   silhouette: chin-length asymmetric bob with a long near-side lock, small bun + two crossed glowing hair-sticks (kanzashi)
//   with a dangling charm · rolled hood (cowl) down around the neck · ASYMMETRIC short cape over the far shoulder on springs ·
//   sleeveless high-neck bodysuit with a glowing seam · bare upper arms with glowing CIRCUIT TATTOOS (skinned decal) · arm wraps
//   with gold cuffs · open hands with finger bones (mudra forms: palm / sword fingers 劍指 / fist) · short asymmetric skirt on
//   springs · tights + thigh-high heeled boots · floating HOLO-GLYPH FOCUS (rings + rune ticks + crystal core) that hovers ahead
//   of the casting palm · ground sigil (magic circle) for the big casts.
// Proportions: same 6.5+ heads, legs = 50 % of the height (the skeleton is shared); narrower shoulders (half-width 0.19 vs 0.232),
// waist 0.104, hips 0.17.
import * as THREE from 'three';
import { tube, shell, spike, smooth, loft } from './geo.js';

const TAU = Math.PI * 2;
/** finger rig: 2 groups per hand (1 = index + middle, 2 = ring + pinky), 2 segments each; hand-local (+Y fingers, +X palm) */
export const FINGER = { ky: 0.082, seg: 0.034 };
/** arm surface radius by height (shared by the arm tube and the tattoo decal so the decal sits just proud of the skin) */
const ARM = [[1.605, 0], [1.594, 0.042], [1.572, 0.06], [1.535, 0.066], [1.48, 0.062, 0.003], [1.4, 0.056, 0.006], [1.31, 0.051, 0.005], [1.22, 0.045], [1.15, 0.042],
  [1.1, 0.045], [1.07, 0.048], [1.056, 0.0495], [1.0, 0.048], [0.94, 0.043], [0.89, 0.0385], [0.876, 0.038], [0.862, 0.0372], [0.848, 0.036], [0.83, 0.0345], [0.81, 0.032], [0.79, 0.027], [0.782, 0]];
/** v2.5: arms ×1.13 wider seen from the front (z) and ×1.05 deeper (x) — they read thin at 412×915 (shared by the tattoo decal) */
const ARM_KX = 0.95 * 1.05, ARM_KZ = 1.13;
const armAt = (y) => { for (let i = 1; i < ARM.length; i++) { const a = ARM[i - 1], b = ARM[i]; if (y <= a[0] && y >= b[0]) { const k = (a[0] - y) / (a[0] - b[0]); return [a[1] + (b[1] - a[1]) * k, (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * k]; } } return [0.04, 0]; };

/**
 * ctx: { acc, B, bind, chain, chainW, pal, H, hm, HB, hr, headGeo, M4, T, W1 } (from buildCharacter).
 * Returns { fingers: { F: [{ p, d, zc } × 2], B: [...] } (proximal / distal bone ids + knuckle z per group), decal: { geo, tex }, focus: Group, focusParts, sigil: Mesh, dispose() }.
 */
export function buildMage(ctx) {
  const { acc, B, bind, chain, chainW, pal, hm, HB, hr, headGeo, M4, T, W1, addBone, neckAO } = ctx;
  const DP = { P: [], UV: [], SI: [], SW: [], I: [] };   // extra decal patches (cape emblem, leg seams) merged into the tattoo decal mesh
  const dVert = (x, y, z, u, v, w) => { const ws = w.filter((q) => q[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), t = ws.reduce((a, q) => a + q[1], 0) || 1;
    DP.P.push(x, y, z); DP.UV.push(u, v); for (let k = 0; k < 4; k++) { DP.SI.push(ws[k] ? ws[k][0] : 0); DP.SW.push(ws[k] ? ws[k][1] / t : 0); } return DP.P.length / 3 - 1; };
  const dQuad = (a, b, c, d) => DP.I.push(a, c, b, b, c, d);
  const rb = (g, k, rx, ry, rz) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x / rx, y / ry, z / rz) || 1; p.setXYZ(i, x * (1 - k) + x / r * k, y * (1 - k) + y / r * k, z * (1 - k) + z / r * k); } g.computeVertexNormals(); return g; };

  // ---------------------------------------------------------------- torso: one loft (bodysuit), narrower shoulders, bust, waist, wide hips
  const R0 = (y, f, b, w, n = 2.2, x = 0) => ({ y, f, b, w, n, x });
  const torso = [R0(0.85, 0, 0, 0), R0(0.866, 0.058, 0.072, 0.1), R0(0.9, 0.09, 0.116, 0.156, 2.3), R0(0.96, 0.094, 0.12, 0.172, 2.4), R0(1.03, 0.086, 0.1, 0.15, 2.3),
    R0(1.1, 0.076, 0.079, 0.117), R0(1.165, 0.073, 0.072, 0.104), R0(1.24, 0.086, 0.076, 0.116, 2.2, 0.004), R0(1.31, 0.11, 0.084, 0.136, 2.3, 0.008),
    R0(1.37, 0.128, 0.088, 0.15, 2.4, 0.012), R0(1.42, 0.116, 0.092, 0.162, 2.6, 0.012), R0(1.47, 0.102, 0.094, 0.178, 2.8, 0.01), R0(1.51, 0.094, 0.09, 0.19, 3.0, 0.008),
    R0(1.545, 0.078, 0.08, 0.168, 2.8, 0.006), R0(1.575, 0.06, 0.062, 0.118, 2.4, 0.004), R0(1.598, 0.045, 0.048, 0.068, 2, 0.004), R0(1.61, 0, 0, 0)];
  const seam = (l) => l.x > 0.04 && Math.abs(l.z) < 0.0075 && l.y > 1.12 && l.y < 1.58;
  // v2.5: light silver-lavender side panels (waist → under the bust) — the side is what the camera sees in a fight
  const panel = (l) => { if (l.y < 1.085 || l.y > 1.39) return false; const a = Math.abs(Math.atan2(l.z, l.x - 0.004)); return a > 1.2 && a < 1.95; };
  acc.add(loft(torso, 18), M4(), {
    part: 'torso', colorFn: (l) => (l.y < 1.075 && l.y > 1.055 ? pal.gold : seam(l) ? pal.trim : panel(l) ? pal.panel : pal.suit), glowFn: (l) => (seam(l) ? 0.6 : 0),
    weights: (v) => { const k = smooth(1.04, 1.2, v.y); const w = [[B.chest, k], [B.pelvis, 1 - k]];
      if (v.y > 1.4 && Math.abs(v.z) > 0.11) { const s = smooth(0.11, 0.19, Math.abs(v.z)) * smooth(1.4, 1.5, v.y) * 0.5; w[0][1] *= 1 - s; w.push([v.z > 0 ? B.uaF : B.uaB, s]); } return w; },
  });
  // high neck of the bodysuit + glowing choker line, then skin
  acc.add(tube([{ y: 1.54, rx: 0 }, { y: 1.555, rx: 0.04, rz: 0.044, x: 0.004 }, { y: 1.6, rx: 0.039, rz: 0.042, x: 0.006 }, { y: 1.628, rx: 0.038, rz: 0.041, x: 0.007 }, { y: 1.64, rx: 0.037, rz: 0.04, x: 0.008 },
    { y: 1.7, rx: 0.034, rz: 0.036, x: 0.008 }, { y: 1.72, rx: 0 }], 10), M4(), {
    part: 'neck', colorFn: (l) => (l.y < 1.625 ? pal.suit : l.y < 1.641 ? pal.trim : pal.skin), glowFn: (l) => (l.y >= 1.625 && l.y < 1.641 ? 0.7 : 0), aoFn: (l) => (l.y > 1.641 ? neckAO(l) : 0),
    weights: (v) => { const a = smooth(1.55, 1.6, v.y), b = smooth(1.66, 1.71, v.y); return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, b]]; } });
  acc.add(headGeo(hr * 0.97, 22, 18, 1), hm, { part: 'head', color: pal.skin, weights: W1(B.head) });
  // belt: gold chain line on the hips + glowing data-crystal buckle
  const bk = rb(new THREE.BoxGeometry(0.03, 0.05, 0.05, 1, 2, 2), 0.5, 0.018, 0.028, 0.028); bk.rotateX(Math.PI / 4);
  acc.add(bk, T(0.095, 1.065, 0.02), { part: 'belt', color: pal.trim, glow: 0.8, weights: W1(B.pelvis) });

  // ---------------------------------------------------------------- arms: bare skin (circuit-tattoo decal on top) → wraps → gold cuff → hand
  for (const side of ['F', 'B']) {
    const z = side === 'F' ? 0.165 : -0.165, ua = B['ua' + side], fa = B['fa' + side];
    const rings = ARM.map(([y, r, x = 0]) => ({ y, rx: r * ARM_KX, rz: r * ARM_KZ, z: z * (y > 1.45 ? 1 + (y - 1.45) * 0.35 : 1), x }));
    acc.add(tube(rings, 10), M4(), {
      part: 'arms', colorFn: (l) => (l.y > 1.53 ? pal.suit : l.y > 1.06 ? pal.skin : l.y > 0.876 ? pal.wrap : l.y > 0.848 ? pal.gold : pal.skin),
      glowFn: (l) => (l.y <= 0.876 && l.y > 0.848 ? 0.45 : 0),
      weights: (v) => { const k = smooth(1.09, 1.2, v.y); const w = [[ua, k], [fa, 1 - k]]; if (v.y > 1.5) { const s = smooth(1.5, 1.6, v.y) * 0.4; w[0][1] *= 1 - s; w.push([B.chest, s]); } if (v.y < 0.83) { const s = smooth(0.83, 0.8, v.y) * 0.5; w[1][1] *= 1 - s; w.push([B['hand' + side], s]); } return w; },
    });
  }
  // ---------------------------------------------------------------- hands: palm + thumb on the hand bone, fingers on 2 × 2 bones (mudra)
  const fingers = { F: [], B: [] };
  for (const side of ['F', 'B']) {
    const hb = B['hand' + side], Mh = bind[hb], th = side === 'F' ? -1 : 1;   // thumb toward local −Z (right hand) / +Z (left hand)
    const palm = rb(new THREE.BoxGeometry(0.034, 0.088, 0.07, 2, 3, 2), 0.45, 0.019, 0.05, 0.04); palm.translate(0.002, 0.044, 0);
    acc.add(palm, Mh, { part: 'hands', colorFn: (l) => (l.y < 0.012 ? pal.gold : pal.skin), weights: W1(hb) });
    const thumb = tube([{ y: -0.004, rx: 0 }, { y: 0.0, rx: 0.012, rz: 0.013 }, { y: 0.03, rx: 0.011, rz: 0.012 }, { y: 0.052, rx: 0.009, rz: 0.01 }, { y: 0.06, rx: 0 }], 5);
    thumb.rotateX(th * 0.95); thumb.rotateZ(-0.35); thumb.translate(0.006, 0.026, th * 0.028);
    acc.add(thumb, Mh, { part: 'hands', color: pal.skin, weights: W1(hb) });
    // finger groups: [z offsets, lengths]; group 1 = index + middle (next to the thumb), group 2 = ring + pinky
    const grp = [[[th * 0.022, 0.07], [th * 0.006, 0.076]], [[-th * 0.01, 0.07], [-th * 0.025, 0.056]]];
    for (let g = 0; g < 2; g++) {
      const zc = (grp[g][0][0] + grp[g][1][0]) / 2;
      const p = addBone('fing' + side + g + 'p', Mh.clone().multiply(T(0, FINGER.ky, zc)));
      const d = addBone('fing' + side + g + 'd', Mh.clone().multiply(T(0, FINGER.ky + FINGER.seg, zc)));
      fingers[side].push({ p, d, zc });
      for (const [fz, L] of grp[g]) {
        const fg = tube([{ y: -0.008, rx: 0 }, { y: -0.004, rx: 0.0098, rz: 0.0094 }, { y: L * 0.45, rx: 0.0094, rz: 0.009 }, { y: L * 0.85, rx: 0.0082, rz: 0.008 }, { y: L, rx: 0.006, rz: 0.006 }, { y: L + 0.004, rx: 0 }], 5);
        fg.translate(0.001, FINGER.ky, fz);
        acc.add(fg, Mh, { part: 'hands', colorFn: (l) => (l.y > FINGER.ky + L * 0.86 ? pal.nail : pal.skin), glowFn: (l) => (l.y > FINGER.ky + L * 0.86 ? 0.6 : 0),
          weights: (v, l) => { const k = smooth(FINGER.ky + FINGER.seg - 0.01, FINGER.ky + FINGER.seg + 0.008, l.y); return [[p, 1 - k], [d, k]]; } });
      }
    }
  }
  // ---------------------------------------------------------------- legs: slim, long; tights above thigh-high boots with a glowing cuff
  for (const side of ['F', 'B']) {
    const z = side === 'F' ? 0.09 : -0.09, th = B['th' + side], sh = B['shin' + side];
    const rings = [[1.0, 0], [0.99, 0.056], [0.95, 0.084], [0.88, 0.085, 0.004], [0.78, 0.079, 0.006], [0.69, 0.072, 0.004], [0.632, 0.066], [0.626, 0.07], [0.61, 0.071], [0.6, 0.069],
      [0.585, 0.065], [0.5, 0.055], [0.455, 0.051], [0.42, 0.052], [0.35, 0.057, -0.006], [0.27, 0.056, -0.006], [0.19, 0.049], [0.11, 0.042], [0.04, 0.039], [-0.012, 0.038], [-0.03, 0]]
      .map(([y, r, x = 0]) => ({ y, rx: r * 1.05, rz: r * 0.96, z, x }));
    const legW = (v) => { const k = smooth(0.42, 0.51, v.y); const w = [[th, k], [sh, 1 - k]]; if (v.y > 0.93) { const s = smooth(0.93, 1.0, v.y) * 0.45; w[0][1] *= 1 - s; w.push([B.pelvis, s]); } return w; };
    acc.add(tube(rings, 10), M4(), {
      part: 'legs', colorFn: (l) => (l.y > 0.628 ? pal.tights : l.y > 0.596 ? pal.trim : pal.boots), glowFn: (l) => (l.y <= 0.628 && l.y > 0.596 ? 0.6 : 0), weights: legW,
    });
    // v2.5: glowing seam lines down both sides of each leg (hip → ankle, over the boot), as decal strips skinned like the leg — so the
    // legs read against the night city without relying on the outline. Slightly forward of the pure side so they face the camera.
    for (const sg of [1, -1]) {
      const a = sg * (Math.PI / 2 - 0.32), hw = 0.0065, rows = rings.filter((q) => q.rx > 0 && q.y < 0.97 && q.y > -0.005);
      let prev = null;
      rows.forEach((q, i) => {
        const r = Math.hypot(Math.cos(a) * q.rx, Math.sin(a) * q.rz) * 1.02, da = hw / r, v = { y: q.y }, w = legW(v), vv = i / (rows.length - 1);
        const ids = [-1, 1].map((e) => { const aa = a + e * da; return dVert(q.x + Math.cos(aa) * q.rx * 1.02, q.y, q.z + Math.sin(aa) * q.rz * 1.02, sg > 0 ? (e < 0 ? 0.81 : 0.94) : (e < 0 ? 0.94 : 0.81), 1 - vv, w); });
        if (prev) dQuad(prev[0], prev[1], ids[0], ids[1]);
        prev = ids;
      });
    }
    // heeled boot foot (foot-local: +Y toward the toe, +X down): slim, glowing sole edge. v2.5: softer almond toe (was a sharp point)
    // and a rounded, tapered heel (was a box) so the feet stop reading as spikes in 3/4
    const bf = tube([{ y: -0.058, rx: 0, x: 0.034 }, { y: -0.05, rx: 0.027, rz: 0.031, x: 0.04 }, { y: -0.028, rx: 0.036, rz: 0.04, x: 0.036 }, { y: 0.02, rx: 0.04, rz: 0.043, x: 0.033 },
      { y: 0.08, rx: 0.035, rz: 0.044, x: 0.04 }, { y: 0.14, rx: 0.029, rz: 0.042, x: 0.046 }, { y: 0.178, rx: 0.024, rz: 0.036, x: 0.05 }, { y: 0.198, rx: 0.018, rz: 0.027, x: 0.052 }, { y: 0.209, rx: 0, x: 0.053 }], 8);
    acc.add(bf, bind[B['foot' + side]], { part: 'boots', colorFn: (l) => (l.x > 0.066 ? pal.trim : pal.boots), glowFn: (l) => (l.x > 0.066 ? 0.5 : 0), weights: W1(B['foot' + side]) });
    const heel = tube([{ y: 0.056, rx: 0 }, { y: 0.058, rx: 0.017, rz: 0.02 }, { y: 0.076, rx: 0.013, rz: 0.016 }, { y: 0.09, rx: 0.012, rz: 0.014 }, { y: 0.094, rx: 0 }], 6);
    heel.rotateZ(-Math.PI / 2); heel.translate(0, -0.038, 0);   // +Y → +X (down), under the heel
    acc.add(heel, bind[B['foot' + side]], { part: 'boots', colorFn: (l) => (l.x > 0.086 ? pal.trim : pal.boots), glowFn: (l) => (l.x > 0.086 ? 0.4 : 0), weights: W1(B['foot' + side]) });
  }

  // ---------------------------------------------------------------- cowl: the hood worn down, rolled around the back of the neck
  {
    const a0 = Math.PI / 2 + 0.25, a1 = Math.PI * 1.5 - 0.25;
    const cg = shell((u, v) => { const a = a0 + (a1 - a0) * u, bulge = Math.sin(Math.PI * v), r = 0.085 + 0.05 * bulge + 0.03 * v; return [Math.cos(a) * r * 1.05 - 0.01, 1.55 + 0.11 * v - 0.025 * bulge, Math.sin(a) * (r + 0.02)]; },
      (u) => { const a = a0 + (a1 - a0) * u; return [Math.cos(a), 0.2, Math.sin(a)]; }, 12, 4, 0.016);
    acc.add(cg, M4(), { part: 'cowl', colorFn: (l) => (l.y > 1.652 ? pal.trim : pal.cape), glowFn: (l) => (l.y > 1.652 ? 0.5 : 0), weights: (v) => { const k = smooth(1.58, 1.68, v.y) * 0.4; return [[B.chest, 1 - k], [B.neck, k]]; } });
  }
  // ---------------------------------------------------------------- asymmetric short cape: back + far shoulder, longer on the far side; springs
  {
    const a0 = Math.PI * 0.68, a1 = Math.PI * 1.86, y0 = 1.565, nCh = 5, n = 3;
    const Lc = (a) => 0.34 + 0.24 * smooth(a0, a1, a);   // hem: short at the back-near edge → long over the far shoulder
    const rad = (a, v) => { const fl = 0.06 * v; return [(0.1 + fl) * Math.cos(a) - 0.012, (0.2 + fl * 0.6) * Math.sin(a)]; };
    const yAt = (a, v) => y0 - Lc(a) * v + 0.035 * Math.sin(Math.PI * Math.min(1, v * 2.2)) * 0.5;
    const angs = Array.from({ length: nCh }, (_, i) => a0 + 0.12 + (a1 - a0 - 0.24) * (i / (nCh - 1)));
    const ids = [];
    for (const a of angs) {
      const pts = []; for (let k = 0; k <= n; k++) { const v = k / n, [x, z] = rad(a, v); pts.push([x, yAt(a, v), z]); }
      ids.push(chain('cape', B.chest, pts, { stiff: [0, 0.26, 0.14, 0.08], drag: 0.92, grav: 6, collide: false, ang: a, sh: true }));
    }
    const vmap = (v) => (v < 0.75 ? v * 0.92 / 0.75 : 0.92 + (v - 0.75) * 0.32);   // the last row is thin: crisp glowing hem
    const surf = (u, v) => { const a = a0 + u * (a1 - a0), vv = vmap(v), [x, z] = rad(a, vv); return [x, yAt(a, vv), z]; };
    const nrm = (u) => { const a = a0 + u * (a1 - a0); return [Math.cos(a), 0.35, Math.sin(a)]; };
    const cg = shell(surf, nrm, 14, 5, 0.012);
    const angOf = (q) => { let a = Math.atan2(q.z / 2, q.x + 0.012); if (a < 0) a += TAU; return Math.min(a1, Math.max(a0, a)); };
    const vOf = (q) => Math.max(0, Math.min(1, (y0 - q.y) / Lc(angOf(q))));
    const capeW = (q) => {
      const a = angOf(q), t = vOf(q); let i = angs.findIndex((x) => x > a); let w;
      if (i < 0) w = [[ids[nCh - 1], 1]]; else if (i === 0) w = [[ids[0], 1]]; else { const k = (a - angs[i - 1]) / (angs[i] - angs[i - 1]); w = [[ids[i - 1], 1 - k], [ids[i], k]]; }
      const out = []; for (const [ch, wa] of w) for (const [b, wb] of chainW(ch, t)) out.push([b, wa * wb]);
      if (t < 0.12) { const s = 1 - t / 0.12; for (const o of out) o[1] *= 1 - s * 0.8; out.push([B.chest, s * 0.8]); }
      return out;
    };
    acc.add(cg, M4(), {
      part: 'cape', colorFn: (l) => { const v = vOf(l); if (v > 0.93) return pal.gold; if (Math.abs(v - 0.8) < 0.022) return pal.trim; const a = angOf(l), [x, z] = rad(a, v); return Math.hypot(l.x + 0.012, l.z / 2) >= Math.hypot(x + 0.012, z / 2) - 0.0005 ? pal.cape : pal.lining; },
      glowFn: (l) => { const v = vOf(l); return v > 0.93 ? 0.35 : Math.abs(v - 0.8) < 0.022 ? 0.7 : 0; },
      weights: capeW,
    });
    // v2.5: glowing netrunner emblem on the back of the cape (ring + eye-glyph + circuit traces to the hem), a decal patch on the cape's
    // outer surface with the cape's own spring weights — the back view used to be a plain dark block
    {
      const ac = Math.PI + 0.1, da = 0.5, v0 = 0.1, v1 = 0.74, nu = 6, nv = 6, grid = [];
      for (let j = 0; j <= nv; j++) { const row = []; for (let i = 0; i <= nu; i++) {
        const a = ac - da + 2 * da * (i / nu), vv = v0 + (v1 - v0) * (j / nv), [x, z] = rad(a, vv), y = yAt(a, vv), nl = Math.hypot(Math.cos(a), 0.35, Math.sin(a)), o = 0.011 / nl;
        const px = x + Math.cos(a) * o, py = y + 0.35 * o, pz = z + Math.sin(a) * o;
        row.push(dVert(px, py, pz, 0.5 + 0.25 * (i / nu), 1 - j / nv, capeW({ x: px, y: py, z: pz })));
      } grid.push(row); }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) dQuad(grid[j][i], grid[j][i + 1], grid[j + 1][i], grid[j + 1][i + 1]);
    }
  }
  // ---------------------------------------------------------------- short asymmetric skirt on springs (front slit), collides with the legs
  {
    const gap = 0.3, nCh = 8, y0 = 1.075, n = 2;
    const Ls = (a) => 0.22 + 0.11 * (0.5 - 0.5 * Math.cos(a)) + 0.05 * Math.max(0, -Math.sin(a));   // longer at the back and the far side
    const rad = (a, v) => { const fl = 0.12 * v; return [(0.1 + fl) * Math.cos(a), (0.165 + fl * 1.1) * Math.sin(a)]; };
    const angs = Array.from({ length: nCh }, (_, i) => gap + 0.16 + (TAU - 2 * gap - 0.32) * (i / (nCh - 1)));
    const ids = [];
    for (const a of angs) {
      const pts = []; for (let k = 0; k <= n; k++) { const v = k / n, [x, z] = rad(a, v); pts.push([x, y0 - Ls(a) * v, z]); }
      ids.push(chain('skirt', B.pelvis, pts, { stiff: [0, 0.2, 0.11], drag: 0.92, grav: 6, collide: true, ang: a }));
    }
    const vmap = (v) => (v < 0.75 ? v * 0.92 / 0.75 : 0.92 + (v - 0.75) * 0.32);
    const surf = (u, v) => { const a = gap + u * (TAU - 2 * gap), vv = vmap(v), [x, z] = rad(a, vv); return [x, y0 - Ls(a) * vv, z]; };
    const nrm = (u) => { const a = gap + u * (TAU - 2 * gap); return [Math.cos(a), 0.2, Math.sin(a)]; };
    const sg = shell(surf, nrm, 22, 4, 0.011);
    const angOf = (q) => { let a = Math.atan2(q.z / 1.1, q.x); if (a < 0) a += TAU; return a; };
    const vOf = (q) => Math.max(0, Math.min(1, (y0 - q.y) / Ls(angOf(q))));
    acc.add(sg, M4(), {
      part: 'skirt', colorFn: (l) => { const v = vOf(l); return v > 0.93 ? pal.trim : Math.abs(v - 0.84) < 0.03 ? pal.gold : pal.skirt; }, glowFn: (l) => (vOf(l) > 0.93 ? 0.6 : 0),
      weights: (q) => {
        const a = angOf(q), t = vOf(q); let i = angs.findIndex((x) => x > a); let w;
        if (i <= 0) w = [[ids[i === 0 ? 0 : nCh - 1], 1]]; else { const k = (a - angs[i - 1]) / (angs[i] - angs[i - 1]); w = [[ids[i - 1], 1 - k], [ids[i], k]]; }
        const out = []; for (const [ch, wa] of w) for (const [b, wb] of chainW(ch, t)) out.push([b, wa * wb]);
        if (t < 0.1) { const s = 1 - t / 0.1; for (const o of out) o[1] *= 1 - s * 0.7; out.push([B.pelvis, s * 0.7]); }
        return out;
      },
    });
  }

  // ---------------------------------------------------------------- hair: bob cap down to the jaw, jagged spring hem, asymmetric bangs,
  // long near-side lock (3 bones) with a glowing ring, short far lock, small bun + crossed glowing hair-sticks + a dangling charm
  const hk = hr / 0.118;
  {
    const capR = hr + 0.01;
    const cap = headGeo(capR, 18, 14); cap.scale(1.08, 1.06, 1.1); cap.translate(-0.01, 0.012, 0);
    const p = cap.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0.02) { const k = 1 + Math.min(0.2, (0.02 - y) * 1.6); p.setX(i, p.getX(i) * (p.getX(i) < 0 ? k : 1)); p.setZ(i, p.getZ(i) * k); } }
    cap.computeVertexNormals();
    acc.add(cap, hm, { part: 'hair', color: pal.hair, shine: 0.7, weights: W1(B.head), line: 1,
      keep: (c) => !(c.x > 0.012 * hk && c.y < 0.06 * hk) && c.y > -0.15 * hk && !(c.x > -0.03 * hk && c.y < -0.03 * hk) });
    const spikes = [];
    // bangs: blunt-ish fringe swept toward the far side (asymmetric), uneven lengths
    const BL = [0.1, 0.13, 0.115, 0.14, 0.12, 0.09];
    for (let i = 0; i < 6; i++) { const u = i / 5 - 0.5, z = u * 0.2; spikes.push({ at: [0.078 * hk, 0.1 * hk, z * hk], dir: [0.55, -1, u * 0.7 - 0.28], L: BL[i], w: 0.042, d: 0.018, s: 0.34 }); }
    // bob hem: jagged locks around the back + sides at jaw level (springs → they swing on turns)
    for (let i = 0; i < 9; i++) { const a = Math.PI * 0.42 + (Math.PI * 1.16) * (i / 8); const x = Math.cos(a), z = Math.sin(a);
      spikes.push({ at: [(x * 0.1 - 0.01) * hk, -0.06 * hk, z * 0.118 * hk], dir: [x * 0.35, -1, z * 0.42], L: 0.075 + (i % 2) * 0.025, w: 0.04, d: 0.03, s: 0.26 }); }
    // crown / back volume
    for (const [x, y, z] of [[-1, 0.35, 0.05], [-1, 0.35, -0.05], [-0.7, 0.8, 0.06], [-0.7, 0.8, -0.06], [0, 1, 0]]) { const l = Math.hypot(x, y, z);
      spikes.push({ at: [(x / l * 0.095 - 0.01) * hk, (y / l * 0.095 + 0.025) * hk, (z / l * 0.095 + z * 0.5) * hk], dir: [x, y * 0.6 - 0.4, z * 2], L: 0.1, w: 0.036, d: 0.036, s: 0.3 }); }
    spikes.push({ at: [0.04 * hk, 0.03 * hk, -0.118 * hk], dir: [0.18, -1, -0.12], L: 0.15, w: 0.026, d: 0.016, s: 0.3 });   // short far-side lock
    for (const sp of spikes) {
      const d = new THREE.Vector3(...sp.dir).normalize(), root = new THREE.Vector3(...sp.at).add(new THREE.Vector3(...HB)), tip = root.clone().addScaledVector(d, sp.L);
      const ids = chain('hair', B.head, [root.toArray(), tip.toArray()], { stiff: [0, sp.s], drag: 0.86, grav: 2.5, collide: false, sh: true });
      acc.add(spike(sp.L, sp.w, sp.d, 4), bind[ids[0]], { part: 'hair', color: pal.hair, shine: 1, weights: W1(ids[0]), line: 0.85 });
    }
    // long near-side lock: 3-bone chain down past the collarbone, glowing ring near the end
    {
      // v2.5: rooted further back (behind the cheek, in front of the ear) so it frames the face instead of covering the near cheek
      const P0 = new THREE.Vector3(0.016 * hk, 0.035 * hk, 0.124 * hk).add(new THREE.Vector3(...HB)), n = 3, L = 0.32, dir = new THREE.Vector3(0.02, -1, 0.22).normalize();
      const pts = []; for (let k = 0; k <= n; k++) pts.push(P0.clone().addScaledVector(dir, L * k / n).toArray());
      const ids = chain('lock', B.head, pts, { stiff: [0, 0.18, 0.1, 0.06], drag: 0.9, grav: 4, collide: false, tail: true, sh: true });
      const tm = new THREE.Matrix4().compose(P0, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1));
      const rings = [{ y: -0.01, rx: 0 }, { y: 0, rx: 0.016, rz: 0.028 }];
      for (let k = 1; k <= 8; k++) { const u = k / 8; rings.push({ y: L * u, rx: 0.016 * (1 - u * 0.5), rz: 0.03 * (1 - u * 0.6) * (1 + 0.15 * Math.sin(u * 6)) }); }
      rings.splice(8, 0, { y: L * 0.8, rx: 0.016, rz: 0.019 }, { y: L * 0.815, rx: 0.019, rz: 0.022 }, { y: L * 0.86, rx: 0.019, rz: 0.022 }, { y: L * 0.875, rx: 0.014, rz: 0.017 });
      rings.sort((a, b) => a.y - b.y); rings.push({ y: L + 0.02, rx: 0 });
      const ring = (l) => l.y > L * 0.81 && l.y < L * 0.87;
      acc.add(tube(rings, 6), tm, { part: 'hair', colorFn: (l) => (ring(l) ? pal.trim : pal.hair), glowFn: (l) => (ring(l) ? 0.75 : 0), weights: (v, l) => chainW(ids, Math.max(0, l.y) / L), line: 0.85, shine: 1 });
    }
    // bun + crossed hair-sticks (kanzashi) with glowing tips + dangling charm (2-bone chain)
    const bunC = new THREE.Vector3(-0.112 * hk, 0.075 * hk, -0.01).add(new THREE.Vector3(...HB));
    const bun = rb(new THREE.SphereGeometry(0.05, 10, 8), 0, 1, 1, 1); bun.scale(0.9, 0.85, 1);
    acc.add(bun, hm.clone().multiply(T(bunC.x - HB[0], bunC.y - HB[1], bunC.z)), { part: 'hair', color: pal.hair, shine: 1, weights: W1(B.head) });
    for (const s of [-1, 1]) {
      const st = tube([{ y: -0.11, rx: 0 }, { y: -0.105, rx: 0.007, rz: 0.007 }, { y: 0.085, rx: 0.006, rz: 0.006 }, { y: 0.088, rx: 0.012, rz: 0.012 }, { y: 0.112, rx: 0.012, rz: 0.012 }, { y: 0.118, rx: 0 }], 5);
      st.rotateX(s * 0.55); st.rotateZ(-0.5 + s * 0.15);
      acc.add(st, hm.clone().multiply(T(bunC.x - HB[0] - 0.01, bunC.y - HB[1], bunC.z)), { part: 'hair', colorFn: (l) => (l.y > 0.086 ? pal.trim : pal.gold), glowFn: (l) => (l.y > 0.086 ? 0.8 : 0), weights: W1(B.head), line: 0.6 });
    }
    {
      const c0 = bunC.clone().add(new THREE.Vector3(-0.04, -0.03, 0.05)), pts = [c0.toArray(), c0.clone().add(new THREE.Vector3(-0.01, -0.07, 0.005)).toArray(), c0.clone().add(new THREE.Vector3(-0.015, -0.13, 0.01)).toArray()];
      const ids = chain('charm', B.head, pts, { stiff: [0, 0.12, 0.06], drag: 0.9, grav: 6, collide: false, sh: true });
      const cord = tube([{ y: 0, rx: 0.003, rz: 0.003 }, { y: 0.066, rx: 0.003, rz: 0.003 }], 4);
      acc.add(cord, bind[ids[0]], { part: 'hair', color: pal.gold, weights: W1(ids[0]), line: 0.4 });
      const gem = new THREE.OctahedronGeometry(0.018, 0); gem.scale(0.8, 1.4, 0.8); gem.translate(0, 0.03, 0);
      acc.add(gem, bind[ids[1]], { part: 'hair', color: pal.trim, glow: 0.85, weights: W1(ids[1]), line: 0.5 });
    }
    // headset: ear cuff on the near ear with a glowing ring + a short mic arm
    const ear = new THREE.CylinderGeometry(0.026, 0.028, 0.018, 10, 1); ear.rotateX(Math.PI / 2);
    acc.add(ear, hm.clone().multiply(T(-0.012, 0.0, 0.122 * hk)), { part: 'hair', colorFn: (l) => (l.z > 0.006 && Math.hypot(l.x, l.y) > 0.017 ? pal.trim : pal.metalDark), glowFn: (l) => (l.z > 0.006 && Math.hypot(l.x, l.y) > 0.017 ? 0.8 : 0), weights: W1(B.head), line: 0.7 });
    const mic = tube([{ y: 0, rx: 0.004, rz: 0.004 }, { y: 0.07, rx: 0.004, rz: 0.004 }, { y: 0.075, rx: 0.008, rz: 0.008 }, { y: 0.085, rx: 0 }], 4); mic.rotateZ(-2.0); mic.translate(-0.005, -0.01, 0.13 * hk);
    acc.add(mic, hm, { part: 'hair', colorFn: (l) => (l.x > 0.055 ? pal.trim : pal.metalDark), glowFn: (l) => (l.x > 0.055 ? 0.7 : 0), weights: W1(B.head), line: 0.5 });
  }

  // ---------------------------------------------------------------- circuit tattoos: one skinned decal mesh (both upper arms), canvas atlas
  const decal = tattooDecal(B, pal, DP);
  // ---------------------------------------------------------------- floating holo-glyph focus (+ crystal core) and the ground sigil
  const focus = makeFocus(pal), sigil = makeSigil(pal), sign = makeSign(pal);
  return {
    fingers, decal, focus, sigil, sign,
    dispose() { decal.geo.dispose(); decal.tex.dispose(); decal.mat.dispose(); focus.userData.dispose(); for (const m of [sigil, sign]) { m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); } },
  };
}

/** tattoo decal: half-cylinder patches just proud of the upper-arm skin (outer + front side), skinned like the arm */
function tattooDecal(B, pal, DP) {
  const P = [...DP.P], UV = [...DP.UV], SI = [...DP.SI], SW = [...DP.SW], I = [...DP.I];   // cape emblem + leg seams first, then both arm panels
  const y0 = 1.13, y1 = 1.48, nu = 7, nv = 6;
  for (const [si, side] of [[0, 'F'], [1, 'B']]) {
    const z = side === 'F' ? 0.165 : -0.165, ua = B['ua' + side], fa = B['fa' + side], base = P.length / 3;
    const a0 = side === 'F' ? -0.2 : 0.55, a1 = side === 'F' ? 2.6 : 3.35;   // angle around the arm (0 = front, π/2 = camera side)
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const y = y1 - (y1 - y0) * (j / nv), a = a0 + (a1 - a0) * (i / nu), [r, x] = armAt(y), zz = z * (y > 1.45 ? 1 + (y - 1.45) * 0.35 : 1);
      P.push(x + Math.cos(a) * r * ARM_KX * 1.04, y, zz + Math.sin(a) * r * ARM_KZ * 1.04); UV.push(si * 0.25 + 0.25 * (i / nu), 1 - j / nv);
      const k = smooth(1.09, 1.2, y); SI.push(ua, fa, 0, 0); SW.push(k, 1 - k, 0, 0);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4)); g.setIndex(I); g.computeVertexNormals();
  const tex = circuitTex(pal);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.35, 1.35, 1.35), transparent: true, alphaTest: 0.25, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });   // patches mix windings; the limb/cape occludes the far side
  return { geo: g, tex, mat };
}
/** procedural circuit traces (two arm panels side by side): vertical traces with 45° jogs, pads, a ring band */
function circuitTex(pal) {
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const c = '#' + new THREE.Color(pal.trim).lerp(new THREE.Color(1, 1, 1), 0.25).getHexString();
  g.strokeStyle = c; g.fillStyle = c; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let s = 0; s < 2; s++) {
    const ox = s * 128;
    const trace = (pts, w = 3.2) => { g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(ox + x, y) : g.moveTo(ox + x, y))); g.stroke(); const [ex, ey] = pts[pts.length - 1]; g.beginPath(); g.arc(ox + ex, ey, 5, 0, TAU); g.fill(); };
    // traces run down the arm (v = along the arm), jogging at 45°, ending in pads; one band wraps around
    trace([[64, 4], [64, 70], [84, 90], [84, 160], [70, 174], [70, 214]]);
    trace([[44, 30], [44, 96], [30, 110], [30, 170]], 2.6);
    trace([[96, 40], [96, 120], [110, 134], [110, 196]], 2.6);
    g.lineWidth = 2.4; g.beginPath(); g.moveTo(ox + 14, 58); g.lineTo(ox + 114, 58); g.stroke();
    g.beginPath(); g.arc(ox + 64, 58, 7, 0, TAU); g.lineWidth = 2.4; g.stroke();
    for (const [x, y] of [[44, 30], [96, 40], [64, 4]]) { g.beginPath(); g.arc(ox + x, y, 3.5, 0, TAU); g.fill(); }
  }
  // cape emblem (u 0.5–0.75): thick lines so it survives the mip levels at phone scale — ring, inner ring with 6 ticks, an eye-glyph
  // (almond + diamond pupil), three circuit traces dropping to the hem with pads
  { const cx = 256 + 64, cy = 100; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, 52, 0, TAU); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 38, 0, TAU); g.stroke();
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + Math.PI / 6; g.beginPath(); g.moveTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38); g.lineTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 28, cy); g.quadraticCurveTo(cx, cy - 22, cx + 28, cy); g.quadraticCurveTo(cx, cy + 22, cx - 28, cy); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx + 9, cy); g.lineTo(cx, cy + 12); g.lineTo(cx - 9, cy); g.closePath(); g.fill();
    g.lineWidth = 5;
    for (const [x0, x1] of [[-30, -44], [0, 0], [30, 44]]) { g.beginPath(); g.moveTo(cx + x0 * 1.2, cy + 50 - Math.abs(x0) * 0.45); g.lineTo(cx + x0 * 1.2, cy + 82); g.lineTo(cx + x1, cy + 100); g.lineTo(cx + x1, cy + 138); g.stroke(); g.beginPath(); g.arc(cx + x1, cy + 142, 6, 0, TAU); g.fill(); }
  }
  // leg seam (u 0.75–1, the strips use u 0.81–0.94): solid glowing line, white-hot core, fully opaque so it holds at every mip level
  { const gr = g.createLinearGradient(415, 0, 481, 0); gr.addColorStop(0, c); gr.addColorStop(0.42, '#ffffff'); gr.addColorStop(0.58, '#ffffff'); gr.addColorStop(1, c);
    g.fillStyle = gr; g.fillRect(384 + 24, 0, 96, H); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
/** holo-glyph focus: outer ring, inner ring, 6 rune ticks, 3 diamonds (additive, no outline) + a toon crystal core with an outline
 *  (built by the caller). v2.5: 1.2× larger, a white-hot core (hex disc + 4-point star, vertex colours > 1 so it blooms) behind the
 *  crystal, and the renderer tilts the ring toward the camera so it reads as a circle instead of an edge-on line at phone scale. */
export const HOLO_K = 1.2;
function makeFocus(pal) {
  const grp = new THREE.Group();
  const c = new THREE.Color(pal.trim).lerp(new THREE.Color(1, 1, 1), 0.2);
  const geos = [], mats = [];
  const holoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  mats.push(holoMat);
  // one merged holo geometry: rings lie in the local XZ plane (normal = local +Y = the cast direction)
  const parts = [], K = HOLO_K, ring = c.clone().multiplyScalar(1.3), hot = c.clone().lerp(new THREE.Color(1, 1, 1), 0.65).multiplyScalar(1.9), mid = c.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(1.5);
  const add = (g, col) => { g.userData.col = col; parts.push(g); };
  const o = new THREE.TorusGeometry(0.12 * K, 0.0065 * K, 3, 30); o.rotateX(Math.PI / 2); add(o, ring);
  const i2 = new THREE.TorusGeometry(0.078 * K, 0.0042 * K, 3, 24); i2.rotateX(Math.PI / 2); add(i2, ring);
  for (let k = 0; k < 6; k++) { const t = new THREE.BoxGeometry(0.03 * K, 0.003, 0.009 * K); t.translate(0.098 * K, 0, 0); t.rotateY(k * TAU / 6); add(t, ring); }
  for (let k = 0; k < 3; k++) { const t = new THREE.BoxGeometry(0.014 * K, 0.003, 0.014 * K); t.rotateY(Math.PI / 4); t.translate(0.142 * K, 0, 0); t.rotateY(k * TAU / 3 + 0.5); add(t, mid); }
  const disc = new THREE.CircleGeometry(0.034 * K, 6); disc.rotateX(-Math.PI / 2); add(disc, hot);
  for (const a of [0, Math.PI / 2]) { const st = new THREE.BufferGeometry(); const L = 0.075 * K, w = 0.007 * K;   // 4-point star: two thin crossed diamonds
    st.setAttribute('position', new THREE.Float32BufferAttribute([-L, 0, 0, 0, 0, w, L, 0, 0, 0, 0, -w], 3)); st.setIndex([0, 1, 2, 0, 2, 3]); st.rotateY(a); add(st, hot); }
  const holo = new THREE.Mesh(mergeGeos(parts), holoMat); holo.frustumCulled = false; holo.renderOrder = 3; geos.push(holo.geometry);
  grp.add(holo);
  grp.userData = { holo, geos, mats, dispose() { for (const q of geos) q.dispose(); for (const m of mats) m.dispose(); } };
  return grp;
}
/** hand-sign after-image (v2.5): a canvas hologram of the casting mudra (open palm | sword fingers) that flashes at the casting hand on
 *  every release and expands / fades in ~0.3 s, so the hand form reads at phone scale. One additive quad in world space. */
function makeSign(pal) {
  const S = 128, cv = document.createElement('canvas'); cv.width = S * 2; cv.height = S; const g = cv.getContext('2d');
  const col = '#' + new THREE.Color(pal.trim).lerp(new THREE.Color(1, 1, 1), 0.35).getHexString();
  const hand = (ox, sword) => {   // fingers up (+v), palm centre at (64, 84), thumb on the left
    g.save(); g.translate(ox, 0); g.lineJoin = 'round'; g.lineCap = 'round';
    const path = () => { g.beginPath(); g.ellipse(64, 86, 22, 26, 0, 0, TAU);
      const fing = sword ? [[-9, 54], [7, 58]] : [[-15, 44], [-4, 52], [8, 50], [19, 40]];
      for (const [x, L] of fing) { g.moveTo(64 + x, 70); g.lineTo(64 + x * 1.08, 70 - L); }
      if (sword) for (const x of [10, 19]) { g.moveTo(64 + x, 72); g.lineTo(64 + x - 2, 62); }   // ring + pinky curled
      g.moveTo(46, 92); g.lineTo(28, 70); };   // thumb
    g.shadowColor = col; g.shadowBlur = 14; g.strokeStyle = col; g.lineWidth = 11; path(); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = '#ffffff'; g.lineWidth = 4; path(); g.stroke();
    g.fillStyle = col; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(64, 86, 22, 26, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.restore();
  };
  hand(0, false); hand(S, true);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(0.5, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  m.frustumCulled = false; m.renderOrder = 4; m.visible = false;
  return m;
}
function mergeGeos(list) {
  const P = [], C = [], I = []; let n = 0;
  for (const g of list) { const gi = g.index ? g : null, p = g.attributes.position, c = g.userData.col; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); if (c) C.push(c.r, c.g, c.b); } const idx = gi ? g.index.array : [...Array(p.count).keys()]; for (const q of idx) I.push(q + n); n += p.count; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); if (C.length) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); out.setIndex(I); return out;
}
/** ground sigil (magic circle): flat disc with a procedural rune texture, additive */
function makeSigil(pal) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), c = S / 2;
  const col = '#' + new THREE.Color(pal.trim).lerp(new THREE.Color(1, 1, 1), 0.3).getHexString();
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3;
  for (const r of [122, 112, 70]) { g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); }
  g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k * TAU * 3 / 7 - Math.PI / 2; const x = c + Math.cos(a) * 110, y = c + Math.sin(a) * 110; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke();   // heptagram
  for (let k = 0; k < 24; k++) { const a = k * TAU / 24; g.save(); g.translate(c + Math.cos(a) * 117, c + Math.sin(a) * 117); g.rotate(a); g.fillRect(-1.5, -4, 3, k % 3 ? 4 : 8); g.restore(); }   // rune ticks
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.26; g.beginPath(); g.arc(c + Math.cos(a) * 91, c + Math.sin(a) * 91, 8, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(c + Math.cos(a) * 85, c + Math.sin(a) * 85); g.lineTo(c + Math.cos(a) * 97, c + Math.sin(a) * 97); g.stroke(); }
  g.beginPath(); g.arc(c, c, 18, 0, TAU); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.2, 1.2, 1.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.frustumCulled = false; m.renderOrder = 1; m.visible = false;
  return m;
}
