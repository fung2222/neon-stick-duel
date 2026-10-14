"""Anime KAGE-SHŌGUN (HANDOFF §16 steps 2–4): turnaround, phase card, fight still, combo clip (headless Chrome,
deterministic clock via window.__duel.api.advance — 1/60 s sim steps, one captured frame per 1/30 s of game time).
Usage: python tests/anime_shogun_shots.py [base_url] [out_dir] [--only turnaround,card,fight,video,perf]
Writes to out_dir (default /workspace/shots/duel-boss):
  shogun-turnaround.png          full body idle: front, 3/4, side, back (+ triangle counts; asserts < 15k drawn)
  shogun-phase-card.png          phase 1 「秩序」 seigan + calm mask | phase 2 「崩壞」 jōdan + cracked mask + data-blade fan
  shogun-vs-sword-412x915.png    fight 10 in-fight still (HUD on): player Swordsman vs real shogun body
  shogun-combo.mp4               ~8 s 412×915 (+1 black row → 412×916), H.264 High yuv420p: Iai (dodge on flash) →
                                 Lunge crosses 50 % → transition (mask crack, blades unfold) → Glitch Step guarded →
                                 Data-Blade Rain (stand in a gap). Frame count asserted; under 8 MB.
  shogun-perf.json               draw calls / triangles for the boss at ladder scale 1.34
Only one shot script may write to the shots folder at a time. Zero console errors is asserted.
"""
import sys, os, time, json, subprocess, shutil
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

_a = sys.argv[1:]; ONLY = None
if '--only' in _a: i = _a.index('--only'); ONLY = set(_a[i + 1].split(',')); del _a[i:i + 2]
BASE = _a[0] if len(_a) > 0 else 'http://127.0.0.1:8862/'
OUT = _a[1] if len(_a) > 1 else '/workspace/shots/duel-boss'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
        '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info']
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

CLEAN = "#hud,#controls,#banner,.banner,.popup,#combo,#ult-cut,#ult-dim,.controls-hint,#demo-tag,#loading,#boss-call{display:none!important}"

# same director as boss_shots.py — phase 1 Iai → dodge → cross 50 % → transition → Glitch → Rain gap
DIRECTOR = """(S) => {
  const d = S.duel, a = d.a, b = d.b, api = S.api, M = b.C.moves; const c = S.dir || (S.dir = { t: 0, i: 0, mark: {} }); c.t += 1/60;
  const at = (k) => { if (c.mark[k] == null) c.mark[k] = c.t; return c.t - c.mark[k]; };
  a.in.guard = false; a.in.mx = 0;
  switch (c.i) {
    case 0: if (c.t > 0.3) { api.foeCmd('bm:iai'); c.i++; } break;
    case 1: if (b.mk === 'iai' && b.t >= M.iai.flash + 2/60) { a.in.mx = -1; api.cmd('dodge'); c.i++; } break;
    case 2: if (b.st !== 'atk' && at('wait1') > 0.2) c.i++; break;
    case 3: { const gap = b.x - a.x; if (gap > 3.0) a.in.mx = 1; else { b.hp = Math.round(b.maxHp * 0.5) + 40; a.cd.s1 = 0; api.cmd('s1'); c.i++; } break; }
    case 4: if (b.st === 'phase') c.i++; break;
    case 5: if (b.st !== 'phase' && at('p2') > 0.15) { api.foeCmd('bm:glitch'); c.i++; } break;
    case 6: a.in.guard = true; if (b.mk !== 'glitch' && at('g') > 0.2) { c.i++; } break;
    case 7: a.in.guard = b.st === 'atk'; if (at('g2') > 0.15 && b.st !== 'atk') { if (Math.abs(b.x - a.x) < 2.2) { b.x = Math.max(-7, Math.min(7, a.x + Math.sign(b.x - a.x || 1) * 2.6)); b.facing = Math.sign(a.x - b.x); } api.foeCmd('bm:rain'); c.i++; } break;
    case 8: { const bl = d.projs.filter((p) => p.key === 'dblade' && !p.dead); if (!bl.length) break;
      if (c.gx == null) { const xs = bl.map((p) => p.x).sort((x, y) => x - y), mids = xs.slice(1).map((x, i) => (x + xs[i]) / 2); c.gx = mids.reduce((m, x) => (Math.abs(x - a.x) < Math.abs(m - a.x) ? x : m)); }
      a.in.mx = Math.abs(c.gx - a.x) > 0.08 ? Math.sign(c.gx - a.x) : 0; break; }
  }
  S.padOv = { mx: a.in.mx, guard: a.in.guard };
  c.frame = (c.frame || 0) + 1;
}"""

