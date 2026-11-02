#!/usr/bin/env python3
"""Gacha machine (art-src/props/gacha-machine.png, flat magenta bg) and capsule
strip (art-src/props/gacha-capsule-sheet.png, 5×64×64 cells on magenta) →
public/art/props/gacha-machine.png (cropped+scaled) and
public/art/props/gacha-capsules.png (5-frame spritesheet, cells kept intact
so Phaser can load it with frameWidth=64, frameHeight=64).
Run: python3 scripts/art/slice_gacha.py [art-root]"""
import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, downscale  # noqa: E402

RES = 2  # machine drawn at RES x; GachaScene marks it HD (heroAnims.markHd)
MACHINE_HEIGHT = 240

def quantize(rgba, soft=False):
    out = Image.fromarray(rgba, 'RGBA')
    alpha = out.split()[3]
    q = out.convert('RGB').quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha if soft else alpha.point(lambda v: 255 if v > 127 else 0))
    return q

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs('public/art/props', exist_ok=True)

    machine = Image.open(os.path.join(root, 'art-src/props/gacha-machine.png')).convert('RGB')
    a = np.array(machine)
    m = fg_mask(a)
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    C, A = downscale(a[y0:y1, x0:x1], m[y0:y1, x0:x1], MACHINE_HEIGHT * RES / (y1 - y0), True)
    rgba = np.dstack([C, (A * 255).astype(np.uint8)])
    q = quantize(rgba, True)
    W, H = q.size
    pad = Image.new('RGBA', (W + -W % RES, H + -H % RES), (0, 0, 0, 0)); pad.paste(q, (0, 0))
    pad.save('public/art/props/gacha-machine.png')
    print('gacha-machine', pad.size)

    sheet = Image.open(os.path.join(root, 'art-src/props/gacha-capsule-sheet.png')).convert('RGB')
    a = np.array(sheet)
    m = fg_mask(a)
    rgba = np.dstack([a, (m * 255).astype(np.uint8)])
    quantize(rgba).save('public/art/props/gacha-capsules.png')
    print('gacha-capsules', sheet.size)

if __name__ == '__main__':
    main()
