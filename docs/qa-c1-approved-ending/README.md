# 大陸1結局對白 QA（2026-11-04）

基線 `main`：`077af8b14b34b3e26d776e36705772fdd691639b`。本 branch 不改其他 branch，不含 #94 合照修正，也不聲稱合照已停留五秒。

## 結果

| 項目 | 結果 |
|---|---|
| `npm run build`（`tsc && vite build`） | 通過；Vite 有 native config loader、chunk size 等提示，見 `build.log` |
| `npm run validate:data` | 9 項通過，見 `validate-data.log` |
| JSON 遞迴比較 | 除 C11 一句、C11_PERFECT 七句及字卡副標外無變，見 `story-scope.log` |
| 桌面 Chromium 1280×720／鍵盤 F | C11 及 C11_PERFECT 各 7 句與字卡均通過 |
| 模擬手機 Chromium 844×390／純 touchscreen | C11 及 C11_PERFECT 各 7 句與字卡均通過 |
| 真機、真人完整通關 | 未驗證 |

測試以 Playwright 啟動遊戲並等待 Boot 完成，之後**注入獨立 Phaser 測試場景，直接呼叫 `playCutscene`**。每張圖均標示 `QA INJECTED ... NOT NATURAL PLAYTHROUGH`。這不是自然遊玩、過關、結局條件或選擇分支測試；沒有對 runtime 加測試入口。手機組的操作只使用 Playwright `touchscreen.tap`，桌面組只用鍵盤 F；讀取 Phaser 畫面文字／角色名、字卡及邊界，再逐句截圖。第二輪額外等待每句的 `▼` 標記，輸入後要求 1.2 秒內消失，早於該遊戲自動前進最少 2.2 秒的等待期，避免僅靠自動播放通過。四組共 28 句、4 張字卡及 28 次輸入回應；各組無 page error／console error。Playwright 只檢查文字物件邊界，並非完整字形／美術可讀性評審。

`results.json` 是第二輪結果；`attempt-1-results.json` 是首輪結果。`attempt-1.log`／`attempt-2.log` 是原始執行輸出，32 張圖以 `desktop|mobile`、場景、`line1`–`line7`／`card` 命名。由於首輪範圍檢查的 stderr 未被當時的 `tee` 擷取，`story-scope-attempt-1.log` 從原終端訊息逐字保存了語法錯誤；修正後結果在 `story-scope.log`。首次背景啟動沒有建立日誌或實際進程，已停止，見 `background-start-attempt.txt`。最後前景測試使用獨立本機 Vite，退出時已停止；未部署。

## 整合時

#94 及 #90 都改 `data/story.json` **及** `docs/STATUS.md`；#94 同改結局位置，#90 改其他故事位置。整合須檢查／解決潛在衝突，保留各自確認修改，重跑 build、資料驗證及結局、開場相關測試。此分支的結果不能代替合併後重測 #94 的五秒合照及 #90 開場。
