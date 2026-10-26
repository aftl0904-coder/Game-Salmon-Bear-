# 自訂圖片位（噗噗、故事圖）

呢個資料夾係留俾 Alan 自己放圖用。遊戲一開就會讀 `custom.json`；入面有寫嘅圖，就會蓋過遊戲原本嗰張。冇寫就照用原本嘅圖。

## 點樣用

1. 將你嘅 PNG 圖放入呢個資料夾。
   - 要透明背景。
   - 大細唔緊要，遊戲會自動縮放、腳底對齊。
2. 改 `custom.json`。下面係例子，檔名換返做你自己嘅：

```json
{
  "pupu": {
    "height": 60,
    "anims": {
      "idle": ["my-bear-idle-1.png", "my-bear-idle-2.png"],
      "walk": ["my-bear-walk-1.png", "my-bear-walk-2.png", "my-bear-walk-3.png"],
      "cute-pose": ["my-bear-happy.png"]
    },
    "portrait": ["my-bear-face.png", "my-bear-face-happy.png", "my-bear-face-shock.png"]
  },
  "stills": {
    "cover": "my-cover.png"
  }
}
```

3. Commit 同 push 上 GitHub，Vercel 會自動更新。

## 每一項做咩

- **`pupu.anims`**：噗噗每個動作嘅幀，每個動作可以放一張或者幾張。
  - 動作名稱有：`idle`、`walk`、`cute-pose`、`tackle`、`hollow-idle`、`wake-up`。
  - 冇提供嘅動作會用返 `idle` 嗰幾張頂上。
  - `hollow-idle`（灰色、失去顏色嗰陣）如果冇提供，會自動將 `idle` 變灰色。
- **`pupu.height`**：噗噗喺遊戲入面有幾高，預設 60。
- **`pupu.portrait`**：對話框頭像。
  - 可以只放一張（三個表情都用佢），或者放三張：普通、開心、驚訝。
  - 灰色版頭像會自動整。
- **`stills`**：替換故事圖，大細會自動填滿 640×360。
  - 可以換：`cover`、`c1-picnic`、`c1-hollow`、`c1-mama`、`c2-note`、`c2-bike`、`s2-boss-intro`、`c3-queen`、`credits-bg`。

## 要留意

- 呢個網站同 GitHub repo 都係公開嘅，放入嚟嘅圖任何人都睇得到。
