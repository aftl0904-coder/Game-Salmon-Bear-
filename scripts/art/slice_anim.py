#!/usr/bin/env python3
"""Slice Cursor's AI action sheets (art-src/anim/<char>/*.png, flat magenta bg) into
game-ready sprite atlases: public/art/anim/<char>.png + data/anim/<char>.json.

- chroma-key the (not exactly #FF00FF) background using the border median colour
- split N frames (N from manifest) at the emptiest column near each 1/N boundary
- normalise scale ACROSS sheets by the area of a stable colour (hair / fur), because
  the generator drew every sheet at a slightly different size
- premultiplied downscale (no magenta fringe), alpha threshold, one shared palette
- feet on the bottom row, body centred, uniform cell size per character

Run: python3 scripts/art/slice_anim.py [art-root]
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

CHARS = {
    'lunbo': dict(height=72, ref='walk', key=hair_black, anims={
        'idle': (6, True), 'walk': (10, True), 'jump': (8, False), 'crouch': (14, False), 'shoot': (16, False),
        'shoot-crouch': (16, False), 'hurt': (10, False), 'ko': (8, False), 'win': (6, True)}),
    'kibobo': dict(height=72, ref='idle', key=hair_brown, anims={
        'idle': (6, True), 'run': (12, True), 'jump': (8, False), 'crouch': (14, False), 'slash1': (18, False),
        'slash2': (18, False), 'slash3': (18, False), 'fan-glide': (8, True), 'hurt': (10, False), 'ko': (8, False), 'win': (6, True)}),
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

def frames_of(path, n):
    a = np.array(Image.open(path).convert('RGB'))
    m = fg_mask(a)
    out = []
    for (x0, x1) in split(m, n):
        sm = m[:, x0:x1]
        # drop specks (noise / stray sparkles far from the body)
        colsum = sm.sum(0); rowsum = sm.sum(1)
        bb = largest_blob_bbox(sm & (rowsum[:, None] > 0) & (colsum[None, :] > 1))
        if bb is None: continue
        bx0, by0, bx1, by1 = bb
        out.append((a[by0:by1, x0 + bx0:x0 + bx1], sm[by0:by1, bx0:bx1]))
    return out

def downscale(rgb, m, s):
    h, w = m.shape
    W, H = max(1, round(w * s)), max(1, round(h * s))
    mf = m.astype(np.float32)
    pre = Image.fromarray((rgb * mf[..., None]).astype(np.uint8))
    A = np.array(Image.fromarray((mf * 255).astype(np.uint8)).resize((W, H), Image.BOX)).astype(np.float32) / 255
    P = np.array(pre.resize((W, H), Image.BOX)).astype(np.float32)
    C = np.where(A[..., None] > 0.01, P / np.maximum(A[..., None], 1e-3), 0).clip(0, 255).astype(np.uint8)
    return C, A > 0.5

def main():
    ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(OUT, exist_ok=True)
    os.makedirs('data/anim', exist_ok=True)
    MAN = {m['file']: m for m in json.load(open(os.path.join(ROOT, 'art-src/anim/manifest.json')))}
    report = {}
    for ch, cfg in CHARS.items():
        sheets = {}
        for anim in cfg['anims']:
            rel = f"art-src/anim/{cfg.get('dir', ch)}/{anim}.png"
            if rel not in MAN or not os.path.exists(os.path.join(ROOT, rel)): continue
            frs = frames_of(os.path.join(ROOT, rel), MAN[rel]['frames'])
            if anim in cfg.get('flip', []):
                frs = [(rgb[:, ::-1], m[:, ::-1]) for rgb, m in frs]
            sheets[anim] = frs
        # scale reference: standing sheet height → target height
        ref = sheets[cfg['ref']]
        ref_h = np.median([f[1].shape[0] for f in ref])
        ref_scale = cfg['height'] / ref_h
        ref_key = np.median([cfg['key'](f[0])[f[1]].sum() for f in ref])
        scaled = {}
        for anim, frs in sheets.items():
            if anim in cfg.get('ref_scale', []):
                # debris / smoke frames confuse both cues: just reuse the reference scale
                s = ref_scale
            elif anim in cfg.get('fit_height', []):
                # colour key can't see this sheet (e.g. grey 噗噗): fit standing height instead
                s = cfg['height'] / float(np.median([f[1].shape[0] for f in frs]))
            else:
                k = np.median([max(1, cfg['key'](f[0])[f[1]].sum()) for f in frs])
                s = ref_scale * float(np.sqrt(ref_key / k))
            # guard against a bad key read: stay within 0.7–1.7× of the reference scale
            s = float(np.clip(s, ref_scale * 0.7, ref_scale * 1.7))
            scaled[anim] = [downscale(rgb, m, s) for rgb, m in frs]
            report[f'{ch}/{anim}'] = round(s / ref_scale, 3)
        # anchor: x = median of foreground in the lower 45 % (legs), y = bottom
        items = []
        for anim, frs in scaled.items():
            for C, A in frs:
                h, w = A.shape
                ys, xs = np.where(A[int(h * 0.55):])
                ax = int(np.median(xs)) if len(xs) else w // 2
                items.append((anim, C, A, ax))
        # symmetric cell so the game can keep origin (0.5, 1) and the foot body centred
        half = max(max(ax for _, _, _, ax in items), max(A.shape[1] - ax for _, _, A, ax in items)) + 2
        left = half
        cw = half * 2; chh = max(A.shape[0] for _, _, A, _ in items) + 2
        sheet = Image.new('RGBA', (cw * len(items), chh), (0, 0, 0, 0))
        anims = {}; i = 0
        for anim, C, A, ax in items:
            h, w = A.shape
            rgba = np.dstack([C, (A * 255).astype(np.uint8)])
            tile = Image.fromarray(rgba, 'RGBA')
            sheet.paste(tile, (i * cw + left - ax, chh - 1 - h), tile)
            anims.setdefault(anim, {'start': i, 'count': 0})
            anims[anim]['count'] += 1; i += 1
        # one shared palette for the character (keeps frames from flickering colour)
        alpha = sheet.split()[3]
        q = sheet.convert('RGB').quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        q.putalpha(alpha.point(lambda v: 255 if v > 127 else 0))
        q.save(OUT + f'{ch}.png')
        for anim, (fps, loop) in cfg['anims'].items():
            if anim in anims: anims[anim].update(fps=fps, loop=loop)
        json.dump({'frameWidth': cw, 'frameHeight': chh, 'anchorX': left, 'anims': anims}, open('data/anim/' + f'{ch}.json', 'w'), indent=1)
        print(ch, 'cell', cw, chh, 'frames', i)
    print('scale vs ref', report)

if __name__ == '__main__':
    main()
