#!/usr/bin/env python3
"""Story illustrations (art-src/story/*.png, 1280×720) → public/art/story/<name>.png at 640×360 logical (RES× pixels; the game marks them HD).
cover: the generator left a flat strip on top — crop to the forest and fit 640×360.
Run: python3 scripts/art/slice_story.py [art-root]"""
import sys, os, glob
from PIL import Image

RES = 2

def to_native(im, box=None):
    if box: im = im.crop(box)
    W, H = 640 * RES, 360 * RES
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.BOX if s <= 1 else Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    im = im.crop((x, y, x + W, y + H))
    return im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs('public/art/story', exist_ok=True)
    # stage backdrops (full-screen far layers)
    extra = [os.path.join(root, f) for f in ('art-src/props/stage2/canopy-far.png', 'art-src/props/stage3/market-far.png', 'art-src/props/stage3/hotspring-far.png',
                                              'art-src/props/stage5/hq-far.png', 'art-src/props/stage5/rooftop-far.png')]
    for f in sorted(glob.glob(os.path.join(root, 'art-src/story/*.png'))) + [e for e in extra if os.path.exists(e)]:
        name = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f).convert('RGB')
        box = (0, 232, im.width, im.height) if name == 'cover' else None
        to_native(im, box).save(f'public/art/story/{name}.png', optimize=True)
        print(name)

if __name__ == '__main__':
    main()
