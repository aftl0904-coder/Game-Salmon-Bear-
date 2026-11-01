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

## 貓頭鷹大佬 (MirrorOwl) 戰鬥手感 Pilot（2026-11-01 夜）

只改貓頭鷹 + 全域受擊。腳本：`scripts/qa/owl/*.mjs`；截圖：`docs/qa-owl/`。

### 已確認事實（Playwright + swiftshader 實跑，~27fps）
- 受擊「冇擊退」真正原因：`hurtHero` / `hitByFishBullet` 設咗 knock 之後即刻 `freezeActors()` 歸零速度；之後 hero 最大水平速度只有 `moveSpeed+60`(≈171) 都會吞 knock。`hazardHit` default `knockX:0` 冇人用（所有 caller 都有傳值），唔係根因。
  修正：freeze 完重新套用 knock；hurt-lock 期間放寬 `HURT_MAX_VX=380`；大佬攻擊用 `BOSS_HURT_LOCK_MS=550`(扣 200ms freeze 後實際約 350ms 可移動) + `BOSS_KNOCK_X=360`；雜兵 lock 維持 260。
  量度（實測位移）：雜兵 28–36px（之前 0）；大佬子彈 78px；貓頭鷹接觸 72px（之前 0）。未去到 ~100px。
- 貓頭鷹 Phase 1 羽幕：warn 光柱（500ms）→ 羽毛出現 → 下墜(190px/s)；缺口 = 玩家平均位置 ±55–85px（靠邊時自動換邊，否則 clamp 會令缺口剛好壓喺玩家頭上）。
  bot 睇到 cue 先反應：反應 350/600ms 4 次全避開；900ms 反應 4 次中 1 次中；企定唔郁 4 次中 3 次中。
- Rest 反擊窗 1.6s、免費 3 下；第 4 下 → 「貪心！」tell 500ms → 兩邊地面波（要跳）。實測 forced hits：rest→tell→blast，企喺旁邊冇跳會中 1 血。
- Phase 2：observe 2.4s（3 隻，只有真身有水面漣漪+倒影）→ tell2 650ms（真身飛去鎖定位置上方 + 紅色落點）→ plunge（只有落點有傷害）→ window2 1.2s（3 下免費，第 4 下 → 同一個貪心反打）→ 重新洗位。避開 plunge 實測成功。
- 重大舊 bug（已修）：`OwlDecoy` 從未 `syncDepth()` / 未播 anim → depth 0，分身喺實戰中完全睇唔到。修正後三隻可見（`docs/qa-owl/phase2-three-owls-ripple.png`）。
- 倒影：原本 depth 0 + 位置喺橋面下 → 完全睇唔到。而家 depth 104、擺喺水面帶 + 一圈月光漣漪（因為貓頭鷹身體會遮住倒影本身）。
- Phase 3：dive 前 450ms cue（橙色 + 「！」）；weak 窗傷害由 ×3 改 ×2，第 4 下 → 貪心反打，所以一個窗打唔死（12HP 要 ≥2 窗）。
- rise / land 期間唔再有接觸傷害（之前企邊度都會被無預警撞）。
- bot 全程 fight（boy 遠程，單命 6HP，normal）：反應 350ms polite n=4 → 1 勝；反應 700ms n=3 → 0 勝；貪心 n=3 → 0 勝。死亡位置主要係 phase 2→3（反光、window2 邊緣、guard 接觸/dive）。

### 估計（未驗證）
- 「真人 4–5 次過關」只可以用 bot 勝率（~25% 單命）粗略估：偏難但可玩；真正手感必須人手。
- 反光懲罰對 boy 遠程特別重（子彈途經分身會觸發）；girl 近戰較少受影響。未量化。
- 倒影／漣漪夠唔夠明顯，我睇咗截圖覺得見到，但係人眼判斷。

### 未驗證
- 2P 對貓頭鷹新階段、真手掣 / 觸控、真機 60fps 下 cap 3 下嘅時機（swiftshader 27fps 下 rest 窗通常得 3 下，第 4 下要真機先測到）。
- 全域 knock 改動同樣令其他 4 個大佬嘅命中擊退變咗（`hurtHero` / `hitByFishBullet` 共用；hurt-lock 與 boss-damp 只對貓頭鷹生效）。

