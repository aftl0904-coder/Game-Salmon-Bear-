# 窿／地面視覺 QA（2026-11-03）

基底 `main`：`285ae63b0a6c8d7db946f21f5955cf95bdb58ba0`。本 branch 只改外觀，不改關卡 JSON、坑寬、碰撞／平台計算、玩家或敵人。截圖以 Playwright 模擬 Pixel 7 橫屏及桌面 1280×720，並非真機；注入關卡及人物起點、隔離敵人、鏡頭固定喺坑口，並非由頭打到尾。手機按 touch 跳過劇情；桌面按 Enter。`mobile.json`／`desktop.json` 記每張圖的坑、人物、鏡頭、平台和暗幕狀態。

## 照片覆蓋

| 關 | 普通／夜景 | 有真正踏板或台階 | 穩定暗幕坑 |
|---|---|---|---|
| 1 | `normal-672` | `fixed-plank-1872`、`moving-plank-5116` | 不適用：沒有 darkZones |
| 2 | `normal-700` | `moving-plank-1980` | 不適用：沒有 darkZones |
| 3 | `night-1040`、`night-slippery-2860` | `night-moving-plank-2560` | 不適用：darkZones 不與坑重疊；夜景已拍 |
| 4 | `night-1040` | `night-real-step-760` 是真實台階，不是木板；此關沒有跨坑木板 | 不適用：沒有 darkZones；夜景已拍 |
| 5 | `normal-2760` | `real-step-620`；`dark-plank-1980` 僅部分踏板跨坑 | `dark-plank-1980`（暗幕約 0.82） |
| 6 | `normal-1880` | `fixed-plank-1150` 真實木板高於坑並完整跨坑 | `dark-3350`、`dark-4000`（暗幕約 0.62） |

每個名稱各有 `mobile-s…png` 及 `desktop-s…png`，合共每個模式 17 張。實看代表性夜景、暗幕及踏板截圖：坑內橫向亮線已中斷；真正高台或踏板保留。地圖色帶、角色／道具可能遮住部分邊線；暗幕的遠處仍然較暗，實際可讀性有待審閱及日後真機確認，不能當成全場景視覺保證。第3關溫泉裝飾現在以本關的坑座標避坑，不再依賴可能尚未建立或屬上一關的資料；第3／5關滑地色帶亦按真實坑口裁切。

## 自動測試

- `build.txt`：`npm run build`，TypeScript 與 Vite 通過（Vite 有既有設定及 chunk-size 警告）。
- `data.txt`：`npm run validate:data`，9 項通過。
- `spans.txt`：`node --experimental-strip-types scripts/qa/pit-visibility-spans.mjs`，核對第1至6關全部 26 個真實坑口、左右地面亮邊停止／恢復及地面色帶避坑；另測重疊、未排序及邊界輸入。只測視覺區間，不代表每種屏幕亮度都清楚。
- `mobile.txt`／`desktop.txt`：`QA_MODE=mobile|desktop node scripts/qa/pit-visibility.mjs`；各 17 個抽樣點通過，包含實際關卡坑座標同角色留在鏡頭內、無 page error，並驗證第5／6關暗幕確實生效。`PASS` 代表座標／測試流程，並非自動判定美術好壞。
- `landing-mobile.txt`／`landing-desktop.txt`：重用 `scripts/qa/two-player-landing.mjs`，第1至5關各一處高低台；手機 2P 場景內 P1 用 touch、P2 靜止；桌面 P1／P2 同時用鍵盤，均通過。截圖及逐幀資料在 `landing/`。
- `stage6-fall.txt`：`scripts/qa/pit-fall-stage6.mjs`，第6關 x1880 缺口由真實 touch／鍵盤走入，兩種均跌下及復活；移動、起點和逐幀紀錄在 `stage6-fall-*.json`。

## 重跑

```bash
npm run dev -- --host 127.0.0.1 --port 47318 --strictPort
npm run build && npm run validate:data
node --experimental-strip-types scripts/qa/pit-visibility-spans.mjs
QA_MODE=mobile node scripts/qa/pit-visibility.mjs
QA_MODE=desktop node scripts/qa/pit-visibility.mjs
QA_BASE_URL=http://127.0.0.1:47318/ QA_OUT=docs/qa-pit-visibility/landing QA_MODE=mobile node scripts/qa/two-player-landing.mjs
QA_BASE_URL=http://127.0.0.1:47318/ QA_OUT=docs/qa-pit-visibility/landing QA_MODE=desktop node scripts/qa/two-player-landing.mjs
QA_MODE=mobile node scripts/qa/pit-fall-stage6.mjs
QA_MODE=desktop node scripts/qa/pit-fall-stage6.mjs
```

未驗證：真機、由頭到尾完整過關、所有坑在所有光線／裝置的辨識度、兩人手機 P2 touch（Alan 已決定不做）。第3關夜景普通坑的暗幕數值少量殘留，已記於 JSON；它不是 darkZones 內的坑。角色起點注入與 Boss／敵人隔離可能避開其他遊玩問題。
