// NEON STICK DUEL v2 — 3D cyberpunk class fighter. Four classes, joystick + arcade buttons, 10-fight ladder, endless tower.
// Game rules live in duel.js (pure sim, fixed DT), ai.js, classes.js, modes.js. This file is the shell: screens, input,
// fixed-step loop, rendering sync, effects, HUD, saves, hub contract (trial caps + ads).
import * as THREE from 'three';
import { i18n, t, flags, createStore, createStage, ThemeController, U, Particles, Shockwaves, FxState, NeonCity, CyberUI, Platform, createAds } from 'cyber-kit';
import { GAME_ID, DT, makeDuel, act, step, CLASSES, CLASS_IDS, ARENA_HALF, actionable } from './duel.js';
import { STAT_KEYS } from './classes.js';
import { aiThink } from './ai.js';
import { TRIAL, LADDER, ladderFoe, endlessFoe, fightScore, migrateSave } from './modes.js';
import './strings.js';
import { StickFighter } from './stickman.js';
import { Rooftop, ROOF_Y } from './world.js';
import { DuelAudio } from './audio.js';
import { createControls } from './controls.js';
import { readHub, returnToHub } from './hub.js';
import { POST } from './config.js';

const $ = (id) => document.getElementById(id);
const L = () => (i18n.lang === 'en' ? 1 : 0);
const nm = (o) => (Array.isArray(o) ? o[L()] : L() ? o.en : o.zh);
const store = createStore(GAME_ID);
if (flags.reset) store.clear();
const migrated = migrateSave(store);
const hub = readHub();
const ui = new CyberUI({ screens: ['start', 'select', 'pause', 'result', 'trial'] });
const stage = createStage({ canvas: $('scene'), ...POST, onFatal: (m) => ui.fatal(m) });
const { scene, camera } = stage;
const theme = new ThemeController(); theme.set(1, true);
const city = new NeonCity(stage, { floor: 'reflect', innerRadius: 16, buildings: 260, billboard: { zh: '天台決鬥', en: 'R O O F T O P   D U E L', pos: [-18, 20, -44], width: 26 }, dustArea: 26, dustHeight: 12 });
const roof = new Rooftop(scene);
const particles = new Particles(scene, 2400, { floorY: ROOF_Y + 0.02 });
stage.onResize((w, h, pr) => particles.resize(h, pr));
const waves = new Shockwaves(scene, 12);
const fx = new FxState();
const audio = new DuelAudio(store); ui.setMuted(audio.muted);
const ads = createAds({ gameId: GAME_ID, interstitialCooldownSec: 180, breaksBetweenInterstitials: 2, graceSec: 120, units: { android: {} }, onAdOpen: (on) => audio.duckAll(on) });
const SPARK_BRIGHT = 1.7;   // particle brightness (kept moderate: fighters must stay crisp)
const SHORT = { sword: [['突刺', 'LUNGE'], ['昇龍', 'DRAGON']], mage: [['閃現', 'BLINK'], ['雷柱', 'PILLAR']], brawler: [['衝拳', 'RUSH'], ['震地', 'QUAKE']], assassin: [['影步', 'SHADOW'], ['瞬殺', 'PHANTOM']] };

// ------------------------------------------------------------------ state
const S = {
  state: 'menu', demo: !!flags.demo, mode: 'ladder', cls: CLASSES[store.get('cls')] ? store.get('cls') : 'sword', selCls: null,
  stage: Math.min(9, store.getNum('ladder', 0)), floor: store.getNum('floor', 0), score: 0,
  duel: null, foe: null, memA: {}, memB: {}, acc: 0, introT: 0, revived: false, result: null, attract: null,
  preview: null, freezeFoe: false, comboShown: 0, cmdLog: [], interstitials: 0, adBreaks: 0, rewardedAsks: 0, migrated,
};
window.__duel = S;  // test hook
const fa = new StickFighter(scene), fb = new StickFighter(scene);
const timers = []; const later = (sec, fn) => timers.push({ t: sec, fn });
const syncGlitch = () => document.querySelectorAll('.glitch').forEach((e) => { e.dataset.text = e.textContent; });
const hex = (c) => '#' + new THREE.Color(c).getHexString();
const isTrial = () => hub.trial && !S.demo;

