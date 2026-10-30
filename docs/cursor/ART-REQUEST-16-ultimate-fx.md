# ART REQUEST 16 — 必殺技全螢幕特效 (ultimate-move FX)

From: Claude → To: Cursor (image generation). Same owner, same game.

**Read `docs/cursor/ART-REQUEST-08-fx-ui.md` first** for the FX conventions (pure **black**
background for anything additive-blended; magenta only for the sprite-sheet impact/particle FX
in that same file's section D). This request follows the same split.

原創效果，唔係任何其他作品嘅招式／角色／台詞。兩隻主角而家嘅「絕招」（打一粒蜂蜜子彈）會升級做
全螢幕特效必殺技，名同畫面都係自己諗嘅：

- 倫寶 → **鮭魚瀑布**：一浪鮭魚色能量浪橫掃全螢幕。
- 琪寶寶 → **蜜光斬**：一度金黃蜜光劍氣橫掃全螢幕。

Branch: **`art/batch-16`**。每做完一節就 push。

---

## A. 蓄力光環 → `art-src/fx/light/`

純黑底。兩個主角共用，Claude 會用 code 分別染色（鮭魚粉橙 / 蜜糖金黃）。

- `charge-aura.png` [4] 每格 **128×128**：一個逐漸脹大、向外脈動嘅能量光環，中心亮白，
  向邊緣化開到透明，冇硬邊。

## B. 鮭魚瀑布 → `art-src/anim/fx/`

純黑底。

- `ult-salmon-wave.png` [6] 每格 **320×160**：一浪鮭魚色（珊瑚粉／橙紅）能量浪，由畫面
  一側湧向另一側，浪頭帶飛濺嘅光點同幼細水花，最後一至兩格散開淡出成幾點殘光。

## C. 蜜光斬 → `art-src/anim/fx/`

純黑底。

- `ult-honey-slash.png` [6] 每格 **320×160**：一度金黃色蜜光斬擊橫掃畫面，帶閃閃發光嘅
  拖尾（似蜜糖黏絲嘅質感），最後一至兩格散開淡出成幾點殘光。

---

## 唔使畫

呢批唔使另外畫「全螢幕色調」— Claude 會重用 `art-src/fx/light/grade-warm.png`（ART-REQUEST-08
已經要求）做全螢幕暖色閃一下，再疊上面 B/C 嘅效果。

## Delivery

1. `git pull` first.
2. Copy accepted images into the paths above.
3. Append entries to `art-src/anim/manifest.json` (file, frames, cols, rows, facing, prompt)
   for all three sheets.
4. Commit **only images + manifest** on branch **`art/batch-16`**, and push after each section.

Other rules:
- Do not touch `src/`, `data/` or `public/`.
- Push with the browser GitHub sign-in — never paste a token.
