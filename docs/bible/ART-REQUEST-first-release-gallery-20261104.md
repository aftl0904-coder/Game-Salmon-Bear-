# ART REQUEST — 角色集缺失動作與切格（2026-11-04，draft）

Alan 授權按角色設計原創缺失動作；此文件只係交接，不能更改別人的 `cursor/` branch。Cursor 自己由最新 main 開獨立新 branch，素材只放 `art-src/` 與 manifest；不改 `src/`／`data/`／`public/`，不覆蓋 #91。若已有相同動作原圖，先檢查／修切格而非重畫或重複索取。本清單供 checkpoint 起步，角色身份與未出場項待 `first-release-gallery-inventory-20261104.md` 複核。

## 全局規格及驗收

只用自創、無品牌、無商標、不模仿任何既有角色／作品。圖片內**無任何文字、字母、數字、水印或商標**。沿 `docs/cursor/ART-REQUEST-02-animation.md` 和 `docs/bible/visual-style.md`：16-bit 原創像素、左上光、面朝右、純 `#FF00FF` 底、固定原角色造型及比例、等格、格間留白、同角色同基線；每動作建議 3–5 個真正不同連續動作幀（下表定出 3 或 4 格），不要用同一動作複製兩次。每個素材記錄路徑、格數、cols、rows、方向、提示詞；交圖前檢查每格整除、人物完整、無跨格／錯向／底線漂移；Manus 另做去背、normalize、<=64 色及二值 alpha、動畫連續性、桌面／模擬手機 QA。禁止把原圖存在稱作已切格合格。別畫文字或新增劇情／能力設定。

## A. 明確缺失：每行一張全新、不同動作 PNG

| 角色（參考） | 原創檔案及動作，均依原角色尺寸／色板 | 格數 |
|---|---|---|
| 咖啡媽媽（`art-src/props/` 的 mama／`public/art/props/mama.png`） | `art-src/anim/gallery/mama/serve.png` 雙手遞咖啡；`wave.png` 空手招呼，輪廓不同 | 每張 4 |
| 夾餅叔叔、蛋撻哥哥、椰青泰國人、刺身師傅（各自 `art-src/anim/stalls/{waffle,tart,coconut,sashimi}/model-sheet.png`） | 各建 `<id>/gallery-wave.png`：各自在攤前空手招呼，不等於已有 serve；4 個角色各一張 | 每張 4 |
| 北極熊 `snowcat`、薑餅 `ginger`、大pat熊 `fleecy`、聖誕伯伯 `gnome`（各 `public/art/friends/<id>.png` 及其 source idle，按現行造型，不套用未確認別名） | 各 `art-src/anim/gallery/friends/<id>/cheer.png` 歡呼舉手跳；`walk.png` 短步行走；4 人各 2 張 | cheer 3，walk 4 |
| 武者王（現版借用帽仔兵；`Stage1Boss.ts`、`data/bosses.json`） | `art-src/anim/gallery/warriorking/model-sheet.png` 原創守蜜武者，參考現版角色及面罩但與普通兵可分辨；`idle.png` 企定、`throw.png` 擲桶、`dash.png` 衝刺（不是同一組） | model 單張；各動作 4 |
| 蜜僵松鼠 `art-src/anim/enemies/E-06-zombiesquirrel/` | `art-src/anim/gallery/squirrel/look-around.png` 緩慢警戒轉身，與 lunge 不同 | 3 |
| 小蜜蜂 `art-src/anim/enemies/E-07-minibee/` | `art-src/anim/gallery/minibee/dive.png` 俯衝、`alert.png` 原地警戒盤旋，與 fly 和彼此不同 | 各 3 |
| 蜜僵 `art-src/anim/enemies/E-11-honeyzombie/` | `art-src/anim/gallery/honeyzombie/stagger-turn.png` 踉蹌轉向，與 reach 不同 | 3 |
| 輸送機械臂 `public/art/props/s6-robotarm.png` | `art-src/anim/gallery/robotarm/aim.png` 機械臂預備瞄準，`fire.png` 釋放既有高／低投射物的前後動作；固定底座 | 各 4 |
| 巡邏無人機（`public/art/props/s6-drone.png`） | `art-src/anim/gallery/drone/lock.png` 鏡頭鎖定、`fire.png` 向下發射，兩者不同 | 各 4 |
| 結局守護者（`public/art/story/ending-c2-05.png`、`08.png`） | 身份和與現有角色是否重複先確認；若確為獨立角色，參考已確認造型另畫 `art-src/anim/gallery/guardian/{idle,wave,hug}.png`，分別為正常、招手、擁抱，不新增身世 | 各 4 |
| 產品化蜜僵（#91 的 `art-src/anim/enemies/c2-product-zombie/model-sheet.png`，只讀參考） | `art-src/anim/gallery/product-zombie/strain.png` 挣扎拉緊但不自行解開籠鏈，空白牌，與 reach 不同 | 4 |

`securitydirector` 現版由 triboss 借圖，已確認方案以洗地機替代，是否仍需獨立角色集圖待身份／範圍確認；不擅自畫成洗地機的駕駛員，亦不將二者當別名。#91 人類保安、洗地機、馴獸師、產品蜜僵已有對應動作原圖，**先修復 QA，勿重畫當缺圖**；其製作規格見 `ART-REQUEST-20`。馴獸師 Boss 卡文字依舊待補。

## B. 原圖已有，先切格 QA，不請重畫

- 朋友 `huihui`, `guard`, `denim`, `brownie`, `shiba`, `kuro`, `tigercub` 各 `art-src/anim/friends/<id>/cheer.png` [3]／`walk.png` [4]；先確認人物、格數、可分割、與 runtime 配色一致。部分原圖為不均勻排列；只取一幀的現有 `slice_friends.py` 不等於全動作合格。虎仔沿已審的原創新版本，勿用舊侵權近似圖。
- 攤主 `waffle`, `tart`, `coconut`, `sashimi` 的 `art-src/anim/stalls/<id>/serve.png` [4]。原 idle／serve 不均勻間距，先檢查後切。
- `art-src/anim/enemies/E-08-lobsterguard/snap.png` [4] 已有原圖，但 `data/anim/lobster.json` 無 snap；先檢查切格而非當已可播放。
- #91 `c2-human-guard/{idle,attack,recover}.png`、`c2-mall-scrubber/{idle,charge,brush-spin}.png`、`c2-trainer/{idle,point,rain}.png`、`c2-product-zombie/{walk,reach}.png` 是未驗收原圖：遵照 #91 回修，任何切格／顯示／版權檢查全部通過前仍標待驗收；不修改 Cursor 分支。

以上動作旨在角色集欣賞，不新增遊戲戰鬥機制；未列入候選仍須完整盤點後追加，這份稿不是第一版驗收或美術完成證明。
