# 敵人數值（data/enemies.json）

`data/enemies.json` 而家係敵人數值嘅來源，改完重新部署就生效。程式喺 `src/game/enemyAi.ts` 嘅 `applyEnemyJsonTuning()` 讀取，載入時喺 console 列出結果（`[enemies.json] species tuning: …`）。

## 對應

| JSON ID | 名稱 | 程式 species | 美術 |
|---|---|---|---|
| E-01 | 紅魚 | fish | public/art/enemies/E-01.png |
| E-03 | 帽仔兵 | barrel | public/art/enemies/E-03.png |
| E-02 | 機械豬 | elephant | public/art/enemies/E-02.png |

## 已接入嘅欄位

| 欄位 | 意思 | 基準 |
|---|---|---|
| `hp` | 普通攻擊打幾下死（一般敵人；守衛、精英、Boss 會再按角色加倍） | 2 = 現時紅魚 |
| `speed` | 移動速度，相對基準 | 30 = 基本敵人速度 |
| `ai.telegraphMs`（E-02 用 `ai.slamTelegraphMs`） | 攻擊前搖，相對基準 | 500 = 基本前搖 |

例子：E-02 `hp` 由 4 改 6，機械豬要多打 50% 先死；`speed` 由 25.5 改 20，佢會行慢啲。

注意：非機械豬嘅前搖，程式仍然限制喺 220–420ms 之間；機械豬最少 500ms。

## 行為（2026-10-26 起）

| 敵人 | 打法 | 玩家應對 | 用到嘅 JSON |
|---|---|---|---|
| 紅魚 E-01 | 喺 150px 內停定蓄力，再直線衝刺，衝完暈 | 跳過佢，趁暈打 | `ai.telegraphMs`、`ai.dashSpeed`、`ai.dashMs`、`ai.stunMs` |
| 帽仔兵 E-03 | 保持 110–190px 距離，230px 內拋石；一嚿低（膝頭高）一嚿高（胸口高）輪流 | 低石要跳，高石要蹲；衝埋去打 | `ai.throwIntervalMs` |
| 機械豬 E-02 | 正面鐵甲打唔入；重擊落空後有破綻時間 | 等「破綻！」先打，或者繞去背脊 | `ai.slamTelegraphMs`、`ai.vulnerableAfterSlamMs` |

未接入：`patrolTiles`、`throwHeights`（固定高低輪流）、`retreatWithinPx`（用固定 110px）、`slamRange`。

## 目前數值

- hp：E-01 2、E-03 1.2、E-02 4
- speed：E-01 48、E-03 72、E-02 34（2026-10-25 由 30／61.5／25.5 調快，原本敵人只有主角約 0.3 倍速，好似原地踏步）
- 前搖：E-01 500、E-03 310、E-02 500
- 行路動畫按實際移動距離播放（約每 10px 一格），唔會再原地踏步。
