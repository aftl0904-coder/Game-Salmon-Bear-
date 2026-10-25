# Visual style & proportion table（階段 1–2）

> 來源：code + `public/art/*` + 程序生成 `paint()` 尺寸。  
> **遊戲內部解像度已改為 480×270**（`GAME_W` / `GAME_H`）。整數倍縮放見 `src/main.ts`。

---

## 待確認

1. **比例表目標高度**（下表「建議」欄）是否採納？尤其主角 **48px**、噗噗 **40px**、Boss **96px**。
2. 現時 PNG 源檔遠高於目標（倫寶／琪寶寶 **110px** 源高）——階段 3 `art-normalize` 會 nearest-neighbor 縮到目標高。OK？
3. 色板上限 **32 色**、統一 **1px** 外框——階段 3 再做；色板要不要從「只角色」定，還是「角色+道具+背景」共用？
4. UI 像素字體：現用系統 `Noto Sans TC`／`Mochiy Pop One`（非像素字）。階段 4 要換哪套（例如 press-start / 自製 5×7）？
5. `bakeSmoothActorTexture` 現為 **3× + LINEAR**——同「nearest + pixelArt」衝突。階段 3 是否改成 **NEAREST bake、取消 soft AA**？

---

## 1. 畫面／渲染（已落地）

| 項 | 數值 | 來源 |
|----|------|------|
| 內部解像度 | **480×270**（16:9） | `constants.ts` `GAME_W`/`GAME_H` |
| 舊設計 | 960×540 | 以 `LAYOUT_SCALE=0.5` 映射 |
| pixelArt | true | `main.ts` |
| roundPixels | true | `main.ts` + camera |
| antialias | false | `main.ts` |
| 縮放 | 整數倍 1×/2×/3×…；視窗 <1× 才 fractional FIT | `applyIntegerZoom()` |
| canvas CSS | `image-rendering: pixelated` | `style.css` + runtime |
| 鏡頭 | `snapCameraScroll` 取整 | `pixelSnap.ts` |

---

## 2. 比例表（建議 · 等你確認後階段 3 執行）

基準：**480×270**。錨點：**origin (0.5, 1)** 腳底。

| 類別 | 建議高度 | 頭身感 | 編號範例 |
|------|----------|--------|----------|
| 主角 | **48px** | ~2.5–3 頭身 | C-01 倫寶、C-02 琪寶寶 |
| 夥伴 噗噗 | **40px** | 偏圓 | C-03 |
| 小型敵人 | **32px** | — | E-01 刺刺魚 |
| 中型敵人 | **48px** | — | E-02 疾風桶 |
| 重型敵人 | **64px** | — | E-03 霸鼻象 |
| Boss | **96px+** | — | （R1 code 無 boss spawn） |
| 物品／金幣 | **16–24px** | — | I-coin 等 |
| 陷阱 | **20–24px** | — | 尖刺／榴槤 |

陰影：角色寬 × ~0.55 的扁橢圓（現有 `shad` / `shadow-blob`），隨角色 scale。

---

## 3. 現有資源實際尺寸（超出規格已標）

### 3.1 PNG（`public/art/`）

| 檔案 | 像素 | 用途 | vs 建議 | 狀態 |
|------|------|------|---------|------|
| `salmon-boy.png` | **56×110** | 倫寶 | 高 110 ≫ 48 | **超出** |
| `bear-girl.png` | **54×110** | 琪寶寶 | 高 110 ≫ 48 | **超出** |
| `kind-bear.png` | **128×128** | 噗噗 | 高 128 ≫ 40 | **超出** |
| `fish-enemy.png` | **56×56** | 刺刺魚 | 高 56 ≫ 32 | **超出** |
| `coin.png` | **72×72** | 金幣 cel | 高 72 ≫ 24 | **超出** |
| `bg-wallpaper.jpg` | 1280×720 | 遠景 | 背景另規 | 待階段 5 |
| `bg-sky-wallpaper.jpg` | 960×300 | 天空 | 背景另規 | 待階段 5 |
| `concept-stage1.png` | 1280×720 | 概念圖（非 runtime） | — | 不入管線 |

### 3.2 程序 `paint()` 紋理（isoArt / tiles / uiArt / honeyArt 等）

| key | 源尺寸 | 類 | vs 建議 |
|-----|--------|-----|---------|
| `art-enemy-barrel` | 40×48 | 中敵 | 高 48 = 中型 OK（源） |
| `art-enemy-elephant` | 56×52 | 重敵 | 高 52 < 64 建議 | 待確認抬到 64？ |
| `prop-honey-stack` | 36×40 | 物品 | 高 40 ≫ 24 | **超出** |
| `hazard-durian` | 42×40 | 陷阱 | 高 40 ≫ 24 | **超出** |
| `blk-spike` / `til-spike` | 16×24 / 24×30 | 陷阱 | 近規格 | OK～偏大 |
| `coin`（procedural fallback） | 16×16 | 物品 | OK | 運行時可被 cel PNG 覆蓋 |
| `pickup-sushi` | 22×14 | 物品 | OK | |
| `goal3d` | 56×88 | 關底道具 | 場景物 | 待確認 |
| `prop-tent` | 40×36 | 場景 | — | |
| `prop-campfire` | 24×22 | 場景 | — | |
| `fx-salmon-shot` | 28×14 | 彈 | — | |
| `fx-fish-bullet` | 10×6 | 彈 | — | |
| `ui-title-plaque` | 420×110 | UI | 半屏寬 | 待階段 4 |
| `ui-wood-panel` | 360×64 | UI | — | 待階段 4 |

### 3.3 運行時顯示高（bake × scale 後 · 480×270 下估算）

`ACTOR_DISPLAY_SCALE` 已 ×`LAYOUT_SCALE`，令螢幕佔比接近舊 960×540。  
**精確 displayHeight 以 Playwright 量度為準**（見 `qa-visual-unify/after_*_measures.json`）。

| 實測（480×270 · 1P 倫寶 · after） | px |
|----------------------------------|-----|
| 倫寶 displayHeight | **57**（scale≈0.173；bake 3× 後） |
| GAME | 480×270 |
| GROUND_Y | 214 |

→ 建議主角 48px 意味著階段 3 還要再縮 ~16%（或調低 bake/scale）。

---

## 4. 色板／外框（階段 3 才執行）

- 上限 **32 色**（待確認提取範圍）
- 外框 **1px**，色＝物件最深色變體或統一深墨 `#12100e`
- Alpha 二值化去半透邊
- 光源：左上
- 輸出：contact sheet + 前後對照

---

## 5. 字體（現況 · 階段 4）

| 用途 | 現用 | 建議字號檔（480 高） |
|------|------|----------------------|
| 標題 | Mochiy Pop One | 22–28px → 改像素字後 12–14 |
| 正文／HUD | Noto Sans TC | 9–12px |
| 提示 | Noto Sans TC | 8–11px |

---

## 6. 驗收筆記（階段 1）

| 視窗 | 期望 |
|------|------|
| 844×390 | 整數 **1×**（480×270）+ 深色邊 |
| 667×375 | 整數 **1×** |
| 1280×720 | 整數 **2×**（960×540 CSS） |

放大 400% 檢查應見清晰像素格、無 FIT 造成的半像素糊邊（1×／2× 時）。
