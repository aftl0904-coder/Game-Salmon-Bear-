import Phaser from 'phaser'
import hdProps from '../../data/props-hd.json'
import { markHd } from './heroAnims'

/**
 * Hand-pixelled PNGs that replace procedural paints (scripts/art/*.py).
 * Loaded in BootScene as `ovr-<key>`, then copied over the runtime key after
 * the procedural register* passes so every caller keeps using the same key.
 */
export const ART_OVERRIDES: Record<string, string> = {
  'fx-salmon-shot': '/art/items/salmon-roe.png',
  'fx-fish-bullet': '/art/items/fish-bubble.png',
  // New key (no procedural original): 帽仔兵 thrown rock.
  'fx-rock': '/art/items/rock.png',
  'pickup-power': '/art/items/power-salmon.png',
  'hazard-crusher': '/art/items/crusher.png',
  // Breakable loot holders (stage1.json breakables).
  // Cursor stage-1 props (scripts/art/slice_props.py) replace the earlier hand-pixelled stand-ins.
  'prop-break-lantern': '/art/props/lantern.png',
  'prop-break-pot': '/art/props/honey-pot.png',
  // Painted replacements for the old isoArt.ts procedural breakables.
  crate3d: '/art/props/crate3d.png',
  chest3d: '/art/props/chest3d.png',
  pot3d: '/art/props/pot3d.png',
  'prop-lantern3d': '/art/props/lantern3d.png',
  // Cutscene props (data/story.json).
  'cs-jar-fake': '/art/items/jar-fake.png',
  'cs-jar-real': '/art/items/jar-real.png',
  'cs-note': '/art/items/note.png',
  'cs-picnic': '/art/props/picnic-blanket.png',
  'cs-cart': '/art/props/coffee-cart.png',
  'cs-mama': '/art/props/mama.png',
  'cs-mama-offer': '/art/props/mama-offer.png',
  'cs-keeper2': '/art/props/keeper2.png',
  'cs-keeper3': '/art/props/keeper3.png',
  'cs-keeper4': '/art/props/keeper4.png',
  'cs-keeper5': '/art/props/keeper5.png',
  // Goal: the honey tree with the glowing hive.
  goal3d: '/art/props/honey-tree.png',
  // M6 items (replace isoArt procedural paints).
  'pickup-sushi': '/art/items/pickup-sushi.png',
  'hazard-durian': '/art/items/hazard-durian.png',
  // M6 camp props (tent / shrine; campfire is a 2-frame strip — see applyCampFireOverride).
  'prop-tent': '/art/props/camp-tent.png',
  'prop-shrine': '/art/props/camp-shrine.png',
  // Scenery (data/levels/stage1.json "decor").
  'deco-stump-a': '/art/props/stump-a.png',
  'deco-stump-b': '/art/props/stump-b.png',
  'deco-rock-a': '/art/props/rock-a.png',
  'deco-rock-b': '/art/props/rock-b.png',
  'deco-rock-c': '/art/props/rock-c.png',
  'deco-mushrooms': '/art/props/mushrooms.png',
  'deco-grass-a': '/art/props/grass-a.png',
  'deco-grass-c': '/art/props/grass-c.png',
  'deco-fern-b': '/art/props/fern-b.png',
  'deco-fence': '/art/props/fence.png',
  'deco-sign-post': '/art/props/sign-post.png',
  'deco-billboard': '/art/props/billboard.png',
  'deco-stone-altar': '/art/props/stone-altar.png',
  'deco-far-trunks': '/art/props/far-trunks.png',
  // Stage 2 · 蜜樹丘 (data/levels/stage2.json)
  's2-bark-ground': '/art/props/s2-bark-ground.png',
  's2-bark-platform': '/art/props/s2-bark-platform.png',
  's2-bark-wall': '/art/props/s2-bark-wall.png',
  's2-honeycomb-wall': '/art/props/s2-honeycomb-wall.png',
  's2-mushroom-shelf': '/art/props/s2-mushroom-shelf.png',
  's2-triangle-mark': '/art/props/s2-triangle-mark.png',
  's2-vine-a': '/art/props/s2-vine-a.png',
  's2-vine-b': '/art/props/s2-vine-b.png',
  's2-hive': '/art/props/s2-hive.png',
  's2-hive-broken': '/art/props/s2-hive-broken.png',
  's2-canopy-mid': '/art/props/s2-canopy-mid.png',
  's2-canopy-front': '/art/props/s2-canopy-front.png',
  's2-vine-lattice': '/art/props/s2-vine-lattice.png',
  // Stage 3 · 月影夜市 (data/levels/stage3.json)
  's3-lantern-on': '/art/props/s3-lantern-on.png',
  's3-lantern-off': '/art/props/s3-lantern-off.png',
  's3-wok-stall': '/art/props/s3-wok-stall.png',
  's3-steam': '/art/props/s3-steam.png',
  's3-sashimi': '/art/props/s3-sashimi.png',
  's3-lobster': '/art/props/s3-lobster.png',
  's3-stall': '/art/props/s3-stall.png',
  's3-stall-broken': '/art/props/s3-stall-broken.png',
  's3-knife': '/art/props/s3-knife.png',
  's3-feather': '/art/props/s3-feather.png',
  's3-market-mid': '/art/props/s3-market-mid.png',
  's3-hotspring-rock': '/art/props/s3-hotspring-rock.png',
  's3-wood-bridge': '/art/props/s3-wood-bridge.png',
  's3-market-ground': '/art/props/s3-market-ground.png',
  // Stage 6 · 購物中心 (data/levels/stage6.json)
  's6-dome': '/art/props/s6-dome.png',
  's6-robotarm': '/art/props/s6-robotarm.png',
  's6-debris': '/art/props/s6-debris.png',
  's6-drone': '/art/props/s6-drone.png',
  's6-cage': '/art/props/s6-cage.png',
  's6-shop-a': '/art/props/s6-shop-a.png',
  's6-shop-b': '/art/props/s6-shop-b.png',
  's6-shop-c': '/art/props/s6-shop-c.png',
  's6-factory-wall': '/art/props/s6-factory-wall.png',
  's6-conveyor': '/art/props/s6-conveyor.png',
  's6-boxstack': '/art/props/s6-boxstack.png',
}

