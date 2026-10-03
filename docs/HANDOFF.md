# NEON STICK DUEL 霓虹火柴人對打 — Handoff

Status: **web build v2.0 — four classes, arcade controls, stage ladder + endless tower** · live https://fung2222.github.io/neon-stick-duel/ · demo `?demo=1` · not yet packaged for Android.
Series rules: `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md` (bilingual zh-HK/EN via `cyber.lang`, endless mode, noindex, moderate bloom/haze, hub contract in `docs/MONETIZATION.md`). Tier: **Silver**. All characters, names, icons and sounds are original (no trademarked names, no console-button symbols).

v2 (2026-10) replaced the v1 one-thumb gesture duel (auto-approach, tap/hold/swipe) with a classic arcade fighter: free movement, joystick + buttons, four classes with combos / skills / ultimates. v1 saves migrate automatically (§8).

## 1. Design overview
- Side-on 3D duel on a neon rooftop above the cyber-kit NeonCity backdrop. 1D arena `x ∈ [-7.5, 7.5]` m (`ARENA_HALF`), y up. 60 s round, time-out decides by HP %.
- **No auto-forward.** The player walks left/right freely (back-walk 0.8×), jumps, guards (hold) and dodges (guard + direction / Shift).
- Every class: a **3–4 hit basic chain** (keep tapping attack), a **2-hit air chain**, **two cooldown skills**, one **ultimate** charged by dealing (0.10 per HP) and taking (0.13 per HP) damage, with a cinematic cut-in.
- Melee classes get a **gap-closer (突進技)**; ranged classes get an **escape (脫離技)**; the Assassin (hybrid) has both (backstep throw + teleport strike).
- Feel: frame data (startup / active / recovery), **hit-stop** (`d.stop`), knockback, **launchers → juggles → air combos** with jump-cancel, spikes, knockdown + rise (invulnerable), **cancel windows** (`chain` fraction: basic → next basic / skill; skill → ult when it connected), super armour, i-frames, guard chip 10 % + guard meter + guard break, combo **proration** (−7.5 %/hit, floor 42 %), juggle cap 6.
- Rendering: lit capsule-bone stick fighters (MeshStandardMaterial, moderate emissive so they stay crisp under bloom), per-class outfit + weapon, spring-blended procedural poses (anticipation → strike → follow-through with slight overshoot), verlet cloth ribbons (coat tails, scarf, headband tails), additive weapon trails, star-sprite hit sparks + particles + shockwaves, damage numbers, combo counter.

## 2. Classes (js/classes.js)
| Class | Look (outfit + weapon) | HP / walk | Basic chain (tap) | Air | Skill 1 | Skill 2 | Ultimate |
|---|---|---|---|---|---|---|---|
| **劍士 Swordsman** (melee) | long coat (shell + collar + belt + 2 tails), visor · **blade** | 980 / 3.0 | Slash 44 → Back-slash 48 → Thrust 58 → Rising cut 72 (launcher) | Air slash 40 → Falling cleave 54 (spike) | **疾風突刺 Gale Lunge** 118 · *gap-closer* (23 m/s dash, i-frames 0.12–0.30 s) · cd 5.5 s | **昇龍斬 Rising Dragon** 108 · anti-air launcher, invulnerable start · cd 7 s | **千刃斬 Thousand Edges** 7×40 + 150 |
| **魔法師 Mage** (ranged) | robe cone + hem, hood with tip · **staff** with orb | 920 / 2.7 | Arcane bolt 35 → Twin bolt 37 → Star orb 52 (launch) — projectiles | Dive bolt 32 ×2 | **閃現 Blink** · *escape*: −4.2 m teleport + 40 blast where you stood, i-frames, usable in air; cornered → blinks past the foe · cd 4.5 s | **雷柱 Thunder Pillar** 118 · delayed (0.38 s) pillar under the foe, leads moving targets · cd 6.5 s | **星隕天降 Starfall** 5×66 + 100 meteors |
| **拳師 Brawler** (melee) | headband (torus + 2 ribbon tails), sash, visor · **gauntlets** ×2 | 1100 / 2.85 | Jab 42 → Cross 48 → Hook 60 → Uppercut 84 (launcher) | Air punch 44 → Hammer fist 64 (spike) | **火箭衝拳 Rocket Rush** 118 · *gap-closer* with super armour 0.10–0.33 s · cd 6.5 s | **震地拳 Quake Slam** 112 · ground AoE ±2.3 m launcher · cd 7 s | **百裂拳 Hundred Fists** 9×34 + 170 |
| **刺客 Assassin** (hybrid) | mask + glowing eye slit, scarf (ring + long ribbon) · **twin daggers** | 960 / 3.45 | Reverse stab 34 → Cross cut 36 → Knee 40 → Blade spin 30+34 (launcher) | Air cut 33 → Drop blade 44 (spike) | **影步飛刀 Shadow Step** · *escape*: backstep (−15 m/s, i-frames) + 3 thrown daggers ×32, usable in air · cd 5 s | **瞬殺 Phantom Strike** 104 · *gap-closer*: teleport behind (≤ 7 m) and stab · cd 7 s | **死蓮 Death Lotus** 8×36 + 160 (teleports in) |

