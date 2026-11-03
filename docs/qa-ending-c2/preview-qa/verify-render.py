#!/usr/bin/env python3
"""Match each captured game's rendered card to the ten public assets.

The scene draws the 300x169 image centred at (320,182) in a 640x360 game.
Downsample both the screenshot crop and each candidate to 80x45 RGB, then rank
by mean squared colour error. This check complements, not replaces, human visual
review. Requires Pillow and a PREVIEW_DIR containing the tested merge preview.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import os

here = Path(__file__).resolve().parent
preview = Path(os.environ.get('PREVIEW_DIR', '/tmp/salmon-ending-preview'))
assets = []
for n in range(1, 11):
    path = preview / 'public' / 'art' / 'story' / f'ending-c2-{n:02}.png'
    assets.append(Image.open(path).convert('RGB').resize((80, 45), Image.Resampling.BILINEAR))
lines = ['Rendered screenshot crop matched against all 10 public PNGs by RGB mean-squared error.',
         'Crop = game coordinates (170,97.5)-(470,266.5); source/screenshot resized to 80x45.']
failed = False
for mode in ('desktop-keyboard', 'mobile-touch'):
    for n in range(1, 11):
        im = Image.open(here / 'screenshots' / f'{mode}-{n:02}.jpg').convert('RGB')
        w, h = im.size
        crop = im.crop((round(w*170/640), round(h*97.5/360), round(w*470/640), round(h*266.5/360))).resize((80,45), Image.Resampling.BILINEAR)
        scores = []
        for i, a in enumerate(assets, 1):
            stat = ImageStat.Stat(ImageChops.difference(crop, a))
            mse = sum(stat.rms[k]**2 for k in range(3)) / 3
            scores.append((mse, i))
        scores.sort()
        match = scores[0][1] == n
        failed |= not match
        lines.append(f'{mode} {n:02}: best={scores[0][1]:02}, mse={scores[0][0]:.2f}, second={scores[1][1]:02}, second_mse={scores[1][0]:.2f}, {"PASS" if match else "FAIL"}')
lines.append(f'RESULT {"FAIL" if failed else "PASS"}')
text = '\n'.join(lines) + '\n'
(here / 'render-match.txt').write_text(text, encoding='utf-8')
print(text, end='')
raise SystemExit(1 if failed else 0)
