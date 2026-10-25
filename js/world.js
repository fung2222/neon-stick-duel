// Minimal dark neon arena: static approved backdrop + thin cyan-edged ground slab.
// Foot plane stays at ROOF_Y (unchanged from 0.5.1). Backdrop is distant only —
// characters and collision still use the 3D slab, so feet do not sink.
import * as THREE from 'three';

export const ROOF_Y = 3.0;

/** Fraction from top of assets/bg/arena.png where the cyan ground line sits. */
const BG_CYAN_FRAC = 548 / 720;
const BG_URL = './assets/bg/arena.png';

export class Rooftop {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Distant static backdrop (world-space plane). Cyan line aligned to ROOF_Y.
    const bgH = 14;
    const bgW = bgH * (16 / 9);
    const bgZ = -10;
    const cyanLocalY = bgH * (0.5 - BG_CYAN_FRAC); // local Y of cyan line on plane
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(bgW, bgH),
      new THREE.MeshBasicMaterial({ color: 0x0a0c0e, toneMapped: false, depthWrite: true }),
    );
    this.backdrop.position.set(0, ROOF_Y - cyanLocalY, bgZ);
    this.backdrop.renderOrder = -20;
    this.backdrop.frustumCulled = false;
    this.group.add(this.backdrop);
    this._loadBackdrop();

    // Ground slab — feet plant here. Dark charcoal matching the BG platform band.
    const W = 16.4, D = 4.2;
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.92, metalness: 0.15 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, D), slabMat);
    slab.position.y = ROOF_Y - 0.25;
    this.group.add(slab);
    // Thin support body under the slab (reads as the low platform ledge in the BG).
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.4, 0.55, D - 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.95, metalness: 0.1 }),
    );
    body.position.y = ROOF_Y - 0.5 - 0.275;
    this.group.add(body);

    // Dim cyan rim matching the approved BG ground line (no bloom-boosted multiply).
    this.edgeMat = new THREE.MeshBasicMaterial({ color: 0x5ed5e5, toneMapped: false });
    const edge = (w, x, z) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.03), this.edgeMat);
      e.position.set(x, ROOF_Y + 0.01, z);
      this.group.add(e);
    };
    edge(W, 0, D / 2);
    edge(W, 0, -D / 2);
    const side = (x) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, D), this.edgeMat);
      e.position.set(x, ROOF_Y + 0.01, 0);
      this.group.add(e);
    };
    side(-W / 2);
    side(W / 2);

    // Soft lighting only — keep cyan accents dim; fighters stay readable.
    const light = new THREE.HemisphereLight(0x4a6a7a, 0x06080c, 0.85);
    scene.add(light);
    const sun = new THREE.DirectionalLight(0xe8f4ff, 1.15);
    sun.position.set(3, ROOF_Y + 8, 9);
    sun.target.position.set(0, ROOF_Y + 1, 0);
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0x40c8d8, 0.7);
    rim.position.set(-4, ROOF_Y + 4, -8);
    rim.target.position.set(0, ROOF_Y + 1, 0);
    scene.add(rim, rim.target);

    // Kept for API compat (main.js setAccent / update / dbg).
    this.pylonMat = this.edgeMat;
    this.sign = { material: { opacity: 1 } };
    this.beacon = { visible: false };
  }

  _loadBackdrop() {
    const loader = new THREE.TextureLoader();
    loader.load(
      BG_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        this.backdrop.material.map = tex;
        this.backdrop.material.color.set(0xffffff);
        this.backdrop.material.needsUpdate = true;
      },
      undefined,
      () => { /* keep solid near-black fallback */ },
    );
  }

  setAccent(_c1, _c2) {
    // Keep approved dim cyan rim; ignore fight accent colours (no bloom, stay readable).
    this.edgeMat.color.set(0x5ed5e5);
  }

  update(_t) { /* static arena — nothing to animate */ }
}
