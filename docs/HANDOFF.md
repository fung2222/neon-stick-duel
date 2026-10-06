# NEON STICK DUEL 霓虹火柴人對打 — Handoff

Status: **web build v2.3 — four classes, anime cel-shaded Swordsman (phase 1 of the anime upgrade, §12), HQ rig, double jump + auto-face, controller-style touch pad, stage ladder + endless tower** · live https://fung2222.github.io/neon-stick-duel/ · demo `?demo=1` · not yet packaged for Android.
Series rules: `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md` (bilingual zh-HK/EN via `cyber.lang`, endless mode, noindex, moderate bloom/haze, hub contract in `docs/MONETIZATION.md`). Tier: **Silver**. All characters, names, icons and sounds are original (no trademarked names, no console-button symbols).

v2 (2026-10) replaced the v1 one-thumb gesture duel (auto-approach, tap/hold/swipe) with a classic arcade fighter: free movement, joystick + buttons, four classes with combos / skills / ultimates. v1 saves migrate automatically (§8).

## 1. Design overview
- Side-on 3D duel on a neon rooftop above the cyber-kit NeonCity backdrop. 1D arena `x ∈ [-7.5, 7.5]` m (`ARENA_HALF`), y up. 60 s round, time-out decides by HP %.
- **No auto-forward.** The player walks left/right freely (back-walk 0.8×), jumps, guards (hold) and dodges (guard + direction / Shift).
- Every class: a **3–4 hit basic chain** (keep tapping attack), a **2-hit air chain**, **two cooldown skills**, one **ultimate** charged by dealing (0.10 per HP) and taking (0.13 per HP) damage, with a cinematic cut-in.
- Melee classes get a **gap-closer (突進技)**; ranged classes get an **escape (脫離技)**; the Assassin (hybrid) has both (backstep throw + teleport strike).
- Feel: frame data (startup / active / recovery), **hit-stop** (`d.stop`), knockback, **launchers → juggles → air combos** with jump-cancel, spikes, knockdown + rise (invulnerable), **cancel windows** (`chain` fraction: basic → next basic / skill; skill → ult when it connected), super armour, i-frames, guard chip 10 % + guard meter + guard break, combo **proration** (−7.5 %/hit, floor 42 %), juggle cap 6.
- **v2.2 (2026-10-06, Roy: "stickmen look stiff, joints look fake; combos chain smoothly but hits look and feel weird")**: the Swordsman renders with the new **HQ rig** (§11: IK skeleton, tapered-capsule body, keyframed clips with easing, springs, planted feet, real blade-arc trail, direction-aware hit reactions, contact sparks + cut flash, camera kick). Other classes stay classic until ported. Every class gets a **double jump** and fighters **auto-face** the opponent after a cross-over. Hit-stop is now 2–6 frames by hit strength (`hitStopOf`).
- Rendering (classic rig): lit capsule-bone stick fighters (MeshStandardMaterial, moderate emissive so they stay crisp under bloom), per-class outfit + weapon, spring-blended procedural poses (anticipation → strike → follow-through with slight overshoot), verlet cloth ribbons (coat tails, scarf, headband tails), additive weapon trails, star-sprite hit sparks + particles + shockwaves, damage numbers, combo counter.

## 2. Classes (js/classes.js)
| Class | Look (outfit + weapon) | HP / walk | Basic chain (tap) | Air | Skill 1 | Skill 2 | Ultimate |
|---|---|---|---|---|---|---|---|
| **劍士 Swordsman** (melee) | long coat (shell + collar + belt + 2 tails), visor · **blade** | 980 / 3.0 | Slash 44 → Back-slash 48 → Thrust 58 → Rising cut 72 (launcher) | Air slash 40 → Falling cleave 54 (spike) | **疾風突刺 Gale Lunge** 118 · *gap-closer* (23 m/s dash, i-frames 0.12–0.30 s) · cd 5.5 s | **昇龍斬 Rising Dragon** 108 · anti-air launcher, invulnerable start · cd 7 s | **千刃斬 Thousand Edges** 7×40 + 150 |
| **魔法師 Mage** (ranged) | robe cone + hem, hood with tip · **staff** with orb | 920 / 2.7 | Arcane bolt 33 → Twin bolt 35 → Star orb 52 (launch) — projectiles | Dive bolt 32 ×2 | **閃現 Blink** · *escape*: −4.2 m teleport + 40 blast where you stood, i-frames, usable in air; cornered → blinks past the foe · cd 4.5 s | **雷柱 Thunder Pillar** 118 · delayed (0.38 s) pillar under the foe, leads moving targets · cd 6.5 s | **星隕天降 Starfall** 5×66 + 100 meteors |
| **拳師 Brawler** (melee) | headband (torus + 2 ribbon tails), sash, visor · **gauntlets** ×2 | 1080 / 2.85 | Jab 42 → Cross 48 → Hook 60 → Uppercut 84 (launcher) | Air punch 44 → Hammer fist 64 (spike) | **火箭衝拳 Rocket Rush** 118 · *gap-closer* with super armour 0.10–0.33 s · cd 6.5 s | **震地拳 Quake Slam** 112 · ground AoE ±2.3 m launcher · cd 7 s | **百裂拳 Hundred Fists** 9×34 + 170 |
| **刺客 Assassin** (hybrid) | mask + glowing eye slit, scarf (ring + long ribbon) · **twin daggers** | 1000 / 3.45 | Reverse stab 34 → Cross cut 36 → Knee 40 → Blade spin 30+34 (launcher) | Air cut 33 → Drop blade 44 (spike) | **影步飛刀 Shadow Step** · *escape*: backstep (−15 m/s, i-frames) + 3 thrown daggers ×32, usable in air · cd 5 s | **瞬殺 Phantom Strike** 104 · *gap-closer*: teleport behind (≤ 7 m, startup 0.17 s — reactable only by top-skill AI/humans) and stab · cd 7 s | **死蓮 Death Lotus** 8×36 + 160 (teleports in) |

Stats shown on the select screen (1–5): Sword ATK4 DEF3 SPD3 RNG2 · Mage 2/2/3/5 · Brawler 5/5/2/1 · Assassin 3/2/5/3.

### Balance philosophy
Ranged does less per hit and needs space; melee takes the risk of walking in and is rewarded with bigger chains and launch → air-combo routes. DPS / TTK sanity table (`node tests/dps.mjs`, theoretical ceiling: chain cancelled at its `chain` fraction, no guard, no proration):

