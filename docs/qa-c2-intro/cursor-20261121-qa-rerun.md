# Cursor 2026-11-21 #90 開場 QA 重測

- Branch：`cursor/c2-intro-from-90-2610`（rebase 後）。
- 伺服器：Vite DEV `127.0.0.1:47338`（sequential 要 `/src/game/run.ts`）；測完已關。
- `node scripts/qa/c2-intro.mjs`：**四情境全 PASS**（desktop/mobile × direct/sequential），`INTRO_QA:0`。
- 十句開場逐字＋speaker；存檔／C2 flag 不變；sequential 注入非完整通關。
- 證據：更新 `results.json`、`qa.log`、截圖。無 merge。
