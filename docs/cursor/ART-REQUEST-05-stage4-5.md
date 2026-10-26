# ART REQUEST 05 — 第 4 關「鹽霧工地」、第 5 關「△畝大廈」

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first.** Every global rule there still applies:
- flat magenta `#FF00FF` background;
- frames left → right in equal cells, facing RIGHT, feet on one baseline;
- no text or letters anywhere;
- 16-bit SNES pixel look with the "8×8 pixel grid" trick;
- 3–5 frames per action;
- model sheet first, then use it as the reference for every later image.

Level design: `docs/bible/stages-3-5.md`.

Finish **ART-REQUEST-04 Batch M (stage 3)** first. Then do **N → O** below, and push after each batch.

Tone gets darker:
- Stage 4: fog, rain, warning lights, the scariest stage — but **atmosphere horror only, never gore**.
- Stage 5: a corporate tower full of screens and red alarm lights, then sunlight at the end.

---

## Batch N — 第 4 關・鹽霧工地 → `art-src/anim/…`, `art-src/props/stage4/`, `art-src/story/`

### Enemies → `art-src/anim/enemies/`
- `E-11-honeyzombie/` **蜜僵** (~52 px)
  - What it is: a forest animal (a badger) hollowed by fake honey. Grey fur, empty glowing-yellow eyes, sticky honey dripping (not blood).
  - Sheets: `walk` [4] shambling, `reach` [3] arms forward, `hit` [2], `die` [4] (melts into a honey puddle, then the animal wakes up and runs away).
- `E-12-taximonster/` **的士怪** (~48 px tall, wide)
  - What it is: a small angry taxi with headlight eyes and a grille mouth (original design, no brand marks, no letters on the sign).
  - Sheets: `idle` [2], `flash` [2] (headlights blink: the warning), `dash` [4], `crash` [3] (dizzy, steam from the bonnet), `die` [4].
- `E-13-punchclock/` **打卡鐘怪** (~44 px)
  - What it is: a walking punch-card time clock with little legs.
  - Sheets: `walk` [4], `tick` [3] (shaking, about to burst), `burst` [4] (papers fly out — also draw a single `paper` FX [3] spinning), `hit` [2], `die` [4].

### Boss → `art-src/anim/boss/mudmane/` **泥鬃（電單車工頭）** (~110 px)
- What it is: a big foreman in a hard hat and a long mud-brown cape with a honey-coloured △ seal on it. He rides a heavy dirt motorbike.
- `model-sheet.png`
- Sheets:
  - `ride` [4] (on the motorbike)
  - `charge` [4] (bike charging with a mud wave)
  - `nailgun` [4] (standing on a high beam, firing — draw `nail` FX [2] separately)
  - `summon` [3] (whistle, calling zombies)
  - `walk` [4] (off the bike)
  - `punch` [4]
  - `hurt` [2]
  - `defeat` [5] (the △ seal on the cape cracks → yellow glow fades → a tired, kind old worker)

### Hero extra → `art-src/anim/lunbo/`, `art-src/anim/kibobo/`
- `moto-ride` [4] and `moto-jump` [3]: same as `bike-ride` / `bike-jump`, but on a small electric scooter-motorbike, with rain streaks.

### Tiles & props → `art-src/props/stage4/` (separate images on magenta; strips tile left-right)
- `site-ground.png`: muddy gravel ground strip with puddles
- `steel-beam.png`: a one-way steel girder platform
- `container.png`: a shipping container with no letters
- `crane-far.png` **1920×1080**: a foggy construction site at night. Cranes and warning lights, rain, no characters.
- `site-mid.png`: tileable strip of fences, cones, barriers and generator lights
- `bulldozer.png` [3]: a big bulldozer silhouette driving left (shown in the background, about 140 px tall)
- `warning-light.png` [2]: a rotating amber light
- `paper-stack.png`: an office paper-stack step
- `road-far.png` **1920×1080**: a midnight highway in rain, for the motorbike chase
- `barrier.png`, `sign.png`: road obstacles (no letters)
- `night-bus.png`: a quiet old bus driving left in fog, windows softly lit.
  - Respectful and calm, not scary.
  - No people visible, no text.

### Story stills → `art-src/story/` (16:9, no text)
- `c7-site.png`: the taxi stops at a foggy construction site in the rain; 倫寶, 琪寶寶 and a 30%-coloured 噗噗 look at bulldozed tree stumps.
- `s4-boss-intro.png`: 泥鬃 revving his motorbike on a muddy ramp under a crane, the △ seal on his cape glowing.

---

## Batch O — 第 5 關・△畝大廈 → `art-src/anim/…`, `art-src/props/stage5/`, `art-src/story/`

### Elite marks
- `elite-mark.png` [2]: a small red △ mark (blinking), drawn on magenta. It floats over elite enemies.
  - No new elite sprites are needed; Claude tints and marks the existing ones.

### Boss → `art-src/anim/boss/triboss/` **△畝大佬** (~128 px)
- What it is: a tall businessman in a dark suit with a polished △ mask, a gold tie-pin shaped like a honey drop, and a remote control.
- `model-sheet.png`
- Sheets:
  - `idle` [4]
  - `point` [3] (commands with the remote)
  - `rain` [4] (raises arms: fake-honey rain — draw `honey-rain` FX [3])
  - `shield` [4] (a glowing △ shield in front)
  - `hurt` [2]
  - `unmask` [5] (the mask cracks off; he is just a tired ordinary man)
  - `defeat` [5]
- `computer.png` [3]: the main-control computer with three glowing weak spots — intact, cracked, broken.

### 噗噗 special
- `art-src/anim/pupu/pounce-final.png` [5]: fully-coloured 噗噗 leaping in with a big hug-tackle, golden sparkles (the final hit).
  - Use the original 噗噗 model sheet.

### Tiles & props → `art-src/props/stage5/`
- `office-floor.png`: polished marble floor strip
- `conveyor.png` [3]: a honey conveyor belt (animated, tileable)
- `hex-wall.png`: dark hexagon wall panel with honey veins
- `screen-wall.png` [3]: a big wall of screens flickering (no text — only abstract charts and △ symbols)
- `alarm-light.png` [2]: a red alarm light
- `hq-far.png` **1920×1080**: inside a dark corporate tower; glass, screens and honey pipes. No characters.
- `rooftop-far.png` **1920×1080**: the rooftop at dawn with the forest far below
- `hotspring-heal.png` [3]: a small hot-spring pool with steam (the full-heal point)

### Story stills → `art-src/story/` (16:9, no text)
- `c10-unmask.png`: in the control room, △畝大佬 lifts his △ mask in front of a big screen showing a mall blueprint over the forest (no letters).
- `ending-3.png`: sunrise picnic; fully-coloured 噗噗 jumping happily with 倫寶 and 琪寶寶; 咖啡媽媽, the queen bee, the mirror owl and the old foreman wave from the back.
- (already done, no need to redo: `c6-screen.png`, `c7-boss.png`, `ending-1.png`, `ending-2.png`)

---

## Delivery

Same as before:
1. `git pull` first.
2. Copy accepted images into the paths above.
3. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt).
4. Commit **only images + manifest** on branch **`art/batch-05`**, and push after each batch.

Other rules:
- Do not touch `src/`, `data/` or `public/`.
- Regenerate off-model frames.
- Push with the browser GitHub sign-in — never paste a token.
