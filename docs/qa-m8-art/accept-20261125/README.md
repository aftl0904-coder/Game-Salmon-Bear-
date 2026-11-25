# 第8關刪格方案：接受現有比例差異後重測（2026-11-25）

Claude 選 B：接受現有主任紀錄板／人物比例差異；PNG 沒有改畫或重新縮放，不可聲稱比例已對齊。#157 的 `83bfb79` 在本接受紀錄完成前已由其他人 merge，main merge commit `b2e41f3`；這份後補紀錄經獨立 Manus 分支交付，沒有直接提交 main。

## 重跑結果

本目錄原本的 `build.txt` 等及 `game-desktop/`、`game-mobile/` 是 #157 的 `83bfb79` 工作樹測試。其後另以已合併的 main `b2e41f3` 加本紀錄變更重跑：`build-main.txt`（tsc + Vite 通過）、`validate-data-main.txt`（13 項通過）、`frame-check-main.txt`（通過）；`main-preview/` 桌面滑鼠／模擬手機純 touch 預覽、`game-desktop-main/` 桌面遊戲及 `game-mobile-main/` 三款橫向手機純 touch 測試均通過。兩次測試的驗證界線相同。

- `build.txt`：`npm run build`，TypeScript 及 Vite build 通過（原有警告保留）。
- `validate-data.txt`：`npm run validate:data`，10 項通過。
- `frame-check.txt`：沿用 `docs/qa-m8-art/drop-frames-20261125/check.py`，兩張 atlas 的尺寸、透明、顏色、每格非空／透明邊、JSON 全部索引及名義動作時長、素材底線通過。板／人物比例沒有由此測試驗證。
- `preview-run.txt`、`preview-log.json` 和 `desktop-*`／`mobile-touch-*`：沿用同一 preview.cjs，讀現有 JSON 的 frames 及 FPS 播放文件櫃與主任的預警→攻擊；桌面滑鼠、模擬手機只用 touch 選擇，順序、預覽計時、末格保持通過。這是獨立素材預覽，不是 Phaser 或實體手機。
- `game-desktop/`：現有第4關遊戲桌面操作測試通過，使用狀態注入到測試點；測試副本以目前 `SLEEP_COST=6` 替代舊腳本過時的 12 金幣斷言。舊腳本失敗紀錄及測試副本在 `docs/qa-m8-art/drop-frames-20261125/` 保留。
- `game-mobile/`：現有第1關遊戲三款橫向手機模擬純 touch 控制通過，直向只檢查轉向提示；並非真機或真人完整通關。

## 尚未驗證

第8關素材未接入 Phaser；實際遊戲內載入、預警／攻擊切換、動畫事件、世界位移、hitbox、落地、Boss 比例、投射物及真機體驗均未驗證。Cursor 接入時必須支援明確 `frames`（含重複）、處理真正的預警與停頓時序，並核實 `anchorY`；JSON 不會自動實現遊戲狀態。
