# 大陸2地圖 PR 預覽 QA（2026-11-03）

兩個 PR 都以 `main` 為目標；測試時最新 `main` 為 `17930a0369a9f177e91372a2456a41da19bd377f`。以下各自使用獨立 worktree，將指定 PR head 暫時合併到該 main，沒有提交合併、修改 Cursor branch 或合併 PR。預覽使用與 main 相同的 `package.json`／`package-lock.json` 和鎖定依賴。

| PR | branch／測試 head | 相對上述 main 合併預檢 | `npm run build` | `npm run validate:data` |
|---|---|---|---|---|
| [#67](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/67) | `cursor/art-n-c2-map-2610` / `22008c9f1e05307d2e359ccaa7feea4ce37ec766` | 無衝突 | 通過（TypeScript + Vite）| 通過（9 項） |
| [#68](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/68) | `cursor/c2-worldmap-code-2610` / `58ac5eb2c3ab0d037e5e1f761fd2aa069b803892` | 無衝突 | 通過（TypeScript + Vite）| 通過（9 項） |

日誌：[PR67 build](pr67-build.txt)、[PR67 資料](pr67-data.txt)、[PR68 build](pr68-build.txt)、[PR68 資料](pr68-data.txt)。兩個 build 均有 Vite chunk size warning，沒有阻止 build。

#68 已包含 #67 美術 commit（#67 head 是 #68 的 ancestor），所以兩者 diff 重疊；而 #68 同樣包含已合併 #65 嘅關卡部分。先前交接建議先 #65、#67，後 #68；#65 已合併，其他 PR 只可按 Alan 明確逐個指定合併。#68 的 `markC2Cleared()` 仍只有定義、未接第10關。

合併預檢使用補齊部分 Git 歷史之後的 `git merge-tree --write-tree`，並在各個實際 worktree 執行無提交三方 merge；GitHub PR API 同時標示 `mergeable=true`、`mergeable_state=clean`。測試時 GitHub PR API 的 `.base.sha` 仍顯示較舊 `dfd4413`，因此以上預覽明確指定實際最新 main `17930a0`，沒有將舊 base 當作最新。任何分支或 main 往後變動均要重新預檢。

**限制：** 今次只核對合併、build 同資料格式，沒有運行遊戲、截圖或真機測試，不能證明地圖顯示、動畫、解鎖及玩家操作正常。#67 N4 `map-walk-duo.png` 的風扇要在 #73 同 #67 合併後由 Cursor 另開 branch 跟新設計對齊；相關安排記於獨立 STATUS PR #69。
