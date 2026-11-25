# 第9關獄卒兵：美術及 QA（2026-11-25）

## 交付

- `public/art/stage9/enemies/s9jailguard.png`：原創獄卒兵，3072×704 RGBA，12 欄×2 行，24 格；每格 256×352，`res: 4`，邏輯畫布 64×88。依次是待機、行、舉棍預警、揮棍、受傷、倒下，各 4 格。
- `s9jailguard.json` 使用 0-based `frames` 清單；FPS 只是素材預覽建議，不等同遊戲計時。
- 生成原稿透明圖為 1536×2304；先以 alpha ≥128 劃分透明空隙，按 6 行×4 欄切割，全部格使用同一比例縮小、統一素材底線，再合成 atlas、量化色盤並 nearest 放大 4 倍。來源及輸出 SHA-256、原稿每格 bbox 記於 `source-report.json`；生成原稿目前只在本機暫存，沒有入 repo。此處底線是素材座標，不代表 Phaser 裏的落地位置。沒有宣稱輪廓每處均為 1 邏輯 px。

## 驗證

- `build.txt`：`npm run build`（tsc + Vite）通過，原有警告保留；`validate-data.txt`：13 項通過。
- `image-check.json`／`.txt`：24 格均非空、格邊透明、二值 alpha、≤64 色、動畫索引合法；行走、預警及攻擊均有多個不同姿勢。數值檢查不代表視覺流暢或攻擊判定正確。
- `preview-run.txt`、`preview-log.json`、`desktop-*`、`mobile-touch-*`：Chromium 桌面滑鼠及模擬手機只用 touch，按 JSON 的 frame 清單及 FPS 依次預覽預警→攻擊，檢查次序、名義間隔及最後畫面保持。這是獨立素材預覽，並非 Phaser 或真機。
- `game-desktop/`：第4關桌面控制及轉場 smoke 通過；透過狀態注入到測試點，瞓覺費用斷言按目前設定為 6。
- `game-mobile/`：第1關三款橫向手機模擬器 touch 控制 smoke 通過；同樣以程式到達場景。直向只測轉向提示。並非真人或實體手機完整通關。

## 未驗證／接入交接

素材尚未接入遊戲；第9關場景中的比例、警棍動作銜接、預警長度、位移、hitbox、遊戲效能、真人與真機均未驗證。現有 `Stage9Enemies.ts` 已另外建立矩形警棍佔位；Cursor 接入內置警棍的新圖時要避免雙棍，並支援 JSON 的 `frames` 清單。貼圖中每格下緣相同不代表遊戲世界位置或碰撞安全。此分支不改任何遊戲程式或玩法。
