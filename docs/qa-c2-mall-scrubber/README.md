# 第6關保安及洗地機 checkpoint QA（2026-11-04）

**歷史 checkpoint 以下為 `6ba07f4` 當時結果。** 本次已接入獨立洗地機初版及已批准 A–E／6→7 文字，但整項仍未完成、不可合併／部署；Boss 安全／操作驗收未通過，不可把以下人類保安紀錄當成洗地機通關證據。

## 2026-11-04 碰撞及 P2 專項再查（仍為 checkpoint）

- 確認 Phaser `Body.reset()` 先用精靈左上角，沒有即時加 offset；原 P2 桌面 active 抽樣 body `[4966,5082]` 超出 warning `[4952,5068]` 右邊 14px，恢復首幀亦可偏左 16px。現對移動／轉刷／恢復同步 offset 及物理 frame snapshots。實測範圍仍有限，不宣稱所有 FPS／狀態通過。
- Boss 入場原先只清 active 敵人，但 `activateDeferredEnemies()` 會在後續重新啟用 inactive patrol。第6關現在入場清除 active 和 inactive、其獨立武器，Boss 戰中禁止 deferred patrol 啟用；其他關邏輯不改。首次測試入場前記到 1 隻 inactive patrol，戰中抽樣沒有其他 active／有 body 敵人；待自然進場和 projectile／hazard 完整檢查。
- 原桌面 P2 HP 4→6 的候選原因是 Boss 入場時 arena 入口固定生成可補滿血的壽司；因當次沒有紀錄 pickup 事件，**不能斷言**原例一定是它。原手機 P2 死亡同樣沒有當時來源事件，不能事後認定是 Boss 或雜兵；deferred 復活確實是干擾路徑，但未重播證明它造成該次死亡。
- `focus1-desktop.json`／`focus1-mobile.json` 是 1P 倫寶（基速 105）注入第6關／場地／角色位置，注入 P2/P3 血量、受擊和 moveCount，P1–P3 各一次用桌面鍵盤／Pixel 7 landscape 模擬 touch 走出預警；各次 HP 6→6。桌面 54 幀、手機 52 幀有效攻擊 body 對照 warning 未見超界；截圖 `focus1-*-p{1,2,3}-*` 只證明該次局部狀況。桌面恢復期實際按鍵使 Boss HP 55→52；手機 HP 55→54 的命中發生在 **scan** 而非 recover，不能說手機反擊空檔已證明。
- 第一版牆邊測試沒有按移動：桌面記到 `hurtHero` 來源 `mall-scrubber`、HP 6→4，故整個 desktop 測試失敗（`focus1-desktop-failure.png`）；手機該次 HP 6→6，但沒有移動，原腳本輸出 `passed:true` **無效，不是牆邊可避證據**。腳本已改為預警時向右側出口移動，並要求逐幀 attack box 位於 warning、戰中無其他敵人、檢查每次受傷事件而非單看前後 HP，且反擊命中必須發生於 recover。先前失敗均保留。
- 第二輪 `focus-desktop.json`：桌面 P1–P3 各次 HP 6→6，51 個有效 attack 抽樣無超框、無其他 active enemy；反擊在 recover 令 Boss 55→52。牆邊注入 Boss 4725／玩家 4654，由警示 `[4640,4769]` 內向右移至 4780，首次 charge／recover 仍 HP 6→6，**只是單個場邊局部例子**；當輪 desktop JSON 的 `frameChecks` 是在後續加嚴事件檢查前產生，已另核對事件空、首次命中在 recover。
- 第二輪 `focus-mobile.json` **整體 FAIL**：P1–P3 三個注入例子各 HP 6→6，66 個有效 attack 抽樣無超框及無其他 active enemy；反擊從 recover 輸入，但實際命中已到 scan，Boss 55→54，不能當恢復期反擊通過。牆邊首個 warning 向右逃至 4785；逐幀顯示首次 charge 和隨後 recover 無扣血，但由於等待時截圖太慢，程式漏了首招並等到下一次 warning／charge，玩家沒有再次躲避，記錄 `mall-scrubber` 傷害 HP 6→4。不能將第二招受擊歸因於首次避位失敗；亦不能把整輪稱 pass。腳本現以 warningId 限定同一招，避免跨招，**此最後腳本修正尚未再跑**。
- 逐幀 JSON 記錄角色/Boss body、角色攻擊 body、預警矩形、HP、其他敵人及壽司，包裝 `hurtHero`／`hazardHit`／`hitByFishBullet`／`takeSushi`／`knockOut` 記錄血量變化。這是插樁自動測試，並非自然全關、真人或真機；P2 死亡原例仍未取得來源。初次 build 因 TS typings 的 `autoFrame` 失敗（`focus-build.txt`），移除該不需使用欄位後 `focus-build-retry.txt` build 及 `focus-validate-retry.txt` 9 個 validator 通過（仍有既存 bundle 警告）。

## 2026-11-04 再續測試

