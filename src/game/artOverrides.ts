import type Phaser from 'phaser'

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
  // Cutscene props (data/story.json).
  'cs-jar-fake': '/art/items/jar-fake.png',
  'cs-jar-real': '/art/items/jar-real.png',
  'cs-note': '/art/items/note.png',
  'cs-picnic': '/art/props/picnic-blanket.png',
  'cs-cart': '/art/props/coffee-cart.png',
  'cs-mama': '/art/props/mama.png',
  'cs-mama-offer': '/art/props/mama-offer.png',
  // Goal: the honey tree with the glowing hive.
  goal3d: '/art/props/honey-tree.png',
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
}

export function preloadArtOverrides(scene: Phaser.Scene) {
  for (const [key, url] of Object.entries(ART_OVERRIDES)) scene.load.image(`ovr-${key}`, url)
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
    scene.textures.addCanvas(key, canvas)
    done.push(key)
  }
  return done
}
