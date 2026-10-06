// NEON STICK DUEL v2 — the four fighter classes: stats, outfits and full move lists (frame data).
// Pure data, no DOM / three.js. Units: metres, seconds, HP points. x is measured along the fighter's facing.
//
// Move fields
//   t: [startup, active, recover]           box: [x0, x1, y0, y1] hitbox relative to the feet (x along facing)
//   dmg, kb (knockback m/s), launch (vy on hit), spike (vy on hit, downward), stun (hit-stun s), stop (hit-stop s)
//   vx: forward speed while moving, vxT: [t0, t1] window for vx (default: startup+active)
//   multi: number of hit ticks spread over the active phase; last: overrides for the final tick
//   inv / armor: [t0, t1] invulnerable / super-armour windows        fire: [{ at, type, ... }] spawned effects
//   chain: the move may be cancelled into the next combo hit / a skill from this fraction of the move onwards
//   cd: cooldown (skills)        air: usable in the air       pose: [anticipation, strike, follow-through] pose keys
export const CLASS_IDS = ['sword', 'mage', 'brawler', 'assassin'];

const B = (o) => ({ kind: 'basic', stop: 0.05, stun: 0.32, kb: 1.6, launch: 0, ...o });
const A = (o) => ({ kind: 'air', air: true, stop: 0.05, stun: 0.3, kb: 1.2, launch: 3.2, ...o });
const S = (o) => ({ kind: 'skill', stop: 0.08, stun: 0.45, kb: 3, launch: 0, ...o });
const U = (o) => ({ kind: 'ult', stop: 0.06, stun: 0.5, kb: 0.6, launch: 0, unblockable: false, ...o });

