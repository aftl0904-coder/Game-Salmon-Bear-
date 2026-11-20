# Cursor 2026-11-21 focus-sameid 重測（#97 continuation）

- Branch：`cursor/c2-scrubber-from-97-2610`（rebase 後 tip）。
- 伺服器：`vite preview` `127.0.0.1:47431`；測完已關。
- 指令：`QA_LABEL=focus-sameid MODE=desktop|mobile node scripts/qa/c2-scrubber-focus.mjs`
- **結果：desktop exit 0、mobile exit 0**（`focus-sameid-exits.txt`）。
- 各 3 輪 dodge HP 6→6；warningId 同招一致；wall HP 6→6；counter boss 55→52 且 `hitInRecovery` true；outsideCount 0；無 pageerror。
- 證據：`focus-sameid-{desktop,mobile}.json`／`.log`／`*-wall-recover.png`（256 色；全色 raw 在本機 `/tmp/scrubber-sameid-raw/`）。
- **仍未驗證／不可當整關驗收：** 自然進場、整關通關、2P、真機／真人、低 FPS、#90／#99 合入後整合。先前 `focus-final` 手機 FAIL 歷史保留（同腳本舊跑；今次 sameid 兩模式 PASS，未另標 focus-final 覆蓋舊檔）。
- JSON `samples` 入庫已抽薄（全量在本機 `/tmp/scrubber-sameid-full-json/`）；結論以 `passed`／`frameChecks`／rounds 為準。
- 無 merge。

