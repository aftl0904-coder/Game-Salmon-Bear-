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
folders delivered in the first friends batch (the original tigercub, berry,
forest, and the unused duplicate bearcub) turned out to depict recognizable
copyrighted characters (Disney's Tigger, a Lotso/Care-Bear-style pink
strawberry bear, and Studio Ghibli's Totoro) and must never be wired into
the game; berry/forest/bearcub are still excluded (no roster id uses them).
ART-REQUEST-12 (art/batch-11) redelivered tigercub as an original sitting
baby-tiger design (round proportions, beanie hiding the ears, no Tigger-style
pink heart nose or spring-coil pose) that passed a human visual re-check, so
it's back in ALLOWED below. Do not widen ALLOWED again without a human
visually re-checking the new id's source art first.

Run: python3 scripts/art/slice_friends.py [art-root]
"""
import sys, os, colorsys
import numpy as np
from scipy import ndimage
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, downscale  # noqa: E402

# id -> target content height in px (matches the old procedural placeholder's
# ~40px bears; 'tall' friends get more so they still read taller; sitting-pose
# friends (tigercub/snowcat/fleecy) are wider than tall so get a bit less).
RES = 2  # pixels per logical px; BootScene marks the textures HD (heroAnims.markHd)

FRIEND_TARGETS = {
    'huihui': 38,
    'guard': 46,
    'denim': 38,
    'brownie': 38,
    'shiba': 34,
    'kuro': 34,
    'tigercub': 36,
    'snowcat': 34,
    'ginger': 36,
    'fleecy': 34,
    'gnome': 48,
}
CAGE_TARGET = 46

# id -> (hue_deg_min, hue_deg_max, max_sat, target_hue_deg) fur recolor, applied to the
# final cropped icon AFTER slicing. huihui's delivered art is grey fur with a pink shirt;
# the owner asked for apricot fur instead, so low-saturation warm-grey pixels (the fur —
# the pink shirt and black nose/eyes have their own hue/saturation and are untouched) get
# their hue pinned to a warm apricot and their saturation boosted, keeping each pixel's
# original value (shading) intact. This is baked into the slicer (not a one-off edit on
# the output PNG) so re-running this script can never silently revert the recolor.
FUR_RECOLOR = {
    'huihui': (8, 55, 0.35, 28 / 360),
}


def recolor_fur(icon: Image.Image, hue_lo: float, hue_hi: float, max_sat: float, target_hue: float) -> Image.Image:
    a = np.array(icon.convert('RGBA')).astype(float)
    rgb = a[..., :3] / 255
    alpha = a[..., 3]
    h = np.zeros(rgb.shape[:2]); s = np.zeros(rgb.shape[:2]); v = np.zeros(rgb.shape[:2])
    it = np.nditer(h, flags=['multi_index'])
    for _ in it:
        y, x = it.multi_index
        hh, ss, vv = colorsys.rgb_to_hsv(*rgb[y, x])
        h[y, x], s[y, x], v[y, x] = hh, ss, vv
    hue_deg = h * 360
    fur = (alpha > 10) & (hue_deg > hue_lo) & (hue_deg < hue_hi) & (s < max_sat) & (v > 0.15)
    out_rgb = rgb.copy()
    for y, x in zip(*np.where(fur)):
        new_s = min(0.55, s[y, x] * 1.7 + 0.14)
        out_rgb[y, x] = colorsys.hsv_to_rgb(target_hue, new_s, v[y, x])
    out = (out_rgb * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([out, alpha.astype(np.uint8)]), 'RGBA')


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


def quantize(rgba, colors=48 * RES):
    img = Image.fromarray(rgba, 'RGBA')
    alpha = img.split()[3]
    q = img.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    W, H = q.size
    pad = Image.new('RGBA', (W + -W % RES, H + -H % RES), (0, 0, 0, 0))
    pad.paste(q, (0, 0))
    return pad


def crop_scale(a, m, box, target_h):
    x0, y0, x1, y1 = box
    sub_a, sub_m = a[y0:y1, x0:x1], m[y0:y1, x0:x1]
    s = target_h * RES / (y1 - y0)
    C, A = downscale(sub_a, sub_m, s, True)
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
        recolor_note = ''
        if fid in FUR_RECOLOR:
            icon = recolor_fur(icon, *FUR_RECOLOR[fid])
            recolor_note = ', fur recolored'
        icon.save(f'public/art/friends/{fid}.png')
        print(fid, icon.size, f'({len(bl)} poses found, used leftmost{recolor_note})')

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
