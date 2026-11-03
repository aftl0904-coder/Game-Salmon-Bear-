# 大陸2結局重溫：獨立合併預覽 QA（2026-11-03）

## 範圍同版本

- Cursor 素材 [draft PR #85](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/85)：`cursor/ending-c2-art-2610`、head `ccbc100c6e3fdd07ffbc61eae8adee46de2167c4`；Cursor branch 並無改動。
- 本 QA branch 由 main 的 #83 merge `c6654efd8420d36adc8034da340a598495028934` 開出，不包含 Cursor 遊戲素材；遊戲測試在另外的 detached merge-preview worktree 執行。共同祖先為 `1f29d26d8c7bcbdf502c8bc4901e2c776f79553e`。
- `git merge --no-commit --no-ff` 預覽 #85 自動合併成功，無衝突、無提交；merge tree `56187f8e755fc05fe9d13e8dadafeb8e2c7a6af2`。Cursor 相對 merge base 涉及 53 個檔案（十個公開結局圖、十個原圖、JSON、設計參考、trailer 同 logo 等）；全清單及完整文字 diff 見 [`merge-diff.txt`](merge-diff.txt)。直接樹比較包含 main 新增的 #83 內容；當中 D 是比較舊 Cursor 樹，並非實際合併會刪除 #83 檔案。
- 本 QA 放 `preview-qa/` 子目錄，以免與 Cursor 既有 `docs/qa-ending-c2/README.md` 及圖片撞檔；未把測試產物提交到 Cursor branch。

## 結果與證據

| 檢查 | 結果 | 證據 |
|---|---|---|
| `npm run build` | PASS，exit 0；存在 Vite config、dynamic import、chunk size 警告 | [`build.txt`](build.txt) |
| `npm run validate:data` | PASS，9 項 validator、exit 0；該命令並非 ending JSON／圖片內容驗證 | [`validate-data.txt`](validate-data.txt) |
| 桌面 Chromium 1280×720 鍵盤 | 實際由選單按 R 進入，再按右鍵由 1 至 10；每圖 scene key、顯示、title／counter 正確、HTTP 200；完成後返回選單 | [`playwright.log`](playwright.log)、[十圖總覽](contact-desktop-keyboard.jpg)、[`screenshots/`](screenshots/) |
| 模擬 Android 橫向 844×390 touch | 觸控選單結局按鈕及「下一張」，1 至 10 次序正確，其他檢查同上；完成後返回選單 | [`playwright.log`](playwright.log)、[十圖總覽](contact-mobile-touch.jpg)、[`screenshots/`](screenshots/) |
| 截圖圖像匹配 | 從兩組共 20 張實際 canvas 截圖的畫面裁取結局圖片，對全部 10 個候選原 PNG 以 80×45 RGB mean-squared error 排序，每張最接近預期圖 | [`render-match.txt`](render-match.txt)、[`verify-render.py`](verify-render.py) |

截圖是執行時 Phaser 畫布，不是直接拼貼素材；contact sheet 由這 20 張獨立截圖縮放排列而成，檔案校驗值見 [`screenshot-sha256.txt`](screenshot-sha256.txt)。Playwright 記錄無 pageerror／requestfailed；十個圖片請求每個狀態 200。Playwright 1.49.0，headless Chromium 156.0.8078.47，Node v22.23.4；手機以 `isMobile`、`hasTouch` 同 Android user agent 模擬，唔係實體電話。

## 必須留意的限制

- **測試在全新獨立 browser context 直接寫入 `localStorage['sake-kuma-c2-cleared-v1']='1'` 才可進入重溫，不是通關；未有真人完整走第10關，亦未真機。** 現有 `markC2Cleared()` 未見第10關呼叫接線，因此未證明完成關卡後自動解鎖；未測跨瀏覽器、實機效能、後退鍵及完整存檔流程。
- 圖像載入及順序通過不代表美術或故事被批准。#1–#4 和 #5–#10 的畫風觀感有差異，請 Alan 審閱。Cursor 自己的 README 記錄 #7「其他小朋友」名單與 #8「親人」為暫時假設；#2 宣佈者未指定，以背面剪影處理。Logo 顏色亦是暫定、基於描述重建；trailer 圖未接遊戲。
- QA branch 只載證據與狀態，不載 #85 素材。除非把特定 Cursor head 合併作預覽，單獨在此 QA branch 運行遊戲不會顯示該十圖。任何一方 head 或 main 改動後須重測；無自動合併任何 PR。

## 重跑（以授權的乾淨 clone 為例）

需 Node/npm、Chromium、Playwright（經 merge-preview 的 `npm ci` 安裝），像素比對另需 Python Pillow。以下只建立新 detached worktree，不會改 Cursor branch；請按環境調整路徑及空閒 port。QA 腳本會覆寫其所在的 log 和 screenshots，請先備份需要保留的證據。

```sh
git fetch origin main cursor/ending-c2-art-2610
git worktree add --detach /tmp/salmon-ending-preview c6654efd8420d36adc8034da340a598495028934
cd /tmp/salmon-ending-preview
git merge --no-commit --no-ff ccbc100c6e3fdd07ffbc61eae8adee46de2167c4
npm ci --no-audit --no-fund
npm run build
npm run validate:data
./node_modules/.bin/vite preview --host 127.0.0.1 --port 18473 --strictPort
# 另一終端，於 QA worktree：
PREVIEW_DIR=/tmp/salmon-ending-preview QA_URL=http://127.0.0.1:18473/ node docs/qa-ending-c2/preview-qa/ending-replay.mjs
PREVIEW_DIR=/tmp/salmon-ending-preview python3 docs/qa-ending-c2/preview-qa/verify-render.py
```

Playwright 只寫測試 context 的解鎖旗標，之後由原生鍵盤／touch 操作正常 UI；`__SAKE_GAME__` 只讀取場景、文字及 texture 狀態，沒有直接跳場景、改索引或替換素材。測完請停止自己啟動的 preview server。
