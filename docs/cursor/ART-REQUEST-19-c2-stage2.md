# ART REQUEST 19 — 大陸2第2關・森友展銷中心（內部第7關）

From: Manus → Cursor。按 Alan 已確認 `docs/bible/c2-stage2-brief.md`、`c2-stage2-answers.md`；本文件只交接美術，**不授權改動遊戲程式、數據或已凍結的 Cursor branch**。待 Alan 同意後由 Cursor 在自己新 branch 製作。先讀 `ART-REQUEST-02-animation.md`、`ART-REQUEST-05-stage4-5.md`、`ART-REQUEST-17-map-continent2.md`；保持同一 16-bit 像素、光源、比例及原創角色風格。

## 全部通用規格

- 精靈／props／FX 用純磁紅 `#FF00FF` 背景，等大小格子由左到右，動作一致朝右、腳同基線；清楚輪廓、不可有水印。橫向場景背景每層分開，可左右接駁。角色外觀每格一致。
- **所有圖片不含文字、數字、字母、商標、浮水印**；招牌和編號牌留空，遊戲程式另外畫字和數字。
- 純原創、不臨摹現實商標或現有作品；傷感但不血腥，與第6關同世界。素材先製作角色 model sheet，再以它作後續同角色各圖參考。
- 不覆蓋現有第6關圖。接受素材先存入以下 `art-src/` 路徑，追加 `art-src/anim/manifest.json`（file、frames、cols、rows、facing、prompt），一批一提交。只提交素材及 manifest；不改 `src/`、`data/`、`public/`，不跑產圖／處理 script。

## 1. 優先：馴獸師 Boss

目前只是第6關 `SecurityDirector` 的 `triboss` 動畫換色，並非已完成馴獸師圖。設計原創訓練場管理人，手持可辨識鞭／繩、輪廓明顯；無圖中文字、編號或標誌。以 `art-src/anim/boss/triboss/` 的角色尺寸、右向、基線和動作密度作比例參考，但不要畫成同一人物。

存 `art-src/anim/boss/c2-trainer/`：`model-sheet.png`；`idle.png` [4]、`point.png` [3] 鞭擊、`rain.png` [4] 發出鏈網、`shield.png` [4] 蓄勢、`hurt.png` [2]、`defeat.png` [5]。動作只供現有狀態機換皮，不設計新 AI 或新戰鬥規則。現有 runtime 格數詳見 `data/anim/triboss.json`，資產整合仍需程式方另做切格和檢查。

## 2. 產品化蜜僵及攻擊

參考 `art-src/anim/enemies/E-11-honeyzombie/`：同一原創蜜僵，身上可辨識籠框／束鏈及空白編號牌；不能變成固定背景或碰撞機關。存 `art-src/anim/enemies/c2-product-zombie/`：`model-sheet.png`、`walk.png` [4]、`reach.png` [3]、`hit.png` [2]、`die.png` [4]。一致方向和尺寸；不要畫字。

存 `art-src/anim/fx/c2-trainer/`：`whip.png` [3]、`chain-net.png` [3]、`chain-net-warning.png` [2]；輪廓清楚並與背景固定鏈網可視區分。預警及傷害時長由資料控制，圖本身不帶字。原有機械臂／保安仍沿用現有圖。

## 3. 背景與固定 props

存 `art-src/props/stage7/`：`entrance-far.png`（640×360，迎賓展廳、空白主招牌）、`corridor-mid.png`（左右可接駁，分類籠舍與空白牌）、`training-mid.png`（左右可接駁，訓練場）、`backstage-far.png`（640×360，較陰暗）、`arena-far.png`（640×360）。再提供各自獨立、無字的 `cage-animal.png`、`cage-empty.png`、`chain-static.png`、`net-static.png`、`number-plate-blank.png`、`sign-blank.png`。固定籠內動物只是靜態剪影；這些 prop 都不應做碰撞或傷害。

## 驗收／交付

先 push 獨立 art branch 並開 PR 交 Alan 審；無獲指定不 merge、不改其他人的 branch。程式方再負責切格、移除磁紅、校驗行動／受擊動畫及碰撞。D 段噗噗台詞、Boss 卡（名稱／稱號／三行）及離隊提示 **均為「待補」**，不在圖裡擅自補寫；返隊時間未定。
