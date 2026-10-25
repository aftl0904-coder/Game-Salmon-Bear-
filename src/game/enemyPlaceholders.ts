import type Phaser from 'phaser'

/**
 * Runtime texture key → enemy art under /art/enemies/{id}.png.
 * Art is cut from art-src/enemies/enemy-lineup-five.png, already sized to the
 * final in-game height (incl. 1px transparent pad for the shared ink outline)
 * and facing RIGHT (PatrolEnemy flips when moving left). In-game scale stays 1.
 *
 * species fish     → E-01 紅魚
 * species barrel   → E-03 帽仔兵（快速、中型 56px）
 * species elephant → E-02 機械豬（重型 72px）
 */
export const ENEMY_SHEET_MAP = {
  'art-enemy': { id: 'E-01' },
  'art-enemy-barrel': { id: 'E-03' },
  'art-enemy-elephant': { id: 'E-02' },
  'hazard-durian': { id: 'E-04' },
  'fx-ambient-bee': { id: 'E-05-ambient' },
} as const

export type EnemySheetKey = keyof typeof ENEMY_SHEET_MAP

/** Sheet id for a runtime texture key (used by isoArt to skip procedural paint). */
export function enemySheetIdFor(texKey: string): string | null {
  const meta = (ENEMY_SHEET_MAP as Record<string, { id: string }>)[texKey]
  return meta ? meta.id : null
}

/**
 * Replace runtime textures with the loaded PNG art (full image, scale 1).
 * If an image failed to load, paint a loud red "MISSING" box instead of
 * silently falling back to procedural blocks.
 */
export function applyEnemyPlaceholderTextures(scene: Phaser.Scene): string[] {
  const applied: string[] = []
  for (const [texKey, meta] of Object.entries(ENEMY_SHEET_MAP)) {
    const sheetKey = `enemy-sheet-${meta.id}`
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    const src = scene.textures.exists(sheetKey)
      ? (scene.textures.get(sheetKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement)
      : null
    const sw = src ? (src as { width: number }).width | 0 : 0
    const sh = src ? (src as { height: number }).height | 0 : 0

    if (!src || sw < 4 || sh < 4) {
      console.error(`[enemyArt] MISSING ${meta.id} for ${texKey}`)
      canvas.width = 32
      canvas.height = 32
      ctx.fillStyle = '#d02020'
      ctx.fillRect(0, 0, 32, 32)
      ctx.fillStyle = '#ffffff'
      ctx.font = '8px monospace'
      ctx.fillText('MISS', 4, 14)
      ctx.fillText(meta.id.slice(0, 5), 2, 26)
    } else {
      canvas.width = sw
      canvas.height = sh
      ctx.clearRect(0, 0, sw, sh)
      ctx.drawImage(src as CanvasImageSource, 0, 0)
    }

    if (scene.textures.exists(texKey)) scene.textures.remove(texKey)
    scene.textures.addCanvas(texKey, canvas)
    applied.push(`${texKey}←${meta.id}`)
  }
  console.log('[enemyArt] species → art:', applied.join(', '))
  return applied
}
