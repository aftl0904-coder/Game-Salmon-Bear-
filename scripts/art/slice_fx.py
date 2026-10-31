#!/usr/bin/env python3
"""Effect sheets: art-src/anim/fx/<name>.png (N frames on a flat background)
→ public/art/fx/<name>.png (uniform cells, each frame centred) + data/anim/fx.json.
Run: python3 scripts/art/slice_fx.py [art-root]"""
import sys, os, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, split, downscale  # noqa: E402

RES = 2

# name → (largest side in game px, fps)
FX = {
    'hit-spark': (34, 24), 'enemy-poof': (52, 16), 'roe-splash': (26, 22), 'muzzle-flash': (22, 30),
    'slash-arc-1': (70, 30), 'slash-arc-2': (70, 30), 'slash-arc-3': (80, 30),
    'lantern-break': (50, 16), 'pot-break': (42, 16), 'coin-spin': (16, 12), 'power-up': (56, 16),
    'dust-step': (18, 18), 'land-dust': (34, 18), 'honey-sparkle': (26, 12), 'armour-clank': (30, 24),
    # stage 2 boss FX (live under the boss folder)
    'wind-vent': (40, 10, '../props/stage2'), 'honey-drip': (16, 6, '../props/stage2'),
    'honey-stream': (90, 14, 'boss/queen-bee'), 'honey-puddle': (60, 8, 'boss/queen-bee'), 'swarm': (64, 12, 'boss/queen-bee'),
}

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    man = {m['file']: m for m in json.load(open(os.path.join(root, 'art-src/anim/manifest.json')))}
    os.makedirs('public/art/fx', exist_ok=True)
    meta = {}
    old = json.load(open('data/anim/fx.json')) if os.path.exists('data/anim/fx.json') else {}
    for name, spec in FX.items():
        target, fps = spec[0], spec[1]
        folder = spec[2] if len(spec) > 2 else 'fx'
        rel = os.path.normpath(f'art-src/anim/{folder}/{name}.png')
        if rel not in man: continue
        a = np.array(Image.open(os.path.join(root, rel)).convert('RGB'))
        m = fg_mask(a)
        n = man[rel]['frames']
        crops = []
        for (x0, x1) in split(m, n):
            sm = m[:, x0:x1]
            ys, xs = np.where(sm)
            if not len(ys): continue
            by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            crops.append((a[by0:by1, x0 + bx0:x0 + bx1], sm[by0:by1, bx0:bx1]))
        big = max(max(c[1].shape) for c in crops)
        s = target / big * RES
        tiles = [downscale(rgb, mm, s, soft=True) for rgb, mm in crops]
        o = old.get(name, {})
        lw = max(-(-max(t[1].shape[1] for t in tiles) // RES) + 1, o.get('frameWidth', 0) // o.get('res', 1))
        lh = max(-(-max(t[1].shape[0] for t in tiles) // RES) + 1, o.get('frameHeight', 0) // o.get('res', 1))
        fw, fh = lw * RES, lh * RES
        strip = Image.new('RGBA', (fw * len(tiles), fh), (0, 0, 0, 0))
        for i, (C, A) in enumerate(tiles):
            h, w = A.shape
            tile = Image.fromarray(np.dstack([C, (A * 255).astype(np.uint8)]), 'RGBA')
            strip.paste(tile, (i * fw + (fw - w) // 2, (fh - h) // 2), tile)
        # drop leftover magenta fringe pixels (keeps the blue/purple slash colours)
        arr = np.array(strip)
        r, g, b = arr[..., 0].astype(int), arr[..., 1].astype(int), arr[..., 2].astype(int)
        arr[..., 3][(r > 180) & (g < 130) & (b > 140) & (r - g > 90)] = 0
        strip = Image.fromarray(arr, 'RGBA')
        alpha = strip.split()[3]
        q = strip.convert('RGB').quantize(colors=32 * RES, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        q.putalpha(alpha)
        q.save(f'public/art/fx/{name}.png')
        meta[name] = {'frameWidth': fw, 'frameHeight': fh, 'count': len(tiles), 'fps': fps, 'res': RES}
        print(name, fw, fh, len(tiles))
    json.dump(meta, open('data/anim/fx.json', 'w'), indent=1)

if __name__ == '__main__':
    main()
