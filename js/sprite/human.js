// Neon humanoid SpriteFighter — procedural 2D canvas → billboard.
// Mini Street Fighter / KOF readability: big windup → clear active → settle.
// Cast: sword / mage / brawler / assassin / shogun (boss).
import * as THREE from 'three';
import { CLASSES } from '../classes.js';
import { SPRITE_CLASSES, hasSprite, spriteMeta } from './meta.js';
export { SPRITE_CLASSES, hasSprite, spriteMeta };

const CW = 384, CH = 384;
const ORIGIN = { x: 192, y: 308 };
const PX = 95;

const hexCss = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

/** Freer per-class pose dialects from sim state — exaggerated for SF readability. */
function poseOf(f, walkPhase, breath) {
  const C = CLASSES[f.cls] || CLASSES.sword;
  const dialect = (SPRITE_CLASSES[f.cls] || {}).style || 'blade';
  const st = f.st, m = f.mk ? C.moves[f.mk] : null;
  let lean = 0.04 + breath * 0.02, head = -0.02 + breath * 0.015;
  let uaF = 0.25, faF = 0.45, uaB = -0.2, faB = 0.5;
  let thF = 0.08, shF = 0.1, thB = -0.12, shB = 0.1;
  let weap = -0.4, hair = breath * 0.08, cloak = breath * 0.06, roll = 0, guard = false;
  let handOpen = dialect === 'loose' ? 0.7 : 0.15;
  let streak = 0; // 0..1 motion arc strength during active frames

  if (dialect === 'loose') { uaF = 0.35; faF = 0.7; uaB = 0.15; faB = 0.85; weap = 0.2; lean = -0.02 + breath * 0.04; handOpen = 0.85; }
  if (dialect === 'street') { uaF = 0.7; faF = 0.9; uaB = 0.55; faB = 0.85; thF = 0.25; thB = -0.2; lean = 0.08; weap = 0; }
  if (dialect === 'fluid') { uaF = 0.4; faF = 0.55; uaB = -0.35; faB = 0.4; lean = -0.06; weap = -0.8; cloak = 0.15 + breath * 0.1; }
  if (dialect === 'oni') { uaF = 0.55; faF = 0.35; uaB = -0.15; faB = 0.4; thF = 0.2; thB = -0.18; lean = 0.06; weap = -0.55; }

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
    } else if (dialect === 'oni') {
      uaF = 0.5 - 0.2 * k; uaB = -0.1 + 0.2 * k; lean = 0.1 * Math.sign(f.vx * f.facing || 1); weap = -0.7;
    } else {
      uaF = 0.35 - 0.3 * k; uaB = -0.25 + 0.3 * k; lean = 0.08 * Math.sign(f.vx * f.facing || 1);
    }
  } else if (st === 'guard' || st === 'block') {
    guard = true;
    if (dialect === 'loose') { uaF = 0.9; faF = 1.1; uaB = 0.7; faB = 1.0; handOpen = 0.5; lean = -0.1; }
    else if (dialect === 'street') { uaF = 1.25; faF = 1.1; uaB = 1.1; faB = 1.0; thF = 0.4; thB = -0.3; }
    else if (dialect === 'fluid') { uaF = 1.0; faF = 0.7; uaB = 0.85; faB = 0.6; weap = 0.6; lean = -0.12; }
    else if (dialect === 'oni') { uaF = 1.15; faF = 0.7; uaB = 0.95; faB = 0.65; weap = 0.5; lean = -0.1; thF = 0.35; thB = -0.28; }
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
    lean = -0.45; uaF = -0.4; uaB = -0.7; thF = 0.5; thB = -0.3; head = 0.35; weap = -1.2; hair = 0.4;
  } else if (st === 'air') {
    // launched — limbs spread, readable juggle silhouette
    lean = -0.22; thF = 0.95; thB = 0.45; uaF = -0.55; uaB = 0.7; weap = -0.85; hair = 0.35; head = 0.2;
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
    else if (dialect === 'oni') { uaF = -0.2; weap = -2.1; lean = -0.05; }
    else { uaF = -0.15; faF = 0.15; weap = -2.35; lean = -0.04; }
  } else if (st === 'atk' && m) {
    const [su, ac] = m.t, tt = f.t;
    const phase = tt < su ? 0 : tt < su + ac ? 1 : 2;
    const atk = applyAttack(dialect, f.mk, phase);
    lean = atk.lean; head = atk.head; uaF = atk.uaF; faF = atk.faF; uaB = atk.uaB; faB = atk.faB;
    thF = atk.thF; shF = atk.shF; thB = atk.thB; shB = atk.shB; weap = atk.weap;
    handOpen = atk.handOpen; hair = atk.hair; cloak = atk.cloak; roll = atk.roll || 0;
    streak = phase === 1 ? 1 : phase === 0 ? 0.25 : 0.05;
  } else if (st === 'phase') {
    lean = -0.15; uaF = -0.6; uaB = -0.5; weap = -2.0; hair = 0.5; cloak = 0.5; thF = 0.4; thB = -0.3;
  }

  return { lean, head, uaF, faF, uaB, faB, thF, shF, thB, shB, weap, hair, cloak, roll, guard, handOpen, dialect, streak };
}

