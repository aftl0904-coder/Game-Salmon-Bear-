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
fw, fh, cols = meta['frameWidth'], meta['frameHeight'], meta['columns']
assert im.width == fw * cols and im.height % fh == 0, im.size
assert meta['res'] in (2, 4) and cols == 12 and fw % meta['res'] == 0 and fh % meta['res'] == 0
count = cols * (im.height // fh)
arr = np.asarray(im)
assert set(np.unique(arr[:, :, 3])).issubset({0, 255}), 'non-binary alpha'
colors = np.unique(arr[arr[:, :, 3] > 0][:, :3], axis=0)
assert len(colors) <= 64, len(colors)
frames = []
for i in range(count):
    x, y = (i % cols) * fw, (i // cols) * fh
    cell = arr[y:y+fh, x:x+fw]
    mask = cell[:, :, 3] != 0
    assert mask.any(), f'empty frame {i}'
    assert not (mask[0].any() or mask[-1].any() or mask[:, 0].any() or mask[:, -1].any()), f'edge content frame {i}'
    ys, xs = np.where(mask)
    frames.append({'frame': i, 'bbox': [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1], 'sha256': hashlib.sha256(cell.tobytes()).hexdigest()})
for name, anim in meta['anims'].items():
    assert anim['fps'] > 0 and anim['frames'] and all(0 <= i < count for i in anim['frames']), name
    if name in ('walk', 'warning', 'attack') or name.endswith('_warning'):
        assert len({frames[i]['sha256'] for i in anim['frames']}) >= 2, f'no pose variation: {name}'
result = {'passed': True, 'size': list(im.size), 'cell': [fw, fh], 'count': len(frames), 'visible_colors': len(colors), 'binary_alpha': True, 'all_frame_edges_transparent': True, 'frames': frames, 'animations': list(meta['anims'])}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {count} non-empty frames, transparent edges, binary alpha, <=64 colors, valid animation indices and varied warning poses')
