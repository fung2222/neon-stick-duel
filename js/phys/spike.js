// PHYS P1 — Planck neon ragdoll duel: grab/throw weapons, impact damage, AI dummy.
// Booted from main.js when ?phys=1 (classic path untouched). Soft joints kept.
import * as THREE from 'three';
import { i18n, t, Platform } from 'cyber-kit';
import { createControls } from '../controls.js';
import { ROOF_Y } from '../world.js';
import {
  makePhysWorld, driveRagdoll, stepWorld, applyHit, snapshotParts, snapshotWeapons,
  torsoPose, nearestFreeWeapon, DT, ARENA, WEAPON_DEFS,
} from './ragdoll.js';
import { NeonRagdollView, NeonWeaponView } from './neon-view.js';

const $ = (id) => document.getElementById(id);

export async function runPhysSpike(ctx) {
  const { stage, scene, camera, roof, city, ui, audio, particles, waves, fx, flags } = ctx;
  const L = () => (i18n.lang === 'en' ? 1 : 0);

  if (ctx.fa) ctx.fa.visible = false;
  if (ctx.fb) ctx.fb.visible = false;

  let phys = makePhysWorld();
  const va = new NeonRagdollView(scene, ROOF_Y);
  const vb = new NeonRagdollView(scene, ROOF_Y);
  const vw = new NeonWeaponView(scene, ROOF_Y);
  va.setColor(0x00e5ff); vb.setColor(0xff2bd6);
  va.build(); vb.build();

  roof.setAccent?.(0x00e5ff, 0xff2bd6);
  document.documentElement.style.setProperty('--me', '#00e5ff');
  document.documentElement.style.setProperty('--foe', '#ff2bd6');

  const S = {
    state: 'menu', acc: 0, time: 60, over: null, score: 0, introT: 0,
    aiMem: { punchT: 0, jumpT: 0, grabT: 0, throwT: 0 },
  };
  window.__phys = S;
  window.__duel = {
    state: 'menu', demo: !!flags.demo, phys: true, physVer: 1,
    api: {
      punch: () => { S._forcePunch = true; },
      jump: () => { S._forceJump = true; },
      grab: () => { S._forceGrab = true; },
      throw: () => { S._forceThrow = true; },
      setHp: (who, hp) => {
        const d = who === 'a' ? phys.a : phys.b; d.hp = Math.max(0, hp);
        if (d.hp <= 0 && d.alive) {
          d.alive = false;
          for (const j of Object.values(d.joints)) { j.enableMotor(false); j.setMaxMotorTorque(0); }
        }
      },
      snapshot: () => ({
        a: snapshotParts(phys.a), b: snapshotParts(phys.b),
        weapons: snapshotWeapons(phys.weapons),
        heldA: phys.a.held?.id || null, heldB: phys.b.held?.id || null,
        over: S.over, time: S.time, hpA: phys.a.hp, hpB: phys.b.hp,
      }),
      start: () => startFight(),
    },
  };

  $('hp-name-a').textContent = L() ? 'YOU' : '你';
  $('hp-cls-a').textContent = 'PHYS';
  $('hp-name-b').textContent = L() ? 'FOE' : '對手';
  $('hp-cls-b').textContent = 'RAGDOLL';
  $('lbl-s1').textContent = L() ? 'GRAB' : '拾取';
  $('lbl-s2').textContent = L() ? 'THROW' : '投擲';

  let tag = document.getElementById('phys-tag');
  if (!tag) {
    tag = document.createElement('div');
    tag.id = 'phys-tag';
    tag.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;padding:6px 14px;border:1px solid #00e5ff;color:#7ff6ff;font:700 11px Orbitron,sans-serif;letter-spacing:.12em;background:rgba(5,1,15,.75);pointer-events:none';
    document.body.appendChild(tag);
  }
  tag.textContent = 'PHYS P1 · ?phys=1 · weapons · impact';

  const ctl = createControls({
    active: () => S.state === 'play' && !flags.demo && !ui.modalOpen,
    anyGesture() { audio.init(); audio.startMusic(); },
    onCmd(cmd) {
      if (S.state !== 'play' || S.over) return;
      if (cmd === 'atk') S._forcePunch = true;
      if (cmd === 'jump') S._forceJump = true;
      if (cmd === 's1') S._forceGrab = true;
      if (cmd === 's2') S._forceThrow = true;
    },
    onAction(a) {
      if (a === 'pause') {
        if (S.state === 'play') { S.state = 'paused'; ui.show('pause'); ui.hud(true); }
        else if (S.state === 'paused') { S.state = 'play'; ui.show(null); ui.hud(true); }
      } else if (a === 'mute') { audio.init(); ui.setMuted(audio.toggleMute()); }
      else if (a === 'primary') {
        if (S.state === 'menu' || S.state === 'result') startFight();
        else if (S.state === 'paused') { S.state = 'play'; ui.show(null); }
      }
    },
  });

  ui.on('btn-ladder', () => { audio.init(); audio.click(); startFight(); });
  ui.on('btn-endless', () => { audio.init(); audio.click(); startFight(); });
  ui.on('btn-class', () => { audio.init(); audio.click(); startFight(); });
  ui.on('btn-fight', () => { audio.init(); audio.click(); startFight(); });
  ui.on('btn-resume', () => { S.state = 'play'; ui.show(null); ui.hud(true); });
  ui.on('btn-quit', () => { showMenu(); });
  ui.on('btn-res-main', () => startFight());
  ui.on('btn-res-menu', () => showMenu());
  ui.on('btn-pause', () => { if (S.state === 'play') { S.state = 'paused'; ui.show('pause'); } });
  ui.on('btn-mute', () => { audio.init(); ui.setMuted(audio.toggleMute()); });
  i18n.bindToggle($('btn-lang'));
  i18n.bindToggle($('btn-lang2'));

  const kicker = document.querySelector('#screen-start .tagline');
  if (kicker) kicker.innerHTML = L()
    ? 'PHYS P1 — soft ragdoll · grab/throw neon weapons · wall/floor impact.<br>Skill1=GRAB · Skill2=THROW · ATTACK=punch/swing. (Classic: remove ?phys=1)'
    : 'PHYS P1 — 軟關節布娃娃 · 拾取／投擲霓虹武器 · 撞牆／落地受傷。<br>技能1＝拾取 · 技能2＝投擲 · 攻擊＝拳／揮。 （返經典：拎走 ?phys=1）';

  function showMenu() {
    S.state = 'menu'; S.over = null;
    ui.show('start'); ui.hud(false);
    document.body.dataset.state = 'menu';
  }

  function startFight() {
    phys = Object.assign(phys, makePhysWorld());
    phys.a.color = 0x00e5ff; phys.b.color = 0xff2bd6;
    S.time = 60; S.over = null; S.acc = 0; S.introT = 0.55; S.state = 'intro'; S.score = 0;
    S.aiMem = { punchT: 0.5, jumpT: 1.2, grabT: 0.3, throwT: 1.5 };
    ui.show(null); ui.hud(true); $('controls').classList.remove('hidden');
    document.body.dataset.state = 'play';
    ui.banner(L() ? 'PHYS DUEL' : '物理對打', L() ? 'GRAB · THROW · PUNCH' : '拾取 · 投擲 · 出拳', '');
    audio.init(); audio.startMusic(); audio.bell?.(2);
    updateHud();
  }

  function updateHud() {
    const pa = torsoPose(phys.a), pb = torsoPose(phys.b);
    $('hp-fill-a').style.width = `${(pa.hp / pa.maxHp) * 100}%`;
    $('hp-lag-a').style.width = `${(pa.hp / pa.maxHp) * 100}%`;
    $('hp-fill-b').style.width = `${(pb.hp / pb.maxHp) * 100}%`;
    $('hp-lag-b').style.width = `${(pb.hp / pb.maxHp) * 100}%`;
    $('ult-fill-a').style.width = phys.a.held ? '100%' : '0%';
    $('ult-fill-b').style.width = phys.b.held ? '100%' : '0%';
    $('hud-time').textContent = String(Math.max(0, Math.ceil(S.time)));
    $('hud-floor').textContent = 'PHYS';
    $('hud-score').textContent = String(Math.round(S.score));
    const held = phys.a.held;
    $('hp-cls-a').textContent = held ? (L() ? held.def.en : held.def.zh) : 'PHYS';
  }

  function finish(won) {
    S.over = { won }; S.state = 'result';
    $('res-kicker').textContent = 'PHYS P1';
    $('res-title').textContent = won ? (L() ? 'K.O.!' : '打倒！') : (L() ? 'DOWN…' : '倒下…');
    $('res-title').dataset.text = $('res-title').textContent;
    $('res-en').textContent = won ? 'RAGDOLL VICTORY' : 'RAGDOLL LOSS';
    $('res-main-zh').textContent = L() ? 'AGAIN' : '再嚟';
    $('res-main-en').textContent = 'RETRY';
    $('btn-revive').classList.add('hidden');
    $('res-stats').innerHTML = `<div>HP ${(phys.a.hp | 0)} / ${(phys.b.hp | 0)} · score ${Math.round(S.score)}</div>`;
    ui.show('result'); ui.hud(true);
    if (won) audio.victory?.(); else audio.defeat?.();
  }

  /** Basic AI dummy: seek weapon → grab → close → swing / throw; else punch. */
  function aiThink(dt) {
    const foe = phys.b, me = phys.a;
    if (!foe.alive) return { mx: 0 };
    const ax = me.parts.torso.getPosition().x;
    const bx = foe.parts.torso.getPosition().x;
    const dx = ax - bx;
    S.aiMem.punchT -= dt; S.aiMem.jumpT -= dt; S.aiMem.grabT -= dt; S.aiMem.throwT -= dt;

    let mx = 0, punch = false, jump = false, guard = false, grab = false, throwIt = false;

    if (!foe.held) {
      const free = nearestFreeWeapon(foe, phys.weapons, 8);
      if (free) {
        const wx = free.body.getPosition().x;
        const toW = wx - bx;
        if (Math.abs(toW) > 0.35) mx = Math.sign(toW) * 0.95;
        if (S.aiMem.grabT <= 0 && nearestFreeWeapon(foe, phys.weapons, 1.4)) {
          grab = true; S.aiMem.grabT = 0.8;
        }
      } else {
        if (Math.abs(dx) > 1.3) mx = Math.sign(dx) * 0.9;
        else if (Math.abs(dx) < 0.65) mx = -Math.sign(dx || 1) * 0.35;
      }
    } else {
      // armed: close in, swing, sometimes throw
      if (Math.abs(dx) > 1.6) mx = Math.sign(dx) * 0.9;
      else if (Math.abs(dx) < 0.9) mx = -Math.sign(dx || 1) * 0.2;
      if (Math.abs(dx) < 2.2 && S.aiMem.punchT <= 0 && me.alive) {
        punch = true; S.aiMem.punchT = 0.5 + Math.random() * 0.35;
      }
      if (Math.abs(dx) < 3.5 && Math.abs(dx) > 1.5 && S.aiMem.throwT <= 0 && Math.random() < 0.35) {
        throwIt = true; S.aiMem.throwT = 2.2 + Math.random();
      }
    }

    foe.face = Math.sign(dx) || foe.face;
    if (!foe.held && Math.abs(dx) < 1.7 && S.aiMem.punchT <= 0 && me.alive) {
      punch = true; S.aiMem.punchT = 0.55 + Math.random() * 0.45;
    }
    if (S.aiMem.jumpT <= 0 && Math.random() < 0.25) { jump = true; S.aiMem.jumpT = 1.4 + Math.random(); }
    if (me.punchCd > 0.15 && Math.abs(dx) < 1.4) guard = Math.random() < 0.3;

    return { mx, punch, jump, guard, grab, throwIt };
  }

  const camPos = new THREE.Vector3(0, ROOF_Y + 3, 14);
  const camLook = new THREE.Vector3(0, ROOF_Y + 1.2, 0);
  const tP = new THREE.Vector3(), tL = new THREE.Vector3();
  const camImp = { x: 0, y: 0, vx: 0, vy: 0 };
  function camKick(x, y) { camImp.vx += x * 28; camImp.vy += y * 28; }

  function frameCamera(dt, now) {
    const aspect = stage.width / stage.height, portrait = aspect < 0.9;
    const vfov = portrait ? 52 : 36;
    camera.fov = vfov; camera.updateProjectionMatrix();
    const pa = phys.a.parts.torso.getPosition(), pb = phys.b.parts.torso.getPosition();
    const mid = (pa.x + pb.x) / 2;
    const gap = Math.abs(pa.x - pb.x);
    const top = Math.max(pa.y, pb.y);
    const tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2)), tanH = tanV * aspect;
    const span = Math.max(portrait ? 4.2 : 6.8, gap + (portrait ? 2.2 : 4));
    let dist = Math.max(span / 2 / tanH, (portrait ? 2.8 : 3.2 + top * 0.2) / tanV);
    let ly = ROOF_Y + (portrait ? 0.5 : 1.35) + top * 0.3;
    if (S.state === 'menu') { dist *= 1.15; ly = ROOF_Y + 0.8; }
    const lx = THREE.MathUtils.clamp(mid, -4.5, 4.5);
    tL.set(lx, ly, 0); tP.set(lx, ly + (portrait ? 0.6 : 0.2), dist);
    const k = 1 - Math.exp(-dt * 4);
    camPos.lerp(tP, k); camLook.lerp(tL, k);
    const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n, w = 34, z = 0.32;
    for (let i = 0; i < n; i++) {
      camImp.vx += (-w * w * camImp.x - 2 * z * w * camImp.vx) * h;
      camImp.vy += (-w * w * camImp.y - 2 * z * w * camImp.vy) * h;
      camImp.x += camImp.vx * h; camImp.y += camImp.vy * h;
    }
    camera.position.copy(camPos); camera.position.x += camImp.x; camera.position.y += camImp.y;
    camera.lookAt(camLook.x + camImp.x * 0.5, camLook.y + camImp.y * 0.5, 0);
    fx.shake?.(camera, now, 0.35);
  }

  function handleHits(evs) {
    for (const e of evs) {
      if (e.type !== 'hit') continue;
      const ko = applyHit(e.def, e.dmg);
      if (e.def === phys.b && (e.att === phys.a || e.kind === 'weapon')) S.score += e.dmg * (e.kind === 'weapon' ? 2.5 : 2);
      if (e.kind === 'impact' && e.def === phys.b) S.score += e.dmg; // environmental KO assist
      const view = e.def === phys.a ? va : vb;
      view.flash(e.kind === 'impact' ? 0xffaa44 : 0xffffff, 70);
      const col = new THREE.Color(e.kind === 'impact' ? 0xff8844 : (e.att?.color ?? e.weapon?.def.color ?? 0xffffff));
      const pos = new THREE.Vector3(e.x, ROOF_Y + e.y, 0.2);
      particles.burst?.(pos, col, e.kind === 'weapon' ? 18 : 12, { speed: 3.5, up: 1.2, life: 0.35, size: 0.7, bright: 1.6 });
      waves.spawn?.(pos, col, { r0: 0.1, r1: e.kind === 'impact' ? 1.6 : 1.2, h: 0.08, dur: 0.25, a: 1.2 });
      camKick(Math.sign(e.x || 1) * 0.04, 0.03);
      fx.kick?.({ trauma: e.kind === 'weapon' ? 0.12 : 0.08 });
      audio.hit?.('brawler', true);
      Platform.haptic?.(e.dmg > 16 ? 'medium' : 'light');
      if (ko) {
        // drop weapon on KO
        if (e.def.held) {
          try { driveRagdoll(e.def, { drop: true }, 0, phys.world, phys.weapons); } catch (_) {}
        }
        audio.ko?.();
        later(0.9, () => finish(e.def === phys.b));
      }
    }
  }

  const timers = [];
  const later = (sec, fn) => timers.push({ t: sec, fn });

  function sim(dt) {
    if (S.state === 'intro') {
      S.introT -= dt;
      driveRagdoll(phys.a, { mx: 0 }, dt, phys.world, phys.weapons);
      driveRagdoll(phys.b, { mx: 0 }, dt, phys.world, phys.weapons);
      stepWorld(phys, DT);
      if (S.introT <= 0) { S.state = 'play'; ui.banner(L() ? 'FIGHT' : '開始', '', ''); }
      return;
    }
    if (S.state !== 'play' || S.over) {
      driveRagdoll(phys.a, {}, dt, phys.world, phys.weapons);
      driveRagdoll(phys.b, {}, dt, phys.world, phys.weapons);
      stepWorld(phys, DT);
      return;
    }

    S.time -= dt;
    if (S.time <= 0) {
      S.time = 0;
      const won = phys.a.hp >= phys.b.hp;
      later(0.3, () => finish(won));
      S.over = { won };
      return;
    }

    const pad = ctl.read();
    const intentA = {
      mx: pad.mx, guard: pad.guard,
      punch: S._forcePunch || false,
      jump: S._forceJump || false,
      grab: S._forceGrab || false,
      throwIt: S._forceThrow || false,
    };
    S._forcePunch = false; S._forceJump = false; S._forceGrab = false; S._forceThrow = false;

    const intentB = aiThink(dt);
    driveRagdoll(phys.a, intentA, dt, phys.world, phys.weapons);
    driveRagdoll(phys.b, intentB, dt, phys.world, phys.weapons);
    const evs = stepWorld(phys, DT);
    handleHits(evs);
    updateHud();
  }

  function menuIdle(dt) {
    driveRagdoll(phys.a, { mx: Math.sin(performance.now() / 800) * 0.3 }, dt, phys.world, phys.weapons);
    driveRagdoll(phys.b, { mx: Math.sin(performance.now() / 900 + 1) * -0.3 }, dt, phys.world, phys.weapons);
    stepWorld(phys, DT);
  }

  function tick(dt, now) {
    for (const tm of timers.slice()) { tm.t -= dt; if (tm.t <= 0) { timers.splice(timers.indexOf(tm), 1); tm.fn(); } }
    fx.update?.(dt);
    if (S.state === 'paused') {
      // frozen
    } else if (S.state === 'menu') {
      S.acc += dt; while (S.acc >= DT) { S.acc -= DT; menuIdle(DT); }
    } else {
      S.acc += dt; let n = 0;
      while (S.acc >= DT && n < 8) { S.acc -= DT; n++; sim(DT); }
      if (S.acc > DT * 2) S.acc = 0;
    }
    va.update(snapshotParts(phys.a), phys.a.alive);
    vb.update(snapshotParts(phys.b), phys.b.alive);
    vw.sync(snapshotWeapons(phys.weapons));
    roof.update?.(now);
    particles.update?.(dt);
    waves.update?.(dt);
    city.update?.(now, dt, camera);
    frameCamera(dt, now);
    fx.applyPost?.(stage, now);
    ui.tick?.(dt);
    stage.render(dt);
  }

  ui.mountHowto?.({
    privacyUrl: './privacy.html',
    getContent: () => ({
      kicker: 'PHYS P1',
      title: t('kit.howto'),
      sections: [
        { heading: L() ? 'Rules' : '規則', body: L()
          ? '<ul><li>Soft neon ragdolls + 3 weapons on the rooftop.</li><li>Grab, swing, throw. Wall/floor impacts hurt.</li><li>KO = motors off → limp.</li></ul>'
          : '<ul><li>軟關節霓虹布娃娃＋天台三件武器。</li><li>拾取、揮打、投擲。撞牆／落地會受傷。</li><li>KO＝關馬達 → 軟癱。</li></ul>' },
        { heading: L() ? 'Controls' : '操作', body: L()
          ? `<ul><li>Stick move · ATTACK punch/swing · JUMP · GUARD.</li><li>Skill1 <b>GRAB</b> · Skill2 <b>THROW</b> (K / L).</li><li>Weapons: ${Object.values(WEAPON_DEFS).map((d) => d.en).join(', ')}.</li></ul>`
          : `<ul><li>搖桿走 · 攻擊拳／揮 · 跳 · 防。</li><li>技能1 <b>拾取</b> · 技能2 <b>投擲</b>（K／L）。</li><li>武器：${Object.values(WEAPON_DEFS).map((d) => d.zh).join('、')}。</li></ul>` },
      ],
    }),
  });

  showMenu();
  if (flags.demo || flags.autostart) startFight();
  ui.loaded?.();
  stage.loop(tick, { isActive: () => S.state === 'play', fpsEl: $('fps') });
  if (flags.fps) $('fps').classList.remove('hidden');
  console.info('[phys-p1] ready — weapons + impact + AI');
}
