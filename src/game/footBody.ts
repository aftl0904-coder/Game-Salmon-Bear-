import type Phaser from 'phaser'

/**
 * Shared foot baseline for heroes & enemies (SNES Goemon-style same ground plane).
 * Origin at feet; arcade body sits on the foot line so everyone shares gravity/colliders.
 */
export function bindFootBody(
  sprite: Phaser.Physics.Arcade.Sprite,
  opts: { bodyW: number; bodyH: number; padBottom?: number },
) {
  const pad = opts.padBottom ?? 2
  const fw = sprite.frame.width
  const fh = sprite.frame.height
  sprite.setOrigin(0.5, 1)
  const body = sprite.body as Phaser.Physics.Arcade.Body
  const w = Math.min(opts.bodyW, fw - 2)
  const h = Math.min(opts.bodyH, fh - pad)
  body.setSize(w, h)
  body.setOffset((fw - w) / 2, fh - h - pad)
  body.allowGravity = true
}
