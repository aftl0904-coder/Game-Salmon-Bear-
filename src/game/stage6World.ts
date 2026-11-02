import Phaser from 'phaser'
import type { Player } from './Player'
import { DEPTH } from './engine/depth'
import { SFX } from './audio'
import { burst } from './fx'

/**
 * 第二大陸・購物中心 mechanics that are new to stage 6 (the dark veil is Stage3World's own):
 *  - debris: ceiling rubble in the construction zone. A gold light pillar blinks on the floor
 *    (the 月橋鏡鴞 warning-pillar look), then the chunk drops. The fall itself is harmless — only
 *    the landing hurts, and only for a short window, so the pillar is the whole telegraph.
 *  - scanner sweep + patrol drone: the 保安總監's attacks, spawned through GameScene hooks.
 *  - cages: a static silhouette backdrop prop (no entity).
 */

export type Stage6Ctx = {
  scene: Phaser.Scene
  floorY: number
  heroes: () => Player[]
  hurt: (h: Player, dir: number, label: string) => void
  /** A bolt dropped on a hero by the patrol drone. */
  dropShot: (x: number, y: number) => void
}

export type Stage6Data = {
  debris?: Array<{ x: number; periodMs: number; offsetMs?: number; warnMs?: number }>
  cages?: Array<{ x: number }>
}

type DebrisPhase = 'idle' | 'warn' | 'fall' | 'land'
type Debris = {
  x: number
  periodMs: number
  warnMs: number
  phase: DebrisPhase
  t: number
  col: Phaser.GameObjects.Rectangle
  base: Phaser.GameObjects.Ellipse
  chunk: Phaser.GameObjects.Image | null
  hit: Set<Player>
}

export type Stage6Event = { kind: 'debris-warn' | 'debris-fall' | 'debris-land' | 'debris-hit' | 'sweep-warn' | 'sweep-run' | 'sweep-hit' | 'drone-lock' | 'drone-shot'; x: number; at: number }

const FALL_MS = 260
const LAND_HURT_MS = 320
const CHUNK_HALF_W = 20
const BEAM_HALF_W = 14
const BEAM_HEIGHT = 22
const DRONE_Y_OFF = 84
const CONE_HALF_W = 38

export class Stage6World {
  private ctx: Stage6Ctx
  private debris: Debris[] = []
  private g: Phaser.GameObjects.Graphics
  private sweeps: Array<{
    x0: number
    x1: number
    dir: 1 | -1
    speed: number
    t: number
    warnMs: number
    x: number
    running: boolean
    hit: Set<Player>
    pillars: Phaser.GameObjects.GameObject[]
  }> = []
  private drones: Array<{
    img: Phaser.GameObjects.Image
    dir: 1 | -1
    speed: number
    x1: number
    lock: Map<Player, number>
    cooldown: number
    fireAt: number
    target: Player | null
  }> = []
  /** Recent hazard events (kept short) — what the QA scripts read to check telegraph-before-damage. */
  readonly events: Stage6Event[] = []

  constructor(ctx: Stage6Ctx, d: Stage6Data) {
    this.ctx = ctx
    const s = ctx.scene
    this.g = s.add.graphics().setDepth(DEPTH.FX - 3)
    for (const c of d.debris ?? []) {
      const warnMs = c.warnMs ?? 950
      const col = s.add.rectangle(c.x, ctx.floorY / 2, 56, ctx.floorY, 0xfff0a0, 0.75).setDepth(DEPTH.SHADOW + 4).setAlpha(0)
      const base = s.add.ellipse(c.x, ctx.floorY + 2, 60, 9, 0xff9a3c, 1).setDepth(DEPTH.SHADOW + 5).setAlpha(0)
      this.debris.push({ x: c.x, periodMs: c.periodMs, warnMs, phase: 'idle', t: c.offsetMs ?? 0, col, base, chunk: null, hit: new Set() })
    }
    for (const c of d.cages ?? []) this.drawCage(c.x)
  }

  private log(kind: Stage6Event['kind'], x: number) {
    this.events.push({ kind, x, at: this.ctx.scene.time.now })
    if (this.events.length > 80) this.events.shift()
  }

