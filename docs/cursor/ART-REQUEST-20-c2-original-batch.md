# ART REQUEST 20 — 大陸2第6／7關原創素材集中批次

From: Manus → Cursor；2026-11-04。基於 main `077af8b`。**一次集中交清單，不是授權修改遊戲；所有未確認設計一律先停，唔好自行開畫定稿。** 本文件整合第6關新指示及第7關 `ART-REQUEST-19-c2-stage2.md`，後者只存在於 #88 `manus/c2-stage2-20261104`，**#88 是未合併 draft**，不是 main 已交付素材。確認狀態以 Alan 說法、已合併 Bible 為準；#88 的 art request 作美術規格來源，不代表 #88 已通過 QA 或合併。

## 開工與交付規則

- Cursor 由開工時重新確認的最新 `origin/main` **自行開一條全新的、獨立 Cursor art branch**；不得覆蓋或編輯任何現有 `cursor/` branch，亦不在 Manus 文件分支工作。若 #20 尚未合併，以 Alan 提供的本文件和 #88 只讀文件作手稿；不得 merge #88 來取文件。
- 只交本批 `art-src/` 圖及需增加項目的 `art-src/anim/manifest.json`（file、frames、cols、rows、facing、prompt）與一份素材清單；**不改 `src/`、`data/`、`public/`、其他人檔案，不跑產圖／切圖／整合 script**。推送自己的新 branch，開獨立 draft PR 供 Alan 審；不自行 merge／close。不同項目可分 commit，但同一條新 branch 一次交付；配額有限就記錄缺項，勿以未完成冒充完成。
- 所有 PNG 原創，16-bit 像素、左上光、輪廓清楚；不可臨摹真實品牌、商標、警隊／公司制服或現有作品角色。**所有圖零文字、字母、數字、標誌、水印**，招牌／編號牌留白，由遊戲另行處理。無血腥。
- Sprite／prop／FX：純磁紅 `#FF00FF`，同角色各動作等格大小、左右一致、動作由左至右、朝右、腳／車輪同基線、格間不重疊；model sheet 先作設計基準。背景層獨立，mid strip 左右可接駁。參考 `docs/bible/visual-style.md`、`ART-REQUEST-02-animation.md`，內部 640×360，小／中敵人約 40／56 px、Boss 約 128px+；以現有角色切格的比例、同一畫布／格尺寸及基線為準；輸入圖不得偽造已完成的 runtime 切格。遊戲整合與移除磁紅另由程式方做。
- `[n]` 是每張橫向 sheet 的格數；以下第6關格數／路徑只是**交接建議，不是 Alan 確認或授權實作的數值**；第7關格數引自 #88 art request。路徑如與已交付檔案撞名先停並報告，不可覆蓋。

## 優先序總表

| 優先 | 狀態及可以做甚麼 | 來源 |
|---|---|---|
| P0 | **可先畫第7關原創馴獸師、產品化蜜僵、鞭／鏈網 FX、A–E 背景及靜態 props**，按 §1 已有 brief；完成仍需 Alan 審美術。不能補任何未定對白。 | main `c2-stage2-brief.md`、`c2-stage2-answers.md`；未合併 #88 的 ART-19 素材規格。 |
| P1 | 第6關人類保安及大型洗地機的身份、原創要求、洗地機鏡頭／轉刷、偵測預警及攻擊方向已確認；**制服／機體設計、顏色與具體動作未獲確認，§2 列完整待畫清單但先停，請 Alan 拍板後才按核准版本開畫。** | Alan 本次指示；`docs/bible/c2-stage1-security-cleaner-proposal.md`。 |
| 核對 | 其他舊請求及第8–10關只列 §3，不可擅自開畫、重畫或把有檔名當批准。 | main 實際樹及各舊 brief。 |

## 1. 第7關（大陸2第2關）——可先畫的已確認素材

設計及動作規格來源：`/tmp/salmon-c2-stage2-impl/docs/cursor/ART-REQUEST-19-c2-stage2.md`（#88 的未合併檔；如 Cursor 無法看到該路徑，可依本節，不需要 checkout 或修改 #88）。延續 main 的 `c2-stage2-brief.md` / `c2-stage2-answers.md`：籠／鏈／網是靜態布景，Boss 的飛行鏈網才是攻擊 FX。所有名稱下的檔案皆為**PNG 原圖**。無任何物件需要改程式或數據。

### P0-A 馴獸師 Boss，原創角色，非第6關洗地機

`art-src/anim/boss/c2-trainer/`；大小、朝向、基線、動作密度參考現有 `art-src/anim/boss/triboss/` 及 `data/anim/triboss.json`（只參考切格，**不可畫成同一人物**）。原創訓練場管理人，鞭／繩輪廓可辨；具體色彩、服裝細節待 Alan 確認，若沒有足夠清楚的設定，先提交待確認，不自行定案。

