# 鮭鮭熊項目狀態（2026-11-03）

## 1. 現況

- 本次更新基於 `main` `1f29d26`（合併 #82）。
- 已合併：#65 商場、#67 大陸2地圖美術、#68 大陸2地圖程式、#69 狀態文件、#70 第4關修復、#72 經文斷行、#73 電風扇美術、#74 雙人落台 QA、#75 電風扇 QA、#76 地圖預覽 QA、#77 地圖雙人風扇、#78 窿辨識、#80 主選單 PR1、#81 存檔方案、#82 存檔實作。
- [#71](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/71) 窿辨識方案草稿已按 Alan 確認關閉，branch 保留。[#78](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/78) 已合併（`eb91ae3`）；build、資料驗證、六關模擬手機／桌面自動 QA 通過，未真機或完整通關。
- #68 的 `markC2Cleared()` 尚未接第10關。#70 未真機及完整泥怪戰測試。#73 獨立 `fan-glide` 未喺遊戲驗證。#74 未測真機及完整對戰。

## 2. 分工同 branch

- Alan：決定設計同合併；遊戲完成前不親自試玩。
- Manus：寫 code、跑自動化 QA、開獨立 branch／PR。
- Claude：對 diff 審 PR、記錄設計決定及寫 brief；唔寫 code。
- Cursor：地圖雙人風扇 #77 已合併；`cursor/` branch 凍結，改內容須先經 Alan 批准。一條 branch 只由一個人改。

## 3. 已確認決定

- 大陸2完成旗標：`sake-kuma-c2-cleared-v1`；`markC2Cleared()` 待第10關完成時接駁。
- 只認 Alan 親口講「merge PR #N」先合併指定 PR；唔直接 commit 去 `main`，亦唔自行 close PR。
- Alan 確認可跑自動化手機／電腦測試；唔自行做手動試玩。
- 手機 2P：Alan 唔會兩人同機用手機玩，**唔做 P2 touch 控制**。
- 第1至6關窿辨識：採用 #71 的 A＋B；窿內加深、兩側高對比邊線、地面頂邊連續亮邊但窿口中斷。只改外觀，不改碰撞、坑寬、平台或敵人。
- 第7至10關新增窿時，沿用 #78 `drawTerrainFeatures()` 的深色窿、兩側邊線及在窿口中斷嘅地面頂邊亮線；以 #78 合併後版本為基線。
- Boss 改名 [#84](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/84) 待 Claude 審：第4關「泥怪」，稱號「爛泥灣工地發瘟判頭」；第5關「Trinity」，職位「項目經理」，原稱號「派嘢嗰個」暫保留。
- 只改文字及資料，ID、機制及美術不變；攻略三張截圖內舊名交 Cursor 跟進；含「大佬」嘅歧義文字待 Claude／Alan 確認。

## 4. 下一步次序

1. **主選單及存檔**：#80、#82 已合併；成長點數另開 PR，細節不清楚須先確認。
2. **大陸2第2關（森友展銷中心）**：Claude 整理 A–E 已確認 brief 並交代來源，Cursor 做原創美術，Manus 實作；欠缺或未確認嘅設計先由 Alan 決定。
3. **大陸2第3–5關 brief**：Claude 整理故事及分關 brief，Alan 確認未決設計，Cursor 做原創美術，Manus 按關卡次序實作；第10關完成時接現有 `markC2Cleared()`。

## 5. 主選單兩階段（Alan 已確認）

- PR1：[#80](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/80) 已按 Alan 指示合併；第10關完成旗標尚未接線，未真機或完整通關。
- PR2：方案 [#81](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/81) 及實作 [#82](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/82) 已合併（#82 `1f29d26`）。⚪ 只用於兩個大陸第一關開新局，✅ 順序延續，🚫 直接揀其他關及重玩舊關不帶；支線裝備、金幣與 HP 用記憶體隔離。**請只開一個分頁**：兩個分頁同時寫入仍可能互相覆蓋；未真機及完整通關。成長點數另開 PR。細節見 `docs/bible/menu-save-decisions.md`。
- 大陸2第2關（內部第7關）A–E brief 原文及問題清單在 [#83](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/83)，Claude 已審閱並提供答覆，見 `docs/bible/c2-stage2-answers.md`；本次文件補充後請 Claude 核對。#83 合併及設計細則經 Alan 確認前不開始實作。
- 噗噗第7關 D 段只反應，擊敗 Boss 後離隊；**返隊時間待 Alan 日後決定，第7關不實作返隊**。第7關存檔級 once 嘅新本局與支線範圍待釐清（第6關籠子 once 只屬單次場景）；噗噗台詞、馴獸師 Boss 卡和離隊提示文字均待 Alan 拍板，不可自行補寫。
