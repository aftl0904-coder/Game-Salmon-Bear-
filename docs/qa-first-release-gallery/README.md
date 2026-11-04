# 角色集 checkpoint QA（2026-11-04）

基線：重新 fetch 的 main `077af8b14b34b3e26d776e36705772fdd691639b`。此分支為未完成的 draft；不代表第一版完成。`build.log` 是最新 TypeScript + Vite build；`validate.log` 是 9 項既有資料驗證。Vite 的 chunk 大小及 `__dirname` 訊息是警告。

`browser.log`／`browser-tests.json` 由 `scripts/qa/first-release-gallery.mjs` 實際產生：桌面 Chromium 鍵盤、Pixel 7 landscape 模擬 touchscreen（非真機），由正常封面進入，檢查好／壞、前後、三個按鈕、待繪／待切格提示、返回封面及 localStorage 不變；再測攻略與遊戲入口。對應截圖在本目錄。測試不代表已逐格驗收所有舊素材、所有角色或完整通關；角色身份與候選見 Bible inventory。沒有真人遊戲手感或真機驗收。測試伺服器由腳本外命令暫啟並關閉。

美術 #91 原圖尚未通過切格 QA，角色集不導入；朋友及攤主不少動作只有原圖或缺圖。未完成角色動作、未合併角色及身份／順序疑問列在 `docs/bible/`。後續完成素材與名單後必須擴充全角色、逐個動作測試及復驗版面，不能因本次 smoke pass 宣稱第一版完成。

最後一次修改加入待核結局守護者、Boss 戰巡邏機並縮短底部提示後，以 `build-final.log`、`validate-final.log` 及 `scripts/qa/first-release-gallery-final.mjs`／`final-browser.log`／`final-tests.json` 記錄最後版本的短回歸。較早完整 `browser-tests.json`／`browser.log`、未帶 final 字樣的截圖在這兩名候選補列前完成，不能當作最終版的完整測試。`*-final-*.png` 對應最終版。
