# 雙人模式落台回歸（2026-11-03）

基底：main `17930a0369a9f177e91372a2456a41da19bd377f`（#70 已合併）。本 PR 只有 QA 腳本及證據，沒有改遊戲程式、關卡或設計。

## 方法

使用 `scripts/qa/two-player-landing.mjs`，以程式設定 `playMode=2p`、關卡、兩個角色起點並移除敵人；第4關避難台測試點以設定 `bossFight`／`bossOn` 同班車 `done` 避開因傳送而誤觸嘅 Boss 入場及班車事件，沒有生成 Boss。之後只用實際鍵盤或 touch 操作。第1至5關各抽一處平台或台階，包括第4關泥怪場右邊避難台。斷言跳起、落到高台、走落低地、落地當幀／之後的碰撞框同水平速度。

- `desktop.txt`、`desktop.json`、`desktop-stage*.png`：Playwright 模擬桌面，第1至5關通過；P1 用 G／A，P2 用句號／左方向鍵；兩角色同場及同時操作。
- `mobile.txt`、`mobile.json`、`mobile-stage*.png`：Playwright 模擬 Pixel 7 橫屏，第1至5關通過；P1 **只用 touch**，P2 同場但保持不動；測試有斷言 P2 無被 P1 touch 意外控制。現行程式 P2 沒有屏幕 touch 控制：P2 依賴鍵盤或第二個手掣；因此這不是兩人純 touch 測試。
- `build.txt`：`npm run build`（TypeScript + Vite）。

## 重跑

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 47316 --strictPort
# 另一個終端
QA_MODE=desktop node scripts/qa/two-player-landing.mjs
QA_MODE=mobile node scripts/qa/two-player-landing.mjs
npm run build
```

## 限制

模擬器非真機；未測兩個實體手掣、所有平台、完整戰鬥、敵人干擾、移動平台或從頭過關。手機 P2 純 touch 無法操作屬現有功能限制，不在這個純 QA PR 改設計。
