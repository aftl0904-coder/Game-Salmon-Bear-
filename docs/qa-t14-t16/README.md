# T14–T16 估算腳本（唔係實測）

| 腳本 | 用途 |
|------|------|
| `scripts/qa/boss-sim.mjs` | T14 Boss 戰 Monte Carlo |
| `scripts/qa/ambush.mjs` | T15 醒來位／反應時間 |
| `scripts/qa/economy.mjs` | T16 攤檔金幣反推（1P） |

```bash
node scripts/qa/boss-sim.mjs --test && node scripts/qa/boss-sim.mjs
node scripts/qa/ambush.mjs --test && node scripts/qa/ambush.mjs
node scripts/qa/economy.mjs --test && node scripts/qa/economy.mjs
```

報告輸出：`boss-sim.txt` / `ambush.txt` / `economy.txt`（本目錄）。

## 對照程式：已確認事實

1. **冇 2P Boss HP 倍率常數**（`src/game` 搜過；只有難度 `difficultyHpMul`、物種 `hpMul`、節奏 helper `RHYTHM.hpMul=0.7`）。
2. **武者王** `KING_HP_RHYTHM=60`；節奏 `guard 1500 / opening 2500(normal) / breather 2000 / phaseBreather 2500`。第2–7關 **未接** `BossRhythm`（Stage1Boss 註解）。
3. **全局背擊×2 唔存在**；只有洗地機 recover 背擊×2／正面×0.5。sim 對 stage1 `back:true` 屬**估算偏離**。
4. **2P 攤檔金幣**：只有 `goldfishQuiz` 用 `purse` 分俾 boy/girl；其他攤檔 `after(coins)` **全部入 boy role 錢包**。
5. 休息 `SLEEP_COST=6`；Lv1 鞋8／劍槍甲10／大心12；C2 `stage>=6` 價錢×1.75。
6. 死亡 `dropOnDeath` 清晒裝備（金武器都唔豁免）。

## 仍要 Alan 決定

見主對話「需要我決定嘅事項」。
