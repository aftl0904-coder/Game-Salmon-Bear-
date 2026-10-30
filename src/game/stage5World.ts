import Phaser from 'phaser'
import type { Player } from './Player'
import { DEPTH } from './engine/depth'

/**
 * △畝大廈 mechanics that are genuinely new to stage 5 (everything else — wind pockets,
 * blackout/lanterns/slippery, the rooftop bulldozer — is the first four stages' own
 * Stage2World/Stage3World/Stage4World, constructed again here in GameScene for the
 * "mixed mechanics" lobby per docs/bible/stages-3-5.md §5):
 *  - conveyors: a belt that keeps nudging a grounded hero along, regardless of input.
 *  - the 溫泉回復點 (hot-spring full heal) is a one-shot trigger, handled directly in
 *    GameScene.tickHotSprings — no continuous state, so it doesn't need a class here.
 */

export type Stage5Ctx = { scene: Phaser.Scene; floorY: number }
export type Stage5Data = {
  conveyors?: Array<{ x0: number; x1: number; dir: 1 | -1; speed?: number }>
  hotSprings?: Array<{ x: number }>
}

export class Stage5World {
  private ctx: Stage5Ctx
  private d: Stage5Data
  private g: Phaser.GameObjects.Graphics
  private t = 0

  constructor(ctx: Stage5Ctx, d: Stage5Data) {
    this.ctx = ctx
    this.d = d
    this.g = ctx.scene.add.graphics().setDepth(DEPTH.GROUND + 4)
  }

  /** Call once per hero per tick, after their own movement update (mirrors Stage3World.slip). */
  push(h: Player, dt: number) {
    const z = (this.d.conveyors ?? []).find((c) => h.x >= c.x0 && h.x <= c.x1)
    if (!z) return
    const grounded = !h.laneJumping && h.y >= this.ctx.floorY - 4
    if (!grounded) return
    h.x += z.dir * (z.speed ?? 70) * (dt / 1000)
  }

  update(dt: number) {
    this.t += dt / 1000
    const g = this.g
    g.clear()
    const floor = this.ctx.floorY
    for (const z of this.d.conveyors ?? []) {
      g.fillStyle(0x30363c, 1).fillRect(z.x0, floor - 4, z.x1 - z.x0, 4)
      const stripeW = 16
      const shift = (((this.t * (z.speed ?? 70) * z.dir) % stripeW) + stripeW) % stripeW
      for (let x = z.x0 - stripeW + shift; x < z.x1; x += stripeW) {
        g.fillStyle(0xffcc33, 0.55).fillRect(x, floor - 3, stripeW * 0.5, 2)
      }
    }
  }

  destroy() {
    this.g.destroy()
  }
}
