# G+S 載入速度（本機 Chromium `createImageBitmap`，cache no-store）

來源：`scripts/qa/c2s2-art-load.mjs` 對 `full/` + `q128/` 共 27 張 PNG。唔係遊戲內 Phaser 載入，亦唔係真機。

| 組 | 張數 | decode 中位 | decode 最大 | fetch 中位 | 最大檔 |
|---|---:|---:|---:|---:|---:|
| full（含 1280 遠景） | 15 | 2.9 ms | 20.1 ms | 2.4 ms | 1.70 MB |
| q128 | 12 | 2.5 ms | 4.3 ms | 1.6 ms | 355 KB |

## 結論（已確認量度）

- **≥128 色 q128 640 遠景／保安 sheet 合格**：decode ≤ 4.3 ms，細過 1280 全色遠景。
- 1280 全色遠景 decode 最大 20 ms、檔案 1.3–1.7 MB，一次載入可接受，但 runtime 遠景建議用 **640 q128**。
- 相對現有 runtime 64 色遠景（109–135 KB），q128 640 約 310–355 KB（約 2.5–3.2×），仍遠細過全色。

不合再調嘅條件未觸發。洗地機批次未做。
