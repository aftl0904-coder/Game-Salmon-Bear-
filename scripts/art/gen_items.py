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
# ---- Larger loot / hazard sprites, drawn at final size (hero is 72px tall) ----
from PIL import ImageDraw
OUTLINE = (34, 22, 16, 255)

def shade_fill(im, mask_col, lit, base, dark, cx_frac=0.35, cy_frac=0.35, edge=None):
    """Re-shade opaque pixels of one flat colour: lit near top-left, dark bottom-right."""
    px = im.load(); W, H = im.size
    xs = [x for y in range(H) for x in range(W) if px[x, y] == mask_col]
    ys = [y for y in range(H) for x in range(W) if px[x, y] == mask_col]
    if not xs: return
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if px[x, y] != mask_col: continue
            u = (x - x0) / max(1, x1 - x0); v = (y - y0) / max(1, y1 - y0)
            k = u * 0.6 + v * 0.4
            px[x, y] = lit if k < cx_frac else (base if k < 0.68 else dark)

def outline(im, col=OUTLINE):
    px = im.load(); W, H = im.size
    src = im.copy().load()
    for y in range(H):
        for x in range(W):
            if src[x, y][3]: continue
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and src[nx, ny][3]:
                    px[x, y] = col; break

def gold_salmon():
    W, H = 26, 16
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im); px = im.load()
    BODY = (214, 160, 40, 255)
    d.ellipse((5, 2, 23, 13), fill=BODY)
    d.polygon([(1, 2), (7, 7), (1, 13)], fill=BODY)
    d.polygon([(11, 1), (16, 0), (17, 3)], fill=BODY)          # dorsal fin
    shade_fill(im, BODY, (255, 226, 120, 255), (222, 168, 44, 255), (168, 112, 26, 255))
    for x in range(8, 21):                                       # scale rows
        for y in range(5, 11):
            if px[x, y][3] and (x + 2 * y) % 5 == 0: px[x, y] = (250, 210, 90, 255)
    for x in range(9, 20): 
        if px[x, 3][3]: px[x, 3] = (255, 244, 190, 255)          # back highlight
    d.line((15, 4, 15, 11), fill=(176, 120, 30, 255))            # gill line
    px[19, 6] = (30, 20, 10, 255); px[20, 6] = (30, 20, 10, 255); px[19, 5] = (255, 255, 240, 255)  # eye
    d.line((21, 9, 23, 9), fill=(150, 96, 20, 255))              # mouth
    outline(im)
    px[10, 4] = (255, 255, 250, 255); px[11, 4] = (255, 255, 250, 255)
    return im
gold_salmon().save(OUT + 'power-salmon.png')

def crusher():
    W, H = 40, 50
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im); px = im.load()
    for y in range(0, 10, 3): d.rectangle((18, y, 21, y + 1), fill=(96, 90, 84, 255)); px[18, y] = (150, 144, 136, 255)
    d.rectangle((15, 8, 24, 11), fill=(70, 66, 62, 255))                     # hook plate
    IRON = (100, 96, 104, 255)
    d.rectangle((2, 11, 37, 34), fill=IRON)
    shade_fill(im, IRON, (150, 146, 154, 255), (104, 100, 108, 255), (66, 62, 70, 255))
    d.rectangle((2, 11, 37, 12), fill=(176, 172, 180, 255))                   # top bevel
    d.rectangle((2, 33, 37, 34), fill=(52, 48, 56, 255))                       # bottom lip
    for x0 in (6, 14, 22, 30):                                                  # plate seams
        d.line((x0 + 3, 14, x0 + 3, 31), fill=(80, 76, 84, 255))
    for (x, y) in [(5, 15), (34, 15), (5, 30), (34, 30), (19, 15), (19, 30)]:  # rivets
        px[x, y] = (214, 210, 204, 255); px[x + 1, y + 1] = (60, 56, 60, 255)
    # △ stencil (triangle group mark)
    for i in range(6):
        d.line((19 - i, 18 + i * 2, 20 + i, 18 + i * 2), fill=(176, 40, 30, 255))
        d.line((19 - i, 19 + i * 2, 20 + i, 19 + i * 2), fill=(176, 40, 30, 255))
    for i in range(7):                                                          # spikes
        x0 = 3 + i * 5
        d.polygon([(x0, 35), (x0 + 4, 35), (x0 + 2, 48)], fill=(170, 166, 160, 255))
        d.line((x0 + 1, 36, x0 + 2, 46), fill=(232, 230, 226, 255))
        px[x0 + 3, 37] = (110, 106, 100, 255)
    outline(im)
    return im
