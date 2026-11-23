# Cursor → Claude：第六批（batch6 polish2）

**Branch:** `cursor/c2-polish2-2610`（由 `origin/main` @ `3793ed0` 開出）  
**Base:** 唔用 JSON 寫嘅 #118 branch（已合）  
**QA:** `docs/qa-batch6/report.json` — **passed: true**

## 已確認事實

| ID | 結果 | 證據 |
|---|---|---|
| C1 P0 潔淨機器人 | PASS | 出招期間中槍唔打斷（charge Δx≈260 同時連射）；硬直上限；5 招 M1–M5；faceTarget 轉身打背後 |
| C2 死唔掉嘢 | PASS | `Enemy.runC2DeathFade` 唔再 `spawnCoin`；截圖 `docs/qa-batch6/c2-death-fade.png`。補血（壽司／蜜／咖啡）路徑冇郁 |
| C3 第6關 4 行為 | PASS | A–E 每段 ≥3 種 `s7charge/hop/shield/can`；企定射擊清唔晒 |
| C4 P0 電梯後指示 | PASS | 上層平台接住 crest；閃動箭咀＋「上層繼續前進 →」；~3s 到下一段；`docs/qa-escalator/` |
| C5 電梯／升降機／雜物 | PASS | 玻璃側板＋郁動梯級；不鏽鋼門＋開門動畫；prop PNG 重畫；`docs/qa-c2-art2/` |

## 主要改動

- `MallScrubber.ts`：super-armor、hit-stun cap（300ms／3s → 2s immune）、M1 return charge 140px、M3 foam、M4 brush、M5 cart；recover 1200／P3 900
- `GameScene.ts`：foam／brush／cart 傷害；扶手電梯 crest 釋放；上層提示；`bossOn` 開打即 true；reveal 唔再用 storyIntro 卡住 update
- `stage6World.ts`：動畫扶手電梯、不鏽鋼升降機門 `playLiftDoors`
- `stage6.json`：4 行為佈局、上層平台／幣／敵、`elevatorX=2140`
- `Enemy.ts`：C2 fade 唔掉金幣（已確認「怪嘢」= coin，唔係補血）

## 估計

- 潔淨機器人 sheet 仍然係舊圖；招式邏輯已重做。若視覺仍然醜，建議按你講用 Manus 重畫。

## 未驗證／需人手

- 完整 3×（2–4 分鐘）人手試玩手感（腳本用 charge contact + hazardHit 代理 ≥3 心）
- Manus 級藝術品質

## 需要你決定

1. 開唔開 PR（Cursor **唔會自己 merge**）  
2. Scrubber 外觀要唔要轉 Manus（12,000 點）  
