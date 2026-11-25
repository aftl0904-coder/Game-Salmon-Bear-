#!/usr/bin/env python3
"""Turn one AI background into the stage-8 640x360 RGB <=64-color format.

Source is retained externally; the report records hash and original dimensions.
No crop, distortion, new visual content, or dithering is introduced.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

if len(sys.argv) != 4:
    raise SystemExit('Usage: normalize.py SOURCE OUTPUT REPORT')
src, dest, report = map(Path, sys.argv[1:])
with Image.open(src) as image:
    original_mode = image.mode
    w, h = image.size
    if w * 9 != h * 16:
        raise SystemExit(f'Source is not 16:9; refusing crop or stretch: {w}x{h}')
    if 'A' in image.getbands() and image.getchannel('A').getextrema() != (255, 255):
        raise SystemExit('Source has transparency; expected opaque background')
    result = image.convert('RGB').resize((640, 360), Image.Resampling.NEAREST)
    result = result.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    dest.parent.mkdir(parents=True, exist_ok=True)
    result.save(dest, format='PNG', optimize=True)
with Image.open(dest) as result:
    colors = len(result.getcolors(640 * 360) or [])
    if result.size != (640, 360) or result.mode != 'RGB' or not 1 <= colors <= 64:
        raise SystemExit('Output validation failed')
    result.load()
    output_mode, output_size = result.mode, list(result.size)
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps({
    'source_name': src.name,
    'source_sha256': hashlib.sha256(src.read_bytes()).hexdigest(),
    'source_dimensions': [w,h],
    'source_mode': original_mode,
    'output': str(dest),
    'output_sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
    'output_dimensions': output_size,
    'output_mode': output_mode,
    'visible_colors': colors,
    'resize': 'proportional nearest-neighbor; no crop',
    'quantization': 'median cut, 64 colors, no dithering',
    'pass': True
}, indent=2, ensure_ascii=False)+'\n')
print(f'PASS {dest}: {output_size[0]}x{output_size[1]} {output_mode}, {colors} colors')
