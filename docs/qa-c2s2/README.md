# 第7關 QA 交接（2026-11-04，draft）

## Cursor 接手 checkpoint（2026-11-08 HKT）

延續本 branch，**無重做**。新 remote branch `cursor/c2-stage7-from-88-2610`。詳見 `cursor-20261108.md`。

- `tsc`／`build`／`validate:data` 今次 exit 0。
- 注入走查 `c2s2-inspect.mjs` 今次 `passed:true`（A–E 截圖、Boss P1–P3、鏈網 816.6／1533 ms、離隊旗標）。**注入，不是自然通關。**
- 舊 600 秒、2P bot、逐影格／hidden 失敗 **未重跑**，不能當已解。
- 文案保持 Alan 批准稿，無改回「待補」。`#91` 角色／Boss／FX 仍佔位。
- 無 merge main。請 Alan／Manus 開 PR。

---


## #91 回修後 B／C 中景接線 checkpoint（2026-11-04；未經瀏覽器驗收）

- **局部接入，不是完成／可合併驗收。** 原圖只取 #91 精確 head `4dab1f198e2342201d54acdccf6bd0d518be92f6` 的 `corridor-mid.png`（1119×720）和 `training-mid.png`（635×720），來源快照兩檔的 Git blob 與該 commit 一致。另一組的原圖掛鉤及三次平鋪目視複驗結果記於 `/tmp/salmon-c2-stage6-planning/docs/qa-art20/recheck-4dab1f1/README.md`，屬原圖局部驗收，不是本次遊戲驗收。未複製其他原圖或改 Cursor branch。
- `python3 scripts/art/derive_stage7_mid.py /tmp/salmon-art20-4dab-readonly` 核對兩個 SHA-256 與尺寸，按實際寬／高先 nearest 約等比縮至 **560×360／318×360**（奇數寬除二，半像素向上取整）、再 RGB median-cut ≤64 色、不加 dithering；兩圖皆不透明、64 色，遊戲 scale 1。各自來源與輸出 SHA、尺寸及 Pillow 版本見 `public/art/stage7/mid-manifest.json` 和 `mid-derivation.txt`。這是獨立於六張舊素材的 manifest，不改寫原來源紀錄；重製需指定原圖及 Pillow 13.0.0。用 `--out /tmp/其他目錄` 可獨立驗重製，`mid-repro.txt` 記錄本機三檔 byte-for-byte 相同。
- 背景沿用 Phaser Camera-fixed image／TileSprite：B=[855,1995)、C=[1995,3135)，平鋪相位按各段世界起點和實際 560／318 寬；A/D/E 原固定遠景按鏡頭實際可見世界範圍裁切，不再只以鏡頭中心整屏切換，B/C 層在遠景之上、固定 props 和角色／實際地形之下。兩中景只顯示縮圖頭 240 行，放在 y=45–285，原圖下方橫地台／訓練欄杆不會落入此中景可視範圍；原有頂部底景與真正地面、兩個坑原碼保留。鏡頭可半邏輯像素，分段視窗共同取整，最壞約半邏輯像素世界對位誤差；實際渲染接縫仍待檢查。背景是無 body 的展示物，不改 terrain／AI／static decor／鏈網或設計數值。
- **已做、非瀏覽器短測**：低優先級 `npm run build` exit 0（既有 Vite config／大 chunk 警告，`mid-build.txt`）；`npm run validate:data` 10 項 exit 0（`mid-validate-data.txt`）；`node --experimental-strip-types scripts/qa/c2s2-mid-layout.mjs` 驗 10,121 個半像素鏡頭位置的 A–E 純計算覆蓋和 560／318 週期（`mid-layout.txt`），**不是 Phaser 畫圖證明**。`mid-repro.txt` 為圖片及 manifest 重製；`mid-browser-syntax.txt` 只記 browser 腳本語法，沒有跑該腳本。
- **待通知後才啟動瀏覽器**：先單序啟動本 branch production preview，例如 `npx vite preview --host 127.0.0.1 --port 47417 --strictPort`，然後分開跑 `QA_URL=http://127.0.0.1:47417/ QA_KIND=desktop-2p node scripts/qa/c2s2-mid-browser.mjs` 及 `QA_KIND=mobile-1p` 同命令；結束關閉 server。腳本採第6關完成測試存檔、正常選單入第7關，再注入鏡頭／部分角色位置並隔離敵人；覆蓋四個 A/B、B/C、C/D、D/E 交界、B/C 平鋪接縫、兩個 C 坑、短距離按鍵／touch、28 個固定物與兩個圖片 HTTP／尺寸。它只作結構短測，**即使 passed 亦不是視覺驗收或自然通關**。須逐張目視背景是否被覆蓋、線條有否誤導落腳、坑口／地面亮邊、角色／props／D 暗幕、移動與轉場是否有縫及相位突跳；另測前後移動、相機邊界、重啟／切場、第6關及真機。現時沒有上述新畫面、console、HTTP 或遊戲運行結果。
- #88 仍 draft；本次不跑 Chromium、600 秒或全關。下列舊資料全部保留：鏈網時序／render 前扣血及 hidden 模擬失敗依然阻塞；原支線 pageerror／timeout、長測失敗等不能因這次素材接線視為已修復。舊「B/C 不合格、未接入」及舊鏡頭中心切換描述是**當時歷史**，以本節回修狀態取代。

