// Anime character builder: class config (palette, hair, outfit, weapon, face) → one skinned toon body + outline hull,
// a face decal (expression atlas), a katana (+ outline) and spring chains (coat panels, sash tails, ponytail, hair spikes).
// Everything is procedural (no external assets). The skeleton mirrors the HQ rig (js/rig/core.js): the renderer drives
// the body bones from solve() joints every frame and the chain bones from a small verlet sim.
//
// Draw calls per fighter: body + body outline + face + katana + katana outline = 5 (plus the shared shadow / trail).
import * as THREE from 'three';
import { SkinAcc, tube, shell, spike, smooth, loft } from './geo.js';
import { toonUniforms, toonMat, outlineUniforms, outlineMat, hookOutline, faceAtlas } from './toon.js';

export const BODY = ['pelvis', 'chest', 'neck', 'head', 'uaF', 'faF', 'handF', 'uaB', 'faB', 'handB', 'thF', 'shinF', 'footF', 'thB', 'shinB', 'footB'];
const B = Object.fromEntries(BODY.map((n, i) => [n, i]));
// bind skeleton (rig units, facing +x, z toward the camera) — straight vertical layout; joints match core.js SK lengths
export const BIND = {
  pelvis: [0, 1.0, 0], lumbar: [0, 1.2, 0], neckB: [0, 1.56, 0], neckT: [0, 1.66, 0], head: [0, 1.81, 0],
  shF: [0, 1.5, 0.165], elF: [0, 1.14, 0.165], hdF: [0, 0.8, 0.165], shB: [0, 1.5, -0.165], elB: [0, 1.14, -0.165], hdB: [0, 0.8, -0.165],
  hipF: [0, 0.93, 0.095], knF: [0, 0.46, 0.095], anF: [0, 0, 0.095], hipB: [0, 0.93, -0.095], knB: [0, 0.46, -0.095], anB: [0, 0, -0.095],
};
const BIND_SEG = {
  pelvis: ['pelvis', 'lumbar'], chest: ['lumbar', 'neckB'], neck: ['neckB', 'neckT'], head: ['head', [0, 1.96, 0]],
  uaF: ['shF', 'elF'], faF: ['elF', 'hdF'], handF: ['hdF', [0, 0.46, 0.165]], uaB: ['shB', 'elB'], faB: ['elB', 'hdB'], handB: ['hdB', [0, 0.46, -0.165]],
  thF: ['hipF', 'knF'], shinF: ['knF', 'anF'], footF: ['anF', [1, 0, 0.095]], thB: ['hipB', 'knB'], shinB: ['knB', 'anB'], footB: ['anB', [1, 0, -0.095]],
};
const ZW = new THREE.Vector3(0, 0, 1), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _R = new THREE.Matrix4();
/** bone frame: origin a, +Y along a→b, X = Y × Zworld (same convention as the HQ renderer's orient()), optional twist about Y */
export function frameMat(a, b, twist, out) {
  _Y.set(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)); const L = _Y.length() || 1e-6; _Y.multiplyScalar(1 / L);
  _X.crossVectors(_Y, ZW); if (_X.lengthSq() < 1e-8) _X.set(1, 0, 0); _X.normalize(); _Z.crossVectors(_X, _Y).normalize();
  out.makeBasis(_X, _Y, _Z); if (twist) out.multiply(_R.makeRotationY(twist)); out.setPosition(a[0], a[1], a[2] || 0); return out;
}
/** body version: 'v2' (v2.3.1 anime proportions: lofted torso with shoulder line / chest / waist / hips, muscle-tapered limbs,
 *  shaped boots + hands, high collar) or 'v1' (the first pilot body, kept for the proportions comparison: `?abody=v1`). */
export const BODY_VER = (() => { try { const q = new URLSearchParams(globalThis.location?.search || '').get('abody'); return q === 'v1' ? 'v1' : 'v2'; } catch (e) { return 'v2'; } })();
/** head: radius + centre (a touch lower / forward of the rig's head joint so the chin sits on a short anime neck) */
const HR = 0.13, HB = [BIND.head[0] + 0.006, BIND.head[1] - 0.026, 0];
const J0 = (k) => (Array.isArray(k) ? k : BIND[k]);
const W1 = (b) => () => [[b, 1]];
const M4 = () => new THREE.Matrix4();
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

/** anime head shape: unit direction → surface point (head-local: +X face, +Y up, +Z camera side). Pointed chin, narrow jaw. */
export function headPoint(dx, dy, dz, r = 0.118, out = [0, 0, 0]) {
  const lo = dy < 0 ? -dy : 0;
  out[0] = r * dx * (dx > 0 ? 1.0 : 1.08) + (dy < 0 ? 0.034 * lo * Math.max(0, dx + 0.35) : 0) - 0.008;
  out[1] = r * dy * (dy < 0 ? 1.3 : 1.04) + 0.012;
  out[2] = r * dz * (1 - 0.4 * lo * lo) * 0.93;
  return out;
}
function headGeo(r, segU = 22, segV = 16) {   // seam-free deformed sphere
  const rings = []; const P = [], I = [];
  P.push(...headPoint(0, -1, 0, r));
  for (let k = 1; k < segV; k++) { const th = Math.PI - (k / segV) * Math.PI; for (let j = 0; j < segU; j++) { const ph = (j / segU) * Math.PI * 2; P.push(...headPoint(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), r)); } }
  P.push(...headPoint(0, 1, 0, r));
  const rv = (k, j) => 1 + (k - 1) * segU + (j % segU);
  for (let k = 1; k < segV - 1; k++) for (let j = 0; j < segU; j++) { const a = rv(k, j), b = rv(k, j + 1), c = rv(k + 1, j), d = rv(k + 1, j + 1); I.push(a, c, b, b, c, d); }
  for (let j = 0; j < segU; j++) I.push(0, rv(1, j), rv(1, j + 1));
  const top = P.length / 3 - 1; for (let j = 0; j < segU; j++) I.push(top, rv(segV - 1, j + 1), rv(segV - 1, j));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
}
/** face decal patch following headPoint (slightly proud of the skin); uv: u 0 = camera side, v 1 = brow line */
const FACE_TH = [1.08, 2.44], FACE_PH = 1.22;
function faceGeo(r) {
  const nu = 14, nv = 12, P = [], UV = [], I = [];
  for (let k = 0; k <= nv; k++) for (let j = 0; j <= nu; j++) {
    const th = FACE_TH[0] + (FACE_TH[1] - FACE_TH[0]) * (k / nv), ph = FACE_PH - 2 * FACE_PH * (j / nu);
    P.push(...headPoint(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), r * 1.012)); UV.push(j / nu, 1 - k / nv);
  }
  for (let k = 0; k < nv; k++) for (let j = 0; j < nu; j++) { const a = k * (nu + 1) + j, b = a + 1, c = a + nu + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); return g;
}

