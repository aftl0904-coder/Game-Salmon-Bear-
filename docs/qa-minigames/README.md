# QA · PR-G minigames（舉旗大賽 + 記貨單）

## Scope
- **F1–F5** 舉旗大賽：取代第 1 關咖啡媽媽攤檔嘅 `stirCoffee` 呼叫；`stirCoffee` function 仍留喺 `src/game/minigames.ts`。
- **M1–M4** 記貨單：第 7 關 Boss 前（x=4580）加攤檔＋攤主；第 7 關會員中心金魚眼搶答唔變。

## 2P
現有小遊戲冇獨立 2P 按鍵分配；舉旗／記貨單暫時跟 1P（←→／WASD／觸控）。

## Run
```bash
node scripts/qa/minigames-prg.mjs
```
（腳本會自己起 Vite @ 47461）

## Acceptance
| ID | 內容 | 證據 |
|----|------|------|
| F1 | 10 輪全啱＝10、全錯＝0 | `F1-perfect.png` / `F1-zero.png` |
| F2 | 陷阱唔撳得分 | `F2-trap.png` |
| F3 | 第一次有教學頁 | `F3-tutorial.png` |
| F4 | 鍵盤＋觸控 | `F4-controls.png` |
| F5 | 第1關攤檔係舉旗唔係攪咖啡 | `F5-stage1-stall.png` |
| M1 | 4 輪長度 3–6 全啱；序列唔會連續三個一樣 | `M1-perfect.png` |
| M2 | 撳錯顯示答案 | `M2-fail-answer.png` |
| M3 | 第一次有教學頁 | `M3-tutorial.png` |
| M4 | 鍵盤＋觸控 | `M4-controls.png` |

結果：`summary.json`
