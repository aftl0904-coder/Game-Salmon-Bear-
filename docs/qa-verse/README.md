# 經文斷行 QA（2026-11-03）

## 檢查

- `build.txt`：`npm run build`（TypeScript + Vite）通過。
- `text-test.txt`：`node --experimental-strip-types scripts/qa/verse-wrap.mjs` 檢查第1–10段經文，原文及標點無流失，換行只發生在標點；亦檢查「站立得穩」完整、無標點的長片語及連續／開首標點。
- `mobile.json`／`desktop.json`、對應 `.txt` 和 `.png`：Playwright Pixel 7 橫屏 touch 及桌面鍵盤；以程式設定進入世界地圖選第3／2關，並進入第6關黑底經文卡，驗證文字、邊界及按鍵／輕觸繼續。圖片是模擬畫面，不是真機。

## 限制

未用實體手機或電腦；未完整遊玩關卡。#68 的大陸2新地圖尚未合併，本分支基於 `main`、未測與 #68 合併後畫面；兩個 PR 都修改 `WorldMapScene.ts`，整合時需再檢查衝突和經文顯示。沒有修改 Cursor branch。