- `build-20261104-resume.txt`：tsc + Vite 通過（仍有既存 bundle 警告）；`validate-20261104-resume.txt`：9 項資料 validator 通過。
- `resume-desktop.json`／`resume-desktop-failure.png`：初次桌面測試等 logo 超時，無進入 Boss。`resume3-desktop.json`／圖片：第二次猜錯 menu scene 名稱而超時，無 Boss 證據。這些是測試入口失敗，不是遊戲完整流程證明。
- `resume-mobile.json` 和 `resume-mobile-p1-charge-{warning,active,recover}.png`：注入場景、Boss 及角色初始位置；P1 預警後 HP 6→4，**避險失敗**。事後發現觸控左鍵使用 x=36，實際按鈕中心 x=12，且截圖先於按鍵可能消耗預警，因此不能推斷玩法公平或不公平；保留失敗並改測試程序，不刪失敗。並非真機。
- `resume4-desktop.json`／截圖：注入關卡、arena 和主角位置；P2 注入 HP 與 `receiveHit`（P3 尚未到達，未注入）。P1 從預警至恢復 HP 6→6，觀察到 `warn→charge→recover` 並透過鍵盤移動；這只是單個注入例子。其間所按反擊按鈕沒有令 Boss 55 HP 改變（主角距 Boss 約 261px），**沒有證明反擊可達**。P2 記錄 `warn→brush→recover`，但腳本以預警 HP 4 與恢復 HP 6 比較而失敗（HP 上升，不能當避險通過，須查回血／其他干擾）。P3 因提前失敗完全未觀察。
- `resume4-mobile.json`／截圖：注入相同關卡及位置；修正左鍵坐標後 P1 touch 記錄 `warn→charge→recover`、HP 6→6；反擊未造成 Boss 傷害。P2 在注入 HP／受擊後，監測有效轉刷或恢復逾時；最後紀錄 phase 2、刷攻擊中、主角 HP 0，**P2 失敗，死亡來源未查明**。沒有 P3 證據。兩例均非完整正常進關、非 2P、非真機或真人；兩者遊戲頁面 `pageerror` 空陣列不代表通過。
- **需先修／查的風險：**桌面 P1 恢復首幀 Boss x=5010、碰撞 body.x=4950、width=88，而同一測試前後正常 body.x=4966，疑 `body.reset` 暫時忽略 offset；**未證明攻擊有效期間碰撞一直落在預警內**。桌面截圖仍見其他敵人，疑 arena 清除未啟動的 deferred enemy 不完整，須查是否干擾 Boss 戰；兩點均未修、未重測。安全判定以左右跑為假設，並未證明慢角色／雙人／邊角真可避。
- A–E 與 6→7 對白程式已接線，但正常入口／整關、6→7 及 #90 已批准開場合併後的順序均未驗證；當前 branch 仍依賴尚未合併的 #90（其開場未由本 branch 補入），故**故事整合未完成**。
- 目前安全計算用角色基速 105px/s，保留 450ms 反應／反向及 12px 裕量，逐位生存玩家檢查警示框外是否在場內可到，沒有安全位則無害移位再重新預警；**尚未證明** crouch／各裝備、受擊、兩人分站及邊角、低 FPS、暫停／恢復時也安全，亦未證明完整碰撞、傷害關閉／反擊與 P1–P3 時序。
- §4 文案初步接入；第6關籠影既有反應仍在。正常入口 A–E、自然擊敗／蜜罐／6→7、#90 合併預覽及 #88 整合仍需補測；第7關／第5關待審文案未改。測試程式 `scripts/qa/c2-scrubber-checkpoint.mjs` 明確標示注入，不是正常通關 bot。

## 歷史人類保安測試（6ba07f4）

| 檢查 | 結果 | 證據／限制 |
|---|---|---|
| `npm run build`（tsc + Vite） | PASS | [build.txt](build.txt)，含現有 bundle size 警告 |
| `npm run validate:data` | PASS | [validate-data.txt](validate-data.txt)，9 個 validator；不代表關卡設計合格 |
| 桌面鍵盤短測 | PASS（有限範圍） | [desktop-short.json](desktop-short.json)、`desktop-windup.png`、`desktop-recover.png`：注入第6關、角色及保安位置；實際 KeyD 移動；觀察預警、攻擊、恢復順序；前搖後另注入角色位置，並非避險證明。 |
| Pixel 7 landscape 模擬手機純 touch 短測 | PASS（有限範圍） | [mobile-short.json](mobile-short.json)、`mobile-windup.png`、`mobile-recover.png`：用 CDP 原生 touch 操作移動、tap 攻擊；同樣注入關卡及位置，不是真機，也非整關。 |
| 首次短測 | FAIL | [desktop-first-failed.json](desktop-first-failed.json)、[mobile-first-failed.json](mobile-first-failed.json)：負載下觀察時間不足，未記到完整狀態。保留對應 `*-failure.png`，不能當通過證據。 |
| 低 FPS 風險 | 發現並修改，仍須深入驗證 | [desktop-before-fix.json](desktop-before-fix.json) 中舊短衝從 x=480 移至 x=446；物理推進與限幅狀態時計不同。改原地固定近身框後，兩個短測各觀察 x=480 保持不變；無完整低 FPS／碰撞邊界測試。`desktop-before-fix-*.png` 為舊版本，非修正後證據。 |
| 第6關整關、1P/2P、B–E、真蜜僵、受擊／死亡／坑邊 | 未驗證 | 沒有正常入口全關、沒有真人手感或真機；不可引用歷史圖冒充新結果。 |
| Boss、故事、第7關整合 | 未完成／未驗證 | 詳見 [checkpoint](../bible/c2-stage1-implementation-checkpoint-20261104.md)。P1–P3、慢角色／角落／2P 安全路徑與每招恢復空檔均仍需實作及測試。#88/#90 不被修改；#91 未過 QA 不接入。 |

短測腳本為 `scripts/qa/c2-mall-guard-short.mjs`。兩次最終測試沒有 pageerror，場景用注入啟動及移位，不能證明自然遭遇、避招、全關通過或完整戰鬥。現已停止自建 Vite 47431 server。
