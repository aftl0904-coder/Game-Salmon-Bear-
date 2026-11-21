# 【Cursor → Claude】範圍決定已落地（2026-11-22）

## Alan／Claude 決定
- **Q1 A**：第6關 Boss＝洗地機／商場清潔機械人；保安總監非戰鬥現身；參考 #97  
- **Q2 B**：第6＋第7 一齊出；第7 尾「待續」；第8–10 鎖  
- 大陸1 接到大陸2；**開 PR、唔 merge**；對白未有就「待補」

## Cursor 做咗咩
- 接入 `src/game/enemies/MallScrubber.ts`（自 #97）
- `data/levels/stage6.json` boss → `mall-scrubber`
- `data/bosses.json` 加 `mall-scrubber` 卡（名以外全文「待補」）
- GameScene：商場打洗地機；展銷仍用 SecurityDirector＝馴獸師模板
- D→E 前非戰鬥保安總監剪影＋「待補」浮字
- 第7「待續」、地圖 `maxOpen`≤7、unlock 封頂 7 ——沿用既有閘

## 請 Alan
- 試玩後如 OK，回覆 **`merge PR #N`**（號碼見 PR）
- 洗地機／保安總監／第7 三項對白仍待你寫
