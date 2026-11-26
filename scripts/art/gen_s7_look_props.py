#!/usr/bin/env python3
"""
s7-look: programmatic prop overlays + gallery composites for Stage 7 enemies.

Same hand-pixelled approach as art-props-1 (PIL, dark outline, 2–3 shade layers).
Does NOT redraw the honeyzombie body — only props + tinted gallery stills.

Run from repo root:
  python3 scripts/art/gen_s7_look_props.py

Writes:
  public/art/stage7/prop-speedlines.png
  public/art/stage7/prop-cage.png
  public/art/stage7/prop-shield.png
  public/art/stage7/prop-canbag.png
  public/art/stage7/gallery-s7{charge,hop,shield,can}.png
  public/art/stage7/_preview-s7-look.png
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "art" / "stage7"
HZ = ROOT / "public" / "art" / "anim" / "honeyzombie.png"

OUTLINE = (34, 22, 16, 255)
HZ_FW, HZ_FH = 232, 114

# Distinct tints (multiply onto honeyzombie RGB) — game uses matching Phaser tint hex.
TINTS = {
    "charge": (0xC8, 0x78, 0x40),  # warm amber rush
    "hop": (0x40, 0x70, 0xB0),  # cool steel-blue cage
    "shield": (0x88, 0x90, 0x98),  # iron-blue plate
    "can": (0xB0, 0x90, 0x48),  # mustard feed bags
}


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


def fill_rect(im: Image.Image, box, col) -> None:
    ImageDraw.Draw(im).rectangle(box, fill=col)


def fill_ellipse(im: Image.Image, box, col) -> None:
    ImageDraw.Draw(im).ellipse(box, fill=col)


def line(im: Image.Image, a, b, col, w=2) -> None:
    ImageDraw.Draw(im).line([a, b], fill=col, width=w)


def apply_tint(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Multiply RGB by tint/255, keep alpha."""
    out = im.copy()
    px = out.load()
    W, H = out.size
    tr, tg, tb = rgb
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            px[x, y] = (
                min(255, r * tr // 255),
                min(255, g * tg // 255),
                min(255, b * tb // 255),
                a,
            )
    return out


def prop_speedlines() -> Image.Image:
    """Horizontal motion streaks — behind / beside charger."""
    im = new(56, 40)
    # Three staggered streak clusters
    colors = [
        (0xE8, 0xC0, 0x60, 220),
        (0xD0, 0x90, 0x40, 180),
        (0xF0, 0xE0, 0xA0, 160),
    ]
    rows = [(6, 10), (16, 8), (28, 10)]
    for i, (y, h) in enumerate(rows):
        c = colors[i % len(colors)]
        # left-pointing chevron streaks
        for k in range(4):
            x0 = 4 + k * 10
            fill_rect(im, (x0, y + 2, x0 + 14 - k, y + h - 2), c)
            # taper tip
            tip = (0xF8, 0xE8, 0xB0, c[3])
            fill_rect(im, (x0 + 14 - k, y + 3, x0 + 18 - k, y + h - 3), tip)
    outline(im, (0x40, 0x28, 0x10, 255))
    return im


def prop_cage() -> Image.Image:
    """Wire cage that sits on the head."""
    im = new(40, 36)
    metal = (0xA8, 0xA0, 0x90, 255)
    dark = (0x48, 0x44, 0x3C, 255)
    # Vertical bars
    for x in (8, 16, 24, 32):
        fill_rect(im, (x - 1, 4, x + 1, 30), metal)
    # Horizontal bars
    for y in (6, 14, 22, 30):
        fill_rect(im, (6, y - 1, 34, y + 1), metal)
    # Corner posts thicker
    fill_rect(im, (5, 3, 8, 32), dark)
    fill_rect(im, (32, 3, 35, 32), dark)
    fill_rect(im, (5, 3, 35, 6), dark)
    fill_rect(im, (5, 29, 35, 32), dark)
    # Lock plate
    fill_rect(im, (15, 15, 25, 22), (0xE0, 0xC8, 0x70, 255))
    fill_rect(im, (17, 17, 23, 20), (0xA0, 0x80, 0x30, 255))
    outline(im)
    return im


def prop_shield() -> Image.Image:
    """Large iron gate plate held in front."""
    im = new(28, 48)
    steel = (0x88, 0x98, 0xA8, 255)
    mid = (0x60, 0x70, 0x80, 255)
    dark = (0x38, 0x44, 0x50, 255)
    rim = (0xC0, 0xD0, 0xE0, 255)
    fill_rect(im, (2, 2, 26, 46), mid)
    fill_rect(im, (4, 4, 24, 44), steel)
    # Horizontal ribs
    for y in (12, 24, 36):
        fill_rect(im, (5, y - 1, 23, y + 1), dark)
        fill_rect(im, (5, y - 2, 23, y - 1), rim)
    # Rivets
    for y in (8, 20, 32, 42):
        for x in (7, 21):
            fill_ellipse(im, (x - 2, y - 2, x + 2, y + 2), dark)
            fill_ellipse(im, (x - 1, y - 1, x + 1, y + 1), rim)
    # Center boss
    fill_ellipse(im, (10, 18, 18, 28), (0xD0, 0xA8, 0x40, 255))
    fill_ellipse(im, (12, 20, 16, 26), (0xF0, 0xD0, 0x60, 255))
    outline(im)
    return im


def prop_canbag() -> Image.Image:
    """Sack of feed cans worn on the back."""
    im = new(36, 40)
    sack = (0x90, 0x78, 0x48, 255)
    sack_mid = (0x70, 0x58, 0x30, 255)
    sack_lit = (0xB0, 0x98, 0x60, 255)
    # Bag body
    fill_ellipse(im, (4, 10, 32, 38), sack)
    fill_ellipse(im, (8, 12, 28, 34), sack_lit)
    fill_rect(im, (10, 8, 26, 14), sack_mid)
    # Drawstring
    line(im, (12, 10), (24, 10), (0x40, 0x30, 0x18, 255), 2)
    # Cans peeking out of top
    cans = [
        ((8, 2), (0xC8, 0xD0, 0x70, 255)),
        ((16, 0), (0xE0, 0xB0, 0x50, 255)),
        ((24, 2), (0xB0, 0xC8, 0x60, 255)),
    ]
    for (x, y), col in cans:
        fill_rect(im, (x, y, x + 8, y + 12), col)
        fill_ellipse(im, (x, y - 2, x + 8, y + 3), (0xF0, 0xE8, 0xA0, 255))
        fill_rect(im, (x + 1, y + 4, x + 7, y + 6), (0x80, 0x70, 0x30, 200))
    outline(im)
    return im


def hz_frame0() -> Image.Image:
    sheet = Image.open(HZ).convert("RGBA")
    return sheet.crop((0, 0, HZ_FW, HZ_FH))


def composite_gallery(kind: str, prop: Image.Image, prop_xy: tuple[int, int], behind: bool) -> Image.Image:
    """Tinted honeyzombie walk-0 + prop overlay for gallery still."""
    body = apply_tint(hz_frame0(), TINTS[kind])
    # Slight contrast bump so tinted body still reads
    body = ImageEnhance.Contrast(body).enhance(1.08)
    canvas = new(HZ_FW, HZ_FH)
    if behind:
        canvas.alpha_composite(prop, dest=prop_xy)
        canvas.alpha_composite(body, dest=(0, 0))
    else:
        canvas.alpha_composite(body, dest=(0, 0))
        canvas.alpha_composite(prop, dest=prop_xy)
    # Trim to content with padding
    bbox = canvas.split()[-1].getbbox()
    if not bbox:
        return canvas
    pad = 4
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(canvas.width, r + pad)
    b = min(canvas.height, b + pad)
    return canvas.crop((l, t, r, b))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    speed = prop_speedlines()
    cage = prop_cage()
    shield = prop_shield()
    canbag = prop_canbag()

    speed.save(OUT / "prop-speedlines.png")
    cage.save(OUT / "prop-cage.png")
    shield.save(OUT / "prop-shield.png")
    canbag.save(OUT / "prop-canbag.png")

    # Gallery composites — prop anchors relative to honeyzombie frame (origin top-left)
    # Body content ~x 77–184, head near y~1–30, feet y~113
    g_charge = composite_gallery("charge", speed, (48, 40), behind=True)
    g_hop = composite_gallery("hop", cage, (96, 0), behind=False)
    g_shield = composite_gallery("shield", shield, (168, 40), behind=False)
    g_can = composite_gallery("can", canbag, (62, 48), behind=True)

    for name, im in [
        ("gallery-s7charge", g_charge),
        ("gallery-s7hop", g_hop),
        ("gallery-s7shield", g_shield),
        ("gallery-s7can", g_can),
    ]:
        im.save(OUT / f"{name}.png")
        print(f"wrote {name}.png {im.size}")

    # Side-by-side preview strip
    cards = [g_charge, g_hop, g_shield, g_can]
    labels = ["衝刺", "跳籠", "盾兵", "罐頭"]
    max_h = max(c.height for c in cards)
    cell_w = max(c.width for c in cards) + 16
    strip = new(cell_w * 4, max_h + 24)
    # warm dark bg
    ImageDraw.Draw(strip).rectangle([0, 0, strip.width, strip.height], fill=(28, 22, 18, 255))
    for i, (c, lab) in enumerate(zip(cards, labels)):
        x = i * cell_w + (cell_w - c.width) // 2
        y = 8 + (max_h - c.height) // 2
        strip.alpha_composite(c, dest=(x, y))
        ImageDraw.Draw(strip).text((i * cell_w + 8, max_h + 10), lab, fill=(240, 220, 160, 255))
    strip.save(OUT / "_preview-s7-look.png")
    print(f"wrote _preview-s7-look.png {strip.size}")
    print("props + gallery composites OK")


if __name__ == "__main__":
    main()
