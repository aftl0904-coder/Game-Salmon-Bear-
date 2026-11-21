# 隱藏鏈網 — 需人手測試

## 點解自動化唔過

- Playwright／本 CI Chromium **觀察唔到** `document.hidden`（切第二分頁、CDP lifecycle 均無 `visibilitychange`）。
- Phaser 已有 `VisibilityHandler`：`document.hidden` → `Game.onHidden` → `loop.pause()`（只記暫停時間戳）；真正令 `delayedCall`／物理停係 **瀏覽器隱藏分頁後停／節流 RAF**。
- 喺仍有 RAF 嘅環境呼叫 `game.loop.pause()` **唔等於** 真切頁，唔可以當產品通過。

## 人手步驟（桌面 Chrome）

1. 開第7關，打到 Boss P2（或用 debug 入 arena）。
2. 等橙色鏈網預警出現。
3. **立即**切去其他分頁／最小化約 2–3 秒，再切返遊戲。
4. 預期：切走期間唔應扣血；切返後預警／網時長仍約 0.8s／1.5s 前景時間，有安全站位。
5. 錄短片或截圖＋文字記錄放入 `docs/qa-c2s2/`。

自動化證據：`hidden-chain.json`（`realHiddenObserved:false`，`manualStillNeeded:true`）。
