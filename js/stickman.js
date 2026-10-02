// Procedural neon stick fighter: 2D forward kinematics on the duel plane, glowing capsule bones, pose blending.
import * as THREE from 'three';

const L = { torso: 0.72, neck: 0.1, head: 0.21, ua: 0.4, fa: 0.38, th: 0.48, sh: 0.48 };
// angles: limbs measured from "straight down", positive = toward facing; lean measured from "straight up"
const P = {
  idle:   { hipY: 0.9,  hipX: 0,    lean: 0.16, head: -0.1, uaF: 1.15, faF: 1.75, uaB: 0.75, faB: 2.0,  thF: 0.42, shF: -0.4, thB: -0.32, shB: -0.3 },
  walkA:  { hipY: 0.92, hipX: 0,    lean: 0.2,  head: -0.1, uaF: 1.1,  faF: 1.7,  uaB: 0.8,  faB: 2.0,  thF: 0.6,  shF: -0.2, thB: -0.5,  shB: -0.6 },
  walkB:  { hipY: 0.94, hipX: 0,    lean: 0.2,  head: -0.1, uaF: 1.2,  faF: 1.7,  uaB: 0.7,  faB: 2.0,  thF: -0.1, shF: -0.9, thB: 0.25,  shB: -0.1 },
  jab:    { hipY: 0.88, hipX: 0.12, lean: 0.32, head: -0.2, uaF: 1.62, faF: 0.0,  uaB: 0.6,  faB: 2.2,  thF: 0.6,  shF: -0.25, thB: -0.5, shB: -0.2 },
  jab2:   { hipY: 0.88, hipX: 0.14, lean: 0.38, head: -0.2, uaF: 0.9,  faF: 1.9,  uaB: 1.62, faB: 0.0,  thF: 0.55, shF: -0.3, thB: -0.55, shB: -0.25 },
  kick:   { hipY: 0.98, hipX: 0.0,  lean: -0.35, head: 0.25, uaF: 0.9, faF: 1.5,  uaB: -0.6, faB: 0.8,  thF: 1.62, shF: 0.0,  thB: -0.1, shB: -0.1 },
  wind:   { hipY: 0.78, hipX: -0.12, lean: -0.22, head: 0.2, uaF: -0.5, faF: 1.9,  uaB: 2.5,  faB: 0.6,  thF: 0.7,  shF: -0.9, thB: -0.55, shB: -0.5 },
  heavy:  { hipY: 0.76, hipX: 0.3,  lean: 0.62, head: -0.5, uaF: 1.72, faF: 0.0,  uaB: -0.7, faB: 0.4,  thF: 0.95, shF: -0.5, thB: -0.85, shB: -0.1 },
  jump:   { hipY: 1.0,  hipX: 0,    lean: 0.1,  head: 0.0,  uaF: 2.4,  faF: 0.7,  uaB: 2.0,  faB: 0.9,  thF: 1.4,  shF: -2.1, thB: 0.7,  shB: -1.9 },
  dive:   { hipY: 1.0,  hipX: 0,    lean: -0.45, head: 0.3, uaF: 0.4,  faF: 1.2,  uaB: -1.0, faB: 0.6,  thF: 1.25, shF: -0.05, thB: 0.2, shB: -1.6 },
  dash:   { hipY: 0.72, hipX: 0,    lean: 0.75, head: -0.6, uaF: -0.7, faF: 0.4,  uaB: -0.9, faB: 0.3,  thF: 0.9,  shF: -1.0, thB: -0.7, shB: -0.6 },
  parry:  { hipY: 0.86, hipX: -0.05, lean: -0.08, head: 0.0, uaF: 2.3, faF: 0.9,  uaB: 1.9,  faB: 1.3,  thF: 0.35, shF: -0.3, thB: -0.4, shB: -0.3 },
  hit:    { hipY: 0.86, hipX: -0.1, lean: -0.55, head: 0.5, uaF: -0.4, faF: 0.6,  uaB: -0.9, faB: 0.5,  thF: 0.5,  shF: -0.2, thB: -0.35, shB: -0.5 },
  stun:   { hipY: 0.8,  hipX: 0,    lean: -0.25, head: 0.6, uaF: 0.3,  faF: 0.4,  uaB: -0.3, faB: 0.3,  thF: 0.3,  shF: -0.5, thB: -0.3, shB: -0.4 },
  ko:     { hipY: 0.2,  hipX: 0,    lean: -1.45, head: 0.2, uaF: 2.6,  faF: 0.2,  uaB: 3.0,  faB: 0.1,  thF: 1.3,  shF: 0.0,  thB: 1.5,  shB: -0.2 },
  win:    { hipY: 0.93, hipX: 0,    lean: -0.05, head: 0.3, uaF: 2.95, faF: 0.15, uaB: 0.5,  faB: 2.0,  thF: 0.3,  shF: -0.1, thB: -0.3, shB: -0.1 },
};
const KEYS = Object.keys(P.idle);

