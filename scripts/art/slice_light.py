#!/usr/bin/env python3
"""Lighting, shadow and UI frames: already-transparent art-src images
→ public/art/fx/* and public/art/ui/* at game resolution.
Run: python3 scripts/art/slice_light.py"""
import os
from PIL import Image

# relative path → (target width, out path)
JOBS = [
    ('fx/shadow/shadow-soft.png', 40, 'fx/shadow-soft.png'),
    ('fx/shadow/shadow-tight.png', 28, 'fx/shadow-tight.png'),
    ('fx/shadow/shadow-long.png', 64, 'fx/shadow-long.png'),
    ('fx/light/glow-round.png', 128, 'fx/glow-round.png'),
    ('fx/light/glow-cone.png', 160, 'fx/glow-cone.png'),
    ('fx/light/glow-ring.png', 96, 'fx/glow-ring.png'),
    ('fx/light/vignette.png', 640, 'fx/vignette.png'),
    ('fx/weather/fog-band.png', 320, 'fx/fog-band.png'),
    ('fx/weather/mist-puff.png', 64, 'fx/mist-puff.png'),
    ('fx/weather/rain-sheet.png', 320, 'fx/rain-sheet.png'),
    ('ui/panel-9slice.png', 96, 'ui/panel-9slice.png'),
    ('ui/panel-dark-9slice.png', 96, 'ui/panel-dark-9slice.png'),
    ('ui/pip.png', 24, 'ui/pip.png'),
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
    for rel, target, dest in JOBS:
        src = os.path.join('art-src', rel)
        if not os.path.exists(src):
            print('skip (missing)', rel)
            continue
        im = Image.open(src)
        if im.mode != 'RGBA' or im.getchannel('A').getextrema()[0] == 255:
            im = key_black(im) if rel.startswith('fx/') else im.convert('RGBA')
        s = target / im.width
        if s < 1:
            im = im.resize((target, max(1, round(im.height * s))), Image.Resampling.LANCZOS)
        out = os.path.join('public/art', dest)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out)
        print(f'{dest:28s} {im.width}x{im.height}')


if __name__ == '__main__':
    main()
