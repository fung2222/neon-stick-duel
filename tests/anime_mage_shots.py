"""Anime Mage (phase 2): screenshots, clip, perf numbers (headless Chrome, deterministic frame stepping via window.__duel.api.advance).
Usage: python tests/anime_mage_shots.py [base_url] [out_dir] [--only turnaround,vsold,forms,fight,perf,video,card]
Writes to out_dir (default /workspace/shots/duel-anime):
  mage-turnaround.png       full body, win pose: front, 3/4, side, back 3/4 (+ triangle counts)
  mage-vs-old.png           old neon (classic stick) Mage vs anime Mage, same sim pose: idle, a3 orb cast, ult held pose
  mage-forms-<move>.png     key-frame strips (wind-up → release → settle) for a1 a2 a3 air1 s1 s2 ult, played in at 1/120 s
  fight-mage-vs-sword-<w>x<h>.png   in-fight frames (HUD on): player anime Mage vs the stage-4 Swordsman (RONIN-07)
  fight-sword-vs-mage-412x915.png   player Swordsman vs the stage-3 Mage (NEON ADEPT, recoloured)
  mage-card.png             close-up portrait
  mage-combo.mp4            ~5.6 s 412x915 (+1 black row → 412x916) combo → pillar → ult, H.264 yuv420p, fixed 1/30 s per frame clock
  mage-perf.json            draw calls / triangles, per-character tris, JS update cost, heap growth per update
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
COMBO_JS = """(S) => {   // scripted showcase: a1 → a2 → a3 chain → thunder pillar → starfall ult (held pose)
  const d = S.duel, a = d.a, api = S.api; const m = a.mk ? a.C.moves[a.mk] : null; S.cs = S.cs || { i: 0, t: 0 }; const c = S.cs; c.t += 1/60;
  const T = m ? m.t[0] + m.t[1] + m.t[2] : 0;
  const ready = !m || (m.chain != null && a.t >= m.chain * T) || a.t >= T * 0.98;
  const seq = ['atk','atk','atk','wait','s2','wait','ult'];
  if (c.i >= seq.length) return; const s = seq[c.i];
  if (s === 'wait') { if (a.st === 'idle' && c.t > 0.2) { c.i++; c.t = 0; } return; }
  if (s === 'atk' && ready && c.t > 0.05) { api.cmd('atk'); c.i++; c.t = 0; return; }
  if (s === 's2' && a.st === 'idle') { a.cd.s2 = 0; api.cmd('s2'); c.i++; c.t = 0; return; }
  if (s === 'ult' && a.st === 'idle') { api.setUlt(100); api.cmd('ult'); c.i++; c.t = 0; }
}"""

def boot(b, w, h, query='?mute=1&style=anime', lang='en'):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=w < 600)
    ctx.add_init_script("try{localStorage.setItem('cyber.lang','%s')}catch(e){}" % lang)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(BASE + query)
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("!!(window.__duel && window.__duel.state==='menu' && window.__duel.duel)"): time.sleep(0.2)
    return ctx, pg, errs

def fight(pg, cls='mage', stage=3, clean=True):
    pg.evaluate("window.__duel.api.startMode('ladder', {cls:'%s', stage:%d})" % (cls, stage))
    pg.evaluate("window.__duel.api.manual(true)")
    pg.evaluate("window.__duel.api.advance(1/30, 70)")
    if clean: pg.add_style_tag(content=CLEAN)
    else: pg.add_style_tag(content="#loading{display:none!important}")
    pg.evaluate("()=>{const a=window.__duel.api; a.freezeFoe(true); a.tank(); const d=window.__duel.duel; d.time=60; d.a.x=-0.9; d.b.x=0.9; d.a.facing=1; d.b.facing=-1;}")
    pg.evaluate("window.__duel.api.advance(1/30, 20)")

def adv(pg, n, dt=1/30): pg.evaluate("window.__duel.api.advance(%f, %d)" % (dt, n))
def shot(pg, path): pg.screenshot(path=path, timeout=180000)
def pose(pg, spec, settle=24):
    pg.evaluate("()=>{const a=window.__duel.api; a.hold(true); const d=window.__duel.duel; d.a.x=-0.9; d.b.x=2.6; d.b.st='idle'; d.b.t=0; d.a.facing=1; d.b.facing=-1;}")
    pg.evaluate("window.__duel.api.setPose('a', %s)" % json.dumps(spec))
    adv(pg, settle)
def play_to(pg, mk, t_end, dt=1/120):
    pose(pg, {'st': 'idle', 't': 0}, 12)
    pg.evaluate("window.__duel.api.setPose('a', %s)" % json.dumps({'st': 'atk', 'mk': mk, 't': 0}))
    n = max(1, int(round(t_end / dt)))
    pg.evaluate("(()=>{const S=window.__duel; for(let i=0;i<%d;i++){S.duel.a.t=Math.min(%f, S.duel.a.t+%f); S.api.advance(%f,1);} })()" % (n, t_end, dt, dt))

VIEWS = {'front': (6.0, 0.0), '3/4': (4.24, 4.24), 'side': (0.0, 6.0), 'back': (-6.0, 0.0), 'back 3/4': (-4.24, -4.24)}
def turnaround(p, w=420, h=840):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg); pg.evaluate("window.__duel.api.dbg().fb.visible=false")
    st = pg.evaluate("window.__duel.api.charStats().a")
    tiles = []
    for v in ['front', '3/4', 'side', 'back']:
        dx, dz = VIEWS[v]
        pg.evaluate("window.__duel.api.cam({fov:30,pos:[%f,1.45,%f],look:[-0.9,1.32,0]})" % (-0.9 + dx, dz + 1e-4))
        pose(pg, {'st': 'win', 't': 3}, 30)
        f = os.path.join(OUT, '_b.png'); shot(pg, f); im = Image.open(f).convert('RGB'); os.remove(f)
        d = ImageDraw.Draw(im, 'RGBA'); d.rectangle((0, 0, w, 34), fill=(6, 4, 18, 200)); d.text((10, 8), v, fill=(220, 180, 255), font=font(17))
        tiles.append(im)
    leak = pg.evaluate("""() => { const { fa } = window.__duel.api.dbg(), bad = []; for (const r of [fa.classic, fa.hq]) if (r && r.group) r.group.traverse((o) => { if (o.isMesh && o.visible && r.group.visible) bad.push(o.name || o.type); }); return { rig: fa.rig, bad }; }""")
    check(leak['rig'] == 'anime' and not leak['bad'], f"turnaround: no stick / classic rig pieces visible ({leak})")
    tw, th = tiles[0].size; out = Image.new('RGB', (tw * 4 + 18, th + 46), (8, 6, 20)); d = ImageDraw.Draw(out)
    d.text((12, 12), f"魔法師 MAGE · anime netrunner · turnaround · {st['unique']} unique tris, {st['drawn']} drawn incl. outline, {st['calls']} calls", fill=(255, 255, 255), font=font(18, True))
    for i, t in enumerate(tiles): out.paste(t, (i * (tw + 6), 46))
    path = os.path.join(OUT, 'mage-turnaround.png'); out.save(path); print('wrote', path, st)
    check(st['drawn'] < 15000, f"mage: {st['unique']} unique / {st['drawn']} drawn triangles (< 15k incl. outline)")
    check(not errs, f'turnaround: zero console errors {errs[:3]}')
    b.close()

def vs_old(p, w=1280, h=800):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("window.__duel.api.cam({fov:30,pos:[-0.5,1.45,6.3],look:[-0.6,1.1,0]}); window.__duel.api.dbg().fb.visible=false")
    T3 = pg.evaluate("window.__duel.duel.a.C.moves.a3.t"); TU = pg.evaluate("window.__duel.duel.a.C.moves.ult.t")
    poses = [('idle', None, 0), ('a3 star-orb release', 'a3', T3[0] + 0.01), ('ult held pose', 'ult', TU[0] + TU[1] + TU[2] * 0.6)]
    rows = []
    for name, mk, tt in poses:
        tiles = []
        for style in ['neon', 'anime']:
            pg.evaluate("window.__duel.api.setStyle('%s')" % style); pg.evaluate("window.__duel.api.dbg().fb.visible=false")
            if mk: play_to(pg, mk, tt)
            else: pose(pg, {'st': 'idle', 't': 0}, 30)
            f = os.path.join(OUT, f'_tmp-{style}.png'); shot(pg, f)
            im = Image.open(f).convert('RGB'); cw, ch = int(w * 0.42), int(h * 0.86); x0 = int(w * 0.25); y0 = int(h * 0.06)
            tiles.append(im.crop((x0, y0, x0 + cw, y0 + ch)).resize((int(cw * 0.75), int(ch * 0.75)))); os.remove(f)
        if name == 'idle': rig_new = pg.evaluate("window.__duel.api.rig().a")
        rows.append((name, tiles))
    tw, th = rows[0][1][0].size
    out = Image.new('RGB', (tw * 2 * 3 + 12 * 5, th + 80), (8, 6, 20)); d = ImageDraw.Draw(out)
    d.text((12, 10), 'OLD neon stick Mage (left of each pair)  vs  NEW anime netrunner Mage (right) · same sim pose', fill=(255, 255, 255), font=font(20))
    x = 0
    for name, tiles in rows:
        for t, lab in zip(tiles, ['OLD NEON', 'ANIME']):
            out.paste(t, (x, 76)); d.text((x + 10, 46), f'{lab} · {name}', fill=(220, 180, 255) if lab == 'ANIME' else (170, 170, 200), font=font(16)); x += tw + 12
    path = os.path.join(OUT, 'mage-vs-old.png'); out.save(path); print('wrote', path)
    pg.evaluate("window.__duel.api.setStyle('anime')")
    check(rig_new == 'anime', 'vs-old: style=anime renders the Mage with the anime rig')
    check(not errs, f'vs-old: zero console errors {errs[:3]}')
    b.close()

def card(p, w=600, h=800):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("window.__duel.api.dbg().fb.visible=false; window.__duel.api.cam({fov:24,pos:[0.6,1.95,3.6],look:[-0.84,1.55,0]})")
    pose(pg, {'st': 'idle', 't': 0}, 40)
    path = os.path.join(OUT, 'mage-card.png'); shot(pg, path); print('wrote', path)
    check(not errs, f'card: zero console errors {errs[:3]}')
    b.close()

FORMS = {   # move: [(label, phase, u)] — phase s/a/r = fraction of startup / active / recovery (same convention as js/anime/clip.js form())
    'a1': [('cat stance', 's', 0.0), ('coil: hip back', 's', 0.6), ('drive', 's', 0.85), ('release (bolt)', 'a', 0.0), ('push-through', 'a', 1.0), ('settle', 'r', 0.6)],
    'a2': [('cross-step', 's', 0.3), ('coil low', 's', 0.58), ('release (bolt)', 'a', 0.0), ('push-through', 'a', 1.0), ('settle', 'r', 0.45), ('held', 'r', 0.8)],
    'a3': [('glyph ring', 's', 0.42), ('sink + gather', 's', 0.8), ('stamp-release', 'a', 0.0), ('extend', 'a', 1.0), ('turn', 'r', 0.3), ('held finish', 'r', 0.82)],
    'air1': [('air coil', 's', 0.5), ('dive release', 'a', 0.0), ('extend', 'a', 1.0), ('settle', 'r', 0.45)],
    's1': [('mudra coil', 's', 0.5), ('blink (line)', 'a', 0.0), ('re-form squash', 'a', 0.6), ('settle', 'r', 0.5)],
    's2': [('coil', 's', 0.3), ('golden rooster', 's', 0.55), ('stamp (pillar)', 's', 0.91), ('sword mudra', 'a', 0.0), ('held', 'r', 0.5), ('settle', 'r', 0.85)],
    'ult': [('wind 1', 's', 0.35), ('wind 2: sink', 's', 0.72), ('stamp + cast', 's', 0.93), ('palms to sky', 'a', 1.0), ('held pose', 'r', 0.6), ('descend', 'r', 0.95)],
}
def forms_shots(p, w=520, h=640):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg)
    pg.evaluate("window.__duel.api.cam({fov:36,pos:[-0.55,1.4,6.0],look:[-0.55,1.2,0]}); window.__duel.api.dbg().fb.visible=false")
    for mk, frames in FORMS.items():
        T = pg.evaluate("window.__duel.duel.a.C.moves['%s'].t" % mk)
        at = lambda ph, u: T[0] * u if ph == 's' else T[0] + T[1] * u if ph == 'a' else T[0] + T[1] + T[2] * u
        if mk.startswith('air'):
            pose(pg, {'st': 'idle', 't': 0}, 12); pg.evaluate("()=>{const a=window.__duel.duel.a; a.y=1.6; a.vy=0;}")
        else: pose(pg, {'st': 'idle', 't': 0}, 12)
        pg.evaluate("window.__duel.api.setPose('a', %s)" % json.dumps({'st': 'atk', 'mk': mk, 't': 0}))
        if mk.startswith('air'): pg.evaluate("()=>{const a=window.__duel.duel.a; a.y=1.6; a.vy=0;}")
        tiles, cur = [], 0.0
        for lab, ph, u in frames:
            tt = at(ph, u); n = int(round((tt - cur) / (1 / 120)))
            keep = "S.duel.a.y=Math.max(S.duel.a.y,1.6);S.duel.a.vy=0;" if mk.startswith('air') else ""
            if n > 0: pg.evaluate("(()=>{const S=window.__duel; for(let i=0;i<%d;i++){S.duel.a.t=Math.min(%f, S.duel.a.t+1/120); %s S.api.advance(1/120,1);} })()" % (n, tt, keep))
            else: pg.evaluate("window.__duel.api.advance(1/120,1)")
            cur = tt
            f = os.path.join(OUT, '_f.png'); shot(pg, f); im = Image.open(f).convert('RGB'); os.remove(f)
            cw = int(w * 0.66); x0 = (w - cw) // 2; tile = im.crop((x0, int(h * 0.02), x0 + cw, int(h * 0.98)))
            d = ImageDraw.Draw(tile, 'RGBA'); d.rectangle((0, 0, cw, 30), fill=(6, 4, 18, 190)); d.text((8, 6), f'{lab}  {tt*1000:.0f} ms', fill=(220, 180, 255), font=font(15))
            tiles.append(tile)
        W = sum(t.width for t in tiles) + 6 * (len(tiles) - 1); out = Image.new('RGB', (W, tiles[0].height + 40), (8, 6, 20)); x = 0
        ImageDraw.Draw(out).text((10, 9), f'ANIME MAGE · {mk} · frame data {T} s (cast on the exact fire frame)', fill=(255, 255, 255), font=font(18))
        for t in tiles: out.paste(t, (x, 40)); x += t.width + 6
        path = os.path.join(OUT, f'mage-forms-{mk}.png'); out.save(path); print('wrote', path)
    check(not errs, f'forms: zero console errors {errs[:3]}')
    b.close()

def fight_shots(p):
    for (w, h, cls, stage, name) in [(412, 915, 'mage', 3, 'fight-mage-vs-sword-412x915.png'), (1280, 800, 'mage', 3, 'fight-mage-vs-sword-1280x800.png'), (412, 915, 'sword', 2, 'fight-sword-vs-mage-412x915.png')]:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx, pg, errs = boot(b, w, h)
        fight(pg, cls=cls, stage=stage, clean=False)
        pg.add_style_tag(content="#banner,.banner,.popup{display:none!important}")
        pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-1.2; d.b.x=1.0; window.__duel.cs=null;}")
        if cls == 'mage':   # mid-combo: a3 star orb in flight toward the Swordsman
            for i in range(120):
                pg.evaluate("window.__duel.api.advance(1/60, 1, %s)" % COMBO_JS)
                st = pg.evaluate("(()=>{const a=window.__duel.duel.a; return {st:a.st, mk:a.mk, t:a.t}})()")
                if st['mk'] == 'a3' and st['t'] >= 0.24: break
        else:   # the Mage (foe) casts a bolt while the Swordsman guards
            pg.evaluate("()=>{const d=window.__duel.duel; d.b.st='idle'; window.__duel.api.freezeFoe(true);}")
            pg.evaluate("()=>{const {act}=window.__duel; }")
            pg.evaluate("window.__duel.api.setPose('b', {st:'atk', mk:'a3', t:0})")
            for i in range(16): pg.evaluate("()=>{const S=window.__duel; S.duel.b.t=Math.min(0.26,S.duel.b.t); S.api.advance(1/60,1);}")
            st = pg.evaluate("window.__duel.api.rig()")
        path = os.path.join(OUT, name); shot(pg, path); print('wrote', path, st)
        r = pg.evaluate("window.__duel.api.rig()")
        check(r['a'] == 'anime' and r['b'] == 'anime', f'{name}: both fighters render anime ({r})')
        check(not errs, f'{name}: zero console errors {errs[:3]}')
        b.close()

PERF_JS = """() => {
  const S = window.__duel, api = S.api, { fa } = api.dbg(), d = S.duel, f = d.a, out = {};
  const run = (n, st, mk, T) => { for (let i = 0; i < n; i++) { f.st = st; f.mk = mk; f.t = T ? (i / 60) % T : i / 60; fa.update(f, 1 / 60, 100 + i / 60, 3, false, 0); fa.takeFx(); } };
  const T = (k) => { const m = f.C.moves[k]; return m.t[0] + m.t[1] + m.t[2]; };
  const all = () => { run(240, 'idle', null); for (const k of ['a1', 'a2', 'a3', 's1', 's2', 'ult']) run(120, 'atk', k, T(k)); run(120, 'block', null); };
  all(); all();
  const t0 = performance.now(); all(); out.updateMs = (performance.now() - t0) / 1080;
  if (window.gc) {
    const heap = (fn, n) => { window.gc(); window.gc(); const m0 = performance.memory.usedJSHeapSize; fn(); return Math.max(0, performance.memory.usedJSHeapSize - m0) / n; };
    out.heapBytesPerUpdate = heap(() => { all(); all(); }, 2160);
    out.heapBytesPerUpdateIdle = heap(() => run(1200, 'idle', null), 1200);
    out.heapBytesPerUpdateCombo = heap(() => { for (const k of ['a1', 'a2', 'a3']) run(400, 'atk', k, T(k)); }, 1200);
  }
  return out;
}"""
def perf(p):
    res = {}
    for style in ['neon', 'anime']:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx, pg, errs = boot(b, 412, 915, '?mute=1&style=%s' % style)
        fight(pg, stage=2)   # mage vs NEON ADEPT (mage): mirror
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
    check(c['drawn'] < 15000, f"anime Mage under 15k drawn triangles incl. outline (unique {c['unique']}, drawn {c['drawn']}, measured per fighter {a['perFighter']})")
    json.dump(res, open(os.path.join(OUT, 'mage-perf.json'), 'w'), indent=1); print('wrote mage-perf.json', a['perFighter'])

def video(p, w=412, h=915, seconds=5.6, fps=30):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    fight(pg, stage=3)
    pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-1.6; d.b.x=1.4; window.__duel.cs=null;}")
    fd = os.path.join(OUT, '_frames'); shutil.rmtree(fd, ignore_errors=True); os.makedirs(fd)
    n = int(seconds * fps); seen = set()
    for i in range(n):   # deterministic clock: exactly 1/30 s of game time per captured frame (2 sim sub-steps)
        pg.evaluate("window.__duel.api.advance(1/60, 2, %s)" % COMBO_JS)
        mk = pg.evaluate("window.__duel.duel.a.mk"); seen.add(mk)
        shot(pg, os.path.join(fd, '%04d.png' % i))
    mp4 = os.path.join(OUT, 'mage-combo.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(fd, '%04d.png'), '-vf', 'pad=412:916:0:0:black,setsar=1', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], check=True)
    shutil.rmtree(fd, ignore_errors=True)
    sz = os.path.getsize(mp4); print('wrote', mp4, sz, sorted(x for x in seen if x))
    check({'a1', 'a2', 'a3', 's2', 'ult'} <= seen, f'video shows combo + pillar + ult ({sorted(x for x in seen if x)})')
    check(50000 < sz < 8 * 1024 * 1024, f'video size {sz} bytes (< 8 MB)')
    check(not errs, f'video: zero console errors {errs[:3]}')
    b.close()

with sync_playwright() as p:
    if want('turnaround'): turnaround(p)
    if want('vsold'): vs_old(p)
    if want('card'): card(p)
    if want('forms'): forms_shots(p)
    if want('fight'): fight_shots(p)
    if want('perf'): perf(p)
    if want('video'): video(p)
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
