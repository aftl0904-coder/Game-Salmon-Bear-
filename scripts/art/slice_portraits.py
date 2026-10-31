#!/usr/bin/env python3
"""Dialogue portraits: art-src/portraits/<id>.png (3 expressions side by side on magenta)
→ public/art/portraits/<id>.png, a 3-frame 72×72 strip (neutral / happy / shocked).
Run: python3 scripts/art/slice_portraits.py [art-root]"""
import sys, os, glob
import numpy as np
from scipy import ndimage
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, split, downscale  # noqa: E402  (shared helpers)

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = 'public/art/portraits/'
os.makedirs(OUT, exist_ok=True)
RES = 2  # keep in sync with PORTRAIT_RES in src/game/heroAnims.ts
S = 72 * RES
for f in sorted(glob.glob(os.path.join(ROOT, 'art-src/portraits/*.png'))):
    pid = os.path.splitext(os.path.basename(f))[0]
    a = np.array(Image.open(f).convert('RGB'))
    m = fg_mask(a)
    strip = Image.new('RGBA', (S * 3, S), (0, 0, 0, 0))
    for i, (x0, x1) in enumerate(split(m, 3)):
        sm = m[:, x0:x1]
        # keep only the big blob(s): drops stray labels the generator wrote into the image
        lab, n = ndimage.label(ndimage.binary_closing(sm, iterations=2))
        if n > 1:
            sizes = ndimage.sum(sm, lab, range(1, n + 1))
            keep = [i + 1 for i, v in enumerate(sizes) if v >= sizes.max() * 0.15]
            sm = sm & np.isin(lab, keep)
        ys, xs = np.where(sm)
        if not len(ys): continue
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgb = a[by0:by1, x0 + bx0:x0 + bx1]; mm = sm[by0:by1, bx0:bx1]
        s = min((S - 2) / mm.shape[0], (S - 2) / mm.shape[1])
        C, A = downscale(rgb, mm, s, True)
        h, w = A.shape
        tile = Image.fromarray(np.dstack([C, (A * 255).round().astype(np.uint8)]), 'RGBA')
        strip.paste(tile, (i * S + (S - w) // 2, S - h))
    alpha = strip.split()[3]
    q = strip.convert('RGB').quantize(colors=40 * RES, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    q.save(OUT + pid + '.png')
    print(pid)
