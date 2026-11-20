# Manus token 等候 — Cursor 分擔（2026-11-21）

Alan：Manus 約兩週先有 token；Cursor 分擔工作。無 merge，除非 Alan 講「merge PR #N」。

## 本輪已做

| 項 | Branch / tip | 狀態 |
|---|---|---|
| #99 隱藏鏈網釐清 | `cursor/c2-stage7-from-88-2610`（`6f070f3`） | 標需人手；唔假 PASS；runtime 三項文案仍「待補」 |
| #98 大陸1結局對白 | `cursor/c1-ending-dialogue-from-98-2610`（`7f681d4`） | build／validate PASS；請開 PR；文案要 Alan 親口確認 |
| #94 C1 合照停 5 秒 | `cursor/c1-photo-hold-from-94-2610`（`f6e0556`） | build／validate PASS；Alan 已確認行為；與 #98 都改 `story.json`，合時要處理衝突 |
| #90 C2 開場十句 | `cursor/c2-intro-from-90-2610`（`266a218`） | rebase→main；build／validate PASS；請開 PR |
| #92 攻略首版至 C2S2 | `cursor/guide-from-92-2610`（`186e0cc`） | rebase 解衝突：保留「盒帶貼紙」＋#92 副標；第7關三項仍「待補」；build／validate PASS；攻略仍有 `?c2=1` 一句，合 #99 後再對齊 |
| #97 洗地機 checkpoint | `cursor/c2-scrubber-from-97-2610`（`c134c1a`） | rebase 無衝突；build／validate PASS；**仍未驗收**（README／sameid 局部 vs focus-final 手機 FAIL）；今次未重跑 Playwright；不可當完成 |

## Manus 開住、建議下一手

| PR | 內容 | 建議 |
|---|---|---|
| #90／#92／#94／#97／#98 | （已接手上表） | 請 Manus／Alan 用 Cursor branch 開／換 PR；**等「merge PR #N」先合** |
| #95／#96 | 成長／角色集 | 大、仍 checkpoint；後做 |
| #93 | TriBoss 羽毛 | 有失敗紀錄；後做 |
| #88 | 舊第7關 | 由 #99 取代，唔使重做 |
| #91／#100 | 美術 | #100 G+S 已交；洗地機 32-bit 批次未開 |

## 阻塞（要 Alan）

1. 第7關三項文案逐字拍板（而家「待補」）。
2. C1 結局句（#98）係咪可當已批准上線。
3. 隱藏鏈網人手測一次，或明示可接受「需人手」後再考慮 #99。
4. #97 要唔要 Cursor 續跑 focus-sameid／整關，定等 #90／#99 合入後再整合。
5. 「merge PR #N」先 merge。
