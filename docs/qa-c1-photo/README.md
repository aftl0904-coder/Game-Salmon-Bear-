# 大陸1結尾大合照：5 秒停留 QA（2026-11-04）

## 範圍及確認方案

Alan 已確認：第一大陸完場的大合照完整顯示後停留 5 秒，玩家可提前跳過；不改故事台詞、不換圖。基線為重新 fetch 的 `main` `077af8b14b34b3e26d776e36705772fdd691639b`。本輪只調整 `data/story.json` 的 `C11` 與 `C11_PERFECT` 最後一張、現時兩個分支都真正使用的 `ending-3`，以及沿用的 `src/game/cutscene.ts`。`ending-3` 現有圖是主角、噗噗、女王蜂、鏡鴞和工頭同框；不應聲稱圖中有全部十一個朋友。`ending-picnic.png` 雖然存在，但此故事執行器沒有載入或使用它，今次不換成另一張圖。大陸2十張重溫圖是另一套 `ending-c2-01…10` 與獨立 `EndingC2Scene`，不改。

正常／完美分支由原有 `perfectEnding()` 選擇，不改判斷。`C11` 原有 Alan 待寫句及 `C11_PERFECT` 七句和字卡「待 Alan 填寫」原樣保留；不自行填寫或替換已確認的第一版文字。其餘故事所有步驟和文字同基線逐項比較一致。

## 原因與處理

目前資料格式並無 `pic` 指令：故事用 `still`。`still` 處理會先將舊圖淡出 350ms，再令新圖淡入 450ms；它本身不等待。`C11` 和 `C11_PERFECT` 的 `{still: 'ending-3'}` 下一步立即 `{still: null}`，所以新圖在淡入完成後即淡出；450 + 350ms 即約 0.8 秒，沒有 5 秒完整顯示。因為前一個 `say` 不會自動關閉對話框，原本它亦會遮著大合照下方。

新增的 `hideDialog` 和 `holdMs` 都是 `still` 的**可選**參數，僅在上述兩個 `ending-3` 事件啟用。顯示新圖前隱藏上一句對話框；淡入到 alpha=1 後才開始 5000ms；其後沿用原本 `still:null` 的獨立 350ms 淡出。右上角原有「跳過 ▶▶」仍可見並接收 touch；鍵盤 Enter／Escape 和原 Start 跳過仍沿用現有 cutscene 全段跳過，跳過後直接進入原有通關卡，不會被計時器再次觸發。普通點畫面、前進按鍵在原有對話期間照舊前進；提早結束用既有跳過功能，不新增故事文案。自然播放按原路徑繼續到結尾字卡 → 第5關通關卡 → 世界地圖 → 片尾。

既有 Phaser `TimerEvent` 採逐幀累積且低幀率有 delta cap，首輪三個 Chromium 並跑時完整透明度的 5 秒設定實測延長成 8249.7／6783ms（見 `preliminary-contention-*.txt`）。修正後，僅新圖片停留用 scene clock 及逐幀檢查截止時刻；其他 `wait`／淡入淡出和未指定參數的 still 邏輯不變。低幀率下可能有一個更新幀的量度誤差；跳過或 scene 清理會移除監聽及該過場的 still／root tween。

## 已記錄結果（不得把設定值當實測值）

- `npm run build`（含 tsc）及 `npm run validate:data` 9 項通過，見 `build.txt`、`validate-data.txt`；Vite 有既有 native config／chunk size 警告。
- 桌面實測：正常結局完整 alpha=1 停留 5116ms、完美結局 5183ms（以 scene clock 計；wall 分別 5115／5173ms）；兩支原有對話全部核對，兩者自然接原字卡、通關卡及片尾。兩支用 Escape 提前跳過分別 196／541ms 到通關卡。見 `desktop.txt` 和逐幀 JSON。桌面早期腳本未檢查跳過後原截止時間及片尾。
- **手機自然播放未通過時間容差**：`mobile-contended-failed.txt` 原始記錄顯示完整 alpha=1 實測 **5599.7ms**；其後一次串行重測 `mobile-serial.txt` 實測 **5366.4ms**，兩次均超過既定上限 5300ms，均不可報 PASS。設定是 5000ms，實際開始淡出須等待畫面更新及排程；受測環境未能證明手機播放符合 5300ms 驗收。
- 手機純 touch 完美分支提前跳過：225ms 到通關卡；超過原有 5 秒期限後通關卡仍存在，再以 touch 進入片尾；七句完美分支對白核對通過。手機自然正常分支對白、結尾字卡及通關卡均已觀察，但因時長斷言失敗，該案例沒有繼續驗證其自然路徑到片尾。其他手機分支組合未作本次最終串行測試。
- 大陸2十圖：桌面與模擬手機各十張均顯示對應素材、HTTP 200 並可返回選單，見 `c2-playwright.txt`；僅測試用 localStorage 直接解鎖，非真實通關。

## 重現

```sh
npm ci
npm run build
npm run validate:data
npm run dev -- --host 127.0.0.1 --port 18641 --strictPort
# 另開 terminal；桌面和手機分開跑以減少主機爭用
QA_MODE=desktop node docs/qa-c1-photo/photo-qa.mjs
QA_MODE=mobile QA_CASE=normal-natural,perfect-skip node docs/qa-c1-photo/photo-qa.mjs
QA_URL=http://127.0.0.1:18641/ node docs/qa-c1-photo/c2-replay-qa.mjs
node docs/qa-c1-photo/data-regression.mjs
```

`photo-qa.mjs` 明確以 `__SAKE_GAME__` 直入第5關、注入 `runFriends`（10 或 11）及呼叫 `playOutro()`；此後由 Playwright 真實 keyboard 或純 touchscreen 操作，逐句核對完整對話，觀察圖片父容器 alpha 與對話框、原結尾字卡及片尾。QA 每幀量度由首次 alpha=1 至開始淡出，獨立於兩端淡化；截圖和原始 frame 記錄一併保留。`c2-replay-qa.mjs` 為既有大陸2回歸測試，於隔離瀏覽器注入 localStorage 通關旗標後由 UI 鍵盤／touch 逐張播放 1–10，並非第10關通關。

**限制：**全部為自動測試和模擬手機，不是真機、真人或第1至5／第10關完整通關。截圖只顯示目前既有圖，並非新素材或修改故事。瀏覽器執行時間及幀率可能因主機負載變動。
