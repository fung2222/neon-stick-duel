#!/usr/bin/env python3
"""Shots for cyber mini-SF SpriteFighter (4 kits + launch / hitstop / menu)."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8811/?lang=zh'
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'docs/shots/sprite')
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

def start_cls(pg, cls, stage=0):
    pg.evaluate(f"window.__duel.api.startMode('ladder', {{cls:'{cls}', stage:{stage}}})")
    check(wait_for(pg, "window.__duel.state==='intro' || window.__duel.state==='play'", 40), f'{cls} start')
    pg.evaluate("()=>{const S=window.__duel; if(S.state==='intro') S.introT=0;}")
    wait_for(pg, "window.__duel.state==='play'", 10)
    pg.wait_for_timeout(1400)
    rig = pg.evaluate("window.__duel.api.rig()")
    check(rig.get('sprite') is True, f'{cls} sprite mode')
    check(rig.get('a') == 'sprite', f'{cls} player sprite ({rig.get("a")})')
    pg.evaluate("()=>{const a=window.__duel.api;a.freezeFoe(true);a.tank();a.close(1.5);}")
    pg.wait_for_timeout(200)

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)

    # menu zh + en
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=1)
    pg = ctx.new_page()
    errors += boot(pg, 'http://127.0.0.1:8811/?lang=zh')
    shot(pg, 'menu-412x915-zh.png')
    print('rig', pg.evaluate("window.__duel.api.rig()"), flush=True)

    for cls in CLASSES:
        start_cls(pg, cls)
        shot(pg, f'{cls}-idle-412x915-zh.png')
        # windup → active attack
        for _ in range(8):
            pg.evaluate("window.__duel.api.cmd('atk')")
            pg.wait_for_timeout(55)
        wait_for(pg, "window.__duel.duel.a.st==='atk'", 4)
        pg.wait_for_timeout(80)
        shot(pg, f'{cls}-atk-412x915-zh.png')
        pg.goto('http://127.0.0.1:8811/?lang=zh', wait_until='domcontentloaded')
        wait_for(pg, "window.__duel.state==='menu'", 30)

    # sword launch (s2 Rising Dragon) — clear launch silhouette
    start_cls(pg, 'sword')
    pg.evaluate("()=>{const a=window.__duel.api;a.close(1.2);a.freezeFoe(true);a.tank();}")
    pg.evaluate("window.__duel.api.cmd('s2')")
    # advance into active / launch
    pg.evaluate("""()=>{
      const S=window.__duel, a=S.api;
      a.manual(true);
      for(let i=0;i<18;i++) a.advance(1/30,1);
    }""")
    pg.wait_for_timeout(100)
    shot(pg, 'sword-launch-412x915-zh.png')
    st = pg.evaluate("()=>{const d=window.__duel.duel; return {ast:d.a.st, amk:d.a.mk, bst:d.b.st, by:d.b.y, stop:d.stop};}")
    print('launch state', st, flush=True)
    check(st.get('amk') == 's2' or st.get('bst') in ('air','hit','atk') or (st.get('by') or 0) > 0.2 or (st.get('stop') or 0) > 0, 'launch/hitstop readable')
    ctx.close()

    # desktop
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    pg2 = ctx2.new_page()
    errors += boot(pg2, 'http://127.0.0.1:8811/?lang=en')
    shot(pg2, 'menu-1280x800-en.png')
    start_cls(pg2, 'mage')
    for _ in range(6):
        pg2.evaluate("window.__duel.api.cmd('atk')"); pg2.wait_for_timeout(50)
    pg2.wait_for_timeout(120)
    shot(pg2, 'mage-loose-1280x800-en.png')
    pg2.goto('http://127.0.0.1:8811/?lang=en', wait_until='domcontentloaded')
    wait_for(pg2, "window.__duel.state==='menu'", 30)
    start_cls(pg2, 'brawler')
    for _ in range(6):
        pg2.evaluate("window.__duel.api.cmd('atk')"); pg2.wait_for_timeout(50)
    shot(pg2, 'brawler-street-1280x800-en.png')
    pg2.goto('http://127.0.0.1:8811/?lang=en', wait_until='domcontentloaded')
    wait_for(pg2, "window.__duel.state==='menu'", 30)
    # sword rising dragon desktop
    start_cls(pg2, 'sword')
    pg2.evaluate("""()=>{
      const a=window.__duel.api;
      a.close(1.15); a.freezeFoe(true); a.tank(); a.manual(true);
      a.cmd('s2');
      for(let i=0;i<20;i++) a.advance(1/30,1);
    }""")
    pg2.wait_for_timeout(80)
    shot(pg2, 'sword-launch-1280x800-en.png')
    pg2.goto('http://127.0.0.1:8811/?lang=en', wait_until='domcontentloaded')
    wait_for(pg2, "window.__duel.state==='menu'", 30)
    pg2.click('#btn-ladder')
    wait_for(pg2, "window.__duel.state==='select'", 20)
    pg2.wait_for_timeout(500)
    shot(pg2, 'roster-select-1280x800-en.png')

    # shogun boss fight
    pg2.goto('http://127.0.0.1:8811/?lang=en', wait_until='domcontentloaded')
    wait_for(pg2, "window.__duel.state==='menu'", 30)
    pg2.evaluate("window.__duel.api.startMode('ladder', {cls:'sword', stage:9})")
    wait_for(pg2, "window.__duel.state==='intro' || window.__duel.state==='play'", 40)
    pg2.evaluate("()=>{const S=window.__duel; if(S.state==='intro') S.introT=0;}")
    wait_for(pg2, "window.__duel.state==='play'", 10)
    pg2.wait_for_timeout(1600)
    boss = pg2.evaluate("()=>{const b=window.__duel.duel.b; return {cls:b.cls, rig:window.__duel.api.rig().b};}")
    print('boss', boss, flush=True)
    check(boss.get('cls') == 'shogun', 'ladder 10 is shogun')
    check(boss.get('rig') == 'sprite', 'shogun uses sprite')
    shot(pg2, 'shogun-boss-1280x800-en.png')
    ctx2.close()
    b.close()

real = [e for e in errors if 'deprecated' not in e.lower() and 'favicon' not in e.lower()]
for e in real[:10]:
    print(' ERR', e); fails.append(e)
meta = {'fails': fails, 'files': sorted(x.name for x in OUT.glob('*.png'))}
(OUT / 'sprite-meta.json').write_text(json.dumps(meta, indent=2))
print('FILES', meta['files'], flush=True)
if fails:
    print('FAILED', len(fails)); sys.exit(1)
print('ALL PASS')
