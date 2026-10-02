// NEON STICK DUEL — one-thumb 3D stick-figure duel, 8-floor rooftop tower.
import * as THREE from 'three';
import { i18n, t, flags, createStore, createStage, ThemeController, U, Particles, Shockwaves, FxState, NeonCity, createInput, CyberUI, Platform, createAds } from 'cyber-kit';
import { GAME_ID, makeDuel, act, step, aiThink, TOWER, TUNE, floorScore, guardBreak, opponentFor, isMilestone } from './duel.js';
import './strings.js';
import { StickFighter } from './stickman.js';
import { Rooftop, ROOF_Y } from './world.js';
import { DuelAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);
if (flags.reset) store.clear();
const ui = new CyberUI({ screens: ['start', 'pause', 'result'] });
const stage = createStage({ canvas: $('scene'), bloom: 0.9, bloomRadius: 0.5, bloomThreshold: 0.78, fov: 42, exposure: 1.05, onFatal: (m) => ui.fatal(m) });
const { scene, camera } = stage;
const theme = new ThemeController(); theme.set(0, true);
const city = new NeonCity(stage, { floor: 'reflect', innerRadius: 16, buildings: 280, billboard: { zh: '天台決鬥', en: 'R O O F T O P   D U E L', pos: [-18, 20, -44], width: 26 }, dustArea: 26, dustHeight: 12 });
const roof = new Rooftop(scene);
const particles = new Particles(scene, 2200, { floorY: ROOF_Y + 0.02 });
stage.onResize((w, h, pr) => particles.resize(h, pr));
const waves = new Shockwaves(scene, 10);
const fx = new FxState();
const audio = new DuelAudio(store); ui.setMuted(audio.muted);
const ads = createAds({ gameId: GAME_ID, interstitialCooldownSec: 180, breaksBetweenInterstitials: 3, graceSec: 150, units: { android: {} }, onAdOpen: (on) => audio.duckAll(on) });
const ME_COLOR = 0x00e5ff;
const DEMO_PROFILE = { ...TOWER[5], id: 'demo', mirror: false, think: 0.28, combo: 0.75, heavy: 0.3 };

const S = { state: 'menu', demo: !!flags.demo, floor: store.getNum('floor', 0) + store.getNum('lap', 0) * 8, score: store.getNum('runScore', 0),
  duel: null, memA: {}, memB: {}, hitstop: 0, introT: 0, combo: 0, comboT: 0, revived: false, holding: false, holdPos: null, result: null, lastCmdT: 0, gestureT: 0, cmdLog: [] };
window.__duel = S;  // test hook
const fa = new StickFighter(scene, ME_COLOR), fb = new StickFighter(scene, TOWER[0].color);

const prof = () => opponentFor(S.floor);
const pName = (p) => i18n.lang === 'en' ? p.en : p.zh, pDesc = (p) => i18n.lang === 'en' ? p.descEn : p.desc;
const syncGlitch = () => document.querySelectorAll('.glitch').forEach((e) => { e.dataset.text = e.textContent; });
function newDuel(attract = false) {
  const p = attract ? TOWER[[1, 2, 3, 4, 6, 7][Math.floor(Math.random() * 6)]] : prof();
  const hp = p.hp;
  S.duel = makeDuel(hp); S.duel.b.walkMul = p.walk; S.memA = {}; S.memB = {}; S.combo = 0; S.hitstop = 0; S.attractProf = p;
  fb.setColor(p.color); document.documentElement.style.setProperty('--foe', '#' + new THREE.Color(p.color).getHexString());
  roof.setAccent(ME_COLOR, p.color); theme.set(attract ? 0 : (S.floor < 8 ? S.floor : Math.floor(S.floor / 10) + 2), false);
}

