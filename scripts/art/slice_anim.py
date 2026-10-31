#!/usr/bin/env python3
"""Slice Cursor's AI action sheets (art-src/anim/<char>/*.png, flat magenta bg) into
game-ready sprite atlases: public/art/anim/<char>.png + data/anim/<char>.json.

- chroma-key the (not exactly #FF00FF) background using the border median colour
- split N frames (N from manifest) at the emptiest column near each 1/N boundary
- normalise scale ACROSS sheets by the area of a stable colour (hair / fur), because
  the generator drew every sheet at a slightly different size
- premultiplied downscale (no magenta fringe), alpha threshold, one shared palette
- feet on the bottom row, body centred, uniform cell size per character

Run: python3 scripts/art/slice_anim.py [art-root]   (ONLY=lobster,mirrorowl to re-slice some sets)
"""
import sys, json, os
import numpy as np
from scipy import ndimage
from PIL import Image

OUT = 'public/art/anim/'

# Character → (target standing height px, reference sheet, colour-key fn for scale, anims)
def hair_black(a):  # 倫寶's black hair + dark shoes
    mx = a.max(-1); mn = a.min(-1)
    return (mx < 70) & (mx - mn < 30)
def hair_brown(a):  # 琪寶寶's brown ponytail
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 70) & (r < 175) & (g > 35) & (g < 115) & (b < 70) & (r - b > 45) & (r > g)
def fur(a):  # 噗噗's golden fur
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 170) & (g > 110) & (b < 110) & (r - b > 90)

def fish_red(a):  # 紅魚 body
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 170) & (g < 140) & (b < 130) & (r - g > 70)
def wood(a):  # 帽仔兵 wooden body + straw hat
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 140) & (g > 90) & (g < 190) & (b < 100) & (r - b > 80)
def wood_dark(a):  # 機械豬 barrel staves
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 80) & (r < 170) & (g > 40) & (g < 110) & (b < 70) & (r - b > 50)

def bee_yellow(a):  # 蜜蜂 / 女王蜂 yellow stripes
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 200) & (g > 160) & (b < 110)
def squirrel_fur(a):  # 蜜僵松鼠 brown fur
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 110) & (r < 210) & (g > 55) & (g < 130) & (b < 80) & (r - b > 60)

def lobster_red(a):  # 龍蝦兵 shell
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 150) & (g < 90) & (b < 80) & (r - g > 80)
def fish_gold(a):  # 油甘魚攤主 yellow skin
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 150) & (g > 120) & (b < 90) & (r - b > 80)
def mirror_white(a):  # 鏡影雜兵 mask
    mx = a.max(-1).astype(int); mn = a.min(-1).astype(int)
    return (mn > 165) & (mx - mn < 50)
def owl_silver(a):  # 月橋鏡鴞 feathers
    mx = a.max(-1).astype(int); mn = a.min(-1).astype(int)
    return (mx > 120) & (mx - mn < 45)

# Output resolution multiplier per set (frames are drawn RES x bigger than the 640x360 logical
# size and shown at 1/RES by the engine: see heroAnims.markHd). Sets not listed stay 1x.
HD = {'lunbo': 2, 'kibobo': 2, 'pupu': 2}
# Logical cell size of the 1x sheets. HD cells are never smaller, so physics bodies (噗噗's body is its
# whole frame) and body offsets stay exactly what the 1x game was tuned with.
MIN_CELL = {'lunbo': (84, 81), 'kibobo': (90, 89), 'pupu': (58, 63)}
MAX_SHEET_W = 4096  # keep atlases within the smallest common GPU texture limit

