"""Anime Swordsman pilot: screenshots, clip, perf numbers (headless Chrome, deterministic frame stepping via window.__duel.api.advance).
Usage: python tests/anime_shots.py [base_url] [out_dir] [--only compare,fight,card,forms,perf,video]
Writes to out_dir (default /workspace/shots/duel-anime):
  compare-<pose>.png        HQ neon stickman (left) vs anime Swordsman (right), same sim pose: idle, midcombo, ult
  fight-412x915.png / fight-1280x800.png   in-fight frames (HUD on) at a combo contact
  portrait-card.png         character-select style close-up
  forms-<move>.png          martial-arts key-frame strips (wind-up → strike → follow-through → held finish) for a1 a2 a3 a4 s1 s2 ult,
                            played in from the move start at 1/120 s so springs (coat / hair fling) and the trail are live
  anime-combo.mp4           ~5 s 412x915 combo clip (+1 black row: yuv420p needs an even height → 412x916), H.264 yuv420p, fixed 1/30 s per frame clock
  perf.json                 draw calls / triangles (anime vs neon), per-character tris, JS update cost, heap growth per update
Zero console errors is asserted on every page.
"""
import sys, os, time, json, subprocess, shutil
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

_a = sys.argv[1:]; ONLY = None
if '--only' in _a: i = _a.index('--only'); ONLY = set(_a[i + 1].split(',')); del _a[i:i + 2]
BASE = _a[0] if len(_a) > 0 else 'http://127.0.0.1:8833/'
OUT = _a[1] if len(_a) > 1 else '/workspace/shots/duel-anime'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
        '--js-flags=--expose-gc', '--enable-precise-memory-info']
os.makedirs(OUT, exist_ok=True)
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m, flush=True)
    if not c: fails.append(m)
def want(k): return ONLY is None or k in ONLY
def font(sz, cjk=False):
    for f in (['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'] if cjk else []) + ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

