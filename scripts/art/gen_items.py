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
# 金鮭 power-up: small golden salmon with shine (light top-left)
def gold_salmon():
    im = Image.new('RGBA', (16, 10)); px = im.load()
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    d.ellipse((2, 1, 13, 8), fill=(214, 160, 40, 255))          # body
    d.polygon([(0, 1), (3, 4), (0, 8)], fill=(184, 128, 30, 255))  # tail
    for x in range(4, 12):
        for y in range(2, 5):
            if px[x, y][3] and (x + y) % 3 == 0: px[x, y] = (250, 214, 96, 255)   # scales
    for x in range(5, 12): px[x, 2] = (255, 236, 150, 255)          # top highlight
    for x in range(4, 13): 
        if px[x, 7][3]: px[x, 7] = (150, 100, 24, 255)              # belly shade
    px[11, 3] = (40, 24, 12, 255)                                   # eye
    px[6, 1] = (255, 255, 236, 255)                                 # glint
    return im
gold_salmon().save(OUT + 'power-salmon.png')

# hanging spike block (crusher): riveted iron block with spikes underneath + chain
def crusher():
    W, H = 24, 30
    im = Image.new('RGBA', (W, H)); px = im.load()
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    for y in range(0, 8, 2): d.rectangle((11, y, 12, y + 1), fill=(90, 84, 78, 255))   # chain
    d.rectangle((1, 8, 22, 21), fill=(96, 92, 96, 255))
    d.rectangle((1, 8, 22, 9), fill=(150, 146, 150, 255)); d.rectangle((1, 8, 2, 21), fill=(140, 136, 140, 255))
    d.rectangle((21, 10, 22, 21), fill=(62, 58, 64, 255)); d.rectangle((1, 20, 22, 21), fill=(62, 58, 64, 255))
    for (x, y) in [(4, 11), (19, 11), (4, 18), (19, 18)]: px[x, y] = (200, 196, 190, 255)    # rivets
    for i in range(5):                                                                     # spikes
        x0 = 2 + i * 4
        d.polygon([(x0, 22), (x0 + 3, 22), (x0 + 1.5, 29)], fill=(176, 172, 168, 255))
        px[x0 + 1, 23] = (230, 228, 224, 255)
    return im
crusher().save(OUT + 'crusher.png')
print('items written')
