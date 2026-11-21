# Manus token 等候 — Cursor 分擔（2026-11-21）

Alan：Manus 約兩週先有 token；**Manus 暫時透一唞**。Cursor 同 Claude 兩人格接力：Cursor 做 rebase／實測／推 branch；Claude 收【Cursor → Claude】整理給 Alan、開／換 PR（Cursor PAT 403）。無 merge，除非 Alan 講「merge PR #N」。

## Cursor 已接手（本輪）

| 項 | Branch / tip | 狀態 |
|---|---|---|
| #99 第7關 | `cursor/c2-stage7-from-88-2610`（`42dd3e2`+） | 隱藏鏈網需人手；三項文案「待補」 |
| #98 C1 結局對白 | `cursor/c1-ending-dialogue-from-98-2610`（`7f681d4`） | build／validate PASS；文案要 Alan 確認 |
| #94 合照停 5 秒 | `cursor/c1-photo-hold-from-94-2610`（`f6e0556`） | Alan 已確認行為；與 #98 合時注意 `story.json` |
| #90 C2 開場十句 | `cursor/c2-intro-from-90-2610`（`7ac9117`） | rebase＋**四情境 QA 全 PASS**（desktop/mobile × direct/sequential） |
| #92 攻略首版 | `cursor/guide-from-92-2610`（`186e0cc`） | 封面衝突已解（貼紙＋首版副標）；待補對齊 #99 |
| #97 洗地機 | `cursor/c2-scrubber-from-97-2610`（`ea39cab`） | rebase＋**focus-sameid desktop/mobile exit 0**；仍 checkpoint（非整關／2P／自然進場） |
| #93 TriBoss 羽毛 | `cursor/c1-feather-from-93-2610`（`e1d6f9d`） | rebase＋focused 四個案 **PASS**（Vite DEV）；仍 draft；舊手機失敗歷史保留 |

## 建議下一手（Cursor 可續）

| PR | 內容 | 建議 |
|---|---|---|
| #95／#96 | 成長／角色集 | 大、仍 checkpoint；下一步可 rebase＋build／盤點 |
| #89 | 保安／洗地機 brief | docs；可對齊 #97／#99 |
| #91／#100 | 美術 | #100 G+S 已交；洗地機 32-bit 批次未開 |
| #88 | 舊第7關 | 由 #99 取代 |

## 阻塞（要 Alan）

1. 「merge PR #N」先合（建議可考慮先合 #90／#94，視文案／衝突）。
2. 第7關三項「待補」逐字拍板。
3. #98 結局句是否批准上線。
4. 隱藏鏈網人手，或明示可接受「需人手」。
5. #97 要不要整關／2P 長測。
