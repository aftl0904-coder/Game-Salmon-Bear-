# M6 榴槤道具 QA

`public/art/items/hazard-durian.png` 是 18×22 RGBA，二值 alpha，64 色，1px 深色外框；尺寸與 `jar-real.png` 一致。原創生成稿經 nearest-neighbour 縮圖及色板量化，不是原尺寸原生繪製。尖刺在目標尺寸極細，整合時需確認可辨性。

`desktop.png`、`mobile-touch.png` 和 `browser.txt` 為獨立素材預覽，非遊戲或真機測試。`build.txt`（tsc + Vite）及 `validate-data.txt`（10 項）通過；沒有修改程式，Cursor 仍需接入。