| 檔案 | 動作／用途 | 優先 |
|---|---|---|
| `model-sheet.png` | 訓練場管理人正面／側面／背面／3⁄4，一致角色外觀錨點 | P0-A1 |
| `idle.png` [4] | 待機、呼吸；Boss 常態 | P0-A2 |
| `point.png` [3] | 發動鞭擊的起手／出手／收勢，鞭身可辨 | P0-A2 |
| `rain.png` [4] | 發出鏈／網攻擊的起手、出招、回收 | P0-A2 |
| `shield.png` [4] | 蓄勢動作；不自行新增盾牌機制 | P0-A2 |
| `hurt.png` [2]、`defeat.png` [5] | 受擊、打敗後動作；不帶文案 | P0-A2 |

### P0-B 產品化蜜僵及攻擊 FX

參考原創 `art-src/anim/enemies/E-11-honeyzombie/`；同一蜜僵加可辨識籠框／束鏈及**空白編號牌**，仍是敵人不是固定背景，格尺寸／方向參考原蜜僵。

| 檔案 | 動作／用途 | 優先 |
|---|---|---|
| `art-src/anim/enemies/c2-product-zombie/model-sheet.png` | 敵人造型錨點，標牌空白 | P0-B1 |
| 同目錄 `walk.png` [4]、`reach.png` [3] | 行走；伸手攻擊 | P0-B2 |
| 同目錄 `hit.png` [2]、`die.png` [4] | 受擊；倒下 | P0-B2 |
| `art-src/anim/fx/c2-trainer/whip.png` [3] | 獨立鞭擊效果 | P0-B3 |
| 同目錄 `chain-net-warning.png` [2] | 鏈網傷害前的醒目警示；與靜態鏈網區分 | P0-B3 |
| 同目錄 `chain-net.png` [3] | Boss 飛出或展開的獨立鏈網 attack FX，輪廓可辨 | P0-B3 |

### P0-C A–E 背景與靜態 props

全部存 `art-src/props/stage7/`；以下均為 PNG：

| 檔案 | 用途／畫面 | 規格 | 優先 |
|---|---|---|---|
| `entrance-far.png` | A 迎賓展廳，主招牌留白 | 640×360，遠景 | P0-C1 |
| `corridor-mid.png` | B 分類籠舍與空白牌 | 中景 strip，左右接駁；尺寸沿現有中景規格 | P0-C1 |
| `training-mid.png` | C 訓練場 | 中景 strip，左右接駁；尺寸沿現有中景規格 | P0-C1 |
| `backstage-far.png` | D 較陰暗後台 | 640×360 | P0-C1 |
| `arena-far.png` | E 馴獸師 arena | 640×360 | P0-C1 |
| `cage-animal.png`、`cage-empty.png` | 籠中動物固定剪影／空籠 | 單獨靜態 PNG；尺寸匹配現有 `stage6/` props 與 640×360 畫面 | P0-C2 |
| `chain-static.png`、`net-static.png` | 場景固定鏈／網，不是 attack FX | 各一獨立靜態 PNG，尺寸沿現有 props | P0-C2 |
| `number-plate-blank.png`、`sign-blank.png` | 空白編號牌、招牌；遊戲另畫字 | 各一獨立靜態 PNG，牌面不得有數字或字 | P0-C2 |

第7關原有機械臂／保安沿用何圖，以 #88、main 及 Alan 決定為準；**不把第6關新 Boss 或人類保安替換第7關馴獸師／確認行為**。D 段噗噗反應＝**待補**；馴獸師 Boss 卡＝**待補**；離隊提示＝**待補**；不可畫入文字、不可寫三項內容。

## 2. 第6關——待 Alan 拍板後才開畫的完整清單

Alan 已確認**人類保安（不是蜜僵換色）**及**大型洗地機 Boss（鏡頭、轉刷、先預警再衝撞或近身轉刷、每輪反擊空檔、後期可避）**；但下列具體外觀、色彩、動作表和格數都只是工作建議、不是已批准設計。**下列不作 P0 開畫項目**。先請 Alan 確認制服顏色／配件與攻擊方式，以及洗地機大小輪廓、輪組／鏡頭／刷子布置、主色、預警圖形、攻擊／恢復動作；不假定控制者或人藏在機器內。

### P1-A 人類保安（待確認）

建議位置 `art-src/anim/enemies/c2-human-guard/`，PNG 原圖，尺寸與現有中型敵人切格兼容；左右向及腳基線一致。應以原創人類步伐、自然站姿區別 D 段蜜僵；不再用蜜僵動畫加色或加帽。裝備、面孔、髮型、制服、手勢／是否持武器待 Alan 決定。

