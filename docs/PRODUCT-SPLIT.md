# Product split — 2026-10-25

> Durable handoff for **any AI** opening this repo.  
> 持久交接：任何打開本 repo 嘅 AI 都要睇呢份。  
> Owner: Roy（fung2222）· Timezone: Asia/Hong_Kong · Docs-only decision; do not treat this as a request to change game code.

---

## Decision（必須原文照抄 / must state verbatim）

1. **機甲雷台** (repo fung2222/neon-stick-duel) will be extracted as a **standalone Google Play fighting game** (Street Fighter / King of Fighters–style): heavy sprite art, landscape, two-hand controls — NOT a one-hand casual time-killer.
2. **cyber-arcade hub** (fung2222/cyber-arcade + per-game repos) stays the place for **short, fun, quick cyberpunk mini-games** suitable for Play hub (free + Silver HK$18 / Gold HK$28 model, bilingual zh-HK/EN, endless modes).

### 粵／繁補充
1. **機甲雷台**（`fung2222/neon-stick-duel`）會抽出做**獨立 Google Play 格鬥遊戲**（街頭霸王／拳皇類型）：大量圖貼、橫向、雙手操作——**唔係**單手消磨時間嘅休閒小品。
2. **cyber-arcade hub**（`fung2222/cyber-arcade` + 各小遊戲 repo）繼續只做**短、好玩、快捷嘅賽博朋克小遊戲**，適合 Play 街機合集（免費 + 銀級 HK$18／金級 HK$28、雙語 zh-HK/EN、無盡模式）。

**Implication for agents:** do **not** reshape this fighter into a one-thumb commute game. Do **not** merge heavy fighter art pipelines into hub mini-game templates. Hub agents: keep casual scope; link out or leave 機甲雷台 as a separate product track.

---

## English — What this repo is

| | |
|---|---|
| **Product name (display)** | 機甲雷台 / MECH THUNDER ARENA |
| **Repo** | `fung2222/neon-stick-duel` |
| **Genre target** | Standalone 2D/3D-billboard fighting game (SF / KOF–style), Google Play |
| **Controls** | Landscape · two hands (left stick + right face buttons) |
| **Art** | Heavy sprite / pose sheets — complete characters before modes polish |
| **Not** | One-hand casual time-killer · hub filler · endless-only snack |

Hub series bible (casual only): [`fung2222/cyber-arcade/docs/PRODUCT-SPLIT.md`](https://github.com/fung2222/cyber-arcade/blob/main/docs/PRODUCT-SPLIT.md) · arcade handoff: `cyber-arcade/docs/ARCADE-HANDOFF.md`.

Deep tech history for this codebase (still useful): [`docs/HANDOFF.md`](HANDOFF.md) · orientation: [`docs/ORIENTATION.md`](ORIENTATION.md).

---

## 中文（zh-HK）— 呢個 repo 係乜

| | |
|---|---|
| **顯示名** | 機甲雷台 / MECH THUNDER ARENA |
| **Repo** | `fung2222/neon-stick-duel` |
| **目標類型** | 獨立上架 Google Play 嘅格鬥作（街頭霸王／拳皇風格） |
| **操作** | 橫向 · 雙手（左搖桿 + 右面掣） |
| **美術** | 大量圖貼／姿勢表——先完成角色再堆模式 |
| **唔係** | 單手休閒消磨時間 · hub 填充 · 淨係無盡零食 |

街機合集只做休閒小品：見 cyber-arcade 嘅 `docs/PRODUCT-SPLIT.md`。

---

## Current prototype status（2026-10-25）

Web prototype on GitHub Pages: https://fung2222.github.io/neon-stick-duel/ · demo `?demo=1`.

| Area | Status |
|---|---|
| **Theme** | 機甲雷台 / Mech Thunder Arena branding in UI strings |
| **Swordsman art** | **Bitmap** charcoal+cyan **mech swordsman** pose frames under `assets/sword/` (`mech_*.png`) — not procedural-only draw path for sword |
| **Action Test** | Free move / pose QA mode（木人樁、無時限、螢幕顯示姿勢鍵）— v0.5.3+ |
| **Arena BG** | Static neon arena backdrop `assets/bg/arena.png` |
| **Orientation** | Landscape play; auto-landscape + iOS/web CSS rotate fallback — see `docs/ORIENTATION.md` (v0.5.4–0.5.5) |
| **Still shared DNA** | Ladder / endless / bilingual / cyber-kit / four class kits in sim — but **product destiny = standalone fighter**, not hub casual tier forever |
| **Android** | Not packaged yet (future Capacitor / Play extract) |

Agents: prefer finishing **one character’s full pose set + feel** over adding more hub-style modes.

---

## Recommended fighter build order

Include this checklist in planning; do not skip ahead to store polish.

1. **Concept** — fantasy, cast silhouettes, tournament fiction (機甲大賽), win/lose fantasy.  
2. **Rules / controls** — movement, guard, dodge, chains, skills, ult; lock **landscape two-hand** pad.  
3. **Complete ONE character pose set + frame data** — swordsman first (see art pipeline).  
4. **Feel polish** — hitstop, launch, readable startup/active/recover, juice.  
5. **Second character** — clone checklist from swordsman; rebalance matchups.  
6. **Modes / UI** — ladder, endless, select, results (keep; don’t invent hub-casual shortcuts).  
7. **Extract standalone Capacitor / Play app** — own listing, not only hub deep-link.  
8. **Closed test** — internal / closed track.  
9. **Store** — listing, screenshots, privacy, billing as needed.

### 建議製作次序（粵／繁）
概念 → 規則／操控 → **完成一個角色全套姿勢 + 幀資料** → 手感打磨 → 第二個角色 → 模式／UI → 抽出獨立 Capacitor／Play app → 封閉測試 → 上架。

---

## Art pipeline

1. **Lock canvas / ORIGIN** — ground plant, billboard size, feet-on-floor (`ORIGIN`); do not redraw sheets until pivot is stable.  
2. **Pose checklist** — idle / move / jump / guard / hit / ko / victory **plus** per-move **startup / active / recover** frames.  
3. **Finish swordsman first** — full checklist before cloning.  
4. **Then clone the list** for mage / brawler / assassin (or next cast).  
5. **Keep backgrounds minimal** — arena plate is enough; spend budget on characters.

Existing sword bitmaps live in `assets/sword/`; arena in `assets/bg/arena.png`. Action Test is the QA loop for poses.

---

## Agent do / don’t

| Do | Don’t |
|---|---|
| Read this file first on fighter work | Turn this into a one-thumb casual snack |
| Extend bitmap pose pipeline for swordsman completeness | Port sono / trademarked IP |
| Keep zh-HK first + EN under | Bump versions for docs-only unless asked |
| Point hub agents at cyber-arcade PRODUCT-SPLIT | Assume Silver hub tier is the final shipping shape |

---

## Related repos

```
fung2222/neon-stick-duel   ← THIS repo — standalone fighter product (機甲雷台)
fung2222/cyber-arcade      ← hub — casual mini-games only (see its docs/PRODUCT-SPLIT.md)
fung2222/cyber-kit         ← shared kit (optional for fighter; not a reason to stay hub-scoped)
fung2222/<other games>     ← short cyberpunk snacks for the hub
```

Recorded **2026-10-25** (Asia/Hong_Kong) from Roy’s product split decision.
