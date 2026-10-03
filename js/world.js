// Rooftop duel stage above the NeonCity backdrop: neon-edged slab, railing posts, water tank + antenna silhouettes,
// a big original sign behind, and floor glyph rings under the fighters.
import * as THREE from 'three';
export const ROOF_Y = 3.0;
export class Rooftop {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    const W = 16.4, D = 4.2;
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x0b0820, roughness: 0.78, metalness: 0.25 });   // rough: no specular glare blob under bloom
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, D), slabMat); slab.position.y = ROOF_Y - 0.25; this.group.add(slab);
    const body = new THREE.Mesh(new THREE.BoxGeometry(W - 1, ROOF_Y - 0.5, D - 0.6), new THREE.MeshStandardMaterial({ color: 0x07051a, roughness: 0.8, metalness: 0.2 })); body.position.y = (ROOF_Y - 0.5) / 2; this.group.add(body);
    // windows on the building face
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, toneMapped: false });
    const wins = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.2), winMat, 40); let n = 0; const m4 = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) for (let j = 0; j < 2; j++) { if ((i * 7 + j * 3) % 5 === 0) continue; m4.makeTranslation(-7 + i * 0.74, 0.7 + j * 0.9, D / 2 - 0.29); wins.setMatrixAt(n, m4); wins.setColorAt(n, new THREE.Color().setHSL(0.08 + (i % 3) * 0.3, 0.8, 0.12 + (i * j % 3) * 0.05)); n++; }
    wins.count = n; this.group.add(wins);
    // neon edges
    this.edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(1.3), toneMapped: false });
    const edge = (w, x, z) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), this.edgeMat); e.position.set(x, ROOF_Y + 0.01, z); this.group.add(e); };
    edge(W, 0, D / 2); edge(W, 0, -D / 2);
    const side = (x) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, D), this.edgeMat); e.position.set(x, ROOF_Y + 0.01, 0); this.group.add(e); };
    side(-W / 2); side(W / 2);
    // boundary pylons at the arena ends
    this.pylonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(1.3), toneMapped: false });
    for (const x of [-7.75, 7.75]) for (const z of [-1.6, 1.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), this.pylonMat); p.position.set(x, ROOF_Y + 0.7, z); this.group.add(p); }
    // back props: water tank, antenna, AC units
    const dark = new THREE.MeshStandardMaterial({ color: 0x120c2a, roughness: 0.6, metalness: 0.4 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 20), dark); tank.position.set(-5.2, ROOF_Y + 1.9, -1.5); this.group.add(tank);
    for (const dx of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), dark); leg.position.set(-5.2 + dx, ROOF_Y + 0.55, -1.5); this.group.add(leg); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.02, 6, 40), this.pylonMat); ring.rotation.x = Math.PI / 2; ring.position.set(-5.2, ROOF_Y + 2.4, -1.5); this.group.add(ring);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 4, 6), dark); mast.position.set(5.6, ROOF_Y + 2, -1.7); this.group.add(mast);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b5c).multiplyScalar(1.6), toneMapped: false })); this.beacon.position.set(5.6, ROOF_Y + 4.05, -1.7); this.group.add(this.beacon);
    for (const x of [2.8, 3.9]) { const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), dark); ac.position.set(x, ROOF_Y + 0.3, -1.75); this.group.add(ac); }
    // sign behind: 對決 + DUEL (canvas texture)
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256); g.textAlign = 'center';
    g.font = '900 150px "Noto Sans TC", "PingFang HK", "Microsoft JhengHei", sans-serif'; g.fillStyle = '#ff5ae0'; g.shadowColor = '#ff2bd6'; g.shadowBlur = 10; g.fillText('對決', 256, 165);
    g.font = '700 34px Orbitron, sans-serif'; g.fillStyle = '#7ff6ff'; g.shadowColor = '#00e5ff'; g.fillText('N E O N   D U E L', 256, 228);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
    this.sign.position.set(0, ROOF_Y + 6.2, -9); this.group.add(this.sign);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.4, 0.06), dark); for (const x of [-2.4, 2.4]) { const f = frame.clone(); f.position.set(x, ROOF_Y + 3, -9.05); this.group.add(f); }
    // floor grid stripes
    const grid = new THREE.GridHelper(16, 32, 0x00e5ff, 0x2a1660); grid.scale.z = D / 16; grid.position.y = ROOF_Y + 0.005; grid.material.transparent = true; grid.material.opacity = 0.35; this.group.add(grid);
    const light = new THREE.HemisphereLight(0x6a5cff, 0x080414, 0.9); scene.add(light);
    const key = new THREE.PointLight(0xff2bd6, 22, 16); key.position.set(0, ROOF_Y + 5, 3); scene.add(key);
    // directional key + cool rim so the lit fighters read as solid 3D shapes (not glow blobs)
    const sun = new THREE.DirectionalLight(0xfff0f6, 1.6); sun.position.set(3, ROOF_Y + 8, 9); sun.target.position.set(0, ROOF_Y + 1, 0); scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0x40e8ff, 1.0); rim.position.set(-4, ROOF_Y + 4, -8); rim.target.position.set(0, ROOF_Y + 1, 0); scene.add(rim, rim.target);
  }
  setAccent(c1, c2) { this.edgeMat.color.set(c1).multiplyScalar(1.3); this.pylonMat.color.set(c2).multiplyScalar(1.3); }
  update(t) { this.beacon.visible = Math.sin(t * 4) > 0; this.sign.material.opacity = 0.85 + Math.sin(t * 13) * Math.sin(t * 3.1) * 0.15; }
}
