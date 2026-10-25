#!/usr/bin/env python3
"""Nearest-scale sprites to bible heights, ≤32 palette, binary alpha, 1px outline."""
from __future__ import annotations

import json
import math
import os
from PIL import Image, ImageDraw, ImageEnhance

ART = "/workspace/public/art"
ARTIFACTS = "/opt/cursor/artifacts/qa-visual-unify"
OUT_DOCS = "/workspace/docs/bible"
TARGETS = {
    "salmon-boy.png": {"h": 48, "role": "hero"},
    "bear-girl.png": {"h": 48, "role": "hero"},
    "kind-bear.png": {"h": 40, "role": "pet"},
    "fish-enemy.png": {"h": 32, "role": "enemy-small"},
    "coin.png": {"h": 20, "role": "item"},
}
WALLPAPERS = {
    "bg-wallpaper.jpg": {"maxW": 640, "maxH": 360, "desaturate": 0.35},
    "bg-sky-wallpaper.jpg": {"maxW": 480, "maxH": 160, "desaturate": 0.45},
}
PALETTE_N = 32
ALPHA_CUT = 90
OUTLINE = (18, 14, 12, 255)


def ensure_rgba(im: Image.Image) -> Image.Image:
    return im.convert("RGBA")


def binary_alpha(im: Image.Image, cut: int = ALPHA_CUT) -> Image.Image:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0 if a < cut else 255)
    return im


def nearest_fit_height(im: Image.Image, th: int) -> Image.Image:
    w, h = im.size
    if h == th:
        return im
    nw = max(1, int(round(w * (th / h))))
    return im.resize((nw, th), Image.Resampling.NEAREST)


def add_outline_1px(im: Image.Image, ink=OUTLINE) -> Image.Image:
    w, h = im.size
    src = im.load()
    opaque = [[src[x, y][3] >= 128 for x in range(w)] for y in range(h)]
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if not opaque[y][x]:
                continue
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h or not opaque[ny][nx]:
                        ox, oy = nx + 1, ny + 1
                        if 0 <= ox < w + 2 and 0 <= oy < h + 2 and opx[ox, oy][3] < 128:
                            opx[ox, oy] = ink
    for y in range(h):
        for x in range(w):
            if opaque[y][x]:
                opx[x + 1, y + 1] = src[x, y]
    return out


def collect_colors(im: Image.Image, bag: list, limit_sample: int = 8000) -> None:
    px = im.load()
    w, h = im.size
    step = max(1, int(math.sqrt((w * h) / limit_sample)))
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            bag.append((r, g, b))


def median_cut(colors: list, n: int) -> list:
    if not colors:
        return [(0, 0, 0)]
    uniq = list({c: 1 for c in colors}.keys())
    if len(uniq) <= n:
        return uniq
    im = Image.new("RGB", (len(uniq), 1))
    im.putdata(uniq)
    q = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: n * 3]
    return [(pal[i], pal[i + 1], pal[i + 2]) for i in range(0, len(pal), 3)][:n]


def apply_palette(im: Image.Image, palette: list) -> Image.Image:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            best = palette[0]
            best_d = 1e18
            for pr, pg, pb in palette:
                d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
                if d < best_d:
                    best_d = d
                    best = (pr, pg, pb)
            px[x, y] = (*best, 255)
    return im


def desaturate(im: Image.Image, amount: float) -> Image.Image:
    enh = ImageEnhance.Color(im.convert("RGB"))
    rgb = enh.enhance(max(0.0, 1.0 - amount))
    a = im.split()[-1]
    out = rgb.convert("RGBA")
    out.putalpha(a)
    return out


