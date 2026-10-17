# NEON STICK DUEL → Option 3 pivot (proposal only — do not implement yet)

**Audience:** English report for a Cantonese pitch to Roy.  
**Decision:** Pivot **away from the Planck phys-ragdoll path** toward **Option 3 — a 2D sprite / animation fighter**. Cast can be **glowing cyberpunk animals, robots, hybrids**, etc.  
**Hard constraints to keep:** CYBER ARCADE **hub contract**, **bilingual zh-HK / EN**, **endless tower** (+ existing ladder / trial / ads rules).  
**Status of this doc:** survey + architecture + phases.

## Status (implementation)
- **FULL RESTART (2026-10-17):** ship as cyber mini-SF. Deleted `js/phys/**`, `js/anime/**`, `js/rig/**`, `js/stickman.js`, `vendor/planck`. Sprite-only `FighterView` + human neon cast (4 kits + shogun). Hitstop 3–8f, launch juice, attack streaks. Phys archived as git tag `phys-spike-archive`.

Live today: https://fung2222.github.io/neon-stick-duel/ · repo `fung2222/neon-stick-duel` · Silver tier in `cyber-arcade/games.json`.

---

## 1. What the duel is today (survey)

### Product shell (keep)
| Piece | Where | Notes |
|---|---|---|
| Hub / trial / ads | `js/hub.js`, `modes.TRIAL`, `main` ads | `?hub=1&tier=…&ads=…&trial=1`; trial caps **ladder 1–3 / endless 1–3**; interstitial only after a loss; rewarded revive once per fight |
| Bilingual | `js/strings.js` + cyber-kit `i18n` | zh-HK / EN, `cyber.lang`, pause + home toggles |
| Stage ladder | `js/modes.js` `LADDER` | 10 fights, bosses at 5 + 10, fight 10 = KAGE-SHŌGUN |
| Endless tower | `endlessFoe` | Never ends; capped difficulty; boss every 10F; Zero echo every 30F |
| Touch pad + keyboard | `js/controls.js` | Joystick left, PS-style face arc + ULT pill |
| Saves | `cyber.neon-stick-duel.*` | Ladder / floor / bests / muted / style / rig |

### Gameplay sim (keep — high value)
| Piece | Where | Notes |
|---|---|---|
| Pure duel sim | `js/duel.js` (~500 LOC) | Fixed 1/60 s: combos, cancels, juggles, guard, ult freeze, KO, boss phases |
| Class kits | `js/classes.js` | Sword / Mage / Brawler / Assassin + `shogun` boss (not selectable) |
| AI | `js/ai.js` | Diff-scaled kits + boss brain |
| Modes / score / migrate | `js/modes.js` | Ladder + endless curves + v1→v2 migration |
| Audio | `js/audio.js` | Synth SFX on cyber-kit loudness chain |

Sim is **renderer-agnostic**: fighters are `{x,y,facing,st,mk,t,…}` + hitboxes. That is the asset we protect.

### Rendering today (replace for Option 3)
Three parallel character pipelines behind `FighterView` (`js/fighter-view.js`):

1. **Anime (default)** — `js/anime/*` (~4k LOC): procedural lofted meshes, toon + outline shaders, face atlas, per-class forms timed from frame data. All four classes + shogun.
2. **HQ neon stick** — `js/rig/*`: IK + clips; Swordsman only.
3. **Classic stick** — `js/stickman.js`: FK capsules.

Stage = Three.js cyber-kit (`createStage`, NeonCity, bloom/glow, reflective floor) + rooftop in `js/world.js`.

### Phys ragdoll path (pivot away)
- Flag: **`?phys=1`** early-returns in `main.js` → `js/phys/spike.js`.
- Stack: vendored **Planck** (`vendor/planck`, ~536 KB) + `ragdoll.js` / `neon-view.js` / `pose-clips.js`.
- Feel: Stick Fight–like soft joints, grab/throw neon weapons, impact damage, pose SM (stand/walk/punch/hit/KO), kung-fu punch clips.
- **Does not** reuse ladder / endless / class select / hub trial / anime kits. Separate mini-loop + `__phys` hook.
- Docs: `docs/PHYS-SPIKE.md`. Recent `main` commits are almost all phys polish.

**Verdict:** Phys was a fun spike, but it forks the product into a second game that drops Silver-tier obligations. Option 3 should **not** grow it; hide or scrap it so energy goes to one shippable fighter.

---

## 2. Option framing (for the pitch)

