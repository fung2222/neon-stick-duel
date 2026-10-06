// Anime class configs: outfit, hair, palette, weapon, face + the animation profile. Phase 1 ships the Swordsman; phase 2 adds
// Mage / Brawler / Assassin / final boss by writing one config + one animation profile each (see docs/HANDOFF.md §12).
import { PROFILE as SWORD_ANIM } from './sword.js';
import { PROFILE as MAGE_ANIM } from './mage.js';

export const ANIME_CLASSES = {
  sword: {
    id: 'sword', concept: 'cyber-samurai: long coat on springs, crimson obi, layered shoulder armour, silver spiky hair + ponytail, glowing-edge katana',
    palette: {
      skin: 0xf8cdb4, hair: 0xe4ebff, hairTie: 0x00e5ff, coat: 0x2d4683, lining: 0x7a1840, inner: 0xe8edf8, pants: 0x161b2e,
      sash: 0xc81e57, sashEdge: 0xf0c25a, armor: 0x56617e, boots: 0x15171f, glove: 0x1b1e2b, trim: 0x00e5ff, metal: 0xd4e2ff,
      tsuka: 0x10121a, tsukaWrap: 0x2b7d99, gold: 0xd9b45a, saya: 0x0e1018, line: 0x07060f,
    },
    paletteV2: { pants: 0x2c3558, boots: 0x1d2030, inner: 0xc6d0e6 },   // v2 body: lighter trousers so the long legs read against the night city
    hair: { style: 'spiky', bangs: 7, ponytail: { len: 0.44, segs: 3 } },
    outfit: { coat: { len: 0.68, flare: 0.11, chains: 7, gap: 0.78 }, collar: true, sash: { tails: 2 }, pauldron: 'F', bracer: 'F' },
    weapon: { type: 'katana', sheath: true },
    face: { iris: '#25d8ff', irisDark: '#08245a', brow: '#232842', blush: 'rgba(255,110,130,0.42)' },
    outlinePx: 1.9,
    anim: SWORD_ANIM,
  },
  mage: {
    id: 'mage', build: 'mage', recolor: ['cape', 'skirt'],
    concept: 'netrunner techno-sorceress: asymmetric bob + long near lock, bun with glowing hair-sticks, hood worn down, asymmetric short cape, sleeveless bodysuit, circuit tattoos, mudra hands, short skirt, thigh-high boots, floating holo-glyph focus',
    palette: {
      skin: 0xfad2bd, hair: 0x2d2550, suit: 0x1f1c38, cape: 0x3d2c7e, lining: 0xd5d9f0, skirt: 0x2e2660, tights: 0x564b8e, boots: 0x231e40, wrap: 0x3c3370,
      panel: 0x938cc8, gold: 0xf2c766, trim: 0xc58bff, nail: 0xd9a8ff, crystal: 0xf3eaff, crystalMid: 0xa77bff, crystalDeep: 0x4e2aa6, metalDark: 0x26223a, hairTie: 0xc58bff, line: 0x0a0614,
    },
    hair: { style: 'bob' },
    outfit: {},
    weapon: { type: 'focus' },
    face: { iris: '#c27bff', irisDark: '#2e0c5c', brow: '#241d44', lash: 'long', mouth: 'small', tattoo: '#d7a6ff', blush: 'rgba(255,110,160,0.45)' },
    outlinePx: 1.9,
    rimLight: { rimK: 0.85, rimW: 0.07 },   // v2.5: stronger / wider rim so the dark suit separates from the night city
    anim: MAGE_ANIM,
  },
};