def boot(b, w, h, lang='en'):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=w < 600)
    ctx.add_init_script("try{localStorage.setItem('cyber.lang','%s')}catch(e){}" % lang)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(BASE + '?mute=1')
    t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("!!(window.__duel && window.__duel.state==='menu' && window.__duel.duel)"): time.sleep(0.2)
    return ctx, pg, errs

def fight10(pg, clean=True):
    pg.evaluate("(()=>{const S=window.__duel, api=S.api; api.startMode('ladder', {cls:'sword', stage:9}); api.manual(true); api.freezeFoe(true); S.acc=0;})()")
    pg.evaluate("window.__duel.api.advance(1/30, 120)")
    if clean: pg.add_style_tag(content=CLEAN)
    else: pg.add_style_tag(content="#loading{display:none!important}")
    info = pg.evaluate("""(()=>{const d=window.__duel.duel, fb=window.__duel.api.dbg().fb, cur=fb.cur; d.time=90; d.a.x=-1.9; d.b.x=1.7; d.a.facing=1; d.b.facing=-1;
      d.a.hp=d.a.maxHp; d.b.hp=d.b.maxHp; window.__duel.dir=null;
      return {foe: window.__duel.foe.en, cls: d.b.cls, rig: window.__duel.api.rig().b, scale: d.b.scale,
        build: cur && cur.char && cur.char.build, interim: !!(cur && cur.cfg && cur.cfg.interim), blades: !!fb.hasDataBlades};})()""")
    return info

def shot(pg, path): pg.screenshot(path=path, timeout=180000)
def adv(pg, n, dt=1/30): pg.evaluate("window.__duel.api.advance(%f, %d)" % (dt, n))
def pose_b(pg, spec, settle=24):
    pg.evaluate("()=>{const a=window.__duel.api; a.hold(true); const d=window.__duel.duel; d.a.x=-2.4; d.b.x=0.2; d.a.facing=1; d.b.facing=-1;}")
    pg.evaluate("window.__duel.api.setPose('b', %s)" % json.dumps(spec))
    adv(pg, settle)

VIEWS = {'front': (6.0, 0.0), '3/4': (4.24, 4.24), 'side': (0.0, 6.0), 'back': (-6.0, 0.0)}

def turnaround(p, w=420, h=840):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    info = fight10(pg); check(info['cls'] == 'shogun' and info['rig'] == 'anime' and info['build'] == 'shogun' and not info['interim'], f'turnaround: real shogun body ({info})')
    pg.evaluate("window.__duel.api.dbg().fa.visible=false")
    st = pg.evaluate("window.__duel.api.charStats().b")
    tiles = []
    for v in ['front', '3/4', 'side', 'back']:
        dx, dz = VIEWS[v]
        pg.evaluate("window.__duel.api.cam({fov:30,pos:[%f,1.55,%f],look:[0.2,1.35,0]})" % (0.2 + dx, dz + 1e-4))
        pose_b(pg, {'st': 'idle', 't': 0, 'phase': 1}, 36)
        f = os.path.join(OUT, '_b.png'); shot(pg, f); im = Image.open(f).convert('RGB'); os.remove(f)
        d = ImageDraw.Draw(im, 'RGBA'); d.rectangle((0, 0, w, 34), fill=(6, 4, 18, 200)); d.text((10, 8), v, fill=(255, 120, 140), font=font(17))
        tiles.append(im)
    leak = pg.evaluate("""() => { const { fb } = window.__duel.api.dbg(), bad = []; for (const r of [fb.classic, fb.hq]) if (r && r.group) r.group.traverse((o) => { if (o.isMesh && o.visible && r.group.visible) bad.push(o.name || o.type); }); return { rig: fb.rig, bad, build: fb.cur && fb.cur.char && fb.cur.char.build }; }""")
    check(leak['rig'] == 'anime' and leak['build'] == 'shogun' and not leak['bad'], f"turnaround: no stick / classic / interim ({leak})")
    tw, th = tiles[0].size; out = Image.new('RGB', (tw * 4 + 18, th + 46), (8, 6, 20)); d = ImageDraw.Draw(out)
    d.text((12, 12), f"塔主・零 KAGE-SHŌGUN · ō-yoroi · turnaround · {st['unique']} unique tris, {st['drawn']} drawn incl. outline, {st['calls']} calls", fill=(255, 255, 255), font=font(16, True))
    for i, t in enumerate(tiles): out.paste(t, (i * (tw + 6), 46))
    path = os.path.join(OUT, 'shogun-turnaround.png'); out.save(path); print('wrote', path, st)
    check(st['drawn'] < 15000, f"shogun: {st['unique']} unique / {st['drawn']} drawn triangles (< 15k incl. outline)")
    check(not errs, f'turnaround: zero console errors {errs[:3]}')
    b.close()