// ------------------------------------------------------------------ projectile / effect meshes
const projMeshes = new Map();
const glowMat = (c, k = 1.3, o = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
const addMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const G = {
  ball: new THREE.SphereGeometry(1, 16, 12), ring: new THREE.TorusGeometry(1, 0.08, 6, 28), dagger: new THREE.ConeGeometry(0.06, 0.5, 4),
  beam: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), disc: new THREE.RingGeometry(0.75, 1, 36), tail: new THREE.ConeGeometry(1, 1, 12, 1, true),
};
function makeProjMesh(p) {
  const c = new THREE.Color(p.owner.cls === 'assassin' ? 0xb8ffe0 : p.owner === S.duel.a ? CLASSES[p.owner.cls].color : (S.foe?.color ?? CLASSES[p.owner.cls].color));
  const g = new THREE.Group();
  if (p.key === 'dagger') { const m = new THREE.Mesh(G.dagger, glowMat(0xe8fff4, 1.2)); m.rotation.z = -Math.PI / 2 * p.dir; g.add(m); }
  else if (p.key === 'pillar') {
    const warn = new THREE.Mesh(G.disc, addMat(c, 0.6)); warn.rotation.x = -Math.PI / 2; warn.scale.setScalar(p.r); g.add(warn);
    const beam = new THREE.Mesh(G.beam, addMat(c.clone().lerp(new THREE.Color(1, 1, 1), 0.4), 0.55)); beam.scale.set(p.r * 0.7, p.h, p.r * 0.7); beam.position.y = p.h / 2; beam.visible = false; g.add(beam);
    const core = new THREE.Mesh(G.beam, addMat(new THREE.Color(1, 1, 1), 0.7)); core.scale.set(p.r * 0.22, p.h, p.r * 0.22); core.position.y = p.h / 2; core.visible = false; g.add(core);
    g.userData = { warn, beam, core };
  } else if (p.key === 'meteor') {
    const m = new THREE.Mesh(G.ball, glowMat(c.clone().lerp(new THREE.Color(1, 0.9, 0.6), 0.5), 1.3)); m.scale.setScalar(p.r * 0.42); g.add(m);
    const tl = new THREE.Mesh(G.tail, addMat(c, 0.45)); tl.scale.set(p.r * 0.38, 2.6, p.r * 0.38); tl.position.y = 1.3; g.add(tl);
    const warn = new THREE.Mesh(G.disc, addMat(c, 0.4)); warn.rotation.x = -Math.PI / 2; warn.scale.setScalar(p.r); g.add(warn); g.userData = { warn };
  } else if (p.key === 'blast') { g.visible = false; }
  else {
    const big = p.key === 'orb';
    const m = new THREE.Mesh(G.ball, glowMat(c.clone().lerp(new THREE.Color(1, 1, 1), 0.35), 1.25)); m.scale.setScalar(p.r * (big ? 0.62 : 0.5)); g.add(m);
    if (big) { const r = new THREE.Mesh(G.ring, addMat(c, 0.8)); r.scale.setScalar(p.r * 0.9); g.add(r); g.userData.ring = r; }
  }
  g.userData.c = c; scene.add(g); projMeshes.set(p.id, { g, p }); return g;
}
function syncProjs(dt) {
  const d = S.duel; const live = new Set();
  if (d) for (const p of d.projs) {
    if (p.dead) continue; live.add(p.id);
    const e = projMeshes.get(p.id) || { g: makeProjMesh(p), p }; const g = e.g, u = g.userData;
    g.position.set(p.x, ROOF_Y + p.y, 0);
    if (p.key === 'pillar') { const on = !(p.delay > 0); u.warn.visible = !on; u.beam.visible = on; u.core.visible = on; u.warn.material.opacity = 0.35 + Math.sin(p.t * 40) * 0.25; g.position.y = ROOF_Y + 0.03; if (on) { const k = Math.max(0, p.life / 0.28); u.beam.material.opacity = 0.55 * k; u.core.material.opacity = 0.75 * k; } }
    else if (p.key === 'meteor') { u.warn.position.y = -p.y + 0.03; u.warn.material.opacity = 0.2 + 0.25 * Math.max(0, 1 - p.y / 10); particles.emit(g.position, new THREE.Vector3((Math.random() - 0.5) * 0.6, 2, 0), u.c, { life: 0.35, size: 1.1, bright: SPARK_BRIGHT }); }
    else if (p.key !== 'blast' && p.key !== 'dagger') { if (u.ring) u.ring.rotation.y += dt * 8; if (Math.random() < 0.7) particles.emit(g.position, new THREE.Vector3(-p.vx * 0.05, 0.3, 0), u.c, { life: 0.25, size: 0.6, bright: SPARK_BRIGHT }); }
  }
  for (const [id, e] of projMeshes) if (!live.has(id)) { scene.remove(e.g); projMeshes.delete(id); }
}
function clearProjMeshes() { for (const [, e] of projMeshes) scene.remove(e.g); projMeshes.clear(); }

// hit-spark stars (crisp sprite pool)
const starTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 9 : 32; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill(); return new THREE.CanvasTexture(cv); })();
const stars = Array.from({ length: 8 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.visible = false; scene.add(s); return { s, t: 0, life: 0.16, size: 1 }; });
let starI = 0;
function spark(pos, color, size = 1) { const st = stars[starI++ % stars.length]; st.s.position.copy(pos); st.s.material.color.copy(color).lerp(new THREE.Color(1, 1, 1), 0.5); st.s.material.rotation = Math.random() * 3; st.t = 0; st.size = size; st.s.visible = true; }
function updateStars(dt) { for (const st of stars) { if (!st.s.visible) continue; st.t += dt; const k = st.t / st.life; if (k >= 1) { st.s.visible = false; continue; } st.s.scale.setScalar(st.size * (0.6 + k * 1.1)); st.s.material.opacity = 1 - k; } }

// ------------------------------------------------------------------ duel setup
function colorOf(f) { const d = S.duel; return f === d.a ? CLASSES[f.cls].color : (S.foe?.color ?? 0xff2bd6); }
function setupDuel(clsA, foe, { oa = {}, preview = false } = {}) {
  S.foe = foe; clearProjMeshes();
  S.duel = makeDuel(clsA, foe.cls, oa, { hpMul: foe.hpMul || 1, dmgMul: foe.dmgMul || 1, ultGain: foe.ultGain || 1, scale: foe.scale || 1, boss: !!foe.boss });
  S.memA = {}; S.memB = {}; S.acc = 0; S.comboShown = 0;
  fa.setClass(clsA, oa.color ?? null, 1); fb.setClass(foe.cls, foe.color, foe.scale || 1);
  fa.visible = true; fb.visible = true;
  document.documentElement.style.setProperty('--me', hex(oa.color ?? CLASSES[clsA].color));
  document.documentElement.style.setProperty('--foe', hex(foe.color));
  roof.setAccent(oa.color ?? CLASSES[clsA].color, foe.color);
}
function attractDuel() {
  const a = CLASS_IDS[Math.floor(Math.random() * 4)], b = CLASS_IDS[Math.floor(Math.random() * 4)];
  S.attract = { diffA: 0.62, diffB: 0.62 };
  setupDuel(a, { cls: b, color: b === a ? 0xff2bd6 : CLASSES[b].color, diff: 0.62, zh: CLASSES[b].zh, en: CLASSES[b].en });
}
function setState(s) {
  S.state = s;
  ui.show({ menu: 'start', select: 'select', paused: 'pause', result: 'result', trial: 'trial' }[s] || null);
  ui.hud(s === 'play' || s === 'intro' || s === 'paused' || s === 'result');
  $('demo-tag').classList.toggle('hidden', !S.demo);
  if (s !== 'play') ctl.reset();
  document.body.dataset.state = s;
}