CLEAN = "#hud,#controls,#banner,.banner,.popup,#combo,#ult-cut,#ult-dim,.controls-hint,#demo-tag,#loading{display:none!important}"
COMBO_JS = """(S) => {   // scripted showcase: a1-a4 chain → jump cancel → air1/air2 → iai dash → corkscrew
  const d = S.duel, a = d.a, api = S.api; const m = a.mk ? a.C.moves[a.mk] : null; S.cs = S.cs || { i: 0, t: 0 }; const c = S.cs; c.t += 1/60;
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

def boot(b, w, h, query='?mute=1&style=anime'):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=w < 600)
    ctx.add_init_script("try{localStorage.setItem('cyber.lang','en')}catch(e){}")
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(BASE + query)
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("!!(window.__duel && window.__duel.state==='menu' && window.__duel.duel)"): time.sleep(0.2)
    return ctx, pg, errs

def fight(pg, stage=1, clean=True):
    pg.evaluate("window.__duel.api.startMode('ladder', {cls:'sword', stage:%d})" % stage)
    pg.evaluate("window.__duel.api.manual(true)")
    pg.evaluate("window.__duel.api.advance(1/30, 70)")
    if clean: pg.add_style_tag(content=CLEAN)
    else: pg.add_style_tag(content="#loading{display:none!important}")   # the loader can still be fading out under a busy CPU
    pg.evaluate("()=>{const a=window.__duel.api; a.freezeFoe(true); a.tank(); const d=window.__duel.duel; d.time=60; d.a.x=-0.9; d.b.x=0.9; d.a.facing=1; d.b.facing=-1;}")
    pg.evaluate("window.__duel.api.advance(1/30, 20)")

def adv(pg, n, dt=1/30): pg.evaluate("window.__duel.api.advance(%f, %d)" % (dt, n))
def shot(pg, path): pg.screenshot(path=path, timeout=180000)

def pose(pg, spec, settle=24):
    pg.evaluate("()=>{const a=window.__duel.api; a.hold(true); const d=window.__duel.duel; d.a.x=-0.9; d.b.x=2.6; d.b.st='idle'; d.b.t=0; d.a.facing=1; d.b.facing=-1;}")
    pg.evaluate("window.__duel.api.setPose('a', %s)" % json.dumps(spec))
    adv(pg, settle)

def compare_shots(p, w=1280, h=800):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("window.__duel.api.cam({fov:30,pos:[-0.5,1.45,6.3],look:[-0.6,1.1,0]}); window.__duel.api.dbg().fb.visible=false")
    poses = {
        'idle': ({'st': 'idle', 't': 0}, 24),
        'midcombo': ({'st': 'atk', 'mk': 'a3', 't': 0.0}, 0),   # t filled in: a3 contact
        'ult': ({'st': 'atk', 'mk': 'ult', 't': 0.0}, 0),
    }
    T3 = pg.evaluate("window.__duel.duel.a.C.moves.a3.t"); TU = pg.evaluate("window.__duel.duel.a.C.moves.ult.t")
    poses['midcombo'][0]['t'] = T3[0] + T3[1] * 0.35; poses['ult'][0]['t'] = TU[0] + TU[1] * 0.42
    for name, (spec, settle) in poses.items():
        tiles = []
        for style in ['neon', 'anime']:
            pg.evaluate("window.__duel.api.setStyle('%s')" % style)
            if style == 'neon': pg.evaluate("window.__duel.api.setRig('hq')")
            pg.evaluate("window.__duel.api.dbg().fb.visible=false")
            if settle: pose(pg, spec, settle)
            else:   # play into the pose from the move start so trails / crossfades / springs are live
                s0 = dict(spec); t_end = s0['t']; s0['t'] = 0; pose(pg, {'st': 'idle', 't': 0}, 12)
                pg.evaluate("window.__duel.api.setPose('a', %s)" % json.dumps(s0))
                n = max(1, int(round(t_end / (1 / 120))))
                pg.evaluate("(()=>{const S=window.__duel; for(let i=0;i<%d;i++){S.duel.a.t=Math.min(%f, S.duel.a.t+1/120); S.api.advance(1/120,1);} })()" % (n, t_end))
            f = os.path.join(OUT, f'_tmp-{style}.png'); shot(pg, f)
            im = Image.open(f).convert('RGB'); cw, ch = int(w * 0.5), int(h * 0.86); x0 = int(w * 0.21); y0 = int(h * 0.06)
            tiles.append(im.crop((x0, y0, x0 + cw, y0 + ch))); os.remove(f)
        W = sum(t.width for t in tiles) + 12; H = tiles[0].height + 44
        out = Image.new('RGB', (W, H), (8, 6, 20)); d = ImageDraw.Draw(out); fnt = font(20)
        x = 0
        for t, lab in zip(tiles, ['HQ NEON STICKMAN', 'ANIME SWORDSMAN']):
            out.paste(t, (x, 44)); d.text((x + 14, 11), f'{lab} · {name}', fill=(160, 250, 255), font=fnt); x += t.width + 12
        path = os.path.join(OUT, f'compare-{name}.png'); out.save(path); print('wrote', path)
    pg.evaluate("window.__duel.api.setStyle('anime')")
    check(not errs, f'compare: zero console errors {errs[:3]}')
    b.close()

def fight_shots(p):
    for (w, h) in [(412, 915), (1280, 800)]:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx, pg, errs = boot(b, w, h)
        fight(pg, stage=3, clean=False)   # stage 3 foe is a Swordsman: mirror match shows two anime fighters (HUD on)
        pg.add_style_tag(content="#banner,.banner,.popup{display:none!important}")
        pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-0.7; d.b.x=0.7; window.__duel.cs=null;}")
        got = None
        for i in range(160):
            pg.evaluate("window.__duel.api.advance(1/60, 1, %s)" % COMBO_JS)
            st = pg.evaluate("(()=>{const a=window.__duel.duel.a; return {st:a.st, mk:a.mk, t:a.t, stop:window.__duel.duel.stop}})()")
            if st['mk'] == 'a3' and st['stop'] > 0: adv(pg, 1, 1/60); got = st; break
        path = os.path.join(OUT, f'fight-{w}x{h}.png'); shot(pg, path); print('wrote', path, got)
        check(got is not None, f'fight {w}x{h}: a3 contact frame')
        check(pg.evaluate("window.__duel.api.rig().a") == 'anime', f'fight {w}x{h}: player renders anime')
        check(not errs, f'fight {w}x{h}: zero console errors {errs[:3]}')
        b.close()

def card(p):
    w, h = 600, 800
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("window.__duel.api.dbg().fb.visible=false; window.__duel.api.cam({fov:24,pos:[1.0,2.0,3.9],look:[-0.84,1.62,0]})")
    pose(pg, {'st': 'idle', 't': 0}, 40)
    f = os.path.join(OUT, '_card.png'); shot(pg, f)
    im = Image.open(f).convert('RGB'); os.remove(f)
    card = Image.new('RGB', (w + 24, h + 24), (0, 229, 255)); inner = Image.new('RGB', (w + 16, h + 16), (10, 8, 26)); card.paste(inner, (4, 4)); card.paste(im, (12, 12))
    d = ImageDraw.Draw(card, 'RGBA'); d.rectangle((12, h - 120, w + 12, h + 12), fill=(6, 4, 18, 200))
    d.text((32, h - 108), '劍士', fill=(255, 255, 255), font=font(46, True)); d.text((150, h - 92), 'SWORDSMAN', fill=(0, 229, 255), font=font(30))
    d.text((34, h - 42), 'Cyber-samurai · iai kenjutsu · long reach', fill=(200, 210, 240), font=font(18))
    path = os.path.join(OUT, 'portrait-card.png'); card.save(path); print('wrote', path)
    check(not errs, f'card: zero console errors {errs[:3]}')
    b.close()


FORMS = {   # move: [(label, phase, u)] — phase s/a/r = fraction of startup / active / recovery (same convention as js/anime/clip.js form())
    'a1': [('stance', 's', 0.0), ('iai coil', 's', 0.55), ('draw', 's', 0.85), ('contact', 'a', 0.0), ('whip', 'a', 1.0), ('guard + settle', 'r', 0.6)],
    'a2': [('drop low', 's', 0.55), ('slide in', 's', 0.85), ('contact', 'a', 0.0), ('rising', 'a', 1.0), ('jodan', 'r', 0.45), ('settle', 'r', 0.75)],
    'a3': [('pivot', 's', 0.3), ('back turned', 's', 0.6), ('whip', 's', 0.85), ('contact', 'a', 0.0), ('through', 'a', 1.0), ('bow stance', 'r', 0.6)],
    'a4': [('chamber', 's', 0.55), ('stamp', 's', 0.9), ('thrust', 'a', 0.0), ('lift', 'a', 1.0), ('held finish', 'r', 0.5), ('held finish', 'r', 0.8)],
    's1': [('iai crouch', 's', 0.5), ('held', 's', 0.86), ('draw-thrust', 'a', 0.0), ('extension', 'a', 0.6), ('skid', 'r', 0.4), ('guard', 'r', 0.7)],
    's2': [('horse stance', 's', 0.6), ('contact', 'a', 0.0), ('corkscrew', 'a', 0.3), ('half turn', 'a', 0.5), ('apex', 'a', 1.0), ('settle', 'r', 0.45)],
    'ult': [('coil', 's', 0.6), ('cut 1', 'a', 0.0), ('spin cut', 'a', 3 / 7), ('thrust', 'a', 4 / 7), ('horse coil', 'a', 5.6 / 7), ('held finish', 'r', 0.6)],
}
def forms_shots(p, w=520, h=640):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("window.__duel.api.cam({fov:34,pos:[-0.75,1.35,6.0],look:[-0.75,1.15,0]}); window.__duel.api.dbg().fb.visible=false")
    for mk, frames in FORMS.items():
        T = pg.evaluate("window.__duel.duel.a.C.moves['%s'].t" % mk)
        at = lambda ph, u: T[0] * u if ph == 's' else T[0] + T[1] * u if ph == 'a' else T[0] + T[1] + T[2] * u
        pose(pg, {'st': 'idle', 't': 0}, 12)
        pg.evaluate("window.__duel.api.setPose('a', %s)" % json.dumps({'st': 'atk', 'mk': mk, 't': 0}))
        tiles, cur = [], 0.0
        for lab, ph, u in frames:
            tt = at(ph, u); n = int(round((tt - cur) / (1 / 120)))
            if n > 0: pg.evaluate("(()=>{const S=window.__duel; for(let i=0;i<%d;i++){S.duel.a.t=Math.min(%f, S.duel.a.t+1/120); S.api.advance(1/120,1);} })()" % (n, tt))
            else: pg.evaluate("window.__duel.api.advance(1/120,1)")
            cur = tt
            f = os.path.join(OUT, '_f.png'); shot(pg, f); im = Image.open(f).convert('RGB'); os.remove(f)
            cw = int(w * 0.62); x0 = (w - cw) // 2; tile = im.crop((x0, int(h * 0.06), x0 + cw, int(h * 0.98)))
            d = ImageDraw.Draw(tile, 'RGBA'); d.rectangle((0, 0, cw, 30), fill=(6, 4, 18, 190)); d.text((8, 6), f'{lab}  {tt*1000:.0f} ms', fill=(160, 250, 255), font=font(15))
            tiles.append(tile)
        W = sum(t.width for t in tiles) + 6 * (len(tiles) - 1); out = Image.new('RGB', (W, tiles[0].height + 40), (8, 6, 20)); x = 0
        ImageDraw.Draw(out).text((10, 9), f'ANIME SWORDSMAN · {mk} · frame data {T} s (contact on the first active frame)', fill=(255, 255, 255), font=font(18))
        for t in tiles: out.paste(t, (x, 40)); x += t.width + 6
        path = os.path.join(OUT, f'forms-{mk}.png'); out.save(path); print('wrote', path)
    check(not errs, f'forms: zero console errors {errs[:3]}')
    b.close()

PERF_JS = """() => {
  const S = window.__duel, api = S.api, { fa } = api.dbg(), d = S.duel, f = d.a, out = {};
  const run = (n, st, mk, T) => { for (let i = 0; i < n; i++) { f.st = st; f.mk = mk; f.t = T ? (i / 60) % T : i / 60; fa.update(f, 1 / 60, 100 + i / 60, 3, false, 0); fa.takeFx(); } };
  const T = (k) => { const m = f.C.moves[k]; return m.t[0] + m.t[1] + m.t[2]; };
  const all = () => { run(240, 'idle', null); for (const k of ['a1', 'a2', 'a3', 'a4', 's1', 's2', 'ult']) run(120, 'atk', k, T(k)); run(120, 'block', null); };
  all(); all();   // warm-up (JIT)
  const t0 = performance.now(); all(); out.updateMs = (performance.now() - t0) / 1320;
  if (window.gc) {
    const heap = (fn, n) => { window.gc(); window.gc(); const m0 = performance.memory.usedJSHeapSize; fn(); return Math.max(0, performance.memory.usedJSHeapSize - m0) / n; };
    out.heapBytesPerUpdate = heap(() => { all(); all(); }, 2640);
    out.heapBytesPerUpdateIdle = heap(() => run(1200, 'idle', null), 1200);
    out.heapBytesPerUpdateCombo = heap(() => { for (const k of ['a1', 'a2', 'a3', 'a4']) run(300, 'atk', k, T(k)); }, 1200);
  }
  return out;
}"""

def perf(p):
    res = {}
    for style in ['neon', 'anime']:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx, pg, errs = boot(b, 412, 915, '?mute=1&style=%s' % style)
        fight(pg, stage=3)
        pose(pg, {'st': 'idle', 't': 0}, 10)
        r = {'rig': pg.evaluate("window.__duel.api.rig()"), 'scene': pg.evaluate("window.__duel.api.renderInfo()"), 'chars': pg.evaluate("window.__duel.api.charStats()")}
        pg.evaluate("window.__duel.api.dbg().fb.visible=false"); r['sceneOneFighterHidden'] = pg.evaluate("window.__duel.api.renderInfo()")
        pg.evaluate("window.__duel.api.dbg().fa.visible=false"); r['sceneNoFighters'] = pg.evaluate("window.__duel.api.renderInfo()")
        pg.evaluate("window.__duel.api.dbg().fa.visible=true; window.__duel.api.dbg().fb.visible=true")
        r['js'] = pg.evaluate(PERF_JS)
        res[style] = r; print(style, json.dumps(r), flush=True)
        check(not errs, f'perf {style}: zero console errors {errs[:3]}')
        b.close()
    a = res['anime']; c = a['chars']['a']
    a['perFighter'] = {'calls': a['sceneOneFighterHidden']['calls'] - a['sceneNoFighters']['calls'], 'triangles': a['sceneOneFighterHidden']['triangles'] - a['sceneNoFighters']['triangles']}
    check(c['unique'] < 15000, f"anime character under 15k triangles (unique {c['unique']}, drawn incl. outline {c['drawn']})")
    json.dump(res, open(os.path.join(OUT, 'perf.json'), 'w'), indent=1); print('wrote perf.json', a['perFighter'])

def video(p, w=412, h=915, seconds=5.2, fps=30):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg, stage=3)
    pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-1.0; d.b.x=0.6; window.__duel.cs=null;}")
    fd = os.path.join(OUT, '_frames'); shutil.rmtree(fd, ignore_errors=True); os.makedirs(fd)
    n = int(seconds * fps)
    for i in range(n):   # deterministic clock: exactly 1/30 s of game time per captured frame (2 sim sub-steps)
        pg.evaluate("window.__duel.api.advance(1/60, 2, %s)" % COMBO_JS)
        shot(pg, os.path.join(fd, '%04d.png' % i))
    mp4 = os.path.join(OUT, 'anime-combo.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(fd, '%04d.png'), '-vf', 'pad=412:916:0:0:black,setsar=1', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], check=True)
    shutil.rmtree(fd, ignore_errors=True)
    sz = os.path.getsize(mp4); print('wrote', mp4, sz)
    check(50000 < sz < 8 * 1024 * 1024, f'video size {sz} bytes (< 8 MB)')
    check(not errs, f'video: zero console errors {errs[:3]}')
    b.close()

with sync_playwright() as p:
    if want('compare'): compare_shots(p)
    if want('fight'): fight_shots(p)
    if want('card'): card(p)
    if want('forms'): forms_shots(p)
    if want('perf'): perf(p)
    if want('video'): video(p)
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
