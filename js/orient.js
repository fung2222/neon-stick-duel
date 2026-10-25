// Force landscape-only play: Screen Orientation API + portrait overlay gate.
// iOS Safari / many desktop browsers cannot lock orientation on the open web —
// the CSS/JS overlay still blocks upright play until the viewport is landscape.
let blocked = false;

export function isPortraitViewport() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(orientation: portrait)').matches) return true;
  } catch (_) { /* ignore */ }
  return window.innerHeight > window.innerWidth;
}

export function tryLockLandscape() {
  try {
    const o = screen.orientation;
    if (o && typeof o.lock === 'function') {
      return Promise.resolve(o.lock('landscape')).then(() => true).catch(() => false);
    }
  } catch (_) { /* unsupported / insecure context */ }
  return Promise.resolve(false);
}

/**
 * Install landscape gate: toggles `need-landscape` on <html>/<body>,
 * calls onChange(blocked) when portrait/landscape flips.
 * @returns {{ isBlocked: () => boolean, tryLock: () => Promise<boolean> }}
 */
export function installLandscapeGate({ onChange } = {}) {
  const sync = () => {
    const next = isPortraitViewport();
    document.documentElement.classList.toggle('need-landscape', next);
    if (document.body) document.body.classList.toggle('need-landscape', next);
    const el = document.getElementById('orient-lock');
    if (el) {
      el.classList.toggle('on', next);
      el.setAttribute('aria-hidden', next ? 'false' : 'true');
    }
    if (next !== blocked) {
      blocked = next;
      try { onChange?.(blocked); } catch (_) { /* listener errors must not break gate */ }
    }
  };

  sync();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', () => setTimeout(sync, 80));
  try {
    screen.orientation?.addEventListener?.('change', sync);
  } catch (_) { /* ignore */ }

  // Best-effort lock (usually needs a user gesture; safe to call early).
  tryLockLandscape();

  const overlay = document.getElementById('orient-lock');
  if (overlay) {
    const nudge = () => { tryLockLandscape(); };
    overlay.addEventListener('pointerdown', nudge);
    overlay.addEventListener('click', nudge);
  }

  return {
    isBlocked: () => blocked || isPortraitViewport(),
    tryLock: tryLockLandscape,
    sync,
  };
}
