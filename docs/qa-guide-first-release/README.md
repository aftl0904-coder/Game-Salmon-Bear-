# 第一版攻略 QA（2026-11-04）

## 範圍及來源

- 基底：重新 fetch 的 `main` `077af8b14b34b3e26d776e36705772fdd691639b`；只改 `public/guide/index.html`、`docs/STATUS.md` 及本 QA 目錄。
- 現況依 `data/levels/stage1.json`、`stage6.json`、`data/bosses.json`、`src/game/enemies/Stage1Boss.ts`、`Stage6Enemies.ts`、`stage6World.ts`、`run.ts` 等 main 內容；第7關目標依已合併 `docs/bible/c2-stage2-brief.md` 與 `c2-stage2-answers.md`。新洗地機／人類保安基本造型依 Alan 已確認、尚未合併的 #89；招式、數值、故事不當成已批准或已實裝。
- 第7關實作 #88 尚未合併；三項文字保留待補。Boss 更名 #84 尚未合併，攻略仍用 main 現名，須協調合併次序；原有 33 個 base64 截圖均未改，為歷史截圖，可能含舊名。#90 開場尚未合併，不當作現行遊戲。

## 自動驗證

- `npm run build`：TypeScript + Vite 通過，`build.txt` 保留既有 Vite native config、dynamic-import 與 chunk size 警告。
- `npm run validate:data`：9 項通過，見 `data.txt`。
- 使用 production build 的 Vite preview（`npm run preview -- --port 47360 --strictPort`），再分別執行：

```sh
QA_MODE=desktop node docs/qa-guide-first-release/guide-navigation.mjs
QA_MODE=mobile node docs/qa-guide-first-release/guide-navigation.mjs
```

- 桌面 1280×720 使用鍵盤；手機為 Playwright Pixel 7 landscape 模擬，用 touchscreen tap 開啟及返回，CDP touchStart／touchMove／touchEnd 真正滑動攻略，不用程式直接改 scrollY。從真實封面開攻略，檢查正文狀態及三項待補，記錄滾動至第6關、第7關、頁末「待續」，用底部及原有頂部連結返回封面，確認 `?c2=1` 測試閘保留。`desktop.json`、`mobile.json`、文字日誌及對應畫面截圖可重查；最終兩個測試均無 404、console error、pageerror 或 request failure。
- 首輪桌面及手機均發現攻略頁缺少 favicon 而產生 `http://127.0.0.1:47360/favicon.ico` console 404；原始 `*-initial-failure.json`／`.txt` 保留（當時 response listener 未捕捉到瀏覽器 favicon 請求，後續另查 console location 確認來源）。攻略加入內嵌 favicon，改進日誌記錄 URL，重建及重跑後通過，未刪改首次失敗結果。

## 未驗證／依賴

沒有真機、真人遊玩或整遊戲通關；測試是封面／攻略導航，沒有實戰第6關或第7關、Boss 招式、存檔遷移、排行或成長系統。第7關、洗地機、人類保安及三項文字仍依各自工作／Alan 決定；第10關完成旗標尚未接線，沒有聲稱大陸2結局可自然解鎖。

早前導航測試通過後曾補充第1關新局扭蛋及排行榜資格兩句文字，並重新 build 及 validate:data。其後再用最終 production build **串行重跑**桌面鍵盤及模擬手機純 touch 導航，兩項均通過，沒有 pageerror、console error、404 或 request failure；見 `desktop-final.txt`、`mobile-final.txt`、`desktop.json`、`mobile.json` 及最新截圖。補充前結果保留在 `desktop-pre-final.json`、`mobile-pre-final.json`。