function applyAttack(dialect, mk, phase) {
  const p = { lean: 0.05, head: 0, uaF: 0.4, faF: 0.4, uaB: -0.2, faB: 0.5, thF: 0.1, shF: 0.1, thB: -0.1, shB: 0.1, weap: -0.4, handOpen: 0.2, hair: 0.1, cloak: 0.1, roll: 0 };

  if (dialect === 'loose') {
    p.handOpen = 0.95;
    if (mk === 'a1' || mk === 'a2' || mk === 'air1' || mk === 'air2') {
      if (phase === 0) { p.uaF = -0.55; p.faF = 0.25; p.uaB = 0.55; p.lean = -0.12; p.weap = 0.5; }
      else if (phase === 1) { p.uaF = 1.45; p.faF = 0.08; p.uaB = 0.65; p.lean = 0.18; p.weap = 0.05; p.hair = 0.35; p.thF = -0.2; }
      else { p.uaF = 0.95; p.faF = 0.45; p.lean = 0.06; }
    } else if (mk === 'a3' || mk === 's2' || mk === 'ult') {
      if (phase === 0) { p.uaF = 0.7; p.faF = 1.15; p.uaB = 0.7; p.faB = 1.1; p.lean = -0.2; p.handOpen = 1; }
      else if (phase === 1) { p.uaF = -0.85; p.faF = 0.15; p.uaB = -0.6; p.lean = 0.28; p.hair = 0.5; p.cloak = 0.5; }
      else { p.uaF = 0.35; p.uaB = 0.35; p.lean = 0.05; }
    } else if (mk === 's1') {
      if (phase === 0) { p.uaF = 0.9; p.uaB = 0.9; p.lean = 0.25; p.cloak = 0.55; }
      else if (phase === 1) { p.uaF = -0.55; p.uaB = -0.45; p.lean = -0.12; p.hair = 0.55; }
      else { p.uaF = 0.4; p.uaB = 0.3; }
    } else {
      if (phase === 0) { p.uaF = -0.4; p.faF = 0.45; } else if (phase === 1) { p.uaF = 1.25; p.lean = 0.18; } else { p.uaF = 0.75; }
    }
    return p;
  }

  if (dialect === 'street') {
    if (mk === 'a1') {
      if (phase === 0) { p.uaF = 1.05; p.faF = 1.35; p.uaB = 0.75; p.thF = 0.25; p.lean = -0.08; }
      else if (phase === 1) { p.uaF = 1.7; p.faF = 0.05; p.lean = 0.32; p.thF = -0.35; p.thB = 0.4; p.hair = 0.25; }
      else { p.uaF = 1.15; p.faF = 0.45; p.lean = 0.1; }
    } else if (mk === 'a2') {
      if (phase === 0) { p.uaB = 1.05; p.faB = 1.3; p.uaF = 0.75; p.lean = -0.06; }
      else if (phase === 1) { p.uaB = 1.65; p.faB = 0.05; p.lean = 0.34; p.thB = -0.25; p.hair = 0.25; }
      else { p.uaB = 1.05; p.lean = 0.1; }
    } else if (mk === 'a3' || mk === 'a4') {
      if (phase === 0) { p.uaF = 0.55; p.faF = 1.2; p.thF = 0.65; p.lean = 0.12; }
      else if (phase === 1) { p.uaF = -0.75; p.faF = 0.25; p.lean = -0.28; p.thF = -0.2; p.hair = 0.4; }
      else { p.uaF = 0.35; p.lean = 0; }
    } else if (mk === 's1') {
      if (phase === 0) { p.uaF = 1.1; p.lean = -0.2; p.thF = 0.55; }
      else if (phase === 1) { p.uaF = 1.75; p.faF = 0.02; p.lean = 0.48; p.thF = -0.45; p.hair = 0.35; }
      else { p.uaF = 1.05; p.lean = 0.18; }
    } else if (mk === 's2' || mk === 'ult') {
      if (phase === 0) { p.uaF = 0.45; p.uaB = 0.45; p.thF = 0.8; p.lean = 0.25; }
      else if (phase === 1) { p.uaF = -0.9; p.uaB = -0.7; p.lean = -0.2; p.thF = 0.25; p.hair = 0.45; }
      else { p.uaF = 0.55; p.uaB = 0.55; }
    } else if (mk === 'air1' || mk === 'air2') {
      if (phase === 0) { p.uaF = -0.5; p.thF = 0.9; } else if (phase === 1) { p.uaF = 1.45; p.lean = 0.25; } else { p.uaF = 0.85; }
    } else {
      if (phase === 0) { p.uaF = 0.9; } else if (phase === 1) { p.uaF = 1.55; p.lean = 0.25; } else { p.uaF = 0.95; }
    }
    return p;
  }

  if (dialect === 'fluid') {
    p.cloak = 0.25;
    if (mk === 'a1' || mk === 'a2') {
      if (phase === 0) { p.uaF = -0.45; p.weap = -1.85; p.lean = -0.2; p.thF = 0.4; }
      else if (phase === 1) { p.uaF = 1.55; p.weap = 0.25; p.lean = 0.28; p.thF = -0.25; p.cloak = 0.5; p.hair = 0.3; }
      else { p.uaF = 1.05; p.weap = 0.45; }
    } else if (mk === 'a3') {
      if (phase === 0) { p.thF = 1.05; p.uaF = 0.55; p.lean = 0.12; }
      else if (phase === 1) { p.thF = -0.3; p.uaF = 0.35; p.lean = 0.32; p.hair = 0.35; }
      else { p.thF = 0.35; }
    } else if (mk === 'a4' || mk === 'ult') {
      if (phase === 0) { p.uaF = 0.55; p.weap = 1.35; p.lean = 0.12; }
      else if (phase === 1) { p.uaF = -0.85; p.weap = -2.55; p.lean = -0.25; p.cloak = 0.55; p.hair = 0.4; p.roll = 0.35; }
      else { p.uaF = -0.25; p.weap = -1.9; }
    } else if (mk === 's1') {
      if (phase === 0) { p.uaF = 1.0; p.lean = 0.3; p.thF = 0.45; p.cloak = 0.5; }
      else if (phase === 1) { p.uaF = 1.3; p.weap = 0.35; p.lean = -0.18; }
      else { p.uaF = 0.65; }
    } else if (mk === 's2') {
      if (phase === 0) { p.uaF = -0.5; p.lean = -0.25; p.cloak = 0.6; }
      else if (phase === 1) { p.uaF = 1.6; p.weap = 0.15; p.lean = 0.35; p.hair = 0.45; }
      else { p.uaF = 0.95; p.lean = 0.1; }
    } else {
      if (phase === 0) { p.uaF = -0.35; p.weap = -1.55; } else if (phase === 1) { p.uaF = 1.35; p.weap = 0.2; p.lean = 0.22; } else { p.uaF = 0.9; }
    }
    return p;
  }

  if (dialect === 'oni') {
    // Boss — tall chamber, long nodachi arcs
    if (mk === 'a1' || mk === 'a2' || mk === 'ten1' || mk === 'ten2') {
      if (phase === 0) { p.uaF = -0.5; p.weap = -2.0; p.lean = -0.15; p.thF = 0.3; }
      else if (phase === 1) { p.uaF = 1.45; p.weap = 0.15; p.lean = 0.28; p.thF = -0.2; p.hair = 0.3; }
      else { p.uaF = 1.05; p.weap = 0.4; }
    } else if (mk === 'a3' || mk === 'ten3' || mk === 'mcut') {
      if (phase === 0) { p.uaF = 0.4; p.weap = 1.5; p.lean = 0.15; p.thF = 0.55; }
      else if (phase === 1) { p.uaF = -0.9; p.weap = -2.5; p.lean = -0.25; p.hair = 0.4; }
      else { p.uaF = -0.3; p.weap = -1.8; }
    } else if (mk === 'iai' || mk === 'ult' || mk === 'ultEnd') {
      if (phase === 0) { p.uaF = -0.7; p.weap = -2.3; p.lean = -0.2; p.thF = 0.4; }
      else if (phase === 1) { p.uaF = 1.6; p.weap = 0.3; p.lean = 0.35; p.roll = 0.25; p.hair = 0.5; }
      else { p.uaF = 1.1; p.weap = 0.5; }
    } else if (mk === 'mirror') {
      p.uaF = 1.2; p.faF = 0.7; p.uaB = 1.0; p.weap = 0.6; p.lean = -0.12; p.thF = 0.35;
    } else if (mk === 'rain' || mk === 'glitch') {
      if (phase === 0) { p.uaF = -0.4; p.lean = 0.2; p.cloak = 0.5; }
      else if (phase === 1) { p.uaF = 1.4; p.weap = 0.2; p.lean = 0.3; p.hair = 0.45; }
      else { p.uaF = 0.8; }
    } else {
      if (phase === 0) { p.uaF = -0.4; p.weap = -1.8; } else if (phase === 1) { p.uaF = 1.4; p.weap = 0.2; p.lean = 0.25; } else { p.uaF = 0.95; }
    }
    return p;
  }

  // blade — flowing swordplay
  if (mk === 'a1' || mk === 'air1') {
    if (phase === 0) { p.uaF = -0.5; p.faF = 0.2; p.weap = -2.05; p.lean = -0.15; p.thF = 0.3; p.cloak = 0.25; }
    else if (phase === 1) { p.uaF = 1.45; p.faF = 0.12; p.weap = 0.25; p.lean = 0.26; p.thF = -0.2; p.thB = 0.35; p.hair = 0.28; p.cloak = 0.4; }
    else { p.uaF = 1.05; p.faF = 0.35; p.weap = 0.5; p.lean = 0.1; }
  } else if (mk === 'a2') {
    if (phase === 0) { p.uaF = 1.4; p.weap = 0.85; p.lean = 0.1; }
    else if (phase === 1) { p.uaF = -0.35; p.weap = -2.2; p.lean = -0.2; p.thB = 0.4; p.cloak = 0.35; p.hair = 0.25; }
    else { p.uaF = 0.3; p.weap = -1.4; }
  } else if (mk === 'a3' || mk === 's1') {
    if (phase === 0) { p.uaF = -0.25; p.faF = 0.95; p.weap = -0.45; p.lean = -0.22; p.thF = 0.55; }
    else if (phase === 1) { p.uaF = 1.65; p.faF = 0.05; p.weap = 0.1; p.lean = 0.38; p.thF = -0.35; p.thB = 0.5; p.cloak = 0.45; p.hair = 0.3; }
    else { p.uaF = 1.2; p.weap = 0.3; p.lean = 0.14; }
  } else if (mk === 'a4' || mk === 's2' || mk === 'air2') {
    // launcher / rising — clear upward silhouette
    if (phase === 0) { p.uaF = 0.4; p.faF = 1.05; p.weap = 1.6; p.lean = 0.15; p.thF = 0.7; }
    else if (phase === 1) { p.uaF = -0.95; p.weap = -2.6; p.lean = -0.28; p.thF = -0.3; p.hair = 0.4; p.cloak = 0.5; }
    else { p.uaF = -0.4; p.weap = -2.0; p.lean = -0.1; }
  } else if (mk === 'ult') {
    const spin = phase === 1 ? 1.35 : phase === 0 ? 0.35 : 0.65;
    p.uaF = 1.15 + spin * 0.3; p.weap = spin * 0.85; p.lean = 0.14; p.roll = spin * 0.22; p.cloak = 0.55; p.hair = 0.35;
    p.thF = 0.3; p.thB = -0.3;
  } else {
    if (phase === 0) { p.uaF = -0.35; p.weap = -1.7; } else if (phase === 1) { p.uaF = 1.35; p.weap = 0.25; p.lean = 0.22; } else { p.uaF = 0.9; p.weap = 0.4; }
  }
  return p;
}