| Option | Idea | Fit with hub / bilingual / endless | Risk |
|---|---|---|---|
| **1 — Stay 3D anime stick / toon** | Ship what is live (v2.7) | Already satisfied | Art ceiling: procedural meshes still read “programmer anime”; Roy already pushed look quality hard |
| **2 — Phys ragdoll** | Stick Fight neon limbs + weapons | Rebuild ladder/endless/hub on phys, or abandon them | Two products; balance/feel unstable; no class fantasy |
| **3 — 2D sprite / animation fighter** ✅ | Side-view fighter with **authored sprite sheets**; cast = glowing cyberpunk **animals / robots / hybrids** | Keep shell + sim; swap only the view + art | Art production is the critical path; need a clear sheet pipeline |

**Why Option 3 wins the pitch:** readable silhouettes on a phone, marketable cast (neon fox / chrome bear / owl mage / lynx assassin / mech shogun), still “CYBER ARCADE fighter,” and we **reuse** the hard-won combo / AI / ladder / endless / hub work instead of throwing it away for ragdoll chaos.

---

## 3. Target architecture (Option 3)

### Principle
**Keep the arcade shell and the pure sim. Replace characters with 2D sprites. Quarantine phys.**

```
┌─────────────────────────────────────────────────────────┐
│  SHELL (keep)                                           │
│  hub.js · strings.js · main states · controls · ads     │
│  modes.js (ladder + endless + trial) · audio · HUD DOM  │
└───────────────────────────┬─────────────────────────────┘
                            │ cmds / events
┌───────────────────────────▼─────────────────────────────┐
│  SIM (keep, mostly untouched)                           │
│  classes.js · duel.js · ai.js · boss-fx (logic only)    │
│  Frame data remains the single timing source of truth   │
└───────────────────────────┬─────────────────────────────┘
                            │ fighter state + hit events
┌───────────────────────────▼─────────────────────────────┐
│  VIEW (new)                                             │
│  SpriteFighter + Atlas / ClipPlayer                     │
│  Maps sim states → sprite clips; contact frame = active │
│  VFX: slash trails, hit sparks, ult cut-in (2D or kit)  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  STAGE (choose in Phase 0)                              │
│  A) Keep Three.js city as parallax + billboard sprites  │
│  B) Canvas2D / WebGL2 orthographic stage (cleaner “2D”) │
│  Recommend A for first ship (reuse kit glow/city/HUD)   │
└─────────────────────────────────────────────────────────┘

PHYS: flag-gated dead end → then delete (see §4)
```

### Character fantasy (working cast — names bilingual later)
Keep **four playable kits** (same moves / HP / roles) so AI + balance tests stay valid; **re-skin identity**:

| Kit id | Role | Sprite fantasy (draft) | Reads as |
|---|---|---|---|
| `sword` | Melee blade | Neon **kitsune / cyber fox** with plasma katana | Gap-closer + rising dragon |
| `mage` | Ranged caster | Glowing **owl / moth drone-mage** with glyph hands | Blink + pillar + starfall |
| `brawler` | Tank melee | Chrome **bear / gorilla bot** with gauntlets | Rush + quake + hundred fists |
| `assassin` | Hybrid | Emerald **lynx / panther** with twin kodachi | Shadow step + phantom strike |
| `shogun` | Boss only | Corrupted **mech shogun / oni-drone** | Order → Collapse phases |

Outfits stay original (no trademarked IP). Glow = emissive sprite layers or additive bloom on neon accents.

### Sprite contract (per fighter)
Minimum clip set, **timed from `classes.js` frame data** (same rule anime used: contact key ≡ first active frame):

- Locomotion: `idle`, `walk`, `walkBack`, `jump`, `fall`, `land`, `dj` (double jump), `dodge`, `guard`, `block`
- Combat: `a1…aN`, `air1`, `air2`, `s1`, `s2`, `ult` (multi-hit marks)
- Reactions: `hitHigh/Mid`, `airHit`, `down`, `rise`, `ko`, `win`
- Facing: flip X (arena is 1D); no 3D yaw

Atlas format proposal: one PNG/WebP sheet + JSON `{ clip, frames[], anchor, box }` under `assets/fighters/<id>/`. Procedural placeholders OK in Phase 1; authored art in Phase 2.

### What stays / goes

| Keep | Hide → scrap | Replace |
|---|---|---|
| `duel` `ai` `modes` `classes` `controls` `hub` `strings` `audio` `config` | `js/phys/**`, `vendor/planck`, `?phys=1` boot, `PHYS-SPIKE.md` as archive | `fighter-view` → `SpriteView`; retire anime/HQ/classic as default |
| cyber-kit vendor (i18n, stage, ads, endless helpers) | Pause **STYLE/RIG** toggles once sprites are default | Ult cut-in / boss telegraphs as 2D overlays |
| Unit tests on sim (`duel.test`, `balance`, `boss`) | Anime/rig shot scripts as non-blocking | New sprite sheet asserts + smoke screenshots |
| Trial caps + save keys (drop `style`/`rig` later) | — | New thumbs / preview for hub |

