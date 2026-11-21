# Cursor：大陸2 32-bit G+S 接入 runtime（2026-11-21）

Alan 已收貨試畫密度、批准先做 G+S、調色板 ≥128、洗地機排後。

## 做咗咩

- Branch：`cursor/c2-32bit-gs-runtime-2610`（由 #99 tip 開出，含第7關）
- **S 遠景：** `public/art/stage7/{entrance,backstage,arena}-far.png` ← `art-src/c2-32bit-test/batch-gs/q128/*-640.png`（128 色）
- **G 保安：** 打包 `public/art/anim/c2guard.png` + `data/anim/c2guard.json`（walk/reach/hit/die；res 4 → 邏輯 64×88）
- `GuardZombie`：有 `c2guard` 就用新 sheet（唔再藍 tint／手繪帽）；否則舊 fallback
- 大陸1 素材零改；洗地機批次未做

## 未驗證

- 遊戲內保安比例／碰撞手感（需人手或注入 QA）
- 中景 T／道具 P／馴獸師 B／蜜僵 Z／洗地機 M
- 真機載入

## 無 merge
等 Alan 睇畫面後先合。
