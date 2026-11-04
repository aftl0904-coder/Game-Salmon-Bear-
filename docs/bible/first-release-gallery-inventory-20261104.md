# 第一版角色集：盤點與已確認設計（2026-11-04，draft checkpoint）

本分支從重新 fetch 的 main `077af8b14b34b3e26d776e36705772fdd691639b` 開始；確認原文見 `first-release-confirmations-20261104.md`。封面三入口，按「好／壞（對戰時身份）」分組；角色和動作不設進度鎖，容許劇透。每名一個正常及兩個不同特別動作，缺圖不可複製另一動作冒充。此稿**不代表第一版完成**。

## 依據和排序

`src/game/galleryData.ts` 是現行草稿列表及三個欄位狀態；登場順序以已在 main 的封面／C1 演出、`data/levels/stage1.json` 至 `stage6.json` 的實際擺位、Boss 與 `GameScene.ts` 的第一個存檔攤檔為準。正文提及但角色未在畫面出現，不當作首次實際登場。開場三主角同時視作封面登場，倫寶、琪寶寶、噗噗以封面畫面排序。朋友、攤主、敵人各關按 x 位置排序；地圖平行支線、鏡頭視野及不同出生點令跨類別的確切首次畫面可能有變，此名單採主線由左至右順序，尚需人工複核，不宣稱精確到實際每個螢幕幀。小蜂、蛋於女王戰中由 Boss 產生；先列女王，再列小蜂、蛋。首現無法在 main 排定者放在有確定順序之後且明示。

**好（20，包括身份待核候選）**：倫寶、琪寶寶、噗噗、咖啡媽媽；第1關熊仔、英國熊；第2關夾餅叔叔、小熊仔、招積熊；第3關蛋撻哥哥、柴柴、北極熊；第4關開椰青的泰國人、薑餅、大pat熊；第5關喵仔、刺身師傅、聖誕伯伯、虎仔。末列「結局守護者（待確認）」，見 `data/ending-c2.json` 及 `public/art/story/ending-c2-05.png`／`08.png`；其身份、是否和已列角色重複不能猜，只有結局合照尚無獨立動作圖。`data/levels/stage3.json` 先 shiba 再 snowcat；stage5 先 kuro 再 gnome 再 tigercub，舊 Bible 列表次序不覆蓋實際配置。咖啡媽媽在 C1 出場，stage6 `data/stalls.json` 再次使用同一名稱，但 `keeperTex()` 在無 keeper6 時 fallback 到 mama。

**壞（25，包括未上線候選）**：第1關紅魚、帽仔兵、機械豬、武者王；第2關蜜蜂兵、蜜僵松鼠、蜜冠女王蜂、小蜜蜂、假蜜蛋；第3關龍蝦兵、油甘魚攤主（敵人，並非蛋撻哥哥）、鏡影雜兵、月橋鏡鴞；第4關蜜僵、打卡鐘怪、的士怪、泥鬃；第5關 △畝大佬；第6關保安、輸送機械臂、商場保安總監、其 Boss 戰召喚的巡邏無人機（`stage6World.ts` 的 `s6-drone`，只有靜態圖）。主線確認方案另有第6關商場清潔機械人、第7關馴獸師及產品化蜜僵，原圖在未合併 #91，不把它們算作已在 main 出場；為免漏報，草稿顯示為尾列候選，排序待 runtime 上線複核。假蜜蛋是會孵化的可打單位，保守列入待確認是否屬角色集；機械臂為固定敵人，同理保留。精英換色不是新角色。

Boss 故事來源 `data/bosses.json`：武者王面罩、蜜冠女王蜂皇冠、月橋鏡鴞鏡、泥鬃蜜印、現版保安總監制服有被控制根據；△畝大佬沒有。清潔機械人不推斷駕駛者或身世。雖舊 `story.md` 稱第一關無 Boss，但 `stage1.json` 與 `Stage1Boss.ts` 實際是武者王，依 runtime。武者王視覺借用帽仔兵，不表示同一人物；現版總監借用 △畝大佬，亦不表示同一人物。

## 別名與衝突

- `src/game/friends.ts` 明示 huihui＝熊仔（原灰灰）、guard＝英國熊（原阿兵）、denim＝小熊仔（原牛仔）、brownie＝招積熊（原啡啡）、snowcat＝北極熊（原雪糕，原設定貓改熊）、fleecy＝大pat熊（原毛毛）、kuro＝喵仔（原黑豆）。不可把程式的 `guard` 朋友同 stage6 保安 species `guard` 混為一人。
- `SPECIES_ANIM`／`enemies-tuning.md`：fish＝E-01 紅魚、barrel＝E-03 帽仔兵、elephant＝E-02 機械豬；舊的 `art-todo.md` 對應互相衝突，依 runtime。
- `art-src/anim/friends/giraffe`, `polar`, `patbear`, `stripebus` 有原圖但無 main roster ID／明確一一對應、無可確定首次出場；不猜它們與現行朋友是同人。列為**候選待確認**，未放進 UI，亦未測切格／版權。`berry`, `forest`, `bearcub` 有原圖但 `scripts/art/slice_friends.py` 明確因與現有作品近似而排除（bearcub 是未用重複）；不可接入，是否須另以原創角色替代請確認。此盤點不是法律鑑證。
- 舊 E-04 刺球、E-06 滾動怪資料在 `data/enemies.json`，但 `data/levels` 無該 species；E-04 等 `public/art/enemies/` 舊圖在 `art-detail-gaps.md` 標剪影佔位。是否視為獨立「已畫角色」需確認；不因為資料檔就猜它們與其他角色同一身份。關卡地刺／飛行道具亦不自動視作角色。
- #91 [ART-20](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/91) 未合併、未通過切格 QA；只記其存在，不導入或播放。main 的第6關 `GuardZombie` 是蜜僵換色加帽，與 Alan 確認的人類保安衝突；現版 Boss `securitydirector` 借用 triboss，確認方案改為獨立洗地機。分開列示，後者不是總監別名。未合併 #88 第7關不當 main 實作。

## 現有動作與限制

可播放的具名動作直接取 `data/anim/*.json`、`public/art/anim/*.png` 和 `heroAnims.ts` 既有 runtime frame；資料檔列每個完整動作集。畫面顯示的三個動作在 `galleryData.ts` 各自指向不同 animation，沒有重複充數；按鍵列只保留可實際播放者，其他顯示待繪／待切格。已有原圖不等於可播放：`scripts/art/slice_friends.py` 每位朋友只輸出一個靜態 idle frame，源 cheer/walk 原圖雖有，尚未切格驗收；四位攤主源 idle／serve 原圖亦非 runtime 動作 atlas。武者王沒有專屬圖；`lobster/snap.png` 有原圖但 runtime atlas 無 snap。咖啡媽媽與攤主平常是靜態圖，不冒充動畫。需求及精確缺口見 `ART-REQUEST-first-release-gallery-20261104.md`。

此 checkpoint 仍未完成：候選角色身份、完整原圖審核及順序仍需跟進；所有未切格素材、缺動作需逐一 QA 後再接入。玩家可以看到草稿角色及其已接入／未接入狀態，並非所有動作立即可看。此差距不可稱已完成第一版。
