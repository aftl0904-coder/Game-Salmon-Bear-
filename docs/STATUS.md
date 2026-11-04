# 鮭鮭熊項目狀態（2026-11-03）

## 2026-11-04 第一版目標更新

- Alan 指定暫時做到可玩至**大陸2第2關（內部第7關）**；攻略更新到該處並標「待續」；第一版有攻略、角色集、遊戲三個入口。角色集收錄全部已畫角色，每人抽一個正常及兩個特別動作；按好／壞分組，再按各組登場順序排列。已記錄於 [`bible/first-release-scope.md`](bible/first-release-scope.md)。
- Alan 於 2026-11-04 確認第一版公開大陸2、第7關待續後回地圖、各角色用三個按鈕選動作並即時可看；新局兩主角各5起始成長點、商店免費重配及保留舊成長選擇等詳見 [`bible/first-release-confirmations-20261104.md`](bible/first-release-confirmations-20261104.md)。第7關及大陸1待填對白已獲 Alan 確認，尚須接入及驗證。第7關 draft #88 與美術 draft #91 尚未合併；不假稱第一版完成。大陸1 bug 仍優先，第8–10關不屬此次指定的完成範圍。
- 兩組對白按 Alan 確認的逐字原文存於 [`bible/first-release-dialogue-drafts.md`](bible/first-release-dialogue-drafts.md)，包括第7關 Boss 卡的現有 `why` 欄位。大陸1對白已接入 draft #98：build、9 項資料驗證、注入場景的桌面鍵盤／模擬手機 touch 逐句驗證通過；第7關對白已接入 #88：build、10 項資料驗證、桌面／模擬手機局部測試的 JSON 均 passed，但外層命令因狀態擷取錯誤 exit 2。均未合併或上線，未真人完整通關。
- 攻略更新至第7關並標「待續」見 draft #92；最終 build／資料驗證與桌面鍵盤、模擬手機 touch 導航通過；第7關及洗地機仍標開發中，#84 Boss 更名未合併須同步。
- 第5關 Boss 羽毛公平度與飛刀見 draft #93：手機局部重測 boy／girl 及 P1 touch＋P2 鍵盤走位通過，飛刀外觀 1.6 倍但原碰撞與傷害不變；舊失敗保留。仍未驗所有起點、真機或完整 Boss 戰。大合照 #94 已由完整淡入後以真實時鐘計五秒，模擬手機正常／完美自然及跳過四項個別測試記錄 PASS；外層 shell 退出碼因包裝器錯誤為失敗，原有超時失敗也保留，不得誤稱整個命令 exit 0。未驗真機／完整通關。兩者尚未 merge。
- 2026-11-04 checkpoint：第7關 #88 已做公開入口、待續回地圖及禁止第8關，桌面／模擬手機局部流程及支線測試通過；鏈網逐影格發現警告／傷害時序失敗，仍未修，接素材後未重跑 600 秒及 2P 全關。成長 #95 已接版本化本局存檔、主線獎勵原子寫入、選舊局、兩主角開局配點、五軸戰鬥效果、商店重配及地圖第1／6關新局入口；桌面與模擬手機有局部操作測試，部分場景／存檔以 fixture 注入，並非自然通關。整體商店／地圖初測有失敗，地圖獨立重試通過；最終商店提示位置及其他關續局／支線仍待驗，跨分頁有競態，請只開一個分頁。角色集 #96 有三入口及基本操作，但缺角色動作及資料仍未完成。第6關 #97 已修正碰撞偏移及 arena 延遲敵人，桌面 P1–P3 注入短測通過；手機嚴格重測仍失敗，反擊及多種安全站位未證明，與 #90 整合及自然通關未驗。以上 PR 都是 draft，未上線。

## 2026-11-04 補充：大陸2第6關方案／集中美術批次

