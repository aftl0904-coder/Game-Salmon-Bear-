# ART-20 回修報告（2026-11-04，基於 `7b198f7`）

只改 `art-src/`。所有 39 張角色／FX sheet 已重新排版：同一套角色（或 FX）共用一個等寬格尺寸，sheet 寬 = 格數 × 格寬（可整除）；各格腳底／地面基線一致（FX 垂直置中）；每格四邊留空、主體及繩／鏈／刷不跨格；每格 ≤60 色，背景平色 `#FF00FF`，無半透明；已移除 whip 圖內黑色分格線。

| 套 | 格尺寸 | 修正 |
|---|---|---|
| c2-human-guard | 256×352 | 全部重排；`walk.png` 重畫為大步幅左右交替；defeat 放大至同比例 |
| c2-mall-scrubber | 368×344 | 全部重排並按機身高度統一比例（model-sheet、idle、warn-charge、brush-spin、defeat 均已統一）|
| fx/c2-mall-scrubber | 536×288 | `scan-warning`、`charge-warning` 由上下排改為左右 2 等格；`brush-warning` 同格尺寸 |
| c2-trainer | 264×384 | point／rain／shield／defeat 繩與人物分格；rain、shield、defeat 比例對齊 idle |
| c2-product-zombie | 376×456 | 5 張重畫／重排；加入大而清楚的空白胸前編號牌；walk 改為四肢交替大步；die 鏈不再跨格 |
| fx/c2-trainer | 288×304 | whip 去除分隔線；chain-net／chain-net-warning 每格完整 |

場景：`props/stage7/corridor-mid.png`、`training-mid.png` 已用邊緣漸變混合，輸出 1080×720，左右並排量度：換行處色差 ≈ 相鄰像素色差（4.0／4.2 及 4.5／3.7）。

檢查結果見 `ART-REQUEST-20-FIX-slicecheck.txt`：39/39 PASS（可整除、格邊不碰前景、基線一致、每格 ≤60 色）。

## 尚欠／風險
- 無遊戲內 runtime 切圖或 Phaser 預覽驗證（brief 禁止整合）。
- 中景接縫處有輕微半透明疊影（原圖左右邊的木箱混合），並非硬切。
- `training-mid.png` 內垂掛繩圈輪廓似吊繩圈，建議 Manus／Alan 決定是否改為掛鉤或盤繩；我未擅自改設計。
- 保安及蜜僵 walk 已拉開步幅，但仍屬 AI 生成姿勢，建議用實際速度播放再確認。
- 未改 model-sheet 以外的 `public/`、`src/`、`data/`。

## 第二輪（吊繩圈與中景接縫）
- `training-mid.png`：重畫，改為裸鐵掛鉤、器材架、藍球與雪糕筒，完全沒有繩圈；635×720，已裁成完整週期。
- `corridor-mid.png`：重畫並裁成完整週期，1119×720。
- 兩張都以 32px 混合接駁（舊版 200px 混合造成疊影已移除）；並排三次目視無重影、無硬切。
- 未驗證：未在遊戲內實際平鋪；兩張寬度不再是 1280／1080，整合方需按新寬度平鋪。