function setState(s) {
  S.state = s; ui.show({ menu: 'start', paused: 'pause', result: 'result' }[s] || null);
  ui.hud(s === 'play' || s === 'intro' || s === 'paused' || s === 'result'); $('demo-tag').classList.toggle('hidden', !S.demo);
}
function refreshMenu() {
  const bf = store.getNum('bestFloor', 0);
  ui.setText('start-floor', bf ? bf + 'F' : '—'); ui.setText('start-best', store.best);
  const cont = S.floor > 0;
  ui.setText('start-label', cont ? t('cont', { f: S.floor + 1 }) : t('climb')); ui.setText('start-sub', cont ? t('contS', { name: pName(prof()) }) : t('climbS'));
  $('btn-restart-tower').classList.toggle('hidden', !cont);
}
function showMenu() { newDuel(true); refreshMenu(); setState('menu'); }

function startFloor() {
  audio.init(); audio.startMusic(); newDuel(false); S.revived = false;
  const p = prof();
  hudNames();
  ui.setText('hud-score', S.score); updateHp(true);
  ui.banner(t('floorBanner', { f: S.floor + 1, name: pName(p) }), i18n.lang === 'en' ? p.zh : p.en, pDesc(p));
  if (S.floor > 0 && S.floor % 10 === 0) later(0.9, () => ui.toast(t('milestone', { f: S.floor }) + ' · ' + t('milestoneS')));
  S.introT = 1.6; setState('intro'); audio.bell(1);
  $('gesture-bar').classList.remove('fade'); S.gestureT = 0;
}
function begin() { if (S.state !== 'menu') return; audio.click(); startFloor(); }
function restartTower() { S.floor = 0; S.score = 0; saveRun(); audio.click(); startFloor(); }
function saveRun() { store.setNum('floor', S.floor); store.setNum('lap', 0); store.setNum('runScore', S.score); }
function hudNames() { const p = prof(); ui.setText('hp-name-b', pName(p)); ui.setText('hp-en-b', i18n.lang === 'en' ? p.zh : p.en); ui.setText('hud-floor', t('floorTag', { f: S.floor + 1 }) + (p.endless ? ' · ' + t('endlessTag') : '')); }

// ------------------------------------------------------------------ HUD
let lastHpA = -1, lastHpB = -1;
function updateHp(force = false) {
  const d = S.duel; if (!d) return;
  const pa = d.a.hp / d.a.maxHp * 100, pb = d.b.hp / d.b.maxHp * 100;
  if (force || pa !== lastHpA) { $('hp-fill-a').style.width = pa + '%'; $('hp-lag-a').style.width = pa + '%'; $('hp-fill-a').classList.toggle('low', pa < 30); lastHpA = pa; }
  if (force || pb !== lastHpB) { $('hp-fill-b').style.width = pb + '%'; $('hp-lag-b').style.width = pb + '%'; $('hp-fill-b').classList.toggle('low', pb < 30); lastHpB = pb; }
  const tm = Math.ceil(d.time); const te = $('hud-time'); if (te.textContent !== String(tm)) { te.textContent = tm; te.classList.toggle('low', tm <= 10); }
}
function showCombo() { const c = $('combo'); if (S.combo >= 2) { c.textContent = t('hits', { n: S.combo }); c.classList.remove('hidden', 'pop'); void c.offsetWidth; c.classList.add('pop'); } }

