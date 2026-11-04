# 鮭鮭熊項目狀態（2026-11-03）

## #88 前景狀態機嘗試 checkpoint（2026-11-04；仍 draft）
- **未能安全落實，保留遊戲原碼、800／1500 ms 及傷害。** 已查 Phaser 4.2.1 事件次序並製作獨立合成狀態機模型；它不是遊戲修復。長 stall 的 1.5 秒期限與下一次 physics 碰撞機會仍需整合設計和驗證，`POST_RENDER` 亦不證明螢幕顯示。第6關共用 Boss 未改，完整回歸未做。
- 桌面 2P 及模擬手機 1P 經注入局部單序重測仍失敗：兩組真實扣血均在首次 active scene render 前；桌面安全位置另一角色未扣血。人工 scene pause 有紀錄但不等於真正背景。切頁、最小化和獨立背景探針均無 hidden 事件，不能當 hidden／resume 通過。量到約 12–15 FPS，機器負載較高，非低負載基準；所有原始 trace、截圖和失敗保留，詳見 `docs/qa-c2s2/README.md`。
- tsc + Vite build 及 10 項資料驗證 exit 0；模型合成斷言通過不代表 runtime 通過。測試 server 已關閉；沒有重跑 600 秒、沒有 merge／close／部署，#88 保持 draft。

## #88 逐幀安全 checkpoint（2026-11-04；仍 draft）
- **阻塞，未改遊戲原碼或 800／1500 ms 設計。** 桌面注入站位的新 trace 顯示鏈網角色實際扣血發生在同一 frame 首次 active 場景 render callback 之前；畫面有可能同 frame 同時顯示網與扣血，不能據此聲稱已看到獨立無網扣血畫面，但單純更換 timer 仍不足以證明 pause／背景／物理與可見期間安全同步。
- 本輪逐幀、位置注入、pause／背景模擬嘗試、可用設備模式、負載及失敗詳見 `docs/qa-c2s2/README.md`。既有對白保留；不降設計時長、不停傷害、不放寬斷言，尚未證明一影格界限或實機可見性。`frame-build.txt`、`frame-validate-data.txt` 記錄重新 build／10 項資料驗證。未重跑 600 秒，#88 不 merge／close／部署。

## 最新 #88 checkpoint（2026-11-04）
- Alan 已確認第7關及大陸1兩組對白；#88 **只接第7關** D 噗噗反應、馴獸師卡名稱／稱號／三行／提示及 Boss 後離隊提示，逐字見 `docs/bible/first-release-dialogue-drafts.md`。D 只反應、Boss 後離隊，主支線與旗標邏輯不變；大陸1結局不在本 PR。
- 鏈網嚴格時間仍阻塞。已用逐影格 trace 證明 Phaser Timer 的平滑／限幅 delta 與事件 RAF timestamp 及 wall clock 不同；手機單次 1500 ms timer 實際 wall 約 1451.5 ms，受控主執行緒 stall 又令預警或活動延長。舊極端樣本無逐影格資料，不能確認每次歷史異常同源；未改時間、未放寬斷言，暫不冒險改遊戲計時。負載、frame resolution、P2/P3、安全位、失敗原檔及下一步詳見 `docs/qa-c2s2/README.md`。
- 文案接入後 build 及 10 項資料驗證通過；桌面／模擬手機正常選單入口，後注入 D 反應、Boss 卡／擊敗、待續與地圖局部通過，2P 支線注入擊敗不改主線亦通過。非真機或真人／自然 Boss 全關；外層 shell 狀態捕獲失敗、各 JSON 結果分別保存。沒有重跑 600 秒。PR 保持 draft，不 merge／close／部署。

以下屬歷史狀態，與上述最新對白批准、鏈網診斷衝突之處以最新 checkpoint 為準。

## 首版確認跟進（2026-11-04；#88 draft）
- 桌面鍵盤／模擬手機純 touch 均通過第6關正常新檔入口；第7關使用預置第6關已過存檔，正常入口後注入擊敗，重測結算→待續→返回地圖通過。支線使用預置 `nextStage=8,puffLeft=true` 主線、正常選單 2P 後注入擊敗，觀察一次離隊、主線快照不變及返回地圖通過。不是實機、真人或完整 Boss 戰；首輪測試失敗原檔保留。
- 鏈網嚴格時間未通過，並行負載實測 P2 1300.0／1749.8 ms、P3 1233.2／1433.4 ms；原因尚未確定，不得宣稱通過。原支線 pageerror／timeout 在正常 Boot 及正常選單新測中沒有重現，但舊錯誤無堆疊，不能斷言產品 race 已全排除。詳見 `docs/qa-c2s2/README.md`。
- Alan 已確認首版公開大陸2：第6關選單新局或第5關順序接續；第7關 Boss→離隊→結算→待續→返回地圖，第8關不可玩。現有第8關主線預期存檔保留、不跳轉；支線返回主線而不寫離隊旗標及大陸2完整結局旗標。細節及驗證請以 `docs/qa-c2s2/README.md` 最新區段為準；本 PR 不包含另行實作的成長系統。
- 三項第7關故事文字仍為「待補」，授權擬稿不是批准上線。維持六張既有素材及其他佔位，#91 不合格動畫沒有接入。素材接入後未重跑 600 秒或 2P 全關；不宣稱真人或實機驗收。
- 下方有關 `?c2=1` 測試閘之描述為歷史狀態，以上次首版確認取代。

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
