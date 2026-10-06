// 機械將軍 KAGE-SHŌGUN — anime body of the final boss 塔主・零 TOWER LORD ZERO (HANDOFF §16 step 2), built on the same skeleton and
// skin accumulator as the four player classes (js/anime/builder.js calls buildShogun(ctx) when cfg.build === 'shogun').
// Procedural only, no external assets.
//   concept: a corrupted AI kenjutsu master in cyber-shogun armour — nothing of a person is left showing: black-lacquer ō-yoroi
//   plates (shells around every limb, crisp red neon seam lines), a horned kabuto (gold kuwagata horns with a red inner edge, a
//   glowing maedate eye, three flared shikoro lames + fukigaeshi), a MASK VISOR instead of a face (canvas atlas, 4 tiles: calm cyan
//   slits · calm focus · cracked corrupted red · corrupted flare), big rectangular ō-sode on both shoulders, kote + gauntlets, a
//   lamellar dō over a crimson under-robe, five kusazuri tassets, haidate thigh aprons, suneate shin guards, a tattered crimson
//   JINBAORI surcoat hanging from the shoulders on 7 spring chains (zig-zag torn hem, glowing), a long saya on the off hip.
//   The nodachi (katana builder × NODACHI_K, see builder.js) and the six floating DATA BLADES (one instanced mesh + outline,
//   placed by the animator — js/anime/shogun.js bladePose) are built in builder.js.
// Proportions: shared skeleton; the fight scales the whole rig by the ladder scale (1.34), so he stands ≈ 1.34 × a player.
// Shoulder line half-width 0.27 (Swordsman 0.232) + ō-sode → ≈ 0.36; boxy cuirass (waist 0.17), heavy limbs (× 1.15).
import * as THREE from 'three';
import { tube, shell, spike, smooth, loft, SkinAcc } from './geo.js';

const TAU = Math.PI * 2;
export const SHOGUN_HR = 0.13;
/** nodachi = the katana builder scaled along the blade (and 1.15 × thicker). With the rig at the ladder scale 1.34 it is 1.7 × the
 *  Swordsman's katana on screen (1.34 × 1.27) and its tip lands on the edge of the sim's 1.8–2.4 m nodachi hitboxes (anime-shogun.test) */
export const NODACHI_K = 1.27;
/** long saya on the off-side hip (pelvis-local mouth + direction into the saya), for the iai coil (koiguchi) and the win nōtō */
export const SAYA = { mouth: [0.115, -0.02, -0.105], dir: (() => { const d = [-Math.cos(0.5), -Math.sin(0.5), -0.12], l = Math.hypot(...d); return d.map((q) => q / l); })(), L: 1.24 };

/** lamellar row knots for crisp seams: plain rows between seam lines; each seam = three vertex rows (s − e, s, s + e), only the
 *  middle one is coloured, so the glowing line stays thin instead of smearing over a whole row. Returns { V, rows, at(v) } */
function lam(seams, plain = 1, e = 0.014, hem = 0) {
  const V = [0]; let prev = 0;
  const pushPlain = (a, b) => { for (let i = 1; i < plain; i++) V.push(a + (b - a) * i / plain); };
  for (const s of seams) { pushPlain(prev, s - e); V.push(s - e, s, s + e); prev = s + e; }
  if (hem) { pushPlain(prev, 1 - hem); V.push(1 - hem); } else pushPlain(prev, 1);
  V.push(1);
  const rows = V.length - 1;
  const at = (v) => { const x = v * rows, i = Math.min(rows - 1, Math.floor(x)), k = x - i; return V[i] + (V[i + 1] - V[i]) * k; };
  return { V, rows, at };
}
const isSeam = (v, seams, e = 0.014) => seams.some((s) => Math.abs(v - s) < e * 0.5);

