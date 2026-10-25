# ART REQUEST 03 — 第 2 關「蜜樹丘」

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first.** Every global rule there still applies:
flat magenta `#FF00FF` background, frames left → right in equal cells, facing RIGHT, feet on one
baseline, no text, 16-bit SNES pixel look with the "8×8 pixel grid" trick, 3–5 frames per action,
model sheet first and then attach it as the reference for every later image.

Batch 1 was great — the quality and consistency of `art/anim-1` is exactly the target. Two notes
from processing it, please follow them this time:
- Draw **every sheet of the same character at the same size** (Batch 1 sizes varied up to 1.7×).
- **Keep the facing RIGHT on every sheet** (機械豬 walk / windup / die were drawn facing left).

Stage theme (see `docs/bible/game-design.md` §2 第 2 關): inside and on top of a giant honey tree.
Curious, slightly oppressive; dappled light through the canopy, humming bees, sticky honey.
The 三角組織 has taken over the hive; their fake honey has turned the forest animals into 蜜僵.

## References in the repo

| What | File |
|---|---|
| 蜜蜂兵 design | `art-src/gen/bee-soldier.png` |
| 蜜僵松鼠 design | `art-src/gen/zombie-squirrel.png` |
| 蜜冠女王蜂 design | `art-src/gen/queen-bee.png`, `art-src/portraits/queen-bee.png` |
| Tile ideas | `art-src/gen/tree-tiles.png`, `art-src/gen/bg-honey-tree.png` |
| Heroes | `art-src/anim/lunbo/model-sheet.png`, `art-src/anim/kibobo/model-sheet.png`, `art-src/anim/pupu/model-sheet.png` |

## Deliverables (priority order)

### Batch F — Stage 2 enemies → `art-src/anim/enemies/`
- `E-05-beesoldier/` 蜜蜂兵 (flies; drawn ~40 px tall in game):
  `fly` [4] wing flap, `aim` [3] stinger lowers + body tilts down, `dive` [3] diving diagonally down-right with speed lines,
  `stuck` [3] stinger stuck in the ground, wiggling, `hit` [2], `die` [4] falls spinning, then a poof
- `E-06-zombiesquirrel/` 蜜僵松鼠 (slow, comes in groups; ~44 px):
  `walk` [4] shambling and swaying, dripping fake honey, `lunge` [3] lunges forward with arms out,
  `hit` [2], `die` [4] collapses into a puddle of fake honey, then the honey dries
- `E-07-minibee/` small bee from the boss's eggs (~20 px): `fly` [3], `die` [3]
- `egg/`: `idle` [2] fake-honey egg pulsing, `hatch` [4] cracks and a mini bee pops out, `break` [3] shattered by an attack

### Batch G — Boss 蜜冠女王蜂 → `art-src/anim/boss/queen-bee/` (big: ~128 px tall in game)
- `model-sheet.png` (front / side / back / three-quarter view)
- `hover` [4] wing flap with a gentle bob
- `summon` [4] raises a sceptre-like stinger and calls a swarm
- `land` [3] heavy landing, wings folded
- `lay-eggs` [4] bending down, eggs dropping out
- `spray` [4] sprays a stream of fake honey (the stream is a separate FX, see below)
- `weak` [3] after spraying: exhausted, with a glowing spot on her head (weak point)
- `hurt` [2]
- `defeat` [5] the crown falls off → she shrinks → wakes up kind (colour returns, calm face)
- FX on magenta: `honey-stream` [4] (spray, left → right), `honey-puddle` [3] (sticky floor),
  `swarm` [3] (a line of 3 bees flying across)

### Batch H — Hero extras → `art-src/anim/lunbo/`, `art-src/anim/kibobo/`
- 單車 segment (stage 2 opening): `bike-ride` [4] riding a casual city bicycle, `bike-jump` [3]
  - 倫寶 rides, holding the salmon gun in one hand
  - 琪寶寶 rides with the paper fan on her back
- 琪寶寶 `fan-float` [3]: holding the fan open overhead, being lifted by an updraft (wind vent)

### Batch I — Stage 2 tiles & props → `art-src/props/stage2/`
Each piece is a separate image on magenta (tiles must loop left-right):
- `bark-ground.png` tileable bark-top ground strip with a moss lip (like stage 1's grass ground)
- `bark-platform.png` a horizontal branch platform (one-way)
- `bark-wall.png` tileable vertical bark wall, and `honeycomb-wall.png` tileable honeycomb wall
- `vine-a.png`, `vine-b.png` hanging vines
- `hive-hanging.png` a hive hanging from a branch, plus `hive-broken.png` (breakable, gives loot)
- `wind-vent.png` [3] a knot-hole in the bark blowing an updraft (leaves swirling up)
- `honey-drip.png` [3] honey dripping from above
- `mushroom-shelf.png` a bracket fungus you can stand on
- `triangle-mark.png` a △ mark carved into the bark (story hint)
- `canopy-far.png` 640×360 far layer: deep inside the honey tree, light shafts, no characters
- `canopy-mid.png` a tileable middle strip of leaves and branches (~640×160)
- `canopy-front.png` a tileable foreground leaf strip (passes in front of the player)

### Batch J — Story stills (16:9, no text) → `art-src/story/`
- `c2-bike.png` 倫寶 and 琪寶寶 riding bicycles uphill towards a gigantic tree glowing with honey;
  a grey 噗噗 sits in the front basket of 琪寶寶's bike
- `s2-boss-intro.png` the 蜜冠女王蜂 hovering in front of a huge honeycomb wall, eyes glowing with fake honey, angry
- (already done, no need to redo: `c3-queen.png`)

## Delivery

Same as before: `git pull` first. Copy accepted images from `~/.cursor/projects/.../assets/` into the
paths above. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt).
Commit only images + the manifest, on branch **`art/stage2`**, and push after each batch. Do not
touch `src/`, `data/` or `public/`; do not run scripts. Regenerate off-model frames instead of pushing them.
