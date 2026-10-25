#!/usr/bin/env python3
"""Hand-tuned pixel terrain for stage 1 (deterministic). Run: python3 scripts/art/gen_terrain.py
Outputs public/art/tiles/: ground-0..3.png (16x16 dirt), ground-top.png (32x40 grass lip + dirt),
bush-strip.png (tileable 192x44 foreground bushes). Palette matches the enemy lineup (earthy, 4-tone)."""
import random, math
from PIL import Image

OUT = 'public/art/tiles/'
R = random.Random(20261025)

DIRT = [(46, 28, 20), (74, 46, 28), (102, 66, 38), (134, 92, 54)]      # dark → light
STONE = [(70, 64, 60), (112, 104, 96), (160, 150, 138)]
ROOT = (58, 36, 22)
GRASS = [(22, 48, 26), (38, 76, 34), (66, 112, 44), (110, 156, 66), (160, 196, 96)]
INK = (24, 16, 14)

def dirt_tile(seed, depth=0, W=16, H=16, pebbles=None):
    """Clumpy dirt: 4x4 coarse value noise (bilinear) quantised to 3 tones, sparse pebbles, roots."""
    r = random.Random(seed)
    gw, gh = W // 4 + 2, H // 4 + 2
    grid = [[r.random() for _ in range(gw)] for _ in range(gh)]
    im = Image.new('RGBA', (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            gx, gy = x / 4, y / 4
            x0, y0 = int(gx), int(gy); fx, fy = gx - x0, gy - y0
            v = (grid[y0][x0] * (1 - fx) * (1 - fy) + grid[y0][x0 + 1] * fx * (1 - fy)
                 + grid[y0 + 1][x0] * (1 - fx) * fy + grid[y0 + 1][x0 + 1] * fx * fy)
            v += (r.random() - 0.5) * 0.12          # tiny grain, not salt-and-pepper
            idx = 0 if v < 0.28 else (1 if v < 0.68 else 2)
            px[x, y] = DIRT[idx] + (255,)
    n = pebbles if pebbles is not None else r.choice([0, 1, 1, 2])
    for _ in range(n):
        cx, cy, rr = r.randint(3, W - 4), r.randint(3, H - 4), r.choice([1, 1, 2])
        for y in range(cy - rr, cy + rr + 1):
            for x in range(cx - rr - 1, cx + rr + 2):
                if 0 <= x < W and 0 <= y < H and (x - cx) ** 2 / (rr + 1) ** 2 + (y - cy) ** 2 / (rr + 0.5) ** 2 <= 1:
                    t = 2 if (x < cx and y < cy) else (0 if (x > cx or y > cy) else 1)
                    px[x, y] = STONE[t] + (255,)
        if cy + rr + 1 < H:
            for x in range(cx - rr, cx + rr + 1):
                if 0 <= x < W: px[x, cy + rr + 1] = DIRT[0] + (255,)   # contact shadow
    if r.random() < 0.45:
        x = r.randint(2, W - 3)
        for y in range(r.randint(0, H // 3), r.randint(H // 2, H - 1)):
            x = max(0, min(W - 1, x + r.choice([-1, 0, 0, 0, 1])))
            px[x, y] = ROOT + (255,)
    if depth:
        k = 1 - 0.13 * depth
        for y in range(H):
            for x in range(W):
                c = px[x, y]
                px[x, y] = (int(c[0] * k), int(c[1] * k), int(c[2] * k), 255)
    return im

def ground_top():
    W, H = 96, 40
    # one wide dirt body (no 16px repeat), slightly darker towards the bottom
    im = dirt_tile(4242, depth=0, W=W, H=H, pebbles=5)
    for y in range(24, H):
        for x in range(W):
            c = im.getpixel((x, y)); im.putpixel((x, y), (int(c[0] * .88), int(c[1] * .88), int(c[2] * .88), 255))
    px = im.load()
    # grass lip: wavy bottom edge 6..9px
    for x in range(W):
        lip = 6 + int(1.5 + 1.5 * math.sin(x * 2 * math.pi / W * 5) + 0.8 * math.sin(x * 2 * math.pi / W * 11 + 1) + R.random())
        for y in range(lip):
            shade = 3 if y <= 1 else (2 if y < lip - 2 else 1)
            if (x + y) % 7 == 0 and y < lip - 1: shade = min(4, shade + 1)
            px[x, y] = GRASS[shade] + (255,)
        px[x, lip] = GRASS[0] + (255,)          # dark grass shadow on the dirt
        if lip + 1 < H: 
            c = px[x, lip + 1]; px[x, lip + 1] = (int(c[0] * .8), int(c[1] * .8), int(c[2] * .8), 255)
    # top highlight line + small flowers
    for x in range(W):
        px[x, 0] = GRASS[4] + (255,)
    for fx in (5, 37, 70):
        px[fx, 1] = (236, 214, 120, 255); px[fx + 1, 2] = (236, 214, 120, 255)
    return im

def bush_strip():
    W, H = 192, 44
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    # periodic silhouette (tileable): sum of bumps with integer frequencies
    def top(x):
        t = x / W * 2 * math.pi
        return 18 + 7 * math.sin(3 * t) + 4 * math.sin(7 * t + 1.3) + 2.5 * math.sin(13 * t + 0.4)
    for x in range(W):
        ty = int(top(x))
        for y in range(max(0, ty), H):
            d = y - ty
            # light from top-left: lighter near the top edge, darker lower
            if d <= 1: c = GRASS[3]
            elif d <= 5: c = GRASS[2]
            elif d <= 14: c = GRASS[1]
            else: c = GRASS[0]
            # leaf texture
            if (x * 3 + y * 5) % 11 == 0 and d > 2: c = GRASS[min(4, GRASS.index(c) + 1)]
            px[x, y] = c + (255,)
        if 0 <= ty - 1 < H: px[x, ty - 1] = (30, 44, 26, 255)  # soft dark rim (not pure black)
    # a few berries / flowers
    rr = random.Random(7)
    for _ in range(10):
        x = rr.randint(2, W - 3); y = int(top(x)) + rr.randint(4, 12)
        if y < H - 1:
            col = rr.choice([(214, 92, 74), (238, 220, 130), (230, 236, 240)])
            px[x, y] = col + (255,); px[x + 1, y] = col + (255,)
    return im

for i in range(4):
    dirt_tile(100 + i * 31, depth=1).save(f'{OUT}ground-{i}.png')
ground_top().save(OUT + 'ground-top.png')
bush_strip().save(OUT + 'bush-strip.png')
print('terrain art written')
