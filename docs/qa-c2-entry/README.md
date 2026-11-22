# QA: C2 ST-06 → ST-07 entry (PR-A / T1)

## Reproduce on `main` (before fix)

See `reproduce-main.json`. After injected `win()` + 「大陸2・第二關 ▶」:

| field | observed |
| --- | --- |
| scene | stayed on `play` |
| `play.stageNo` | 6 |
| `registry.stageNo` | 7 |
| `run.nextStage` | 6 |
| `run.lastCleared` | 5 |
| `progress.maxStage` | 7 |

Root cause: `saveClear` no-op when run/context lagged → nextStage never advanced; worldmap `pick:true` stranded players.

## Fix

- `ensureMainRun` / `guaranteeC2Stage7Unlock` + hardened `saveClear`
- C2 mall→exhibit auto-travel (`pick: false`)
- Main menu continent-2 lands on 7 when run waits there

## Run

```bash
npx vite --host 127.0.0.1 --port 47461 --strictPort
QA_PORT=47461 node scripts/qa/c2-s6-to-s7-entry.mjs
# or: QA_PORT=47461 node --import tsx tests/c2-entry.spec.ts
```
