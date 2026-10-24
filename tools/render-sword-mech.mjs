/**
 * Export sword biomech PNG previews + 6-pose sheet from drawSwordMech
 * (no browser). Usage: node tools/render-sword-mech.mjs
 *
 * Pose angles mirror Roy poses-v2 idle/move/attack/defend/hit/victory refs.
 */
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOT_DIR || '/workspace/neon-stick-duel-shots';
const SCALE = Number(process.env.SCALE || 2); // sheet uses 2x; singles can override

const humanSrc = fs.readFileSync(path.join(ROOT, 'js/sprite/human.js'), 'utf8');
const stub = humanSrc
  .replace(/^import\s+[\s\S]*?;?\s*$/gm, '')
  .replace(/^export\s+\{[^}]+\}\s*;?\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  + '\nexport { drawSwordMech, applyAttack, CW, CH };\n';

fs.mkdirSync(OUT, { recursive: true });
const stubPath = path.join(OUT, `_sword-mech-stub-${Date.now()}.mjs`);
fs.writeFileSync(stubPath, stub);
const { drawSwordMech, applyAttack, CW, CH } = await import(pathToFileURL(stubPath).href);

const META = {
  color: 0x5a6574, trim: 0x2a313c, accent: 0x00e8ff, style: 'blade',
};

function basePose(extra = {}) {
  return {
    lean: 0.015, head: -0.02,
    uaF: 0.72, faF: 0.78, uaB: 0.55, faB: 0.72,
    thF: 0.1, shF: 0.06, thB: -0.12, shB: 0.06,
    weap: -0.2, hair: 0.03, cloak: 0.02,
    roll: 0, guard: false, handOpen: 0.18, dialect: 'blade', streak: 0,
    bladeHand: null, bladeLen: 0,
    ...extra,
  };
}

/** Snapshots matching poseOf(blade) for Roy poses-v2 refs. */
function poses() {
  const k = 1; // mid-stride peak for move
  return {
    idle: basePose(),
    move: basePose({
      thF: 0.68 * k, shF: 0.34 * k, thB: -0.7 * k, shB: -0.36 * k,
      uaF: 0.32 + 0.12 * k, faF: 0.4, uaB: 1.05 - 0.1 * k, faB: 0.62,
      lean: 0.16, head: -0.05, weap: 1.15, handOpen: 0.08,
      bladeHand: 'B', bladeLen: 78,
    }),
    attack: (() => {
      const p = applyAttack('blade', 'a1', 1);
      return {
        ...basePose(), ...p, guard: false, dialect: 'blade', streak: 1,
        handOpen: p.handOpen ?? 0.06,
        bladeHand: p.bladeHand ?? 'F', bladeLen: p.bladeLen ?? 56,
      };
    })(),
    defend: basePose({
      guard: true, uaF: 0.28, faF: 0.32, uaB: 0.4, faB: 0.36, handOpen: 0.05,
      weap: 0, lean: 0.06, head: -0.12, thF: 0.28, shF: 0.1, thB: -0.24, shB: 0.1,
      bladeHand: null, bladeLen: 0,
    }),
    hit: basePose({
      lean: -0.5, head: 0.4, uaF: -1.15, faF: 0.25, uaB: 0.35, faB: 0.55,
      thF: 0.48, shF: 0.28, thB: -0.32, shB: 0.12, weap: 0, hair: 0.42, handOpen: 0.95,
      bladeHand: null, bladeLen: 0,
    }),
    victory: basePose({
      uaF: 0.88, faF: 0.98, uaB: -0.55, faB: 0.38, handOpen: 0.08,
      lean: 0.05, head: -0.12, thF: 0.12, shF: 0.06, thB: -0.12, shB: 0.06,
      weap: -0.12, hair: 0.1, bladeHand: 'B', bladeLen: 92,
    }),
  };
}