function limb(ctx, x, y, ang, len, w, color, glow) {
  const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
  ctx.save();
  ctx.strokeStyle = glow; ctx.lineWidth = w + 3; ctx.lineCap = 'round'; ctx.globalAlpha = 0.18;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
  return { x: x2, y: y2 };
}

function drawStreak(ctx, baseX, baseY, tipX, tipY, color, glow, strength, inv) {
  if (strength < 0.08) return;
  ctx.save();
  const mx = (baseX + tipX) / 2, my = (baseY + tipY) / 2;
  const dx = tipX - baseX, dy = tipY - baseY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const fan = 22 + 28 * strength;
  ctx.globalAlpha = 0.22 * strength * inv;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(mx + nx * fan, my + ny * fan, tipX, tipY);
  ctx.quadraticCurveTo(mx + nx * fan * 0.3, my + ny * fan * 0.3, baseX, baseY);
  ctx.fill();
  ctx.globalAlpha = 0.55 * strength * inv;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX + nx * 4, baseY + ny * 4);
  ctx.quadraticCurveTo(mx + nx * fan * 0.7, my + ny * fan * 0.7, tipX, tipY);
  ctx.stroke();
  // impact hash near tip (SF-style “whoosh” ticks)
  ctx.globalAlpha = 0.7 * strength * inv;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const t = 0.65 + i * 0.12;
    const px = baseX + dx * t, py = baseY + dy * t;
    const s = 6 + i * 2;
    ctx.beginPath(); ctx.moveTo(px - nx * s, py - ny * s); ctx.lineTo(px + nx * s, py + ny * s); ctx.stroke();
  }
  ctx.restore();
}

function drawHand(ctx, x, y, ang, open, color, glow, inv) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = inv;
  ctx.fillStyle = color; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
  if (open > 0.5) {
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 4, -4); ctx.lineTo(i * 5, -14); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}


/** Tapered hard-edge armor limb (filled plate, not a neon stick). */
function plateLimb(ctx, x, y, ang, len, w0, w1, armor, edge, energy) {
  const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
  const nx = Math.cos(ang), ny = Math.sin(ang);
  ctx.save();
  // dark silhouette underlay so charcoal reads on night sky / bloom
  ctx.strokeStyle = '#05070b';
  ctx.lineWidth = Math.max(w0, w1) + 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  // soft cyan sheath (accent only — keep dim so charcoal body stays dominant)
  ctx.globalAlpha *= 0.18;
  ctx.strokeStyle = energy;
  ctx.lineWidth = Math.max(w0, w1) + 7;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha /= 0.18;
  // hard plate body — solid charcoal fill
  const g = ctx.createLinearGradient(x - nx * w0, y - ny * w0, x + nx * w0, y + ny * w0);
  g.addColorStop(0, edge);
  g.addColorStop(0.45, armor);
  g.addColorStop(1, '#8a94a4');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#0e1218';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x - nx * w0 * 0.5, y - ny * w0 * 0.5);
  ctx.lineTo(x2 - nx * w1 * 0.5, y2 - ny * w1 * 0.5);
  ctx.lineTo(x2 + nx * w1 * 0.5, y2 + ny * w1 * 0.5);
  ctx.lineTo(x + nx * w0 * 0.5, y + ny * w0 * 0.5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // thin energy panel seam (not the whole limb)
  ctx.strokeStyle = energy; ctx.lineWidth = 1.0; ctx.globalAlpha *= 0.7;
  ctx.beginPath();
  ctx.moveTo(x + Math.sin(ang) * len * 0.15, y - Math.cos(ang) * len * 0.15);
  ctx.lineTo(x + Math.sin(ang) * len * 0.85, y - Math.cos(ang) * len * 0.85);
  ctx.stroke();
  ctx.globalAlpha /= 0.7;
  // rim highlight
  ctx.strokeStyle = '#c0c8d4'; ctx.lineWidth = 1.1; ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  ctx.moveTo(x - nx * w0 * 0.42, y - ny * w0 * 0.42);
  ctx.lineTo(x2 - nx * w1 * 0.42, y2 - ny * w1 * 0.42);
  ctx.stroke();
  ctx.globalAlpha /= 0.55;
  ctx.restore();
  return { x: x2, y: y2 };
}

function cableJoint(ctx, x, y, r, energy) {
  // exposed actuator joint with cyan cable ring
  ctx.save();
  ctx.fillStyle = '#0a0c10';
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = energy; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = energy; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.stroke();
  // tiny cable stubs
  for (let i = 0; i < 3; i++) {
    const a = -0.6 + i * 0.55;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5));
    ctx.stroke();
  }
  ctx.restore();
}

