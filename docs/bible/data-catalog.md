# 資料圖鑑（階段資料 1–4）

> 玩法規則不變；本頁只登記 JSON 編號。線上頁：[／bible](/bible)

| 檔案 | 內容 | 校驗 |
|------|------|------|
| `data/terrain.json` | T-01…T-04 地形類型 | `scripts/validate/terrain.mjs` |
| `data/hazards.json` | H-01…H-09（含 H-09 懸掛尖刺塊） | `scripts/validate/hazards.mjs` |
| `data/enemies.json` | E-01…E-06（含 E-06 滾動怪） | `scripts/validate/enemies.mjs` |
| `data/camera.json` | followX／deadZone／lookAhead／lockZones | `scripts/validate/camera.mjs` |
| `data/signs.json` | SG-01 箭咀、SG-02 教學提示 | `scripts/validate/signs.mjs` |
| `data/stages.json` | **stub** ST-01（供 camera.lockZones ref） | — |

## 接入（唔改戰鬥規則）

- `CAMERA.deadZonePx` / `vertical.smoothing` / `lookAheadPx` → `GameScene` 鏡頭
- `SIGNS` tutorial（SG-02）→ 開場後顯示提示字（`floatText`）
- 完整 catalog → `/bible`（`bible.html`）

## 指令

```bash
npm run validate:data
# 開圖鑑
npm run play   # 然後開 http://127.0.0.1:4741/bible
```

## 待確認後（5–14）

items／checkpoints／config／ui／audio／story／bosses／qte／stages 完整包／difficulty／assets。
