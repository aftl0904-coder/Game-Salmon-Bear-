# 鮭鮭熊項目狀態（2026-11-03）

## 1. 現況

- 最新 `main`：`0014e63352a56e1b54bc1ec36a397b96aedca75d`（合併 #76）。
- 已合併：#65 商場、#67 大陸2地圖美術、#68 大陸2地圖程式、#70 第4關修復、#73 電風扇美術、#75 電風扇 QA、#76 地圖預覽 QA。
- 未合併：[#69](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/69) 狀態文件、草稿 [#71](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/71) 窿／地面方案、[#72](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/72) 經文斷行、[#74](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/74) 雙人落台 QA。
- #68 的 `markC2Cleared()` 尚未接第10關。#70 未做真機及完整泥鬃戰測試。#73 風口實際播 `fan-float`，獨立 `fan-glide` 未喺遊戲驗證。
- #74 舊版測試：第1至5關各抽一處，桌面兩人同時鍵盤落台通過；手機 P1 純 touch、P2 同場靜止通過。遊戲沒有 P2 屏幕 touch 控制；未真機及完整對戰。

## 2. 分工同 branch

- Alan：決定設計同合併；遊戲完成前不親自試玩。
- Manus：寫 code、跑 QA、開獨立 branch／PR。
- Claude：對 diff 審 PR、記錄設計決定及寫 brief；唔寫 code。
- Cursor：#73 同 #67 已合併，**可以由最新 main 開新 branch**，將 N4 `art-src/map/c2/map-walk-duo.png` 風扇對齊藍色手提電風扇新設計。原有 `cursor/` branch 凍結，改內容須先經 Alan 批准。一條 branch 只由一個人改。

## 3. 已確認決定

- 大陸2完成旗標：`sake-kuma-c2-cleared-v1`；`markC2Cleared()` 待第10關完成時接駁。
- 只認 Alan 親口講「merge PR #N」先合併指定 PR；唔直接 commit 去 `main`，亦唔自行 close PR。
- 第4關過關及轉場要只用 touch 可操作；泥鬃場地安全並留足攻擊反應時間；蜜僵追人、變速同重用跳坑機制。
- Alan 確認可跑自動化手機／電腦測試；唔自行做手動試玩。
- 玩家回饋其他關都出現窿同地面顏色難分；#71 列出三個方案，**等 Alan 確認方向，暫不實作**。

## 4. 下一步次序

1. Manus 檢查 #69、#72、#74 與最新 main 嘅衝突、build 同驗證，交 Claude 審閱。
2. Cursor 由最新 main 開新 branch 修 N4 風扇；唔修改原有 Cursor branch。
3. #71 等 Alan 確認方向；再按已確認故事大綱處理主選單及存檔。