Stats shown on the select screen (1–5): Sword ATK4 DEF3 SPD3 RNG2 · Mage 2/2/3/5 · Brawler 5/5/2/1 · Assassin 3/2/5/3.

### Balance philosophy
Ranged does less per hit and needs space; melee takes the risk of walking in and is rewarded with bigger chains and launch → air-combo routes. DPS / TTK sanity table (`node tests/dps.mjs`, theoretical ceiling: chain cancelled at its `chain` fraction, no guard, no proration):

| Class | HP | Basic chain (per hit) | Chain dmg | Chain time | Chain DPS | Skill 1 | Skill 2 | Ult | TTK vs 990 HP (chain loop) |
|---|---|---|---|---|---|---|---|---|---|
| Swordsman | 980 | 44 / 48 / 58 / 72 | 222 | 1.08 s | 206 | 118 (cd 5.5 s) | 108 (cd 7 s) | 390 | 4.8 s |
| Mage | 920 | 35 / 37 / 52 | 124 | 1.09 s | 113 | 40 (cd 4.5 s) | 118 (cd 6.5 s) | 430 | 8.7 s |
| Brawler | 1100 | 42 / 48 / 60 / 84 | 234 | 0.97 s | 242 | 118 (cd 6.5 s) | 112 (cd 7 s) | 442 | 4.1 s |
| Assassin | 960 | 34 / 36 / 40 / 64 | 174 | 0.84 s | 208 | 96 (cd 5 s) | 104 (cd 7 s) | 412 | 4.8 s |

Real fights last 15–26 s (AI vs AI) because of spacing, guarding, proration and knockdowns.

### AI-vs-AI balance sim (`node tests/balance.mjs 200 <diff>`, sides alternate, 200 fights per matchup)
Row = class, value = row win %. Last run 2026-10-03.

| diff 0.70 (ladder mid) | vs Sword | vs Mage | vs Brawler | vs Assassin | overall |
|---|---|---|---|---|---|
| Swordsman | 50 | 45 | 48 | 57 | 49.8 % |
| Mage | 56 | 53 | 52 | 53 | 53.3 % |
| Brawler | 52 | 48 | 57 | 49 | 49.5 % |
| Assassin | 43 | 48 | 51 | 49 | 47.0 % |

| diff 0.35 / 0.95 overall | Sword | Mage | Brawler | Assassin |
|---|---|---|---|---|
| diff 0.35 (easy) | 49.8 % | 43.7 % | 56.7 % | 49.8 % |
| diff 0.95 (hard) | 52.5 % | 42.8 % | 51.7 % | 53.0 % |

Worst single matchups: diff 0.35 Brawler–Sword 61 %, diff 0.95 Assassin–Mage 63 % (teleport strikes beat kiting at top AI skill). Everything at diff 0.7 is inside 43–57 %. `tests/duel.test.mjs` asserts every diff-0.7 matchup stays within 35–65 % (60 fights).

## 3. Controls
| Input | Touch | Keyboard |
|---|---|---|
| Move / back off | floating **virtual joystick** (left 46 % of the screen; appears where you touch) | `A` `D` / `←` `→` |
| Jump | stick up, or **JUMP** button | `W` / `↑` / `Space` |
| Guard (hold) | stick down, or hold **GUARD** | `S` / `↓` |
| Dodge (i-frames) | **GUARD** while the stick points sideways | `Shift` / `O` (+ direction) |
| Attack (combo) | **ATTACK** — keep tapping (holding repeats every 130 ms) | `J` |
| Skill 1 / Skill 2 | buttons with short skill names + **cooldown rings** + seconds | `K` / `L` |
| Ultimate | **ULT** button; ring = meter, pulses when ready | `U` / `I` |
| Pause / mute | top-right buttons | `P` / `Esc`, `M`; `Enter` = primary button on menus; `F` FPS |

Commands are buffered 0.2 s (`TUNE.bufferT`) so slightly early presses still chain. Android back: dialog → pause → resume; result → menu; select / trial → menu.

