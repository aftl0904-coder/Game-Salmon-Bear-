import Phaser from 'phaser'
import type { Player } from './Player'
import { DEPTH } from './engine/depth'
import { jumpGravity } from './config/playerData'
import { playFx, hasFx } from './fxAnims'
import { SFX } from './audio'
import { floatText, burst } from './fx'

/**
 * 蜜樹丘 stage mechanics that are not enemies:
 *  - wind vents: step in → launched up; 琪寶寶 opens her fan and glides down slowly
 *  - honey drips: form under the canopy (telegraph), fall, stick the hero's feet (slow)
 *  - fake-honey spray + puddles from the queen (hurt / sticky floor)
 * Pure logic + sprites; GameScene passes heroes and a damage callback.
 */

export type Vent = { x: number; lift: number }
export type Drip = { x: number; periodMs: number }

type DripState = { x: number; period: number; t: number; phase: 'idle' | 'form' | 'fall'; drop: Phaser.GameObjects.Container | null; y: number; vy: number; form: Phaser.GameObjects.Sprite | null }
type Puddle = { x: number; until: number; spr: Phaser.GameObjects.GameObject }
type Spray = { x0: number; x1: number; until: number; hit: Set<Player> }

export type Stage2Ctx = {
  scene: Phaser.Scene
  floorY: number
  /** Ceiling line drips form under (below the HUD band). */
  ceilY: number
  heroes: () => Player[]
  hurt: (h: Player, dir: number, label: string) => void
}

const STICKY_MS = 2600
const STICKY_MUL = 0.5

export class Stage2World {
  private ctx: Stage2Ctx
  private vents: Vent[]
  private drips: DripState[] = []
  private puddles: Puddle[] = []
  private sprays: Spray[] = []

