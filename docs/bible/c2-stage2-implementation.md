# 大陸2第2關實作交接（draft，2026-11-04）

最新確認：Alan 已批准並由本分支接入第7關 D 反應、馴獸師 Boss 卡及 Boss 後離隊提示，原文見 `first-release-dialogue-drafts.md`；以下舊有「待補」描述屬歷史。D 仍只反應、Boss 後才離隊。鏈網 800／1500 ms 保持原值，但逐影格測試仍未通過，須見 `docs/qa-c2s2/README.md`，不代表已驗收。

基底 `main` `077af8b`；規格來源 `c2-stage2-brief.md`、`c2-stage2-answers.md`。首版公開大陸2入口，不依賴 `?c2=1`；第8關未實作，不提前開通。A–E 範圍及配置在 `data/levels/stage7.json`。

| 段 | 實際選用（兩種模式均不自動稀疏／複製） |
|---|---|
| A | `GuardZombie` 保安 ×2；蜜罐 ×1 |
| B | `GuardZombie` ×2、`ProductZombie`（沿用 `HoneyZombie` AI，籠框佔位皮膚）×2 |
| C | `GuardZombie` ×2、固定 `RobotArm` turret ×1；兩個 56／64 px 坑，沿用現有 pit-hop／窿視覺 |
| D | `GuardZombie` ×3、產品化 `HoneyZombie` ×3；原有 stage3 暗幕；尾段「待補」反應 |
| E | `SecurityDirector` 狀態機佔位：55 HP、P2 ≤66%、P3 <30%，第7關 P3 時鐘 1.3 倍；P1 每次召 1 個、同時最多 2 個產品化蜜僵；P2／P3 鏈網目標範圍警告與持續時間由資料控制。P1 以既有低／高 projectile 作鞭索佔位 |

C 的保安近身有程式畫鞭索佔位；機械臂沿用第6關低／高投射物，尚欠原創繩索素材。A–D 籠、鏈、網為無 physics body 的背景 display objects；Boss 鏈網是獨立的 `enemyShots`。招牌和籠號由程式畫文字；素材需無字。美術詳見 `docs/cursor/ART-REQUEST-19-c2-stage2.md`。

D 只反應，Boss 後離隊；主線與結算快照同時寫 `run.puffLeft`，舊檔預設 false，新局 reset；支線保留基準隊伍並不改主線旗標，離隊後主線不跟隨。返隊未決，不實作。此接線仍須完整 QA 驗證，尤其失敗／重試及支線。三項未定文案逐字「待補」。

依現有 `clearRank` 呼叫僅主線的空 `stage7GrowthHook()`，沒有實作或發放成長點；將來正式 hook 必須自行加一次性／主線 eligibility 防重。第10關 `markC2Cleared()` 仍未接。QA 缺口、失敗和原始證據見 `docs/qa-c2s2/README.md`；本分支保持 draft。

## 第一版公開與待續（Alan 確認，2026-11-04）
選單可直接由第6關開新局；第5關主線片尾可順序續第6關，沿用本局／帶不帶及支線隔離。第7關主線 Boss 後觸發既定離隊，結算後顯示獨立「待續」卡，再返回大陸2地圖；地圖只供選已發布的第6／7關。主線快照仍保留 `nextStage=8` 供將來續接，但首版不載入第8關或寫大陸2結局旗標。支線返回既有主線：如主線等待第8關則回停留地圖，不進未實作關卡；第5關片尾支線同樣可返回第7關／停留地圖。此前測試閘的描述屬歷史紀錄，現以 `first-release-confirmations-20261104.md` 為準。三項第7關文案仍「待補」；授權擬稿不等於授權上線。成長系統屬獨立 PR，本分支仍只保留空 hook。
