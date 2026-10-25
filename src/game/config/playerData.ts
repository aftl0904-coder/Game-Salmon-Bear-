/**
 * Runtime player stats — sourced from /data/player.json (not hardcoded).
 * Stage 1 single-lane platformer.
 */
import raw from '../../../data/player.json'

export type PlayerJson = typeof raw

/** Canonical player tuning (JSON). */
export const PLAYER: PlayerJson = raw

/** Jump impulse (Arcade: negative = up). */
export function jumpVelocity(): number {
  return -Math.abs(PLAYER.jump.velocity)
}

/** World / body gravity from JSON. */
export function jumpGravity(): number {
  return PLAYER.jump.gravity
}

/** Apex velocity that reaches `heightPx` under current gravity: v = -√(2gh). */
export function apexVelocityForHeight(heightPx: number): number {
  const g = jumpGravity()
  return -Math.sqrt(Math.max(1, 2 * g * heightPx))
}

export function tapApexVelocity(): number {
  return apexVelocityForHeight(PLAYER.jump.targetHeightPx.tap)
}

export function fullApexVelocity(): number {
  // Prefer JSON velocity when it matches full height; else derive.
  const fromJson = jumpVelocity()
  const fromHeight = apexVelocityForHeight(PLAYER.jump.targetHeightPx.full)
  return Math.abs(fromJson - fromHeight) < 8 ? fromJson : fromHeight
}
