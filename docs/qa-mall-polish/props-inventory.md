# T5b Mall props inventory (stage 6)

List of triangle / geometry Graphics placeholders found in stage6 décor, and replacements.

| x (approx) | Old shape | File / site | Replacement |
|---|---|---|---|
| 400 | fillCircle pair + text「中庭裝置」 | `GameScene.drawMallWorld` atrium | `lightbox` @400 + `plant` @340 + `bench` @480 |
| 1860–1980 | fillTriangle escalator ramp + text「扶手電梯」 | `GameScene.drawMallWorld` B→C | Keep ramp art (belt collision); add `escalator-sign` @1848 |
| 880 | *(new)* | corridor | `plant` |
| 1020 | *(new)* | corridor | `cart` |
| 1200 | *(new)* | corridor | `wayfind` |
| 1550 | *(new)* | corridor | `rail` |
| 1340, 1680, 2450, 3580, 4100 | fillTriangle spike +「雜物」tag | `stage6World.buildJunk` | `bin` (trash) — hurt footprint `w` unchanged |
| 2090, 2380, 2740, 3020 | scaffold poles/planks Graphics | `GameScene.scaffold` (removed) | `rail` + `bin` per bay |
| 4960 | boss fan Graphics (fillCircle / fillTriangle blades) | `stage6World.buildBossFan` | **kept** — boss FX, not décor placeholder |
| elevX | elevator shaft Graphics +「電梯」 | `stage6World.buildElevator` | **kept** — interactive elevator, not triangle décor |

## Prop kinds used (height 24–64px, mall palette, no brands/text)

盆栽 `plant` · 長椅 `bench` · 垃圾桶 `bin` · 指示牌 `wayfind` · 購物手推車 `cart` · 膠欄杆 `rail` · 自動扶手電梯入口牌 `escalator-sign` · 廣告燈箱（無字）`lightbox`
