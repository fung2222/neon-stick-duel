// Option 3 Phase 1 — neon fox sprite meta (no DOM / three).
import { SPRITE_CLASSES, hasSprite, spriteMeta } from '../js/sprite/meta.js';
import { CLASSES } from '../js/classes.js';

let n = 0, failed = 0;
const ok = (c, m) => { n++; if (!c) { failed++; console.error('FAIL', m); } else console.log('ok', m); };

ok(hasSprite('sword'), 'sword has sprite');
ok(!hasSprite('mage'), 'mage has no sprite yet');
ok(spriteMeta('sword').en === 'NEON FOX', 'EN name');
ok(spriteMeta('sword').zh === '霓狐劍士', 'ZH name');
ok(!!CLASSES.sword.moves.a1, 'kit still swordsman');
ok(Object.keys(SPRITE_CLASSES).length === 1, 'Phase 1 = one class');

if (failed) { console.error(failed + '/' + n + ' failed'); process.exit(1); }
console.log('ALL PASS', n);
