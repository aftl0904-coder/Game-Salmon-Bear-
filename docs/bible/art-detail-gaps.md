# 美術細節不足清單（640×360 升格）

> `art-src/` 現有 PNG 多數係舊 480×270 目標高度（主角 48／噗噗 40）。  
> `npm run art:normalize` 用 lanczos3 升到新高度後，**唔等於重畫**——細節會顯得軟／空。

| id | 檔 | 舊高 → 新高 | 狀態 |
|----|----|-------------|------|
| P-01 | salmon-boy.png | 48 → 72 | **待重畫**（頭身／衫摺／槍反光不足） |
| P-02 | bear-girl.png | 48 → 72 | **待重畫**（紫色衫細節／風扇） |
| CP-01 | kind-bear.png | 40 → 56 | **待重畫** |
| E-fish | fish-enemy.png | 32 → 40 | 可暫用；建議重畫 |
| I-coin | coin.png | 20 → 24 | 可暫用 |

請喺 `art-src/` 放入目標尺寸原圖後再跑 `npm run art:normalize`；唔好用濾鏡假裝有細節。