CHARS = {
    'lunbo': dict(height=72, ref='walk', key=hair_black, anims={
        'idle': (6, True), 'walk': (10, True), 'jump': (8, False), 'crouch': (14, False), 'shoot': (16, False),
        'shoot-crouch': (16, False), 'hurt': (10, False), 'ko': (8, False), 'win': (6, True),
        'bike-ride': (12, True), 'bike-jump': (8, False)}),
    'kibobo': dict(height=72, ref='idle', key=hair_brown, anims={
        'idle': (6, True), 'run': (12, True), 'jump': (8, False), 'crouch': (14, False), 'slash1': (18, False),
        'slash2': (18, False), 'slash3': (18, False), 'fan-glide': (8, True), 'hurt': (10, False), 'ko': (8, False), 'win': (6, True),
        'bike-ride': (12, True), 'bike-jump': (8, False), 'fan-float': (8, True)}, keep_largest=['fan-float']),
    'pupu': dict(height=56, ref='idle', key=fur, fit_height=['hollow-idle', 'wake-up'], anims={
        'idle': (6, True), 'walk': (10, True), 'cute-pose': (6, False), 'tackle': (14, False),
        'hollow-idle': (4, True), 'wake-up': (6, False)}),
    # Enemies (art-src/anim/enemies/<dir>). `flip`: sheets the generator drew facing LEFT.
    'fish': dict(height=40, ref='walk', key=fish_red, ref_scale=['die'], dir='enemies/E-01-fish', anims={
        'walk': (8, True), 'charge': (10, False), 'dash': (14, True), 'dizzy': (8, True), 'hit': (12, False), 'die': (10, False)}),
    'hatsoldier': dict(height=56, ref='walk', key=wood, ref_scale=['die'], dir='enemies/E-03-hatsoldier', anims={
        'walk': (8, True), 'throw-low': (12, False), 'throw-high': (12, False), 'hit': (12, False), 'die': (10, False)}),
    'mechpig': dict(height=64, ref='walk', key=wood_dark, ref_scale=['die'], dir='enemies/E-02-mechpig', flip=['walk', 'windup', 'die'], anims={
        'walk': (7, True), 'windup': (8, False), 'lunge': (14, True), 'opening': (8, True), 'block': (14, False), 'die': (10, False)}),
    # Stage 2 (art/stage2)
    'beesoldier': dict(height=40, ref='fly', key=bee_yellow, dir='enemies/E-05-beesoldier', ref_scale=['die'], keep_largest=['dive', 'aim'], anims={
        'fly': (10, True), 'aim': (10, False), 'dive': (14, True), 'stuck': (8, True), 'hit': (12, False), 'die': (10, False)}),
    'squirrel': dict(height=44, ref='walk', key=squirrel_fur, dir='enemies/E-06-zombiesquirrel', ref_scale=['die'], anims={
        'walk': (5, True), 'lunge': (12, False), 'hit': (12, False), 'die': (8, False)}),
    'minibee': dict(height=20, ref='fly', key=bee_yellow, dir='enemies/E-07-minibee', ref_scale=['die'], anims={
        'fly': (14, True), 'die': (10, False)}),
    'egg': dict(height=22, ref='idle', key=bee_yellow, dir='enemies/egg', ref_scale=['hatch', 'break'], anims={
        'idle': (4, True), 'hatch': (8, False), 'break': (12, False)}),
    'queen': dict(height=128, ref='hover', key=bee_yellow, dir='boss/queen-bee', ref_scale=['defeat'], anims={
        'hover': (8, True), 'summon': (8, False), 'land': (8, False), 'lay-eggs': (8, False), 'spray': (10, True),
        'weak': (6, True), 'hurt': (12, False), 'defeat': (6, False)}),
    # Stage 3 (batch M). `src`: anim → (sheet, frames on it, picked frame indices, (row, rows) band).
    # Cursor shipped a few combined sheets (duck+hit+die on one row, 3 owl actions on 3 rows).
    'lobster': dict(height=56, ref='walk', key=lobster_red, dir='enemies/E-08-lobsterguard', ref_scale=['die', 'turn'], anims={
        'walk': (6, True), 'block': (8, False), 'turn': (8, True), 'hit': (12, False), 'die': (10, False)}),
    'stallkeeper': dict(height=56, ref='idle', key=fish_gold, dir='enemies/E-09-stallkeeper', clip=(0.7, 3.2), scale_as={'die': 'hit'}, anims={
        'idle': (6, True), 'throw': (12, False), 'duck': (8, False), 'hit': (12, False), 'die': (10, False)},
        src={'duck': ('duck-hit-die-sheet', 8, [0, 1], None), 'hit': ('duck-hit-die-sheet', 8, [2, 3], None),
             'die': ('duck-hit-die-sheet', 8, [4, 5, 6, 7], None)}),
    'mirrorshade': dict(height=48, ref='float', key=mirror_white, dir='enemies/E-10-mirrorshade', clip=(0.7, 3.2), scale_as={'die': 'hit'}, fit_height=['hit'], anims={
        'float': (8, True), 'dash': (12, True), 'split': (10, False), 'hit': (12, False), 'die': (10, False)},
        src={'hit': ('hit-die-sheet', 11, [4, 5], None), 'die': ('hit-die-sheet', 11, [6, 7, 8, 9], None)}),
    'mirrorowl': dict(height=112, ref='perch', key=owl_silver, dir='boss/mirror-owl', ref_scale=['defeat', 'hurt'], clip=(0.7, 3.2), keep_largest=['guard', 'feather-curtain', 'split'], anims={
        'perch': (6, True), 'fly': (10, True), 'feather-curtain': (8, False), 'split': (8, False), 'guard': (6, True),
        'hurt': (12, False), 'defeat': (6, False)},
        src={'feather-curtain': ('feather-curtain', 4, None, (0, 3)), 'split': ('feather-curtain', 4, None, (1, 3)),
             'guard': ('feather-curtain', 3, None, (2, 3)), 'hurt': ('hurt', 3, [1, 2], None)}),
}

