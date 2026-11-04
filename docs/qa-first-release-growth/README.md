# 第一版成長 checkpoint QA

此 draft 已接入版本化本局存檔、主線發點及新局選源／配點 UI；**商店重配仍未接；五軸只完成局部戰鬥 checkpoint**，不能視作完整驗收或合併。

## 2026-11-04：五軸戰鬥局部 checkpoint
- [桌面鍵盤](combat-20261104/desktop-retry3.log)／[模擬手機純 touch](combat-20261104/mobile-retry2.log)：注入分配、真實場景及固定目標並停用敵 AI，0／1 點分別為生命 6→7、攻擊碰撞 3→4、防禦無敵 1500→1560ms、耐力上限 1→1.1／一秒回氣 0.55→0.5665、絕招碰撞 3→4。實際按 F／T 或手機「攻／絕」經 Phaser overlap，其餘直接呼叫場景方法；截圖及 JSON 同目錄。手機非真機；均非真人或自然通關。
- 實際碰撞注入第1關 Boss：未配攻擊扣 1、攻擊3點扣 2；Boss 1點可被取整吸收，不是自然 Boss 戰。[生命週期](combat-20261104/lifecycle-attempt.log) 注入購裝、補血、checkpoint、死亡及復活，檢查跨關 HP、死亡清裝及保留成長、支線不讀主線、死亡不獲 S 和效果上限。
- 首次桌面／手機碰撞逾時是 fixture 朝向與目標相反，原 log／JSON／截圖保留；其後[桌面重試](combat-20261104/desktop-retry2.log)及[手機重試](combat-20261104/mobile-retry1.log)發現絕招銷毀物件後才讀施放者，雙人錯歸屬；修正後上列通過，失敗均保留。[退出碼](combat-20261104/exits.log)、[build](combat-20261104/build-final.log)、[資料驗證](combat-20261104/validate-final.log)、[server](combat-20261104/server.log)。首輪關服務仍有 listener，已另行清理。
- 商店免費重配、地圖入口完整驗收、所有 Boss／兩角色攻擊和多裝備／扭蛋組合、真人手感與自然通關仍待辦；不是全面平衡或完成驗收。
## 2026-11-04：支線、裝備及榜單補測

- [桌面鍵盤](ui-20261104/extended/desktop.log)、[模擬手機純 touch](ui-20261104/extended/mobile.log) 均通過：再由正常封面／選單進第2關支線，確認支線符合榜單資格；**注入**支線購裝及清關後主線快照逐字不變。另**注入**主線買槍，經正常選單選帶舊裝備及不帶舊成長，新局保留槍、各5點且不具榜單資格；均非自然通關。退出碼見 [extended/exits.log](ui-20261104/extended/exits.log)。
- [實際榜單寫入 retry](ui-20261104/score/retry/score.log)：**注入**遊戲場景、新局來源及結算觸發，在真實 `GameScene` 測兩個寫榜位置；帶非零舊成長兩處均零筆，不帶成長兩處各寫一筆。不是玩家自然完成 Boss 或完整榜單驗收。[首次失敗](ui-20261104/score/score.log) 等 `started` 超時，因仍停在開場故事（[截圖](ui-20261104/score/failure.png)）；測試補按畫面「跳過」後才重試通過，兩次退出碼均保留。
- 測試伺服器 47951 已停止，無 listener，見 [server.log](ui-20261104/server.log)。地圖入口、自然關卡／Boss、商店重配及五軸戰鬥仍未實測或未接線；未真機、未真人。舊版選單警告與取消保留，新局成長 UI 不等於完成整個成長系統。

## 2026-11-04：新局來源及雙角色配點首輪

