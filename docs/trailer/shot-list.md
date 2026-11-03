# 鮭鮭熊 trailer 第一版：75 秒分鏡

先製作分鏡，再錄製及剪接；時間碼以成片為準。規格：1280×720、16:9、30 fps、H.264 MP4；畫面以原有遊戲素材、Playwright 實錄及 FFmpeg 剪接，不用 AI 生成圖片／影片或外來音樂。Alan 其後明確批准使用遊戲現有台詞，故事字幕逐字引用 `data/story.json` 內 C1 原文，不另寫宣傳語；字幕時間及文字可在 `docs/trailer/subtitles.json` 更換。片尾只顯示指定英文。

| 時間（秒） | 畫面及實際素材 | 構圖／效果及聲音 |
|---|---|---|
| 00–04 | `public/art/story/c1-picnic.png`，野餐 | 暖色慢推近，遊戲 `story` BGM 漸入。 |
| 04–07 | 同一野餐圖內原有食物：蘋果、蜂蜜、籃 | 局部推近，沿用開場像素字幕。 |
| 07–13 | `public/art/props/honey-pot.png`、`public/art/items/jar-fake.png`，假蜜線索 | 罐子局部放大、轉暗，配遊戲 `gulp`；小圖非新畫。 |
| 13–20 | `public/art/story/c1-hollow.png`，噗噗變灰 | 暗角、慢推近；遊戲 `sad` 音樂及 `dread`。 |
| 20–25 | `public/art/story/c2-bike.png` | 單車出發，緩慢移鏡；切到遊戲 `stage1`。 |
| 25–29 | Playwright 錄製現有第1關，鍵盤移動／跳躍 | 裁掉頂部 HUD 及底部介面；非完整遊玩。 |
| 29–31 | 武者王：`public/art/anim/hatsoldier.png` 的遊戲角色圖集 | 遮半邊、壓暗、短閃；其餘為黑場。 |
| 31–33 | 蜜冠女王蜂：`public/art/story/s2-boss-intro.png` 局部 | 局部遮罩及壓暗、短閃；其餘為黑場。 |
| 33–35 | 月橋鏡鴞：`public/art/story/s3-boss-intro.png` 局部 | 局部遮罩及壓暗、短閃；其餘為黑場。 |
| 35–37 | 泥怪（舊資產名 mudmane／泥鬃）：`public/art/story/s4-boss-intro.png` 局部 | 局部遮罩及壓暗、短閃；其餘為黑場。 |
| 37–38 | Trinity（舊資產名 △畝大佬）：`public/art/story/c7-boss.png` | 暗色剪影局部短閃；不使用揭面圖。 |
| 38–39 | Ken：`docs/trailer/source/cursor/ken-optB-silhouette.png` | Alan 已選 B；只用暗光剪影短閃。 |
| 39–40 | 商場保安總監：現有 `public/art/anim/triboss.png` 遊戲 placeholder | 陰影及半邊剪裁短閃；遊戲目前重用 Trinity 圖集，並非獨立最終設計。 |
| 40–41 | Leon：`docs/trailer/source/cursor/leon-silhouette.png` | 已確認人類設計；只用暗光剪影短閃。 |
| 41–48 | Playwright 錄製現有大陸2第1關（內部第6關）商場 | 裁除 HUD／對白；遊戲 `mall` BGM。 |
| 48–52 | Cursor `c2s2-expo-hall-dark.png` | 展銷中心原創概念圖慢推近；不是已實作遊戲畫面。 |
| 52–55 | Cursor `c2s2-cage-corridor-dark.png` | 籠舍原創概念圖，暗光慢推近。 |
| 55–60 | Cursor `bear-chained-dark.png` | 受困大熊伏筆，暗光及慢推近。 |
| 60–60.6 | Cursor 結局圖 `ending-c2-01.png`（唯讀原始分支）的極小片 | 強烈降解析度及模糊、局部碎片，最多 0.6 秒；其餘時間黑場，不洩露結局。 |
| 61–67 | Playwright 第1關出發畫面 | 裁除 HUD／對白；回到旅程，非完整遊玩。 |
| 67–75 | 黑場，指定字句 `Coming Christmas 2026` | 唯一指定片尾文案，淡入淡出。 |

## 素材缺口及界線

- 展銷中心、第7關及被困大熊未有已實作遊戲畫面；片中相關鏡頭為 Cursor 確認原創概念圖，不冒充遊戲實錄。
- Ken 用 Cursor 記錄 Alan 已選的 B 方案剪影；Leon 用修正後人類剪影，不用舊獅頭版。五張概念素材取自 `cursor/ending-c2-art-2610` 的 `ccbc100c6e3fdd07ffbc61eae8adee46de2167c4`，本地副本可放 `docs/trailer/source/cursor/`，但不入 Git；原 Cursor branch 不變。
- 第6位保安總監尚無專屬圖集；遊戲實際沿用 Trinity 圖集，預告以同款局部 placeholder 表示，不能當作其最終設計。
- 結局圖分支未合併，僅唯讀取一張作不可辨認碎片，顯示不超過 0.6 秒；絕不顯示全圖、姓名或揭露身份。
- 遊戲開場及第1／6關使用場景注入定位來錄製，之後以鍵盤操作；不代表由頭通關。手機模擬測試不等同實體手機。
- 音樂／音效均錄自 `src/game/audio.ts` 原創 Web Audio；字幕及遊戲 HUD 以裁切／遮罩處理。詳細來源、命令及測試結果見 `docs/qa-trailer/`。
- 引用 C1 原文字幕及時間：00.7–06.5「野餐日。百畝樹林，天氣好好。」；07.5–12.5「嗰啲唔係真蜂蜜，係假蜜。」；13.5–19.5「噗噗……？你點解變晒灰色？」；20.3–24.5「要五罐真蜂蜜，先救得返佢。」字型 `public/fonts/fusion-pixel-12-zh-hk.woff2`，OFL 授權見 `public/fonts/OFL-fusion-pixel.txt`，不使用 Nintendo 官方字型或商標。
