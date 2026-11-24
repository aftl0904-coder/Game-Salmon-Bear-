# ART-REQUEST-20 素材清單

全部素材為原創 16-bit 像素風、無文字／字母／數字／品牌。動畫、prop 與 FX 使用純磁紅 `#FF00FF` 背景；本批只交 `art-src/` 原圖及 manifest，未切 runtime 圖。

## S6-A 人類保安（完成）

路徑：`art-src/anim/enemies/c2-human-guard/`

- `model-sheet.png` [4]
- `idle.png` [3]
- `walk.png` [4]
- `detect.png` [3]
- `warning.png` [3]
- `attack.png` [3]
- `recover.png` [3]
- `hit.png` [2]
- `defeat.png` [4]

設計：原創人類商場保安，深藍無標誌制服及帽；自然步姿、徒手近身動作，並非蜜僵換色。

## S6-B 大型洗地機 Boss（完成）

路徑：`art-src/anim/boss/c2-mall-scrubber/`

- `model-sheet.png` [4]
- `idle.png` [4]
- `move.png` [4]
- `scan.png` [3]
- `warn-charge.png` [3]
- `charge.png` [4]
- `charge-stop.png` [3]
- `warn-brush.png` [3]
- `brush-spin.png` [4]
- `recover.png` [3]
- `hurt.png` [2]
- `defeat.png` [5]

設計：銀灰／深藍無品牌自主洗地機，前置鏡頭、轉刷、輪組；無駕駛者或人物。

路徑：`art-src/anim/fx/c2-mall-scrubber/`

- `scan-warning.png` [2]
- `charge-warning.png` [2]
- `brush-warning.png` [2]

三種預警均以輪廓／箭嘴／範圍形狀表達，不只靠顏色。

## S7-A 馴獸師 Boss（完成）

路徑：`art-src/anim/boss/c2-trainer/`

- `model-sheet.png` [4]
- `idle.png` [4]
- `point.png` [3]
- `rain.png` [4]
- `shield.png` [4]
- `hurt.png` [2]
- `defeat.png` [5]

設計：原創女性訓練場管理人，棕／橄欖綠工作服、實用長辮、繩與短鞭；`shield` 只畫蓄勢防守姿勢，無新增盾牌。

## S7-B 產品化蜜僵與 FX（完成）

路徑：`art-src/anim/enemies/c2-product-zombie/`

- `model-sheet.png` [4]
- `walk.png` [4]
- `reach.png` [3]
- `hit.png` [2]
- `die.png` [4]

設計：灰獾蜜僵加入可穿戴籠框、鬆鏈及完全空白牌；仍可移動，無血腥。

路徑：`art-src/anim/fx/c2-trainer/`

- `whip.png` [3]
- `chain-net-warning.png` [2]
- `chain-net.png` [3]

## S7-C 場景及靜態 props（完成）

路徑：`art-src/props/stage7/`

- `entrance-far.png`（640×360）
- `corridor-mid.png`（1280×720，可接駁構圖）
- `training-mid.png`（1280×720，可接駁構圖）
- `backstage-far.png`（640×360）
- `arena-far.png`（640×360）
- `cage-animal.png`（640×360）
- `cage-empty.png`（640×360）
- `chain-static.png`（640×360）
- `net-static.png`（640×360）
- `number-plate-blank.png`（640×360，牌面全空白）
- `sign-blank.png`（640×360，牌面全空白）

## Manifest

`art-src/anim/manifest.json` 已加入上述 50 個檔案的 `file`、`frames`、`cols`、`rows`、`facing`、`prompt`。

## 未驗證／交接

- 按 brief 未執行切圖、產圖整合或遊戲測試，亦未改 `public/`、`src/` 或 `data/`。
- `corridor-mid.png`、`training-mid.png` 以同高牆／地板邊緣設計作接駁，但未在 runtime 實際平鋪驗證。
- 動畫已按橫向等格交圖及檢查格數；實際切格、碰撞、速度與 Boss 行為須由整合方驗證。
- 無重畫任何結局圖。