- [桌面鍵盤 log](ui-20261104/desktop.log)／[手機純 touch log](ui-20261104/mobile.log) 均從正常封面 → 難度 → 選角操作，沒有注入場景。兩人各5及各自加點見 [桌面](ui-20261104/desktop-points-both.png)、[手機](ui-20261104/mobile-points-both.png)；選不帶、選舊10、選另一局5、取消，核對所有來源保留、不合併及新局 `eligible`。手機為 Chromium Pixel 7 landscape 模擬器，不是真機或真人。
- 為建立舊10資料，透過真實模組**注入**第1–5關清關事件（3=S、5=A）、購槍及解鎖進度；不是自然打 Boss。首輪只核對 run 的資格布林；支線及注入寫榜補測見上節，地圖入口仍待測。
- 各以正常 UI 確認時注入 `localStorage.setItem` quota 失敗及損壞原始字串，驗證仍停留配點、原本快照逐字不變，恢復寫入後重試；見 [桌面失敗](ui-20261104/desktop-quota-failure.png)、[手機失敗](ui-20261104/mobile-quota-failure.png)、[桌面壞檔](ui-20261104/desktop-corrupt-blocked.png)、[手機壞檔](ui-20261104/mobile-corrupt-blocked.png)。舊版無明確配點呼叫仍阻擋非零重開。未證明跨分頁同時 compare/set 安全。
- [build](ui-20261104/build.log)、[validate](ui-20261104/validate.log)、[純帳本模型](ui-20261104/ledger.log) 通過，退出碼 [exits](ui-20261104/exits.log)；Vite 有既有設定及 chunk 警告。後兩項為模型／資料檢查，不是玩家操作。自然通關、死亡／戰鬥效果、商店重配、真人及真機未測或未實作。

以下版本化存檔為上一輪歷史記錄；其中「未有取回 UI」是當時狀態。

## 2026-11-04：版本化存檔 checkpoint

- [storage-reload.log](storage-20261104/storage-reload.log)、[storage.json](storage-20261104/storage.json)：真實 Chromium localStorage，使用注入清關事件和 fixture。覆蓋 3/5/7 × S/A/B/C、兩角色同額、每格1,000次重放、支線不改主線、空 v1 原文保留／零點遷移、損壞／未知／v2 帳本不一致、注入 quota 失敗及重試、順序 stale writer，以及重新載入／恢復。來源切換為**注入 v2 fixture**，實際讀取並驗證舊10、另一局6及取回舊10不合併；沒有玩家可用的取回介面或實際來源選擇操作。
- [win-fresh.log](storage-20261104/win-fresh.log) 及 [win-failure-retry.log](storage-20261104/win-failure-retry.log)：注入第3關存檔和評級數值，直接呼叫真實 `GameScene.win()`；驗證顯示 S、同一快照推進及兩人各8、重放不加點；另注入 canonical setItem 失敗，確認下一關被阻止、恢復寫入後以原 S 重試一次。這不是自然打 Boss 或完整通關。[結算截圖](storage-20261104/desktop-injected-win.png)。
- [desktop-input-final.log](storage-20261104/desktop-input-final.log)、[mobile-input-final.log](storage-20261104/mobile-input-final.log)：注入選單場景後，以桌面鍵盤及模擬手機純 touch 操作既有第1關新局入口，檢查 v2 雙5，並透過選單嘗試不帶重開、確認被阻止且存檔不變；見 [桌面保護](storage-20261104/desktop-restart-blocked.png)、[手機保護](storage-20261104/mobile-restart-blocked.png)、[桌面選單](storage-20261104/desktop-baseline-menu.png)及[手機選單](storage-20261104/mobile-baseline-menu.png)。不是成長 UI 驗收。未真機或真人。
- [build-final.log](storage-20261104/build-final.log)（tsc + Vite）、[validate-final.log](storage-20261104/validate-final.log)（9項）、[ledger-final.log](storage-20261104/ledger-final.log) 通過；退出碼見 [exits.log](storage-20261104/exits.log) 及 [input-final-exits.log](storage-20261104/input-final-exits.log)。Vite 有既有設定與 chunk 警告。受控測試服務在 [final-server.log](storage-20261104/final-server.log) 記錄 SIGTERM，47947／47948／47949 最後均無 listener。
- 開發前在一次性隔離瀏覽器重現舊版損壞存檔被開新局覆寫：保留 [risk-before.log](storage-20261104/risk-before.log)，新程式拒絕覆寫。結算測試首次 [win.log](storage-20261104/win.log) 及 [win-debug.log](storage-20261104/win-debug.log) 失敗：正在開發的 Vite HMR 導致測試載入無時間戳的 `run.ts`，場景載入帶時間戳的另一實例，故測試注入不在場景使用的上下文；[失敗截圖](storage-20261104/desktop-injected-win-failure.png) 保留。停止伺服器、以乾淨 Vite 模組圖重跑後上面兩項場景測試通過，並非把失敗記成通過。
- localStorage 同一鍵快照是單次 setItem，並非跨分頁 compare-and-set：只測先後陳舊寫入被拒，**同時跨頁寫入仍有競態，請只開一個分頁**；舊裝備鍵同步另為一筆寫入。未有取回 UI，已有非零成長時保護性阻擋新局；玩家無法完成帶／不帶、選回任一舊局，尚須補實作。

