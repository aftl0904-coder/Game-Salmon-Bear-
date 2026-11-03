# Trailer 第一版 — 製作及 QA

## 成片與來源

- 成片：75 秒、1280×720、16:9、30 fps、H.264／AAC、約 7.9 MiB；只留 Alan 私人 Drive，不入 Git。編碼及時長以 `ffprobe.json` 為準，當次校驗雜湊在 `sha256.txt`。Alan 對內容不滿意，要求暫停，未獲接納的初版不應視作完成品。
- 分鏡及逐鏡時間：`docs/trailer/shot-list.md`。初版由 main `c6654efd8420d36adc8034da340a598495028934`（合併 #83）開分支錄製；清理 Git 大檔時將 #87 更新到 main `077af8b14b34b3e26d776e36705772fdd691639b`（合併 #86），沒有修改 Cursor branch。
- 野餐、食物、變灰、單車、商場與 Boss 原畫／圖集均取自本 repo，精確路徑見分鏡及 `prepare-plates.py`。食物局部係原野餐圖裁切，無新畫或 AI 圖片／影片。
- Gameplay 原錄影為 `docs/trailer/source/stage1.webm`、`stage6.webm`：由 Playwright 執行現有遊戲，透過注入選第1及第6關，然後鍵盤移動、跳躍／攻擊；不是由頭完整通關。錄影第1關取約 0.8–2.6 秒、第6關取約 1.8–4 秒，慢放並裁去上下 HUD 和右側戰鬥／店舖文字；第1關片段重用兩次。
- 商場實錄係**現有大陸2第1關／內部第6關**。展銷中心、籠舍、被困大熊及 Ken B、Leon 人類版剪影來自 Cursor `cursor/ending-c2-art-2610` 的 `ccbc100c6e3fdd07ffbc61eae8adee46de2167c4`：五張本地素材副本及原錄影均不入 Git。第7關未完成，相關鏡頭是原創概念圖而非遊戲實錄；Ken／Leon 只短閃剪影。商場保安總監仍以現有遊戲重用的 `triboss` 圖集作暗光半邊 placeholder，不代表最終造型。
- 結局碎片：唯讀來源 `cursor/ending-c2-art-2610` 的 `ccbc100c6e3fdd07ffbc61eae8adee46de2167c4`，`public/art/story/ending-c2-01.png` 原始 SHA-256 `3813bdb179263e197cabd32190c6fee85c7a5b59478947b8df066808b4c5529c`。只把原圖縮成 5×3 色格，擷取 2×2，再放大、重度模糊及變暗；結果 `docs/trailer/source/ending-abstract.png`，只在 60–60.6 秒小碎片顯示一次，無完整畫面或身份揭露。原圖不複製進本分支。
- 原有合成音樂／音效 `src/game/audio.ts`，由 Chromium Web Audio 實際錄成 `docs/trailer/source/game-audio.webm`；無外來音樂、AI 音樂或配音。`capture-audio.mjs` 紀錄歌曲切換及 `gulp`、`dread`、`jump`、六次 `boss` 音效安排。配樂按剪輯時間觸發，不是原 Gameplay 同步實況音軌。
- 歷史初版有四句 Alan 當時批准引用的 `data/story.json` C1 原文；現按新交接將 `docs/trailer/subtitles.json` 改為「待補」，**未改私人 Drive 初版成片**，所以現時 JSON 不再代表初版實際字幕；`render.py` 及 `check-media.py` 遇到待補會停止，舊 QA 紀錄不會冒認新字幕已驗證。遊戲所用 Fusion Pixel（`public/fonts/fusion-pixel-12-zh-hk.woff2`、SIL OFL 見 `public/fonts/OFL-fusion-pixel.txt`）曾轉 TTF，由 Pillow 繪製字幕層；不使用 Nintendo 字型／商標。初版片尾為 `Coming Christmas 2026`。

## 重跑命令

