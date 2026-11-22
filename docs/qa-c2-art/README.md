# QA · C2 mall art (PR-K / B7)

Evidence for `B7_SCRUBBER_AND_PROPS_ART`.

## Assets

| File | Key |
|------|-----|
| `public/art/c2/scrubber-sheet.png` | `c2-scrubber` (112×80 ×10) |
| `public/art/c2/blower-sheet.png` | `c2-blower` (48×40 ×5) |
| `public/art/c2/acid-puddle-strip.png` | `c2-acid-puddle` |
| `public/art/c2/acid-fx.png` | `c2-acid-drip` (first 2 frames) |
| `public/art/c2/prop-*.png` | `c2-prop-*` |

## Run

```bash
npx vite --host 127.0.0.1 --port 47653
QA_PORT=47653 node scripts/qa/c2-mall-art-b7.mjs
```

## Shots

- `segment-A.png` … `segment-E.png` — stage 6 midpoints（plant／bench／trash／lightbox／escalator 等 c2-prop）
- `boss-idle.png` / `warn` / `charge` / `recover` / `spray` / `defeated` — in-game arena
- `sheet-scrubber-poses.png` + `sheet-scrubber-*.png` — 每狀態視覺差（sheet 放大）
- `sheet-blower-*.png` / `sheet-acid-fx.png` / `sheet-mall-props.png`
- `report.json` — texture presence + collision box check（96×58 @ offset 8,20）

## Notes

- 綠 `__MISSING` 方塊係舊敵人／道具缺圖（唔喺 B7 範圍），唔係 scrubber／blower／acid／商場雜物嘅 Graphics 佔位。
- PNG 係 python 正式像素畫布（1px 外框＋明暗）；人手重畫可直接蓋同檔名／格表。