// ------------------------------------------------------------------ commands
function playerCmd(cmd) {
  if (S.state !== 'play' || S.demo || !S.duel || S.duel.over) return false;
  const ok = act(S.duel.a, cmd);
  if (ok) { S.cmdLog.push(cmd); if (S.cmdLog.length > 50) S.cmdLog.shift(); cmdFx(S.duel.a, cmd); if (S.memB) S.memB.lastSeen = cmd; S.gestureT += 1; if (S.gestureT > 12) $('gesture-bar').classList.add('fade'); }
  return ok;
}
function cmdFx(f, cmd) {
  if (cmd === 'jab') audio.swing(false); else if (cmd === 'chargeRelease') { audio.swing(true); if (guardBreak(f)) fx.kick({ aberr: 0.8 }); }
  else if (cmd === 'dashF' || cmd === 'dashB') { audio.dash(); particles.burst(new THREE.Vector3(f.x, ROOF_Y + 0.9, 0), new THREE.Color(f === S.duel.a ? ME_COLOR : prof().color), 16, { speed: 3, up: 0.5, life: 0.35, size: 0.7 }); }
  else if (cmd === 'jump') audio.jump();
}
const relDash = (d) => { const f = S.duel && S.duel.a; if (!f) return null; const dirX = d === 'right' ? 1 : -1; return dirX === f.facing ? 'dashF' : 'dashB'; };

// ------------------------------------------------------------------ duel events → effects
function handleEvents() {
  const d = S.duel;
  for (const e of d.events) {
    const isMe = e.who === d.a, col = new THREE.Color(isMe ? prof().color : ME_COLOR), pos = new THREE.Vector3(e.x, ROOF_Y + (e.y ?? 1.2), 0);
    if (e.type === 'hit') {
      (isMe ? fa : fb).flash(); audio.hit(e.heavy);
      particles.burst(pos, col, e.heavy ? 70 : 28, { speed: e.heavy ? 8 : 5, up: 2, life: 0.55, size: e.heavy ? 1.2 : 0.8, color2: new THREE.Color(1, 1, 1) });
      if (e.heavy) waves.spawn(new THREE.Vector3(e.x, ROOF_Y + 0.05, 0), col, { r0: 0.2, r1: 3.5, h: 0.6, dur: 0.5 });
      if (e.breakGuard) { audio.breakGuard(); ui.popup(...xy(pos, 0.4), t('guardBreak'), '', 'big'); }
      fx.kick({ trauma: e.heavy ? 0.35 : 0.12, aberr: e.heavy ? 0.7 : 0.25, fovKick: e.heavy ? 0.5 : 0 }); S.hitstop = e.heavy ? 0.12 : 0.05;
      const sp = xy(pos, 0); ui.popup(sp[0], sp[1], '-' + e.dmg, '', e.heavy ? 'big' : '');
      if (!isMe) { S.combo = S.comboT > 0 ? S.combo + 1 : 1; S.comboT = 1.2; showCombo(); Platform.haptic(e.heavy ? 'medium' : 'light'); if (!S.demo) S.score += e.dmg * 5; }
      else { S.combo = 0; $('combo').classList.add('hidden'); ui.flash('rgba(255,43,214,0.18)', 160); Platform.haptic(e.heavy ? 'heavy' : 'medium'); }
    } else if (e.type === 'parry') {
      (e.who === d.a ? fa : fb).parryFlash(); audio.parry(); fx.kick({ aberr: 0.5, slowmo: 0.5 }); S.hitstop = 0.1;
      particles.burst(pos, new THREE.Color(0x9ffcff), 40, { speed: 6, up: 2, life: 0.5, size: 0.9 });
      const sp = xy(pos, 0.3); ui.popup(sp[0], sp[1], t('parry'), '', 'big');
      if (e.who === d.a) { Platform.haptic('success'); if (!S.demo) S.score += 150; }
    } else if (e.type === 'evade') {
      const sp = xy(pos, 0.2); ui.popup(sp[0], sp[1], t('evade'), '', ''); if (e.who === d.a && !S.demo) S.score += 50;
    } else if (e.type === 'ko') {
      audio.ko(); fx.kick({ trauma: 0.6, aberr: 1.2, glitch: 0.6, slowmo: 1 }); S.hitstop = 0.25; ui.flash('rgba(255,255,255,0.4)', 260);
      particles.burst(pos, col, 140, { speed: 10, up: 4, life: 1, size: 1.3, color2: new THREE.Color(1, 1, 1) });
      waves.spawn(new THREE.Vector3(e.x, ROOF_Y + 0.05, 0), col, { r0: 0.3, r1: 7, h: 1.2, dur: 0.8 });
      if (S.state === 'play') ui.banner(t('ko'), e.who === d.a ? t('down') : t('knockout'), '');
    }
  }
  d.events.length = 0;
}
const xy = (v, dy) => { const s = stage.toScreen(v.clone().add(new THREE.Vector3(0, dy, 0))); return [s.x, s.y]; };

