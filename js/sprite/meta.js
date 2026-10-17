// Option 3 Phase 1 — sprite cast metadata (no three.js; node-testable).
export const SPRITE_CLASSES = {
  sword: {
    zh: '霓狐劍士', en: 'NEON FOX',
    color: 0x00e5ff, trim: 0xff7ad9, ear: 0xff4ad2,
    desc: ['賽博狐劍士 · 霓虹刃連段', 'Cyber fox bladesman · neon katana combos'],
  },
};
export const hasSprite = (cls) => !!SPRITE_CLASSES[cls];
export const spriteMeta = (cls) => SPRITE_CLASSES[cls] || null;
