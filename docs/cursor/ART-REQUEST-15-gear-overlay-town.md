# ART REQUEST 15 — 裝備掛件、市鎮兩個小畫面、賭檔道具

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first.** Every global rule there still applies:
- flat magenta `#FF00FF` background for sprite/prop sheets;
- original designs only, no existing franchise characters;
- 16-bit SNES pixel look, 1px dark outline, light from top-left, ≤24 colours per item;
- no text or letters anywhere;
- model sheet first if one doesn't exist yet, then use it as reference for every later image.

Branch: **`art/batch-15`**. Push after each section.

Why: (1) buying gear should visibly change how 倫寶/琪寶寶 look, not just raise a number;
(2) the stage-clear screen is getting 2 more buttons (瞓覺 / 賭檔) that each need a simple
backdrop; (3) the 賭檔 needs its own small props.

Use `art-src/anim/lunbo/model-sheet.png` and `art-src/anim/kibobo/model-sheet.png` as the
reference images for section A, so proportions and palette match the existing heroes.

---

## A. 裝備掛件 (gear overlays) → `art-src/props/gear-overlay/`

**Not full character redraws.** These are small standalone accessory pieces, drawn once each,
that Claude's code places on top of the existing hero sprites at a fixed point (head / chest /
feet). Draw each piece **alone, side view facing right**, no character underneath, magenta
background, about 16–20px tall (small — they sit on an already-small sprite).

Three tiers per piece, same shape, only the colour/trim changes — plain **wood/leather** →
**steel** → **gold**, matching the 銅/銀/金 tier look already used for the shop icons in
`art-src/props/shop/`. One file per piece with all 3 tiers side by side (`<name>.png` [3]):

| file | piece | notes |
|---|---|---|
| `helmet.png` [3] | small head piece (band / light cap) | must sit above a ~24px-tall head without covering the face — a cap or brow-band reads better than a full helmet at this scale |
| `armour-chest.png` [3] | a chest strap / vest front | worn over the torso, open enough to still show the character's own shirt colour underneath |
| `boots-cuff.png` [3] | an ankle cuff / shoe trim | wraps the lower leg just above the foot |

Draw **one generic version of each** (not separate for 倫寶 vs 琪寶寶) — Claude will tint/flip
as needed. Keep silhouettes simple and readable at tiny scale (these will render at well under
20px on screen).

## B. 市鎮兩個畫面 → `art-src/story/`

Same treatment as the existing `friends-stall.png` backdrop (stage-clear screen button). Each
is a single illustration, **640×360**, no characters, no text, a calm still background a button
opens into:

- `town-inn.png`: a small, cosy room with a single neat bed, warm lamp light, a window with
  night sky outside — reads as "rest and heal here".
- `town-gamble.png`: a small street gambling stall at night — a low wooden table, a couple of
  paper lanterns, a worn mat — friendly and a little mischievous, not seedy.

## C. 賭檔道具 (gambling props) → `art-src/props/gamble/`

- `dice.png` [6]: one die shown face-up, six frames — faces 1 through 6, pips only, plain
  cream/ivory die with black pips, drawn straight-on (not isometric).
- `dice-cup.png`: a small wooden dice cup / bowl, empty, side view.
- `gamble-mat.png`: a small rectangular betting mat / cloth, plain pattern, viewed from above,
  with **no text, numbers or markings** (Claude draws the betting spots in code).

---

## Delivery

1. `git pull` first.
2. Copy accepted images into the paths above.
3. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt) for
   section A and the dice sheet in section C.
4. Commit **only images + manifest** on branch **`art/batch-15`**, and push.

Other rules:
- Do not touch `src/`, `data/` or `public/`.
- Regenerate off-model frames.
- Push with the browser GitHub sign-in — never paste a token.
