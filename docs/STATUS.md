# 鮭鮭熊項目狀態（2026-11-03）

## 1. 現況

- 本次第7關 draft 基於 `main` `077af8b`（#83、#85、#86 已合併）。
- 已合併：#65 商場、#67 大陸2地圖美術、#68 大陸2地圖程式、#69 狀態文件、#70 第4關修復、#72 經文斷行、#73 電風扇美術、#74 雙人落台 QA、#75 電風扇 QA、#76 地圖預覽 QA、#77 地圖雙人風扇、#78 窿辨識、#80 主選單 PR1、#81 存檔方案、#82 存檔實作、#83 大陸2第2關 brief、#85 大陸2結局素材、#86 結局圖 QA。
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

- Cursor 素材 [#85](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/85) 已合併；包含結局十圖、人物與底圖、trailer 和 logo 草稿。Alan 已同 Cursor 確認圖片，唔再等佢揀；凍結 Cursor branch 並維持一人一 branch。
- 獨立 QA [#86](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/86) 已合併，只含測試證據，沒有重複 #85 素材。以 #83 merge `c6654ef` 加 #85 head `ccbc100` 在 detached worktree 合併預覽，無衝突；build、9 項資料驗證以及 Playwright 桌面鍵盤／模擬手機 touch 逐張重溫 1–10 通過。測試透過 localStorage 直接解鎖，並非真人完整通關或真機測試；第10關完成時仍要接 `markC2Cleared()` 自動解鎖。證據在 `docs/qa-ending-c2/preview-qa/`。
- 預告片 #87 按 Alan 指示暫停製作，不因結局圖 QA 通過而視為獲接納。

## 7. 大陸2第2關實作（draft，2026-11-04）

- 獨立 branch `manus/c2-stage2-20261104`，#88 保持 draft，不 merge／close。從未合併 #91 head `7b198f735ebebfa14c5d07aa7388681745ade7e5` 只接入 A/D/E 遠景及固定網、空白籠號牌、招牌共六張衍生圖；來源／腳本／雜湊／處理和證據見 `docs/qa-c2s2/README.md`。動物籠尺寸不符原牌座標、空籠用途不符、橫向鏈不適合既有直鏈，均保留原佔位；B/C 中景接縫、角色／FX 切格及兩張警示軸向問題仍不合格，未接入。三項文案仍「待補」，返隊不實作。
- 接入後 build 及 10 項資料驗證通過；桌面 2P 鍵盤、模擬手機 1P touch 從正常入口進第7關及短操作，六張圖片 HTTP 200、無 runtime error／404；A–E 視覺和 28 個無 body 固定物前後比對使用注入位置／隔離敵人，不是全關。舊 2P 鍵盤 bot 正常入口全關、兩坑及旗標等記錄屬**素材接入前**，接入後未重跑；詳見 `docs/qa-c2s2/README.md`。
- 鏈網事件已隔離，但並行負載下 P2／P3 實測時長有超出嚴格容差，保留失敗紀錄、不可當穩定通過；第6關共用 Boss 模板獨立回歸、真機及真人完整通關未驗證。1P 自動前段 600 秒只在**素材接入前**通過（非全關），接入後按指示未重跑；旗標短測中主線注入及重載已觀察，支線啟動出現 pageerror 與 timeout，成因未判定，舊檔、新局及支線未驗證。
- 成長系統不在此 PR 實作；只保留空 `clearRank` hook，支線不發點。**第10關 `markC2Cleared()` 尚未接駁**，維持待辦。