crusher().save(OUT + 'crusher.png')

def break_lantern():
    W, H = 26, 46
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im); px = im.load()
    WOOD = (110, 72, 40, 255)
    d.rectangle((11, 24, 14, 44), fill=WOOD)
    for y in range(24, 45): px[11, y] = (150, 104, 60, 255); px[14, y] = (78, 50, 28, 255)
    d.rectangle((6, 42, 19, 45), fill=(84, 56, 32, 255)); d.line((6, 42, 19, 42), fill=(130, 90, 52, 255))  # foot
    d.rectangle((8, 0, 17, 2), fill=(48, 34, 24, 255)); d.line((8, 0, 17, 0), fill=(92, 66, 44, 255))       # top cap
    PAPER = (196, 40, 32, 255)
    d.ellipse((1, 2, 24, 25), fill=PAPER)
    shade_fill(im, PAPER, (240, 92, 64, 255), (198, 42, 34, 255), (138, 22, 22, 255), cx_frac=0.3)
    for y in (6, 10, 14, 18, 22):                                                # bamboo ribs
        for x in range(1, 25):
            if px[x, y][3] and px[x, y] != (48, 34, 24, 255): px[x, y] = (120, 18, 18, 255)
    for y in range(5, 22):                                                       # inner candle glow
        for x in range(8, 17):
            if px[x, y][3] and ((x - 12) ** 2 + (y - 13) ** 2) < 14 and px[x, y] != (120, 18, 18, 255):
                px[x, y] = (255, 132, 70, 255)
    for i in range(4):                                                           # △ mark (gold)
        d.line((12 - i, 9 + i * 2, 13 + i, 9 + i * 2), fill=(255, 214, 110, 255))
    d.line((9, 16, 16, 16), fill=(255, 214, 110, 255))
    d.rectangle((8, 25, 17, 27), fill=(48, 34, 24, 255))                          # bottom cap
    d.line((12, 28, 12, 31), fill=(232, 190, 80, 255)); px[13, 31] = (232, 190, 80, 255)  # tassel
    outline(im)
    px[5, 6] = (255, 214, 190, 255); px[6, 5] = (255, 214, 190, 255)
    return im
break_lantern().save(OUT + 'break-lantern.png')

def break_pot():
    W, H = 26, 24
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im); px = im.load()
    CLAY = (164, 92, 50, 255)
    d.ellipse((1, 5, 24, 23), fill=CLAY)
    d.rectangle((7, 1, 18, 6), fill=CLAY)
    shade_fill(im, CLAY, (210, 140, 88, 255), (166, 94, 52, 255), (110, 56, 30, 255))
    d.rectangle((5, 0, 20, 2), fill=(190, 118, 70, 255)); d.line((5, 2, 20, 2), fill=(120, 64, 36, 255))   # lip
    for x in range(3, 23):                                                       # honey band + drips
        if px[x, 11][3]: px[x, 11] = (240, 180, 50, 255); px[x, 12] = (206, 140, 30, 255)
    for (x, l) in [(7, 3), (13, 4), (18, 2)]:
        for y in range(13, 13 + l): px[x, y] = (226, 160, 40, 255)
    d.line((15, 15, 17, 19), fill=(96, 48, 26, 255))                             # crack
    outline(im)
    px[5, 8] = (240, 200, 160, 255); px[6, 7] = (240, 200, 160, 255)
    return im
break_pot().save(OUT + 'break-pot.png')
print('items written')
