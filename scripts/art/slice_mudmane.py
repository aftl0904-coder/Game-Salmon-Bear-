#!/usr/bin/env python3
"""Stage 4 boss 泥鬃: art-src/anim/boss/mudmane/*.png (flat magenta, 1280x720, one combined
sheet per action) -> public/art/anim/mudmane.png + data/anim/mudmane.json, same atlas format
as scripts/art/slice_anim.py / slice_triboss.py.

Every sheet was drawn at a different size (the bike sheets show a small rider, the walk sheet a
big one), so each sheet is scaled so its yellow hard hat has the same area as in the walk sheet
(whose standing height is pinned to HEIGHT). Run: python3 scripts/art/slice_mudmane.py [art-root]
"""
import sys, os, json
import numpy as np
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, split, downscale  # noqa: E402

OUT_IMG = 'public/art/anim/mudmane.png'
OUT_JSON = 'data/anim/mudmane.json'
SRC_DIR = 'art-src/anim/boss/mudmane'
RES = 2
MAX_SHEET_W = 4096
CELL_1X = (110, 96)
HEIGHT = 92  # standing height of the walk sheet, logical px (heroes are ~72, TriBoss 100)

# anim -> (source stem, frames, fps, loop)
ANIMS = {
    'ride': ('ride', 4, 8, True),
    'charge': ('charge', 4, 12, True),
    'walk': ('walk', 4, 8, True),
    'summon': ('summon', 3, 6, True),
    'nailgun': ('nailgun', 4, 8, True),
    'punch': ('punch', 4, 8, False),
    'hurt': ('hurt', 2, 10, False),
    'defeat': ('defeat', 5, 6, False),
}


def hat(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 170) & (g > 100) & (g < 200) & (b < 80) & (r - b > 110)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs('public/art/anim', exist_ok=True)
    os.makedirs('data/anim', exist_ok=True)
    from PIL import Image

    def load(stem, n):
        path = os.path.join(root, SRC_DIR, f'{stem}.png')
        if not os.path.exists(path):
            print('missing', path); sys.exit(1)
        a = np.array(Image.open(path).convert('RGB'))
        m = fg_mask(a)
        # Wheel spokes enclose bits of background that fg_mask keeps; drop anything still magenta.
        r_, g_, b_ = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
        m &= ~((r_ - g_ > 90) & (b_ - g_ > 50) & (r_ > 140))
        pink = (b_ - g_ > 25) & (r_ - g_ > 50)
        a = a.copy()
        a[..., 2] = np.where(pink, np.minimum(b_, g_ + 8), a[..., 2])
        h = hat(a)
        out = []
        for (x0, x1) in split(m, n):
            sm = m[:, x0:x1]
            ys, xs = np.where(sm)
            if not len(ys):
                continue
            by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            hm = h[:, x0:x1] & sm
            lab, k = ndimage.label(hm)
            area = max([(lab == i).sum() for i in range(1, k + 1)] or [0])
            out.append((a[by0:by1, x0 + bx0:x0 + bx1], sm[by0:by1, bx0:bx1], float(area)))
        return out

    raw = {k: load(v[0], v[1]) for k, v in ANIMS.items()}
    walk = raw['walk']
    walk_scale = HEIGHT * RES / float(np.median([m.shape[0] for _, m, _ in walk]))
    target_hat = float(np.median([ar for *_, ar in walk])) * walk_scale ** 2
    report = {}
    sheets = {}
    for anim, frs in raw.items():
        ha = float(np.median([ar for *_, ar in frs]))
        s = walk_scale if anim == 'walk' else (target_hat / ha) ** 0.5
        report[anim] = (round(s / walk_scale, 3), len(frs))
        sheets[anim] = [downscale(c, m, s, True) for c, m, _ in frs]

    items = []
    for anim in ANIMS:
        for C, A in sheets[anim]:
            h, w = A.shape
            ys, xs = np.where(A[int(h * 0.55):] > 0.5)
            ax = int(np.median(xs)) if len(xs) else w // 2
            items.append((anim, C, A, ax))
    half = max(max(ax for _, _, _, ax in items), max(A.shape[1] - ax for _, _, A, ax in items)) + 2
    cw = max(half * 2, CELL_1X[0] * RES)
    chh = max(max(A.shape[0] for _, _, A, _ in items) + 2, CELL_1X[1] * RES)
    cw += -cw % RES
    chh += -chh % RES
    left = cw // 2
    cols = max(1, min(len(items), MAX_SHEET_W // cw))
    rows = -(-len(items) // cols)
    sheet = Image.new('RGBA', (cw * cols, chh * rows), (0, 0, 0, 0))
    anims = {}
    for i, (anim, C, A, ax) in enumerate(items):
        h, w = A.shape
        rgba = np.dstack([C, (A * 255).astype(np.uint8)])
        sheet.paste(Image.fromarray(rgba, 'RGBA'), ((i % cols) * cw + left - ax, (i // cols) * chh + chh - 1 - h))
        anims.setdefault(anim, {'start': i, 'count': 0})
        anims[anim]['count'] += 1
    alpha = sheet.split()[3]
    q = sheet.convert('RGB').quantize(colors=64 * RES, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    q.save(OUT_IMG, optimize=True)
    for anim, (_, n, fps, loop) in ANIMS.items():
        anims[anim].update(fps=fps, loop=loop)
    p = anims['punch']
    # The punch sheet is wind-up, reach, impact, recover: the first half is the telegraph, the second the strike.
    anims['windup'] = {'start': p['start'], 'count': 2, 'fps': 5, 'loop': False}
    anims['strike'] = {'start': p['start'] + 2, 'count': 2, 'fps': 8, 'loop': False}
    json.dump({'frameWidth': cw, 'frameHeight': chh, 'anchorX': left, 'res': RES, 'columns': cols, 'cell1x': list(CELL_1X), 'anims': anims}, open(OUT_JSON, 'w'), indent=1)
    print('mudmane cell', cw, chh, 'frames', len(items), 'walk scale', round(walk_scale, 3))
    print('scale vs walk (factor, frames):', report)


if __name__ == '__main__':
    main()
