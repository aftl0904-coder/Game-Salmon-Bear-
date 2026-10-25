import type Phaser from 'phaser'

export type NonIntegerScaleHit = { key: string; sx: number; sy: number }

/**
 * Walk scene display list (incl. Containers) and report non-integer sprite scales.
 * Call with ?debug=1 — target count = 0 after art bake / layout fixes.
 */
export function assertIntegerScale(scene: Phaser.Scene): NonIntegerScaleHit[] {
  const bad: NonIntegerScaleHit[] = []
  const walk = (list: readonly Phaser.GameObjects.GameObject[]) =>
    list.forEach((o) => {
      const any = o as Phaser.GameObjects.GameObject & {
        list?: Phaser.GameObjects.GameObject[]
        texture?: { key?: string }
        scaleX?: number
        scaleY?: number
      }
      if (any.list) walk(any.list)
      if (
        any.texture &&
        typeof any.scaleX === 'number' &&
        typeof any.scaleY === 'number' &&
        (any.scaleX % 1 !== 0 || any.scaleY % 1 !== 0)
      ) {
        bad.push({ key: any.texture.key ?? '?', sx: any.scaleX, sy: any.scaleY })
      }
    })
  walk(scene.children.list)
  if (bad.length) console.warn('[pixel] 非整數縮放：', bad)
  else console.log('[pixel] 全部整數縮放 OK')
  return bad
}

export function isDebugQuery(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1'
  } catch {
    return false
  }
}
