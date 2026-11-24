# C2 art batch 2 — QA

## Group 1: loading portraits and jars

- Fourteen portraits and two jars are standalone PNG assets; no game code or integration is changed.
- `group1-dimensions.txt` and `group1-alpha-check.txt` record dimensions, binary alpha and palette checks. The empty jar has intentionally transparent glass; the full jar also has small transparent glass highlights. The enclosed transparency in Kibobo is the gap between her braid and head, visually checked against a contrasting background.
- `group1-desktop.png` and `group1-mobile-touch.png`, with `group1-browser.txt`, record a desktop mouse and simulated mobile touch-only test of image decoding and selection in a standalone preview. This does not test actual game integration or a physical phone.
- `group1-build.txt`: `npm run build` (`tsc && vite build`) passed.
- `group1-validate-data.txt`: `npm run validate:data` failed on `stage7.json / trainer: static decor types and positions` (1 of 10 validators). The same failure was reproduced on the unchanged main baseline; no data or game code was altered here.

## Group 2: stage 6 and 7 story illustrations

- Five new story PNGs are 1280×720 and opaque; the source images were reduced proportionally, without cropping. Contents follow the requested story-depth draft, which was read from `origin/claude/c2s1-work-order` because it is not on this main baseline. The trainer art was referenced read-only from `origin/cursor/c2-original-batch`; no Cursor branch was modified.
- `group2-dimensions.txt` records output dimensions. `group2-desktop.png`, `group2-mobile-touch.png`, and `group2-browser.txt` record a standalone image preview using desktop mouse and simulated mobile touch only. The images have not been wired into or tested in the game and have not been tested on a physical phone.
- `group2-build.txt`: `npm run build` passed. `group2-validate-data.txt`: the same existing stage7 static-decor data validation failed (1/10), unchanged by this art-only batch.

## Group 3: escalator prop

- Replaced the existing `public/art/c2/prop-escalator.png` at 64×80 with an opaque-subject, transparent-background RGBA PNG, binary alpha and 63 colours; see `group3-dimensions.txt`. The whole escalator, rails and stair treads are visible in the standalone previews (`group3-desktop.png`, `group3-mobile-touch.png`; `group3-browser.txt`).
- The additional Playwright test (`group3-game-test.json`, `group3-game-log.txt` and the two `group3-game-*.png` screenshots) loads the game fully, then injects stage 6 and the player position near the prop and isolates enemies. Desktop uses keyboard, simulated mobile uses touch for interaction; it is not a natural playthrough or physical-device test. The texture loaded and two instances were found at x=1848 and x=1920 with no page errors. The screenshot shows the new small escalator overlapping nearby scenery/cart and the existing large functional escalator: placement and legibility need the integration owner to review; this art-only task does not change code or placement.
- The first attempt jumped into the scene before loading had finished and failed: texture/props were missing. Its log, JSON and screenshots are retained as `group3-game-initial-*`. The later test waits for the menu before injecting and is not evidence of a full playthrough.
- `group3-build.txt`: `npm run build` passed. `group3-validate-data.txt`: the same existing stage7 static-decor data validation failed (1/10).
