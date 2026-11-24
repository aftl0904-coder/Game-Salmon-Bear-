# 第8關：故事圖首批 QA

本批七張：`S8_A_無人接待全景`、`S8_B_真蜜腳印與假蜜管道對照`、`S8_C_監視器內噗噗舔掌`、`S8_D_原稿與摘要並排`、`S8_D_下層門前蜜印`、`S8_E_綠色進度與受傷動物`、`S8_E_主任擋住報告`；均放在 `public/art/story/`，使用故事檔 `art_needed` 的原名。噗噗參考 `public/art/portraits/pupu.png`，沒有護目鏡；主任參考本批主任造型。兩份報告紙張留白，內容、簽名及文字待遊戲疊上。

每張為 1280×720 RGB PNG、128 色，參考第7關故事圖尺寸與色數；`image-check.json` 有實測結果。每張先以 2560×1440 生成，等比例 nearest 縮小、不裁切、不拉伸，量化時沒有額外 dithering；並非原生 1280×720 製作。來源及交付圖 SHA-256 見 `sources.json`，大圖原稿是暫存、沒有入庫。現有風格文件的 64 色限制是 sprite 規格，本批是故事圖，沿用 `c7-boss.png` 的 128 色參考。

`browser.txt`、`desktop-*.png`、`mobile-touch-*.png`：桌面滑鼠及模擬手機純 touch 獨立選取預覽七圖，非遊戲或真機測試。`build.txt` 記錄 TypeScript + Vite，`validate-data.txt` 記錄全部 10 項資料驗證；均通過，現有 Vite 大 chunk 警告仍在。

第八張 `S8_C_監視器內噗噗離開` 原稿錯把噗噗畫在監視器外，**不合格，沒有收錄本批**；修正版已另交，見 `docs/qa-m8-art/story-final/`。七圖尚未接入遊戲，未測真機、文字覆蓋或畫面轉場；藝術與劇情效果仍待 Claude 一併檢查。
