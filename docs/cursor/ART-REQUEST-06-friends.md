# ART REQUEST 06 — 噗噗嘅朋友仔 (picnic friends)

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first.** Every global rule there still applies:
- flat magenta `#FF00FF` background;
- frames left → right in equal cells, facing RIGHT, feet on one baseline;
- no text or letters anywhere;
- 16-bit SNES pixel look with the "8×8 pixel grid" trick;
- model sheet first, then use it as the reference for every later image.

Story: `docs/bible/friends.md`.

These are the hero's plush-toy friends. They are soft, cuddly stuffed toys come to life:
- visible fabric texture and stitching;
- round and chubby;
- about 34–40 px tall in game (half the height of 倫寶).

All of them are **original, unbranded designs**. Draw only what is described below. Do not make any of them look like a famous cartoon character.

Branch: **`art/batch-06`**. Push when done.

---

## Characters → `art-src/anim/friends/<id>/`

For each friend, draw these sheets:
- `model-sheet.png`: front / side / back / three-quarter.
- `idle.png` [3]: gentle breathing.
- `cheer.png` [3]: both arms up, little hop.
- `walk.png` [4]: waddling walk.

| id | What it looks like |
|---|---|
| `huihui` | An old, well-loved **grey teddy bear**. Short fuzzy grey-beige fur that is a bit pilled, a pale pink short-sleeved shirt, brown felt foot pads, small black eyes, a tiny pink nose. Slightly droopy, sweet face. |
| `guard` | A **brown shaggy teddy bear** dressed as a royal guard: red tunic with gold buttons, white belt, black trousers, and a very tall black fluffy hat. Shaggy brown fur on paws and feet. |
| `denim` | A **light-tan teddy bear** with a cream muzzle, wearing dark-blue denim dungarees with a front pocket. |
| `brownie` | A **small brown teddy bear** with a white muzzle and white paw pads, wearing a plain black T-shirt (no letters). |
| `snowcat` | A **fluffy white long-haired cat**, round like a loaf, with a soft pink tint on the ears and top of the head, and grey-blue eyes. |
| `shiba` | A **chubby shiba-inu plush**: tan back, white cheeks and belly, curled tail, smiling face. |
| `ginger` | A **crocheted gingerbread bear**: knitted brown yarn texture, a small red-and-white Christmas hat, a green ribbon bow at the neck, white icing stitches on the edges. |
| `fleecy` | A **grey teddy bear in a white fluffy fleece onesie** with a hood (ears poking out). |
| `gnome` | A **knitted gnome**: tall red-and-white striped pointy hat, long white yarn beard covering the face, round red nose, red body. |
| `tigercub` | **Original design.** A round, chubby baby tiger plush **sitting**: orange with simple dark stripes, white belly, round ears, a blue knitted beanie hat. |
| `kuro` | **Original design.** A small black kitten plush with four white socks and a gold bell on a blue collar. |

## Portraits → `art-src/portraits/friend-<id>.png`

- One image for each friend.
- 3 expressions side by side on magenta: neutral, happy, surprised.
- Bust only, no text.

## Props → `art-src/props/friends/`

- `cage.png` [3]: a honey-crate cage with wooden bars and a honey-yellow △ padlock. Draw 3 states: closed, cracked, broken open.
- `picnic-blanket-big.png`: a big red-and-white checked picnic blanket seen from the side, wide strip (it gets crowded in the ending).

## Story still → `art-src/story/` (16:9, no text)

- `ending-picnic.png`
  - What it shows: a sunrise picnic in the forest.
  - Who is there:
    - 倫寶 and 琪寶寶 (use their model sheets);
    - 噗噗 fully coloured (use the original 噗噗 model sheet);
    - all eleven friends above, sitting and playing on a huge checked blanket;
    - honey jars, sandwiches and coffee cups.
  - In the back, waving: 咖啡媽媽, the queen bee, the mirror owl.
  - Mood: warm and happy.

## Delivery

Same as before:
1. `git pull` first.
2. Copy accepted images into the paths above.
3. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt).
4. Commit **only images + manifest** on branch **`art/batch-06`**, and push.

Other rules:
- Do not touch `src/`, `data/` or `public/`.
- Regenerate off-model frames.
- Push with the browser GitHub sign-in — never paste a token.
