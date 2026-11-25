# 第8關：無人機及試管兵動畫初稿 QA

## 檔案及格數

- `public/art/stage8/enemies/s8drone.png`、`s8tube.png`：各 3072×704，12 欄×2 行，共 24 格；每格 256×352、`res: 4`，邏輯畫布 64×88。兩個 `.json` 記錄對應格位及建議播放速度，尚未由遊戲讀取。
- 每種依次為 idle 0–3、walk／fly 4–7、warning 8–11、attack 12–15、hurt 16–19、defeat 20–23。飛行沿用 metadata 的 `walk` 名稱。待機可見高度約 40 邏輯 px，底部距格邊約 2 邏輯 px。
- 無人機預警第 2–3 格紅燈較亮，但待機本身已有紅燈；半透明紅暈二值化後減弱，**遊戲實景預警對比仍要驗證**。試管兵預警第 2–4 格可見舉起試管。動畫及 FPS 尚未經遊戲整合調校。

## 生成及切格

以原創大圖生成動作、先將 alpha ≥128 二值化，再尋找每行全透明間隙和每個動作行內的全透明列間隙，不依名義格線盲切；刪除了低透明霧光及雜點。按統一比例縮至邏輯格後以 nearest 放大 4×，無 dithering，共用角色色盤。大圖大幅縮小並非目標尺寸原生繪製；現有深色輪廓未逐處證明是 1 邏輯 px，接入前須目視審核，必要時重畫。各源圖 hash、切線、bbox 和量化損失見 `drone-source-qa.json`、`tube-source-qa.json`；其中 `/tmp` 來源路徑只屬當時工作路徑，不代表已入庫。

## 測試與限制

- `image-check.json`：兩張 atlas 逐格掃描共 48 格，全部邊緣透明、alpha 為 0／255；無人機 64 色，試管兵 62 色（不計透明）。
- `browser.txt`、`desktop-*.png`、`mobile-touch-*.png`：Chromium 桌面滑鼠與模擬手機純 touch 選取並輪播 12 組動作。這是**獨立素材預覽，不是遊戲、真人或手機真機測試**；`*-contact.png` 為動作逐格對照。
- `build.txt` 為 `npm run build`（TypeScript + Vite）；`validate-data.txt` 為 10 項資料驗證，均通過。Vite 仍有既有大 chunk 警告。
- 尚未驗證：遊戲內登場比例、實際錨點／碰撞、預警辨識度、貼合背景、整合後播放速度、真人及真機；不修改遊戲程式。文件櫃及 Boss 仍另行修整。
