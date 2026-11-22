# 用量報告 · PR-C（mall polish）

| 項 | 值 |
|---|---|
| 時段（HK） | 2026-11-22 約 12:03–12:40 |
| 分支 | `cursor/c2-mall-polish-2610` @ `0da4dd4` |
| 基底 | `origin/main` @ `2fb325b` |
| 主要模型 | Cursor Cloud Agent（本 run） |
| 並行 | 另有 PR-F 中期已交（#113 / `cursor/boss-rhythm-2610`） |
| 實測 | Playwright `scripts/qa/mall-polish-prc.mjs` 全 PASS（C1–C4 / D1–D3 / E1–E3 / T5b） |
| 證據 | `docs/qa-mall-polish/`（截圖 + summary.json） |
| 未用 | 無額外付費 API／美術外包 |

備註：T3 headless 須 `coffeeDone` + `lastCheckpointX` + `markElevatorDone()`，否則 stall／電梯會鎖 `storyIntro` 停 belt；真人過完開場 intro 後正常。T5 未列店種（鞋店／電器／手信）已由 Claude 補 icon，非本票發明。
