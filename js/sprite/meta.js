// Option 3 — human-shaped neon sprite cast (all 4 kits). No three.js; node-testable.
// Display names stay the class names; meta adds palette + pose dialect.
export const SPRITE_CLASSES = {
  sword: {
    zh: '劍士', en: 'SWORDSMAN',
    color: 0x00e5ff, trim: 0xe9fbff, accent: 0x7adfff,
    style: 'blade', // flowing cuts, not rigid kata
    desc: ['霓虹劍士 · 流暢斬擊連段', 'Neon swordsman · fluid slash combos'],
  },
  mage: {
    zh: '魔法師', en: 'MAGE',
    color: 0xb26bff, trim: 0xffd76b, accent: 0xe0a0ff,
    style: 'loose', // floaty casting, open hands — not kung-fu
    desc: ['霓虹術士 · 鬆散施法姿勢', 'Neon mage · loose casting poses'],
  },
  brawler: {
    zh: '拳師', en: 'BRAWLER',
    color: 0xff7a1a, trim: 0xffe14d, accent: 0xffb070,
    style: 'street', // wide free boxing / street punches
    desc: ['霓虹拳師 · 街頭自由拳路', 'Neon brawler · free street punches'],
  },
  assassin: {
    zh: '刺客', en: 'ASSASSIN',
    color: 0x3bff9a, trim: 0xff2b6a, accent: 0xb8ffe0,
    style: 'fluid', // lean sneaky, whippy blades
    desc: ['霓虹刺客 · 流動暗殺步法', 'Neon assassin · fluid kill steps'],
  },
};
export const hasSprite = (cls) => !!SPRITE_CLASSES[cls];
export const spriteMeta = (cls) => SPRITE_CLASSES[cls] || null;
