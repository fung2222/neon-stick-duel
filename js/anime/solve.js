// Allocation-free port of the HQ rig's solve() (js/rig/core.js) for the anime renderer: same maths, same results
// (tests/anime.test.mjs compares both on every form), but writes into a preallocated joint record so the per-frame
// update (body + up to 24 sub-frame trail samples) allocates nothing.
import { SK, LIMITS } from '../rig/core.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const A3 = () => new Float64Array(3);
const JKEYS = ['pelvis', 'lumbar', 'neckB', 'neckT', 'head', 'shF', 'shB', 'hipF', 'hipB', 'kneeF', 'ankleF', 'kneeB', 'ankleB', 'elbowF', 'handF', 'elbowB', 'handB', 'bladeDir', 'base', 'tip', 'grip', 'hilt'];
/** a joint record (same fields as core.solve's result) */
export function makeJ() {
  const J = { roll: 0.5, aC: 0.5, headAng: 0.5, drop: 0.5, bends: { kF: 0.5, kB: 0.5, eF: 0.5, eB: 0.5 } };
  for (const k of JKEYS) J[k] = A3();
  J._t = { P0: A3(), lumbar: A3(), neckB: A3(), neckT: A3(), head: A3(), shC: A3(), hC: A3(), shF: A3(), shB: A3(), hipF: A3(), hipB: A3(), grip: A3(), bd: A3(), hilt: A3(), oT: A3(), fF: A3(), fB: A3(), ik: { jx: 0.5, jy: 0.5, ex: 0.5, ey: 0.5, bend: 0.5 } };
  return J;
}
const RV = new Float64Array(5);   // roll pivot x, y, sin, cos, roll (typed array: module-level doubles would be re-boxed on every write)
function R(q, o) { if (RV[4]) { const x = q[0] - RV[0], y = q[1] - RV[1]; o[0] = RV[0] + x * RV[3] - y * RV[2]; o[1] = RV[1] + x * RV[2] + y * RV[3]; } else { o[0] = q[0]; o[1] = q[1]; } o[2] = q[2]; return o; }
const DROPK = ['pelvis', 'lumbar', 'neckB', 'neckT', 'head', 'shF', 'shB', 'hipF', 'hipB'];
const segEnd = (p, ang, len, o) => { o[0] = p[0] + Math.sin(ang) * len; o[1] = p[1] + Math.cos(ang) * len; o[2] = p[2]; return o; };
function ik2(rx, ry, tx, ty, a, b, bend, lim, o) {
  const dx = tx - rx, dy = ty - ry;
  let d = Math.sqrt(dx * dx + dy * dy) || 1e-5; const ux = dx / d, uy = dy / d;
  const maxD = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(lim[0])), minD = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(lim[1]));
  const soft = maxD * 0.96;
  if (d > soft) { const x = d - soft, w = maxD - soft; d = soft + w * (1 - Math.exp(-x / w)); }
  d = clamp(d, minD + 1e-5, maxD);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), A = Math.acos(cosA) * (bend >= 0 ? 1 : -1);
  const ja = Math.atan2(uy, ux) + A;
  o.jx = rx + Math.cos(ja) * a; o.jy = ry + Math.sin(ja) * a; o.ex = rx + ux * d; o.ey = ry + uy * d;
  const cosB = clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1); o.bend = Math.PI - Math.acos(cosB);
  return o;
}
/** solve pose p into J (from makeJ()); opts.plantF / plantB as in core.solve */
export function solveInto(p, plantF, plantB, J) {
  const T = J._t, roll = -(p.rr || 0);
  const P0 = T.P0; P0[0] = p.px; P0[1] = p.py; P0[2] = 0;
  const aP = clamp(p.pt, -0.6, 0.8), aL = aP + clamp(p.sp, LIMITS.spine[0], LIMITS.spine[1]), aC = aL + clamp(p.ch, -0.8, 0.8);
  segEnd(P0, aL * 0.6 + aP * 0.4, SK.lumbar, T.lumbar); segEnd(T.lumbar, aC, SK.chest, T.neckB);
  const headAng = aC + clamp(p.hd, LIMITS.head[0], LIMITS.head[1]);
  segEnd(T.neckB, aC * 0.65 + headAng * 0.35, SK.neck, T.neckT); segEnd(T.neckT, headAng, SK.headUp, T.head);
  const tw = p.tw, ctw = p.tw + p.ctw;
  const shC = segEnd(T.neckB, aC + Math.PI, SK.shoulderDrop, T.shC);
  T.shF[0] = shC[0] + Math.sin(ctw) * SK.shoulderW; T.shF[1] = shC[1]; T.shF[2] = Math.cos(ctw) * SK.shoulderW;
  T.shB[0] = shC[0] - Math.sin(ctw) * SK.shoulderW; T.shB[1] = shC[1]; T.shB[2] = -Math.cos(ctw) * SK.shoulderW;
  const hC = segEnd(P0, aP + Math.PI, SK.hipDrop, T.hC);
  T.hipF[0] = hC[0] + Math.sin(tw) * SK.hipW; T.hipF[1] = hC[1]; T.hipF[2] = Math.cos(tw) * SK.hipW;
  T.hipB[0] = hC[0] - Math.sin(tw) * SK.hipW; T.hipB[1] = hC[1]; T.hipB[2] = -Math.cos(tw) * SK.hipW;
  const g = T.grip; g[0] = p.gx; g[1] = p.gy; g[2] = T.shF[2] * 0.55;
  const bd = T.bd; bd[0] = Math.cos(p.ga) * Math.cos(p.gw); bd[1] = Math.sin(p.ga); bd[2] = Math.cos(p.ga) * Math.sin(p.gw);
  const hl = T.hilt; hl[0] = g[0] - bd[0] * 0.13; hl[1] = g[1] - bd[1] * 0.13; hl[2] = g[2] - bd[2] * 0.13;
  const oT = T.oT; oT[0] = p.ox + (hl[0] - p.ox) * p.oh; oT[1] = p.oy + (hl[1] - p.oy) * p.oh; oT[2] = T.shB[2] * (1 - p.oh) + hl[2] * p.oh;
  RV[0] = P0[0]; RV[1] = P0[1] + 0.12; RV[2] = Math.sin(roll); RV[3] = Math.cos(roll); RV[4] = roll;
  R(P0, J.pelvis); R(T.lumbar, J.lumbar); R(T.neckB, J.neckB); R(T.neckT, J.neckT); R(T.head, J.head); R(T.shF, J.shF); R(T.shB, J.shB); R(T.hipF, J.hipF); R(T.hipB, J.hipB);
  R(g, J.grip); R(hl, J.hilt); const oTR = R(oT, T.oT);
  const bdR = J.bladeDir; if (roll) { bdR[0] = bd[0] * RV[3] - bd[1] * RV[2]; bdR[1] = bd[0] * RV[2] + bd[1] * RV[3]; bdR[2] = bd[2]; } else { bdR[0] = bd[0]; bdR[1] = bd[1]; bdR[2] = bd[2]; }
  let fF, fB;
  if (plantF) fF = plantF; else { T.fF[0] = p.fFx; T.fF[1] = p.fFy; T.fF[2] = T.hipF[2]; fF = R(T.fF, T.fF); }
  if (plantB) fB = plantB; else { T.fB[0] = p.fBx; T.fB[1] = p.fBy; T.fB[2] = T.hipB[2]; fB = R(T.fB, T.fB); }
  let drop = 0; const maxL = (SK.th + SK.sh) * 0.975;
  for (let s = 0; s < 2; s++) {
    const h = s ? J.hipB : J.hipF, f = s ? fB : fF, planted = s ? !!plantB : !!plantF;
    if (!(planted || (f[1] <= SK.ankle + 0.012 && Math.abs(roll) < 0.05))) continue;
    const dx = f[0] - h[0]; if (Math.abs(dx) < maxL) { const hy = f[1] + Math.sqrt(maxL * maxL - dx * dx); if (h[1] > hy) drop = Math.max(drop, h[1] - hy); }
  }
  if (drop > 0) { drop = Math.min(drop, 0.35); for (let i = 0; i < DROPK.length; i++) J[DROPK[i]][1] -= drop; }
  const o = T.ik;
  ik2(J.hipF[0], J.hipF[1], fF[0], fF[1], SK.th, SK.sh, 1, LIMITS.knee, o); J.kneeF[0] = o.jx; J.kneeF[1] = o.jy; J.kneeF[2] = J.hipF[2]; J.ankleF[0] = o.ex; J.ankleF[1] = o.ey; J.ankleF[2] = J.hipF[2]; J.bends.kF = o.bend;
  ik2(J.hipB[0], J.hipB[1], fB[0], fB[1], SK.th, SK.sh, 1, LIMITS.knee, o); J.kneeB[0] = o.jx; J.kneeB[1] = o.jy; J.kneeB[2] = J.hipB[2]; J.ankleB[0] = o.ex; J.ankleB[1] = o.ey; J.ankleB[2] = J.hipB[2]; J.bends.kB = o.bend;
  const gR = J.grip;
  ik2(J.shF[0], J.shF[1], gR[0], gR[1], SK.ua, SK.fa, -1, LIMITS.elbow, o); J.elbowF[0] = o.jx; J.elbowF[1] = o.jy; J.elbowF[2] = (J.shF[2] + gR[2]) / 2; J.handF[0] = o.ex; J.handF[1] = o.ey; J.handF[2] = gR[2]; J.bends.eF = o.bend;
  ik2(J.shB[0], J.shB[1], oTR[0], oTR[1], SK.ua, SK.fa, -1, LIMITS.elbow, o); J.elbowB[0] = o.jx; J.elbowB[1] = o.jy; J.elbowB[2] = (J.shB[2] + oTR[2]) / 2; J.handB[0] = o.ex; J.handB[1] = o.ey; J.handB[2] = oTR[2]; J.bends.eB = o.bend;
  const hd = J.handF;
  for (let i = 0; i < 3; i++) { J.base[i] = hd[i] + bdR[i] * SK.bladeBase; J.tip[i] = hd[i] + bdR[i] * SK.blade; }
  J.roll = roll; J.aC = aC; J.headAng = headAng; J.drop = drop;
  return J;
}
