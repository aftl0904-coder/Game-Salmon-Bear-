/**
 * s7-look / art-scale: Manus S8–10 sheets use res:4 with large empty padding,
 * so at scale 1 they look much smaller than Stage 1–4 enemies.
 * Bump display only; keep world collision ≈ the original bodyW×bodyH
 * (Arcade Body size scales with the GameObject).
 */
import Phaser from 'phaser'
import type { AnimEnemy } from './enemies/Stage2Enemies'

/** ~1.55 → content height near honeyzombie / hatsoldier (~56–65 logical px). */
export const C2_SHEET_DISPLAY_SCALE = 1.55

export function applyC2SheetDisplayScale(enemy: AnimEnemy, bodyW: number, bodyH: number) {
  const s = C2_SHEET_DISPLAY_SCALE
  enemy.baseScale = s
  enemy.setScale(s)
  const w = bodyW / s
  const h = bodyH / s
  const body = enemy.body as Phaser.Physics.Arcade.Body
  const fw = enemy.frame.width
  const fh = enemy.frame.height
  body.setSize(w, h)
  body.setOffset((fw - w) / 2, fh - h - 2)
}
