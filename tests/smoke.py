"""Headless smoke test for NEON STICK DUEL v2.
Usage:  python tests/smoke.py [base_url] [out_dir]
  base_url defaults to http://127.0.0.1:8811/  (serve the repo root with `python3 -m http.server 8811`)
Checks on 412x915 touch + 1280x800, zh + en: zero console errors; menu -> class select (all 4 classes) -> fight;
joystick moves, keyboard A/D/W/S/J/K/L/U/Shift, on-screen buttons; combo chain; skills go on cooldown; ultimate
cut-in; KO win -> result -> next fight saved; loss -> rewarded revive; endless floor 12; trial caps (ladder 1-3,
endless 1-3) with the trial screen; interstitial break only after a loss; v1 save migration; ?demo=1.
Headless Chrome runs at a few FPS, so everything polls game state instead of trusting wall time.
Screenshots (class select, each class mid-combo, ultimate, joystick HUD) go to out_dir.
"""
import sys, os, time, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8811/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/shots'
QUICK = '--quick' in sys.argv
os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
fails = []

def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg, flush=True)
    if not cond: fails.append(msg)

def wait_for(pg, js, timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(100)
    return False

def page(b, w, h, lang, init='', query=''):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=w < 600, is_mobile=False)
    ctx.add_init_script(f"try{{localStorage.setItem('cyber.lang','{lang}');{init}}}catch(e){{}}")
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(BASE + query)
    wait_for(pg, "window.__duel && window.__duel.state==='menu' && window.__duel.duel", 60)
    return ctx, pg, errs

def start(pg, mode, cls, **kw):
    opts = dict(cls=cls, **kw)
    pg.evaluate(f"window.__duel.api.startMode('{mode}', {json.dumps(opts)})")
    return wait_for(pg, "window.__duel.state==='play'", 40)

def shot(pg, name):
    pg.screenshot(path=os.path.join(OUT, name + '.png'))

def mid_combo(pg, cls, name):
    pg.wait_for_timeout(1300)   # let the FIGHT! banner clear
    pg.evaluate("()=>{const a=window.__duel.api;a.freezeFoe(true);a.tank();a.close(%s)}" % ('3.2' if cls == 'mage' else '1.3'))
    target = 'a3'
    got = False
    for i in range(18):
        pg.keyboard.press('KeyJ'); pg.wait_for_timeout(140)
        f = pg.evaluate("window.__duel.api.fighter('a')")
        if f['mk'] in ('a3', 'a4') and f['st'] == 'atk':
            got = True; break
    shot(pg, name)
    f = pg.evaluate("window.__duel.api.fighter('a')")
    return got, f

