#!/usr/bin/env python3
"""Check an M8-format 12x2 enemy atlas and its explicit JSON frames."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

if len(sys.argv) != 4:
    raise SystemExit('usage: image-check.py atlas.png metadata.json output.json')
img_path, meta_path, report_path = map(Path, sys.argv[1:])
im = Image.open(img_path).convert('RGBA')
meta = json.loads(meta_path.read_text())
assert im.size == (3072, 704), im.size
assert (meta['frameWidth'], meta['frameHeight'], meta['res'], meta['columns']) == (256, 352, 4, 12)
arr = np.asarray(im)
assert set(np.unique(arr[:, :, 3])).issubset({0, 255}), 'non-binary alpha'
colors = np.unique(arr[arr[:, :, 3] > 0][:, :3], axis=0)
assert len(colors) <= 64, len(colors)
frames = []
for i in range(24):
    x, y = (i % 12) * 256, (i // 12) * 352
    cell = arr[y:y+352, x:x+256]
    mask = cell[:, :, 3] != 0
    assert mask.any(), f'empty frame {i}'
    assert not (mask[0].any() or mask[-1].any() or mask[:, 0].any() or mask[:, -1].any()), f'edge content frame {i}'
    ys, xs = np.where(mask)
    frames.append({'frame': i, 'bbox': [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1], 'sha256': hashlib.sha256(cell.tobytes()).hexdigest()})
for name, anim in meta['anims'].items():
    assert anim['fps'] > 0 and anim['frames'] and all(0 <= i < 24 for i in anim['frames']), name
    if name in ('walk', 'warning', 'attack'):
        assert len({frames[i]['sha256'] for i in anim['frames']}) >= 2, f'no pose variation: {name}'
result = {'passed': True, 'size': list(im.size), 'cell': [256, 352], 'count': len(frames), 'visible_colors': len(colors), 'binary_alpha': True, 'all_frame_edges_transparent': True, 'frames': frames, 'animations': list(meta['anims'])}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: 24 non-empty frames, transparent edges, binary alpha, <=64 colors, valid animation indices, varied walk/warning/attack')
