# Clarity-1 QA

## 本階段做咗咩
實作扣血反饋（來源閃白 80ms + hit-spark）、鏡頭內先出招、第 6 關雜物 i-frame 唔再誤響 `SFX.hurt`、`?hitbox=1` 開 F1 overlay；並跑 1P 倫寶／琪寶寶、2P × 第 1／5／6 關截圖。

## 證據
- 截圖：本目錄 `1p-boy-s{1,5,6}*.png`、`1p-girl-s{1,5,6}*.png`、`2p-s{1,5,6}*.png`
- 摘要：`summary.json`、`run-log.txt`
- Hitbox 審計（唔改數據）：`hitbox-audit.md`

## 已確認事實
- `?hitbox=1` → `debugOverlay.enabled === true`（9/9 cases）
- 鏡頭外 `ATTACK`／windup 計數 = 0
- Stage 6 無敵踩雜物唔加 `junk-hit` event（`junkIframeOk: true`）
- 1P 琪寶寶：`soloCast=girl` 時 `boy.role==='girl'`（單人共用 P1 slot）

## 估計
- hit-spark 動畫喺 Boot 已載入（`fxa-hit-spark`）；接觸截圖未必影到 80ms 閃白幀

## 未驗證
- 真機手機瀏覽器觸控開 hitbox
- 連續 10 分鐘穩定性（本輪 QA 未做）

## 重跑
```bash
npx vite --port 4531
QA_PORT=4531 node scripts/qa/clarity-1.mjs
```