def phase_card(p, w=640, h=800):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    info = fight10(pg); check(info['build'] == 'shogun' and info['blades'], f'phase-card: real body + data blades ({info})')
    pg.evaluate("window.__duel.api.dbg().fa.visible=false")
    tiles = []
    for phase, lab, spec in [
        (1, 'Ⅰ 秩序 ORDER · seigan · calm cyan mask', {'st': 'idle', 't': 0.4, 'phase': 1}),
        (2, 'Ⅱ 崩壞 COLLAPSE · jōdan · cracked red mask · data blades', {'st': 'idle', 't': 0.4, 'phase': 2}),
    ]:
        pg.evaluate("window.__duel.api.cam({fov:32,pos:[2.6,1.7,5.2],look:[0.2,1.35,0]})")
        # force phase look through the sim so mask + blades update
        pg.evaluate("""(ph) => { const d = window.__duel.duel, b = d.b; b.phase = ph; b.phaseN = ph >= 2 ? 1 : 0;
          if (ph >= 2) { b.hp = Math.floor(b.maxHp * 0.4); window.__duel.api.dbg().fb.setPhaseLook(2); }
          else { b.hp = b.maxHp; window.__duel.api.dbg().fb.setPhaseLook(1); } }""", phase)
        pose_b(pg, spec, 50)
        f = os.path.join(OUT, '_c.png'); shot(pg, f); im = Image.open(f).convert('RGB'); os.remove(f)
        # crop to the boss
        cw, ch = int(w * 0.62), int(h * 0.92); x0 = int(w * 0.16); y0 = int(h * 0.02)
        tile = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((int(cw * 0.95), int(ch * 0.95)))
        d = ImageDraw.Draw(tile, 'RGBA'); d.rectangle((0, 0, tile.width, 36), fill=(6, 4, 18, 210)); d.text((10, 8), lab, fill=(255, 140, 160) if phase == 2 else (120, 230, 255), font=font(15, True))
        tiles.append(tile)
    tw, th = tiles[0].size; out = Image.new('RGB', (tw * 2 + 24, th + 50), (8, 6, 20)); d = ImageDraw.Draw(out)
    d.text((12, 12), '塔主・零 TOWER LORD ZERO · phase 1 秩序 vs phase 2 崩壞', fill=(255, 255, 255), font=font(18, True))
    for i, t in enumerate(tiles): out.paste(t, (12 + i * (tw + 12), 46))
    path = os.path.join(OUT, 'shogun-phase-card.png'); out.save(path); print('wrote', path)
    check(not errs, f'phase-card: zero console errors {errs[:3]}')
    b.close()

def fight_still(p, w=412, h=915):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    info = fight10(pg, clean=False); check(info['build'] == 'shogun' and not info['interim'], f'fight: real shogun ({info})')
    pg.add_style_tag(content="#banner,.banner,.popup,#loading{display:none!important}")
    pg.evaluate("()=>{const d=window.__duel.duel; d.a.x=-1.6; d.b.x=1.4; d.a.facing=1; d.b.facing=-1;}")
    # mid Iai coil (readable nodachi + kabuto at phone size)
    pg.evaluate("window.__duel.api.setPose('b', {st:'atk', mk:'iai', t:0.35, phase:1})")
    adv(pg, 8)
    path = os.path.join(OUT, 'shogun-vs-sword-412x915.png'); shot(pg, path); print('wrote', path)
    r = pg.evaluate("window.__duel.api.rig()"); check(r['a'] == 'anime' and r['b'] == 'anime', f'fight: both anime ({r})')
    check(not errs, f'fight: zero console errors {errs[:3]}')
    b.close()

