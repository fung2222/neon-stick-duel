// Auto-landscape for 機甲雷台.
// Goal: flip to landscape as soon as the game opens — no blocking "please rotate" card.
//
// Platform reality:
//   • Android Chrome / installed PWA / Capacitor WebView: screen.orientation.lock('landscape')
//     usually works after a user gesture (and often at boot inside Capacitor / fullscreen).
//   • iOS Safari (and most iOS Chrome): orientation.lock is unavailable on the open web.
//     We apply a CSS rotate(90deg) full-viewport fallback so a physically-portrait phone
//     still shows a logical landscape game UI, with window.innerWidth/Height proxied so
//     Three.js + the touch pad lay out as landscape.
//   • Desktop narrow windows: no CSS rotate (would look wrong); existing portrait camera
//     path keeps the game playable without any overlay.
//
// isBlocked() is always false — play is never gated on orientation.

let cssOn = false;
let proxyOn = false;
let lockOk = false;
let physW = 0;
let physH = 0;

/** Physical viewport (untransformed). Prefer visualViewport — survives our innerWidth proxy. */
function readPhysical() {
  try {
    const vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) {
      physW = Math.round(vv.width);
      physH = Math.round(vv.height);
      return { w: physW, h: physH };
    }
  } catch (_) { /* ignore */ }
  // Fallback before proxy is installed, or if visualViewport is missing.
  if (!proxyOn) {
    physW = window.innerWidth;
    physH = window.innerHeight;
  } else {
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;
    if (cw > 0 && ch > 0) { physW = cw; physH = ch; }
  }
  return { w: physW, h: physH };
}

export function isPortraitViewport() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(orientation: portrait)').matches) return true;
  } catch (_) { /* ignore */ }
  const p = readPhysical();
  return p.h > p.w;
}

function isMobileish() {
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (_) { /* ignore */ }
  readPhysical();
  if ((navigator.maxTouchPoints || 0) > 0 && Math.min(physW || 9999, physH || 9999) < 600) return true;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch (_) { /* ignore */ }
  return false;
}

/**
 * Install a permanent innerWidth/Height proxy.
 * When cssOn: returns swapped (logical landscape) sizes.
 * When cssOff: returns physical sizes (via visualViewport).
 * Never `delete` the override — that can break Chrome's native getters.
 */
function ensureProxy() {
  if (proxyOn || typeof window === 'undefined') return;
  readPhysical();
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    enumerable: true,
    get() {
      readPhysical();
      return cssOn ? physH : physW;
    },
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    enumerable: true,
    get() {
      readPhysical();
      return cssOn ? physW : physH;
    },
  });
  proxyOn = true;
}

/** Remap env(safe-area-inset-*) from physical → logical under rotate(90deg) CW. */
export function remapSafeInsets(sa) {
  if (!cssOn) return sa;
  // CW 90°: logical top←phys right, right←phys bottom, bottom←phys left, left←phys top (notch → stick side)
  return { t: sa.r, r: sa.b, b: sa.l, l: sa.t };
}

export function usingCssLandscape() { return cssOn; }

export function logicalSize() {
  readPhysical();
  if (cssOn) return { w: physH, h: physW };
  return { w: physW, h: physH };
}

function applyCssFallback(on) {
  const html = document.documentElement;
  const body = document.body;
  if (!body) return;
  ensureProxy();
  readPhysical();
  if (on) {
    const lw = physH, lh = physW;
    html.classList.add('css-landscape');
    body.style.position = 'absolute';
    body.style.width = lw + 'px';
    body.style.height = lh + 'px';
    body.style.top = '50%';
    body.style.left = '50%';
    body.style.margin = '0';
    body.style.overflow = 'hidden';
    // CW 90°: notch (phys top) lands on logical left (joystick side).
    body.style.transform = 'translate(-50%, -50%) rotate(90deg)';
    body.style.transformOrigin = 'center center';
  } else if (cssOn || html.classList.contains('css-landscape')) {
    html.classList.remove('css-landscape');
    body.style.position = '';
    body.style.width = '';
    body.style.height = '';
    body.style.top = '';
    body.style.left = '';
    body.style.margin = '';
    body.style.overflow = '';
    body.style.transform = '';
    body.style.transformOrigin = '';
  }
  cssOn = on;
}

