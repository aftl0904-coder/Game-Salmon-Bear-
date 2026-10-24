import type Phaser from 'phaser'
import { GROUND_Y } from './constants'

/** True when arcade body is supported from below (tile / static collider). */
export function isGrounded(body: Phaser.Physics.Arcade.Body | null | undefined): boolean {
  if (!body) return false
  return body.blocked.down || body.touching.down
}

/** Feet Y for a foot-origin sprite (originY === 1 → sprite.y is feet). */
export function feetY(sprite: Phaser.GameObjects.Sprite): number {
  return sprite.y
}

/** Body AABB bottom in world space. */
export function bodyBottom(body: Phaser.Physics.Arcade.Body): number {
  return body.bottom
}

/**
 * Snap a foot-origin actor onto the shared ground plane and zero vertical velocity.
 * Used after fall-respawn / coin-continue so heroes & enemies share the same plane.
 */
export function snapToGroundPlane(
  sprite: Phaser.Physics.Arcade.Sprite,
  x: number,
  surfaceY: number = GROUND_Y,
) {
  sprite.setPosition(x, surfaceY)
  const body = sprite.body as Phaser.Physics.Arcade.Body | null
  if (body) {
    body.velocity.y = 0
    body.blocked.down = true
  }
}

/**
 * Soft wall/ceiling damping — kills residual velocity when jammed into a blocker
 * so characters do not stick vibrating inside tiles.
 */
export function resolveStick(
  body: Phaser.Physics.Arcade.Body,
  opts: { wallDamp?: number; ceilKill?: boolean } = {},
) {
  const wallDamp = opts.wallDamp ?? 0.35
  if (body.blocked.left && body.velocity.x < 0) body.velocity.x *= wallDamp
  if (body.blocked.right && body.velocity.x > 0) body.velocity.x *= wallDamp
  if (opts.ceilKill !== false && body.blocked.up && body.velocity.y < 0) {
    body.velocity.y = 0
  }
}

/** Horizontal gap between two foot bottoms — used by smoke / debug plane checks. */
export function groundPlaneSpan(bottoms: number[]): number {
  if (bottoms.length === 0) return 0
  return Math.max(...bottoms) - Math.min(...bottoms)
}
