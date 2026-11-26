#!/usr/bin/env python3
"""
art-trial: redraw s8drone + s9jailguard (deterministic PIL).

- Keeps data/anim/*.json unchanged (256×352, 12 cols, 24 frames, same anim order).
- Figures fill ~80% of frame height (old sheets ~45%).
- Style: dark outline + 2–3 shade layers (match fish / hatsoldier / mechpig).

Run from repo root:
  python3 scripts/art/gen_art_trial_enemies.py

Writes:
  public/art/stage8/enemies/s8drone.png
  public/art/stage9/enemies/s9jailguard.png
  public/art/_art-trial/compare.png
  public/art/_art-trial/s8drone-walk.gif
  public/art/_art-trial/s9jailguard-walk.gif
"""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DRONE_PATH = ROOT / "public" / "art" / "stage8" / "enemies" / "s8drone.png"
GUARD_PATH = ROOT / "public" / "art" / "stage9" / "enemies" / "s9jailguard.png"
HAT_PATH = ROOT / "public" / "art" / "anim" / "hatsoldier.png"
OUT_DIR = ROOT / "public" / "art" / "_art-trial"
OLD_DIR = OUT_DIR / "old"

# Logical canvas (res:4 → display 64×88; sheet stores ×4)
LW, LH = 64, 88
SCALE = 4
FW, FH = LW * SCALE, LH * SCALE  # 256×352
COLS = 12
FRAMES = 24

OUTLINE = (28, 18, 14, 255)

# Drone palette (steel blue)
D_LIT = (168, 196, 220, 255)
D_MID = (92, 128, 168, 255)
D_DARK = (48, 72, 104, 255)
D_PROP = (120, 190, 230, 255)
D_PROP_DIM = (70, 120, 160, 255)
D_LAMP_OFF = (90, 40, 36, 255)
D_LAMP_ON = (255, 90, 60, 255)
D_LAMP_CORE = (255, 220, 160, 255)
D_ACCENT = (220, 70, 70, 255)

# Jailguard palette
G_SKIN_L = (240, 188, 148, 255)
G_SKIN = (214, 150, 110, 255)
G_SKIN_D = (170, 100, 72, 255)
G_UNI_L = (70, 110, 150, 255)
G_UNI = (40, 70, 110, 255)
G_UNI_D = (22, 40, 70, 255)
G_HAT = (28, 48, 78, 255)
G_BOOT = (36, 28, 28, 255)
G_BATON = (70, 70, 78, 255)
G_BATON_L = (140, 140, 150, 255)
G_KEY = (220, 180, 70, 255)
G_HAIR = (60, 40, 28, 255)


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


def shade_ellipse(im: Image.Image, box, lit, mid, dark) -> None:
    """Fill ellipse with 3-tone lighting from upper-left."""
    d = ImageDraw.Draw(im)
    d.ellipse(box, fill=mid)
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = max(1, (x1 - x0) / 2), max(1, (y1 - y0) / 2)
    px = im.load()
    W, H = im.size
    for y in range(max(0, int(y0)), min(H, int(y1) + 1)):
        for x in range(max(0, int(x0)), min(W, int(x1) + 1)):
            if px[x, y][3] == 0:
                continue
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            if nx * nx + ny * ny > 1.05:
                continue
            lit_k = (-nx - ny) / 2
            if lit_k > 0.28:
                px[x, y] = lit
            elif lit_k < -0.18:
                px[x, y] = dark


def blit(dst: Image.Image, src: Image.Image, ox: int, oy: int) -> None:
    dst.alpha_composite(src, (ox, oy))


def upscale(im: Image.Image) -> Image.Image:
    return im.resize((FW, FH), Image.Resampling.NEAREST)


def sheet_from_frames(frames: list[Image.Image]) -> Image.Image:
    assert len(frames) == FRAMES
    rows = (FRAMES + COLS - 1) // COLS
    sheet = new(COLS * FW, rows * FH)
    for i, fr in enumerate(frames):
        if fr.size != (FW, FH):
            fr = fr.resize((FW, FH), Image.Resampling.NEAREST)
        c, r = i % COLS, i // COLS
        sheet.paste(fr, (c * FW, r * FH), fr)
    return sheet


def extract_frame(sheet: Image.Image, idx: int, fw=FW, fh=FH, cols=COLS) -> Image.Image:
    c, r = idx % cols, idx // cols
    return sheet.crop((c * fw, r * fh, c * fw + fw, r * fh + fh))


