# Manus token 等候 — Cursor 分擔（2026-11-21）

Alan：Manus 約兩週先有 token；Cursor 分擔工作。無 merge，除非 Alan 講「merge PR #N」。

## 本輪已做

| 項 | Branch / PR | 狀態 |
|---|---|---|
| #99 隱藏鏈網釐清 | `cursor/c2-stage7-from-88-2610` | 標需人手；唔假 PASS |
| #98 大陸1結局對白 rebase→main | `cursor/c1-ending-dialogue-from-98-2610`（`7f681d4`） | build／validate PASS；請 Alan／Manus 開 PR；文案 provenance 要 Alan 親口確認 |
| #94 C1 合照停 5 秒 rebase→main | `cursor/c1-photo-hold-from-94-2610`（`f6e0556`） | build／validate PASS；Alan 已確認行為；開 PR 後等 merge 指令。與 #98 都改 `story.json`，合時要處理衝突 |

## Manus 開住、建議下一手（Cursor 可繼續）

| PR | 內容 | 建議 |
|---|---|---|
| #90 | C2 開場十句 | Alan 已確認原文；可 rebase＋複測 |
| #94 | （已接手上表） | — |
| #92 | 攻略至第7關待續 | 可 rebase；對齊 #99「待補」文案 |
| #97 | 洗地機 checkpoint | 未驗收；32-bit 洗地機排後；可先 collison／QA 收尾 |
| #95／#96 | 成長／角色集 | 大、仍 checkpoint；後做 |
| #93 | TriBoss 羽毛 | 有失敗紀錄；後做 |
| #88 | 舊第7關 | 由 #99 取代，唔使重做 |
| #91／#100 | 美術 | #100 G+S 已交；洗地機批次未開 |

## 阻塞（要 Alan）

1. 第7關三項文案逐字拍板（而家「待補」）。
2. C1 結局句（#98／新 branch）係咪可當已批准上線。
3. 隱藏鏈網人手測一次，或明示可接受「需人手」後 merge #99。
4. 「merge PR #N」先 merge。
