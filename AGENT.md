# AGENT — 機甲雷台 / neon-stick-duel

**Read first:** [`docs/PRODUCT-SPLIT.md`](docs/PRODUCT-SPLIT.md) (2026-10-25 product split).

## Decision (verbatim)

1. **機甲雷台** (repo fung2222/neon-stick-duel) will be extracted as a **standalone Google Play fighting game** (Street Fighter / King of Fighters–style): heavy sprite art, landscape, two-hand controls — NOT a one-hand casual time-killer.
2. **cyber-arcade hub** (fung2222/cyber-arcade + per-game repos) stays the place for **short, fun, quick cyberpunk mini-games** suitable for Play hub (free + Silver HK$18 / Gold HK$28 model, bilingual zh-HK/EN, endless modes).

This repo = **fighter product**. Hub = **casual only**. Deep tech: `docs/HANDOFF.md`.

**Build order:** Concept → rules/controls → complete ONE character pose set + frame data → feel polish → second character → modes/UI → extract standalone Capacitor/Play app → closed test → store.

**Art:** lock canvas/ORIGIN → pose checklist (idle/move/jump/guard/hit/ko/victory + per-move startup/active/recover) → finish swordsman first → clone list for other chars → backgrounds minimal.

**Prototype now:** bitmap mech swordsman (`assets/sword/`), Action Test mode, arena BG, landscape web/CSS fallback.
