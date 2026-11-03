# 大陸2第一關開場 QA

基線：main `077af8b14b34b3e26d776e36705772fdd691639b`；測試為本分支的本地 Vite 開發伺服器，2026-11-04（香港時間）。

## 執行結果

- `npm ci`：完成；`npm run build`（`tsc && vite build`）：成功，Vite 有 bundle 大小及 dynamic import 提示，見 `build.log`。
- `npm run validate:data`：9 項資料驗證通過，見 `validate-data.log`。
- `node scripts/qa/c2-intro.mjs`：四個情境成功，無收集到 pageerror／console error；逐項結果見 `results.json` 及 `qa.log`。桌面使用 Chromium 鍵盤；手機使用 Playwright Pixel 7 landscape 模擬及純 touch，並非真機。
- **直接入口**：全新瀏覽器從封面、難度選擇、主選單選大陸2、地圖走入內部第6關；逐句檢查十句完整文字及角色名稱，桌面以 F、手機以 touch 推進，最後進入可操作的第6關。截圖 `*-direct-picnic.png`、`*-direct-mall-door.png`、`*-direct-last-line.png`、`*-direct-gameplay.png`。
- **順序銜接（注入式）**：程式建立大陸1本局，直接寫入第1–4關完成狀態並在第5關呼叫 `playOutro()` 勝利捷徑；觀察原有第5關結局第一句後跳過，從過關卡進片尾，使用片尾的大陸2入口經地圖到第6關，再用桌面 Escape／手機 touch 跳過新開場。截圖 `*-sequential-*.png`。**這不是第1–5關完整通關，也不是完整觀看大陸1結局。**
- 四個情境均比較第6關開場前後的 `sake-kuma-run-v1` 與 `sake-kuma-c2-cleared-v1`，在測試過程中保持不變；順序情境有檢查第5關結算保存 `lastCleared=5`、`nextStage=6`。不代表已全面驗證所有存檔／跨分頁情況。

## 未驗證與備註

未做真人或真機測試；未完整遊玩第1–6關、完整檢查第5關所有結局分支、全部存檔遷移、重玩／支線、雙人或中斷重載。第7關、保安造型及清潔機器人 Boss 不在本測試或改動範圍。舊第6關純文字標題卡被新開場取代，入口地圖／第5關結局、片尾接駁與存檔程式未改。野餐圖及商場門面僅重用已有素材，沒有生成或聲稱批准新畫面。
