# 第8關：管道、閥門及機關美術 QA

| 素材（`public/art/stage8/props/`） | 圖像尺寸 | 備註 |
|---|---:|---|
| `pipe-normal.png`、`pipe-shake-left.png`、`pipe-shake-right.png`、`pipe-spray.png` | 各 48×128 | 相同畫布；噴蜜向下 |
| `pipe-shake.png` | 192×128，4 格、每格 48×128 | 依序正常、左、正常、右 |
| `valve-normal.png`、`valve-broken.png` | 各 64×80 | 完整／輪圈破損 |
| `server-platform.png` | 96×48 | 雙門機櫃 |
| `bookshelf.png` | 80×104 | 帶輪書架；圖本身不會移動 |
| `cart.png` | 96×80 | 手推車，圖本身保持水平 |

尺寸係製圖暫定值，**不是已確認的碰撞尺寸**。管道震動係正常圖整張向左／右平移 1px；`pipe-shake.png` 是供後續播放的圖表，未接上遊戲計時。噴蜜及破閥由正常原創圖生成變體：狀態間主體不保證逐像素一致，閥門比例有小變化，切換可能跳動。書架移動、手推車傾斜及旋轉樞軸需接入時處理，尚未驗證。

原圖先生成較大圖片，再裁去透明留白、縮至目標；使用 LANCZOS 縮細、alpha 二值化、無 dithering 量化及加一圈深色外沿。並非在目標像素尺寸原生製作；閥門兩狀態為對齊主體而有輕微非等比縮放。圖內沒有文字；輪廓及細節應喺遊戲內另行檢查。

## 本批測試

- `image-check.json`：10 張圖均為 RGBA、alpha 0／255、每圖最多 63 個可見顏色；震動表每格四邊透明。完整逐格 bbox 已列出。
- `browser.txt`、`desktop-*.png`、`mobile-touch-*.png`：桌面滑鼠及 Chromium 模擬手機純 touch **獨立素材預覽**，全部圖像能載入，震動表能輪播；不是遊戲畫面、真機或真人測試。`states-compare.png`、`props-compare.png` 是素材對照預覽。
- `build.txt`：`npm run build`，包括 TypeScript 與 Vite；`validate-data.txt`：10 項資料驗證通過。現有 Vite 大 chunk 警告仍在。
- 尚未驗證：遊戲內各狀態切換、震動速度、實際物件大小／碰撞、角色與背景對比、手推車傾斜、真人及手機真機。

可從 repo 根目錄重跑 `python3 docs/qa-m8-art/props/image-check.py docs/qa-m8-art/props/manifest.json`（需 Pillow、NumPy），以及 `node docs/qa-m8-art/props/preview.cjs docs/qa-m8-art/props/manifest.json docs/qa-m8-art/props`（需 Playwright 和 `/usr/bin/chromium`）。
