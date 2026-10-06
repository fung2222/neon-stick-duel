"""Final boss 塔主・零 / 機械將軍 KAGE-SHŌGUN (HANDOFF §16 step 1): in-fight screenshots + clip (headless Chrome, deterministic clock
via window.__duel.api.advance — 1/60 s sim steps, one captured frame per 1/30 s of game time).
Usage: python tests/boss_shots.py [base_url] [out_dir] [--lang en|zh]
Writes to out_dir (default /workspace/shots/duel-boss):
  boss-phase1-412x915.png      phase 1 「秩序」: Iai Judgement on the flash (white-hot ground zone + hilt glint + move callout)
  boss-transition-412x915.png  the 50 % phase change: invulnerable transition, shockwave, 「第二型態・崩壞」 / PHASE 2 · COLLAPSE banner
  boss-phase2-412x915.png      phase 2 「崩壞」: Data-Blade Rain markers with countdown fill + falling blades, red outline, data-blade halo
  boss-sim.mp4                 ~8 s 412x915 (+1 black row → 412x916), H.264 yuv420p: Iai (player dodges on the flash) → the player's
                               Lunge crosses 50 % → transition → Glitch Step (decoys, real one behind; player guards) → Data-Blade Rain
                               (player steps into a gap)
Zero console errors is asserted.
"""
import sys, os, time, json, subprocess, shutil
from playwright.sync_api import sync_playwright

_a = sys.argv[1:]; LANG = 'en'
if '--lang' in _a: i = _a.index('--lang'); LANG = _a[i + 1]; del _a[i:i + 2]
BASE = _a[0] if len(_a) > 0 else 'http://127.0.0.1:8862/'
OUT = _a[1] if len(_a) > 1 else '/workspace/shots/duel-boss'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
os.makedirs(OUT, exist_ok=True)
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m, flush=True)
    if not c: fails.append(m)

# scripted fight (runs before every 1/60 s tick). The boss AI is frozen; both sides are driven by this director.
DIRECTOR = """(S) => {
  const d = S.duel, a = d.a, b = d.b, api = S.api, M = b.C.moves; const c = S.dir || (S.dir = { t: 0, i: 0, mark: {} }); c.t += 1/60;
  const at = (k) => { if (c.mark[k] == null) c.mark[k] = c.t; return c.t - c.mark[k]; };
  a.in.guard = false; a.in.mx = 0;
  switch (c.i) {
    case 0: if (c.t > 0.3) { api.foeCmd('bm:iai'); c.i++; } break;                                       // phase 1: Iai Judgement
    case 1: if (b.mk === 'iai' && b.t >= M.iai.flash + 2/60) { a.in.mx = -1; api.cmd('dodge'); c.i++; } break;   // dodge on the flash
    case 2: if (b.st !== 'atk' && at('wait1') > 0.2) c.i++; break;
    case 3: { const gap = b.x - a.x; if (gap > 3.0) a.in.mx = 1; else { b.hp = Math.round(b.maxHp * 0.5) + 40; a.cd.s1 = 0; api.cmd('s1'); c.i++; } break; }   // Lunge crosses 50 %
    case 4: if (b.st === 'phase') c.i++; break;
    case 5: if (b.st !== 'phase' && at('p2') > 0.15) { api.foeCmd('bm:glitch'); c.i++; } break;          // phase 2: Glitch Step
    case 6: a.in.guard = true; if (b.mk !== 'glitch' && at('g') > 0.2) { c.i++; } break;
    case 7: a.in.guard = b.st === 'atk'; if (at('g2') > 0.15 && b.st !== 'atk') { if (Math.abs(b.x - a.x) < 2.2) { b.x = Math.max(-7, Math.min(7, a.x + Math.sign(b.x - a.x || 1) * 2.6)); b.facing = Math.sign(a.x - b.x); } api.foeCmd('bm:rain'); c.i++; } break;   // Data-Blade Rain
    case 8: { const bl = d.projs.filter((p) => p.key === 'dblade' && !p.dead); if (!bl.length) break;
      if (c.gx == null) { const xs = bl.map((p) => p.x).sort((x, y) => x - y), mids = xs.slice(1).map((x, i) => (x + xs[i]) / 2); c.gx = mids.reduce((m, x) => (Math.abs(x - a.x) < Math.abs(m - a.x) ? x : m)); }
      a.in.mx = Math.abs(c.gx - a.x) > 0.08 ? Math.sign(c.gx - a.x) : 0; break; }
  }
  S.padOv = { mx: a.in.mx, guard: a.in.guard };   // the director's stick / guard (read by simStep instead of the touch pad)
  c.frame = (c.frame || 0) + 1;
}"""

