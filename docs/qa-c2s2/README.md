# 第7關 QA 交接（2026-11-04，draft）

基底 main `077af8b14b34b3e26d776e36705772fdd691639b`。應優先處理大陸1 Boss／結局問題，因此 Alan／協調方要求停止新增及重跑耗時測試。以下只報目前結果；**不視為可合併驗收**。本資料夾包含原始 JSON、截圖及失敗日誌，保留可重現測試腳本 `scripts/qa/c2s2-*.mjs`。

## 已完成

- `npm run build`（tsc + Vite）成功，見 `build.txt`；Vite 提示既有大 chunk 警告。
- `npm run validate:data` 通過既有 9 項驗證，見 `validate-data.txt`；現有 validator **沒有涵蓋**新 `stage7.json` 或 Boss 實戰邏輯。
- 桌面 Playwright 透過正常主選單、預先放入「第6關已過」測試存檔進入第7關；1P 和 2P 都有實際鍵盤操作，非真人。2P 未傳送、未改血、未硬設勝利。
- 局部程式注入走查：`injected-A.png` 至 `injected-E.png`、`injected-boss-p1.png`、`injected-boss-p2.png`、`injected-boss-net.png`。畫面由程式直接設位置／無敵／血量／Boss phase 並跳過小遊戲，**不是完整通關**。2P 固定布景 20 個 display objects 前後位置、數量一致，沒有 physics body；D 段同一場景反應一次；P1 觀察到兩次召喚且同時存活不超過 2。詳見 `injected-inspection.json`。

## 未通過／未驗證

- **1P ≥600 秒第7關連續操作未通過**：`soak-1p.json` 在約 267 秒後已離開第7關，後續進入第5關；最後約 411 秒按指示終止，不能用總耗時聲稱 600 秒第7關。記錄到第7關 P3，沒有 pageerror／console error；這並非真人測試。
- **2P bot 全關未判定通過**：`2p-bot.json` 記 `passed:false`、180 秒到時；最終 `win:true` 和 `2p-bot-final.png` 顯示剛到結算畫面，但腳本未在期限內完成自動 pass 判定／驗證清關存檔，不能單靠 ended/win 冒稱完整驗收。可見曾續關、P1–P3；0 pageerror／console error。這不是真人遊玩。
- **局部注入檢查整體失敗**：`injected-inspection.json` 是 `passed:false`。鏈網計時斷言拾到自然攻擊和測試手動攻擊重疊事件，結果無法配對；`injected-inspection-console.txt` 留下事件原始時間。不能聲稱 0.8 秒預警、1.5 秒持續或安全躲避已驗證。要隔離事件 ID／攻擊並重新測試。Boss P3 注入截圖未取得。
- **離隊旗標**：程式有主線結算同一 `saveClear` snapshot、支線不寫、舊檔預設 false 和新局 reset 的實作，但目前注入測試在此之前失敗；舊檔遷移、重載、支線不寫、一次性及 2P 實際存檔均**未驗證**。需要測一次性、失敗重試及重玩。
- 手機 touch、真機、真人完整通關、1P 靜態物前後比對、兩個坑敵人 pit-hop、桌面完整可躲 hazard 均未驗證。成長點只保留空 hook；支線不發點、返隊不實作。第10關 `markC2Cleared()` 仍未接。

## 可重跑但本次未重跑

修正 `scripts/qa/c2s2-inspect.mjs` 的鏈網事件配對（例如為每次攻擊記 ID，或等待上一攻擊完全結束），再檢查安全站位、P3、離隊旗標與存檔。1P 長測應確保整段都在第7關正常操作或明確描述允許的正常重試流程；2P bot 等完整結算並斷言存檔再設 pass。以上須待大陸1優先問題處理後另行安排。
