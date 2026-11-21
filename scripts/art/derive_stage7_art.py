#!/usr/bin/env python3
"""Derive ONLY the accepted stage-7 runtime art from Cursor PR #91.

Usage: python3 scripts/art/derive_stage7_art.py /path/to/cursor-worktree
Requires Pillow and NumPy. Refuses any source not matching the reviewed #91 head.
The source worktree is read-only; output is written solely under public/art/stage7.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1]) / 'art-src/props/stage7' if len(sys.argv) == 2 else None
if SOURCE is None:
    sys.exit('usage: derive_stage7_art.py /path/to/cursor-worktree')
OUT = ROOT / 'public/art/stage7'
OUT.mkdir(parents=True, exist_ok=True)
HEAD = '7b198f735ebebfa14c5d07aa7388681745ade7e5'
HASHES = {
    'entrance-far.png': 'b1418ce1066b1d3f6a8f3b84e2e335e4d55c97c48af025987af32b733e0d80a6',
    'backstage-far.png': '91279289c55ef0991140a86226d5625328ba3fd999931b3b5e0e1ec4a8bce33a',
    'arena-far.png': 'e99627122dd3b173580177c312bc7d2259bd2c544b6dcc779c38541c454d7afd',
    'net-static.png': '0e189aa6f2dc64b3a98bcad5895eeff37257e8d3bc315affa9833dc5891ff033',
    'number-plate-blank.png': 'dbd900297fdd37c977ef01ad231240a3c59cb9c14ada14d59b5593e96a9da138',
    'sign-blank.png': '49d6d9783afa80dfaf9c456271185281b575cab818146b3e3e3e7aaadf3b28ae',
}
for name, expected in HASHES.items():
    actual = hashlib.sha256((SOURCE / name).read_bytes()).hexdigest()
    if actual != expected:
        sys.exit(f'{name}: wrong source SHA-256: {actual}')

report = {'source_pr': 91, 'source_head': HEAD, 'pillow': pillow_version, 'numpy': np.__version__, 'files': []}
for name in ('entrance-far.png', 'backstage-far.png', 'arena-far.png'):
    img = Image.open(SOURCE / name).convert('RGB')
    assert img.size == (640, 360)
    # Already 640x360; no crop or geometry changes. 64 colours, no dithering.
    result = img.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    result.save(OUT / name, optimize=True)
    report['files'].append({'source': name, 'source_sha256': HASHES[name], 'output': name,
                            'output_size': list(result.size), 'method': 'RGB median-cut 64, no dithering; no resize'})

# Bounding box of non-magenta pixels, nearest-neighbour aspect-preserving resize;
# no opacity interpolation. Each image is sized for the existing coordinates.
props = {
    'net-static.png': {'fit': (104, 68)},
    'number-plate-blank.png': {'fit': (20, 13)},
    'sign-blank.png': {'fit': (158, 90)},
}
for name, spec in props.items():
    rgb = np.array(Image.open(SOURCE / name).convert('RGB'))
    r, g, b = [rgb[:, :, i].astype(np.int16) for i in range(3)]
    magenta = (r > 170) & (g < 110) & (b > 140) & (r - g > 90) & (b - g > 90)
    if name == 'net-static.png':
        # Its pale rope has magenta-composited dark fringe, unlike the other props.
        magenta |= (r > 50) & (b > 40) & (r-g > 25) & (b-g > 25)
    mask = ~magenta
    ys, xs = np.where(mask)
    box = (int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1))
    rgba = np.dstack((rgb, mask.astype(np.uint8) * 255))
    crop = Image.fromarray(rgba, 'RGBA').crop(box)
    w, h = crop.size
    fit_w, fit_h = spec['fit']
    scale = min(fit_w / w, fit_h / h)
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    crop = crop.resize(size, Image.Resampling.NEAREST)
    alpha = crop.getchannel('A')
    # Quantize only after hard key/nearest resize; preserve alpha exactly.
    q = crop.convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    if 'canvas' in spec:
        canvas = Image.new('RGBA', spec['canvas'], (0, 0, 0, 0))
        canvas.paste(q, ((canvas.width-q.width)//2, canvas.height-spec['bottom_margin']-q.height))
        q = canvas
    q.save(OUT / name, optimize=True)
    visible = np.array(q)
    colors = len(np.unique(visible[:, :, :3][visible[:, :, 3] > 0], axis=0))
    assert colors <= 64 and set(np.unique(visible[:, :, 3])).issubset({0, 255})
    report['files'].append({'source': name, 'source_sha256': HASHES[name], 'output': name,
                            'source_crop_xyxy': box, 'resized': size, 'output_size': list(q.size),
                            'visible_colors': colors, 'alpha': 'binary',
                            'method': 'magenta threshold, bounding box, nearest aspect fit, RGB median-cut 64/no dither, binary alpha' + ('; transparent padding' if 'canvas' in spec else '')})

(OUT / 'manifest.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(report, indent=2, ensure_ascii=False))
