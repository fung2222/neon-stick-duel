// NEON STICK DUEL v2 — procedural 3D stick fighter with class outfits + weapons.
// 2D forward kinematics in the fighter's local plane (x = facing), lit capsule bones, spring-blended poses
// (anticipation → strike → follow-through with slight overshoot), verlet cloth (coat tails, scarf, headband ribbons),
// robe cone, hood, mask, gauntlets, blade / staff / twin daggers, weapon trails, guard hex, ult-ready ring.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BASE, KEYS, STANCE, POSES } from './poses.js';
import { CLASSES } from './classes.js';

const L = { torso: 0.72, neck: 0.1, head: 0.2, ua: 0.4, fa: 0.38, th: 0.48, sh: 0.48 };
const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
const TMP = new THREE.Vector3(), TMP2 = new THREE.Vector3();
const col = (c, k = 1) => new THREE.Color(c).multiplyScalar(k);

// ------------------------------------------------------------------ cloth ribbon (verlet chain rendered as a strip)
class Ribbon {
  constructor(scene, n, seg, width, mat, { taper = 0.6, grav = 9, drag = 0.9 } = {}) {
    this.n = n; this.seg = seg; this.width = width; this.taper = taper; this.grav = grav; this.drag = drag;
    this.p = Array.from({ length: n }, () => new THREE.Vector3()); this.o = Array.from({ length: n }, () => new THREE.Vector3());
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(n * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 2 * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; scene.add(this.mesh); this.ok = false;
  }
  reset(a) { for (let i = 0; i < this.n; i++) { this.p[i].set(a.x, a.y - i * this.seg, a.z); this.o[i].copy(this.p[i]); } this.ok = true; }
  update(a, dt, wind) {
    if (!this.ok || this.p[0].distanceTo(a) > 2.5) this.reset(a);
    const steps = Math.min(6, Math.max(1, Math.ceil(dt / (1 / 90)))), h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.p[0].copy(a); this.o[0].copy(a);
      for (let i = 1; i < this.n; i++) {
        const p = this.p[i], o = this.o[i];
        const vx = (p.x - o.x) * this.drag, vy = (p.y - o.y) * this.drag, vz = (p.z - o.z) * this.drag;
        o.copy(p); p.x += vx + wind.x * h * h; p.y += vy + (wind.y - this.grav) * h * h; p.z += vz;
        p.z += (a.z - p.z) * 0.2;
      }
      for (let it = 0; it < 3; it++) for (let i = 1; i < this.n; i++) {
        const A = this.p[i - 1], Bp = this.p[i]; TMP.subVectors(Bp, A); const d = TMP.length() || 1e-4;
        Bp.addScaledVector(TMP, (this.seg - d) / d);
      }
    }
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i], q = this.p[Math.min(this.n - 1, i + 1)], r = this.p[Math.max(0, i - 1)];
      let tx = q.x - r.x, ty = q.y - r.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const w = this.width * 0.5 * (1 - this.taper * i / (this.n - 1));
      const k = i * 6;
      this.pos[k] = p.x - ty * w; this.pos[k + 1] = p.y + tx * w; this.pos[k + 2] = p.z;
      this.pos[k + 3] = p.x + ty * w; this.pos[k + 4] = p.y - tx * w; this.pos[k + 5] = p.z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  set visible(v) { this.mesh.visible = v; }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); }
}

