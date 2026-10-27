#!/usr/bin/env python3
"""Charm icons (art-src/items/charm-*.png, 64×64 on flat magenta bg) →
public/art/items/charm-*.png, cropped to content and centred in a 48×48
transparent canvas (HUD icon size).
Run: python3 scripts/art/slice_charms.py [art-root]"""
import sys, os, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, downscale  # noqa: E402

TARGET = 44  # content height inside the 48×48 canvas

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs('public/art/items', exist_ok=True)
    for f in sorted(glob.glob(os.path.join(root, 'art-src/items/charm-*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        a = np.array(Image.open(f).convert('RGB'))
        m = fg_mask(a)
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        s = TARGET / max(y1 - y0, x1 - x0)
        C, A = downscale(a[y0:y1, x0:x1], m[y0:y1, x0:x1], s)
        rgba = np.dstack([C, (A * 255).astype(np.uint8)])
        icon = Image.fromarray(rgba, 'RGBA')
        canvas = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
        canvas.paste(icon, ((48 - icon.width) // 2, (48 - icon.height) // 2), icon)
        alpha = canvas.split()[3]
        q = canvas.convert('RGB').quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        q.putalpha(alpha.point(lambda v: 255 if v > 127 else 0))
        q.save(f'public/art/items/{name}.png')
        print(name, q.size)

if __name__ == '__main__':
    main()