def boot(b, w, h):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=w < 600)
    ctx.add_init_script("try{localStorage.setItem('cyber.lang','%s')}catch(e){}" % LANG)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(BASE + '?mute=1')
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("!!(window.__duel && window.__duel.state==='menu' && window.__duel.duel)"): time.sleep(0.2)
    return ctx, pg, errs

def run(p, w=412, h=915, seconds=8.2, fps=30):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    # ladder fight 10 via the test hook; manual clock + frozen boss AI before any wall-clock frame runs
    pg.evaluate("(()=>{const S=window.__duel, api=S.api; api.startMode('ladder', {cls:'sword', stage:9}); api.manual(true); api.freezeFoe(true); S.acc=0;})()")
    pg.evaluate("window.__duel.api.advance(1/30, 120)")   # intro + FIGHT! banner gone
    pg.add_style_tag(content="#loading{display:none!important}")
    info = pg.evaluate("(()=>{const d=window.__duel.duel; d.time=90; d.a.x=-1.9; d.b.x=1.7; d.a.facing=1; d.b.facing=-1; d.a.hp=d.a.maxHp; d.b.hp=d.b.maxHp; window.__duel.dir=null; return {foe: window.__duel.foe.en, cls: d.b.cls, rig: window.__duel.api.rig().b, scale: d.b.scale}})()")
    check(info['cls'] == 'shogun' and info['rig'] == 'anime', f'fight 10 = boss, anime interim body ({info})')
    pg.evaluate("window.__duel.api.advance(1/30, 6)")
    fd = os.path.join(OUT, '_frames'); shutil.rmtree(fd, ignore_errors=True); os.makedirs(fd)
    n = int(seconds * fps); log = []; shots = {}
    for i in range(n):
        pg.evaluate("window.__duel.api.advance(1/60, 2, %s)" % DIRECTOR)
        st = pg.evaluate("(()=>{const S=window.__duel, b=S.duel.b, a=S.duel.a; return {i: S.dir.i, mk: b.mk, st: b.st, t: b.t, ph: b.phase, ast: a.st, ahp: a.hp, flash: b.C.moves.iai.flash, blades: S.duel.projs.filter(p=>p.key==='dblade').length, falling: S.duel.projs.filter(p=>p.key==='dblade' && p.delay > 0 && p.delay < 0.22).length, landed: S.duel.projs.filter(p=>p.key==='dblade' && !(p.delay > 0) && !p.dead).length, decoys: S.duel.projs.filter(p=>p.key==='decoy').length}})()")
        log.append(st)
        f = os.path.join(fd, '%04d.png' % i); pg.screenshot(path=f, timeout=180000)
        if 'phase1' not in shots and st['mk'] == 'iai' and st['t'] >= st['flash'] + 0.03: shots['phase1'] = f
        if 'transition' not in shots and st['st'] == 'phase' and st['t'] >= 0.3: shots['transition'] = f
        if 'phase2' not in shots and st['blades'] >= 4 and st['falling'] >= 1 and st['landed'] >= 1: shots['phase2'] = f
    for k, f in shots.items(): shutil.copy(f, os.path.join(OUT, f'boss-{k}-{w}x{h}.png')); print('wrote', os.path.join(OUT, f'boss-{k}-{w}x{h}.png'))
    check(set(shots) == {'phase1', 'transition', 'phase2'}, f'screenshots captured: {sorted(shots)}')
    mp4 = os.path.join(OUT, 'boss-sim.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(fd, '%04d.png'), '-vf', 'pad=412:916:0:0:black,setsar=1', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', mp4], check=True)
    nf = int(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', mp4], capture_output=True, text=True).stdout.strip() or 0)
    check(nf == n, f'video: {nf} encoded frames == {n} captured')
    if not os.environ.get('KEEP_FRAMES'): shutil.rmtree(fd, ignore_errors=True)
    sz = os.path.getsize(mp4); mks = sorted({s['mk'] for s in log if s['mk']}); print('wrote', mp4, sz, mks)
    check({'iai', 'glitch', 'rain'} <= set(mks) and any(s['st'] == 'phase' for s in log), f'clip shows a phase-1 move, the transition and phase-2 moves ({mks})')
    check(max(s['decoys'] for s in log) == 2, 'Glitch Step decoys on screen')
    bh = pg.evaluate("window.__duel.duel.b.stats.hits")
    check(bh == 0, f"every boss attack was answered in the clip (boss clean hits {bh}; player hp {log[-1]['ahp']} = chip only)")
    check(50000 < sz < 8 * 1024 * 1024, f'video size {sz} bytes (< 8 MB)')
    check(not errs, f'zero console errors {errs[:3]}')
    b.close()

with sync_playwright() as p: run(p)
print('\nFAILED:\n  ' + '\n  '.join(fails) if fails else '\nALL PASS'); sys.exit(1 if fails else 0)
