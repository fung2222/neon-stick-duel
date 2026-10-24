// Neon humanoid cast — mini Street Fighter / KOF roster (sword: bitmap frames; others procedural).
export const SPRITE_CLASSES = {
  sword: {
    zh: '劍士', en: 'SWORDSMAN',
    color: 0x5a6574, trim: 0x2a313c, accent: 0x00e8ff,
    style: 'blade',
    desc: ['機甲劍士 · 點陣姿勢精靈', 'Mech swordsman · bitmap pose sprites'],
  },
  mage: {
    zh: '魔法師', en: 'MAGE',
    color: 0xb26bff, trim: 0xffd76b, accent: 0xe0a0ff,
    style: 'loose',
    desc: ['霓虹術士 · 鬆散施法姿勢', 'Neon mage · loose casting poses'],
  },
  brawler: {
    zh: '拳師', en: 'BRAWLER',
    color: 0xff7a1a, trim: 0xffe14d, accent: 0xffb070,
    style: 'street',
    desc: ['霓虹拳師 · 街頭自由拳路', 'Neon brawler · free street punches'],
  },
  assassin: {
    zh: '刺客', en: 'ASSASSIN',
    color: 0x3bff9a, trim: 0xff2b6a, accent: 0xb8ffe0,
    style: 'fluid',
    desc: ['霓虹刺客 · 流動暗殺步法', 'Neon assassin · fluid kill steps'],
  },
  shogun: {
    zh: '機械將軍', en: 'KAGE-SHŌGUN',
    color: 0xff2440, trim: 0xffd2d8, accent: 0xff8090,
    style: 'oni',
    desc: ['最終頭目 · 秩序 → 崩壞', 'Final boss · Order → Collapse'],
  },
};
export const hasSprite = (cls) => !!SPRITE_CLASSES[cls];
export const spriteMeta = (cls) => SPRITE_CLASSES[cls] || null;
