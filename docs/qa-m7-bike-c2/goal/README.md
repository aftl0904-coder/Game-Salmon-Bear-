# M7 單車過場：側門 QA

`public/art/bike-c2/goal.png` 是 320×240 RGBA 透明底、二值 alpha，原創側門和卸貨捲閘，招牌留白、無文字。由 2176×1632 生成圖二值化 alpha 後，按非透明範圍等比例最近鄰縮小放到底部，不裁去二值化後的內容；量化為最多 63 種不透明色、沒有 dithering，詳見 `image.txt`。並非原生目標尺寸製作。

`desktop.png`／`mobile-touch.png` 和 `browser.txt` 是 Chromium 獨立預覽頁的圖片載入、滑鼠和模擬手機純 touch；**不是遊戲畫面或真機測試**。`build.txt` 為 tsc + Vite，`validate-data.txt` 為資料檢查。尚未接入遊戲，圖層、錨點、標題疊字與真機效果均待整合驗證。