def run_view(p, w, h, lang, classes):
    tag = f"{w}x{h}-{lang}"
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = page(b, w, h, lang)
    check(pg.evaluate("document.documentElement.lang") != '' and pg.evaluate("window.__duel.state") == 'menu', f'{tag}: boots to menu')
    check(pg.evaluate("!!document.querySelector('meta[name=robots][content*=noindex]')"), f'{tag}: noindex')
    shot(pg, f'menu-{tag}')
    # class select
    pg.click('#btn-ladder'); check(wait_for(pg, "window.__duel.state==='select'"), f'{tag}: class select opens')
    for c in ['sword', 'mage', 'brawler', 'assassin']:
        pg.click(f'.sel-tab[data-cls={c}]'); pg.wait_for_timeout(150)
        check(pg.evaluate(f"window.__duel.selCls==='{c}' && document.querySelectorAll('#sel-kit li').length===4"), f'{tag}: select {c} shows kit')
    sel = classes[0]
    pg.click(f'.sel-tab[data-cls={sel}]')
    wait_for(pg, "window.__duel.duel && window.__duel.duel.a.st==='atk'", 20); pg.wait_for_timeout(600)
    shot(pg, f'select-{sel}-{tag}')
    pg.click('#btn-fight'); check(wait_for(pg, "window.__duel.state==='play'"), f'{tag}: FIGHT starts ladder fight 1')
    check(pg.evaluate(f"window.__duel.cls==='{sel}' && window.__duel.duel.a.cls==='{sel}'"), f'{tag}: chosen class used')
    # joystick drag right -> walks
    jz = pg.evaluate("(()=>{const r=document.getElementById('joy-zone').getBoundingClientRect();return [r.left+90, r.bottom-110]})()")
    pg.evaluate("window.__duel.api.freezeFoe(true); window.__duel.api.close(5)")
    x0 = pg.evaluate("window.__duel.duel.a.x")
    pg.mouse.move(jz[0], jz[1]); pg.mouse.down(); pg.mouse.move(jz[0] + 50, jz[1], steps=4)
    wait_for(pg, f"window.__duel.duel.a.x > {x0} + 0.6", 20)
    shot(pg, f'joystick-hud-{sel}-{tag}')
    check(pg.evaluate(f"window.__duel.duel.a.x > {x0} + 0.3"), f'{tag}: joystick right walks forward')
    pg.mouse.move(jz[0] - 50, jz[1], steps=4); x1 = pg.evaluate("window.__duel.duel.a.x")
    check(wait_for(pg, f"window.__duel.duel.a.x < {x1} - 0.3", 20), f'{tag}: joystick left backs off (no auto-forward)')
    pg.mouse.up(); pg.wait_for_timeout(300)
    xs = pg.evaluate("window.__duel.duel.a.x"); pg.wait_for_timeout(900)
    check(abs(pg.evaluate("window.__duel.duel.a.x") - xs) < 0.15, f'{tag}: released stick stands still')
    # keyboard move / jump / guard
    if w > 600:
        pg.keyboard.down('KeyD'); ok = wait_for(pg, f"window.__duel.duel.a.st==='walk'", 10); pg.keyboard.up('KeyD'); check(ok, f'{tag}: D walks')
        pg.keyboard.press('Space'); check(wait_for(pg, "window.__duel.duel.a.y>0.3", 10), f'{tag}: Space jumps')
        wait_for(pg, "window.__duel.duel.a.y===0 && window.__duel.duel.a.st==='idle'", 10)
        pg.keyboard.down('KeyS'); ok = wait_for(pg, "window.__duel.duel.a.st==='guard'", 10); pg.keyboard.up('KeyS'); check(ok, f'{tag}: S guards')
        pg.keyboard.down('KeyA'); pg.keyboard.press('ShiftLeft'); ok = wait_for(pg, "window.__duel.duel.a.st==='dodge'", 10); pg.keyboard.up('KeyA'); check(ok, f'{tag}: Shift+dir dodges')
    else:
        pg.click('.b-jump'); check(wait_for(pg, "window.__duel.duel.a.y>0.3", 10), f'{tag}: JUMP button jumps')
        wait_for(pg, "window.__duel.duel.a.y===0", 10)
        bx = pg.evaluate("(()=>{const r=document.querySelector('.b-guard').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        pg.mouse.move(bx[0], bx[1]); pg.mouse.down(); ok = wait_for(pg, "window.__duel.duel.a.st==='guard'", 10); pg.mouse.up(); check(ok, f'{tag}: GUARD button guards')
    # mid-combo for each class
    for i, c in enumerate(classes):
        if i > 0: start(pg, 'ladder', c, stage=i)
        wait_for(pg, "window.__duel.state==='play'", 30)
        got, f = mid_combo(pg, c, f'combo-{c}-{tag}')
        check(got and f['stats']['hits'] >= 2 if c != 'mage' else got, f'{tag}: {c} combo chains to hit 3+ (hits={f["stats"]["hits"]}, move={f["mk"]})')
    # skills + cooldown rings via buttons
    wait_for(pg, "window.__duel.duel.a.st==='idle'||window.__duel.duel.a.st==='walk'", 10); pg.wait_for_timeout(300)
    pg.click('.b-s1'); check(wait_for(pg, "window.__duel.duel.a.cd.s1>0", 10), f'{tag}: skill 1 button fires + cooldown')
    check(wait_for(pg, "document.querySelector('.b-s1').classList.contains('cooling')", 10), f'{tag}: skill 1 cooldown ring shown')
    wait_for(pg, "['idle','walk'].includes(window.__duel.duel.a.st) && window.__duel.duel.a.y===0", 10); pg.wait_for_timeout(200)
    pg.keyboard.press('KeyL'); check(wait_for(pg, "window.__duel.duel.a.cd.s2>0", 10), f'{tag}: L fires skill 2')
    # ultimate
    wait_for(pg, "['idle','walk'].includes(window.__duel.duel.a.st) && window.__duel.duel.a.y===0", 15)
    pg.evaluate("window.__duel.api.setUlt(100); window.__duel.api.close(1.4)")
    wait_for(pg, "document.querySelector('.b-ult').classList.contains('ready')", 10)
    pg.click('.b-ult')
    check(wait_for(pg, "!document.getElementById('ult-cut').classList.contains('hidden')", 10), f'{tag}: ultimate cut-in shows')
    pg.wait_for_timeout(250); shot(pg, f'ult-cutin-{classes[-1]}-{tag}')
    wait_for(pg, "window.__duel.duel.freeze<=0 && window.__duel.duel.a.st==='atk'", 10); pg.wait_for_timeout(500)
    shot(pg, f'ult-{classes[-1]}-{tag}')
    check(wait_for(pg, "window.__duel.duel.a.stats.ults>=1", 5), f'{tag}: ultimate used')
    # KO win -> result -> next (saved)
    pg.evaluate("window.__duel.api.setHp('b', 1); window.__duel.api.freezeFoe(true); window.__duel.api.close(1.3)")
    wait_for(pg, "['idle','walk'].includes(window.__duel.duel.a.st)", 15)
    for _ in range(12):
        if pg.evaluate("!!window.__duel.duel.over"): break
        pg.keyboard.press('KeyJ'); pg.wait_for_timeout(200)
    check(wait_for(pg, "window.__duel.state==='result'", 30), f'{tag}: KO -> result screen')
    lvl = pg.evaluate("window.__duel.stage")
    check(pg.evaluate("window.__duel.api.store().ladder") == lvl, f'{tag}: ladder progress saved ({lvl})')
    pg.click('#btn-res-main'); check(wait_for(pg, "window.__duel.state==='play' || window.__duel.state==='intro'", 20), f'{tag}: next fight starts')
    # loss -> revive
    wait_for(pg, "window.__duel.state==='play'", 20)
    pg.evaluate("window.__duel.api.setHp('a', 1); window.__duel.api.freezeFoe(false); window.__duel.api.close(1.2)")
    check(wait_for(pg, "window.__duel.state==='result'", 60), f'{tag}: losing -> result')
    check(pg.evaluate("!document.getElementById('btn-revive').classList.contains('hidden')"), f'{tag}: revive offered after KO loss')
    pg.click('#btn-revive'); check(wait_for(pg, "window.__duel.state==='play' && window.__duel.duel.a.hp>=window.__duel.duel.a.maxHp*0.45", 20), f'{tag}: revive restores 50% HP')
    # endless deep floor
    start(pg, 'endless', classes[0], floor=11)
    check(pg.evaluate("document.getElementById('hud-floor').textContent.includes('12')"), f'{tag}: endless floor 12 HUD')
    # pause
    pg.keyboard.press('KeyP') if w > 600 else pg.click('#btn-pause')
    check(wait_for(pg, "window.__duel.state==='paused'", 10), f'{tag}: pause'); pg.click('#btn-resume'); check(wait_for(pg, "window.__duel.state==='play'", 15), f'{tag}: resume')
    check(not errs, f'{tag}: zero console errors {errs[:5]}')
    b.close()

def run_hub(p):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    # trial caps: ladder 1-3
    ctx, pg, errs = page(b, 1280, 800, 'en', query='?hub=1&tier=free&ads=1&trial=1&trialLeft=2&adsim=1')
    check(pg.evaluate("window.__duel.api.hub().trial===true"), 'trial: hub params read')
    check(pg.evaluate("!document.getElementById('start-trial').classList.contains('hidden')"), 'trial: menu shows trial note')
    pg.evaluate("window.__duel.api.startMode('ladder', {cls:'brawler'})"); wait_for(pg, "window.__duel.state==='play'")
    check(pg.evaluate("window.__duel.stage") == 0, 'trial: ladder starts at fight 1')
    for n in range(3):
        wait_for(pg, "window.__duel.state==='play'", 30)
        pg.evaluate("window.__duel.api.setHp('b', 1); window.__duel.api.freezeFoe(true); window.__duel.api.close(1.2)")
        for _ in range(15):
            if pg.evaluate("!!window.__duel.duel.over"): break
            pg.keyboard.press('KeyJ'); pg.wait_for_timeout(200)
        wait_for(pg, "window.__duel.state==='result'", 30)
        pg.click('#btn-res-main')
    check(wait_for(pg, "window.__duel.state==='trial'", 20), 'trial: after ladder fight 3 -> trial screen')
    check(pg.evaluate("window.__duel.api.store().ladder") == 0, 'trial: does not write ladder save')
    check(pg.evaluate("window.__duel.adBreaks") == 0, 'ads: no interstitial break after wins')
    # endless 1-3
    pg.click('#btn-trial-menu'); wait_for(pg, "window.__duel.state==='menu'")
    pg.evaluate("window.__duel.api.startMode('endless', {cls:'sword', floor: 7})"); wait_for(pg, "window.__duel.state==='play'")
    check(pg.evaluate("window.__duel.floor") == 0, 'trial: endless starts at floor 1')
    pg.evaluate("window.__duel.floor = 2"); pg.evaluate("window.__duel.api.setHp('b', 1); window.__duel.api.freezeFoe(true); window.__duel.api.close(1.2)")
    for _ in range(15):
        if pg.evaluate("!!window.__duel.duel.over"): break
        pg.keyboard.press('KeyJ'); pg.wait_for_timeout(200)
    wait_for(pg, "window.__duel.state==='result'", 30); pg.click('#btn-res-main')
    check(wait_for(pg, "window.__duel.state==='trial'", 20), 'trial: after endless floor 3 -> trial screen')
    # loss -> interstitial break only then
    pg.click('#btn-trial-menu'); wait_for(pg, "window.__duel.state==='menu'")
    pg.evaluate("window.__duel.api.startMode('ladder', {cls:'mage'})"); wait_for(pg, "window.__duel.state==='play'")
    pg.evaluate("window.__duel.api.setHp('a', 1); window.__duel.api.close(1.2)")
    wait_for(pg, "window.__duel.state==='result'", 60); pg.click('#btn-res-main'); pg.wait_for_timeout(800)
    check(pg.evaluate("window.__duel.adBreaks") == 1, 'ads: interstitial break after a loss (ads=1)')
    check(not errs, f'hub/trial: zero console errors {errs[:5]}')
    ctx.close()
    # v1 save migration
    init = "if(!sessionStorage.getItem('m')){sessionStorage.setItem('m','1');localStorage.clear();localStorage.setItem('cyber.lang','zh');localStorage.setItem('cyber.neon-stick-duel.floor','3');localStorage.setItem('cyber.neon-stick-duel.lap','1');localStorage.setItem('cyber.neon-stick-duel.bestFloor','11');localStorage.setItem('cyber.neon-stick-duel.best','45000');}"
    ctx, pg, errs = page(b, 412, 915, 'zh', init=init)
    s = pg.evaluate("window.__duel.api.store()")
    check(s['floor'] == 11 and s['ver'] == 2 and s['lap'] is None and s['cls'] == 'sword', f'migration: v1 floor 3 + lap 1 -> floor 11, ver 2 ({s})')
    check(pg.evaluate("document.getElementById('start-floor').textContent") == '11F', 'migration: best floor kept')
    check(pg.evaluate("document.getElementById('start-best').textContent") == '45000', 'migration: best score kept')
    check(not errs, f'migration: zero console errors {errs[:5]}')
    ctx.close()
    # demo
    ctx, pg, errs = page(b, 1280, 720, 'en', query='?demo=1')
    check(wait_for(pg, "window.__duel.state==='play' && window.__duel.demo", 30), 'demo: autoplays endless')
    check(wait_for(pg, "window.__duel.duel.a.stats.hits + window.__duel.duel.b.stats.hits > 2", 60), 'demo: AI vs AI trade hits')
    check(not errs, f'demo: zero console errors {errs[:5]}')
    b.close()

with sync_playwright() as p:
    run_view(p, 412, 915, 'zh', ['sword', 'mage', 'brawler', 'assassin'])
    if not QUICK:
        run_view(p, 1280, 800, 'en', ['brawler', 'assassin', 'sword', 'mage'])
        run_view(p, 412, 915, 'en', ['assassin', 'brawler'])
        run_view(p, 1280, 800, 'zh', ['mage', 'sword'])
        run_hub(p)
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
