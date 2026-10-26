# ART REQUEST 07 — 小食攤檔 + 裝備店 (stalls & shop)

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-02-animation.md` first.** Every global rule there still applies:
- flat magenta `#FF00FF` background;
- frames left → right in equal cells, facing RIGHT, feet on one baseline;
- **no text or letters anywhere** (no shop signs, no prices, no brand names);
- 16-bit SNES pixel look with the "8×8 pixel grid" trick;
- model sheet first, then use it as the reference for every later image.

Branch: **`art/batch-07`**. Push after each section.

Why: every stage gets its own food stall with its own little minigame, and after it the
players spend their coins on gear. These are the images for that.

---

## A. 攤檔老闆 (stall keepers) → `art-src/anim/stalls/<id>/`

Friendly Hong Kong street-food vendors. Each is a **person**, about 64 px tall, warm and
welcoming — they are the safe spot in the stage. Original faces, not caricatures of anyone.

For each: `model-sheet.png`, `idle.png` [3] (small breathing + a wave), `serve.png` [4]
(hands the food forward), and the stall itself as `cart.png` (one image, ~72 px tall).

| id | Who | Stall |
|---|---|---|
| `waffle` | 夾餅叔叔 — middle-aged man, apron, white vest, towel over the shoulder, cheerful | A street cart with a round waffle iron, steam rising |
| `tart` | 蛋撻哥哥 — young man, baker's whites, paper hat, flour on his hands | A small bakery counter with trays of egg tarts |
| `coconut` | 椰青泰國人 — Thai man, straw hat, loose shirt, holds a heavy cleaver (held safely, pointing down) | A cart stacked with green coconuts and a block of ice |
| `sashimi` | 刺身師傅 — Japanese chef, headband, navy apron, long knife on the board | A cedar sushi counter with a salmon fillet on it |

(咖啡媽媽 already exists — do not redraw her.)

## B. 小遊戲道具 (minigame props) → `art-src/props/minigames/`

**2026-10-27 更新**：玩法改咗做四種，道具跟住改。每張喺磁紅底，畫得大同清楚（佢哋喺小遊戲入面佔成個畫面）。

### 第 2 關・夾餅叔叔（撳住倒漿，啱啱滿放手）
- `waffle-iron.png` [3]: 一個打開咗嘅雞蛋仔鐵模，由上面望落去 — 空 / 半滿麵漿 / 啱啱滿
- `batter-jug.png`: 一個倒緊麵漿嘅壺，壺嘴向下，有一條麵漿流落嚟
- `waffle-done.png` [3]: 整好嘅雞蛋仔 — 淺色未熟 / 金黃色啱啱好 / 燶咗

### 第 3 關・蛋撻哥哥（爐火條，啱嗰刻抽盤出爐）
- `tart-oven.png`: 一個打開咗爐門嘅焗爐，入面見到一盤蛋撻，有暖光
- `tart-tray.png` [3]: 一盤六個蛋撻，由上面望落去 — 蒼白未熟 / 金黃色啱啱好 / 燶咗
- `oven-gauge.png` 同 `oven-pointer.png`: 一條直立嘅火力條（紅 → 橙 → 黃），同一個細細嘅指針，**分開兩張圖**

### 第 4 關・泰國人（傾斜電話接椰青水）
- `coconut-pour.png`: 一個開咗頂嘅青椰，側住緊倒水出嚟
- `coconut-drop.png` [3]: 一滴跌緊嘅椰青水（清、帶少少白）
- `coconut-cup.png`: 一個玻璃杯，由正面望，杯口闊

### 第 5 關・刺身師傅（指針條，撳嘅時候落刀）
- `salmon-fillet.png` [3]: 砧板上面一塊三文魚柳 — 完整 / 切咗一半 / 切到整齊刺身
- `sushi-knife.png`: 一把幼長嘅日本刀，刀鋒向左

### 共用
- `timing-bar.png` 同 `timing-pointer.png`: 一條橫條，**紅 ｜ 綠 ｜ 紅**，下面一個白色細指針（分開兩張）
- `honey-drop.png` [3]: 一滴跌緊嘅金色蜂蜜（第 3→4 關之間嘅接蜜小遊戲）

（**唔使畫喇**：牛油同刀、椰青頂虛線、劈刀、燒魚。嗰幾個玩法砍咗。）

## C. 裝備 (shop gear) → `art-src/props/shop/`

Each item has **3 quality tiers** drawn left → right in one image (`<name>.png` [3]):
wooden/plain → steel → gold. Item only, no character, ~28 px tall.

- `sword.png` [3]: 琪寶寶's sword
- `gun.png` [3]: 倫寶's salmon gun (tier 3 has three barrels)
- `armour.png` [3]: a light chest guard — cloth / leather / gold-trimmed
- `boots.png` [3]: shoes — sneakers / hiking boots / winged boots
- `charm.png` [3]: a lucky charm on a string — wooden tag / jade / gold honeycomb

Also:
- `coin-stack.png` [3]: a few coins / a small pile / a big pile
- `shop-板.png` → name it `shop-board.png`: a plain wooden signboard, **blank, no letters**

## D. 兩張漏低咗嘅圖 (still owed from batch 06)

- `art-src/props/friends/picnic-blanket-big.png`
- `art-src/story/ending-picnic.png`

---

## Delivery

1. `git pull` first.
2. Copy accepted images into the paths above.
3. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt).
4. Commit **only images + manifest** on branch **`art/batch-07`**, and push.

Other rules:
- Do not touch `src/`, `data/` or `public/`.
- Regenerate off-model frames.
- Push with the browser GitHub sign-in — never paste a token.

---

## E. 2026-10-27 新加（故事改版之後）

睇 `docs/bible/story.md`。

### E1. 朋友仔檔口 → `art-src/props/shop/`
- `friends-stall.png`: 一個好細、臨時搭嘅檔口，用木箱同布搭成，掛住幾件裝備（劍、護甲、鞋）。
  **冇人喺度**（救返嘅朋友仔係由遊戲擺上去）。大約 72 px 高。

### E2. Boss 來歷卡底圖 → `art-src/ui/`
- `boss-card-bg.png` **640×360**: 一張深色嘅卡底，四邊有少少花紋，中間留白俾字。
  **唔好有字。** 顏色偏深啡／深藍，要同遊戲嘅木牌風格夾到。

### E3. 教會（琪寶寶嘅星期日）→ `art-src/story/`
- `c0-church.png` **16:9**: 星期日朝早，一間細細嘅教會喺樹林邊，門口有陽光。
  冇人、冇字，平靜就得。

### E4. 仲欠（batch 06 嗰陣講過）
- `art-src/props/friends/picnic-blanket-big.png`
- `art-src/story/ending-picnic.png`
