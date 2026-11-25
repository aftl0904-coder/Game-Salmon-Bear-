#!/usr/bin/env python3
"""Combine three 4x4 generated transparent sources into a 48-frame Boss atlas.

Usage: python3 prepare-boss.py source-a.png source-b.png source-c.png output.png report.json
All pixels originate in the inputs. Figures are split at transparent gaps or
8-connected silhouettes; detached foreground bits are assigned to the nearest
figure and no connected pixels are silently discarded.
"""
import hashlib
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

if len(sys.argv) != 6:
    raise SystemExit('usage: prepare-boss.py a.png b.png c.png output.png report.json')
sources = [Path(x) for x in sys.argv[1:4]]
output, report = map(Path, sys.argv[4:6])

def bands(active):
    result = []
    start = None
    for i, value in enumerate(active):
        if value and start is None:
            start = i
        elif not value and start is not None:
            result.append((start, i))
            start = None
    if start is not None:
        result.append((start, len(active)))
    return result

def get_components(mask):
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    parts = []
    for yy, xx in zip(*np.nonzero(mask)):
        if labels[yy, xx]:
            continue
        label = len(parts) + 1
        labels[yy, xx] = label
        queue = deque([(int(yy), int(xx))])
        n, x0, y0, x1, y1 = 0, w, h, 0, 0
        while queue:
            y, x = queue.popleft()
            n += 1
            x0, x1, y0, y1 = min(x0, x), max(x1, x + 1), min(y0, y), max(y1, y + 1)
            for dy, dx in ((-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = label
                    queue.append((ny, nx))
        parts.append({'label': label, 'pixels': n, 'bbox': [x0,y0,x1,y1]})
    return labels, parts

def bbox_distance(a, b):
    dx = max(b[0] - a[2], a[0] - b[2], 0)
    dy = max(b[1] - a[3], a[1] - b[3], 0)
    return dx * dx + dy * dy

frames, source_reports = [], []
for source in sources:
    rgba = np.asarray(Image.open(source).convert('RGBA')).copy()
    rgba[:,:,3] = np.where(rgba[:,:,3] >= 128, 255, 0).astype('uint8')
    mask = rgba[:,:,3] > 0
    rows, cols = bands(mask.any(axis=1)), bands(mask.any(axis=0))
    if len(rows) != 4:
        raise SystemExit(f'ERROR {source}: expected 4 separated rows; got {rows}')
    source_info = {'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'size': [rgba.shape[1],rgba.shape[0]], 'rows': rows, 'global_columns': cols, 'frames': []}
    for r, (top, bottom) in enumerate(rows):
        if len(cols) == 4:
            for left, right in cols:
                part = Image.fromarray(rgba[top:bottom,left:right], 'RGBA')
                box = part.getchannel('A').getbbox()
                if not box:
                    raise SystemExit(f'ERROR {source}: empty frame in row {r}')
                srcbox = [left+box[0],top+box[1],left+box[2],top+box[3]]
                frames.append((part.crop(box), srcbox))
                source_info['frames'].append({'bbox': srcbox, 'method': 'transparent column gap'})
        else:
            labels, comps = get_components(mask[top:bottom])
            major = sorted(comps, key=lambda p:p['pixels'], reverse=True)[:4]
            if len(major) != 4 or min(p['pixels'] for p in major) < 500:
                raise SystemExit(f'ERROR {source} row {r}: cannot identify four figures: {comps}')
            minor = [p for p in comps if p not in major]
            if minor and max(p['pixels'] for p in minor) > min(p['pixels'] for p in major) * 0.5:
                raise SystemExit(f'ERROR {source} row {r}: ambiguous detached component')
            major.sort(key=lambda p: (p['bbox'][0]+p['bbox'][2])/2)
            groups = [[p] for p in major]
            for bit in minor:
                index = min(range(4), key=lambda k: bbox_distance(bit['bbox'], major[k]['bbox']))
                groups[index].append(bit)
            for group in groups:
                x0 = min(p['bbox'][0] for p in group); y0 = min(p['bbox'][1] for p in group)
                x1 = max(p['bbox'][2] for p in group); y1 = max(p['bbox'][3] for p in group)
                lab = [p['label'] for p in group]
                crop = rgba[top+y0:top+y1,x0:x1].copy()
                crop[:,:,3] = np.where(np.isin(labels[y0:y1,x0:x1], lab), crop[:,:,3], 0)
                srcbox = [x0,top+y0,x1,top+y1]
                frames.append((Image.fromarray(crop, 'RGBA'), srcbox))
                source_info['frames'].append({'bbox': srcbox, 'method': 'connected figures and nearest detached components', 'component_sizes': [p['pixels'] for p in group]})
    source_reports.append(source_info)

if len(frames) != 48:
    raise SystemExit(f'ERROR: expected 48 frames, got {len(frames)}')
maxw = max(f.width for f,_ in frames)
maxh = max(f.height for f,_ in frames)
idleh = max(f.height for f,_ in frames[:4])
scale = min(72/idleh, 100/maxh, 120/maxw)
base = Image.new('RGBA',(128*12,112*4),(0,0,0,0))
frame_info = []
for i,(f,box) in enumerate(frames):
    w,h = max(1,round(f.width*scale)),max(1,round(f.height*scale))
    f = f.resize((w,h),Image.Resampling.NEAREST)
    x=(i%12)*128+(128-w)//2
    y=(i//12)*112+108-h
    base.alpha_composite(f,(x,y))
    frame_info.append({'frame':i,'source_bbox':box,'logical_size':[w,h],'logical_bbox':[x%128,y%112,x%128+w,y%112+h]})
alpha = base.getchannel('A')
quant = base.convert('RGB').quantize(colors=63,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGBA')
quant.putalpha(alpha)
atlas = quant.resize((128*12*2,112*4*2),Image.Resampling.NEAREST)
output.parent.mkdir(parents=True,exist_ok=True)
atlas.save(output,optimize=True)
result = {'sources':source_reports,'source_scale_all_frames':scale,'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'output_size':list(atlas.size),'cell_size':[256,224],'logical_cell':[128,112],'res':2,'alpha_threshold':128,'palette_limit':63,'frames':frame_info,'note':'Common scaling and aligned visible bottoms are asset-space only; runtime anchor, projectile and hitbox require integration testing.'}
report.parent.mkdir(parents=True,exist_ok=True)
report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'size':result['output_size'],'cell':result['cell_size'],'frames':len(frame_info),'common_scale':scale,'idle_logical_sizes':[x['logical_size'] for x in frame_info[:4]],'output_sha256':result['output_sha256']},ensure_ascii=False))