- 本文件分支由重新核對的 `origin/main` `077af8b14b34b3e26d776e36705772fdd691639b` 建立；只寫文件及保存 QA，未改程式或遊戲數據。大陸2開場原文另由獨立分支實作，本分支不碰其檔案。
- Alan 已確認第6關小怪改成原創人類保安（不得以蜜僵動畫換色），Boss 改成有掃描鏡頭及轉刷的原創大型商場洗地機，偵測後先預警、衝撞或近身轉刷，每輪留反擊空檔，後期加快但可避；不影響第7關馴獸師。已確認造型：保安深藍制服及帽；洗地機銀灰深藍、前方鏡頭及轉刷；第7關馴獸師棕綠工作服、鞭或繩。餘下造型細節由 Cursor 發揮。2026-11-04 已批准保安近攻、洗地機三階段及 §4 較完整故事，其他戰鬥細數授權按現況與實測調整；詳見確認文件與 [`bible/c2-stage1-security-cleaner-proposal.md`](bible/c2-stage1-security-cleaner-proposal.md) 頂部更新。
- 集中 Cursor 素材見 [`cursor/ART-REQUEST-20-c2-original-batch.md`](cursor/ART-REQUEST-20-c2-original-batch.md)：第6關保安、洗地機，以及第7關馴獸師、產品化蜜僵、FX、背景及固定物可按確認方向一次製作；缺 brief 的第8–10關及批准狀態不明舊項目不得開畫。#88 `manus/c2-stage2-20261104` 是未合併 draft；其 ART-19 僅作第7關美術交接來源。第7關 D 噗噗反應、馴獸師 Boss 卡、離隊提示已獲 Alan 確認並接入 #88 草稿。
- 方案 §4 較完整的第6關 A–E 及前往第7關故事／對白已獲 Alan 確認；已確認的開場原文不改。大陸2開場實作見 draft #90，並非已合併或上線；第7關三項文字及大陸1待填結局已接入各自草稿，整合後仍須複測。
- 本次 baseline build、9 項 data validation、桌面雙人鍵盤及模擬手機 P1 touch 落台 smoke 通過；使用注入測試點，未測第6關新設計／第7關、真機、真人通關及手感。證據與限制見 `docs/qa-c2-planning/`。
- Cursor ART-20 已推新 branch，由 Manus 代開 draft #91，檢查 head `7b198f7`；50 張 PNG 齊，但動畫跨格、部分 FX 排列不符 manifest，兩張第7關中景接縫不合格，暫不能整批整合。詳細回修清單及獨立桌面／模擬手機素材預覽見 `docs/qa-art20/`。#88 已局部接入六張合格 runtime 衍生圖，其餘用佔位；素材接入後未重跑 600 秒與 2P 全關，原鏈網計時及支線注入錯誤仍待處理。#91 不自行 merge 或 close。
- Alan 於 2026-11-04 明確批准 **Cursor 修改並推送 #91 原分支 `cursor/c2-original-batch`** 進行素材回修；仍由 Cursor 一人修改，Manus 只在完成後檢查。這不構成合併／關閉 #91 或修改其他 `cursor/` 分支的授權。
- 預告片 #87 仍 draft，已排除大檔、字幕「待補」；Alan 指示暫停，不重剪。正式網站 Production 已部署最新已合併 main `077af8b`；第7關、開場及新美術草稿均未上線。

## 1. 現況

