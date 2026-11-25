#!/usr/bin/env python3
"""Validate source atlas and the proposed 0-based frame lists; not a game test."""
import json
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
base = ROOT / 'public/art/stage8/enemies'
items = [('cabinet', 's8cabinet-draft', 24), ('researcher', 's8researcher-draft', 40)]
result = {}
for name, stem, count in items:
    m = json.loads((base / (stem + '.json')).read_text())
    image = Image.open(base / (stem + '.png'))
    assert image.mode == 'RGBA', f'{name}: not RGBA'
    arr = np.array(image)
    h, w = arr.shape[:2]
    fw, fh, cols = m['frameWidth'], m['frameHeight'], m['columns']
    assert w == fw * cols and h == fh * (count // cols), f'{name}: size mismatch'
    alpha = arr[:, :, 3]
    assert set(np.unique(alpha)).issubset({0, 255}), f'{name}: non-binary alpha'
    colors = len(np.unique(arr[alpha > 0, :3], axis=0))
    assert colors <= 64, f'{name}: {colors} colors'
    cells = []
    for n in range(count):
        x, y = n % cols * fw, n // cols * fh
        a = alpha[y:y+fh, x:x+fw]
        ys, xs = np.nonzero(a)
        assert len(xs) > 0, f'{name}: frame {n} empty'
        assert not (a[0,:].any() or a[-1,:].any() or a[:,0].any() or a[:,-1].any()), f'{name}: frame {n} touches border'
        cells.append({'frame': n, 'bbox_xyxy_inclusive': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]})
    anims = {}
    for key, anim in m['anims'].items():
        assert 'start' not in anim and 'count' not in anim, f'{name}/{key}: conflicting legacy fields'
        frames = anim['frames']
        assert frames and all(type(n) is int and 0 <= n < count for n in frames), f'{name}/{key}: bad frame index'
        assert isinstance(anim['fps'], (int, float)) and anim['fps'] > 0 and type(anim['loop']) is bool
        anims[key] = {'frames': frames, 'fps': anim['fps'], 'loop': anim['loop'], 'nominal_seconds': len(frames)/anim['fps']}
    result[name] = {'size': [w,h], 'colors': colors, 'alpha': sorted(map(int,np.unique(alpha))), 'cells': cells, 'anims': anims}

c = result['cabinet']['anims']; r = result['researcher']['anims']
assert c['warning']['frames'] == [8,9,9,9] and c['attack']['frames'] == [14,15,15,15]
assert r['board_warning']['frames'] == [7,7,7,7] and r['board_sweep']['frames'] == [8,9,10,11]
assert c['warning']['nominal_seconds'] == 1 and c['attack']['nominal_seconds'] == .5
assert r['board_warning']['nominal_seconds'] == 4/6 and r['board_sweep']['nominal_seconds'] == .5
assert all(x['bbox_xyxy_inclusive'][3] == 202 for x in result['researcher']['cells'])
placeholder = Image.open(ROOT / 'public/art/anim/triboss.png').convert('RGBA').crop((0,0,172,204))
p = np.asarray(placeholder)[:,:,3]; yy, _ = np.nonzero(p)
assert int(yy.max()) == 202
result['baseline'] = {'researcher_all_frames_lowest_visible_y': 202, 'stage7_current_placeholder_idle_lowest_visible_y': 202,
  'note': 'Sheet coordinates only; defeat lowest pixel may not be a shoe; no Phaser floor test.'}
result['limitations'] = ['Board-to-person ratios are not verified by bounding boxes or this script.',
 'Sequential preview is not gameplay timing, hitbox testing, or proof that a runtime reader supports frames.']
print(json.dumps(result, ensure_ascii=False, indent=2))
print('PASS: atlas integrity, explicit frame lists, nominal durations and sheet baseline')
