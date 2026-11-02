# ART REQUEST 18 — 琪寶寶：圓紙扇 → 藍色手提電風扇（全套重畫）

From: Claude → To: Cursor (image generation + wiring). Same owner, same game.

**Read `ART-REQUEST-02-animation.md` first.** Every global rule still applies: flat magenta
`#FF00FF` background, frames left → right in equal cells, facing RIGHT, feet on one baseline, no
text or letters, 16-bit SNES pixel look with the 8×8 grid trick, model sheet first and then used
as the reference for every later image.

## Timing

**Start only after the Stage 4 mobile fixes (clear-card touch, 泥鬃 platform, 蜜僵 speed) are
merged.** Continent 1 is this Christmas's build — don't run both at once.

## What changes (Alan, 2026-11-03)

琪寶寶's round paper fan is replaced everywhere by a **small blue handheld electric fan** — the
portable kind people carry around Hong Kong in summer.

- Shape: a round fan head (3–5 blades) inside a round guard grille, on a short straight handle.
- Colour: blue body and handle; blades a lighter blue or white so they read against the body.
  Pick a blue that sits well with her existing palette.
- No brand, no logo, no text, no buttons with symbols.
- Size: about the same as the paper fan it replaces.

**One-for-one swap.** Wherever the paper fan appears today — in her hand or carried on her back —
the electric fan goes in the same place, at the same size. On her back it hangs from a short
strap. The paper fan's tassel becomes the strap: it keeps the one-frame-lag secondary motion.

**Nothing else changes:** face, hair, outfit, sword, proportions, frame count, cell size,
baseline and facing all stay exactly as they are, so the existing slicing and `data/anim/kibobo.json`
still fit.

### Glide and float

- `fan-glide` [3]: she holds the fan overhead pointing down; blades drawn as a spinning blur
  (alternate the blur between frames); a few short air lines below it.
- `fan-float` [3]: same pose, lifted by the wind vent; stronger air lines.

## Files to redraw

Model sheet first, then everything else with it as the reference:

1. `art-src/anim/kibobo/model-sheet.png`
2. `art-src/anim/kibobo/`: `idle`, `run`, `jump`, `crouch`, `hurt`, `ko`, `slash1`, `slash2`,
   `slash3`, `win`, `fan-glide`, `fan-float`, `bike-ride`, `bike-jump`, `moto-ride`, `moto-jump`
3. If they exist by then: the stage 4–5 tactical-outfit sheets from ART-REQUEST-14.
4. `art-src/portraits/kibobo.png`, and her entries in `art-src/gen/portraits.png` and
   `art-src/gen/kibobo-poses.png` if the game still uses them.
5. `art-src/map/map-walk.png` (her in the chibi walk group).
6. Story art that shows her fan — check every file in `art-src/story/` (for example `cover.png`,
   `c1-picnic.png`, `c2-bike.png`, the ending panels). Redraw only the ones where the fan shows.
7. `art-src/bear-girl.png`, if it is still used anywhere.

## Text and sound

- `data/story.json` line 404: 「風口我嚟！把扇一開，我飄得上最高嗰格。」 →
  「風口我嚟！風扇一開，我飄得上最高嗰格。」 **(confirmed by Alan, 2026-11-03)**
- `docs/bible/game-design.md` and `docs/bible/characters.md`: 「紙扇」 → 「手提電風扇」.
- Optional: a soft motor whirr layered under the existing wind sound on glide/float.

## Acceptance

- [ ] Every redrawn sheet re-slices with the existing anim data: same frame count, cell size and
      baseline; no frame jumps when playing.
- [ ] Old vs new side-by-side screenshots for each sheet in `docs/qa-fan/`.
- [ ] Stage 2 wind vent: glide and float work on phone (touch) and desktop.
- [ ] No paper fan left anywhere: title/cover, clear card, map, story panels, ending.
- [ ] Separate branch and PR; no merge without Alan's go-ahead.
