#!/usr/bin/env python3
"""Friend NPC art (art-src/anim/friends/<id>/idle.png, 1280x720 magenta bg,
several unevenly-spaced idle poses) and the honey-crate cage prop
(art-src/props/friends/cage.png, 3 unevenly-spaced states: locked/cracked/open)
-> public/art/friends/<id>.png (one representative pose each, the leftmost)
and public/art/friends/cage.png (the intact/locked state, to match the single
static 'friend-cage' texture the game already uses).

Poses are NOT evenly spaced across the sheet, so this uses full connected-
component blob detection (ndimage.label over the whole mask) rather than the
even-grid split() in slice_anim.py, then sorts blobs left-to-right by centroid.

IMPORTANT: only a vetted allow-list of friend ids is sliced here. Several
folders delivered in this batch (tigercub, berry, forest, and the unused
duplicate bearcub) turned out to depict recognizable copyrighted characters
(Disney's Tigger, a Lotso/Care-Bear-style pink strawberry bear, and Studio
Ghibli's Totoro) and must never be wired into the game. Do not widen ALLOWED
without a human visually re-checking the new id's source art first.

Run: python3 scripts/art/slice_friends.py [art-root]
"""
import sys, os
import numpy as np
from scipy import ndimage
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, downscale  # noqa: E402

# id -> target content height in px (matches the old procedural placeholder's
# ~40px bears; the two 'tall' friends get a bit more so they still read taller).
FRIEND_TARGETS = {
    'huihui': 38,
    'guard': 46,
    'denim': 38,
    'brownie': 38,
    'shiba': 34,
    'kuro': 34,
}
CAGE_TARGET = 46


def blobs(mask, min_area=250):
    lab, k = ndimage.label(ndimage.binary_closing(mask, iterations=2))
    out = []
    for i in range(1, k + 1):
        m = lab == i
        area = int(m.sum())
        if area < min_area:
            continue
        ys, xs = np.where(m)
        out.append((float(xs.mean()), int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    out.sort(key=lambda b: b[0])
    return out


def quantize(rgba, colors=48):
    img = Image.fromarray(rgba, 'RGBA')
    alpha = img.split()[3]
    q = img.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha.point(lambda v: 255 if v > 127 else 0))
    return q


def crop_scale(a, m, box, target_h):
    x0, y0, x1, y1 = box
    sub_a, sub_m = a[y0:y1, x0:x1], m[y0:y1, x0:x1]
    s = target_h / (y1 - y0)
    C, A = downscale(sub_a, sub_m, s)
    rgba = np.dstack([C, (A * 255).astype(np.uint8)])
    return quantize(rgba)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs('public/art/friends', exist_ok=True)

    for fid, target_h in FRIEND_TARGETS.items():
        path = os.path.join(root, f'art-src/anim/friends/{fid}/idle.png')
        if not os.path.exists(path):
            print(f'MISSING {fid}: {path}')
            continue
        a = np.array(Image.open(path).convert('RGB'))
        m = fg_mask(a)
        bl = blobs(m)
        if not bl:
            print(f'NO BLOBS {fid}')
            continue
        _, x0, y0, x1, y1 = bl[0]  # leftmost pose
        icon = crop_scale(a, m, (x0, y0, x1, y1), target_h)
        icon.save(f'public/art/friends/{fid}.png')
        print(fid, icon.size, f'({len(bl)} poses found, used leftmost)')

    cage_path = os.path.join(root, 'art-src/props/friends/cage.png')
    a = np.array(Image.open(cage_path).convert('RGB'))
    m = fg_mask(a)
    bl = blobs(m)
    if bl:
        _, x0, y0, x1, y1 = bl[0]  # leftmost = intact/locked cage
        icon = crop_scale(a, m, (x0, y0, x1, y1), CAGE_TARGET)
        icon.save('public/art/friends/cage.png')
        print('cage', icon.size, f'({len(bl)} states found, used leftmost/locked)')
    else:
        print('NO BLOBS cage')


if __name__ == '__main__':
    main()