// ------------------------------------------------------------------ menu
function refreshMenu() {
  const lb = store.getNum('ladderBest', 0), bf = store.getNum('bestFloor', 0), C = CLASSES[S.cls];
  ui.setText('start-ladder', `${lb}/10` + (store.getNum('ladderClears', 0) ? ` ×${store.getNum('ladderClears', 0)}` : ''));
  ui.setText('start-floor', bf ? bf + 'F' : '—'); ui.setText('start-best', store.best);
  const ls = isTrial() ? 0 : S.stage;
  ui.setText('ladder-sub', t('ladderS', { n: ls + 1, name: nm(ladderFoe(ls, S.cls)) }));
  ui.setText('endless-sub', t('endlessS', { f: (isTrial() ? 0 : S.floor) + 1 }));
  ui.setText('class-label', t('changeCls', { c: nm(C) }));
  $('btn-restart-tower').classList.toggle('hidden', isTrial() || S.floor === 0);
  const tn = $('start-trial'); tn.classList.toggle('hidden', !hub.trial);
  if (hub.trial) tn.textContent = t('trialTag') + (hub.trialLeft != null ? ' · ' + t('trialLeft', { n: hub.trialLeft }) : '');
}
function showMenu() { attractDuel(); refreshMenu(); setState('menu'); audio.duckMusic && audio.unduckMusic && audio.unduckMusic(); }