以下為上一輪隔離模型 checkpoint 的歷史記錄，不代表目前接線狀態。

## 2026-11-04 更新：已確認規則的 provenance 模型

- [ledger-20261104/ledger.log](ledger-20261104/ledger.log)：純模型通過。覆蓋新局兩人各5、舊10帶入仍10、不帶及選回舊局、不合併、3／5／7關 S/A/B/C 全矩陣兩人同額、1,000 次重複事件、支線不改帳本、重配守恆、空舊欄位及拒絕損壞／未知結構。這不是實際存檔、榜單或 UI 測試。
- [build.log](ledger-20261104/build.log)、[validate.log](ledger-20261104/validate.log)、[core.log](ledger-20261104/core.log) 通過，退出碼在 [exits.log](ledger-20261104/exits.log)；build 有既有 Vite 設定和大 chunk 警告。
- 桌面鍵盤與模擬手機**純 touch**重跑現有第1關新局入口，分別見 [desktop log](ledger-20261104/desktop-input.log)、[mobile log](ledger-20261104/mobile-input.log) 及同目錄截圖。注入選單場景，`growth` 仍為空；不是新成長 UI 驗收。原有存檔回歸 12 項在 [state.log](ledger-20261104/state.log)，同樣不涉及新成長。
- [server-probe.log](ledger-20261104/server-probe.log) 保留啟動前首次連線拒絕；測試結束後原 cleanup trap 未執行、伺服器仍在監聽，失敗及明確 SIGTERM 關閉後檢查均保留在 [server.log](ledger-20261104/server.log)。最終 47939 沒有 listener。

## 已完成

| 測試 | 結果與範圍 |
|---|---|
| `npm run build`（含 tsc、Vite） | 通過；`build.log`、`exits.log`。基線結果另存 `build-baseline.log`。 |
| `npm run validate:data` | 通過；`validate.log`、`exits.log`。基線結果另存 `validate-baseline.log`。 |
| `first-release-growth-core.mjs` | 通過；`core.log`。測兩個獨立5點模型、重配守恆（重複1000次）、非法輸入、S/A/B/C 映射和暫定公式。純模型，並未測遊戲內發點、存檔或實戰平衡。 |
| `menu-save-pr2-state.mjs` | 通過12項；`state-desktop.log`、`state.json`。測既有裝備／存檔：舊檔遷移、carry／不帶、支線買裝及死亡清裝、損壞及寫入失敗、跨頁警告。用注入狀態，**沒有測永久成長**。 |
| `menu-save-pr2-start.mjs` | 桌面鍵盤、模擬手機純 touch 都通過；`browser-exits.log`、`start-desktop.log`、`start-mobile.log`、`desktop-start.json`、`mobile-start.json`，另有選單及地圖警告截圖。以注入場景／進度建立條件，只測既有第1／6關新局入口、警告及取消保留存檔。**沒有成長配點 UI**。 |
| `first-release-growth-input.mjs` | 桌面鍵盤及模擬手機純 touch 通過；`input-exits.log`、`*-baseline-input.*` 和 `*-baseline-*.png`。用注入選單場景並操作現有第1關新局，驗證 growth 仍為空；不是新成長功能。 |

啟動探測曾在 Vite 尚未就緒時收到一次連線拒絕，重試後服務正常；原始訊息見 `server-start-probe.log`。Vite `server.log` 記載測試伺服器及關閉檢查。
原有 shell cleanup 後 Vite 子程序處於暫停狀態而仍佔用端口；第一次 SIGTERM 關閉檢查失敗，原樣留在 `server.log`。其後對此分支的暫停程序使用 SIGKILL，確認 47931 已無 listener。

## 上一輪未完成／未驗證（歷史狀態）

**開局配點介面、商店重配介面、實際發點、持久化、防刷 ledger、五軸戰鬥效果、成長死亡保留、carry／不帶成長、成長支線隔離、舊成長遷移、帶成長榜單及實戰自動平衡全部未接入及未測。** 本 PR 不得被視為完成遊戲功能。未以真機或真人測試，未完整通關；以上自動化均不代表真人手感。
