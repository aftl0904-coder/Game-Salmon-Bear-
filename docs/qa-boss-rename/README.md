# Boss 文字改名 QA

基於 main `1f29d26`。本 PR 只改顯示文字、資料、文件及 QA；不改戰鬥、數值、程式 ID 或任何美術圖片。

## 改動位置

- `data/bosses.json`：`mudmane` 名稱及稱號；`triboss` 名稱與職位資料 `role`，原稱號「派嘢嗰個」不變。Boss 卡仍顯示名稱及稱號；`role` 是資料欄位，未額外顯示在卡上。
- `src/game/GameScene.ts`：Boss 血條名、泥怪醒返提示及原有註解；`src/game/cutscene.ts`：Trinity 對白顯示名稱；`src/game/CreditsScene.ts`：片尾名單；`src/game/audio.ts`、`src/game/enemies/Stage1Boss.ts`、`Stage4Enemies.ts`、`Stage5Enemies.ts`：僅註解。
- `data/levels/stage4.json`、`data/levels/stage5.json`：僅段落註記；`STORY.md`、`docs/bible/game-design.md`、`docs/bible/stages-3-5.md`、`docs/bible/story.md`、`docs/STATUS.md`、`docs/audit-2026-11-01.md`：文字及狀態。
- `public/guide/index.html`：Boss 文字、圖片說明、Trinity 職位；原有圖片資料完全不變。
- `docs/cursor/ART-REQUEST-05-stage4-5.md`、`ART-REQUEST-18-kibobo-electric-fan.md`、`scripts/art/slice_mudmane.py`、`slice_triboss.py`：僅文字描述／註解；既有 `docs/qa-2026-11-01-sandbox.md`、`docs/qa-2p-landing/README.md`、`docs/qa-stage4/README.md` 亦更新專名。
- 本目錄及 `scripts/qa/boss-rename.mjs`：測試和證據，非遊戲機制。

## 保留不改、待 Claude／Alan 決定

- `data/story.json` C8、C11「大佬保險箱」兩句：是否指 Trinity，應否更名？C10「三角大人」是否保留作稱呼？
- `STORY.md` 第5關「地產老闆＝三角大佬」、`data/ending-c2.json`「大佬醒覺」及「大佬同框」、`src/game/GameScene.ts`「大佬醒返喇！」：是否指 Trinity／集團老闆？先保留原文，不自行改寫。
- 攻略內嵌 3 張歷史截圖有舊名，全部保留、請 Cursor 跟進：圖說分別是「倒下畫面：投幣續關／R 回選單（同場可見 Boss 血條）」（△畝大佬）、「Boss 泥怪（電單車隊長）；命中『重擊』；左邊壽司盒」（圖內泥鬃）、「Boss 登場」（對白框內△畝大佬）。改名後截圖會同 HTML 圖說暫時不一致。QA 截圖亦屬歷史證據，不修改像素。
- 抽查 `art-src/anim/boss/mudmane/model-sheet.png`、`triboss/model-sheet.png`、`art-src/ui/boss-card-bg.png`、`art-src/story/s4-boss-intro.png`、`c10-unmask.png`：未見舊名字；其他所有圖片未逐張核實。
- `mudmane`、`triboss`、`△畝發展`、`三角組織` 不變。

## 驗證

- `npm run build`：通過（含 `tsc`、Vite；原有 Vite 警告見 `build.txt`）。
- `npm run validate:data`：9 項通過，見 `data.txt`。另用 JSON 比較確認 Boss 其他欄位不變，原 `data/story.json` 同攻略所有內嵌圖片 bytes 不變。
- 先 `npm run dev -- --host 127.0.0.1 --port 47324 --strictPort`；分別 `QA_MODE=mobile node scripts/qa/boss-rename.mjs` 及 `QA_MODE=desktop node scripts/qa/boss-rename.mjs`。模擬 Pixel 7 橫屏純 touch／桌面鍵盤：在 logo 場景直接調用實際 Boss 卡，驗證兩個名稱、稱號、跳過輸入、血條名稱函式及攻略 HTML；截圖及 JSON／log 同目錄。
- 未驗證實體手機／電腦、完整遊玩或實戰；此測試直接顯示 Boss 卡，不代表已進入 Boss 戰。攻略截圖內舊名仍在。