// ------------------------------------------------------------------ floor end / result
function finishDuel() {
  const d = S.duel, w = d.over.winner, p = prof();
  S.result = { won: w === 'a', by: d.over.by };
  setTimeout(() => {}, 0);
  later(S.result.won ? 1.6 : 1.8, () => {
    let record = false, kick, title, en, stats, main;
    if (S.result.won) {
      const sc = floorScore(S.floor + 1, d); S.score += sc.total; audio.victory();
      const cleared = S.floor + 1; if (cleared > store.getNum('bestFloor', 0)) { store.setNum('bestFloor', cleared); record = true; }
      if (store.submitBest(S.score)) record = true;
      const top = S.floor === TOWER.length - 1, ms = isMilestone(S.floor);
      kick = `${t('floorTag', { f: S.floor + 1 })} · ${pName(p)} · ${d.over.by === 'ko' ? 'K.O.' : t('timeOver')}`; title = t('victory'); en = top ? t('endlessUnlocked') : ms ? t('milestone', { f: S.floor + 1 }) : d.over.by === 'ko' ? t('koWin') : t('decWin');
      stats = [[t('sFloor'), sc.base], [t('sHp'), sc.hp], ms ? [t('sMilestone'), '+' + sc.milestone] : [t('sTime'), sc.time], [sc.perfect ? t('sPerfect') : t('sTotal'), sc.perfect ? '+' + sc.perfect : S.score]];
      main = [t('next'), t('nextS')];
      S.floor++;
      saveRun();
    } else {
      audio.defeat();
      kick = `${t('floorTag', { f: S.floor + 1 })} · ${pName(p)}`; title = d.over.winner === 'draw' ? t('draw') : t('defeat'); en = d.over.winner === 'draw' ? '' : d.over.by === 'ko' ? t('gotKo') : t('timeOver');
      stats = [[t('sHits'), d.a.stats.hits], [t('sParries'), d.a.stats.parries], [t('sFoeHp'), Math.round(d.b.hp / d.b.maxHp * 100) + '%'], [t('sTotal'), S.score]];
      main = [t('retry'), t('retryS')];
    }
    ui.setText('res-kicker', kick); const te = $('res-title'); te.textContent = title; te.dataset.text = title; te.classList.toggle('danger', !S.result.won);
    ui.setText('res-en', en); $('res-record').classList.toggle('hidden', !record);
    $('res-stats').innerHTML = stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    ui.setText('res-main-zh', main[0]); ui.setText('res-main-en', main[1]);
    const canRevive = !S.result.won && d.over.by === 'ko' && !S.revived && ads.rewardedAvailable();
    $('btn-revive').classList.toggle('hidden', !canRevive); ui.setText('revive-sub', ads.isNative ? t('reviveAd') : t('reviveFree'));
    ui.setText('hud-score', S.score); setState('result');
    if (S.demo) later(2.2, () => { if (S.state === 'result') nextFromResult(); });
  });
}
async function nextFromResult() { if (S.state !== 'result') return; audio.click(); await ads.naturalBreak('floor'); startFloor(); }
async function resultMenu() { if (S.state !== 'result') return; audio.back(); await ads.naturalBreak('floor'); showMenu(); }
async function revive() {
  if (S.state !== 'result' || S.revived || !S.duel || S.result.won) return;
  const r = await ads.rewarded('revive'); if (!r.rewarded) return;
  S.revived = true; const d = S.duel; d.over = null; d.a.hp = Math.round(d.a.maxHp * 0.5); d.a.st = 'idle'; d.a.y = 0; d.a.vx = 0; d.a.invuln = 1.2;
  d.b.st = 'idle'; d.b.x = d.a.x + d.a.facing * 3; d.time = Math.max(d.time, 20); updateHp(true);
  ui.banner(t('revived'), '50% HP', ''); S.introT = 1.0; setState('intro');
}
function pause() { if (S.state !== 'play' && S.state !== 'intro') return; S.pausedFrom = S.state; setState('paused'); audio.duckMusic(); endHold(); }
function resume() { if (S.state !== 'paused') return; setState(S.pausedFrom || 'play'); audio.unduckMusic(); }
const timers = []; const later = (t, fn) => timers.push({ t, fn });

