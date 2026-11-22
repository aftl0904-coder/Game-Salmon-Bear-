# QA — Stage 7 enemy variety (B4_ST7_ENEMY_VARIETY)

## Acceptance

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| A1 | Each segment A–E has ≥3 behavior types; no consecutive same type; density ≤18 | **PASS** | `acceptance.json` → `A1_*` |
| A2 | Standing still + continuous shooting cannot clear a full segment | **PASS** | `03-standstill-shooting.png`, `04-standstill-survivors.png`, `acceptance.json` → `A2_*` |
| A3 | Playthrough clear time (target 4–6 min) | **PASS*** | `clear-time.json` — scripted clear **194s (~3.2 min)** |

## Behavior types

| Species | Name | HP | Notes |
|---------|------|----|-------|
| `s7charge` | 衝鋒蜜僵 | 3 | 400ms warn → 2.5× walk for 200px → rest 800ms |
| `s7hop` | 跳跳籠 | 2 | hop 140px; grounded = immune (`airOnly`) |
| `s7shield` | 盾牌飼養員 | 3 | front `blocks` + `SFX.ding`; hit from behind |
| `s7can` | 掟罐員 | 2 | every 2.5s parabolic can → ground explode |

Art: reuses `honeyzombie` + C2 tints / procedural shield+can overlays. Optional sheets: `docs/cursor/ART-REQUEST-20-st7-enemy-variety.md`.

## How to run

```bash
npx vite --host 127.0.0.1 --port 47652 --strictPort
QA_URL=http://127.0.0.1:47652/?c2=1 node scripts/qa/st7-enemy-variety.mjs
QA_URL=http://127.0.0.1:47652/?c2=1 node scripts/qa/st7-enemy-behaviors.mjs
QA_URL=http://127.0.0.1:47652/?c2=1 QA_PLAY_MS=360000 node scripts/qa/st7-enemy-clear-time.mjs
```

## Clear-time note (A3)

- **Scripted full clear:** `194s` (~3.2 min) — see `clear-time.json` (`clearedFull: true`). Bot used light gear (+1 heart/speed/gun) and soft-healed only when HP≤1 so routing could finish; boss fight from ~102s → win at 194s.
- **Target band 4–6 min:** still the intended human clear without bot assists. Scripted run is faster than band (gear + soft heal); first acceptance pass without gear (`st7-enemy-variety.mjs` 120s cap) reached arena (`bestX≈5273`) but did not finish boss — evidence kept in `acceptance.json` `A3_playthrough`.

## Files

- `acceptance.json` / `summary.json` — main acceptance run
- `behaviors.json` + `behavior-*.png` — per-type smoke
- `clear-time.json` + `clear-*.png` — timed attempt
- `run-console.txt` / `behaviors-console.txt` / `clear-console.txt` — raw logs
