#!/usr/bin/env python3
"""Cut a 4x6 generated alpha sheet into an M8-style atlas.

Usage: python3 prepare-sheet.py source.png output.png report.json [idle-height [logical-width]]
Cuts only at transparent gaps, or isolates four separate connected figures per
row when their horizontal bounding boxes overlap. Resizes, aligns, quantizes,
and rearranges existing image content; does not invent image content.
"""
import hashlib
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

if len(sys.argv) not in (4, 5, 6):
    raise SystemExit('usage: prepare-sheet.py source.png output.png report.json [idle-height [logical-width]]')
source, output, report = map(Path, sys.argv[1:4])
target_idle_height = float(sys.argv[4]) if len(sys.argv) >= 5 else None
logical_width = int(sys.argv[5]) if len(sys.argv) == 6 else 64
if target_idle_height is not None and not (1 <= target_idle_height <= 76):
    raise SystemExit('ERROR: idle height must be between 1 and 76 logical pixels')
if not (64 <= logical_width <= 128):
    raise SystemExit('ERROR: logical width must be between 64 and 128 pixels')
im = Image.open(source).convert('RGBA')
rgba = np.asarray(im).copy()
rgba[:, :, 3] = np.where(rgba[:, :, 3] >= 128, 255, 0).astype('uint8')
img = Image.fromarray(rgba, 'RGBA')
mask = rgba[:, :, 3] > 0

def bands(active):
    out = []
    start = None
    for idx, val in enumerate(active):
        if val and start is None:
            start = idx
        elif not val and start is not None:
            out.append((start, idx))
            start = None
    if start is not None:
        out.append((start, len(active)))
    return out

def separate_components(row_mask):
    h, w = row_mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    parts = []
    number = 0
    for yy, xx in zip(*np.nonzero(row_mask)):
        if labels[yy, xx]:
            continue
        number += 1
        labels[yy, xx] = number
        queue = deque([(int(yy), int(xx))])
        n, x0, y0, x1, y1 = 0, w, h, 0, 0
        while queue:
            y, x = queue.popleft()
            n += 1
            x0, x1, y0, y1 = min(x0, x), max(x1, x + 1), min(y0, y), max(y1, y + 1)
            for dy, dx in ((-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and row_mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = number
                    queue.append((ny, nx))
        parts.append({'label': number, 'pixels': n, 'bbox': [x0, y0, x1, y1]})
    large = [p for p in parts if p['pixels'] >= 20]
    if len(large) != 4:
        raise SystemExit(f'ERROR: expected 4 separate figures; component sizes: {[p["pixels"] for p in parts]}')
    large.sort(key=lambda p: (p['bbox'][0] + p['bbox'][2]) / 2)
    return labels, large, sum(p['pixels'] for p in parts if p['pixels'] < 20)

rows = bands(mask.any(axis=1))
cols = bands(mask.any(axis=0))
if len(rows) != 6:
    raise SystemExit(f'ERROR: expected six separated rows; got {rows=}')
frames = []
discarded_pixels = 0
if len(cols) == 4:
    method = 'global transparent row and column gaps'
    for top, bottom in rows:
        for left, right in cols:
            part = img.crop((left, top, right, bottom))
            box = part.getchannel('A').getbbox()
            if not box:
                raise SystemExit('ERROR: empty frame')
            frames.append((part.crop(box), [left + box[0], top + box[1], left + box[2], top + box[3]]))
else:
    method = 'transparent row gaps and separated connected figures within each row'
    for top, bottom in rows:
        labels, parts, dropped = separate_components(mask[top:bottom])
        discarded_pixels += dropped
        for part in parts:
            x0, y0, x1, y1 = part['bbox']
            crop = rgba[top+y0:top+y1, x0:x1].copy()
            crop[:, :, 3] = np.where(labels[y0:y1, x0:x1] == part['label'], crop[:, :, 3], 0)
            frames.append((Image.fromarray(crop, 'RGBA'), [x0, top+y0, x1, top+y1]))

maxw = max(frame.width for frame, _ in frames)
maxh = max(frame.height for frame, _ in frames)
# One common scale for all frames avoids visually resizing a character between poses.
if target_idle_height is None:
    scale = min(52 / maxw, 50 / maxh)
else:
    max_idle_height = max(frame.height for frame, _ in frames[:4])
    scale = min(target_idle_height / max_idle_height, 76 / maxh, (logical_width - 8) / maxw)
base = Image.new('RGBA', (logical_width * 12, 88 * 2), (0, 0, 0, 0))
frame_report = []
for idx, (frame, source_bbox) in enumerate(frames):
    w = max(1, round(frame.width * scale))
    h = max(1, round(frame.height * scale))
    small = frame.resize((w, h), Image.Resampling.NEAREST)
    x = (idx % 12) * logical_width + (logical_width - w) // 2
    y = (idx // 12) * 88 + 84 - h
    base.alpha_composite(small, (x, y))
    frame_report.append({'frame': idx, 'source_bbox': source_bbox, 'logical_size': [w, h], 'logical_bbox': [x % logical_width, y % 88, x % logical_width + w, y % 88 + h]})
alpha = base.getchannel('A')
quant = base.convert('RGB').quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
quant.putalpha(alpha)
atlas = quant.resize((logical_width * 12 * 4, 704), Image.Resampling.NEAREST)
output.parent.mkdir(parents=True, exist_ok=True)
atlas.save(output, optimize=True)
summary = {
    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'source_size': list(im.size), 'rows': rows, 'columns': cols, 'cut_method': method,
    'discarded_small_component_pixels': discarded_pixels,
    'scale_all_frames': scale, 'target_idle_height': target_idle_height, 'output_size': list(atlas.size),
    'cell_size': [logical_width * 4, 352], 'resolution': 4, 'logical_cell': [logical_width, 88],
    'alpha_threshold': 128, 'palette_limit': 63, 'frames': frame_report,
    'note': 'Source is a generated image; all transformations use the same scale. Aligned visible bottoms are image-space only, not world-space or collision proof.'
}
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in summary.items() if k != 'frames'}, ensure_ascii=False))
