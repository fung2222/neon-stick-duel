/**
 * Export sword biomech PNG previews from js/sprite/human.js drawSwordMech
 * (no browser). Usage: node tools/render-sword-mech.mjs
 */
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOT_DIR || '/workspace/neon-stick-duel-shots';
const SCALE = Number(process.env.SCALE || 3); // 384*3 = 1152

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

function idlePose(breath = 0.35) {
  return {
    lean: 0.04 + breath * 0.02, head: -0.02 + breath * 0.015,
    uaF: 0.25, faF: 0.45, uaB: -0.2, faB: 0.5,
    thF: 0.08, shF: 0.1, thB: -0.12, shB: 0.1,
    weap: -0.4, hair: breath * 0.08, cloak: breath * 0.06,
    roll: 0, guard: false, handOpen: 0.15, dialect: 'blade', streak: 0,
  };
}

function attackPose() {
  const p = applyAttack('blade', 'a1', 1);
  return { ...p, guard: false, dialect: 'blade', streak: 1, handOpen: p.handOpen ?? 0.15 };
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

function render(pose, t, outName) {
  // drawSwordMech clearRect(0,0,CW,CH) — render to offscreen first, then blit
  const sprite = createCanvas(CW, CH);
  const sctx = sprite.getContext('2d');
  drawSwordMech(sctx, pose, META, 0, 1, t);

  const w = CW * SCALE, h = CH * SCALE;
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

const idle = render(idlePose(), 1.2, 'sword-biomech-idle.png');
const match = render(idlePose(), 1.2, 'sword-match-sample.png');
const atk = render(attackPose(), 0.8, 'sword-biomech-attack.png');
try { fs.unlinkSync(stubPath); } catch {}
console.log(JSON.stringify({ idle, match, attack: atk, scale: SCALE, cw: CW, ch: CH }, null, 2));