/** katana geometry (local +Y = blade direction, origin at the weapon hand; +X = cutting edge) with vertex colours + glow */
function katanaGeo(pal, L = 1.18) {
  const acc = new SkinAcc(), W = () => [[0, 1]];
  // tsuka (two-hand grip) with diamond wrap bands, kashira cap
  acc.add(tube([{ y: -0.19, rx: 0 }, { y: -0.185, rx: 0.02, rz: 0.017 }, { y: -0.17, rx: 0.026, rz: 0.021 }, { y: 0.0, rx: 0.024, rz: 0.019 }, { y: 0.045, rx: 0.025, rz: 0.02 }, { y: 0.05, rx: 0 }], 8), M4(),
    { colorFn: (l) => (l.y < -0.165 ? pal.gold : (Math.floor((l.y + 0.2) / 0.028) % 2 ? pal.tsukaWrap : pal.tsuka)), weights: W });
  // tsuba (square-ish cyber guard with a glowing ring)
  const ts = new THREE.CylinderGeometry(0.052, 0.052, 0.012, 8, 1); ts.rotateY(Math.PI / 8);
  acc.add(ts, T(0, 0.058, 0), { colorFn: (l) => (Math.hypot(l.x, l.z) > 0.044 ? pal.trim : pal.tsuka), glowFn: (l) => (Math.hypot(l.x, l.z) > 0.044 ? 0.7 : 0), weights: W });
  acc.add(tube([{ y: 0.064, rx: 0 }, { y: 0.065, rx: 0.022, rz: 0.012 }, { y: 0.09, rx: 0.02, rz: 0.011 }, { y: 0.091, rx: 0 }], 6), M4(), { color: pal.gold, weights: W });
  // blade: curved (sori toward the spine), lens cross-section, cutting edge (+X) glows
  const n = 18, R = 6, P = [], I = [], C = [];
  const sori = 0.04, y0 = 0.09, w = 0.034, sp = 0.0075;
  const prof = [[w * 0.55, 0], [w * 0.25, sp], [-w * 0.45, sp * 0.9], [-w * 0.5, 0], [-w * 0.45, -sp * 0.9], [w * 0.25, -sp]];   // edge at +X
  for (let k = 0; k <= n; k++) {
    const u = k / n, y = y0 + (L - y0) * u, cx = -sori * u * u, taper = k === n ? 0.02 : 1 - 0.25 * u;
    for (let j = 0; j < R; j++) { const [px, pz] = prof[j]; P.push(cx + px * taper + (k === n ? -w * 0.2 : 0), y, pz * taper); }
  }
  for (let k = 0; k < n; k++) for (let j = 0; j < R; j++) { const a = k * R + j, b = k * R + (j + 1) % R, c = a + R, d = b + R; I.push(a, b, c, b, d, c); }
  const tip = P.length / 3; P.push(-sori * 1.02 - w * 0.1, L + 0.035, 0); for (let j = 0; j < R; j++) I.push(n * R + j, n * R + (j + 1) % R, tip);
  const base = P.length / 3; P.push(0, y0 - 0.002, 0); for (let j = 0; j < R; j++) I.push(base, (j + 1) % R, j);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setIndex(I); bg.computeVertexNormals();
  acc.add(bg, M4(), { colorFn: (l) => { const u = (l.y - y0) / (L - y0), cx = -sori * u * u; return l.x - cx > w * 0.38 ? pal.trim : pal.metal; }, glowFn: (l) => { const u = (l.y - y0) / (L - y0), cx = -sori * u * u; return l.x - cx > w * 0.38 ? 0.9 : 0.04; }, weights: W, line: 0.7, shine: 0.8 });
  const g = acc.build(); g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight'); return g;
}

/**
 * build a character. Returns { body, outline, face, faceTex, weapon, weaponOutline, bones, bind (Matrix4 per bone),
 * chains, U (toon uniforms), OU (outline uniforms), tris, dispose() }.
 */
