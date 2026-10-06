// Final boss telegraph FX (interim, HANDOFF §16 step 1): everything the player must read is drawn from sim state, so it is
// deterministic and matches the hitboxes exactly.
//   · attack zone   — the ground footprint of the boss's current hitbox (hazard stripes) during the startup; the Iai zone turns
//                     white-hot on the flash (= the dodge / jump cue)
//   · iai glint     — star + horizontal glint at the hilt on the 'flash' event
//   · mirror        — a silver oval "mirror" in front of the boss while Mirror Guard can parry
//   · data blades   — per 'dblade' projectile: ground ring (danger radius incl. body width) + countdown fill + light column,
//                     the blade falls in the last 0.22 s and sticks in the floor
//   · decoys        — Glitch Step after-images (AnimeFighter ghosts, tinted red, mirrored to face the player) + glitch bursts
//   · phase 2       — six thin data-blade shards fanned behind the boss (placeholder for the step-2 instanced data blades)
import * as THREE from 'three';
import { ROOF_Y } from './world.js';

const RED = new THREE.Color(0xff2440), HOT = new THREE.Color(0xffd0d8), WHITE = new THREE.Color(1, 1, 1), SILVER = new THREE.Color(0xe8eeff);
const add = (c, o = 0) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
function stripeTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 32); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.5, 'rgba(255,255,255,0.55)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, 128, 32);
  g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 14, 32); g.lineTo(x + 30, 0); g.lineTo(x + 16, 0); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function starTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr;
  g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 7 : 32; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill();
  return new THREE.CanvasTexture(cv);
}

