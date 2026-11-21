# Bug 清單（階段三 QA · 2026-11-21）

自動化 acceptance + extreme +（soak 另記）對 ST-06／金魚眼。

| # | 嚴重 | 重現 | 證據 | 狀態 |
|---|---|---|---|---|
| — | — | 本輪腳本驗收 **0 FAIL**（AC-04／AC-10 樓層掣暫緩 SKIP） | `summary.json` fails=0 | 無阻擋 bug |

## 觀察（非 bug／低優先）

| # | 嚴重 | 說明 | 建議 |
|---|---|---|---|
| OBS-01 | 低 | 電梯過場期間 `physics.pause`；測試若唔 `body.reset`＋`resume`，之後 teleport 會被 body 拉返舊位 | QA 腳本已避開；玩法正常觸發電梯後會 resume |
| OBS-02 | 低 | AC-15 雙人互搶未腳本化 | 標「需人手」 |
| OBS-03 | 低 | 金魚眼假對手節奏已調慢，手感仍要真人搶幾局 | 標「需人手」 |
| OBS-04 | 低 | 舖頭係 code facade，唔係 32-bit shop art | 已知限制 |

## Soak
- 10 分鐘 ASSIST 亂按＋分段 teleport：**PASS**（157 samples，0 pageerror）— `soak_1p_assist.log.json` / `soak10.log`

## 需人手測試

1. **金魚眼節奏**：真人連玩 2–3 局，睇假對手係咪搶太快／太慢。  
2. **2P 搶答**：兩人各自紅掣，答錯後對手可否搶。  
3. **Boss 風機逆風**：打保安總監時前進減速手感。  
4. **全關通關**：A→Boss 人手打通一次（腳本有分段 teleport，非完整操作通關）。
