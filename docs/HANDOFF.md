# NEON STICK DUEL 霓虹火柴人對決 — Handoff

Status: **web build v1.1 — bilingual + endless** · live https://fung2222.github.io/neon-stick-duel/ · not yet packaged for Android.
Series rules: `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md`. Replaces the retired ai-fighter / Stickman Fighter idea; all new code, original characters and icons (no trademarked names, no console-button symbols).

## 1. Design
- Side-on 3D duel on a neon rooftop above the NeonCity backdrop. Fighters auto-approach to striking range (`TUNE.approach`), so the player only chooses **timing** — one thumb.
- Gestures → commands (`js/duel.js act()`): tap = jab (chains jab → jab2 → kick within `comboWindow`), hold ≥200 ms = charge (`wind`), release = heavy (damage 12 + 20×charge, lunge; full charge `chargeMax` 0.9 s = **guard break**, unparryable; auto-release at 1.6 s), swipe up = jump (ground moves whiff if defender y > 0.9; tap in the air = dive kick), swipe sideways = dash relative to facing (0.18 s i-frames, cooldown), swipe down = parry (0.26 s window; success stuns the attacker 0.75 s).
- A swipe that starts as a very short hold (<0.2 s charge) cancels the charge so the swipe wins (no accidental weak heavies).
- Hits: hit-stop (0.05 / 0.12 s), knockback, shake, particles, shockwave on heavies, damage popups, combo counter, low-HP pulse, slow-mo + K.O. banner.
- **Endless tower (v1.1)**: floors are unbounded. `opponentFor(floor)`: 0–7 = authored `TOWER`, 8+ = procedural remix (archetype cycles 2F–8F, prefix 暗影/SHADOW, 超載/OVERDRIVE…, hue-shifted colour) with a capped curve: HP 150 + 6/floor (max 330), think ≥ 0.17 s, every rate ≤ 0.92. Milestone every 10 floors (`isMilestone`): +5000 score, toast, district theme shift (`theme.set(floor/10 + 2)`). Old saves with `lap` migrate to `floor = lap×8 + floor`. Best floor = endless record (`bestFloor`).
- **Bilingual (v1.1)**: cyber-kit v0.2.1 i18n; all strings in `js/strings.js`; HTML uses `data-i18n*`; toggle `#btn-lang` (start) / `#btn-lang2` (pause); opponent names/descriptions have zh + en (`descEn`). `?lang=en|zh`.
- **Tower** (`TOWER`): 8 original opponents with AI profiles (think interval, parry/evade/heavy/combo/dash/jump/punish rates; MIRROR copies your last command). Progress (`floor`, `lap`, `runScore`) is saved; menu shows CONTINUE + NEW TOWER RUN. Best floor `bestFloor`, best score via `store.submitBest`.
- Scoring: damage ×5, parry +150, evade +50; floor clear = 1000×floor + HP%×10 + seconds left×15 + perfect 2000.
- Round timer 60 s; time-out decides by HP %.
- Menu attract: two AIs spar behind the start screen. `?demo=1`: the player side is AI-driven and floors auto-advance.

## 2. Controls
Touch as above · keyboard J/Space jab, hold K (or L) charge, ↑ jump, ←/→ dash, ↓ parry, P/Esc pause, M mute, Enter on menus/results. Android back: dialog → pause → resume; result → menu.

## 3. File map
```
index.html       HUD (two HP bars with lag, floor, timer, score, combo, gesture bar with original SVG icons, charge ring), start / pause / result
css/game.css     HUD + portrait rules
js/duel.js       pure simulation: fighters, moves (frame data), parry/evade/guard break, physics, KO/time-out, AI, tower, scoring (unit-tested)
js/stickman.js   StickFighter: 2D FK skeleton → glowing capsule bones, 16 blended poses, charge orb, hex parry shield, hit flash
js/world.js      Rooftop: slab, neon edges, pylons, water tank, antenna beacon, AC units, 對決 sign, grid
js/audio.js      DuelAudio (cyber-kit SynthAudio, 'drive' music)
js/strings.js    zh-HK / en string table
js/main.js       states (menu/intro/play/paused/result), input mapping, events → FX, result/revive/ads, camera framing, demo
vendor/cyber-kit cyber-kit v0.2.1
tests/           duel.test.mjs, smoke.py
```
Test hook: `window.__duel` (state, floor, lap, score, duel, cmdLog, `api.cmd/setHp/close/freezeFoe/tank/screenOf`).

## 4. Tests
`node tests/duel.test.mjs` (22 tests, incl. endless opponents capped, floor 60 winnable, milestone bonus; approach, jab range, combo, parry/late parry, guard break, dash i-frames, jump vs ground jab, dive, charge interrupt, KO, time-out, bounds, tower data, AI-vs-AI finishes, top AI beats dummy AI ≥15/20, scoring) · `python tests/smoke.py [url] [out]` — 412×915 touch + 1280×800: start, tap jab lands, hold charge → heavy, swipe up/side/down, keyboard J / K-hold / ↑, pause/resume, KO → result → 2F, defeat → revive, CONTINUE on menu, demo, language toggle + persistence, English start screen, endless floor 9 → 10, `?lang=zh`, zero console errors. Last run 2026-10-02: ALL PASSED.

## 5. Android packaging
As DATA FUSE (Capacitor 8 + `@capacitor-community/admob` v8; app id suggestion `hk.fung2222.neonstickduel`; landscape or portrait both work — portrait recommended for one-thumb play).

## 6. Ad placements
| Placement | Type | Code | Rule |
|---|---|---|---|
| `floor` | interstitial | `nextFromResult()` / `resultMenu()` → `ads.naturalBreak('floor')` | only after the player taps next/retry/menu on a result; cooldown 180 s, every 3rd break, 150 s grace |
| `revive` | rewarded | `revive()` | opt-in, once per floor attempt, only after a K.O. loss |

## 7. Known issues / ideas
- Headless SwiftShader ≈ 3 FPS: tests poll state and check the accepted-command log; phones run at 60 FPS with auto-quality.
- Ideas: unlockable fighter colours/trails per lap, daily challenge floor, local 2-player (split screen halves as thumbs).
