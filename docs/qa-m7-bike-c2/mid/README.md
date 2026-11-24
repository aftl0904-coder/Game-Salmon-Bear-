# M7 單車過場：中景 QA

`public/art/bike-c2/mid.png` 是 1280×302 RGBA、二值 alpha 的原創夜色後巷中景，最多 63 種不透明顏色。由 2688×1152 生成圖二值化 alpha，按非透明範圍等比例最近鄰縮小，無裁去二值化後內容；所以不是原生目標尺寸生成。為接合路緣，空白邊距加入取自同圖的一小段路緣，原有主圖不受覆蓋，詳見 `image.txt`。

左右最外像素列一致；`three-tiles.png` 是三張並排的靜態接縫檢查。這不是 Phaser 滾動畫面，遊戲內平鋪及實機視覺仍待驗證。`desktop.png`／`mobile-touch.png` 和 `browser.txt` 記錄 Chromium 獨立預覽頁的圖片載入、滑鼠和模擬手機純 touch；**不是遊戲測試或真機測試**。`build.txt` 是 tsc + Vite，`validate-data.txt` 是資料檢查。
