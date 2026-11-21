# 32-bit 小批次 G 保安 + S 遠景

Alan 2026-11-08：密度收貨；先做 G+S；洗地機排後；大陸2 調色板放寬到 **≥128 色**，先量檔案大小同載入速度。

本批只放 `art-src/`，**未接入 runtime**。

## 產出

- `full/`：全色 32-bit 原圖（保安格數／尺寸同 #91；遠景 640×360 + 1280×720）
- `q128/`：median-cut **128 色、無 dither**（保安保留磁紅 `#FF00FF`）
- `measure.json`：色數同 byte 量度

保安 9 張：`idle` 3／`walk` 4／`detect` 3／`warning` 3／`attack` 3／`recover` 3／`hit` 2／`defeat` 4／`model-sheet` 4；每格 **256×352**。  
遠景 3 張：`entrance-far`（沿用試畫）、`backstage-far`、`arena-far`。圖內無文字。

## 檔案大小（640 遠景 PNG）

| 圖 | #91 原圖 | 現 runtime ≤64 色 | 32-bit 全色 640 | 32-bit q128 640 |
|---|---:|---:|---:|---:|
| entrance-far | 465 KB（~12 萬色） | 109 KB（64） | 486 KB | 350 KB（128） |
| backstage-far | 359 KB | 135 KB（64） | 391 KB | 355 KB（128） |
| arena-far | 383 KB | 117 KB（64） | 380 KB | 310 KB（128） |

保安 sheet：#91 約 58–113 KB（~120–240 色）；32-bit 全色 89–168 KB；q128 約 79–150 KB（**剛好 128 色**）。

1280 全色遠景 1.3–1.7 MB，只作原圖，唔建議直接當 camera-fixed 遠景。

## 載入速度

見 `docs/qa-c2s2/art-load-32bit.json`（#100 唔改遊戲；量度腳本喺 #99 `scripts/qa/c2s2-art-load.mjs`）。結論寫喺該 JSON 同行嘅 `art-src/c2-32bit-test/batch-gs/LOAD.md`。

## 建議（估計）

- **q128 640 遠景** 比而家 64 色 runtime 大 2.5–3.2 倍，但細過 #91 高色原圖。若 decode 合格，大陸2 遠景用 128 色、角色 sheet 用 128 色合理。
- 全色遠景（14 萬色）檔案同 decode 都重，不合先用。
- 洗地機（批次 M）未做。
