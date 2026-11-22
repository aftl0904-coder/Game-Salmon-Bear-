# 程式繪製／臨時美術盤點（art-todo）

> 任務：清走 Graphics／generateTexture／canvas paint 臨時圖，改 PNG sprite。  
> 狀態欄：`todo` = 仍程式繪製 · `placeholder` = 已換剪影 PNG · `done` = 正式原畫

## 敵人（優先）

| 顯示 key | 物種／資料 id | 檔案 · 函數 | 狀態 |
|----------|---------------|-------------|------|
| `art-enemy` | fish／E-01 紅魚 | `BootScene` load fish-enemy.png；舊 procedural 補缺 | placeholder → `enemies/E-01.png` |
| `art-enemy-barrel` | barrel／E-02 機械豬 | `isoArt.ts` `paint(...'art-enemy-barrel'...)` ~L749 | placeholder → `enemies/E-02.png` |
| `art-enemy-elephant` | elephant／重型 | `isoArt.ts` `paint(...'art-enemy-elephant'...)` ~L535 | placeholder → `enemies/E-03.png`（暫代帽仔兵位／重型） |
| （未接） | E-04 刺球 | — | placeholder `enemies/E-04.png` |
| `fx-ambient-bee` 等 | E-05 蜜蜂（裝飾 critter） | `worldArt`／`isoArt` ambient + `GameScene.spawnOneCritter` | placeholder `enemies/E-05.png` |
| （未接） | E-06 滾動怪 | — | placeholder `enemies/E-06.png` |

## 道具／武器／特效（程式 canvas）

| key | 檔案 · 函數 | 狀態 |
|-----|-------------|------|
| `prop-enemy-knife/spear/club/trunk` | `honeyArt.ts` `paint` | todo |
| `fx-salmon-shot` / `fx-fish-bullet` / `fx-honey` / trunk FX | `honeyArt.ts` / `isoArt.ts` | todo |
| `prop-sword` / `fan3d` / `prop-fan` | `honeyArt` / `isoArt` | todo |
| `prop-honey-*` / `hazard-durian` / `pickup-sushi` | `honeyArt.ts` | todo |
| `goal3d` / `pot3d` / `chest3d` / `crate3d` | `isoArt.ts` | todo |
| `prop-tent` / picnic / shrine / campfire | `worldArt.ts` | todo |
| `blk-spike` / ground tiles | `tiles.ts` `registerTiles` | **地面改 PNG tile（本輪）** |
| `coin` | 曾 procedural；而家 `BootScene.applyCelCoinTexture` ← `/art/coin.png` | done（cel） |
| `__atk-hitbox` | `Player.ts` `generateTexture` | todo（碰撞用，可留） |
| `light-ST-*` | `lighting.ts` `createCanvas` | 光暗層（保留） |
| bake／outline | `pixelSnap.ts` `addCanvas` | 後處理（保留） |

## 場景／UI Graphics（非 sprite 紋理）

| 用途 | 檔案 · 函數 | 狀態 |
|------|-------------|------|
| 天空／霧／河岸色塊 | `GameScene.drawWorld` / `buildRiverBand` | 背景改像素 wallpaper＋地面 tile（本輪） |
| Boot／Logo／Menu 底 | `BootScene` / `LogoScene` / `MainMenuScene` | todo |
| HUD 白方塊頭像框 | `hud.ts` `make.graphics` | 另任務 |
| Debug gfx | `engine/debug.ts` | 保留 |

## ART-REQUEST — Loading Q-heads（T8_LOADING_SCREEN）

> 現況：BootScene 用現有全身／公仔 sprite 頭頂裁切 + nearest 2–3× 做 interim Q 頭。  
> 正式要：每隻獨立 Q-head PNG（透明底），表情可之後再加。

| 角色 | id / 紋理 | 建議尺寸 | 狀態 |
|------|-----------|----------|------|
| 倫寶 | `qhead-lunbo` ← `art-salmon` crop | 88×88 | todo（interim crop） |
| 琪寶寶 | `qhead-kibobo` ← `art-girl` crop | 88×88 | todo（interim crop） |
| 噗噗 | `qhead-pupu` ← `art-bear` crop | 88×88 | todo（interim crop） |
| 熊仔 | `qhead-huihui` ← `friend-huihui` | 64×64 | todo（interim crop） |
| 英國熊 | `qhead-guard` ← `friend-guard` | 64×64 | todo（interim crop） |
| 小熊仔 | `qhead-denim` ← `friend-denim` | 64×64 | todo（interim crop） |
| 招積熊 | `qhead-brownie` ← `friend-brownie` | 64×64 | todo（interim crop） |
| 北極熊 | `qhead-snowcat` ← `friend-snowcat` | 64×64 | todo（interim crop） |
| 柴柴 | `qhead-shiba` ← `friend-shiba` | 64×64 | todo（interim crop） |
| 薑餅 | `qhead-ginger` ← `friend-ginger` | 64×64 | todo（interim crop） |
| 大pat熊 | `qhead-fleecy` ← `friend-fleecy` | 64×64 | todo（interim crop） |
| 聖誕伯伯 | `qhead-gnome` ← `friend-gnome` | 64×64 | todo（interim crop） |
| 虎仔 | `qhead-tigercub` ← `friend-tigercub` | 64×64 | todo（interim crop） |
| 喵仔 | `qhead-kuro` ← `friend-kuro` | 64×64 | todo（interim crop） |
| 蜜糖罐進度條 | `load-jar` / honey fill UI | 48×64 jar | todo（現用 jar-real + Graphics） |
| 放射陽光底 | sunburst 12 rays | 全畫面 procedural | todo（可改靜幀＋旋轉） |

## 本輪（1–3）交付

1. 本清單  
2. `public/art/enemies/E-0x.png` 剪影 sheet + `data/assets.json` 幀表；Boot 優先載入  
3. `bg-wallpaper` 640×360／64 色；16px 地面 ≥4 變體對齊腳底  
