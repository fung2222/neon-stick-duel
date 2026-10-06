// NEON STICK DUEL v2 — arcade controls: floating virtual joystick (left) + action buttons (right) + keyboard.
//   const ctl = createControls({ onCmd(cmd) {}, onAction(name) {}, active: () => bool });
//   ctl.read() → { mx: -1..1, guard: bool }  (call every sim step)
// Joystick: horizontal = move, push up = jump (edge), push down = guard (hold). Generous radial dead-zone (DEAD).
// Guard button: hold = guard; pressed while the stick / arrow keys point sideways = dodge.
// Attack: tap repeatedly to continue the combo (holding also re-taps every 130 ms).
// Touch layout (v2.1, "pad"): layoutPad() places everything in viewport px from the screen size + safe-area insets:
//   left  = joystick zone only (nothing else may touch it);
//   right = face-button arc around a big ATTACK at the right-thumb rest: GUARD (low left) → SKILL 1 → SKILL 2 → JUMP
//           (above, toward the edge); the ULTIMATE is a separate shoulder-style pill above the arc.
//   Every hit area is ≥ 56 px and no two hit areas (circles; the ult pill as its rectangle) overlap or touch the zone.
const DEAD = 0.3;          // joystick dead-zone (fraction of the knob travel) — no drift from a resting thumb
const ARC = [['guard', -6], ['s1', 34], ['s2', 74], ['jump', 114]];   // degrees: 0 = left of ATTACK, 90 = straight above
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'atk', KeyK: 's1', KeyL: 's2', KeyU: 'ult', KeyI: 'ult', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyO: 'dodge',
  KeyP: 'pause', Escape: 'pause', KeyM: 'mute', Enter: 'primary', KeyF: 'fps',
};
export function createControls({ onCmd, onAction, active = () => true, anyGesture = () => {} }) {
  const $ = (id) => document.getElementById(id);
  const zone = $('joy-zone'), joy = $('joy'), knob = $('joy-knob');
  const st = { mx: 0, my: 0, guardBtn: false, keys: new Set(), joyId: null, cx: 0, cy: 0, up: false, atkHold: null, last: '' };
  const R = () => (joy.offsetWidth || 120) * 0.42;
  const fire = (cmd) => { if (!active()) return; st.last = cmd; onCmd(cmd); };
  // ---- joystick
  function joyMove(x, y) {
    let dx = x - st.cx, dy = y - st.cy; const r = R(), l = Math.hypot(dx, dy);
    if (l > r) { dx *= r / l; dy *= r / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / r, ny = dy / r, dz = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - DEAD) / (1 - DEAD) * 1.1));
    if (Math.hypot(nx, ny) < DEAD) { st.mx = 0; st.my = 0; } else { st.mx = dz(nx); st.my = ny; }
    const up = st.my < -0.62;
    if (up && !st.up) fire('jump');
    st.up = up;
  }
  function joyReset() { st.joyId = null; st.mx = 0; st.my = 0; st.up = false; knob.style.transform = ''; joy.classList.remove('on'); joy.style.left = st.restL || ''; joy.style.top = st.restT || ''; }
  zone.addEventListener('pointerdown', (e) => {
    anyGesture(); if (st.joyId !== null) return; e.preventDefault();
    st.joyId = e.pointerId; zone.setPointerCapture?.(e.pointerId);
    const zr = zone.getBoundingClientRect(), jr = joy.getBoundingClientRect();
    const hx = jr.width / 2, hy = jr.height / 2;
    st.cx = Math.max(zr.left + hx, Math.min(zr.right - hx, e.clientX)); st.cy = Math.max(zr.top + hy, Math.min(zr.bottom - hy, e.clientY));
    joy.style.left = (st.cx - zr.left - hx) + 'px'; joy.style.top = (st.cy - zr.top - hy) + 'px'; joy.classList.add('on');
    joyMove(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === st.joyId) { e.preventDefault(); joyMove(e.clientX, e.clientY); } });
  const end = (e) => { if (e.pointerId === st.joyId) joyReset(); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
  // ---- buttons
  document.querySelectorAll('#btns [data-cmd]').forEach((b) => {
    const cmd = b.dataset.cmd;
    b.addEventListener('pointerdown', (e) => {
      anyGesture(); e.preventDefault(); e.stopPropagation(); b.setPointerCapture?.(e.pointerId); b.classList.add('press');
      if (cmd === 'guard') { if (Math.abs(horiz()) > 0.4) fire('dodge'); else st.guardBtn = true; }
      else fire(cmd);
      if (cmd === 'atk') { clearInterval(st.atkHold); st.atkHold = setInterval(() => fire('atk'), 130); }
    });
    const up = () => { b.classList.remove('press'); if (cmd === 'guard') st.guardBtn = false; if (cmd === 'atk') { clearInterval(st.atkHold); st.atkHold = null; } };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  // ---- keyboard
  const horiz = () => { const k = st.keys; const kx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0); return kx || st.mx; };
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
    const a = KEYMAP[e.code]; if (!a) return; anyGesture();
    if (['up', 'down', 'left', 'right', 'atk', 's1', 's2', 'ult', 'dodge'].includes(a) || a === 'primary') e.preventDefault();
    if (a === 'left' || a === 'right' || a === 'down') { st.keys.add(a); return; }
    if (e.repeat) return;
    if (a === 'up') { st.keys.add('up'); if (active()) fire('jump'); else onAction('primary'); return; }
    if (['atk', 's1', 's2', 'ult', 'dodge'].includes(a)) { if (active()) fire(a); else if (a === 'atk') onAction('primary'); return; }
    onAction(a);
  });
  window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) st.keys.delete(a); });
  window.addEventListener('blur', () => { st.keys.clear(); st.guardBtn = false; joyReset(); });
  const relayout = () => { const L = layoutPad(); st.restL = L.joyRest.left + 'px'; st.restT = L.joyRest.top + 'px'; if (st.joyId === null) joyReset(); return L; };
  window.addEventListener('resize', relayout); window.addEventListener('orientationchange', () => setTimeout(relayout, 120));
  relayout();
  return {
    read() { const mx = horiz(); return { mx: Math.max(-1, Math.min(1, mx)), guard: st.guardBtn || st.keys.has('down') || st.my > 0.55 }; },
    reset() { st.keys.clear(); st.guardBtn = false; joyReset(); clearInterval(st.atkHold); st.atkHold = null; document.querySelectorAll('#btns .press').forEach((b) => b.classList.remove('press')); },
    get last() { return st.last; },
    layout: relayout,
  };
}