## 新 checkpoint：狀態機嘗試與背景測試阻塞（2026-11-04）

- **仍阻塞；本次沒有接入候選狀態機，遊戲原碼、800／1500 ms、安全位及傷害全部保留。** 純合成模型 `scripts/qa/c2s2-state-model.mjs`／`state-checkpoint-model.json` 嘗試以 monotonic time、前景 render 及 pre-physics 邊界區分 warning、active 與 end；pause／resume 丟棄未確認的時間、恢復後先 render 才能傷害。六項只是模型斷言及一個假設性反例，**不是 Phaser、畫面呈現、碰撞或遊戲修復驗收**。尤其若主執行緒在第一次 active engine render 後長時間停頓，當下一 physics 到達時 wall 期已過，模型會結束而沒有碰撞機會；若為補償而延長又須處理 1.5 秒及 Boss 節奏。模型不具備 compositor 訊號，也未處理完整 camera 遮擋、physics 多步、Boss phase 轉換與全部生命周期；不安全直接搬入遊戲。
- **已核對 Phaser 4.2.1 本地來源**：`core/Game.js` 的 scene update 在 scene render 之前，全局 `POST_RENDER` 在 `renderer.postRender()` 之後；`scene/Systems.js` 的 scene `RENDER` 在 camera render 之後；`physics/arcade/ArcadePhysics.js` 把 `World.update` 訂到 scene `UPDATE`，而 `Systems.step()` 在 scene 自己的 `update()` 前發出該事件。`World.update` 可以同一 frame 多次 physics step；scene 暫停時仍可以 render。這些都是引擎事件，不證明 compositor 或實體螢幕已呈現。第7關沿用 `SecurityDirector` 的 AI sweep 是另一個平滑時鐘；單獨延長鏈網而不協調 AI／phase 轉換，可能令 Boss 提前進下一狀態。第6關完整 Boss 回歸本輪未做，原碼沒改。
- **重新單序跑現有 production build 的注入測試，均失敗**：`state-checkpoint-desktop-2p.json`／`state-checkpoint-mobile-1p.json` 及 console。完整 Boot 後注入 stage、模式、Boss P2、玩家位置／HP，隔離其他敵人；手機入口只用 touch，但不是實機、真人或自然通關。桌面正常案例首次 warning→active scene render callback **888.6 ms**、active→消失 **1513.2 ms**，網內 boy HP 6→5 的實際碰撞比首次 active render **早 6.8 ms**，x=4800 的 girl 保持 6。手機正常案例分別 **934.5／1573.2 ms**，boy 6→5 比首次 active render **早 12.7 ms**；沒有單獨重做手機 safe-only，舊手機注入安全位記錄保留於下方。兩張 `state-checkpoint-*-warning.png` 實際拍到橙色預警。
- **人工場景 pause-warning**：桌面及手機 pause/resume 前後記錄 HP 6、暫停時沒有 chain-active；恢復後仍分別在首次 active render 前 13.5／5.1 ms 扣血。warning 的 wall 時間包含停下的約一秒，不可當連續前景的 800 ms 證據。`hidden-active` 兩案都沒有 `visibilitychange`，`hiddenObserved:false`，**背景模擬失敗**，不是 hidden／resume 通過；active 中 scene pause、physics pause、真正 hidden、Boss 死亡／重啟清理及 P3 本輪未實測。
- 額外獨立 `scripts/qa/c2s2-visibility-probe.mjs`／`state-checkpoint-visibility-probe.json`：headful／headless 的切頁與 CDP 視窗最小化均未收到 hidden 或 visible 事件，exit 1；沒有偽造 `document.hidden`。另在獨立 Xvfb 試實際 Ctrl+Tab 仍沒有事件；CDP `Emulation.setPageVisibilityOverride` 不存在，`Page.setWebLifecycleState(frozen)` 雖返回成功，`document.hidden` 仍 false，不是 hidden 驗證。所有嘗試均不能當通過；需要能產生真實 hidden/visible 的環境再逐幀驗證。
- **負載／FPS**：本次兩案例單序、沒有同時跑本分支其他測試，但共享主機 6 CPU；啟動時 1 分鐘 load average 7.69／9.54，結束時 12.30，仍非低負載。正常案例取 pre-update 連續樣本間距，桌面平均約 **12.1 FPS**（30 samples、raw median 83.3 ms、max 116.7 ms），手機約 **15.2 FPS**（39 samples、raw median 66.7 ms、max 116.6 ms）；包括 instrumentation 負擔，非裝置性能基準。兩組 0 pageerror／console error 但各自 `passed:false`、exit 1。此前所有失敗檔案均保留。
- `state-checkpoint-build.txt` tsc + Vite build exit 0（既有 config／chunk warnings），`state-checkpoint-validate.txt` 10 項資料檢查 exit 0。模型 exit 0 只代表合成斷言；visibility probe exit 1。測試 server `:47429` 已關閉。未重跑 600 秒，無 merge／close／部署；#88 保持 draft。