| 建議檔案 | 供確認的用途／pose | 擬議格數、優先 |
|---|---|---|
| `model-sheet.png` | 全身正／側／背／3⁄4，角色比例和制服錨點 | 單張；P1-A1 |
| `idle.png` | 巡邏間待機／呼吸，站姿自然 | [3]；P1-A2 |
| `walk.png` | 人類正常步行，鞋落同一地平線 | [4]；P1-A2 |
| `detect.png` | 注意到玩家，轉頭／站定 | [3]；P1-A2 |
| `warning.png` | 已選定攻擊方向的清晰前搖 | [3]；P1-A3 |
| `attack.png` | 近身攻擊，招式／手持物須另確認 | [3]；P1-A3 |
| `recover.png` | 收勢、露出可反擊的站姿 | [3]；P1-A3 |
| `hit.png`、`defeat.png` | 受擊後退；非血腥倒下 | [2]／[4]；P1-A3 |

### P1-B 洗地機 Boss（待確認）

建議位置 `art-src/anim/boss/c2-mall-scrubber/`，PNG 原圖、可辨商場大型洗地機；參考 Boss 128px+ 及現有 `triboss` 切格／基線，非沿用人物角色；同一造型的鏡頭及轉刷在各幀的位置一致。**下列動作只說明可讀圖像，不批准招式速度、判定、階段或故事。**

| 建議檔案 | 供確認的用途／pose | 擬議格數、優先 |
|---|---|---|
| `model-sheet.png` | 正／側／背／3⁄4，鏡頭、刷子及整台機器的輪廓基準 | 單張；P1-B1 |
| `idle.png`、`move.png` | 機器待機／輪組移動 | [4]／[4]；P1-B2 |
| `scan.png` | 掃描鏡頭朝向玩家、停止及鎖定 | [3]；P1-B2 |
| `warn-charge.png` | 衝撞前的方向預警、機身蓄勢，非攻擊有效幀 | [3]；P1-B3 |
| `charge.png`、`charge-stop.png` | 向既定方向衝撞；停下，不附帶人物 | [4]／[3]；P1-B3 |
| `warn-brush.png`、`brush-spin.png` | 近身轉刷前預警及刷子轉動 | [3]／[4]；P1-B3 |
| `recover.png` | 刷子停止／機身停穩，反擊窗口清晰 | [3]；P1-B3 |
| `hurt.png`、`defeat.png` | 受擊、機器安全停機；不畫人或被控制解除 | [2]／[5]；P1-B3 |
| `art-src/anim/fx/c2-mall-scrubber/scan-warning.png`、`charge-warning.png`、`brush-warning.png` | 分開鏡頭掃描、衝撞方向與刷範圍提示；預警圖不得單靠顏色區分 | 各 [2]；P1-B4 |

## 3. 只供核對，暫不開畫

- **已交付，不重畫**：main 有 `art-src/story/ending-c2-01.png` 至 `ending-c2-10.png`，#85 已合併；第6關 `art-src/props/stage6/` 的圓頂、商場／工場遠景及 props 已存在，地圖 #67、電風扇 #73 及 #77 已合併；不重畫這些舊素材或已確認圖片。`ART-REQUEST-16` 的 `charge-aura.png`、`ult-salmon-wave.png`、`ult-honey-slash.png` 原圖在 main，毋須再畫。
- **確有缺檔但批准狀態未明，不可重畫或自動批准**：main 無 `ART-REQUEST-15` 的 `art-src/props/gear-overlay/{helmet,armour-chest,boots-cuff}.png`、`art-src/story/{town-inn,town-gamble}.png`、`art-src/props/gamble/{dice,dice-cup,gamble-mat}.png`。舊 brief #55 已入庫不等於 Alan 本次批准其設計；先核對其他交付或是否仍要做。第4–5關 tactical variants 在 repo 沒有（`docs/qa-fan/ASSET-CHECKLIST.md`），但 ART-14 的紙扇已被電風扇決定取代；整套是否仍要做及動作細節待核對。舊 art-todo／舊 requests 的 placeholder 或缺檔不代表仍欠「已批准」圖。
- **第8–10關**：只有地圖名稱／概念，不等於分關設計 brief；人物、Boss、故事、背景與動作都待 Alan 確認，未有 brief 不開畫。
- 第6關新增開場已交另一 agent 實作；不改該 branch 或其檔案，不替開場追加未批准畫面／台詞。先問 Alan 批第6關的色彩、造型和動作細節；第7關已有結構可先交原創素材，仍應審視畫面是否忠於 brief。
