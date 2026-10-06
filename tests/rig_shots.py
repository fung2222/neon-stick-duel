"""HQ rig screenshots + clip capture (headless Chrome, deterministic frame stepping via window.__duel.api.advance).
Usage: python tests/rig_shots.py [base_url] [out_dir] [--only compare,combo,dj,mobile,video,debug]
Writes to out_dir (default /workspace/shots/duel-hq):
  compare-<pose>-<w>x<h>.png   classic (left) vs HQ (right) Swordsman in the same sim pose: idle, mid-slash, hit reaction
  combo-<w>x<h>.png            HQ Swordsman combo frame with the blade trail + contact sparks
  doublejump-<w>x<h>.png       double jump mid-somersault
  hq-combo.mp4 / hq-combo.gif  ~5 s HQ combo clip (30 fps frame capture + ffmpeg)
Zero console errors is asserted.
"""
import sys, os, time, json, subprocess, shutil
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

_a = sys.argv[1:]; ONLY = None
if '--only' in _a: i = _a.index('--only'); ONLY = set(_a[i + 1].split(',')); del _a[i:i + 2]
BASE = _a[0] if len(_a) > 0 else 'http://127.0.0.1:8833/'
OUT = _a[1] if len(_a) > 1 else '/workspace/shots/duel-hq'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
os.makedirs(OUT, exist_ok=True)
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m, flush=True)
    if not c: fails.append(m)
def want(k): return ONLY is None or k in ONLY

CLEAN = "#hud,#controls,#banner,.banner,.popup,#combo,#ult-cut,#ult-dim,.controls-hint,#demo-tag{display:none!important}"

def boot(b, w, h, query='?mute=1'):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=w < 600)
    ctx.add_init_script("try{localStorage.setItem('cyber.lang','en')}catch(e){}")
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(BASE + query)
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("!!(window.__duel && window.__duel.state==='menu' && window.__duel.duel)"): time.sleep(0.2)
    return ctx, pg, errs

def fight(pg, stage=1):
    pg.evaluate("window.__duel.api.startMode('ladder', {cls:'sword', stage:%d})" % stage)
    pg.evaluate("window.__duel.api.manual(true)")
    pg.evaluate("window.__duel.api.advance(1/30, 70)")   # through the intro banner
    pg.add_style_tag(content=CLEAN)
    pg.evaluate("()=>{const a=window.__duel.api; a.freezeFoe(true); a.tank(); const d=window.__duel.duel; d.time=60; d.a.x=-0.9; d.b.x=0.9; d.a.facing=1; d.b.facing=-1;}")
    pg.evaluate("window.__duel.api.advance(1/30, 20)")

def adv(pg, n, dt=1/30): pg.evaluate("window.__duel.api.advance(%f, %d)" % (dt, n))

def pose(pg, spec, settle=24):
    """hold the sim and put fighter a into spec; let springs / crossfades settle"""
    pg.evaluate("()=>{const a=window.__duel.api; a.hold(true); const d=window.__duel.duel; d.a.x=-0.9; d.b.x=0.9; d.b.st='idle'; d.b.t=0; d.a.facing=1; d.b.facing=-1;}")
    pg.evaluate("window.__duel.api.setPose('a', %s)" % json.dumps(spec))
    adv(pg, settle)

def crop_a(pg, path, w, h, zoom=1.0):
    pg.screenshot(path=path)
    sx = pg.evaluate("(()=>{const s=window.__duel.api.screenOf('a'); const t=window.__duel.api.screenOf('b'); return [s.x, s.y, t.x, t.y]})()")
    return sx

def compare_shots(p, w, h):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    poses = {
        'idle': {'st': 'idle', 't': 0},
        'midslash': {'st': 'atk', 'mk': 'a1', 't': 0.09},
        'hit': {'st': 'hit', 't': 0.06, 'stunT': 0.4, 'hit': {'dmg': 58, 'kb': 2.4, 'src': 'a3'}},
    }
    for name, spec in poses.items():
        tiles = []
        for rig in ['classic', 'hq']:
            pg.evaluate("window.__duel.api.setRig('%s')" % rig)
            pose(pg, spec)
            f = os.path.join(OUT, f'_tmp-{rig}.png'); pg.screenshot(path=f)
            s = pg.evaluate("(()=>{const s=window.__duel.api.screenOf('a'); return [s.x, s.y]})()")
            im = Image.open(f); cw, ch = (int(w * 0.42), int(h * 0.62)) if w > h else (int(w * 0.8), int(h * 0.42))
            x0 = int(max(0, min(w - cw, s[0] - cw * 0.42))); y0 = int(max(0, min(h - ch, s[1] - ch * 0.5)))
            tiles.append(im.crop((x0, y0, x0 + cw, y0 + ch))); os.remove(f)
        W = sum(t.width for t in tiles) + 12; H = tiles[0].height + 40
        out = Image.new('RGB', (W, H), (8, 6, 20)); d = ImageDraw.Draw(out)
        x = 0
        for t, lab in zip(tiles, ['CLASSIC', 'HQ RIG']):
            out.paste(t, (x, 40)); d.text((x + 12, 12), f'{lab} · Swordsman · {name}', fill=(160, 250, 255)); x += t.width + 12
        path = os.path.join(OUT, f'compare-{name}-{w}x{h}.png'); out.save(path); print('wrote', path)
    pg.evaluate("window.__duel.api.setRig('hq')")
    check(not errs, f'compare {w}x{h}: zero console errors {errs[:3]}')
    b.close()

