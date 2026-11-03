# ART-18 合併預覽 QA（2026-11-03）

- 預覽：`main` `17930a0369a9f177e91372a2456a41da19bd377f` + [#73](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/73) `89be87ba7e944a5838f0e7c34f765fc816830c8f`，喺獨立 worktree 做未提交 merge；沒有修改或推送 Cursor branch。
- `build.txt`：`npm run build` 通過（TypeScript + Vite；有 Vite chunk size warning）。
- `validate-data.txt`：`npm run validate:data` 通過（9 個 validators）。

## 動作截圖

Playwright Pixel 7 橫屏模擬；第2關、單人琪寶寶，測試先設定關卡／起點及移除敵人，然後 **只用 touch** 行、跳及走入真正風口。`scripts/qa/fan-preview-mobile.mjs` 重用現有 `scripts/qa/mobile.mjs` 嘅 CDP touch 方式。截圖前後嘅角色狀態記錄於 `mobile-poses.json`／`.txt`；遊戲會在截圖期間繼續推進，前後狀態不是截圖精確同一幀。

- [站立](mobile-idle.png)（[腳底放大](mobile-idle-feet-crop.png)）
- [跑步](mobile-run.png)（[腳底放大](mobile-run-feet-crop.png)）
- [跳躍](mobile-jump.png)
- [風口滑翔](mobile-glide-actual-fan-float.png)

站立和跑步截圖中，鞋底貼近草面、未見明顯陷地；放大後鞋底似有約 1–2 畫面像素嘅細空隙，草面／陰影令判斷有不確定性，請 Claude 視覺覆核。記錄當時角色腳位 `y=285`、地面支撐 `y=285`，body bottom `283`；這是物理座標，不能單憑它證明美術像素已貼地。跳躍及滑翔截圖中離地屬動作本身，不能用來判斷站立貼地。

**風扇動畫限制：** 實際風口滑翔播放嘅狀態係 `fan-float`（`Player.ts`），雖然 atlas 另有 `fan-glide`，現時來源搜尋未見遊戲呼叫 `fan-glide`。因此截圖反映實際滑翔畫面，不代表獨立 `fan-glide` sheet 已在遊戲運行中驗證。

`desktop-poses.txt`／`.json` 同 `desktop-*.png` 為相同預覽嘅桌面鍵盤自動化。放大腳底圖只係由原截圖裁剪及最近鄰放大，原圖保留，並非新畫面。

## 重跑及限制

先在獨立 worktree 合併預覽上述兩個 commit（唔 push Cursor branch），安裝相同依賴及開 Vite 47317；在此 QA branch 執行：

```sh
QA_MODE=mobile node scripts/qa/fan-preview-mobile.mjs
QA_MODE=desktop node scripts/qa/fan-preview-mobile.mjs
```

未做真機、全動畫逐格、完整關卡、其他造型及全素材人工覆核；影格高度 178→180 嘅跨場景影響仍需 Claude 審閱。PR #73 仍為 draft，唔自行 merge。
