# STATUS（#78 已合併）更新 QA

基於 main `eb91ae382229b7f08a9d6b84dcb30fc0b243775f`。更新 `docs/STATUS.md`，沒有改遊戲程式或資料。`build.txt` 記錄 `npm run build`（TypeScript 和 Vite）；`mobile.txt`／`desktop.txt` 與對應 JSON、截圖記錄重用 `scripts/qa/two-player-landing.mjs` 的第1關自動回歸：模擬手機 P1 純 touch，桌面 P1／P2 鍵盤。

場景與起點由測試設定；沒有真機、完整通關或手機 P2 操作。這個文件更新不替代 #78 的六關 QA，該紀錄保留於 `docs/qa-pit-visibility/`。

重跑：先啟動 `npm run dev -- --host 127.0.0.1 --port 47319 --strictPort`，再執行：

```sh
npm run build
QA_BASE_URL=http://127.0.0.1:47319/ QA_OUT=docs/qa-status-pr78 QA_MODE=mobile QA_STAGE=1 node scripts/qa/two-player-landing.mjs
QA_BASE_URL=http://127.0.0.1:47319/ QA_OUT=docs/qa-status-pr78 QA_MODE=desktop QA_STAGE=1 node scripts/qa/two-player-landing.mjs
```