## 補充：大佬傷害 / 完美結局分支

- 大佬傷害：新增 `engine/bossDamage.ts`（`bossHitDamage`：實際 dmg ÷ 基礎 3，四捨五入，封頂）。基礎一下 = 以前嘅 1（weak 窗 ×3，貓頭鷹 ×2）。普通窗封頂 2、weak 窗封頂 5（貓頭鷹 4）。QueenBee / MirrorOwl / MudMane / TriBoss 四個 override 都已改；實測 dmg 3/5/8/15 → 普通 1/2/2/2；weak 窗 3/5/5/5（貓頭鷹 2/3/4/4）。Stage 1「武者」係普通 PatrolEnemy（hp 18、直接用實際 dmg、冇封頂），未改。
- 完美結局：`C11_PERFECT`（`data/story.json`，對白全部 placeholder「［完美結局對白 #n — 待 Alan 填寫］」，舞台指令照抄 C11）。條件 `perfectEnding()`：11 個朋友全部喺存檔（`savedFriends()` + 今次 `friendsSaved`）。實測：0/11、10/11 → 原 C11；11/11 → C11_PERFECT（截圖 `docs/qa-owl/ending-*.png`）。
- Guide：刪走「五罐蜂蜜」，改成「救全部 11 個小朋友」。

## 待辦整合 C / D / E（2026-11-02）

- C 完美結局：改成「同一次 run 救晒 11 個」（registry `runFriends`，主選單開新 run 時清空；唔再讀瀏覽器存檔）。實測 10/11 → false、11/11 → true、只有存檔無 run → false。Stage 1「武者」(PatrolEnemy boss) 加 `receiveHit` 封頂：以基礎一下(3)為單位 1–2 倍，實測 dmg 3/5/8/15 → 3/6/6/6（hp 18 節奏不變）。
- D 單車：1→2、2→3、3→4、4→5 全部經 `worldmap(next:'bike')`；`BikeScene.init({to})` 決定目的地名、配樂(`stage{to}`)、完成後 `stageNo`。背景圖維持同一組。實測四段都入到 bike、目的地名正確、Enter 略過後入正確關卡。揀去非預設關嘅話仍然跳過單車（沿用舊行為）。
- E 聖經金句：`data/verses.json`（1–5 關），WorldMapScene 揀關時頂部顯示對應經文（跟住 ←→ 更新），確認後停 2.6 秒或按 Enter/A/點擊先出發；finale→credits 路徑唔顯示。

## 2026-11-02 攤檔檔主造型 + 椰青波波黑窿

### 1) 5 個檔主各有造型
- 新增 `public/art/props/keeper2..5.png`（夾餅叔叔／蛋撻哥哥／開椰青嘅泰國人／刺身師傅，手持各自食物），以 `mama.png` 作風格參考，AI 生成後用 `scripts/qa/owl/keeper_key.py` 去綠底、裁切、縮到 128px 高（res 2）。
- `GameScene.keeperTex()` 按關卡揀 `cs-keeper{N}`，stage 1 保持 `cs-mama`；移走 stage 2/3 檔主染色。stage 2–5 冇另畫「遞出」姿勢，到達 checkpoint 時改為小跳一下（stage 1 仍換 `cs-mama-offer`）。
- 實測：`scripts/qa/owl/keepers.mjs` 逐關開、傳送到檔口，截圖 `docs/qa-keepers/stage{1..5}-{before,reached}.png`；5 關檔主 texture 分別係 cs-mama / cs-keeper2..5，displayHeight ≈ 64，console 0 error。
- 未驗證：人手睇過美術一致性（AI 圖縮細後唔係逐 pixel 手畫）；cutscene 內頭像／對話立繪仍用舊嘅，未改。

### 2) 椰青 tiltGame 黑窿
- `minigames.ts` 新增 `tiltLayout()`：第 1 個黑窿放喺起點→目標窿連線上（隨機插值點 + ±6px 側向偏移），其餘黑窿照舊隨機。
- 統計（`tilt.mjs`、`tilt2.mjs`，1 萬次）：連線被擋 100%，最小窿距起點／目標窿／黑窿互相 ≥ 36／38／40，BFS 驗證全部可解。
- 實機輸入（`tiltplay2.mjs`，朴素「直線瞄準目標窿」控制器）：頭兩回合波都跌入線上黑窿（`tilt-pit-fall.png`），第 4 回合要繞先入到窿。樣本細、控制器唔係真人，只證明邏輯有效，難度手感需人手測。

