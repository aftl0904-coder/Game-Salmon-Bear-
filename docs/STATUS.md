# 鮭鮭熊項目狀態（2026-11-03）

## 2026-11-04 · #97 洗地機碰撞／干擾專項（仍為 draft）

- 查明 Phaser `body.reset` 未即時加 offset，修正洗地機移動、轉刷及恢復時 body 同步；第6關 Boss 入場清除 inactive deferred patrol 並禁止戰中重啟，其他關不改。首次注入測試桌面／模擬手機 P1–P3 各一次 HP 6→6、有效攻擊抽樣未超出預警，桌面有一次恢復期實際命中；手機該次命中已到 scan，**未證明手機恢復期反擊**。
- 首次牆邊測試沒有移動，桌面被 Boss 扣 2 HP、測試失敗；手機原程式錯誤地將不動 HP 不變視為通過，不能當作牆邊避險證據。新腳本加上真實避位及傷害事件檢查。舊手機 P2 死亡來源未有原始事件記錄，未證明；桌面 P2 回血候選為 Boss 入口壽司但無法追認。詳見 [`qa-c2-mall-scrubber/README.md`](qa-c2-mall-scrubber/README.md)。
- 第二輪桌面單個牆邊例子有實際移到安全側、HP 6→6；手機逐幀亦見首招安全，但截圖延誤導致測試漏首招、將下一招當首招，下一招不動被洗地機扣 2 HP，整輪 **FAIL**；手機反擊仍到 scan 才命中。測試已修正跨招判定，最後修正未重跑。
- 僅注入局部、自動鍵盤／模擬手機 touch，非自然通關、真人、真機；2P、各裝備、低 FPS、暫停／死亡／重試和完整進場／整合仍未驗證。§4 故事初接與 #90 依賴及 #88 整合未驗證不變；本 PR 不可合併／部署。

## 2026-11-04 · 大陸2第1關洗地機再續 checkpoint（仍為 draft）

- 基線 main `077af8b`；原 `6ba07f4` 只做人類保安，本次新增第6關獨立洗地機初版（臨時原創無字造型）、沿用 Boss 基準 HP 55 及難度倍率；P1 掃描預警後衝撞，P2 近距轉刷，P3 加速，各招嘗試完整恢復。實作**未驗收、不可合併或部署**；詳細驗證及失敗見 [`qa-c2-mall-scrubber/README.md`](qa-c2-mall-scrubber/README.md)。
- 安全位是保守計算而非證明：桌面與模擬手機注入短測 P1 單次 HP 6→6，但桌面 P2 因 HP 4→6 對比失敗、手機 P2 角色死亡後等待逾時，兩者 P3 均未觀察，反擊未命中；首輪手機 P1 HP 6→4，原按鍵座標亦有誤。詳見 QA，不宣稱公平或通關。桌面恢復首幀碰撞位置曾偏移、截圖可見其他敵人；須查 warning／body 對齊及 deferred enemy 清場，未修。
- §4 A–E 與 6→7 已批准文字接到第6關 runtime；未改 #90 開場，其已批准開場仍須合併及整合驗證。未改 #88 `SecurityDirector`；#88 仍有程式及狀態文件衝突，須另行整合、共用人類外形而不改第7關玩法。#91 未驗收素材未使用；第7關三項及第5關待填文字未改。正常入口全關、真機及真人未驗證。

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