def main() -> None:
    os.makedirs(os.path.join(ARTIFACTS, "normalize-before"), exist_ok=True)
    os.makedirs(os.path.join(ARTIFACTS, "normalize-after"), exist_ok=True)
    os.makedirs(OUT_DOCS, exist_ok=True)

    bag: list = []
    for name in TARGETS:
        p = os.path.join(ART, name)
        if os.path.exists(p):
            collect_colors(ensure_rgba(Image.open(p)), bag)
    for name in WALLPAPERS:
        p = os.path.join(ART, name)
        if os.path.exists(p):
            collect_colors(ensure_rgba(Image.open(p)), bag)

    palette = median_cut(bag, PALETTE_N)
    if (18, 14, 12) not in palette:
        palette[0] = (18, 14, 12)

    with open(os.path.join(OUT_DOCS, "palette.json"), "w") as f:
        json.dump({"n": len(palette), "rgb": palette}, f, indent=2)

    report: dict = {"paletteN": len(palette), "files": []}

    for name, spec in TARGETS.items():
        src_path = os.path.join(ART, name)
        if not os.path.exists(src_path):
            report["files"].append({"name": name, "error": "missing"})
            continue
        before = ensure_rgba(Image.open(src_path))
        before.save(os.path.join(ARTIFACTS, "normalize-before", name))
        # Scale + palette + binary alpha only — 1px outline is BootScene thickenSpriteOutline.
        im = binary_alpha(before)
        im = nearest_fit_height(im, spec["h"])
        im = apply_palette(im, palette)
        im = binary_alpha(im)
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
        if im.size[1] != spec["h"]:
            im = nearest_fit_height(im, spec["h"])
            im = binary_alpha(im)
        w, h = im.size
        if w % 2 or h % 2:
            canvas = Image.new("RGBA", (w + (w % 2), h + (h % 2)), (0, 0, 0, 0))
            canvas.paste(im, (0, 0))
            im = canvas
        im.save(src_path, "PNG")
        im.save(os.path.join(ARTIFACTS, "normalize-after", name))
        report["files"].append(
            {"name": name, "role": spec["role"], "targetH": spec["h"], "out": list(im.size)}
        )

    for name, spec in WALLPAPERS.items():
        p = os.path.join(ART, name)
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        im.save(os.path.join(ARTIFACTS, "normalize-before", name.replace(".jpg", ".png")))
        im = desaturate(im, spec["desaturate"])
        w, h = im.size
        scale = min(spec["maxW"] / w, spec["maxH"] / h, 1.0)
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        im = im.resize((nw, nh), Image.Resampling.NEAREST)
        im = apply_palette(im, palette)
        rgb = Image.new("RGB", im.size, (26, 20, 32))
        rgb.paste(im, mask=im.split()[-1])
        rgb.save(p, "JPEG", quality=82)
        rgb.save(os.path.join(ARTIFACTS, "normalize-after", name.replace(".jpg", ".png")))
        report["files"].append({"name": name, "role": "bg", "out": list(rgb.size)})

    cells, labels = [], []
    for name, spec in TARGETS.items():
        ap = os.path.join(ARTIFACTS, "normalize-after", name)
        if os.path.exists(ap):
            cells.append(Image.open(ap).convert("RGBA"))
            labels.append(f"{name} h={spec['h']}")

    cell_w, cell_h = 100, 120
    cols = min(5, max(1, len(cells)))
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w + 8, rows * cell_h + 8), (26, 20, 32, 255))
    draw = ImageDraw.Draw(sheet)
    for i, im in enumerate(cells):
        cx = (i % cols) * cell_w + 4
        cy = (i // cols) * cell_h + 4
        sw, sh = im.size
        ox = cx + (cell_w - 8 - sw) // 2
        oy = cy + 4 + max(0, (cell_h - 28 - sh) // 2)
        sheet.paste(im, (ox, oy), im)
        draw.text((cx + 2, cy + cell_h - 22), labels[i][:22], fill=(255, 224, 138, 255))

    sheet_path = os.path.join(ARTIFACTS, "contact_sheet.png")
    sheet.save(sheet_path)
    report["contactSheet"] = sheet_path
    with open(os.path.join(ARTIFACTS, "normalize-report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
