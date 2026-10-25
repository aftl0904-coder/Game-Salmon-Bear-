# ART REQUEST 02 — 動作幀、特效、背景物件、封面、過場、結局

From: Claude (game programmer / art integrator) → To: Cursor (image generation)
Owner: Alan Fong. Personal, non-commercial gift game. Read this whole file before generating.

This request **supersedes the hero/enemy parts of earlier art batches**. If you already made
images for batch 1 / batch 2 (`art/gen-batch-1`, `art/gen-batch-2`), push them anyway and use
the good ones as reference images here.

## Why

Right now every character is **one still picture that slides around**. We want real animation:
every action gets **3–5 frames** (walk, attack, hurt, etc.), plus hit effects, background props,
title cover, cutscene stills and ending art. Claude will slice, clean, palette-match and wire
everything into the game. You only make images and push them.

---

## Global rules (apply to every image)

1. **Style**: top-tier 16-bit SNES pixel art (think late-era Super Famicom action games), clean
   1px dark outlines, limited palette per character (≤ 24 colours), light from the top-left,
   no gradients, no anti-aliased blur, no painterly texture, no photo look.
2. **Original designs only.** Do not draw Winnie the Pooh, Disney characters, Konami/Goemon
   characters or any existing franchise character. 噗噗 is our own original bear.
3. **Same character = same design in every frame and every file.** Use the reference images
   listed below as image input every time (and the model sheet once you have made it).
   Same proportions, same clothes, same colours, same size.
4. **Sprite sheets** (characters, enemies, FX):
   - Flat solid **magenta background `#FF00FF`** (no gradient, no floor, no shadow, no scenery).
   - Frames laid out **left → right in one row** (or a regular grid if there are more than 5),
     **equal cell size**, at least 24px empty gap between frames. Frames must not touch.
   - Side view, **facing RIGHT**.
   - **Feet on the same baseline** in every frame (same bottom line), same scale across frames.
   - No text, no labels, no frame numbers, no watermark.
   - Any canvas size is fine (e.g. 1536×1024 or 1536×512); bigger is better — Claude scales down.
5. **Illustrations** (cover, cutscenes, ending, portraits): pixel art too, 16:9 (e.g. 1920×1080),
   **no text or letters at all** (Claude adds all text in-game). Leave the empty areas noted.
6. **Tone**: bright and cute at stage 1, getting creepier stage by stage (atmosphere horror —
   darkness, silhouettes, fog — never gore).

### Push the detail to the maximum (Alan's request: 「視覺推到極致」)

Use everything modern image models do well (reference-image consistency, high resolution,
precise lighting) — but the result must still read as hand-placed 16-bit pixels.

**Pixel grid trick (sprites):** describe each sprite as "pixel art drawn on a native grid where
the character is 72 px tall (head-to-body ≈ 1:3), upscaled 8× with nearest-neighbour so every
art pixel is a crisp 8×8 square". Same for enemies (fish 40 px, hat soldier 56 px, mech pig 72 px,
噗噗 56 px) and items (20–28 px). Claude snaps it back to the native grid.

**Detail checklist for every character frame:**
- 3–4 shade steps per material (skin, hair, hoodie, denim, sneakers, metal), light top-left,
  a thin warm rim light on the right edge, darker cool shadow side.
- Hair with highlight bands and individual strand tips; eyes with a 1-pixel catch light.
- Cloth details: hoodie zipper glint, drawstrings, sleeve folds, denim seams, sneaker soles.
- Weapon details: salmon-gun scales, fin, glossy eye; sword edge glint; paper-fan ribs + tassel.
- **Secondary motion**: ponytail, fan tassel, hoodie strings and 噗噗's ears lag one frame behind
  the body (follow-through).
- **Animation principles**: anticipation frame before every attack, a **smear frame** on the
  fastest slash frame, squash on landing, stretch on jump take-off, overshoot on recover.
- Hurt frame: body bends away from the hit, eyes shut, flash-friendly flat colours.

**Detail checklist for props / backgrounds:** texture through hand-placed pixel clusters (bark
grain, moss, paper fibres, clay cracks), ambient occlusion where an object touches the ground,
atmospheric perspective (far objects bluer, lower contrast), and every layer separate so Claude
can parallax it.

**Detail checklist for illustrations (cover, cutscenes, ending):** cinematic composition, strong
silhouettes, dramatic light (golden hour, lantern glow, fog backlight, screen glow), god-rays and
fog rendered as dithered pixel bands, rich but controlled palette, faces readable at 640×360.

