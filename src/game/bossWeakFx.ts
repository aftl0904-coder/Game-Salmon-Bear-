/**
 * weak-hit-1: readable feedback when a boss hit went through bossHitDamage's weak branch.
 * Numbers here are feel-only (spark size / freeze / toast rate) — not damage.
 */
import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { burst, floatText, freezeActors, impactRing } from './fx'
import { hasFx, playFx } from './fxAnims'
import { SFX } from './audio'

/** Slightly longer than normal HIT_CONFIRM_FREEZE_MS (70) so the weak hit reads on phone. */
export const WEAK_HIT_FREEZE_MS = 80

const WEAK_TOAST_GAP_MS = 500
let lastWeakToastAt = 0

/** Distinct weak-hit crunch (pitched-up hit layers). */
export function playWeakHitSfx() {
  SFX.weakHit()
}

/**
 * Spark ~2× normal, teal/gold tint, 「弱點！」 toast (≤1 / 0.5s), short freeze.
 * Call from GameScene after a boss receiveHit that set `result.weak`.
 */
export function playBossWeakHitFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  actors: Array<Phaser.Physics.Arcade.Sprite | null | undefined>,
) {
  const sparkScale = 2
  const color = 0x5cffd0
  if (hasFx(scene, 'hit-spark')) {
    const s = playFx(scene, 'hit-spark', x, y, { depth: DEPTH.FX + 3, scale: sparkScale })
    s?.setTint(color)
  } else {
    burst(scene, x, y, color, 14)
  }
  impactRing(scene, x, y, color, 12)
  burst(scene, x, y - 4, 0xffe08a, 6)
  playWeakHitSfx()
  freezeActors(scene, actors, WEAK_HIT_FREEZE_MS)
  const now = scene.time.now
  // scene.time restarts from 0 on scene restart / next stage — reset the gate instead of muting the toast.
  if (now < lastWeakToastAt) lastWeakToastAt = -WEAK_TOAST_GAP_MS
  if (now - lastWeakToastAt >= WEAK_TOAST_GAP_MS) {
    lastWeakToastAt = now
    floatText(scene, x, y - 56, '弱點！', '#5cffd0', { size: 18, rise: 40, dur: 700 })
  }
}