def video(p, w=412, h=915, seconds=8.0, fps=30):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, w, h)
    info = fight10(pg, clean=False); check(info['build'] == 'shogun' and info['blades'], f'video: real shogun + blades ({info})')
    pg.add_style_tag(content="#loading{display:none!important}")
    pg.evaluate("()=>{const d=window.__duel.duel; d.time=90; d.a.x=-1.9; d.b.x=1.7; d.a.facing=1; d.b.facing=-1; d.a.hp=d.a.maxHp; d.b.hp=d.b.maxHp; window.__duel.dir=null;}")
    adv(pg, 6)
    fd = os.path.join(OUT, '_frames'); shutil.rmtree(fd, ignore_errors=True); os.makedirs(fd)
    n = int(seconds * fps); log = []; shots = {}
    for i in range(n):
        pg.evaluate("window.__duel.api.advance(1/60, 2, %s)" % DIRECTOR)
        st = pg.evaluate("""(()=>{const S=window.__duel, b=S.duel.b, a=S.duel.a; return {i:S.dir&&S.dir.i, mk:b.mk, st:b.st, t:b.t, ph:b.phase,
          blades:S.duel.projs.filter(p=>p.key==='dblade').length, falling:S.duel.projs.filter(p=>p.key==='dblade'&&p.delay>0&&p.delay<0.22).length,
          decoys:S.duel.projs.filter(p=>p.key==='decoy').length, flash:b.C.moves.iai.flash};})()""")
        log.append(st)
        f = os.path.join(fd, '%04d.png' % i); shot(pg, f)
        if 'phase1' not in shots and st['mk'] == 'iai' and st['t'] >= st['flash'] + 0.03: shots['phase1'] = f
        if 'transition' not in shots and st['st'] == 'phase' and st['t'] >= 0.3: shots['transition'] = f
        if 'phase2' not in shots and st['blades'] >= 4 and st['falling'] >= 1: shots['phase2'] = f
    mp4 = os.path.join(OUT, 'shogun-combo.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(fd, '%04d.png'),
                    '-vf', 'pad=412:916:0:0:black,setsar=1', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                    '-crf', '22', '-movflags', '+faststart', mp4], check=True)
    nf = int(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0',
                             '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', mp4], capture_output=True, text=True).stdout.strip() or 0)
    check(nf == n, f'video: {nf} encoded frames == {n} captured')
    if not os.environ.get('KEEP_FRAMES'): shutil.rmtree(fd, ignore_errors=True)
    sz = os.path.getsize(mp4); mks = sorted({s['mk'] for s in log if s['mk']}); print('wrote', mp4, sz, mks, 'stills', sorted(shots))
    check({'iai', 'glitch', 'rain'} <= set(mks) and any(s['st'] == 'phase' for s in log), f'clip shows phase-1 + transition + phase-2 ({mks})')
    check(max(s['decoys'] for s in log) == 2, 'Glitch Step decoys on screen')
    check(50000 < sz < 8 * 1024 * 1024, f'video size {sz} bytes (< 8 MB)')
    check(not errs, f'video: zero console errors {errs[:3]}')
    b.close()

def perf(p):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx, pg, errs = boot(b, 412, 915)
    info = fight10(pg); check(info['build'] == 'shogun', f'perf: real shogun ({info})')
    pose_b(pg, {'st': 'idle', 't': 0, 'phase': 2}, 20)
    r = {'info': info, 'rig': pg.evaluate("window.__duel.api.rig()"), 'scene': pg.evaluate("window.__duel.api.renderInfo()"),
         'chars': pg.evaluate("window.__duel.api.charStats()")}
    pg.evaluate("window.__duel.api.dbg().fa.visible=false"); r['sceneBossOnly'] = pg.evaluate("window.__duel.api.renderInfo()")
    pg.evaluate("window.__duel.api.dbg().fb.visible=false"); r['sceneEmpty'] = pg.evaluate("window.__duel.api.renderInfo()")
    pg.evaluate("window.__duel.api.dbg().fa.visible=true; window.__duel.api.dbg().fb.visible=true")
    c = r['chars']['b']
    r['perBoss'] = {'calls': r['sceneBossOnly']['calls'] - r['sceneEmpty']['calls'],
                    'triangles': r['sceneBossOnly']['triangles'] - r['sceneEmpty']['triangles']}
    check(c['drawn'] < 15000, f"perf: under 15k drawn ({c})")
    path = os.path.join(OUT, 'shogun-perf.json'); json.dump(r, open(path, 'w'), indent=1); print('wrote', path, c, r['perBoss'])
    check(not errs, f'perf: zero console errors {errs[:3]}')
    b.close()

with sync_playwright() as p:
    if want('turnaround'): turnaround(p)
    if want('card'): phase_card(p)
    if want('fight'): fight_still(p)
    if want('perf'): perf(p)
    if want('video'): video(p)
print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)
