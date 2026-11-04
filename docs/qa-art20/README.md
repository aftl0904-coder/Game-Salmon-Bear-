# ART-20 素材 QA 與回修清單

## 範圍與結論

- 測試對象：Cursor draft PR #91，head `7b198f735ebebfa14c5d07aa7388681745ade7e5`，基底 main `077af8b14b34b3e26d776e36705772fdd691639b`。本 QA 只讀素材，沒有更改 Cursor branch。
- 50 張 PNG、manifest 欄位及清單均存在，39 張為角色／FX（含 4 張 model sheet）、11 張為第7關背景／props；所查第7關招牌及編號牌留白。清單齊不等於切格、動畫或場景驗收合格。
- **未通過，不可直接整批接入遊戲。** 已確認的三個角色基本造型可辨，不要求改造型；請修正下列技術問題，不需要重畫結局圖。
- 第7關 #88 不等回修，暫維持現有佔位；修好素材後另做接入及獨立 QA。三項第7關文字仍「待補」。

## Cursor 回修清單

1. **等格、跨格、錨點**：各角色各動作要可分成整數等寬、同角色一致畫布與腳底基線；每格主體及繩／刷完整、不進鄰格。14 張 1280px 三格圖不可整數等分、17 張的名義切線有非底色前景跨界；3 格圖不整除不等於三個人物都壞，可用補邊／重新排版修正，勿盲目重畫全部。量度和檔名見 `sprite-measurements.csv`。優先檢查：
   - 保安 `warning.png`、`attack.png`、`defeat.png`；`idle.png`、`walk.png` 與其他動作的大小、基線與站位；步行四格需看得出左右交替。
   - 洗地機 `model-sheet.png`、`idle.png`、`warn-charge.png`、`brush-spin.png`、`defeat.png`；檢查各動作機身尺寸、基線與刷子完整性。
   - 馴獸師 `point.png`、`rain.png`、`shield.png`、`defeat.png`，特別是繩跨格及動作間大小落差。`rain` 的起手／出招／回收要能配合獨立鏈網 FX，不能因美術另加盾牌機制。
   - 產品化蜜僵 `die.png` 的鏈及身體跨格；`walk.png` 的左右步態需可辨；補清楚可見、完全留白的獨立編號牌。
   - 馴獸師 FX `chain-net.png` 有跨格，`whip.png` 有兩條全高深色分格線；移除畫在圖內的線及清除跨界。格數和方向參考 ART-20。
2. **洗地機警示 FX 軸向**：`fx/c2-mall-scrubber/scan-warning.png` 及 `charge-warning.png` 原圖各為上下兩格，但 manifest 寫左右 2 列；現有 FX slicer 以左右方向切，已確認切錯。請按原 brief 排成左右等格、去除分隔線並核對 manifest，修完再試切。`brush-warning.png` 未見同一軸向錯誤。
3. **中景接縫**：`props/stage7/corridor-mid.png` 同 `training-mid.png` 左右平鋪有牆、地板、欄杆或繩索硬切；修到兩張並排時可自然接駁。量度見 `background-metrics.json`，目視證據見 `corridor-seam.png`、`training-seam.png`。A 遠景沒有清楚籠裝動物，但已有獨立籠道具；實際擺位待整合，不因此要求重畫 A。
4. **像素輸出**：本次試切的 98 個角色幀全超過 Bible 的每 sprite 64 色基準，四個角色 atlas 均有半透明像素；原圖色數與經 normalize 的 runtime 色數要分開看。最終接入前應透過合適處理／必要回修，驗證每 sprite ≤64 色與二值 alpha，並在目標顯示尺寸下檢查輪廓與文字留白。見 `per-frame-colors.txt`、`transparency-audit.txt`。
5. **不改設計**：保安深藍制服及帽、洗地機銀灰深藍及前置鏡頭／轉刷、馴獸師棕綠工作服和鞭／繩維持 Alan 已確認方向；素材中不加字、數字、標誌或品牌。場景固定籠、鏈、網不是攻擊物；程式標牌文字另處理。

## 已做檢查及證據

- 清單、manifest 對照及 39 張角色／FX 尺寸、切線與色鍵篩查：`sprite-measurements.csv`。由前景像素量度的跨線只是篩查，部分繩／散件須目視；三格切線以接近整數位置示意，並非宣稱正式 runtime 的捨入方法。審查示例：`trainer-grid-review.png`、`scrubber-fx-review.png`、`trainer-fx-review.png`；圖中標題與切線只屬 QA 標註，不在原素材內。
- 11 張場景及 props 檔名與畫布存在；兩張中景各以原圖並排檢查。招牌目視留白，未見可辨品牌／字樣。僅憑目視、Git 差異或清單聲明，不能證明全批作品著作權或完全原創。
- 以既有 slicer 在獨立目錄試切四組角色和六組 FX，並用獨立 Phaser 預覽檢查桌面及模擬手機的幀索引有變：`preview-desktop.png`、`preview-mobile.png`、`preview-browser-report.json`。這是**素材預覽，不是遊戲整合**；幀索引會變不等於畫面切對。試切記錄 `slice-retry.log`、尺寸記錄 `cut-risk-audit.txt`。
- 相同素材快照 `npm run build`（tsc + Vite）及現有 9 項 `validate:data` 通過：`build.log`、`validate-data.log`；二者均不驗證新素材、遊戲內整合或第7關玩法。

## 未驗證

新圖尚未接進實際遊戲，未測正式 runtime 的完整動作、實際比例、碰撞與警示、A–E 場景位置及手機真機／真人遊玩；道具的最終裁切與縮放亦待驗。第7關 #88 其他 QA 狀態以其自己的 `docs/qa-c2s2/` 為準。
