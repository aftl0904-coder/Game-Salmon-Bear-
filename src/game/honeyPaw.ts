/**
 * M6 honey-paw prints — 16×16 strip (frame 0 full, frame 1 shrink, frame 2 empty).
 * True fade uses sprite alpha (strip is binary alpha only).
 */
import Phaser from 'phaser'
import { HONEY_PAW_SHEET } from './artOverrides'
import { DEPTH } from './engine/depth'
import { enablePixelSprite } from './pixelSnap'

export type PawPoint = { x: number; y: number; flip?: boolean }

/** Ground trail: larger → smaller frames + falling alpha toward the end. */
export function placeHoneyPawTrail(
  scene: Phaser.Scene,
  points: PawPoint[],
  opts: { depth?: number; alpha0?: number; alpha1?: number; tint?: number } = {},
): Phaser.GameObjects.Image[] {
  if (!scene.textures.exists(HONEY_PAW_SHEET) || points.length === 0) return []
  const depth = opts.depth ?? DEPTH.PROP - 1
  const a0 = opts.alpha0 ?? 0.72
  const a1 = opts.alpha1 ?? 0.22
  const tint = opts.tint ?? 0xffd76a
  const out: Phaser.GameObjects.Image[] = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const t = n === 1 ? 0 : i / (n - 1)
    // Prefer shrink frame toward the end; skip empty frame 2.
    const frame = t >= 0.55 ? 1 : 0
    const alpha = a0 + (a1 - a0) * t
    const img = scene.add
      .image(Math.round(p.x), Math.round(p.y), HONEY_PAW_SHEET, frame)
      .setOrigin(0.5, 1)
      .setDepth(depth)
      .setAlpha(alpha)
      .setTint(tint)
      .setFlipX(!!p.flip)
    enablePixelSprite(img)
    out.push(img)
  }
  return out
}

/** A few paw prints over picnic story stills (C1 / ending picnic). */
export function overlayPicnicPaws(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
): Phaser.GameObjects.Image[] {
  if (!scene.textures.exists(HONEY_PAW_SHEET)) return []
  // Logical 640×360 still — soft trail across the blanket / grass.
  const spots: Array<PawPoint & { frame: number; alpha: number }> = [
    { x: 250, y: 268, frame: 0, alpha: 0.55, flip: false },
    { x: 278, y: 276, frame: 0, alpha: 0.42, flip: true },
    { x: 308, y: 282, frame: 1, alpha: 0.32, flip: false },
    { x: 334, y: 288, frame: 1, alpha: 0.2, flip: true },
  ]
  const out: Phaser.GameObjects.Image[] = []
  for (const s of spots) {
    const img = scene.add
      .image(s.x, s.y, HONEY_PAW_SHEET, s.frame)
      .setOrigin(0.5, 1)
      .setAlpha(s.alpha)
      .setTint(0xffd76a)
      .setFlipX(!!s.flip)
    enablePixelSprite(img)
    parent.add(img)
    out.push(img)
  }
  return out
}

export function isPicnicStill(id: string | null | undefined): boolean {
  return id === 'c1-picnic' || id === 'ending-3'
}
