# 第一版成長 checkpoint QA

此 draft **沒有接線至遊戲或存檔**。所有成長測試只測隔離純函數，不是玩家功能驗收。

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

## 未完成／未驗證

**開局配點介面、商店重配介面、實際發點、持久化、防刷 ledger、五軸戰鬥效果、成長死亡保留、carry／不帶成長、成長支線隔離、舊成長遷移、帶成長榜單及實戰自動平衡全部未接入及未測。** 本 PR 不得被視為完成遊戲功能。未以真機或真人測試，未完整通關；以上自動化均不代表真人手感。
