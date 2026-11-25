# 第5關黃昏背景 QA／接入交接

`public/art/stage5/bg-sunset-tower.png` 是按已確認要求製作的紫粉色夕陽玻璃大廈 **未接入背景候選**，以既有 `public/art/story/hq-far.png` 作構圖參考；圖片由原圖編輯後等比例縮小量化，並非原生 640×360 繪製。

現版 `src/game/GameScene.ts` 的 `drawTowerWorld()` 使用 `hq-far.png`、`rooftop-far.png` 兩幅既有 1280×720 遠景，接近 Boss 門時 crossfade，另疊程序柱與燈。此次新增候選圖，沒有覆蓋原圖、修改程式或更改該轉場。Cursor 接入時需自行核對背景圖層、縮放、鏡頭及兩幅遠景的切換方式，避免破壞現有場景；遊戲內外觀、桌面／手機 touch、真機及真人驗收尚待接入後驗證。

此目錄的桌面及模擬手機 touch 截圖是新素材**獨立預覽**，不是遊戲內或真機截圖；build 與資料檢查僅證明目前專案可構建及資料驗證通過。
