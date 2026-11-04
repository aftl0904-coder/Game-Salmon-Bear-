#!/usr/bin/env python3
"""Read-only ART-20 stage7 image QA; writes only into this script's directory."""
from pathlib import Path
import os
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(os.environ.get('ART20_ROOT', '/tmp/salmon-art20-4dab-readonly')) / 'art-src/props/stage7'
OUT = Path(os.environ.get('QA_OUT', '/tmp/qa-art20-4dab'))
OUT.mkdir(parents=True, exist_ok=True)
MAGENTA = np.array([255, 0, 255], dtype=np.uint8)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image_metrics(path):
    im = Image.open(path)
    rgb = np.asarray(im.convert('RGB'))
    exact = np.all(rgb == MAGENTA, axis=2)
    # Tolerance is an investigative count, not proof that pixels are background.
    near = (rgb[:, :, 0] >= 240) & (rgb[:, :, 1] <= 15) & (rgb[:, :, 2] >= 240) & ~exact
    ys, xs = np.nonzero(~exact)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1] if len(xs) else None
    border = np.concatenate([rgb[0], rgb[-1], rgb[1:-1, 0], rgb[1:-1, -1]])
    return {'size': list(im.size), 'mode': im.mode, 'sha256': sha256(path),
            'metadata': {k: str(v) for k, v in im.info.items()},
            'unique_RGB_colors': int(len(np.unique(rgb.reshape(-1, 3), axis=0))),
            'exact_magenta_pixels': int(exact.sum()),
            'near_magenta_nonexact_pixels': int(near.sum()),
            'exact_magenta_border_pixels': int(np.all(border == MAGENTA, axis=1).sum()),
            'total_border_pixels': len(border),
            'non_exact_magenta_bbox_xyxy_exclusive': bbox}


def seam_metrics(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    a = np.asarray(im, dtype=np.int16)
    # No overlap, no mirror, no blending: end column of first copy touches first column of second.
    tiled = Image.new('RGB', (w*2, h))
    tiled.paste(im, (0, 0))
    tiled.paste(im, (w, 0))
    tiled.save(OUT / f'{path.stem}-repeat-2x.png')
    tiled.crop((w-256, 0, w+256, h)).save(OUT / f'{path.stem}-join-focus.png')
    detail = tiled.crop((w-100, 160, w+100, 650))
    detail.resize((400, 980), Image.Resampling.NEAREST).save(OUT / f'{path.stem}-join-detail-2x.png')
    seam = np.abs(a[:, -1, :] - a[:, 0, :])
    row_mae = seam.mean(axis=1)
    internal = np.abs(a[:, 1:, :] - a[:, :-1, :])
    column_mae = internal.mean(axis=(0, 2))
    return {'source_size': [w, h], 'join_x_in_repeat': w,
            'join_x_in_focus': 256,
            'seam_RGB_channel_MAE_0_255': float(seam.mean()),
            'seam_RGB_channel_absdiff_p95': float(np.percentile(seam, 95)),
            'seam_RGB_channel_absdiff_max': int(seam.max()),
            'seam_rows_exact_rgb_match_pct': float(np.mean(np.all(seam == 0, axis=1))*100),
            'seam_rows_avg_channel_absdiff_gt_10_pct': float(np.mean(row_mae > 10)*100),
            'seam_rows_avg_channel_absdiff_gt_30_pct': float(np.mean(row_mae > 30)*100),
            'within_image_adjacent_column_mean_MAE': float(column_mae.mean()),
            'within_image_adjacent_column_MAE_p50': float(np.percentile(column_mae, 50)),
            'within_image_adjacent_column_MAE_p95': float(np.percentile(column_mae, 95)),
            'within_image_adjacent_column_MAE_p99': float(np.percentile(column_mae, 99)),
            'fraction_internal_columns_lower_MAE_than_seam': float(np.mean(column_mae < seam.mean()))}


def main():
    result = {'snapshot_expected_head': '4dab1f198e2342201d54acdccf6bd0d518be92f6',
              'images': {p.name: image_metrics(p) for p in sorted(ROOT.glob('*.png'))},
              'seams': {name: seam_metrics(ROOT / name) for name in ('corridor-mid.png','training-mid.png')}}
    text = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    (OUT / 'metrics.json').write_text(text, encoding='utf-8')
    print(text)


if __name__ == '__main__':
    main()
