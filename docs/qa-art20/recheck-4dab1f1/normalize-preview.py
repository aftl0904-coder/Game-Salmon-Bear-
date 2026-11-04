#!/usr/bin/env python3
"""Test-only background resize/quantize; never writes source or game assets."""
import json, os
from pathlib import Path
import numpy as np
from PIL import Image

source = Path(os.environ.get('ART20_ROOT', '/tmp/salmon-art20-4dab-readonly')) / 'art-src/props/stage7'
out = Path(os.environ.get('QA_OUT', '/tmp/qa-art20-4dab'))
out.mkdir(parents=True, exist_ok=True)
result = {}
for name, width in [('corridor-mid', 560), ('training-mid', 318)]:
    original = Image.open(source / (name + '.png')).convert('RGB')
    # QA-only logical dimensions approximate 720->360 height, with odd widths rounded.
    normalized = original.resize((width, 360), Image.Resampling.NEAREST)
    normalized = normalized.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    a = np.array(normalized, dtype=np.int16)
    seam = np.abs(a[:, -1, :] - a[:, 0, :])
    internal = np.abs(a[:, 1:, :] - a[:, :-1, :])
    normalized.save(out / (name + '-qa-normalized.png'))
    result[name] = {'source_size': original.size, 'preview_size': normalized.size,
                    'visible_colors': len(normalized.getcolors(maxcolors=65536)),
                    'seam_mae': float(seam.mean()), 'within_adjacent_mae': float(internal.mean()),
                    'seam_p95': float(np.percentile(seam, 95))}
(out / 'normalized-metrics.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
