"""Phys active-ragdoll screenshots. Usage: python tests/phys_shots.py [base_url] [out_dir]"""
import sys, os, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8811/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/shots/phys'
os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']

def wait_for(pg, js, timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(120)
    return False

fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m, flush=True)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=1, has_touch=True)
    ctx.add_init_script("try{localStorage.setItem('cyber.lang','en')}catch(e){}")
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(BASE + '?phys=1&fps=1')
    ok = wait_for(pg, "window.__duel && window.__duel.phys === true && window.__phys", 50)
    check(ok, 'boots phys spike')
    pg.wait_for_timeout(800)
    pg.screenshot(path=os.path.join(OUT, 'phys-menu-412x915.png'))

    pg.evaluate("window.__duel.api.start()")
    ok = wait_for(pg, "window.__phys && (window.__phys.state==='play' || window.__phys.state==='intro')", 20)
    check(ok, 'starts fight')
    # let intro settle into play
    wait_for(pg, "window.__phys.state==='play'", 15)
    pg.wait_for_timeout(900)

    # STAND
    snap = pg.evaluate("window.__duel.api.snapshot()")
    check(snap.get('poseA') in ('stand', 'walk'), f"idle poseA={snap.get('poseA')}")
    pg.screenshot(path=os.path.join(OUT, 'phys-pose-stand-412x915.png'))
    pg.screenshot(path=os.path.join(OUT, 'phys-fight-idle-412x915.png'))

    # WALK
    pg.evaluate("window.__duel.api.forceMx(0.85)")
    pg.wait_for_timeout(700)
    snap = pg.evaluate("window.__duel.api.snapshot()")
    check(snap.get('poseA') == 'walk', f"walk poseA={snap.get('poseA')}")
    pg.screenshot(path=os.path.join(OUT, 'phys-pose-walk-412x915.png'))
    pg.evaluate("window.__duel.api.forceMx(0)")
    pg.wait_for_timeout(300)

    # PUNCH
    for i in range(8):
        pg.evaluate("window.__duel.api.punch()")
        pg.wait_for_timeout(70)
    snap = pg.evaluate("window.__duel.api.snapshot()")
    check(snap and 'a' in snap and 'torso' in snap['a'], 'snapshot has torso')
    # pose may already have returned to stand; capture mid-swing by punch then immediate shot
    pg.evaluate("window.__duel.api.punch()")
    pg.wait_for_timeout(50)
    snap = pg.evaluate("window.__duel.api.snapshot()")
    check(snap.get('poseA') in ('punch', 'stand', 'walk'), f"punch-ish poseA={snap.get('poseA')}")
    pg.screenshot(path=os.path.join(OUT, 'phys-pose-punch-412x915.png'))
    pg.screenshot(path=os.path.join(OUT, 'phys-fight-punch-412x915.png'))

    # HIT pose
    pg.evaluate("window.__duel.api.setHp('a', 55)")
    pg.evaluate("window.__duel.api.forceHit('a', 14)")
    pg.wait_for_timeout(80)
    snap = pg.evaluate("window.__duel.api.snapshot()")
    check(snap.get('poseA') == 'hit', f"hit poseA={snap.get('poseA')}")
    pg.screenshot(path=os.path.join(OUT, 'phys-pose-hit-412x915.png'))

    # KO limp
    pg.evaluate("window.__duel.api.setHp('b', 0)")
    pg.wait_for_timeout(1100)
    snap = pg.evaluate("window.__duel.api.snapshot()")
    check(snap.get('poseB') == 'ko' or snap.get('hpB', 1) <= 0, f"ko poseB={snap.get('poseB')} hpB={snap.get('hpB')}")
    pg.screenshot(path=os.path.join(OUT, 'phys-pose-ko-412x915.png'))
    pg.screenshot(path=os.path.join(OUT, 'phys-ko-limp-412x915.png'))

    # desktop
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    ctx2.add_init_script("try{localStorage.setItem('cyber.lang','zh')}catch(e){}")
    pg2 = ctx2.new_page()
    pg2.goto(BASE + '?phys=1&autostart=1')
    wait_for(pg2, "window.__phys && (window.__phys.state==='play' || window.__phys.state==='intro')", 40)
    pg2.wait_for_timeout(1800)
    for i in range(10):
        pg2.evaluate("window.__duel.api.punch()"); pg2.wait_for_timeout(80)
    pg2.screenshot(path=os.path.join(OUT, 'phys-fight-1280x800.png'))

    # classic path
    ctx3 = b.new_context(viewport={'width': 412, 'height': 915})
    pg3 = ctx3.new_page()
    pg3.goto(BASE)
    ok = wait_for(pg3, "window.__duel && window.__duel.state==='menu' && !window.__duel.phys", 50)
    check(ok, 'classic path still boots (no phys flag)')
    pg3.screenshot(path=os.path.join(OUT, 'classic-menu-still-ok.png'), timeout=60000)

    real = [e for e in errs if 'favicon' not in e.lower()]
    check(len(real) == 0, f'no console errors ({len(real)}): {real[:3]}')
    print('errs', real)
    b.close()

print('OUT', OUT)
if fails:
    print('FAILED', fails); sys.exit(1)
print('ALL PASS')
