# 第6關人類保安 checkpoint QA（2026-11-04）

**整項功能未完成；不可合併／部署。洗地機 Boss 根本未實作**，關內仍是舊人形 `SecurityDirector`、舊卡及舊攻擊；這不是洗地機。A–E 和 6→7 已批准對白亦尚未接 runtime。無 Boss P1–P3、落點或反擊空檔證據，不能聲稱符合設計。

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
