import { SPRITE_CLASSES, hasSprite, spriteMeta } from '../js/sprite/meta.js';
import { CLASSES, CLASS_IDS } from '../js/classes.js';

let n = 0, failed = 0;
const ok = (c, m) => { n++; if (!c) { failed++; console.error('FAIL', m); } else console.log('ok', m); };

for (const id of CLASS_IDS) {
  ok(hasSprite(id), `${id} has sprite`);
  ok(!!spriteMeta(id).style, `${id} has pose dialect`);
  ok(CLASSES[id].zh === spriteMeta(id).zh, `${id} keeps class name`);
}
ok(hasSprite('shogun'), 'boss has sprite body');
ok(spriteMeta('shogun').style === 'oni', 'shogun is oni dialect');
ok(spriteMeta('mage').style === 'loose', 'mage is loose dialect');
ok(spriteMeta('brawler').style === 'street', 'brawler is street dialect');
ok(spriteMeta('assassin').style === 'fluid', 'assassin is fluid dialect');
ok(spriteMeta('sword').style === 'blade', 'sword is blade dialect');
ok(Object.keys(SPRITE_CLASSES).length === 5, 'four kits + boss');

if (failed) { console.error(failed + '/' + n + ' failed'); process.exit(1); }
console.log('ALL PASS', n);
