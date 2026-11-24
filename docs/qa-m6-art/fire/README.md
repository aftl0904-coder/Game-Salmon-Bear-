# M6 營火 QA

`public/art/props/camp-fire.png` 是 208×60 RGBA，橫向兩格各 104×60，二值 alpha，64 色；每格畫布參考 `picnic-blanket.png`。兩格火焰方向不同，第 2 格由第 1 格火焰上半部鏡像得到，y≥36 木柴部分逐像素相同；不是遊戲中播放的動畫驗證。原創生成稿經 nearest-neighbour 縮圖及色板量化，不是原尺寸原生繪製。接入時需核對底部錨點。

`desktop.png`、`mobile-touch.png` 和 `browser.txt` 為獨立素材預覽，非遊戲或真機測試。`build.txt`（tsc + Vite）及 `validate-data.txt`（10 項）通過；沒有修改程式，Cursor 仍需接入並驗證動畫。
