# ART-20 回修複驗（2026-11-04）

## 結論

只讀對象為 Cursor draft PR #91 head `9c8d58ca6fa87cd24ba409ecb38810c5a6e1949e`、main 基底 `077af8b14b34b3e26d776e36705772fdd691639b`。回修 commit 相對 `7b198f7` 只改 `art-src/`；沒有修改 Cursor 分支、合併或部署。原始問題及舊版證據保留在上一層 README。

**原圖切格問題已大幅改善，但仍未能視作整批遊戲整合驗收。** 訓練場繩圈外形待 Alan 決定；兩張中景的混合接縫有可見疊影；全部角色及 FX 未接到正式遊戲，步態仍需於真實玩法速度與場景驗證。

## 驗證結果

- 39 張指定角色／FX 原圖（包括 4 張 model sheet）均可按 manifest 整數等分，每格均有前景；格界及外圍沒有偵測到前景接觸、沒有原圖半透明像素，亦沒有色鍵附近的非精確洋紅雜點。角色各套格高、腳底資料一致；CSV 為機械篩查，不能單憑數字證明每格動作美術合理。每格原圖最多 61 色，包含洋紅背景；即最多 60 個前景 RGB 色。見 [量度](sprite-measurements.csv)及 `check-sprites.py`。
- `scan-warning`／`charge-warning` 現為 manifest 指定的左右兩格；`whip` 試切圖不見原有全高分格線。蜜僵胸前有空白牌。目視沒有看到字／品牌，不代表全面版權或全部圖的人工鑑定完成。
- [走廊接縫](corridor-mid-join-focus.png)及[訓練場接縫](training-mid-join-focus.png)比原版硬切平順，但混合區可見重影，特別是訓練場木箱及繩；不能只以接縫色差當美術合格。接縫平均 RGB 色差分別約 4.01／4.51，完整算法及其他數據見 [量度](background-metrics.json)。訓練場繩圈形狀似吊頸繩，已向 Alan 問保留還是改掛鉤／盤繩；在決定前不自行改圖或當已批准新造型。
- 使用 repo 現有切圖器做**隔離試切**，四個角色共 98 格及六組 FX 無程式例外；獨立 Phaser 6 fps 素材預覽中，桌面及模擬手機都觀察到四角色及兩組 FX 幀索引變化，無 pageerror／console error／HTTP 失敗，見[桌面](preview-desktop.png)、[手機](preview-mobile-landscape.png)及 [browser JSON](preview-browser-report.json)。尺寸及速度僅作預覽；不是遊戲實際接線或真機。幀索引改變不代表保安與蜜僵左右步態在實際速度下已合格。
- 舊切圖器的**試用輸出仍不符像素規格**：四組角色 atlas 分別有 8,219／8,191／9,942／5,833 個半透明像素；25／38／22／13 格的可見色均超 64。順序為保安／洗地機／馴獸師／蜜僵。此問題屬所測**衍生流程**，不可誤指原圖仍超色，也不可直接接用這批試驗輸出。
- 另用 `direct-slice.py` 作等格、精確洋紅去背、最近鄰縮圖的獨立試驗：39 張圖、所有輸出格均二值 alpha 且最多 64 個可見 RGB 色；詳見 [JSON](direct-slice-report.json)及 [log](direct-slice.log)。輸出尺寸只是試驗值，不是已批准的角色比例；仍需結合各動作、腳底錨點及遊戲碰撞／節奏驗證後才接入。
- `npm run build`（含 tsc、Vite）及 `npm run validate:data` 在隔離快照通過，見 [build](build.log)／[data](validate-data.log)；只證明既有程式和資料格式，**不驗新素材整合**。

## 尚欠

1. 等 Alan 決定訓練場繩圈；兩張中景疊影是否回修需跟 Cursor 跟進。
2. 在 Manus 分支接入可重現、符合 alpha／色數規格的實際 runtime 管線與資料，驗證角色／FX 全動作、尺度、腳點及真實步速；勿使用這次隔離預覽圖當正式輸出。
3. 第7關 A–E 場景定位、static 無碰撞／傷害、Boss 鏈網警告及預警安全、完整 1P／2P 路程、真機及真人均未驗證。第7關 #88 的其他阻塞以其 QA 為準。

## 重現

- 素材快照需固定 `9c8d58ca6fa87cd24ba409ecb38810c5a6e1949e`。原圖切格：`python3 check-sprites.py`（腳本記錄快照及輸出路徑，須安裝 Pillow、NumPy）。中景量度：`python3 inspect-stage7.py`；兩個腳本均只寫 `/tmp/qa-art20-fixed/`。
- 直接等格試驗：`ART20_ROOT=/path/to/detached-snapshot ART20_OUT=/tmp/art20-output python3 direct-slice.py`，使用 Pillow 和 NumPy，**不修改原圖**。既有切圖器參數、6 fps 預覽頁及原始衍生圖留在沙盒 `/tmp/qa-art20-fixed/integration/`，不入 Cursor 原分支或遊戲。