## 4. Modes (js/modes.js)
- **Stage ladder (階梯模式)**: 10 fights — 夜鴉 NIGHT CROW (assassin) · 後巷鐵拳 ALLEY IRONFIST (brawler) · 霓虹術士 NEON ADEPT (mage) · 浪人七號 RONIN-07 (sword) · **BOSS 重錘霸王 HAMMER KING** (brawler, HP ×1.55, size ×1.28) · 風暴巫女 STORM WITCH · 幻刃 PHANTOM EDGE · 劍聖 BLADE SAINT · 鏡像分身 MIRROR SHADE (your class) · **FINAL BOSS 塔主・零 TOWER LORD ZERO** (sword, HP ×1.85, ult gain ×1.35). AI difficulty 0.12 → 0.86. Progress saved per fight; clearing all 10 counts a ladder clear and restarts at fight 1. A loss retries the same fight.
- **Endless tower (無盡天台塔)**: unbounded floors (`endlessFoe(floor)`): class rotates (never the same class twice in a row), procedural names (暗影 / 超載 / 鉻鋼 … prefixes), capped curves — AI diff 0.18 → 0.95 (`capCurve`, τ = 16 floors), HP ×(1 + 0.015/floor, max +0.5), damage ×(1 + 0.007/floor, max +0.22); **boss every 10th floor** (+0.55 HP, +0.06 dmg, bigger, faster ult). It never ends; a loss retries the floor (score kept).
- AI (js/ai.js) uses each class's whole kit: spacing (mage keeps ~5 m, blinks when pressured, leads pillars; melee rolls/jumps through projectiles and uses closers vs ranged), reactive guard / dodge / anti-air with a reaction delay, combo continuation, jump-cancel air combos (diff > 0.45), skill enders, ult on hit-confirm, corner escape. Every rate scales with `diff`.
- Scoring: damage dealt ×0.5 live + evade +30; a win adds `fightScore` = 1000 × level + HP % × 10 + seconds left × 15 + best combo × 60 + perfect 2000 + boss 3000.
- Menu attract: two random classes spar behind the start screen. `?demo=1`: player side AI (diff 0.7), endless floors auto-advance, no saves (`&cls=mage&floor=12` optional).

## 5. Hub contract, trial caps, ads (cyber-arcade docs/MONETIZATION.md)
- `js/hub.js` reads `?hub=1&tier=free|silver|gold&ads=0|1[&trial=1&trialLeft=N]` with fallback to localStorage `cyber.entitlement`.
- **Trial caps** (`TRIAL` in js/modes.js, mirrored in cyber-arcade games.json `trial.caps`): **ladder fights 1–3, endless floors 1–3**. Trial runs always start at fight 1 / floor 1, never write ladder / tower saves, and show a trial tag; winning fight 3 / floor 3 opens the trial screen (`#screen-trial`) with **UNLOCK IN HUB** (`returnToHub`, leaves `cyber.arcade.openStore` so the hub opens its unlock sheet) and MAIN MENU. All four classes are playable in the trial.
- **Ads**: interstitial **only at game over** — after a lost fight, when the player taps RETRY or MAIN MENU, and only when `hub.ads` is true (Free tier) — `gameOverBreak()` → `ads.naturalBreak('gameover')` (kit caps: 180 s cooldown, every 2nd break, 120 s grace). Never after wins, never mid-ladder. **Rewarded revive**: once per fight after a K.O. loss (`revive()` → `ads.rewarded('revive')`, 50 % HP, foe pushed back). Web build: rewarded is granted free, interstitials never show (`?adsim=1` simulates both).

| Placement | Type | Code | Rule |
|---|---|---|---|
| `gameover` | interstitial | `resultMain()` (retry) / `resultMenu()` → `gameOverBreak()` | lost fight only, `hub.ads` only, kit caps |
| `revive` | rewarded | `revive()` | opt-in, once per fight, K.O. loss only |

## 6. Look / audio settings (keep tidy for the series-wide pass)
- **Bloom / exposure in one place**: `js/config.js` `POST = { bloom 0.45, bloomRadius 0.3, bloomThreshold 0.88, exposure 1.0 }` → `createStage({...POST})`. `?bloom=` still overrides (kit). `FxState.applyPost` adds a small aberration-driven bloom kick only. Roy wants crisp fighters: keep bloom moderate; fighters use lit materials with emissive ≤ 0.6 and the rooftop neon is ×1.3 (was ×2 in v1). Fog/haze comes from the kit theme unchanged.
- Particles use `SPARK_BRIGHT = 1.7` (kit default 3) and shockwaves `a: 1.4`.
- **Audio**: `js/audio.js` `DuelAudio extends SynthAudio` ('drive' music). Per-class swing/cast sounds, hit (metal tick for blades), block, guard break, dodge, blink, jump/land, thunder (pillar), boom (meteor), ult riser, KO, bells, victory, defeat. No master-volume code here — loudness belongs to cyber-kit. Attract/preview fights are silent.

