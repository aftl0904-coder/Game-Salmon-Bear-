# Visual style & proportion table（階段 1–5 · 已確認）

> 資料圖鑑（terrain／hazards／enemies／camera／signs）：見 [`data-catalog.md`](./data-catalog.md) · 頁面 `/bible`。

> 來源：code + `public/art/*` + `scripts/art-normalize/run.py`。  
> **遊戲內部解像度 640×360**（`src/game/display.ts` · `GAME_W` / `GAME_H`）。`Scale.NONE`；CSS 縮放見 `main.ts`（待接 `fitCanvas`）。  
> 比例表／art-normalize 目標高度（72／56／40…）緊接後續步驟；暫保留既有 sprite 高度。  

---

## 已確認（階段 2 → 執行）

1. 比例表目標高度：主角 **48**、噗噗 **40**、小敵 **32**、中敵 **48**、重敵 **64**、Boss **96+**、物品 **16–24**。
2. PNG nearest-neighbor 縮到目標高（`art-normalize`）。
3. 色板上限 **32 色**，角色＋道具＋背景共用；統一 **1px** 外框（`OUTLINE_INK` `#12100e`）。
4. UI 字體：**Fusion Pixel 12**（zh-HK／zh-Hant，自託管 `public/fonts/`）；字號倍數 12／24。
5. Bake：**NEAREST ×1**，取消 soft AA／LINEAR actor bake。

---

## 1. 畫面／渲染

| 項 | 數值 | 來源 |
|----|------|------|
| 內部解像度 | **480×270**（16:9） | `constants.ts` |
| pixelArt / roundPixels | true | `main.ts` |
| antialias | false | `main.ts` |
| 縮放 | 整數倍 1×／2×／3×… | `applyIntegerZoom()` |
| canvas CSS | `image-rendering: pixelated` | `style.css` |
| Actor bake | `bakePixelTexture` ×`BAKE_RES_FACTOR=1` | `BootScene` |
| Outline | `OUTLINE_WIDTH=1` | `constants.ts` |
| Actor filter | NEAREST | `setActorNearestFilter` |

---

## 2. 比例表（落地）

基準：**480×270**。錨點：**origin (0.5, 1)** 腳底。`ACTOR_DISPLAY_SCALE=1`。

| 類別 | 目標高度 | 落地 |
|------|----------|------|
| 主角 | **48px** | `salmon-boy`／`bear-girl` normalize |
| 夥伴 噗噗 | **40px** | `kind-bear`；`PET_HEIGHT_FRAC=40/48` |
| 小型敵人 | **32px** | `fish-enemy` |
| 中型敵人 | **48px** | `art-enemy-barrel` nearest-fit @ boot |
| 重型敵人 | **64px** | `art-enemy-elephant` nearest-fit @ boot |
| 物品／金幣 | **16–24px** | `coin` 20；honey／durian fit |
| 陷阱尖刺 | **20–24px** | tiles 近規格 |

---

## 3. 資源尺寸（normalize 後）

| 檔案 | 像素 | 用途 |
|------|------|------|
| `salmon-boy.png` | ~24×48 | 倫寶 |
| `bear-girl.png` | ~24×48 | 琪寶寶 |
| `kind-bear.png` | ~22×40 | 噗噗 |
| `fish-enemy.png` | ~34×32 | 刺刺魚 |
| `coin.png` | 20×20 | 金幣 cel |
| `bg-wallpaper.jpg` | 640×360 | 遠景（desaturate + palette） |
| `bg-sky-wallpaper.jpg` | 480×150 | 天空 |

色板：`docs/bible/palette.json`（32 RGB）。

---

## 4. 字體（階段 4）

| 用途 | 字族 | 字號 |
|------|------|------|
| 標題／品牌 | Fusion Pixel | **24px** |
| 正文／HUD | Fusion Pixel | **12px** |
| 提示 | Fusion Pixel | **12px** |

檔案：`public/fonts/fusion-pixel-12-zh-hk.woff2`（優先）、`…-zh-hant.woff2`、OFL。

---

## 5. 背景（階段 5）

- Wallpaper nearest 縮到 ≤640×360／480×160，共用 32 色，略降飽和。
- 遠景 tint／fog 常數維持（`BG_PALE_TINT` 等）。

---

## 6. 管線指令

```bash
python3 scripts/art-normalize/run.py
# → public/art/* + docs/bible/palette.json + /opt/cursor/artifacts/qa-visual-unify/
```

---

## 7. 驗收

| 視窗 | 期望 |
|------|------|
| 844×390 | 整數 **1×**（480×270）+ 深色邊 |
| 1280×720 | 整數 **2×**（960×540 CSS） |
| 角色高度 | 倫寶／琪寶寶 ≈ **48**；噗噗 ≈ **40**；魚 ≈ **32** |
| 放大 400% | 清晰像素格、無 LINEAR 糊邊 |
