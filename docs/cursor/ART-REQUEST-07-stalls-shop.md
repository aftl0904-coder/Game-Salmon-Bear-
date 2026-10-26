# ART REQUEST 07 — 小食攤檔 + 裝備店 (stalls & shop)

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first.** Every global rule there still applies:
- flat magenta `#FF00FF` background;
- frames left → right in equal cells, facing RIGHT, feet on one baseline;
- **no text or letters anywhere** (no shop signs, no prices, no brand names);
- 16-bit SNES pixel look with the "8×8 pixel grid" trick;
- model sheet first, then use it as the reference for every later image.

Branch: **`art/batch-07`**. Push after each section.

Why: every stage gets its own food stall with its own little minigame, and after it the
players spend their coins on gear. These are the images for that.

---

## A. 攤檔老闆 (stall keepers) → `art-src/anim/stalls/<id>/`

Friendly Hong Kong street-food vendors. Each is a **person**, about 64 px tall, warm and
welcoming — they are the safe spot in the stage. Original faces, not caricatures of anyone.

For each: `model-sheet.png`, `idle.png` [3] (small breathing + a wave), `serve.png` [4]
(hands the food forward), and the stall itself as `cart.png` (one image, ~72 px tall).

| id | Who | Stall |
|---|---|---|
| `waffle` | 夾餅叔叔 — middle-aged man, apron, white vest, towel over the shoulder, cheerful | A street cart with a round waffle iron, steam rising |
| `tart` | 蛋撻哥哥 — young man, baker's whites, paper hat, flour on his hands | A small bakery counter with trays of egg tarts |
| `coconut` | 椰青泰國人 — Thai man, straw hat, loose shirt, holds a heavy cleaver (held safely, pointing down) | A cart stacked with green coconuts and a block of ice |
| `sashimi` | 刺身師傅 — Japanese chef, headband, navy apron, long knife on the board | A cedar sushi counter with a salmon fillet on it |

(咖啡媽媽 already exists — do not redraw her.)

## B. 小遊戲道具 (minigame props) → `art-src/props/minigames/`

Each one on magenta, drawn big and clean (they fill the screen in the minigame).

- `waffle-plain.png` [3]: an egg waffle — raw batter / cooked golden / burnt dark brown
- `waffle-butter.png`: a pat of butter and a knife, seen from above
- `tart-shell.png` [3]: an empty tart shell / half full of custard / perfectly full
- `tart-tray.png`: a baking tray holding six shells, seen from above
- `coconut-top.png` [3]: the top of a green coconut seen from above — whole / 3 cuts made / lid off with a straw in it
- `cleaver.png`: a cleaver, blade pointing left
- `salmon-fillet.png` [3]: a salmon fillet on a cutting board — whole / half sliced / neatly sliced into sashimi
- `sushi-knife.png`: a long thin Japanese knife, blade pointing left
- `honey-drop.png` [3]: a falling drop of golden honey (for the tilt-the-bottle minigame)
- `honey-bottle.png`: a small glass bottle with a wide mouth, seen from the front
- `grill-fish.png` [4]: a salmon steak on a grill — raw / cooking / perfect / burnt
- `timing-bar.png`: a horizontal bar, **red | green | red**, with a small white pointer below it.
  Draw the bar and the pointer as two separate images (`timing-bar.png`, `timing-pointer.png`).

## C. 裝備 (shop gear) → `art-src/props/shop/`

Each item has **3 quality tiers** drawn left → right in one image (`<name>.png` [3]):
wooden/plain → steel → gold. Item only, no character, ~28 px tall.

- `sword.png` [3]: 琪寶寶's sword
- `gun.png` [3]: 倫寶's salmon gun (tier 3 has three barrels)
- `armour.png` [3]: a light chest guard — cloth / leather / gold-trimmed
- `boots.png` [3]: shoes — sneakers / hiking boots / winged boots
- `charm.png` [3]: a lucky charm on a string — wooden tag / jade / gold honeycomb

Also:
- `coin-stack.png` [3]: a few coins / a small pile / a big pile
- `shop-板.png` → name it `shop-board.png`: a plain wooden signboard, **blank, no letters**

## D. 兩張漏低咗嘅圖 (still owed from batch 06)

- `art-src/props/friends/picnic-blanket-big.png`
- `art-src/story/ending-picnic.png`

---

## Delivery

1. `git pull` first.
2. Copy accepted images into the paths above.
3. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt).
4. Commit **only images + manifest** on branch **`art/batch-07`**, and push.

Other rules:
- Do not touch `src/`, `data/` or `public/`.
- Regenerate off-model frames.
- Push with the browser GitHub sign-in — never paste a token.
