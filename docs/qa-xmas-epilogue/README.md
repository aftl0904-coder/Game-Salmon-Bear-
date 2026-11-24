# Christmas epilogue — QA

- `public/art/story/xmas-01.png` 與 `xmas-02.png` 均為 1280×720 不透明 PNG；尺寸及 SHA-256 見 `dimensions.txt`。生成稿為 2560×1440，以 nearest-neighbour 等比例縮至目標尺寸，沒有裁切。
- 畫風參考 `public/art/story/ending-c2-*.png`，主角參考 `portraits/{lunbo,kibobo,pupu}.png`，聚會圖 11 位朋友按 `public/art/friends/` 中 huihui、guard、denim、brownie、snowcat、shiba、ginger、fleecy、gnome、tigercub、kuro 角色外貌製作；Pupu 另計。已檢查主要角色衣色、數量及圖內無可讀文字。
- `build.txt`：`npm run build`（TypeScript + Vite）通過。`validate-data.txt`：10 項資料驗證通過。`browser.txt` 及桌面／模擬手機截圖記錄純圖片預覽：兩圖均可解碼，桌面用滑鼠、模擬手機只用 touch 切換，沒有 page error。
- 本分支只新增美術及 QA／狀態紀錄，沒有接入遊戲、沒有實際遊戲場景或真機測試。圖片尚待整合者檢查遊戲內裁切和顯示。
- 本分支由 main `4d8a641d76337db9628b65e96d2e175557e8ae96` 開出；噗噗 Q 頭橙啡衫修正則在原有 `manus/c2-art-batch2-2610` 分支獨立提交，未包含在本分支。
