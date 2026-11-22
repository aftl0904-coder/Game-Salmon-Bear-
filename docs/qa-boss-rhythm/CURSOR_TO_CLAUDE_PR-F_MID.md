# 【Cursor → Claude】PR-F 中期（只交第1關 WarriorKing）

**PR #／branch：** （未開 PR）`cursor/boss-rhythm-2610`  
**Remote：** `aftl0904-coder/Game-Salmon-Bear-`  
**Step：** T9_BOSS_RHYTHM step 1 only — **STOP pending Alan playtest**

## 改咗
- 新增共用 `src/game/enemies/BossRhythm.ts`（GUARD→WARN→ATTACK→OPENING→BREATHER）
- **只**套落 `WarriorKing`（`Stage1Boss.ts`）
- `GameScene.hurtHero`：非 ATTACK 撞王 → soft push、0 血；`damageEnemy` 顯示「叮！」
- Playwright K1–K4 + 短錄影／截圖：`docs/qa-boss-rhythm/`

## acceptance
| ID | 結果 | 證據 |
|----|------|------|
| K1 GUARD/BREATHER 0 dmg + ding | **PASS** | `report.json` k1_*；`k1-guard-ding.png` |
| K2 OPENING 有傷害 | **PASS** | 180→177（weak×3） |
| K3 非 ATTACK 撞唔扣血 | **PASS** | soft push vx=-120 |
| K4 每段血 3–4 OPENING | **PASS** | 4 openings / segment 60 |
| K5 七個 Boss | **未做** | 等 Alan |
| K6 清關回歸 | **未跑** | 中期只交第1關 |

## 最終數值
- WarriorKing HP：**180**（round(50×0.7)=35 太薄；調到約 3–4 OPENING／段，**玩家傷害未改**）
- GUARD 1500 / WARN ×1.3 / ATTACK speed ×0.8 / OPENING 2500（easy 3000 / hard|hell 2000）/ BREATHER 2000 / 轉段 BREATHER 2500 + shake

## 預覽
- 截圖：`docs/qa-boss-rhythm/k1-guard-ding.png`、`k2-opening-hit.png`、`k3-soft-push.png`、`cycle-*.png`
- 錄影：`docs/qa-boss-rhythm/warrior-rhythm-short.webm`
- `npm run build` PASS（`build.txt`）

## 卡住／疑問
- **其他 Boss（QueenBee / MirrorOwl / MudMane / TriBoss / MallScrubber / Trainer）未套用** — 等 Alan 試手感後先繼續 step 3。
- 180 HP 按「每 OPENING 約 6 下 × weak 3」估；請 Alan 確認 1P 冇裝備手感。
- OPENING 一律當 weak window（沿用 bossHitDamage weakBase 3）。
- Headless WebGL 偶發 `resolution` null；邏輯驗收仍 PASS。真人預覽請用本機／preview。

## 請 Alan
試第1關武者王節奏：護盾叮、出招空隙、喘氣可打、轉段抖一陣。**OK 先繼續其餘 Boss；未覆就停。**
