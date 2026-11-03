# 大陸2第6關設計文件 PR：基線 QA（2026-11-04）

工作樹由重新確認的 `origin/main` `077af8b14b34b3e26d776e36705772fdd691639b` 開出；只新增設計／美術 brief、更新狀態及保存本測試紀錄。未改 `src/`、`data/` 或任何遊戲圖像；共用 `/tmp/salmon-menu2/node_modules`。

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run build` | PASS，exit 0；Vite 有既存 dynamic import 與大 chunk 警告 | `build.txt` |
| `npm run validate:data` | PASS，9 個既有 validators；不代表驗證新方案的關卡行為 | `validate-data.txt` |
| `scripts/qa/two-player-landing.mjs`，`QA_STAGE=1 QA_MODE=desktop` | PASS，exit 0；2P 鍵盤跳回平台及落台、碰撞框 | `desktop.json`、`desktop.txt`、`desktop-stage1.png` |
| 同腳本，`QA_STAGE=1 QA_MODE=mobile` | PASS，exit 0；Playwright Pixel 7 landscape 模擬、P1 touch、P2 在場但靜止；不是手機 P2 touch | `mobile.json`、`mobile.txt`、`mobile-stage1.png` |

測試使用本地 Vite server、Chromium swiftshader。落台腳本注入 stage／初始座標、清除敵人並給測試 HP／grace，之後用鍵盤或模擬 touch 實際操作；不是正常入口全關、真人遊玩或通關。腳本記錄 pageerror（JSON `errors`），**沒有完整 console error 掃描**。截圖是基線 stage 1，不是新保安／洗地機。沒有測試第6關新 Boss／平衡、#88、第7關實作、真人手感或真機。這是文件 PR 的回歸 smoke，不可當新設計或第7關驗收。

上述測試後只補充了 A–E 候選故事、釐清素材批准範圍及更新 STATUS；沒有改遊戲程式、數據或美術，因此結果只代表相同程式基線，不代表候選設計已測試。

Alan 確認三個角色的基本造型後再次更新文件並重跑 `npm run build`、`npm run validate:data`，兩者均 PASS，見 `approval-build.txt`、`approval-validate-data.txt`。桌面／模擬手機截圖仍為上表既有基線，沒有重跑，不能用來證明新美術或 Boss 已完成。
