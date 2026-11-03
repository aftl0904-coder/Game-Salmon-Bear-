# 第4關手機 bug 修復 QA（2026-11-03）

## 基線與範圍

修復分支以 `main` `dfd4413ec9b85f90743d4d669ff6151471596324`（包含已合併的 #65）為基底。`baseline-test.txt`／`baseline.json` 使用未修復的舊 main `1c6609300820a5770dc0d0beb8c89fcade86e264` 和擴充後的 `scripts/qa/mobile.mjs --transitions-only`：模擬鎖定 Boss 場鏡頭後觸發過關，再以 touch 點檔口，鏡頭 X 為 3160、檔口未開啟。`baseline-clear.png` 是該基線畫面；此測試用程式設定鏡頭及過關狀態，並非實際打贏 Boss。

## 測試結果與證據

- `build-test.txt`：`npm run build`（TypeScript + Vite）通過；有既有 Vite warning。
- `data-test.txt`：`npm run validate:data` 通過。
- `mobile-test.txt`、`mobile-controls.json`、`mobile-transitions.json`：`scripts/qa/mobile.mjs` 使用 Playwright 的 iPhone 13、Pixel 7 及小尺寸 Android 橫屏模擬。操作使用 touch；過關檔口換人／購買／長按離開、瞓覺、賭檔贏輸、世界地圖、單車跳過及片尾返回選單以 touch 測試。直向只檢查轉橫屏提示。
- `touch-01-clear.png` 至 `touch-06-credits.png`：Pixel 7 過關及轉場截圖；`touch-07-boss-platform-boy.png`、`touch-07-boss-platform-girl.png`：兩角色避難台截圖。測試以程式設定關卡、Boss 場鏡頭及通關狀態，不代表從頭打完整關。
- `physics-test.txt`、`physics-boy.json`、`physics-girl.json`：兩位角色分別以 touch 測試平台、跳過 Boss 和避開衝撞；蜜僵在三個坑雙向跨越、跳坑受擊及死亡，並量度追人速度；第二階段釘槍逐發預警與發射時距亦有紀錄。場地、敵人及 Boss 階段由測試程式設定，不代表完整對戰。
- `landing-before-sync-fix.json` 記錄修正前低幀率下，腳位雖曾落到平台頂，但物理 body 隨後將角色拉回平台下方的情況；修正後同步 body 和腳位，兩角色測試通過。
- `desktop-test.txt`、`desktop.json`、`desktop-*.png`：模擬桌面鍵盤移動、跳躍、過關、檔口、瞓覺、賭檔、世界地圖及單車到第5關。
- `c2-smoke/test.txt`：整合 #65 後，以既有 `scripts/qa/c2s1/smoke.mjs` 設定並走訪第6關 A–D 區；輸出無 page／console errors。此為傳送式 smoke，並非完整過關或對商場玩法的完整驗收。

## 未驗證

未在實體手機或實體電腦操作，未由頭完整遊玩第4關或第6關。泥鬃空檔及蜜僵速度是否好玩、真機觸控手感，仍須 Alan 試玩。沒有在 Cursor branch 作任何修改。