**Consistency workflow:**
1. Make the model sheets first. Pick the best one; that becomes the anchor reference.
2. Attach the anchor model sheet (and the previous accepted sheet) as reference images to
   **every** later generation of that character.
3. Re-use the same wording block for the character every time (copy the design paragraph below).
4. Palette guide: `docs/bible/palette.json` + `docs/bible/visual-style.md`.
5. Save the exact prompt you used for each file into the manifest (`"prompt": "..."`) so a
   frame can be regenerated the same way later.

### References in the repo
| Who | File | Notes |
|---|---|---|
| 倫寶 (boy) | `art-src/bear-girl.png` (yes, the file names are swapped) | redesign into casual clothes |
| 琪寶寶 (girl) | `art-src/salmon-boy.png` (swapped name) | redesign into casual clothes |
| 噗噗 (bear) | `art-src/kind-bear.png` | original bear, keep this design |
| Enemies | `public/art/enemies/E-01.png` … `E-03.png`, `art-src/enemies/` | keep designs, add frames |
| Story / stages | `STORY.md`, `docs/bible/game-design.md` | |

### Character designs (casual — NO kung-fu / martial-arts clothes)
- **倫寶**: young man, short black hair, warm salmon-orange zip hoodie / light jacket, white tee,
  blue jeans, sneakers. Holds a **salmon-shaped water-gun** (orange salmon body, tail = grip,
  mouth = muzzle) that fires salmon roe (ikura). Calm, a bit clumsy, heavier movement.
- **琪寶寶**: young woman, long dark hair in a high ponytail, cream/pastel top, dark slim trousers,
  sneakers. A short straight sword in hand and a **round paper fan carried on her back**.
  Quick, light, energetic movement.
- **噗噗**: small round original bear (see reference), follows 琪寶寶. Has two looks:
  normal (warm colours) and "hollow" (grey, limp, empty eyes — cursed by fake honey).

---

## Deliverables — in priority order

Save under `art-src/anim/` exactly with these names. **3–5 frames per action** (number in brackets).
Push after each batch so Claude can start integrating early.

### Batch A — Heroes (most important)
`art-src/anim/lunbo/` (倫寶)
- `model-sheet.png` — front, side, back, 3/4 view (one image, magenta bg)
- `idle.png` [3] breathing · `walk.png` [4] · `jump.png` [3] rise / apex / fall
- `crouch.png` [3] going down → crouched → crouched aiming
- `shoot.png` [4] raise gun → fire (muzzle flash, recoil) → recoil → recover
- `shoot-crouch.png` [3]
- `hurt.png` [3] · `ko.png` [5] knocked back → falling → lying · `win.png` [3] victory pose

`art-src/anim/kibobo/` (琪寶寶)
- `model-sheet.png`
- `idle.png` [3] · `run.png` [5] · `jump.png` [3]
- `crouch.png` [3]
- `slash1.png` [4] wind-up → horizontal slash → follow-through → recover
- `slash2.png` [4] upward slash · `slash3.png` [5] spinning finisher
- `fan-glide.png` [3] holding the paper fan overhead, floating down
- `hurt.png` [3] · `ko.png` [5] · `win.png` [3]

`art-src/anim/pupu/` (噗噗)
- `idle.png` [3] · `walk.png` [4] · `cute-pose.png` [3] · `tackle.png` [4] dash attack
- `hollow-idle.png` [3] grey limp version · `wake-up.png` [5] grey → colour returning → jumps up

### Batch B — Enemies (keep current designs, add motion)
`art-src/anim/enemies/`
- `E-01-fish/` 紅魚: `walk` [4], `charge` [3] puffing up, `dash` [3], `dizzy` [3] stars, `hit` [2], `die` [4]
- `E-03-hatsoldier/` 帽仔兵: `walk` [4], `throw-low` [4], `throw-high` [4], `hit` [2], `die` [4]
- `E-02-mechpig/` 機械豬 (iron armour): `walk` [4], `windup` [3], `lunge` [3],
  `opening` [3] (gears pop loose — weak moment), `block` [2] sparks on front armour, `die` [5]

### Batch C — Effects (magenta bg, no characters)
`art-src/anim/fx/`
- `slash-arc-1.png` [4], `slash-arc-2.png` [4], `slash-arc-3.png` [5] (white/blue sword trails)
- `muzzle-flash.png` [3] (orange) · `roe-splash.png` [4] (orange droplets bursting)
- `hit-spark.png` [4] · `enemy-poof.png` [5] (cartoon smoke puff) · `armour-clank.png` [3]
- `lantern-break.png` [4] paper lantern tearing apart · `pot-break.png` [4] clay pot shattering
- `power-up.png` [4] golden ring burst · `honey-sparkle.png` [4] · `coin-spin.png` [4]
- `dust-step.png` [3] small foot dust · `land-dust.png` [4]