## 最新 checkpoint：可見時間及物理邊界（2026-11-04）

- **仍阻塞；保留遊戲原碼。** 沒有修改 800／1500 ms、減傷／取消傷害、擴大容差或還原 Alan 對白，也沒有聲稱自然通關。Phaser Clock 使用 smoothed／截限 delta；RAF timestamp 和 wall clock 不是該累加量。只替換成 wall clock 不能處理顯示、碰撞先後和暫停。此前沒有逐幀資料的舊極端失敗仍不能斷言同源。
- 新測 `scripts/qa/c2s2-frame-boundaries.mjs`：完整 Boot 後**注入第7關、模式、Boss phase、玩家位置和 HP，隔離敵人**，不注入勝利；實際呼叫既有 `trainerChain` 及 Arcade overlap／傷害，不是自然通關、真機或真人。手機 UI 使用 touch；手機 2P 只用注入模式檢測，現有產品不提供 P2 touch 控制。`frame-boundary-20261104.json` 保存每個 pre/post update、render callback、傷害、visibility 事件及 raw/smoothed delta，`frame-boundary-20261104-console.txt` 保留原始輸出。Scene render callback 只是引擎畫圖時點，不能證明 compositor／螢幕真正呈現，也未測 camera 遮擋等所有狀況。
- **新實測失敗**：模擬手機 1P 前景 P2 單次，首次 warning render callback 到首次 active render callback 約 **711.7 ms**；首個真實扣血約在 warning callback 後 **704.0 ms**，同一 frame 的 active render callback **7.7 ms 後**才執行；active 到消失的兩個 render callback 約 **1689.0 ms**。同一案例 wall 事件間隔 704.3／1693.5 ms，最大 raw frame 200 ms，測量環境高負載、非低負載／60 FPS。這反映該次預警及活動渲染時間未達設計要求，不是以設定值冒充實測。
- 桌面 1P 正常案例首次 warning→active render 約 928.9 ms、active→消失約 1580.9 ms；實際 HP 6→5 在 active render callback 前 6.0 ms。桌面 2P 正常案例 warning→active 約 814.2 ms、active→消失約 1505.3 ms，HP 6→5 於 active render 前 17.0 ms；注入 x=4800 的另一角色保持 6。模擬手機 2P 正常案例分別 809.6／1893.7 ms，網內角色扣血、網外角色保持 6。四模式共 12 案均無 pageerror／console error，但四組 `passed:false`；碰撞均在首次 active scene render callback 前發生。
- `*-desktop-1p-warning.png` 和 `*-mobile-2p-warning.png` 實際拍到橙色預警；`*-desktop-2p-warning.png`、`*-mobile-1p-warning.png` 因截圖排程延誤實際拍到**網已生效及扣血**，檔名不是其階段證明。碰撞先於 scene render，不等同證明玩家見過獨立無網扣血畫面：該 frame 最終可以同時呈現網及扣血，實際呈現／背景打斷仍未證實。
- 場景 pause-warning 人為停約一秒、再恢復：trace 記錄 pause／resume 時間和 HP，暫停中沒有活動事件；牽涉 pause 的 warning wall 差值包含非遊戲時間，**不能套前景 800 ms 斷言**。`hidden-active` 透過開第二個 Chromium 分頁嘗試切背景，但 trace **沒有 visibilitychange／hidden 事件**，因此這些案例是**背景模擬失敗**，不表示背景／恢復通過。測試原始資料照留；進程已載入腳本後，才更新磁碟腳本加 hidden 事件守門，且不把 pause wall 間隔誤當連續前景時長；當前證據是改守門前執行，不覆寫。
- 測試開始時 1 分鐘 load average 10.56、6 CPU，執行期間升至 25；與其他工作共享主機，並非低負載基準。render instrumentation、截圖和 CPU／frame scheduling 本身均會影響時間，不把此測說成真機性能。舊手機 x=4800 safe-only 及桌面 2P safe／hit 數據保留於下方 clock checkpoint，均屬注入，不代表全場景安全位。
- **後續須處理**：先定義從實際首次繪製起的有效前景時鐘及 pause、hidden、physics pause、背景恢復的狀態轉換；確保 warning 至少 800 ms，active 繪製後才允許 collision，且结束時與 physics step 和最後可見畫面同步，防止恢復首 frame 未顯示即造成傷害；處理場景重啟、Boss 死亡、長 stall 和相機視野，再以真正可控的背景／恢復及低負載環境逐幀測試各邊界、一影格上下界、1P/2P 安全站位和第6關共用 Boss 回歸。此輪未能安全完成整套約束，所以保留原碼與 draft 阻塞。無重跑 600 秒，真機、真人與完整實戰仍未驗證。
- `frame-build.txt` 的 tsc + Vite build exit 0（既有 config／chunk warning）；`frame-validate-data.txt` 10 項資料驗證 exit 0；不等於 runtime 通過。逐幀腳本最終 JSON 明確 `passed:false`；外層 shell `${PIPESTATUS[0]}` 再次被互動執行器捕捉為空，不能聲稱 wrapper exit 0。測試 server `:47429` 已關閉。

