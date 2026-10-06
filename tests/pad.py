"""Touch-pad layout check for NEON STICK DUEL (v2.1 pad).
Usage: python tests/pad.py [base_url] [out_dir] [--views 412x915,915x412]
For 412x915, 360x780, 390x844, 430x932, 412x1000 (tall), 915x412, 740x360 landscape, zh + en: starts a fight, screenshots the
in-fight HUD, and checks every control: hit area >= 56 px, no two hit areas overlap (circles; the ult pill as a rectangle),
nothing overlaps the joystick zone, everything inside the viewport and clear of the HP bars / pause buttons, each button is
the top element at its centre. Then a CDP multi-touch test: joystick held right + ATTACK tapped at the same time.
Zero console errors required.
"""
import sys, os, json, math, time
from playwright.sync_api import sync_playwright
ARGV = [a for i, a in enumerate(sys.argv) if a != '--views' and (i == 0 or sys.argv[i - 1] != '--views')]
BASE = ARGV[1] if len(ARGV) > 1 else 'http://127.0.0.1:8811/'
OUT = ARGV[2] if len(ARGV) > 2 else '/workspace/shots/duel-pad'
os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
VIEWS = [(412, 915), (360, 780), (915, 412), (390, 844), (430, 932), (412, 1000), (740, 360)]
if '--views' in sys.argv: VIEWS = [tuple(int(n) for n in v.split('x')) for v in sys.argv[sys.argv.index('--views') + 1].split(',')]
SHOT_VIEWS = {(412, 915), (360, 780), (915, 412)}
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m, flush=True)
    if not c: fails.append(m)
def wait_for(pg, js, t=40):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(100)
    return False
def shape(b):
    r = b['r']
    if b['round']: return ('c', r['x'] + r['width'] / 2, r['y'] + r['height'] / 2, min(r['width'], r['height']) / 2)
    return ('r', r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])
def rect_of(s):
    return (s[1] - s[3], s[2] - s[3], s[1] + s[3], s[2] + s[3]) if s[0] == 'c' else s[1:]
def gap(a, b):
    """distance between two hit shapes (negative = overlap)"""
    if a[0] == 'c' and b[0] == 'c': return math.hypot(a[1] - b[1], a[2] - b[2]) - a[3] - b[3]
    if a[0] == 'r' and b[0] == 'r':
        dx = max(b[1] - a[3], a[1] - b[3]); dy = max(b[2] - a[4], a[2] - b[4])
        return max(dx, dy) if (dx < 0 or dy < 0) and not (dx < 0 and dy < 0) else (math.hypot(max(dx, 0), max(dy, 0)) if dx >= 0 and dy >= 0 else max(dx, dy))
    c, r = (a, b) if a[0] == 'c' else (b, a)
    nx = min(max(c[1], r[1]), r[3]); ny = min(max(c[2], r[2]), r[4])
    return math.hypot(c[1] - nx, c[2] - ny) - c[3]