export function buildCharacter(cfg) {
  const V2 = (cfg.body || BODY_VER) !== 'v1', hr = V2 ? 0.131 : HR;
  const pal = V2 ? { ...cfg.palette, ...(cfg.paletteV2 || {}) } : cfg.palette, O = cfg.outfit, H = cfg.hair;
  const bones = [], bind = [], names = [...BODY];
  for (const n of BODY) { const [a, b] = BIND_SEG[n]; bind.push(frameMat(J0(a), J0(b), 0, M4())); }
  const addBone = (name, m) => { names.push(name); bind.push(m); return names.length - 1; };
  const acc = new SkinAcc();
  const chains = [];
  /** register a spring chain: points (bind space) p[0..n], anchored to bone `anchor`. Returns its bone indices. */
  const chain = (name, anchor, pts, opt) => {
    const ids = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize());
      ids.push(addBone(name + i, new THREE.Matrix4().compose(new THREE.Vector3(...a), q, new THREE.Vector3(1, 1, 1))));
    }
    chains.push({ name, anchor, pts: pts.map((p) => new THREE.Vector3(...p)), bones: ids, ...opt });
    return ids;
  };
  const yBlend = (bTop, bBot, y0, y1) => (v) => { const k = smooth(y0, y1, v.y); return [[bTop, k], [bBot, 1 - k]]; };

  const hm = T(...HB);
  const roundBox = (g, k) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x, y, z) || 1; p.setXYZ(i, x * (1 - k) + x / r * 0.05 * k, y * (1 - k) + y / r * 0.055 * k, z * (1 - k) + z / r * 0.048 * k); } g.computeVertexNormals(); return g; };
  if (!V2) {
    // ---------------------------------------------------------------- torso (coat top over the inner kimono), elliptical rings
    const torsoRings = [[0.86, 0], [0.875, 0.07], [0.9, 0.118], [0.95, 0.136], [1.0, 0.132], [1.08, 0.118], [1.16, 0.114], [1.26, 0.13], [1.36, 0.15], [1.44, 0.166], [1.5, 0.17], [1.545, 0.14], [1.575, 0.085], [1.59, 0]]
      .map(([y, r]) => ({ y, rx: r * (y > 1.2 ? 0.66 : 0.7), rz: r, x: y > 1.25 ? 0.012 : 0 }));
    const vNeck = (l) => l.x > 0 && Math.abs(l.z) < 0.022 + Math.max(0, l.y - 1.22) * 0.32 && l.y > 1.22;
    acc.add(tube(torsoRings, 18), M4(), {
      colorFn: (l) => (l.y < 1.07 ? pal.pants : vNeck(l) ? pal.inner : (l.x > 0.02 && Math.abs(Math.abs(l.z) - (0.024 + Math.max(0, l.y - 1.22) * 0.32)) < 0.012 && l.y > 1.2 ? pal.trim : pal.coat)),
      glowFn: (l) => (l.x > 0.02 && l.y > 1.2 && Math.abs(Math.abs(l.z) - (0.024 + Math.max(0, l.y - 1.22) * 0.32)) < 0.012 ? 0.55 : 0),
      weights: (v) => { const k = smooth(1.04, 1.2, v.y); const w = [[B.chest, k], [B.pelvis, 1 - k]]; if (v.y > 1.42 && Math.abs(v.z) > 0.11) { const s = smooth(0.11, 0.17, Math.abs(v.z)) * 0.35; w[0][1] *= 1 - s; w.push([v.z > 0 ? B.uaF : B.uaB, s]); } return w; },
    });
    // standing collar (open at the front) + glowing top edge
    if (O.collar) {
      const cg = shell((u, v) => { const a = 0.55 + u * (Math.PI * 2 - 1.1); return [Math.cos(a) * (0.072 + v * 0.008), 1.6 - v * 0.085, Math.sin(a) * (0.08 + v * 0.01)]; },
        (u) => { const a = 0.55 + u * (Math.PI * 2 - 1.1); return [Math.cos(a), 0, Math.sin(a)]; }, 14, 2, 0.01);
      acc.add(cg, M4(), { colorFn: (l) => (l.y > 1.592 ? pal.trim : pal.coat), glowFn: (l) => (l.y > 1.592 ? 0.6 : 0), weights: (v) => [[B.chest, 0.75], [B.neck, 0.25]] });
    }
    // neck + head (head built in head-local space; bind head frame = translation)
    acc.add(tube([{ y: 1.5, rx: 0 }, { y: 1.52, rx: 0.036, rz: 0.04 }, { y: 1.62, rx: 0.033, rz: 0.036 }, { y: 1.72, rx: 0.03, rz: 0.032 }, { y: 1.74, rx: 0 }], 10), M4(),
      { color: pal.skin, weights: (v) => { const a = smooth(1.53, 1.6, v.y), b = smooth(1.66, 1.72, v.y); return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, b]]; } });
    acc.add(headGeo(hr), hm, { color: pal.skin, weights: W1(B.head), part: 'head' });
    // hands: weapon fist (local +Y = blade axis) and off-hand mitten (local +Y = along the forearm)
    const fist = new THREE.BoxGeometry(0.08, 0.098, 0.084, 2, 2, 2); fist.translate(0.012, -0.004, 0);
    const handF = bind[B.handF], handB = bind[B.handB];
    acc.add(roundBox(fist, 0.45), handF, { color: pal.glove, weights: W1(B.handF) });
    const thumbF = tube([{ y: -0.01, rx: 0 }, { y: 0, rx: 0.018, rz: 0.02 }, { y: 0.045, rx: 0.016, rz: 0.017 }, { y: 0.06, rx: 0 }], 6); thumbF.rotateZ(-0.5); thumbF.translate(0.02, 0.02, 0.04);
    acc.add(thumbF, handF, { color: pal.glove, weights: W1(B.handF) });
    const mit = roundBox(new THREE.BoxGeometry(0.075, 0.11, 0.05, 2, 2, 2), 0.5); mit.translate(0.005, 0.06, 0);
    acc.add(mit, handB, { color: pal.glove, weights: W1(B.handB) });
    const thumbB = tube([{ y: -0.01, rx: 0 }, { y: 0, rx: 0.016, rz: 0.017 }, { y: 0.05, rx: 0.014, rz: 0.015 }, { y: 0.065, rx: 0 }], 6); thumbB.rotateZ(0.7); thumbB.translate(-0.02, 0.03, 0.02);
    acc.add(thumbB, handB, { color: pal.glove, weights: W1(B.handB) });

    // ---------------------------------------------------------------- arms: one continuous tube per arm (shoulder → wrist), elbow blend
    for (const side of ['F', 'B']) {
      const z = side === 'F' ? 0.165 : -0.165, ua = B['ua' + side], fa = B['fa' + side];
      // extra rings at every colour edge (coat | bracer | glowing cuff | glove) so the bands stay crisp instead of smearing along the forearm
      const rings = [[1.585, 0], [1.575, 0.04], [1.55, 0.058], [1.5, 0.062], [1.42, 0.056], [1.3, 0.052], [1.2, 0.045], [1.14, 0.042], [1.08, 0.044], [1.056, 0.0445], [1.044, 0.0448], [1.0, 0.045], [0.92, 0.041], [0.882, 0.038], [0.868, 0.0372], [0.852, 0.0365], [0.838, 0.0368], [0.83, 0.038], [0.81, 0.034], [0.8, 0]]
        .map(([y, r]) => ({ y, rx: r * 0.95, rz: r, z }));
      const armor = side === 'F' && O.bracer;
      acc.add(tube(rings, 12), M4(), {
        colorFn: (l) => (l.y < 0.845 ? pal.glove : armor && l.y < 1.05 ? (l.y < 0.875 ? pal.trim : pal.armor) : pal.coat),
        glowFn: (l) => (armor && l.y < 0.875 && l.y > 0.845 ? 0.7 : 0),
        weights: (v) => { const k = smooth(1.09, 1.19, v.y); const w = [[ua, k], [fa, 1 - k]]; if (v.y > 1.5) { const s = smooth(1.5, 1.585, v.y) * 0.4; w[0][1] *= 1 - s; w.push([B.chest, s]); } if (v.y < 0.83) { const s = smooth(0.83, 0.8, v.y) * 0.5; w[1][1] *= 1 - s; w.push([B['hand' + side], s]); } return w; },
      });
    }
    // ---------------------------------------------------------------- legs: one tube per leg (hip → ankle), knee blend; boots below the knee
    for (const side of ['F', 'B']) {
      const z = side === 'F' ? 0.095 : -0.095, th = B['th' + side], sh = B['shin' + side];
      const rings = [[1.0, 0], [0.99, 0.05], [0.95, 0.078], [0.86, 0.074], [0.7, 0.066], [0.55, 0.054], [0.47, 0.05], [0.422, 0.0555], [0.408, 0.058], [0.392, 0.0615], [0.378, 0.0618], [0.3, 0.058], [0.16, 0.048], [0.06, 0.042], [0.0, 0.04], [-0.03, 0]]
        .map(([y, r]) => ({ y, rx: r, rz: r * 0.95, z }));
      acc.add(tube(rings, 12), M4(), {
        colorFn: (l) => (l.y > 0.415 ? pal.pants : l.y > 0.385 ? pal.trim : pal.boots), glowFn: (l) => (l.y <= 0.415 && l.y > 0.385 ? 0.65 : 0),
        weights: (v) => { const k = smooth(0.42, 0.51, v.y); const w = [[th, k], [sh, 1 - k]]; if (v.y > 0.93) { const s = smooth(0.93, 1.0, v.y) * 0.45; w[0][1] *= 1 - s; w.push([B.pelvis, s]); } return w; },
      });
      // knee guard plate
      const kg = new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); kg.scale(0.55, 1.1, 1); kg.rotateZ(-Math.PI / 2);
      acc.add(kg, T(0.035, 0.47, z), { color: pal.armor, weights: (v) => [[th, 0.5], [sh, 0.5]] });
      // boot foot (foot-local: +Y toward the toe, +X down)
      const bootFoot = roundBox(new THREE.BoxGeometry(0.075, 0.25, 0.09, 2, 3, 2), 0.35); bootFoot.translate(0.035, 0.07, 0);
      acc.add(bootFoot, bind[B['foot' + side]], { colorFn: (l) => (l.x > 0.066 ? pal.trim : pal.boots), glowFn: (l) => (l.x > 0.066 ? 0.5 : 0), weights: W1(B['foot' + side]) });
    }

  } else {
    // ---------------------------------------------------------------- v2 torso: one loft, coat over an inner kimono. Anime build: broad
    // shoulder line (half-width 0.22 vs hips 0.17), chest + pecs forward, tapered waist (0.12), hips with seat; trapezius slope to the neck
    const R0 = (y, f, b, w, n = 2.2, x = 0) => ({ y, f, b, w, n, x });
    const torso = [R0(0.85, 0, 0, 0), R0(0.866, 0.06, 0.07, 0.09), R0(0.9, 0.094, 0.11, 0.148, 2.3), R0(0.96, 0.1, 0.118, 0.168, 2.4), R0(1.03, 0.095, 0.102, 0.152, 2.3),
      R0(1.1, 0.087, 0.088, 0.128), R0(1.17, 0.085, 0.082, 0.12), R0(1.25, 0.098, 0.085, 0.136, 2.3, 0.004), R0(1.33, 0.118, 0.094, 0.158, 2.4, 0.008),
      R0(1.41, 0.138, 0.104, 0.188, 2.6, 0.012), R0(1.47, 0.132, 0.106, 0.214, 2.9, 0.012), R0(1.515, 0.116, 0.102, 0.232, 3.2, 0.01), R0(1.55, 0.094, 0.09, 0.212, 3.0, 0.006),
      R0(1.578, 0.07, 0.07, 0.15, 2.6, 0.004), R0(1.6, 0.052, 0.055, 0.085, 2, 0.004), R0(1.612, 0, 0, 0)];
    const lap = (l) => 0.026 + Math.max(0, l.y - 1.22) * 0.34;   // lapel line: V-neck opening widening toward the collar
    const vNeck = (l) => l.x > 0 && Math.abs(l.z) < lap(l) && l.y > 1.22, lapel = (l) => l.x > 0.02 && l.y > 1.2 && Math.abs(Math.abs(l.z) - lap(l)) < 0.013;
    acc.add(loft(torso, 20), M4(), {
      part: 'torso', colorFn: (l) => (l.y < 1.07 ? pal.pants : vNeck(l) ? pal.inner : lapel(l) ? pal.trim : pal.coat), glowFn: (l) => (lapel(l) ? 0.55 : 0),
      weights: (v) => { const k = smooth(1.04, 1.2, v.y); const w = [[B.chest, k], [B.pelvis, 1 - k]];
        if (v.y > 1.4 && Math.abs(v.z) > 0.12) { const s = smooth(0.12, 0.22, Math.abs(v.z)) * smooth(1.4, 1.5, v.y) * 0.5; w[0][1] *= 1 - s; w.push([v.z > 0 ? B.uaF : B.uaB, s]); } return w; },
    });
    // high standing collar (open at the front), glowing top edge — hides most of the short neck
    if (O.collar) {
      // rows: a thin first row (8 % of the height) holds the glowing edge, so the trim colour doesn't bleed down the collar
      const cv = (v) => (v < 0.34 ? v * 0.24 : 0.08 + (v - 1 / 3) * 1.38);
      const cg = shell((u, v) => { const a = 0.6 + u * (Math.PI * 2 - 1.2), w = cv(v); return [0.006 + Math.cos(a) * (0.074 + w * 0.014), 1.675 - w * 0.115, Math.sin(a) * (0.084 + w * 0.016)]; },
        (u) => { const a = 0.6 + u * (Math.PI * 2 - 1.2); return [Math.cos(a), 0, Math.sin(a)]; }, 14, 3, 0.012);
      acc.add(cg, M4(), { part: 'collar', colorFn: (l) => (l.y > 1.67 ? pal.trim : pal.coat), glowFn: (l) => (l.y > 1.67 ? 0.6 : 0), weights: (v) => { const k = smooth(1.58, 1.67, v.y) * 0.45; return [[B.chest, 1 - k], [B.neck, k]]; } });
    }
    // short neck (chin sits just above the collar line)
    acc.add(tube([{ y: 1.54, rx: 0 }, { y: 1.555, rx: 0.043, rz: 0.047, x: 0.004 }, { y: 1.63, rx: 0.04, rz: 0.043, x: 0.008 }, { y: 1.7, rx: 0.036, rz: 0.038, x: 0.008 }, { y: 1.72, rx: 0 }], 10), M4(),
      { part: 'neck', color: pal.skin, weights: (v) => { const a = smooth(1.55, 1.6, v.y), b = smooth(1.66, 1.71, v.y); return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, b]]; } });
    acc.add(headGeo(hr), hm, { part: 'head', color: pal.skin, weights: W1(B.head) });
    // hands: chunky stylised sword-grip fist (weapon hand, local +Y = blade axis) and an open guarding mitt (off hand), gloves
    const rb = (g, k, rx, ry, rz) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x / rx, y / ry, z / rz) || 1; p.setXYZ(i, x * (1 - k) + x / r * k, y * (1 - k) + y / r * k, z * (1 - k) + z / r * k); } g.computeVertexNormals(); return g; };
    const handF = bind[B.handF], handB = bind[B.handB];
    const fist = rb(new THREE.BoxGeometry(0.094, 0.11, 0.096, 3, 3, 3), 0.5, 0.054, 0.06, 0.054); fist.translate(0.012, -0.004, 0);
    acc.add(fist, handF, { part: 'hands', colorFn: (l) => (l.y < -0.04 ? pal.trim : pal.glove), glowFn: (l) => (l.y < -0.05 ? 0.5 : 0), weights: W1(B.handF) });
    const thumbF = tube([{ y: -0.01, rx: 0 }, { y: 0, rx: 0.021, rz: 0.023 }, { y: 0.05, rx: 0.018, rz: 0.019 }, { y: 0.066, rx: 0 }], 6); thumbF.rotateZ(-0.5); thumbF.translate(0.024, 0.022, 0.045);
    acc.add(thumbF, handF, { part: 'hands', color: pal.glove, weights: W1(B.handF) });
    const mit = rb(new THREE.BoxGeometry(0.086, 0.124, 0.058, 3, 3, 2), 0.5, 0.05, 0.066, 0.034); mit.translate(0.006, 0.066, 0);
    acc.add(mit, handB, { part: 'hands', color: pal.glove, weights: W1(B.handB) });
    const thumbB = tube([{ y: -0.01, rx: 0 }, { y: 0, rx: 0.019, rz: 0.02 }, { y: 0.055, rx: 0.016, rz: 0.017 }, { y: 0.07, rx: 0 }], 6); thumbB.rotateZ(0.7); thumbB.translate(-0.024, 0.034, 0.022);
    acc.add(thumbB, handB, { part: 'hands', color: pal.glove, weights: W1(B.handB) });
    // arms: one muscle-tapered tube per arm — deltoid cap blends into the shoulder line, biceps forward, slim elbow, forearm swell,
    // tapered wrist into the glove; colour edges (sleeve | bracer | glowing cuff | glove) get their own rings so the bands stay crisp
    for (const side of ['F', 'B']) {
      const z = side === 'F' ? 0.165 : -0.165, ua = B['ua' + side], fa = B['fa' + side];
      const rings = [[1.605, 0], [1.594, 0.046], [1.572, 0.066], [1.535, 0.075], [1.48, 0.072, 0.004], [1.4, 0.066, 0.008], [1.31, 0.06, 0.006], [1.22, 0.052], [1.15, 0.048],
        [1.1, 0.052], [1.056, 0.0565], [1.044, 0.057], [1.0, 0.055], [0.94, 0.049], [0.89, 0.044], [0.882, 0.0435], [0.868, 0.0425], [0.852, 0.041], [0.838, 0.0415], [0.82, 0.043], [0.8, 0.037], [0.788, 0]]
        .map(([y, r, x = 0]) => { const k = y > 0.86 ? 1.12 : 1.04; return { y, rx: r * 0.95 * k, rz: r * k, z: z * (y > 1.45 ? 1 + (y - 1.45) * 0.4 : 1), x }; });   // ×1.12 volume above the glove
      const armor = side === 'F' && O.bracer;
      acc.add(tube(rings, 12), M4(), {
        part: 'arms', colorFn: (l) => (l.y < 0.845 ? pal.glove : armor && l.y < 1.05 ? (l.y < 0.875 ? pal.trim : pal.armor) : l.y < 0.875 ? pal.trim : pal.coat),
        glowFn: (l) => (l.y < 0.875 && l.y > 0.845 ? 0.7 : 0),
        weights: (v) => { const k = smooth(1.09, 1.2, v.y); const w = [[ua, k], [fa, 1 - k]]; if (v.y > 1.5) { const s = smooth(1.5, 1.6, v.y) * 0.4; w[0][1] *= 1 - s; w.push([B.chest, s]); } if (v.y < 0.83) { const s = smooth(0.83, 0.8, v.y) * 0.5; w[1][1] *= 1 - s; w.push([B['hand' + side], s]); } return w; },
      });
    }
    // legs: long (hip joint → floor = half the height), full thigh tapering to a slim knee, calf swell toward the back, slim ankle;
    // knee-high boots with a flared glowing cuff — no separate knee caps, everything is one skinned surface
    for (const side of ['F', 'B']) {
      const z = side === 'F' ? 0.095 : -0.095, th = B['th' + side], sh = B['shin' + side];
      const rings = [[1.0, 0], [0.99, 0.06], [0.95, 0.09], [0.88, 0.091, 0.004], [0.78, 0.086, 0.006], [0.68, 0.078, 0.004], [0.58, 0.068], [0.5, 0.06], [0.46, 0.058], [0.43, 0.0585],
        [0.422, 0.06], [0.415, 0.068], [0.4, 0.07], [0.385, 0.069], [0.376, 0.066], [0.32, 0.067, -0.008], [0.24, 0.062, -0.006], [0.15, 0.053], [0.07, 0.049], [0.02, 0.048], [-0.02, 0.045], [-0.035, 0]]
        .map(([y, r, x = 0]) => { const k = y > 0.5 ? 1.08 : 1.06; return { y, rx: r * k, rz: r * 0.95 * k, z, x }; });
      acc.add(tube(rings, 12), M4(), {
        part: 'legs', colorFn: (l) => (l.y > 0.415 ? pal.pants : l.y > 0.385 ? pal.trim : pal.boots), glowFn: (l) => (l.y <= 0.415 && l.y > 0.385 ? 0.65 : 0),
        weights: (v) => { const k = smooth(0.42, 0.51, v.y); const w = [[th, k], [sh, 1 - k]]; if (v.y > 0.93) { const s = smooth(0.93, 1.0, v.y) * 0.45; w[0][1] *= 1 - s; w.push([B.pelvis, s]); } return w; },
      });
      // boot foot (foot-local: +Y toward the toe, +X down): rounded heel, instep, tapered toe, glowing sole
      const bf = tube([{ y: -0.062, rx: 0, x: 0.036 }, { y: -0.054, rx: 0.03, rz: 0.036, x: 0.042 }, { y: -0.032, rx: 0.041, rz: 0.046, x: 0.037 }, { y: 0.02, rx: 0.046, rz: 0.05, x: 0.032 },
        { y: 0.08, rx: 0.04, rz: 0.053, x: 0.038 }, { y: 0.14, rx: 0.031, rz: 0.05, x: 0.045 }, { y: 0.19, rx: 0.023, rz: 0.04, x: 0.051 }, { y: 0.216, rx: 0, x: 0.053 }], 10);
      acc.add(bf, bind[B['foot' + side]], { part: 'boots', colorFn: (l) => (l.x > 0.068 ? pal.trim : pal.boots), glowFn: (l) => (l.x > 0.068 ? 0.5 : 0), weights: W1(B['foot' + side]) });
    }
  }
  // ---------------------------------------------------------------- shoulder armour (layered sode plates on the weapon-side shoulder)
  if (O.pauldron) {
    const z = 0.165, ua = B.uaF;
    for (let i = 0; i < 3; i++) {
      const r = (V2 ? 0.096 : 0.088) - i * 0.004, cy = (V2 ? 1.54 : 1.53) - i * 0.045;
      const pg = shell((u, v) => { const ph = -1.25 + u * 2.5, th = 0.15 + v * 1.25; return [Math.sin(ph) * Math.sin(th) * r * 1.05, cy + Math.cos(th) * r * 0.75, z + 0.012 + Math.cos(ph) * Math.sin(th) * r]; },
        (u, v) => { const ph = -1.25 + u * 2.5, th = 0.15 + v * 1.25; return [Math.sin(ph) * Math.sin(th), Math.cos(th), Math.cos(ph) * Math.sin(th)]; }, 10, 4, 0.01);
      acc.add(pg, M4(), { colorFn: (l) => (l.y < cy - r * 0.18 && i === 2 ? pal.trim : pal.armor), glowFn: (l) => (l.y < cy - r * 0.18 && i === 2 ? 0.6 : 0), weights: (v) => [[ua, 0.65 + i * 0.1], [B.chest, 0.35 - i * 0.1]] });
    }
  }
  // ---------------------------------------------------------------- sash (obi) + knot; tails are chains
  if (O.sash) {
    const sg = shell((u, v) => { const a = u * Math.PI * 2 * 0.999; const r = 0.128 + 0.004; return V2 ? [Math.cos(a) * 0.106, 1.065 - v * 0.075, Math.sin(a) * 0.158] : [Math.cos(a) * r * 0.74, 1.06 - v * 0.07, Math.sin(a) * r * 1.02]; },
      (u) => { const a = u * Math.PI * 2; return [Math.cos(a), 0, Math.sin(a)]; }, 20, 1, 0.012);
    acc.add(sg, M4(), { colorFn: (l) => (Math.abs(l.y - 1.025) > 0.03 ? pal.sashEdge : pal.sash), weights: W1(B.pelvis) });
    const knot = roundBox(new THREE.BoxGeometry(0.05, 0.07, 0.07, 1, 1, 1), 0.6); knot.rotateZ(0.3);
    acc.add(knot, T(V2 ? -0.1 : -0.09, 1.02, V2 ? -0.08 : -0.07), { color: pal.sash, weights: W1(B.pelvis) });
    for (let i = 0; i < (O.sash.tails || 2); i++) {
      const L = 0.4 - i * 0.07, z0 = -0.07 + i * 0.03, n = 3, pts = [];
      for (let k = 0; k <= n; k++) pts.push([-0.1 - 0.06 * (k / n), 1.0 - L * (k / n), z0 - 0.02 * k]);
      const ids = chain('sash' + i, B.pelvis, pts, { stiff: [0, 0.16, 0.08, 0.04], drag: 0.9, grav: 7, collide: false });
      const tg = shell((u, v) => [pts[0][0] - 0.06 * v, 1.0 - L * v, z0 - 0.06 * v + (u - 0.5) * 0.055], () => [-1, 0, 0], 2, 6, 0.01);
      acc.add(tg, M4(), { colorFn: (l) => (1.0 - l.y > L * 0.94 ? pal.trim : pal.sash), glowFn: (l) => (1.0 - l.y > L * 0.94 ? 0.6 : 0), weights: (v) => chainW(ids, (1.0 - v.y) / L) });
    }
  }
  // ---------------------------------------------------------------- saya (sheath) on the off-side hip, bound to the pelvis
  let sheath = null;
  if (cfg.weapon.sheath) {
    const mouth = [0.11, 0.985, -0.08], dir = [-Math.cos(0.62), -Math.sin(0.62), -0.14], L = 0.96;
    const dl = Math.hypot(...dir); dir[0] /= dl; dir[1] /= dl; dir[2] /= dl;
    const sm = new THREE.Matrix4().compose(new THREE.Vector3(...mouth), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir)), new THREE.Vector3(1, 1, 1));
    const rings = [{ y: -0.004, rx: 0 }, { y: 0, rx: 0.03, rz: 0.019 }, { y: 0.035, rx: 0.03, rz: 0.019 }, { y: 0.05, rx: 0.027, rz: 0.017 }];
    for (let k = 1; k <= 8; k++) { const u = k / 8; rings.push({ y: 0.05 + (L - 0.08) * u, rx: 0.027 - 0.004 * u, rz: 0.017 - 0.002 * u, x: 0.035 * u * u }); }
    rings.push({ y: L - 0.01, rx: 0.025, rz: 0.016, x: 0.035 }, { y: L, rx: 0, x: 0.035 });
    acc.add(tube(rings, 8), sm, { colorFn: (l) => (l.y < 0.04 || l.y > L - 0.06 ? pal.gold : l.x < -0.022 + 0.035 * ((l.y - 0.05) / (L - 0.08)) ** 2 ? pal.trim : pal.saya), glowFn: (l) => (l.y >= 0.04 && l.y <= L - 0.06 && l.x < -0.022 + 0.035 * ((l.y - 0.05) / (L - 0.08)) ** 2 ? 0.5 : 0), weights: W1(B.pelvis) });
    // pelvis-local mouth + direction (for the sheath flourish)
    const inv = bind[B.pelvis].clone().invert();
    sheath = { mouth: new THREE.Vector3(...mouth).applyMatrix4(inv), dir: new THREE.Vector3(...dir).transformDirection(inv) };
  }
  // ---------------------------------------------------------------- long coat skirt: closed shell split into spring chains, open at the front
  if (O.coat) {
    const C = O.coat, gap = C.gap ?? 0.45, nCh = C.chains || 7, L = C.len || 0.8, y0 = 1.04, n = 3;
    const angs = Array.from({ length: nCh }, (_, i) => gap + 0.18 + (Math.PI * 2 - 2 * gap - 0.36) * (i / (nCh - 1)));
    const rad = (a, v) => { const r0x = V2 ? 0.112 : 0.105, r0z = V2 ? 0.166 : 0.15, fl = (C.flare ?? 0.14) * v; return [(r0x + fl) * Math.cos(a), (r0z + fl * 1.1) * Math.sin(a)]; };
    const ids = [];
    for (const a of angs) {
      const pts = []; for (let k = 0; k <= n; k++) { const v = k / n, [x, z] = rad(a, v); pts.push([x + (Math.cos(a) < 0 ? -0.03 * v : 0.01 * v), y0 - L * v, z]); }
      ids.push(chain('coat', B.pelvis, pts, { stiff: [0, 0.2, 0.11, 0.06], drag: 0.93, grav: 6, collide: true, ang: a }));
    }
    const surf = (u, v) => { const a = gap + u * (Math.PI * 2 - 2 * gap), [x, z] = rad(a, v); return [x + (Math.cos(a) < 0 ? -0.03 * v : 0.01 * v), y0 - L * v, z]; };
    const nrm = (u) => { const a = gap + u * (Math.PI * 2 - 2 * gap); return [Math.cos(a), 0.15, Math.sin(a)]; };
    const cg = shell(surf, nrm, V2 ? 26 : 30, 9, 0.012);
    const angOf = (v3) => { let a = Math.atan2(v3.z / 1.1, v3.x); if (a < 0) a += Math.PI * 2; return a; };
    acc.add(cg, M4(), {
      part: 'coat', colorFn: (l) => { const v = (y0 - l.y) / L, out = Math.hypot(l.x, l.z / 1.1) > Math.hypot(...rad(angOf(l), v).map((q, i) => q / (i ? 1.1 : 1))) - 0.0005; return v > 0.94 ? pal.trim : out ? pal.coat : pal.lining; },
      glowFn: (l) => ((y0 - l.y) / L > 0.94 ? 0.6 : 0),
      weights: (v) => {
        const a = angOf(v), t = (y0 - v.y) / L; let i = angs.findIndex((q) => q > a); let w;
        if (i <= 0) w = [[ids[i === 0 ? 0 : nCh - 1], 1]]; else { const k = (a - angs[i - 1]) / (angs[i] - angs[i - 1]); w = [[ids[i - 1], 1 - k], [ids[i], k]]; }
        const out = []; for (const [ch, wa] of w) for (const [b, wb] of chainW(ch, t)) out.push([b, wa * wb]);
        if (t < 0.08) { const s = 1 - t / 0.08; for (const q of out) q[1] *= 1 - s * 0.6; out.push([B.pelvis, s * 0.6]); }
        return out;
      },
    });
  }
  // ---------------------------------------------------------------- hair: skull cap + spikes (bangs, side locks, back) + ponytail, all on springs
  const HC = (l) => pal.hair;
  {
    const capR = hr + 0.01, hk = hr / 0.118;
    const cap = headGeo(capR, 20, 14); if (V2) cap.scale(1.06, 1.07, 1.08); else cap.scale(1.04, 1.05, 1.06); cap.translate(-0.008, 0.012, 0);
    acc.add(cap, hm, { part: 'hair', color: pal.hair, shine: 1, weights: W1(B.head), keep: (c) => !(c.x > 0.02 * hk && c.y < 0.055 * hk) && !(c.y < -0.06 * hk && c.x > -0.09 * hk) && c.y > -0.12 * hk, line: 1 });
    const spikes = [];
    // bangs over the forehead (pointing down-forward), side locks framing the face, back spikes radiating, crown
    // bangs: broad flat locks from the hairline, overlapping, swept toward the camera side with uneven lengths
    const nb = H.bangs || 7, BL = [0.12, 0.155, 0.11, 0.165, 0.125, 0.145, 0.1, 0.13];
    for (let i = 0; i < nb; i++) { const u = i / (nb - 1) - 0.5, z = u * 0.2; spikes.push({ at: [0.075 * hk, 0.1 * hk, z * hk], dir: [0.62, -1, u * 0.9 + 0.22], L: BL[i % BL.length], w: 0.04, d: 0.02 }); }
    for (const s of [-1, 1]) spikes.push({ at: [0.05 * hk, 0.04 * hk, s * 0.114 * hk], dir: [0.2, -1, s * 0.14], L: 0.19, w: 0.024, d: 0.016 });
    const backs = [[-1, 0.55, 0], [-1, 0.1, 0.06], [-1, 0.1, -0.06], [-0.9, -0.45, 0.07], [-0.9, -0.45, -0.07], [-0.6, 0.95, 0.07], [-0.6, 0.95, -0.07], [-1, -0.2, 0], [0.1, 1, 0.05]];
    for (const [x, y, z] of backs) { const l = Math.hypot(x, y, z); spikes.push({ at: [(x / l * 0.09 - 0.01) * hk, (y / l * 0.09 + 0.03) * hk, (z / l * 0.09 + z * 0.4) * hk], dir: [x, y * 0.85 - 0.25, z * 2.2], L: 0.13 + (y < 0 ? 0.03 : 0), w: 0.034, d: 0.038 }); }
    for (const sp of spikes) {
      const d = new THREE.Vector3(...sp.dir).normalize(), root = new THREE.Vector3(...sp.at).add(new THREE.Vector3(...HB)), tip = root.clone().addScaledVector(d, sp.L);
      const ids = chain('hair', B.head, [root.toArray(), tip.toArray()], { stiff: [0, 0.32], drag: 0.86, grav: 2.5, collide: false });
      const g = spike(sp.L, sp.w, sp.d, 4); acc.add(g, bind[ids[0]], { part: 'hair', colorFn: HC, shine: 1, weights: W1(ids[0]), line: 0.85 });
    }
    // ponytail: tie ring (glow) + long tapered tube on a 3-bone chain
    if (H.ponytail) {
      const P0 = new THREE.Vector3(-0.115 * hk, 0.085 * hk, 0).add(new THREE.Vector3(...HB)), n = H.ponytail.segs || 3, L = H.ponytail.len || 0.42, dir = new THREE.Vector3(-0.55, -0.83, 0).normalize();
      const pts = []; for (let k = 0; k <= n; k++) pts.push(P0.clone().addScaledVector(dir, L * k / n).toArray());
      const ids = chain('tail', B.head, pts, { stiff: [0, 0.12, 0.06, 0.035], drag: 0.9, grav: 5, collide: false, tail: true });
      const tm = new THREE.Matrix4().compose(P0, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1));
      const rings = [{ y: -0.02, rx: 0 }, { y: -0.012, rx: 0.03, rz: 0.03 }, { y: 0.015, rx: 0.032, rz: 0.032 }, { y: 0.03, rx: 0.042, rz: 0.04 }];
      for (let k = 1; k <= 9; k++) { const u = k / 9; rings.push({ y: 0.03 + (L - 0.03) * u, rx: 0.044 * (1 - u * 0.85) * (1 + 0.25 * Math.sin(u * 3)), rz: 0.036 * (1 - u * 0.8), x: 0.02 * Math.sin(u * 2.5) }); }
      rings.push({ y: L + 0.03, rx: 0 });
      acc.add(tube(rings, 7), tm, { part: 'hair', colorFn: (l) => (l.y < 0.02 && l.y > -0.012 ? pal.hairTie : pal.hair), glowFn: (l) => (l.y < 0.02 && l.y > -0.012 ? 0.7 : 0), weights: (v, l) => chainW(ids, Math.max(0, l.y) / L), line: 0.9, shine: 1 });
    }
  }

  // ---------------------------------------------------------------- assemble
  for (let i = 0; i < names.length; i++) { const b = new THREE.Bone(); b.name = names[i]; bind[i].decompose(b.position, b.quaternion, b.scale); bones.push(b); }
  const skeleton = new THREE.Skeleton(bones, bind.map((m) => m.clone().invert()));
  const geo = acc.build();
  const U = toonUniforms(pal.rim ?? pal.trim), OU = outlineUniforms(cfg.outlinePx ?? 1.9, pal.line ?? 0x07060f);
  const mat = toonMat(U);   // one material for the whole body; the hair highlight is masked per vertex (aShine)
  const body = new THREE.SkinnedMesh(geo, mat), outline = new THREE.SkinnedMesh(geo, outlineMat(OU));
  for (const m of [body, outline]) { m.bind(skeleton, new THREE.Matrix4()); m.frustumCulled = false; }
  hookOutline(outline, OU); outline.renderOrder = -1;
  // face decal (child of the head bone)
  const faceTex = faceAtlas(cfg.face);
  const face = new THREE.Mesh(faceGeo(hr), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  face.renderOrder = 2; face.position.set(HB[0] - BIND.head[0], HB[1] - BIND.head[1], 0); bones[B.head].add(face);
  // katana (+ outline), placed by the renderer at the weapon hand
  const kg = katanaGeo(pal), wmat = toonMat(U), weapon = new THREE.Mesh(kg, wmat), wo = new THREE.Mesh(kg, outlineMat(OU));
  hookOutline(wo, OU); weapon.add(wo); weapon.frustumCulled = false; wo.frustumCulled = false;
  const tris = { parts: acc.parts, yr: acc.yr, body: geo.index.count / 3, weapon: kg.index.count / 3, face: face.geometry.index.count / 3 };
  return {
    body, outline, face, faceTex, weapon, bones, bind, skeleton, chains, sheath, U, OU, tris, B, ver: V2 ? 'v2' : 'v1', legR: V2 ? [0.11, 0.082] : [0.1, 0.075],
    dispose() { geo.dispose(); kg.dispose(); face.geometry.dispose(); faceTex.dispose(); for (const m of [mat, outline.material, wmat, wo.material, face.material]) m.dispose(); skeleton.dispose(); },
  };
}
/** weights along a chain of rigid bones: tent functions centred on each segment (0.5/0.5 at the joints) */
function chainW(ids, t) {
  const n = ids.length, s = Math.max(0, Math.min(0.9999, t)) * n, out = [];
  for (let k = 0; k < n; k++) { const w = Math.max(0, 1 - Math.abs(s - (k + 0.5))); if (w > 0) out.push([ids[k], w]); }
  if (s < 0.5) out.push([ids[0], 1]);            // the first half of the first segment is fully rigid
  if (s > n - 0.5) out.push([ids[n - 1], 1]);
  return out;
}
