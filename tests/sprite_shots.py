#!/usr/bin/env python3
"""Shots for human-shaped SpriteFighter (all 4 classes, default on)."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8811/?lang=zh'
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/shots/duel-sprite')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
CLASSES = ['sword', 'mage', 'brawler', 'assassin']
fails = []

def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg, flush=True)
    if not cond: fails.append(msg)

def wait_for(pg, js, timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        pg.wait_for_timeout(200)
    return False

def shot(pg, name):
    path = OUT / name
    pg.screenshot(path=str(path), full_page=False)
    print('wrote', path, flush=True)

def boot(pg, url):
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.goto(url, wait_until='domcontentloaded', timeout=90000)
    check(wait_for(pg, "window.__duel && window.__duel.state==='menu'", 60), 'menu ' + url.split('?')[-1][:40])
    return errs

def start_cls(pg, cls):
    pg.evaluate(f"window.__duel.api.startMode('ladder', {{cls:'{cls}', stage:0}})")
    check(wait_for(pg, "window.__duel.state==='intro' || window.__duel.state==='play'", 40), f'{cls} start')
    pg.evaluate("()=>{const S=window.__duel; if(S.state==='intro') S.introT=0;}")
    wait_for(pg, "window.__duel.state==='play'", 10)
    pg.wait_for_timeout(1600)
    rig = pg.evaluate("window.__duel.api.rig()")
    check(rig.get('sprite') is True, f'{cls} sprite mode')
    check(rig.get('a') == 'sprite', f'{cls} player sprite ({rig.get("a")})')
    pg.evaluate("()=>{const a=window.__duel.api;a.freezeFoe(true);a.tank();a.close(1.5);}")
    pg.wait_for_timeout(250)

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)

    # roster strip: each class idle + attack, portrait
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=1)
    pg = ctx.new_page()
    errors += boot(pg, URL if 'sprite=' in URL else (URL + ('&' if '?' in URL else '?') + 'lang=zh').replace('lang=zh&lang=zh', 'lang=zh'))
    # normalize URL
    base = 'http://127.0.0.1:8811/?lang=zh'
    pg.goto(base, wait_until='domcontentloaded')
    wait_for(pg, "window.__duel.state==='menu'", 40)
    print('rig', pg.evaluate("window.__duel.api.rig()"), flush=True)

    for cls in CLASSES:
        start_cls(pg, cls)
        shot(pg, f'{cls}-idle-412x915-zh.png')
        for _ in range(8):
            pg.evaluate("window.__duel.api.cmd('atk')")
            pg.wait_for_timeout(60)
        wait_for(pg, "window.__duel.duel.a.st==='atk'", 4)
        pg.wait_for_timeout(100)
        shot(pg, f'{cls}-atk-412x915-zh.png')
        # back to menu for next
        pg.evaluate("()=>{const S=window.__duel; S.state='menu'; document.querySelectorAll('.screen').forEach(e=>e.classList.add('hidden')); const s=document.getElementById('screen-start'); if(s) s.classList.remove('hidden');}")
        pg.goto(base, wait_until='domcontentloaded')
        wait_for(pg, "window.__duel.state==='menu'", 30)
    ctx.close()

    # desktop roster select + fight
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    pg2 = ctx2.new_page()
    errors += boot(pg2, 'http://127.0.0.1:8811/?lang=en')
    start_cls(pg2, 'mage')
    for _ in range(6):
        pg2.evaluate("window.__duel.api.cmd('atk')"); pg2.wait_for_timeout(50)
    pg2.wait_for_timeout(150)
    shot(pg2, 'mage-loose-1280x800-en.png')
    pg2.goto('http://127.0.0.1:8811/?lang=en', wait_until='domcontentloaded')
    wait_for(pg2, "window.__duel.state==='menu'", 30)
    start_cls(pg2, 'brawler')
    for _ in range(6):
        pg2.evaluate("window.__duel.api.cmd('atk')"); pg2.wait_for_timeout(50)
    shot(pg2, 'brawler-street-1280x800-en.png')
    pg2.goto('http://127.0.0.1:8811/?lang=en', wait_until='domcontentloaded')
    wait_for(pg2, "window.__duel.state==='menu'", 30)
    pg2.click('#btn-ladder')
    wait_for(pg2, "window.__duel.state==='select'", 20)
    pg2.wait_for_timeout(500)
    shot(pg2, 'roster-select-1280x800-en.png')
    ctx2.close()

    # sprite=0 still works (anime fallback)
    ctx3 = b.new_context(viewport={'width': 412, 'height': 915})
    pg3 = ctx3.new_page()
    errors += boot(pg3, 'http://127.0.0.1:8811/?sprite=0&lang=zh')
    pg3.evaluate("window.__duel.api.startMode('ladder', {cls:'sword', stage:0})")
    wait_for(pg3, "window.__duel.state==='intro' || window.__duel.state==='play'", 30)
    pg3.evaluate("()=>{const S=window.__duel; if(S.state==='intro') S.introT=0;}")
    wait_for(pg3, "window.__duel.state==='play'", 10)
    pg3.wait_for_timeout(500)
    rig = pg3.evaluate("window.__duel.api.rig()")
    check(rig.get('sprite') is False, 'sprite=0 disables')
    check(rig.get('a') == 'anime', f'sprite=0 uses anime (got {rig.get("a")})')
    shot(pg3, 'sprite0-anime-fallback-412x915.png')
    ctx3.close()
    b.close()

real = [e for e in errors if 'deprecated' not in e.lower()]
for e in real[:8]:
    print(' ERR', e); fails.append(e)
meta = {'fails': fails, 'files': sorted(x.name for x in OUT.glob('*.png'))}
(OUT / 'sprite-meta.json').write_text(json.dumps(meta, indent=2))
print('FILES', meta['files'], flush=True)
if fails:
    print('FAILED', len(fails)); sys.exit(1)
print('ALL PASS')