async function lockViaCapacitor() {
  try {
    const SO = window.Capacitor?.Plugins?.ScreenOrientation;
    if (SO && typeof SO.lock === 'function') {
      await SO.lock({ orientation: 'landscape' });
      return true;
    }
  } catch (_) { /* plugin missing / denied */ }
  return false;
}

async function lockViaScreenApi() {
  try {
    const o = screen.orientation;
    if (o && typeof o.lock === 'function') {
      await o.lock('landscape');
      return true;
    }
  } catch (_) { /* unsupported / needs gesture / insecure */ }
  try {
    const s = screen;
    if (typeof s.lockOrientation === 'function') { s.lockOrientation('landscape'); return true; }
    if (typeof s.mozLockOrientation === 'function') { s.mozLockOrientation('landscape'); return true; }
    if (typeof s.msLockOrientation === 'function') { s.msLockOrientation('landscape'); return true; }
  } catch (_) { /* ignore */ }
  return false;
}

export function tryLockLandscape() {
  return (async () => {
    if (await lockViaCapacitor()) { lockOk = true; return true; }
    if (await lockViaScreenApi()) { lockOk = true; return true; }
    return false;
  })();
}

/** Best-effort fullscreen then lock — helps Android Chrome honor orientation.lock. */
export function tryFullscreenAndLock() {
  return (async () => {
    try {
      const el = document.documentElement;
      if (isMobileish() && !document.fullscreenElement && el.requestFullscreen) {
        try { await el.requestFullscreen({ navigationUI: 'hide' }); } catch (_) { /* denied */ }
      }
    } catch (_) { /* ignore */ }
    return tryLockLandscape();
  })();
}

/**
 * Install auto-landscape: aggressive lock + CSS rotate fallback on mobile portrait.
 * Never blocks input. onChange(cssFallbackActive) fires when the CSS path toggles.
 */
export function installLandscapeGate({ onChange } = {}) {
  const hideLegacyOverlay = () => {
    const el = document.getElementById('orient-lock');
    if (el) {
      el.classList.remove('on');
      el.setAttribute('aria-hidden', 'true');
      el.hidden = true;
      el.style.display = 'none';
    }
    document.documentElement.classList.remove('need-landscape');
    if (document.body) document.body.classList.remove('need-landscape');
  };

  let syncing = false;
  const sync = () => {
    if (syncing) return;
    syncing = true;
    try {
      readPhysical();
      hideLegacyOverlay();
      const portrait = isPortraitViewport();
      // Physical landscape (lock worked or user rotated) → never use CSS fallback.
      // Mobile portrait without a successful lock → CSS rotate so play stays landscape.
      const next = portrait && isMobileish() && !lockOk;
      const prev = cssOn;
      applyCssFallback(next);
      if (next !== prev || next) {
        try { if (next !== prev) onChange?.(next); } catch (_) { /* ignore */ }
        // Nudge stage/pad to re-read proxied innerWidth. Guard above stops recursion.
        try { window.dispatchEvent(new Event('resize')); } catch (_) { /* ignore */ }
      }
    } finally {
      syncing = false;
    }
  };

  const bumpLock = () => {
    tryLockLandscape().then((ok) => {
      if (ok) lockOk = true;
      // If lock claims success but viewport is still portrait, keep/enable CSS fallback.
      if (ok && isPortraitViewport()) lockOk = false;
      sync();
    });
  };

  ensureProxy();
  sync();
  window.addEventListener('resize', () => { readPhysical(); sync(); });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (isPortraitViewport()) lockOk = false;
      bumpLock();
    }, 80);
  });
  try {
    screen.orientation?.addEventListener?.('change', () => {
      if (isPortraitViewport()) lockOk = false;
      sync();
    });
  } catch (_) { /* ignore */ }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) bumpLock();
  });
  try {
    window.visualViewport?.addEventListener?.('resize', () => { readPhysical(); sync(); });
  } catch (_) { /* ignore */ }

  bumpLock();

  return {
    isBlocked: () => false,
    tryLock: tryLockLandscape,
    tryFullscreenAndLock,
    sync,
    usingCss: () => cssOn,
  };
}