// ------------------------------------------------------------------ input
function startHold(p) { if (playerCmd('chargeStart')) { S.holding = true; S.holdPos = p; const r = $('charge-ring'); r.style.left = p.x + 'px'; r.style.top = p.y + 'px'; r.classList.remove('hidden', 'full'); S.fullCue = false; } }
function endHold(fromPointer = false) {
  if (!S.holding) return; S.holding = false; $('charge-ring').classList.add('hidden');
  // a swipe that began as a (very short) hold: let the swipe win instead of firing a weak heavy
  if (fromPointer && S.duel && S.duel.a.st === 'wind' && S.duel.a.charge < 0.2) { S.pendingRelease = true; queueMicrotask(() => { if (S.pendingRelease) { S.pendingRelease = false; playerCmd('chargeRelease'); } }); return; }
  playerCmd('chargeRelease');
}
function cancelPendingCharge() { if (!S.pendingRelease) return; S.pendingRelease = false; const f = S.duel.a; if (f.st === 'wind') { f.st = 'idle'; f.charge = 0; } }
createInput({
  anyGesture() { audio.init(); audio.startMusic(); },
  tap() { if (ui.modalOpen) return; if (S.state === 'play') playerCmd('jab'); },
  holdStart(p) { if (S.state === 'play' && !ui.modalOpen) startHold(p); },
  holdEnd() { endHold(true); },
  dir(d, info) {
    if (S.state !== 'play' || (info && info.repeat)) return;
    cancelPendingCharge();
    if (d === 'up') playerCmd('jump'); else if (d === 'down') playerCmd('parry'); else { const c = relDash(d); if (c) playerCmd(c); }
  },
  action(a) {
    if (ui.modalOpen) { if (a === 'pause') ui.closeModal(); return; }
    if (a === 'primary' || a === 'jab') { if (S.state === 'play') playerCmd('jab'); else if (S.state === 'menu') begin(); else if (S.state === 'result') nextFromResult(); else if (S.state === 'paused') resume(); }
    else if (a === 'pause') { if (S.state === 'play' || S.state === 'intro') pause(); else if (S.state === 'paused') resume(); }
    else if (a === 'mute') { audio.init(); ui.setMuted(audio.toggleMute()); }
    else if (a === 'fps') $('fps').classList.toggle('hidden');
  },
}, { swipe: 'once', threshold: 34, holdMs: 200, tapMaxMove: 16, actions: { KeyJ: 'jab', KeyZ: 'none', KeyU: 'none', Backspace: 'none', KeyR: 'none', KeyC: 'none' } });
// keyboard charge: hold K (or L)
window.addEventListener('keydown', (e) => { if ((e.code === 'KeyK' || e.code === 'KeyL') && !e.repeat && S.state === 'play') { e.preventDefault(); if (playerCmd('chargeStart')) { S.holding = true; const r = $('charge-ring'); r.style.left = (stage.width / 2) + 'px'; r.style.top = (stage.height * 0.7) + 'px'; r.classList.remove('hidden', 'full'); S.fullCue = false; } } });
window.addEventListener('keyup', (e) => { if (e.code === 'KeyK' || e.code === 'KeyL') endHold(); });
ui.on('btn-start', begin); ui.on('btn-restart-tower', restartTower);
ui.on('btn-pause', pause); ui.on('btn-mute', () => { audio.init(); ui.setMuted(audio.toggleMute()); });
ui.on('btn-resume', resume); ui.on('btn-quit', () => { audio.back(); showMenu(); });
ui.on('btn-res-main', nextFromResult); ui.on('btn-res-menu', resultMenu); ui.on('btn-revive', revive);
Platform.onBack(() => { if (ui.closeModal()) return true; if (S.state === 'play' || S.state === 'intro') { pause(); return true; } if (S.state === 'paused') { resume(); return true; } if (S.state === 'result') { resultMenu(); return true; } return false; });
Platform.onPause(() => { if (!S.demo) pause(); });
S.api = {
  cmd: (c) => act(S.duel.a, c), setHp: (who, hp) => { S.duel[who].hp = hp; }, close: (gap = 1) => { S.duel.a.x = -gap / 2; S.duel.b.x = gap / 2; },
  freezeFoe: (on = true) => { S.freezeFoe = on; }, tank: () => { S.duel.b.hp = S.duel.b.maxHp = 9999; }, screenOf: (who) => stage.toScreen(new THREE.Vector3(S.duel[who].x, ROOF_Y + 1.2, 0)),
};

