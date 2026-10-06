// Geometry helpers for the anime character builder: a skinned-geometry accumulator (merges every body part into ONE
// SkinnedMesh with per-vertex colour, emissive trim, outline width and up to 4 bone weights) and seam-free primitives
// (closed tubes with elliptical rings, closed shells for cloth panels, spikes) so the inverted-hull outline never cracks.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _l = new THREE.Vector3(), _nm = new THREE.Matrix3(), _c = new THREE.Color();
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class SkinAcc {
  /** skinHex: vertices whose colour is this hex get the warm skin shadow (aSkin = 1) in the toon shader */
  constructor(skinHex = null) { this.P = []; this.N = []; this.C = []; this.G = []; this.L = []; this.SI = []; this.SW = []; this.I = []; this.H = []; this.K = []; this.A = []; this.n = 0; this.parts = {}; this.yr = {}; this.skinHex = skinHex; }
  /** add a geometry. M: local → bind (rig) space. o.color (hex) | o.colorFn(local, bind) → hex; o.glow | o.glowFn;
   *  o.weights(bind, local) → [[bone, w], …]; o.line (outline width factor); o.keep(centroidLocal) → false drops a triangle;
   *  o.ao | o.aoFn(local, bind) → baked occlusion (pushes the toon ramp toward shadow: under the chin, …) */
  add(geo, M, o) {
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const pos = geo.attributes.position, nor = geo.attributes.normal, cnt = pos.count, base = this.n;
    _nm.getNormalMatrix(M);
    for (let i = 0; i < cnt; i++) {
      _l.fromBufferAttribute(pos, i); _v.copy(_l).applyMatrix4(M); _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
      this.P.push(_v.x, _v.y, _v.z); this.N.push(_n.x, _n.y, _n.z);
      { const pk = o.part || 'misc', r = this.yr[pk] || (this.yr[pk] = [Infinity, -Infinity]); r[0] = Math.min(r[0], _v.y); r[1] = Math.max(r[1], _v.y); }   // bind-space height range per part (proportion report)
      const hex = o.colorFn ? o.colorFn(_l, _v, i) : o.color; _c.set(hex); this.C.push(_c.r, _c.g, _c.b);
      this.K.push(o.skin ?? (this.skinHex != null && hex === this.skinHex ? 1 : 0)); this.A.push(o.aoFn ? o.aoFn(_l, _v) : (o.ao || 0));
      this.G.push(o.glowFn ? o.glowFn(_l, _v, i) : (o.glow || 0)); this.L.push(o.lineFn ? o.lineFn(_l, _v) : (o.line ?? 1)); this.H.push(o.shine || 0);
      let w = o.weights(_v, _l).filter((q) => q[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const s = w.reduce((a, q) => a + q[1], 0) || 1;
      for (let k = 0; k < 4; k++) { this.SI.push(w[k] ? w[k][0] : 0); this.SW.push(w[k] ? w[k][1] / s : 0); }
    }
    const idx = geo.index ? geo.index.array : [...Array(cnt).keys()], T = [], P = this.P;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (o.keep) { _l.set(0, 0, 0); for (const q of [a, b, c]) { _v.fromBufferAttribute(pos, q); _l.add(_v); } _l.multiplyScalar(1 / 3); if (!o.keep(_l)) continue; }
      T.push(a, b, c);
    }
    // Orientation fix: tubes built top → down (limbs, neck, boots) and mirrored matrices come out wound INSIDE-OUT, which
    // turned their inverted-hull outline into an inner hull (no outline on arms/legs). Closed parts with negative signed
    // volume get their winding and normals flipped so every part faces outward. Open sheets (|vol| ~ 0) are left alone.
    let vol = 0;
    for (let t = 0; t < T.length; t += 3) {
      const a = (base + T[t]) * 3, b = (base + T[t + 1]) * 3, c = (base + T[t + 2]) * 3;
      const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b] - ax, by = P[b + 1] - ay, bz = P[b + 2] - az, cx = P[c] - ax, cy = P[c + 1] - ay, cz = P[c + 2] - az;
      const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
      vol += (ax - P[base * 3]) * nx + (ay - P[base * 3 + 1]) * ny + (az - P[base * 3 + 2]) * nz;
    }
    const flip = o.flip ?? vol < -1e-9;
    if (flip) for (let i = base * 3; i < (base + cnt) * 3; i++) this.N[i] = -this.N[i];
    for (let t = 0; t < T.length; t += 3) {
      if (flip) this.I.push(base + T[t], base + T[t + 2], base + T[t + 1]); else this.I.push(base + T[t], base + T[t + 1], base + T[t + 2]);
      const pk = o.part || 'misc'; this.parts[pk] = (this.parts[pk] || 0) + 1;
    }
    if (flip) { const pk = o.part || 'misc'; (this.flipped || (this.flipped = {}))[pk] = ((this.flipped || {})[pk] || 0) + 1; }
    this.n += cnt;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.G, 1));
    g.setAttribute('aLine', new THREE.Float32BufferAttribute(this.L, 1));
    g.setAttribute('aShine', new THREE.Float32BufferAttribute(this.H, 1));
    g.setAttribute('aSkin', new THREE.Float32BufferAttribute(this.K, 1));
    g.setAttribute('aAO', new THREE.Float32BufferAttribute(this.A, 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** closed tube along +Y, no seam: rings [{ y, rx, rz, x?, z? }] (rx = depth along X, rz = width along Z); poles at both ends.
 *  The first/last ring may have r = 0 (it becomes the pole). R radial segments. */
export function tube(rings, R = 12) {
  const P = [], I = [];
  const first = rings[0], last = rings[rings.length - 1];
  const body = rings.filter((r, i) => !((i === 0 || i === rings.length - 1) && r.rx === 0));
  const topPole = last.rx === 0, botPole = first.rx === 0;
  if (botPole) P.push(first.x || 0, first.y, first.z || 0);
  const off = P.length / 3;
  for (const r of body) for (let j = 0; j < R; j++) { const a = (j / R) * Math.PI * 2; P.push((r.x || 0) + Math.cos(a) * r.rx, r.y, (r.z || 0) + Math.sin(a) * r.rz); }
  if (topPole) P.push(last.x || 0, last.y, last.z || 0);
  const ringV = (k, j) => off + k * R + (j % R);
  for (let k = 0; k < body.length - 1; k++) for (let j = 0; j < R; j++) { const a = ringV(k, j), b = ringV(k, j + 1), c = ringV(k + 1, j), d = ringV(k + 1, j + 1); I.push(a, c, b, b, c, d); }
  if (botPole) for (let j = 0; j < R; j++) I.push(0, ringV(0, j), ringV(0, j + 1));
  if (topPole) { const p = P.length / 3 - 1, k = body.length - 1; for (let j = 0; j < R; j++) I.push(p, ringV(k, j + 1), ringV(k, j)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  return g;
}

/** closed thin shell over a parametric surface f(u, v) → [x, y, z] with outward normal side given by `nf(u, v)` → [nx, ny, nz];
 *  thickness th. cols × rows samples. Outer + inner faces + edge strips, all smooth per face group. */
export function shell(f, nf, cols, rows, th = 0.012) {
  const P = [], I = [];
  const at = (side, i, j) => side * (cols + 1) * (rows + 1) + j * (cols + 1) + i;
  for (const side of [0, 1]) for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const u = i / cols, v = j / rows, p = f(u, v), n = nf(u, v), s = side ? -th / 2 : th / 2; P.push(p[0] + n[0] * s, p[1] + n[1] * s, p[2] + n[2] * s);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = at(0, i, j), b = at(0, i + 1, j), c = at(0, i, j + 1), d = at(0, i + 1, j + 1); I.push(a, c, b, b, c, d);
    const a2 = at(1, i, j), b2 = at(1, i + 1, j), c2 = at(1, i, j + 1), d2 = at(1, i + 1, j + 1); I.push(a2, b2, c2, b2, d2, c2);
  }
  // edge strips (hem, top, sides) so the panel is closed
  for (let i = 0; i < cols; i++) for (const j of [0, rows]) { const a = at(0, i, j), b = at(0, i + 1, j), c = at(1, i, j), d = at(1, i + 1, j); if (j) I.push(a, b, c, b, d, c); else I.push(a, c, b, b, c, d); }
  for (let j = 0; j < rows; j++) for (const i of [0, cols]) { const a = at(0, i, j), b = at(0, i, j + 1), c = at(1, i, j), d = at(1, i, j + 1); if (i) I.push(a, c, b, b, c, d); else I.push(a, b, c, b, d, c); }
  // winding: outer faces must face nf → flip every triangle if the sampled orientation disagrees
  const p0 = f(0.5, 0.5), pu = f(0.5 + 1e-3, 0.5), pv = f(0.5, 0.5 + 1e-3), n0 = nf(0.5, 0.5);
  const du = [pu[0] - p0[0], pu[1] - p0[1], pu[2] - p0[2]], dv = [pv[0] - p0[0], pv[1] - p0[1], pv[2] - p0[2]];
  const cr = [dv[1] * du[2] - dv[2] * du[1], dv[2] * du[0] - dv[0] * du[2], dv[0] * du[1] - dv[1] * du[0]];
  if (cr[0] * n0[0] + cr[1] * n0[1] + cr[2] * n0[2] < 0) for (let t = 0; t < I.length; t += 3) { const q = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = q; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  return g;
}

/** a spike / hair strand: flattened pyramid from the origin along +Y, length L, base half-widths w (X) and d (Z), `sides` faces */
export function spike(L, w, d, sides = 4, bend = 0) {
  const rings = [{ y: -0.01, rx: 0 }, { y: 0, rx: w, rz: d }, { y: L * 0.45, rx: w * 0.75, rz: d * 0.8, x: bend * 0.3 }, { y: L, rx: 0, x: bend }];
  return tube(rings, sides);
}

/** closed loft along +Y with shaped cross-sections (anime body volumes): rings [{ y, f, b, w, n?, wb?, x?, z? }]
 *  f / b = depth toward +X (front) / −X (back), w = half-width along Z (wb = half-width on the −Z side, default w),
 *  n = superellipse exponent (2 = ellipse, > 2 = squarer shoulders / chest). Ring with f = 0 at either end = pole.
 *  Same vertex layout as tube(), so skin weights / colour functions work the same way. */
export function loft(rings, R = 16) {
  const P = [], I = [];
  const first = rings[0], last = rings[rings.length - 1];
  const isPole = (r) => !r.f && !r.b && !r.w;
  const body = rings.filter((r, i) => !((i === 0 || i === rings.length - 1) && isPole(r)));
  const topPole = isPole(last), botPole = isPole(first);
  if (botPole) P.push(first.x || 0, first.y, first.z || 0);
  const off = P.length / 3, sg = (v, e) => Math.sign(v) * Math.abs(v) ** e;
  for (const r of body) {
    const e = 2 / (r.n || 2);
    for (let j = 0; j < R; j++) { const a = (j / R) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); P.push((r.x || 0) + sg(c, e) * (c >= 0 ? r.f : r.b), r.y, (r.z || 0) + sg(sn, e) * (sn >= 0 ? r.w : (r.wb ?? r.w))); }
  }
  if (topPole) P.push(last.x || 0, last.y, last.z || 0);
  const ringV = (k, j) => off + k * R + (j % R);
  for (let k = 0; k < body.length - 1; k++) for (let j = 0; j < R; j++) { const a = ringV(k, j), b = ringV(k, j + 1), c = ringV(k + 1, j), d = ringV(k + 1, j + 1); I.push(a, c, b, b, c, d); }
  if (botPole) for (let j = 0; j < R; j++) I.push(0, ringV(0, j), ringV(0, j + 1));
  if (topPole) { const p = P.length / 3 - 1, k = body.length - 1; for (let j = 0; j < R; j++) I.push(p, ringV(k, j + 1), ringV(k, j)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