// ------------------------------------------------------------------ touch layout
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let probe = null;
function safeInsets() {
  if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe); }
  const c = getComputedStyle(probe), n = (v) => parseFloat(v) || 0;
  return { t: n(c.paddingTop), r: n(c.paddingRight), b: n(c.paddingBottom), l: n(c.paddingLeft) };
}
/**
 * Pure geometry: viewport (w, h) + safe insets → pixel boxes for the joystick zone, the resting joystick and every button.
 * Buttons: { cmd, x, y (centre), w, h, round }. Exported for tests (window.__duel.api.pad()).
 */
export function padGeometry(w, h, sa = { t: 0, r: 0, b: 0, l: 0 }) {
  const land = w > h * 1.05;
  const k = land ? clamp(h / 380, 1, 1.15) : clamp(Math.min(w / 380, h / 800), 1, 1.12);
  const rs = Math.round(29 * k), rA = Math.round(42 * k), gap = Math.round(7 * k);           // small r ≥ 29 → 58 px hit, attack 84+
  const R = Math.ceil(Math.max(rA + rs + gap, (2 * rs + gap) / (2 * Math.sin(Math.PI / 9))));  // 40° apart on the arc
  const mx = land ? 22 : 10, my = land ? 16 : 12, hintRoom = 18;                                // edge margins; room under GUARD for its hint
  const rad = (d) => (d * Math.PI) / 180, ax = (d) => Math.cos(rad(d)), ay = (d) => Math.sin(rad(d));
  // attack centre measured from the bottom-right safe corner (x leftwards, y upwards)
  const last = ARC[ARC.length - 1][1], first = ARC[0][1];
  const cx = Math.max(rA + mx, rs + mx - R * ax(last));
  const cy = Math.max(rA + my, rs + hintRoom - R * ay(first));
  const right = w - sa.r, bottom = h - sa.b, X = (x) => right - x, Y = (y) => bottom - y;
  const btns = [{ cmd: 'atk', x: X(cx), y: Y(cy), w: 2 * rA, h: 2 * rA, round: true }];
  let top = cy + rA;
  for (const [cmd, d] of ARC) { const bx = cx + R * ax(d), by = cy + R * ay(d); btns.push({ cmd, x: X(bx), y: Y(by), w: 2 * rs, h: 2 * rs, round: true }); top = Math.max(top, by + rs); }
  // ultimate: shoulder-style pill above the arc, flush with the right margin, a clear gap above the face buttons
  const uw = Math.round(100 * k), uh = Math.round(58 * k), ugap = Math.round((land ? 22 : 34) * k);
  let uy = top + ugap + uh / 2;
  const uMax = bottom - (sa.t + (land ? 96 : 150)) - uh / 2;                                  // never into the HP bars / pause buttons
  if (land && uy > uMax) uy = Math.max(top + 10 + uh / 2, uMax);
  btns.push({ cmd: 'ult', x: X(mx + uw / 2), y: Y(uy), w: uw, h: uh, round: false });
  const clusterLeft = Math.min(...btns.map((b) => b.x - b.w / 2));
  // joystick zone: left side only, ends 12 px before the cluster's leftmost hit area
  const zl = 0, zr = land ? Math.min(clusterLeft - 24, Math.round(w * 0.42)) : clusterLeft - 12;
  const zt = land ? Math.max(sa.t + 84, Math.round(h * 0.26)) : Math.max(Math.round(h * 0.5), h - 470);
  const zone = { left: zl, top: zt, width: Math.max(0, Math.floor(zr - zl)), height: h - zt };
  const joySize = Math.round(clamp(zone.width - sa.l - 24, 104, 132 * Math.min(k, 1.08)));
  const jx = land ? sa.l + 36 + joySize / 2 : clamp(zone.width / 2 + sa.l / 2, sa.l + 8 + joySize / 2, zone.width - 8 - joySize / 2);
  const jy = bottom - (land ? 28 : 34) - joySize / 2;
  return { land, k, zone, joySize, joyRest: { left: Math.round(jx - joySize / 2), top: Math.round(jy - joySize / 2 - zt) }, btns };
}
export function layoutPad() {
  const g = padGeometry(window.innerWidth, window.innerHeight, safeInsets());
  const $ = (id) => document.getElementById(id);
  const zone = $('joy-zone'), joy = $('joy');
  if (!zone || !joy) return g;
  Object.assign(zone.style, { left: g.zone.left + 'px', top: g.zone.top + 'px', width: g.zone.width + 'px', height: g.zone.height + 'px' });
  joy.style.width = joy.style.height = g.joySize + 'px';
  for (const b of g.btns) {
    const el = document.querySelector(`#btns [data-cmd="${b.cmd}"]`); if (!el) continue;
    Object.assign(el.style, { left: Math.round(b.x - b.w / 2) + 'px', top: Math.round(b.y - b.h / 2) + 'px', width: b.w + 'px', height: b.h + 'px' });
    const ring = el.querySelector('svg.ring.pill');
    if (ring) {   // ult meter traces the pill outline (pathLength keeps the shared 182.2 dash maths)
      const W = b.w + 12, H = b.h + 12; ring.setAttribute('viewBox', `0 0 ${W} ${H}`);
      for (const r of ring.querySelectorAll('rect')) { r.setAttribute('x', 3); r.setAttribute('y', 3); r.setAttribute('width', W - 6); r.setAttribute('height', H - 6); r.setAttribute('rx', (H - 6) / 2); }
    }
  }
  document.documentElement.classList.toggle('pad-land', g.land);
  return g;
}
