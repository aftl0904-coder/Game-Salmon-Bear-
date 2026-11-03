# 主選單 PR1 QA（2026-11-03）

基底：`main` `eb91ae382229b7f08a9d6b84dcb30fc0b243775f`。本 PR 不實作本局存檔、裝備／成長選擇、排名資格，亦不改第5關結局流程；這些屬 PR2 或成長點數的獨立工作。

## 自動測試

- `npm run build`：TypeScript 與 Vite 通過；現有 Vite 設定／bundle 大小警告仍在（見 `build.txt`）。
- `npm run validate:data`：9 項現有資料驗證通過；`ending-c2.json` 不在現有 validator 清單，由下列測試檢查十幕內容及順序。
- `scripts/qa/menu-save-pr1.mjs`：模擬 Pixel 7、iPhone 13 橫屏純 touch，及桌面鍵盤（`mobile.txt`、`iphone.txt`、`desktop.txt` 與對應 JSON）。
- 封面→攻略→遊戲、C1 第1關既有抽籤路徑、`?c2=1` 開關與記憶（包括攻略往返）、`?c2=0` 隱藏 C2、C2 第1關入口至世界地圖。
- 結局未解鎖灰色且不可開啟；在隔離測試瀏覽器中**人工設定** `sake-kuma-c2-cleared-v1=1`，逐一驗證十幕描述佔位卡、前後翻頁、返回選單和存檔不變。此旗標不是遊戲真的完成第10關後寫入。
- 代表性手機及桌面截圖保留於本資料夾。測試沒有真機、沒有完整通關，亦沒有驗證日後 Cursor 加入的十張圖片。

## 重跑

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 47320 --strictPort
# 另一終端：
QA_MODE=mobile node scripts/qa/menu-save-pr1.mjs
QA_MODE=mobile QA_PROFILE='iPhone 13 landscape' node scripts/qa/menu-save-pr1.mjs
QA_MODE=desktop node scripts/qa/menu-save-pr1.mjs
```

其他限制：C2 第1關開始時仍沿用現有裝備／HP 初始化，沒有「帶／唔帶」選擇；舊存檔遷移、排名、跳關隔離、由大陸1第5關後前往大陸2等均未在 PR1 實作或驗證。
