# PR2 方案文件 QA（2026-11-03）

基底 `main`：`ec6da2ebb07bff9528b07a752ea50bee9bc9d0d8`。本分支只更新設計／狀態文件及本 QA 紀錄，沒有實作 PR2、改遊戲程式或修改存檔。

- `npm run build`：TypeScript 及 Vite 通過，既有 Vite 設定及 bundle 大小警告見 `build.txt`。
- `npm run validate:data`：9 個現有資料驗證通過，見 `data.txt`。
- 第一關落台自動回歸：`scripts/qa/two-player-landing.mjs`；模擬 Pixel 7 橫屏 P1 純 touch、桌面 2P 鍵盤，均通過，見 `mobile.txt`、`desktop.txt`、JSON 和截圖。測試先注入關卡及人物位置，並隔離敵人；手機 P2 保持不動。
- 未真機、未完整通關；因 PR2 尚未實作，本測試**沒有**驗證 PR2 的攜帶、排名、存檔、跳關或遷移規則。

重跑：先用 `npm run dev -- --host 127.0.0.1 --port 47321 --strictPort` 啟動服務，然後分別設 `QA_MODE=mobile`／`desktop` 執行 `QA_BASE_URL=http://127.0.0.1:47321/ QA_OUT=docs/qa-menu-save-plan QA_STAGE=1 node scripts/qa/two-player-landing.mjs`。
