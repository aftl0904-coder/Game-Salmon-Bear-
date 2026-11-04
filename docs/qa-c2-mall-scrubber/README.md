# 第6關保安及洗地機 checkpoint QA（2026-11-04）

**歷史 checkpoint 以下為 `6ba07f4` 當時結果。** 本次已接入獨立洗地機初版及已批准 A–E／6→7 文字，但整項仍未完成、不可合併／部署；Boss 安全／操作驗收未通過，不可把以下人類保安紀錄當成洗地機通關證據。

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
