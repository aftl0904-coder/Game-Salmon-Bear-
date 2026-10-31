#!/usr/bin/env python3
"""ART-16 ultimate-move FX sheets: art-src/{fx/light,anim/fx}/<name>.png (pure-black
background, uniform NxM grid per art-src/anim/manifest.json) → public/art/fx/<name>.png
with luminance keyed to alpha, ready for an ADD-blend Phaser spritesheet. Unlike
slice_fx.py (magenta-keyed, variable-size auto-crop) these sheets are already a clean
grid, so this is just the same key_black treatment slice_light.py uses for single
glow images, applied to the whole sheet at once (alpha is per-pixel, frame-boundary-safe).

Output goes into data/anim/fx.json — the SAME meta file slice_fx.py writes — so these
play through the existing fxAnims.ts (fxa-<name> / fxa-<name>-loop, playFx()) with zero
extra wiring. This script MERGES into the existing file rather than overwriting it, but
slice_fx.py itself still overwrites wholesale — if it's re-run after this, re-run this
script again afterwards to restore these 3 entries.
Run: python3 scripts/art/slice_ult_fx.py [art-root]
"""
import sys, os, json
from PIL import Image

# dest name → (art-src relative path, frame px, fps)
# ult-salmon-wave / ult-honey-slash were 20fps (0.3s total) at first ship — Cursor's
# round-2 device pass flagged the ultimate sweep as reading under 0.4s and not like a
# sweep; slowed to 14fps (~0.43s) and paired with a travel tween in GameScene.ts's
# playUltimateFx() so the existing 6-frame art actually crosses the screen instead of
# shrinking in place. Re-run this script after any re-slice to keep fx.json in sync.
JOBS = [
    ('charge-aura', 'fx/light/charge-aura.png', 128, 128, 12),
    ('ult-salmon-wave', 'anim/fx/ult-salmon-wave.png', 320, 160, 14),
    ('ult-honey-slash', 'anim/fx/ult-honey-slash.png', 320, 160, 14),
]


def key_black(im: Image.Image) -> Image.Image:
    """Art drawn on black: use luminance as alpha so it can be added over the scene."""
    im = im.convert('RGB')
    px = im.load()
    out = Image.new('RGBA', im.size)
    op = out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            a = max(r, g, b)
            op[x, y] = (r, g, b, a)
    return out


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    man = {m['file']: m for m in json.load(open(os.path.join(root, 'art-src/anim/manifest.json')))}
    os.makedirs('public/art/fx', exist_ok=True)
    fx_path = os.path.join(root, 'data/anim/fx.json')
    meta = json.load(open(fx_path)) if os.path.exists(fx_path) else {}
    for name, rel, fw, fh, fps in JOBS:
        src_rel = f'art-src/{rel}'
        if src_rel not in man:
            print('skip (not in manifest)', src_rel)
            continue
        entry = man[src_rel]
        src = os.path.join(root, src_rel)
        if not os.path.exists(src):
            print('skip (missing)', src_rel)
            continue
        im = Image.open(src)
        expect_w, expect_h = fw * entry['cols'], fh * entry['rows']
        if im.size != (expect_w, expect_h):
            print(f'WARNING {name}: sheet is {im.size}, manifest/JOBS expect {(expect_w, expect_h)}')
        out = key_black(im)
        dest = f'public/art/fx/{name}.png'
        out.save(dest)
        meta[name] = {'frameWidth': fw, 'frameHeight': fh, 'count': entry['frames'], 'fps': fps}
        print(f'{dest:32s} {out.width}x{out.height}  frame {fw}x{fh} x{entry["frames"]}')
    with open(fx_path, 'w') as f:
        json.dump(meta, f, indent=1)
    print('updated', fx_path)


if __name__ == '__main__':
    main()
