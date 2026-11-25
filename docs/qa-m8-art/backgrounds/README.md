# 第8關：五段背景素材 QA

`public/art/stage8/bg-{reception,pipes,machine,records,control}.png` 各為 640×360 RGB 不透明背景；無字、無商標。參照第7關遠景尺寸及大陸2夜色，以原創場景繪製。各圖原先以 2560×1440 生成，再以最近鄰等比例縮至 640×360、不裁切、無 dithering 量化成 64 色；並非原生目標尺寸製作。實際尺寸、色數和處理方式記於 `image.json`。

`desktop.png`、`mobile-touch.png` 和 `browser.txt` 是 Chromium 獨立素材預覽，逐張測圖片載入、滑鼠或模擬手機純 touch，不是遊戲畫面或真機測試。`build.txt` 記錄 tsc + Vite，`validate-data.txt` 記錄資料檢查。背景尚未接入第8關，未驗證實際圖層、鏡頭、前景可讀性、手機真機或真人操作。
