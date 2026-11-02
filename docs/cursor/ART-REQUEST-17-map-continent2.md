# ART REQUEST 17 — 大陸2世界地圖（母公司嘅地頭）＋ 地圖按大陸分開

From: Claude → To: Cursor. Same owner, same game.

**Read `ART-REQUEST-02-animation.md` and `ART-REQUEST-04-map-bike-stage3.md` (Batch K) first.**
Every global rule still applies: magenta `#FF00FF` background for sheets, no text or letters
anywhere, 16-bit SNES pixel look with the 8×8 grid trick. The Continent 2 map must look like it
belongs to the same game as `art-src/map/world-map.png`: same camera tilt, same pixel density,
same dotted-road style. All buildings are **original designs** — no real buildings, brands or logos.

## Why

Stages 6–10 currently open the Continent 1 map, which only knows places 1–5: the banner falls
back to 「第一關・百畝樹林」 and `arrive()` throws on `PLACES[6]!`. PR #65 gets a temporary black
transition for stages 6+. Story-wise Continent 2 is the parent company's own territory — another
shore — so it gets its own map, and that map changes once the ending is reached.

## Batch N — 大陸2地圖 → `art-src/map/c2/`

### N1 `world-map-c2-dark.png` — 1280×720 (shown from stage 6 until stage 10 is cleared)

A coastal company city on a different shore, top-down and slightly tilted like the C1 map.
No characters. One winding dirt road (~3–4 art-px wide, clearly visible) from bottom-left to
top-right:

0. **碼頭** (start, bottom-left) — a small wooden pier with a moored boat: the party arrives by sea
   from Continent 1. Keep a little warm lamplight here — the only warm spot on the whole map.
