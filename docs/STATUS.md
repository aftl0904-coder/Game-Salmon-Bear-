# 鮭鮭熊項目狀態（2026-11-03）

## 1. 現況

- `main`：`dfd4413ec9b85f90743d4d669ff6151471596324`（PR #65：大陸2第1關商場已合併；待 Alan 試玩）。
- 開住嘅 PR：[#67](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/67)（ART-17 地圖美術）、[#68](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/68)（大陸2地圖 code）同 [#69](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/69)（STATUS 文件），待審及試玩。
- 地圖 code branch 疊住已合併嘅 #65，亦包含 #67 地圖美術 commit；#67 同 #68 嘅 diff 有重疊。
- `manus/stage4-mobile-fix-20261103`：第4關修復及 QA 進行中，未開 PR。

## 2. 分工同 branch

- Alan：試玩、決定設計同合併。
- Manus：寫 code、跑 QA、開獨立 branch／PR。
- Claude：對 diff 審 PR、記錄設計決定及寫 brief；唔寫 code。
- Cursor：美術批次 ART-17／ART-18；`cursor/` branch 凍結，改內容須先經 Alan 批准。一條 branch 只由一個人改。

## 3. 已確認決定

- 大陸2完成旗標：`sake-kuma-c2-cleared-v1`；`markC2Cleared()` 暫未接駁，待第10關完成時呼叫。
- 只認 Alan 親口講「merge PR #N」先合併指定 PR；唔直接 commit 去 `main`，亦唔自行 close PR。
- 第4關：過關及轉場要只用 touch 可操作；泥鬃場地安全並留足攻擊反應時間；蜜僵追人、變速同重用跳坑機制。

## 4. 下一步次序

1. 完成第4關手機 bug 修復、模擬手機／桌面 QA，開 PR 交 Claude 審，再請 Alan 真機試玩。
2. Alan 試玩已合併嘅 #65，同未合併嘅 #67、#68。#68 原先依賴先合併 #65；各 PR 只按 Alan 明確指示合併。
3. ART-18 琪寶寶藍色手提電風扇全套重畫。
4. 按已確認故事大綱處理主選單及存檔。
