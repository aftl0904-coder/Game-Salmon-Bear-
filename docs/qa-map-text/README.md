# PR-D T7 — World map text ×2

## Change
fontSize ×2: 9→18, 10→20, 11→22, 13→26, 14→28; title 22→32 (exception).  
Hints shortened to `A／Enter 繼續`; wordWrap ≤560; labels under icons.

## Evidence
| File | What |
|------|------|
| `continent1-map.png` | 大陸1 map |
| `continent2-map.png` | 大陸2 map |
| `bible-verse.png` | Verse panel on map |
| `title-card-verse.png` | Title-card verse page |
| `new-game-choice.png` | New-game dialog |
| `iphone13-map.png` | iPhone 13 landscape |
| `iphone13-portrait.png` | iPhone 13 portrait |
| `report.json` | W1–W3 PASS |

## Run
```bash
QA_URL=http://127.0.0.1:47510/ node scripts/qa/c2-map-text.mjs
```