function mechFoot(ctx, x, y, ang, armor, energy) {
  // ang=0 points UP; for planted shins ang≈π. Tip continues along limb + slight forward flare.
  const fx = Math.sin(ang), fy = -Math.cos(ang); // along shin
  const px = Math.cos(ang), py = Math.sin(ang);  // perpendicular
  ctx.save();
  ctx.fillStyle = armor;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = energy; ctx.shadowBlur = 4;
  // pointed digitigrade boot (split toe silhouette)
  ctx.beginPath();
  ctx.moveTo(x - px * 5 - fx * 2, y - py * 5 - fy * 2);
  ctx.lineTo(x + px * 4 - fx * 1, y + py * 4 - fy * 1);
  ctx.lineTo(x + px * 3 + fx * 14, y + py * 3 + fy * 14);
  ctx.lineTo(x + fx * 18, y + fy * 18);
  ctx.lineTo(x - px * 2 + fx * 12, y - py * 2 + fy * 12);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // sole energy rail
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - px * 1 + fx * 2, y - py * 1 + fy * 2);
  ctx.lineTo(x + fx * 15, y + fy * 15);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // ankle ring
  ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function mechHand(ctx, x, y, ang, armor, energy, inv) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = inv;
  ctx.fillStyle = armor;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = energy; ctx.shadowBlur = 5;
  // claw gauntlet
  ctx.beginPath();
  ctx.moveTo(-8, -5); ctx.lineTo(10, -7); ctx.lineTo(12, 6); ctx.lineTo(-9, 8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#080a0e';
  ctx.fillRect(-3, -2, 9, 3);
  ctx.strokeStyle = energy; ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(i * 3.5, -4); ctx.lineTo(i * 4.5, -12); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Charcoal + fluorescent cyan biomechanical combat mech (sword / SWORDSMAN).
 * Matches approved sample: tall slender ~1:7–1:8 humanoid (long legs, small head),
 * layered V-chest, sharp pauldrons, horn crest, neck cables, vertical back fins.
 * Limb ang=0 points UP; legs use ang+π so idle th≈0 plants feet on the ground.
 */
function drawSwordMech(ctx, pose, meta, flash, inv, t) {
  ctx.clearRect(0, 0, CW, CH);
  // Match approved sample: charcoal armor + cyan energy, tall slender humanoid.
  const armor = '#5a6574';
  const plate = '#2a313c';
  const energy = hexCss(meta.accent || 0x00e8ff);
  const o = ORIGIN;
  const DOWN = Math.PI; // ang=0 is UP; legs need +π to plant on ground

  ctx.save();
  ctx.translate(o.x, o.y);
  if (pose.roll) ctx.rotate(pose.roll);
  ctx.globalAlpha = inv;

  // soft ground glow
  ctx.save();
  ctx.globalAlpha = 0.14 * inv;
  const rg = ctx.createRadialGradient(0, 4, 2, 0, 4, 48);
  rg.addColorStop(0, energy); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, 6, 38, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // —— TALL SLENDER ANIME PROPORTIONS (~1:7.5) ——
  // Long legs dominate; small head; narrow waist; hips well above feet.
  // Feet ≈ y=0; hip ≈ -100; shoulder ≈ -155; head ≈ -175; horn ≈ -195.
  const hipX = pose.lean * 8, hipY = -100;
  const torsoH = 54;
  const shX = hipX + pose.lean * 18, shY = hipY - torsoH;
  const headR = 11;

  // —— BACK FINS (large vertical stabilizers, like sample) ——
  ctx.save();
  const finSway = Math.sin(t * 2.0) * 2.5 + pose.cloak * 8;
  ctx.fillStyle = plate;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.3;
  ctx.shadowColor = energy; ctx.shadowBlur = 5;
  // tall upper dorsal fin (points up/back)
  ctx.beginPath();
  ctx.moveTo(hipX - 4, shY + 8);
  ctx.lineTo(hipX - 18 - finSway * 0.3, shY - 28);
  ctx.lineTo(hipX - 28 - finSway * 0.4, shY - 8);
  ctx.lineTo(hipX - 14, shY + 18);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // secondary mid fin
  ctx.beginPath();
  ctx.moveTo(hipX - 2, shY + 22);
  ctx.lineTo(hipX - 20 - finSway * 0.2, shY + 10);
  ctx.lineTo(hipX - 24 - finSway * 0.25, shY + 36);
  ctx.lineTo(hipX - 6, shY + 40);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // thin trailing edge glow
  ctx.shadowBlur = 0;
  ctx.strokeStyle = energy; ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(hipX - 4, shY + 8); ctx.lineTo(hipX - 18 - finSway * 0.3, shY - 28);
  ctx.stroke();
  ctx.restore();

  // —— LONG LEGS (slim plate segments) ——
  const thighL = 50, shinL = 46;
  const spread = 0.20;
  // A-stance: left hip goes further left (ang=π+spread), right hip further right (ang=π-spread)
  const legAngB = pose.thB + DOWN + spread;
  const legAngF = pose.thF + DOWN - spread;
  const shinAngB = pose.thB + pose.shB + DOWN + spread * 0.35;
  const shinAngF = pose.thF + pose.shF + DOWN - spread * 0.35;

  const kB = plateLimb(ctx, hipX - 9, hipY + 2, legAngB, thighL, 11, 8, plate, armor, energy);
  const fB = plateLimb(ctx, kB.x, kB.y, shinAngB, shinL, 8.5, 6.5, armor, plate, energy);
  cableJoint(ctx, kB.x, kB.y, 3.6, energy);
  mechFoot(ctx, fB.x, fB.y, shinAngB, plate, energy);

  const kF = plateLimb(ctx, hipX + 9, hipY + 2, legAngF, thighL, 12, 8.5, armor, plate, energy);
  const fF = plateLimb(ctx, kF.x, kF.y, shinAngF, shinL, 9, 7, armor, plate, energy);
  cableJoint(ctx, kF.x, kF.y, 3.8, energy);
  mechFoot(ctx, fF.x, fF.y, shinAngF, armor, energy);

  cableJoint(ctx, hipX - 9, hipY + 2, 3.2, energy);
  cableJoint(ctx, hipX + 9, hipY + 2, 3.2, energy);

  // —— SLIM PELVIS (no hip-blob) ——
  ctx.save();
  ctx.fillStyle = plate;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(hipX - 10, hipY - 10);
  ctx.lineTo(hipX - 12, hipY + 2);
  ctx.lineTo(hipX - 4, hipY + 6);
  ctx.lineTo(hipX + 4, hipY + 6);
  ctx.lineTo(hipX + 12, hipY + 2);
  ctx.lineTo(hipX + 10, hipY - 10);
  ctx.lineTo(hipX + 4, hipY - 14);
  ctx.lineTo(hipX - 4, hipY - 14);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // belt energy line
  ctx.strokeStyle = energy; ctx.lineWidth = 1.8;
  ctx.shadowColor = energy; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(hipX - 8, hipY - 4); ctx.lineTo(hipX + 8, hipY - 4); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = energy;
  ctx.beginPath(); ctx.arc(hipX, hipY - 4, 2.0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // —— LAYERED V-CHEST TORSO → narrow waist ——
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(pose.lean);
  const tw = 7, sw = 18; // waist / shoulder half-widths (slender)
  const body = ctx.createLinearGradient(0, -4, 0, -torsoH);
  body.addColorStop(0, plate);
  body.addColorStop(0.5, armor);
  body.addColorStop(1, '#3a4250');
  ctx.fillStyle = body;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.5;
  // main torso silhouette
  ctx.beginPath();
  ctx.moveTo(-tw, -4);
  ctx.lineTo(-tw - 1, -torsoH * 0.38);
  ctx.lineTo(-sw + 3, -torsoH * 0.55);
  ctx.lineTo(-sw, -torsoH + 5);
  ctx.lineTo(-6, -torsoH);
  ctx.lineTo(6, -torsoH);
  ctx.lineTo(sw, -torsoH + 5);
  ctx.lineTo(sw - 3, -torsoH * 0.55);
  ctx.lineTo(tw + 1, -torsoH * 0.38);
  ctx.lineTo(tw, -4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // outer V chest plate (layer 1)
  ctx.fillStyle = plate;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-14, -torsoH * 0.82);
  ctx.lineTo(-16, -torsoH * 0.55);
  ctx.lineTo(0, -torsoH * 0.42);
  ctx.lineTo(16, -torsoH * 0.55);
  ctx.lineTo(14, -torsoH * 0.82);
  ctx.lineTo(0, -torsoH * 0.92);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // inner V chest plate (layer 2)
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.moveTo(-9, -torsoH * 0.78);
  ctx.lineTo(-10, -torsoH * 0.58);
  ctx.lineTo(0, -torsoH * 0.50);
  ctx.lineTo(10, -torsoH * 0.58);
  ctx.lineTo(9, -torsoH * 0.78);
  ctx.lineTo(0, -torsoH * 0.86);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // slim abs seams
  ctx.strokeStyle = energy; ctx.lineWidth = 1.0; ctx.globalAlpha = 0.8 * inv;
  ctx.strokeRect(-5.5, -torsoH * 0.34, 11, 14);
  ctx.beginPath(); ctx.moveTo(0, -torsoH * 0.34); ctx.lineTo(0, -torsoH * 0.34 + 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5.5, -torsoH * 0.34 + 7); ctx.lineTo(5.5, -torsoH * 0.34 + 7); ctx.stroke();
  ctx.globalAlpha = inv;

  // chest energy core
  ctx.fillStyle = energy;
  ctx.shadowColor = energy; ctx.shadowBlur = 11;
  ctx.beginPath(); ctx.ellipse(0, -torsoH * 0.64, 3.8, 4.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8ffff';
  ctx.beginPath(); ctx.ellipse(0, -torsoH * 0.64, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();

  // collar ring
  ctx.strokeStyle = energy; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(0, -torsoH + 3, 6.5, 2.8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // —— SHARP MULTI-LAYER PAULDRONS ——
  function pauldron(sx, sy, mirror) {
    const m = mirror ? -1 : 1;
    ctx.save();
    ctx.fillStyle = armor;
    ctx.strokeStyle = energy;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = energy; ctx.shadowBlur = 5;
    // outer sharp wing
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + m * 5, sy - 14);
    ctx.lineTo(sx + m * 24, sy - 8);
    ctx.lineTo(sx + m * 28, sy + 2);
    ctx.lineTo(sx + m * 14, sy + 10);
    ctx.lineTo(sx + m * 2, sy + 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // inner plate layer
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.moveTo(sx + m * 2, sy - 2);
    ctx.lineTo(sx + m * 6, sy - 10);
    ctx.lineTo(sx + m * 18, sy - 5);
    ctx.lineTo(sx + m * 16, sy + 4);
    ctx.lineTo(sx + m * 3, sy + 3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    // leading edge glow
    ctx.strokeStyle = energy; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + m * 5, sy - 14);
    ctx.lineTo(sx + m * 24, sy - 8);
    ctx.lineTo(sx + m * 28, sy + 2);
    ctx.stroke();
    ctx.restore();
  }
  pauldron(shX - 14, shY + 2, true);
  pauldron(shX + 14, shY + 2, false);

  // —— BACK ARM (slim, hangs forward in idle) ——
  const ARM = 1.2;
  const uaL = 38, faL = 36;
  const eB = plateLimb(ctx, shX - 12, shY + 6, pose.uaB + ARM, uaL, 9, 7, plate, armor, energy);
  const hB = plateLimb(ctx, eB.x, eB.y, pose.uaB + pose.faB + ARM, faL, 7.5, 6, armor, plate, energy);
  cableJoint(ctx, eB.x, eB.y, 3.2, energy);
  cableJoint(ctx, shX - 12, shY + 6, 2.8, energy);
  mechHand(ctx, hB.x, hB.y, pose.uaB + pose.faB + ARM, plate, energy, inv);

  // —— NECK CABLES + HEAD + HORN CREST ——
  const hx = shX + pose.lean * 3, hy = shY - 18 + pose.head * 5;
  // neck column
  ctx.fillStyle = plate;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(shX - 4, shY - 1);
  ctx.lineTo(hx - 3.2, hy + headR - 1);
  ctx.lineTo(hx + 3.2, hy + headR - 1);
  ctx.lineTo(shX + 4, shY - 1);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // ribbed cables
  ctx.strokeStyle = energy; ctx.lineWidth = 1.15;
  ctx.shadowColor = energy; ctx.shadowBlur = 3;
  for (const ox of [-2.2, 0, 2.2]) {
    ctx.beginPath();
    ctx.moveTo(shX + ox, shY - 1);
    ctx.quadraticCurveTo(hx + ox * 0.5, (shY + hy) * 0.5, hx + ox * 0.65, hy + headR - 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(pose.head * 0.35);
  // swept horn crest
  ctx.fillStyle = plate;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-2, -headR + 1);
  ctx.lineTo(-2, -headR - 14 - pose.hair * 4);
  ctx.lineTo(4, -headR - 9);
  ctx.lineTo(6, -headR + 2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = energy; ctx.lineWidth = 1.7;
  ctx.shadowColor = energy; ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(-0.5, -headR + 1);
  ctx.lineTo(-0.5, -headR - 12 - pose.hair * 4);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // sleek helmet (small, aerodynamic)
  ctx.fillStyle = armor;
  ctx.strokeStyle = energy;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-headR + 1, 3);
  ctx.lineTo(-headR, -3);
  ctx.lineTo(-headR * 0.4, -headR);
  ctx.lineTo(headR * 0.35, -headR + 1);
  ctx.lineTo(headR, -2);
  ctx.lineTo(headR - 2, 5);
  ctx.lineTo(-headR * 0.45, 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // cyan visor slit
  ctx.fillStyle = energy;
  ctx.shadowColor = energy; ctx.shadowBlur = 8;
  ctx.fillRect(-headR + 2.5, -1.5, headR * 1.5, 2.8);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8ffff';
  ctx.fillRect(-headR * 0.4, -0.8, headR * 0.85, 1.2);
  ctx.restore();

  // —— FRONT ARM + ENERGY BLADE ——
  const eF = plateLimb(ctx, shX + 12, shY + 5, pose.uaF + ARM, 40, 10, 7.5, armor, plate, energy);
  const hF = plateLimb(ctx, eF.x, eF.y, pose.uaF + pose.faF + ARM, 38, 8, 6.5, armor, plate, energy);
  cableJoint(ctx, eF.x, eF.y, 3.4, energy);
  cableJoint(ctx, shX + 12, shY + 5, 3.0, energy);
  mechHand(ctx, hF.x, hF.y, pose.uaF + pose.faF + ARM, armor, energy, inv);

  const bang = pose.uaF + pose.faF + ARM + pose.weap;
  const len = 112;
  const baseX = hF.x + Math.sin(bang) * 12;
  const baseY = hF.y - Math.cos(bang) * 12;
  const tipX = hF.x + Math.sin(bang) * len;
  const tipY = hF.y - Math.cos(bang) * len;
  drawStreak(ctx, baseX, baseY, tipX, tipY, energy, energy, pose.streak || 0, inv);
  ctx.save();
  ctx.strokeStyle = energy; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.globalAlpha = 0.2 * inv;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.globalAlpha = inv;
  ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 3.8;
  ctx.shadowColor = energy; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = energy; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
  const gx = Math.cos(bang) * 10, gy = Math.sin(bang) * 10;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(baseX - gx, baseY - gy); ctx.lineTo(baseX + gx, baseY + gy); ctx.stroke();
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.arc(baseX, baseY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = energy; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(baseX, baseY, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  if (pose.guard) {
    ctx.save();
    ctx.translate(shX + 40, shY + 8);
    ctx.strokeStyle = energy; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 * inv;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 30, y = Math.sin(a) * 30;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, flash * 5) * inv;
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

function drawHuman(ctx, pose, meta, flash, inv, t, cls, phaseLook = 1) {
  // Sword / SWORDSMAN: charcoal+cyan biomechanical mech (other kits unchanged).
  if (cls === 'sword') return drawSwordMech(ctx, pose, meta, flash, inv, t);

  ctx.clearRect(0, 0, CW, CH);
  const fill = hexCss(meta.color), trim = hexCss(meta.trim), accent = hexCss(meta.accent || meta.trim);
  const glow = fill;
  const o = ORIGIN;
  const boss = cls === 'shogun';
  const scaleY = boss ? 1.08 : 1;

  ctx.save();
  ctx.translate(o.x, o.y);
  if (pose.roll) ctx.rotate(pose.roll);
  ctx.scale(1, scaleY);
  ctx.globalAlpha = inv;

  // ground contact glow
  ctx.save();
  ctx.globalAlpha = 0.16 * inv;
  const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, boss ? 56 : 48);
  rg.addColorStop(0, glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, 2, boss ? 48 : 40, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const hipX = pose.lean * 10, hipY = -14;
  const shX = hipX + pose.lean * 32, shY = hipY - (boss ? 88 : 78);

  // legs
  const kF = limb(ctx, hipX + 11, hipY, pose.thF, boss ? 52 : 46, boss ? 14 : 12, fill, glow);
  const fF = limb(ctx, kF.x, kF.y, pose.thF + pose.shF, boss ? 46 : 42, boss ? 12 : 10, fill, glow);
  const kB = limb(ctx, hipX - 11, hipY, pose.thB, boss ? 52 : 46, boss ? 13 : 11, trim, glow);
  const fB = limb(ctx, kB.x, kB.y, pose.thB + pose.shB, boss ? 46 : 42, boss ? 11 : 9, trim, glow);
  for (const k of [kF, kB]) {
    ctx.fillStyle = '#0b0e18'; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(k.x, k.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#070910'; ctx.strokeStyle = accent; ctx.lineWidth = 2;
  for (const ft of [{ p: fF, a: pose.thF + pose.shF }, { p: fB, a: pose.thB + pose.shB }]) {
    ctx.save();
    ctx.translate(ft.p.x, ft.p.y);
    ctx.rotate(ft.a);
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(18, 2); ctx.lineTo(18, 8); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // coat / robe / scarf / oni cape
  if (cls === 'sword' || cls === 'assassin' || cls === 'mage' || boss) {
    ctx.save();
    const sway = Math.sin(t * 2.4) * 6 + pose.cloak * 28;
    ctx.globalAlpha = (boss ? 0.65 : 0.55) * inv;
    ctx.fillStyle = phaseLook >= 2 && boss ? '#3a0810' : trim;
    ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hipX - 8, hipY - 55);
    ctx.quadraticCurveTo(hipX - 28 - sway * 0.4, hipY - 20, hipX - 22 - sway * 0.2, hipY + 8);
    ctx.lineTo(hipX + 6, hipY + 4);
    ctx.quadraticCurveTo(hipX - 4, hipY - 30, hipX - 2, hipY - 58);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (cls === 'mage') {
      ctx.beginPath();
      ctx.moveTo(hipX - 18, hipY - 10);
      ctx.quadraticCurveTo(hipX - 40 - sway * 0.3, hipY + 20, hipX + 30 + sway * 0.2, hipY + 18);
      ctx.lineTo(hipX + 14, hipY - 12);
      ctx.closePath(); ctx.globalAlpha = 0.4 * inv; ctx.fill();
    }
    ctx.restore();
  }

  // pelvis + torso
  ctx.fillStyle = trim; ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(hipX, hipY - 4, boss ? 24 : 20, boss ? 14 : 12, pose.lean * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(pose.lean);
  const body = ctx.createLinearGradient(0, -8, 0, boss ? -88 : -78);
  body.addColorStop(0, trim); body.addColorStop(0.5, fill); body.addColorStop(1, phaseLook >= 2 && boss ? '#ff8090' : '#eefcff');
  ctx.fillStyle = body; ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath();
  const tw = boss ? 18 : 14, sw = boss ? 32 : 26;
  ctx.moveTo(-tw, -8); ctx.lineTo(-sw + 4, -50); ctx.lineTo(-sw, boss ? -82 : -72); ctx.lineTo(sw, boss ? -82 : -72);
  ctx.lineTo(sw - 4, -50); ctx.lineTo(tw, -8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = accent; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-tw - 1, -12); ctx.lineTo(tw + 1, -12); ctx.stroke();
  ctx.fillStyle = '#0a0c14';
  ctx.beginPath(); ctx.ellipse(0, boss ? -82 : -72, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  // boss chest plate
  if (boss) {
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.strokeRect(-14, -55, 28, 22);
    ctx.fillStyle = glow; ctx.globalAlpha = 0.35 * inv;
    ctx.fillRect(-6, -48, 12, 8);
    ctx.globalAlpha = inv;
  }
  ctx.restore();

  // shoulders
  ctx.fillStyle = fill; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(shX - (boss ? 26 : 22), shY + 2, boss ? 12 : 10, boss ? 9 : 7, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(shX + (boss ? 26 : 22), shY + 2, boss ? 12 : 10, boss ? 9 : 7, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // back arm
  const eB = limb(ctx, shX - (boss ? 22 : 18), shY + 6, pose.uaB, boss ? 40 : 36, boss ? 11 : 9, trim, glow);
  const hB = limb(ctx, eB.x, eB.y, pose.uaB + pose.faB, boss ? 38 : 34, boss ? 10 : 8, trim, glow);
  ctx.fillStyle = '#0b0e18'; ctx.strokeStyle = accent; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(eB.x, eB.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawHand(ctx, hB.x, hB.y, pose.uaB + pose.faB, pose.handOpen, trim, glow, inv);

  // head
  const hx = shX + pose.lean * 6, hy = shY - (boss ? 32 : 28) + pose.head * 10;
  ctx.strokeStyle = fill; ctx.lineWidth = boss ? 10 : 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(shX, shY - 6); ctx.lineTo(hx, hy + 16); ctx.stroke();

  ctx.save();
  ctx.translate(hx, hy);
  if (cls === 'mage') {
    ctx.fillStyle = trim; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-20, 2); ctx.quadraticCurveTo(-24, -28, 0, -36 - pose.hair * 8);
    ctx.quadraticCurveTo(24, -28, 20, 2); ctx.lineTo(12, -4); ctx.quadraticCurveTo(0, -18, -12, -4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(2, -52); ctx.lineTo(10, -28); ctx.fill();
  } else if (cls === 'brawler') {
    ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -2, 22, -2.6, -0.5); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -8); ctx.quadraticCurveTo(-30, 10 + pose.hair * 10, -22, 24); ctx.stroke();
  } else if (cls === 'assassin') {
    ctx.fillStyle = '#06140f'; ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 2, 20, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (boss) {
    // kabuto / horned helm
    ctx.fillStyle = '#1a0508'; ctx.strokeStyle = glow; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-22, 4); ctx.lineTo(-26, -18); ctx.lineTo(0, -38 - pose.hair * 6); ctx.lineTo(26, -18); ctx.lineTo(22, 4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(-34, -40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -22); ctx.lineTo(34, -40); ctx.stroke();
  } else {
    ctx.fillStyle = trim;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-16, -26 - pose.hair * 10, 6, -24);
    ctx.lineTo(16, -8); ctx.lineTo(14, 4); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = fill; ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, boss ? 20 : 18, boss ? 22 : 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 10, 12, 8, 0, 0.1, Math.PI - 0.1); ctx.fill();
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
    ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, 9); ctx.quadraticCurveTo(0, 11, 4, 9); ctx.stroke();
  }
  ctx.restore();

  // front arm
  const eF = limb(ctx, shX + (boss ? 22 : 18), shY + 4, pose.uaF, boss ? 42 : 38, boss ? 12 : 10, fill, glow);
  const hF = limb(ctx, eF.x, eF.y, pose.uaF + pose.faF, boss ? 40 : 36, boss ? 11 : 9, fill, glow);
  ctx.fillStyle = '#0b0e18'; ctx.strokeStyle = accent; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(eF.x, eF.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawHand(ctx, hF.x, hF.y, pose.uaF + pose.faF, pose.handOpen, fill, glow, inv);

  const bang = pose.uaF + pose.faF + pose.weap;
  let tipX = hF.x, tipY = hF.y, baseX = hF.x, baseY = hF.y;
  if (cls === 'sword' || cls === 'assassin' || boss) {
    const len = cls === 'assassin' ? 68 : boss ? 140 : 112;
    baseX = hF.x + Math.sin(bang) * 12;
    baseY = hF.y - Math.cos(bang) * 12;
    tipX = hF.x + Math.sin(bang) * len;
    tipY = hF.y - Math.cos(bang) * len;
    drawStreak(ctx, baseX, baseY, tipX, tipY, fill, glow, pose.streak || 0, inv);
    ctx.save();
    ctx.strokeStyle = glow; ctx.lineWidth = cls === 'assassin' ? 7 : boss ? 12 : 10; ctx.lineCap = 'round'; ctx.globalAlpha = 0.22 * inv;
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.globalAlpha = inv; ctx.strokeStyle = '#f7ffff'; ctx.lineWidth = cls === 'assassin' ? 3 : boss ? 5.5 : 4.5;
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
    if (cls === 'sword' || boss) {
      const gx = Math.cos(bang) * (boss ? 14 : 11), gy = Math.sin(bang) * (boss ? 14 : 11);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(baseX - gx, baseY - gy); ctx.lineTo(baseX + gx, baseY + gy); ctx.stroke();
    }
    if (cls === 'assassin') {
      const bang2 = pose.uaB + pose.faB - 0.4;
      const t2x = hB.x + Math.sin(bang2) * 52, t2y = hB.y - Math.cos(bang2) * 52;
      drawStreak(ctx, hB.x, hB.y, t2x, t2y, fill, glow, (pose.streak || 0) * 0.7, inv);
      ctx.strokeStyle = '#f7ffff'; ctx.lineWidth = 2.5; ctx.globalAlpha = inv;
      ctx.beginPath(); ctx.moveTo(hB.x, hB.y); ctx.lineTo(t2x, t2y); ctx.stroke();
    }
    ctx.restore();
  } else if (cls === 'brawler') {
    tipX = hF.x + Math.sin(pose.uaF + pose.faF) * 14;
    tipY = hF.y - Math.cos(pose.uaF + pose.faF) * 14;
    baseX = hF.x; baseY = hF.y;
    if (pose.streak > 0.2) drawStreak(ctx, baseX, baseY, tipX + (tipX - baseX) * 2, tipY + (tipY - baseY) * 2, fill, glow, pose.streak, inv);
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
    const r = 14 + Math.sin(t * 5) * 2 + (pose.streak || 0) * 8;
    ctx.beginPath(); ctx.arc(tipX, tipY, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX - r, tipY); ctx.lineTo(tipX + r, tipY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX, tipY - r); ctx.lineTo(tipX, tipY + r); ctx.stroke();
    ctx.fillStyle = glow; ctx.globalAlpha = (0.3 + pose.streak * 0.35) * inv;
    ctx.beginPath(); ctx.arc(tipX, tipY, 5 + pose.streak * 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (pose.guard) {
    ctx.save();
    ctx.translate(shX + 48, shY + 6);
    ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.globalAlpha = 0.65 * inv;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 34, y = Math.sin(a) * 34;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  // hitstop / hit flash — stronger white crush for SF crunch
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, flash * 5) * inv;
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

    // Glitch Step decoys (simple neon silhouettes)
    this.ghosts = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.95, h * 0.95),
        new THREE.MeshBasicMaterial({ color: 0xff3a52, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      );
      m.visible = false; scene.add(m);
      this.ghosts.push({ mesh: m, life: 0, life0: 0.4 });
    }

    this.joints = {}; this.cls = null; this.vis = true; this.flashT = 0;
    this.walkPhase = 0; this.scaleK = 1; this.meta = SPRITE_CLASSES.sword;
    this._lastAtk = ''; this.anchors = null; this.phaseLook = 1; this.cloaked = false;
    this.hasDataBlades = false;
  }

  setClass(clsId, color = null, scale = 1) {
    const C = CLASSES[clsId] || CLASSES.sword;
    const meta = SPRITE_CLASSES[clsId] || SPRITE_CLASSES.sword;
    this.cls = clsId; this.C = C; this.scaleK = scale;
    // Sword biomech: charcoal armor+trim are fixed; optional color only tints cyan energy/accent
    // (foe/attract used to pass CLASSES.sword cyan into meta.color and wash out the mech).
    if (clsId === 'sword') {
      this.meta = { ...meta, color: meta.color, trim: meta.trim, accent: color ?? meta.accent };
    } else {
      this.meta = { ...meta, color: color ?? meta.color };
    }
    this.ring.material.color.set(this.meta.accent || this.meta.color);
    this.group.scale.setScalar((clsId === 'shogun' ? 1.28 : 1.12) * scale);
    this._lastAtk = '';
    this.hasDataBlades = clsId === 'shogun' && this.phaseLook >= 2;
  }

  flash() { this.flashT = 0.16; }
  set visible(v) {
    this.vis = v; this.group.visible = v && !this.cloaked; this.shadow.visible = v && !this.cloaked;
    if (!v) this.ring.visible = false;
  }
  get visible() { return this.vis; }
  resetAnim() { this.walkPhase = 0; this._lastAtk = ''; }
  setCloak(on) { this.cloaked = !!on; this.group.visible = this.vis && !this.cloaked; this.shadow.visible = this.vis && !this.cloaked; }
  setPhaseLook(p) {
    this.phaseLook = p || 1;
    this.hasDataBlades = this.cls === 'shogun' && this.phaseLook >= 2;
    if (this.phaseLook >= 2 && this.meta) this.ring.material.color.set(0xff2440);
  }
  spawnGhostAt(x, dir, yOff = 0.7, life = 0.4, color = 0xff3a52) {
    const g = this.ghosts.find((q) => q.life <= 0) || this.ghosts[0];
    g.life = g.life0 = life;
    g.mesh.visible = true;
    g.mesh.material.color.set(color);
    g.mesh.material.opacity = 0.55;
    const sk = (this.cls === 'shogun' ? 1.28 : 1.12) * this.scaleK;
    g.mesh.position.set(x, (this._baseY || 0) + yOff, 0.05);
    g.mesh.scale.set(sk * (dir || 1), sk, sk);
  }

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
  bossSync() { /* BossFx owns data-blade markers */ }

  update(f, dt, t, baseY, frozen = false, shake = 0) {
    if (!this.C) return;
    this._baseY = baseY;
    f._spriteT = (f._spriteT || 0) + (frozen ? 0 : dt);
    const breath = Math.sin((f._spriteT || 0) * 2.2);
    if (!frozen && f.st === 'walk') {
      this.walkPhase += dt * 9 * (Math.abs(f.vx) / (this.C.walk || 3) + 0.2) * Math.sign(f.vx * f.facing || 1);
    }
    if (f.st !== 'atk') this._lastAtk = '';

    const pose = poseOf(f, this.walkPhase, breath);
    this.flashT = Math.max(0, this.flashT - dt);
    // hold flash a hair longer during sim hitstop so white crush reads
    const flashShow = this.flashT + (frozen && this.flashT > 0 ? 0.04 : 0);
    const inv = (f.inv > 0 && f.st !== 'dodge' && f.st !== 'down') ? 0.55 + Math.sin(t * 40) * 0.35 : 1;
    this.anchors = drawHuman(this.ctx, pose, this.meta, flashShow, inv, t, this.cls, this.phaseLook);
    this.tex.needsUpdate = true;

    const face = f.facing >= 0 ? 1 : -1;
    const baseSk = (this.cls === 'shogun' ? 1.28 : 1.12) * this.scaleK;
    this.group.position.set(f.x + (shake ? (Math.random() - 0.5) * shake : 0), baseY + f.y, 0);
    this.group.scale.set(baseSk * face, baseSk, baseSk);

    const toWorld = (ax, ay) => {
      const lx = (ax / PX) * face;
      const ly = -ay / PX;
      return new THREE.Vector3(f.x + lx * baseSk, baseY + f.y + ly * baseSk, 0.15);
    };
    const a = this.anchors;
    this.joints = {
      tip: toWorld(a.tip.x, a.tip.y),
      base: toWorld(a.base.x, a.base.y),
      handF: toWorld(a.hand.x, a.hand.y),
      head: toWorld(a.head.x, a.head.y),
    };

    this.shadow.position.set(f.x, baseY + 0.015, 0);
    const sc = Math.max(0.3, 1 - f.y * 0.22) * baseSk;
    this.shadow.scale.set(sc, sc, 1);

    const ready = f.ult >= 100 && f.st !== 'ko';
    this.ring.visible = ready && this.vis && !this.cloaked;
    this.ring.position.set(f.x, baseY + 0.03, 0);
    this.ring.material.opacity = 0.4 + Math.sin(t * 6) * 0.2;
    this.ring.scale.setScalar(baseSk * (1 + Math.sin(t * 6) * 0.05));

    for (const g of this.ghosts) {
      if (g.life > 0) {
        g.life -= dt;
        g.mesh.material.opacity = Math.max(0, (g.life / g.life0) * 0.55);
        if (g.life <= 0) g.mesh.visible = false;
      }
    }
  }
}
