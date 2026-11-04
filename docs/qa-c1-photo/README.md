# 大陸1結尾大合照：5 秒停留 QA（2026-11-04）

## 範圍及確認方案

Alan 已確認：第一大陸完場的大合照完整顯示後停留 5 秒，玩家可提前跳過；不改故事台詞、不換圖。基線為重新 fetch 的 `main` `077af8b14b34b3e26d776e36705772fdd691639b`。本輪只調整 `data/story.json` 的 `C11` 與 `C11_PERFECT` 最後一張、現時兩個分支都真正使用的 `ending-3`，以及沿用的 `src/game/cutscene.ts`。`ending-3` 現有圖是主角、噗噗、女王蜂、鏡鴞和工頭同框；不應聲稱圖中有全部十一個朋友。`ending-picnic.png` 雖然存在，但此故事執行器沒有載入或使用它，今次不換成另一張圖。大陸2十張重溫圖是另一套 `ending-c2-01…10` 與獨立 `EndingC2Scene`，不改。

正常／完美分支由原有 `perfectEnding()` 選擇，不改判斷。`C11` 原有 Alan 待寫句及 `C11_PERFECT` 七句和字卡「待 Alan 填寫」原樣保留；不自行填寫或替換已確認的第一版文字。其餘故事所有步驟和文字同基線逐項比較一致。

## 原因與處理

目前資料格式並無 `pic` 指令：故事用 `still`。`still` 處理會先將舊圖淡出 350ms，再令新圖淡入 450ms；它本身不等待。`C11` 和 `C11_PERFECT` 的 `{still: 'ending-3'}` 下一步立即 `{still: null}`，所以新圖在淡入完成後即淡出；450 + 350ms 即約 0.8 秒，沒有 5 秒完整顯示。因為前一個 `say` 不會自動關閉對話框，原本它亦會遮著大合照下方。

新增的 `hideDialog` 和 `holdMs` 都是 `still` 的**可選**參數，僅在上述兩個 `ending-3` 事件啟用。顯示新圖前隱藏上一句對話框；淡入到 alpha=1 後才開始 5000ms；其後沿用原本 `still:null` 的獨立 350ms 淡出。右上角原有「跳過 ▶▶」仍可見並接收 touch；鍵盤 Enter／Escape 和原 Start 跳過仍沿用現有 cutscene 全段跳過，跳過後直接進入原有通關卡，不會被計時器再次觸發。普通點畫面、前進按鍵在原有對話期間照舊前進；提早結束用既有跳過功能，不新增故事文案。自然播放按原路徑繼續到結尾字卡 → 第5關通關卡 → 世界地圖 → 片尾。

既有 Phaser `TimerEvent` 採逐幀累積及平滑 delta，首輪三個 Chromium 並跑時完整透明度的 5 秒設定實測延長成 8249.7／6783ms（見 `preliminary-contention-*.txt`）。原修訂改用 scene clock，但複核發現 `scene.time.now` 是該幀較早的 rAF 時戳，而非淡入完成及繪製提交後的實時；慢幀下以它起計，不能嚴格保證提交後足夠 5 秒。本輪改為淡入完成後，以 `performance.now()` 單調時鐘起計，逐次 scene update 檢查截止時間；其餘 `wait`／淡入淡出和未指定參數的 still 邏輯不變。跳過或 scene 清理會移除監聽及該過場的 still／root tween。

## 舊測原始結果（保留；不得把設定值當實測值）

- `npm run build`（含 tsc）及 `npm run validate:data` 9 項通過，見 `build.txt`、`validate-data.txt`；Vite 有既有 native config／chunk size 警告。
- 桌面實測：正常結局完整 alpha=1 停留 5116ms、完美結局 5183ms（以 scene clock 計；wall 分別 5115／5173ms）；兩支原有對話全部核對，兩者自然接原字卡、通關卡及片尾。兩支用 Escape 提前跳過分別 196／541ms 到通關卡。見 `desktop.txt` 和逐幀 JSON。桌面早期腳本未檢查跳過後原截止時間及片尾。
- **舊版腳本手機自然播放未通過其時間上限**：`mobile-contended-failed.txt` 原始記錄顯示完整 alpha=1 實測 **5599.7ms**；其後一次串行重測 `mobile-serial.txt` 實測 **5366.4ms**，兩次均超過既定上限 5300ms，均不可報 PASS。設定是 5000ms，實際開始淡出須等待畫面更新及排程；當時上限為自行設定，並非 Alan 確認的產品要求；兩次原判定仍然是 FAIL，不能改稱 PASS。兩次失敗並無保存逐幀資料，故不能反推各次確實的幀率或以事後猜測斷定其成因。
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

舊版 `photo-qa.mjs` 明確以 `__SAKE_GAME__` 直入第5關、注入 `runFriends`（10 或 11）及呼叫 `playOutro()`；此後由 Playwright 真實 keyboard 或純 touchscreen 操作，逐句核對完整對話，觀察圖片父容器 alpha 與對話框、原結尾字卡及片尾。QA 每幀量度由首次 alpha=1 至開始淡出，獨立於兩端淡化；截圖和原始 frame 記錄一併保留。`c2-replay-qa.mjs` 為既有大陸2回歸測試，於隔離瀏覽器注入 localStorage 通關旗標後由 UI 鍵盤／touch 逐張播放 1–10，並非第10關通關。

