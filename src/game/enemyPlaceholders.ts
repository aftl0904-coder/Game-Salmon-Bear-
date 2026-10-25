import type Phaser from 'phaser'

/** Maps runtime texture keys → placeholder sheet under /art/enemies/. */
export const ENEMY_SHEET_MAP = {
  'art-enemy': { id: 'E-01', frameWidth: 36, frameHeight: 40 },
  'art-enemy-barrel': { id: 'E-02', frameWidth: 64, frameHeight: 72 },
  'art-enemy-elephant': { id: 'E-03', frameWidth: 40, frameHeight: 56 },
} as const

export type EnemySheetKey = keyof typeof ENEMY_SHEET_MAP

/**
 * After procedural isoArt paints, replace enemy textures with first frame of
 * public/art/enemies/{id}.png silhouette sheets (scale=1 in-game).
 */
export function applyEnemyPlaceholderTextures(scene: Phaser.Scene): string[] {
  const applied: string[] = []
  for (const [texKey, meta] of Object.entries(ENEMY_SHEET_MAP)) {
    const sheetKey = `enemy-sheet-${meta.id}`
    if (!scene.textures.exists(sheetKey)) continue
    const src = scene.textures.get(sheetKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
    const sw = (src as { width: number }).width | 0
    const sh = (src as { height: number }).height | 0
    if (sw < 4 || sh < 4) continue
    const fw = meta.frameWidth
    const fh = meta.frameHeight
    const canvas = document.createElement('canvas')
    canvas.width = fw
    canvas.height = fh
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, fw, fh)
    // Frame 0 (idle)
    ctx.drawImage(src as CanvasImageSource, 0, 0, fw, fh, 0, 0, fw, fh)
    if (scene.textures.exists(texKey)) scene.textures.remove(texKey)
    scene.textures.addCanvas(texKey, canvas)
    applied.push(`${texKey}←${meta.id}`)
  }
  return applied
}
