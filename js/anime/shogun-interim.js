// 機械將軍 KAGE-SHŌGUN — INTERIM look (HANDOFF §16 step 1): the anime Swordsman body, recoloured red / black, driven by forms
// re-timed from the boss frame data (contact key on the first active frame, as for every class). Steps 2–3 replace this file
// with js/anime/shogun-body.js + js/anime/shogun.js (armour plates, kabuto, mask visor, nodachi, six data blades).
import { form } from './clip.js';
import { PROFILE as SWORD, STANCE, POSES, FORMS as F } from './sword.js';

const P = (o) => ({ ...STANCE, ...o });
// jōdan (blade raised overhead, two hands) and the karatake-wari chop it falls into — the boss's signature silhouette
const JODAN = P({ px: -0.02, py: 0.84, sp: -0.1, ch: -0.12, tw: 0.1, ctw: -0.1, hd: 0.02, fFx: 0.42, fBx: -0.46, hB: 0.3, gx: -0.05, gy: 1.92, ga: 2.7, gw: 0, oh: 0.9 });
const CHOP = P({ px: 0.14, py: 0.72, sp: 0.3, ch: 0.1, hd: -0.15, tw: 0.3, fFx: 0.56, fBx: -0.52, hB: 0, gx: 0.6, gy: 1.15, ga: -0.4, gw: 0, oh: 0.8 });
const CHOPE = P({ px: 0.14, py: 0.7, sp: 0.36, tw: 0.3, fFx: 0.56, fBx: -0.52, hB: 0, gx: 0.5, gy: 0.75, ga: -1.2, gw: 0, oh: 0.7 });
// summon: blade point to the sky (data blades unfold) → plunge the point toward the floor (the rain falls)
const SKY = P({ py: 0.9, sp: -0.14, ch: -0.16, hd: 0.2, tw: 0.2, ctw: 0, fFx: 0.34, fBx: -0.36, hB: 0, gx: 0.14, gy: 2.05, ga: 1.62, gw: 0.1, oh: 0, ox: -0.3, oy: 1.5 });
const PLUNGE = P({ px: 0.06, py: 0.7, sp: 0.42, ch: 0.12, hd: -0.25, tw: 0.3, fFx: 0.44, fBx: -0.46, kB: 0.4, hB: 0, gx: 0.42, gy: 0.82, ga: -1.45, gw: 0, oh: 0.85 });
// Mirror Guard: blade vertical in front of the face, flat of the blade to the foe (the "mirror"), deep horse stance
const MIRROR = P({ px: -0.05, py: 0.74, sp: 0.04, ch: -0.04, tw: 0.75, ctw: 0, hd: 0.02, fFx: 0.46, fBx: -0.46, kF: -0.15, kB: 0.55, hB: 0, gx: 0.3, gy: 1.2, ga: 1.57, gw: 1.35, oh: 0, ox: 0.3, oy: 1.5 });

/** boss move → keys (frame windows from CLASSES.shogun; every form keeps the contact key on the first active frame) */
function moveKeys(key, m) {
  const t = m.t;
  switch (key) {
    case 'a1': case 'ten1': return SWORD.moveKeys('a1', m);
    case 'a2': case 'ten2': return SWORD.moveKeys('a2', m);
    case 'a3': case 'ten3': return form(t, [['s', 0.45, JODAN, 'coil'], ['s', 0.85, JODAN, 'hold'], ['a', 0, CHOP, 'snap', 'stamp'], ['a', 1, CHOPE, 'whip'], ['r', 0.4, CHOPE, 'settle'], ['r', 0.8, CHOPE, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    // 居合裁き: the Gale Lunge iai crouch held long (the flash comes at ~2/3 of the coil) → one-handed screen-wide draw cut, held zanshin
    case 'iai': return form(t, [['s', 0.3, F.s1.A, 'coil', 'sink'], ['s', 0.92, F.s1.A2, 'hold'], ['a', 0, F.a1.S, 'snap', 'stamp'], ['a', 1, F.a1.E, 'whip', 'ring'], ['r', 0.35, F.a1.F, 'settle'], ['r', 0.85, F.a1.F, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'mirror': return form(t, [['s', 1, MIRROR, 'outQuad', 'sink'], ['a', 1, MIRROR, 'hold'], ['r', 0.6, POSES.guard, 'inOutSine'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'mcut': return SWORD.moveKeys('a3', m);   // spinning return cut
    case 'rain': return form(t, [['s', 0.7, SKY, 'coil', 'ring'], ['s', 1, SKY, 'hold'], ['a', 0, PLUNGE, 'snap', 'quake'], ['r', 0.6, PLUNGE, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    case 'glitch': return SWORD.moveKeys('a1', m);
    case 'ult': return SWORD.moveKeys('ult', m);
    case 'ultEnd': return form(t, [['s', 0.35, JODAN, 'coil', 'sink'], ['s', 1, JODAN, 'hold'], ['a', 0, CHOP, 'snap', 'quake'], ['a', 1, CHOPE, 'whip'], ['r', 0.5, CHOPE, 'hold'], ['x', 0.05, STANCE, 'inOutSine']]);
    default: return SWORD.moveKeys(key, m);
  }
}
export const PROFILE = { ...SWORD, id: 'shogun', moveKeys, ghosts: true, ghostN: 6, ghostTrail: false };