---

## 4. Phys path: hide first, scrap second

**Recommendation: hide now, scrap after Option 3 vertical slice ships.**

| Step | Action | Why |
|---|---|---|
| **H0 (day 0)** | Stop linking phys from default UX; leave `?phys=1` but mark **deprecated** in PHYS-SPIKE | Zero risk to live Pages; spike still recoverable |
| **H1** | Boot guard: ignore `phys` unless `?phys=1&dev=1` (or remove dynamic import entirely) | Casual testers never enter the fork |
| **H2** | After Sprite Phase 1 green: delete `js/phys/`, `vendor/planck`, importmap, `phys_shots.py`; keep a git tag `phys-spike-archive` | Shrink repo ~0.6 MB + remove dual-product confusion |

Do **not** port grab/throw weapons into Option 3 in v1 — that is phys’s fantasy, not the class fighter’s.

---

## 5. Phases (no implementation in this pass)

### Phase 0 — Align (½ day)
- Confirm cast (animals/robots) + name table zh/en.
- Choose stage path **A (Three.js billboards)** vs **B (full 2D)**. Default proposal: **A**.
- Phys: apply **H0/H1** hide.
- Update pitch copy only (this doc); do not change `games.json` until Phase 1 playable.

### Phase 1 — Vertical slice (3–5 days)
- One class (recommend **sword / fox**) full clip set + placeholder art.
- `SpriteFighter` driven by existing `duel` state; contact frame sync test.
- Menu → select → one ladder fight → result; hub trial still works.
- Smoke: 412×915 zh + en, zero console errors.
- **Exit:** “feels like a fighter, not a stick mesh.”

### Phase 2 — Full roster (1–2 weeks)
- Mage / Brawler / Assassin sheets + select portraits.
- Remap display names / taglines; keep kit ids for saves.
- Endless + ladder foes use new looks; mirror match OK.
- Balance: re-run `duel.test` + `balance.mjs` (numbers should not move if frame data untouched).

### Phase 3 — Boss + juice (3–5 days)
- Shogun mech sheet + phase 1/2 palette swap.
- 2D telegraph overlays (reuse `boss-fx` timing).
- Ult cut-ins as character art cards.
- Audio pass for creature/robot hits.

### Phase 4 — Ship shell (2–3 days)
- Phys **H2** scrap.
- Hub: refresh `games.json` genre/stage/thumb/preview (“2D neon beast fighter” wording).
- README + HANDOFF status line; Android packaging still later.
- Live smoke + bilingual pad check.

### Explicit non-goals (v1 Option 3)
- Online / local 2P  
- New move lists (keep kits)  
- Phys weapons  
- Rewriting AI  
- Dropping endless or trial  

---

## 6. Cantonese pitch notes (speak from this English)

**One-liner:**  
「我哋唔再追 ragdoll；改做 **2D 精靈動畫格鬥**，角色可以係發光賽博動物／機械人，但 **大廳、中英、無盡塔** 全部留低。」

**三點：**
1. **而家嘅貨** — 網頁版已經係完整銀級格鬥（四職業、階梯十戰、無盡塔、試玩上限、雙語）。貴嘅係 3D 動漫網格同 phys 分叉，唔係玩法邏輯。  
2. **點解 Option 3** — 手機上剪影更易讀、角色更好賣、同 CYBER ARCADE 其他 2D 方向一致；玩法碼（連段／AI／無盡）可以原封再用。  
3. **點處理 phys** — 先隱藏 `?phys=1`，等 2D 豎切面可玩再刪 Planck，避免半套兩個遊戲。

**風險一句：** 美術產能係關鍵路徑；Phase 1 用占位圖驗證「跟 frame data 嘅精靈」先至畫四套成稿。

**Ask:** 批 Phase 0–1（狐狸劍士豎切面 + 隱藏 phys）；未批之前 **唔寫碼**。

---

## 7. File touch map (when implementation is approved)

| Area | Likely files |
|---|---|
| New | `js/sprite/fighter.js`, `clip.js`, `atlas.js`, `assets/fighters/**` |
| Edit | `js/fighter-view.js` or replace callers in `main.js`; `strings.js` names; optional `world.js` billboard layer |
| Hide | `main.js` phys boot; later delete `js/phys/**`, `vendor/planck`, `package.json` import |
| Docs | HANDOFF status, README genre line, archive PHYS-SPIKE |
| Hub (later) | `cyber-arcade/games.json` genre / stage / thumb |

---

*Survey date: 2026-10-17 (Asia/Hong_Kong). Repo HEAD includes phys spike commits on `main`; classic anime fighter remains default without `?phys=1`.*