export const CLASSES = {
  sword: {
    id: 'sword', zh: '劍士', en: 'SWORDSMAN', color: 0x00e5ff, trim: 0xe9fbff, cloth: 0x13233f,
    role: 'melee', hp: 980, walk: 3.0, weight: 1.0, reach: 1.7, prefer: 1.5,
    stats: { atk: 4, def: 3, spd: 3, rng: 2 },
    outfit: { weapon: 'blade', body: 'coat' },
    desc: ['均衡近戰 · 突刺貼身、昇龍挑空', 'Balanced melee · lunge in, launch with the rising dragon'],
    combo: ['a1', 'a2', 'a3', 'a4'], airCombo: ['air1', 'air2'],
    moves: {
      a1: B({ name: ['橫斬', 'Slash'], t: [0.08, 0.08, 0.2], dmg: 44, box: [0, 1.65, 0.5, 2.0], vx: 2.6, chain: 0.42, pose: ['swA0', 'swA1', 'swA1f'] }),
      a2: B({ name: ['回斬', 'Back-slash'], t: [0.08, 0.08, 0.2], dmg: 48, box: [0, 1.65, 0.5, 2.0], vx: 2.6, chain: 0.42, pose: ['swB0', 'swB1', 'swB1f'] }),
      a3: B({ name: ['突刺', 'Thrust'], t: [0.1, 0.09, 0.24], dmg: 58, box: [0, 1.95, 0.7, 1.8], vx: 4.2, kb: 2.4, stun: 0.38, chain: 0.45, pose: ['swC0', 'swC1', 'swC1f'] }),
      a4: B({ name: ['挑斬', 'Rising cut'], t: [0.12, 0.1, 0.36], dmg: 72, box: [-0.1, 1.7, 0.2, 2.6], vx: 2.2, kb: 1.4, launch: 9.6, stun: 0.6, stop: 0.08, chain: 0.4, pose: ['swD0', 'swD1', 'swD1f'] }),
      air1: A({ name: ['空斬', 'Air slash'], t: [0.06, 0.1, 0.16], dmg: 40, box: [-0.2, 1.6, -0.6, 1.8], chain: 0.45, pose: ['airA0', 'airA1', 'airA1f'] }),
      air2: A({ name: ['落斬', 'Falling cleave'], t: [0.08, 0.1, 0.24], dmg: 54, box: [-0.2, 1.6, -0.9, 1.6], launch: 0, spike: -13, kb: 2, stop: 0.08, pose: ['airB0', 'airB1', 'airB1f'] }),
      s1: S({ name: ['疾風突刺', 'Gale Lunge'], tag: 'closer', t: [0.14, 0.22, 0.32], dmg: 118, box: [0, 1.5, 0.5, 2.0], vx: 23, vxT: [0.12, 0.36], inv: [0.12, 0.3], kb: 5.5, stun: 0.55, cd: 5.5, pose: ['swC0', 'lunge', 'swC1f'] }),
      s2: S({ name: ['昇龍斬', 'Rising Dragon'], tag: 'antiair', t: [0.06, 0.2, 0.42], dmg: 108, box: [-0.3, 1.5, 0, 3.2], vx: 1.8, inv: [0, 0.2], launch: 11, kb: 1.2, stun: 0.7, cd: 7, selfVy: 9, pose: ['swD0', 'dragon', 'swD1f'] }),
      ult: U({ name: ['千刃斬', 'Thousand Edges'], t: [0.12, 1.05, 0.5], dmg: 40, box: [-0.6, 2.2, 0, 2.6], vx: 15, vxT: [0.1, 0.36], multi: 7, last: { dmg: 150, kb: 8, launch: 8, stun: 0.9, stop: 0.16 }, inv: [0, 1.7], pose: ['ult0', 'ultSword', 'swD1f'] }),
    },
  },
  mage: {
    id: 'mage', zh: '魔法師', en: 'MAGE', color: 0xb26bff, trim: 0xffd76b, cloth: 0x2a1450,
    role: 'ranged', hp: 920, walk: 2.7, weight: 0.9, reach: 7.5, prefer: 5.0,
    stats: { atk: 2, def: 2, spd: 3, rng: 5 },
    outfit: { weapon: 'staff', body: 'robe', head: 'hood' },
    desc: ['遠程法術 · 拉開距離、閃現逃脫', 'Ranged caster · keep distance, blink away'],
    combo: ['a1', 'a2', 'a3'], airCombo: ['air1', 'air2'],
    moves: {
      a1: B({ name: ['奧術彈', 'Arcane bolt'], t: [0.13, 0.05, 0.28], dmg: 0, chain: 0.4, fire: [{ at: 0.13, type: 'proj', proj: 'bolt' }], pose: ['mgA0', 'mgA1', 'mgA1f'] }),
      a2: B({ name: ['連珠彈', 'Twin bolt'], t: [0.12, 0.05, 0.28], dmg: 0, chain: 0.4, fire: [{ at: 0.12, type: 'proj', proj: 'bolt2' }], pose: ['mgB0', 'mgB1', 'mgB1f'] }),
      a3: B({ name: ['星核爆', 'Star orb'], t: [0.18, 0.05, 0.5], dmg: 0, chain: 0.45, fire: [{ at: 0.18, type: 'proj', proj: 'orb' }], pose: ['mgC0', 'mgC1', 'mgC1f'] }),
      air1: A({ name: ['俯射', 'Dive bolt'], t: [0.08, 0.05, 0.18], dmg: 0, chain: 0.45, fire: [{ at: 0.08, type: 'proj', proj: 'airbolt' }], pose: ['mgA0', 'mgAir', 'mgA1f'] }),
      air2: A({ name: ['俯射', 'Dive bolt'], t: [0.08, 0.05, 0.22], dmg: 0, fire: [{ at: 0.08, type: 'proj', proj: 'airbolt' }], pose: ['mgA0', 'mgAir', 'mgA1f'] }),
      s1: S({ name: ['閃現', 'Blink'], tag: 'escape', t: [0.04, 0.06, 0.16], dmg: 0, inv: [0, 0.26], cd: 4.5, air: true, fire: [{ at: 0.04, type: 'blink', dist: -4.2, blast: 'blast' }], pose: ['blink0', 'blink', 'mgA1f'] }),
      s2: S({ name: ['雷柱', 'Thunder Pillar'], tag: 'zone', t: [0.22, 0.05, 0.3], dmg: 0, cd: 6.5, fire: [{ at: 0.2, type: 'pillar', proj: 'pillar', maxDist: 7.5 }], pose: ['mgC0', 'mgCast', 'mgC1f'] }),
      ult: U({ name: ['星隕天降', 'Starfall'], t: [0.3, 0.1, 0.7], dmg: 0, inv: [0, 1.1], fire: [{ at: 0.28, type: 'meteors', proj: 'meteor', n: 6 }], pose: ['ult0', 'mgCast', 'mgC1f'] }),
    },
    projs: {
      bolt:    { dmg: 33, v: 11, life: 0.75, r: 0.32, y: 1.3, kb: 2.6, stun: 0.24 },
      bolt2:   { dmg: 35, v: 11.5, life: 0.75, r: 0.32, y: 1.15, kb: 2.8, stun: 0.26 },
      orb:     { dmg: 52, v: 8.5, life: 0.95, r: 0.48, y: 1.35, kb: 2.5, launch: 6.5, stun: 0.5, stop: 0.08 },
      airbolt: { dmg: 32, v: 10, vy: -7, life: 0.6, r: 0.32, y: 0.2, kb: 1.4, stun: 0.3, launch: 2 },
      blast:   { dmg: 40, v: 0, life: 0.16, r: 1.15, y: 0.4, h: 2.2, kb: 5, stun: 0.4 },
      pillar:  { dmg: 118, v: 0, life: 0.28, delay: 0.38, r: 0.9, y: 0, h: 3.6, kb: 0.8, launch: 10.5, stun: 0.7, stop: 0.09 },
      meteor:  { dmg: 66, v: 0, vy: -15, life: 1.4, r: 1.0, y: 8, kb: 1.5, launch: 5, stun: 0.6, stop: 0.06, ult: true },
    },
  },
  brawler: {
    id: 'brawler', zh: '拳師', en: 'BRAWLER', color: 0xff7a1a, trim: 0xffe14d, cloth: 0x3a1608,
    role: 'melee', hp: 1080, walk: 2.85, weight: 1.15, reach: 1.3, prefer: 1.1,
    stats: { atk: 5, def: 5, spd: 2, rng: 1 },
    outfit: { weapon: 'gauntlets', head: 'headband' },
    desc: ['重拳近身 · 火箭衝拳霸體突進', 'Heavy hitter · armoured rocket rush'],
    combo: ['a1', 'a2', 'a3', 'a4'], airCombo: ['air1', 'air2'],
    moves: {
      a1: B({ name: ['刺拳', 'Jab'], t: [0.06, 0.07, 0.16], dmg: 42, box: [0, 1.3, 0.8, 2.0], vx: 2.0, chain: 0.4, pose: ['brA0', 'brA1', 'brA1f'] }),
      a2: B({ name: ['直拳', 'Cross'], t: [0.07, 0.07, 0.18], dmg: 48, box: [0, 1.35, 0.8, 2.0], vx: 2.4, chain: 0.4, pose: ['brB0', 'brB1', 'brB1f'] }),
      a3: B({ name: ['勾拳', 'Hook'], t: [0.09, 0.08, 0.22], dmg: 60, box: [0, 1.35, 0.6, 2.1], vx: 2.6, kb: 2.2, stun: 0.38, chain: 0.42, pose: ['brC0', 'brC1', 'brC1f'] }),
      a4: B({ name: ['昇天拳', 'Uppercut'], t: [0.11, 0.09, 0.36], dmg: 84, box: [-0.1, 1.3, 0.3, 2.8], vx: 2.0, launch: 10, kb: 1.2, stun: 0.6, stop: 0.09, chain: 0.4, pose: ['brD0', 'brD1', 'brD1f'] }),
      air1: A({ name: ['空中拳', 'Air punch'], t: [0.05, 0.09, 0.15], dmg: 44, box: [-0.1, 1.3, -0.4, 1.8], chain: 0.45, pose: ['airA0', 'brAir', 'airA1f'] }),
      air2: A({ name: ['鐵鎚擊', 'Hammer fist'], t: [0.08, 0.1, 0.26], dmg: 64, box: [-0.2, 1.4, -1.0, 1.4], launch: 0, spike: -14, kb: 2, stop: 0.09, pose: ['airB0', 'brHammer', 'airB1f'] }),
      s1: S({ name: ['火箭衝拳', 'Rocket Rush'], tag: 'closer', t: [0.15, 0.24, 0.34], dmg: 118, box: [0, 1.4, 0.6, 2.1], vx: 20, vxT: [0.13, 0.39], armor: [0.1, 0.33], kb: 7, stun: 0.55, stop: 0.1, cd: 6.5, pose: ['brB0', 'rocket', 'brB1f'] }),
      s2: S({ name: ['震地拳', 'Quake Slam'], tag: 'aoe', t: [0.2, 0.12, 0.38], dmg: 112, box: [-2.3, 2.3, -0.2, 1.1], groundOnly: true, launch: 8.5, kb: 3, stun: 0.6, stop: 0.1, cd: 7, pose: ['quake0', 'quake', 'quakef'] }),
      ult: U({ name: ['百裂拳', 'Hundred Fists'], t: [0.12, 1.1, 0.5], dmg: 34, box: [-0.3, 1.8, 0, 2.6], vx: 13, vxT: [0.1, 0.33], armor: [0, 0.3], multi: 9, last: { dmg: 170, kb: 9, launch: 9, stun: 0.9, stop: 0.18 }, inv: [0, 1.72], pose: ['ult0', 'ultFists', 'brD1f'] }),
    },
  },
  assassin: {
    id: 'assassin', zh: '刺客', en: 'ASSASSIN', color: 0x3bff9a, trim: 0xff2b6a, cloth: 0x0c1a16,
    role: 'hybrid', hp: 1000, walk: 3.45, weight: 0.85, reach: 1.35, prefer: 1.3,
    stats: { atk: 3, def: 2, spd: 5, rng: 3 },
    outfit: { weapon: 'daggers', head: 'mask', neck: 'scarf' },
    desc: ['高速雙匕 · 影步飛刀、瞬殺繞背', 'Fast twin daggers · shadow-step throws, teleport strikes'],
    combo: ['a1', 'a2', 'a3', 'a4'], airCombo: ['air1', 'air2'],
    moves: {
      a1: B({ name: ['逆手刺', 'Reverse stab'], t: [0.05, 0.06, 0.14], dmg: 34, box: [0, 1.35, 0.6, 2.0], vx: 2.8, chain: 0.38, stun: 0.3, pose: ['asA0', 'asA1', 'asA1f'] }),
      a2: B({ name: ['交叉斬', 'Cross cut'], t: [0.05, 0.06, 0.14], dmg: 36, box: [0, 1.35, 0.6, 2.0], vx: 2.8, chain: 0.38, stun: 0.3, pose: ['asB0', 'asB1', 'asB1f'] }),
      a3: B({ name: ['膝撞', 'Knee'], t: [0.06, 0.07, 0.16], dmg: 40, box: [0, 1.2, 0.4, 1.7], vx: 3.0, chain: 0.4, stun: 0.34, pose: ['asC0', 'asC1', 'asC1f'] }),
      a4: B({ name: ['旋刃', 'Blade spin'], t: [0.07, 0.16, 0.3], dmg: 30, box: [-0.6, 1.45, 0.3, 2.3], vx: 2.0, multi: 2, last: { dmg: 34, launch: 9, stun: 0.6, stop: 0.08 }, chain: 0.4, pose: ['asD0', 'asSpin', 'asD1f'] }),
      air1: A({ name: ['空刃', 'Air cut'], t: [0.04, 0.08, 0.12], dmg: 33, box: [-0.2, 1.4, -0.5, 1.8], chain: 0.42, pose: ['airA0', 'asAir', 'airA1f'] }),
      air2: A({ name: ['墜刃', 'Drop blade'], t: [0.05, 0.1, 0.2], dmg: 44, box: [-0.2, 1.4, -0.9, 1.5], launch: 0, spike: -13, kb: 2, stop: 0.07, pose: ['airB0', 'asDrop', 'airB1f'] }),
      s1: S({ name: ['影步飛刀', 'Shadow Step'], tag: 'escape', t: [0.08, 0.18, 0.22], dmg: 0, inv: [0, 0.22], vx: -15, vxT: [0, 0.2], cd: 5, air: true, fire: [{ at: 0.12, type: 'proj', proj: 'dagger' }, { at: 0.18, type: 'proj', proj: 'dagger', dy: 0.25 }, { at: 0.24, type: 'proj', proj: 'dagger', dy: -0.2 }], pose: ['asB0', 'asThrow', 'asA1f'] }),
      s2: S({ name: ['瞬殺', 'Phantom Strike'], tag: 'closer', t: [0.17, 0.1, 0.3], dmg: 104, box: [-0.2, 1.4, 0.4, 2.1], inv: [0, 0.16], kb: 4, stun: 0.55, stop: 0.1, cd: 7, fire: [{ at: 0.15, type: 'teleport', behind: true, maxDist: 7 }], pose: ['blink0', 'asA1', 'asA1f'] }),
      ult: U({ name: ['死蓮', 'Death Lotus'], t: [0.14, 1.0, 0.45], dmg: 36, box: [-1.2, 1.6, 0, 2.6], multi: 8, last: { dmg: 160, kb: 8, launch: 9, stun: 0.9, stop: 0.16 }, inv: [0, 1.6], fire: [{ at: 0.1, type: 'teleport', behind: false, maxDist: 9 }], pose: ['ult0', 'asSpin', 'asD1f'] }),
    },
    projs: {
      dagger: { dmg: 32, v: 14, life: 0.45, r: 0.3, y: 1.35, kb: 1.4, stun: 0.3 },
    },
  },
};

