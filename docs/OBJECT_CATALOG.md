# 鮭鮭熊 Object Catalog

Canonical data lives in `src/game/data/objectCatalog.ts` (`OBJECT_CATALOG`).

## Categories

| Category | Examples |
|----------|----------|
| hero | 倫寶, 琪寶寶 |
| pet | 噗噗 |
| enemy | 刺刺魚, 疾風桶, 霸鼻象 |
| weapon | sword, knife, spear, club, trunk |
| projectile | salmon shot, fish bullet, honey jet |
| pickup | honey, sushi, coin |
| hazard | durian, spike |
| prop / scenery | goal, pot, chest, tent, picnic |
| bg | riverside wallpaper |

## Action frames

Heroes / pet / enemies register procedural frames after bake:

- `{base}` — idle/base
- `{base}-idle-0..1` — breath
- `{base}-run-0..N` — walk (`WALK_FRAMES`)
- `{base}-atk-windup` / `{base}-atk-strike` — enemies only

## Specs

Combat numbers pull from `engine/constants.ts` and `enemyAi.ts` (`KIND_STATS`, `SPECIES_STATS`) so the catalog stays in sync with gameplay.

## Audit helper

```ts
import { allCatalogTextureKeys, catalogByCategory } from './data/objectCatalog'
```