### Batch D — Background props (NOT the wallpaper/sky — we already have that)
`art-src/props/stage1/` — each prop as its own image on magenta, front-side view, ground at bottom:
- breakable paper lantern on a short wooden post (red, with a small △ mark) + its torn version
- clay honey pot (breakable) + broken shards version
- 咖啡媽媽's small coffee cart (checkpoint), with an awning; no text
- picnic blanket with basket · tree stumps ×2 · mossy rocks ×3 · mushrooms cluster
- wooden fence piece (tileable left-right) · blank wooden sign post
- billboard frame for "△畝發展・即將動工" — **leave the board blank**, Claude adds text
- small stone altar / shrine-like stand (no real religious symbols) for the stage-end ambush
- honey-tree goal: big tree trunk base with a glowing beehive
- foreground grass / fern clumps ×3 (these pass in front of the player)
- far-mid layer: row of dark tree trunks (tileable left-right), one transparent-friendly strip

Then the same list style for stage 2 (蜜樹丘: vines, honeycomb walls, hanging hives, tree-bark
platforms), stage 3 (月影夜市: food stalls, lantern strings, woks, steaming hot-spring rocks,
small bridge), stage 4 (鹽霧工地: fences, warning lights, crane silhouette, bulldozer, clock-in
machine, office desks with paper piles), stage 5 (蜂巢主控室: hexagon walls, screens, cables,
honey pipes) — save as `art-src/props/stage2/` … `stage5/`.

### Batch E — Cover, cutscenes, ending, portraits (16:9, NO text)
`art-src/story/`
- `cover.png` — title key art: 倫寶 (salmon gun) + 琪寶寶 (sword, fan) + 噗噗 in front of the
  百畝樹林 at golden hour, a faint triangle shadow in the sky. **Keep the top 35% fairly empty**
  for the game logo.
- `c1-picnic.png` picnic, 噗噗 tasting honey · `c1-hollow.png` 噗噗 turning grey, triangle shadow
  over the forest · `c1-mama.png` 咖啡媽媽 at her cart, serious
- `c2-note.png` close-up of a paper note pinned with a triangle pin (blank note — text in-game)
- `c3-queen.png` the honey-crown queen bee, calmed, sitting on a hive
- `c4-taxi.png` a taxi stopped in rain at night, 咖啡媽媽 handing hot coffee through the window,
  construction warning lights far away
- `c5-bus.png` a quiet bus passing slowly in fog at midnight — respectful, calm, no faces,
  no horror effects, no text
- `c6-screen.png` a dark office, a computer screen glowing (blank screen — text in-game)
- `c7-boss.png` a tall silhouette in a suit with a triangle mask in a control room of screens
- `ending-1.png` 噗噗 awake and jumping, forest colour returning
- `ending-2.png` the three having a picnic at sunset, warm and happy
- `credits-bg.png` calm forest night sky with fireflies (empty centre for scrolling credits)

`art-src/portraits/` — dialogue head-and-shoulders, 1:1, magenta bg, 3 expressions each in one row
(neutral / happy / shocked): 倫寶, 琪寶寶, 噗噗 (normal), 噗噗 (hollow), 咖啡媽媽, 蜜冠女王蜂.

---

## How to deliver

1. `git pull` first.
   Note: Cursor saves generated images to `~/.cursor/projects/<project>/assets/` by default —
   **copy each accepted image into the repo path listed above** before committing.
   If you hit 429 / timeout errors, wait a minute and continue; don't skip files silently.
2. Generate in the order A → B → C → D → E. If your image tool has a limit, stop at the
   limit and push what you have — partial batches are fine.
3. Add/update `art-src/anim/manifest.json`, one entry per file:
   `{ "file": "art-src/anim/lunbo/walk.png", "frames": 4, "cols": 4, "rows": 1, "facing": "right" }`
4. Commit only images + the manifest, on branch **`art/anim-1`**, and push.
   - Do **not** edit anything in `src/`, `data/` or `public/`.
   - Do **not** run any scripts (especially `scripts/gen-enemy-placeholders.mjs`).
5. If a frame came out off-model (different face/clothes/colour), regenerate it rather than
   pushing it — consistency matters more than quantity.
