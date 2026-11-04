# ART-20 背景第二輪回修複驗（2026-11-04）

## 結果

只讀驗證 #91 頭 `4dab1f198e2342201d54acdccf6bd0d518be92f6`，基底 main `077af8b14b34b3e26d776e36705772fdd691639b`；相對 `9c8d58c` 的回修只有兩張 `art-src/props/stage7/` 圖、素材 manifest 和 Cursor 回修報告，沒有改遊戲程式。本次沒有修改 Cursor branch、合併或部署。

**背景回修的原圖局部驗收通過：**訓練場掛繩圈已換成掛鉤，符合 Alan 已確認方向；兩張圖連續並排三次及各接縫放大目視，沒有見到上輪明顯的重影或硬切，牌面未見可辨文字。這是所檢查兩圖的局部視覺結果，不代表全部美術、版權或遊戲完成。

三次平鋪證據：[走廊](corridor-mid-repeat-3x.png)／[訓練場](training-mid-repeat-3x.png)。

| 圖 | 原圖尺寸 | 邊界相鄰色差 MAE | 圖內相鄰列平均 MAE | 接縫圖 |
|---|---:|---:|---:|---|
| `corridor-mid.png` | 1119×720 | 1.883 | 3.055 | [走廊接縫](corridor-mid-join-focus.png) |
| `training-mid.png` | 635×720 | 2.042 | 3.767 | [訓練場接縫](training-mid-join-focus.png) |

數字按 RGB 0–255 每通道平均差計算，僅作輔助，不能單憑平均數判定所有畫面均無縫；完整資料見 [metrics.json](metrics.json)。上一版的重影證據留在 [9c8d 複驗](../recheck-9c8d58c/README.md)，不應被覆寫。

## 可行性試驗，不是遊戲整合

兩張原圖高 720、寬 1119／635，不能把舊圖寬度 1080 當新平鋪週期；`#88` 的 `BootScene.ts`／`GameScene.ts` 目前未載入或使用這兩張背景。接線時須按實際寬度、世界段落與鏡頭定位，另外驗段落切換、地形和角色遮擋。原圖色數分別為 19,271／31,348 RGB 色，需按照項目像素規格處理，不能原封不動當成已通過的 runtime 交付。

本次在隔離目錄用 nearest-neighbour 等比近似縮至 **560×360／318×360**（奇數寬度四捨五入）並各自量化至 64 色、不加 dithering；縮圖後接縫平均差分別為 1.906／1.916，圖內相鄰列平均差 4.875／5.585。完整見 [normalized-metrics.json](normalized-metrics.json)。這兩個輸出尺寸只作測試，未定為正式尺寸，也沒有改寫原圖或遊戲檔案。

用獨立 Phaser tileSprite 在桌面 1280×720 與模擬手機橫屏 844×390 分別顯示兩圖，接縫置於中央，並額外平移 37 像素；四個預覽均有 canvas，沒有觀察到 pageerror、console error 或 HTTP 錯誤。證據：[桌面走廊](preview-desktop-corridor-mid.png)、[桌面訓練場](preview-desktop-training-mid.png)、[模擬手機走廊](preview-mobile-corridor-mid.png)、[模擬手機訓練場](preview-mobile-training-mid.png)、[browser JSON](preview-browser-report.json)。這不是實際遊戲場景，不含真機、觸控玩法、前景、物理、相機滾動、segment 交界及 1P／2P 全關驗收。

隔離快照 `npm run build`（含 tsc／Vite）及 `npm run validate:data` 9 項均通過；分別見 [build.log](build.log)、[validate-data.log](validate-data.log)。測試只證明既有程式可建置、資料格式通過，不代表新圖已被載入遊戲。與上輪相同的角色／FX 圖在本次四檔 diff 中沒有改動；原切圖器的半透明／超色及角色實際步態仍待實際整合時處理。

## 重現

使用該 commit 的乾淨快照，`ART20_ROOT=/path/to/snapshot QA_OUT=/tmp/art20-recheck python3 inspect_stage7.py` 產生雙連接縫圖及量度；以同樣環境執行 `python3 normalize-preview.py` 作測試尺寸與色數衍生。Python 需 Pillow、NumPy。把 `preview.html`、`capture-preview.cjs` 複製到 `QA_OUT`，於該目錄建立 `node_modules` 指向已安裝 Phaser 及 Playwright 的目錄，再以 `QA_OUT=/tmp/art20-recheck PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node capture-preview.cjs` 執行；使用本機 Chromium，port 由 `QA_PORT` 指定，默認 18795。這些腳本只寫測試目錄。