| Class | HP | Basic chain (per hit) | Chain dmg | Chain time | Chain DPS | Skill 1 | Skill 2 | Ult | TTK vs 990 HP (chain loop) |
|---|---|---|---|---|---|---|---|---|---|
| Swordsman | 980 | 44 / 48 / 58 / 72 | 222 | 1.08 s | 206 | 118 (cd 5.5 s) | 108 (cd 7 s) | 390 | 4.8 s |
| Mage | 920 | 33 / 35 / 52 | 120 | 1.09 s | 110 | 40 (cd 4.5 s) | 118 (cd 6.5 s) | 430 | 9.0 s |
| Brawler | 1080 | 42 / 48 / 60 / 84 | 234 | 0.97 s | 242 | 118 (cd 6.5 s) | 112 (cd 7 s) | 442 | 4.1 s |
| Assassin | 1000 | 34 / 36 / 40 / 64 | 174 | 0.84 s | 208 | 96 (cd 5 s) | 104 (cd 7 s) | 412 | 4.8 s |

Real fights last 15–26 s (AI vs AI) because of spacing, guarding, proration and knockdowns.

### AI-vs-AI balance sim (`node tests/balance.mjs 1000 <diff>`, sides alternate, 1000 fights per matchup, deterministic seeds)
Row = class, value = row win %. Last run **2026-10-06 (v2.2, after double jump + auto-face + the v2.2 balance pass)**. Target: every matchup 40–60 % at every difficulty.

| diff 0.70 (ladder mid) | vs Sword | vs Mage | vs Brawler | vs Assassin | overall |
|---|---|---|---|---|---|
| Swordsman | — | 41 | 48 | 52 | 46.9 % |
| Mage | 59 | — | 58 | 46 | 54.4 % |
| Brawler | 52 | 42 | — | 48 | 47.1 % |
| Assassin | 49 | 54 | 52 | — | 51.5 % |

| diff 0.35 (easy) | vs Sword | vs Mage | vs Brawler | vs Assassin | overall |
|---|---|---|---|---|---|
| Swordsman | — | 52 | 44 | 50 | 48.6 % |
| Mage | 48 | — | 43 | 48 | 46.2 % |
| Brawler | 56 | 57 | — | 54 | 55.5 % |
| Assassin | 50 | 53 | 46 | — | 49.6 % |

| diff 0.95 (hard) | vs Sword | vs Mage | vs Brawler | vs Assassin | overall |
|---|---|---|---|---|---|
| Swordsman | — | 49 | 41 | 57 | 49.0 % |
| Mage | 51 | — | 47 | 42 | 46.7 % |
| Brawler | 59 | 53 | — | 59 | 56.8 % |
| Assassin | 43 | 58 | 41 | — | 47.4 % |

All 18 matchup cells are inside **41–59 %** (mirror matches 46–52 %, i.e. seed noise; the same matchup moves ±3 pts between seed sets at n = 1000, so cells near 41 / 59 are at the edge of the band). Average fight 16–26 s, no time-outs.

**Balance pass v2.2** (2026-10-06). Auto-face removed an old AI advantage: before, a fighter left facing away after a cross-over / teleport could attack backwards and whiff; now attacks, landings, dodge ends, wake-ups and (after 0.12 s) guard / hit-stun turn to the foe. Together with the double jump this moved some cells out of the band: diff 0.7 Mage–Brawler 61 %, diff 0.95 Sword–Assassin 65 %, and Brawler–Sword 66–68 % once the air double-jump extension was removed completely. Fixes (AI, plus one stat): (1) the AI's "launcher → jump-cancel" out of an **air** hit (now a double-jump juggle extension) is used at 0.3 × `jcP`; (2) melee jump-ins against a Mage only from skilled AI (`jumpIn` = max(0, diff − 0.6)/s; jump-ins mostly ate anti-airs); (3) Mage escape-cancel `escP` = 2.2 × (diff − 0.62) (was 1.6 × (diff − 0.5)); (4) Assassin HP 980 → 1000. Swordsman damage and frame data are unchanged.

Balance pass v2.0.1 (before → after, worst cells): diff 0.95 Assassin–Mage 63 → 52 %, Brawler–Mage 60 → 47 %; diff 0.35 Brawler–Sword 60 → 58 %. Changes: Mage AI can **escape-cancel** a basic volley into Blink when a melee/teleport threat starts (rate `escP` = 1.6 × (diff − 0.5), so only skilled AI does it — a human can always do it); AI reacts to teleport strikes by blinking / dodging / hopping instead of guarding the wrong side; Phantom Strike startup 0.12 → 0.17 s (teleport at 0.15 s); Mage bolts 35/37 → 33/35; Brawler HP 1100 → 1080; Assassin HP 960 → 980. `tests/duel.test.mjs` asserts every diff-0.7 matchup is within 40–60 % over 400 deterministic fights.

## 3. Controls
| Input | Touch | Keyboard |
|---|---|---|
| Move / back off | floating **virtual joystick** in its own zone on the left (appears where you touch; radial dead-zone 30 % of the travel) | `A` `D` / `←` `→` |
| Jump / **double jump** | stick up, or **JUMP** button; press again in the air | `W` / `↑` / `Space`; press again in the air (key auto-repeat ignored, so holding W does not double jump) |
| Guard (hold) | stick down, or hold **GUARD** | `S` / `↓` |
| Dodge (i-frames) | **GUARD** while the stick points sideways | `Shift` / `O` (+ direction) |
| Attack (combo) | big **ATTACK** — keep tapping (holding repeats every 130 ms) | `J` |
| Skill 1 / Skill 2 | buttons with short per-class skill names + **cooldown rings** + seconds | `K` / `L` |
| Ultimate | shoulder-style **ULT** pill; its outline = meter, pulses when ready | `U` / `I` |
| Pause / mute | top-right buttons | `P` / `Esc`, `M`; `Enter` = primary button on menus; `F` FPS |

Commands are buffered 0.2 s (`TUNE.bufferT`) so slightly early presses still chain.

