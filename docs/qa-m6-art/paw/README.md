# M6 蜜腳印 QA

`public/art/fx/honey-paw.png` 為 48×16 RGBA，橫向 3 格各 16×16，31 色、二值 alpha。第 1 格腳印完整，第 2 格為縮小的腳印，第 3 格完全透明。為遵守現有二值透明規格，第 2 格是縮小而非真正半透明淡出；如要平滑漸淡，接入方需另用透明度動畫或確認可用半透明素材。原創圖由大圖 nearest-neighbour 縮至 16×16，並非目標尺寸原生繪製。

`desktop.png`、`mobile-touch.png` 和 `browser.txt` 為獨立素材預覽，非遊戲或真機測試。`build.txt`（tsc + Vite）與 `validate-data.txt`（10 項）通過；沒有修改遊戲程式，Cursor 仍需接入。
