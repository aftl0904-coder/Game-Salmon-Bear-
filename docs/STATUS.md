# 鮭鮭熊項目狀態（2026-11-03）

## 1. 現況

- `main`：`17930a0369a9f177e91372a2456a41da19bd377f`（#65、#70 已合併）。
- 開住嘅 PR：[#67](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/67)（ART-17 美術）、[#68](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/68)（大陸2地圖 code）、[#69](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/69)（STATUS 文件）、草稿 [#71](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/71)（窿／地面辨識方案）、[#72](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/72)（經文按標點斷行）、草稿 [#73](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/73)（ART-18 風扇）及 [#74](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/74)（2P 落台 QA）。
- 地圖 code branch 疊住已合併嘅 #65，亦包含 #67 地圖美術 commit；#67 同 #68 嘅 diff 有重疊。
- #73 與 `main` 三方合併預檢無文字衝突；`frameHeight` 由 178 改 180，與 ART-18 原 brief「cell size 不變」不同，待 Claude 審及遊戲內驗證；未改 Cursor branch。
- [#70](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/70) 第4關修復已合併至 `17930a0`。第1、2、3、5關各抽一處高台，兩角色各自以單人模式嘅模擬手機 touch 同桌面鍵盤回歸通過；第4關物理、手機轉場、桌面及第6關 smoke 已重跑。未真機或完整打泥鬃，亦未涵蓋各關所有平台；釘槍節奏待日後評估。
- #74 補真正 2P 場景：第1至5關各抽一處，桌面兩人同時鍵盤落台通過；手機 P1 純 touch、P2 同場靜止通過。現有遊戲沒有 P2 屏幕 touch 控制，P2 要鍵盤或第二個手掣；未真機及未測完整對戰。
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

1. Claude 審 #74 雙人模式落台自動回歸，並留意手機 P2 touch 限制。
2. Claude 審草稿 #71 嘅窿／地面方案；待 Alan 明確確認先實作。
3. #72 修復經文斷行，已做文字、手機及桌面自動測試，待 Claude 審閱；與 #68 同改 `WorldMapScene.ts`，整合後需再驗證。
4. 處理 Cursor 的 #67、#68；只按 Alan 明確指示合併。
5. ART-18 琪寶寶藍色手提電風扇全套重畫；按已確認故事大綱處理主選單及存檔。Alan 遊戲完成前不親自試玩。
