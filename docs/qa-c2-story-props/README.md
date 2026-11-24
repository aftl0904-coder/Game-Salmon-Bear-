# C2 story props — ART-REQUEST-21 QA

六張 PNG 存於 `public/art/c2/story/`，名稱及尺寸見 `dimensions-alpha.txt`。全部是 RGBA、二值 alpha、每張少於 64 色，透明範圍沒有封閉空洞。原始生成圖為高解像度，透明邊界裁除後以 nearest-neighbour 等比縮到目標畫布並量化；並非在目標解像度原生繪製，與 `visual-style.md` 的原生繪圖建議有差異。舊相在 36×28 原尺寸的敘事細節較細，請接入時留意。

`desktop.png`、`mobile-touch.png` 展示每張素材 1×及 4×；`browser.txt` 記錄桌面滑鼠及模擬手機純 touch 可選六圖、無頁面錯誤。這是獨立素材預覽，不是實機或遊戲整合測試。

`build.txt`：`npm run build`（TypeScript + Vite）通過。`validate-data.txt`：10 項資料驗證全部通過。主線 `src/game/storyDepth.ts` 仍使用 `ensureStoryDepthArt()` 臨時 bake；本分支沒有改遊戲程式或 BootScene，Cursor 需在整合時接入正式 PNG 並驗證遊戲內呈現。未真機／完整通關。

工單來源：`cursor/c2-story-depth-2610:docs/cursor/ART-REQUEST-21-c2-story-depth.md`（只讀）；本分支基於 main `4d8a641d76337db9628b65e96d2e175557e8ae96`。
