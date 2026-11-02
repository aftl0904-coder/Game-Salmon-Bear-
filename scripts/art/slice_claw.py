#!/usr/bin/env python3
"""夜市抓抓機 prizes: art-src/claw/claw-prizes-sheet.jpg (4 items on flat green, 2x2) ->
public/art/props/claw-{lobster,shrimp,boot,can}.png at 2x resolution (shown at logical size via markHd).
Run: python3 scripts/art/slice_claw.py [art-root]
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

RES = 2
# name -> (quadrant col, row, logical width px)
ITEMS = {'lobster': (0, 0, 46), 'shrimp': (1, 0, 38), 'boot': (0, 1, 32), 'can': (1, 1, 28)}


def key(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (g - r > 50) & (g - b > 50) & (g > 110)
    lab, n = ndimage.label(bg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(border))
    bgm = ndimage.binary_dilation(bgm, iterations=1) & (((g - r > 25) & (g - b > 25)) | bgm)
    # Green pockets enclosed by claws / legs are not reachable from the border; none of the prizes is green.
    bgm |= (g - r > 40) & (g - b > 40) & (g > 90)
    edge = ndimage.binary_dilation(bgm, iterations=3) & ~bgm
    cap = np.maximum(r, b)
    rgb = a.copy()
    rgb[..., 1] = np.where(edge & (g > cap), cap, g)
    alpha = np.where(bgm, 0, 255).astype(np.uint8)
    # keep only the biggest blob (JPEG speckle)
    lab2, n2 = ndimage.label(alpha > 0)
    if n2:
        sizes = ndimage.sum(alpha > 0, lab2, range(1, n2 + 1))
        alpha = np.where(lab2 == (1 + int(np.argmax(sizes))), alpha, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), 'RGBA')


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    sheet = Image.open(os.path.join(root, 'art-src/claw/claw-prizes-sheet.jpg'))
    w, h = sheet.size
    for name, (cx, cy, lw) in ITEMS.items():
        q = sheet.crop((cx * w // 2, cy * h // 2, (cx + 1) * w // 2, (cy + 1) * h // 2))
        im = key(q)
        im = im.crop(im.getchannel('A').getbbox())
        tw = lw * RES
        th = round(im.height * tw / im.width)
        im = im.resize((tw, th), Image.LANCZOS)
        out = f'public/art/props/claw-{name}.png'
        im.save(out)
        print(out, im.size)


if __name__ == '__main__':
    main()