export class StickFighter {
  constructor(scene, color, { scale = 1.2 } = {}) {
    this.color = new THREE.Color(color); this.scale = scale;
    this.group = new THREE.Group(); scene.add(this.group);
    const mk = (c, k) => new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(k), toneMapped: false });
    this.matF = mk(this.color, 2.2); this.matB = mk(this.color, 1.0); this.matCore = mk(new THREE.Color(1, 1, 1), 1.6);
    const cap = new THREE.CapsuleGeometry(0.065, 1, 4, 10);
    this.bones = {}; const bone = (name, mat, r = 1) => { const m = new THREE.Mesh(cap, mat); m.userData.r = r; this.group.add(m); this.bones[name] = m; return m; };
    bone('torso', this.matF, 1.25); bone('uaF', this.matF); bone('faF', this.matF); bone('uaB', this.matB); bone('faB', this.matB);
    bone('thF', this.matF, 1.1); bone('shF', this.matF, 1.1); bone('thB', this.matB, 1.1); bone('shB', this.matB, 1.1);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(L.head, 24, 16), this.matF); this.group.add(this.head);
    this.visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.3), this.matCore); this.group.add(this.visor);
    this.fistF = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), this.matCore); this.group.add(this.fistF);
    // charge orb + parry shield + floor shadow
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })); this.orb.visible = false; this.group.add(this.orb);
    const hex = new THREE.RingGeometry(0.55, 0.68, 6); this.shield = new THREE.Mesh(hex, new THREE.MeshBasicMaterial({ color: 0x9ffcff, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shieldIn = new THREE.Mesh(new THREE.CircleGeometry(0.55, 6), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shield.add(this.shieldIn); this.shield.rotation.y = Math.PI / 2; this.group.add(this.shield);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.pose = { ...P.idle }; this.joints = {}; this.flashT = 0; this.shieldT = 0; this.walkPhase = 0; this.ghost = 0;
  }
  setColor(c) { this.color.set(c); this.matF.color.copy(this.color).multiplyScalar(2.2); this.matB.color.copy(this.color).multiplyScalar(1.0); this.shadow.material.color.copy(this.color); }
  flash() { this.flashT = 0.12; }
  parryFlash() { this.shieldT = 0.35; }
  /** f = duel fighter state; baseY = rooftop height */
  update(f, dt, t, baseY) {
    // choose target pose
    let target = P.idle, rate = 14;
    switch (f.st) {
      case 'walk': this.walkPhase += dt * 9 * (f.walkMul || 1); target = Math.sin(this.walkPhase) > 0 ? P.walkA : P.walkB; rate = 10; break;
      case 'attack': target = f.phase === 'startup' ? (f.move === 'heavy' ? P.wind : f.move === 'kick' ? { ...P.kick, thF: 0.9, shF: -1.2 } : P.idle) : P[f.move] || P.jab; rate = f.phase === 'active' ? 40 : f.phase === 'recover' ? 9 : 30; break;
      case 'wind': target = P.wind; rate = 12; break;
      case 'jump': target = P.jump; rate = 12; break;
      case 'dive': target = P.dive; rate = 24; break;
      case 'dash': target = P.dash; rate = 28; break;
      case 'parry': target = P.parry; rate = 36; break;
      case 'hit': target = P.hit; rate = 30; break;
      case 'stun': target = P.stun; rate = 10; break;
      case 'ko': target = P.ko; rate = 7; break;
      case 'win': target = P.win; rate = 8; break;
    }
    const k = 1 - Math.exp(-rate * dt);
    for (const key of KEYS) this.pose[key] += (target[key] - this.pose[key]) * k;
    const breathe = f.st === 'idle' ? Math.sin(t * 3.2) * 0.025 : 0, wob = f.st === 'stun' ? Math.sin(t * 9) * 0.25 : 0;
    // forward kinematics in local 2D (x forward = facing), scaled
    const s = this.scale, fc = f.facing, p = this.pose;
    const dir = (a) => [Math.sin(a) * fc, -Math.cos(a)];
    const hip = [f.x + p.hipX * fc * s, baseY + f.y + (p.hipY + breathe) * s];
    const lean = p.lean + wob;
    const neck = [hip[0] + Math.sin(lean) * fc * L.torso * s, hip[1] + Math.cos(lean) * L.torso * s];
    const ha = lean + p.head;
    const head = [neck[0] + Math.sin(ha) * fc * (L.neck + L.head) * s, neck[1] + Math.cos(ha) * (L.neck + L.head) * s];
    const sh = [hip[0] + Math.sin(lean) * fc * L.torso * 0.92 * s, hip[1] + Math.cos(lean) * L.torso * 0.92 * s];
    const add = (a, d, len) => [a[0] + d[0] * len * s, a[1] + d[1] * len * s];
    const eF = add(sh, dir(p.uaF), L.ua), hF = add(eF, dir(p.uaF + p.faF), L.fa);
    const eB = add(sh, dir(p.uaB), L.ua), hB = add(eB, dir(p.uaB + p.faB), L.fa);
    const kF = add(hip, dir(p.thF), L.th), fF = add(kF, dir(p.thF + p.shF), L.sh);
    const kB = add(hip, dir(p.thB), L.th), fB = add(kB, dir(p.thB + p.shB), L.sh);
    const zF = 0.14 * s, zB = -0.14 * s;
    const V = (a, z = 0) => new THREE.Vector3(a[0], a[1], z);
    this.placeBone('torso', V(hip), V(neck)); this.placeBone('uaF', V(sh, zF), V(eF, zF)); this.placeBone('faF', V(eF, zF), V(hF, zF));
    this.placeBone('uaB', V(sh, zB), V(eB, zB)); this.placeBone('faB', V(eB, zB), V(hB, zB));
    this.placeBone('thF', V(hip, zF * 0.6), V(kF, zF * 0.6)); this.placeBone('shF', V(kF, zF * 0.6), V(fF, zF * 0.6));
    this.placeBone('thB', V(hip, zB * 0.6), V(kB, zB * 0.6)); this.placeBone('shB', V(kB, zB * 0.6), V(fB, zB * 0.6));
    this.head.position.set(head[0], head[1], 0); this.head.scale.setScalar(s);
    this.visor.position.set(head[0] + fc * 0.11 * s, head[1] + 0.02 * s, 0); this.visor.scale.setScalar(s); this.visor.rotation.z = -fc * (ha - 0.1);
    this.fistF.position.set(hF[0], hF[1], zF); this.fistF.scale.setScalar(s);
    this.joints = { hip: V(hip), head: V(head), handF: V(hF, zF), handB: V(hB, zB), footF: V(fF, zF), footB: V(fB, zB), neck: V(neck) };
    // charge orb
    const charging = f.st === 'wind';
    this.orb.visible = charging || (f.st === 'attack' && f.move === 'heavy' && f.phase !== 'recover');
    if (this.orb.visible) {
      const c = charging ? Math.min(1, f.charge / 0.9) : f.power; const full = c >= 0.999;
      this.orb.position.copy(this.joints.handF); this.orb.scale.setScalar((0.6 + c * 1.4 + (full ? Math.sin(t * 30) * 0.2 : 0)) * s);
      this.orb.material.color.copy(full ? new THREE.Color(1, 1, 1) : this.color).multiplyScalar(1.5 + c * 2);
    }
    // parry shield
    this.shieldT = Math.max(0, this.shieldT - dt);
    const sOn = f.st === 'parry' && f.t < 0.26 ? 0.55 : 0, sA = Math.max(sOn, this.shieldT * 2.4);
    this.shield.material.opacity = Math.min(1, sA); this.shieldIn.material.opacity = Math.min(0.5, sA * 0.35);
    this.shield.position.set(f.x + fc * 0.62 * s, baseY + f.y + 1.25 * s, 0); this.shield.scale.setScalar((1 + this.shieldT * 1.5) * s);
    this.shield.rotation.z += dt * 2;
    // hit flash + invulnerability shimmer
    this.flashT = Math.max(0, this.flashT - dt);
    const fl = this.flashT > 0 ? 3 : 1, inv = f.invuln > 0 ? 0.45 + Math.sin(t * 50) * 0.3 : 1;
    this.matF.color.copy(this.color).multiplyScalar(2.2 * fl * inv); this.matB.color.copy(this.color).multiplyScalar(1.0 * fl * inv);
    this.shadow.position.set(f.x, baseY + 0.02, 0); const sc = Math.max(0.3, 1 - f.y * 0.25); this.shadow.scale.set(sc * s, sc * s, 1);
  }
  placeBone(name, a, b) {
    const m = this.bones[name], d = b.clone().sub(a), len = d.length();
    m.position.copy(a).addScaledVector(d, 0.5);
    m.scale.set(this.scale * m.userData.r, Math.max(0.001, len), this.scale * m.userData.r);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
  }
  dispose(scene) { scene.remove(this.group); scene.remove(this.shadow); }
}
const UP = new THREE.Vector3(0, 1, 0);
