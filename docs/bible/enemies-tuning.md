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

## 未接入（寫咗喺 JSON，但程式未用）

`frontArmor`、`vulnerableAfterSlamMs`、`dashSpeed`、`dashMs`、`stunMs`、`throwIntervalMs`、`throwHeights`、`retreatWithinPx`、`patrolTiles`。

E-04 刺球、E-05 蜜蜂、E-06 滾動怪未有對應 AI。

## 目前數值

接入時將數值設定成同舊版手感一樣（hp E-02 4、E-03 1.2；speed E-02 25.5、E-03 61.5；前搖 E-02 500、E-03 310），所以呢次改動唔會改變遊戲手感。
