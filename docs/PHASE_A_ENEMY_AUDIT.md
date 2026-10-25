# 階段 A — 敵人行為審查（只讀，未改 AI）

**時間（Asia/Shanghai）：** 2026-10-25 21:00  
**證據：** `/opt/cursor/artifacts/qa-enemy-phase-a/`  
**腳本：** `scripts/qa-enemy-phase-a-audit.mjs`（Playwright 60s 抽樣）

---

## 1. 畫面名稱 → code 對照

| 你觀察到 | Code | 美術 key | 備註 |
|----------|------|----------|------|
| 紅魚 | `species: fish`（刺刺魚） | `art-enemy` | chaser tint `0xff9977`；射小彈 |
| 紫色機械豬／大隻怪 | `species: elephant`（霸鼻象） | `art-enemy-elephant` | 鼻擊近戰；HP×2；較慢 |
| 帽仔兵／棍兵 | `species: barrel`（疾風桶） | `art-enemy-barrel` | 棍近戰；HP×0.6；速×2.05 |
| 刺球 | **唔係敵人 AI** | `hazard-durian` / `blk-spike` | 靜態陷阱，踩中 −1HP |

另有 **kind 角色軸**（blocker / chaser / ambusher / guardian / interrupter / boss）：多數只改 desireX／patrol 範圍，**真正戰鬥套路主要由 species 決定**。R1 `placeEnemies()` **冇 spawn boss**。

---

## 2. 數值表（來自 `enemyAi.ts` + `constants.ts`）

基準：`BOY_SPEED=179`，`ENEMY_SPEED=54`，玩家傷 `PLAYER_ATTACK_DMG=3`，敵傷 `ENEMY_ATTACK_DMG=1`（魚彈 `FISH_BULLET_DMG=1`）。

### Species 乘數

| species | 中文 | HP× | 速× | atkCd× | windup× | knock× | 攻擊 |
|---------|------|-----|-----|--------|---------|--------|------|
| fish | 刺刺魚 | 1 | 1 → **54** | 1 | 1 | 1 | **projectile** 小彈 |
| barrel | 疾風桶 | 0.6 | 2.05 → **111** | 0.5 | 0.62 | 0.4 | melee 棍 |
| elephant | 霸鼻象 | 2 | 0.85 → **46** | 1 | 1 | 1.15 | melee 鼻（meleeR 放大） |

### Kind 基底 HP／前搖（再 × species）

| kind | HP | windupMs | recoverMs | atkCdMs | melee |
|------|----|----------|-----------|---------|-------|
| blocker | 6 | 320 | 280 | 1100 | 50 |
| chaser | 6 | 300 | 260 | 1000 | 52 |
| ambusher | 6 | 340 | 280 | 1100 | 56 |
| guardian | 9 | 340 | 300 | 1150 | 52 |
| interrupter | 9 | 300 | 260 | 980 | 56 |
| boss | 18 | 380 | 320 | 1200 | 70 |

**實作夾逼（`PatrolEnemy.beginWindup`）：**  
- elephant：`windup = max(500, ms)`  
- 其餘：`windup = min(420, max(220, ms))`  
→ 非象實際前搖常被壓到 ~220–420ms，象至少 0.5s。

**受擊／傷害差異（現況）：**  
- 全物種對玩家傷害仍係 **1**（barrel 只改 floatText「輕傷」同 knock×0.4）  
- elephant 命中後可 `grantDominate` 短暫霸體  
- **冇** 正面護甲／背刺倍率／擊飛分輕重型（設計稿未落地）

---

## 3. AI 邏輯摘要（`PatrolEnemy.tick` — 現行路徑）

啟動後幾乎永遠：

1. `seekHeroLane`（跟玩家換線）  
2. 同行 + 距離 < melee + atkCd=0 → `beginWindup` → `strike`（魚射彈）→ 短 `recover`  
3. 否則 **CHASE**：朝玩家 X 走（離線時仍 0.85× 速壓迫）

註解原文：`// Always chase once active — never idle/patrol freeze.`

`enemyAi.tickEnemy` 裡 hop / pause / charge / patrol desireX **對 PatrolEnemy 幾乎唔跑**（有 `fsm` 就 diversion 去 class.tick）。

**陷阱：** `spikes` / `durian` 靜態 overlap，無狀態機。

---

## 4. R1 編制（roster 實測）

- 總數 **37**：fish 13 / elephant 13 / barrel 11  
- kind：chaser 14、ambusher 11、blocker 6、guardian 4、interrupter 2、**boss 0**  
- 分段 `deferEnemy`：wave1 / later / altar

---

## 5. 60 秒狀態分佈（Playwright 證據）

條件：單人倫寶，大致連按 **D 前進 + F 攻擊**，每 250ms 抽樣，205 frames。

| 指標 | 結果 |
|------|------|
| 全域 FSM | **CHASE 97.4%**，ATTACK 1.5%，HURT 0.3%，DEAD 0.8% |
| fish CHASE | **97.6%** |
| elephant CHASE | **96.9%** |
| barrel CHASE | **98.2%**（抽樣期間 **atkPhase 100% = none**，幾乎冇進入攻擊） |
| 同時 ATTACK 中 | max **2**；`>2` 的 sample = **0**（偶發達標，**無 attack-token 系統**） |

檔案：

- `phase_a_report.json` — 匯總  
- `phase_a_samples.ndjson` — 全量  
- `roster.json` — 開場花名冊  
- `phase_a_end.png` — 結束截圖  

---

## 6. 「行為重複」結論

1. **三物種主循環相同：追線 → 靠近 →（偶發）短前搖攻擊。** CHASE 佔比全部 >96%。  
2. **kind 差異弱**：blocker／chaser／guardian 在 PatrolEnemy 裡唔再走 desireX 分支。  
3. **barrel 的 hop/charge 設計在 live FSM 幾乎失效**（60s 內 0% windup/strike）。  
4. **魚「遠程」仍要行近 melee 距離先射**（同近戰觸發條件），唔係風箏。  
5. **刺球唔參與戰術輪替**，只係地面傷害。  
6. 因此「連按 F」有效：敵人自己送上槍口，缺少必須換線／等破綻／優先擊殺嘅壓力。

---

## 7. 未能實測

- 單一物種隔離 30s（bestiary 未有）→ **未能實測** 純種狀態序列  
- Boss 三階段 → R1 **無 boss spawn**，**未能實測**  
- 正面護甲／背刺 → code 無此欄，**未能實測**  
- 亂打通關率 5 次 → 留待階段 E  

---

## 8. 需要你決定（先唔改 B）

1. 畫面「機械豬／帽仔兵」對應：**elephant=豬、barrel=帽仔** 係咪 OK？  
2. 階段 B 要唔要加 **潛行型**、**召喚型**？（建議 R1 先做齊衝刺／重裝／遠程／刺球／偷蜜，新種放 R3+）  
3. 刺球要升級成「沿線慢滾 AI」定保持靜態陷阱？  
4. R1 教學是否只留 fish + barrel + 刺球（設計稿），elephant 延後？
