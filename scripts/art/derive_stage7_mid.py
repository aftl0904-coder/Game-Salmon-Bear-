#!/usr/bin/env python3
"""Derive the two reviewed #91 stage-7 mid backgrounds, without touching sources.

Usage: python3 scripts/art/derive_stage7_mid.py /path/to/4dab1f1-snapshot
Optional: --out /tmp/stage7-mid-check (for byte-for-byte reproduction).
Requires Pillow. Input SHA-256 and dimensions are verified before writing.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[2]
HEAD = '4dab1f198e2342201d54acdccf6bd0d518be92f6'
SPECS = {
    'corridor-mid.png': ((1119, 720), '935d607dbd51e1139877242a1706c9a9725d62cf9b9650a3992d6257ae065e14'),
    'training-mid.png': ((635, 720), '43d0917ec6dc30e7d2f7c46ec779a86d79515cbac5857a6f4b9bc66f49690c01'),
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'public/art/stage7')
    args = parser.parse_args()
    source = args.snapshot / 'art-src/props/stage7'
    images = {}
    # Validate everything before writing either output.
    for name, (size, expected_hash) in SPECS.items():
        path = source / name
        data = path.read_bytes()
        if sha256(data) != expected_hash:
            raise SystemExit(f'{name}: wrong source SHA-256: {sha256(data)}')
        with Image.open(path) as image:
            if image.size != size or image.mode != 'RGB':
                raise SystemExit(f'{name}: unexpected source size/mode: {image.size} {image.mode}')
            images[name] = image.copy()

    args.out.mkdir(parents=True, exist_ok=True)
    report = {'source_pr': 91, 'source_head': HEAD, 'pillow': pillow_version, 'files': []}
    for name, original in images.items():
        # 720 -> 360; half-pixel widths round upward to the nearest whole pixel.
        width = (original.width + 1) // 2
        result = original.resize((width, 360), Image.Resampling.NEAREST).quantize(
            colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        colors = len(result.convert('RGB').getcolors(maxcolors=65536))
        assert colors <= 64
        target = args.out / name
        result.save(target, optimize=True)
        report['files'].append({
            'source': name, 'source_size': list(original.size), 'source_sha256': SPECS[name][1],
            'output': name, 'output_size': [width, 360], 'output_sha256': sha256(target.read_bytes()),
            'visible_colors': colors, 'alpha': 'opaque',
            'method': 'height 720->360, width rounded half up; nearest resize, RGB median-cut <=64, no dithering',
        })
    (args.out / 'mid-manifest.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
