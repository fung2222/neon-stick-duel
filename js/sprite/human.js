// Option 3 — human-shaped neon SpriteFighter (procedural 2D canvas → billboard).
// All 4 kits: freer pose dialects (blade / loose mage / street brawler / fluid assassin).
// Not stickmen, not animal mascots — human proportions + class outfits.
import * as THREE from 'three';
import { CLASSES } from '../classes.js';
import { SPRITE_CLASSES, hasSprite, spriteMeta } from './meta.js';
export { SPRITE_CLASSES, hasSprite, spriteMeta };

const CW = 384, CH = 384;
const ORIGIN = { x: 192, y: 308 };
const PX = 95;

const hexCss = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

/** Freer per-class pose dialects from sim state. */
function poseOf(f, walkPhase, breath) {
  const C = CLASSES[f.cls] || CLASSES.sword;
  const dialect = (SPRITE_CLASSES[f.cls] || {}).style || 'blade';
  const st = f.st, m = f.mk ? C.moves[f.mk] : null;
  // defaults — relaxed human idle (not a martial chamber)
  let lean = 0.04 + breath * 0.02, head = -0.02 + breath * 0.015;
  let uaF = 0.25, faF = 0.45, uaB = -0.2, faB = 0.5;
  let thF = 0.08, shF = 0.1, thB = -0.12, shB = 0.1;
  let weap = -0.4, hair = breath * 0.08, cloak = breath * 0.06, roll = 0, guard = false;
  let handOpen = dialect === 'loose' ? 0.7 : 0.15;

  // dialect idle flavour
  if (dialect === 'loose') { uaF = 0.35; faF = 0.7; uaB = 0.15; faB = 0.85; weap = 0.2; lean = -0.02 + breath * 0.04; handOpen = 0.85; }
  if (dialect === 'street') { uaF = 0.7; faF = 0.9; uaB = 0.55; faB = 0.85; thF = 0.25; thB = -0.2; lean = 0.08; weap = 0; }
  if (dialect === 'fluid') { uaF = 0.4; faF = 0.55; uaB = -0.35; faB = 0.4; lean = -0.06; weap = -0.8; cloak = 0.15 + breath * 0.1; }

  if (st === 'walk') {
    const k = Math.sin(walkPhase);
    thF = 0.5 * k; shF = 0.32 * k; thB = -0.5 * k; shB = -0.32 * k;
    if (dialect === 'loose') {
      uaF = 0.5 + 0.2 * Math.sin(walkPhase * 0.5); uaB = 0.3 - 0.2 * Math.sin(walkPhase * 0.5);
      faF = 0.9; handOpen = 0.9; lean = 0.06 * Math.sign(f.vx * f.facing || 1);
    } else if (dialect === 'street') {
      uaF = 0.75 - 0.25 * k; uaB = 0.55 + 0.25 * k; lean = 0.12 * Math.sign(f.vx * f.facing || 1);
    } else if (dialect === 'fluid') {
      uaF = 0.35 - 0.4 * k; uaB = -0.2 + 0.35 * k; lean = 0.05 * Math.sign(f.vx * f.facing || 1); cloak = 0.25 + 0.15 * k;
    } else {
      uaF = 0.35 - 0.3 * k; uaB = -0.25 + 0.3 * k; lean = 0.08 * Math.sign(f.vx * f.facing || 1);
    }
  } else if (st === 'guard' || st === 'block') {
    guard = true;
    if (dialect === 'loose') { uaF = 0.9; faF = 1.1; uaB = 0.7; faB = 1.0; handOpen = 0.5; lean = -0.1; }
    else if (dialect === 'street') { uaF = 1.25; faF = 1.1; uaB = 1.1; faB = 1.0; thF = 0.4; thB = -0.3; }
    else if (dialect === 'fluid') { uaF = 1.0; faF = 0.7; uaB = 0.85; faB = 0.6; weap = 0.6; lean = -0.12; }
    else { uaF = 1.1; faF = 0.85; uaB = 0.9; faB = 0.8; weap = 0.7; lean = -0.08; thF = 0.3; thB = -0.22; }
  } else if (st === 'jump') {
    if (f.djT < 0.42) {
      roll = -Math.PI * 2 * Math.min(1, f.djT / 0.42);
      thF = 1.3; thB = 1.15; uaF = -0.7; uaB = 0.7;
    } else if (f.vy > 0.5) {
      thF = -0.35; thB = 0.5; uaF = dialect === 'loose' ? -0.3 : -0.55; uaB = 0.65;
      if (dialect === 'loose') { handOpen = 1; faF = 0.3; }
    } else {
      thF = 0.65; thB = -0.15; uaF = 0.85; uaB = -0.4;
    }
  } else if (st === 'dodge') {
    roll = -Math.sign(f.dodgeDir * f.facing || 1) * Math.PI * 2 * Math.min(1, f.t / 0.3);
    thF = 1.15; thB = 0.95; uaF = -0.35; uaB = 0.35; cloak = 0.4;
  } else if (st === 'hit') {
    lean = -0.4; uaF = -0.35; uaB = -0.65; thF = 0.45; thB = -0.25; head = 0.3; weap = -1.1; hair = 0.35;
  } else if (st === 'air') {
    lean = -0.18; thF = 0.75; thB = 0.35; uaF = -0.45; uaB = 0.55; weap = -0.7;
  } else if (st === 'down' || (st === 'ko' && f.y < 0.3)) {
    lean = 1.3; thF = 0.15; thB = -0.08; uaF = 0.25; uaB = -0.35; weap = 0.15; head = 0.35;
  } else if (st === 'rise') {
    lean = 0.5; thF = 0.85; thB = 0.35; uaF = 0.15; uaB = -0.25; weap = -0.5;
  } else if (st === 'stun') {
    lean = -0.12; head = 0.18; uaF = 0.2; uaB = -0.25; hair = 0.4;
  } else if (st === 'win') {
    if (dialect === 'loose') { uaF = -0.5; faF = 0.2; uaB = 0.4; handOpen = 1; lean = -0.08; weap = 0.3; }
    else if (dialect === 'street') { uaF = -0.3; faF = 0.2; uaB = 0.9; lean = 0.05; }
    else if (dialect === 'fluid') { uaF = 0.2; weap = -2.2; lean = -0.1; cloak = 0.35; }
    else { uaF = -0.15; faF = 0.15; weap = -2.35; lean = -0.04; }
  } else if (st === 'atk' && m) {
    const [su, ac] = m.t, tt = f.t, phase = tt < su ? 0 : tt < su + ac ? 1 : 2;
    const atk = applyAttack(dialect, f.mk, phase);
    lean = atk.lean; head = atk.head; uaF = atk.uaF; faF = atk.faF; uaB = atk.uaB; faB = atk.faB;
    thF = atk.thF; shF = atk.shF; thB = atk.thB; shB = atk.shB; weap = atk.weap;
    handOpen = atk.handOpen; hair = atk.hair; cloak = atk.cloak; roll = atk.roll || 0;
  }

  return { lean, head, uaF, faF, uaB, faB, thF, shF, thB, shB, weap, hair, cloak, roll, guard, handOpen, dialect };
}