/** Campfire strip key (2× 104×60). Loaded as spritesheet; not in ART_OVERRIDES. */
export const CAMP_FIRE_SHEET = 'ovr-prop-campfire'
export const CAMP_FIRE_ANIM = 'prop-campfire-burn'
/** Honey-paw strip (3× 16×16). Frame 2 is empty; use 0/1 + alpha for fade. */
export const HONEY_PAW_SHEET = 'fx-honey-paw'

export function preloadArtOverrides(scene: Phaser.Scene) {
  for (const [key, url] of Object.entries(ART_OVERRIDES)) scene.load.image(`ovr-${key}`, url)
  scene.load.spritesheet(CAMP_FIRE_SHEET, '/art/props/camp-fire.png', {
    frameWidth: 104,
    frameHeight: 60,
  })
  scene.load.spritesheet(HONEY_PAW_SHEET, '/art/fx/honey-paw.png', {
    frameWidth: 16,
    frameHeight: 16,
  })
}

export function applyArtOverrides(scene: Phaser.Scene): string[] {
  const done: string[] = []
  for (const key of Object.keys(ART_OVERRIDES)) {
    const src = `ovr-${key}`
    if (!scene.textures.exists(src)) {
      console.error(`[artOverrides] missing ${src}`)
      continue
    }
    const img = scene.textures.get(src).getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0)
    if (scene.textures.exists(key)) scene.textures.remove(key)
    const tex = scene.textures.addCanvas(key, canvas)
    // Props sliced at RES× (scripts/art/slice_props.py) show at their logical size.
    const name = ART_OVERRIDES[key]!.split('/').pop()!.replace(/\.png$/, '')
    if (tex) markHd(tex, (hdProps as Record<string, number>)[name] ?? 1)
    done.push(key)
  }
  done.push(...applyCampFireOverride(scene))
  applyHoneyPawSheet(scene)
  return done
}

/** Replace procedural campfire with M6 2-frame strip + loop anim. */
function applyCampFireOverride(scene: Phaser.Scene): string[] {
  if (!scene.textures.exists(CAMP_FIRE_SHEET)) {
    console.error(`[artOverrides] missing ${CAMP_FIRE_SHEET}`)
    return []
  }
  markHd(scene.textures.get(CAMP_FIRE_SHEET), (hdProps as Record<string, number>)['camp-fire'] ?? 2)
  scene.textures.get(CAMP_FIRE_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST)
  // Static key for catalog / bakeCastTextures: first frame only.
  const frame = scene.textures.getFrame(CAMP_FIRE_SHEET, 0)
  const canvas = document.createElement('canvas')
  canvas.width = frame.cutWidth
  canvas.height = frame.cutHeight
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const src = scene.textures.get(CAMP_FIRE_SHEET).getSourceImage() as CanvasImageSource
  ctx.drawImage(src, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight)
  if (scene.textures.exists('prop-campfire')) scene.textures.remove('prop-campfire')
  const tex = scene.textures.addCanvas('prop-campfire', canvas)
  if (tex) markHd(tex, (hdProps as Record<string, number>)['camp-fire'] ?? 2)
  if (!scene.anims.exists(CAMP_FIRE_ANIM)) {
    scene.anims.create({
      key: CAMP_FIRE_ANIM,
      frames: scene.anims.generateFrameNumbers(CAMP_FIRE_SHEET, { start: 0, end: 1 }),
      frameRate: 6,
      repeat: -1,
    })
  }
  return ['prop-campfire']
}

function applyHoneyPawSheet(scene: Phaser.Scene) {
  if (!scene.textures.exists(HONEY_PAW_SHEET)) {
    console.error(`[artOverrides] missing ${HONEY_PAW_SHEET}`)
    return
  }
  scene.textures.get(HONEY_PAW_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST)
}