// ------------------------------------------------------------------ mask visor atlas (4 tiles; u 0 = camera side, v 0 = forehead)
// tile 0: phase 1 calm — gunmetal faceplate, two narrow cyan eye slits angled in (stern), faint cyan ridge, dim cheek vents
// tile 1: phase 1 focus (attacking) — slits white-hot, light streaks trailing off the slits, ridge lit
// tile 2: phase 2 corrupted — a jagged crack from the brow through the near eye to the jaw glowing red, a chunk broken out, eyes red
//          (the cracked one larger, torn), red / cyan glitch scan-bars, oni teeth grille
// tile 3: phase 2 flare — the same, hotter, wider glitch offset
export const MASK = { calm: 0, focus: 1, broken: 2, flare: 3 };
export function maskAtlas() {
  const S = 384, K = S / 256, cv = document.createElement('canvas'); cv.width = S * 4; cv.height = S; const g = cv.getContext('2d');
  const plate = () => {   // menpō faceplate silhouette (V-chin), gunmetal gradient, bright rim
    g.beginPath(); g.moveTo(26, 16); g.lineTo(230, 16); g.lineTo(236, 112); g.lineTo(214, 186); g.lineTo(160, 246); g.lineTo(96, 246); g.lineTo(42, 186); g.lineTo(20, 112); g.closePath();
  };
  const slit = (cx, mirror, wid, hgt) => {   // angular eye slit, inner corner low (stern brow line)
    g.save(); g.translate(cx, 126); if (mirror) g.scale(-1, 1);
    g.beginPath(); g.moveTo(-wid * 0.55, -hgt * 0.15); g.lineTo(wid * 0.5, -hgt * 0.75); g.lineTo(wid * 0.56, hgt * 0.15); g.lineTo(-wid * 0.48, hgt * 0.62); g.closePath(); g.restore();
  };
  for (let i = 0; i < 4; i++) {
    g.save(); g.translate(i * S, 0); g.scale(K, K);
    const p2 = i >= 2, hot = i % 2 === 1, eye = p2 ? '#ff2440' : '#4fe6ff', core = p2 ? '#ffd8de' : '#eaffff';
    // plate
    const gr = g.createLinearGradient(0, 16, 0, 246); gr.addColorStop(0, '#3a3e4c'); gr.addColorStop(0.45, '#22252f'); gr.addColorStop(1, '#0f1016');
    plate(); g.fillStyle = gr; g.fill();
    // brow ridge shadow + cheekbone planes (lit from upper front: lighter upper-left, darker lower-right)
    g.fillStyle = 'rgba(0,0,0,0.42)'; g.beginPath(); g.moveTo(24, 96); g.lineTo(232, 96); g.lineTo(230, 112); g.lineTo(26, 112); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(40, 150); g.lineTo(112, 150); g.lineTo(96, 236); g.lineTo(54, 186); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(144, 150); g.lineTo(216, 150); g.lineTo(202, 186); g.lineTo(160, 236); g.closePath(); g.fill();
    // rim
    plate(); g.lineWidth = 5; g.strokeStyle = p2 ? '#3a0a12' : '#0b0d14'; g.stroke();
    g.lineWidth = 2; g.strokeStyle = p2 ? 'rgba(255,60,80,0.75)' : 'rgba(110,235,255,0.55)'; g.beginPath(); g.moveTo(26, 18); g.lineTo(230, 18); g.stroke();
    // centre ridge (nose line)
    g.strokeStyle = p2 ? 'rgba(255,50,70,0.55)' : (hot ? 'rgba(160,250,255,0.95)' : 'rgba(80,220,255,0.55)'); g.lineWidth = hot ? 3 : 2;
    g.beginPath(); g.moveTo(128, 20); g.lineTo(128, 150); g.lineTo(120, 166); g.stroke();
    // cheek vents
    g.strokeStyle = p2 ? 'rgba(255,40,70,0.7)' : 'rgba(80,220,255,0.45)'; g.lineWidth = 3;
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const x0 = 128 + sx * 48, y = 172 + k * 11; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + sx * (26 - k * 5), y + 4); g.stroke(); }
    // mouth grille: calm = one thin slit, corrupted = oni teeth
    if (p2) { g.fillStyle = '#12030a'; g.beginPath(); g.moveTo(98, 206); g.lineTo(158, 206); g.lineTo(150, 226); g.lineTo(106, 226); g.closePath(); g.fill();
      g.fillStyle = hot ? '#ffd0d8' : '#ff5068'; for (let k = 0; k < 6; k++) { const x = 104 + k * 9; g.beginPath(); g.moveTo(x, 206); g.lineTo(x + 6, 206); g.lineTo(x + 3, 216 + (k % 2) * 4); g.closePath(); g.fill(); } }
    else { g.strokeStyle = 'rgba(80,220,255,0.5)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(108, 214); g.lineTo(148, 214); g.stroke(); }
    // eyes (camera side = left half of the tile)
    const wN = p2 ? 70 : 58, hN = p2 ? 26 : 16, wF = 56, hF = p2 ? 18 : 16;
    g.save(); g.shadowColor = eye; g.shadowBlur = hot ? 26 : 14;
    g.fillStyle = eye; slit(86, false, wN, hN); g.fill(); slit(170, true, wF, hF); g.fill();
    g.fillStyle = core; g.shadowBlur = 0; g.save(); g.translate(86, 126); g.scale(0.62, 0.38); g.translate(-86, -126); slit(86, false, wN, hN); g.fill(); g.restore();
    g.save(); g.translate(170, 126); g.scale(0.62, 0.38); g.translate(-170, -126); slit(170, true, wF, hF); g.fill(); g.restore();
    g.restore();
    if (hot && !p2) {   // focus: light streaks off the slits toward the camera side (kiai of a machine)
      g.strokeStyle = 'rgba(150,245,255,0.8)'; g.lineWidth = 3; for (const [y, l] of [[118, 34], [128, 26]]) { g.beginPath(); g.moveTo(56, y); g.lineTo(56 - l, y - 6); g.stroke(); }
    }
    if (p2) {
      // the crack: brow → through the near eye → jaw, with side branches; dark fissure + red glow core; a chunk broken out at the cheek
      const crack = [[96, 16], [104, 52], [92, 84], [100, 112], [84, 140], [92, 170], [74, 204], [82, 246]];
      g.save(); g.lineJoin = 'miter'; g.lineCap = 'round';
      g.strokeStyle = '#050104'; g.lineWidth = 9; g.beginPath(); crack.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.shadowColor = '#ff1a3a'; g.shadowBlur = hot ? 22 : 12; g.strokeStyle = hot ? '#ffb0bc' : '#ff2440'; g.lineWidth = 3.2; g.stroke();
      g.lineWidth = 2; for (const br of [[[104, 52], [128, 44], [140, 56]], [[92, 84], [66, 92], [50, 82]], [[92, 170], [116, 182]], [[100, 112], [124, 104]]]) { g.beginPath(); br.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      g.fillStyle = '#0a0105'; g.beginPath(); g.moveTo(60, 150); g.lineTo(86, 142); g.lineTo(94, 168); g.lineTo(70, 182); g.lineTo(54, 168); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,36,64,0.85)'; g.beginPath(); g.moveTo(66, 154); g.lineTo(82, 150); g.lineTo(86, 164); g.lineTo(72, 172); g.closePath(); g.fill();
      g.restore();
      // glitch scan-bars (chromatic: red right, cyan left), deterministic
      const bars = hot ? [[30, 0.18, 14], [150, 0.32, -18], [112, 0.6, 10], [196, 0.82, -12], [64, 0.45, 20]] : [[40, 0.22, 8], [140, 0.58, -10], [190, 0.84, 6]];
      for (const [x, v, o] of bars) { const y = 16 + v * 230; g.fillStyle = 'rgba(255,40,70,0.55)'; g.fillRect(x + o, y, 46, 3 + (x % 3)); g.fillStyle = 'rgba(60,230,255,0.4)'; g.fillRect(x - o * 0.6, y + 4, 30, 2); }
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(0.25, 1); tex.anisotropy = 4;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** one data blade (local +Y = blade direction, origin = the hex core at its base; +X = edge): lens blade with a white-hot edge on a
 *  red body + a glowing octahedral core. Built with SkinAcc so it carries the toon attributes (colour, glow, line…); 44 triangles. */
export function dataBladeGeo(pal) {
  const acc = new SkinAcc(), W = () => [[0, 1]], L = 0.62, w = 0.052, d = 0.012;
  acc.add(tube([{ y: 0.03, rx: 0 }, { y: 0.05, rx: w * 0.55, rz: d }, { y: 0.32, rx: w, rz: d * 1.1, x: 0.006 }, { y: 0.52, rx: w * 0.62, rz: d * 0.8, x: 0.01 }, { y: L, rx: 0, x: 0.004 }], 4), M4(),
    { colorFn: (l) => (l.x > w * 0.3 ? 0xfff0f2 : pal.dblade), glowFn: (l) => (l.x > w * 0.3 ? 1 : 0.62), weights: W, line: 0.8, shine: 0.6 });
  const core = new THREE.OctahedronGeometry(0.04, 0); core.scale(1, 1.4, 0.6);
  acc.add(core, M4(), { color: pal.trim, glow: 0.9, weights: W, line: 0.7 });
  const g = acc.build(); g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight'); return g;
}
const M4 = () => new THREE.Matrix4();

/**
 * ctx: { acc, B, bind, chain, chainW, pal, hm, HB, hr, headGeo, headPoint, M4, T, W1, addBone, neckAO } (from buildCharacter).
 * Returns { faceTex, sheath, dispose() }.
 */
export function buildShogun(ctx) {
  const { acc, B, bind, chain, chainW, pal, hm, HB, hr, headGeo, T, W1 } = ctx;
  const rb = (g, k, rx, ry, rz) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x / rx, y / ry, z / rz) || 1; p.setXYZ(i, x * (1 - k) + x / r * k, y * (1 - k) + y / r * k, z * (1 - k) + z / r * k); } g.computeVertexNormals(); return g; };
  const hk = hr / 0.118;
  const LQ = pal.lacquer, SEAM = pal.trim, GOLD = pal.gold;

  // ---------------------------------------------------------------- dō (cuirass): one boxy loft, little waist taper. Lamellar rows on the
  // belly (crisp red seams at 1.17 / 1.25), a solid munaita breastplate above 1.36 with a seam under it, crimson under-robe below
  const R0 = (y, f, b, w, n = 2.2, x = 0) => ({ y, f, b, w, n, x });
  const DOS = [1.17, 1.25, 1.37], E = 0.006;
  const torso = [R0(0.85, 0, 0, 0), R0(0.866, 0.07, 0.08, 0.11), R0(0.9, 0.108, 0.12, 0.17, 2.4), R0(0.97, 0.114, 0.124, 0.184, 2.5), R0(1.04, 0.112, 0.114, 0.178, 2.6),
    R0(1.1, 0.114, 0.104, 0.172, 2.8), R0(1.17 - E, 0.118, 0.102, 0.174, 3), R0(1.17, 0.12, 0.103, 0.176, 3), R0(1.17 + E, 0.12, 0.103, 0.177, 3),
    R0(1.25 - E, 0.128, 0.106, 0.186, 3), R0(1.25, 0.13, 0.107, 0.188, 3), R0(1.25 + E, 0.131, 0.107, 0.19, 3),
    R0(1.37 - E, 0.148, 0.112, 0.214, 3.1), R0(1.37, 0.15, 0.112, 0.216, 3.1), R0(1.37 + E, 0.151, 0.113, 0.218, 3.1),
    R0(1.44, 0.152, 0.116, 0.244, 3.3), R0(1.49, 0.142, 0.116, 0.262, 3.5), R0(1.525, 0.124, 0.11, 0.27, 3.6), R0(1.555, 0.098, 0.094, 0.24, 3.2),
    R0(1.58, 0.074, 0.074, 0.168, 2.6), R0(1.6, 0.054, 0.056, 0.09, 2), R0(1.612, 0, 0, 0)];
  const doSeam = (l) => l.y > 1.08 && DOS.some((s) => Math.abs(l.y - s) < E * 0.5);
  const emblem = (l) => l.x > 0.1 && l.y > 1.4 && l.y < 1.5 && Math.abs(Math.hypot(l.z, l.y - 1.45) - 0.034) < 0.008;   // breastplate kamon ring (painted, coarse)
  acc.add(loft(torso, 16), M4(), {
    part: 'torso', colorFn: (l) => (l.y < 1.085 ? pal.robe : doSeam(l) || emblem(l) ? SEAM : l.y > 1.37 ? pal.lacquerHi : LQ), glowFn: (l) => (doSeam(l) ? 0.85 : emblem(l) ? 0.6 : 0), shine: 0.35,
    weights: (v) => { const k = smooth(1.04, 1.2, v.y); const w = [[B.chest, k], [B.pelvis, 1 - k]];
      if (v.y > 1.4 && Math.abs(v.z) > 0.13) { const s = smooth(0.13, 0.26, Math.abs(v.z)) * smooth(1.4, 1.5, v.y) * 0.5; w[0][1] *= 1 - s; w.push([v.z > 0 ? B.uaF : B.uaB, s]); } return w; },
  });
  // neck (lacquer collar → no skin anywhere) + nodowa throat guard
  acc.add(tube([{ y: 1.54, rx: 0 }, { y: 1.555, rx: 0.05, rz: 0.054, x: 0.004 }, { y: 1.64, rx: 0.046, rz: 0.05, x: 0.008 }, { y: 1.7, rx: 0.042, rz: 0.044, x: 0.008 }, { y: 1.72, rx: 0 }], 8), M4(),
    { part: 'neck', color: pal.lacquerHi, weights: (v) => { const a = smooth(1.55, 1.6, v.y), b = smooth(1.66, 1.71, v.y); return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, b]]; } });
  {
    const ng = shell((u, v) => { const a = -1.2 + u * 2.4; return [0.012 + Math.cos(a) * (0.062 + v * 0.014), 1.645 - v * 0.075, Math.sin(a) * (0.07 + v * 0.016)]; }, (u) => { const a = -1.2 + u * 2.4; return [Math.cos(a), 0.1, Math.sin(a)]; }, 6, 2, 0.012);
    acc.add(ng, M4(), { part: 'neck', colorFn: (l) => (l.y < 1.578 ? SEAM : LQ), glowFn: (l) => (l.y < 1.578 ? 0.7 : 0), shine: 0.4, weights: (v) => { const k = smooth(1.58, 1.65, v.y) * 0.5; return [[B.chest, 1 - k], [B.neck, k]]; } });
  }
  // head (lacquer: the mask decal is the face)
  acc.add(headGeo(hr, 16, 12, 1), hm, { part: 'head', color: pal.lacquerHi, weights: W1(B.head) });

  // ---------------------------------------------------------------- kabuto: hachi bowl (glowing ribs), mabisashi brim, 3 flared shikoro lames,
  // fukigaeshi turn-backs, gold kuwagata horns with a red inner edge, maedate eye
  {
    const R = hr * 1.2, cy = 0.022 * hk, cx = -0.008;
    const thMax = (ph) => 1.02 + 0.42 * smooth(0.6, 2.4, Math.abs(ph));   // low at the front (brow), deeper at the sides / back
    const bowl = (u, v) => { const ph = (u - 0.5) * TAU, th = 0.08 + v * (thMax(ph) - 0.08); return [cx + Math.cos(ph) * Math.sin(th) * R, cy + Math.cos(th) * R * 0.92, Math.sin(ph) * Math.sin(th) * R]; };
    const rib = (l) => { const ph = Math.atan2(l.z, l.x - cx); return Math.abs(((ph / TAU) * 8 % 1 + 1) % 1 - 0.5) > 0.44 && l.y > cy + R * 0.25; };
    acc.add(shell(bowl, (u, v) => { const p = bowl(u, v); const d = [p[0] - cx, p[1] - cy, p[2]], l = Math.hypot(...d) || 1; return d.map((q) => q / l); }, 16, 4, 0.014), hm,
      { part: 'helmet', colorFn: (l) => (rib(l) ? SEAM : LQ), glowFn: (l) => (rib(l) ? 0.55 : 0), shine: 0.6, weights: W1(B.head) });
    const tehen = new THREE.CylinderGeometry(0.018, 0.026, 0.02, 8, 1); tehen.translate(cx, cy + R * 0.94, 0);
    acc.add(tehen, hm, { part: 'helmet', color: GOLD, glow: 0.2, shine: 0.6, weights: W1(B.head), line: 0.7 });
    // brim over the visor
    const brim = shell((u, v) => { const ph = -0.95 + u * 1.9, th = thMax(ph) - 0.02, r = R * (1.02 + 0.22 * v); return [cx + Math.cos(ph) * Math.sin(th) * r, cy + Math.cos(th) * R * 0.92 - 0.012 * v, Math.sin(ph) * Math.sin(th) * r]; },
      (u) => { const ph = -0.95 + u * 1.9; return [0.3 * Math.cos(ph), 1, 0.3 * Math.sin(ph)]; }, 8, 1, 0.012);
    acc.add(brim, hm, { part: 'helmet', colorFn: (l) => (l.x > R * 1.1 ? GOLD : LQ), shine: 0.6, weights: W1(B.head) });
    // shikoro: three lames stepping down and out around the sides / back, glowing lower edges
    for (let k = 0; k < 3; k++) {
      const y0 = cy - 0.035 * hk - k * 0.04 * hk, r0 = R * (0.96 + 0.1 * k), a0 = 0.95 - 0.05 * k;
      const lg = shell((u, v) => { const ph = a0 + u * (TAU - 2 * a0), r = r0 + v * 0.05 * hk; return [cx + Math.cos(ph) * r, y0 - v * 0.05 * hk, Math.sin(ph) * r * 1.02]; },
        (u) => { const ph = a0 + u * (TAU - 2 * a0); return [Math.cos(ph), 0.45, Math.sin(ph)]; }, 12, 1, 0.012);
      acc.add(lg, hm, { part: 'helmet', colorFn: (l) => (l.y < y0 - 0.044 * hk ? SEAM : LQ), glowFn: (l) => (l.y < y0 - 0.044 * hk ? 0.75 : 0), shine: 0.4, weights: W1(B.head) });
    }
    // fukigaeshi: the top lame turned back beside the face (both sides), gold edged
    for (const s of [1, -1]) {
      const fg = shell((u, v) => [cx + 0.045 * hk - u * 0.05 * hk, cy - 0.025 * hk - v * 0.07 * hk + u * 0.01, s * (R * 1.02 + 0.03 * hk * u + 0.012 * v)], () => [0.2, 0, s], 3, 2, 0.012);
      acc.add(fg, hm, { part: 'helmet', colorFn: (l) => (l.x > cx + 0.035 * hk ? GOLD : LQ), shine: 0.5, weights: W1(B.head) });
    }
    // kuwagata horns: flat curved blades rising in a V from the front of the bowl, gold with a red glowing inner edge
    for (const s of [1, -1]) {
      const pts = []; for (let k = 0; k <= 7; k++) { const u = k / 7; pts.push([cx + R * 0.86 + 0.03 * u - 0.06 * u * u, cy + R * 0.42 + u * 0.36 * hk, s * (0.024 + u * 0.07 + u * u * 0.09) * hk]); }
      const P = [], I = [], C = [], n = pts.length;
      for (let k = 0; k < n; k++) {   // ribbon with thickness: 4 verts per station (front-in, front-out, back-out, back-in)
        const [x, y, z] = pts[k], wdt = 0.022 * (1 - (k / (n - 1)) * 0.85) * hk, th = 0.006;
        P.push(x + th, y - wdt * 0.4, z - s * wdt * 0.5, x + th, y + wdt * 0.4, z + s * wdt * 0.5, x - th, y + wdt * 0.4, z + s * wdt * 0.5, x - th, y - wdt * 0.4, z - s * wdt * 0.5);
      }
      for (let k = 0; k < n - 1; k++) for (let j = 0; j < 4; j++) { const a = k * 4 + j, b = k * 4 + (j + 1) % 4, c = a + 4, d = b + 4; I.push(a, c, b, b, c, d); }
      I.push(0, 1, 2, 0, 2, 3); const e0 = (n - 1) * 4; I.push(e0, e0 + 2, e0 + 1, e0, e0 + 3, e0 + 2);
      const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); hg.setIndex(I); hg.computeVertexNormals();
      acc.add(hg, hm, { part: 'helmet', colorFn: (l, v, i) => ((i % 4 === 0 || i % 4 === 3) ? SEAM : GOLD), glowFn: (l, v, i) => ((i % 4 === 0 || i % 4 === 3) ? 0.7 : 0.12), shine: 0.9, weights: W1(B.head), line: 0.75 });
    }
    // maedate: a glowing red data-eye between the horns
    const gem = new THREE.OctahedronGeometry(0.026 * hk, 0); gem.scale(0.6, 1.25, 1); gem.translate(cx + R * 0.98, cy + R * 0.4, 0);
    acc.add(gem, hm, { part: 'helmet', color: SEAM, glow: 0.9, shine: 0.8, weights: W1(B.head), line: 0.7 });
  }

  // ---------------------------------------------------------------- ō-sode: big rectangular lamellar shoulder boards on both shoulders, hanging
  // outside the upper arm (four lames, crisp seams, glowing bottom edge)
  {
    const S = [0.25, 0.5, 0.75], L = lam(S, 1, 0.022, 0.05);
    for (const s of [1, -1]) {
      const z0 = s * 0.2, y0 = 1.62, H = 0.33;
      const surf = (u, v) => { const vv = L.at(v), x = -0.13 + u * 0.27, bow = Math.cos((u - 0.5) * 2.2); return [x - 0.012 * vv, y0 - H * vv, z0 + s * (0.06 + 0.035 * bow + 0.07 * vv)]; };
      const sg = shell(surf, (u) => [0, 0.35, s], 4, L.rows, 0.016);
      const vOf = (l) => (y0 - l.y) / H;
      acc.add(sg, M4(), { part: 'armor', colorFn: (l) => { const v = vOf(l); return v > 1 - 0.05 * 0.5 ? SEAM : isSeam(v, S, 0.022) ? SEAM : v < 0.25 ? pal.lacquerHi : LQ; },
        glowFn: (l) => { const v = vOf(l); return v > 1 - 0.025 ? 0.85 : isSeam(v, S, 0.022) ? 0.7 : 0; }, shine: 0.45,
        weights: (v) => { const k = smooth(1.62, 1.3, v.y); return [[s > 0 ? B.uaF : B.uaB, 0.45 + 0.4 * k], [B.chest, 0.55 - 0.4 * k]]; } });
    }
  }

  // ---------------------------------------------------------------- arms: crimson under-sleeve (upper arm) → black kote (forearm) → gauntlet.
  // Fewer rings than the player bodies: the plates (shells) carry the detail
  const ARM = [[1.605, 0], [1.594, 0.05], [1.572, 0.072], [1.535, 0.082], [1.48, 0.08, 0.004], [1.38, 0.074, 0.008], [1.26, 0.064, 0.006], [1.17, 0.058],
    [1.1, 0.06], [1.02, 0.062], [0.94, 0.056], [0.875, 0.05], [0.85, 0.047], [0.82, 0.046], [0.8, 0.04], [0.788, 0]];
  for (const sd of ['F', 'B']) {
    const z = sd === 'F' ? 0.165 : -0.165, ua = B['ua' + sd], fa = B['fa' + sd], zs = Math.sign(z);
    const rings = ARM.map(([y, r, x = 0]) => ({ y, rx: r * 1.0, rz: r * 1.1, z: z * (y > 1.45 ? 1 + (y - 1.45) * 0.5 : 1), x }));
    acc.add(tube(rings, 10), M4(), {
      part: 'arms', colorFn: (l) => (l.y < 0.86 ? pal.glove : l.y < 1.12 ? LQ : pal.robe), shine: 0.2,
      weights: (v) => { const k = smooth(1.09, 1.2, v.y); const w = [[ua, k], [fa, 1 - k]]; if (v.y > 1.5) { const s = smooth(1.5, 1.6, v.y) * 0.4; w[0][1] *= 1 - s; w.push([B.chest, s]); } if (v.y < 0.83) { const s = smooth(0.83, 0.8, v.y) * 0.5; w[1][1] *= 1 - s; w.push([B['hand' + sd], s]); } return w; },
    });
    // kote plate: lacquer shell over the outer forearm (wrist → elbow) with a seam and a glowing wrist edge; elbow cap
    const kS = [0.5], kL = lam(kS, 1, 0.03, 0.06);
    const kg = shell((u, v) => { const a = -1.5 + u * 3.0, vv = kL.at(v), y = 1.08 - vv * 0.22, r = 0.07 - 0.01 * vv; return [Math.sin(a) * r * 1.02, y, z + zs * Math.cos(a) * r * 1.1]; },
      (u) => { const a = -1.5 + u * 3.0; return [Math.sin(a), 0, zs * Math.cos(a)]; }, 5, kL.rows, 0.012);
    acc.add(kg, M4(), { part: 'armor', colorFn: (l) => { const v = (1.08 - l.y) / 0.22; return v > 0.97 || isSeam(v, kS, 0.03) ? SEAM : LQ; }, glowFn: (l) => { const v = (1.08 - l.y) / 0.22; return v > 0.97 ? 0.85 : isSeam(v, kS, 0.03) ? 0.6 : 0; }, shine: 0.45, weights: W1(fa) });
    const ec = new THREE.SphereGeometry(0.062, 6, 4, 0, Math.PI, 0, Math.PI); ec.rotateY(zs > 0 ? -Math.PI / 2 : Math.PI / 2); ec.scale(0.8, 1.1, 1); ec.translate(-0.02, 1.14, z + zs * 0.012);
    acc.add(ec, M4(), { part: 'armor', color: pal.lacquerHi, shine: 0.5, weights: () => [[ua, 0.5], [fa, 0.5]], line: 0.85 });
    // gauntlet: armoured fist (weapon hand grips along the blade axis; off hand an open armoured mitt), red knuckle line
    const hb = B['hand' + sd], Mh = bind[hb];
    if (sd === 'F') {
      const fist = rb(new THREE.BoxGeometry(0.104, 0.12, 0.104, 2, 2, 2), 0.5, 0.06, 0.066, 0.06); fist.translate(0.012, -0.004, 0);
      acc.add(fist, Mh, { part: 'hands', colorFn: (l) => (l.y < -0.05 ? SEAM : l.x < -0.04 ? pal.lacquerHi : pal.glove), glowFn: (l) => (l.y < -0.05 ? 0.6 : 0), shine: 0.3, weights: W1(hb) });
      const th = tube([{ y: -0.01, rx: 0 }, { y: 0, rx: 0.023, rz: 0.025 }, { y: 0.054, rx: 0.02, rz: 0.021 }, { y: 0.07, rx: 0 }], 5); th.rotateZ(-0.5); th.translate(0.026, 0.024, 0.05);
      acc.add(th, Mh, { part: 'hands', color: pal.glove, weights: W1(hb) });
    } else {
      const mit = rb(new THREE.BoxGeometry(0.094, 0.134, 0.064, 2, 2, 2), 0.5, 0.055, 0.072, 0.038); mit.translate(0.006, 0.07, 0);
      acc.add(mit, Mh, { part: 'hands', colorFn: (l) => (l.x < -0.034 && l.y > 0.03 ? pal.lacquerHi : pal.glove), shine: 0.3, weights: W1(hb) });
      const th = tube([{ y: -0.01, rx: 0 }, { y: 0, rx: 0.021, rz: 0.022 }, { y: 0.058, rx: 0.018, rz: 0.019 }, { y: 0.074, rx: 0 }], 5); th.rotateZ(0.7); th.translate(-0.026, 0.036, 0.024);
      acc.add(th, Mh, { part: 'hands', color: pal.glove, weights: W1(hb) });
    }
  }

  // ---------------------------------------------------------------- legs: crimson hakama thighs → lacquer below the knee; boots with a glowing sole
  for (const sd of ['F', 'B']) {
    const z = sd === 'F' ? 0.095 : -0.095, zs = Math.sign(z), th = B['th' + sd], sh = B['shin' + sd];
    const rings = [[1.0, 0], [0.99, 0.066], [0.95, 0.1], [0.86, 0.1, 0.004], [0.72, 0.092, 0.005], [0.58, 0.076], [0.48, 0.066], [0.43, 0.066], [0.36, 0.07, -0.006],
      [0.24, 0.066, -0.006], [0.12, 0.056], [0.03, 0.054], [-0.02, 0.05], [-0.035, 0]]
      .map(([y, r, x = 0]) => ({ y, rx: r * 1.08, rz: r * 1.0, z, x }));
    const legW = (v) => { const k = smooth(0.42, 0.51, v.y); const w = [[th, k], [sh, 1 - k]]; if (v.y > 0.93) { const s = smooth(0.93, 1.0, v.y) * 0.45; w[0][1] *= 1 - s; w.push([B.pelvis, s]); } return w; };
    acc.add(tube(rings, 10), M4(), { part: 'legs', colorFn: (l) => (l.y > 0.47 ? pal.robe : pal.glove), shine: 0.1, weights: legW });
    // haidate: lamellar apron on the front / outer thigh (under the kusazuri), seams + glowing hem
    const hS = [0.33, 0.66], hL = lam(hS, 1, 0.025, 0.05);
    const hg = shell((u, v) => { const a = -0.7 + u * 2.3, vv = hL.at(v), y = 0.86 - vv * 0.3, r = 0.112 + 0.006 * vv; return [Math.cos(a) * r * 1.05 + 0.006, y, z + zs * Math.sin(a) * r]; },
      (u) => { const a = -0.7 + u * 2.3; return [Math.cos(a), 0.1, zs * Math.sin(a)]; }, 5, hL.rows, 0.012);
    const hv = (l) => (0.86 - l.y) / 0.3;
    acc.add(hg, M4(), { part: 'armor', colorFn: (l) => (hv(l) > 0.975 || isSeam(hv(l), hS, 0.025) ? SEAM : LQ), glowFn: (l) => (hv(l) > 0.975 ? 0.8 : isSeam(hv(l), hS, 0.025) ? 0.6 : 0), shine: 0.4, weights: W1(th) });
    // suneate: shin guard (front / outer shin) with a raised knee plate, glowing top + bottom edges
    const sS = [0.42], sL = lam(sS, 2, 0.03, 0.05);
    const sg = shell((u, v) => { const a = -1.25 + u * 2.6, vv = sL.at(v), y = 0.53 - vv * 0.44, r = (vv < 0.2 ? 0.088 : 0.084 - 0.018 * vv); return [Math.cos(a) * r * 1.08 + 0.01 * (1 - vv), y, z + zs * Math.sin(a) * r]; },
      (u) => { const a = -1.25 + u * 2.6; return [Math.cos(a), 0, zs * Math.sin(a)]; }, 4, sL.rows, 0.012);
    const sv = (l) => (0.53 - l.y) / 0.44;
    acc.add(sg, M4(), { part: 'armor', colorFn: (l) => (sv(l) > 0.97 || isSeam(sv(l), sS, 0.03) ? SEAM : sv(l) < 0.2 ? pal.lacquerHi : LQ), glowFn: (l) => (sv(l) > 0.97 ? 0.8 : isSeam(sv(l), sS, 0.03) ? 0.65 : 0), shine: 0.45,
      weights: (v) => { const k = smooth(0.44, 0.52, v.y); return [[sh, 1 - k * 0.7], [th, k * 0.7]]; } });
    // boot (foot-local: +Y toward the toe, +X down), glowing sole
    const bf = tube([{ y: -0.066, rx: 0, x: 0.038 }, { y: -0.056, rx: 0.034, rz: 0.04, x: 0.044 }, { y: -0.03, rx: 0.046, rz: 0.052, x: 0.038 }, { y: 0.03, rx: 0.05, rz: 0.056, x: 0.034 },
      { y: 0.12, rx: 0.04, rz: 0.056, x: 0.042 }, { y: 0.2, rx: 0.026, rz: 0.044, x: 0.052 }, { y: 0.232, rx: 0, x: 0.056 }], 8);
    acc.add(bf, bind[B['foot' + sd]], { part: 'boots', colorFn: (l) => (l.x > 0.074 ? SEAM : pal.glove), glowFn: (l) => (l.x > 0.074 ? 0.55 : 0), weights: W1(B['foot' + sd]) });
  }

  // ---------------------------------------------------------------- obi (cord belt over the dō hem) + kusazuri: five lamellar tassets hanging
  // from it; the plates over each leg lean on that thigh so they ride with the stride instead of cutting through it
  {
    const og = shell((u, v) => { const a = u * TAU * 0.999; return [Math.cos(a) * 0.124 + 0.003, 1.11 - v * 0.05, Math.sin(a) * 0.186]; }, (u) => { const a = u * TAU; return [Math.cos(a), 0, Math.sin(a)]; }, 18, 1, 0.014);
    acc.add(og, M4(), { part: 'belt', colorFn: (l) => (Math.abs(l.y - 1.085) < 0.008 ? GOLD : pal.obi), weights: W1(B.pelvis) });
    const kS = [0.3, 0.6], kL = lam(kS, 1, 0.026, 0.05), H = 0.34, y0 = 1.075;
    for (const [a0, wdt] of [[0.42, 0.62], [-0.42, 0.62], [1.42, 0.7], [-1.42, 0.7], [Math.PI, 0.95]]) {
      const surf = (u, v) => { const a = a0 + (u - 0.5) * wdt, vv = kL.at(v), rx = 0.13 + 0.06 * vv, rz = 0.19 + 0.05 * vv; return [Math.cos(a) * rx, y0 - vv * H, Math.sin(a) * rz]; };
      const kg = shell(surf, (u) => { const a = a0 + (u - 0.5) * wdt; return [Math.cos(a), 0.12, Math.sin(a)]; }, 3, kL.rows, 0.013);
      const kv = (l) => (y0 - l.y) / H, legB = Math.sin(a0) > 0.2 ? B.thF : Math.sin(a0) < -0.2 ? B.thB : -1;
      acc.add(kg, M4(), { part: 'armor', colorFn: (l) => (kv(l) > 0.975 || isSeam(kv(l), kS, 0.026) ? SEAM : LQ), glowFn: (l) => (kv(l) > 0.975 ? 0.8 : isSeam(kv(l), kS, 0.026) ? 0.6 : 0), shine: 0.4,
        weights: (v) => { const k = smooth(1.05, 0.74, v.y) * (Math.abs(Math.cos(a0)) > 0.5 && Math.cos(a0) > 0 ? 0.55 : 0.4); return legB < 0 ? [[B.pelvis, 1]] : [[B.pelvis, 1 - k], [legB, k]]; } });
    }
  }

  // ---------------------------------------------------------------- long saya on the off-side hip (pelvis), gold koiguchi + kojiri, red seam
  let sheath;
  {
    const mouth = [SAYA.mouth[0], SAYA.mouth[1] + 1, SAYA.mouth[2]], dir = SAYA.dir, L = SAYA.L;
    const sm = new THREE.Matrix4().compose(new THREE.Vector3(...mouth), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir)), new THREE.Vector3(1, 1, 1));
    const rings = [{ y: -0.004, rx: 0 }, { y: 0, rx: 0.036, rz: 0.023 }, { y: 0.045, rx: 0.036, rz: 0.023 }, { y: 0.06, rx: 0.032, rz: 0.021 }];
    for (let k = 1; k <= 6; k++) { const u = k / 6; rings.push({ y: 0.06 + (L - 0.1) * u, rx: 0.032 - 0.005 * u, rz: 0.021 - 0.003 * u, x: 0.045 * u * u }); }
    rings.push({ y: L - 0.012, rx: 0.03, rz: 0.019, x: 0.045 }, { y: L, rx: 0, x: 0.045 });
    const edge = (l) => l.x < -0.026 + 0.045 * ((l.y - 0.06) / (L - 0.1)) ** 2;
    acc.add(tube(rings, 8), sm, { part: 'saya', colorFn: (l) => (l.y < 0.05 || l.y > L - 0.07 ? GOLD : edge(l) ? SEAM : pal.saya), glowFn: (l) => (l.y >= 0.05 && l.y <= L - 0.07 && edge(l) ? 0.55 : 0), shine: 0.5, weights: W1(B.pelvis) });
    const inv = bind[B.pelvis].clone().invert();
    sheath = { mouth: new THREE.Vector3(...mouth).applyMatrix4(inv), dir: new THREE.Vector3(...dir).transformDirection(inv) };
  }

  // ---------------------------------------------------------------- jinbaori: tattered crimson surcoat hanging from the shoulders down the back
  // and sides to the knees, 7 spring chains (the top rides on the chest, below the waist it swings), zig-zag torn hem with a glowing edge,
  // a red neon kamon on the back
  {
    const nCh = 7, n = 3, a0 = 0.58 * Math.PI, a1 = TAU - a0, y0 = 1.53, L = 1.06, yHem = y0 - L;
    const angs = Array.from({ length: nCh }, (_, i) => a0 + 0.12 + (a1 - a0 - 0.24) * (i / (nCh - 1)));
    const rad = (a, v) => { const rx = 0.15 + 0.03 * v + 0.07 * smooth(0.45, 1, v), rz = 0.29 - 0.08 * smooth(0, 0.45, v) + 0.1 * smooth(0.45, 1, v); return [rx * Math.cos(a), rz * Math.sin(a)]; };
    const cols = 16, tear = (u) => { const c = Math.floor(u * cols + 1e-6); return [0, 0.09, 0.03, 0.14, 0.05, 0.1, 0][c % 7] * (c % 2 ? 1 : 0.4); };   // per-column hem lift: torn strips
    const ids = [];
    for (const a of angs) {
      const pts = []; for (let k = 0; k <= n; k++) { const v = [0, 0.42, 0.72, 1][k], [x, z] = rad(a, v); pts.push([x - 0.02 * v, y0 - L * v, z]); }
      ids.push(chain('jinbaori', B.chest, pts, { stiff: [0, 0.55, 0.13, 0.06], drag: 0.92, grav: 6, collide: true, ang: a }));
    }
    const Lr = lam([], 5, 0.02, 0.045);
    const surf = (u, v) => { const a = a0 + u * (a1 - a0), vv = Lr.at(v) * (1 - tear(u)), [x, z] = rad(a, vv); return [x - 0.02 * vv, y0 - L * vv, z]; };
    const nrm = (u) => { const a = a0 + u * (a1 - a0); return [Math.cos(a), 0.1, Math.sin(a)]; };
    const cg = shell(surf, nrm, cols, Lr.rows, 0.012);
    // decode a bind-space point back to the surface parameters: angle (exact through the ellipse), column (→ its tear), depth vv
    const uvOf = (q) => { const vv = Math.max(0, Math.min(1, (y0 - q.y) / L)), rx = 0.15 + 0.03 * vv + 0.07 * smooth(0.45, 1, vv), rz = 0.29 - 0.08 * smooth(0, 0.45, vv) + 0.1 * smooth(0.45, 1, vv);
      let a = Math.atan2(q.z / rz, (q.x + 0.02 * vv) / rx); if (a < 0) a += TAU; const u = Math.max(0, Math.min(1, (a - a0) / (a1 - a0))), tr = tear(Math.round(u * cols) / cols);
      return { a, u, vv, hem: vv > (1 - 0.0225) * (1 - tr), out: Math.hypot((q.x + 0.02 * vv) / rx, q.z / rz) > 1 }; };
    const angOf = (q) => uvOf(q).a, vOf = (q) => uvOf(q).vv;
    acc.add(cg, M4(), {
      part: 'jinbaori',
      colorFn: (q) => { const o = uvOf(q); return o.hem ? SEAM : o.out ? pal.jinbaori : pal.lining; },
      glowFn: (q) => (uvOf(q).hem ? 0.75 : 0),
      weights: (q) => {
        const a = angOf(q), t = vOf(q); let i = angs.findIndex((x) => x > a); let w;
        if (i <= 0) w = [[ids[i === 0 ? 0 : nCh - 1], 1]]; else { const k = (a - angs[i - 1]) / (angs[i] - angs[i - 1]); w = [[ids[i - 1], 1 - k], [ids[i], k]]; }
        const out = []; for (const [ch, wa] of w) for (const [b, wb] of chainW(ch, t)) out.push([b, wa * wb]);
        if (t < 0.3) { const s = 1 - t / 0.3; for (const q2 of out) q2[1] *= 1 - s; out.push([B.chest, s]); }
        return out;
      },
    });
    // kamon on the back: a red neon ring crossed by a blade (flat, on the rigid upper part of the surcoat)
    const km = new THREE.RingGeometry(0.058, 0.074, 14, 1); km.rotateY(-Math.PI / 2);
    const bar = new THREE.PlaneGeometry(0.016, 0.2); bar.rotateY(-Math.PI / 2);
    for (const g of [km, bar]) acc.add(g, T(-0.168, 1.29, 0), { part: 'jinbaori', color: SEAM, glow: 0.7, weights: W1(B.chest), line: 0 });
  }

  return { faceTex: maskAtlas(), sheath, dispose() {} };
}
