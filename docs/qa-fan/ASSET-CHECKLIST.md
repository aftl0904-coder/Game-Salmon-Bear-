# ART-18 素材清單：有琪寶寶嘅圖

審核方式：逐張打開 `art-src` 原圖睇（圖片檢查，冇開遊戲）。「過關卡」同 Logo／片尾字幕用邊張圖，係睇 `src/game` 代碼確認。

## 一、已重畫（舊紙扇 → 藍色手提電風扇）

| 項目 | 檔案 | 對照圖 |
|---|---|---|
| 角色設定圖 | `art-src/anim/kibobo/model-sheet.png` | `sheet-model-sheet.jpg` |
| 動作 sheet ×16（idle, run, jump, crouch, hurt, ko, slash1–3, win, fan-glide, fan-float, bike-ride, bike-jump, moto-ride, moto-jump） | `art-src/anim/kibobo/*.png` → 重切 `public/art/anim/kibobo.png` + `data/anim/kibobo.json` | `sheet-*.jpg`、`atlas-old-vs-new.png` |
| 封面 | `art-src/story/cover.png` | `story-cover.jpg` |
| 故事圖：野餐 | `art-src/story/c1-picnic.png` | `story-c1-picnic.jpg` |
| 故事圖：單車 | `art-src/story/c2-bike.png` | `story-c2-bike.jpg` |
| 故事圖：夜市 | `art-src/story/c3-market.png` | `story-c3-market.jpg` |
| 故事圖：工地 | `art-src/story/c7-site.png` | `story-c7-site.jpg` |
| 結局圖 ending-2 / ending-3 / ending-picnic | `art-src/story/ending-*.png` | `story-ending-*.jpg` |
| 舊版主角圖（程式冇用，但圖入面有紙扇，所以一齊換） | `art-src/gen/heroes.png`、`art-src/gen/kibobo-poses.png` | `legacy-heroes.jpg`、`legacy-kibobo-poses.jpg` |

## 二、原本冇扇，無需改

| 項目 | 檔案 | 點解 |
|---|---|---|
| 頭像（遊戲內／HUD／對話） | `art-src/portraits/kibobo.png`、`public/art/portraits/kibobo.png` | 三個表情都係胸口以上，冇扇 |
| 頭像（舊合集） | `art-src/gen/portraits.png` | 琪寶寶嗰行係胸口以上，冇扇 |
| 地圖步行圖 | `art-src/map/map-walk.png`、`public/art/map/walk.png` | 約 24px 小人，原圖冇扇 |
| ending-1 | `art-src/story/ending-1.png` | 只有噗噗，冇琪寶寶 |
| `bear-girl.png`（舊占位圖，BootScene 備用載入） | `art-src/bear-girl.png` | 圖中冇可辨認嘅扇；代碼 stamp 上去嘅 `prop-fan` 本身已係電風扇 |
| 第一關概念圖 | `public/art/concept-stage1.png` | 人物冇扇 |
| 其他故事圖：c0-church、c1-hollow、c1-mama、c2-note、c3-queen、c4-taxi、c5-bus、c6-screen、c7-boss、c10-unmask、s2/s3/s4-boss-intro、credits-bg | `art-src/story/*.png` | 冇琪寶寶 |

## 三、冇獨立圖，用上面已重畫嘅 sheet

| 項目 | 用邊張 | 代碼位置 |
|---|---|---|
| 過關卡（stage clear card）嘅琪寶寶 | `kibobo` 動畫 `win` | `GameScene.ts` 約第 5051 行 |
| Logo 畫面 | `kibobo-idle` | `LogoScene.ts` 第 84–88 行 |
| 片尾字幕跑步 | `kibobo` `run` | `CreditsScene.ts` 第 100 行 |
| 過場對話嘅角色 | `kibobo` 動畫組 | `cutscene.ts` |

## 四、冇做／未覆蓋

- **tactical（第 4–5 關戰術服）圖：repo 入面未有呢批圖。** `docs/cursor/ART-REQUEST-14-stage4-5-tactical-outfit.json` 只係要求單，冇交付檔案，所以冇得改。日後畫嗰批要直接用電風扇。
- **二人行走圖 `map-walk-duo.png`**：喺 PR #67 branch，唔喺呢條 branch。裡面暫用嘅風扇要同新設計對齊，需要另一條 branch 處理。

## 五、frameHeight 178 → 180

重切時 cell 高度取所有幀最高者加 2px，最高嗰幀係 `win`（舉劍同電風扇歡呼，新扇比舊紙扇高少少），高咗 1 邏輯 px，所以 `frameHeight` 由 178 變 180（腳底基線同 `cell1x` 90×89 不變）。