def fg_mask(a):
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    d = np.sqrt(((a.astype(float) - bg) ** 2).sum(-1))
    fg = d > 70
    # magenta fringe: strongly red+blue, little green — only where it touches the background,
    # so red / pink bodies (紅魚) don't get holes punched in them.
    spill = (a[..., 1] < 40) & (a[..., 0] > 140) & (a[..., 2] > 60)
    near_bg = ndimage.binary_dilation(~fg, iterations=2)
    fg = fg & ~(spill & near_bg)
    # fill interior holes (dark-red bodies sit close to the crimson background colour),
    # but keep real enclosed background gaps (between an arm and the body) transparent
    holes = ndimage.binary_fill_holes(fg) & ~fg
    return fg | (holes & (d > 30))

def split(mask, n):
    h, w = mask.shape
    col = mask.sum(0)
    cuts = [0]
    for k in range(1, n):
        c = int(k * w / n); r = int(w / n / 3)
        lo, hi = max(1, c - r), min(w - 1, c + r)
        cuts.append(lo + int(np.argmin(col[lo:hi])))
    cuts.append(w)
    return [(cuts[i], cuts[i + 1]) for i in range(n)]

def largest_blob_bbox(m):
    ys, xs = np.where(m)
    if not len(ys): return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def row_band(m, row, rows):
    """(y0, y1) of the row-th of `rows` figure rows, cut at the widest empty-row gaps."""
    r = m.sum(1) > 2
    ys = np.where(r)[0]
    gaps, run = [], None
    for y in range(ys.min(), ys.max() + 1):
        if not r[y]:
            run = run or [y, y]; run[1] = y
        elif run:
            gaps.append((run[1] - run[0] + 1, run[0], run[1])); run = None
    gaps = sorted(sorted(gaps, reverse=True)[: rows - 1], key=lambda g: g[1])
    edges = [ys.min()] + [(g[1] + g[2]) // 2 for g in gaps] + [ys.max() + 1]
    return edges[row], edges[row + 1]

def frames_of(path, n, keep_largest=False, band=None):
    a = np.array(Image.open(path).convert('RGB'))
    m = fg_mask(a)
    if band:
        y0, y1 = row_band(m, *band)
        a, m = a[y0:y1], m[y0:y1]
    out = []
    for (x0, x1) in split(m, n):
        sm = m[:, x0:x1]
        if keep_largest:
            # only the character's own blob: drops stray labels / separate props in the cell
            lab, k = ndimage.label(ndimage.binary_closing(sm, iterations=2))
            if k > 1:
                sizes = ndimage.sum(sm, lab, range(1, k + 1))
                sm = sm & (lab == int(np.argmax(sizes)) + 1)
        # drop specks (noise / stray sparkles far from the body)
        colsum = sm.sum(0); rowsum = sm.sum(1)
        bb = largest_blob_bbox(sm & (rowsum[:, None] > 0) & (colsum[None, :] > 1))
        if bb is None: continue
        bx0, by0, bx1, by1 = bb
        out.append((a[by0:by1, x0 + bx0:x0 + bx1], sm[by0:by1, bx0:bx1]))
    return out

def downscale(rgb, m, s, soft=False):
    h, w = m.shape
    W, H = max(1, round(w * s)), max(1, round(h * s))
    mf = m.astype(np.float32)
    pre = Image.fromarray((rgb * mf[..., None]).astype(np.uint8))
    A = np.array(Image.fromarray((mf * 255).astype(np.uint8)).resize((W, H), Image.BOX)).astype(np.float32) / 255
    P = np.array(pre.resize((W, H), Image.BOX)).astype(np.float32)
    C = np.where(A[..., None] > 0.01, P / np.maximum(A[..., None], 1e-3), 0).clip(0, 255).astype(np.uint8)
    return C, (A if soft else (A > 0.5).astype(np.float32))

def main():
    ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(OUT, exist_ok=True)
    os.makedirs('data/anim', exist_ok=True)
    MAN = {m['file']: m for m in json.load(open(os.path.join(ROOT, 'art-src/anim/manifest.json')))}
    report = {}
    only = [x for x in os.environ.get('ONLY', '').split(',') if x]
    for ch, cfg in CHARS.items():
        if only and ch not in only: continue
        sheets = {}
        for anim in cfg['anims']:
            spec = cfg.get('src', {}).get(anim)
            rel = f"art-src/anim/{cfg.get('dir', ch)}/{spec[0] if spec else anim}.png"
            if rel not in MAN or not os.path.exists(os.path.join(ROOT, rel)): continue
            n = spec[1] if spec else MAN[rel]['frames']
            frs = frames_of(os.path.join(ROOT, rel), n, anim in cfg.get('keep_largest', []), spec[3] if spec else None)
            if spec and spec[2]: frs = [frs[i] for i in spec[2] if i < len(frs)]
            if anim in cfg.get('flip', []):
                frs = [(rgb[:, ::-1], m[:, ::-1]) for rgb, m in frs]
            sheets[anim] = frs
        # scale reference: standing sheet height → target height
        res = HD.get(ch, 1)
        cfg = dict(cfg, height=cfg['height'] * res)
        ref = sheets[cfg['ref']]
        ref_h = np.median([f[1].shape[0] for f in ref])
        ref_scale = cfg['height'] / ref_h
        ref_key = np.median([cfg['key'](f[0])[f[1]].sum() for f in ref])
        scaled = {}
        scales = {}
        lo, hi = cfg.get('clip', (0.7, 1.7))
        for anim, frs in sorted(sheets.items(), key=lambda kv: kv[0] in cfg.get('scale_as', {})):
            if anim in cfg.get('scale_as', {}):
                # same combined sheet as another anim: reuse its scale (debris frames fool the key)
                s = scales[cfg['scale_as'][anim]]
            elif anim in cfg.get('ref_scale', []):
                # debris / smoke frames confuse both cues: just reuse the reference scale
                s = ref_scale
            elif anim in cfg.get('fit_height', []):
                # colour key can't see this sheet (e.g. grey 噗噗): fit standing height instead
                s = cfg['height'] / float(np.median([f[1].shape[0] for f in frs]))
            else:
                k = np.median([max(1, cfg['key'](f[0])[f[1]].sum()) for f in frs])
                s = ref_scale * float(np.sqrt(ref_key / k))
            # guard against a bad key read: stay within 0.7–1.7× of the reference scale
            s = float(np.clip(s, ref_scale * lo, ref_scale * hi))
            scales[anim] = s
            scaled[anim] = [downscale(rgb, m, s, res > 1) for rgb, m in frs]
            report[f'{ch}/{anim}'] = round(s / ref_scale, 3)
        # anchor: x = median of foreground in the lower 45 % (legs), y = bottom
        items = []
        for anim, frs in [(k, scaled[k]) for k in cfg['anims'] if k in scaled]:
            for C, A in frs:
                h, w = A.shape
                ys, xs = np.where(A[int(h * 0.55):] > 0.5)
                ax = int(np.median(xs)) if len(xs) else w // 2
                items.append((anim, C, A, ax))
        # symmetric cell so the game can keep origin (0.5, 1) and the foot body centred
        half = max(max(ax for _, _, _, ax in items), max(A.shape[1] - ax for _, _, A, ax in items)) + 2
        left = half
        cw = half * 2; chh = max(A.shape[0] for _, _, A, _ in items) + 2
        if ch in MIN_CELL and res > 1:
            cw = max(cw, MIN_CELL[ch][0] * res); chh = max(chh, MIN_CELL[ch][1] * res)
        chh += -chh % res  # logical (cell / res) size must stay integral
        cw += -cw % res
        left = cw // 2
        cols = max(1, min(len(items), MAX_SHEET_W // cw)) if res > 1 else len(items)
        rows = -(-len(items) // cols)
        sheet = Image.new('RGBA', (cw * cols, chh * rows), (0, 0, 0, 0))
        anims = {}; i = 0
        for anim, C, A, ax in items:
            h, w = A.shape
            rgba = np.dstack([C, (A * 255).round().astype(np.uint8)])
            tile = Image.fromarray(rgba, 'RGBA')
            sheet.paste(tile, ((i % cols) * cw + left - ax, (i // cols) * chh + chh - 1 - h))
            anims.setdefault(anim, {'start': i, 'count': 0})
            anims[anim]['count'] += 1; i += 1
        # one shared palette for the character (keeps frames from flickering colour)
        alpha = sheet.split()[3]
        q = sheet.convert('RGB').quantize(colors=48 * res, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        q.putalpha(alpha if res > 1 else alpha.point(lambda v: 255 if v > 127 else 0))
        q.save(OUT + f'{ch}.png')
        for anim, (fps, loop) in cfg['anims'].items():
            if anim in anims: anims[anim].update(fps=fps, loop=loop)
        meta = {'frameWidth': cw, 'frameHeight': chh, 'anchorX': left, 'anims': anims}
        if res > 1: meta.update(res=res, columns=cols)
        json.dump(meta, open('data/anim/' + f'{ch}.json', 'w'), indent=1)
        print(ch, 'cell', cw, chh, 'frames', i)
    print('scale vs ref', report)

if __name__ == '__main__':
    main()
