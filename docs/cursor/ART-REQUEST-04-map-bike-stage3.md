# ART REQUEST 04 — 世界地圖、單車追逐小關、第 3 關「月影夜市＋溫泉」

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first.** Every global rule there still applies:
- flat magenta `#FF00FF` background, frames left → right in equal cells;
- facing RIGHT, feet on one baseline;
- no text or letters anywhere;
- 16-bit SNES pixel look with the "8×8 pixel grid" trick;
- 3–5 frames per action;
- make the model sheet first, then attach it as the reference for every later image.

Batches 1–3 were excellent — keep the same quality.

Two reminders from processing them:
- Draw **every sheet of the same character at the same size**.
- Keep **every sheet facing RIGHT**.

Priority order: **K → L → M**. Push after each batch (Claude can start wiring K and L right away).

---

## Batch K — 世界地圖（SNES 經典世界地圖） → `art-src/map/`

Used between stages: the heroes walk along a dotted road from one place to the next, then the
camera spins and zooms into the next stage (Mode-7 style).

- `world-map.png` **1920×1080**, top-down (slightly tilted, like an SNES world map) pixel-art
  island/valley. No text, no characters. Five places connected by **one winding dirt road**
  (leave the road clearly visible, ~3–4 art-pixels wide), from bottom-left to top-right:
  1. **百畝樹林** — bright green forest with a picnic clearing and a small river (bottom-left)
  2. **蜜樹丘** — one gigantic glowing honey tree on a hill, bees around it
  3. **月影夜市＋溫泉** — a riverside night-market street with red lanterns, a small arched
     bridge and steaming hot-spring pools (dusk colours around it)
  4. **鹽霧工地** — a foggy construction site with cranes and warning lights
  5. **△畝大廈** — a tall dark office tower with a △ logo shape on top (no letters), top-right
  - The colours get darker / foggier from place 1 → 5 (story gets creepier).
  - Leave sea/mountain borders around the edges so the map can be zoomed a little.
- `map-icons.png` (magenta sheet, 5 frames): the five place badges as small round icons
  (~32 art-px), same order as above.
- `map-walk.png` (magenta sheet): tiny chibi 倫寶 + 琪寶寶 walking side by side with 噗噗,
  **one sprite group ~24 art-px tall**, `walk` [4] facing right.
  - Use the model sheets `art-src/anim/lunbo/model-sheet.png`, `art-src/anim/kibobo/model-sheet.png`
    and `art-src/anim/pupu/model-sheet.png` as reference.

## Batch L — 單車追逐小關（第 1 → 2 關之間） → `art-src/bike/`

A short auto-scrolling bike ride uphill to the honey tree. The hero bike frames already exist
(`bike-ride`, `bike-jump`); only the world is needed.

- `bike-far.png` **1920×1080**: countryside under a blue sky; the gigantic glowing honey tree far
  away on the hill (match `art-src/story/c2-bike.png`). No characters.
- `bike-mid.png` **tileable left-right strip** (~1920×360): rolling hills, wooden fences,
  wildflowers, small trees.
- `bike-road.png` **tileable left-right strip** (~1920×160): an uphill dirt road with grass edges.
- Obstacles (magenta, one image each, side view):
  - `rock.png`
  - `log.png` (a fallen log)
  - `honey-puddle.png` (a fake-honey puddle, glossy yellow)
  - `cone.png` (a traffic cone)
  - `ramp.png` (a small wooden ramp to jump from)
  - `bee-swarm.png` [3] (a small cloud of bees flying left)

## Batch M — 第 3 關「月影夜市＋溫泉」（詭異） → `art-src/anim/…`, `art-src/props/stage3/`, `art-src/story/`

See `docs/bible/game-design.md` §2 第 3 關. Mood: **eerie but cute**.
- The night market is empty, but woks are still sizzling.
- Paper lanterns go out one by one.
- Then a creek bridge, then misty hot springs.
- Atmosphere horror only (darkness, silhouettes, steam) — never gore.