## 7. File map
```
index.html        HUD (HP + ult bars, timer, stage/floor, score, combo, trial tag), joystick + 6 buttons with SVG cooldown rings,
                  ult cut-in, start / class select / pause / result / trial screens. noindex.
css/game.css      HUD, controls layout (portrait + landscape + short landscape), select screen, cut-in
js/classes.js     4 classes: stats, outfits, full move lists (frame data), projectiles — pure data
js/duel.js        pure sim (fixed DT 1/60): movement, buffer, chains, cancels, juggles, guard, armour, projectiles, hit-stop,
                  ult freeze, KO / time-out, events — unit-tested
js/ai.js          AI controller (aiThink), difficulty params, seeded RNG
js/modes.js       ladder, endless curve, trial caps, scoring, v1 → v2 save migration — pure
js/poses.js       base pose + per-class stances + 83 named key poses
js/stickman.js    StickFighter: FK skeleton → lit capsule bones, outfits, weapons, cloth ribbons, weapon trail, spring pose blending,
                  guard hex, ult-ready ring, hit flash
js/world.js       Rooftop stage + key/rim directional lights
js/controls.js    virtual joystick + buttons + keyboard → { mx, guard } + commands
js/main.js        shell: states (menu/select/intro/play/paused/result/trial), fixed-step loop, class-select preview vs a dummy,
                  events → FX/audio, projectile meshes, ult cinematic + camera, HUD, saves, hub/trial/ads, test hook
js/audio.js       DuelAudio · js/config.js look settings · js/strings.js zh/en table · js/hub.js hub contract
vendor/cyber-kit  cyber-kit v0.2.1
tests/            duel.test.mjs (26), balance.mjs, dps.mjs, smoke.py (headless Chrome)
```
Test hook `window.__duel`: state, mode, cls, stage, floor, score, duel, foe, cmdLog, adBreaks, interstitials, rewardedAsks, and `api.cmd / setHp / close / freezeFoe / tank / setUlt / startMode(mode,{cls,stage,floor}) / pickClass / fighter(who) / store() / hub() / screenOf`.

## 8. Saves (localStorage `cyber.neon-stick-duel.*`)
`cls` (last class) · `ladder` (next fight 0–9) · `ladderScore` · `ladderBest` (fights cleared, best) · `ladderClears` · `floor` (next endless floor, 0-based) · `runScore` · `bestFloor` · `best` (kit best score) · `muted` · `ver` = 2.
**Migration** (`migrateSave`, runs at boot): v1 `lap` → `floor += lap × 8`, `lap` removed, `cls` = sword, `ver` = 2. `floor`, `runScore`, `bestFloor`, `best`, `muted` keep their meaning, so a v1 tower run continues as the endless tower. Tested in duel.test.mjs and smoke.py.

## 9. Tests
- `node tests/duel.test.mjs` — 26 tests: class kits (3–4 hit chains, 2 skills with cooldowns, ult), ranged per-hit < melee per-hit, free movement (no auto-forward, slower back-walk), every class chains its full combo, launcher → juggle, launcher → jump-cancel → air combo, basic → skill cancel, cooldowns, gap-closers close / escapes open distance, mage corner blink crosses over, projectiles / pillar / meteors, ult (meter, freeze, invulnerable, damage), ult meter from dealing + taking damage, guard chip + guard break, dodge i-frames, jump over a bolt + wake-up invulnerability, juggle cap, KO / time-out, arena bounds, ladder data (bosses at 5 and 10, mirror, rising difficulty), endless never ends + capped + boss every 10, floor 60 winnable, harder AI beats easier AI, trial caps + scoring, v1 migration, balance band 35–65 % at diff 0.7.
- `node tests/balance.mjs [n] [diff]` — matchup matrix. `node tests/dps.mjs` — DPS/TTK table.
- `python tests/smoke.py [url] [out] [--quick]` — headless Chrome, 412×915 touch + 1280×800, zh + en: menu, class select (all 4), joystick walk/back-off/stand-still, keyboard / buttons (jump, guard, dodge), each class mid-combo, skill buttons + cooldown rings, ult cut-in, KO → result → next (saved), loss → revive, endless floor 12, pause/resume; hub trial caps (ladder 3 / endless 3 → trial screen, no saves), interstitial break only after a loss, v1 save migration, demo; zero console errors. Writes screenshots. Headless SwiftShader ≈ 3 FPS, so it polls state.

## 10. Known gaps / ideas
- Balance is tuned on AI-vs-AI; human players will find the Mage's kiting and the Assassin's teleport stronger/weaker than the AI does. Watch real play data.
- At top difficulty the Assassin beats the Mage ~63 %; at easy the Brawler is slightly favoured (~57 % overall).
- No local 2-player or online play. No per-class unlockable skins yet.
- Poses are procedural (no motion-captured clips); the cloth is a simple verlet strip; weapon trails look chunky at very low FPS.
- Android packaging: as DATA FUSE (Capacitor 8 + `@capacitor-community/admob` v8; app id `hk.fung2222.neonstickduel`); portrait and landscape both supported.
