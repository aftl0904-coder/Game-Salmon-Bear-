# STATUS 文件 QA（2026-11-03）

本 branch 只新增 `docs/STATUS.md` 與本 QA 資料，沒有修改遊戲程式。測試基底包含 main `dfd4413ec9b85f90743d4d669ff6151471596324`。

- `build.txt`：`npm run build` 通過 TypeScript 及 Vite；保留現有 Vite 警告。
- `mobile.txt`、`mobile-controls.json`、`pixel7L-play.png`：Playwright 模擬 iPhone 13、Pixel 7 及小尺寸 Android 橫屏，以 touch 測移動、跳躍、攻擊、換武器、多指及暫停；iPhone 直向只檢查轉橫屏提示。此測試以程式設定入關狀態，並非由頭打完整關。
- `desktop.txt`、`desktop.png`：模擬桌面以鍵盤測第4關移動及跳躍；以程式設定入關狀態。
- 未驗證：實體手機、實體電腦、完整遊玩。此文件 PR 不代表驗證其他 PR 嘅玩法或美術。

手機基本操作測試可喺專案根目錄啟動 Vite 後執行：

```sh
npm run dev -- --host 127.0.0.1 --port 47314 --strictPort
# 另一個 terminal：
QA_BASE_URL=http://127.0.0.1:47314/ QA_OUT=docs/qa-status node docs/qa-status/mobile-controls.mjs --controls-only
```
