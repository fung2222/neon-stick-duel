# Orientation — auto landscape (v0.5.5+)

Roy’s intent: **the game flips itself to landscape on open**. No blocking 「請將手機橫放 / Please rotate」 card.

## What we do

1. **Aggressive `orientation.lock('landscape')`**
   - Inline `<head>` script before modules
   - Again on boot, on `visibilitychange`, on every user gesture
   - First gesture also tries `requestFullscreen` then lock (helps Android Chrome)
   - Capacitor: `Plugins.ScreenOrientation.lock({ orientation: 'landscape' })` when present

2. **PWA / install hints**
   - `manifest.json` → `"orientation": "landscape"`, `"display": "fullscreen"`
   - `<meta name="screen-orientation" content="landscape">`
   - `mobile-web-app-capable` / Apple web-app meta

3. **CSS `rotate(90deg)` fallback (iOS Safari & any browser that cannot lock)**
   - Detect mobile-ish + physical portrait + lock did not stick
   - `html.css-landscape` + `body` sized to `innerHeight × innerWidth` and `transform: translate(-50%,-50%) rotate(90deg)`
   - Proxy `window.innerWidth` / `innerHeight` to the logical landscape size so Three.js (`createStage`) and the touch pad lay out as landscape
   - Remap `safe-area-inset-*` in `layoutPad()` (notch → logical left / stick side under CW 90°)
   - **Play is never blocked** — `isBlocked()` always returns `false`

4. **Desktop narrow windows**
   - No CSS rotate (looks wrong on a tall browser window)
   - Existing portrait camera path stays playable; no overlay

## What actually locks

| Environment | Auto lock? | Fallback |
|---|---|---|
| Android Chrome (HTTPS), after tap / fullscreen | Often yes | CSS rotate if lock denied |
| Android PWA / installed | Usually yes via manifest | — |
| Capacitor Android WebView + ScreenOrientation plugin / manifest landscape | Yes at boot | — |
| iOS Safari / iOS Chrome (open web) | **No** (API unsupported) | **CSS rotate** |
| iOS home-screen web app | Still no reliable lock | CSS rotate |
| Desktop | N/A | Portrait camera OK |

## Capacitor packaging note

When wrapping with Capacitor, also set native landscape:

- `capacitor.config` → `"orientation": "landscape"` (or the ScreenOrientation plugin)
- Android `AndroidManifest.xml` activity: `android:screenOrientation="landscape"`
- iOS: lock landscape in Xcode / `Info.plist` supported interface orientations

Web fallbacks above still cover TestFlight-less browser play.

## Files

- `js/orient.js` — lock + CSS fallback + proxy
- `css/game.css` — `html.css-landscape` rules; legacy `.orient-lock` forced hidden
- `manifest.json` — PWA landscape
- `index.html` — early lock script, manifest link
