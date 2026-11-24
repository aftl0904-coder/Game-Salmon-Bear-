import type Phaser from 'phaser'

/**
 * Clarity-1: combat engagement uses the camera worldView inset by 16px.
 * Off-screen enemies may walk closer, but must not start attacks / shots.
 */
export function inCombatView(
  scene: Phaser.Scene,
  x: number,
  y: number,
  inset = 16,
): boolean {
  const cam = scene.cameras?.main
  if (!cam) return true
  const l = cam.scrollX + inset
  const r = cam.scrollX + cam.width - inset
  const t = cam.scrollY + inset
  const b = cam.scrollY + cam.height - inset
  return x >= l && x <= r && y >= t && y <= b
}
