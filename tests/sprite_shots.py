#!/usr/bin/env python3
"""Capture neon fox SpriteFighter vertical-slice shots (?sprite=1)."""
import json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8811/?sprite=1&lang=zh'
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/shots/duel-sprite')
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
fails = []

def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg, flush=True)
    if not cond: fails.append(msg)

def wait_for(pg, js, timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if pg.evaluate(js): return True
        except Exception:
            pass
        pg.wait_for_timeout(200)
    return False

def shot(pg, name):
    path = OUT / name
    pg.screenshot(path=str(path), full_page=False)
    print('wrote', path, flush=True)
    return path

def boot(pg, url):
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.goto(url, wait_until='domcontentloaded', timeout=90000)
    check(wait_for(pg, "window.__duel && window.__duel.state==='menu'", 60), 'boots to menu')
    return errs

def fight_sword(pg):
    pg.evaluate("window.__duel.api.startMode('ladder', {cls:'sword', stage:0})")
    check(wait_for(pg, "window.__duel.state==='intro' || window.__duel.state==='play'", 40), 'fight started')
    # skip intro banner
    pg.evaluate("()=>{const S=window.__duel; if(S.state==='intro'){S.introT=0;}}")
    wait_for(pg, "window.__duel.state==='play'", 10)
    pg.wait_for_timeout(800)  # fight banner fade
    rig = pg.evaluate("window.__duel.api.rig()")
    check(rig.get('sprite') is True, 'sprite mode on')
    check(rig.get('a') == 'sprite', f"player rig is sprite (got {rig.get('a')})")
    check(pg.evaluate("window.__duel.cls==='sword'"), 'cls sword')
    pg.evaluate("()=>{const a=window.__duel.api;a.freezeFoe(true);a.tank();a.close(1.5);}")
    pg.wait_for_timeout(300)

errors = []
with sync_playwright() as p:
    # portrait zh
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=1)
    pg = ctx.new_page()
    errors += boot(pg, URL)
    print('rig@menu', pg.evaluate("window.__duel.api.rig()"), flush=True)
    fight_sword(pg)
    shot(pg, 'fox-idle-412x915-zh.png')
    for _ in range(10):
        pg.evaluate("window.__duel.api.cmd('atk')")
        pg.wait_for_timeout(70)
    wait_for(pg, "window.__duel.duel.a.st==='atk'", 5)
    pg.wait_for_timeout(120)
    shot(pg, 'fox-slash-412x915-zh.png')
    pg.evaluate("window.__duel.api.cmd('s2')")
    pg.wait_for_timeout(280)
    shot(pg, 'fox-dragon-412x915-zh.png')
    # vs neon side-by-side compare: hold pose
    pg.evaluate("""() => {
      const a = window.__duel.api;
      if (a.setPose) a.setPose('a', {st:'atk', mk:'a1', t:0.12});
    }""")
    pg.wait_for_timeout(100)
    shot(pg, 'fox-pose-a1-412x915-zh.png')
    ctx.close()

    # desktop en
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    pg2 = ctx2.new_page()
    url_en = URL.replace('lang=zh', 'lang=en') if 'lang=' in URL else (URL + ('&' if '?' in URL else '?') + 'lang=en')
    errors += boot(pg2, url_en)
    fight_sword(pg2)
    for _ in range(8):
        pg2.evaluate("window.__duel.api.cmd('atk')")
        pg2.wait_for_timeout(60)
    pg2.wait_for_timeout(200)
    shot(pg2, 'fox-fight-1280x800-en.png')
    # select screen
    pg2.goto(url_en, wait_until='domcontentloaded', timeout=90000)
    check(wait_for(pg2, "window.__duel.state==='menu'", 40), 're-menu')
    pg2.click('#btn-ladder')
    check(wait_for(pg2, "window.__duel.state==='select'", 20), 'select')
    pg2.evaluate("window.__duel.api.pickClass('sword')")
    pg2.wait_for_timeout(600)
    label = pg2.evaluate("document.getElementById('sel-zh')?.textContent||''")
    print('select label', label, flush=True)
    check('FOX' in label.upper() or '狐' in label, f'fox label ({label})')
    shot(pg2, 'fox-select-1280x800-en.png')
    ctx2.close()

    # phys deprecation: ?phys=1 alone should NOT enter phys
    ctx3 = b.new_context(viewport={'width': 412, 'height': 915})
    pg3 = ctx3.new_page()
    pg3.goto('http://127.0.0.1:8811/?phys=1&lang=zh', wait_until='domcontentloaded', timeout=90000)
    check(wait_for(pg3, "window.__duel && window.__duel.state==='menu'", 40), 'phys=1 alone still boots classic menu')
    check(pg3.evaluate("!window.__duel.phys"), 'phys not active without dev=1')
    shot(pg3, 'phys-deprecated-menu-412x915.png')
    ctx3.close()
    b.close()

real = [e for e in errors if 'deprecated' not in e.lower()]
print('page errors', len(real), flush=True)
for e in real[:8]:
    print(' ERR', e, flush=True)
    fails.append('pageerror: ' + e)
meta = {'url': URL, 'out': str(OUT), 'fails': fails, 'files': sorted(x.name for x in OUT.glob('*.png'))}
(OUT / 'sprite-meta.json').write_text(json.dumps(meta, indent=2))
print('FILES', meta['files'], flush=True)
if fails:
    print('FAILED', len(fails)); sys.exit(1)
print('ALL PASS')
