#!/usr/bin/env python3
"""Small hand-pixelled items (deterministic). Run: python3 scripts/art/gen_items.py
public/art/items/: salmon-roe.png (倫寶 shot), fish-bubble.png (紅魚 spit)."""
from PIL import Image
OUT = 'public/art/items/'

def bead(size, rim, base, mid, light, spec):
    """Glossy sphere: light from top-left, dark rim, specular dot."""
    im = Image.new('RGBA', (size, size)); px = im.load()
    c = (size - 1) / 2; r = size / 2 - 0.6
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            d = (dx * dx + dy * dy) ** 0.5
            if d > r: continue
            if d > r - 1.0: col = rim
            else:
                lit = (-dx - dy) / (2 * r)             # top-left brighter
                col = light if lit > 0.28 else (mid if lit > -0.15 else base)
            px[x, y] = col + (255,)
    sx = int(c - r * 0.35); sy = int(c - r * 0.35)
    px[sx, sy] = spec + (255,)
    if size >= 10: px[sx + 1, sy] = spec + (255,)
    return im

# salmon roe (三文魚籽 / ikura): translucent orange-red bead, darker "eye" spot,
# glow on the lower-right (light passing through), strong specular top-left.
def ikura(size=11):
    im = Image.new('RGBA', (size, size)); px = im.load()
    c = (size - 1) / 2; r = size / 2 - 0.2
    RIM, DEEP, BODY, GLOW, HI, SPEC, EYE = (138, 36, 18), (206, 70, 30), (240, 104, 40), (255, 160, 70), (255, 196, 128), (255, 250, 236), (150, 44, 22)
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            d = (dx * dx + dy * dy) ** 0.5
            if d > r: continue
            if d > r - 1.1: col = RIM
            else:
                lit = (-dx - dy) / (2 * r)
                col = HI if lit > 0.32 else (BODY if lit > -0.1 else DEEP)
                if dx > 0.5 and dy > 0.5 and d < r - 1.6: col = GLOW   # inner glow (translucency)
            px[x, y] = col + (255,)
    px[int(c - 2), int(c - 2)] = SPEC + (255,)
    px[int(c - 1), int(c - 2)] = SPEC + (255,)
    px[int(c - 2), int(c - 1)] = SPEC + (255,)
    px[int(c + 1), int(c)] = EYE + (255,)                          # the tiny embryo eye
    return im

ikura(11).save(OUT + 'salmon-roe.png')
# fish spit bubble: pale blue water bead
bead(8, (52, 86, 120), (120, 170, 210), (160, 206, 236), (214, 238, 252), (255, 255, 255)).save(OUT + 'fish-bubble.png')
# 帽仔兵's rock: lumpy grey stone, light top-left
def rock(size=9):
    im = Image.new('RGBA', (size, size)); px = im.load()
    pts = [(1,3),(2,1),(5,0),(7,2),(8,5),(6,8),(3,8),(0,6)]
    from PIL import ImageDraw
    d = ImageDraw.Draw(im); d.polygon(pts, fill=(112, 104, 96, 255), outline=(52, 46, 42, 255))
    for (x, y) in [(3,2),(4,2),(2,3),(3,3),(5,1)]: px[x, y] = (168, 158, 146, 255)
    for (x, y) in [(6,6),(5,7),(7,5),(4,7)]: px[x, y] = (78, 72, 66, 255)
    return im
rock().save(OUT + 'rock.png')
print('items written')
