# 角色／夥伴（JSON 1–2 · 待確認）

> 線上頁：[／bible#cast](/bible#cast) · 來源 `data/characters.json`、`data/companion.json`  
> **取代** `data/player.json`（runtime 已改讀 characters；舊檔可刪）。

## 角色

| id | 名 | role | hp | moveSpeed | jumpVelocity | 武器 |
|----|----|------|----|-----------|--------------|------|
| P-01 | 倫寶 | ranged | 6 | 95 | 290 | 鮭魚槍 → 鮭魚籽 |
| P-02 | 琪寶寶 | melee | 5 | 115 | 300 | 劍（3 段 combo）＋背脊風扇滑翔 |

共用：hitbox／jump（gravity 700、coyote 90、buffer 110、tap 28／full 60）／crouch 0.5／hurt／fall。

平衡目標：`dpsRatioGirlToBoy` 1.0–1.5；bot 通關率 倫寶 55–70%、琪寶寶 70–85%。

## 夥伴

| id | 名 | follow | downed | assists |
|----|----|--------|--------|---------|
| CP-01 | 噗噗 | P-02→P-01 · trail 24–40px · delay 250ms · teleport 160 | hide 5s | AS-01 蜂蜜感應、AS-02 衝撞、AS-03 拾取 I-02 |

限制：`invulnerable`、不能殺 Boss、唔檔玩家。

## 待確認後（3–5）

`data/coop.json`、控制／HUD、Playwright 攻速／滑翔／跟隨／雙人／機械人通關率。
