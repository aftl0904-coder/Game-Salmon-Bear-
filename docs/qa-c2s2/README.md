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

## 2026-11-04 跟進 checkpoint（仍為 draft）

上面原始失敗及證據保留；以下是**新一輪**，不把注入走查當正常全關。新美術 #91 的動畫切格、FX 和場景接縫已由另一組報告有問題，**未獲品質確認，不匯入、不複製**；本分支繼續用現有佔位。

- **2P 正常入口鍵盤 bot：通過本次自動全關與存檔斷言**。以第6關已過測試存檔從主選單進第7關，沒有傳送、改血或強設勝利；約 178 秒完成，期間有正常續關。最終 Boss `defeat` → 一次 `departure` → 結算；同場 D 段反應一次。主線保存為 `lastCleared=7`、`nextStage=8`、`puffLeft=true`；觀察到的相關 run 快照沒有旗標與過關狀態分開的寫入。`2p-bot-current.json`、`2p-bot-current-final.png`。這是 bot，不是真人。
- **手機 touch 短測：通過**。模擬手機使用 touch 從正常入口進第7關，實測右移、跳及攻擊；1P 固定布景測試則在注入座標及停用敵人後，以 touch 移動對比，20 個無 body 的固定物座標、數量不變。`mobile-current.json` 與 `mobile-current-*.png`。不是實體手機或手機全關。
- **坑：局部通過**。桌面與模擬手機、注入位置及隔離其他敵人後，兩個 C 段坑均觀察到產品化蜜僵正常追逐跳過，以及玩家透過鍵盤／touch 行入坑後重生。`pit-desktop-current.json`、`pit-mobile-current.json` 及相應截圖；不是自然全關覆蓋。
- **2P 固定物**：注入位置走查 20 個無 body 的固定物，前後數量和座標相同；`injected-inspection-current.json` 及原始 `injected-inspection.json`。這不是正常行完全關的完整靜態物追蹤。
- **鏈網嚴格計時仍有失敗，不可報為穩定通過**。測試先停自然 Boss／敵人並等舊定時器排空，獨立配對一次 warning、active、end。並行負載下第一次 P2 約 850／1666 ms（原測容差為 790–900／1490–1600 ms）；第二次 P2 約 867／1600 ms，而 P3 約 817／1633 ms，P3 超出容差。記錄 `injected-inspection-under-load-failure.{json,txt}`、`injected-inspection-p3-load-failure.{json,txt}`。第二次另見網內角色由 6 扣至 5、網外角色保持 6；這是注入站位，不代表所有情況均已驗證。`current-injected-boss-p3.png` 為注入 HP 截圖。CPU／Phaser frame scheduling 可能影響測量，但未釐清，不能把設定值直接等同實測通過。
- **build／資料驗證**：`npm run build` 通過（Vite 既有 config／大 chunk 警告），見 `build-current.txt`；新增 `scripts/validate/stage7.mjs` 並接入 `validate:data`，現在 10 項包括第7關配置和 Boss 卡佔位；屬資料檢查，不能代替 runtime 驗證。
- **1P 600 秒：通過本次前段穩定性測試**。新腳本以鍵盤在第7關前段來回操作，累計 600 秒第7關有效操作、wall 601 秒，結束仍在第7關、未通關；0 pageerror／console error。只計有觀測到的第7關運作時間，離關或勝利即停止，不計其他關。`soak-1p-current.json`、`soak-1p-current-final.png`；`soak-1p-checkpoint.json` 保留中途 461 秒快照。這不是全關、真人或真機測試。
- **旗標短測整體失敗**：注入主線時，兩次觸發只產生一次離隊，結算將旗標與第7關完成以單一 run 寫入，重載後旗標仍為 true；但隨後嘗試注入支線場景時出現 `Cannot read properties of null (reading 'resolution')` pageerror 及 30 秒 timeout。測試 setup 與產品 bug 的成因未判定，不能掩蓋；支線場景、舊檔遷移及新局 reset **未驗證**。`injected-inspection-current.json`、`injected-inspection-side-start-failure.{json,txt}` 保留錯誤。正常 2P bot 有正常續關後通關，惟不代表所有失敗重試及重玩分支均已覆蓋。
- 最後一輪 P2 為約 933／1483 ms，嚴格斷言失敗；P3 該輪約 817／1500 ms 雖通過單次斷言，較早 P3 約 817／1633 ms 失敗仍保留，故整體仍不穩。`injected-inspection-current.json`。第6關共用 Boss 模板獨立回歸、實體手機、真人通關仍未驗證；第10關 `markC2Cleared()` 仍未接。任何失敗維持 PR draft。