- 本次更新基於 `main` `077af8b`（合併 #86）；下方其他歷史紀錄保留原有驗證時間。
- 已合併：#65 商場、#67 大陸2地圖美術、#68 大陸2地圖程式、#69 狀態文件、#70 第4關修復、#72 經文斷行、#73 電風扇美術、#74 雙人落台 QA、#75 電風扇 QA、#76 地圖預覽 QA、#77 地圖雙人風扇、#78 窿辨識、#80 主選單 PR1、#81 存檔方案、#82 存檔實作、#83 大陸2第2關 brief。
- [#71](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/71) 窿辨識方案草稿已按 Alan 確認關閉，branch 保留。[#78](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/78) 已合併（`eb91ae3`）；build、資料驗證、六關模擬手機／桌面自動 QA 通過，未真機或完整通關。
- #68 的 `markC2Cleared()` 尚未接第10關。#70 未真機及完整泥鬃戰測試。#73 獨立 `fan-glide` 未喺遊戲驗證。#74 未測真機及完整對戰。

## 2. 分工同 branch

- Alan：決定設計、合併及何時親自試玩。
- Manus：寫 code、跑自動化 QA、開獨立 branch／PR；Claude 休息時按 Alan 指示兼顧規劃及審核。
- Claude：平時對 diff 審 PR、記錄設計決定及寫 brief；唔寫 code。
- Cursor：地圖雙人風扇 #77 已合併；`cursor/` branch 凍結，改內容須先經 Alan 批准。一條 branch 只由一個人改。

## 3. 已確認決定

- 大陸2完成旗標：`sake-kuma-c2-cleared-v1`；`markC2Cleared()` 待第10關完成時接駁。
- 只認 Alan 親口講「merge PR #N」先合併指定 PR；唔直接 commit 去 `main`，亦唔自行 close PR。
- Alan 確認可跑自動化手機／電腦測試；唔自行做手動試玩。
- 手機 2P：Alan 唔會兩人同機用手機玩，**唔做 P2 touch 控制**。
- 第1至6關窿辨識：採用 #71 的 A＋B；窿內加深、兩側高對比邊線、地面頂邊連續亮邊但窿口中斷。只改外觀，不改碰撞、坑寬、平台或敵人。
- 第7至10關新增窿時，沿用 #78 `drawTerrainFeatures()` 的深色窿、兩側邊線及在窿口中斷嘅地面頂邊亮線；以 #78 合併後版本為基線。
## 4. 下一步次序
1. **大陸1優先**：Alan 已確認第5關 Boss 要兩個以上可到達安全位、足夠預警及閃動落點影，Boss 左右橫飛的小刀要更大更易見但不加大判定。大合照完整顯示後停留5秒並可跳過；#93／#94 尚有 QA 阻塞，保持 draft。
2. **大陸2第1關**：開場對白 draft #90；人類保安及洗地機 Boss 方案／美術批次 draft #89，已確認造型可交 Cursor；戰鬥數值及其他故事建議先等 Alan 確認。
3. **成長點數及大陸2其餘關卡**：成長系統獨立 PR，開局配點數與其餘未定細節先確認；第7關實作 draft #88 QA 未完成；第8–10關缺 brief，第10關完成時接 `markC2Cleared()`。
## 5. 主選單兩階段（Alan 已確認）
- PR1：[#80](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/80) 已按 Alan 指示合併；第10關完成旗標尚未接線，未真機或完整通關。
- PR2：方案 [#81](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/81) 及實作 [#82](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/82) 已合併（#82 `1f29d26`）。⚪ 只用於兩個大陸第一關開新局，✅ 順序延續，🚫 直接揀其他關及重玩舊關不帶；支線裝備、金幣與 HP 用記憶體隔離。**請只開一個分頁**：兩個分頁同時寫入仍可能互相覆蓋；未真機及完整通關。成長點數另開 PR。細節見 `docs/bible/menu-save-decisions.md`。
- 大陸2第2關（內部第7關）A–E brief 原文及問題清單在 [#83](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/83)，已合併（`c6654ef`）；Alan 已確認 Claude 答覆第3–9項同噗噗離隊旗標方案。細節見 `docs/bible/c2-stage2-answers.md`。
- 噗噗第7關 D 段只反應，擊敗 Boss 後離隊；旗標跟主線本局，支線事件不寫存檔。**返隊時間待 Alan 日後決定，第7關不實作返隊**。噗噗台詞、馴獸師 Boss 卡和離隊提示文字均待 Alan 拍板，不可自行補寫。

## 6. 大陸2結局圖

- Cursor 素材 [#85](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/85) 已合併；包含結局十圖、人物與底圖、trailer 和 logo 草稿。Alan 已同 Cursor 確認圖片，唔再等佢揀；不重畫結局十圖，凍結 Cursor branch 並維持一人一 branch。
- 獨立 QA [#86](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/86) 只含測試證據，沒有重複 #85 素材。以 #83 merge `c6654ef` 加 #85 head `ccbc100` 在 detached worktree 合併預覽，無衝突；build、9 項資料驗證以及 Playwright 桌面鍵盤／模擬手機 touch 逐張重溫 1–10 通過。測試透過 localStorage 直接解鎖，並非真人完整通關或真機測試；第10關完成時仍要接 `markC2Cleared()` 自動解鎖。證據在 `docs/qa-ending-c2/preview-qa/`。
- 預告片 #87 按 Alan 指示暫停製作，不因結局圖 QA 通過而視為獲接納。
