#!/usr/bin/env python3
"""Cut a 4x6 generated alpha sheet at real transparent gaps into an M8-style atlas.

Usage: python3 prepare-sheet.py source.png output.png report.json
This only cuts, resizes, aligns, quantizes and rearranges existing image content.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

if len(sys.argv) != 4:
    raise SystemExit('usage: prepare-sheet.py source.png output.png report.json')
source, output, report = map(Path, sys.argv[1:])
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

rows = bands(mask.any(axis=1))
cols = bands(mask.any(axis=0))
if len(rows) != 6 or len(cols) != 4:
    raise SystemExit(f'ERROR: expected six separated rows and four separated columns; got {rows=} {cols=}')
frames = []
for row, (top, bottom) in enumerate(rows):
    for col, (left, right) in enumerate(cols):
        part = img.crop((left, top, right, bottom))
        box = part.getchannel('A').getbbox()
        if not box:
            raise SystemExit(f'ERROR: empty frame {row=}, {col=}')
        frames.append((part.crop(box), [left + box[0], top + box[1], left + box[2], top + box[3]]))

maxw = max(frame.width for frame, _ in frames)
maxh = max(frame.height for frame, _ in frames)
# One common scale for all frames avoids visually resizing a character between poses.
scale = min(52 / maxw, 50 / maxh)
base = Image.new('RGBA', (64 * 12, 88 * 2), (0, 0, 0, 0))
frame_report = []
for idx, (frame, source_bbox) in enumerate(frames):
    w = max(1, round(frame.width * scale))
    h = max(1, round(frame.height * scale))
    small = frame.resize((w, h), Image.Resampling.NEAREST)
    x = (idx % 12) * 64 + (64 - w) // 2
    y = (idx // 12) * 88 + 84 - h
    base.alpha_composite(small, (x, y))
    frame_report.append({'frame': idx, 'source_bbox': source_bbox, 'logical_size': [w, h], 'logical_bbox': [x % 64, y % 88, x % 64 + w, y % 88 + h]})
alpha = base.getchannel('A')
quant = base.convert('RGB').quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
quant.putalpha(alpha)
atlas = quant.resize((3072, 704), Image.Resampling.NEAREST)
output.parent.mkdir(parents=True, exist_ok=True)
atlas.save(output, optimize=True)
summary = {
    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'source_size': list(im.size), 'rows': rows, 'columns': cols,
    'scale_all_frames': scale, 'output_size': list(atlas.size),
    'cell_size': [256, 352], 'resolution': 4, 'logical_cell': [64, 88],
    'alpha_threshold': 128, 'palette_limit': 63, 'frames': frame_report,
    'note': 'Source is a generated image; all transformations use the same scale. Aligned visible bottoms are image-space only, not world-space or collision proof.'
}
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in summary.items() if k != 'frames'}, ensure_ascii=False))
