# P0 PHYS SPIKE — Planck neon ragdoll

**Branch:** `spike/phys-ragdoll` · **Flag:** `?phys=1` (classic game unchanged without the flag)

## Try it

```bash
cd neon-stick-duel
python3 -m http.server 8811
# open:
#   http://127.0.0.1:8811/?phys=1
#   http://127.0.0.1:8811/?phys=1&autostart=1
#   http://127.0.0.1:8811/?phys=1&demo=1   (same shell; AI foe still punches)
# live (after push / Pages): https://fung2222.github.io/neon-stick-duel/?phys=1
```

Controls (same pad): stick move · **ATTACK** = punch impulse · **JUMP** · **GUARD** stiffens motors.

## Feel (v0.2 soft joints)

Wide revolute limits + soft motors + low angular damping → limbs bend/flail like Stick Fight.
**Limb mesh sizes unchanged** (silhouette locked). Hit = brief motor near-zero + angular flail; KO = motors off.

Live Pages (after merge to `main`): https://fung2222.github.io/neon-stick-duel/?phys=1

## What this spike proves

- Planck.js 2D world on the existing neon rooftop (cyber-kit stage + bloom)
- Jointed ragdoll (head / torso / arms / legs / fists) with motors while alive
- Punch = linear impulse through the lead fist; hits scale with relative speed
- HP → 0 disables motors → **KO limp**
- Shell kept: HUD, touch pad, bilingual howto, pause/mute, result retry

## Not yet (later phases)

- Weapon grab/throw, class kits, ladder/endless curves, anime/HQ retirement

## Files

| Path | Role |
|------|------|
| `vendor/planck/planck.mjs` | Planck 1.5.1 |
| `js/phys/ragdoll.js` | World + ragdoll + punch/KO |
| `js/phys/neon-view.js` | Neon capsule renderer |
| `js/phys/spike.js` | `?phys=1` play shell |
| `js/main.js` | Boot gate only when `phys=1` |
| `docs/shots/phys/` | Screenshots |

## Node smoke

```bash
node --input-type=module -e "import { makePhysWorld, driveRagdoll, stepWorld, DT } from './js/phys/ragdoll.js'; const c=makePhysWorld(); for(let i=0;i<60;i++){driveRagdoll(c.a,{mx:1,punch:i===20},DT);driveRagdoll(c.b,{mx:-.2},DT);stepWorld(c,DT);} console.log('ok',c.a.hp,c.b.hp);"
```