function paintStage(ctx, w, h) {
  ctx.fillStyle = '#1a2433';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.86, 8, w * 0.5, h * 0.86, w * 0.42);
  g.addColorStop(0, 'rgba(0,232,255,0.14)');
  g.addColorStop(0.55, 'rgba(20,40,60,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,232,255,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function renderSprite(pose, t) {
  const sprite = createCanvas(CW, CH);
  const sctx = sprite.getContext('2d');
  drawSwordMech(sctx, pose, META, 0, 1, t);
  return sprite;
}

function renderSingle(pose, t, outName, scale = SCALE) {
  const sprite = renderSprite(pose, t);
  const w = CW * scale, h = CH * scale;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  paintStage(ctx, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sprite, 0, 0, w, h);
  const outPath = path.join(OUT, outName);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  const st = fs.statSync(outPath);
  console.log(`wrote ${outPath} (${w}x${h}, ${(st.size / 1024).toFixed(1)} KiB)`);
  return outPath;
}

function renderPoseSheet(all, scale = SCALE) {
  const labels = ['idle', 'move', 'attack', 'defend', 'hit', 'victory'];
  const cellW = CW * scale, cellH = CH * scale;
  const labelH = 36;
  const pad = 16;
  const cols = 3, rows = 2;
  const w = cols * cellW + (cols + 1) * pad;
  const h = rows * (cellH + labelH) + (rows + 1) * pad;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d141c';
  ctx.fillRect(0, 0, w, h);
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  labels.forEach((name, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (cellW + pad);
    const y = pad + row * (cellH + labelH + pad);
    const cell = createCanvas(cellW, cellH);
    const cctx = cell.getContext('2d');
    paintStage(cctx, cellW, cellH);
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(renderSprite(all[name], name === 'attack' ? 0.8 : 1.2), 0, 0, cellW, cellH);
    ctx.drawImage(cell, x, y);
    ctx.fillStyle = '#00e8ff';
    ctx.fillText(name.toUpperCase(), x + cellW / 2, y + cellH + labelH / 2);
  });

  const outPath = path.join(OUT, 'sword-pose-sheet.png');
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  // also drop a copy into tracked docs/shots for review
  const docsDir = path.join(ROOT, 'docs', 'shots');
  fs.mkdirSync(docsDir, { recursive: true });
  const docsPath = path.join(docsDir, 'sword-pose-sheet.png');
  fs.copyFileSync(outPath, docsPath);
  const st = fs.statSync(outPath);
  console.log(`wrote ${outPath} (${w}x${h}, ${(st.size / 1024).toFixed(1)} KiB)`);
  console.log(`copied ${docsPath}`);
  return { outPath, docsPath, w, h };
}

const all = poses();
const idle = renderSingle(all.idle, 1.2, 'sword-biomech-idle-v2.png', 3);
renderSingle(all.idle, 1.2, 'sword-biomech-idle.png', 3);
const match = renderSingle(all.idle, 1.2, 'sword-match-sample.png', 3);
const side = renderSingle(all.idle, 1.2, 'sword-sideview-v1.png', 3);
const atk = renderSingle(all.attack, 0.8, 'sword-biomech-attack-v2.png', 3);
renderSingle(all.attack, 0.8, 'sword-biomech-attack.png', 3);
for (const name of ['move', 'defend', 'hit', 'victory']) {
  renderSingle(all[name], 1.2, `sword-biomech-${name}-v2.png`, 3);
  renderSingle(all[name], 1.2, `sword-biomech-${name}.png`, 3);
}
const sheet = renderPoseSheet(all, 2);
// also versioned sheet name
const sheetV2 = path.join(OUT, 'sword-pose-sheet-v2.png');
fs.copyFileSync(sheet.outPath, sheetV2);
const docsV2 = path.join(ROOT, 'docs', 'shots', 'sword-pose-sheet-v2.png');
fs.copyFileSync(sheet.outPath, docsV2);
console.log(`copied ${sheetV2}`);
console.log(`copied ${docsV2}`);
try { fs.unlinkSync(stubPath); } catch {}
console.log(JSON.stringify({ idle, match, attack: atk, sideview: side, sheet, sheetV2, docsV2, scale: SCALE, cw: CW, ch: CH }, null, 2));
