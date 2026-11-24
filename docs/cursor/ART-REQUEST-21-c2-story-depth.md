# ART-REQUEST-21 · 大陸2 深度故事（第6、7關）

**Branch:** `cursor/c2-story-depth-2610`  
**Date:** 2026-11-24  
**Status:** **done**（Manus `public/art/c2/story/*.png`；BootScene 載入，bake 僅 fallback）

## 需要新圖

| Key / 檔案 | 尺寸建議 | 用途 |
|---|---|---|
| `c2-truth-scrap` | 28×32 RGBA | 真相碎片拾取物（文件／紙張＋微光） |
| `c2-ken-photo` | 36×28 RGBA | 第6關玻璃走廊舊相（Ken 扶樹＋彩色布條） |
| `c2-ken-memo` | 30×34 RGBA | 第7關後台批示文件 |
| `c2-pupu-branch` | 24×10 RGBA | 噗噗放低嘅熟悉樹枝 |
| `c2-maint-hatch` | 40×48 RGBA | 籠車通過嘅窄小維修口 |
| `c2-leon-emblem` | 32×28 RGBA | Leon 獅子象徵物剪影（高架閃過） |

## 規則
- 32-bit 像素；唔好用純幾何色塊做最終交付。
- 舊相要睇得出「年輕 Ken 蹲喺溪邊扶樹、樹枝掛彩色布條」。
- 批示要睇得出公文／印章感覺，唔使可讀細字。

## 程式暫用
`src/game/storyDepth.ts` → `ensureStoryDepthArt()` bake；有正式 PNG 後改 BootScene 載入並刪 bake。
