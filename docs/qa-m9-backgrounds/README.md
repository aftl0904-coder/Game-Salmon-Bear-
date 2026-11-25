# M9 背景素材 QA

本工作按 `docs/bible/m9-background-decisions.md` 次序逐段交圖；完成狀態以 `docs/STATUS.md` 為準。`s9-*`、`s10-*` 及其他個別目錄各記錄該段圖片規格、build、資料檢查、桌面及模擬手機測試截圖／log。

背景生成後以 `normalize.py` 依第8關方法處理：原圖 16:9、等比例最近鄰縮小至 640×360、不裁切，最多 64 色、不加 dithering，輸出不透明 RGB PNG。原圖由圖像模型生成，並非原生 640×360 繪製；各段 `image.json` 保留原圖尺寸及 SHA-256。原始大圖屬工作暫存，repo 以對應 `public/art/` 最終 PNG 為準。

`preview.cjs` 沿用 M8 素材 QA 腳本，僅測 standalone 圖片載入，桌面用滑鼠、Chromium 模擬手機只用 touch；**不是遊戲畫面、真機或真人驗收**。場景實際圖層、鏡頭、主角與地面對比、區段切換及第4關機關位置都未在遊戲內驗證。沒有修改 TypeScript；不 merge 或 close PR。
