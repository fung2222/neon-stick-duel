# Mech sword frames verify (v0.5.0)

In-game loader: `./assets/sword/mech_${key}.png` via `swordFrameOf` / attack `pose` phases.

| key | mech_ file | bytes |
|-----|------------|------|
| `idle` | `mech_idle.png` | 54766 |
| `move` | `mech_move.png` | 109351 |
| `defend` | `mech_defend.png` | 88469 |
| `hit` | `mech_hit.png` | 101858 |
| `victory` | `mech_victory.png` | 59415 |
| `attack` | `mech_attack.png` | 91347 |
| `swA0` | `mech_swA0.png` | 99926 |
| `swA1` | `mech_swA1.png` | 120868 |
| `swA1f` | `mech_swA1f.png` | 103504 |
| `swB0` | `mech_swB0.png` | 89111 |
| `swB1` | `mech_swB1.png` | 101879 |
| `swB1f` | `mech_swB1f.png` | 99339 |
| `swC0` | `mech_swC0.png` | 101716 |
| `swC1` | `mech_swC1.png` | 100833 |
| `swC1f` | `mech_swC1f.png` | 86248 |
| `swD0` | `mech_swD0.png` | 107044 |
| `swD1` | `mech_swD1.png` | 76111 |
| `swD1f` | `mech_swD1f.png` | 49404 |
| `airA0` | `mech_airA0.png` | 71266 |
| `airA1` | `mech_airA1.png` | 76391 |
| `airA1f` | `mech_airA1f.png` | 87979 |
| `airB0` | `mech_airB0.png` | 45874 |
| `airB1` | `mech_airB1.png` | 39633 |
| `airB1f` | `mech_airB1f.png` | 137027 |
| `lunge` | `mech_lunge.png` | 97060 |
| `dragon` | `mech_dragon.png` | 56133 |
| `ult0` | `mech_ult0.png` | 73988 |
| `ultSword` | `mech_ultSword.png` | 189637 |

Total: 28/28 present.

Pose map: startup→pose[0] (e.g. swA0), active→pose[1] (swA1/lunge/dragon/ultSword), recover→pose[2] (*1f). Missing → attack/idle.
