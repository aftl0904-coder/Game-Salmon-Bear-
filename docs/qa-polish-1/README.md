# Polish-1 QA

Branch `cursor/polish-1-2610` — M6 art wire-in, tip signs 1–7, stage7 spotlight gate, belt deadzone, transition-6to7 chase.

## Run

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 4747 --strictPort
QA_PORT=4747 node scripts/qa/polish-1.mjs
QA_PORT=4747 node scripts/qa/transition-6to7.mjs
```

## Results (this pass)

| Check | Result |
| --- | --- |
| M6 sushi/durian/camp/paw textures | PASS (durian native 18×22 readable silhouette) |
| Stage1–7 `signs` placed | PASS |
| Spotlight ≥2 enemies → warn only | PASS |
| Belt 2080–2360 last 40px no push | PASS (2320+ unmoved; 2200/2300 pushed) |
| Land 2376 → reverse belt 2420 | PASS (reverse pushes when vx=0) |
| Chase bike `to:7` boot + skip → s7 | see `docs/qa-transition-6to7/` |

Art note: campfire / tent / shrine / honey-paw are M6 PNGs; chase alley uses temporary s6/c2 props until Manus plates.
