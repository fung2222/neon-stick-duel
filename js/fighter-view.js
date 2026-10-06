// Fighter view: picks the renderer per class — the HQ rig (js/rig/, hierarchical skeleton + IK + clips) for classes that
// have an HQ profile and are switched to it, the classic procedural StickFighter otherwise. Same API either way.
//   ?rig=hq       every class with an HQ profile uses it (today: Swordsman)
//   ?rig=classic  everyone uses the classic rig (for side-by-side comparison)
//   no flag       the stored setting (pause screen RIG button), else RIG_DEFAULT
// To port a class: add js/rig/<class>.js (PROFILE with stance / poses / moveKeys / outfit), register it in
// HQ_PROFILES (rig/hq-fighter.js), add the outfit + weapon meshes in HQFighter.setClass, then flip RIG_DEFAULT.
import * as THREE from 'three';
import { StickFighter } from './stickman.js';
import { HQFighter, HQ_PROFILES } from './rig/hq-fighter.js';
import { AnimeFighter } from './anime/fighter.js';
import { ANIME_CLASSES } from './anime/configs.js';

// Look per class: 'anime' (cel-shaded character, js/anime/) or 'neon' (the v2.2 HQ / classic stick look).
//   ?style=anime | ?style=neon   (pause screen STYLE button stores `style`); classes without an anime config are always neon.
export const STYLE_DEFAULT = { sword: 'anime', mage: 'anime', brawler: 'anime', assassin: 'anime', shogun: 'anime' };   // v2.3: anime Swordsman · v2.4: anime Mage · v2.6: anime Brawler · v2.7: anime Assassin (perf in docs/HANDOFF.md §12–15)
let styleOv = null;
export function setStyleMode(m) { styleOv = m === 'anime' || m === 'neon' ? m : null; }
export const styleMode = () => styleOv;
export const hasAnime = (cls) => !!ANIME_CLASSES[cls];
export function styleFor(cls) { return hasAnime(cls) ? styleOv || STYLE_DEFAULT[cls] || 'neon' : 'neon'; }

export const RIG_DEFAULT = { sword: 'hq' };
let override = null;
export function setRigMode(m) { override = m === 'hq' || m === 'classic' ? m : null; }
export const rigMode = () => override;
/** 'anime' | 'hq' | 'classic'. ?rig=classic always wins (comparison shots); otherwise the anime style, then the HQ rig. */
export function rigFor(cls) {
  if (override === 'classic') return 'classic';
  if (styleFor(cls) === 'anime') return 'anime';
  if (!HQ_PROFILES[cls]) return 'classic';
  return override || RIG_DEFAULT[cls] || 'classic';
}
export const hasHQ = (cls) => !!HQ_PROFILES[cls];

export class FighterView {
  constructor(scene) {
    this.scene = scene; this.classic = new StickFighter(scene); this.hq = new HQFighter(scene); this.hq.visible = false; this.anime = null;
    this.cur = this.classic; this.rig = 'classic'; this.vis = true; this.prevTip = new THREE.Vector3(); this.hasPrev = false; this.tipVel = new THREE.Vector3();
  }
  setClass(cls, color = null, scale = 1) {
    this.args = [cls, color, scale];
    const rig = rigFor(cls);
    if (rig === 'anime' && !this.anime) { this.anime = new AnimeFighter(this.scene); this.anime.visible = false; }
    const next = rig === 'anime' ? this.anime : rig === 'hq' ? this.hq : this.classic;
    next.setClass(cls, color, scale);
    for (const r of [this.classic, this.hq, this.anime]) if (r && r !== next) r.visible = false;
    if (next !== this.cur) { this.cur = next; if (next.resetAnim) next.resetAnim(); this.hasPrev = false; }
    this.rig = rig; this.cur.visible = this.vis;
  }
  /** dust / ring cues from the anime renderer (empty for the other rigs) */
  takeFx() { return this.cur.takeFx ? this.cur.takeFx() : null; }
  stats() { return this.cur.stats ? this.cur.stats() : null; }
  /** re-apply after the rig setting changed */
  refresh() { if (this.args) this.setClass(...this.args); }
  set visible(v) { this.vis = v; this.cur.visible = v; }
  get visible() { return this.vis; }
  update(f, dt, t, baseY, frozen = false, shake = 0) {
    this.cur.update(f, dt, t, baseY, frozen, shake);
    const tip = this.cur.joints && this.cur.joints.tip;
    if (tip && dt > 0 && !frozen) { if (this.hasPrev) this.tipVel.subVectors(tip, this.prevTip).divideScalar(dt); this.prevTip.copy(tip); this.hasPrev = true; }
  }
  flash() { this.cur.flash(); }
  onHit(e) { if (this.cur.onHit) this.cur.onHit(e); }
  get joints() { return this.cur.joints; }
  // final boss hooks (anime only; the neon / classic rigs ignore them)
  get cloaked() { return !!this.cur.cloaked; }
  setCloak(on) { if (this.cur.setCloak) this.cur.setCloak(on); }
  setPhaseLook(p) { if (this.cur.setPhaseLook) this.cur.setPhaseLook(p); }
  get spawnGhostAt() { return this.cur.spawnGhostAt && this.cur.ghosts ? (...a) => this.cur.spawnGhostAt(...a) : null; }
  /** Assassin 居合: the ult's delayed hits land while the blades go home (main.js draws X cuts on the foe instead of contact sparks) */
  zan() { return !!(this.cur.zanNow && this.cur.zanNow()); }
  /** swing-sound cue: HQ fires when the blade starts accelerating; classic fires on the move start (handled by main) */
  takeSwingCue(f) { return this.cur.takeSwingCue ? this.cur.takeSwingCue(f) : null; }
  /** world point where this fighter's weapon meets the defender's body (sparks go here). null = no weapon segment */
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
