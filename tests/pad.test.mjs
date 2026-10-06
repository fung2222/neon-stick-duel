// Pure geometry check for the touch pad (js/controls.js padGeometry): node tests/pad.test.mjs
// Phones 360–430 px portrait, tall screens, landscape phones, desktop; with and without notch / gesture-bar safe areas.
import { padGeometry } from '../js/controls.js';
const sizes = [[360, 640], [360, 780], [375, 667], [390, 844], [412, 915], [430, 932], [412, 1000], [360, 800], [915, 412], [844, 390], [740, 360], [667, 375], [1280, 800], [1920, 1080], [768, 1024]];
const insets = [{ t: 0, r: 0, b: 0, l: 0 }, { t: 47, r: 0, b: 34, l: 0 }, { t: 0, r: 47, b: 21, l: 47 }, { t: 24, r: 0, b: 48, l: 0 }];
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } };
const shape = (b) => (b.round ? { c: true, x: b.x, y: b.y, r: b.w / 2 } : { c: false, l: b.x - b.w / 2, t: b.y - b.h / 2, r: b.x + b.w / 2, b: b.y + b.h / 2 });
const box = (s) => (s.c ? { l: s.x - s.r, t: s.y - s.r, r: s.x + s.r, b: s.y + s.r } : s);
function gap(a, b) {
  if (a.c && b.c) return Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
  if (!a.c && !b.c) return Math.max(b.l - a.r, a.l - b.r, b.t - a.b, a.t - b.b);
  const c = a.c ? a : b, r = a.c ? b : a, nx = Math.min(Math.max(c.x, r.l), r.r), ny = Math.min(Math.max(c.y, r.t), r.b);
  return Math.hypot(c.x - nx, c.y - ny) - c.r;
}
for (const [w, h] of sizes) for (const sa of insets.filter((i) => w > h || !i.l)) {   // side insets only exist in landscape
  const g = padGeometry(w, h, sa), tag = `${w}x${h} sa=${JSON.stringify(sa)}`;
  const S = g.btns.map(shape), Z = { l: g.zone.left, t: g.zone.top, r: g.zone.left + g.zone.width, b: g.zone.top + g.zone.height };
  ok(g.btns.every((b) => Math.min(b.w, b.h) >= 56), `${tag}: hit areas ≥ 56`);
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) ok(gap(S[i], S[j]) > 2, `${tag}: ${g.btns[i].cmd} vs ${g.btns[j].cmd} gap ${gap(S[i], S[j]).toFixed(1)}`);
  for (let i = 0; i < S.length; i++) { const B = box(S[i]); ok(Math.max(Z.l - B.r, B.l - Z.r, Z.t - B.b, B.t - Z.b) > 0, `${tag}: ${g.btns[i].cmd} clear of joystick zone`);
    ok(B.l >= sa.l && B.r <= w - sa.r && B.t >= sa.t && B.b <= h - sa.b, `${tag}: ${g.btns[i].cmd} inside the safe area`); }
  ok(g.zone.width >= 130 && g.zone.height >= 200, `${tag}: zone roomy ${g.zone.width}x${g.zone.height}`);
  const jl = g.joyRest.left, jt = g.joyRest.top + g.zone.top;
  ok(jl >= sa.l && jl + g.joySize <= g.zone.width && jt + g.joySize <= h - sa.b, `${tag}: resting joystick inside zone + safe area`);
}
console.log(`${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