大型影片／音訊檔及 `docs/trailer/source/cursor/` 均受 `.gitignore` 排除。若日後 Alan 指示重做，須重新錄製遊戲素材及音軌；五張 Cursor 圖可由已確認的 #85 分支原始路徑補返本地目錄。以下只保留舊版重製方法，**而家不要重剪**。在 repo 根目錄，用 `npm ci` 準備依賴，再執行：

```bash
npm run build
npm run dev -- --host 127.0.0.1 --port 4777 --strictPort
# 另一個終端；錄音約 76 秒，兩段遊戲錄影各需實時操作等待
node docs/qa-trailer/capture-audio.mjs
node docs/qa-trailer/capture-game.mjs
node docs/qa-trailer/smoke.mjs
python3 docs/qa-trailer/render.py
bash docs/qa-trailer/final-qa.sh
python3 docs/qa-trailer/check-audio-sync.py
```

Python 需 Pillow、numpy、fonttools（含 woff2／brotli），系統需 Chromium、FFmpeg 及 ffprobe。`render.py` 把中間檔放 `/tmp/salmon-trailer-render/`；完整重跑無需沿用該目錄，實際一次輸出的 FFmpeg 命令見 `render-commands.txt`。錄音含遊戲隨機雜訊，重新錄製不保證位元相同；`sha256.txt` 固定記錄今次產物。

## 已做檢查

- `build.txt`：TypeScript `tsc` 及 Vite build 成功；Vite 提示原有 config native loader 與大型 bundle 警告，非 build 失敗。
- `smoke-results.json`、`smoke-log.txt`、`smoke-desktop.png`、`smoke-mobile.png`：桌面鍵盤及 Pixel 7 landscape 模擬裝置的 CDP touch，各從場景注入起步、真輸入向右移動且無 pageerror。兩者都非實體手機／電腦驗證，並非完整遊玩。
- `ffprobe.json`、`decode.txt`：全片影像及音訊可解碼；`audio-levels.txt`、`media-check.json`：AAC 音軌有聲，平均 −23.2 dB、峰值 −6.8 dB，包含逐秒 RMS；75 個逐秒抽樣中 44 個相鄰時段有畫面變化。錄音時間戳曾有細微缺口，最終使用 `aresample=async=1:first_pts=0` 補正後，音訊樣本覆蓋 75 秒。淡入淡出、轉歌與音效按 `capture-audio.mjs` 的時間表排列：假蜜 7 秒、恐懼 13 秒、跳躍約 26.7 秒、六次角色短閃約 29.2–39.2 秒、商場 41 秒、籠子 52 秒；影片按相同時間碼剪接。
- `audio-sync-check.txt`：把已按時間戳補正嘅錄音與成片七個時段做相關性比對，確認重新編碼沒有額外移位；此測試唔代表真人耳聽同步或混音。
- `frames/timeline-01.jpg` 至 `timeline-05.jpg` 每秒一格覆蓋全片；`frames/boss-01.jpg` 至 `boss-04.jpg` 每 0.2 秒抽格覆蓋 29–41 秒（Boss 表上時間為相對於 29 秒）；字幕、Ken／Leon、展銷、被困伏筆、結局碎片及片尾另有 PNG 抽幀。原始畫面曾以原尺寸核對，入庫存證圖已縮小至最多 640×360；縮小不代表重新製作影片。曾發現直接用 FFmpeg 寫字缺字，已更改字幕層並重新抽查；商場曾有右邊緣戰鬥字，已擴大裁切並重抽。

## 未驗證／限制

此 QA 採逐段抽幀及音訊數值／時間表檢查，**沒有真人以正常速度完整觀看和耳聽成片**；不能保證主觀節奏、混音、短促音效聽感及精確感知同步。第7關未完成，展銷中心及被困大熊僅為原創概念圖；保安總監專屬素材未有。沒有在實體手機測試、沒有完整通關、沒有發佈 YouTube 或其他公開平台。
