// Fighter view — sprite-only neon humanoids (mini Street Fighter / KOF shell).
// Public API kept stable for main.js / boss-fx (cloak, phase look, swing cues, contact).
import * as THREE from 'three';
import { SpriteFighter, swordFrameOf } from './sprite/human.js';
import { hasSprite, spriteMeta, SPRITE_CLASSES } from './sprite/meta.js';

export { hasSprite, spriteMeta, SPRITE_CLASSES, swordFrameOf };

export class FighterView {
  constructor(scene) {
    this.scene = scene;
    this.sprite = new SpriteFighter(scene);
    this.cur = this.sprite;
    this.rig = 'sprite';
    this.vis = true;
    this.prevTip = new THREE.Vector3();
    this.hasPrev = false;
    this.tipVel = new THREE.Vector3();
    this._cloak = false;
    this._phase = 1;
  }
  setClass(cls, color = null, scale = 1) {
    this.args = [cls, color, scale];
    this.sprite.setClass(cls, color, scale);
    if (this.sprite.setPhaseLook) this.sprite.setPhaseLook(this._phase);
    this.cur = this.sprite;
    this.rig = 'sprite';
    this.cur.visible = this.vis && !this._cloak;
    this.hasPrev = false;
  }
  refresh() { if (this.args) this.setClass(...this.args); }
  set visible(v) { this.vis = v; this.cur.visible = v && !this._cloak; }
  get visible() { return this.vis; }
  takeFx() { return this.cur.takeFx ? this.cur.takeFx() : null; }
  stats() { return this.cur.stats ? this.cur.stats() : { rig: 'sprite' }; }
  update(f, dt, t, baseY, frozen = false, shake = 0) {
    this.cur.update(f, dt, t, baseY, frozen, shake);
    const tip = this.cur.joints && this.cur.joints.tip;
    if (tip && dt > 0 && !frozen) {
      if (this.hasPrev) this.tipVel.subVectors(tip, this.prevTip).divideScalar(dt);
      this.prevTip.copy(tip); this.hasPrev = true;
    }
  }
  flash() { this.cur.flash(); }
  onHit(e) { if (this.cur.onHit) this.cur.onHit(e); }
  get joints() { return this.cur.joints; }
  get cloaked() { return this._cloak; }
  setCloak(on) {
    this._cloak = !!on;
    this.cur.visible = this.vis && !this._cloak;
    if (this.cur.setCloak) this.cur.setCloak(on);
  }
  bossSync(projs, simF) { if (this.cur.bossSync) this.cur.bossSync(projs, simF); }
  get hasDataBlades() { return !!this.cur.hasDataBlades; }
  setPhaseLook(p) {
    this._phase = p || 1;
    if (this.cur.setPhaseLook) this.cur.setPhaseLook(this._phase);
  }
  get spawnGhostAt() {
    return this.cur.spawnGhostAt && this.cur.ghosts
      ? (...a) => this.cur.spawnGhostAt(...a)
      : null;
  }
  zan() { return !!(this.cur.zanNow && this.cur.zanNow()); }
  takeSwingCue(f) { return this.cur.takeSwingCue ? this.cur.takeSwingCue(f) : null; }
  contactPoint(def, baseY) {
    const j = this.cur.joints; if (!j || !j.tip || !j.base) return null;
    const y0 = baseY + def.y + 0.25, y1 = baseY + def.y + 2.05, hw = 0.32;
    let best = null, bd = Infinity;
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      const x = j.base.x + (j.tip.x - j.base.x) * k;
      const y = j.base.y + (j.tip.y - j.base.y) * k;
      const cx = Math.max(def.x - hw, Math.min(def.x + hw, x));
      const cy = Math.max(y0, Math.min(y1, y));
      const d = Math.hypot(x - cx, y - cy);
      if (d < bd - 1e-6) { bd = d; best = new THREE.Vector3((x + cx) / 2, (y + cy) / 2, 0.3); }
    }
    return bd < 1.2 ? best : null;
  }
}