def rgap(a, b):
    dx = max(b[0] - a[2], a[0] - b[2]); dy = max(b[1] - a[3], a[1] - b[3])
    return max(dx, dy)   # > 0 means separated
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    report = {}
    for (w, h) in VIEWS:
        for lang in ('zh', 'en'):
            tag = f'{w}x{h}-{lang}'
            ctx = br.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=True, is_mobile=False)
            ctx.add_init_script(f"try{{localStorage.setItem('cyber.lang','{lang}')}}catch(e){{}}")
            pg = ctx.new_page(); errs = []
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
            pg.goto(BASE)
            wait_for(pg, "window.__duel && window.__duel.state==='menu' && window.__duel.duel", 60)
            pg.evaluate("window.__duel.api.startMode('ladder', {cls:'assassin', stage:2})")
            wait_for(pg, "window.__duel.state==='play'", 40)
            pg.evaluate("window.__duel.api.freezeFoe(true); window.__duel.api.close(2.6)")
            wait_for(pg, "(()=>{const b=document.getElementById('banner');return !b||b.classList.contains('hidden')||+(b.style.opacity||1)<0.05})()", 40)
            pg.wait_for_timeout(300)
            pad = pg.evaluate("window.__duel.api.pad()")
            shapes = {b['cmd']: shape(b) for b in pad['btns']}
            z = pad['zone']; zr = (z['x'], z['y'], z['x'] + z['width'], z['y'] + z['height'])
            hit = {b['cmd']: min(b['r']['width'], b['r']['height']) for b in pad['btns']}
            check(min(hit.values()) >= 56, f'{tag}: every hit area >= 56 px (min {min(hit.values()):.0f})')
            names = list(shapes); worst = 1e9
            for i in range(len(names)):
                for j in range(i + 1, len(names)):
                    g = gap(shapes[names[i]], shapes[names[j]]); worst = min(worst, g)
                    if g <= 0: check(False, f'{tag}: {names[i]} overlaps {names[j]} ({g:.1f})')
            check(worst > 0, f'{tag}: no overlapping button hit areas (closest gap {worst:.1f} px)')
            zg = min(rgap(rect_of(s), zr) for s in shapes.values())
            check(zg > 0, f'{tag}: no button touches the joystick zone (closest {zg:.1f} px)')
            check(z['width'] >= 130 and z['height'] >= 200, f'{tag}: joystick zone is roomy ({z["width"]:.0f}x{z["height"]:.0f})')
            inside = all(rect_of(s)[0] >= 0 and rect_of(s)[1] >= 0 and rect_of(s)[2] <= w and rect_of(s)[3] <= h for s in shapes.values())
            check(inside, f'{tag}: all buttons inside the viewport')
            hudr = pg.evaluate("['.vs-bar','.hud-buttons'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})")
            clear = all(rgap(rect_of(s), hr) > 0 for s in shapes.values() for hr in hudr) and all(rgap(zr, hr) > 0 for hr in hudr)
            check(clear, f'{tag}: controls clear of the HP bars and pause/mute buttons')
            check(rgap(hudr[0], hudr[1]) > 0, f'{tag}: HP bars clear of the pause/mute buttons')
            tops = pg.evaluate("window.__duel.api.pad().btns.map(b=>{const r=b.r;const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!(e&&e.closest('[data-cmd]')&&e.closest('[data-cmd]').dataset.cmd===b.cmd)})")
            check(all(tops), f'{tag}: each button is the top element at its centre')
            fits = pg.evaluate("[...document.querySelectorAll('.cbtn b')].every(b=>b.textContent==='' || b.scrollWidth<=b.clientWidth+1)")
            check(fits, f'{tag}: button labels fit (no ellipsis)')
            if (w, h) in SHOT_VIEWS:
                pg.evaluate("window.__duel.api.setUlt(65)"); wait_for(pg, "document.getElementById('cd-ult').style.strokeDashoffset !== ''", 10); pg.wait_for_timeout(400)
                pg.screenshot(path=os.path.join(OUT, f'hud-{tag}.png'))
            report[tag] = {'zone': [round(v) for v in zr], 'btns': {k: [round(v) for v in rect_of(s)] for k, s in shapes.items()}}
            if lang == 'zh' and (w, h) in SHOT_VIEWS:
                # multi-touch: hold the joystick right, then tap ATTACK with a second finger while still holding
                cdp = ctx.new_cdp_session(pg)
                jx, jy = zr[0] + min(70, (zr[2] - zr[0]) / 2), zr[3] - 90
                ar = shapes['atk']; ax, ay = ar[1], ar[2]
                pg.evaluate("window.__duel.api.close(1.6); window.__duel.cmdLog.length=0")
                x0 = pg.evaluate("window.__duel.duel.a.x")
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': jx, 'y': jy, 'id': 1}]})
                for k in range(1, 6): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': jx + k * 11, 'y': jy, 'id': 1}]})
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': jx + 55, 'y': jy, 'id': 1}, {'x': ax, 'y': ay, 'id': 2}]})
                pg.wait_for_timeout(60)
                held = pg.evaluate("document.querySelector('.b-atk').classList.contains('press') && document.getElementById('joy').classList.contains('on')")
                mx_ok = wait_for(pg, "window.__duel.duel.a.in.mx > 0.5", 10)
                atk = wait_for(pg, "window.__duel.cmdLog.includes('atk')", 20)
                cmds = pg.evaluate("JSON.stringify(window.__duel.cmdLog.slice(-6))")
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': jx + 55, 'y': jy, 'id': 1}]})
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                pg.wait_for_timeout(100)
                check(held and mx_ok and atk, f'{tag}: multi-touch — joystick held right (mx > 0.5) + ATTACK pressed together, attack fired (log {cmds[:60]})')
                released = pg.evaluate("!document.querySelector('.b-atk').classList.contains('press') && !document.getElementById('joy').classList.contains('on')")
                check(released, f'{tag}: both touches release cleanly')
            check(not errs, f'{tag}: zero console errors {errs[:2]}')
            ctx.close()
    br.close()
json.dump(report, open(os.path.join(OUT, 'layout.json'), 'w'), indent=1)
print(f'\n{len(fails)} failures'); sys.exit(1 if fails else 0)
