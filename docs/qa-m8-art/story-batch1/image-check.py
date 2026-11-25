#!/usr/bin/env python3
"""Verify story PNG dimensions, RGB mode and palette-size limit."""
import json, sys
from pathlib import Path
from PIL import Image

config = json.loads(Path(sys.argv[1]).read_text())
results = []
for item in config['items']:
    image = Image.open(item['path'])
    colors = image.convert('RGB').getcolors(maxcolors=1_000_000)
    count = len(colors) if colors is not None else None
    result = {
        'name': item['name'], 'path': item['path'], 'mode': image.mode,
        'size': list(image.size), 'visible_colors': count,
        'pass': image.format == 'PNG' and image.mode == 'RGB' and image.size == (1280, 720) and count is not None and count <= 128,
    }
    results.append(result)
print(json.dumps(results, ensure_ascii=False, indent=2))
sys.exit(0 if all(x['pass'] for x in results) else 1)
