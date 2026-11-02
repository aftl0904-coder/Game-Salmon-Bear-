#!/usr/bin/env python3
"""ART-17 Batch N (大陸2世界地圖) → public/art/map/c2/*, plus the c2icons / walkDuo entries in data/anim/map-bike.json.
Run: python3 scripts/art/slice_c2map.py   (needs art-src/map/c2/*.png)"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask  # noqa: E402
from slice_batch04 import RES, blobs, cut, strip, groups_by_columns  # noqa: E402

def main():
    os.makedirs('public/art/map/c2', exist_ok=True)
    Image.open('art-src/map/c2/world-map-c2-dark.png').convert('RGB').save('public/art/map/c2/world-map-dark.png')
    Image.open('art-src/map/c2/world-map-c2-green.png').convert('RGB').save('public/art/map/c2/world-map-green.png')
    meta = json.load(open('data/anim/map-bike.json'))
    a = np.array(Image.open('art-src/map/c2/map-icons-c2.png').convert('RGB')); m = fg_mask(a)
    keep, lab = blobs(m, 0.3)
    frs = [cut(a, m & (lab == k), 32) for k in keep[:5]]
    sh, w, h = strip(frs); sh.save('public/art/map/c2/icons.png')
    meta['c2icons'] = {'frameWidth': w, 'frameHeight': h, 'count': len(frs), 'res': RES}
    a = np.array(Image.open('art-src/map/c2/map-walk-duo.png').convert('RGB')); m = fg_mask(a)
    frs = []
    for x0, x1 in groups_by_columns(m, 4):
        mm = np.zeros_like(m); mm[:, x0:x1] = m[:, x0:x1]
        frs.append(cut(a, mm, 30))
    sh, w, h = strip(frs); sh.save('public/art/map/c2/walk-duo.png')
    meta['walkDuo'] = {'frameWidth': w, 'frameHeight': h, 'count': 4, 'res': RES}
    json.dump(meta, open('data/anim/map-bike.json', 'w'), indent=2)
    print(json.dumps({k: meta[k] for k in ('icons', 'walk', 'c2icons', 'walkDuo')}))

if __name__ == '__main__':
    main()