function applyAttack(dialect, mk, phase) {
  const p = { lean: 0.05, head: 0, uaF: 0.4, faF: 0.4, uaB: -0.2, faB: 0.5, thF: 0.1, shF: 0.1, thB: -0.1, shB: 0.1, weap: -0.4, handOpen: 0.2, hair: 0.1, cloak: 0.1, roll: 0 };

  if (dialect === 'loose') {
    // Mage — floaty, open-hand casts, not chambered punches
    p.handOpen = 0.95;
    if (mk === 'a1' || mk === 'a2' || mk === 'air1' || mk === 'air2') {
      if (phase === 0) { p.uaF = -0.4; p.faF = 0.3; p.uaB = 0.5; p.lean = -0.08; p.weap = 0.4; }
      else if (phase === 1) { p.uaF = 1.2; p.faF = 0.15; p.uaB = 0.6; p.lean = 0.12; p.weap = 0.1; p.hair = 0.25; }
      else { p.uaF = 0.9; p.faF = 0.5; p.lean = 0.05; }
    } else if (mk === 'a3' || mk === 's2' || mk === 'ult') {
      if (phase === 0) { p.uaF = 0.6; p.faF = 1.0; p.uaB = 0.6; p.faB = 1.0; p.lean = -0.15; p.handOpen = 1; }
      else if (phase === 1) { p.uaF = -0.7; p.faF = 0.2; p.uaB = -0.5; p.lean = 0.2; p.hair = 0.45; p.cloak = 0.4; }
      else { p.uaF = 0.3; p.uaB = 0.3; p.lean = 0.05; }
    } else if (mk === 's1') { // blink — collapse then open
      if (phase === 0) { p.uaF = 0.8; p.uaB = 0.8; p.lean = 0.2; p.cloak = 0.5; }
      else if (phase === 1) { p.uaF = -0.5; p.uaB = -0.4; p.lean = -0.1; p.hair = 0.5; }
      else { p.uaF = 0.4; p.uaB = 0.3; }
    } else {
      if (phase === 0) { p.uaF = -0.3; p.faF = 0.5; } else if (phase === 1) { p.uaF = 1.1; p.lean = 0.15; } else { p.uaF = 0.7; }
    }
    return p;
  }

  if (dialect === 'street') {
    // Brawler — freer street boxing, not deep horse-stance kung-fu
    if (mk === 'a1') {
      if (phase === 0) { p.uaF = 0.9; p.faF = 1.2; p.uaB = 0.7; p.thF = 0.2; }
      else if (phase === 1) { p.uaF = 1.55; p.faF = 0.1; p.lean = 0.25; p.thF = -0.25; p.thB = 0.35; }
      else { p.uaF = 1.1; p.faF = 0.5; p.lean = 0.1; }
    } else if (mk === 'a2') {
      if (phase === 0) { p.uaB = 0.9; p.faB = 1.15; p.uaF = 0.7; }
      else if (phase === 1) { p.uaB = 1.5; p.faB = 0.1; p.lean = 0.28; p.thB = -0.2; }
      else { p.uaB = 1.0; p.lean = 0.1; }
    } else if (mk === 'a3' || mk === 'a4') {
      if (phase === 0) { p.uaF = 0.5; p.faF = 1.1; p.thF = 0.55; p.lean = 0.1; }
      else if (phase === 1) { p.uaF = -0.6; p.faF = 0.3; p.lean = -0.2; p.thF = -0.15; p.hair = 0.3; }
      else { p.uaF = 0.3; p.lean = 0; }
    } else if (mk === 's1') {
      if (phase === 0) { p.uaF = 1.0; p.lean = -0.15; p.thF = 0.5; }
      else if (phase === 1) { p.uaF = 1.6; p.faF = 0.05; p.lean = 0.4; p.thF = -0.4; }
      else { p.uaF = 1.0; p.lean = 0.15; }
    } else if (mk === 's2' || mk === 'ult') {
      if (phase === 0) { p.uaF = 0.4; p.uaB = 0.4; p.thF = 0.7; p.lean = 0.2; }
      else if (phase === 1) { p.uaF = -0.8; p.uaB = -0.6; p.lean = -0.15; p.thF = 0.2; p.hair = 0.4; }
      else { p.uaF = 0.5; p.uaB = 0.5; }
    } else if (mk === 'air1' || mk === 'air2') {
      if (phase === 0) { p.uaF = -0.4; p.thF = 0.8; } else if (phase === 1) { p.uaF = 1.3; p.lean = 0.2; } else { p.uaF = 0.8; }
    } else {
      if (phase === 0) { p.uaF = 0.8; } else if (phase === 1) { p.uaF = 1.4; p.lean = 0.2; } else { p.uaF = 0.9; }
    }
    return p;
  }

  if (dialect === 'fluid') {
    // Assassin — whippy, sneaky, low
    p.cloak = 0.25;
    if (mk === 'a1' || mk === 'a2') {
      if (phase === 0) { p.uaF = -0.3; p.weap = -1.6; p.lean = -0.15; p.thF = 0.35; }
      else if (phase === 1) { p.uaF = 1.4; p.weap = 0.2; p.lean = 0.22; p.thF = -0.2; p.cloak = 0.4; }
      else { p.uaF = 1.0; p.weap = 0.4; }
    } else if (mk === 'a3') {
      if (phase === 0) { p.thF = 0.9; p.uaF = 0.5; p.lean = 0.1; }
      else if (phase === 1) { p.thF = -0.2; p.uaF = 0.3; p.lean = 0.25; p.hair = 0.3; }
      else { p.thF = 0.3; }
    } else if (mk === 'a4' || mk === 'ult') {
      if (phase === 0) { p.uaF = 0.5; p.weap = 1.2; p.lean = 0.1; }
      else if (phase === 1) { p.uaF = -0.7; p.weap = -2.4; p.lean = -0.2; p.roll = phase === 1 ? 0.4 : 0; p.cloak = 0.5; }
      else { p.uaF = -0.2; p.weap = -1.8; }
    } else if (mk === 's1') {
      if (phase === 0) { p.uaF = 0.9; p.lean = 0.25; p.thF = 0.4; p.cloak = 0.45; }
      else if (phase === 1) { p.uaF = 1.2; p.weap = 0.3; p.lean = -0.15; }
      else { p.uaF = 0.6; }
    } else if (mk === 's2') {
      if (phase === 0) { p.uaF = -0.4; p.lean = -0.2; p.cloak = 0.55; }
      else if (phase === 1) { p.uaF = 1.5; p.weap = 0.1; p.lean = 0.3; p.hair = 0.4; }
      else { p.uaF = 0.9; p.lean = 0.1; }
    } else {
      if (phase === 0) { p.uaF = -0.25; p.weap = -1.4; } else if (phase === 1) { p.uaF = 1.25; p.weap = 0.15; p.lean = 0.18; } else { p.uaF = 0.85; }
    }
    return p;
  }

  // blade — flowing swordplay (human coatsman), not rigid kenjutsu chamber
  if (mk === 'a1' || mk === 'air1') {
    if (phase === 0) { p.uaF = -0.35; p.faF = 0.25; p.weap = -1.8; p.lean = -0.1; p.thF = 0.25; p.cloak = 0.2; }
    else if (phase === 1) { p.uaF = 1.3; p.faF = 0.2; p.weap = 0.2; p.lean = 0.2; p.thF = -0.15; p.thB = 0.3; p.hair = 0.2; p.cloak = 0.35; }
    else { p.uaF = 1.0; p.faF = 0.4; p.weap = 0.45; p.lean = 0.08; }
  } else if (mk === 'a2') {
    if (phase === 0) { p.uaF = 1.25; p.weap = 0.7; p.lean = 0.08; }
    else if (phase === 1) { p.uaF = -0.25; p.weap = -2.0; p.lean = -0.16; p.thB = 0.35; p.cloak = 0.3; }
    else { p.uaF = 0.25; p.weap = -1.3; }
  } else if (mk === 'a3' || mk === 's1') {
    if (phase === 0) { p.uaF = -0.15; p.faF = 0.85; p.weap = -0.35; p.lean = -0.18; p.thF = 0.5; }
    else if (phase === 1) { p.uaF = 1.5; p.faF = 0.08; p.weap = 0.08; p.lean = 0.32; p.thF = -0.3; p.thB = 0.45; p.cloak = 0.4; }
    else { p.uaF = 1.15; p.weap = 0.25; p.lean = 0.12; }
  } else if (mk === 'a4' || mk === 's2' || mk === 'air2') {
    if (phase === 0) { p.uaF = 0.35; p.faF = 0.95; p.weap = 1.45; p.lean = 0.12; p.thF = 0.6; }
    else if (phase === 1) { p.uaF = -0.85; p.weap = -2.45; p.lean = -0.22; p.thF = -0.25; p.hair = 0.35; p.cloak = 0.45; }
    else { p.uaF = -0.35; p.weap = -1.9; p.lean = -0.08; }
  } else if (mk === 'ult') {
    const spin = phase === 1 ? 1.2 : phase === 0 ? 0.3 : 0.6;
    p.uaF = 1.1 + spin * 0.3; p.weap = spin * 0.8; p.lean = 0.12; p.roll = spin * 0.2; p.cloak = 0.5; p.hair = 0.3;
    p.thF = 0.25; p.thB = -0.25;
  } else {
    if (phase === 0) { p.uaF = -0.25; p.weap = -1.5; } else if (phase === 1) { p.uaF = 1.25; p.weap = 0.2; p.lean = 0.18; } else { p.uaF = 0.85; p.weap = 0.35; }
  }
  return p;
}

