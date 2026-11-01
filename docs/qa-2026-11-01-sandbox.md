# Sandbox QA 2026-11-01 (branch `cursor/res-2x-on-58-2610`)

Scripts: `scripts/qa/*.mjs` (Playwright + swiftshader, dev server on port 47313; edit `PORT`/paths at top). Evidence PNG/JSON were written to `/opt/cursor/artifacts/` (not committed).

## 已確認（真係跑過）
- **2P Boss 打到死 → 清關 → 世界地圖**：stage 2 easy、stage 2 normal、stage 3 normal 由 script 同時操控兩個玩家打死 Boss，無 crash、無 pageerror。Stage 2 normal 女角死 2 次、Stage 3 normal 死 1 次：出「投幣續關」→ Enter 後兩人同位置（3208/3208）復活、幣 −1、繼續打到 Boss 死。
- **Stage 4 / 5 Boss**：bot 太弱打唔死（stage 5 normal 用晒 8 隻幣、stage 4 hard 用晒幣），所以改為 Boss 打 10 秒後將 `queen.hp` 設做 3（**人手改血，唔係自然打死**）再由兩個玩家打完：Boss 死 → 清關 → worldmap 流程無 crash。Stage 5 嗰次曾去到 credits。
- **幣用盡**（stage 5）：出「幣已用盡 R／Start 回選單」，唔係 softlock（之前 harness 誤報 softlock = 續關／game over 畫面，harness 唔識處理）。
- **customSkins**：用 route 攔截 `custom.json` 載入 `public/art/custom` 嘅噗噗圖。**發現並修正一個真 bug**：呢條路徑原本用 1× canvas、冇 `markHd`，噗噗／頭像／故事圖喺 2× 畫面會糊。已改為按 `pupu.res`／`PORTRAIT_RES`／`STORY_RES` 畫大再 `markHd`；實測 `anim-pupu`、`art-bear`、`portrait-pupu(-hollow)` 全部 resolution=2，過場同遊戲內都正常 render，冇 error。
- **手掣（模擬 `navigator.getGamepads`）**：menu（Start/A）、P1 十字／左 stick 移動、A 跳、B/X 攻、Y 絕招、LT 換武器、↓ 蹲；第二支掣 = P2 同樣一套；雙人同時操作互不干擾；Start 暫停；中途拔掣會停。P2 絕招要有目標先扣 MP（冇敵人會「無目標」）。
- **手機（Playwright 觸控 + CDP touch）**：iPhone 13 橫、Pixel 7 橫、640×320 細機：按鈕全部喺畫面內，左右／蹲／跳／攻／換／絕／Ⅱ 暫停全部有效，多指（按住右 + 點跳）有效；直向會出「請將裝置橫向遊玩」。

## 未能驗證（sandbox 做唔到）
- 真機 FPS、發熱、電量、記憶體（呢度係 swiftshader 軟件渲染 ~27fps，數字無參考價值）。
- 真手掣延遲／相容性（8BitDo、PS、Switch Pro、iOS Safari Gamepad API 差異）。
- 真手指觸控手感、notch／safe-area、iOS Safari 網址列伸縮、`DeviceMotion`／麥克風權限提示。
- Stage 4、5 Boss 自然打死（bot 太弱）。

## 小發現
- 手機觸控按鈕最細約 42×38 CSS px（iPhone 13 橫），低於 Apple 建議 44pt；640 闊細機 ~39×36。
- 手機 2P 只有 P1 有觸控掣，P2 要外接掣／鍵盤。
- 手機遊戲內仍顯示鍵盤提示字（「雙人：←→／S蹲 …」）。
- `public/art/custom/pupu-*.png` 現成放喺 repo（`custom.json` 係 `null`，未啟用）；個噗噗造型似 Winnie the Pooh（紅衫黃熊），啟用／發佈前建議確認版權風險。

## 第二輪（待辦 1–4）

- **Stage 5 大佬**：Phase 3（盾裂後）原本 `shield`↔`crack` 兩個狀態互相切換，**完全冇攻擊**；shield 期間仲免疫接觸傷害。另外 Phase 2 嘅貓頭鷹羽毛安全位設喺大佬自己 x（腳下死角），推土機只係一條冇傷害嘅視覺波。已修：Phase 3 加光束齊射（高低交替，要蹲／跳）同「羽毛雨＋蜂蜜雨＋蛋」風暴，大佬接觸傷害常開；羽毛安全位改喺遠離大佬同玩家嘅位；推土機改為預警線 + 實體掃過（跳過）。實測（`scripts/qa/camp5.mjs`，玩家企喺大佬面前狂按攻擊、唔閃）：修前 phase 3 零傷害打贏；修後約 17 秒死。**未驗證**：閃避高手嘅通關率／難度是否公道（要真人試）。
- **Stage 1 卡位**：量度到兩個原因。(a) 紅魚追到 16/32px 台階牆邊就 `setVelocityX(0)`，停喺牆前 ATTACK 狀態郁唔到（實測 975px 停 5 秒以上）；(b) 玩家行入 16px 矮台階要跳先過。已修：敵人唔再被矮台階阻擋；玩家對 ≤18px 矮台階自動踏上；敵人喺窄坑（≤90px）邊卡住 0.7 秒會跳過去。重跑 stage 1 bot 行足全程無卡位。**未確認**呢個就係 Alan 見到嗰個位（無法同佢確認），如果仲有，請俾 x 位置或截圖。
- **敵人移動 review（stage 1–5 逐段 sample）**：卡住嘅係上面（a）同 stage 5 大堂 x≈688 嘅坑邊紅魚（原因同樣係坑邊阻擋）；設計上唔郁嘅：`MarketStall`／`StallKeeper`（stage 3 攤檔）、`ClockPunch`（stage 4 定時炸彈）；偏慢：蜜僵（約 16px/s，倫寶 105px/s）、鏡影漂浮 34px/s、紅魚 51px/s（約倫寶一半，永遠追唔到玩家）。量度時多次「冇郁」其實係我 teleport 去咖啡車位置觸發小遊戲暫停，已排除。**未驗證**：個別敵人慢係咪「太慢」係手感判斷，要真人。
- **Stage 1 加長 50% 試做**：`scripts/level/extend_stage1.py` 由 `stage1.base.json` 生成新 `stage1.json`（世界闊度 3800 → 5700，`worldW` 欄位 + `WORLD_W` 改為可按關設定）。內容係**回收**舊段落（S3/S4/S5/S1 複製、紅魚部分換桶仔、加 1 隻機械豬、多 1 個存檔點、金鮭掉落冇複製），唔係新設計。bot 跑足全程冇卡位、validators 全過。**未驗證**：真人節奏／難度、美術重複感、其他 4 關。
