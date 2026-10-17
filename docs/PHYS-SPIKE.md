# PHYS path — Planck neon ragdoll (`?phys=1`)

**On `main` (GitHub Pages).** Classic class-fighter unchanged without the flag.

## Try

```bash
# live
https://fung2222.github.io/neon-stick-duel/?phys=1
https://fung2222.github.io/neon-stick-duel/?phys=1&autostart=1

# local
python3 -m http.server 8811
# → http://127.0.0.1:8811/?phys=1
```

### Controls
| Input | Action |
|-------|--------|
| Stick | Move / lean |
| ATTACK (J) | Punch, or **swing** if holding a weapon |
| Skill 1 (K) | **GRAB** nearest neon weapon |
| Skill 2 (L) | **THROW** held weapon |
| JUMP / GUARD | Jump · stiffen motors |

### Weapons (P1)
- **PLASMA BAT** 等離子棍
- **NEON BLADE** 霓虹刃
- **CHROME PIPE** 鉻管

### Feel
- **Punch-fix (post-P1):** sturdier alive stance (less stumble), larger fist hitbox, aim+probe hits, hit-stop + damage popups. Floppy limp only on KO.

### Feel
- Soft Stick Fight–like joints (wide revolute limits, soft motors) — **limb silhouette unchanged**
- Wall / floor **impact damage** on hard landings / wall smashes
- Simple HP · KO = motors off → limp
- AI dummy seeks weapons, grabs, swings / throws

## Files
`js/phys/ragdoll.js` · `neon-view.js` · `spike.js` · shots in `docs/shots/phys/`

## Stand / balance (2026-10-17)

Alive fighters plant: heavy legs+feet (lower COM), grippy ground (fric 1.45), stronger hip/knee/ankle + torso upright motors, narrow leg limits while alive (unlock on KO). Arms stay soft. Idle/walk stable; punch no longer dumps balance (arm-only impulse, tip recovery wins over punch plant).
