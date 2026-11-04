# 第一版成長 checkpoint QA

本 PR **沒有接線至遊戲／存檔**。所有成長程式測試只測隔離純函數，不是玩家功能驗收。

- `core.log`：兩角色各5點、純配點及免費重配守恆、拒絕超額／負數／小數／未知軸和無效 wallet、S/A/B/C 及第3/5/7關門檻。`PREVIEW` 是數學估算，不是戰鬥自動平衡或手感試玩。
- `build.log`／`validate.log`／`exits.log`：最後一次 `npm run build`（含 tsc 及 Vite）和 `npm run validate:data` 結果；`*-baseline.log` 是修改前基線。
- `state-desktop.log`／`state.json` 和 `start-desktop.log`／`start-mobile.log`：既有 run／gear 回歸和模擬輸入測試，並非新成長功能測試。既有測試用隔離瀏覽器資料、部分直接注入存檔／場景，絕非完整通關；輸出及截圖如有失敗照樣保留。桌面使用鍵盤，手機模擬使用 touch。
- 成長 UI、開局分配、戰鬥效果、實際重配、成長死亡保留、carry／不帶、重複重開防刷、帶成長榜單、成長支線隔離與成長舊檔遷移：**未實作、未測**。真機、真人試玩及完整通關均未做。

測試腳本：`node scripts/qa/first-release-growth-core.mjs`；瀏覽器回歸沿用 `scripts/qa/menu-save-pr2-state.mjs`、`scripts/qa/menu-save-pr2-start.mjs`。日誌明確記錄 exit code；臨時 Vite 僅供自動測試，結束後關閉，不部署。
