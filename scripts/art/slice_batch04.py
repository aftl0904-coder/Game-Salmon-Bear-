#!/usr/bin/env python3
"""Batch 04 K+L: world map + bike chase → public/art/map, public/art/bike.
Run: python3 scripts/art/slice_batch04.py"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, downscale  # noqa: E402

RES = 2  # pixels per logical px; BikeScene/WorldMapScene mark the textures HD (heroAnims.markHd)

def rgba_of(C, A):
    return Image.fromarray(np.dstack([C, (A * 255).astype(np.uint8)]), 'RGBA')

def cut(a, m, target_h):
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    C, A = downscale(a[y0:y1, x0:x1], m[y0:y1, x0:x1], target_h * RES / (y1 - y0), True)
    return C, A

def blobs(m, min_frac=0.05, close=3):
    lab, n = ndimage.label(ndimage.binary_closing(m, iterations=close))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = [i + 1 for i, v in enumerate(sizes) if v >= sizes.max() * min_frac]
    return sorted(keep, key=lambda k: np.where(lab == k)[1].min()), lab

def groups_by_columns(m, n):
    """Split a sheet into n frames at the n-1 widest empty column gaps."""
    col = m.sum(0) > 0
    xs = np.where(col)[0]
    gaps = []
    run = None
    for x in range(xs.min(), xs.max() + 1):
        if not col[x]:
            run = run or [x, x]
            run[1] = x
        elif run:
            gaps.append((run[1] - run[0] + 1, run[0], run[1]))
            run = None
    gaps = sorted(sorted(gaps, reverse=True)[: n - 1], key=lambda g: g[1])
    edges = [xs.min()] + [g[1] + (g[2] - g[1]) // 2 for g in gaps] + [xs.max() + 1]
    return [(edges[i], edges[i + 1]) for i in range(n)]

def strip(frames, pad=2 * RES):
    """Equal cells, bottom-aligned, centred."""
    W = max(C.shape[1] for C, _ in frames) + pad * 2
    H = max(C.shape[0] for C, _ in frames)
    W += -W % RES
    H += -H % RES
    sheet = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, (C, A) in enumerate(frames):
        im = rgba_of(C, A)
        sheet.paste(im, (i * W + (W - im.width) // 2, H - im.height), im)
    return sheet, W, H

def main():
    os.makedirs('public/art/map', exist_ok=True)
    os.makedirs('public/art/bike', exist_ok=True)
    meta = {}
    # ── World map: keep 1280×720 (shown at 0.5× and zoomed into) ──
    Image.open('art-src/map/world-map.png').convert('RGB').save('public/art/map/world-map.png')
    # icons: 5 round badges → 32 px
    a = np.array(Image.open('art-src/map/map-icons.png').convert('RGB')); m = fg_mask(a)
    keep, lab = blobs(m, 0.3)
    frs = [cut(a, m & (lab == k), 32) for k in keep[:5]]
    sh, w, h = strip(frs); sh.save('public/art/map/icons.png'); meta['icons'] = {'frameWidth': w, 'frameHeight': h, 'count': len(frs), 'res': RES}
    # chibi party walk: 4 frames of (boy, girl, bear) → 30 px tall
    a = np.array(Image.open('art-src/map/map-walk.png').convert('RGB')); m = fg_mask(a)
    frs = []
    for x0, x1 in groups_by_columns(m, 4):
        mm = np.zeros_like(m); mm[:, x0:x1] = m[:, x0:x1]
        frs.append(cut(a, mm, 30))
    sh, w, h = strip(frs); sh.save('public/art/map/walk.png'); meta['walk'] = {'frameWidth': w, 'frameHeight': h, 'count': 4, 'res': RES}
    # ── Bike chase ──
    Image.open('art-src/bike/bike-far.png').convert('RGB').resize((640 * RES, 360 * RES), Image.BOX if RES <= 2 else Image.LANCZOS).save('public/art/bike/far.png')
    # mid: drop the sky (keyed by the top-row colour), keep the hills band
    a = np.array(Image.open('art-src/bike/bike-mid.png').convert('RGB')).astype(int)
    sky = np.median(a[:8].reshape(-1, 3), axis=0)
    m = np.sqrt(((a - sky) ** 2).sum(-1)) > 40
    m = ndimage.binary_opening(m, iterations=1)
    rows = np.where(m.sum(1) > m.shape[1] * 0.02)[0]
    y0 = rows.min()
    C, A = downscale(a[y0:].astype(np.uint8), m[y0:], 0.5 * RES, True)
    H = A.shape[0] + -A.shape[0] % RES
    pad = Image.new('RGBA', (A.shape[1], H), (0, 0, 0, 0)); pad.paste(rgba_of(C, A), (0, 0)); pad.save('public/art/bike/mid.png')
    # road: keep only the fully-opaque band and trim the side columns (magenta fringe = seams)
    a = np.array(Image.open('art-src/bike/bike-road.png').convert('RGB')); m = fg_mask(a)
    rows = np.where(m.mean(1) > 0.97)[0]
    cols = np.where(m[rows.min():rows.max() + 1].mean(0) > 0.99)[0]
    y0, y1 = rows.min() + 2, rows.max() - 2
    x0, x1 = cols.min() + 8, cols.max() - 8
    band = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8))
    h = 46 * RES
    band.resize((640 * RES, h), Image.BOX).save('public/art/bike/road.png')
    # obstacles: rock, log, puddle, cone, ramp (heights in game px)
    a = np.array(Image.open('art-src/bike/obstacles-sheet.png').convert('RGB')); m = fg_mask(a)
    keep, lab = blobs(m, 0.15)
    for name, k, hh in zip(['rock', 'log', 'puddle', 'cone', 'ramp'], keep[:5], [22, 16, 9, 22, 20]):
        C, A = cut(a, m & (lab == k), hh)
        H, W = A.shape
        pad = Image.new('RGBA', (W + -W % RES, H + -H % RES), (0, 0, 0, 0)); pad.paste(rgba_of(C, A), (0, 0)); pad.save(f'public/art/bike/{name}.png')
    # bee swarm: 6 objects alternate cluster / big bee; the clusters are the 3 flight frames
    a = np.array(Image.open('art-src/bike/bee-swarm.png').convert('RGB')); m = fg_mask(a)
    cols = groups_by_columns(ndimage.binary_dilation(m, iterations=6), 6)
    frs = []
    for i in (0, 2, 4):
        x0, x1 = cols[i]
        mm = np.zeros_like(m); mm[:, x0:x1] = m[:, x0:x1]
        frs.append(cut(a, mm, 30))
    sh, w, h = strip(frs); sh.save('public/art/bike/swarm.png'); meta['swarm'] = {'frameWidth': w, 'frameHeight': h, 'count': 3, 'res': RES}
    json.dump(meta, open('data/anim/map-bike.json', 'w'), indent=2)
    print(json.dumps(meta))

if __name__ == '__main__':
    main()