## 2026-11-02 死亡清裝備 / 通關卡「瞓覺」「賭檔」/ 裝備視覺化

### 1) 死亡全清裝備
- `gear.ts dropOnDeath(who)`：該角色 6 項全部歸 0（含大心心、金劍／金槍），回傳被清走嘅清單；`GameScene.knockOut` 顯示「裝備全部清走：…」。只清死咗嗰個角色（2P 另一個唔受影響）。
- 實測 `scripts/qa/gear/death_wipe.mjs`：girl {heart3,sword3,armour2,boots3,charm2} 死一次 → 全 0；boy 嘅 localStorage 不變。截圖 `docs/qa-gear/death-float.png`。

### 2) 通關卡新按鈕
- `ClearAction` 加 `sleep` / `gamble`，新增 `clearMenus.ts`（確認彈窗、擲幣彈窗）。
- 瞓覺 12 幣：確認後全隊回滿血，由較多幣嗰個角色畀；已滿血或幣唔夠 → 掣灰色、彈窗唔可確認。賭檔：落注 20 幣，50% 變 40、50% 輸晒；擲幣動畫約 1.4 秒。
- 實測 `sleep_gamble.mjs`：幣 60、HP 2/6 → 瞓覺後 HP 6/6、幣 48；賭檔強制贏 48→68、強制輸 68→48；彈窗開咗時 Enter／Esc 唔會誤觸背後嘅「下一關／返主選單」。`broke_carry.mjs`：幣 5 時兩粒掣灰色並被方向鍵跳過。
- 發現：原本每關開始都係滿血，「瞓覺回滿血」會冇作用。所以加咗 `CARRY_HP_BETWEEN_STAGES = true`：通關時剩餘 HP 帶入下一關（最少 1）。實測 HP 2 → 第 3 關開局 HP 2。呢個係平衡改動，要退返原樣只需將常數改 false（瞓覺掣會一齊隱藏）。
- 順手：通關卡 Esc 原本係 `once` 直接返主選單，現在彈窗／小朋友檔口開住時唔會誤觸（`shop_esc.mjs`：檔口內 Esc 只關檔口）。

### 3) 裝備視覺化（`gearFx.ts`，唔畫新圖）
- 盔甲：疊一份同幀 sprite，銅／銀／金染色（透明度 0.4／0.46／0.5）＋ 每 2.4 秒一次加色閃光。
- 劍（琪）／槍（倫）：武器手邊 1／2／3 條光線，顏色銅／銀／金，閃爍。
- 實測 `gear_fx.mjs` 截圖 `docs/qa-gear/tiers-zoom.png`（上排琪寶寶、下排倫寶，左至右 0–3 級）。
- 未驗證：光線位置係固定偏移，唔會跟住每格動畫嘅劍位置移動（揮劍時光線留喺原位）；金色整體偏黃要人手睇係咪接受；冇加心心／鞋／蜜符視覺（brief 只要求盔甲同武器）。

## 2026-11-02 Stage 4 泥鬃 / Stage 5 △畝大佬 換動畫 sprite

### 現況核對（和需求描述有出入）
- 兩隻大佬嘅正式美術其實一早已經喺 repo：`art-src/anim/boss/triboss/*`（batch-13，已切片成 `public/art/anim/triboss.png` + `data/anim/triboss.json`，TriBoss 本來就有 `hasArt` 路徑，`makeTexture` 只係冇圖時嘅後備）；`art-src/anim/boss/mudmane/*` 有 10 張 AI 生成動作表，但從未切片／接駁。所以冇重新生成，直接用現成同 pipeline 嘅圖。
- 同樣情況（有 art-src 未切片）：`art-src/anim/enemies/E-11 honeyzombie / E-12 taximonster / E-13 punchclock`（Stage 4 三隻雜兵仍係 `makeTexture`），今次冇動。