// ------------------------------------------------------------------ class select (with live 3D preview vs a dummy)
function showSelect(next = null) {
  S.selNext = next; S.selCls = S.cls; setState('select'); buildTabs(); pickClass(S.cls, true);
  ui.setText('sel-mode', next === 'ladder' ? t('ladder') : next === 'endless' ? t('endless') : t('changeClsS'));
}
function buildTabs() {
  $('sel-tabs').innerHTML = CLASS_IDS.map((id) => `<button class="sel-tab${id === S.selCls ? ' on' : ''}" data-cls="${id}" style="--k:${hex(CLASSES[id].color)}">${CLASSES[id].zh}<small>${CLASSES[id].en}</small></button>`).join('');
  $('sel-tabs').querySelectorAll('[data-cls]').forEach((b) => { b.onclick = () => { audio.click(); pickClass(b.dataset.cls); }; });
}
function kitHtml(C) {
  const mv = C.moves, tag = (m) => (m.tag ? `<span class="kt ${m.tag}">${t('tag.' + m.tag)}</span>` : '');
  const list = (keys) => keys.map((k) => nm(mv[k].name)).join(' → ');
  const dmgOf = (m, k) => { if (m.multi) return `${m.multi}×${m.dmg}+${m.last.dmg}`; if (m.dmg) return m.dmg; const f = (m.fire || [])[0]; if (!f) return 0; const p = C.projs[f.proj || f.blast]; if (!p) return 0; if (f.type === 'meteors') return `${f.n - 1}×${p.dmg}+100`; return (k === 's1' && C.id === 'assassin') ? `3×${p.dmg}` : p.dmg; };
  const row = (k, label, extra = '') => `<li><span class="kk">${label}</span><span>${nm(mv[k].name)}${tag(mv[k])} <small>${dmgOf(mv[k], k)} · ${extra}</small></span></li>`;
  return [
    `<li><span class="kk">${t('b.atk')}</span><span>${t('kit.combo', { list: list(C.combo) })}<br><small>${C.combo.map((k) => dmgOf(mv[k], k)).join(' / ')} · ${t('kit.air', { list: list(C.airCombo) })}</small></span></li>`,
    row('s1', L() ? 'SKILL 1' : '技能 1', t('kit.cd', { s: mv.s1.cd })),
    row('s2', L() ? 'SKILL 2' : '技能 2', t('kit.cd', { s: mv.s2.cd })),
    row('ult', t('b.ult'), t('kit.ult')),
  ].join('');
}
function pickClass(id, instant = false) {
  S.selCls = id; const C = CLASSES[id];
  $('sel-tabs').querySelectorAll('.sel-tab').forEach((b) => b.classList.toggle('on', b.dataset.cls === id));
  const panel = document.querySelector('.sel-panel'); panel.style.setProperty('--k', hex(C.color));
  ui.setText('sel-zh', L() ? C.en : C.zh); ui.setText('sel-en', L() ? C.zh : C.en); ui.setText('sel-role', t('role.' + C.role)); ui.setText('sel-desc', nm(C.desc));
  $('sel-stats').innerHTML = STAT_KEYS.map((k) => `<span>${t('st.' + k)}</span><span class="stat-bar">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= C.stats[k] ? 'on' : ''}"></i>`).join('')}</span>`).join('');
  $('sel-kit').innerHTML = kitHtml(C);
  setupDuel(id, { cls: 'brawler', color: 0x6f7a90, diff: 0, hpMul: 50, zh: '木人', en: 'DUMMY' }, { preview: true });
  S.duel.a.x = -1.6; S.duel.b.x = 1.4;
  S.preview = { i: 0, t: 0.6 }; if (!instant) audio.confirm && audio.confirm();
}
const PREVIEW = ['atk', 'atk', 'atk', 'atk', '_', '_', 's1', '_', '_', '_', 's2', '_', '_', '_', 'ult', '_', '_', '_', '_', '_', '_', 'reset'];
function previewThink(d, dt) {
  const a = d.a, b = d.b, P = S.preview, C = a.C, gap = Math.abs(b.x - a.x), dir = Math.sign(b.x - a.x) || 1;
  b.in.mx = 0; b.in.guard = false; b.hp = b.maxHp; b.facing = a.x < b.x ? -1 : 1;
  // spacing: melee walks in, the mage keeps ~4 m
  a.in.mx = 0;
  if (actionable(a)) { if (C.role === 'ranged') { if (gap < 3.2) a.in.mx = -dir; else if (gap > 5) a.in.mx = dir; } else if (gap > C.reach + 0.2) a.in.mx = dir; }
  P.t -= dt; if (P.t > 0) return;
  P.t = 0.2; const c = PREVIEW[P.i++ % PREVIEW.length];
  if (c === 'reset') { if (actionable(a) && (b.st === 'idle' || b.st === 'walk')) { a.x = -1.6; b.x = 1.4; a.facing = 1; } else P.i--; return; }
  if (c === '_') return;
  if (c === 'ult') a.ult = 100;
  if (c === 's1' || c === 's2') a.cd[c] = 0;
  if (C.role !== 'ranged' && c === 'atk' && gap > C.reach + 0.6) { P.i--; return; }
  act(a, c);
}
function confirmClass() {
  S.cls = S.selCls; store.set('cls', S.cls); audio.click();
  if (S.selNext === 'ladder') startLadder(); else if (S.selNext === 'endless') startEndless(); else showMenu();
}

// ------------------------------------------------------------------ modes
function startLadder() { S.mode = 'ladder'; S.score = isTrial() ? 0 : store.getNum('ladderScore', 0); if (isTrial()) S.stage = 0; startFight(); }
function startEndless() { S.mode = 'endless'; S.score = isTrial() ? 0 : store.getNum('runScore', 0); if (isTrial()) S.floor = 0; startFight(); }
function restartTower() { S.floor = 0; store.setNum('floor', 0); store.setNum('runScore', 0); audio.click(); startEndless(); }
function currentFoe() { return S.mode === 'ladder' ? ladderFoe(S.stage, S.cls) : endlessFoe(S.floor); }
function startFight() {
  audio.init(); audio.startMusic();
  const foe = currentFoe(); setupDuel(S.cls, foe);
  if (foe.cls === S.cls) fb.setClass(foe.cls, foe.color, foe.scale || 1);
  S.revived = false; S.result = null;
  hudNames(); updateHud(true); setSkillLabels();
  const level = S.mode === 'ladder' ? S.stage + 1 : S.floor + 1;
  theme.set(S.mode === 'ladder' ? S.stage + 1 : S.floor + 3, false);
  ui.banner(S.mode === 'ladder' ? t('stageBanner', { n: level, name: nm(foe) }) : t('floorBanner', { f: level, name: nm(foe) }),
    (foe.boss ? t('bossTag') + ' · ' : '') + (L() ? CLASSES[foe.cls].en : CLASSES[foe.cls].zh), nm(foe.desc));
  S.introT = 1.7; setState('intro'); audio.bell(1);
  const tr = $('trial-tag'); tr.classList.toggle('hidden', !isTrial());
  if (isTrial()) tr.textContent = t('trialTag') + (hub.trialLeft != null ? ' · ' + t('trialLeft', { n: hub.trialLeft }) : '');
}
function hudNames() {
  const f = S.foe, C = CLASSES[S.cls];
  ui.setText('hp-name-a', t('you')); ui.setText('hp-cls-a', L() ? C.en : C.zh);
  ui.setText('hp-name-b', nm(f)); ui.setText('hp-cls-b', L() ? CLASSES[f.cls].en : CLASSES[f.cls].zh);
  ui.setText('hud-floor', S.mode === 'ladder' ? t('stageTag', { n: S.stage + 1 }) + (f.boss ? ' · ' + t('bossTag') : '') : t('floorTag', { f: S.floor + 1 }) + ' · ' + (f.boss ? t('bossTag') : t('endlessTag')));
}
function setSkillLabels() { const sh = SHORT[S.cls]; ui.setText('lbl-s1', sh[0][L()]); ui.setText('lbl-s2', sh[1][L()]); }

// ------------------------------------------------------------------ HUD
const last = {};
function setW(id, pct) { const k = Math.round(pct * 10) / 10; if (last[id] !== k) { last[id] = k; $(id).style.width = k + '%'; } }
function updateHud(force = false) {
  const d = S.duel; if (!d) return; const a = d.a, b = d.b;
  const pa = a.hp / a.maxHp * 100, pb = b.hp / b.maxHp * 100;
  setW('hp-fill-a', pa); setW('hp-lag-a', pa); setW('hp-fill-b', pb); setW('hp-lag-b', pb);
  $('hp-fill-a').classList.toggle('low', pa < 30); $('hp-fill-b').classList.toggle('low', pb < 30);
  setW('ult-fill-a', a.ult); setW('ult-fill-b', b.ult); $('ult-fill-a').classList.toggle('full', a.ult >= 100); $('ult-fill-b').classList.toggle('full', b.ult >= 100);
  const tm = Math.ceil(d.time), te = $('hud-time'); if (force || te.textContent !== String(tm)) { te.textContent = tm; te.classList.toggle('low', tm <= 10); }
  for (const k of ['s1', 's2']) {
    const cdMax = a.C.moves[k].cd, cd = Math.max(0, a.cd[k]), btn = document.querySelector('.b-' + k), frac = cd / cdMax;
    const off = (182.2 * frac).toFixed(1); if (last['cd' + k] !== off) { last['cd' + k] = off; $('cd-' + k).style.strokeDashoffset = off; }
    btn.classList.toggle('cooling', cd > 0); const s = cd > 0 ? Math.ceil(cd) : ''; if (last['cdn' + k] !== s) { last['cdn' + k] = s; $('cdn-' + k).textContent = s; }
  }
  const uo = (182.2 * (1 - a.ult / 100)).toFixed(1); if (last.ult !== uo) { last.ult = uo; $('cd-ult').style.strokeDashoffset = uo; }
  const ub = document.querySelector('.b-ult'); ub.classList.toggle('ready', a.ult >= 100); ub.classList.toggle('locked', a.ult < 100);
  ui.setText('hud-score', Math.round(S.score));
}
function showCombo(n) { const c = $('combo'); if (n >= 2) { c.textContent = t('hits', { n }); c.classList.remove('hidden', 'pop'); void c.offsetWidth; c.classList.add('pop'); S.comboShown = 1.1; } }
const xy = (x, y) => { const s = stage.toScreen(new THREE.Vector3(x, ROOF_Y + y, 0)); return [s.x, s.y]; };

// ------------------------------------------------------------------ events → effects
function handleEvents() {
  const d = S.duel, inPlay = S.state === 'play' || S.state === 'intro', menuish = S.state === 'menu' || S.state === 'select';
  const vol = menuish ? 0 : 1;   // the attract / preview fights stay silent
  for (const e of d.events) {
    const me = e.who === d.a;
    switch (e.type) {
      case 'move': if (vol && e.kind !== 'ult') audio.swing(e.who.cls, e.kind); break;
      case 'hit': {
        const att = e.att, col = new THREE.Color(colorOf(att)), pos = new THREE.Vector3(e.x, ROOF_Y + e.y, 0.3);
        (e.who === d.a ? fa : fb).flash();
        if (vol) audio.hit(e.heavy, att.cls);
        spark(pos, col, e.heavy ? 1.9 : 1.2);
        particles.burst(pos, col, e.heavy ? 46 : 20, { speed: e.heavy ? 7 : 4.5, up: 1.5, life: 0.4, size: e.heavy ? 1 : 0.7, color2: new THREE.Color(1, 1, 1), bright: SPARK_BRIGHT });
        if (e.heavy) waves.spawn(new THREE.Vector3(e.x, ROOF_Y + 0.05, 0), col, { r0: 0.2, r1: 3, h: 0.5, dur: 0.45, a: 1.4 });
        fx.kick({ trauma: e.heavy ? 0.28 : 0.1, aberr: e.heavy ? 0.45 : 0.15, fovKick: e.heavy ? 0.4 : 0 });
        if (!menuish) { const [sx, sy] = xy(e.x, e.y + 0.3); ui.popup(sx, sy, String(e.dmg), '', e.heavy ? 'big' : ''); }
        if (att === d.a && inPlay) { if (!S.demo) S.score += e.dmg * 0.5; if ((e.chain || 0) >= 2) showCombo(e.chain); Platform.haptic(e.heavy ? 'medium' : 'light'); }
        else if (e.who === d.a && inPlay) { ui.flash('rgba(255,43,90,0.14)', 140); Platform.haptic(e.heavy ? 'heavy' : 'medium'); }
        break;
      }
      case 'block': { const pos = new THREE.Vector3(e.x, ROOF_Y + e.y, 0.3); spark(pos, new THREE.Color(0x9ffcff), 0.9); if (vol) audio.block(); break; }
      case 'guardBreak': { if (vol) audio.breakGuard(); if (!menuish) { const [sx, sy] = xy(e.x, e.y + 0.5); ui.popup(sx, sy, t('guardBreak'), '', 'big'); } fx.kick({ aberr: 0.5 }); break; }
      case 'armor': if (!menuish) { const [sx, sy] = xy(e.x, e.y + 0.5); ui.popup(sx, sy, t('armor'), '', ''); } break;
      case 'evade': if (!menuish && me) { const [sx, sy] = xy(e.x, e.y + 0.3); ui.popup(sx, sy, t('evade'), '', ''); if (!S.demo && inPlay) S.score += 30; } break;
      case 'dodge': if (vol) audio.dodge(); break;
      case 'jump': if (vol && me) audio.jump(); break;
      case 'land': if (e.hard) { particles.burst(new THREE.Vector3(e.who.x, ROOF_Y + 0.1, 0), new THREE.Color(0x8899cc), 14, { speed: 2.5, up: 1, life: 0.35, size: 0.6, bright: 1.2 }); if (vol) audio.land(true); } break;
      case 'blink': {
        const c = new THREE.Color(colorOf(e.who));
        for (const x of [e.from, e.to]) particles.burst(new THREE.Vector3(x, ROOF_Y + 1.1 + e.y, 0), c, 26, { speed: 3.5, up: 0.6, life: 0.35, size: 0.8, bright: SPARK_BRIGHT });
        if (vol) audio.blink(); break;
      }
      case 'pillar': { const c = new THREE.Color(colorOf(e.who)); waves.spawn(new THREE.Vector3(e.p.x, ROOF_Y + 0.05, 0), c, { r0: 0.3, r1: 2.6, h: 0.8, dur: 0.4, a: 1.4 }); if (vol) audio.thunder(); fx.kick({ trauma: 0.15 }); break; }
      case 'projEnd': case 'projHit': if (e.p.key === 'meteor') { const c = new THREE.Color(colorOf(e.p.owner)); waves.spawn(new THREE.Vector3(e.p.x, ROOF_Y + 0.05, 0), c, { r0: 0.3, r1: 3.2, h: 0.7, dur: 0.45, a: 1.4 }); particles.burst(new THREE.Vector3(e.p.x, ROOF_Y + 0.3, 0), c, 30, { speed: 5, up: 3, life: 0.5, size: 0.9, bright: SPARK_BRIGHT }); if (vol) audio.boom(); fx.kick({ trauma: 0.2 }); } break;
      case 'ult': ultCinematic(e.who, menuish); break;
      case 'ko': {
        const c = new THREE.Color(colorOf(e.att || (e.who === d.a ? d.b : d.a)));
        if (vol) audio.ko(); fx.kick({ trauma: 0.5, aberr: 0.7, slowmo: 0.9 }); if (!menuish) ui.flash('rgba(255,255,255,0.3)', 240);
        particles.burst(new THREE.Vector3(e.x, ROOF_Y + e.y, 0), c, 90, { speed: 8, up: 3, life: 0.8, size: 1.1, color2: new THREE.Color(1, 1, 1), bright: SPARK_BRIGHT });
        waves.spawn(new THREE.Vector3(e.x, ROOF_Y + 0.05, 0), c, { r0: 0.3, r1: 6, h: 1, dur: 0.7, a: 1.4 });
        if (inPlay) ui.banner(t('ko'), e.who === d.a ? t('down') : t('knockout'), '');
        break;
      }
      case 'cmd': if (me && inPlay) { S.cmdLog.push(e.cmd); if (S.cmdLog.length > 60) S.cmdLog.shift(); } break;
    }
  }
  d.events.length = 0;
}
function ultCinematic(f, quiet) {
  const C = CLASSES[f.cls], m = C.moves.ult, col = hex(colorOf(f));
  if (!quiet) {
    audio.ult();
    const cut = $('ult-cut'); cut.style.setProperty('--uc', col); ui.setText('uc-cls', (f === S.duel.a ? t('you') : nm(S.foe)) + ' · ' + (L() ? C.en : C.zh));
    ui.setText('uc-name', m.name[L()]); ui.setText('uc-en', m.name[1 - L()]);
    cut.classList.remove('hidden'); $('ult-dim').classList.remove('hidden');
    const band = cut.querySelector('.uc-band'); band.style.animation = 'none'; void band.offsetWidth; band.style.animation = '';
    ui.flash('rgba(255,255,255,0.55)', 200);
    later(0.85, () => { cut.classList.add('hidden'); $('ult-dim').classList.add('hidden'); });
    Platform.haptic('heavy');
  }
  particles.burst(new THREE.Vector3(f.x, ROOF_Y + 1.2, 0), new THREE.Color(colorOf(f)), 60, { speed: 5, up: 2, life: 0.7, size: 0.9, bright: SPARK_BRIGHT });
  waves.spawn(new THREE.Vector3(f.x, ROOF_Y + 0.05, 0), new THREE.Color(colorOf(f)), { r0: 0.2, r1: 5, h: 1.6, dur: 0.8, a: 1.3 });
  S.ultCam = { who: f, t: 0.95 };
}

// ------------------------------------------------------------------ fight end / result
function finishDuel() {
  const d = S.duel, won = d.over.winner === 'a', foe = S.foe;
  S.result = { won, by: d.over.by, draw: d.over.winner === 'draw' };
  later(won ? 1.5 : 1.7, () => {
    if (S.state !== 'play') return;
    let record = false, title, en, stats, main, act = 'retry';
    const level = S.mode === 'ladder' ? S.stage + 1 : S.floor + 1;
    const kick = (S.mode === 'ladder' ? t('stageTag', { n: level }) : t('floorTag', { f: level })) + ' · ' + nm(foe);
    if (won) {
      const sc = fightScore(level, d, !!foe.boss); if (!S.demo) S.score += sc.total; audio.victory();
      title = t('victory'); en = d.over.by === 'ko' ? t('koWin') : t('decWin');
      stats = [[t('sLevel'), sc.base], [t('sHp'), sc.hp], [t('sCombo'), `${d.a.stats.maxCombo} · +${sc.combo}`], [sc.perfect ? t('sPerfect') : foe.boss ? t('sBoss') : t('sTime'), sc.perfect ? '+' + sc.perfect : foe.boss ? '+' + sc.boss : sc.time], [t('sTotal'), Math.round(S.score)]];
      main = [t('next'), t('nextS')]; act = 'next';
      if (S.mode === 'ladder') {
        S.stage++;
        if (!isTrial() && !S.demo) { if (S.stage > store.getNum('ladderBest', 0)) { store.setNum('ladderBest', S.stage); record = true; } }
        if (S.stage >= LADDER.length) { act = 'clear'; en = t('ladderClear'); main = [t('menu'), t('ladderClearS')]; if (!S.demo && !isTrial()) store.setNum('ladderClears', store.getNum('ladderClears', 0) + 1); S.stage = 0; }
        if (!isTrial() && !S.demo) { store.setNum('ladder', S.stage); store.setNum('ladderScore', act === 'clear' ? 0 : Math.round(S.score)); }
        if (isTrial() && S.stage >= TRIAL.ladder) act = 'trial';
      } else {
        S.floor++;
        if (!isTrial() && !S.demo) { if (S.floor > store.getNum('bestFloor', 0)) { store.setNum('bestFloor', S.floor); record = true; } store.setNum('floor', S.floor); store.setNum('runScore', Math.round(S.score)); }
        main = [t('nextFloor'), t('nextS')];
        if (isTrial() && S.floor >= TRIAL.endless) act = 'trial';
      }
      if (!isTrial() && !S.demo && store.submitBest(Math.round(S.score))) record = true;
      if (act === 'trial') main = [t('trialTitle'), t('toHubS')];
    } else {
      audio.defeat();
      title = S.result.draw ? t('draw') : t('defeat'); en = S.result.draw ? t('timeOver') : d.over.by === 'ko' ? t('gotKo') : t('timeOver');
      stats = [[t('sHits'), d.a.stats.hits], [t('sDmg'), Math.round(d.a.stats.dmg)], [t('sCombo'), d.a.stats.maxCombo], [t('sFoeHp'), Math.round(d.b.hp / d.b.maxHp * 100) + '%']];
      main = [t('retry'), t('retryS')];
    }
    ui.setText('res-kicker', kick); const te = $('res-title'); te.textContent = title; te.dataset.text = title; te.classList.toggle('danger', !won);
    ui.setText('res-en', en); $('res-record').classList.toggle('hidden', !record);
    $('res-stats').innerHTML = stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    ui.setText('res-main-zh', main[0]); ui.setText('res-main-en', main[1]); $('btn-res-main').dataset.act = act;
    const canRevive = !won && !S.result.draw && d.over.by === 'ko' && !S.revived && ads.rewardedAvailable();
    $('btn-revive').classList.toggle('hidden', !canRevive); ui.setText('revive-sub', ads.isNative ? t('reviveAd') : t('reviveFree'));
    updateHud(); setState('result');
    if (S.demo) later(2.2, () => { if (S.state === 'result') resultMain(); });
  });
}
// interstitials: ONLY after a lost fight (game over), only when the hub allows ads (Free tier). Never after wins / mid-run.
async function gameOverBreak() {
  if (!S.result || S.result.won || !hub.ads || S.demo) return;
  S.adBreaks++; if (await ads.naturalBreak('gameover')) S.interstitials++;
}
async function resultMain() {
  if (S.state !== 'result') return; const act = $('btn-res-main').dataset.act; audio.click();
  if (act === 'trial') { showTrial(); return; }
  if (act === 'clear') { showMenu(); return; }
  if (act === 'next') { startFight(); return; }
  await gameOverBreak(); startFight();
}
async function resultMenu() { if (S.state !== 'result') return; audio.back(); await gameOverBreak(); showMenu(); }
async function revive() {
  if (S.state !== 'result' || S.revived || !S.result || S.result.won) return;
  S.rewardedAsks++;
  const r = await ads.rewarded('revive'); if (!r.rewarded) { ui.toast(t('kit.rewardOffline')); return; }
  S.revived = true; const d = S.duel, a = d.a, b = d.b;
  d.over = null; d.overT = 0; d.projs = []; clearProjMeshes();
  a.hp = Math.round(a.maxHp * 0.5); a.st = 'idle'; a.t = 0; a.y = 0; a.vy = 0; a.vx = 0; a.inv = 1.4; a.mk = null; a.jug = 0; a.jugCap = false;
  b.st = 'idle'; b.t = 0; b.mk = null; b.y = 0; b.vy = 0; b.vx = 0;
  if (Math.abs(b.x - a.x) < 3) b.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, a.x + (a.x < 0 ? 3.5 : -3.5)));
  a.facing = b.x > a.x ? 1 : -1; b.facing = -a.facing; d.time = Math.max(d.time, 25); S.result = null;
  updateHud(true); ui.banner(t('revived'), '50% HP', ''); S.introT = 1.0; setState('intro'); Platform.haptic('success');
}
function showTrial() {
  ui.setText('trial-from', S.mode === 'ladder' ? t('trialLadder') : t('trialEndless'));
  setState('trial');
}
function pause() { if (S.state !== 'play' && S.state !== 'intro') return; S.pausedFrom = S.state; setState('paused'); audio.duckMusic(); }
function resume() { if (S.state !== 'paused') return; S.introT = Math.max(S.introT, 0.4); setState('intro'); audio.unduckMusic(); }

// ------------------------------------------------------------------ input
const ctl = createControls({
  active: () => S.state === 'play' && !S.demo && !ui.modalOpen,
  anyGesture() { audio.init(); audio.startMusic(); },
  onCmd(cmd) { if (S.duel && !S.duel.over) act(S.duel.a, cmd); },
  onAction(a) {
    if (ui.modalOpen) { if (a === 'pause') ui.closeModal(); return; }
    if (a === 'primary') {
      if (S.state === 'menu') { audio.click(); showSelect('ladder'); }
      else if (S.state === 'select') confirmClass();
      else if (S.state === 'result') resultMain();
      else if (S.state === 'paused') resume();
      else if (S.state === 'trial') returnToHub(hub);
    } else if (a === 'pause') {
      if (S.state === 'play' || S.state === 'intro') pause(); else if (S.state === 'paused') resume(); else if (S.state === 'select') { audio.back(); showMenu(); }
    } else if (a === 'mute') { audio.init(); ui.setMuted(audio.toggleMute()); }
    else if (a === 'fps') $('fps').classList.toggle('hidden');
  },
});
ui.on('btn-ladder', () => { audio.init(); audio.click(); showSelect('ladder'); });
ui.on('btn-endless', () => { audio.init(); audio.click(); showSelect('endless'); });
ui.on('btn-class', () => { audio.init(); audio.click(); showSelect(null); });
ui.on('btn-restart-tower', restartTower);
ui.on('btn-fight', confirmClass); ui.on('btn-sel-back', () => { audio.back(); showMenu(); });
ui.on('btn-pause', pause); ui.on('btn-mute', () => { audio.init(); ui.setMuted(audio.toggleMute()); });
ui.on('btn-resume', resume); ui.on('btn-quit', () => { audio.back(); showMenu(); });
ui.on('btn-res-main', resultMain); ui.on('btn-res-menu', resultMenu); ui.on('btn-revive', revive);
ui.on('btn-hub', () => returnToHub(hub)); ui.on('btn-trial-menu', () => { audio.back(); showMenu(); });
Platform.onBack(() => {
  if (ui.closeModal()) return true;
  if (S.state === 'play' || S.state === 'intro') { pause(); return true; }
  if (S.state === 'paused') { resume(); return true; }
  if (S.state === 'result') { resultMenu(); return true; }
  if (S.state === 'select' || S.state === 'trial') { showMenu(); return true; }
  return false;
});
Platform.onPause(() => { if (!S.demo) pause(); });
S.api = {
  cmd: (c) => act(S.duel.a, c), setHp: (who, hp) => { S.duel[who].hp = hp; }, close: (gap = 1.2) => { S.duel.a.x = -gap / 2; S.duel.b.x = gap / 2; S.duel.a.facing = 1; S.duel.b.facing = -1; },
  freezeFoe: (on = true) => { S.freezeFoe = on; }, tank: () => { S.duel.b.hp = S.duel.b.maxHp = 99999; }, setUlt: (v = 100) => { S.duel.a.ult = v; },
  startMode: (mode, opts = {}) => { if (opts.cls) S.cls = opts.cls; if (opts.stage != null) S.stage = opts.stage; if (opts.floor != null) S.floor = opts.floor; if (mode === 'ladder') startLadder(); else startEndless(); },
  pickClass: (id) => pickClass(id), dbg: () => ({ scene, roof, city, particles, waves, fa, fb, stage, THREE }), screenOf: (who) => stage.toScreen(new THREE.Vector3(S.duel[who].x, ROOF_Y + 1.2, 0)),
  hub: () => hub, store: () => ({ ladder: store.getNum('ladder', 0), floor: store.getNum('floor', 0), bestFloor: store.getNum('bestFloor', 0), cls: store.get('cls'), ver: store.getNum('ver', 0), lap: store.get('lap') }),
  fighter: (who) => { const f = S.duel[who]; return { st: f.st, mk: f.mk, x: f.x, y: f.y, hp: f.hp, maxHp: f.maxHp, ult: f.ult, cd: { ...f.cd }, comboN: f.comboN, cls: f.cls, stats: { ...f.stats } }; },
};

// ------------------------------------------------------------------ fixed-step simulation
function simStep() {
  const d = S.duel; if (!d) return;
  const st = S.state;
  if (st === 'select') previewThink(d, DT);
  else if (st === 'menu' || ((st === 'play') && S.demo)) {
    const pa = st === 'menu' ? { diff: S.attract.diffA } : { diff: 0.7 };
    const ca = aiThink(d, d.a, d.b, pa, S.memA, DT); if (ca) act(d.a, ca);
  } else if (st === 'play') { const r = ctl.read(); d.a.in.mx = r.mx; d.a.in.guard = r.guard; }
  else { d.a.in.mx = 0; d.a.in.guard = false; }
  if ((st === 'play' || st === 'menu') && !S.freezeFoe) { const cb = aiThink(d, d.b, d.a, S.foe, S.memB, DT); if (cb) act(d.b, cb); }
  else if (st !== 'select') { d.b.in.mx = 0; d.b.in.guard = false; }
  const wasOver = !!d.over;
  step(d, DT); handleEvents();
  if (!wasOver && d.over) {
    if (st === 'play') finishDuel();
    else if (st === 'menu') later(2.4, () => { if (S.state === 'menu') attractDuel(); });
  }
  if (st === 'select' && d.over) { d.over = null; d.b.hp = d.b.maxHp; }
}

// ------------------------------------------------------------------ camera
const camPos = new THREE.Vector3(0, ROOF_Y + 3, 14), camLook = new THREE.Vector3(0, ROOF_Y + 1.2, 0), tP = new THREE.Vector3(), tL = new THREE.Vector3();
function frameCamera(dt, now, instant = false) {
  const d = S.duel, aspect = stage.width / stage.height, portrait = aspect < 0.9, st = S.state;
  const vfov = portrait ? 52 : 36; camera.fov = vfov - fx.fovKick * 3; camera.updateProjectionMatrix();
  const tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2)), tanH = tanV * aspect;
  const top = d ? Math.max(d.a.y, d.b.y) : 0;
  let mid = d ? (d.a.x + d.b.x) / 2 : 0; const gap = d ? Math.abs(d.a.x - d.b.x) : 3;
  const span = Math.max(portrait ? 3.9 : 6.4, gap + (portrait ? 2.0 : 3.8));
  let dist = Math.max(span / 2 / tanH, (portrait ? 2.6 : 3.0 + top * 0.25) / tanV);
  // portrait: fighters sit in the upper half (controls below) → look below them
  let ly = ROOF_Y + (portrait ? 0.45 : 1.35) + top * 0.35, yaw = Math.sin(now * 0.2) * 0.035, pitch = 0.1;
  if (st === 'menu') { yaw = 0.22 + Math.sin(now * 0.15) * 0.07; pitch = 0.14; if (!portrait) dist *= 1.25; else { ly = ROOF_Y - 0.2; dist *= 1.15; } }
  if (st === 'select') { dist = portrait ? 8.2 : 7.6; yaw = 0.28 + Math.sin(now * 0.3) * 0.05; pitch = 0.06; ly = portrait ? ROOF_Y - 0.9 : ROOF_Y + 1.25; mid = d ? (d.a.x + d.b.x) / 2 : 0; }
  if (S.ultCam && S.ultCam.t > 0 && d) { const f = S.ultCam.who; mid = THREE.MathUtils.lerp(mid, f.x, 0.75); dist *= portrait ? 0.74 : 0.64; ly = ROOF_Y + (portrait ? 0.7 : 1.3) + f.y; yaw = f.facing * 0.32; }
  const ko = d && d.over && d.over.by === 'ko' && st === 'play'; if (ko) dist *= 0.85;
  const lx = THREE.MathUtils.clamp(mid, -4.5, 4.5);
  tL.set(lx, ly, 0); tP.set(lx + Math.sin(yaw) * dist, ly + Math.sin(pitch) * dist + (portrait ? 0.6 : 0), Math.cos(yaw) * dist);
  if ((st === 'menu' || st === 'select') && !portrait) { const sh = dist * tanH * (st === 'select' ? -0.4 : 0.42); tL.x -= sh * Math.cos(yaw); tP.x -= sh * Math.cos(yaw); tL.z += sh * Math.sin(yaw); tP.z += sh * Math.sin(yaw); }
  const k = instant ? 1 : 1 - Math.exp(-dt * (S.ultCam && S.ultCam.t > 0 ? 7 : 4)); camPos.lerp(tP, k); camLook.lerp(tL, k);
  camera.position.copy(camPos); camera.lookAt(camLook); fx.shake(camera, now, 0.45);
}

// ------------------------------------------------------------------ frame loop
function tick(dt, now) {
  U.uTime.value = now; theme.update(dt); fx.update(dt);
  const d = S.duel;
  if (S.state !== 'paused') {
    for (const tm of timers.slice()) { tm.t -= dt; if (tm.t <= 0) { timers.splice(timers.indexOf(tm), 1); tm.fn(); } }
    if (S.state === 'intro') { S.introT -= dt; if (S.introT <= 0) { setState('play'); if (!S.duel.over) { ui.banner(t('fight'), t('fightS'), ''); audio.bell(2); } } }
    if (d && S.state !== 'trial') {
      S.acc += dt * (fx.timeScale ?? 1); let n = 0;
      while (S.acc >= DT && n < 8) { S.acc -= DT; n++; if (S.state === 'intro') { d.a.in.mx = 0; d.b.in.mx = 0; handleEvents(); break; } simStep(); }
      if (S.acc > DT * 2) S.acc = 0;
    }
    if (S.comboShown > 0) { S.comboShown -= dt; if (S.comboShown <= 0) $('combo').classList.add('hidden'); }
    if (S.ultCam) { S.ultCam.t -= dt; if (S.ultCam.t <= 0 && !(d && d.freeze > 0)) S.ultCam = null; }
    if (S.state === 'play' || S.state === 'result' || S.state === 'intro') updateHud();
  }
  if (d) {
    const paused = S.state === 'paused', stop = d.stop > 0 || paused, fz = d.freeze > 0;
    fa.update(d.a, dt, now, ROOF_Y, stop || (fz && d.freezeBy !== d.a), d.stop > 0 && !paused ? 0.05 : 0);
    fb.update(d.b, dt, now, ROOF_Y, stop || (fz && d.freezeBy !== d.b), d.stop > 0 && !paused ? 0.05 : 0);
    syncProjs(paused ? 0 : dt);
  }
  roof.update(now); particles.update(dt); waves.update(dt); updateStars(dt);
  city.update(now, dt, camera); frameCamera(dt, now); fx.applyPost(stage, now); ui.tick(dt); stage.render(dt);
}
i18n.bindToggle($('btn-lang')); i18n.bindToggle($('btn-lang2'));
i18n.onChange(() => {
  syncGlitch(); refreshMenu();
  if (S.state === 'select') { buildTabs(); pickClass(S.selCls, true); ui.setText('sel-mode', S.selNext === 'ladder' ? t('ladder') : S.selNext === 'endless' ? t('endless') : t('changeClsS')); }
  if (S.duel && S.foe && ['play', 'intro', 'paused', 'result'].includes(S.state)) { hudNames(); setSkillLabels(); }
});
syncGlitch();
async function boot() {
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  showMenu(); frameCamera(0, 0, true); ui.loaded();
  if (S.demo) { S.cls = CLASSES[flags.get('cls')] ? flags.get('cls') : CLASS_IDS[Math.floor(Math.random() * 4)]; S.floor = Math.max(0, Math.floor(flags.num('floor', 0))); startEndless(); }
  stage.loop(tick, { isActive: () => S.state === 'play', fpsEl: $('fps') });
  if (flags.fps) $('fps').classList.remove('hidden');
  ads.init().catch(() => {});
}
boot().catch((e) => { console.error(e); ui.fatal('載入失敗 Failed to start: ' + e.message); });