// ------------------------------------------------------------------ camera + loop
const camPos = new THREE.Vector3(0, ROOF_Y + 3, 14), camLook = new THREE.Vector3(0, ROOF_Y + 1.2, 0), tP = new THREE.Vector3(), tL = new THREE.Vector3();
function frameCamera(dt, now, instant = false) {
  const d = S.duel, aspect = stage.width / stage.height, portrait = aspect < 0.9, menu = S.state === 'menu';
  const vfov = portrait ? 50 : 38; camera.fov = vfov - fx.fovKick * 4; camera.updateProjectionMatrix();
  const tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2)), tanH = tanV * aspect;
  const mid = d ? (d.a.x + d.b.x) / 2 : 0, gap = d ? Math.abs(d.a.x - d.b.x) : 3;
  const span = Math.max(portrait ? 4.6 : 6.2, gap + (portrait ? 2.6 : 3.6));
  let dist = Math.max(span / 2 / tanH, (portrait ? 3.2 : 2.9) / tanV);
  const ko = d && d.over && d.over.by === 'ko' && S.state === 'play';
  if (ko) dist *= 0.8;
  let lx = THREE.MathUtils.clamp(mid, -4, 4), ly = ROOF_Y + (portrait ? 1.05 : 1.45), yaw = Math.sin(now * 0.2) * 0.04, pitch = 0.1;
  if (menu) { yaw = 0.22 + Math.sin(now * 0.15) * 0.08; pitch = 0.14; if (!portrait) { dist *= 1.25; } else { ly = ROOF_Y + 0.2; dist *= 1.1; } }
  tL.set(lx, ly, 0); tP.set(lx + Math.sin(yaw) * dist, ly + Math.sin(pitch) * dist, Math.cos(yaw) * dist);
  if (menu && !portrait) { const sh = dist * tanH * 0.42; tL.x -= sh * Math.cos(yaw); tP.x -= sh * Math.cos(yaw); tL.z += sh * Math.sin(yaw); tP.z += sh * Math.sin(yaw); }
  const k = instant ? 1 : 1 - Math.exp(-dt * 4); camPos.lerp(tP, k); camLook.lerp(tL, k); camera.position.copy(camPos); camera.lookAt(camLook); fx.shake(camera, now, 0.5);
}

