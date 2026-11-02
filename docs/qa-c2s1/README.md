# QA 記錄 · 第二大陸 Stage 1「購物中心」(Stage 6)

分支 `cursor/c2-stage1-mall-2610`（由 `main` 7757cf2 開出）。
入口：`?c2=1`（寫入 localStorage `sake-kuma-c2-v1`；`?c2=0` 關閉）。大陸一嘅 5 關流程同結局冇改（stage 5 通關 → 片尾字幕，已重測）。

所有測試用 Playwright + swiftshader 真係跑 Vite dev server（`scripts/qa/c2s1/*.mjs`），用 `window.__SAKE_GAME__` 讀遊戲狀態、傳送英雄、強制 boss HP 去觸發階段。
**唔係人手玩出嚟嘅**：手感、難度、平衡未驗證（見最底「需人手測試」）。

## 驗收清單結果

| # | 驗收項 | 結果 | 證據 |
|---|---|---|---|
| 1 | 關卡可進入、無 console error | PASS（1P / 2P，所有 run `errs: []`） | 各 `*.log.json` |
| 2 | A 段有圓頂入口 + 兩座皇冠塔，用同一色盤 | PASS（畫面確認；塔係 mall-far 背景畫入面兩座塔） | `A1-dome.png` `A0-start.png` |
| 3 | A 段 2–3 個保安 honeyzombie + 可拾蜜罐 | PASS（3 隻 `GuardZombie`；蜜罐 x=470 拾取後 honeyGot=1） | `seg_ab.log.json` `A3-guards.png` |
| 4 | B 段坑位 + chaser 會跳坑 | PASS（3 個坑，紅魚 chaser 全部過坑） | `seg_ab.log.json`（`B.pit*`） |
| 5 | B 段 1–2 隻固定機械臂向英雄射擊 | PASS（2 隻；`stayedPut [1280]`；有 shots log） | `B2-robotarm.png` `B3-arm-fire.png` |
| 6 | C 段碎石：先預警光柱 → 落下 → 落地後先傷人 | PASS（事件序 warn → fall → land → hit；站喺旁邊 45px 冇傷；站喺正下面落地先 `碎石 -1`） | `C4-telegraph.png` `C5-landed-hit.png` `debris_under` log |
| 7 | D 段暗角 veil + 4–5 隻敵人 | PASS（`s3world.dark` 0.62，出咗 zone 回 0；1P 5 隻 = 3 honeyzombie + 2 機械臂；2P 6 隻） | `D3-darkveil.png` `seg_d.log.json` |
| 8 | D 段籠子線只觸發一次 | PASS（走近→走遠→再近，`count: 1`） | `D4-cage.png` `seg_d.log.json` |
| 9 | E 段三階段，P3 喺 HP<30% | PASS（強制 HP 後：P1→P2（≤66%）→P3（<30%）；每階段循環 stalk→windup→barrage/sweep→exposed） | `seg_e_1p.log.json` `E-p*.png` |
| 10 | boss 後蜜罐 → 正常過場 → 通關卡；噗噗全程跟隨 | PASS（1P/2P：boss 死 → 蜜罐 → 拾取 → 通關卡；「第二大陸・下一關 製作中」灰掉、冇片尾字幕按鈕）。噗噗 = 2P 先有（現有機制：寵物綁女角，未改） | `E2-clear-card.png` `seg_e2_*.log.json` |
| 11 | tsc / build 通過 | PASS（本機 `npx tsc --noEmit`、`npm run build`）；CI 待 push 後睇 | — |
| 12 | 每段真實 Playwright 運行 + 截圖 | PASS（A/B/C/D/E 都有） | `docs/qa-c2s1/*.png` |

## 測試期間發現並已修嘅 bug

1. **D 段 dark veil 完全冇作用**：`tickStage6` 漏咗叫 `s3world.update` → 補上（`dark` 由 0 變 0.62）。
2. **機械臂喺 1P 被「每 4 隻抽走一隻」同 2P「每 3 隻複製」影響**（2P 會出兩隻疊埋）→ 機械臂豁免，永遠只有手放嗰幾隻。
3. **偵察機（drone）永遠鎖唔中**：錐形寬 26px × 85px/s 只夠 0.61 秒，鎖定要 0.65 秒 → 錐 38px、鎖定 0.42 秒；重測有 `drone-shot` 同扣血。
4. **碎石預警光柱太淡**（alpha ≤0.3）→ 加亮加實，底部加橙色圈。
5. 之前已修：測試傳送高度 / 掉落傷害判斷（`CHUNK_HALF_W` 24→20，見 commit）、草叢上大理石、遠景樹影、混凝土斑點。

## 其他檢查

- Stage 1 / Stage 5 開局正常；Stage 5 通關卡仍然係「片尾字幕」按鈕（`R-stage5-clear.png`）。
- 亂按 / 長按 soak：2P 一次（`soak_2p_run1.log.json`，只傳送到 A、D，終局 game over）、1P 一次（`soak_1p.log.json`，遊戲內時間 366 秒，隨機傳送 A–E 各段 28 次，0 error、冇 crash）。

## 未驗證 / 需人手測試

- 手感、難度曲線、boss 公平度（P2 偵察機 + 掃描、P3 連擊）— 只確認功能運作，未有人玩。
- 真正 10 分鐘連續遊玩（最長一次 soak 係遊戲內 366 秒）。
- 音效/音樂：沿用 stage 5 同 boss5 嘅曲，未有新曲。
- 手機觸控、真實 GPU。
- 2P 完整打穿全關（只測咗 E 段 + 傳送）。

## 已知限制 / 如實披露

- Boss 美術係 `triboss` 動畫幀重新調色嘅**暫代**；保安帽子係程序繪畫；機械臂 / 偵察機 / 碎石 / 籠子 / 圓頂係生成嘅圖 + slice，未經美術確認。
- 機械臂係獨立 class `RobotArm`，唔係字面上「barrel + stationary flag」。
- Boss 卡文字、開場字卡、籠子旁白（「噗噗隻耳仔輕輕郁咗一下……」）係我寫嘅，**需要 Alan 確認**。
- Boss 場地 x 4640–5280（640 闊），觸發點 4680。
- 籠子旁白用 floatText，淡出時描邊會糊（現有 floatText 行為）。
