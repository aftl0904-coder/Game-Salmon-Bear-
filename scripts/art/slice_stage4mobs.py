#!/usr/bin/env python3
"""Stage 4 mobs 蜜僵 / 的士怪 / 打卡鐘怪: art-src/anim/enemies/E-11..E-13/*.png (flat magenta,
1280x720, one combined sheet per action) -> public/art/anim/<set>.png + data/anim/<set>.json,
same atlas format as slice_mudmane.py / slice_anim.py.

Each sheet was drawn at a slightly different size, so every sheet is scaled so a stable body
colour (fur / paint / casing) covers the same area as in the reference sheet, whose size is
pinned to REF_DIM logical px. The relative factor is clamped, because corpses and debris share
little body colour with the standing pose.
Run: python3 scripts/art/slice_stage4mobs.py [art-root]   (ONLY=taximonster to redo one set)
"""
import sys, os, json
import numpy as np
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, split, downscale  # noqa: E402

RES = 2
MAX_SHEET_W = 4096


def fur(a):  # 蜜僵 grey fur
    r, g, b = (a[..., i].astype(int) for i in range(3))
    mx, mn = a.max(-1).astype(int), a.min(-1).astype(int)
    return (mx > 40) & (mx < 170) & (mx - mn < 28)


def taxi_red(a):  # 的士怪 paint
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (r > 130) & (g < 90) & (b < 80) & (r - g > 70)


def clock_dark(a):  # 打卡鐘怪 casing
    mx, mn = a.max(-1).astype(int), a.min(-1).astype(int)
    return (mx < 95) & (mx - mn < 35)


# set -> dir, reference anim, ('h'|'w', logical px of the reference sheet's median frame), key fn,
#        anims {name: (source stem, frames in the sheet, frames used, fps, loop)}
SETS = {
    'honeyzombie': dict(
        dir='E-11-honeyzombie', ref='walk', ref_dim=('h', 56), key=fur,
        anims={
            'walk': ('walk', 4, 4, 5, True),
            'reach': ('reach', 3, 3, 6, False),
            'hit': ('hit', 2, 2, 10, False),
            'die': ('die', 4, 4, 7, False),
        },
    ),
    'taximonster': dict(
        dir='E-12-taximonster', ref='idle', ref_dim=('w', 80), key=taxi_red, clamp=(0.8, 2.0),
        anims={
            'idle': ('idle', 2, 2, 3, True),
            'flash': ('flash', 2, 2, 8, True),
            'dash': ('dash', 4, 4, 14, True),
            'crash': ('crash', 3, 3, 6, False),
            'die': ('die', 4, 4, 8, False),
        },
    ),
    'clockpunch': dict(
        dir='E-13-punchclock', ref='walk', ref_dim=('h', 54), key=clock_dark,
        anims={
            'walk': ('walk', 4, 4, 6, True),
            'tick': ('tick', 3, 3, 5, True),
            'burst': ('burst', 4, 4, 12, False),
            'hit': ('hit', 4, 4, 14, False),
            'die': ('die', 4, 4, 8, False),
        },
    ),
}


def slice_set(name, cfg, root):
    from PIL import Image

    def load(stem, n):
        path = os.path.join(root, 'art-src/anim/enemies', cfg['dir'], f'{stem}.png')
        if not os.path.exists(path):
            print('missing', path); sys.exit(1)
        a = np.array(Image.open(path).convert('RGB'))
        m = fg_mask(a)
        k = cfg['key'](a)
        out = []
        for (x0, x1) in split(m, n):
            sm = m[:, x0:x1]
            ys, xs = np.where(sm)
            if not len(ys):
                continue
            by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            area = float((k[:, x0:x1] & sm).sum())
            out.append((a[by0:by1, x0 + bx0:x0 + bx1], sm[by0:by1, bx0:bx1], area))
        return out

    raw = {an: load(v[0], v[1])[:v[2]] for an, v in cfg['anims'].items()}
    ref = raw[cfg['ref']]
    axis, dim = cfg['ref_dim']
    idx = 0 if axis == 'h' else 1
    ref_scale = dim * RES / float(np.median([m.shape[idx] for _, m, _ in ref]))
    ref_area = float(np.median([ar for *_, ar in ref]))
    target_area = ref_area * ref_scale ** 2
    report = {}
    items = []
    for anim, frs in raw.items():
        if anim == cfg['ref']:
            s = ref_scale
        else:
            first = max(frs[0][2], 1.0)
            s = float(np.clip((target_area / first) ** 0.5 / ref_scale, cfg.get("clamp", (0.8, 1.25))[0], cfg.get("clamp", (0.8, 1.25))[1])) * ref_scale
        report[anim] = round(s / ref_scale, 3)
        for c, m, _ in frs:
            C, A = downscale(c, m, s, True)
            h, w = A.shape
            ys, xs = np.where(A[int(h * 0.55):] > 0.5)
            ax = int(np.median(xs)) if len(xs) else w // 2
            items.append((anim, C, A, ax))
    half = max(max(ax for _, _, _, ax in items), max(A.shape[1] - ax for _, _, A, ax in items)) + 2
    cw = half * 2
    chh = max(A.shape[0] for _, _, A, _ in items) + 2
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
    q.save(f'public/art/anim/{name}.png', optimize=True)
    for anim, spec in cfg['anims'].items():
        anims[anim].update(fps=spec[3], loop=spec[4])
    json.dump({'frameWidth': cw, 'frameHeight': chh, 'anchorX': left, 'res': RES, 'columns': cols,
               'cell1x': [cw // RES, chh // RES], 'anims': anims}, open(f'data/anim/{name}.json', 'w'), indent=1)
    print(name, 'cell', cw, chh, 'frames', len(items), 'scale vs ref', report)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    only = [x for x in os.environ.get('ONLY', '').split(',') if x]
    os.makedirs('public/art/anim', exist_ok=True)
    os.makedirs('data/anim', exist_ok=True)
    for name, cfg in SETS.items():
        if only and name not in only:
            continue
        slice_set(name, cfg, root)


if __name__ == '__main__':
    main()
