# 霓虹火柴人對打 NEON STICK DUEL

> 3D 賽博朋克職業格鬥 · 3D cyberpunk class fighter · 劍士／魔法師／拳師／刺客 · 階梯十連戰 + 無盡天台塔 · Three.js · 手機優先

**試玩 Play:** https://fung2222.github.io/neon-stick-duel/ · **自動示範 Demo:** https://fung2222.github.io/neon-stick-duel/?demo=1

![NEON STICK DUEL](docs/shots/v2-desktop-ult.png)

## 玩法 How to play
揀職業，用左邊**虛擬搖桿**自由走位（可以後退拉開距離；左邊淨係得搖桿），右邊好似手掣咁：大**攻擊**掣喺拇指位，防禦、技能 1、技能 2、跳圍住佢排成弧形，**必殺**係上面獨立嘅長掣（似肩掣，唔會誤撳）：
| 掣 | 動作 |
|---|---|
| **攻擊** ATTACK | 連撳出 3–4 下連段；挑空之後跳起可以接空中連段 |
| **技能 1／2** | 每個職業兩招技能，有冷卻光圈 |
| **必殺** ULT | 打中或者被打都會儲能量，儲滿放必殺技（有特寫） |
| **跳** JUMP · **防禦** GUARD | 按住防禦；防禦＋方向＝閃避（短暫無敵） |

| 職業 | 武器／造型 | 技能 1 | 技能 2 | 必殺 |
|---|---|---|---|---|
| 劍士 Swordsman | 劍、長褸 | 疾風突刺（突進） | 昇龍斬（對空挑空） | 千刃斬 |
| 魔法師 Mage | 法杖、長袍、兜帽 | 閃現（脫離） | 雷柱 | 星隕天降 |
| 拳師 Brawler | 拳套、頭帶 | 火箭衝拳（霸體突進） | 震地拳 | 百裂拳 |
| 刺客 Assassin | 雙匕首、面罩、頸巾 | 影步飛刀（後撤＋飛刀） | 瞬殺（繞背突進） | 死蓮 |

**階梯模式**：十場（第 5 場同第 10 場係頭目，第 9 場係鏡像分身）。**無盡天台塔**：無限層數，難度慢慢上升但有上限，每 10 層一個頭目。進度自動儲存。被 K.O. 可以**原地復活**一次（網頁版免費）。

## 語言 Language
支援**繁體中文（香港）**同 **English**，主畫面或暫停畫面撳「EN／中」切換（`localStorage cyber.lang`，所有 CYBER 遊戲共用）。網址加 `?lang=en` / `?lang=zh` 亦可。

## English
**NEON STICK DUEL** is a 3D cyberpunk stick-figure fighter with four classes — **Swordsman** (blade, coat), **Mage** (staff, robe, hood), **Brawler** (gauntlets, headband) and **Assassin** (twin daggers, mask, scarf). Move freely with the on-screen joystick, tap ATTACK to chain 3–4 hit combos, launch into air combos, use two cooldown skills (melee classes get a gap-closer, ranged classes an escape) and unleash an ultimate charged by dealing and taking damage. Fight through a 10-fight **stage ladder** with two bosses, then climb the **endless tower**.

## 鍵盤 Keyboard
`A` `D` / `←` `→` 走位 · `W` / `↑` / `Space` 跳 · `S` / `↓` 防禦 · `Shift` 閃避 · `J` 攻擊 · `K` `L` 技能 · `U` 必殺 · `P` / `Esc` 暫停 · `M` 靜音

## 網址參數 URL flags
`?demo=1` AI 對打示範（`&cls=mage&floor=12`）· `?fps=1` · `?quality=low` · `?adsim=1` · `?reset=1` · `?mute=1` · `?bloom=0.4`

## 技術 Tech
Three.js + [cyber-kit](https://github.com/fung2222/cyber-kit) v0.3.0（`vendor/cyber-kit/`），冇 build step。純模擬（`js/duel.js`，固定 1/60 s）有單元測試同 AI 對 AI 平衡模擬；火柴人用正向運動學 + 彈簧姿勢混合即時生成。所有角色、圖示、音效都係原創／程式生成。

## 開發 Development
```bash
python3 -m http.server 8811            # http://127.0.0.1:8811/
node tests/duel.test.mjs                # 26 unit tests
node tests/balance.mjs 1000 0.7         # AI vs AI matchup matrix (all within 42–58 %)
node tests/dps.mjs                      # DPS / TTK table
python tests/smoke.py http://127.0.0.1:8811/ docs/shots
```
文件：[docs/HANDOFF.md](docs/HANDOFF.md) · [privacy.html](privacy.html) · 屬於 [CYBER ARCADE](https://github.com/fung2222/cyber-arcade) 系列。
