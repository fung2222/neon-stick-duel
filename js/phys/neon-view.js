// Neon capsule renderer for Planck ragdoll parts (Three.js). Cyber emissive look.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PART_GEO = {
  torso: { kind: 'box', hx: 0.16, hy: 0.38, hz: 0.12 },
  head: { kind: 'sphere', r: 0.16 },
  uArmF: { kind: 'box', hx: 0.07, hy: 0.18, hz: 0.07 },
  lArmF: { kind: 'box', hx: 0.06, hy: 0.16, hz: 0.06 },
  fistF: { kind: 'sphere', r: 0.13 },
  uArmB: { kind: 'box', hx: 0.07, hy: 0.18, hz: 0.07 },
  lArmB: { kind: 'box', hx: 0.06, hy: 0.16, hz: 0.06 },
  fistB: { kind: 'sphere', r: 0.11 },
  thighF: { kind: 'box', hx: 0.09, hy: 0.22, hz: 0.09 },
  shinF: { kind: 'box', hx: 0.08, hy: 0.2, hz: 0.08 },
  thighB: { kind: 'box', hx: 0.09, hy: 0.22, hz: 0.09 },
  shinB: { kind: 'box', hx: 0.08, hy: 0.2, hz: 0.08 },
};

function neonMat(color, emissive = 0.55) {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: c.clone().multiplyScalar(0.35),
    emissive: c.clone().multiplyScalar(emissive),
    emissiveIntensity: 1,
    metalness: 0.35,
    roughness: 0.35,
  });
}

export class NeonRagdollView {
  constructor(scene, roofY = 3) {
    this.scene = scene;
    this.roofY = roofY;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = {};
    this.rim = null;
    this.color = 0x00e5ff;
    this.visible = true;
  }

  setColor(hex) {
    this.color = hex;
    const mat = neonMat(hex);
    for (const m of Object.values(this.meshes)) {
      if (m.material) { m.material.dispose(); m.material = mat.clone(); }
    }
    if (this.rim) {
      this.rim.material.color.set(hex).multiplyScalar(1.4);
    }
  }

  build() {
    this.clear();
    const mat = neonMat(this.color);
    for (const [name, g] of Object.entries(PART_GEO)) {
      let mesh;
      if (g.kind === 'sphere') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(g.r, 14, 12), mat.clone());
      } else {
        mesh = new THREE.Mesh(new RoundedBoxGeometry(g.hx * 2, g.hy * 2, g.hz * 2, 2, 0.04), mat.clone());
      }
      mesh.castShadow = false;
      this.group.add(mesh);
      this.meshes[name] = mesh;
    }
    // soft glow ring under feet
    this.rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.025, 6, 28),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(this.color).multiplyScalar(1.3), toneMapped: false, transparent: true, opacity: 0.7 }),
    );
    this.rim.rotation.x = Math.PI / 2;
    this.group.add(this.rim);
  }

  clear() {
    for (const m of Object.values(this.meshes)) {
      this.group.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    this.meshes = {};
    if (this.rim) { this.group.remove(this.rim); this.rim.geometry.dispose(); this.rim.material.dispose(); this.rim = null; }
  }

  /** snap = snapshotParts(doll) */
  update(snap, alive = true) {
    if (!Object.keys(this.meshes).length) this.build();
    for (const [name, p] of Object.entries(snap)) {
      const m = this.meshes[name];
      if (!m) continue;
      m.position.set(p.x, this.roofY + p.y, 0);
      m.rotation.z = p.a;
      m.rotation.x = 0;
      m.rotation.y = 0;
    }
    const t = snap.torso;
    if (this.rim && t) {
      this.rim.position.set(t.x, this.roofY + 0.04, 0);
      this.rim.material.opacity = alive ? 0.75 : 0.2;
    }
    // limp: dim emissive
    const em = alive ? 0.55 : 0.18;
    for (const m of Object.values(this.meshes)) {
      if (m.material?.emissiveIntensity != null) m.material.emissiveIntensity = em;
    }
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  flash(color = 0xffffff, ms = 80) {
    for (const m of Object.values(this.meshes)) {
      if (!m.material?.emissive) continue;
      const prev = m.material.emissive.getHex();
      m.material.emissive.setHex(color);
      setTimeout(() => { try { m.material.emissive.setHex(prev); } catch (_) {} }, ms);
    }
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}

/** Neon weapon meshes synced from snapshotWeapons(). */
export class NeonWeaponView {
  constructor(scene, roofY = 3) {
    this.scene = scene;
    this.roofY = roofY;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = new Map();
  }

  sync(list) {
    const live = new Set();
    for (const w of list) {
      live.add(w.id);
      let m = this.meshes.get(w.id);
      if (!m) {
        const mat = neonMat(w.color, 0.7);
        m = new THREE.Mesh(
          new RoundedBoxGeometry(w.hx * 2, w.hy * 2, Math.max(0.06, w.hy * 1.2), 2, 0.03),
          mat,
        );
        // tip glow
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.05, w.hy * 1.1), 10, 8),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(w.color).multiplyScalar(1.6), toneMapped: false }),
        );
        tip.position.x = w.hx * 0.92;
        m.add(tip);
        this.group.add(m);
        this.meshes.set(w.id, m);
      }
      m.position.set(w.x, this.roofY + w.y, 0.05);
      m.rotation.z = w.a;
      m.material.emissiveIntensity = w.held ? 0.85 : 0.55;
    }
    for (const [id, m] of this.meshes) {
      if (!live.has(id)) {
        this.group.remove(m);
        m.geometry?.dispose();
        m.material?.dispose();
        this.meshes.delete(id);
      }
    }
  }

  dispose() {
    for (const m of this.meshes.values()) {
      this.group.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    this.meshes.clear();
    this.scene.remove(this.group);
  }
}
