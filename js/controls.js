// NEON STICK DUEL v2 — arcade controls: floating virtual joystick (left) + action buttons (right) + keyboard.
//   const ctl = createControls({ onCmd(cmd) {}, onAction(name) {}, active: () => bool });
//   ctl.read() → { mx: -1..1, guard: bool }  (call every sim step)
// Joystick: horizontal = move, push up = jump (edge), push down = guard (hold).
// Guard button: hold = guard; pressed while the stick / arrow keys point sideways = dodge.
// Attack: tap repeatedly to continue the combo (holding also re-taps every 130 ms).
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
    st.mx = Math.abs(dx / r) < 0.25 ? 0 : dx / r; st.my = dy / r;
    const up = st.my < -0.62;
    if (up && !st.up) fire('jump');
    st.up = up;
  }
  function joyReset() { st.joyId = null; st.mx = 0; st.my = 0; st.up = false; knob.style.transform = ''; joy.classList.remove('on'); joy.style.left = ''; joy.style.top = ''; }
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
  return {
    read() { const mx = horiz(); return { mx: Math.max(-1, Math.min(1, mx)), guard: st.guardBtn || st.keys.has('down') || st.my > 0.55 }; },
    reset() { st.keys.clear(); st.guardBtn = false; joyReset(); clearInterval(st.atkHold); st.atkHold = null; document.querySelectorAll('#btns .press').forEach((b) => b.classList.remove('press')); },
    get last() { return st.last; },
  };
}
