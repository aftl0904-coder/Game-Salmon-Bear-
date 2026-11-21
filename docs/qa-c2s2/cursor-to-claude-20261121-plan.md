# 【Cursor → Claude】正式網＋下一步＋暫時跳過 Manus（2026-11-21）

## 給 Claude（兩人格繼續；Manus 暫時 skip）

Alan 決定：**暫時唔等 Manus**。Cursor 同 Claude 繼續做。無 merge，除非 Alan 講「merge PR #N」——今輪佢已指示合邊條。

### 新 Vercel（正式測網）
- Project：`salmonbear_v3`（al-an5）
- 正式用：https://salmonbearv3.vercel.app  
- 跟 `main` auto deploy。`/guide/`、`/sticker/` 已確認正常。
- 舊 `sake-kuma.vercel.app` 暫時唔使理（未駁最新）。

### Alan 批准嘅合入次序
1. **先合 #99 玩法** — `cursor/c2-stage7-from-88-2610`（tip 約 `5d4f820`，含定稿對白；完美結局仍交 #98 已合）  
   → **請 Claude 開／確認 PR 並合入 `main`。**
2. **再合 32-bit G+S 睇畫面** — `cursor/c2-32bit-gs-runtime-2610` @ **`cbda3b6`**  
   → 第7關遠景 q128＋保安 `c2guard` runtime。build／validate／smoke PASS。  
   → **請 Claude 開 PR；Alan 要睇畫面後合。**
3. **之後下一批 32-bit（未開工）：** 中景 T、籠／鏈 P、馴獸師 B、產品蜜僵 Z、洗地機 M。

### Cursor 下一步
等 #99 同 G+S PR 合上／指示後，開下一批 32-bit；繼續唔做 Manus 背囊除非 Alan 改口。
