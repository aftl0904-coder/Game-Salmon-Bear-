import type Phaser from 'phaser'

/**
 * Hand-pixelled PNGs that replace procedural paints (scripts/art/*.py).
 * Loaded in BootScene as `ovr-<key>`, then copied over the runtime key after
 * the procedural register* passes so every caller keeps using the same key.
 */
export const ART_OVERRIDES: Record<string, string> = {
  'fx-salmon-shot': '/art/items/salmon-roe.png',
  'fx-fish-bullet': '/art/items/fish-bubble.png',
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
