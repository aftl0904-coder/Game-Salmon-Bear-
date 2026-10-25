# Visual style & proportion table（640×360 · 已確認）

> 資料圖鑑：[`data-catalog.md`](./data-catalog.md) · 頁面 `/bible`。  
> 細節缺口：[`art-detail-gaps.md`](./art-detail-gaps.md)。

> 來源：`art-src/` → `npm run art:normalize` → `public/art/` · 清單 `data/assets.json`。  
> 內部解像度 **640×360**（`display.ts`）· CSS：`fitCanvas` · 整數 scale：`?debug=1`。

---

## 已確認規格（新圖必須跟）

1. **內部解像度 640×360**；CSS 整數倍優先（浪費過多則平滑）。
2. **遊戲內 sprite scale 只准 1／2／3**；禁止 `setScale(小數)` 同 `setDisplaySize` 縮像素圖；尺寸喺 normalize 預先做好。
3. **每 sprite 各自 ≤64 色**（取消全域 32 色）；唔加 dither；alpha 二值化；**1px 外框**用相鄰像素變深，**唔用純黑**。
4. **比例表（以 640×360 為準）**

| 類別 | 目標高度 |
|------|----------|
| 主角 | **72px** |
| 噗噗 | **56px** |
| 小敵人 | **40px** |
| 中型 | **56px** |
| 重型 | **72px** |
| Boss | **128px+** |
| 物品 | **20–28px** |

5. 原圖要喺目標尺寸畫／生成，唔好超大圖大幅縮細。
6. 每種材質（皮膚、頭髮、衫、鞋）**3–4 階明暗**；光源統一**左上**；頭髮／眼睛有高光；衫有摺痕；武器有反光。
7. 三個角色同一套比例（頭身約 **3**）、同一種明暗做法。
8. 細節不足 → 列入 [`art-detail-gaps.md`](./art-detail-gaps.md) 等重畫；**唔好用濾鏡假裝有細節**。

---

## 1. 畫面／渲染

| 項 | 數值 | 來源 |
|----|------|------|
| 內部解像度 | **640×360**（16:9） | `display.ts` |
| pixelArt / roundPixels | true | `phaserConfig` |
| antialias | false | `phaserConfig` |
| 縮放 | Scale.NONE + `fitCanvas` | `fitCanvas.ts` |
| 整數 scale 檢查 | `?debug=1` → `__SAKE_PIXEL_SCALE__` | `assertIntegerScale.ts` |
| Actor bake | `bakePixelTexture` ×1 NEAREST | `BootScene` |
| 地面陰影 | `addGroundShadow`（跳起縮細變淡） | `shadow.ts` |
| 接觸陰影 | 地面頂 **2px** 暗帶 | `addContactShadowBand` |
| 關卡光暗 | multiply veil + 可選 Light2D | `lighting.ts` + `environment.json` |

---

## 2. 資源尺寸（normalize 後）

| 檔案 | 高度 | 用途 |
|------|------|------|
| `salmon-boy.png` | 72 | 倫寶 |
| `bear-girl.png` | 72 | 琪寶寶 |
| `kind-bear.png` | 56 | 噗噗 |
| `fish-enemy.png` | 40 | 刺刺魚 |
| `coin.png` | 24 | 金幣 |
| `bg-wallpaper-px.png` | 360 | 遠景 ≤64c |

錨點：**origin (0.5, 1)** 腳底。`ACTOR_DISPLAY_SCALE=1`。

---

## 3. 字體

| 用途 | 字族 | 字號 |
|------|------|------|
| 標題 | Fusion Pixel | **16／24px** |
| HUD／正文 | Fusion Pixel | **12px**（最小） |

`public/fonts/fusion-pixel-12-zh-hk.woff2`（SIL OFL）。

---

## 4. 管線

```bash
npm run art:normalize
# art-src/* → public/art/*（lanczos3、二值 alpha、1px 鄰色外框、≤64c）
```

---

## 5. 驗收

| 視窗 | 期望 |
|------|------|
| 844×390／1280×720／1920×1080 | 像素格一致、無撕裂 |
| `?debug=1` | 非整數縮放物件 = **0** |
| 通關 card | cast 喺標題下、唔重疊 |
| contact sheet | 全部 sprite 1:1 同 4× |
