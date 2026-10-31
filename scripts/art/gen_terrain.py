#!/usr/bin/env python3
"""Hand-tuned pixel terrain for stage 1 (deterministic). Run: python3 scripts/art/gen_terrain.py
Outputs public/art/tiles/: ground-0..3.png (16x16 dirt), ground-top.png (32x40 grass lip + dirt),
bush-strip.png (tileable 192x44 foreground bushes). Palette matches the enemy lineup (earthy, 4-tone)."""
import random, math
from PIL import Image

OUT = 'public/art/tiles/'
S = 2  # pixels per logical px; BootScene marks the tile textures HD (heroAnims.markHd)
R = random.Random(20261025)

DIRT = [(46, 28, 20), (74, 46, 28), (102, 66, 38), (134, 92, 54)]      # dark → light
STONE = [(70, 64, 60), (112, 104, 96), (160, 150, 138)]
ROOT = (58, 36, 22)
GRASS = [(22, 48, 26), (38, 76, 34), (66, 112, 44), (110, 156, 66), (160, 196, 96)]
INK = (24, 16, 14)

def dirt_tile(seed, depth=0, W=16, H=16, pebbles=None):
    """Clumpy dirt: 4x4 (logical) coarse value noise quantised to 3 tones, sparse pebbles, roots. W/H are logical px."""
    r = random.Random(seed)
    gw, gh = W // 4 + 2, H // 4 + 2
    grid = [[r.random() for _ in range(gw)] for _ in range(gh)]
    PW, PH = W * S, H * S
    im = Image.new('RGBA', (PW, PH))
    px = im.load()
    for y in range(PH):
        for x in range(PW):
            gx, gy = x / (4 * S), y / (4 * S)
            x0, y0 = int(gx), int(gy); fx, fy = gx - x0, gy - y0
            v = (grid[y0][x0] * (1 - fx) * (1 - fy) + grid[y0][x0 + 1] * fx * (1 - fy)
                 + grid[y0 + 1][x0] * (1 - fx) * fy + grid[y0 + 1][x0 + 1] * fx * fy)
            v += (r.random() - 0.5) * 0.12          # tiny grain, not salt-and-pepper
            idx = 0 if v < 0.28 else (1 if v < 0.68 else 2)
            px[x, y] = DIRT[idx] + (255,)
    n = pebbles if pebbles is not None else r.choice([0, 1, 1, 2])
    for _ in range(n):
        cx, cy, rr = r.randint(3, W - 4) * S, r.randint(3, H - 4) * S, r.choice([1, 1, 2]) * S
        for y in range(cy - rr, cy + rr + 1):
            for x in range(cx - rr - S, cx + rr + S + 1):
                if 0 <= x < PW and 0 <= y < PH and (x - cx) ** 2 / (rr + S) ** 2 + (y - cy) ** 2 / (rr + S / 2) ** 2 <= 1:
                    t = 2 if (x < cx and y < cy) else (0 if (x > cx or y > cy) else 1)
                    px[x, y] = STONE[t] + (255,)
        if cy + rr + S < PH:
            for x in range(cx - rr, cx + rr + 1):
                if 0 <= x < PW:
                    for k in range(S): px[x, cy + rr + S + k] = DIRT[0] + (255,) if cy + rr + S + k < PH else px[x, cy + rr + S]
    if r.random() < 0.45:
        x = r.randint(2, W - 3) * S
        for y in range(r.randint(0, H // 3) * S, r.randint(H // 2, H - 1) * S):
            if y % S == 0: x = max(0, min(PW - S, x + S * r.choice([-1, 0, 0, 0, 1])))
            for k in range(S): px[x + k, y] = ROOT + (255,)
    if depth:
        k = 1 - 0.13 * depth
        for y in range(PH):
            for x in range(PW):
                c = px[x, y]
                px[x, y] = (int(c[0] * k), int(c[1] * k), int(c[2] * k), 255)
    return im

def ground_top():
    W, H = 96, 40
    im = dirt_tile(4242, depth=0, W=W, H=H, pebbles=5)
    PW, PH = W * S, H * S
    for y in range(24 * S, PH):
        for x in range(PW):
            c = im.getpixel((x, y)); im.putpixel((x, y), (int(c[0] * .88), int(c[1] * .88), int(c[2] * .88), 255))
    px = im.load()
    jitter = [R.random() for _ in range(W)]
    for x in range(PW):
        lx = x / S
        lip = (6 + 1.5 + 1.5 * math.sin(lx * 2 * math.pi / W * 5) + 0.8 * math.sin(lx * 2 * math.pi / W * 11 + 1) + jitter[x // S]) * S
        lipi = int(lip)
        for y in range(lipi):
            ly = y / S
            shade = 3 if ly < 2 else (2 if y < lipi - 2 * S else 1)
            if (x + y) % (7 * S) < S and y < lipi - S: shade = min(4, shade + 1)
            px[x, y] = GRASS[shade] + (255,)
        for k in range(S):
            if lipi + k < PH: px[x, lipi + k] = GRASS[0] + (255,)
        for k in range(S, 2 * S):
            if lipi + k < PH:
                c = px[x, lipi + k]; px[x, lipi + k] = (int(c[0] * .8), int(c[1] * .8), int(c[2] * .8), 255)
    for x in range(PW):
        for k in range(S): px[x, k] = GRASS[4] + (255,)
    for fx in (5, 37, 70):
        for a in range(S):
            for b in range(S):
                px[fx * S + a, S + b] = (236, 214, 120, 255)
                px[(fx + 1) * S + a, 2 * S + b] = (236, 214, 120, 255)
    return im

def bush_strip():
    W, H = 192, 44
    PW, PH = W * S, H * S
    im = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
    px = im.load()
    def top(lx):
        t = lx / W * 2 * math.pi
        return 18 + 7 * math.sin(3 * t) + 4 * math.sin(7 * t + 1.3) + 2.5 * math.sin(13 * t + 0.4)
    for x in range(PW):
        lx = x / S
        ty = int(top(lx) * S)
        for y in range(max(0, ty), PH):
            d = (y - ty) / S
            if d <= 1: ci = 3
            elif d <= 5: ci = 2
            elif d <= 14: ci = 1
            else: ci = 0
            if (lx * 3 + (y / S) * 5) % 11 < 1 and d > 2: ci = min(4, ci + 1)
            px[x, y] = GRASS[ci] + (255,)
        for k in range(1, S + 1):
            if 0 <= ty - k < PH: px[x, ty - k] = (30, 44, 26, 255)
    rr = random.Random(7)
    for _ in range(10):
        x = rr.randint(2, W - 3); y = int(top(x)) + rr.randint(4, 12)
        if y < H - 1:
            col = rr.choice([(214, 92, 74), (238, 220, 130), (230, 236, 240)])
            for a in range(2 * S):
                for b in range(S):
                    px[x * S + a, y * S + b] = col + (255,)
    return im

for i in range(4):
    dirt_tile(100 + i * 31, depth=1).save(f'{OUT}ground-{i}.png')
ground_top().save(OUT + 'ground-top.png')
bush_strip().save(OUT + 'bush-strip.png')
print('terrain art written')
