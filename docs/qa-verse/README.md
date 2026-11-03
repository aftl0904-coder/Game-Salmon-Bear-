# 經文斷行 QA（2026-11-03）

## 測試版本

#72 已由最新 `main` `0014e63352a56e1b54bc1ec36a397b96aedca75d` rebase；`build.txt`／`data-test.txt` 中 `c383780` 係 rebase 後、提交 QA 紀錄前嘅執行版本。只改經文斷行同測試，保留 #68 大陸2地圖流程。

#68 已以大陸2地圖取代原第6關黑卡／`showContinent2Card`。現在第6至10關在地圖 `showVerse()` 顯示按標點斷行嘅經文；對未被地圖識別的關卡，後備 `showTitleCard()` 亦使用相同規則，保留 `stageTitle()`。

## 驗證

- `npm run build`：TypeScript + Vite 通過；Vite 有既有 warning。
- `npm run validate:data`：9 項資料驗證通過。
- `node --experimental-strip-types scripts/qa/verse-wrap.mjs`：第1–10段原文、標點不流失，只在指定標點換行；亦測「站立得穩」、長無標點片語及連續標點。
- `scripts/qa/verse-visual.mjs`：Playwright 模擬 Pixel 7、iPhone 13 橫屏**純 touch**及桌面鍵盤；三者均檢查 C1 第3／2關、大陸2第6–10關經文完整原文和引用、標點斷行、畫面邊界、由第5關到第6關碼頭並繼續入關、選關由8轉7、暗圖和通關綠圖。角色起點／關卡以程式設定。
- 測試以**只存在於測試瀏覽器記憶體**嘅虛構第11關經文驗證未知關卡後備卡，沒有改正式 `data/verses.json`；截圖 `mobile-fallback11.png` 不是正式故事內容。

記錄：`text-test.txt`、`build.txt`、`data-test.txt`、`mobile.json`／`.txt`、`iphone.json`／`.txt`、`desktop.json`／`.txt`。截圖包括 `mobile-map-stage3.png`、`mobile-c2-stage6.png`、`mobile-c2-stage9.png`、`mobile-fallback11.png`、`iphone-c2-stage6.png`、`desktop-map-stage3.png`、`desktop-c2-stage6.png`。舊版第6關黑卡截圖已移除，避免誤認現況。

## 重跑及限制

```sh
npm run dev -- --host 127.0.0.1 --port 47315 --strictPort
# 另一個終端
npm run build && npm run validate:data
node --experimental-strip-types scripts/qa/verse-wrap.mjs
QA_MODE=mobile QA_PROFILE='Pixel 7 landscape' node scripts/qa/verse-visual.mjs
QA_MODE=mobile QA_PROFILE='iPhone 13 landscape' node scripts/qa/verse-visual.mjs
QA_MODE=desktop node scripts/qa/verse-visual.mjs
```

截圖係瀏覽器模擬，未測真機、完整關卡、所有路線動畫、9→10 升降機或由頭遊玩。第10關完成旗標接駁不屬本 PR。遇到超長無標點經文會保留完整詞句並縮小字體，未驗證所有未來資料的可讀性。沒有修改 Cursor branch。
