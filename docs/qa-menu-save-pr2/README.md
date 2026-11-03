# 主選單／存檔 PR2 QA

基於 `main` `56f4f968ee128917dc4923a4314584d54423424f`（#81）。所有畫面均為 Playwright 模擬，並非實體手機或完整通關。

## 驗證及紀錄

- `npm run build`：TypeScript、Vite 成功（現有 Vite 警告見 `build.txt`）；`npm run validate:data` 九項通過（`data.txt`）。
- `menu-save-pr2-state.mjs`：舊檔／無裝備、第一關帶或不帶、注入第1–5關快照與重載、死亡與支線隔離、排行榜資格、損壞或禁寫、既有分頁已寫入時拒絕覆蓋、抽籤及轉場獎勵保存（`state.txt`／`state.json`）。
- `menu-save-pr2-score.mjs`：注入關卡狀態，檢查舊檔有裝備遷移後由兩個過關寫分入口上榜、非零／零裝備資格、評級、損壞排行榜（`score.txt`／`score.json`）。
- `menu-save-pr2-start.mjs`：手機 touch、桌面鍵盤測兩個大陸第一關喺主選單／世界地圖的新玩家直接開局；模擬有進度時檢查警告、預設取消及取消後存檔不變（`mobile-start.*`／`desktop-start.*`）。
- `menu-save-pr2-scenes.mjs`：Pixel 7 橫向純 touch、桌面鍵盤；注入過關，實際操作商店、賭檔、地圖重玩及返回主線、第一關新局、片尾到第6關，以及關閉測試閘後的支線返回（`mobile-scenes.*`／`desktop-scenes.*`）。
- `menu-save-pr1.mjs`：手機／桌面重測封面、攻略、兩個大陸入口、兩個第一關選項、結局鎖定及十幕佔位卡（`mobile.*`／`desktop.*`）。
- `menu-save-pr2-minigames.mjs`：注入單車／夾公仔結果，驗證續關幣接入本局快照並可重載（`minigames.*`）。
- 圖片保留手機及桌面第一關選項、地圖、支線過關及片尾入口。測試的角色、關卡、勝利及小遊戲結果部分以程式設定，並非由第一關真打至第六關。

## 重跑

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 47322 --strictPort
# 另開終端：
npm run build && npm run validate:data
node scripts/qa/menu-save-pr2-state.mjs
node scripts/qa/menu-save-pr2-score.mjs
node scripts/qa/menu-save-pr2-minigames.mjs
QA_MODE=mobile node scripts/qa/menu-save-pr2-start.mjs
QA_MODE=desktop node scripts/qa/menu-save-pr2-start.mjs
QA_MODE=mobile node scripts/qa/menu-save-pr2-scenes.mjs
QA_MODE=desktop node scripts/qa/menu-save-pr2-scenes.mjs
QA_BASE_URL=http://127.0.0.1:47322/ QA_OUT=docs/qa-menu-save-pr2 QA_MODE=mobile node scripts/qa/menu-save-pr1.mjs
QA_BASE_URL=http://127.0.0.1:47322/ QA_OUT=docs/qa-menu-save-pr2 QA_MODE=desktop node scripts/qa/menu-save-pr1.mjs
```

## 未驗證／風險

- 未真機、未完整連續通關、未以真人試玩；手機 P2 touch 按 Alan 決定不提供。成長點數系統另做，今次只有預留欄位；第10關通關旗標未接。
- **請只開一個分頁**：可偵測「另一分頁先完成寫入」的舊快照並警告，但 `localStorage` 讀取比較與寫入不是原子操作；兩分頁幾乎同時寫入仍可能互相覆蓋。Claude 評估此限制不阻合併。
- 快照與舊裝備鍵是兩次寫入：主線先寫，成功後才同步舊裝備鍵；儲存失敗會顯示警告。