## 最新 checkpoint：鏈網逐影格診斷及 Alan 已批准對白

- **結論：鏈網時長仍阻塞，沒有修改 800／1500 ms 設定、沒有放寬舊斷言或聲稱自然通關。** `GameScene.trainerChain` 的兩個 `this.time.delayedCall` 用 Phaser Clock 累加平滑／限幅 delta；`stage7Events[].at` 則是 RAF 帶入 `this.time.now` 的最近一個影格時間戳，並非累加 delta。`performance.now()` 是另一個 wall-clock 取樣；事件程式執行時間與 RAF timestamp 本身可相差數十 ms。兩種時鐘不應混同。
- 單次重現不止是測試讀數：模擬手機 P2 無人為 stall 時，warning→active 的 scene timestamp 866.7 ms、wall 861.6 ms；active→end 的 scene timestamp **1466.6 ms**、wall **1451.5 ms**。該段 16 個更新的 raw delta 合計 1466.6 ms，平滑 delta 合計 1531.6 ms；Clock 到達 1500 ms，wall 卻不到 1500 ms。詳細每幀、每次 timer 及 `performance.now()` 原始數據 `clock-before.json`，不是由設定值推論；這只是該環境單次結果。
- 控制實驗在 warning 或 active 中注入 **350 ms 主執行緒忙等**（只用來重現，不代表實機負載），RAF raw 單幀約 433–450 ms，但 Phaser 預設 `smoothStep=true`、`minFps=5`，超 200 ms 被歷史合理 delta 替代並平滑。桌面 P2 warning scene 1183.2／wall 1165.7 ms（raw 合計 1183.2，smoothed 876.63）；桌面 P3 active scene 1866.6／wall 1850.0 ms（raw 合計 1866.6，smoothed 1540.03）。手機同樣重現：P2 warning 1199.9／1189.2 ms、P3 active 2033.1／2036.6 ms。完整 `clock-desktop-retry2.json`、`clock-mobile-retry.json` 和同名 console；人為 stall 不等於先前測試負載的精確來源，舊 P2 1300／1749.8、P3 1233.2／1433.4 沒有逐影格資料，不能斷言每一個歷史失敗都由同一原因造成。
- **解析度／負載**：兩次新樣本啟動時 1 分鐘 load average 16.82／17.38、容器 6 CPU；在非人為 stall 的樣本仍見最大 raw frame 116.7–166.6 ms，不能當低負載或 60 FPS 證據；影格邊界、渲染負擔與系統競爭均會影響 wall 量度。桌面無 stall P2 scene 850／1666.7 ms（失敗）、P3 816.6／1533.3 ms（單次舊斷言通過）；手機無 stall P2 833.4／1516.5 ms（單次通過）、P3 883.4／1666.5 ms（失敗）。P3 Boss clock return 2990 只抵銷 1.3 倍 AI clock，鏈網兩個配置不變。舊嚴格上下限仍保留，不因單次 pass 宣稱穩定。
- **安全位／真傷害**：桌面注入 2P 站位：x=5000 正常被 Arcade 鏈網傷害，x=4800 的另一角色不扣血；手機注入 1P 先鎖定 x=5000、預警後將角色移到 x=4800，整次不扣血。原始手機 safe-only 標 P2，但 Boss 先前已不可逆升到 P3，所以實際為 P3；新腳本已更正標籤並要求重跑時驗證實際 phase。其餘敵人被隔離、HP／Boss phase／位置為注入，但沒有關閉目標的普通受傷判定；不是自然躲避、全場地安全位或真人全關。模擬手機不是真機。
- **保留所有失敗**：`clock-before.json` 首輪桌面進選單 timeout；其中一項標 P2 的 stall 實際已不可逆升到 P3（`settings.phase=3`），不可當 P2；後續腳本改先 P2 再 P3 並驗證實際 phase。`clock-desktop-retry.*` 為 preview 連線重設；`clock-mobile-preview-port-conflict.txt` 留下第二個 server 啟動埠被佔而失敗，該次測試實際使用先前仍存活的本分支 production preview，之後兩個測試伺服器均已關閉。原有所有 `release-*`、`injected-*` 失敗未覆寫。
- **尚待**：設計與驗證能保留 800／1500 ms、處理暫停／背景／卡頓與物理更新同步的局部計時修正；測量低負載及受控負載下各影格實際顯示和傷害，不可只改斷言。第6關共用 Boss 的完整回歸、所有重試／舊檔／重玩、真機、真人完整通關、素材接入後 600 秒／自然 2P 全關仍未驗證；按指示沒有重跑 600 秒。
- **Alan 最新批准並已接入第7關文案**：逐字原文在 `docs/bible/first-release-dialogue-drafts.md`；D「噗……噗噗？」只反應，Boss 後提示「噗噗暫時離隊。」；馴獸師 Boss 名、稱號、三行及提示亦已逐字接入，D／離隊旗標及主支線規則不變。大陸1結局不屬本 PR。`dialogue-final-build.txt` 通過（既有 Vite config／chunk 警告）；`dialogue-final-validate-data.txt` 10 項通過，包含卡片逐字及 800／1500 資料檢查。
- **接入後短測**：`dialogue-release-{desktop-keyboard,mobile-touch}-stage{6,7}.json` 各自 `passed:true`、0 pageerror／console error；無 query 正常選單入第6關，預置第6關完成存檔入第7關。第7關其後**注入位置和 Boss 開場／擊敗**：D 文字及無離隊、完整 Boss 卡四個文字欄位和畫面範圍、離隊提示、一次離隊、主線快照、待續及返回只開 6／7 的地圖通過；Boss 卡截圖可見。手機為模擬純 touch，非真機；D 浮字畫面偏淡，完整戰鬥可讀性仍待驗。`dialogue-side-2p.json`：正常選單 2P 支線入關、注入兩次擊敗、主線快照逐字不變及返回地圖通過。不是正常 Boss 戰或自然通關。
- 測試外層 shell 最終 exit 2：互動執行器令 `${PIPESTATUS[0]}` 狀態捕獲為空並出現 `integer expression expected`；上列五個 **各自 JSON** 有 `passed:true`、console 無錯，不能把外層 command 說成 exit 0。獨立結果和 console 都保留。

