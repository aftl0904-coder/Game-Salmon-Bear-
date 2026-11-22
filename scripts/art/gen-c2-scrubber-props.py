#!/usr/bin/env python3
"""Generate formal 32-bit-style C2 mall art sheets (scrubber / blower / acid / props).

Authored-looking pixel canvases — not rectangle placeholders.
Output → public/art/c2/
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "art" / "c2"
OUT.mkdir(parents=True, exist_ok=True)

# Continent-2 mall palette (silver/navy machines + mall warm accents)
SILVER = (168, 184, 196)
SILVER_HI = (214, 226, 234)
SILVER_SH = (106, 122, 136)
NAVY = (26, 58, 90)
NAVY_DK = (14, 32, 52)
NAVY_MID = (42, 74, 106)
STEEL = (120, 136, 148)
STEEL_DK = (64, 80, 96)
YELLOW = (232, 192, 64)
YELLOW_HI = (255, 248, 224)
RED = (255, 64, 64)
RED_DK = (180, 32, 40)
ORANGE = (255, 136, 68)
SMOKE = (136, 153, 170)
WHEEL = (16, 24, 32)
WHEEL_HUB = (120, 144, 160)
OUTLINE = (18, 24, 36)
ACID = (184, 224, 74)
ACID_DK = (88, 140, 40)
ACID_HI = (220, 245, 140)
BLUE = (30, 120, 200)
BLUE_DK = (15, 74, 138)
BLUE_MID = (56, 148, 220)
BLUE_STUN = (58, 90, 112)
LAMP_Y = (255, 224, 64)
LAMP_G = (128, 255, 128)
LAMP_OFF = (96, 128, 160)


def blank(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(draw: ImageDraw.ImageDraw, xy, color, a=255):
    c = (*color[:3], a) if len(color) == 3 else color
    draw.point(xy, fill=c)


def fill_rect(draw, box, color, a=255):
    c = (*color[:3], a) if len(color) == 3 else color
    draw.rectangle(box, fill=c)


def fill_ellipse(draw, box, color, a=255):
    c = (*color[:3], a) if len(color) == 3 else color
    draw.ellipse(box, fill=c)


def outline_sprite(img: Image.Image, color=OUTLINE) -> Image.Image:
    """1px dark outline from opaque neighbors (not pure black)."""
    w, h = img.size
    src = img.load()
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3] >= 128:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] >= 128:
                    dst[x, y] = (*color, 255)
                    break
    return out


def draw_scrubber(pose: str, frame: int = 0) -> Image.Image:
    """112×80 scrubber (96×80 art + 8px pad) — keeps MallScrubber body offset (8,20)."""
    img = blank(112, 80)
    d = ImageDraw.Draw(img)
    # Content lives in x=8..104 to match legacy Graphics texture / collision.

    recovering = pose in ("recover", "defeated")
    silver = SILVER_SH if recovering else SILVER
    silver_hi = STEEL if recovering else SILVER_HI
    brush_spin = 0.35 if pose == "charge" else (0.15 if frame else 0.0)
    eye = (
        (34, 48, 64)
        if pose == "defeated"
        else RED
        if pose in ("warn", "charge")
        else STEEL_DK
        if pose == "recover"
        else YELLOW
    )

    # Shadow under chassis
    fill_ellipse(d, (18, 70, 94, 78), (0, 0, 0), 70)

    # Navy lower skirt
    fill_rect(d, (14, 42, 98, 64), NAVY)
    fill_rect(d, (16, 44, 96, 50), NAVY_MID)  # highlight band
    fill_rect(d, (16, 58, 96, 62), NAVY_DK)

    # Silver body
    fill_rect(d, (18, 20, 80, 50), silver)
    fill_rect(d, (20, 22, 78, 28), silver_hi)  # top highlight
    fill_rect(d, (20, 44, 78, 48), SILVER_SH if not recovering else (70, 84, 96))

    # Camera dome (right / "control")
    fill_rect(d, (74, 22, 98, 48), NAVY_DK)
    fill_rect(d, (76, 24, 96, 46), NAVY)
    fill_ellipse(d, (78, 26, 98, 46), (10, 16, 24))
    fill_ellipse(d, (82, 30, 94, 42), eye)
    if pose != "defeated":
        fill_ellipse(d, (86, 32, 90, 36), YELLOW_HI if pose not in ("warn", "charge") else (255, 200, 200))
    if pose in ("warn", "charge") and frame == 1:
        # blink flash
        fill_ellipse(d, (82, 30, 94, 42), (255, 180, 180))

    # Front brush (left)
    bx, by, br = 26, 54, 15
    fill_ellipse(d, (bx - br, by - br, bx + br, by + br), NAVY_DK)
    brush_col = STEEL if pose in ("warn", "charge") else (112, 128, 144)
    fill_ellipse(d, (bx - 10, by - 10, bx + 10, by + 10), brush_col)
    fill_ellipse(d, (bx - 4, by - 4, bx + 4, by + 4), STEEL_DK)
    import math

    for i in range(8):
        a = (i / 8) * math.pi * 2 + brush_spin + (0.4 if pose == "charge" else 0) + frame * 0.35
        x0 = int(bx + math.cos(a) * 6)
        y0 = int(by + math.sin(a) * 6)
        x1 = int(bx + math.cos(a) * 13)
        y1 = int(by + math.sin(a) * 13)
        d.line([(x0, y0), (x1, y1)], fill=(*SILVER_HI, 255), width=2)

    # Rear vent grille
    vent = ORANGE if pose == "recover" else STEEL_DK
    vent2 = (255, 204, 102) if pose == "recover" else STEEL
    fill_rect(d, (96, 26, 103, 48), vent)
    for yy in range(28, 46, 4):
        fill_rect(d, (98, yy, 102, yy + 2), vent2)

    # Nozzle (warn / spray)
    if pose in ("spray", "warn"):
        top = 2 if pose == "spray" else 8
        fill_rect(d, (52, top, 60, 20), NAVY_MID)
        fill_rect(d, (53, top + 1, 59, top + 4), SILVER_HI)
        fill_ellipse(d, (54, top - 2, 62, top + 6), ACID if pose == "spray" else (96, 192, 64))
        if pose == "spray":
            fill_ellipse(d, (56, 0, 60, 4), ACID_HI)

    # Wheels
    for wx in (32, 76):
        fill_ellipse(d, (wx - 7, 62, wx + 7, 76), WHEEL)
        fill_ellipse(d, (wx - 3, 66, wx + 3, 72), WHEEL_HUB)
        fill_rect(d, (wx - 1, 64, wx + 1, 74), STEEL_DK)

    # Charge lean dust
    if pose == "charge":
        for i, (cx, cy, r) in enumerate(((96, 60, 3), (100, 58, 2), (104, 62, 2))):
            fill_ellipse(d, (cx - r, cy - r, cx + r, cy + r), (200, 176, 144), 140 - i * 30)

    # Recover smoke
    if pose == "recover":
        for cx, cy, r, a in ((44, 10, 5, 140), (54, 4, 4, 110), (62, 8, 3, 90)):
            fill_ellipse(d, (cx - r, cy - r, cx + r, cy + r), SMOKE, a)

    # Defeated chip pop + dead eye already dark
    if pose == "defeated":
        fill_rect(d, (78, 2, 90, 12), (255, 224, 128))
        fill_rect(d, (80, 4, 88, 10), (255, 200, 80))
        fill_ellipse(d, (82, 5, 86, 9), RED)
        # cracked panel line
        d.line([(22, 30), (48, 34)], fill=(*STEEL_DK, 255), width=1)
        d.line([(48, 34), (68, 28)], fill=(*STEEL_DK, 255), width=1)

    # Panel seam details
    d.line([(28, 32), (68, 32)], fill=(*STEEL_DK, 180), width=1)
    fill_rect(d, (30, 36, 38, 40), NAVY_DK)  # status LED strip
    led = RED if pose in ("warn", "charge") else (LAMP_G if pose == "idle" else STEEL)
    fill_rect(d, (31, 37, 37, 39), led)

    return outline_sprite(img)


def scrubber_sheet() -> tuple[Image.Image, dict]:
    plan = [
        ("idle", 0),
        ("idle", 1),
        ("warn", 0),
        ("warn", 1),
        ("charge", 0),
        ("charge", 1),
        ("recover", 0),
        ("recover", 1),
        ("spray", 0),
        ("defeated", 0),
    ]
    fw, fh = 112, 80
    sheet = blank(fw * len(plan), fh)
    frames = {}
    for i, (pose, fi) in enumerate(plan):
        fr = draw_scrubber(pose, fi)
        sheet.paste(fr, (i * fw, 0), fr)
        frames[f"{pose}_{fi}" if pose in ("idle", "warn", "charge", "recover") else pose] = {
            "x": i * fw,
            "y": 0,
            "w": fw,
            "h": fh,
            "index": i,
        }
    # Convenient pose → primary frame index
    pose_index = {"idle": 0, "warn": 2, "charge": 4, "recover": 6, "spray": 8, "defeated": 9}
    meta = {
        "frameWidth": fw,
        "frameHeight": fh,
        "frames": frames,
        "poseIndex": pose_index,
        "order": [f"{p}_{f}" if p in ("idle", "warn", "charge", "recover") else p for p, f in plan],
    }
    return sheet, meta


def draw_blower(state: str, frame: int = 0) -> Image.Image:
    """48×40 floor blower — blue snail drum, flat outlet left, small wheels."""
    img = blank(48, 40)
    d = ImageDraw.Draw(img)
    stunned = state == "stunned"
    blue = BLUE_STUN if stunned else BLUE
    blue_dk = (42, 64, 80) if stunned else BLUE_DK
    blue_mid = (80, 110, 130) if stunned else BLUE_MID

    fill_ellipse(d, (6, 34, 44, 40), (0, 0, 0), 60)

    # Snail drum
    fill_ellipse(d, (16, 2, 44, 30), blue)
    fill_ellipse(d, (18, 4, 34, 28), blue_dk)
    fill_ellipse(d, (20, 6, 32, 18), blue_mid)  # highlight

    # Intake grille
    fill_ellipse(d, (28, 8, 44, 24), (16, 24, 32))
    for r in (3, 5, 7):
        d.ellipse((36 - r, 16 - r, 36 + r, 16 + r), outline=(*STEEL_DK, 255))
    fill_ellipse(d, (34, 14, 38, 18), STEEL)

    # Flat wide outlet (left)
    fill_rect(d, (2, 18, 18, 30), blue)
    fill_rect(d, (3, 20, 16, 28), (10, 24, 32))
    for i in range(4):
        fill_rect(d, (4 + i * 3, 21, 5 + i * 3, 27), STEEL_DK)

    # Handle + telescopic stub
    fill_rect(d, (24, 0, 36, 3), WHEEL)
    fill_rect(d, (42, 8, 46, 22), WHEEL)

    # Status lamp
    lamp = LAMP_Y if state == "warn" else LAMP_G if state == "on" else STEEL_DK if stunned else LAMP_OFF
    fill_ellipse(d, (8, 15, 14, 21), lamp)
    if state == "warn":
        fill_ellipse(d, (9, 16, 13, 20), YELLOW_HI)

    # Wheels + feet
    for wx in (26, 38):
        fill_ellipse(d, (wx - 4, 30, wx + 4, 38), WHEEL)
        fill_ellipse(d, (wx - 1, 33, wx + 1, 35), STEEL)
    fill_rect(d, (4, 30, 8, 34), WHEEL)
    fill_rect(d, (10, 30, 14, 34), WHEEL)

    if state == "on":
        # air streaks
        for i in range(3):
            y = 22 + i * 3
            x1 = 2 - frame * 2
            d.line([(x1, y), (x1 - 8 - i * 3, y - 1)], fill=(168, 216, 255, 200), width=1)

    if stunned:
        fill_ellipse(d, (26, 0, 34, 6), SMOKE, 150)
        fill_ellipse(d, (30, -2, 36, 4), SMOKE, 100)

    return outline_sprite(img)


def blower_sheet() -> tuple[Image.Image, dict]:
    plan = [("off", 0), ("warn", 0), ("on", 0), ("on", 1), ("stunned", 0)]
    fw, fh = 48, 40
    sheet = blank(fw * len(plan), fh)
    frames = {}
    for i, (st, fi) in enumerate(plan):
        fr = draw_blower(st, fi)
        sheet.paste(fr, (i * fw, 0), fr)
        key = f"on_{fi}" if st == "on" else st
        frames[key] = {"x": i * fw, "y": 0, "w": fw, "h": fh, "index": i}
    meta = {
        "frameWidth": fw,
        "frameHeight": fh,
        "frames": frames,
        "stateIndex": {"off": 0, "warn": 1, "on": 2, "stunned": 4},
        "order": ["off", "warn", "on_0", "on_1", "stunned"],
    }
    return sheet, meta


def acid_sheet() -> tuple[Image.Image, dict]:
    """Drip 12×12 ×2 + puddle 64×10 ×2 packed horizontally with pads."""
    # Layout: [drip0 12][drip1 12][puddle0 64][puddle1 64]  height 12 (puddles vertically centered)
    fw_total = 12 + 12 + 64 + 64
    sheet = blank(fw_total, 12)
    frames = {}

    def drip(frame: int) -> Image.Image:
        im = blank(12, 12)
        d = ImageDraw.Draw(im)
        # teardrop
        cy = 4 + frame
        fill_ellipse(d, (3, cy - 3, 9, cy + 3), ACID)
        fill_ellipse(d, (4, cy - 2, 7, cy + 1), ACID_HI)
        fill_rect(d, (5, cy + 2, 7, cy + 5 + frame), ACID_DK)
        fill_ellipse(d, (4, 8 + frame, 8, 11 + frame), ACID)
        return outline_sprite(im)

    def puddle(frame: int) -> Image.Image:
        im = blank(64, 10)
        d = ImageDraw.Draw(im)
        fill_ellipse(d, (2, 1, 62, 9), ACID_DK)
        fill_ellipse(d, (4, 2, 60, 8), ACID)
        fill_ellipse(d, (10, 3, 28, 6), ACID_HI)
        # bubbles
        for bx, by, r in ((18, 3 + frame, 2), (36, 4 - frame, 2), (48, 3, 1 + frame)):
            fill_ellipse(d, (bx - r, by - r, bx + r, by + r), ACID_HI)
            fill_ellipse(d, (bx - r + 4, by - r + 1, bx + r + 3, by + r), ACID_DK)
        return outline_sprite(im)

    x = 0
    for i in range(2):
        fr = drip(i)
        sheet.paste(fr, (x, 0), fr)
        frames[f"drip_{i}"] = {"x": x, "y": 0, "w": 12, "h": 12, "index": i}
        x += 12
    for i in range(2):
        fr = puddle(i)
        # paste into 12-tall sheet centered vertically → y=1
        sheet.paste(fr, (x, 1), fr)
        frames[f"puddle_{i}"] = {"x": x, "y": 1, "w": 64, "h": 10, "index": 2 + i}
        x += 64

    # Also export a taller dedicated puddle strip for easier Image use (64×10 ×2)
    puddle_strip = blank(128, 10)
    for i in range(2):
        fr = puddle(i)
        puddle_strip.paste(fr, (i * 64, 0), fr)

    meta = {
        "frames": frames,
        "dripSize": [12, 12],
        "puddleSize": [64, 10],
        "layout": "drip0|drip1|puddle0|puddle1",
    }
    return sheet, meta, puddle_strip


def draw_prop(kind: str) -> Image.Image:
    """Mall clutter props — 24–64px tall, distinct silhouettes."""
    if kind == "plant":
        im = blank(28, 40)
        d = ImageDraw.Draw(im)
        fill_rect(d, (8, 28, 20, 39), (140, 90, 60))
        fill_rect(d, (9, 29, 19, 32), (180, 130, 90))
        for box, col in (
            ((4, 10, 16, 28), (48, 120, 64)),
            ((12, 6, 24, 26), (64, 148, 80)),
            ((8, 2, 18, 16), (90, 180, 100)),
        ):
            fill_ellipse(d, box, col)
        fill_ellipse(d, (10, 4, 14, 8), (180, 230, 160))
        return outline_sprite(im)

    if kind == "bench":
        im = blank(48, 24)
        d = ImageDraw.Draw(im)
        fill_rect(d, (2, 10, 46, 16), (160, 120, 72))
        fill_rect(d, (3, 11, 45, 13), (200, 160, 100))
        fill_rect(d, (4, 16, 8, 23), (90, 70, 50))
        fill_rect(d, (40, 16, 44, 23), (90, 70, 50))
        fill_rect(d, (2, 6, 46, 10), (140, 100, 60))
        return outline_sprite(im)

    if kind == "trash":
        im = blank(20, 32)
        d = ImageDraw.Draw(im)
        fill_rect(d, (3, 8, 17, 30), (70, 90, 100))
        fill_rect(d, (4, 10, 16, 14), (110, 140, 150))
        fill_rect(d, (2, 6, 18, 10), (50, 60, 70))
        fill_rect(d, (7, 2, 13, 6), (50, 60, 70))
        fill_rect(d, (5, 16, 8, 28), (40, 50, 58))
        fill_rect(d, (12, 16, 15, 28), (40, 50, 58))
        return outline_sprite(im)

    if kind == "sign":
        im = blank(28, 40)
        d = ImageDraw.Draw(im)
        fill_rect(d, (12, 10, 16, 39), (90, 90, 100))
        fill_rect(d, (2, 2, 26, 18), (40, 70, 120))
        fill_rect(d, (3, 3, 25, 17), (70, 120, 180))
        # arrow only — no letters
        d.polygon([(8, 10), (16, 6), (16, 9), (22, 9), (22, 11), (16, 11), (16, 14)], fill=(*YELLOW_HI, 255))
        return outline_sprite(im)

    if kind == "cart":
        im = blank(40, 32)
        d = ImageDraw.Draw(im)
        # basket
        d.rectangle((6, 6, 34, 22), outline=(*STEEL, 255))
        for x in range(8, 34, 4):
            d.line([(x, 6), (x, 22)], fill=(*STEEL, 255))
        for y in range(8, 22, 4):
            d.line([(6, y), (34, y)], fill=(*STEEL, 255))
        fill_rect(d, (32, 2, 36, 20), STEEL_DK)  # handle
        fill_ellipse(d, (8, 24, 16, 32), WHEEL)
        fill_ellipse(d, (26, 24, 34, 32), WHEEL)
        fill_ellipse(d, (10, 26, 14, 30), STEEL)
        fill_ellipse(d, (28, 26, 32, 30), STEEL)
        return outline_sprite(im)

    if kind == "barrier":
        im = blank(36, 28)
        d = ImageDraw.Draw(im)
        # plastic stanchions + rope
        for x in (4, 28):
            fill_ellipse(d, (x, 18, x + 8, 27), (200, 60, 60))
            fill_rect(d, (x + 2, 4, x + 6, 20), (220, 80, 80))
            fill_ellipse(d, (x + 1, 2, x + 7, 8), (240, 120, 120))
        d.line([(8, 6), (30, 6)], fill=(*RED, 255), width=2)
        d.line([(8, 8), (30, 8)], fill=(*YELLOW, 255), width=1)
        return outline_sprite(im)

    if kind == "escalator":
        im = blank(48, 40)
        d = ImageDraw.Draw(im)
        fill_rect(d, (4, 8, 44, 36), (60, 70, 82))
        fill_rect(d, (6, 10, 42, 34), (90, 104, 120))
        # stair steps icon (no text)
        for i in range(5):
            y = 28 - i * 4
            fill_rect(d, (10 + i * 4, y, 22 + i * 4, y + 3), SILVER_HI)
            fill_rect(d, (10 + i * 4, y, 12 + i * 4, y + 3), STEEL)
        fill_rect(d, (8, 4, 40, 12), NAVY)
        # up chevron
        d.polygon([(24, 5), (18, 10), (30, 10)], fill=(*YELLOW, 255))
        return outline_sprite(im)

    if kind == "lightbox":
        im = blank(40, 48)
        d = ImageDraw.Draw(im)
        fill_rect(d, (4, 4, 36, 44), (40, 44, 56))
        fill_rect(d, (6, 6, 34, 42), (24, 28, 40))
        # colorful abstract blocks — no brand text
        blocks = [
            ((8, 8, 20, 18), (255, 96, 128)),
            ((22, 8, 32, 18), (80, 180, 255)),
            ((8, 20, 32, 28), (255, 200, 64)),
            ((8, 30, 18, 40), (120, 220, 140)),
            ((20, 30, 32, 40), (180, 120, 255)),
        ]
        for box, col in blocks:
            fill_rect(d, box, col)
            fill_rect(d, (box[0], box[1], box[2], box[1] + 2), tuple(min(255, c + 40) for c in col))
        return outline_sprite(im)

    raise ValueError(kind)


def mall_props_sheet() -> tuple[Image.Image, dict]:
    kinds = ["plant", "bench", "trash", "sign", "cart", "barrier", "escalator", "lightbox"]
    props = {k: draw_prop(k) for k in kinds}
    # Pack into a row with 2px padding, on a 64-tall strip
    gap = 2
    widths = [props[k].size[0] for k in kinds]
    total_w = sum(widths) + gap * (len(kinds) - 1)
    sheet = blank(total_w, 64)
    frames = {}
    x = 0
    for k in kinds:
        im = props[k]
        y = 64 - im.size[1]
        sheet.paste(im, (x, y), im)
        frames[k] = {"x": x, "y": y, "w": im.size[0], "h": im.size[1], "anchor": "bottom"}
        # also save individual for easy Image keys
        im.save(OUT / f"prop-{k}.png")
        x += im.size[0] + gap
    meta = {"frameHeight": 64, "frames": frames, "order": kinds}
    return sheet, meta


def main():
    scrub, scrub_meta = scrubber_sheet()
    scrub.save(OUT / "scrubber-sheet.png")
    (OUT / "scrubber-sheet.json").write_text(json.dumps(scrub_meta, indent=2) + "\n")

    blow, blow_meta = blower_sheet()
    blow.save(OUT / "blower-sheet.png")
    (OUT / "blower-sheet.json").write_text(json.dumps(blow_meta, indent=2) + "\n")

    acid, acid_meta, puddle_strip = acid_sheet()
    acid.save(OUT / "acid-fx.png")
    puddle_strip.save(OUT / "acid-puddle-strip.png")
    (OUT / "acid-fx.json").write_text(json.dumps(acid_meta, indent=2) + "\n")

    props, props_meta = mall_props_sheet()
    props.save(OUT / "mall-props.png")
    (OUT / "mall-props.json").write_text(json.dumps(props_meta, indent=2) + "\n")

    print("Wrote:")
    for p in sorted(OUT.glob("*")):
        if p.suffix in {".png", ".json"}:
            print(f"  {p.relative_to(ROOT)} ({p.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
