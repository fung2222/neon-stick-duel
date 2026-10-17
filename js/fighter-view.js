// Fighter view: picks the renderer per class.
//   DEFAULT = human-shaped neon SpriteFighter for all 4 kits (Option 3).
//   ?sprite=0          fall back to anime / neon stick paths
//   ?style=anime|neon  when sprite off: cel-shaded anime vs HQ/classic stick
//   ?rig=hq|classic    HQ stick (Swordsman) vs classic stick
import * as THREE from 'three';
import { StickFighter } from './stickman.js';
import { HQFighter, HQ_PROFILES } from './rig/hq-fighter.js';
import { AnimeFighter } from './anime/fighter.js';
import { animeCfg } from './anime/configs.js';
import { SpriteFighter } from './sprite/human.js';
import { hasSprite } from './sprite/meta.js';

export { hasSprite, spriteMeta, SPRITE_CLASSES } from './sprite/meta.js';

export const STYLE_DEFAULT = { sword: 'anime', mage: 'anime', brawler: 'anime', assassin: 'anime', shogun: 'anime' };
let styleOv = null;
export function setStyleMode(m) { styleOv = m === 'anime' || m === 'neon' ? m : null; }
export const styleMode = () => styleOv;
export const hasAnime = (cls) => !!animeCfg(cls);
export function styleFor(cls) { return hasAnime(cls) ? styleOv || STYLE_DEFAULT[cls] || 'neon' : 'neon'; }

export const RIG_DEFAULT = { sword: 'hq' };
let override = null;
export function setRigMode(m) { override = m === 'hq' || m === 'classic' ? m : null; }
export const rigMode = () => override;

/** Sprite path default ON. ?sprite=0 disables; ?sprite=1 forces on. */
let spriteOn = true;
export function setSpriteMode(on) { spriteOn = !!on; }
export const spriteMode = () => spriteOn;

/** 'sprite' | 'anime' | 'hq' | 'classic' */
export function rigFor(cls) {
  if (spriteOn && hasSprite(cls)) return 'sprite';
  if (override === 'classic') return 'classic';
  if (styleFor(cls) === 'anime') return 'anime';
  if (!HQ_PROFILES[cls]) return 'classic';
  return override || RIG_DEFAULT[cls] || 'classic';
}
export const hasHQ = (cls) => !!HQ_PROFILES[cls];

export class FighterView {
  constructor(scene) {
    this.scene = scene;
    this.classic = new StickFighter(scene);
    this.hq = new HQFighter(scene); this.hq.visible = false;
    this.anime = null; this.sprite = null;
    this.cur = this.classic; this.rig = 'classic'; this.vis = true;
    this.prevTip = new THREE.Vector3(); this.hasPrev = false; this.tipVel = new THREE.Vector3();
  }
  setClass(cls, color = null, scale = 1) {
    this.args = [cls, color, scale];
    const rig = rigFor(cls);
    if (rig === 'anime' && !this.anime) { this.anime = new AnimeFighter(this.scene); this.anime.visible = false; }
    if (rig === 'sprite' && !this.sprite) { this.sprite = new SpriteFighter(this.scene); this.sprite.visible = false; }
    const next = rig === 'sprite' ? this.sprite : rig === 'anime' ? this.anime : rig === 'hq' ? this.hq : this.classic;
    next.setClass(cls, color, scale);
    for (const r of [this.classic, this.hq, this.anime, this.sprite]) if (r && r !== next) r.visible = false;
    if (next !== this.cur) { this.cur = next; if (next.resetAnim) next.resetAnim(); this.hasPrev = false; }
    this.rig = rig; this.cur.visible = this.vis;
  }
  takeFx() { return this.cur.takeFx ? this.cur.takeFx() : null; }
  stats() { return this.cur.stats ? this.cur.stats() : null; }
  refresh() { if (this.args) this.setClass(...this.args); }
  set visible(v) { this.vis = v; this.cur.visible = v; }
  get visible() { return this.vis; }
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
  get cloaked() { return !!this.cur.cloaked; }
  setCloak(on) { if (this.cur.setCloak) this.cur.setCloak(on); }
  bossSync(projs, simF) { if (this.cur.bossSync) this.cur.bossSync(projs, simF); }
  get hasDataBlades() { return !!this.cur.hasDataBlades; }
  setPhaseLook(p) { if (this.cur.setPhaseLook) this.cur.setPhaseLook(p); }
  get spawnGhostAt() { return this.cur.spawnGhostAt && this.cur.ghosts ? (...a) => this.cur.spawnGhostAt(...a) : null; }
  zan() { return !!(this.cur.zanNow && this.cur.zanNow()); }
  takeSwingCue(f) { return this.cur.takeSwingCue ? this.cur.takeSwingCue(f) : null; }
  contactPoint(def, baseY) {
    const j = this.cur.joints; if (!j || !j.tip || !j.base) return null;
    const y0 = baseY + def.y + 0.25, y1 = baseY + def.y + 2.05, hw = 0.32;
    let best = null, bd = Infinity;
    for (let i = 0; i <= 16; i++) {
      const k = i / 16, x = j.base.x + (j.tip.x - j.base.x) * k, y = j.base.y + (j.tip.y - j.base.y) * k;
      const cx = Math.max(def.x - hw, Math.min(def.x + hw, x)), cy = Math.max(y0, Math.min(y1, y)), d = Math.hypot(x - cx, y - cy);
      if (d < bd - 1e-6) { bd = d; best = new THREE.Vector3((x + cx) / 2, (y + cy) / 2, 0.3); }
    }
    return bd < 1.2 ? best : null;
  }
}