### Enemies → `art-src/anim/enemies/`
- `E-08-lobsterguard/` **龍蝦兵** (~56 px)
  - What it is: a red lobster soldier with two big claws and a little armour vest. It guards
    with its claws in front, so you have to jump over and hit its back.
  - Sheets:
    - `walk` [4]
    - `block` [3] (both claws up in front)
    - `snap` [4] (claw strike forward)
    - `turn` [2]
    - `hit` [2]
    - `die` [4] (shell cracks, then a poof)
- `E-09-stallkeeper/` **油甘魚攤主** (~56 px)
  - What it is: a yellowtail-fish stall keeper with an apron and headband, standing behind a
    small food stall.
  - Sheets:
    - `idle` [3] (chopping)
    - `throw` [4] (throws a kitchen knife — draw the spinning knife as a separate FX `knife` [4])
    - `duck` [2] (hides behind the stall)
    - `hit` [2]
    - `die` [4]
  - Also draw the **stall** itself as a prop: `stall.png` plus a `stall-broken.png` version.
- `E-10-mirrorshade/` **鏡影雜兵** (~48 px)
  - What it is: a hooded shadow figure with a mirror-glass face. Its fake copies are
    semi-transparent; the real one casts a reflection.
  - Sheets:
    - `float` [4]
    - `dash` [3]
    - `split` [4] (splits into two)
    - `hit` [2]
    - `die` [4] (mirror shatters into sparkles)

### Boss → `art-src/anim/boss/mirror-owl/` **月橋鏡鴞** (big, ~128 px)
- What it is: a large owl with silvery feathers and a round mirror disc on its chest, perched on
  a moon-lit bridge. Eyes glow fake-honey yellow (like the queen bee was controlled).
- `model-sheet.png` (front / side / back / three-quarter)
- Sheets:
  - `perch` [4]
  - `fly` [4]
  - `feather-curtain` [4] (wings spread, a rain of feathers falls — draw `feather` FX [3] separately)
  - `split` [4] (turns into three mirror copies)
  - `guard` [3] (guards a honey crate)
  - `hurt` [2]
  - `defeat` [5] (mirror disc cracks → yellow glow fades → a calm, kind owl)

### Tiles & props → `art-src/props/stage3/` (each a separate image on magenta; strips tile left-right)
- `market-ground.png`: stone-paved street strip
- `wood-bridge.png`: arched wooden bridge deck
- `hotspring-rock.png`: wet rock ground strip
- `market-far.png` **1920×1080**: the night-market street at night — lantern strings, closed
  stalls, a big moon, steam. No characters.
- `market-mid.png`: tileable strip of stalls, signboards (no letters, just shapes), and lantern strings
- `hotspring-far.png` **1920×1080**: misty hot springs at night with a moon reflection
- `lantern-on.png`, `lantern-off.png`: a hanging red paper lantern, lit and unlit
- `wok-stall.png`: a small empty stall with a wok and steam
- `steam.png` [4]: a rising steam puff animation
- Items, 20–28 px:
  - `sashimi.png` (a plate of yellowtail sashimi = heals 2)
  - `lobster.png` (a cooked lobster = power-up)

### Story stills → `art-src/story/` (16:9, no text)
- `c3-market.png`
  - What it shows: 倫寶, 琪寶寶 and a half-coloured 噗噗 arriving at the empty night market;
    lanterns half lit, woks steaming, nobody there; a little eerie.
- `s3-boss-intro.png`
  - What it shows: the 月橋鏡鴞 spreading its wings on a moon-lit arched bridge, its chest
    mirror reflecting the moon.
- (already done, no need to redo: `c4-taxi.png`)

---

## Delivery

Same as before:
1. `git pull` first.
2. Copy accepted images from `~/.cursor/projects/.../assets/` into the paths above.
3. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt).
4. Commit **only images + the manifest**, on branch **`art/batch-04`**, and push after each batch.

Other rules:
- Do not touch `src/`, `data/` or `public/`, and do not run scripts.
- Regenerate off-model frames instead of pushing them.
- Push with the GitHub sign-in in the browser — never paste a token into chat.
