# 階段 1：單線橫向動作（完成 · 等「下一步」）

## 已做

- 移除多線換線（`LANE_COUNT=1`，`sameLane` 恒真，W/S 不再換線）
- 操作：A/D 左右、**G 跳**、**S 蹲**、**F 攻**、**T 絕招**
- 可變跳：數值來自 `data/player.json`（輕點 ≈24px、按住 ≈48px）
- 蹲低：hitbox `12×14`（企 `12×24`），移速 ×0.5，可攻擊
- 觸控：左 ←→＋蹲；右 跳／攻／絕（底角，唔遮中場）
- 美術／PNG：**未改**

## 數值來源

全部 jump／crouch／hitbox／speed／hp → [`data/player.json`](../data/player.json)  
載入：`src/game/config/playerData.ts`

## 驗收

```bash
npm run build && npm run preview -- --host 127.0.0.1 --port 4741
QA_PORT=4741 node scripts/qa-stage1-single-lane.mjs
```

產物：`/opt/cursor/artifacts/qa-stage1/`

## 未做（等「下一步」）

階段 2：enemies／hazards／levels JSON 等。
