# ART REQUEST 08 — 光影、特效、介面 (FX, lighting & UI)

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first** for the global rules
(magenta `#FF00FF` background, equal cells left → right, no text, 16-bit SNES look).

呢批唔係角色，係**令成隻遊戲睇落貴啲**嘅嘢：光暈、影、天氣、打擊感、介面框。
而家呢啲全部係我用 code 畫圓形同長方形砌出嚟，所以睇落「乾」。有真圖就會好好多。

Branch: **`art/batch-08`**。每做完一節就 push。

---

## A. 光暈同光影 → `art-src/fx/light/`

全部畫喺**純黑底**（唔係磁紅），因為呢啲圖喺遊戲入面用加法疊落去。

- `glow-round.png` **256×256**: 一個柔和嘅圓形光暈，中間白，向外淡出到完全透明。
  邊緣要好滑，唔好有硬邊。
- `glow-cone.png` **256×256**: 一束由上向下嘅錐形光（好似街燈），上窄下闊，向下淡出。
- `glow-ring.png` **128×128**: 一個環形光圈，中間空。
- `shaft-soft.png` **128×360**: 一條斜嘅光柱，好淡，上面濃啲。
- `vignette.png` **640×360**: 四邊黑、中間完全透明嘅暗角。
- `grade-warm.png` 同 `grade-cold.png` **640×360**: 好淡嘅color wash，一張暖橙、一張冷藍。

## B. 影 → `art-src/fx/shadow/`

畫喺純黑底，白色＝影嘅濃度。

- `shadow-soft.png` **128×64**: 一個柔邊橢圓，中間實、邊緣散開。
- `shadow-tight.png` **128×64**: 同上但邊緣硬啲（主角企喺硬地用）。
- `shadow-long.png` **256×64**: 拉長咗嘅橢圓（黃昏斜光用）。

## C. 天氣 → `art-src/fx/weather/`

- `rain-sheet.png` **640×360**: 斜雨絲，**要可以上下左右無縫接駁**（tileable）。
- `fog-band.png` **640×120**: 一條霧帶，左右無縫接駁，上下淡出。
- `mist-puff.png` [4] **每格 128×128**: 一團霧散開嘅動畫。
- `water-ripple.png` **256×64**: 水面波紋，左右無縫接駁（倒影用）。

## D. 打擊同粒子 → `art-src/anim/fx/`

同舊嘅 FX 一樣，磁紅底，一行 N 格。

- `impact-big.png` [5]: 一下重擊 — 白光爆開、碎片飛散、淡出。約 96 px。
- `dust-puff.png` [4]: 細細團塵，落地同跑步用。約 40 px。
- `sparkle-trail.png` [4]: 一串閃粉，攞到嘢嗰陣用。約 48 px。
- `shockwave.png` [4]: 一個向外擴散嘅圓環波。約 128 px。
- `leaf-bits.png` [4]: 幾塊樹葉碎飛散（打爛叢林物件用）。約 48 px。
- `glass-shards.png` [4]: 鏡碎（第 3 關鏡影雜兵死亡用）。約 64 px。

## E. 介面 → `art-src/ui/`

磁紅底。呢啲會變成遊戲入面所有對話框、選單、卡片嘅框。

- `panel-9slice.png` **96×96**: 一個木牌風格嘅方框，**四邊同四角嘅花紋要畫得清楚**，
  中間留一大片淨色（我會切成九格去拉大細）。深啡木 + 金邊。
- `panel-dark-9slice.png` **96×96**: 同上，但深藍黑色（Boss 卡、夜市用）。
- `button.png` [3]: 一個掣 — 平時 / 撳住 / 唔撳得（灰）。約 96×28。
- `heart.png` [3]: 一粒心 — 滿 / 半 / 空。約 16 px。
- `coin-icon.png`: 一個金幣圖示，約 14 px。
- `pip.png` [2]: 一粒細圓點 — 著 / 熄（武器等級用）。約 8 px。
- `cursor-hand.png`: 一隻指住嘅手，選單用。約 20 px。

---

## 唔使畫

音樂同音效**唔使 Cursor 做** — 全部由 Claude 喺 `src/game/audio.ts` 即時合成，
冇外部音檔。如果你見到有人叫你整音效，唔好做，話返俾 Alan 知。

## Delivery

1. `git pull` first.
2. Copy accepted images into the paths above.
3. Append entries to `art-src/anim/manifest.json` for anything with frames
   (file, frames, cols, rows, facing, prompt). 單張圖都要寫 1 格。
4. Commit **only images + manifest** on branch **`art/batch-08`**, and push after each section.

Other rules:
- Do not touch `src/`, `data/` or `public/`.
- A 光暈 or 影 drawn on magenta instead of black is unusable — double-check the background.
- Push with the browser GitHub sign-in — never paste a token.
