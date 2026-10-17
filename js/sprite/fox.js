// Option 3 vertical slice — neon fox blade SpriteFighter (procedural 2D canvas → billboard).
// Driven by the pure duel sim; contact tip/base match the active blade for sparks.
// Only the Swordsman kit (`sword`) has a sprite body in Phase 1.
import * as THREE from 'three';
import { CLASSES } from '../classes.js';

import { SPRITE_CLASSES, hasSprite, spriteMeta } from './meta.js';
export { SPRITE_CLASSES, hasSprite, spriteMeta };

const CW = 384, CH = 384;
const ORIGIN = { x: 192, y: 300 }; // feet on canvas
const PX = 92; // pixels per metre (fighter ~2.1 m tall → ~193 px)

function hexCss(n) {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

/** Map sim fighter → limb angles (radians, 0 = down, + = forward / clockwise when facing right). */
function poseOf(f, walkPhase) {
  const C = CLASSES[f.cls] || CLASSES.sword;
  const st = f.st, m = f.mk ? C.moves[f.mk] : null;
  let lean = 0.06, head = -0.05;
  let uaF = 0.55, faF = 0.35, uaB = -0.45, faB = 0.55;
  let thF = 0.12, shF = 0.08, thB = -0.18, shB = 0.12;
  let blade = -0.35, ear = 0, tail = -0.55, tuck = 0, roll = 0;
  let guard = false;

  if (st === 'walk') {
    const k = Math.sin(walkPhase);
    thF = 0.55 * k; shF = 0.35 * k; thB = -0.55 * k; shB = -0.35 * k;
    uaF = 0.45 - 0.35 * k; uaB = -0.35 + 0.35 * k;
    lean = 0.1 * Math.sign(f.vx * f.facing || 1); tail = -0.45 + 0.25 * k;
  } else if (st === 'guard' || st === 'block') {
    guard = true; uaF = 1.15; faF = 0.9; uaB = 0.95; faB = 0.85; blade = 0.85; lean = -0.08; thF = 0.35; thB = -0.25;
  } else if (st === 'jump') {
    if (f.djT < 0.42) { tuck = 1; roll = -Math.PI * 2 * Math.min(1, f.djT / 0.42); thF = 1.4; thB = 1.2; uaF = -0.8; uaB = 0.8; }
    else if (f.vy > 0.5) { thF = -0.4; thB = 0.55; uaF = -0.6; uaB = 0.7; blade = -1.1; }
    else { thF = 0.7; thB = -0.2; uaF = 0.9; uaB = -0.5; blade = -0.2; }
  } else if (st === 'dodge') {
    roll = -Math.sign(f.dodgeDir * f.facing || 1) * Math.PI * 2 * Math.min(1, f.t / 0.3);
    thF = 1.2; thB = 1.0; uaF = -0.4; uaB = 0.4; tuck = 0.6;
  } else if (st === 'hit') {
    lean = -0.35; uaF = -0.4; uaB = -0.7; thF = 0.5; thB = -0.3; head = 0.25; ear = 0.4; blade = -1.2;
  } else if (st === 'air') {
    lean = -0.2; thF = 0.8; thB = 0.4; uaF = -0.5; uaB = 0.6; blade = -0.8;
  } else if (st === 'down' || (st === 'ko' && f.y < 0.3)) {
    lean = 1.35; thF = 0.2; thB = -0.1; uaF = 0.3; uaB = -0.4; blade = 0.2; head = 0.4; tail = -0.1;
  } else if (st === 'rise') {
    lean = 0.55; thF = 0.9; thB = 0.4; uaF = 0.2; uaB = -0.3; blade = -0.6;
  } else if (st === 'stun') {
    lean = -0.15; head = 0.2; ear = 0.5; uaF = 0.3; uaB = -0.3;
  } else if (st === 'win') {
    uaF = -0.2; faF = 0.1; blade = -2.4; lean = -0.05; thF = 0.2; thB = -0.15; tail = -0.8; ear = -0.15;
  } else if (st === 'atk' && m) {
    const [su, ac, rc] = m.t, t = f.t, phase = t < su ? 0 : t < su + ac ? 1 : 2;
    const mk = f.mk;
    if (mk === 'a1' || mk === 'air1') {
      if (phase === 0) { uaF = -0.5; faF = 0.2; blade = -2.0; lean = -0.12; thF = 0.35; }
      else if (phase === 1) { uaF = 1.35; faF = 0.15; blade = 0.15; lean = 0.22; thF = -0.2; thB = 0.35; }
      else { uaF = 1.1; faF = 0.4; blade = 0.55; lean = 0.1; }
    } else if (mk === 'a2') {
      if (phase === 0) { uaF = 1.4; faF = 0.3; blade = 0.8; lean = 0.1; }
      else if (phase === 1) { uaF = -0.3; faF = 0.2; blade = -2.2; lean = -0.18; thB = 0.4; }
      else { uaF = 0.2; blade = -1.4; }
    } else if (mk === 'a3' || mk === 's1') {
      if (phase === 0) { uaF = -0.2; faF = 0.9; blade = -0.4; lean = -0.2; thF = 0.6; }
      else if (phase === 1) { uaF = 1.55; faF = 0.05; blade = 0.05; lean = 0.35; thF = -0.35; thB = 0.5; }
      else { uaF = 1.2; faF = 0.3; blade = 0.25; lean = 0.15; }
    } else if (mk === 'a4' || mk === 's2' || mk === 'air2') {
      if (phase === 0) { uaF = 0.4; faF = 1.0; blade = 1.6; lean = 0.15; thF = 0.7; }
      else if (phase === 1) { uaF = -0.9; faF = 0.2; blade = -2.6; lean = -0.25; thF = -0.3; }
      else { uaF = -0.4; blade = -2.0; lean = -0.1; }
    } else if (mk === 'ult') {
      const spin = (t / Math.max(0.01, su + ac)) * Math.PI * 6;
      uaF = 1.2 + Math.sin(spin) * 0.8; faF = 0.1; blade = Math.sin(spin) * 1.4; lean = 0.15; roll = spin * 0.15;
      thF = 0.3 * Math.sin(spin); thB = -0.3 * Math.sin(spin);
    } else {
      if (phase === 0) { uaF = -0.3; blade = -1.6; }
      else if (phase === 1) { uaF = 1.3; blade = 0.2; lean = 0.2; }
      else { uaF = 0.8; blade = 0.4; }
    }
  } else {
    // idle breathe
    const b = Math.sin((f._spriteT || 0) * 2.4) * 0.03;
    lean = 0.05 + b; tail = -0.55 + b * 2; ear = b * 3; uaF = 0.5; faF = 0.4; uaB = -0.4; faB = 0.5;
  }
  return { lean, head, uaF, faF, uaB, faB, thF, shF, thB, shB, blade, ear, tail, tuck, roll, guard };
}

function limb(ctx, x, y, ang, len, w, color, glow) {
  const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
  ctx.save();
  ctx.strokeStyle = glow; ctx.lineWidth = w + 6; ctx.lineCap = 'round'; ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
  return { x: x2, y: y2 };
}

function drawFox(ctx, pose, color, trim, earCol, flash, inv, t) {
  ctx.clearRect(0, 0, CW, CH);
  const o = ORIGIN;
  const s = 1;
  const glow = hexCss(color);
  const fill = hexCss(color);
  const trimC = hexCss(trim);
  const earC = hexCss(earCol);

  ctx.save();
  ctx.translate(o.x, o.y);
  if (pose.roll) ctx.rotate(pose.roll);
  ctx.globalAlpha = inv;

  // floor glow
  ctx.save();
  ctx.globalAlpha = 0.25 * inv;
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
  g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 4, 55, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const hipY = -18 * s, hipX = pose.lean * 8;
  const shY = hipY - 78 * s, shX = hipX + pose.lean * 40;

  // legs
  const kF = limb(ctx, hipX + 10, hipY, pose.thF, 42 * s, 11, fill, glow);
  limb(ctx, kF.x, kF.y, pose.thF + pose.shF, 40 * s, 10, fill, glow);
  const kB = limb(ctx, hipX - 10, hipY, pose.thB, 42 * s, 10, trimC, glow);
  limb(ctx, kB.x, kB.y, pose.thB + pose.shB, 40 * s, 9, trimC, glow);

  // feet pads
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(kF.x + Math.sin(pose.thF + pose.shF) * 8, kF.y - Math.cos(pose.thF + pose.shF) * 8 + 6, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(kB.x + Math.sin(pose.thB + pose.shB) * 8, kB.y - Math.cos(pose.thB + pose.shB) * 8 + 6, 12, 5, 0, 0, Math.PI * 2); ctx.fill();

  // tail (behind)
  ctx.save();
  ctx.strokeStyle = glow; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.globalAlpha = 0.35 * inv;
  ctx.beginPath(); ctx.moveTo(hipX - 8, hipY - 10);
  ctx.quadraticCurveTo(hipX - 50, hipY - 40 + Math.sin(t * 3) * 6, hipX - 70 + pose.tail * 20, hipY - 90 + pose.tail * 30);
  ctx.stroke();
  ctx.globalAlpha = inv; ctx.strokeStyle = trimC; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(hipX - 8, hipY - 10);
  ctx.quadraticCurveTo(hipX - 50, hipY - 40 + Math.sin(t * 3) * 6, hipX - 70 + pose.tail * 20, hipY - 90 + pose.tail * 30);
  ctx.stroke();
  // tip glow
  const tx = hipX - 70 + pose.tail * 20, ty = hipY - 90 + pose.tail * 30;
  ctx.fillStyle = earC; ctx.globalAlpha = 0.85 * inv;
  ctx.beginPath(); ctx.arc(tx, ty, 10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // torso
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(pose.lean);
  const tg = ctx.createLinearGradient(0, 0, 0, -90);
  tg.addColorStop(0, trimC); tg.addColorStop(0.5, fill); tg.addColorStop(1, '#e8ffff');
  ctx.fillStyle = tg; ctx.strokeStyle = glow; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -40, 28, 48, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // chest neon seam
  ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.55 * inv; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -70); ctx.stroke();
  ctx.restore();

  // back arm
  const eB = limb(ctx, shX - 6, shY + 6, pose.uaB, 34 * s, 9, trimC, glow);
  const hB = limb(ctx, eB.x, eB.y, pose.uaB + pose.faB, 32 * s, 8, trimC, glow);

  // head
  const hx = shX + pose.lean * 10, hy = shY - 28 + pose.head * 10;
  ctx.save();
  ctx.translate(hx, hy);
  // ears
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.35 + pose.ear * 0.2));
    ctx.fillStyle = fill; ctx.strokeStyle = glow; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(side * 6, -8); ctx.lineTo(side * 22, -42); ctx.lineTo(side * 2, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = earC; ctx.beginPath(); ctx.moveTo(side * 7, -12); ctx.lineTo(side * 18, -34); ctx.lineTo(side * 5, -18); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // skull
  ctx.fillStyle = fill; ctx.strokeStyle = glow; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // snout
  ctx.beginPath(); ctx.ellipse(18, 6, 14, 10, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // eyes
  ctx.fillStyle = '#041018';
  ctx.beginPath(); ctx.ellipse(8, -4, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(20, -2, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = earC; ctx.shadowColor = earC; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(9, -3, 3.2, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(21, -1, 2.8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // nose
  ctx.fillStyle = '#1a0a14';
  ctx.beginPath(); ctx.ellipse(30, 6, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // front arm + blade
  const eF = limb(ctx, shX + 8, shY + 4, pose.uaF, 36 * s, 10, fill, glow);
  const hF = limb(ctx, eF.x, eF.y, pose.uaF + pose.faF, 34 * s, 9, fill, glow);
  // fist
  ctx.fillStyle = fill; ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hF.x, hF.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  const bang = pose.uaF + pose.faF + pose.blade;
  const bx = hF.x, by = hF.y;
  const tipX = bx + Math.sin(bang) * 118 * s, tipY = by - Math.cos(bang) * 118 * s;
  const baseX = bx + Math.sin(bang) * 18 * s, baseY = by - Math.cos(bang) * 18 * s;

  // blade glow
  ctx.save();
  ctx.strokeStyle = glow; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.globalAlpha = 0.3 * inv;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.globalAlpha = inv; ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.strokeStyle = trimC; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(tipX, tipY); ctx.stroke();
  // guard
  const gx = Math.cos(bang) * 14, gy = Math.sin(bang) * 14;
  ctx.strokeStyle = trimC; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(baseX - gx, baseY - gy); ctx.lineTo(baseX + gx, baseY + gy); ctx.stroke();
  ctx.restore();

  // guard hex
  if (pose.guard) {
    ctx.save();
    ctx.translate(shX + 55, shY + 10);
    ctx.strokeStyle = glow; ctx.lineWidth = 3; ctx.globalAlpha = 0.7 * inv;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 38, y = Math.sin(a) * 38;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = glow; ctx.globalAlpha = 0.12 * inv; ctx.fill();
    ctx.restore();
  }

  // flash wash
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, flash * 4) * inv;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-CW, -CH, CW * 2, CH * 2);
    ctx.restore();
  }

  ctx.restore();
  // return blade anchors in canvas px relative to ORIGIN (feet)
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
    // feet at group origin: canvas origin is near bottom
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
    this.walkPhase = 0; this.scaleK = 1; this.color = 0x00e5ff; this.trim = 0xff7ad9; this.ear = 0xff4ad2;
    this._swing = null; this._lastAtk = ''; this.anchors = null;
  }

  setClass(clsId, color = null, scale = 1) {
    const C = CLASSES[clsId] || CLASSES.sword;
    const meta = SPRITE_CLASSES[clsId] || SPRITE_CLASSES.sword;
    this.cls = clsId; this.C = C; this.scaleK = scale;
    this.color = color ?? meta.color ?? C.color;
    this.trim = meta.trim; this.ear = meta.ear;
    this.ring.material.color.set(this.color);
    this.group.scale.setScalar(1.15 * scale);
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
    if (!frozen && f.st === 'walk') {
      this.walkPhase += dt * 9 * (Math.abs(f.vx) / (this.C.walk || 3) + 0.2) * Math.sign(f.vx * f.facing || 1);
    }
    if (f.st !== 'atk') this._lastAtk = '';

    const pose = poseOf(f, this.walkPhase);
    this.flashT = Math.max(0, this.flashT - dt);
    const inv = (f.inv > 0 && f.st !== 'dodge' && f.st !== 'down') ? 0.55 + Math.sin(t * 40) * 0.35 : 1;
    this.anchors = drawFox(this.ctx, pose, this.color, this.trim, this.ear, this.flashT, inv, t);
    this.tex.needsUpdate = true;

    const face = f.facing >= 0 ? 1 : -1;
    const sk = 1.15 * this.scaleK;
    this.group.position.set(f.x + (shake ? (Math.random() - 0.5) * shake : 0), baseY + f.y, 0);
    this.group.scale.set(sk * face, sk, sk);

    // world joints from canvas anchors (relative to feet ORIGIN; canvas +y is down)
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
