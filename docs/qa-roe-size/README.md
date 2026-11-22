# PR-D T6 — Roe size

## Change
- `spawnRoe` base scale `1.7 → 1.1` (~65% visual)
- Power multipliers `0.8` / `1.4` unchanged
- `PROJ_DISPLAY_SCALE` unchanged
- Hitbox restored via `body.setSize` so world size matches old `frame × 1.7 × powerMul` (18.7px @ power 1, frame 11)

## Evidence
| File | What |
|------|------|
| `before-shot.png` | Visual at scale 1.7 |
| `after-shot.png` | Visual at scale 1.1 |
| `before-baseline.json` | Expected old world sizes |
| `after-measure.json` | Measured after change |
| `report.json` | R1–R3 PASS |

## Run
```bash
QA_URL=http://127.0.0.1:47510/ node scripts/qa/c2-roe-size.mjs
```