以下為歷史記錄；關於文案仍「待補」的敘述以本節最新批准／接入取代，所有當時的失敗結果仍有效。

## ART-20 局部接入與本次驗證（以下舊紀錄均在接入前）
- 來源是未合併的 Cursor [#91](https://github.com/aftl0904-coder/Game-Salmon-Bear-/pull/91) 精確 head `7b198f735ebebfa14c5d07aa7388681745ade7e5`；只提交六張實際 runtime 衍生圖至 `public/art/stage7/`，沒有複製 50 張原圖或修改 Cursor branch。運行本 PR 不依賴 #91 合併；**重製**才需要該 head 的素材、Python、Pillow 13.0.0、NumPy 2.5.4，執行 `python3 scripts/art/derive_stage7_art.py /path/to/cursor-worktree`。腳本核對來源 SHA-256；來源檔名、雜湊、裁切座標和輸出尺寸見 `public/art/stage7/manifest.json`，輸出日誌 `art20-derivation.txt`。
- **已接入**：`entrance-far.png`（A）、`backstage-far.png`（D）、`arena-far.png`（E）保留 640×360，median-cut 64 色、無 dithering；camera-fixed 遠景於既有 A/B、C/D、D/E 界線按鏡頭中心硬切，B/C 延用既有背景，沒有平鋪不合格中景。D 沿用原暗幕。`net-static.png` 裁切及去磁紅、保比例 nearest 縮成 104×68，使用原網的位置和範圍；`number-plate-blank.png` 為 20×13，`sign-blank.png` 為 158×89。牌字和號碼仍由程式在原有座標繪製；固定物不具碰撞或傷害。六張輸出 ≤64 色，道具 alpha 二值。
- **保留原佔位**：動物籠按原比例縮到既有寬 84 時只有 84×72，原籠高 91、原牌座標不能改，遊戲內牌會明顯懸空；試切效果證據 `art20-rejected-cage-floating-label.png`／`art20-rejected-cage-initial.json`，所以不接入、不提交籠圖。空籠與既有載有動物的籠用途不符；`chain-static.png` 為橫向 U 形，不能在既有窄直鏈位置保比例安全使用，仍用原鏈。`corridor-mid.png`／`training-mid.png` 平鋪接縫不合格；角色和 FX 整批切格／色數／透明度未過，特別兩張洗地機警示圖軸向錯列，全部不接入、不等待回修。Boss、角色、攻擊 FX 原佔位不變。
- **接入後 build／資料**：`art20-build.txt` 的 tsc + Vite 通過（既有 config／大 chunk 警告）；`art20-validate-data.txt` 的 10 項通過。資料驗證不等於玩法通關。
- **接入後 production build 自動短測**：`scripts/qa/c2s2-art20.mjs`，`art20-browser.txt`、`art20-desktop-2p.json`、`art20-mobile-1p.json`。兩者均以第6關已過測試存檔經正常入口進第7關，桌面 2P 實際鍵盤移動、模擬手機 1P touch 移動／跳／攻擊；六張 PNG HTTP 200、`image/png`，Phaser texture 尺寸正確，0 pageerror／console error／HTTP ≥400／requestfailed。`art20-*-normal-entry.png` 為正常入口。
- A–E 其餘 `art20-*-injected-{A,B,C,D,E}.png` 是**注入玩家座標、隔離敵人**，不是正常全關；兩種模式均檢查 A/D/E 遠景和 B/C 原背景。B 段按鍵／touch 實際移動前後，28 個標記的固定 display objects 數量、座標、型別、depth、scale 一致，全部無 physics body；其中新增 7 個號牌底圖及 1 個招牌底圖，並非 2P 複製。這是局部結構／移動回歸，不是全關傷害或真人測試。
- 中間失敗照留：`art20-first-entry-timeout.txt` 為首輪桌面入口逾時／整個命令被終止，非通過；`art20-initial-desktop-aborted-requests-failure.{json,png}` 與 `art20-initial-browser-failure.txt` 留有 Vite 開發模式多個 `net::ERR_ABORTED`；`art20-initial-mobile-boss-lock-failure.{json,png}` 在注入 E 後回 B 試移動，遇 Boss 入場鎖輸入而失敗。後來將靜態回歸移至進 E 前，且改用 production preview，結果如上；不把失敗抹掉。
- **未重跑／未驗證**：素材接入後沒有重跑 600 秒、2P 正常入口全關、Boss phases／鏈網計時、pit-hop、存檔旗標。下文的 600 秒「通過」只是**素材接入前前段**結果，不能當本次素材驗收；舊 2P 全關同樣只代表接入前。原鏈網嚴格時間失敗及支線啟動 pageerror／timeout 仍未釐清；真機、真人完整通關、D 暗幕下所有實戰可讀性未驗證。PR 保持 draft。

基底 main `077af8b14b34b3e26d776e36705772fdd691639b`。應優先處理大陸1 Boss／結局問題，因此 Alan／協調方要求停止新增及重跑耗時測試。以下只報目前結果；**不視為可合併驗收**。本資料夾包含原始 JSON、截圖及失敗日誌，保留可重現測試腳本 `scripts/qa/c2s2-*.mjs`。

## 已完成

- `npm run build`（tsc + Vite）成功，見 `build.txt`；Vite 提示既有大 chunk 警告。
- `npm run validate:data` 通過既有 9 項驗證，見 `validate-data.txt`；現有 validator **沒有涵蓋**新 `stage7.json` 或 Boss 實戰邏輯。
- 桌面 Playwright 透過正常主選單、預先放入「第6關已過」測試存檔進入第7關；1P 和 2P 都有實際鍵盤操作，非真人。2P 未傳送、未改血、未硬設勝利。
- 局部程式注入走查：`injected-A.png` 至 `injected-E.png`、`injected-boss-p1.png`、`injected-boss-p2.png`、`injected-boss-net.png`。畫面由程式直接設位置／無敵／血量／Boss phase 並跳過小遊戲，**不是完整通關**。2P 固定布景 20 個 display objects 前後位置、數量一致，沒有 physics body；D 段同一場景反應一次；P1 觀察到兩次召喚且同時存活不超過 2。詳見 `injected-inspection.json`。

## 未通過／未驗證

- **1P ≥600 秒第7關連續操作未通過**：`soak-1p.json` 在約 267 秒後已離開第7關，後續進入第5關；最後約 411 秒按指示終止，不能用總耗時聲稱 600 秒第7關。記錄到第7關 P3，沒有 pageerror／console error；這並非真人測試。
- **2P bot 全關未判定通過**：`2p-bot.json` 記 `passed:false`、180 秒到時；最終 `win:true` 和 `2p-bot-final.png` 顯示剛到結算畫面，但腳本未在期限內完成自動 pass 判定／驗證清關存檔，不能單靠 ended/win 冒稱完整驗收。可見曾續關、P1–P3；0 pageerror／console error。這不是真人遊玩。
- **局部注入檢查整體失敗**：`injected-inspection.json` 是 `passed:false`。鏈網計時斷言拾到自然攻擊和測試手動攻擊重疊事件，結果無法配對；`injected-inspection-console.txt` 留下事件原始時間。不能聲稱 0.8 秒預警、1.5 秒持續或安全躲避已驗證。要隔離事件 ID／攻擊並重新測試。Boss P3 注入截圖未取得。
- **離隊旗標**：程式有主線結算同一 `saveClear` snapshot、支線不寫、舊檔預設 false 和新局 reset 的實作，但目前注入測試在此之前失敗；舊檔遷移、重載、支線不寫、一次性及 2P 實際存檔均**未驗證**。需要測一次性、失敗重試及重玩。
- 手機 touch、真機、真人完整通關、1P 靜態物前後比對、兩個坑敵人 pit-hop、桌面完整可躲 hazard 均未驗證。成長點只保留空 hook；支線不發點、返隊不實作。第10關 `markC2Cleared()` 仍未接。

## 可重跑但本次未重跑

修正 `scripts/qa/c2s2-inspect.mjs` 的鏈網事件配對（例如為每次攻擊記 ID，或等待上一攻擊完全結束），再檢查安全站位、P3、離隊旗標與存檔。1P 長測應確保整段都在第7關正常操作或明確描述允許的正常重試流程；2P bot 等完整結算並斷言存檔再設 pass。以上須待大陸1優先問題處理後另行安排。

## 2026-11-04 跟進 checkpoint（仍為 draft）

上面原始失敗及證據保留；以下是**新一輪**，不把注入走查當正常全關。新美術 #91 的動畫切格、FX 和場景接縫已由另一組報告有問題，**未獲品質確認，不匯入、不複製**；本分支繼續用現有佔位。

- **2P 正常入口鍵盤 bot：通過本次自動全關與存檔斷言**。以第6關已過測試存檔從主選單進第7關，沒有傳送、改血或強設勝利；約 178 秒完成，期間有正常續關。最終 Boss `defeat` → 一次 `departure` → 結算；同場 D 段反應一次。主線保存為 `lastCleared=7`、`nextStage=8`、`puffLeft=true`；觀察到的相關 run 快照沒有旗標與過關狀態分開的寫入。`2p-bot-current.json`、`2p-bot-current-final.png`。這是 bot，不是真人。
- **手機 touch 短測：通過**。模擬手機使用 touch 從正常入口進第7關，實測右移、跳及攻擊；1P 固定布景測試則在注入座標及停用敵人後，以 touch 移動對比，20 個無 body 的固定物座標、數量不變。`mobile-current.json` 與 `mobile-current-*.png`。不是實體手機或手機全關。
- **坑：局部通過**。桌面與模擬手機、注入位置及隔離其他敵人後，兩個 C 段坑均觀察到產品化蜜僵正常追逐跳過，以及玩家透過鍵盤／touch 行入坑後重生。`pit-desktop-current.json`、`pit-mobile-current.json` 及相應截圖；不是自然全關覆蓋。
- **2P 固定物**：注入位置走查 20 個無 body 的固定物，前後數量和座標相同；`injected-inspection-current.json` 及原始 `injected-inspection.json`。這不是正常行完全關的完整靜態物追蹤。
- **鏈網嚴格計時仍有失敗，不可報為穩定通過**。測試先停自然 Boss／敵人並等舊定時器排空，獨立配對一次 warning、active、end。並行負載下第一次 P2 約 850／1666 ms（原測容差為 790–900／1490–1600 ms）；第二次 P2 約 867／1600 ms，而 P3 約 817／1633 ms，P3 超出容差。記錄 `injected-inspection-under-load-failure.{json,txt}`、`injected-inspection-p3-load-failure.{json,txt}`。第二次另見網內角色由 6 扣至 5、網外角色保持 6；這是注入站位，不代表所有情況均已驗證。`current-injected-boss-p3.png` 為注入 HP 截圖。CPU／Phaser frame scheduling 可能影響測量，但未釐清，不能把設定值直接等同實測通過。
- **build／資料驗證**：`npm run build` 通過（Vite 既有 config／大 chunk 警告），見 `build-current.txt`；新增 `scripts/validate/stage7.mjs` 並接入 `validate:data`，現在 10 項包括第7關配置和 Boss 卡佔位；屬資料檢查，不能代替 runtime 驗證。
- **1P 600 秒：通過本次前段穩定性測試**。新腳本以鍵盤在第7關前段來回操作，累計 600 秒第7關有效操作、wall 601 秒，結束仍在第7關、未通關；0 pageerror／console error。只計有觀測到的第7關運作時間，離關或勝利即停止，不計其他關。`soak-1p-current.json`、`soak-1p-current-final.png`；`soak-1p-checkpoint.json` 保留中途 461 秒快照。這不是全關、真人或真機測試。
- **旗標短測整體失敗**：注入主線時，兩次觸發只產生一次離隊，結算將旗標與第7關完成以單一 run 寫入，重載後旗標仍為 true；但隨後嘗試注入支線場景時出現 `Cannot read properties of null (reading 'resolution')` pageerror 及 30 秒 timeout。測試 setup 與產品 bug 的成因未判定，不能掩蓋；支線場景、舊檔遷移及新局 reset **未驗證**。`injected-inspection-current.json`、`injected-inspection-side-start-failure.{json,txt}` 保留錯誤。正常 2P bot 有正常續關後通關，惟不代表所有失敗重試及重玩分支均已覆蓋。
- 最後一輪 P2 為約 933／1483 ms，嚴格斷言失敗；P3 該輪約 817／1500 ms 雖通過單次斷言，較早 P3 約 817／1633 ms 失敗仍保留，故整體仍不穩。`injected-inspection-current.json`。第6關共用 Boss 模板獨立回歸、實體手機、真人通關仍未驗證；第10關 `markC2Cleared()` 仍未接。任何失敗維持 PR draft。

## 首版公開及待續 checkpoint（2026-11-04）
- Alan 的首版確認記於 `docs/bible/first-release-confirmations-20261104.md`。本次公開第6關入口，不再依賴測試 query；第5關片尾可按原順序承接。選關不因公開入口而解鎖未玩的大陸1關卡；第8–10關不開放。第7關主線結算後獨立「待續」卡，再到第6／7關地圖；本局仍保存 `nextStage=8`，供將來版本續接，非大陸2完整通關。支線不寫主線，原主線若等待第8關則返回停留地圖。第5關支線片尾也支援返回第7關／停留地圖。
- `release-build.txt`：tsc + Vite build 通過（仍有既有 Vite config／chunk 警告）；`release-validate-data.txt`：10 項通過。三項第7關文案未獲上線批准，runtime 仍「待補」；沒有接第10關結局旗標。已接六張素材及其他佔位未改；#91 動畫未用。
- 測試從無 `?c2=1` 參數的選單入關。`release-desktop-keyboard-stage6.json` 和 `release-mobile-touch-stage6.json`：新檔經正常鍵盤／模擬手機純 touch 進入第6關，非真人／實機。第7關測試使用預設第6關已過存檔，正常選單入關，之後直接呼叫擊敗事件，**不是打贏 Boss 或全關**。截圖及結果以各 `release-*-stage7*.json/png` 為準。
- 桌面首輪 `release-initial-desktop-keyboard-stage7.json/png`：已顯示待續畫面（`*-failure.png`），但舊測試查詢沒有深入 Phaser 容器而 timeout，不能報通過；修正測試查詢後再測，保留首輪。`release-hmr-failure-*` 為開發伺服器測試時另一次 build/源碼熱更新令頁面重新載入、中斷的失敗，不當通過。
- 鏈網仍按原嚴格上下限；本次多個測試並行、未隔離負載。原始 `release-inspect-console.txt` 的 P2 warning 1300.0 ms、active 1749.8 ms；P3 warning 1233.2 ms、active 1433.4 ms（由記錄的 `this.time.now` 事件相減）。全部屬**實測超出舊嚴格容差**，不得用設定值或放寬斷言說成通過；調度原因及低負載下表現未驗證。
- 原支線注入問題：舊測試 reload 後固定只等 1.5 秒，直接 stop 所有 scenes 再強制啟動 play，會中斷正常 Boot／素材載入生命週期；新腳本改為等 Boot 完整、從正常選單鍵盤進支線，另有注入擊敗以觀察旗標。是否已完全排除產品根因，須看 `release-injected-inspection.json` 和 pageerror 紀錄，不能把一次正常進入等同完整真人回歸。
- 依指示素材接入後**沒有重新跑 600 秒或 2P 全關**；第6關共用 Boss 完整回歸、所有失敗重試／重玩、真機及真人完整通關仍未驗證。此前紀錄保留、PR 維持 draft。
- 桌面第7關重測 `release-desktop-keyboard-stage7.json` 通過：正常入關、注入 `trainerDefeated()`、同一主線快照記 `puffLeft=true,lastCleared=7,nextStage=8`、結算→明顯待續→地圖；沒有開放第8關及沒有寫完整結局旗標，0 pageerror／console error。不是正常打完 Boss。
- `release-injected-inspection.json` 整體仍**失敗**：除 P2/P3 鏈網嚴格時間失敗外，重載後正常選單入支線沒有 pageerror 或 timeout，但重選角預設為 1P 倫寶（噗噗只隨琪寶寶生成），腳本錯誤斷言必須有 pet 而失敗。原結果保留；後續另用選 2P 的 `c2s2-release-side.mjs` 驗證，結果以 `release-side-2p.json` 為準，未生成則表示未完成。
- 手機第7關 `release-mobile-touch-stage7.json` 重試通過：用模擬手機純 touch，預置第6關已過存檔，正常選單入第7關，再注入擊敗事件測主線結算／待續／返回地圖；0 pageerror／console error，非真機或 Boss 全關。首輪 `release-initial-mobile-touch-stage7.json` 因同一 Phaser 容器搜尋錯誤逾時，原截圖及失敗保留。
- 支線 `release-side-2p.json` 通過局部驗證：預置主線 `nextStage=8,puffLeft=true`，完整 Boot 後正常選單鍵盤選 2P 入第7關支線，原隊伍噗噗存在；注入兩次擊敗觸發後只一次離隊，主線快照逐字不變、不寫完整結局旗標，結算返回停留地圖，0 pageerror／console error。此測試非自然 Boss 戰；不同失敗重試、所有舊檔及其他主線進度仍未完整覆蓋。舊 pageerror 在正常入口沒有再出現，但未有舊錯誤堆疊，不能斷言根因已徹底證實或產品完全無 race。
