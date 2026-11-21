# C2S1 商場強化 — QA 測試案例（階段三）

對應 GDD `docs/gdd/C2S1-MALL-POLISH.md` 驗收清單 + 玩家三改（L 節）。  
腳本：`scripts/qa/c2s1/acceptance.mjs`、`soak.mjs`、`extreme-restart.mjs`。

| ID | 操作步驟 | 預期 | 對應 AC |
|---|---|---|---|
| T01 | 開 ST-06；分別停 A/C/D 段截圖，讀 moodWash alpha／色 | 光→陰→恐可辨 | AC-01 |
| T02 | 行／傳送到 elevatorX≈1995；等或 Skip | 假 3D 電梯過場；出後 mood≥陰 | AC-02 |
| T03 | （樓層掣房） | **本輪暫緩／N/A** | AC-03/04/10 |
| T04 | 同站位企射 vs 踎射，記 muzzleY | 踎射 Y 明顯較大（較低） | AC-05 |
| T05 | 生成魚追兵→擊殺；0.5s 內查 corpse | 無長殘影／可互動物件感 | AC-06 |
| T06 | 魚進入 windup；確認有 telegraph 旗／驚嘆 | 有短預兆再衝 | AC-07 |
| T07 | B 段截圖／掃 Text物件 | 招牌+門/窗至少兩項 | AC-08 |
| T08 | A 段掃文字 | 中庭裝置＋扶手電梯／電梯 | AC-09 |
| T09 | 讀 README | 有電梯、踎低、會員中心說明（迷你房暫緩可寫明） | AC-11 |
| T10 | 開會員中心完成／抽局 | 7 題；第 7 難題；≥70 庫；無免責字 | AC-12/13/16/19 |
| T11 | 答啱／答錯／超時幣 | 加／扣／唔變負 | AC-14 |
| T12 | 單人紅掣搶答 vs 假對手 | 可搶；假對手 Q1≥2.4s | AC-15 部分／L3 |
| T13 | 行到 CP2（1600） | 開金魚眼；CP1 唔開 | AC-17／L1 |
| T14 | ST-07 stalls.json + 進關 | game=goldfish；有會員中心標 | AC-18 |
| T15 | 頭段 x&lt;1200 | 只教地滑；雜物隱藏 | L1 |
| T16 | B 段舖頭招牌列表 | ≥6 個店名 | L2 |
| T17 | 亂鍵 60s＋長按 | 無 pageerror crash | 極端 |
| T18 | 重開 play 兩次 | 可再進關 | 重開 |
| T19 | soak ≥10 分鐘 ASSIST | 無 crash | 連玩 |

結果寫入 `docs/qa-c2s1/results/`（或 `/opt/cursor/artifacts/qa-c2s1-acceptance/`）。
