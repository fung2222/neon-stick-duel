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

export const RIG_DEFAULT = { sword: 'hq' };
let override = null;
export function setRigMode(m) { override = m === 'hq' || m === 'classic' ? m : null; }
export const rigMode = () => override;
export function rigFor(cls) {
  if (!HQ_PROFILES[cls]) return 'classic';
  return override || RIG_DEFAULT[cls] || 'classic';
}
export const hasHQ = (cls) => !!HQ_PROFILES[cls];

export class FighterView {
  constructor(scene) {
    this.classic = new StickFighter(scene); this.hq = new HQFighter(scene); this.hq.visible = false;
    this.cur = this.classic; this.rig = 'classic'; this.vis = true; this.prevTip = null; this.tipVel = new THREE.Vector3();
  }
  setClass(cls, color = null, scale = 1) {
    this.args = [cls, color, scale];
    const useHQ = rigFor(cls) === 'hq', next = useHQ ? this.hq : this.classic, other = useHQ ? this.classic : this.hq;
    next.setClass(cls, color, scale); other.visible = false;
    if (next !== this.cur) { this.cur = next; if (useHQ) this.hq.resetAnim(); }
    this.rig = useHQ ? 'hq' : 'classic'; this.cur.visible = this.vis;
  }
  /** re-apply after the rig setting changed */
  refresh() { if (this.args) this.setClass(...this.args); }
  set visible(v) { this.vis = v; this.cur.visible = v; }
  get visible() { return this.vis; }
  update(f, dt, t, baseY, frozen = false, shake = 0) {
    this.cur.update(f, dt, t, baseY, frozen, shake);
    const tip = this.cur.joints && this.cur.joints.tip;
    if (tip && dt > 0 && !frozen) { if (this.prevTip) this.tipVel.subVectors(tip, this.prevTip).divideScalar(dt); this.prevTip = tip.clone(); }
  }
  flash() { this.cur.flash(); }
  onHit(e) { if (this.cur.onHit) this.cur.onHit(e); }
  get joints() { return this.cur.joints; }
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