# ── s8drone ─────────────────────────────────────────────────────────────

def prop_blade(angle_q: int, bright: bool = True, size: int = 15) -> Image.Image:
    """Propeller cross; angle_q 0..3 rotates look. size≈15 fills tall silhouette."""
    im = new(size, size)
    d = ImageDraw.Draw(im)
    col = D_PROP if bright else D_PROP_DIM
    hub = (200, 220, 235, 255)
    cx = cy = size // 2
    r = size // 2 - 1
    if angle_q % 2 == 0:
        d.rectangle((1, cy - 1, size - 2, cy + 1), fill=col)
        d.rectangle((cx - 1, 1, cx + 1, size - 2), fill=col)
    else:
        d.line((2, 2, size - 3, size - 3), fill=col, width=2)
        d.line((2, size - 3, size - 3, 2), fill=col, width=2)
    d.ellipse((cx - 2, cy - 2, cx + 2, cy + 2), fill=hub)
    # tip glow
    for t in ((1, cy), (size - 2, cy), (cx, 1), (cx, size - 2)):
        d.point(t, fill=D_LIT if bright else D_PROP_DIM)
    return im


def draw_drone(frame: int) -> Image.Image:
    """
    Side view facing right. Anim order:
      0–3 idle, 4–7 walk/strafe, 8–11 warning (lamp on),
      12–15 attack, 16–19 hurt, 20–23 defeat.
    Silhouette targets ~80% of frame height (props span top→bottom).
    """
    im = new(LW, LH)
    anim = frame // 4
    fi = frame % 4
    bob = [0, -1, 0, 1][fi]
    if anim == 5:  # defeat
        bob = fi * 2
    tilt = 0
    if anim == 1:  # walk
        tilt = [-2, 0, 2, 0][fi]
    elif anim == 3:  # attack dive tilt
        tilt = [0, 3, 5, 2][fi]
    elif anim == 4:  # hurt
        tilt = [-3, -1, 1, 2][fi]

    # Large flat body; props reach near top & bottom → ~80% fill
    cx, cy = 32, 44 + bob
    body_w, body_h = 46, 30  # round-flat chassis

    # Prop mounts (4 arms) — vertical span ≈ y8..y80 (+ blade radius)
    mounts = [
        (cx - 22, cy - 26 + tilt),  # top-back
        (cx + 20, cy - 28 - tilt),  # top-front
        (cx - 24, cy + 24 + tilt),  # bot-back
        (cx + 22, cy + 22 - tilt),  # bot-front
    ]
    d = ImageDraw.Draw(im)
    for mx, my in mounts:
        d.line((cx, cy, mx, my), fill=D_DARK, width=3)
        d.line((cx, cy, mx, my), fill=D_MID, width=1)

    # Body (flattened oval) with 3-tone shade
    bx0 = cx - body_w // 2
    by0 = cy - body_h // 2 + tilt // 2
    shade_ellipse(im, (bx0, by0, bx0 + body_w, by0 + body_h), D_LIT, D_MID, D_DARK)
    # panel seams
    px = im.load()
    for x in range(bx0 + 6, bx0 + body_w - 6):
        y = cy + tilt // 2
        if 0 <= y < LH and px[x, y][3]:
            px[x, y] = D_DARK
    for y in range(by0 + 6, by0 + body_h - 6):
        x = cx - 2
        if px[x, y][3]:
            px[x, y] = D_DARK
    # rear thruster
    d.ellipse((bx0 - 4, cy - 6 + tilt // 2, bx0 + 5, cy + 6 + tilt // 2), fill=D_DARK)
    d.ellipse((bx0 - 2, cy - 3 + tilt // 2, bx0 + 2, cy + 3 + tilt // 2), fill=D_PROP)

    # Front red optic (large)
    ox = bx0 + body_w - 12
    oy = cy - 5 + tilt // 2
    d.ellipse((ox, oy, ox + 10, oy + 10), fill=D_ACCENT)
    d.ellipse((ox + 2, oy + 2, ox + 6, oy + 6), fill=(255, 160, 120, 255))
    d.point((ox + 3, oy + 3), fill=(255, 240, 220, 255))

    # Bottom searchlight (big)
    lamp_on = anim in (2, 3)
    lx, ly = cx - 5, by0 + body_h - 2
    lamp = D_LAMP_ON if lamp_on else D_LAMP_OFF
    d.ellipse((lx, ly, lx + 12, ly + 10), fill=lamp)
    d.ellipse((lx + 1, ly + 1, lx + 11, ly + 9), fill=D_DARK if not lamp_on else D_LAMP_ON)
    if lamp_on:
        d.ellipse((lx + 3, ly + 3, lx + 9, ly + 7), fill=D_LAMP_CORE)
        glow = (255, 150, 80, 110 if anim == 2 else 160)
        for i, w in enumerate((8, 14, 20, 26)):
            yy = ly + 9 + i * 3
            if yy < LH - 2:
                d.ellipse((cx - w // 2, yy, cx + w // 2, min(LH - 1, yy + 4)), fill=glow)

    # Propellers spinning
    pq = (fi + anim) % 4
    for i, (mx, my) in enumerate(mounts):
        blade = prop_blade((pq + i) % 4, bright=anim != 5, size=15)
        blit(im, blade, mx - 7, my - 7)

    # Attack: forward streak
    if anim == 3 and fi >= 1:
        for i in range(4):
            d.line(
                (bx0 - 6 - i * 4, cy + tilt // 2 - 2, bx0 - 2 - i * 4, cy + tilt // 2 + 2),
                fill=D_PROP,
                width=2,
            )

    # Hurt sparks
    if anim == 4:
        for sx, sy in ((cx + 14, cy - 16), (cx - 12, cy + 12), (cx + 6, cy - 8)):
            d.rectangle((sx + fi, sy - fi, sx + fi + 1, sy - fi + 1), fill=(255, 220, 120, 255))
            d.point((sx + 2 + fi, sy - 1 - fi), fill=D_ACCENT)

    # Defeat
    if anim == 5:
        if fi >= 2:
            d.ellipse((cx - 8, cy - 28, cx + 2, cy - 18), fill=(120, 120, 130, 180))
            d.ellipse((cx + 4, cy - 32, cx + 14, cy - 20), fill=(90, 90, 100, 160))
        if fi == 3:
            im = new(LW, LH)
            d2 = ImageDraw.Draw(im)
            shade_ellipse(im, (10, 52, 54, 78), D_LIT, D_MID, D_DARK)
            for mx, my in ((12, 48), (50, 48), (14, 80), (48, 80)):
                blit(im, prop_blade(fi, False, 15), mx - 7, my - 7)
            d2.ellipse((26, 70, 40, 80), fill=D_LAMP_OFF)
            outline(im)
            return upscale(im)

    outline(im)
    return upscale(im)


# ── s9jailguard ─────────────────────────────────────────────────────────

def limb(im: Image.Image, x0, y0, x1, y1, thick, lit, mid, dark) -> None:
    """Draw a short shaded limb segment as thick line + ellipse joints."""
    d = ImageDraw.Draw(im)
    d.line((x0, y0, x1, y1), fill=mid, width=thick)
    d.ellipse((x0 - 1, y0 - 1, x0 + 1, y0 + 1), fill=lit)
    d.ellipse((x1 - 1, y1 - 1, x1 + 1, y1 + 1), fill=dark)


def draw_guard(frame: int) -> Image.Image:
    """
    Side-view facing right (match old sheet / hatsoldier).
    Thick shoulders, baton, belt keys. Walk: opposite arm/leg.
    Warning: raise baton. Attack: swing down.
    """
    im = new(LW, LH)
    d = ImageDraw.Draw(im)
    anim = frame // 4
    fi = frame % 4

    # ~80% of 88 ≈ 70px tall; feet near bottom
    foot_y = 85
    bob = 0
    if anim in (0, 1):
        bob = [0, -2, 0, -2][fi] if anim == 1 else [0, -1, 0, -1][fi]
    hip_y = foot_y - 26 + bob
    shoulder_y = hip_y - 22
    head_top = shoulder_y - 18  # short neck stack → ~80% height
    cx = 30

    # Defeat: collapse to prone
    if anim == 5 and fi >= 3:
        im2 = new(LW, LH)
        d2 = ImageDraw.Draw(im2)
        shade_ellipse(im2, (12, 70, 50, 82), G_UNI_L, G_UNI, G_UNI_D)
        shade_ellipse(im2, (48, 68, 60, 80), G_SKIN_L, G_SKIN, G_SKIN_D)
        d2.rectangle((48, 66, 62, 72), fill=G_HAT)
        d2.rectangle((6, 76, 18, 82), fill=G_BOOT)
        d2.rectangle((40, 78, 56, 84), fill=G_BOOT)
        d2.line((28, 74, 44, 64), fill=G_BATON, width=2)
        d2.ellipse((26, 78, 34, 84), fill=G_KEY)
        outline(im2)
        return upscale(im2)

    # Legs — side view: far leg then near leg
    if anim == 1:  # walk stride
        if fi % 2 == 0:
            far = (cx - 2, hip_y, cx - 10, foot_y)
            near = (cx + 2, hip_y - 1, cx + 12, foot_y)
            arm_far = (cx - 2, shoulder_y + 2, cx - 10, shoulder_y + 16)
            arm_near = (cx + 4, shoulder_y + 2, cx + 2, shoulder_y + 14)
            baton = (cx + 2, shoulder_y + 12, cx + 4, shoulder_y + 26)
        else:
            far = (cx - 2, hip_y - 1, cx - 12, foot_y)
            near = (cx + 2, hip_y, cx + 10, foot_y)
            arm_far = (cx - 2, shoulder_y + 2, cx + 2, shoulder_y + 16)
            arm_near = (cx + 4, shoulder_y + 2, cx + 12, shoulder_y + 14)
            baton = (cx + 12, shoulder_y + 12, cx + 14, shoulder_y + 26)
    elif anim == 2:  # warning: plant + raise
        far = (cx - 4, hip_y, cx - 10, foot_y)
        near = (cx + 4, hip_y, cx + 10, foot_y)
        raise_amt = [6, 12, 18, 20][fi]
        arm_far = (cx - 4, shoulder_y + 2, cx - 8, shoulder_y + 14)
        arm_near = (cx + 4, shoulder_y, cx + 8, shoulder_y - raise_amt)
        baton = (cx + 7, shoulder_y - raise_amt, cx + 9, shoulder_y - raise_amt - 14)
    elif anim == 3:  # attack swing
        lean = [0, 2, 5, 3][fi]
        cx += lean
        far = (cx - 6, hip_y, cx - 12, foot_y)
        near = (cx + 4, hip_y, cx + 12, foot_y)
        swing = [
            (cx + 6, shoulder_y - 18, cx + 8, shoulder_y - 30),
            (cx + 12, shoulder_y - 6, cx + 20, shoulder_y - 12),
            (cx + 14, shoulder_y + 4, cx + 28, shoulder_y + 2),
            (cx + 10, shoulder_y + 10, cx + 22, shoulder_y + 14),
        ]
        ax0, ay0, ax1, ay1 = swing[fi]
        arm_far = (cx - 4, shoulder_y + 2, cx - 10, shoulder_y + 12)
        arm_near = (cx + 4, shoulder_y, ax0, ay0)
        baton = (ax0, ay0, ax1, ay1)
    elif anim == 4:  # hurt
        far = (cx, hip_y, cx - 2, foot_y)
        near = (cx + 4, hip_y, cx + 2, foot_y)
        arm_far = (cx - 2, shoulder_y, cx - 10, shoulder_y + 6)
        arm_near = (cx + 4, shoulder_y, cx + 2, shoulder_y + 10)
        baton = (cx + 2, shoulder_y + 8, cx, shoulder_y + 20)
        cx -= fi
    elif anim == 5:  # defeat early frames
        sink = fi * 6
        far = (cx - 6, hip_y + sink // 2, cx - 12, foot_y)
        near = (cx + 2, hip_y + sink // 2, cx + 10, min(foot_y, foot_y - 2 + sink // 3))
        arm_far = (cx - 4, shoulder_y + sink // 2, cx - 10, shoulder_y + 10 + sink // 2)
        arm_near = (cx + 4, shoulder_y + sink // 2, cx + 10, shoulder_y + 8 + sink // 2)
        baton = (cx + 10, shoulder_y + 6 + sink // 2, cx + 16, shoulder_y + 2 + sink // 2)
        head_top += sink
        shoulder_y += sink // 2
        hip_y += sink // 2
    else:  # idle
        far = (cx - 3, hip_y, cx - 5 - (fi % 2), foot_y)
        near = (cx + 2, hip_y, cx + 6 + (fi % 2), foot_y)
        arm_far = (cx - 3, shoulder_y + 2, cx - 8, shoulder_y + 14)
        arm_near = (cx + 4, shoulder_y + 2, cx + 8, shoulder_y + 14)
        baton = (cx + 8, shoulder_y + 12, cx + 10, shoulder_y + 26)

    # Draw far limbs first
    limb(im, *far, 4, G_UNI_D, G_UNI, G_UNI_D)
    d.rectangle((far[2] - 3, far[3] - 2, far[2] + 4, far[3] + 1), fill=G_BOOT)
    limb(im, *arm_far, 3, G_SKIN_D, G_SKIN, G_SKIN_D)

    # Torso (side oval) + thick shoulder
    shade_ellipse(im, (cx - 8, shoulder_y - 2, cx + 10, hip_y + 2), G_UNI_L, G_UNI, G_UNI_D)
    shade_ellipse(im, (cx - 2, shoulder_y - 6, cx + 14, shoulder_y + 8), G_UNI_L, G_UNI, G_UNI_D)  # 厚肩

    # Belt + keys at hip (viewer-front of belt)
    d.rectangle((cx - 6, hip_y - 1, cx + 9, hip_y + 3), fill=G_BOOT)
    kx = cx + 6
    d.ellipse((kx, hip_y + 1, kx + 4, hip_y + 6), fill=G_KEY)
    d.ellipse((kx + 3, hip_y + 3, kx + 7, hip_y + 8), fill=(200, 155, 55, 255))
    d.line((kx + 2, hip_y + 1, kx + 2, hip_y + 9), fill=(150, 110, 40, 255), width=1)

    # Near leg / arm / baton
    limb(im, *near, 4, G_UNI_L, G_UNI, G_UNI_D)
    d.rectangle((near[2] - 3, near[3] - 2, near[2] + 4, near[3] + 1), fill=G_BOOT)
    limb(im, *arm_near, 3, G_SKIN_L, G_SKIN, G_SKIN_D)
    d.line((baton[0], baton[1], baton[2], baton[3]), fill=G_BATON, width=3)
    d.line((baton[0], baton[1], baton[2], baton[3]), fill=G_BATON_L, width=1)

    # Head (side) sitting on short neck
    hx = cx + 4
    hy = head_top + bob
    d.rectangle((hx - 1, hy + 9, hx + 3, shoulder_y), fill=G_SKIN)  # neck
    shade_ellipse(im, (hx - 4, hy, hx + 8, hy + 12), G_SKIN_L, G_SKIN, G_SKIN_D)
    d.rectangle((hx - 3, hy, hx + 7, hy + 3), fill=G_HAIR)
    # peaked cap
    d.polygon([(hx - 5, hy + 2), (hx + 2, hy - 4), (hx + 9, hy + 2)], fill=G_HAT)
    d.rectangle((hx - 6, hy + 1, hx + 10, hy + 3), fill=G_HAT)
    d.point((hx + 3, hy), fill=G_KEY)
    d.point((hx + 5, hy + 6), fill=OUTLINE)  # eye facing right

    outline(im)
    return upscale(im)


# ── compare + gifs ──────────────────────────────────────────────────────

def make_walk_gif(sheet: Image.Image, path: Path, fps: int = 6) -> None:
    frames = [extract_frame(sheet, i) for i in range(4, 8)]
    # trim transparent margins a bit for clearer gif, keep canvas
    duration = int(1000 / fps)
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
    )


def make_compare(old_drone: Image.Image, new_drone: Image.Image, old_guard: Image.Image, new_guard: Image.Image) -> Image.Image:
    """Old | New | hatsoldier ref — one frame each, labeled rows for drone & guard."""
    hat_sheet = Image.open(HAT_PATH).convert("RGBA")
    hat = hat_sheet.crop((0, 0, 124, 130))
    # scale hat to similar preview height
    hat_p = hat.resize((FW // 2, int(130 * (FW // 2) / 124)), Image.Resampling.NEAREST)

    cell_w, cell_h = FW, FH
    pad = 16
    label_h = 28
    cols_n = 3
    rows_n = 2
    W = cols_n * cell_w + (cols_n + 1) * pad
    H = rows_n * (cell_h + label_h) + (rows_n + 1) * pad + 36
    canvas = Image.new("RGBA", (W, H), (18, 14, 22, 255))
    d = ImageDraw.Draw(canvas)
    d.text((pad, 8), "art-trial  new vs old  (+ hatsoldier ref)", fill=(255, 220, 140, 255))

    def place(img, col, row, title):
        x = pad + col * (cell_w + pad)
        y = 36 + pad + row * (cell_h + label_h + pad)
        # checker behind
        for yy in range(0, cell_h, 8):
            for xx in range(0, cell_w, 8):
                if (xx // 8 + yy // 8) % 2 == 0:
                    d.rectangle((x + xx, y + yy, x + xx + 8, y + yy + 8), fill=(28, 24, 34, 255))
        canvas.alpha_composite(img, (x, y))
        d.text((x, y + cell_h + 4), title, fill=(220, 210, 190, 255))

    place(extract_frame(old_drone, 4), 0, 0, "s8drone OLD walk")
    place(extract_frame(new_drone, 4), 1, 0, "s8drone NEW walk")
    # hatsoldier centered in cell
    hat_cell = new(cell_w, cell_h)
    hx = (cell_w - hat_p.size[0]) // 2
    hy = cell_h - hat_p.size[1] - 8
    hat_cell.alpha_composite(hat_p, (hx, hy))
    place(hat_cell, 2, 0, "hatsoldier REF")

    place(extract_frame(old_guard, 4), 0, 1, "s9jailguard OLD walk")
    place(extract_frame(new_guard, 4), 1, 1, "s9jailguard NEW walk")
    place(hat_cell, 2, 1, "hatsoldier REF")
    return canvas


def content_fill(im: Image.Image) -> float:
    bb = im.split()[-1].getbbox()
    if not bb:
        return 0.0
    return (bb[3] - bb[1]) / im.size[1]


def load_old_sheet(path: Path, git_rel: str) -> Image.Image:
    """Prefer committed HEAD version as 'old' so re-runs don't compare new-vs-new."""
    import subprocess

    try:
        data = subprocess.check_output(["git", "show", f"origin/main:{git_rel}"], cwd=ROOT)
        from io import BytesIO

        return Image.open(BytesIO(data)).convert("RGBA")
    except Exception:
        return Image.open(path).convert("RGBA")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OLD_DIR.mkdir(parents=True, exist_ok=True)

    # True pre-trial sheets from git HEAD (Manus), not whatever is on disk after prior runs
    old_drone = load_old_sheet(DRONE_PATH, "public/art/stage8/enemies/s8drone.png")
    old_guard = load_old_sheet(GUARD_PATH, "public/art/stage9/enemies/s9jailguard.png")
    old_drone.save(OLD_DIR / "s8drone.png")
    old_guard.save(OLD_DIR / "s9jailguard.png")

    print("drawing s8drone…")
    drone_frames = [draw_drone(i) for i in range(FRAMES)]
    drone_sheet = sheet_from_frames(drone_frames)
    drone_sheet.save(DRONE_PATH)
    print(" ", DRONE_PATH.relative_to(ROOT), drone_sheet.size, f"fill≈{content_fill(drone_frames[0])*100:.0f}%")

    print("drawing s9jailguard…")
    guard_frames = [draw_guard(i) for i in range(FRAMES)]
    guard_sheet = sheet_from_frames(guard_frames)
    guard_sheet.save(GUARD_PATH)
    print(" ", GUARD_PATH.relative_to(ROOT), guard_sheet.size, f"fill≈{content_fill(guard_frames[0])*100:.0f}%")

    compare = make_compare(old_drone, drone_sheet, old_guard, guard_sheet)
    compare_path = OUT_DIR / "compare.png"
    compare.save(compare_path)
    print(" ", compare_path.relative_to(ROOT))

    make_walk_gif(drone_sheet, OUT_DIR / "s8drone-walk.gif", fps=6)
    make_walk_gif(guard_sheet, OUT_DIR / "s9jailguard-walk.gif", fps=6)
    print(" ", "s8drone-walk.gif / s9jailguard-walk.gif")

    # Copy deliverables to artifacts for agent report
    art_out = Path("/opt/cursor/artifacts/art-trial")
    art_out.mkdir(parents=True, exist_ok=True)
    for name in ("compare.png", "s8drone-walk.gif", "s9jailguard-walk.gif"):
        shutil.copy2(OUT_DIR / name, art_out / name)
    shutil.copy2(DRONE_PATH, art_out / "s8drone.png")
    shutil.copy2(GUARD_PATH, art_out / "s9jailguard.png")
    print("artifacts →", art_out)


if __name__ == "__main__":
    main()