COMBO_JS = """(S) => {   // scripted showcase: a1-a4 chain → jump cancel → air1/air2 → lunge → rising dragon
  const d = S.duel, a = d.a, api = S.api; const m = a.mk ? a.C.moves[a.mk] : null; S.cs = S.cs || { i: 0, t: 0 }; const c = S.cs; c.t += 1/30;
  const T = m ? m.t[0] + m.t[1] + m.t[2] : 0;
  const ready = !m || (m.chain != null && a.t >= m.chain * T) || a.t >= T * 0.98;
  const seq = ['atk','atk','atk','atk','jump','atk','atk','wait','s1','wait','s2','wait'];
  if (c.i >= seq.length) return; const s = seq[c.i];
  if (s === 'wait') { if (a.st === 'idle' && c.t > 0.35) { c.i++; c.t = 0; } return; }
  if (s === 'jump') { if (m && m.launch && a.connected && a.t >= m.t[0] + m.t[1]) { api.cmd('jump'); c.i++; c.t = 0; } return; }
  if (s === 'atk' && a.st === 'jump' && a.y > 0.6) { api.cmd('atk'); c.i++; c.t = 0; return; }
  if (s === 'atk' && a.st !== 'jump' && ready && c.t > 0.05) { api.cmd('atk'); c.i++; c.t = 0; return; }
  if ((s === 's1' || s === 's2') && a.st === 'idle') { const gap = d.b.x - a.x; if (s === 's1' && gap < 3) { a.x = d.b.x - 3.6; } a.cd[s] = 0; api.cmd(s); c.i++; c.t = 0; }
}"""

def combo_shot(p, w, h):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-0.7; d.b.x=0.7; window.__duel.cs=null;}")
    got = {}
    for i in range(110):
        pg.evaluate("window.__duel.api.advance(1/60, 1, %s)" % COMBO_JS)
        st = pg.evaluate("(()=>{const a=window.__duel.duel.a; return {st:a.st, mk:a.mk, t:a.t, stop:window.__duel.duel.stop}})()")
        if st['mk'] in ('a2', 'a3', 'a4', 's2') and st['stop'] > 0 and st['mk'] not in got:   # connecting: trail + sparks on screen
            adv(pg, 1, 1/60); got[st['mk']] = st
            path = os.path.join(OUT, f"combo-{st['mk']}-{w}x{h}.png"); pg.screenshot(path=path); print('wrote', path, st)
            if len(got) == 4: break
    check(len(got) >= 3, f'combo {w}x{h}: captured contact frames {sorted(got)}')
    check(not errs, f'combo {w}x{h}: zero console errors {errs[:3]}')
    b.close()

def dj_shot(p, w, h):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-1.6; d.b.x=1.6;}")
    pg.evaluate("window.__duel.api.cmd('jump')"); adv(pg, 9, 1/60)
    pg.evaluate("window.__duel.api.cmd('jump')")
    got = False
    for i in range(40):
        adv(pg, 1, 1/60)
        s = pg.evaluate("(()=>{const a=window.__duel.duel.a; return {dj:a.dj, djT:a.djT, y:a.y}})()")
        if s['dj'] and s['djT'] >= 0.17: got = True; break
    path = os.path.join(OUT, f'doublejump-{w}x{h}.png'); pg.screenshot(path=path); print('wrote', path, s)
    check(got, f'double jump {w}x{h}: mid-flip frame')
    check(not errs, f'dj {w}x{h}: zero console errors {errs[:3]}')
    b.close()

def video(p, w=1280, h=800, seconds=5.2, fps=30):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-1.0; d.b.x=0.6; window.__duel.cs=null;}")
    fd = os.path.join(OUT, '_frames'); shutil.rmtree(fd, ignore_errors=True); os.makedirs(fd)
    n = int(seconds * fps)
    for i in range(n):
        pg.evaluate("window.__duel.api.advance(1/60, 2, %s)" % COMBO_JS)
        pg.screenshot(path=os.path.join(fd, '%04d.png' % i))
    mp4 = os.path.join(OUT, 'hq-combo.mp4'); gif = os.path.join(OUT, 'hq-combo.gif')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(fd, '%04d.png'), '-vf', 'scale=960:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', gif], check=True)
    shutil.rmtree(fd, ignore_errors=True)
    print('wrote', mp4, gif)
    check(os.path.getsize(mp4) > 50000, 'video written')
    check(not errs, f'video: zero console errors {errs[:3]}')
    b.close()

with sync_playwright() as p:
    for (w, h) in [(1280, 800), (412, 915)]:
        if want('compare'): compare_shots(p, w, h)
        if want('combo'): combo_shot(p, w, h)
        if want('dj'): dj_shot(p, w, h)
    if want('video'): video(p)
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
