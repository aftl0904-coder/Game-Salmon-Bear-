# 鮭鮭熊項目狀態（2026-11-03）

## 1. 現況

- `main`：`dfd4413ec9b85f90743d4d669ff6151471596324`（PR #65：大陸2第1關商場已合併；待 Alan 試玩）。
- 開住嘅 PR：[#67](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/67)（ART-17 美術）、[#68](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/68)（大陸2地圖 code）、[#69](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/69)（STATUS 文件）、[#70](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/70)（第4關修復）及草稿 [#71](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/71)（窿／地面辨識方案）。
- 地圖 code branch 疊住已合併嘅 #65，亦包含 #67 地圖美術 commit；#67 同 #68 嘅 diff 有重疊。
- `manus/stage4-mobile-fix-20261103`：第4關修復已開 #70；Claude 已只讀審閱，無阻塞問題。Alan 暫停試玩前已做模擬手機、桌面、build 同資料驗證；未真機或完整打泥鬃。`Player.ts` 的落地同步影響各關，第1、2、3、5關高低台仍未實測；釘槍節奏亦待日後試玩評估。
- 對 Claude 疑問的靜態核對：`shop.ts` 鍵盤處理包含 Enter 離開；`GameScene.ts` 敵人更新會呼叫共用 `keepEnemyOnTerrain`，蜜僵的 CHASE 狀態遇坑受阻約 700ms 後可觸發跳坑。未因核對而重跑遊戲。

## 2. 分工同 branch

- Alan：試玩、決定設計同合併。
- Manus：寫 code、跑 QA、開獨立 branch／PR。
- Claude：對 diff 審 PR、記錄設計決定及寫 brief；唔寫 code。
- Cursor：美術批次 ART-17／ART-18；`cursor/` branch 凍結，改內容須先經 Alan 批准。一條 branch 只由一個人改。

## 3. 已確認決定

- 大陸2完成旗標：`sake-kuma-c2-cleared-v1`；`markC2Cleared()` 暫未接駁，待第10關完成時呼叫。
- 只認 Alan 親口講「merge PR #N」先合併指定 PR；唔直接 commit 去 `main`，亦唔自行 close PR。
- 第4關：過關及轉場要只用 touch 可操作；泥鬃場地安全並留足攻擊反應時間；蜜僵追人、變速同重用跳坑機制。
- Alan 確認可跑自動化手機／電腦測試；遊戲完成前佢唔會親自試玩。唔自行做手動試玩。
- 玩家回饋：其他關都出現窿同地面顏色難分嘅問題；#71 列出三個方案，待 Claude 審及 Alan 確認，暫不修改遊戲視覺。

## 4. 下一步次序

1. 完成 #70 第1、2、3、5關落台自動回歸，並通知 Claude。
2. Claude 審草稿 #71 嘅窿／地面方案；待 Alan 明確確認先實作。
3. 處理 #67、#68 及主選單／存檔；各 PR 只按 Alan 明確指示合併。Alan 遊戲完成前不親自試玩。
4. ART-18 琪寶寶藍色手提電風扇全套重畫。