**Double jump (v2.2, every class)**: once per airtime, from a jump or from the recovery of an air attack (`TUNE.djAir`), not before 0.1 s of airtime (`djMin`); speed 0.9 × `jumpV` (`djMul`, ≈ 81 % of the first jump's height); resets on landing. Somersault (classic `tuck` pose + roll; HQ `tuck` clip with a full roll) + a small neon burst and ring (`audio.djump()`). The AI double-jumps once per airtime near the apex to chase a juggled / jumping foe, to clear a cross-up, or (Mage) to keep away (`djP` = 0.25 → 0.7 by diff), and sparingly to extend an air juggle. Hints: `keysHint` / `touchHint` (zh 「空中再撳＝二段跳」, en "(again in the air = double jump)").

**Auto-face (v2.2)**: `faceFoe(f, o)` turns a fighter toward the opponent on landing (jump or air attack), when a ground attack starts from neutral (input remap: a buffered attack right after a cross-over goes the right way), when an attack recovers (never mid-attack), at the end of a dodge and on wake-up. Grounded fighters left facing away in guard / block / hit-stun turn after `TUNE.turnDelay` = 0.12 s. Walking is in world space (stick right = move right), so "toward the foe" is forward again as soon as the facing flips. The renderer turns with a 0.14 s eased yaw + a turn pose (HQ) instead of snapping. Android back: dialog → pause → resume; result → menu; select / trial → menu.

### Touch pad layout (v2.1, 2026-10-06 — Roy: "Guard sat on the joystick; make it look like a game controller")
- **Left = joystick only.** `#joy-zone` runs from the left edge to 12 px before the leftmost button (portrait) / up to 42 % of the width (landscape); nothing else is inside it. A faint dashed panel marks the area.
- **Right = PlayStation-style face-button arc** around a big **ATTACK** at the right-thumb rest: **GUARD** (low left, with the `+方向＝閃避` hint under it) → **SKILL 1** → **SKILL 2** → **JUMP** (above, toward the edge), 40° apart on one arc (`ARC` in `js/controls.js`; angle 0 = left of ATTACK, 90 = straight above).
- **ULTIMATE** is a separate shoulder-style pill above the arc, flush right, ≥ 34 px (portrait) / 22 px (landscape) clear of the face buttons so it is not pressed by accident. No L/R buttons at the top corners: the top belongs to the HP bars + pause/mute, and Guard must stay on the right thumb so it can be combined with the stick for dodge.
- Geometry is pure JS (`padGeometry(w, h, safeInsets)` → `layoutPad()` writes px positions; re-run on resize / orientation change). Scale `k` = 1 at 360–380 px wide, up to 1.12 portrait / 1.15 landscape: small buttons 58–66 px, ATTACK 84–96 px, ULT pill 100×58 → 115×67. Safe-area insets come from a hidden `env(safe-area-inset-*)` probe; `node tests/pad.test.mjs` checks 15 screen sizes × notch / gesture-bar / landscape side insets (1530 assertions).
- Typical boxes: 360×780 — zone 145 px wide, ATTACK Ø84, buttons Ø58, closest gap 7 px; 412×915 — zone 183 px, ATTACK Ø92, buttons Ø62; 915×412 — zone 384 px (left), cluster at the right edge.
- Short landscape (≤ 560 px tall): HP bars move to the very top and narrow so they clear pause/mute.
- No new saves: the layout is computed, not stored, so old saves are untouched (`cyber.neon-stick-duel.*` unchanged).
- Multi-touch: the joystick and every button capture their own pointer (`setPointerCapture`), so stick + button work together (tested with CDP two-finger touch).

## 4. Modes (js/modes.js)
- **Stage ladder (階梯模式)**: 10 fights — 夜鴉 NIGHT CROW (assassin) · 後巷鐵拳 ALLEY IRONFIST (brawler) · 霓虹術士 NEON ADEPT (mage) · 浪人七號 RONIN-07 (sword) · **BOSS 重錘霸王 HAMMER KING** (brawler, HP ×1.55, size ×1.28) · 風暴巫女 STORM WITCH · 幻刃 PHANTOM EDGE · 劍聖 BLADE SAINT · 鏡像分身 MIRROR SHADE (your class) · **FINAL BOSS 塔主・零 TOWER LORD ZERO** (sword, HP ×1.85, ult gain ×1.35). AI difficulty 0.12 → 0.86. Progress saved per fight; clearing all 10 counts a ladder clear and restarts at fight 1. A loss retries the same fight.
- **Endless tower (無盡天台塔)**: unbounded floors (`endlessFoe(floor)`): class rotates (never the same class twice in a row), procedural names (暗影 / 超載 / 鉻鋼 … prefixes), capped curves — AI diff 0.18 → 0.95 (`capCurve`, τ = 16 floors), HP ×(1 + 0.015/floor, max +0.5), damage ×(1 + 0.007/floor, max +0.22); **boss every 10th floor** (+0.55 HP, +0.06 dmg, bigger, faster ult). It never ends; a loss retries the floor (score kept).
- AI (js/ai.js) uses each class's whole kit: spacing (mage keeps ~5 m, blinks when pressured — skilled mages escape-cancel a bolt volley into Blink —, leads pillars; melee rolls/jumps through projectiles and uses closers vs ranged), reactive guard / dodge / anti-air with a reaction delay, combo continuation, jump-cancel air combos (diff > 0.45), skill enders, ult on hit-confirm, corner escape. Every rate scales with `diff`.
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
- **Bloom / exposure in one place**: `js/config.js` `POST = { bloom 0.45, bloomRadius 0.3, bloomThreshold 0.88, exposure 1.0 }` → `createStage({...POST})`. Since cyber-kit v0.3.0 these are the **Glow HIGH** look; the default is **Glow LOW** (kit scales bloom ×0.45, radius ×0.55, threshold +0.12, aberration 0.0006, grain 0.01). Shared pref `localStorage cyber.glow`, `?glow=low|high`; the pause screen has a **GLOW: LOW/HIGH** button (`ui.glowToggle(stage)`). `?bloom=` still overrides (kit). `FxState.applyPost` adds a small aberration-driven bloom kick only. Roy wants crisp fighters: keep bloom moderate; fighters use lit materials with emissive ≤ 0.6 and the rooftop neon is ×1.3 (was ×2 in v1). Fog/haze comes from the kit theme (v0.3.0 default density 0.012, was 0.017 — lighter).
- Particles use `SPARK_BRIGHT = 1.7` (kit default 3) and shockwaves `a: 1.4`.
- **Audio**: `js/audio.js` `DuelAudio extends SynthAudio` ('drive' music, `sfxTrimDb: 0`). Kit v0.3.0 loudness chain (glue comp → limiter → soft clip → volume/mute). Measured 2026-10-06 with `python3 cyber-kit/tests/loudness.py http://127.0.0.1:PORT nsd-pad:DuelAudio` (served from the folder holding both checkouts): music −19.9 LUFS, SFX median −19.8 → **SFX/BGM +0.1 dB** (target −20 ± 1 LUFS, 0 ± 2 dB), so no trim is needed; re-measure after changing sounds. Per-class swing/cast sounds, hit (metal tick for blades), block, guard break, dodge, blink, jump/land, thunder (pillar), boom (meteor), ult riser, KO, bells, victory, defeat. No master-volume code here — loudness belongs to cyber-kit. Attract/preview fights are silent.

## 7. File map
```
index.html        HUD (HP + ult bars, timer, stage/floor, score, combo, trial tag), joystick zone + 6 buttons with SVG cooldown rings (ult = pill outline),
                  ult cut-in, start / class select / pause / result / trial screens. noindex.
css/game.css      HUD, control looks (positions come from js/controls.js), short-landscape HUD, select screen, cut-in
js/classes.js     4 classes: stats, outfits, full move lists (frame data), projectiles — pure data
js/duel.js        pure sim (fixed DT 1/60): movement, buffer, chains, cancels, juggles, guard, armour, projectiles, hit-stop,
                  ult freeze, KO / time-out, events — unit-tested
js/ai.js          AI controller (aiThink), difficulty params, seeded RNG
js/modes.js       ladder, endless curve, trial caps, scoring, v1 → v2 save migration — pure
js/poses.js       base pose + per-class stances + 83 named key poses
js/fighter-view.js FighterView: picks anime / HQ / classic per class (`?style=anime|neon`, `?rig=hq|classic`, save keys `style` / `rig`, pause buttons), contact point for sparks, FX cues
js/anime/         anime pipeline (v2.3, §12): toon.js (toon + outline shaders, face atlas) · geo.js (skin accumulator, tubes / shells / spikes) ·
                  builder.js (class config → skinned body + outline + face + weapon + spring chains) · clip.js (forms, power chain, extra channels) ·
                  solve.js (allocation-free port of core.solve) · sword.js (Swordsman kenjutsu forms) · configs.js (ANIME_CLASSES) · fighter.js (AnimeFighter)
js/rig/core.js    HQ rig math (pure, node-tested): skeleton lengths, joint limits, pose lerp, clips + easing, two-bone IK, solve()
js/rig/sword.js   Swordsman HQ profile: stance, 24 poses, A/S/E/F keys for every move, ult flurry, outfit
js/rig/hq-fighter.js HQFighter renderer (three.js): body meshes, neon rim, springs, cloth, planted feet, arc trail, hit reactions
js/stickman.js    StickFighter (classic rig): FK skeleton → lit capsule bones, outfits, weapons, cloth ribbons, weapon trail, spring pose blending,
                  guard hex, ult-ready ring, hit flash
js/world.js       Rooftop stage + key/rim directional lights
js/controls.js    virtual joystick + buttons + keyboard → { mx, guard } + commands; padGeometry / layoutPad (touch pad layout)
js/main.js        shell: states (menu/select/intro/play/paused/result/trial), fixed-step loop, class-select preview vs a dummy,
                  events → FX/audio, projectile meshes, ult cinematic + camera, HUD, saves, hub/trial/ads, test hook
js/audio.js       DuelAudio · js/config.js look settings · js/strings.js zh/en table · js/hub.js hub contract
vendor/cyber-kit  cyber-kit v0.3.0
tests/            duel.test.mjs (29), rig.test.mjs (5), anime.test.mjs (6), pad.test.mjs, balance.mjs, dps.mjs, smoke.py + pad.py + rig_shots.py + anime_shots.py (headless Chrome)
```
Test hook `window.__duel`: state, mode, cls, stage, floor, score, duel, foe, cmdLog, adBreaks, interstitials, rewardedAsks, and `api.cmd / setHp / close / freezeFoe / tank / setUlt / startMode(mode,{cls,stage,floor}) / pickClass / fighter(who) / store() / hub() / screenOf / pad()` (pad = layout geometry + live button / zone rects), and for deterministic captures `api.rig() / setRig(mode, persist) / setStyle(mode, persist) / hold(on) / setPose(who, {st, mk, t, …}) / manual(on) / advance(dt, n, eachFn) / cam({fov, pos, look} | null) / renderInfo() / charStats()` (manual = the render loop stops stepping the sim; advance steps it n × dt, calling eachFn(S) before every step, and draws only the last step; cam overrides the camera for close-ups; renderInfo = draw calls + triangles of one full frame).

## 8. Saves (localStorage `cyber.neon-stick-duel.*`)
`cls` (last class) · `ladder` (next fight 0–9) · `ladderScore` · `ladderBest` (fights cleared, best) · `ladderClears` · `floor` (next endless floor, 0-based) · `runScore` · `bestFloor` · `best` (kit best score) · `muted` · `rig` (v2.2: `hq` / `classic` from the pause button; unset = per-class default, Swordsman HQ) · `style` (v2.3: `anime` / `neon` from the pause button; unset = `STYLE_DEFAULT`, Swordsman anime) · `ver` = 2. `rig` and `style` are optional, so older saves load unchanged.
**Migration** (`migrateSave`, runs at boot): v1 `lap` → `floor += lap × 8`, `lap` removed, `cls` = sword, `ver` = 2. `floor`, `runScore`, `bestFloor`, `best`, `muted` keep their meaning, so a v1 tower run continues as the endless tower. Tested in duel.test.mjs and smoke.py.

## 9. Tests
- `node tests/duel.test.mjs` — 29 tests (v2.2 added: **auto-face after a cross-over** — every class jumps over the foe, faces it on the landing frame, a guarding foe turns within 0.15 s, walking toward the foe after the switch is forward speed, a buffered attack after landing hits the right side, no turn mid-attack and a turn right after it recovers; **double jump** — once per airtime, lower than the first jump, resets on landing, not before `djMin`, a press buffered in the air comes out, the AI double-jumps ≥ 3 times over 12 fights; **hit-stop** 2–6 frames by strength). The "floor 60 winnable" test now plays 40 seeds and needs ≥ 3 wins (baseline rate ≈ 15 % before and after v2.2; the old 10-seed / 1-win version was flaky). Older list: class kits (3–4 hit chains, 2 skills with cooldowns, ult), ranged per-hit < melee per-hit, free movement (no auto-forward, slower back-walk), every class chains its full combo, launcher → juggle, launcher → jump-cancel → air combo, basic → skill cancel, cooldowns, gap-closers close / escapes open distance, mage corner blink crosses over, projectiles / pillar / meteors, ult (meter, freeze, invulnerable, damage), ult meter from dealing + taking damage, guard chip + guard break, dodge i-frames, jump over a bolt + wake-up invulnerability, juggle cap, KO / time-out, arena bounds, ladder data (bosses at 5 and 10, mirror, rising difficulty), endless never ends + capped + boss every 10, floor 60 winnable, harder AI beats easier AI, trial caps + scoring, v1 migration, balance band 40–60 % at diff 0.7 (400 deterministic fights per matchup).
- `python tests/pad.py [url] [out] [--views 412x915,915x412]` — touch pad: 412×915, 360×780, 390×844, 430×932, 412×1000, 915×412, 740×360 × zh/en: hit areas ≥ 56 px, no overlapping hit areas (circles, ult pill as a rect), nothing touches the joystick zone, inside the viewport, clear of HP bars / pause, each button topmost at its centre, labels fit, two-finger CDP test (stick + ATTACK), zero console errors; screenshots `hud-<w>x<h>-<lang>.png` + `layout.json`.
- `node tests/rig.test.mjs` — HQ rig (5 tests): two-bone IK respects joint limits and reach; every Swordsman pose solves with planted feet and limbs within limits; attack clips hit their contact key exactly on the first active frame (frame data unchanged); the blade lies inside the move's hitbox on the first active frame and for ≥ 60 % of active frames, with enough reach; crossfades and easing have no snaps.
- `python tests/rig_shots.py [url] [out] [--only compare,combo,dj,video]` — headless Chrome captures into `/workspace/shots/duel-hq` (default): classic vs HQ side-by-side (idle / mid-slash / hit reaction) at 412×915 and 1280×800, HQ combo contact frames (a2 / a3 / a4 with trail, sparks and cut flash), double jump mid-flip, and a 5.2 s combo video (`hq-combo.mp4` + `.gif`, needs ffmpeg). Uses `api.manual` + `advance` so frames are deterministic at 3 FPS SwiftShader; zero console errors checked.
- `node tests/anime.test.mjs` — anime Swordsman (6 tests, pure math): every pose / form key has all channels and solves; contact key exactly on the first active frame for every move; blade inside the hitbox on the first active frame and ≥ 60 % of active frames **with the power-chain lead and the spin applied** (a1–a4, air1/2, s1, s2 = 100 %, ult 82 %); no snaps (ε-continuity < 2 mm from idle and from mid-spin snapshots); spins end on whole turns, snapshots normalise, knee splay keeps bone lengths; `solveInto` / `lerpA` equal core `solve` / `lerpPose` (1670 samples, max error 7e-15).
- `python tests/anime_shots.py [url] [out] [--only compare,fight,card,perf,video]` — `/workspace/shots/duel-anime` (default): HQ-vs-anime side-by-sides (idle / midcombo / ult), in-fight 412×915 + 1280×800 at an a3 contact, portrait card, `perf.json` (draw calls / triangles anime vs neon, per-character tris, JS cost, heap growth), `anime-combo.mp4` (5.2 s, 412×916 H.264 yuv420p, exactly 1/30 s of game time per frame). Zero console errors checked on every page. `rig_shots.py` now boots `?style=neon` so it keeps showing the HQ rig.
- `node tests/balance.mjs [n] [diff]` — matchup matrix. `node tests/dps.mjs` — DPS/TTK table.
- `python tests/smoke.py [url] [out] [--quick]` — headless Chrome, 412×915 touch + 1280×800, zh + en: menu, class select (all 4), joystick walk/back-off/stand-still, keyboard / buttons (jump, guard, dodge), each class mid-combo, skill buttons + cooldown rings, ult cut-in, KO → result → next (saved), loss → revive, endless floor 12, pause/resume; hub trial caps (ladder 3 / endless 3 → trial screen, no saves), interstitial break only after a loss, v1 save migration, demo; zero console errors. Writes screenshots. Headless SwiftShader ≈ 3 FPS, so it polls state.

## 10. Known gaps / ideas
- Touch pad: not yet tried on a real notch / gesture-bar phone (safe areas are checked through `padGeometry` in node, not in a device); no left-handed mirror or size option yet (would go in `padGeometry` + a stored `pad` pref). The joystick up = jump stays on (some players may prefer it off).
- Balance is tuned on AI-vs-AI; human players will find the Mage's kiting and the Assassin's teleport stronger/weaker than the AI does. Watch real play data.
- AI-vs-AI the Mage is slightly favoured at mid difficulty (54.4 % overall at diff 0.7) and the Brawler at easy / hard (55.5 % / 56.8 %); every matchup is 41–59 %, but a few cells sit near the edge (diff 0.7 Sword–Mage 41, diff 0.95 Brawler–Sword / Brawler–Assassin 59). The next balance change should get those back toward 45–55.
- Anime style: only the Swordsman (phase 1). Mage / Brawler / Assassin keep the neon look until phase 2 (§12). Honest limits of the pilot: the body is built from procedural tubes and shells, so close-ups show faceted silhouettes (no sculpted cloth folds or hand-painted textures); the face is a decal (4 expressions), so there are no lip-sync or eye-direction changes; the IK is planar per limb, so wide horse stances are faked with a knee-splay channel and read mostly from the front; hair and coat springs collide only with the legs (the hair can clip the shoulders on hard spins); swiftshader screenshots can't show real-device frame times — the 60 fps figure is an estimate from draw calls, triangles and JS cost, not a device measurement.
- HQ rig: only the Swordsman. Mage / Brawler / Assassin still use the classic rig (porting guide in §11). The HQ rig is a bit heavier: 2 fighters ≈ 60 extra meshes + 3 cloth ribbons; not yet profiled on a low-end phone.
- HQ hit reactions are layered on the existing sim states (`hit` / `air` / `down` / `rise`); there is no separate stagger state in the sim, so a "stagger" is just the strong-hit reaction clip on a normal `hit`.
- No local 2-player or online play. No per-class unlockable skins yet.
- Classic-rig poses are procedural (no motion-captured clips); the cloth is a simple verlet strip; classic weapon trails look chunky at very low FPS (the HQ trail sub-samples the blade between frames).
- Android packaging: as DATA FUSE (Capacitor 8 + `@capacitor-community/admob` v8; app id `hk.fung2222.neonstickduel`); portrait and landscape both supported.

## 11. HQ rig (v2.2 — Swordsman pilot)
Toggle: `?rig=hq` / `?rig=classic` forces every class that has an HQ profile; the pause screen button **劍士動畫 / SWORDSMAN RIG: HQ / CLASSIC** stores `rig` (§8). Default `RIG_DEFAULT = { sword: 'hq' }` in `js/fighter-view.js`; classes without a profile always use the classic `StickFighter`.

### Architecture (3 layers, sim untouched)
1. **`js/rig/core.js` — pure math, no three.js (node-tested).**
   - *Skeleton* `SK` (rig units; the mesh group is scaled by fighter scale × 1.2 × `RIG_SCALE` 1.08 so the HQ body is as tall as the classic one): pelvis → lumbar 0.2 → chest 0.36 → neck 0.1 → head (r 0.185); shoulders (drop 0.06, half-width 0.165) → upper arm 0.36 → forearm 0.34 → hand; hips (drop 0.07, half-width 0.095) → thigh 0.47 → shin 0.46 → ankle 0.075 → foot 0.24; blade 1.18.
   - *Pose* = flat numeric object (`POSE_KEYS`): pelvis `px py pt`, spine / chest bend `sp ch`, hip twist `tw` + chest counter-twist `ctw`, head `hd`, whole-body roll `rr`, foot targets `fFx fFy fBx fBy`, arm swivel `aF aB`, **weapon-hand grip target** `gx gy` + blade angle `ga` + blade yaw `gw`, off-hand target `ox oy oh`. Poses only say where the hands, feet and hips go; IK fills in the elbows and knees.
   - `LIMITS`: knee 0.02–2.5 rad, elbow 0.02–2.6, spine / chest / neck / twist clamps. `ik2(root, target, a, b, bend, lim)`: analytic two-bone IK with soft reach (no knee/elbow pop at full extension) and limits; knees bend forward (+1), elbows back (−1).
   - `solve(p, { plantF, plantB })` → joint positions (`pelvis lumbar neckB head shF elF handF … hipF knF ankF toeF …`), blade `base / tip / bladeDir`, roll. Planted feet are passed in as world-locked targets; when a leg can't reach, the pelvis drops instead of the foot sliding.
   - `lerpPose` interpolates the grip on an arc around a chest-level point (`GRIP_PIVOT`) so swings curve instead of cutting straight through the body; blade angle wraps only on crossfades (so a rising cut can do > 180°).
   - `evalClip(keys, t, from)` with per-key easing (`EASE`: outQuad, inQuad, inOutSine, outSine, outBack, …); the `'from'` key = the snapshot of whatever pose was showing (crossfade). `attackKeys(t, P, stance)` maps a move's frame data `t = [startup, active, recovery]` to keys **A** (anticipation, at 0.5 × startup, outQuad) → **S** (strike contact, exactly at the first active frame, inQuad) → **E** (end of the active window, outSine) → **F** (follow-through, 40 % into recovery) → stance (end + 0.05 s). So frame data stays the single source of truth: changing a move's timing in classes.js re-times the animation. `flurryKeys` builds the ult's multi-hit.
2. **`js/rig/sword.js` — the per-class profile (data).** `STANCE`; 24 named poses (idle1, walk, walkBack, turn, guard, block, jump, fall, land, tuck, dodge, hitHigh, hitMid, hitBack, stagger, airHit, spiked, down, ko, sit, crouch, stun, win0, win); `MOVES` = A/S/E/F poses for a1–a4, air1, air2, s1, s2; `ULT` flurry poses; `PROFILE = { id, weapon: 'blade', stance, poses, moveKeys, outfit: { coat, tails, scarf }, airMoves }`.
3. **`js/rig/hq-fighter.js` — the renderer (`HQFighter`).** Same API as `StickFighter` (`setClass / update / flash / visible / joints`) plus `onHit(e)` and `takeSwingCue(f)`.
   - *Body*: lathe-turned tapered capsules with rounded joint caps and slight muscle bulge (deltoids, forearm, calf), jaw + visor head, glowing soles; `neonMat` = MeshStandardMaterial with a fresnel rim (onBeforeCompile) so the class colour reads as a neon edge while the body stays crisp under bloom (emissive ≤ 0.6). Coat shell + skirt + hem + collar + belt; coat tails and scarf are verlet `Ribbon`s (exported from stickman.js) pinned to the chest / hips.
   - *Animation state machine* (`stateOf` / `keyed`): sim state → clip; a state change snapshots the current pose and crossfades. Attack clips are driven by `f.t` (so hit-stop freezes them exactly); hit / block / rise / win clips too.
   - *Feet*: `footTargets` keeps each foot world-locked while it is planted; when the body drifts past a tolerance, the foot that lags most takes an eased step (lift arc, duration shrinks with speed, lead ∝ velocity) — one foot at a time, so walks have a real stride matched to speed and no sliding.
   - *Secondary motion* (`spring`): head lag, chest twist lags the hips (hips lead), hit recoil (torso + head snap), landing squash, walk bob; idle has a slow weight shift + breath. Turning = 0.14 s eased yaw + a turn pose, feet re-plant after.
   - *Hit reactions* (`onHit`): picks hitBack (hit from behind), stagger (heavy: ≥ 58 dmg, kb ≥ 2.4 or a heavy event), hitHigh / hitMid alternating for high-reaching hitboxes, else hitMid; strength k from damage + knockback scales the pose and kicks the recoil springs (hips, chest, head snap); launches use airHit / spiked; knockdown → down → rise (sit → crouch → stance).
   - *Trail* (`ArcTrail`): every frame the blade is re-solved every 1/300 s of clip time (up to 24 samples) between the previous and current frame, so the ribbon follows the real arc even at 3 FPS; covers the outer 58 % of the blade, fades in 0.12 s, white-hot edge.
   - *Swing sfx*: the HQ rig skips the sim's `move` swing sound and plays it from `takeSwingCue` at 45 % of startup, when the blade starts to accelerate.
   - *Hit FX* (main.js): sparks + particles + a white-hot **cut flash** (`slash()`) at `FighterView.contactPoint` (blade sampled against the defender's body box), streaks along the blade's velocity, all scaled by hit-stop length; camera impulse `camKick` (spring, w 34, z 0.32) + trauma; HQ rim flash on the defender.

### Porting another class (e.g. Brawler)
1. Copy `js/rig/sword.js` → `js/rig/brawler.js`. Keep `STANCE` / pose keys; author poses in rig units (feet on the floor at `fFy ≈ SK.ankle`).
2. For every move in `classes.js` write A / S / E / F poses. The **S** pose must put the weapon (or fist) inside the move's `box` on the first active frame — `tests/rig.test.mjs` checks this; extend its move loop to the new profile (for fists, test the hand instead of the blade tip).
3. Weapon / outfit: `setClass` builds the blade when `prof.weapon === 'blade'`. Add a builder for the new weapon (`'gauntlets'` = two hand meshes + glow; `'staff'` = shaft along `bladeDir` held by both hands — set `ox oy` from the grip; `'daggers'` = a second short blade on the off hand, trail on both). Outfit flags pick coat / skirt / tails / scarf / headband ribbons.
4. Register it: `HQ_PROFILES = { sword: SWORD, brawler: BRAWLER }` and `RIG_DEFAULT.brawler = 'hq'` (or leave classic and use `?rig=hq` while authoring).
5. Run `node tests/rig.test.mjs`, then `python tests/rig_shots.py` (add the class to `compare_shots`), then `tests/smoke.py`. Balance does not change: the rig never touches the sim.

### Sketch: a 5th class on the HQ rig (doc only — not built)
*鎖鏈 Chain Warden* (hybrid, kusarigama): sickle in the weapon hand (`weapon: 'blade'` with `blade 0.45` and a hook mesh), weight on the off hand, a verlet chain (`Ribbon` with 12 segments, round cross-section) between them. Moves: a1–a3 short sickle cuts (A/S/E/F like the Swordsman), a4 = chain swing where the weight is a projectile-like hitbox — the chain's far end is driven by the off-hand pose `ox oy` plus a spring, and the trail uses the chain end instead of the blade tip. s1 = chain pull (gap-closer: the sim already has `vx` dashes; the rig pulls the opponent's hit reaction toward the user with `hitBack`). s2 = spinning guard (ult-style `flurryKeys` loop with the chain as a ring). It would need: a two-handed grip option in `solve` (off hand IK to a point on the chain), a chain builder, and frame data + AI entries in classes.js / ai.js — then a balance pass.

## 12. Anime pipeline (v2.3 — phase 1: Swordsman 劍士)
Toggle: `?style=anime` / `?style=neon`; the pause screen button **劍士造型 / SWORDSMAN STYLE: ANIME / NEON STICK** stores `style` (§8). `STYLE_DEFAULT = { sword: 'anime' }` in `js/fighter-view.js` (flip back to `{}` to make neon the default again). `?rig=classic` still forces the classic stickman everywhere (comparison shots); `?rig=hq` without `?style` shows the neon HQ rig. Classes without an anime config are unaffected. The sim, frame data, hitboxes and AI are untouched (balance below = the v2.2 tables).

### What is built
- **Procedural only.** Every mesh is generated in code (three.js r169 from cyber-kit); no external models, textures, fonts or CC0 assets were used, so there is no third-party licence to track. The face atlas is drawn on a canvas at runtime.
- **Look** (`js/anime/toon.js`): one custom toon `ShaderMaterial` for body, hair and katana. A fixed view-space key light drives a 3-step ramp (shadow / mid / lit) with blue-tinted shadows, a stepped rim in the class accent, a crisp two-band "anime" highlight masked per vertex (`aShine`: hair 1, blade 0.8), and emissive trims through vertex colour × `aGlow` (glow kept low, ≤ 0.7, so bloom stays crisp at Glow LOW). Hit flash = `uFlash`, invulnerability shimmer = `uDim`. Skinning, fog and tone mapping use the stock three chunks.
- **Outlines**: an inverted hull (BackSide) on the same skinned geometry, pushed out along the normal by a **constant number of screen pixels** (`uPx` 1.9 px, from camera fov + drawing-buffer height in `onBeforeRender`, capped in world size) — so lines stay ~2 px at 412×915 and 1280×800 alike. Per-vertex `aLine` thins the lines on hair spikes.
- **Body** (`js/anime/builder.js`, `buildCharacter(cfg)`): one `SkinnedMesh` (16 body bones + 48 spring-chain bones = 64), ~6.8k triangles:
  - about 6.7 heads tall; anime head (r 0.13, narrow jaw, pointed chin) on a short neck; elliptical torso with a V-neck inner kimono and glowing lapels, standing collar;
  - continuous arm and leg tubes with blended elbow / knee weights (no cracks at the joints), weapon fist and off-hand mitten, each with a thumb; knee guards, boots with a glowing cuff;
  - cyber-samurai kit: long coat skirt open at the front (7 spring panels × 3 segments, coloured lining, glowing hem, collides with the legs), crimson obi with a knot and 2 spring tails, 3-plate sode pauldron on the sword shoulder, bracer, saya on the hip;
  - silver hair: skull cap with a face cut-out, 7 broad bangs, 2 side locks, 9 back spikes (each a 1-bone spring) and a 3-bone ponytail with a glowing tie;
  - katana: curved lens-profile blade with a glowing edge, wrapped tsuka, tsuba and habaki (separate mesh + outline, follows the weapon hand).
- **Face**: a 1024×256 canvas atlas (neutral / blink / hurt / fierce: big two-highlight eyes, brows, mouth, blush) on a decal patch that follows the head shape; the head turns ~35° toward the camera (3/4 view) so the eyes read in a side-on fighter. Blinks every 2.4–4 s; fierce while attacking; hurt on hits; eyes closed while sheathing.
- **Springs** (`AnimeFighter.stepChains`): verlet chains in world space (2–4 sub-steps, rest-pull stiffness, distance constraints, capsule collision against the thighs / shins for coat panels); bones get the shortest-arc rotation from their rest direction, so coat, sash, ponytail and hair whip on spins and settle afterwards.

### Animation (kenjutsu, `js/anime/sword.js` + `js/anime/clip.js`)
- **Channels on top of the HQ pose**: `sy` spin about a vertical axis at `pv` (pivot on the ball of the front foot), `hF / hB` heel lifts, `kF / kB` knee splay, `sh` sheath 0..1.
- **Forms are timed from frame data** (`form(mt, [[phase, u, pose, ease, fx]…])`): the contact key sits exactly on the first active frame, so changing `classes.js` re-times the animation and balance cannot drift. Every strike is coil (slow, `coil` ease) → explosive release (`snap`, k³) → whip through (`whip`) → settle with a small overshoot (`settle`) → held zanshin → back to seigan.
- **Power chain** (`evalChain`): feet sample 2 × 28 ms ahead, hips 1.3 ×, torso 0.6 ×, arm + blade exactly on time — every cut starts in the feet and the blade arrives last. The lead ramps in, so crossfades still start from the snapshot.
- **Stances**: seigan (chūdan, two hands, kendo back heel raised) for idle, with breathing and an occasional suri-ashi shuffle; bow stance for thrusts and lunges; horse-style guard. Low sliding steps (lift 4 cm), heel lifts on pivots.
- **Combo as one form**: a1 抜き打ち draw cut from an iai coil (off hand on the koiguchi, saya-biki) → a2 逆袈裟 rising cut (tsugi-ashi slide, hips reverse) → a3 回転斬り spinning cut (ball-of-foot pivot, back to the camera mid-turn, blade lags then whips, lands in a wide bow stance) → a4 昇り突き rising thrust (stamp, two-handed, the finish is **held**). air1 空斬, air2 兜割り falling cleave. s1 疾風突刺 Gale Lunge = held iai crouch → flying one-handed draw-thrust → braking skid. s2 昇龍斬 Rising Dragon = horse-stance coil → corkscrew rising cut with a full turn in the air. Ult 千刃斬 = a seven-cut kata ending in a held rising finish.
- **Feel kept from v2.2**: hit-stop freezes the forms exactly (they are driven by `f.t`), camera kick, sub-frame blade trail (re-solved every 1/300 s along the real spinning arc), sparks and cut flash at the blade contact point. FX cues on form keys: `stamp` (dust burst + low ground ring), `slide` / `skid` (dust), `ring` (air ring at chest height on spins); all small and dim.
- **Other states**: directional hit reactions (high / mid / from behind / stagger, scaled by hit strength), air hit and spike, knockdown with a bounce, tech roll (ukemi: backward roll over the shoulder → kneel → seigan), double-jump somersault, dodge roll, landing squash, 0.14 s turn-around pivoting on the balls of the feet, and the win pose: chiburi blood flick → nōtō (the blade slides into the saya along its real direction) → zanshin.
- Crossfades snapshot whatever pose is showing; snapshots are normalised (`sy`, `rr` wrapped), so a crossfade never unwinds a spin. Feet are world-planted (IK) except while spinning.

### Performance (412×915, both fighters anime, `tests/anime_shots.py --only perf`, `perf.json`)
| | anime Swordsman ×2 | neon HQ Swordsman ×2 |
|---|---|---|
| whole frame (incl. city, reflective floor, post) | **72 draw calls · 64.1k triangles** | 139 draw calls · 33.9k triangles |
| one fighter (both passes: main + floor reflection) | **11 calls · 27.8k tris** | 46 calls · 13.0k tris |
| one character mesh | 7,177 unique triangles (body 6.3k + katana + face); 14.0k drawn incl. outline hull — under the 15k budget | — |
| draw calls per character per pass | 5 (body, outline, face, katana, katana outline) + shared shadow / trail | 23 |
| bones | 64 (16 body + 48 spring) | — |
| JS per fighter update (animator + IK + springs + trail) | 0.064 ms (desktop SwiftShader box) | 0.033 ms |
| heap growth per update (idle / combo) | ≈ 0.86 KB / 2.9 KB | ≈ 6 KB / 2.9 KB |

- **Per-frame allocations**: the anime update path creates no objects, arrays or closures: poses are fixed-shape objects with unrolled lerps, `solve.js` writes into preallocated `Float64Array` joints (verified equal to `core.solve`), and the trail ring, sample pool, FX cue pool and step objects are reused. The ~0.9 KB per frame that remains is V8 boxing doubles returned from three.js maths (`Matrix4.decompose`, `Vector3.length`). It is short-lived young-gen garbage, about a third of the HQ rig's. During swings it rises to ~2.9 KB from the 24-sample sub-frame trail.
- **60 fps on a mid-range Android**: not measured on a device; the box has no GPU. Estimated from the numbers: 72 draw calls and 64k triangles are well inside a 2021+ mid-range GPU's budget (Adreno 6xx / Mali-G7x handle several hundred calls and >300k triangles at 60 fps), and the two shaders are single-pass with no textures except the 1024×256 face atlas. On `quality: low` cyber-kit drops the reflective floor, which halves the per-fighter cost. The pilot renders cleanly at 412×915 (outlines 1.9 px, zero console errors), so the Swordsman now defaults to anime.

### Phase 2 plan (Mage, Brawler, Assassin, boss)
1. **Config + profile per class**: add `ANIME_CLASSES.<id>` in `configs.js` (palette, hair, outfit flags, weapon, face colours) and a forms file `js/anime/<id>.js` exporting `PROFILE` (stance, poses, `moveKeys` from frame data). `buildCharacter` already handles optional outfit parts; add only what is new:
   - **Mage 魔導士**: long hooded robe (coat panels → 9 chains, no front gap), floating sleeve chains, staff weapon (shaft along `bladeDir`, both hands; trail on the orb), short hair with a hair-stick; forms built on taiji-style circular arm paths (casting = both palms push), blink = squash-and-vanish frames.
   - **Brawler 拳師**: no coat; sleeveless gi top + wrapped forearms, big gauntlets (fist mesh ×2 with glow knuckles), headband with 2 spring tails; forms from Hung Gar / Wing Chun (horse stance for real here — knees out with the splay channel, chain punches, iron-bridge guard). Test the hand inside the hitbox instead of the blade.
   - **Assassin 刺客**: short scarf chain, hood or mask over the lower face (face atlas with a mask variant), twin daggers (weapon on both hands, two trails), low crouched stance, forms with reverse-grip slashes and teleports (fade + dust).
2. Extend `tests/anime.test.mjs` so its move loop runs over every profile (contact key, hitbox coverage, continuity), add the class to `anime_shots.py`, then flip `STYLE_DEFAULT.<id>` only after the same 412×915 perf check.
3. Shared polish worth doing once for all classes: a second face patch for side views, ankle roll on uneven landings, a hair–shoulder collision capsule, and a per-class outline width.

### Boss concept — 機械將軍 KAGE-SHŌGUN, the corrupted AI master (doc only, not built)
A towering cyber-shogun (≈ 1.35 × fighter scale): black-lacquer ō-yoroi plates with red neon seams, a horned kabuto with a mask face (the face atlas becomes a glowing visor with 2 states: calm cyan / corrupted red), a tattered jinbaori on springs, and a nodachi (2 m blade) plus a floating ring of six "data blades". Built with the same builder: armour plates are pauldron-style shells on every limb; data blades are extra katana meshes driven by the animator, not bones.
- **Phase 1 — 「秩序」 Order (100–50 % HP)**: slow, perfect kenjutsu. *Iaidō Judgement* (long held coil → screen-wide draw cut, blockable, dodge window on the flash); *Ten-Step Advance* (suri-ashi pressure with three nodachi cuts that push the player to the edge); *Mirror Guard* (a parry stance: hitting it triggers a counter cut — punish by waiting or throwing a skill).
- **Transition**: the mask cracks, the outline turns red, the six data blades unfold behind him; a short taunt with the camera kick and a ground ring (the ult cinematic camera).
- **Phase 2 — 「崩壊」 Collapse (50–0 %)**: fast and glitchy. *Data-Blade Rain* (the floating blades drop in a readable left-to-right pattern, ground markers first); *Glitch Step* (teleports behind the player with 3 afterimages, only the last is real); *Shogun's Thousand Edges* (his own ult: the player's ult kata mirrored at 1.3 × speed, ending in a held overhead you can dodge through).
- Sim work needed: a boss move list in `classes.js` (with long startups for readability), new AI patterns in `ai.js`, a phase flag in the duel state, then a balance pass (target: ladder players win 35–50 % on the first try).

### Balance (unchanged sim, 1000 AI-vs-AI fights per matchup, `node tests/balance.mjs 1000 <diff>`)
| diff | Sword | Mage | Brawler | Assassin | range |
|---|---|---|---|---|---|
| 0.35 | 48.6 % | 46.2 % | 55.5 % | 49.6 % | every cell 43–57 % |
| 0.7 | 46.9 % | 54.4 % | 47.1 % | 51.5 % | every cell 41–59 % |
| 0.95 | 49.0 % | 46.7 % | 56.8 % | 47.4 % | every cell 41–59 % |
Identical to the v2.2 tables in §2: every matchup is 40–60 %.