**限制：**全部為自動測試和模擬手機，不是真機、真人或第1至5／第10關完整通關。截圖只顯示目前既有圖，並非新素材或修改故事。瀏覽器執行時間及幀率可能因主機負載變動。

## 2026-11-04 複核方法

Alan 確認的是**完整顯示後至少 5 秒、可跳過**，不是「5 秒至 5.3 秒」的固定容差。不能由預設 60fps、顯示器規格或設定值推算這台共享主機實際幀率：應量當次相鄰 update／render 的間隔。絕對 5300ms 上限欠缺該依據，但舊結果仍照當時規則記錄為失敗。

源碼依據：Phaser `src/time/Clock.js` 的 `update(time, delta)` 設定 `now = time`；`src/scene/Systems.js` 的每幀順序是 `PRE_UPDATE` → `UPDATE` → `POST_UPDATE` → `render`。淡入 tween 完成後，Promise continuation 在該幀同步渲染返回後才註冊 hold。`performance.now()` 到期後，在**第一個可執行的 scene update**移除監聽；其後 continuation 註冊淡出 tween，還需後續幀才出現 alpha 小於 1。因此，計時截止、fade tween 註冊、scene 物件 alpha 與 QA 觀察到的繪製幀是不同事件。低 FPS、OS／瀏覽器排程和截圖可能令可見更新較遲；一個固定上限並不能證明或排除邏輯缺陷。

本輪 QA 在獨立 `audit-20261104/` 留存逐幀 JSON：`wall` 是 `performance.now()`，`scene` 是 rAF scene 時戳；監測 hold 監聽註冊與移除、上一個 update、fade tween 註冊，以及首次 alpha=1 和首次 alpha<1 的 Phaser `render` 回調。斷言包括 render 樣本至少 5000ms、到期前沒有被漏掉的合資格 update，並檢查淡出在到期後兩幀內出現，記錄各段延遲、實際相鄰幀間隔和觀察 FPS；2ms 只用於估計 hold 計算後註冊觀測的極小儀器偏差，**不是**把完整顯示時間下限改成 4998ms。測試由遊戲 hook 直入結局，之後純 touch，非真機或完整通關。Phaser render 事件是繪製提交，不是硬件螢幕實際呈現時間；未測頁面隱藏、鎖屏或暫停，當頁面背景時單調時鐘仍前進，不能證明玩家看足 5 秒。

### 新一輪模擬手機串行結果

本輪 Chromium 156／Playwright 1.49、6 核共享主機；測試時 load average 約 18.8（1 分鐘），軟件 WebGL，見 `audit-20261104/environment.txt`。兩個自然分支各經 7 句原對白後，不遮擋的相片自然接原字卡 → 通關卡 → 世界地圖 → 片尾；兩個跳過分支均透過右上角 touch 提早進通關卡，過原期限後通關卡仍在，再進片尾。截圖、原始 JSON、日誌及程式放 `audit-20261104/`。

| 模擬手機 touch | 首個完整 render → 首個淡出 render | hold 註冊 → 移除 | 到期跨越 update 間隔 | 首個淡出相對移除 | 實測 render FPS | 結果 |
|---|---:|---:|---:|---:|---:|---|
| 正常自然 | 5268.0ms | 5016.3ms | 155.2ms | 2 幀 | 6.83 | PASS |
| 完美自然 | 5346.6ms | 5018.1ms | 163.6ms | 2 幀 | 6.36 | PASS |
| 正常跳過 | 提早跳過 | — | — | — | — | PASS，368ms 至通關卡 |
| 完美跳過 | 提早跳過 | — | — | — | — | PASS，542ms 至通關卡 |

正常／完美兩案例淡入首個完整 render 的 scene 時戳分別比實際 render 回調早約 68.8／48.2ms，正是舊計時起點不足夠嚴謹的原因；兩案例到期移除至 fade tween 註冊分別約 31.9／42.1ms，再至首次淡出 render 分別約 219.5／286.1ms（詳見 JSON／log）。例如完美案例超出 5300ms 並非單靠更改容差掩飾：它是五秒截止後的下一個 update、Promise/tween 和下一次可觀察 render；實測幀間距中位數 159.3ms、P95 209.1ms、最大 256.3ms。此例符合新測的**至少 5 秒及逐事件／實測幀數**準則，不代表符合舊的 5300ms 上限；歷史兩次 FAIL 不作改判。高度負載下幀率本身很低，實機流暢度仍須另行測試。

四個案例均輸出 `RESULT PASS`、無 `FAIL`，截圖及 frame JSON 存在（`audit-check.txt`）；執行殼層擷取 `PIPESTATUS` 意外得到空值，最後 `exit` 出現 numeric argument 錯誤，故**包裝程序整體狀態為 failed，不能聲稱該程序退出碼是 0**。測試程序個別結果與資料已獨立核對；伺服器已關閉。

重現新版短測（伺服器用完須關閉；這個 shell 不依賴管道退出碼）：

```sh
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 18651 --strictPort > /tmp/c1-photo-vite.log 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
QA_URL=http://127.0.0.1:18651/ QA_MODE=mobile node docs/qa-c1-photo/audit-20261104/photo-qa.mjs > /tmp/c1-photo-new-run.log 2>&1
status=$?
cat /tmp/c1-photo-new-run.log
kill "$server" 2>/dev/null || true
trap - EXIT
exit "$status"
```
