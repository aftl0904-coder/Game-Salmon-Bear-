# 第9關鎖匠機械人：美術及 QA（2026-11-25）

## 交付

`public/art/stage9/enemies/s9lockbot.png` 是原創方身鎖匠機械人，身上有鎖頭及鎖鏈；24 格依次為企、行、擲鏈預警、擲鏈、受傷及倒下，每組 4 格。PNG 為 4224×704 RGBA，12 欄×2 行，每格 352×352、`res: 4`，邏輯格 88×88；待機可見高度約 55–56 邏輯 px。比第8關小兵格加闊，為保留擲出的鏈條，格式仍是透明 PNG atlas + 0-based 動作 JSON；Cursor 不可假設所有角色同一格寬。

原稿 1536×2304。因一格擲出的鏈條與隔離格機械人的橫向 bbox 重疊約 9 px，不能以垂直直線盲切；兩者的非透明輪廓並未連接，按每行四個獨立連通區分離，無丟棄碎片。全格共用同一縮放比例、素材底線、色盤量化及 nearest 放大 4 倍。來源、切割和 SHA-256 見 `source-report.json`；原稿只在暫存，未入 repo。素材底線不是遊戲內落地位置。

## 驗證及一次手機測試失敗

- `build.txt`：tsc + Vite 通過；`validate-data.txt`：13 項通過。`image-check.txt`／`.json`：24 格均非空、格邊透明、alpha 二值、≤64 色、動畫格號有效；行走、預警及攻擊有姿勢變化。
- `preview-run.txt`、`desktop-*`、`mobile-touch-*`：桌面滑鼠及模擬手機只用 touch 播放真實 JSON 的預警→攻擊，序列及名義計時通過；獨立預覽不是 Phaser 或真機。
- `game-desktop/`：第4關桌面控制及轉場 smoke 通過，有狀態注入到測試點。
- `game-mobile/` 首次測試：iPhone 13、Pixel 7 橫向通過；細 Android 橫向雙指同時行走及跳躍時，行走 `dx=51` 但 `jumpMinVy=0`，未通過。`game-mobile-retest/` 保留獨立重試：三款橫向機型均通過，細 Android `dx=99`、`jumpMinVy=-360`。首次失敗原因未查明，不能因重試通過就聲稱已修復或排除間歇問題；直向只測轉向提示。測試以程式到達遊戲場景，不代表完整通關。

## 未驗證／交接

新圖未接入遊戲，實際場景高度、預警辨識度、鏈條／現有 projectile 的銜接、hitbox、真人和真機未驗證。現行程式有獨立機械手及鏈條 projectile，Cursor 接入時要避免重複顯示、支援 JSON 明確 frame 清單，並確認各動作錨點。這次沒有修改遊戲玩法或手機控制。
