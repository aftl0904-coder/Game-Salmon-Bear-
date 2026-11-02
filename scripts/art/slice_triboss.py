#!/usr/bin/env python3
"""Stage 5 boss △畝大佬: art-src/anim/boss/triboss/*.png (flat magenta, 1280×720, one
combined sheet per action) → public/art/anim/triboss.png + data/anim/triboss.json,
same atlas format as scripts/art/slice_anim.py (frameWidth/frameHeight/anims).

Unlike slice_anim.py's per-character CHARS table, this boss wears a plain dark suit with
no single colour patch that's reliable to key for cross-sheet scale (the usual trick:
measure a stable colour's blob area). All sheets were generated in one batch from the
same model-sheet reference, so instead this just fits each sheet's own standing/acting
height directly against the target — simpler, and the report line below is there to
eyeball before committing.

Run: python3 scripts/art/slice_triboss.py [art-root]
"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from slice_anim import fg_mask, split, downscale  # noqa: E402

OUT_IMG = 'public/art/anim/triboss.png'
OUT_JSON = 'data/anim/triboss.json'
SRC_DIR = 'art-src/anim/boss/triboss'
RES = 2  # frames drawn RES x bigger, shown at 1/RES (heroAnims.markHd)
MAX_SHEET_W = 4096
CELL_1X = (86, 102)  # keep the 1x logical cell so the boss body/offsets stay identical
HEIGHT = 100  # target standing height, px — adult businessman, taller than the 72px heroes

# anim name -> (source file stem, frame count, fps, loop)
ANIMS = {
    'idle': ('idle', 4, 6, True),
    'point': ('point', 3, 8, False),
    'rain': ('rain', 4, 6, True),
    'shield': ('shield', 4, 8, True),
    'hurt': ('hurt', 2, 10, False),
    'defeat': ('defeat', 5, 6, False),
    'unmask': ('unmask', 5, 7, False),
}

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs('public/art/anim', exist_ok=True)
    os.makedirs('data/anim', exist_ok=True)

    from PIL import Image

    def load_frames(stem, n):
        path = os.path.join(root, SRC_DIR, f'{stem}.png')
        if not os.path.exists(path):
            print(f'✗ missing {path}'); sys.exit(1)
        a = np.array(Image.open(path).convert('RGB'))
        m = fg_mask(a)
        frs = []
        for (x0, x1) in split(m, n):
            sm = m[:, x0:x1]
            colsum = sm.sum(0); rowsum = sm.sum(1)
            ys, xs = np.where(sm & (rowsum[:, None] > 0) & (colsum[None, :] > 1))
            if not len(ys):
                continue
            by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            frs.append((a[by0:by1, x0 + bx0:x0 + bx1], sm[by0:by1, bx0:bx1]))
        return frs

    # Reference scale from 'idle' (standing upright in every frame) — reused for every
    # other anim rather than fitting each sheet's own median height. A per-sheet fit
    # breaks on anything that isn't standing upright throughout (defeat crouches lower
    # across its 5 frames, so its own median height undershoots and over-scales it).
    idle_frs = load_frames(ANIMS['idle'][0], ANIMS['idle'][1])
    ref_h = float(np.median([m_.shape[0] for _, m_ in idle_frs]))
    ref_scale = HEIGHT * RES / ref_h

    sheets = {}
    report = {}
    for anim, (stem, n, fps, loop) in ANIMS.items():
        frs = idle_frs if anim == 'idle' else load_frames(stem, n)
        scaled = [downscale(rgb, m_, ref_scale, True) for rgb, m_ in frs]
        sheets[anim] = scaled
        report[anim] = (round(ref_scale, 4), len(frs))

    # anchor: x = median of lower-45% foreground (legs), y = bottom — same as slice_anim.py
    items = []
    for anim, (_, n, fps, loop) in ANIMS.items():
        for C, A in sheets[anim]:
            h, w = A.shape
            ys, xs = np.where(A[int(h * 0.55):])
            ax = int(np.median(xs)) if len(xs) else w // 2
            items.append((anim, C, A, ax))

    half = max(max(ax for _, _, _, ax in items), max(A.shape[1] - ax for _, _, A, ax in items)) + 2
    cw = max(half * 2, CELL_1X[0] * RES)
    chh = max(max(A.shape[0] for _, _, A, _ in items) + 2, CELL_1X[1] * RES)
    cw += -cw % RES
    chh += -chh % RES
    left = cw // 2
    cols = max(1, min(len(items), MAX_SHEET_W // cw))
    rows = -(-len(items) // cols)
    sheet = Image.new('RGBA', (cw * cols, chh * rows), (0, 0, 0, 0))
    anims = {}
    i = 0
    for anim, C, A, ax in items:
        h, w = A.shape
        rgba = np.dstack([C, (A * 255).astype(np.uint8)])
        tile = Image.fromarray(rgba, 'RGBA')
        sheet.paste(tile, ((i % cols) * cw + left - ax, (i // cols) * chh + chh - 1 - h))
        anims.setdefault(anim, {'start': i, 'count': 0})
        anims[anim]['count'] += 1
        i += 1

    alpha = sheet.split()[3]
    q = sheet.convert('RGB').quantize(colors=56 * RES, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q.putalpha(alpha)
    q.save(OUT_IMG, optimize=True)

    for anim, (_, n, fps, loop) in ANIMS.items():
        if anim in anims:
            anims[anim].update(fps=fps, loop=loop)
    json.dump({'frameWidth': cw, 'frameHeight': chh, 'anchorX': left, 'res': RES, 'columns': cols, 'cell1x': list(CELL_1X), 'anims': anims}, open(OUT_JSON, 'w'), indent=1)
    print('triboss cell', cw, chh, 'frames', i)
    print('scale report (factor, frames)', report)

if __name__ == '__main__':
    main()
