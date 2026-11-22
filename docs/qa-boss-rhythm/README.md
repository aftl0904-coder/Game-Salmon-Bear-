# QA — PR-F mid / T9_BOSS_RHYTHM (WarriorKing only)

**Scope:** shared `BossRhythm` helper + WarriorKing (Stage 1). Other bosses **not** wired — pending Alan playtest.

## Acceptance (K1–K4)

| ID | Check | Result |
|----|-------|--------|
| K1 | GUARD/BREATHER hit → 0 dmg + ding | see `report.json` |
| K2 | OPENING hit → damage | see `report.json` |
| K3 | Non-ATTACK contact → player HP unchanged (soft push) | see `report.json` |
| K4 | ~3–4 OPENINGs per HP segment | see `report.json` |

## Final numbers

- WarriorKing HP: **180** (tuned from round(50×0.7)=35; ~6 hits×3 weak ≈18 / OPENING → 60 segment needs 3–4 openings)
- OPENING: 2500ms normal / 3000 easy / 2000 hard|hell
- GUARD 1500 · BREATHER 2000 · phase-change BREATHER 2500
- WARN windup ×1.3 · ATTACK move/bullet ×0.8

## Evidence

- `report.json` — K1–K4 + meta
- `k1-guard-ding.png` / `k2-opening-hit.png` / `k3-soft-push.png`
- `cycle-*.png` — GUARD / WARN / OPENING / BREATHER
- `warrior-rhythm-short.webm` — short Playwright recording

## Run

```bash
# with vite already on :47501
QA_PORT=47501 node scripts/qa/boss-rhythm-k1-k4.mjs

# or let the script start vite
node scripts/qa/boss-rhythm-k1-k4.mjs
```
