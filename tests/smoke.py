"""Headless smoke test for NEON STICK DUEL.
Usage:  python tests/smoke.py [base_url] [out_dir]
  base_url defaults to http://127.0.0.1:18940/neon-stick-duel/  (serve the repo parent dir with `python3 -m http.server`)
Checks on 412x915 touch + 1280x800: zero console errors; start -> intro -> play; tap = jab lands damage; hold = charge
then heavy; swipe up = jump; swipe sideways = dash; swipe down = parry; keyboard J / K-hold / arrows; pause/resume;
win a floor (KO) -> result -> next floor; lose -> revive (rewarded hook) -> fight resumes; CONTINUE on the menu; demo.
Headless Chrome runs at a few FPS, so everything polls game state instead of trusting wall time.
"""
import sys, os, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18940/neon-stick-duel/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/shots'
os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
fails = []

def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def wait_for(pg, js, timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(120)
    return False

def run(p, name, w, h, mobile):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    tap = (lambda sel: pg.tap(sel)) if mobile else (lambda sel: pg.click(sel))
    st = lambda: pg.evaluate('({s: __duel.state, a: __duel.duel.a.st, b: __duel.duel.b.st, ahp: __duel.duel.a.hp, bhp: __duel.duel.b.hp, ay: __duel.duel.a.y, floor: __duel.floor})')
    pg.goto(BASE + '?reset=1'); pg.wait_for_timeout(4500)
    pg.screenshot(path=f'{OUT}/{name}-start.png')
    tap('#btn-start')
    check(wait_for(pg, "__duel.state==='play'", 30), f'{name}: start -> intro -> play')
    pg.evaluate('__duel.api.freezeFoe(true); __duel.api.tank()')
    cx, cy = w // 2, int(h * 0.55)
    def swipe(dx, dy):
        pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + dx, cy + dy, steps=5); pg.mouse.up()
    def ready(): return wait_for(pg, "['idle','walk'].includes(__duel.duel.a.st)", 15)
    # tap = jab
    wait_for(pg, "Math.abs(__duel.duel.a.x-__duel.duel.b.x) < 1.4", 30)
    hp0 = st()['bhp']; ready()
    if mobile: pg.touchscreen.tap(cx, cy)
    else: pg.mouse.click(cx, cy)
    check(wait_for(pg, f"__duel.duel.b.hp < {hp0}", 15), f'{name}: tap = jab lands ({hp0} -> {st()["bhp"]})')
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/{name}-hit.png')
    # hold = charge -> heavy
    ready(); pg.mouse.move(cx, cy); pg.mouse.down()
    check(wait_for(pg, "__duel.duel.a.st==='wind'", 10), f'{name}: hold starts charging')
    wait_for(pg, "__duel.duel.a.charge > 0.5", 15); pg.screenshot(path=f'{OUT}/{name}-charge.png'); pg.mouse.up()
    check(wait_for(pg, "__duel.duel.a.move==='heavy'", 8), f'{name}: release = heavy strike')
    # swipes
    ready(); swipe(0, -120); check(wait_for(pg, "__duel.cmdLog.at(-1)==='jump'", 8), f'{name}: swipe up = jump')
    ready(); swipe(-140, 0); check(wait_for(pg, "__duel.cmdLog.at(-1)==='dashB' || __duel.cmdLog.at(-1)==='dashF'", 8), f'{name}: swipe side = dash')
    ready(); swipe(0, 120); check(wait_for(pg, "__duel.cmdLog.at(-1)==='parry'", 8), f'{name}: swipe down = parry')
    # keyboard
    ready(); pg.keyboard.press('ArrowUp'); check(wait_for(pg, "__duel.cmdLog.at(-1)==='jump'", 8), f'{name}: key up = jump')
    ready(); pg.keyboard.press('j'); check(wait_for(pg, "__duel.cmdLog.at(-1)==='jab'", 8), f'{name}: key J = jab')
    ready(); pg.keyboard.down('k'); check(wait_for(pg, "__duel.duel.a.st==='wind'", 8), f'{name}: hold K = charge'); pg.keyboard.up('k')
    check(wait_for(pg, "__duel.duel.a.move==='heavy'", 8), f'{name}: release K = heavy')
    # parry vs the AI: unfreeze, let it fight a bit
    pg.evaluate('__duel.api.freezeFoe(false)'); pg.wait_for_timeout(2500); pg.screenshot(path=f'{OUT}/{name}-play.png')
    pg.keyboard.press('p'); pg.wait_for_timeout(300); check(st()['s'] == 'paused', f'{name}: pause')
    tap('#btn-resume'); pg.wait_for_timeout(300); check(st()['s'] in ('play',), f'{name}: resume')
    # win the floor
    pg.evaluate("__duel.api.freezeFoe(true); __duel.duel.b.maxHp = 60; __duel.api.setHp('b', 1)"); ready(); pg.evaluate("__duel.api.close(1.0)")
    pg.keyboard.press('j')
    check(wait_for(pg, "__duel.duel.over && __duel.duel.over.winner==='a'", 15), f'{name}: KO the opponent')
    pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/{name}-ko.png')
    check(wait_for(pg, "__duel.state==='result'", 20), f'{name}: victory result screen')
    check(st()['floor'] == 1, f'{name}: floor advanced to 2F')
    pg.screenshot(path=f'{OUT}/{name}-win.png')
    tap('#btn-res-main'); check(wait_for(pg, "__duel.state==='play'", 30), f'{name}: next floor starts')
    check(pg.evaluate("document.getElementById('hp-name-b').textContent") in ('後巷打仔', 'ALLEY BRAWLER'), f'{name}: 2F opponent shown')
    # lose -> revive
    pg.evaluate("__duel.api.setHp('a', 1)"); pg.evaluate('__duel.api.freezeFoe(false)')
    check(wait_for(pg, "__duel.state==='result'", 90), f'{name}: defeat result screen')
    pg.screenshot(path=f'{OUT}/{name}-lose.png')
    if pg.is_visible('#btn-revive'):
        tap('#btn-revive'); check(wait_for(pg, "__duel.state==='play' && __duel.duel.a.hp > 1", 20), f'{name}: revive resumes the fight at 50% HP')
    else: check(False, f'{name}: revive offered after KO loss')
    pg.keyboard.press('p'); pg.wait_for_timeout(200); tap('#btn-quit'); pg.wait_for_timeout(400)
    check(st()['s'] == 'menu' and 'F' in pg.evaluate("document.getElementById('start-label').textContent"), f'{name}: menu offers CONTINUE 2F')
    # language toggle (start screen) + persisted choice
    zh0 = pg.evaluate("document.documentElement.lang")
    tap('#btn-lang'); pg.wait_for_timeout(300)
    lang1 = pg.evaluate("document.documentElement.lang"); lbl = pg.evaluate("document.getElementById('start-label').textContent")
    check(lang1 != zh0 and pg.evaluate("localStorage.getItem('cyber.lang')") in ('en', 'zh-HK'), f'{name}: language toggle switches + persists ({zh0} -> {lang1}, "{lbl}")')
    pg.goto(BASE + '?lang=en'); pg.wait_for_timeout(3000)
    check(pg.evaluate("document.getElementById('title').textContent") == 'NEON STICK' and 'CONTINUE' in pg.evaluate("document.getElementById('start-label').textContent"), f'{name}: English start screen')
    pg.screenshot(path=f'{OUT}/{name}-start-en.png')
    # endless: jump past the authored 8 floors
    pg.evaluate("__duel.floor = 8"); tap('#btn-start'); wait_for(pg, "__duel.state==='play'", 30)
    nm = pg.evaluate("document.getElementById('hp-name-b').textContent"); fl = pg.evaluate("document.getElementById('hud-floor').textContent")
    check('ENDLESS' in fl and nm != 'TOWER LORD ZERO', f'{name}: floor 9 is a procedural endless opponent ({nm} / {fl})')
    pg.wait_for_timeout(1500); pg.screenshot(path=f'{OUT}/{name}-endless-en.png')
    pg.evaluate("__duel.api.freezeFoe(true); __duel.duel.b.maxHp = 60; __duel.api.setHp('b', 1)"); ready(); pg.evaluate("__duel.api.close(1.0)"); pg.keyboard.press('j')
    check(wait_for(pg, "__duel.state==='result'", 30) and pg.evaluate('__duel.floor') == 9, f'{name}: endless floor cleared -> floor 10 next')
    pg.goto(BASE + '?lang=zh'); pg.wait_for_timeout(2500)
    check(pg.evaluate("document.getElementById('title').textContent") == '霓虹火柴人', f'{name}: ?lang=zh switches back to Chinese')
    pg.goto(BASE + '?demo=1')
    check(wait_for(pg, "__duel.state==='play' && (__duel.duel.a.stats.hits + __duel.duel.b.stats.hits) > 2", 90), f'{name}: demo autoplays')
    pg.screenshot(path=f'{OUT}/{name}-demo.png')
    check(not errs, f'{name}: zero console errors {errs[:3]}')
    b.close()

with sync_playwright() as p:
    run(p, 'mobile', 412, 915, True)
    run(p, 'desktop', 1280, 800, False)
print('ALL PASSED' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