### 改動
- 新 `scripts/art/slice_mudmane.py`：魔術粉紅去底，每張動作表按黃色安全帽面積同 walk 表對齊比例（因為騎車表入面嘅人細好多），出 `public/art/anim/mudmane.png`（30 格，cell 113×121 邏輯 px，res 2）+ `data/anim/mudmane.json`；動畫：ride / charge / walk / summon / nailgun / punch(拆做 windup + strike) / hurt / defeat。`heroAnims.ts` 註冊 `mudmane`。
- `MudMane` 同 `TriBoss` 都改成 `extends AnimEnemy`，刪走 `makeTexture` 後備同 `hasArt` 分支。MudMane 每個 act 對應動畫（`MUD_ANIM`）：intro/anticip/recover=ride、charge=charge（碰撞箱放寬到 96 包住電單車）、platform/approach=walk、summon=summon、volley=nailgun、windup/strike=punch 前後半、exposed=hurt、死=defeat。原有 telegraph 染色（anticip/windup/exposed）保留，方便睇出弱點窗口。
- TriBoss 死亡：unmask → defeat 由動畫自己帶，唔再有 bounce tween（呢條路徑本來已經係咁，只係移除咗後備）。

### 實測（Playwright，真開遊戲打大佬）
- `scripts/qa/owl/boss_acts.mjs` / `boss_acts_p3.mjs` / `boss_defeat.mjs`。
- Stage 4：anticip→charge→recover→platform→summon→volley→approach→windup→strike→exposed→死，逐個 act 打印 `anims.currentAnim.key`，全部對應正確（ride/charge/walk/summon/nailgun/walk/windup/strike/hurt/defeat），console 0 error。截圖 `docs/qa-bossart/mudmane-acts.png`、`defeat-4-5.png`。
- Stage 5：idle/point/rain/shield/hurt 對應 act 正確，強制擊殺 → unmask → defeat 播完，勝利流程進入通關卡。
- 未驗證：人手打過兩場 boss 嘅手感（電單車衝撞箱 96px 係估計）；泥鬃嘅釘槍子彈（`nail.png` FX）同泥浪仍用舊嘅代碼畫；「hurt」第一格係全白受擊閃光（原圖就係咁）；bike 表有少量紅色邊緣（原圖輪輻透底色殘留，縮細後幾乎睇唔到）；Stage 4 三隻雜兵仍係 placeholder。

## Stage 1 mini-boss 武者王 (WarriorKing)

- Change: the altar ambush (4 mobs rushing at once) is replaced by a real boss fight. `WarriorKing extends AnimEnemy` (`src/game/enemies/Stage1Boss.ts`, `hatsoldier` set, 1.5x, HP 50), `boss` field added to `data/levels/stage1.json` (trigger 5280, arena 5240–5690). The reveal reuses `startQueenFight` / `queenReveal` / boss bar / `onQueenEvent`; the 4 old altar mobs are now the P2 (2) and P3 (2) summons. Defeat -> `kingDefeated()` -> `bossOn` -> existing honey-tree `checkWin` -> C2 outro.
- Test: `scripts/qa/owl/king_acts.mjs` (STAGE=1, Playwright + swiftshader, hero kept alive). Screenshots in `docs/qa-king/`.
- Observed (log): P1 stalk -> throw-low/throw-high; P2 (hp 33/50) +2 summons, throw / windup / dash / recover; P3 (hp 17/50) +2 summons, fan / windup / dash / exposed; exposed hit 16->13 (x3), normal hit 13->12; defeat -> bar removed, minions dead, `bossOn` true, standing on the goal -> `outro`.
- Not verified: dash contact damage on a real hero (test keeps the hero invulnerable), fan fairness (low/high shots overlapping), pacing/difficulty by a human, 2P.

## Stage 4 mobs on real animation (蜜僵 / 的士怪 / 打卡鐘怪)

