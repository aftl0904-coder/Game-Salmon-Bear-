#!/usr/bin/env python3
"""Replace four walk cells in the packed guard atlas using a 2x2 AI walk source.

Usage: python3 prepare-buildingguard.py base-atlas.png base-report.json walk-source.png output.png report.json
Uses only existing source pixels; alpha threshold, same scale within the walk cycle,
nearest-neighbour resizing and global palette quantization are recorded in report.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

if len(sys.argv) != 6:
    raise SystemExit('usage: prepare-buildingguard.py base.png base-report.json walk.png output.png report.json')
base, base_report, walk, output, report = map(Path, sys.argv[1:])
meta = json.loads(base_report.read_text())
im = Image.open(base).convert('RGBA')
assert im.size == (3072, 704)
arr = np.array(Image.open(walk).convert('RGBA'))
arr[:, :, 3] = np.where(arr[:, :, 3] >= 128, 255, 0)
mask = arr[:, :, 3] != 0

def bands(active):
    ans, start = [], None
    for i, v in enumerate(active):
        if v and start is None:
            start = i
        elif not v and start is not None:
            ans.append((start, i))
            start = None
    if start is not None:
        ans.append((start, len(active)))
    return ans
rows, cols = bands(mask.any(axis=1)), bands(mask.any(axis=0))
if len(rows) != 2 or len(cols) != 2:
    raise SystemExit(f'ERROR: walk source needs 2 transparent-separated rows and columns, got {rows=} {cols=}')
frames = []
for y0,y1 in rows:
    for x0,x1 in cols:
        cell = Image.fromarray(arr[y0:y1, x0:x1], 'RGBA')
        box = cell.getchannel('A').getbbox()
        if not box:
            raise SystemExit('ERROR: empty walk frame')
        frames.append((cell.crop(box), [x0+box[0], y0+box[1], x0+box[2], y0+box[3]]))
target_h = max(f['logical_size'][1] for f in meta['frames'][:4])
scale = min(target_h / max(f.height for f,_ in frames), 56 / max(f.width for f,_ in frames))
frame_reports = []
for i,(sprite, box) in enumerate(frames):
    w,h = round(sprite.width * scale), round(sprite.height * scale)
    sprite = sprite.resize((w,h), Image.Resampling.NEAREST).resize((w*4,h*4), Image.Resampling.NEAREST)
    x = (4+i)*256 + ((64-w)//2)*4
    y = (84-h)*4
    im.paste((0,0,0,0),((4+i)*256,0,(5+i)*256,352))
    im.alpha_composite(sprite,(x,y))
    frame_reports.append({'atlas_frame':4+i, 'source_bbox':box, 'logical_size':[w,h], 'logical_bbox':[(x//4)%64,y//4,(x//4)%64+w,y//4+h]})
alpha = im.getchannel('A')
quant = im.convert('RGB').quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
quant.putalpha(alpha)
output.parent.mkdir(parents=True,exist_ok=True)
quant.save(output,optimize=True)
result = {'base_atlas_sha256':hashlib.sha256(base.read_bytes()).hexdigest(), 'base_source_report':meta, 'walk_source':str(walk), 'walk_source_sha256':hashlib.sha256(walk.read_bytes()).hexdigest(), 'walk_rows':rows,'walk_columns':cols,'walk_scale_all_frames':scale,'walk_target_idle_height':target_h,'walk_frames':frame_reports,'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'note':'Walk and base sources use separate common scales to match idle height; visible baseline is not a runtime anchor. Two stride and two passing poses are not proof of anatomically alternating feet.'}
report.parent.mkdir(parents=True,exist_ok=True)
report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'walk_target_height':target_h,'walk_scale':scale,'walk_logical_sizes':[r['logical_size'] for r in frame_reports],'output_sha256':result['output_sha256']}))