  private drawCage(x: number) {
    const s = this.ctx.scene
    const key = 's6-cage'
    if (!s.textures.exists(key)) return
    const img = s.add.image(x, this.ctx.floorY + 1, key).setOrigin(0.5, 1).setDepth(DEPTH.PROP - 1).setTint(0xb0a098)
    img.setScale(img.scaleX * 1.3, img.scaleY * 1.3)
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    const eyes = s.add.graphics().setDepth(DEPTH.PROP)
    eyes.fillStyle(0xffe08a, 1).fillRect(x - 10, this.ctx.floorY - 28, 2, 2).fillRect(x + 6, this.ctx.floorY - 28, 2, 2)
    s.tweens.add({ targets: eyes, alpha: { from: 0.15, to: 0.9 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  }

  /** Warn → beam → gone. `speed` px/s. Returns the total length in ms (warn + run). */
  sweep(x0: number, x1: number, dir: 1 | -1, warnMs: number, speed: number): number {
    const s = this.ctx.scene
    const startX = dir > 0 ? x0 + 12 : x1 - 12
    const pillars: Phaser.GameObjects.GameObject[] = []
    const col = s.add.rectangle(startX, this.ctx.floorY / 2, 36, this.ctx.floorY, 0x8ac8ff, 0.2).setDepth(DEPTH.SHADOW + 4)
    const base = s.add.ellipse(startX, this.ctx.floorY + 2, 44, 9, 0xfff0a0, 0.7).setDepth(DEPTH.SHADOW + 5)
    const lane = s.add.rectangle((x0 + x1) / 2, this.ctx.floorY + 2, x1 - x0, 3, 0xff5030, 0.25).setDepth(DEPTH.SHADOW + 5)
    s.tweens.add({ targets: [col, base], alpha: { from: 0.2, to: 0.75 }, duration: 140, yoyo: true, repeat: Math.max(1, Math.round(warnMs / 280)) })
    pillars.push(col, base, lane)
    this.sweeps.push({ x0, x1, dir, speed, t: 0, warnMs, x: startX, running: false, hit: new Set(), pillars })
    this.log('sweep-warn', startX)
    SFX.siren()
    return warnMs + ((x1 - x0 - 24) / speed) * 1000
  }

  /** A patrol drone crosses the arena; any hero held in its light for a beat gets a bolt dropped on them. */
  drone(x0: number, x1: number, dir: 1 | -1, speed: number) {
    const s = this.ctx.scene
    const key = s.textures.exists('s6-drone') ? 's6-drone' : 'coin'
    const img = s.add.image(dir > 0 ? x0 : x1, this.ctx.floorY - DRONE_Y_OFF, key).setDepth(DEPTH.FX - 2)
    s.tweens.add({ targets: img, y: img.y - 4, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' })
    this.drones.push({ img, dir, speed, x1: dir > 0 ? x1 : x0, lock: new Map(), cooldown: 0, fireAt: 0, target: null })
  }

  droneCount() {
    return this.drones.length
  }

  update(dt: number) {
    const s = this.ctx.scene
    const now = s.time.now
    const heroes = this.ctx.heroes()
    const cam = s.cameras.main
    const floor = this.ctx.floorY
    const g = this.g
    g.clear()

    for (const d of this.debris) {
      d.t -= dt
      const onScreen = d.x > cam.scrollX - 60 && d.x < cam.scrollX + 700
      if (d.phase === 'idle' && d.t <= 0) {
        d.phase = 'warn'
        d.t = d.warnMs
        d.hit.clear()
        if (onScreen) this.log('debris-warn', d.x)
        s.tweens.add({ targets: [d.col, d.base], alpha: { from: 0.25, to: 1 }, duration: 150, yoyo: true, repeat: Math.max(1, Math.round(d.warnMs / 300)) })
        if (onScreen) SFX.siren()
      } else if (d.phase === 'warn' && d.t <= 0) {
        d.phase = 'fall'
        d.t = FALL_MS
        const key = s.textures.exists('s6-debris') ? 's6-debris' : 'coin'
        d.chunk = s.add.image(d.x, -20, key).setOrigin(0.5, 1).setDepth(DEPTH.FX - 2)
        s.tweens.add({ targets: d.chunk, y: floor + 2, duration: FALL_MS, ease: 'Quad.in' })
        if (onScreen) this.log('debris-fall', d.x)
      } else if (d.phase === 'fall' && d.t <= 0) {
        d.phase = 'land'
        d.t = LAND_HURT_MS
        s.tweens.killTweensOf([d.col, d.base])
        d.col.setAlpha(0)
        d.base.setAlpha(0)
        if (onScreen) {
          this.log('debris-land', d.x)
          SFX.slam()
          cam.shake(110, 0.004)
          burst(s, d.x - 12, floor - 2, 0xc8b898, 6)
          burst(s, d.x + 12, floor - 2, 0xc8b898, 6)
        }
        const chunk = d.chunk
        if (chunk) s.tweens.add({ targets: chunk, alpha: 0, delay: 1100, duration: 400, onComplete: () => chunk.destroy() })
        d.chunk = null
      } else if (d.phase === 'land' && d.t <= 0) {
        d.phase = 'idle'
        d.t = d.periodMs
      }
      if (d.phase === 'land') {
        for (const h of heroes) {
          if (d.hit.has(h) || !h.alive) continue
          if (Math.abs(h.x - d.x) < CHUNK_HALF_W && h.y > floor - 30) {
            d.hit.add(h)
            this.log('debris-hit', d.x)
            this.ctx.hurt(h, Math.sign(h.x - d.x) || 1, '碎石 -1')
          }
        }
      }
    }

    for (let i = this.sweeps.length - 1; i >= 0; i--) {
      const w = this.sweeps[i]!
      w.t += dt
      if (!w.running && w.t >= w.warnMs) {
        w.running = true
        this.log('sweep-run', w.x)
        SFX.slam()
        cam.shake(120, 0.003)
      }
      if (w.running) {
        w.x += w.dir * w.speed * (dt / 1000)
        const end = w.dir > 0 ? w.x >= w.x1 - 12 : w.x <= w.x0 + 12
        const [col, base] = w.pillars as [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Ellipse]
        col.setPosition(w.x, floor / 2).setFillStyle(0xfff0a0, 0.55)
        base.setPosition(w.x, floor + 2)
        g.fillStyle(0xff7040, 0.9).fillRect(w.x - BEAM_HALF_W, floor - BEAM_HEIGHT, BEAM_HALF_W * 2, BEAM_HEIGHT)
        g.fillStyle(0xfff0c0, 0.9).fillRect(w.x - 2, floor - BEAM_HEIGHT, 4, BEAM_HEIGHT)
        for (const h of heroes) {
          if (w.hit.has(h) || !h.alive) continue
          if (Math.abs(h.x - w.x) < BEAM_HALF_W + 6 && h.y > floor - BEAM_HEIGHT) {
            w.hit.add(h)
            this.log('sweep-hit', w.x)
            this.ctx.hurt(h, w.dir, '掃描 -1')
          }
        }
        if (end) {
          for (const p of w.pillars) p.destroy()
          this.sweeps.splice(i, 1)
        }
      }
    }

    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i]!
      d.img.x += d.dir * d.speed * (dt / 1000)
      d.cooldown = Math.max(0, d.cooldown - dt)
      let lit: Player | null = null
      for (const h of heroes) if (h.alive && Math.abs(h.x - d.img.x) < CONE_HALF_W) lit = h
      const locking = !!lit && d.cooldown <= 0
      if (lit && locking) {
        const t = (d.lock.get(lit) ?? 0) + dt
        d.lock.set(lit, t)
        if (t > 120 && d.target !== lit) {
          d.target = lit
          this.log('drone-lock', d.img.x)
        }
        if (t >= 420) {
          d.lock.clear()
          d.target = null
          d.cooldown = 1500
          this.log('drone-shot', lit.x)
          this.ctx.dropShot(lit.x, floor - DRONE_Y_OFF + 10)
        }
      } else {
        d.lock.clear()
        d.target = null
      }
      const red = !!d.target
      const tip = d.img.y + 8
      g.fillStyle(red ? 0xff4030 : 0xfff0a0, red ? 0.3 : 0.16)
      g.fillTriangle(d.img.x, tip, d.img.x - CONE_HALF_W, floor + 2, d.img.x + CONE_HALF_W, floor + 2)
      const gone = d.dir > 0 ? d.img.x >= d.x1 : d.img.x <= d.x1
      if (gone) {
        d.img.destroy()
        this.drones.splice(i, 1)
      }
    }
    void now
  }

  /** Boss down: drop any beam / drone still in flight. */
  clearHazards() {
    for (const w of this.sweeps) for (const p of w.pillars) p.destroy()
    for (const d of this.drones) d.img.destroy()
    this.sweeps = []
    this.drones = []
  }

  destroy() {
    this.g.destroy()
    for (const d of this.debris) {
      d.col.destroy()
      d.base.destroy()
      d.chunk?.destroy()
    }
    for (const w of this.sweeps) for (const p of w.pillars) p.destroy()
    for (const d of this.drones) d.img.destroy()
    this.debris = []
    this.sweeps = []
    this.drones = []
  }
}
