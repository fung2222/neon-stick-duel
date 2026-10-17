// Neon humanoid cast — mini Street Fighter / KOF roster (procedural canvas sprites).
export const SPRITE_CLASSES = {
  sword: {
    zh: '劍士', en: 'SWORDSMAN',
    color: 0x00e5ff, trim: 0xe9fbff, accent: 0x7adfff,
    style: 'blade',
    desc: ['霓虹劍士 · 流暢斬擊連段', 'Neon swordsman · fluid slash combos'],
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
