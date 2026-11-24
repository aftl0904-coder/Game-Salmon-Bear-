# M6 小神龕 QA

`public/art/props/camp-shrine.png` 是 104×60 RGBA，二值 alpha，64 色，1px 深色外框；畫布參考 `picnic-blanket.png`，圖像底部在 y=58，接入時要核對錨點。原創生成稿經 nearest-neighbour 縮圖及色板量化，不是原尺寸原生繪製。沒有文字、品牌或真實宗教符號。

`desktop.png`、`mobile-touch.png` 和 `browser.txt` 為獨立素材預覽，非遊戲或真機測試。`build.txt`（tsc + Vite）及 `validate-data.txt`（10 項）通過；沒有修改程式，Cursor 仍需接入。