- Change: `scripts/art/slice_stage4mobs.py` slices art-src E-11/12/13 into `public/art/anim/{honeyzombie,taximonster,clockpunch}.png` + `data/anim/*.json` (registered in `heroAnims.ts`). `HoneyZombie` / `TaxiMonster` / `ClockPunch` now `extends AnimEnemy`; `makeTexture` and the `stage4-*` textures are gone. GameScene's per-texture damage multiplier keys changed to `anim-honeyzombie` / `anim-taximonster`.
- Test: `scripts/qa/owl/s4mobs2.mjs` (spawns each mob on stage 4, logs the anim key per phase, screenshots in `docs/qa-s4mobs/`). Observed anim keys: zombie walk / reach (within 46 px) / hit / die; clock walk / tick (last second of the 3 s countdown) / burst / hit / die; taxi idle / flash (0.6 s warning) / dash / crash (stun) / die. No page errors.
- Not used: `E-13-punchclock/paper.png` (white background, a paper projectile; the burst still uses the existing paper FX).
- Not verified: hitbox feel against the new sprites (bodies are 30x44 / 64x34 / 34x44 logical px, estimated), difficulty by a human, colour fringe on the taxi dash speed lines.

## Freed friends follow the terrain (`friendWalk`)

- Change: `freeFriend()` no longer tweens x with a fixed sway. After the two happy hops, `friendWalk()` moves the plush per frame to the same destination at the same speed (9 ms/px): terrain heights come from `groundTopBelow` / `stepUpTop` / `wallClampX`; steps up to 15 px are walked, drops are walked off and fall, and a pit or a taller step makes it stop for 320 ms and hop across/onto it. The friend art is a single still (no walk frames), so a 3 px bounce per stride replaces the sway. Destination, trigger and the wave-at-the-cart behaviour are unchanged. 25 s failsafe snaps it to the destination.
- Test: `scripts/qa/owl/friendwalk.mjs` (STAGE/FX env: frees the real cage, samples the sprite every 100 ms) and `friendwalk_syn.mjs` (drives `friendWalk` on a dummy sprite across a 32 px step). Observed: stage 1 huihui 760->1402 walks up the 16 px step at ~992, drops off at ~1114-1139, stops and hops the 40 px pit at 1184 (y 283->248->285); stage 1 guard (on the plank, y 226) drops to the floor then the same hop; stage 4 ginger 1660->3162 hops the 64 px pit at 2040; synthetic run hops onto the 32 px step. Sprite angle stays 0 throughout. No page errors.
- Not verified: how the bounce looks in motion (only position logs, not video), the 2P case, stages 2/3/5 friend routes.

## 龍蝦夜市抓抓機 (ClawScene, replaces the bike on the 2→3 leg)

- Change: `clawGame()` in `minigames.ts` (same `Mini` shape / `frame()` / `showTutorial` as pour/timing/tilt), hosted by new `ClawScene` (`src/game/ClawScene.ts`, key `claw`). `WorldMapScene.goNext` starts `claw` only for `from===2 && to===3`; other legs still start `bike`. Destination name (`DEST_NAMES`, exported from BikeScene) and song (`stage<to>`) follow the target stage like 0d28fcb. Coins add to `carryCoins` like the bike. Art: `art-src/claw/claw-prizes-sheet.jpg` -> `scripts/art/slice_claw.py` -> `public/art/props/claw-{lobster,shrimp,boot,can}.png` (AI-generated, same pipeline as the keepers); background reuses `story-market-far` plus a neon cabinet drawn in code; golden lobster = tinted lobster.
- Rules: claw moves on a rail (←→ / A D / pad / touch buttons), attack key drops it (430 ms down, 190 ms close, 430 ms up); prizes ride a belt at 26–58 px/s (gold 82) and bounce at the ends, so the drop has to lead the target; grab zone = ±10–15 px by prize; 18 s limit; values lobster 6 / shrimp 3 / boot 1 / can 1 / gold lobster 12.
- Test (`scripts/qa/owl/claw.mjs`, `claw_play.mjs`, screenshots `docs/qa-claw/`): routing 2→3 = claw PASS, 1→2 = bike PASS, 3→4 = bike PASS; tutorial → game → ←/→ moves the claw (320→440, back to 379); aimed drop on a moving lobster = +6; deliberate miss = no coin and counted as a drop; full 18 s run with perfect aiming = 11/12 grabs, 25 coins, `carryCoins` 5→30, result card shown, then `play`. No page errors.
- Not verified: how hard it is for a human (my script aims with perfect lead, so 25 coins is the ceiling-ish, not typical), balance against the bike's coin yield, touch/pad controls on a real device, 2P (one shared claw).