// ------------------------------------------------------------------ weapon trail (fading additive strip)
class Trail {
  constructor(scene, n = 16) {
    this.n = n; this.s = []; const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.al = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uC: { value: new THREE.Color(1, 1, 1) }, uO: { value: 0.5 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uO; varying float vA; void main(){ gl_FragColor = vec4(uC * vA * uO, 1.0); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  setColor(c) { this.mat.uniforms.uC.value.set(c); }
  update(dt, on, base, tip) {
    for (const s of this.s) s.l -= dt / 0.16;
    if (on) this.s.unshift({ b: base.clone(), t: tip.clone(), l: 1 });
    while (this.s.length > this.n || (this.s.length && this.s[this.s.length - 1].l <= 0)) this.s.pop();
    const m = this.s.length;
    for (let i = 0; i < this.n; i++) {
      const s = this.s[Math.min(i, m - 1)]; const k = i * 6;
      if (!s) { this.al[i * 2] = this.al[i * 2 + 1] = 0; continue; }
      this.pos[k] = s.b.x; this.pos[k + 1] = s.b.y; this.pos[k + 2] = s.b.z; this.pos[k + 3] = s.t.x; this.pos[k + 4] = s.t.y; this.pos[k + 5] = s.t.z;
      const a = i < m ? Math.max(0, s.l) * (1 - i / this.n) : 0; this.al[i * 2] = a * 0.15; this.al[i * 2 + 1] = a;
    }
    const g = this.mesh.geometry.attributes; g.position.needsUpdate = true; g.aA.needsUpdate = true;
    this.mesh.visible = m > 1;
  }
  dispose(scene) { scene.remove(this.mesh); }
}

// ------------------------------------------------------------------ fighter
export class StickFighter {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.trail = new Trail(scene); this.ribbons = []; this.parts = [];
    this.pose = { ...BASE }; this.vel = Object.fromEntries(KEYS.map((k) => [k, 0]));
    this.joints = {}; this.flashT = 0; this.walkPhase = 0; this.yaw = 0; this.hitAlt = 0; this.lastSt = ''; this.cls = null;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring);
    const hex = new THREE.RingGeometry(0.52, 0.62, 6);
    this.shield = new THREE.Mesh(hex, new THREE.MeshBasicMaterial({ color: 0x9ffcff, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shield.add(new THREE.Mesh(new THREE.CircleGeometry(0.52, 6), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.shield.rotation.y = Math.PI / 2; scene.add(this.shield);
  }

  /** (re)build body, outfit and weapon for a class. color overrides the class colour (rivals), scale for bosses */
  setClass(clsId, color = null, scale = 1) {
    const C = CLASSES[clsId]; if (!C) return;
    if (this.cls === clsId && this.colorHex === (color ?? C.color) && this.scaleK === scale) return;
    this.disposeParts(); this.cls = clsId; this.C = C; this.colorHex = color ?? C.color; this.scaleK = scale; this.scale = 1.2 * scale;
    const c = new THREE.Color(this.colorHex);
    this.c = c; this.trail.setColor(c.clone().multiplyScalar(0.9));
    const M = this.m = {
      body: new THREE.MeshStandardMaterial({ color: col(c, 0.35), emissive: c, emissiveIntensity: 0.6, roughness: 0.38, metalness: 0.3 }),
      bodyB: new THREE.MeshStandardMaterial({ color: col(c, 0.22), emissive: c, emissiveIntensity: 0.3, roughness: 0.45, metalness: 0.3 }),
      cloth: new THREE.MeshStandardMaterial({ color: C.cloth, emissive: C.cloth, emissiveIntensity: 0.45, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide }),
      trim: new THREE.MeshStandardMaterial({ color: C.trim, emissive: C.trim, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: 0xd8e2ff, emissive: c, emissiveIntensity: 0.12, roughness: 0.22, metalness: 0.95 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x17131f, roughness: 0.5, metalness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: col(c, 1.5), toneMapped: false }),
      eye: new THREE.MeshBasicMaterial({ color: col(0xffffff, 1.3), toneMapped: false }),
    };
    const s = this.scale, add = (m) => { this.group.add(m); this.parts.push(m); return m; };
    const cap = new THREE.CapsuleGeometry(0.065, 1, 4, 10); this.parts.push({ geometry: cap });
    this.bones = {};
    const bone = (name, mat, r = 1) => { const m = add(new THREE.Mesh(cap, mat)); m.userData.r = r; this.bones[name] = m; return m; };
    bone('torso', M.body, 1.35); bone('uaF', M.body); bone('faF', M.body); bone('uaB', M.bodyB); bone('faB', M.bodyB);
    bone('thF', M.body, 1.15); bone('shF', M.body, 1.1); bone('thB', M.bodyB, 1.15); bone('shB', M.bodyB, 1.1);
    this.head = add(new THREE.Mesh(new THREE.SphereGeometry(L.head, 24, 16), M.body));
    this.handF = add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), M.body)); this.handB = add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), M.bodyB));
    const footG = new THREE.BoxGeometry(0.22, 0.07, 0.1); this.footF = add(new THREE.Mesh(footG, M.dark)); this.footB = add(new THREE.Mesh(footG, M.dark));
    // face: visor (sword / brawler / mage), mask (assassin)
    const O = C.outfit;
    if (O.head !== 'mask') { this.visor = add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.26), M.eye)); }
    // outfit
    this.shell = null; this.robe = null; this.hood = null; this.mask = null; this.band = null; this.scarfRing = null;
    if (O.body === 'coat' || O.body === 'robe' || O.head === 'mask') { this.shell = bone('shell', M.cloth, 2.0); }
    if (O.body === 'coat') {
      this.collar = add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 20), M.trim));
      this.ribbons.push({ r: new Ribbon(this.scene, 6, 0.15 * s, 0.34 * s, M.cloth, { taper: 0.15, grav: 7, drag: 0.92 }), at: 'hipBack', z: -0.05 });
      this.ribbons.push({ r: new Ribbon(this.scene, 4, 0.13 * s, 0.26 * s, M.cloth, { taper: 0.2, grav: 7, drag: 0.9 }), at: 'hipFront', z: 0.12 });
      this.belt = add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 20), M.trim));
    }
    if (O.body === 'robe') {
      const g = new THREE.CylinderGeometry(0.55, 1, 1, 18, 1, true); g.translate(0, -0.5, 0);
      this.robe = add(new THREE.Mesh(g, M.cloth));
      this.robeHem = add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 24), M.trim));
    }
    if (O.head === 'hood') {
      this.hood = add(new THREE.Mesh(new THREE.SphereGeometry(0.255, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M.cloth));
      this.hoodTip = add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 10), M.cloth));
    }
    if (O.head === 'headband') {
      this.band = add(new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.03, 6, 26), M.trim));
      this.ribbons.push({ r: new Ribbon(this.scene, 5, 0.1 * s, 0.07 * s, M.trim, { taper: 0.4, grav: 3, drag: 0.9 }), at: 'headBack', z: -0.02, wind: 1.4 });
      this.ribbons.push({ r: new Ribbon(this.scene, 4, 0.1 * s, 0.06 * s, M.trim, { taper: 0.4, grav: 4, drag: 0.9 }), at: 'headBack', z: 0.03, wind: 1.1 });
      this.sash = add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 20), M.trim));
    }
    if (O.head === 'mask') {
      this.mask = add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.15, 0.3, 2, 0.04), M.dark));
      this.eyes = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.27), M.glow));
    }
    if (O.neck === 'scarf') {
      this.scarfRing = add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 20), M.trim));
      this.ribbons.push({ r: new Ribbon(this.scene, 8, 0.13 * s, 0.15 * s, M.trim, { taper: 0.3, grav: 2.5, drag: 0.93 }), at: 'neck', z: -0.06, wind: 2.2 });
    }
    // weapons (local +y = weapon direction, origin at the grip)
    this.wF = null; this.wB = null; this.tipLocal = new THREE.Vector3(0, 1, 0); this.baseLocal = new THREE.Vector3(0, 0.2, 0);
    const W = O.weapon;
    if (W === 'blade') {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8), M.dark); handle.position.y = -0.06; g.add(handle);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.06), M.trim); guard.position.y = 0.07; g.add(guard);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.02, 0.014), M.metal); blade.position.y = 0.59; g.add(blade);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.98, 0.018), M.glow); edge.position.set(0.03, 0.59, 0); g.add(edge);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 4), M.metal); tip.position.y = 1.15; g.add(tip);
      this.wF = add(g); this.tipLocal.set(0, 1.18, 0); this.baseLocal.set(0, 0.25, 0);
    } else if (W === 'staff') {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.85, 8), M.dark); shaft.position.y = 0.32; g.add(shaft);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), M.trim); band.position.y = 0.0; g.add(band);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 18), M.trim); crown.position.y = 1.3; g.add(crown);
      this.orbM = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), M.glow); this.orbM.position.y = 1.3; g.add(this.orbM);
      this.wF = add(g); this.tipLocal.set(0, 1.3, 0); this.baseLocal.set(0, 1.0, 0);
    } else if (W === 'gauntlets') {
      const mk = (mat) => { const g = new THREE.Group(); const fist = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.21, 0.21, 2, 0.05), mat); fist.position.y = 0.02; g.add(fist);
        const knuck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.2), M.glow); knuck.position.set(0, 0.06, 0); knuck.scale.set(1, 0.25, 1); knuck.position.y = 0.13; g.add(knuck);
        const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 10), M.dark); bracer.position.y = -0.17; g.add(bracer);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 14), M.trim); ring.rotation.x = Math.PI / 2; ring.position.y = -0.07; g.add(ring); return g; };
      this.wF = add(mk(M.metal)); this.wB = add(mk(M.metal)); this.gaunt = true; this.tipLocal.set(0, 0.14, 0); this.baseLocal.set(0, -0.2, 0);
    } else if (W === 'daggers') {
      const mk = () => { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), M.dark); g.add(h);
        const gd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.04), M.trim); gd.position.y = 0.07; g.add(gd);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.36, 0.012), M.metal); b.position.y = 0.26; g.add(b);
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.34, 0.016), M.glow); e.position.set(0.024, 0.26, 0); g.add(e); return g; };
      this.wF = add(mk()); this.wB = add(mk()); this.tipLocal.set(0, 0.45, 0); this.baseLocal.set(0, 0.1, 0);
    }
    this.ring.material.color.copy(c);
    for (const rb of this.ribbons) rb.r.ok = false;
  }

  disposeParts() {
    for (const p of this.parts) { if (p.isObject3D) this.group.remove(p); }
    this.parts = []; for (const rb of this.ribbons) rb.r.dispose(this.scene); this.ribbons = [];
    if (this.m) for (const k in this.m) this.m[k].dispose();
    this.gaunt = false; this.collar = this.belt = this.robeHem = this.hoodTip = this.eyes = this.sash = this.visor = this.orbM = null;
  }
  flash() { this.flashT = 0.12; this.hitAlt ^= 1; }
  set visible(v) { this.group.visible = v; this.shadow.visible = v; for (const rb of this.ribbons) rb.r.visible = v; if (!v) { this.trail.mesh.visible = false; this.ring.visible = false; this.shield.visible = false; } }

  /** choose the target pose + spring stiffness for the current fighter state */
  targetFor(f, dt) {
    const C = this.C, st = STANCE[this.cls] || {};
    let key = 'idle', w = 10, roll = null;
    const m = f.mk ? C.moves[f.mk] : null;
    switch (f.st) {
      case 'walk': key = 'walk'; w = 16; break;
      case 'guard': key = 'guard'; w = 26; break;
      case 'block': key = 'block'; w = 40; break;
      case 'jump': key = f.vy > 0 ? 'jump' : 'fall'; w = 12;
        if (f.djT < 0.42) { key = 'tuck'; w = 30; const k = f.djT / 0.42; roll = -Math.PI * 2 * (k * k * (3 - 2 * k)); }   // double-jump somersault
        break;
      case 'dodge': key = 'dodge'; w = 30; roll = -Math.sign(f.dodgeDir * f.facing || 1) * Math.PI * 2 * Math.min(1, f.t / 0.3); break;
      case 'hit': key = this.hitAlt ? 'hit2' : 'hit'; w = 36; break;
      case 'air': key = 'air'; w = 14; break;
      case 'down': key = 'down'; w = 11; break;
      case 'rise': key = 'rise'; w = 14; break;
      case 'stun': key = 'stun'; w = 10; break;
      case 'ko': key = f.y > 0.3 ? 'air' : 'ko'; w = 8; break;
      case 'win': key = 'win'; w = 7; break;
      case 'atk': if (m) {
        const [su, ac, rc] = m.t, t = f.t, P = m.pose || ['idle', 'idle', 'idle'];
        if (t < su) { key = P[0]; w = Math.min(46, 4.2 / Math.max(0.04, su)); }
        else if (t < su + ac) { key = P[1]; w = 42; }
        else if (t < su + ac + rc * 0.6) { key = P[2]; w = 15; }
        else { key = 'idle'; w = 10; }
        if (key === 'ultSword') key = f.ticks % 2 ? 'swB1' : 'swA1';
        if (key === 'ultFists') key = f.ticks % 2 ? 'brB1' : 'brA1';
      } break;
    }
    const T = Object.assign({}, BASE, st);
    if (key === 'walk') {
      this.walkPhase += dt * 8.5 * (Math.abs(f.vx) / (C.walk || 3) + 0.25) * Math.sign(f.vx * f.facing || 1);
      const k = 0.5 + 0.5 * Math.sin(this.walkPhase), A = POSES.walkA, Bw = POSES.walkB;
      for (const q of ['thF', 'shF', 'thB', 'shB']) T[q] = A[q] + (Bw[q] - A[q]) * k;
      T.hipY = (st.hipY ?? BASE.hipY) + A.hipY + (Bw.hipY - A.hipY) * Math.abs(Math.cos(this.walkPhase));
      T.lean += Math.sign(f.vx * f.facing) > 0 ? 0.06 : -0.08;
    } else Object.assign(T, POSES[key] || {});
    if (f.st === 'idle') T.hipY += Math.sin(performance.now() / 1000 * 3.2) * 0.02;
    return { T, w, roll, key };
  }

  /** f = sim fighter; baseY = arena floor height. frozen = hit-stop (hold the pose), shake = hit-stop jitter */
  update(f, dt, t, baseY, frozen = false, shake = 0) {
    if (!this.C) return;
    const { T, w, roll, key } = this.targetFor(f, frozen ? 0 : dt);
    if (!frozen) {
      const steps = Math.min(8, Math.max(1, Math.ceil(dt / (1 / 120)))), h = dt / steps, k = w * w, c = 2 * 0.72 * w;
      for (let i = 0; i < steps; i++) for (const q of KEYS) { if (q === 'roll' || q === 'spin') continue; const a = k * (T[q] - this.pose[q]) - c * this.vel[q]; this.vel[q] += a * h; this.pose[q] += this.vel[q] * h; }
      // spin + roll: direct (no overshoot), continuous spin for blade-spin moves
      const spinT = (key === 'asSpin' && f.st === 'atk') ? f.t * 26 : T.spin;
      this.pose.spin += (spinT - this.pose.spin) * Math.min(1, dt * (key === 'asSpin' ? 60 : 18));
      if (key !== 'asSpin' && Math.abs(this.pose.spin) > Math.PI) this.pose.spin = Math.atan2(Math.sin(this.pose.spin), Math.cos(this.pose.spin));
      if (roll != null) this.pose.roll = roll;
      else { this.pose.roll = Math.atan2(Math.sin(this.pose.roll), Math.cos(this.pose.roll)); const tr = f.st === 'air' ? -0.5 + Math.max(-1, Math.min(1, f.vy * 0.06)) : 0; this.pose.roll += (tr - this.pose.roll) * Math.min(1, dt * 10); }
    }
    // facing: smooth yaw turn (π when facing left)
    const yawT = f.facing > 0 ? 0 : Math.PI;
    let dy = yawT - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, (frozen ? 0 : dt) * 16);
    if (this.lastSt === '') this.yaw = yawT;
    this.lastSt = f.st;
    const s = this.scale, p = this.pose, wob = f.st === 'stun' ? Math.sin(t * 9) * 0.25 : 0;
    this.group.position.set(f.x + (shake ? (Math.random() - 0.5) * shake : 0), baseY + f.y, 0);
    this.group.rotation.y = this.yaw + p.spin;
    // ---- FK in the local plane (x forward)
    const dir = (a) => [Math.sin(a), -Math.cos(a)];
    const hip = [p.hipX * s, p.hipY * s];
    const lean = p.lean + wob;
    const neck = [hip[0] + Math.sin(lean) * L.torso * s, hip[1] + Math.cos(lean) * L.torso * s];
    const ha = lean + p.head;
    const head = [neck[0] + Math.sin(ha) * (L.neck + L.head) * s, neck[1] + Math.cos(ha) * (L.neck + L.head) * s];
    const sh = [hip[0] + Math.sin(lean) * L.torso * 0.92 * s, hip[1] + Math.cos(lean) * L.torso * 0.92 * s];
    const add = (a, d, len) => [a[0] + d[0] * len * s, a[1] + d[1] * len * s];
    const eF = add(sh, dir(p.uaF), L.ua), hF = add(eF, dir(p.uaF + p.faF), L.fa);
    const eB = add(sh, dir(p.uaB), L.ua), hB = add(eB, dir(p.uaB + p.faB), L.fa);
    const kF = add(hip, dir(p.thF), L.th), fF = add(kF, dir(p.thF + p.shF), L.sh);
    const kB = add(hip, dir(p.thB), L.th), fB = add(kB, dir(p.thB + p.shB), L.sh);
    const pts = { hip, neck, head, sh, eF, hF, eB, hB, kF, fF, kB, fB };
    if (Math.abs(p.roll) > 1e-3) {   // roll the whole body around the hip (dodge roll, juggle tumble)
      const cx = hip[0], cy = hip[1] + 0.1 * s, co = Math.cos(p.roll), si = Math.sin(p.roll);
      for (const k in pts) { const q = pts[k]; const x = q[0] - cx, y = q[1] - cy; pts[k] = [cx + x * co - y * si, cy + x * si + y * co]; }
      // keep the lowest point above the floor while rolling on the ground
      if (f.y < 0.05) { let minY = Infinity; for (const k in pts) minY = Math.min(minY, pts[k][1]); if (minY < 0.05) for (const k in pts) pts[k][1] += 0.05 - minY; }
    }
    const zF = 0.14 * s, zB = -0.14 * s, V = (a, z = 0) => new THREE.Vector3(a[0], a[1], z);
    const P = pts;
    this.placeBone('torso', V(P.hip), V(P.neck));
    this.placeBone('uaF', V(P.sh, zF), V(P.eF, zF)); this.placeBone('faF', V(P.eF, zF), V(P.hF, zF));
    this.placeBone('uaB', V(P.sh, zB), V(P.eB, zB)); this.placeBone('faB', V(P.eB, zB), V(P.hB, zB));
    this.placeBone('thF', V(P.hip, zF * 0.6), V(P.kF, zF * 0.6)); this.placeBone('shF', V(P.kF, zF * 0.6), V(P.fF, zF * 0.6));
    this.placeBone('thB', V(P.hip, zB * 0.6), V(P.kB, zB * 0.6)); this.placeBone('shB', V(P.kB, zB * 0.6), V(P.fB, zB * 0.6));
    if (this.shell) this.placeBone('shell', V([P.hip[0] * 0.9 + P.neck[0] * 0.1, P.hip[1] * 0.9 + P.neck[1] * 0.1]), V([P.hip[0] * 0.15 + P.neck[0] * 0.85, P.hip[1] * 0.15 + P.neck[1] * 0.85]));
    this.head.position.set(P.head[0], P.head[1], 0); this.head.scale.setScalar(s);
    const headRot = -(ha + p.roll);
    this.handF.position.set(P.hF[0], P.hF[1], zF); this.handF.scale.setScalar(s); this.handB.position.set(P.hB[0], P.hB[1], zB); this.handB.scale.setScalar(s);
    this.footF.position.set(P.fF[0] + 0.05 * s, P.fF[1] + 0.03 * s, zF * 0.6); this.footF.scale.setScalar(s); this.footF.rotation.z = p.roll;
    this.footB.position.set(P.fB[0] + 0.05 * s, P.fB[1] + 0.03 * s, zB * 0.6); this.footB.scale.setScalar(s); this.footB.rotation.z = p.roll;
    if (this.visor) { this.visor.position.set(P.head[0] + Math.cos(ha + p.roll) * 0.12 * s, P.head[1] + 0.02 * s - Math.sin(ha + p.roll) * 0.12 * s, 0); this.visor.scale.setScalar(s); this.visor.rotation.z = headRot; }
    if (this.hood) { this.hood.position.set(P.head[0] - 0.01 * s, P.head[1] + 0.01 * s, 0); this.hood.scale.setScalar(s); this.hood.rotation.set(0, 0, headRot + 0.35);
      this.hoodTip.position.set(P.head[0] - Math.cos(ha + p.roll) * 0.2 * s, P.head[1] + 0.05 * s, 0); this.hoodTip.scale.setScalar(s); this.hoodTip.rotation.z = Math.PI * 0.62 + p.roll; }
    if (this.mask) { const fx = Math.cos(ha + p.roll), fy = -Math.sin(ha + p.roll);
      this.mask.position.set(P.head[0] + fx * 0.09 * s - fy * 0.0, P.head[1] - 0.07 * s, 0); this.mask.scale.setScalar(s); this.mask.rotation.z = headRot;
      this.eyes.position.set(P.head[0] + fx * 0.15 * s, P.head[1] + 0.04 * s, 0); this.eyes.scale.setScalar(s); this.eyes.rotation.z = headRot; }
    const ringTo = (m, x, y, axA, scl) => { m.position.set(x, y, 0); m.scale.setScalar(scl); m.quaternion.setFromUnitVectors(ZAX, TMP.set(Math.sin(axA), Math.cos(axA), 0)); };
    if (this.band) ringTo(this.band, P.head[0], P.head[1] + 0.05 * s, ha + p.roll, s);
    if (this.collar) ringTo(this.collar, P.sh[0], P.sh[1] + 0.05 * s, lean + p.roll, s);
    if (this.scarfRing) ringTo(this.scarfRing, P.neck[0], P.neck[1] - 0.03 * s, lean + p.roll, s);
    if (this.belt || this.sash) ringTo(this.belt || this.sash, P.hip[0], P.hip[1] + 0.06 * s, lean + p.roll, s * (this.sash ? 1.1 : 1));
    if (this.robe) {
      const mk = [(P.kF[0] + P.kB[0]) / 2, (P.kF[1] + P.kB[1]) / 2];
      const top = [P.hip[0] + Math.sin(lean) * 0.12 * s, P.hip[1] + Math.cos(lean) * 0.12 * s], bot = [mk[0], Math.max(0.05 * s, mk[1] - 0.22 * s)];
      const dx = bot[0] - top[0], dy = bot[1] - top[1], len = Math.hypot(dx, dy), spread = Math.abs(P.kF[0] - P.kB[0]) * 0.5 + 0.2 * s;
      this.robe.position.set(top[0], top[1], 0); this.robe.scale.set(spread, len, 0.2 * s + spread * 0.3);
      this.robe.rotation.set(0, 0, Math.atan2(dx, -dy));
      this.robeHem.position.set(bot[0], bot[1], 0); this.robeHem.scale.set(spread, 0.2 * s + spread * 0.3, 1);
      this.robeHem.quaternion.setFromUnitVectors(ZAX, TMP.set(-dx / len, -dy / len, 0)); this.robeHem.scale.set(spread, spread, 1);
    }
    // weapons
    const aF = p.uaF + p.faF + p.wF + p.roll, aB = p.uaB + p.faB + p.wB + p.roll;
    if (this.wF) {
      const fa = this.gaunt ? p.uaF + p.faF + p.roll : aF;
      this.wF.position.set(P.hF[0], P.hF[1], zF + (this.gaunt ? 0 : 0.03)); this.wF.rotation.set(0, 0, fa + Math.PI); this.wF.scale.setScalar(s);
    }
    if (this.wB) {
      const fb = this.gaunt ? p.uaB + p.faB + p.roll : aB;
      this.wB.position.set(P.hB[0], P.hB[1], zB - 0.02); this.wB.rotation.set(0, 0, fb + Math.PI); this.wB.scale.setScalar(s);
    }
    this.group.updateMatrixWorld(true);
    // world-space joints for FX
    const W = (a, z = 0) => this.group.localToWorld(new THREE.Vector3(a[0], a[1], z));
    this.joints = { hip: W(P.hip), head: W(P.head), neck: W(P.neck), handF: W(P.hF, zF), handB: W(P.hB, zB), footF: W(P.fF, zF), footB: W(P.fB, zB) };
    this.joints.tip = this.wF ? this.wF.localToWorld(this.tipLocal.clone()) : this.joints.handF;
    this.joints.base = this.wF ? this.wF.localToWorld(this.baseLocal.clone()) : this.joints.handF;
    // cloth
    const wind = new THREE.Vector3(-f.facing * 2 - f.vx * 1.6, -f.vy * 0.4, 0);
    for (const rb of this.ribbons) {
      let a;
      if (rb.at === 'hipBack') a = W([P.hip[0] - 0.1 * s, P.hip[1] + 0.12 * s], rb.z);
      else if (rb.at === 'hipFront') a = W([P.hip[0] + 0.08 * s, P.hip[1] + 0.1 * s], rb.z);
      else if (rb.at === 'headBack') a = W([P.head[0] - Math.cos(ha + p.roll) * 0.2 * s, P.head[1] + 0.06 * s], rb.z);
      else a = W([P.neck[0] - 0.06 * s, P.neck[1] - 0.04 * s], rb.z);
      const ww = TMP2.copy(wind).multiplyScalar(rb.wind || 1); ww.x += Math.sin(t * 3 + rb.z * 40) * 1.2;
      rb.r.update(a, frozen ? 0.0001 : dt, ww);
    }
    // trail during active / early recovery of attacks
    let trailOn = false;
    if (f.st === 'atk' && f.mk) { const m = this.C.moves[f.mk]; const [su, ac, rc] = m.t; trailOn = f.t >= su * 0.6 && f.t < su + ac + rc * 0.35 && (m.box || m.kind === 'ult'); }
    if (f.st === 'dodge') trailOn = false;
    const useBack = this.wB && (this.cls === 'assassin' || this.cls === 'brawler') && f.mk && /a2|b1|B1|air2/.test((this.C.moves[f.mk]?.pose || [])[1] || '') && f.mk !== 'a1';
    const tw = useBack ? this.wB : this.wF;
    const tip = tw ? tw.localToWorld(this.tipLocal.clone()) : this.joints.handF, base = tw ? tw.localToWorld(this.baseLocal.clone()) : this.joints.neck;
    this.trail.update(frozen ? 0 : dt, trailOn && !frozen, base, tip);
    // hit flash / invulnerability shimmer
    this.flashT = Math.max(0, this.flashT - dt);
    const fl = this.flashT > 0 ? 2.6 : 1, inv = (f.inv > 0 && f.st !== 'dodge' && f.st !== 'down') ? 0.55 + Math.sin(t * 40) * 0.35 : 1;
    this.m.body.emissiveIntensity = 0.6 * fl * inv; this.m.bodyB.emissiveIntensity = 0.3 * fl * inv;
    // shadow, guard hex, ult ring
    this.shadow.position.set(f.x, baseY + 0.015, 0); const sc = Math.max(0.3, 1 - f.y * 0.22) * s; this.shadow.scale.set(sc, sc, 1);
    const guard = f.st === 'guard' || f.st === 'block';
    this.shield.visible = guard && this.group.visible; this.shield.material.opacity = f.st === 'block' ? 0.9 : 0.4;
    this.shield.position.set(f.x + f.facing * 0.55 * s, baseY + f.y + 1.15 * s, 0); this.shield.scale.setScalar(s * (f.st === 'block' ? 1.15 : 1)); this.shield.rotation.x += dt * 1.5;
    const ready = f.ult >= 100 && f.st !== 'ko';
    this.ring.visible = ready && this.group.visible; this.ring.position.set(f.x, baseY + 0.03, 0); this.ring.material.opacity = 0.35 + Math.sin(t * 6) * 0.2; this.ring.scale.setScalar(s * (1 + Math.sin(t * 6) * 0.05));
  }
  placeBone(name, a, b) {
    const m = this.bones[name], d = b.clone().sub(a), len = d.length();
    m.position.copy(a).addScaledVector(d, 0.5);
    m.scale.set(this.scale * m.userData.r, Math.max(0.001, len), this.scale * m.userData.r);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
  }
}
