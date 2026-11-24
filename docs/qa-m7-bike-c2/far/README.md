# M7 單車過場：遠景 QA

- `public/art/bike-c2/far.png`：1280×720、RGB 不透明；原創夜色後巷，沒有畫字或商標。
- 生成尺寸為 2560×1440，等比例 nearest 2:1 縮至交付尺寸，無裁切；之後無 dithering 量化成 64 色。並非原生在目標尺寸生成。
- `image.txt` 紀錄格式；`build.txt` 是 `npm run build`（tsc + Vite）；`validate-data.txt` 是 `npm run validate:data`。
- `desktop.png`／`mobile-touch.png` 和 `browser.txt`：以 Chromium 於獨立素材預覽頁測圖片載入與滑鼠／模擬手機純 touch，**不是遊戲畫面或實機測試**。
- 本張素材未接入遊戲；尚未驗證 Phaser 圖層、捲動效果、真機或真人操作。