let chargeTick = 0;
function tick(dt, now) {
  U.uTime.value = now; theme.update(dt); fx.update(dt);
  const d = S.duel;
  if (S.state !== 'paused') {
    for (const tm of timers.slice()) { tm.t -= dt; if (tm.t <= 0) { timers.splice(timers.indexOf(tm), 1); tm.fn(); } }
    const sdt = dt * (fx.timeScale ?? 1);
    if (S.state === 'intro') { S.introT -= dt; if (S.introT <= 0) { setState('play'); ui.banner(t('fight'), t('fightS'), ''); audio.bell(2); } }
    if (S.hitstop > 0) S.hitstop -= dt;
    else if (d && (S.state === 'play' || S.state === 'menu' || S.state === 'result')) {
      // AI
      if (S.state === 'play' || S.state === 'menu') {
        const pB = S.state === 'menu' ? S.attractProf : prof();
        if (!S.freezeFoe) { const cb = aiThink(d, d.b, d.a, pB, S.memB, sdt); if (cb) { const ok = act(d.b, cb); if (ok) cmdFx(d.b, cb); } }
        if (S.demo || S.state === 'menu') { const ca = aiThink(d, d.a, d.b, DEMO_PROFILE, S.memA, sdt); if (ca && act(d.a, ca)) cmdFx(d.a, ca); }
      }
      const wasOver = !!d.over; step(d, sdt); handleEvents();
      if (!wasOver && d.over) { if (S.state === 'play') finishDuel(); else if (S.state === 'menu') later(2.5, () => { if (S.state === 'menu') newDuel(true); }); }
      S.comboT = Math.max(0, S.comboT - sdt); if (S.comboT <= 0 && S.combo) { S.combo = 0; $('combo').classList.add('hidden'); }
      if (S.holding && d.a.st === 'wind') {
        const c = Math.min(1, d.a.charge / TUNE.chargeMax); $('charge-arc').style.strokeDashoffset = 264 * (1 - c);
        if (c >= 1 && !S.fullCue) { S.fullCue = true; $('charge-ring').classList.add('full'); audio.full(); Platform.haptic('light'); }
        chargeTick += dt; if (chargeTick > 0.12) { chargeTick = 0; audio.charge(c); }
      } else if (S.holding && d.a.st !== 'wind') { S.holding = false; $('charge-ring').classList.add('hidden'); }
      if (S.state === 'play') updateHp();
      ui.setText('hud-score', S.score);
    }
  }
  if (d) { fa.update(d.a, dt, now, ROOF_Y); fb.update(d.b, dt, now, ROOF_Y);
    for (const [f, sf, c] of [[d.a, fa, ME_COLOR], [d.b, fb, null]]) if ((f.st === 'attack' && f.phase === 'active') || f.st === 'dash' || f.st === 'dive') {
      const p = f.move === 'kick' || f.st === 'dive' ? sf.joints.footF : f.st === 'dash' ? sf.joints.hip : sf.joints.handF;
      particles.emit(p, new THREE.Vector3(-f.facing * 0.5, 0.2, 0), new THREE.Color(c ?? (S.state === 'menu' ? S.attractProf.color : prof().color)), { life: 0.3, size: 0.8 });
    } }
  roof.update(now); particles.update(dt); waves.update(dt);
  city.update(now, dt, camera); frameCamera(dt, now); fx.applyPost(stage, now); ui.tick(dt); stage.render(dt);
}
i18n.bindToggle($('btn-lang')); i18n.bindToggle($('btn-lang2'));
i18n.onChange(() => { syncGlitch(); refreshMenu(); if (S.duel && S.state !== 'menu') hudNames(); });
syncGlitch();
async function boot() {
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
  showMenu(); frameCamera(0, 0, true); ui.loaded();
  if (S.demo) startFloor();
  stage.loop(tick, { isActive: () => S.state === 'play', fpsEl: $('fps') });
  if (flags.fps) $('fps').classList.remove('hidden');
  ads.init().catch(() => {});
}
boot().catch((e) => { console.error(e); ui.fatal('載入失敗 Failed to start: ' + e.message); });