  constructor(ctx: Stage2Ctx, vents: Vent[], drips: Drip[]) {
    this.ctx = ctx
    this.vents = vents
    const s = ctx.scene
    for (const v of vents) {
      // Knot-hole in the bark + looping updraft above it.
      const hole = s.add.graphics().setDepth(DEPTH.GROUND + 4)
      hole.fillStyle(0x1a0e08, 1).fillEllipse(v.x, ctx.floorY + 2, 30, 8)
      hole.fillStyle(0x4a2a14, 1).fillEllipse(v.x, ctx.floorY, 22, 5)
      if (s.anims.exists('fxa-wind-vent-loop')) {
        for (let i = 0; i < 3; i++) {
          s.add
            .sprite(v.x, ctx.floorY - i * 40, 'fxa-wind-vent')
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.PROP - 1)
            .setAlpha(0.75 - i * 0.2)
            .play({ key: 'fxa-wind-vent-loop', startFrame: i % 3 })
        }
      }
    }
    for (const d of drips) {
      // A honey glob clinging to the canopy marks where drops will fall.
      const glob = s.add.graphics().setDepth(DEPTH.PROP - 1)
      glob.fillStyle(0x9a5a10, 1).fillEllipse(d.x, ctx.ceilY + 1, 14, 6)
      glob.fillStyle(0xf0a020, 1).fillEllipse(d.x, ctx.ceilY, 10, 4)
      this.drips.push({ x: d.x, period: d.periodMs, t: (d.x * 7) % d.periodMs, phase: 'idle', drop: null, y: 0, vy: 0, form: null })
    }
  }

  /** Movement multiplier for a hero (sticky honey on the feet). */
  speedMul(h: Player): number {
    const until = (h.getData('stickyUntil') as number | undefined) ?? 0
    return this.ctx.scene.time.now < until ? STICKY_MUL : 1
  }

  private stick(h: Player, ms = STICKY_MS) {
    const now = this.ctx.scene.time.now
    const was = ((h.getData('stickyUntil') as number | undefined) ?? 0) > now
    h.setData('stickyUntil', now + ms)
    if (!was) {
      floatText(this.ctx.scene, h.x, h.y - 52, '黐腳！', '#ffcc44', { size: 12, dur: 800 })
      SFX.gulp()
    }
  }

  update(dt: number) {
    const s = this.ctx.scene
    const now = s.time.now
    const floor = this.ctx.floorY
    const heroes = this.ctx.heroes()

    // ── Wind vents ──
    for (const h of heroes) {
      for (const v of this.vents) {
        if (Math.abs(h.x - v.x) > 16) continue
        if (h.laneJumping || h.y < floor - 3) continue
        const girl = h.role === 'girl'
        const lift = v.lift * (girl ? 1.3 : 1)
        h.launch(-Math.sqrt(2 * jumpGravity() * lift))
        if (girl) h.floating = true
        SFX.jump()
        SFX.sparkle()
        if (hasFx(s, 'dust-step')) playFx(s, 'dust-step', v.x, floor, { originY: 1 })
      }
      // Sticky feet sparkle so the slow reads.
      if (now < ((h.getData('stickyUntil') as number | undefined) ?? 0) && Math.random() < dt / 260) {
        burst(s, h.x, h.y - 2, 0xffc040, 2)
      }
    }

    // ── Honey drips ──
    for (const d of this.drips) {
      d.t += dt
      if (d.phase === 'idle' && d.t >= d.period) {
        d.phase = 'form'
        d.t = 0
        d.form = s.anims.exists('fxa-honey-drip')
          ? s.add.sprite(d.x, this.ctx.ceilY, 'fxa-honey-drip').setOrigin(0.5, 0).setDepth(DEPTH.FX - 2).play('fxa-honey-drip')
          : null
      } else if (d.phase === 'form' && d.t >= 650) {
        d.form?.destroy()
        d.form = null
        d.phase = 'fall'
        d.t = 0
        d.y = this.ctx.ceilY + 14
        d.vy = 40
        const g = s.add.graphics()
        g.fillStyle(0x8a4a08, 1).fillEllipse(0, 0, 6, 9)
        g.fillStyle(0xf2a822, 1).fillEllipse(0, 0, 4, 7)
        g.fillStyle(0xfff0b0, 1).fillRect(-1, -2, 1, 2)
        d.drop = s.add.container(d.x, d.y, [g]).setDepth(DEPTH.FX - 2)
      } else if (d.phase === 'fall' && d.drop) {
        d.vy += 900 * (dt / 1000)
        d.y += d.vy * (dt / 1000)
        d.drop.setY(d.y)
        let done = false
        for (const h of heroes) {
          if (Math.abs(h.x - d.x) < 11 && d.y > h.y - 46 && d.y < h.y) {
            this.stick(h)
            done = true
          }
        }
        if (d.y >= floor - 2) {
          burst(s, d.x, floor - 2, 0xf2a822, 5)
          done = true
        }
        if (done) {
          d.drop.destroy()
          d.drop = null
          d.phase = 'idle'
          d.t = 0
        }
      }
    }

    // ── Queen spray (hurts while the stream is out) ──
    this.sprays = this.sprays.filter((sp) => {
      if (now > sp.until) return false
      for (const h of heroes) {
        if (sp.hit.has(h)) continue
        if (h.x >= sp.x0 && h.x <= sp.x1 && h.y > floor - 34) {
          sp.hit.add(h)
          this.ctx.hurt(h, Math.sign(h.x - (sp.x0 + sp.x1) / 2) || 1, '假蜜')
        }
      }
      return true
    })

    // ── Sticky puddles ──
    this.puddles = this.puddles.filter((p) => {
      if (now > p.until) {
        const spr = p.spr as Phaser.GameObjects.Sprite
        s.tweens.add({ targets: spr, alpha: 0, duration: 400, onComplete: () => spr.destroy() })
        return false
      }
      for (const h of heroes) {
        if (Math.abs(h.x - p.x) < 28 && !h.laneJumping) this.stick(h, 900)
      }
      return true
    })
  }

  /** Queen's fake-honey stream along the floor from x towards dir, then a sticky puddle. */
  spray(x: number, dir: 1 | -1) {
    const s = this.ctx.scene
    const floor = this.ctx.floorY
    playFx(s, 'honey-stream', x + dir * 50, floor - 22, { flipX: dir < 0, depth: DEPTH.FX })
    SFX.slam()
    const reach = 104
    const x0 = dir > 0 ? x + 6 : x - reach
    const x1 = dir > 0 ? x + reach : x - 6
    this.sprays.push({ x0, x1, until: s.time.now + 420, hit: new Set() })
    s.time.delayedCall(380, () => {
      const px = x + dir * 78
      let spr: Phaser.GameObjects.GameObject
      if (s.anims.exists('fxa-honey-puddle')) {
        const sp = s.add.sprite(px, floor + 6, 'fxa-honey-puddle').setOrigin(0.5, 1).setDepth(DEPTH.GROUND + 5)
        sp.play('fxa-honey-puddle')
        spr = sp
      } else {
        spr = s.add.ellipse(px, floor, 56, 8, 0xf2a822, 0.9).setDepth(DEPTH.GROUND + 5)
      }
      this.puddles.push({ x: px, until: s.time.now + 4500, spr })
    })
  }

  destroy() {
    for (const d of this.drips) {
      d.drop?.destroy()
      d.form?.destroy()
    }
    this.drips = []
    this.puddles = []
    this.sprays = []
  }
}
