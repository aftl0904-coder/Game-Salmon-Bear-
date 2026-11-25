# 第8關動畫修訂 checkpoint（2026-11-25）

**未完成；#157 應維持 draft。** Claude 已確認原來造型及預警，要求文件櫃手臂／轉招、主任動作銜接及腳底基準修好後才轉 ready。本次只保存部分改善，不能當成已解決或准許 Cursor 正式接入的最終稿。

## 文件櫃

- 最終工作樹的 24 格候選是 `public/art/stage8/enemies/s8cabinet-draft.png` 和旁邊 JSON。預警 3、4 格將右臂顯示在開門前，兩格的手勢不同；攻擊 1、2 格由開門變半關，後接原攻擊。攻擊 1、2 的門／櫃內局部經 AI 編輯並映射原色盤；預警 3 重用原角色像素，預警 4 使用另一輪 AI 編輯的手臂局部。
- **仍阻塞：**手臂根部仍貼近門鉸，連接透視不夠清楚；預警 4→攻擊 1 身體由直立急轉前傾，仍有姿勢跳變。一次另畫前傾中間格失敗，沒有將它當完成格接入。原攻擊第 3 格約 3.44 邏輯 px 水平補償及來源縮圖細節限制仍在。
- `cabinet-contact.png` 是實際 8 格；`cabinet-exact.apng.png` 是同一組逐格連播，預警每格 250ms、攻擊每格 125ms，符合 metadata。循環回第一格只是方便預覽，並不代表遊戲連招設計。

## 主任研究員

- 最終工作樹的 40 格候選是 `public/art/stage8/enemies/s8researcher-draft.png` 和旁邊 JSON。原 40 格全部下移 2 sheet px：最低可見行由 y=200 改為 y=202。第7關目前 runtime 使用染色 `triboss` 佔位，待機腳底可見行同樣 y=202；兩者 172×204／res2，假設 origin `(0.5,1)`、scale1 時，鞋底可見下邊緣均離格底 0.5 邏輯 px。倒下格最低點未必是鞋，不能一律稱腳底。`researcher-baseline.png` 有直接比較；這是素材幾何比對，**不是 Phaser 地面測試**。
- 拋瓶原 index 17、18 的人物連通區作水平補償；飛瓶及軌跡保留原像素，但其中一格相對人物上移，兩格飛瓶位移仍不明顯。角色下半身相鄰最佳配準水平位移由最多 29 降至 1 sheet px；配準數值不保證自然。飛瓶已畫進 atlas，接獨立 projectile 時必須避免重複。metadata 的 `anchorY=203` 是圖內可見底邊的交接記錄，現有程式沒有自動讀取它。
- **仍阻塞：**板預警最後格直接接掃擊第一格，板位和姿勢仍突跳；掃擊及補瓶接回 idle 也未修好。`researcher-board-unfixed.gif` 是實際保留的 40 格候選，不代表成功。橫掃與補瓶可讀性、交原稿場景配合亦仍待核實。
- 另試畫 6 個中間格，分別見 `researcher-experiment-1-NOT-FINAL.*` 和 `researcher-experiment-2-NOT-FINAL.*`；**兩者均未採用，不能接入遊戲**。各自 `*-board.gif`、`researcher-experimental.png`、`researcher-experimental-retry-contact.png` 保留失敗對照：人物面貌、衣袖、鞋、板大小及握法漂移，部分轉場亦未自然。試驗從 40 格變 46 格，板掃額外 0.625 秒、補瓶額外約 0.167 秒；若重新設計轉場，接入方亦須另驗事件時序，不能假設攻擊判定同步。試驗不是目前 runtime 素材。
- 第7關佔位 Boss 待機可見高度約 100 邏輯 px，主任約 71；對齊腳底並不是對齊身高。主任 at scale1 仍低於風格表 Boss 128px+；整數 scale2 理論約 142px，但未驗證場景比例、錨點及碰撞。

## 技術檢查與驗證邊界

- `image-check.json`：文件櫃 3072×704、24 格、63 色；主任 1720×816、40 格、64 色。兩張均 RGBA、alpha 0／255，每格非空且四邊透明；此檢查不證明原圖內部沒有裁切或外框處處 1 邏輯 px。
- `build.txt`：`npm run build`（tsc + Vite）通過，保留 Vite 原有警告。`validate-data.txt`：10 項通過。
- `browser.txt`、`desktop-*.png`、`mobile-touch-*.png`：19 組獨立素材／連播預覽，桌面滑鼠和 Chromium 模擬手機純 touch 通過，沒有 page error。獨立預覽的固定 150ms 每格只檢查載入及輪播；它**不是依 metadata FPS 的遊戲速度測試**。檔案存讀按 `preview-manifest.json`，可用 `node docs/qa-m8-art/researcher/preview.cjs docs/qa-m8-art/revision-20261125/preview-manifest.json /tmp/m8-preview-check` 重跑。
- **未驗證：**遊戲內載入／對齊／比例／碰撞、所有狀態和事件切換、真實遊戲速度、真機及真人體驗。沒有修改任何 TypeScript、沒有合併或關閉 PR。