6. **購物中心** (left, near the coast) — the luxury mall: the glass diamond-lattice dome entrance
   and twin mirrored towers from Stage 6 (match `art-src/props/stage6/dome-entrance.png` and
   `mall-far.png` — on the PR #65 branch until it merges). Half-hidden behind it: the rusty
   abandoned honey factory with dead chimneys (`factory-far.png`). The factory carries a faded,
   peeling **red horizontal rectangular sign** with white blocks standing in for characters — no
   real text, not based on any real brand (Alan, 2026-11-03). Same sign as in Stage 6 segment D.
7. **森友展銷中心** (centre-bottom) — a long exhibition hall with a glass roof; along one side,
   rows of small cages / crates as silhouettes. Sad, not graphic.
8. **配方控制中心** (right-middle) — a windowless data-centre block: cooling units, pipes, tanks
   glowing amber (fake honey), blue screen-light leaking through narrow slits.
9. **地底監禁層** (top-centre-right, at the FOOT of the HQ tower) — a big grated gate / ramp going
   down into the ground, faint red lights inside. It must read as "underground".
10. **頂層控制室** (top-right, the TOP of the same HQ tower) — the tallest building on the map:
    dark glass, glass-walled top floors (matches the `c2_stage5_boss_office` scene JSON in the
    story doc), a △ shape on top — the same mark as C1's △畝大廈, no letters.
    - Places 9 and 10 are the same tower: badge 9 at its base, badge 10 at its top. The road ends
      at the base; 9 → 10 is a lift ride straight up the tower's side.
    - **Hong Kong-style refuse collection point (Alan, original element):** in the back lane at
      the foot of the tower, right where the road meets it — a small low building with a roller
      shutter, large green wheeled bins, a row of three-colour recycling bins, stacked cardboard,
      a handcart. Generic shapes only: no government logos, no text. It sits right next to the
      glossy tower on purpose — the rubbish behind the luxury. Small at map scale, but readable.

Mood: grey-violet smog, LED glare from the mall, withered trees, a dried-up river bed, amber
fake-honey pipes running between the buildings. Darker and foggier from 6 → 10, the same way C1
gets darker from 1 → 5. Sea and cliffs around the edges so the camera can zoom a little.

### N2 `world-map-c2-green.png` — 1280×720 (shown after stage 10 is cleared, from then on)

**Exactly the same composition as N1.** Use N1 as the reference image so every building, the road
and every place sit on the same pixels — only the state of the land changes:

- smog gone, blue sky; the river runs again through the dried bed
- trees regrown, and a green forest corridor linking the buildings
- rooftop gardens and small solar panels on the mall and the exhibition hall
- the cages along 7 are open and empty; a small sanctuary meadow beside the hall
- bees, birds and a few small animals
- the refuse collection point at the tower's foot is now a tidy recycling station: clean
  bins in neat rows, no overflowing rubbish, a few potted plants by the shutter
- on a hill near the tower: the giant guardian bear and 噗噗 side by side — small, not the focus
- **the △ on top of the tower is replaced by a new mark (Alan's design):** six thin, tall,
  dark-green rectangles standing upright side by side, with one curved line flowing through the
  middle of them from left to right. Abstract shape only, no letters. It must read clearly at
  map size — keep the rectangles evenly spaced and the curve smooth.

This is the payoff of the ending (森林共生式發展). Warm, not flashy.

### N3 `map-icons-c2.png` — magenta sheet, 5 frames

Same cell size as `art-src/map/map-icons.png` (70×64 after processing). Badges for places 6–10,
in order.

### N4 `map-walk-duo.png` (confirmed by Alan)

Same as `art-src/map/map-walk.png` (same size, same baseline, `walk` [4] facing right) but
倫寶 + 琪寶寶 only, no 噗噗 — for the trips into 8 and 9, while 噗噗 is away from the team.
琪寶寶 carries the blue handheld electric fan from ART-REQUEST-18, not the old paper fan — in
this sheet and in any redrawn `map-walk.png`.

## Code — after the art lands

- Map data per continent: `{ texture, icons, places, roads, start }`. C1 = today's data,
  untouched. C2 = new: places 6–10 plus start 0 (the pier); coordinates measured on N1.
- Stage ≥ 6 → C2 data. Use the green texture once the 「大陸2通關」 flag is set — the same permanent
  flag that unlocks 「重溫快樂結局」 on the main menu. Do not add a second flag.
- No `PLACES[n]!`-style lookups anywhere. An unknown stage falls back to a plain transition and
  never throws.
- 9 → 10: a vertical lift tween up the side of the tower instead of a road walk.
- Walk sprite: the duo sheet for trips whose destination is 8 or 9, otherwise `map-walk`.
- Stage names for 6–10 use the continent form everywhere they show (map banner, HUD plaque,
  clear card, stage-select): 「大陸2・第一關・購物中心」, 「大陸2・第二關・森友展銷中心」,
  「大陸2・第三關・配方控制中心」, 「大陸2・第四關・地底監禁層」, 「大陸2・第五關・頂層控制室」.
  Continent 1 names stay as they are. The HUD plaque currently ellipsizes long titles — check
  these fit on a phone, and shorten the display (not the data) if they don't.
- Stage picking: the C2 map offers C2 stages (6–10) only; the C1 map offers 1–5 only.
- Remove PR #65's temporary black transition once this works.

## Acceptance

- [ ] Entering stage 6 (main menu 大陸2, and `?c2=1`) shows the C2 map with the right stage name.
- [ ] Every C2 trip (pier → 6, 6 → 7 … 8 → 9 walk, 9 → 10 lift) plays through on phone and
      desktop; on phone, touch alone is enough.
- [ ] After clearing stage 10, the C2 map shows the green version from then on.
- [ ] The C1 map behaves exactly as before (stages 1 → 5).
- [ ] No console errors. Screenshots + log in `docs/qa-c2map/`.

## Decided by Alan (2026-11-03)

1. Green version tower mark: replace the △ with six upright dark-green rectangles crossed by a
   left-to-right curve (see N2).
2. Duo walk sprite (N4): yes.
3. Continent 2 stage names show as 「大陸2・第X關・…」 (see Code).