function limb(ctx, x, y, ang, len, w, color, glow) {
  const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
  ctx.save();
  ctx.strokeStyle = glow; ctx.lineWidth = w + 3; ctx.lineCap = 'round'; ctx.globalAlpha = 0.16;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
  return { x: x2, y: y2 };
}

function drawHuman(ctx, pose, meta, flash, inv, t, cls) {
  ctx.clearRect(0, 0, CW, CH);
  const fill = hexCss(meta.color), trim = hexCss(meta.trim), accent = hexCss(meta.accent || meta.trim);
  const glow = fill;
  const o = ORIGIN;

  ctx.save();
  ctx.translate(o.x, o.y);
  if (pose.roll) ctx.rotate(pose.roll);
  ctx.globalAlpha = inv;

  // soft ground contact (dim — avoid blob wash)
  ctx.save();
  ctx.globalAlpha = 0.14 * inv;
  const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, 48);
  rg.addColorStop(0, glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, 2, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const hipX = pose.lean * 10, hipY = -14;
  const shX = hipX + pose.lean * 32, shY = hipY - 78;

  // ---- legs (clear thigh / shin / boot)
  const kF = limb(ctx, hipX + 11, hipY, pose.thF, 46, 12, fill, glow);
  const fF = limb(ctx, kF.x, kF.y, pose.thF + pose.shF, 42, 10, fill, glow);
  const kB = limb(ctx, hipX - 11, hipY, pose.thB, 46, 11, trim, glow);
  const fB = limb(ctx, kB.x, kB.y, pose.thB + pose.shB, 42, 9, trim, glow);
  // knees
  for (const k of [kF, kB]) {
    ctx.fillStyle = '#0b0e18'; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(k.x, k.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // boots
  ctx.fillStyle = '#070910'; ctx.strokeStyle = accent; ctx.lineWidth = 2;
  for (const ft of [{ p: fF, a: pose.thF + pose.shF }, { p: fB, a: pose.thB + pose.shB }]) {
    ctx.save();
    ctx.translate(ft.p.x, ft.p.y);
    ctx.rotate(ft.a);
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(18, 2); ctx.lineTo(18, 8); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---- coat / cape / scarf (behind torso)
  if (cls === 'sword' || cls === 'assassin' || cls === 'mage') {
    ctx.save();
    const sway = Math.sin(t * 2.4) * 6 + pose.cloak * 28;
    ctx.globalAlpha = 0.55 * inv;
    ctx.fillStyle = trim; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hipX - 8, hipY - 55);
    ctx.quadraticCurveTo(hipX - 28 - sway * 0.4, hipY - 20, hipX - 22 - sway * 0.2, hipY + 8);
    ctx.lineTo(hipX + 6, hipY + 4);
    ctx.quadraticCurveTo(hipX - 4, hipY - 30, hipX - 2, hipY - 58);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (cls === 'mage') {
      // robe hem flare
      ctx.beginPath();
      ctx.moveTo(hipX - 18, hipY - 10);
      ctx.quadraticCurveTo(hipX - 40 - sway * 0.3, hipY + 20, hipX + 30 + sway * 0.2, hipY + 18);
      ctx.lineTo(hipX + 14, hipY - 12);
      ctx.closePath(); ctx.globalAlpha = 0.4 * inv; ctx.fill();
    }
    ctx.restore();
  }

  // ---- pelvis
  ctx.fillStyle = trim; ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(hipX, hipY - 4, 20, 12, pose.lean * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // ---- torso (shoulders wider than waist — human)
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(pose.lean);
  const body = ctx.createLinearGradient(0, -8, 0, -78);
  body.addColorStop(0, trim); body.addColorStop(0.5, fill); body.addColorStop(1, '#eefcff');
  ctx.fillStyle = body; ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath();
  // waist → chest → shoulders trapezoid-ish
  ctx.moveTo(-14, -8); ctx.lineTo(-22, -50); ctx.lineTo(-26, -72); ctx.lineTo(26, -72);
  ctx.lineTo(22, -50); ctx.lineTo(14, -8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // belt
  ctx.strokeStyle = accent; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.stroke();
  // collar / neck hole
  ctx.fillStyle = '#0a0c14';
  ctx.beginPath(); ctx.ellipse(0, -72, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // shoulder pads
  ctx.fillStyle = fill; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(shX - 22, shY + 2, 10, 7, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(shX + 22, shY + 2, 10, 7, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // ---- back arm
  const eB = limb(ctx, shX - 18, shY + 6, pose.uaB, 36, 9, trim, glow);
  const hB = limb(ctx, eB.x, eB.y, pose.uaB + pose.faB, 34, 8, trim, glow);
  ctx.fillStyle = '#0b0e18'; ctx.strokeStyle = accent; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(eB.x, eB.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawHand(ctx, hB.x, hB.y, pose.uaB + pose.faB, pose.handOpen, trim, glow, inv);

  // ---- neck + head
  const hx = shX + pose.lean * 6, hy = shY - 28 + pose.head * 10;
  ctx.strokeStyle = fill; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shX, shY - 6); ctx.lineTo(hx, hy + 16); ctx.stroke();

  ctx.save();
  ctx.translate(hx, hy);
  // hair / hood / band / mask BEFORE face so face reads on top
  if (cls === 'mage') {
    ctx.fillStyle = trim; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-20, 2); ctx.quadraticCurveTo(-24, -28, 0, -36 - pose.hair * 8);
    ctx.quadraticCurveTo(24, -28, 20, 2); ctx.lineTo(12, -4); ctx.quadraticCurveTo(0, -18, -12, -4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // tip
    ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(2, -52); ctx.lineTo(10, -28); ctx.fill();
  } else if (cls === 'brawler') {
    ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -2, 22, -2.6, -0.5); ctx.stroke();
    // ribbon ends
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -8); ctx.quadraticCurveTo(-30, 10 + pose.hair * 10, -22, 24); ctx.stroke();
  } else if (cls === 'assassin') {
    ctx.fillStyle = '#06140f'; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 2, 20, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    // sword short hair
    ctx.fillStyle = trim;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-16, -26 - pose.hair * 10, 6, -24);
    ctx.lineTo(16, -8); ctx.lineTo(14, 4); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill();
  }
  // skull
  ctx.fillStyle = fill; ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // jaw
  ctx.beginPath(); ctx.ellipse(0, 10, 12, 8, 0, 0.1, Math.PI - 0.1); ctx.fill();
  // face
  if (cls === 'assassin') {
    ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 8;
    ctx.fillRect(-11, -3, 22, 3.5);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#060a12';
    ctx.beginPath(); ctx.ellipse(-6, -2, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -2, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.ellipse(-6, -1.5, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -1.5, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // small mouth
    ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, 9); ctx.quadraticCurveTo(0, 11, 4, 9); ctx.stroke();
  }
  ctx.restore();

  // ---- front arm
  const eF = limb(ctx, shX + 18, shY + 4, pose.uaF, 38, 10, fill, glow);
  const hF = limb(ctx, eF.x, eF.y, pose.uaF + pose.faF, 36, 9, fill, glow);
  ctx.fillStyle = '#0b0e18'; ctx.strokeStyle = accent; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(eF.x, eF.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawHand(ctx, hF.x, hF.y, pose.uaF + pose.faF, pose.handOpen, fill, glow, inv);

  const bang = pose.uaF + pose.faF + pose.weap;
  let tipX = hF.x, tipY = hF.y, baseX = hF.x, baseY = hF.y;
  if (cls === 'sword' || cls === 'assassin') {
    const len = cls === 'assassin' ? 68 : 112;
    baseX = hF.x + Math.sin(bang) * 12;
    baseY = hF.y - Math.cos(bang) * 12;
    tipX = hF.x + Math.sin(bang) * len;
    tipY = hF.y - Math.cos(bang) * len;
    ctx.save();
    ctx.strokeStyle = glow; ctx.lineWidth = cls === 'assassin' ? 7 : 10; ctx.lineCap = 'round'; ctx.globalAlpha = 0.22 * inv;
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.globalAlpha = inv; ctx.strokeStyle = '#f7ffff'; ctx.lineWidth = cls === 'assassin' ? 3 : 4.5;
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
    if (cls === 'sword') {
      const gx = Math.cos(bang) * 11, gy = Math.sin(bang) * 11;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(baseX - gx, baseY - gy); ctx.lineTo(baseX + gx, baseY + gy); ctx.stroke();
    }
    if (cls === 'assassin') {
      const bang2 = pose.uaB + pose.faB - 0.4;
      const t2x = hB.x + Math.sin(bang2) * 52, t2y = hB.y - Math.cos(bang2) * 52;
      ctx.strokeStyle = '#f7ffff'; ctx.lineWidth = 2.5; ctx.globalAlpha = inv;
      ctx.beginPath(); ctx.moveTo(hB.x, hB.y); ctx.lineTo(t2x, t2y); ctx.stroke();
    }
    ctx.restore();
  } else if (cls === 'brawler') {
    tipX = hF.x + Math.sin(pose.uaF + pose.faF) * 14;
    tipY = hF.y - Math.cos(pose.uaF + pose.faF) * 14;
    baseX = hF.x; baseY = hF.y;
    ctx.save();
    ctx.fillStyle = accent; ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.shadowColor = accent; ctx.shadowBlur = 10;
    for (const [hx2, hy2] of [[tipX, tipY], [hB.x + Math.sin(pose.uaB + pose.faB) * 12, hB.y - Math.cos(pose.uaB + pose.faB) * 12]]) {
      ctx.beginPath();
      const x0 = hx2 - 10, y0 = hy2 - 10, r = 5;
      ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + 20, y0, x0 + 20, y0 + 20, r); ctx.arcTo(x0 + 20, y0 + 20, x0, y0 + 20, r);
      ctx.arcTo(x0, y0 + 20, x0, y0, r); ctx.arcTo(x0, y0, x0 + 20, y0, r); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.restore();
  } else if (cls === 'mage') {
    tipX = hF.x + Math.sin(pose.uaF + pose.faF) * 30;
    tipY = hF.y - Math.cos(pose.uaF + pose.faF) * 30;
    baseX = hF.x; baseY = hF.y;
    ctx.save();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.9 * inv;
    const r = 14 + Math.sin(t * 5) * 2;
    ctx.beginPath(); ctx.arc(tipX, tipY, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX - r, tipY); ctx.lineTo(tipX + r, tipY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX, tipY - r); ctx.lineTo(tipX, tipY + r); ctx.stroke();
    ctx.fillStyle = glow; ctx.globalAlpha = 0.3 * inv;
    ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (pose.guard) {
    ctx.save();
    ctx.translate(shX + 48, shY + 6);
    ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 * inv;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 34, y = Math.sin(a) * 34;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.45, flash * 4) * inv;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-CW, -CH, CW * 2, CH * 2);
    ctx.restore();
  }

  ctx.restore();
  return {
    tip: { x: tipX, y: tipY },
    base: { x: baseX, y: baseY },
    hand: { x: hF.x, y: hF.y },
    head: { x: hx, y: hy },
  };
}

function drawHand(ctx, x, y, ang, open, color, glow, inv) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = inv;
  ctx.fillStyle = color; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
  if (open > 0.5) {
    // open palm
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 4, -4); ctx.lineTo(i * 5, -14); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export class SpriteFighter {
  constructor(scene) {
    this.scene = scene;
    this.canvas = document.createElement('canvas');
    this.canvas.width = CW; this.canvas.height = CH;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const h = CH / PX, w = CW / PX;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.mesh.frustumCulled = false;
    this.group = new THREE.Group(); this.group.add(this.mesh);
    this.mesh.position.y = h * (1 - ORIGIN.y / CH);
    scene.add(this.group);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.72, 40),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
        toneMapped: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring);

    this.joints = {}; this.cls = null; this.vis = true; this.flashT = 0;
    this.walkPhase = 0; this.scaleK = 1; this.meta = SPRITE_CLASSES.sword;
    this._lastAtk = ''; this.anchors = null;
  }

  setClass(clsId, color = null, scale = 1) {
    const C = CLASSES[clsId] || CLASSES.sword;
    const meta = SPRITE_CLASSES[clsId] || SPRITE_CLASSES.sword;
    this.cls = clsId; this.C = C; this.scaleK = scale;
    this.meta = { ...meta, color: color ?? meta.color };
    this.ring.material.color.set(this.meta.color);
    this.group.scale.setScalar(1.12 * scale);
    this._lastAtk = '';
  }

  flash() { this.flashT = 0.12; }
  set visible(v) {
    this.vis = v; this.group.visible = v; this.shadow.visible = v;
    if (!v) this.ring.visible = false;
  }
  get visible() { return this.vis; }
  resetAnim() { this.walkPhase = 0; this._lastAtk = ''; }

  takeSwingCue(f) {
    if (f.st !== 'atk' || !f.mk || f.mk === this._lastAtk) return null;
    const m = this.C?.moves[f.mk]; if (!m) return null;
    if (f.t < m.t[0] * 0.55) return null;
    this._lastAtk = f.mk;
    return { kind: m.kind || 'basic', mk: f.mk };
  }
  takeFx() { return null; }
  onHit() { this.flash(); }
  stats() { return { rig: 'sprite', cls: this.cls, tris: 2, calls: 1 }; }

  update(f, dt, t, baseY, frozen = false, shake = 0) {
    if (!this.C) return;
    f._spriteT = (f._spriteT || 0) + (frozen ? 0 : dt);
    const breath = Math.sin((f._spriteT || 0) * 2.2);
    if (!frozen && f.st === 'walk') {
      this.walkPhase += dt * 9 * (Math.abs(f.vx) / (this.C.walk || 3) + 0.2) * Math.sign(f.vx * f.facing || 1);
    }
    if (f.st !== 'atk') this._lastAtk = '';

    const pose = poseOf(f, this.walkPhase, breath);
    this.flashT = Math.max(0, this.flashT - dt);
    const inv = (f.inv > 0 && f.st !== 'dodge' && f.st !== 'down') ? 0.55 + Math.sin(t * 40) * 0.35 : 1;
    this.anchors = drawHuman(this.ctx, pose, this.meta, this.flashT, inv, t, this.cls);
    this.tex.needsUpdate = true;

    const face = f.facing >= 0 ? 1 : -1;
    const sk = 1.12 * this.scaleK;
    this.group.position.set(f.x + (shake ? (Math.random() - 0.5) * shake : 0), baseY + f.y, 0);
    this.group.scale.set(sk * face, sk, sk);

    const toWorld = (ax, ay) => {
      const lx = (ax / PX) * face;
      const ly = -ay / PX;
      return new THREE.Vector3(f.x + lx * sk, baseY + f.y + ly * sk, 0.15);
    };
    const a = this.anchors;
    this.joints = {
      tip: toWorld(a.tip.x, a.tip.y),
      base: toWorld(a.base.x, a.base.y),
      handF: toWorld(a.hand.x, a.hand.y),
      head: toWorld(a.head.x, a.head.y),
    };

    this.shadow.position.set(f.x, baseY + 0.015, 0);
    const sc = Math.max(0.3, 1 - f.y * 0.22) * sk;
    this.shadow.scale.set(sc, sc, 1);

    const ready = f.ult >= 100 && f.st !== 'ko';
    this.ring.visible = ready && this.vis;
    this.ring.position.set(f.x, baseY + 0.03, 0);
    this.ring.material.opacity = 0.4 + Math.sin(t * 6) * 0.2;
    this.ring.scale.setScalar(sk * (1 + Math.sin(t * 6) * 0.05));
  }
}

// Back-compat alias used by older imports
export { SpriteFighter as FoxSpriteFighter };
