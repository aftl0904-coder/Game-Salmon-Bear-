# 鮭鮭熊項目狀態（2026-11-03）

## 第一版商店／地圖 checkpoint（2026-11-04）
- 商店重配及地圖第一關入口已接入；兩角色獨立保額、支線拒絕永久重配、原子保存及 HP 不回血的方案見 [bible](bible/first-release-growth-20261104.md)。
- [QA](qa-first-release-growth/README.md) 保存桌面、模擬手機觸控以及 fixture 失敗；未真機／真人／自然通關，地圖及後續回歸以 QA 的實際記錄為準。#95 維持 draft，不合併、不部署。

## 第一版五軸戰鬥 checkpoint（2026-11-04，歷史）
- 主線按各角色已分配成長接入五軸；支線為零基準、死亡保留成長清裝備；公式和上限見 [bible](bible/first-release-growth-20261104.md)。商店重配未做；不可合併。
- [QA](qa-first-release-growth/README.md)：桌面鍵盤及模擬手機 touch 以注入配點／靜止目標比較實際場景與碰撞，發現並修正雙人絕招歸屬，失敗保留。注入式補血／跨關／死亡／支線檢查通過；未真機、真人、自然通關或全面平衡，所有 Boss 和裝備組合未測。
## 第一版新局成長 UI checkpoint（2026-11-04，歷史）
- 主選單及地圖接入 Phaser 舊局／不帶來源及兩角色配點，與舊裝備選擇分開；只有明確確認配點的新局呼叫可越過非零重開保護，舊呼叫仍阻擋。商店重配及五軸戰鬥效果未做，不應合併。
- 桌面鍵盤及模擬手機純 touch 從封面操作新局、兩人配點、取消、不帶及選回兩個不同來源；過關及裝備資料是注入 fixture。注入 quota／壞檔保留原文並阻擋確認；詳見 [QA](qa-first-release-growth/README.md)。補測兩種輸入經選單進支線，注入購裝／清關不改主線，並測舊裝備承接；榜單兩個寫入點以注入場景／結算驗證，首次故事未跳過超時已保留，重試通過。地圖新局入口仍未實測。未真機、未真人、未自然通關；跨分頁同時寫入仍有競態。
## 第一版成長版本化存檔 checkpoint（2026-11-04）

- Alan 已確認帶舊成長保底5但不額外加5、3/5/7關單雙打均兩人各得同額、每局獨立可選回且不合併；見 [成長規則](bible/first-release-growth-20261104.md)。
- v2 本局快照已存 GrowthBook、雙角色起始點及首次 3/5/7 主線獎勵；`win()` 先固定原評級，再將進度與帳本一起寫入。只有空舊預留欄位可零點遷移並保留原文；未知／損壞拒絕覆寫。當時尚未有取回 UI，故當時已有非零成長時暫停重開新局；不能當完整成長系統合併。
- build、資料驗證、真實瀏覽器 localStorage、注入場景結算／失敗重試、既有桌面及模擬手機 touch 新局入口通過；當時來源切換是注入 fixture，不是玩家操作。當時配點／重配／取回 UI、五軸戰鬥效果、榜單整體及實戰平衡仍未完成；跨分頁同時寫入未保證安全。詳見 [QA](qa-first-release-growth/README.md)。未真人、真機或自然完整通關。

## 1. 現況

- 本次更新基於 `main` `c6654ef`（合併 #83）。
- 已合併：#65 商場、#67 大陸2地圖美術、#68 大陸2地圖程式、#69 狀態文件、#70 第4關修復、#72 經文斷行、#73 電風扇美術、#74 雙人落台 QA、#75 電風扇 QA、#76 地圖預覽 QA、#77 地圖雙人風扇、#78 窿辨識、#80 主選單 PR1、#81 存檔方案、#82 存檔實作、#83 大陸2第2關 brief。
- [#71](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/71) 窿辨識方案草稿已按 Alan 確認關閉，branch 保留。[#78](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/78) 已合併（`eb91ae3`）；build、資料驗證、六關模擬手機／桌面自動 QA 通過，未真機或完整通關。
- #68 的 `markC2Cleared()` 尚未接第10關。#70 未真機及完整泥鬃戰測試。#73 獨立 `fan-glide` 未喺遊戲驗證。#74 未測真機及完整對戰。

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

## 4. 下一步次序

1. **主選單及存檔**：#80、#82 已合併；成長點數另開 PR，細節不清楚須先確認。
2. **大陸2第2關（森友展銷中心）**：Claude 整理 A–E 已確認 brief 並交代來源，Cursor 做原創美術，Manus 實作；欠缺或未確認嘅設計先由 Alan 決定。
3. **大陸2第3–5關 brief**：Claude 整理故事及分關 brief，Alan 確認未決設計，Cursor 做原創美術，Manus 按關卡次序實作；第10關完成時接現有 `markC2Cleared()`。

## 5. 主選單兩階段（Alan 已確認）

- PR1：[#80](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/80) 已按 Alan 指示合併；第10關完成旗標尚未接線，未真機或完整通關。
- PR2：方案 [#81](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/81) 及實作 [#82](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/82) 已合併（#82 `1f29d26`）。⚪ 只用於兩個大陸第一關開新局，✅ 順序延續，🚫 直接揀其他關及重玩舊關不帶；支線裝備、金幣與 HP 用記憶體隔離。**請只開一個分頁**：兩個分頁同時寫入仍可能互相覆蓋；未真機及完整通關。成長點數另開 PR。細節見 `docs/bible/menu-save-decisions.md`。
- 大陸2第2關（內部第7關）A–E brief 原文及問題清單在 [#83](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/83)，已合併（`c6654ef`）；Alan 已確認 Claude 答覆第3–9項同噗噗離隊旗標方案。細節見 `docs/bible/c2-stage2-answers.md`。
- 噗噗第7關 D 段只反應，擊敗 Boss 後離隊；旗標跟主線本局，支線事件不寫存檔。**返隊時間待 Alan 日後決定，第7關不實作返隊**。噗噗台詞、馴獸師 Boss 卡和離隊提示文字均待 Alan 拍板，不可自行補寫。

## 6. 大陸2結局圖

- Cursor 素材 [#85](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/85) 為 draft，尚未合併；包含結局十圖、人物與底圖、trailer 和 logo 草稿。Alan 已同 Cursor 確認圖片，唔再等佢揀；凍結 Cursor branch 並維持一人一 branch。
- 獨立 QA [#86](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/86) 只含測試證據，沒有重複 #85 素材。以 #83 merge `c6654ef` 加 #85 head `ccbc100` 在 detached worktree 合併預覽，無衝突；build、9 項資料驗證以及 Playwright 桌面鍵盤／模擬手機 touch 逐張重溫 1–10 通過。測試透過 localStorage 直接解鎖，並非真人完整通關或真機測試；第10關完成時仍要接 `markC2Cleared()` 自動解鎖。證據在 `docs/qa-ending-c2/preview-qa/`。
- 預告片 #87 按 Alan 指示暫停製作，不因結局圖 QA 通過而視為獲接納。