export class BossFx {
  constructor(scene, particles, waves) {
    this.scene = scene; this.particles = particles; this.waves = waves;
    const plane = new THREE.PlaneGeometry(1, 1);
    this.zoneTex = stripeTex();
    this.zone = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: this.zoneTex, color: RED, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    this.zone.rotation.x = -Math.PI / 2; this.zone.renderOrder = 2; this.zone.visible = false; scene.add(this.zone);
    this.edge = new THREE.Mesh(plane, add(RED)); this.edge.renderOrder = 2; this.edge.visible = false; scene.add(this.edge);   // upright bar at the far end of the reach
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), color: HOT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.glint.visible = false; this.glint.renderOrder = 5; scene.add(this.glint); this.glintT = 9;
    this.line = new THREE.Mesh(plane, add(WHITE)); this.line.visible = false; this.line.renderOrder = 5; scene.add(this.line);
    this.mirror = new THREE.Group();
    this.mirrorFill = new THREE.Mesh(new THREE.CircleGeometry(1, 32), add(SILVER, 0.16)); this.mirror.add(this.mirrorFill);
    this.mirrorRim = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), add(RED, 0.8)); this.mirror.add(this.mirrorRim);
    this.mirror.visible = false; this.mirror.renderOrder = 4; scene.add(this.mirror);
    // data-blade markers (pool)
    const ring = new THREE.RingGeometry(0.86, 1, 36), disc = new THREE.CircleGeometry(1, 32), col = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
    const blade = new THREE.ConeGeometry(0.09, 1.5, 4); blade.rotateX(Math.PI);   // tip down
    this.marks = Array.from({ length: 8 }, () => {
      const g = new THREE.Group(); g.visible = false; scene.add(g);
      const r = new THREE.Mesh(ring, add(RED, 0.8)); r.rotation.x = -Math.PI / 2; g.add(r);
      const f = new THREE.Mesh(disc, add(RED, 0.35)); f.rotation.x = -Math.PI / 2; f.position.y = 0.005; g.add(f);
      const c = new THREE.Mesh(col, add(RED, 0.12)); g.add(c);
      const b = new THREE.Mesh(blade, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc0c8), toneMapped: false, transparent: true, opacity: 1 })); g.add(b);
      const bg = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.7, 4).rotateX(Math.PI), add(RED, 0.5)); b.add(bg);
      return { g, r, f, c, b, id: -1 };
    });
    // phase-2 halo: six thin data-blade shards fanned behind the boss
    this.halo = new THREE.Group(); this.halo.visible = false; scene.add(this.halo);
    const shard = new THREE.ConeGeometry(0.05, 0.9, 4);
    this.shards = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(shard, add(RED, 0.75)); this.halo.add(m); return m; });
    this.decoyIds = new Set(); this.phaseT = 9; this.flare = 0;
  }
  reset() {
    this.zone.visible = false; this.edge.visible = false; this.glint.visible = false; this.line.visible = false; this.mirror.visible = false; this.halo.visible = false;
    for (const m of this.marks) { m.g.visible = false; m.id = -1; }
    this.decoyIds.clear(); this.phaseT = 9; this.glintT = 9;
  }
  /** sim event hook (main.js handleEvents) */
  onEvent(e, d, view) {
    const P = this.particles, W = this.waves, v = new THREE.Vector3();
    switch (e.type) {
      case 'flash': {   // Iai Judgement: the cue to dodge / jump
        const h = view.joints && view.joints.handF; v.set(h ? h.x : e.x, h ? h.y : ROOF_Y + e.y, 0.4);
        this.glint.position.copy(v); this.glintT = 0; this.glint.visible = true;
        this.line.position.set(e.who.x + e.who.facing * 2.9, v.y, 0.35); this.lineFace = e.who.facing;
        P.burst(v, HOT, 18, { speed: 3, up: 0.4, life: 0.3, size: 0.55, bright: 1.6 });
        break;
      }
      case 'proj': if (e.p.key === 'decoy') {
        const p = e.p; this.decoyIds.add(p.id);
        if (view.spawnGhostAt) view.spawnGhostAt(p.x, p.dir, 0.7, (p.life0 || 0.32) + 0.08, 0xff3a52);
        v.set(p.x, ROOF_Y + 1.1, 0.2); P.burst(v, RED, 26, { speed: 3.5, up: 0.6, life: 0.3, size: 0.6, color2: WHITE, bright: 1.6 });
        W.spawn(v.set(p.x, ROOF_Y + 0.04, 0), RED, { r0: 0.2, r1: 1.4, h: 0.05, dur: 0.28, a: 1.1 });
      } break;
      case 'projEnd': if (e.p.key === 'decoy') {   // the decoy "cuts" and shatters into pixels: harmless
        const p = e.p; v.set(p.x + p.dir * 0.5, ROOF_Y + 1.15, 0.25);
        P.burst(v, RED, 30, { speed: 4.5, up: 1, life: 0.35, size: 0.5, color2: WHITE, bright: 1.5 });
        this.decoyIds.delete(p.id);
      } break;
      case 'phase': {
        this.phaseT = 0; v.set(e.x, ROOF_Y + 0.05, 0);
        W.spawn(v, RED, { r0: 0.3, r1: 7, h: 1.4, dur: 0.8, a: 1.5 }); W.spawn(v, WHITE, { r0: 0.2, r1: 3.5, h: 0.4, dur: 0.45, a: 1.2 });
        P.burst(v.set(e.x, ROOF_Y + 1.4, 0), RED, 90, { speed: 7, up: 3, life: 0.8, size: 1.0, color2: WHITE, bright: 1.7 });
        break;
      }
      case 'parry': v.set(e.x, ROOF_Y + e.y, 0.4); P.burst(v, SILVER, 34, { speed: 5, up: 1, life: 0.3, size: 0.6, color2: RED, bright: 1.7 }); this.mirrorHit = 0.25; break;
      case 'crush': v.set(e.x, ROOF_Y + e.y, 0.4); P.burst(v, SILVER, 46, { speed: 6, up: 2, life: 0.5, size: 0.7, color2: WHITE, bright: 1.6 }); break;
    }
  }
  /** per frame: zone, glint, mirror, rain markers, halo. view = the boss's FighterView */
  update(dt, d, boss, view) {
    const m = boss && boss.st === 'atk' && boss.mk ? boss.C.moves[boss.mk] : null, s = boss ? boss.scale || 1 : 1;
    // attack zone (ground footprint of the hitbox), shown during the startup and the active frames
    let zk = 0;
    if (m && m.box) {
      const [su, ac] = m.t, tel = (m.fire || []).find((f) => f.type === 'teleport');
      const big = m.kind !== 'basic', iai = !!m.flash;
      if ((!tel || boss.t >= tel.at) && boss.t < su + ac + 0.06) {
        const u = Math.min(1, boss.t / su), act = boss.t >= su;
        zk = act ? 0.95 : (big ? 0.18 + 0.5 * u * u : 0.1 + 0.18 * u);
        if (iai && boss.t >= m.flash) zk = act ? 1 : 0.75 + 0.25 * Math.sin(boss.t * 60);
        const x0 = boss.x + boss.facing * m.box[0], x1 = boss.x + boss.facing * m.box[1], len = Math.abs(x1 - x0);
        this.zone.position.set((x0 + x1) / 2, ROOF_Y + 0.03, 0); this.zone.scale.set(len, 1.3, 1);
        this.zoneTex.repeat.set(len / 0.55, 1); this.zoneTex.offset.x = (this.zoneTex.offset.x - dt * 1.2 * boss.facing) % 1;
        this.zone.material.color.copy(iai && boss.t >= m.flash ? HOT : RED);
        this.edge.position.set(x1, ROOF_Y + 0.45, 0); this.edge.scale.set(0.06, 0.9, 1); this.edge.material.opacity = zk * 0.9;
      }
    }
    this.zone.visible = zk > 0.01; this.zone.material.opacity = zk; this.edge.visible = zk > 0.01;
    // iai glint
    if (this.glintT < 0.45) {
      this.glintT += dt; const k = this.glintT / 0.45;
      this.glint.visible = true; this.glint.scale.setScalar(1.6 + 2.4 * k); this.glint.material.opacity = (1 - k) ** 1.2; this.glint.material.rotation = k * 1.5;
      this.line.visible = true; this.line.scale.set(5.8 * (0.4 + 0.6 * Math.min(1, k * 3)), 0.04 * (1 - k * 0.6), 1); this.line.material.opacity = (1 - k) ** 1.5;
    } else { this.glint.visible = false; this.line.visible = false; }
    // mirror guard
    const mir = m && m.parry && boss.t <= m.parry[1];
    this.mirror.visible = !!mir;
    if (mir) {
      const u = Math.min(1, boss.t / Math.max(0.05, m.parry[0])); this.mirrorHit = Math.max(0, (this.mirrorHit || 0) - dt);
      this.mirror.position.set(boss.x + boss.facing * 0.75 * s, ROOF_Y + 1.25 * s, 0.25); this.mirror.scale.set(0.32 * s * u, 0.95 * s * u, 1);
      this.mirrorFill.material.opacity = 0.12 + 0.05 * Math.sin(boss.t * 18) + this.mirrorHit * 1.6; this.mirrorRim.material.opacity = 0.7 + this.mirrorHit;
    }
    // data-blade markers
    const live = new Set();
    for (const p of d.projs) {
      if (p.key !== 'dblade' || p.dead) continue; live.add(p.id);
      let mk = this.marks.find((q) => q.id === p.id); if (!mk) { mk = this.marks.find((q) => q.id < 0); if (!mk) continue; mk.id = p.id; }
      const rr = p.r + 0.35, wait = p.delay > 0, k = wait ? 1 - p.delay / (p.delay0 || 0.6) : 1;
      mk.g.visible = true; mk.g.position.set(p.x, ROOF_Y + 0.03, 0);
      mk.r.scale.set(rr, rr, 1); mk.f.scale.setScalar(rr * Math.max(0.05, k)); mk.r.material.opacity = wait ? 0.55 + 0.35 * Math.sin(p.t * 30) : 0.9;
      mk.f.material.opacity = wait ? 0.18 + 0.3 * k : 0.8 * Math.max(0, p.life / 0.14);
      mk.c.scale.set(p.r * 0.8, 6, p.r * 0.8); mk.c.position.y = 3; mk.c.material.opacity = wait ? 0.05 + 0.12 * k : 0.35 * Math.max(0, p.life / 0.14);
      const fall = wait ? Math.max(0, Math.min(1, 1 - p.delay / 0.22)) : 1;   // the blade drops in the last 0.22 s of the marker
      mk.b.visible = fall > 0 && !(view && view.hasDataBlades); mk.b.position.y = 0.75 + (1 - fall * fall) * 7; mk.b.material.opacity = 1;
    }
    for (const mk of this.marks) if (mk.id >= 0 && !live.has(mk.id)) { mk.id = -1; mk.g.visible = false; }
    // phase-2 halo
    const p2 = boss && boss.phase === 2 && boss.st !== 'ko';
    if (p2 && (view.cloaked || view.hasDataBlades)) this.halo.visible = false;   // the real boss body fans its own six blades
    else if (p2) {
      this.phaseT += dt; const grow = Math.min(1, this.phaseT / 0.9), t = performance.now() / 1000;
      const rain = m && boss.mk === 'rain' && boss.t < m.t[0] + m.t[1]; this.flare = rain ? Math.min(1, this.flare + dt * 5) : Math.max(0, this.flare - dt * 2);
      this.halo.visible = true; this.halo.position.set(boss.x - boss.facing * 0.2 * s, ROOF_Y + boss.y + 1.55 * s, -0.35);
      this.shards.forEach((sh, i) => {
        const a = (-0.5 + i / 5) * 1.9 + Math.sin(t * 1.3 + i) * 0.05, r = (0.75 + 0.15 * this.flare) * s * grow;
        sh.position.set(Math.sin(a) * r, Math.cos(a) * r * 0.85 + this.flare * 0.5, 0); sh.rotation.set(0, 0, -a);
        sh.scale.setScalar(s * grow * (1 + 0.3 * this.flare)); sh.material.opacity = 0.55 + 0.25 * Math.sin(t * 6 + i) + 0.3 * this.flare;
      });
    } else this.halo.visible = false;
  }
}