// ------------------------------------------------------------------ final boss (not player-selectable: not in CLASS_IDS)
// 機械將軍 KAGE-SHŌGUN — the body of 塔主・零 TOWER LORD ZERO (ladder fight 10, endless floors 30 / 60 / 90 …). docs/HANDOFF.md §16.
// Extra move fields used only by the boss (duel.js):
//   phase: 1 | 2 — only usable in that phase (0 / missing = both)      follow: key of a move that starts automatically when this one ends
//   sub: true — only reachable through follow / counter (not a command)   flash: time of the telegraph flash event (dodge / jump cue)
//   parry: [t0, t1] — a basic / air melee hit landing from the front in this window is parried: the attacker staggers
//          (BOSS_TUNE.parryStun) and the boss starts `counter`; skills, ults and projectiles break the stance instead (+25 %, long stun)
//   callout: show the move name over the boss when it starts (telegraph text)
// Boss commands are 'bm:<key>' (act(f, 'bm:iai')). The phase flips once at phases.at × max HP (duel.js: 'phase' state, invulnerable).
const BS = (o) => ({ kind: 'skill', stop: 0.08, stun: 0.45, kb: 3, launch: 0, callout: true, ...o });
export const BOSS_IDS = ['shogun'];
CLASSES.shogun = {
  id: 'shogun', zh: '機械將軍', en: 'KAGE-SHŌGUN', color: 0xff2440, trim: 0xffd2d8, cloth: 0x140a0e,
  role: 'melee', boss: true, selectable: false, hp: 1000, walk: 2.55, weight: 1.3, reach: 1.75, prefer: 2.4,
  stats: { atk: 5, def: 4, spd: 2, rng: 3 },
  outfit: { weapon: 'blade', body: 'coat' },
  desc: ['最終頭目 · 兩個型態：秩序 → 崩壞', 'Final boss · two phases: Order → Collapse'],
  phases: { at: 0.5, transT: 1.2, names: [['秩序', 'ORDER'], ['崩壞', 'COLLAPSE']] },
  combo: ['a1', 'a2', 'a3'], airCombo: [],
  moves: {
    // nodachi basics (both phases): reach 1.8 m, startups 0.18–0.26 s
    a1: B({ name: ['袈裟斬', 'Kesa Cut'], t: [0.2, 0.08, 0.28], dmg: 48, box: [0, 1.8, 0.4, 2.1], vx: 2.0, chain: 0.5, pose: ['swA0', 'swA1', 'swA1f'] }),
    a2: B({ name: ['逆袈裟', 'Rising Kesa'], t: [0.18, 0.08, 0.28], dmg: 52, box: [0, 1.8, 0.4, 2.2], vx: 2.0, chain: 0.5, pose: ['swB0', 'swB1', 'swB1f'] }),
    a3: B({ name: ['唐竹割', 'Karatake Split'], t: [0.26, 0.1, 0.42], dmg: 66, box: [0, 1.75, 0.2, 2.4], vx: 1.6, kb: 3.2, stun: 0.45, stop: 0.07, pose: ['swD0', 'swD1', 'swD1f'] }),
    // ---- phase 1 「秩序」 Order: slow, perfect kenjutsu
    iai: BS({ name: ['居合裁き', 'Iai Judgement'], phase: 1, t: [0.62, 0.08, 0.55], flash: 0.42, dmg: 120, box: [0.2, 5.6, 0.1, 1.55], kb: 5, stun: 0.6, stop: 0.1, cd: 4.5, pose: ['swC0', 'lunge', 'swC1f'] }),
    ten1: BS({ name: ['十歩詰め', 'Ten-Step Advance'], phase: 1, t: [0.3, 0.08, 0.14], dmg: 46, box: [0, 1.85, 0.3, 2.1], vx: 3.4, vxT: [0.04, 0.36], kb: 3.4, stun: 0.36, cd: 6, follow: 'ten2', pose: ['swA0', 'swA1', 'swA1f'] }),
    ten2: BS({ name: ['十歩詰め・二', 'Ten-Step II'], sub: true, callout: false, t: [0.26, 0.08, 0.14], dmg: 46, box: [0, 1.85, 0.3, 2.1], vx: 3.4, vxT: [0.02, 0.32], kb: 3.4, stun: 0.36, follow: 'ten3', pose: ['swB0', 'swB1', 'swB1f'] }),
    ten3: BS({ name: ['十歩詰め・終', 'Ten-Step Finale'], sub: true, callout: false, t: [0.3, 0.1, 0.5], dmg: 66, box: [0, 1.95, 0.2, 2.2], vx: 3.6, vxT: [0.02, 0.38], kb: 7, stun: 0.5, stop: 0.1, pose: ['swD0', 'swD1', 'swD1f'] }),
    mirror: BS({ name: ['鏡受け', 'Mirror Guard'], phase: 1, t: [0.1, 0.95, 0.42], dmg: 0, parry: [0.08, 1.05], counter: 'mcut', cd: 6.5, pose: ['guard', 'guard', 'guard'] }),
    mcut: BS({ name: ['鏡返し', 'Mirror Return'], sub: true, t: [0.34, 0.1, 0.4], dmg: 100, box: [-0.2, 2.0, 0.2, 2.3], kb: 5, stun: 0.55, stop: 0.1, pose: ['swC0', 'swC1', 'swC1f'] }),
    // ---- phase 2 「崩壞」 Collapse: fast and glitchy
    rain: BS({ name: ['數據刃雨', 'Data-Blade Rain'], phase: 2, t: [0.45, 0.1, 0.5], dmg: 0, cd: 7, fire: [{ at: 0.4, type: 'rain', proj: 'dblade', n: 6, gap: 1.8, delay: 0.6, step: 0.13 }], pose: ['swD0', 'dragon', 'swD1f'] }),
    glitch: BS({ name: ['故障步', 'Glitch Step'], phase: 2, t: [0.62, 0.1, 0.42], dmg: 88, box: [-0.2, 1.9, 0.3, 2.2], inv: [0, 0.4], kb: 4, stun: 0.5, stop: 0.09, cd: 5,
      fire: [{ at: 0.04, type: 'decoy', side: -1, dist: 2.1, life: 0.34 }, { at: 0.18, type: 'decoy', side: 1, dist: 1.15, life: 0.3 }, { at: 0.36, type: 'teleport', behind: true, maxDist: 9 }], pose: ['blink0', 'swA1', 'swA1f'] }),
    ult: U({ name: ['千刃斬・鏡', 'Thousand Edges Mirrored'], phase: 2, t: [0.26, 0.81, 0.14], dmg: 28, box: [-0.6, 2.3, 0, 2.6], vx: 19.5, vxT: [0.22, 0.42], multi: 7, last: { dmg: 40, kb: 1.5, stun: 0.6 }, inv: [0, 1.0], follow: 'ultEnd', pose: ['ult0', 'ultSword', 'swD1f'] }),
    ultEnd: U({ name: ['千刃斬・鏡　終之型', 'Mirrored Finale'], sub: true, callout: true, t: [0.5, 0.1, 0.6], dmg: 140, box: [-0.3, 2.4, 0, 2.8], kb: 8, launch: 7, stun: 0.9, stop: 0.12, pose: ['swD0', 'swD1', 'swD1f'] }),
  },
  projs: {
    dblade: { dmg: 62, v: 0, life: 0.14, r: 0.32, y: 0, h: 3.0, kb: 2.2, stun: 0.42, stop: 0.06 },   // data blade: telegraphed column (delay = marker time)
    decoy: { dmg: 0, v: 0, life: 0.32, r: 0.4, y: 0, harmless: true },                              // Glitch Step after-image: no hitbox at all
  },
};

/** display info for the class-select screen */
export const STAT_KEYS = ['atk', 'def', 'spd', 'rng'];
export const classOf = (id) => CLASSES[id] || CLASSES.sword;
