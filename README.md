# 鮭鮭熊

超任風雙人過關。全故事五關（見 `STORY.md`）；**五關皆可玩**（每關有攤檔小遊戲，第 2–5 關有 Boss），難度分 簡單／普通／困難／地獄 四級。

故事：△**三角組織**大頭目雇來雜魚當 **傀儡**，搶走祭典的 **蜂蜜** 與 **鮭魚**——倫寶／琪寶寶／噗噗要一關一關奪回來。

角色：**倫寶（Lun Bo）** 鮭魚槍（有射程）、**琪寶寶（Ki Bobo）** 劍＋電風扇移速×1.5、**噗噗（Pooh）** AI 跟在琪寶寶**身後**，她受傷才衝前半傷反擊。

## 流程

讀取 → Logo（約 3 秒／可跳過）→ 選單（揀 **單人／雙人**；未選中掣呈灰色）→ 撳 **「開始」**（或空白／Enter）→ 進關

- **單人**：只玩倫寶  
- **雙人**：倫寶＋琪寶寶（＋噗噗）

## 操作（超任佈局 · 5 行）

側視 **5 行**。攻擊／受傷／絕招**同行或相鄰一行（±1）**都會命中。每次換行 ±1。

| | 角色 | 十字鍵 | ABXY（鍵盤） |
|--|------|--------|--------------|
| P1 | 倫寶 | `WASD` | `F` 鮭槍／`G` 跳／`T` 蜂蜜絕招 |
| P2 | 琪寶寶 | `←↑↓→` | `,` 劍／`.` 跳／`;` 絕招 |
| 共用 | — | — | `Enter`／`Space` Start；手掣可用 |
| AI | 噗噗 | — | 跟琪寶寶；她受傷 → 衝前半傷 |

舊鍵 `J/K`、數字鍵仍可用。點畫面一次解鎖聲音。

## 敵人（三角組織傀儡）

| 外觀 | 說明 |
|------|------|
| **醃魚雜兵** | 魚形傀儡，巡邏／追擊 |
| **木桶武者** | 木桶傀儡，Hop／Lunge |
| **大象傀儡** | 體型較大，混入中後段 |
| **背景小蜂** | 只在天空飛過，無碰撞 |

## 畫面規格

- 邏輯座標 **640×360**，畫布以 **×2（1280×720）** 渲染，整數倍縮放（見 `docs/bible/visual-style.md`）；角色／背景／特效貼圖為 2x 版，少量程序繪製元件仍為 1x
- 角色／敵人／道具 nearest 像素化 + 共用 32 色板；Fusion Pixel 字型（`public/fonts/`）
- 重跑美術正規化：`python3 scripts/art-normalize/run.py`

## 執行

```bash
npm install
npm run play
```

開 [http://127.0.0.1:4741](http://127.0.0.1:4741)

**手機橫向**：自動 fit 螢幕；左下虛擬十字鍵、右下四掣（攻／跳／絕／始），透明度 60%。

開發（Vite HMR；經 Cursor 代理有時會卡住／空白）：

```bash
npm run dev -- --host 0.0.0.0 --port 4637
```

## 發佈

**Production：** [https://sake-kuma.vercel.app](https://sake-kuma.vercel.app)

GitHub 目標：`aftl0904-coder/Game-Salmon-Bear-`  
Vercel 專案：`sake-kuma`（靜態 `dist`，見 `vercel.json`）

對 Agent 講 **publish** 即會一次完成：push GitHub、開／更新 PR、Vercel 部署。


## 2x 畫面解像度（HD）

遊戲邏輯／物理／關卡資料／碰撞箱全部仍然係 640×360；canvas 係 `CANVAS_W/H = GAME_W/H × RENDER_SCALE`（1280×720），每個 scene 嘅 camera 用 zoom 2（`src/game/hd.ts` 修正咗 Phaser camera 嘅 scroll／follow／pan 語義）。

- HD 貼圖用 `markHd(texture, res)`（`heroAnims.ts`）標記：畫面像素係 `res` 倍，但 frame 邏輯尺寸不變，所以 sprite／body／layout 毋須改。
- 切圖腳本（`scripts/art/slice_*.py`）用 `RES = 2` 出 2x 圖（柔邊 alpha、palette ×2）；角色用 `cell1x`／`MIN_CELL` 保持同 1x 一樣嘅格仔尺寸。
- 新 scene 請用 `GAME_W/GAME_H` 做佈局，唔好用 `this.scale.width/height`（會係 1280×720）。
- 仍然係 1x：charm／capsule（原圖得 64px，睇落係 chunky 像素 icon，決定保留）、程序畫嘅 UI 面板同破壞物（`uiArt.ts`／`isoArt.ts` 逐 pixel 畫，乘 RES 唔會多細節）、`hud2-heart`。
- 光暗 overlay 用 `ctx.scale(RENDER_SCALE)` + `markHd`；HUD 頭像 icon 由 HD 肖像烘焙。
