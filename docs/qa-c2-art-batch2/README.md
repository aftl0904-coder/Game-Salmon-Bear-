# C2 art batch 2 — QA

## Group 1: loading portraits and jars

- Fourteen portraits and two jars are standalone PNG assets; no game code or integration is changed.
- `group1-dimensions.txt` and `group1-alpha-check.txt` record dimensions, binary alpha and palette checks. The empty jar has intentionally transparent glass; the full jar also has small transparent glass highlights. The enclosed transparency in Kibobo is the gap between her braid and head, visually checked against a contrasting background.
- `group1-desktop.png` and `group1-mobile-touch.png`, with `group1-browser.txt`, record a desktop mouse and simulated mobile touch-only test of image decoding and selection in a standalone preview. This does not test actual game integration or a physical phone.
- `group1-build.txt`: `npm run build` (`tsc && vite build`) passed.
- `group1-validate-data.txt`: `npm run validate:data` failed on `stage7.json / trainer: static decor types and positions` (1 of 10 validators). The same failure was reproduced on the unchanged main baseline; no data or game code was altered here.
