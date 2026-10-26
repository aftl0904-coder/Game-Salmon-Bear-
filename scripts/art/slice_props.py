#!/usr/bin/env python3
"""Stage props: art-src/props/<stage>/*.png and a few art-src/gen sheets (flat magenta / black bg)
→ public/art/props/<name>.png, cropped to the object and scaled to an in-game height.
Run: python3 scripts/art/slice_props.py [art-root]"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, downscale  # noqa: E402

# out name → (source, target height px, which blob: 'largest' | 'all' | int index left→right)
PROPS = {
    'lantern': ('props/stage1/lantern.png', 40, 'largest'),
    'honey-pot': ('props/stage1/honey-pot.png', 24, 'largest'),
    'stump-a': ('props/stage1/stump-a.png', 26, 'largest'),
    'stump-b': ('props/stage1/stump-b.png', 20, 'largest'),
    'rock-a': ('props/stage1/rock-a.png', 14, 'largest'),
    'rock-b': ('props/stage1/rock-b.png', 18, 'largest'),
    'rock-c': ('props/stage1/rock-c.png', 10, 'largest'),
    'mushrooms': ('props/stage1/mushrooms.png', 18, 'all'),
    'grass-a': ('props/stage1/grass-a.png', 16, 'all'),
    'grass-c': ('props/stage1/grass-c.png', 12, 'all'),
    'fern-b': ('props/stage1/fern-b.png', 22, 'all'),
    'fence': ('props/stage1/fence.png', 24, 'all'),
    'sign-post': ('props/stage1/sign-post.png', 34, 'largest'),
    'billboard': ('props/stage1/billboard-blank.png', 78, 'largest'),
    'stone-altar': ('props/stage1/stone-altar.png', 36, 'largest'),
    'honey-tree': ('props/stage1/honey-tree.png', 210, 'all'),
    'coffee-cart': ('props/stage1/coffee-cart.png', 62, 'all'),
    'picnic-blanket': ('props/stage1/picnic-blanket.png', 30, 'all'),
    'far-trunks': ('props/stage1/far-tree-trunks.png', 110, 'all'),
    # stage 2 · 蜜樹丘
    's2-bark-ground': ('props/stage2/bark-ground.png', 40, 'all'),
    's2-bark-platform': ('props/stage2/bark-platform.png', 14, 'all'),
    's2-bark-wall': ('props/stage2/bark-wall.png', 160, 'largest'),
    's2-honeycomb-wall': ('props/stage2/honeycomb-wall.png', 120, 'all'),
    's2-mushroom-shelf': ('props/stage2/mushroom-shelf.png', 14, 'largest'),
    's2-triangle-mark': ('props/stage2/triangle-mark.png', 40, 'largest'),
    's2-vine-a': ('props/stage2/vine-a.png', 90, 'all'),
    's2-vine-b': ('props/stage2/vine-b.png', 110, 'all'),
    's2-hive': ('props/stage2/hive-hanging.png', 40, 'all'),
    's2-hive-broken': ('props/stage2/hive-broken.png', 18, 'all'),
    's2-canopy-mid': ('props/stage2/canopy-mid.png', 80, 'all'),
    's2-canopy-front': ('props/stage2/canopy-front.png', 46, 'all'),
    's2-vine-lattice': ('props/stage2/canopy-mid-front-sheet.png', 34, 0),
    # stage 3 · 月影夜市 (pick = (x0, y0, x1, y1): blobs centred inside that box of a combined sheet)
    's3-lantern-on': ('props/stage3/lanterns-wok-steam-items-sheet.png', 30, (220, 90, 350, 340)),
    's3-lantern-off': ('props/stage3/lanterns-wok-steam-items-sheet.png', 24, (420, 90, 545, 290)),
    's3-wok-stall': ('props/stage3/lanterns-wok-steam-items-sheet.png', 72, (700, 25, 1045, 315)),
    's3-steam': ('props/stage3/lanterns-wok-steam-items-sheet.png', 64, (800, 320, 950, 665)),
    's3-sashimi': ('props/stage3/lanterns-wok-steam-items-sheet.png', 12, (220, 555, 410, 655)),
    's3-lobster': ('props/stage3/lanterns-wok-steam-items-sheet.png', 12, (470, 560, 660, 650)),
    's3-stall': ('props/stage3/props-sheet.png', 64, (15, 210, 310, 470)),
    's3-stall-broken': ('props/stage3/stall.png', 44, (70, 490, 427, 700)),
    's3-knife': ('anim/enemies/E-09-stallkeeper/knife.png', 14, (140, 60, 305, 212)),
    's3-feather': ('anim/boss/mirror-owl/feather.png', 22, 0),
    's3-market-mid': ('props/stage3/market-mid.png', 100, 'all'),
    's3-hotspring-rock': ('props/stage3/hotspring-rock.png', 40, 'all'),
    's3-wood-bridge': ('props/stage3/wood-bridge.png', 56, 'all'),
    's3-market-ground': ('props/stage3/market-ground.png', 40, 'all'),
    'mama': ('gen/coffee-mama.png', 64, 0),
    'mama-offer': ('gen/coffee-mama.png', 64, 1),
}

TRIM = {'s3-market-ground': (10, 3, 10, 2), 's3-market-mid': (4, 0, 4, 0)}

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs('public/art/props', exist_ok=True)
    only = [x for x in os.environ.get('ONLY', '').split(',') if x]
    for name, (src, target, pick) in PROPS.items():
        if only and not any(name.startswith(o) for o in only): continue
        im = Image.open(os.path.join(root, 'art-src', src))
        if im.mode == 'RGBA':  # already cut out (gen sheets)
            arr = np.array(im)
            a, m = arr[..., :3], arr[..., 3] > 127
        else:
            a = np.array(im.convert('RGB')); m = fg_mask(a)
        lab, n = ndimage.label(ndimage.binary_closing(m, iterations=3))
        if n == 0: continue
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        big = [i + 1 for i, v in enumerate(sizes) if v >= sizes.max() * 0.04]
        if pick == 'largest':
            keep = [int(np.argmax(sizes)) + 1]
        elif pick == 'all':
            keep = big
        elif isinstance(pick, tuple):
            bx0, by0, bx1, by1 = pick
            keep = []
            for k in range(1, n + 1):
                ys, xs = np.where(lab == k)
                cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
                if bx0 <= cx <= bx1 and by0 <= cy <= by1 and sizes[k - 1] > 200: keep.append(k)
        else:
            # n-th big blob from the left
            order = sorted(big, key=lambda k: np.where(lab == k)[1].min())
            keep = [order[pick]]
        mm = m & np.isin(lab, keep)
        ys, xs = np.where(mm)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        C, A = downscale(a[y0:y1, x0:x1], mm[y0:y1, x0:x1], target / (y1 - y0))
        rgba = np.dstack([C, (A * 255).astype(np.uint8)])
        r, g, b = C[..., 0].astype(int), C[..., 1].astype(int), C[..., 2].astype(int)
        rgba[..., 3][(r > 170) & (g < 120) & (b > 120) & (r - g > 90)] = 0  # magenta fringe
        out = Image.fromarray(rgba, 'RGBA')
        alpha = out.split()[3]
        q = out.convert('RGB').quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        q.putalpha(alpha.point(lambda v: 255 if v > 127 else 0))
        if name in TRIM:  # strips meant to tile: cut the rounded ends / soft top
            l, t, r, b = TRIM[name]
            q = q.crop((l, t, q.width - r, q.height - b))
        q.save(f'public/art/props/{name}.png')
        print(name, q.size)

if __name__ == '__main__':
    main()
