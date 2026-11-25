#!/usr/bin/env python3
"""
art-props-1: hand-pixelled minigame props (deterministic PIL).

Run from repo root:
  python3 scripts/art/gen_minigame_props.py

Writes public/art/minigames/*.png (+ *.json for sheets) and a preview strip.
SNES-ish: dark outline, 2–3 shade layers, no brand marks.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "art" / "minigames"
PREVIEW = OUT / "_preview-all.png"

OUTLINE = (34, 22, 16, 255)
INK = OUTLINE


def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def outline(im: Image.Image, col=OUTLINE) -> None:
    px = im.load()
    W, H = im.size
    src = im.copy().load()
    for y in range(H):
        for x in range(W):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and src[nx, ny][3]:
                    px[x, y] = col
                    break


def put(im: Image.Image, pts, col) -> None:
    px = im.load()
    W, H = im.size
    for x, y in pts:
        if 0 <= x < W and 0 <= y < H:
            px[x, y] = col


def fill_rect(im: Image.Image, box, col) -> None:
    ImageDraw.Draw(im).rectangle(box, fill=col)


def fill_ellipse(im: Image.Image, box, col) -> None:
    ImageDraw.Draw(im).ellipse(box, fill=col)


def shade_disk(im: Image.Image, cx, cy, r, lit, mid, dark, rim=OUTLINE) -> None:
    px = im.load()
    W, H = im.size
    for y in range(max(0, cy - r - 1), min(H, cy + r + 2)):
        for x in range(max(0, cx - r - 1), min(W, cx + r + 2)):
            dx, dy = x - cx, y - cy
            d = (dx * dx + dy * dy) ** 0.5
            if d > r + 0.6:
                continue
            if d > r - 0.4:
                px[x, y] = rim
            else:
                lit_k = (-dx - dy) / (2 * r)
                px[x, y] = lit if lit_k > 0.28 else (mid if lit_k > -0.12 else dark)


def save_sheet(name: str, frames: list[Image.Image], anim: dict, fps: int = 6, loop: bool = True) -> None:
    fw, fh = frames[0].size
    sheet = new(fw * len(frames), fh)
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * fw, 0), fr)
    path = OUT / f"{name}.png"
    sheet.save(path)
    meta = {
        "frameWidth": fw,
        "frameHeight": fh,
        "columns": len(frames),
        "anims": {
            anim.get("key", "idle"): {
                "label": anim.get("label", "idle"),
                "start": 0,
                "count": len(frames),
                "fps": fps,
                "loop": loop,
            }
        },
    }
    (OUT / f"{name}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("sheet", path.name, fw, fh, "x", len(frames))


def save_still(name: str, im: Image.Image) -> None:
    path = OUT / f"{name}.png"
    im.save(path)
    print("still", path.name, im.size)


# ── 1. Salmon + knife ───────────────────────────────────────────────────

def salmon_frame(tilt: int = 0) -> Image.Image:
    """Side-view salmon; tilt shifts body for swim cycle."""
    W, H = 40, 24
    im = new(W, H)
    d = ImageDraw.Draw(im)
    BODY = (232, 118, 92, 255)
    # body
    y0 = 6 + tilt
    d.ellipse((8, y0, 32, y0 + 12), fill=BODY)
    d.polygon([(4, y0 + 2), (10, y0 + 6), (4, y0 + 10)], fill=BODY)  # tail
    d.polygon([(18, y0 - 1), (24, y0 - 3 + tilt), (25, y0 + 2)], fill=BODY)  # dorsal
    # shade
    px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y] != BODY:
                continue
            k = (x / W) * 0.5 + (y / H) * 0.5
            if k < 0.38:
                px[x, y] = (255, 176, 140, 255)
            elif k > 0.72:
                px[x, y] = (186, 78, 58, 255)
    # belly stripe + eye + gill
    for x in range(12, 28):
        if px[x, y0 + 9][3]:
            px[x, y0 + 9] = (255, 210, 180, 255)
    px[28, y0 + 4] = (20, 14, 12, 255)
    px[29, y0 + 4] = (255, 240, 220, 255)
    for y in range(y0 + 3, y0 + 9):
        if px[22, y][3]:
            px[22, y] = (168, 64, 48, 255)
    outline(im)
    return im


def salmon_half(side: str) -> Image.Image:
    W, H = 22, 18
    im = new(W, H)
    d = ImageDraw.Draw(im)
    FLESH = (255, 150, 110, 255)
    SKIN = (210, 96, 72, 255)
    BONE = (255, 236, 210, 255)
    if side == "left":
        d.ellipse((2, 3, 18, 15), fill=FLESH)
        d.polygon([(1, 5), (6, 9), (1, 13)], fill=SKIN)
        for x in range(8, 16):
            im.putpixel((x, 9), BONE)
    else:
        d.ellipse((4, 3, 20, 15), fill=FLESH)
        d.polygon([(16, 4), (21, 9), (16, 14)], fill=SKIN)
        for x in range(6, 14):
            im.putpixel((x, 9), BONE)
    # shade flesh
    px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y] == FLESH:
                px[x, y] = (255, 176, 140, 255) if y < 8 else (230, 118, 88, 255)
    outline(im)
    return im


def knife() -> Image.Image:
    W, H = 28, 12
    im = new(W, H)
    d = ImageDraw.Draw(im)
    BLADE = (210, 220, 230, 255)
    d.polygon([(2, 5), (18, 3), (18, 8), (2, 7)], fill=BLADE)
    # blade shade
    px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y] == BLADE and y >= 6:
                px[x, y] = (150, 162, 176, 255)
            elif px[x, y] == BLADE and y <= 4:
                px[x, y] = (236, 242, 248, 255)
    # handle
    d.rectangle((18, 4, 26, 9), fill=(120, 72, 40, 255))
    for x in range(19, 26):
        px[x, 5] = (168, 110, 64, 255)
        px[x, 8] = (86, 48, 28, 255)
    outline(im)
    return im


# ── 2. Lab bottles + smoke ──────────────────────────────────────────────

def tube(level: str) -> Image.Image:
    """level: empty | half | full"""
    W, H = 16, 32
    im = new(W, H)
    d = ImageDraw.Draw(im)
    GLASS = (190, 220, 230, 255)
    # tube body
    d.rectangle((5, 4, 11, 28), fill=GLASS)
    d.ellipse((5, 26, 11, 30), fill=GLASS)
    # rim
    d.rectangle((4, 2, 12, 5), fill=(160, 190, 200, 255))
    px = im.load()
    # glass highlight / shade
    for y in range(4, 28):
        if px[6, y][3]:
            px[6, y] = (230, 244, 248, 255)
        if px[10, y][3]:
            px[10, y] = (140, 170, 184, 255)
    honey = (240, 170, 40, 255)
    honey_d = (186, 120, 22, 255)
    honey_l = (255, 210, 110, 255)
    if level == "half":
        y0 = 16
    elif level == "full":
        y0 = 7
    else:
        y0 = 99
    for y in range(y0, 29):
        for x in range(6, 11):
            if px[x, y][3]:
                k = (y - y0) / 20
                px[x, y] = honey_l if k < 0.25 else (honey if k < 0.7 else honey_d)
    # meniscus
    if level != "empty":
        for x in range(6, 11):
            px[x, y0] = (255, 230, 160, 255)
    outline(im)
    return im


def jar(kind: str) -> Image.Image:
    """honey | pollen | water"""
    W, H = 22, 28
    im = new(W, H)
    d = ImageDraw.Draw(im)
    if kind == "honey":
        fill, lit, dark = (220, 150, 36, 255), (255, 200, 90, 255), (160, 96, 20, 255)
        lid = (140, 90, 40, 255)
    elif kind == "pollen":
        fill, lit, dark = (240, 200, 70, 255), (255, 236, 140, 255), (190, 150, 40, 255)
        lid = (90, 140, 70, 255)
    else:
        fill, lit, dark = (110, 180, 220, 255), (180, 220, 240, 255), (60, 120, 160, 255)
        lid = (90, 110, 130, 255)
    d.rectangle((4, 8, 17, 24), fill=fill)
    d.ellipse((4, 20, 17, 26), fill=fill)
    d.rectangle((5, 4, 16, 9), fill=lid)
    d.rectangle((7, 2, 14, 5), fill=lid)
    px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y] == fill:
                u = (x - 4) / 13
                px[x, y] = lit if u < 0.3 else (fill if u < 0.7 else dark)
            elif px[x, y] == lid and y <= 5:
                px[x, y] = (min(255, lid[0] + 40), min(255, lid[1] + 30), min(255, lid[2] + 20), 255)
    # label band (generic, no logo)
    for x in range(6, 16):
        px[x, 14] = (255, 244, 220, 255)
        px[x, 15] = (230, 210, 170, 255)
    outline(im)
    return im


def smoke_frame(i: int) -> Image.Image:
    W, H = 28, 28
    im = new(W, H)
    # rising puffs, frame shifts upward / spreads
    centers = [
        [(14, 20), (10, 16), (18, 17)],
        [(14, 14), (8, 12), (19, 11), (14, 18)],
        [(14, 8), (7, 10), (20, 9), (12, 14), (16, 13)],
    ][i]
    for cx, cy in centers:
        r = 4 + (i % 2)
        shade_disk(im, cx, cy, r, (220, 220, 228, 180), (170, 170, 180, 160), (120, 120, 130, 140), rim=(80, 80, 90, 200))
    return im


# ── 3. Kite, bird, wire ─────────────────────────────────────────────────

def kite_frame(sway: int) -> Image.Image:
    W, H = 28, 32
    im = new(W, H)
    d = ImageDraw.Draw(im)
    ox = sway  # -1 / +1
    # diamond
    pts = [(14 + ox, 2), (24 + ox, 12), (14 + ox, 22), (4 + ox, 12)]
    d.polygon(pts, fill=(220, 70, 70, 255))
    px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y] == (220, 70, 70, 255):
                # cross panels
                if (x - (14 + ox)) * (y - 12) > 0:
                    px[x, y] = (255, 140, 90, 255) if y < 12 else (180, 40, 50, 255)
                else:
                    px[x, y] = (255, 200, 80, 255) if y < 12 else (200, 60, 60, 255)
    # spine
    for y in range(3, 22):
        px[14 + ox, y] = (255, 230, 180, 255)
    for x in range(5 + ox, 24 + ox):
        if 0 <= x < W:
            px[x, 12] = (255, 230, 180, 255)
    # tail
    for i, (tx, ty) in enumerate([(14 + ox, 23), (12 + ox - sway, 26), (16 + ox + sway, 29)]):
        if 0 <= tx < W and 0 <= ty < H:
            px[tx, ty] = (255, 210, 80, 255)
            if tx + 1 < W:
                px[tx + 1, ty] = (240, 100, 60, 255)
    outline(im)
    return im


def bird_frame(wing_up: bool) -> Image.Image:
    W, H = 24, 20
    im = new(W, H)
    d = ImageDraw.Draw(im)
    BODY = (70, 120, 180, 255)
    d.ellipse((6, 8, 18, 16), fill=BODY)
    d.ellipse((15, 6, 21, 12), fill=BODY)  # head
    # beak
    d.polygon([(21, 8), (24, 9), (21, 11)], fill=(240, 170, 50, 255))
    # wing
    if wing_up:
        d.polygon([(8, 10), (4, 2), (14, 8)], fill=(100, 160, 210, 255))
    else:
        d.polygon([(8, 10), (3, 16), (14, 12)], fill=(100, 160, 210, 255))
    px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y] == BODY and y >= 12:
                px[x, y] = (40, 80, 130, 255)
            elif px[x, y] == BODY and x >= 17:
                px[x, y] = (120, 170, 220, 255)
    px[19, 8] = (20, 16, 14, 255)
    # feet
    px[10, 16] = (200, 120, 40, 255)
    px[14, 16] = (200, 120, 40, 255)
    outline(im)
    return im


def wire() -> Image.Image:
    W, H = 48, 16
    im = new(W, H)
    px = im.load()
    # sagging cable between two posts
    for x in range(4, 44):
        t = (x - 4) / 40
        y = int(3 + 8 * (4 * t * (1 - t)))  # parabola
        px[x, y] = (60, 60, 70, 255)
        px[x, y + 1] = (110, 110, 120, 255)
    # posts
    for y in range(2, 14):
        px[3, y] = (90, 70, 50, 255)
        px[44, y] = (90, 70, 50, 255)
        px[4, y] = (140, 110, 70, 255)
        px[45, y] = (140, 110, 70, 255)
    outline(im)
    return im


# ── 4. Wheel, driftwood, wave, pier ─────────────────────────────────────

def wheel_frame(tilt: int) -> Image.Image:
    W, H = 24, 24
    im = new(W, H)
    cx, cy, r = 12, 12, 9
    shade_disk(im, cx, cy, r, (180, 140, 90, 255), (140, 100, 60, 255), (90, 60, 35, 255))
    px = im.load()
    # hub
    shade_disk(im, cx, cy, 2, (220, 200, 160, 255), (180, 150, 100, 255), (120, 90, 50, 255))
    # spokes (tilt rotates pattern)
    for a in range(4):
        import math

        ang = (a * 45 + tilt * 12) * math.pi / 180
        for dist in range(3, 9):
            x = int(cx + dist * math.cos(ang))
            y = int(cy + dist * math.sin(ang))
            if 0 <= x < W and 0 <= y < H and px[x, y][3]:
                px[x, y] = (70, 48, 28, 255)
    outline(im)
    return im


def driftwood() -> Image.Image:
    W, H = 36, 14
    im = new(W, H)
    d = ImageDraw.Draw(im)
    WOOD = (160, 118, 70, 255)
    d.ellipse((2, 3, 34, 11), fill=WOOD)
    px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y] != WOOD:
                continue
            px[x, y] = (200, 160, 100, 255) if y < 6 else (120, 80, 45, 255)
            if x % 7 == 2:
                px[x, y] = (90, 60, 35, 255)
    outline(im)
    return im


def wave_frame(i: int) -> Image.Image:
    W, H = 48, 24
    im = new(W, H)
    px = im.load()
    # rising crest
    crest = 10 + i * 3
    for x in range(W):
        t = x / (W - 1)
        # sine-ish crest
        import math

        y_crest = int(crest - 6 * math.sin(t * math.pi) - i)
        for y in range(y_crest, H):
            depth = (y - y_crest) / max(1, H - y_crest)
            if depth < 0.25:
                col = (200, 230, 245, 255)
            elif depth < 0.55:
                col = (80, 150, 200, 255)
            else:
                col = (30, 80, 140, 255)
            px[x, y] = col
        # foam tip
        if 0 <= y_crest < H:
            px[x, y_crest] = (240, 250, 255, 255)
            if y_crest + 1 < H:
                px[x, y_crest + 1] = (180, 220, 240, 255)
    outline(im)
    return im


def pier() -> Image.Image:
    W, H = 48, 28
    im = new(W, H)
    d = ImageDraw.Draw(im)
    # deck
    d.rectangle((2, 8, 45, 14), fill=(150, 110, 60, 255))
    px = im.load()
    for x in range(2, 46):
        px[x, 9] = (190, 150, 90, 255)
        px[x, 13] = (100, 70, 40, 255)
        if x % 4 == 0:
            for y in range(8, 15):
                px[x, y] = (80, 55, 30, 255)
    # piles
    for x in (6, 22, 38):
        for y in range(14, 26):
            px[x, y] = (110, 80, 45, 255)
            px[x + 1, y] = (160, 120, 70, 255)
            px[x + 2, y] = (90, 60, 35, 255)
    # water line under
    for x in range(0, W):
        px[x, 25] = (60, 120, 170, 180)
        if x % 3:
            px[x, 26] = (40, 90, 140, 160)
    outline(im)
    return im


# ── 5. Searchlight + box ────────────────────────────────────────────────

def searchlight_cone() -> Image.Image:
    W, H = 40, 36
    im = new(W, H)
    px = im.load()
    # lamp housing top-center
    for y in range(2, 8):
        for x in range(16, 24):
            px[x, y] = (70, 70, 80, 255) if y > 4 else (120, 120, 130, 255)
    # cone widening down (semi-transparent warm light)
    for y in range(8, 34):
        half = int(2 + (y - 8) * 0.55)
        for x in range(20 - half, 20 + half + 1):
            if 0 <= x < W:
                t = (y - 8) / 26
                a = int(200 * (1 - t * 0.55))
                lit = 255 if abs(x - 20) < half * 0.35 else 230
                px[x, y] = (lit, lit, 180, a)
    # rim outline on housing only
    outline_housing = new(W, H)
    for y in range(2, 8):
        for x in range(16, 24):
            outline_housing.putpixel((x, y), (70, 70, 80, 255))
    outline(outline_housing)
    im.alpha_composite(outline_housing)
    return im


def cardboard_box() -> Image.Image:
    W, H = 28, 24
    im = new(W, H)
    d = ImageDraw.Draw(im)
    CARD = (196, 150, 90, 255)
    # isometric-ish front + top
    d.polygon([(4, 8), (14, 3), (24, 8), (14, 13)], fill=(220, 180, 120, 255))  # top
    d.polygon([(4, 8), (14, 13), (14, 22), (4, 17)], fill=CARD)  # left
    d.polygon([(14, 13), (24, 8), (24, 17), (14, 22)], fill=(160, 110, 60, 255))  # right
    px = im.load()
    # flap seam
    for y in range(13, 22):
        px[14, y] = (90, 60, 35, 255)
    # "hide" slot (dark opening)
    for y in range(15, 20):
        for x in range(7, 12):
            px[x, y] = (40, 28, 18, 255)
    outline(im)
    return im


# ── 6. Camera frame + flash ─────────────────────────────────────────────

def camera_frame() -> Image.Image:
    W, H = 36, 28
    im = new(W, H)
    d = ImageDraw.Draw(im)
    # outer viewfinder rectangle
    d.rectangle((2, 2, 33, 25), outline=(240, 240, 245, 255))
    d.rectangle((3, 3, 32, 24), outline=(40, 40, 50, 255))
    d.rectangle((4, 4, 31, 23), outline=(220, 220, 230, 220))
    # corner brackets
    px = im.load()
    BR = (255, 220, 80, 255)
    for L in range(0, 6):
        px[2 + L, 2] = BR
        px[2, 2 + L] = BR
        px[33 - L, 2] = BR
        px[33, 2 + L] = BR
        px[2 + L, 25] = BR
        px[2, 25 - L] = BR
        px[33 - L, 25] = BR
        px[33, 25 - L] = BR
    # center crosshair
    for i in range(14, 22):
        px[i, 13] = (255, 255, 255, 180)
        px[17, i - 3] = (255, 255, 255, 180)
    return im


def flash_frame(i: int) -> Image.Image:
    W, H = 32, 32
    im = new(W, H)
    cx, cy = 16, 16
    if i == 0:
        shade_disk(im, cx, cy, 6, (255, 255, 240, 255), (255, 240, 160, 230), (255, 200, 80, 200))
        # rays
        px = im.load()
        for ang_deg, length in ((20, 12), (70, 11), (130, 12), (200, 10), (260, 12), (310, 11)):
            import math

            ang = ang_deg * math.pi / 180
            for dist in range(7, length):
                x = int(cx + dist * math.cos(ang))
                y = int(cy + dist * math.sin(ang))
                if 0 <= x < W and 0 <= y < H:
                    px[x, y] = (255, 250, 200, 220)
    else:
        # fade burst
        shade_disk(im, cx, cy, 10, (255, 255, 255, 160), (255, 240, 180, 100), (255, 210, 100, 40), rim=(255, 255, 255, 0))
    return im


# ── 7. Puzzle cell + badge base ─────────────────────────────────────────

def puzzle_cell() -> Image.Image:
    W, H = 32, 32
    im = new(W, H)
    d = ImageDraw.Draw(im)
    # recessed cell
    d.rectangle((2, 2, 29, 29), fill=(50, 42, 36, 255))
    d.rectangle((4, 4, 27, 27), fill=(90, 78, 64, 255))
    # inner highlight frame
    px = im.load()
    for i in range(4, 28):
        px[i, 4] = (160, 140, 110, 255)
        px[4, i] = (160, 140, 110, 255)
        px[i, 27] = (40, 32, 26, 255)
        px[27, i] = (40, 32, 26, 255)
    # tab notches (puzzle feel, generic)
    for x in range(13, 19):
        px[x, 2] = (90, 78, 64, 255)
        px[x, 1] = (90, 78, 64, 255)
    for y in range(13, 19):
        px[29, y] = (90, 78, 64, 255)
        px[30, y] = (90, 78, 64, 255)
    outline(im)
    return im


def badge_base() -> Image.Image:
    W, H = 32, 32
    im = new(W, H)
    cx, cy, r = 16, 16, 13
    # outer ring gold
    shade_disk(im, cx, cy, r, (255, 220, 120, 255), (220, 170, 50, 255), (150, 100, 30, 255))
    # inner plate
    shade_disk(im, cx, cy, 9, (255, 244, 210, 255), (236, 210, 150, 255), (190, 150, 80, 255), rim=(120, 80, 30, 255))
    # generic star notch (not a brand)
    px = im.load()
    for (x, y) in [(16, 10), (15, 11), (17, 11), (16, 12), (14, 13), (18, 13), (15, 14), (17, 14), (16, 15)]:
        px[x, y] = (180, 120, 40, 255)
    # rim ticks
    for a in range(0, 360, 45):
        import math

        ang = a * math.pi / 180
        x = int(cx + 11 * math.cos(ang))
        y = int(cy + 11 * math.sin(ang))
        if 0 <= x < W and 0 <= y < H:
            px[x, y] = (255, 240, 180, 255)
    outline(im)
    return im


def build_preview(paths: list[Path]) -> None:
    """Side-by-side strip of every generated PNG (first frame of sheets)."""
    imgs = []
    labels = []
    for p in sorted(paths):
        if p.name.startswith("_"):
            continue
        if p.suffix.lower() != ".png":
            continue
        im = Image.open(p).convert("RGBA")
        meta = p.with_suffix(".json")
        if meta.exists():
            data = json.loads(meta.read_text(encoding="utf-8"))
            fw, fh = data["frameWidth"], data["frameHeight"]
            im = im.crop((0, 0, fw, fh))
        imgs.append(im)
        labels.append(p.stem)
    if not imgs:
        return
    pad = 6
    cell_w = max(im.size[0] for im in imgs) + pad * 2
    cell_h = max(im.size[1] for im in imgs) + pad * 2 + 10
    cols = min(8, len(imgs))
    rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (36, 28, 40, 255))
    d = ImageDraw.Draw(sheet)
    for i, im in enumerate(imgs):
        r, c = divmod(i, cols)
        x0 = c * cell_w
        y0 = r * cell_h
        d.rectangle((x0 + 1, y0 + 1, x0 + cell_w - 2, y0 + cell_h - 12), fill=(20, 16, 24, 255))
        ox = x0 + (cell_w - im.size[0]) // 2
        oy = y0 + (cell_h - 10 - im.size[1]) // 2
        sheet.paste(im, (ox, oy), im)
        d.text((x0 + 4, y0 + cell_h - 10), labels[i][:14], fill=(230, 210, 160, 255))
    sheet.save(PREVIEW)
    print("preview", PREVIEW, sheet.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # 1 salmon
    save_sheet("salmon-swim", [salmon_frame(0), salmon_frame(1)], {"key": "swim", "label": "游動"}, fps=5)
    save_still("salmon-half-left", salmon_half("left"))
    save_still("salmon-half-right", salmon_half("right"))
    save_still("knife", knife())

    # 2 tubes / jars / smoke
    save_still("tube-empty", tube("empty"))
    save_still("tube-half", tube("half"))
    save_still("tube-full", tube("full"))
    save_still("honey-jar", jar("honey"))
    save_still("pollen-jar", jar("pollen"))
    save_still("water-bottle", jar("water"))
    save_sheet("smoke", [smoke_frame(0), smoke_frame(1), smoke_frame(2)], {"key": "puff", "label": "冒煙"}, fps=6)

    # 3 kite / bird / wire
    save_sheet("kite", [kite_frame(-1), kite_frame(1)], {"key": "sway", "label": "擺動"}, fps=4)
    save_sheet("bird", [bird_frame(True), bird_frame(False)], {"key": "flap", "label": "拍翼"}, fps=6)
    save_still("wire", wire())

    # 4 wheel / wood / wave / pier
    save_sheet("wheel", [wheel_frame(0), wheel_frame(1)], {"key": "wobble", "label": "搖晃"}, fps=5)
    save_still("driftwood", driftwood())
    save_sheet("wave", [wave_frame(0), wave_frame(1), wave_frame(2)], {"key": "crash", "label": "大浪"}, fps=5)
    save_still("pier", pier())

    # 5 searchlight / box
    save_still("searchlight-cone", searchlight_cone())
    save_still("cardboard-box", cardboard_box())

    # 6 camera / flash
    save_still("camera-frame", camera_frame())
    save_sheet("flash", [flash_frame(0), flash_frame(1)], {"key": "burst", "label": "閃光"}, fps=8, loop=False)

    # 7 puzzle / badge
    save_still("puzzle-cell", puzzle_cell())
    save_still("badge-base", badge_base())

    build_preview(list(OUT.glob("*.png")))


if __name__ == "__main__":
    main()
