import Phaser from 'phaser'
import type { Player } from './Player'
import { DEPTH } from './engine/depth'
import { SFX, playSong, stopBgm } from './audio'

/**
 * 鹽霧工地 mechanics (no enemies here — those are in enemies/Stage4Enemies.ts):
 *  - bulldozers: a background hazard. A warning light blinks ~1.5 s, then it sweeps a lane
 *    at ground height; any hero still on the ground (not up on a step/platform) in its path
 *    takes a hit. The S5 motorcycle-chase and S4 teaching beats are expressed purely through
 *    stage4.json's own pits/steps/spikes/enemies — the design brief calls that segment
 *    "no damage, just jump and shoot", which the existing engine already covers, so it needs
 *    no bespoke mechanic here.
 *  - busEvent: the one respectful, wordless beat (喪事班車段). A quiet bus crosses the
 *    background; forward progress is gently held at a soft wall until it passes, with the
 *    stage music ducked to just rain/engine ambience, then both resume.
 *  - fog: a thin ambient drizzle overlay for mood (purely decorative, never blocks).
 */

export type Stage4Ctx = {
  scene: Phaser.Scene
  floorY: number
  heroes: () => Player[]
  hurt: (h: Player, dir: number, label?: string) => void
}

export type Stage4Data = {
  bulldozers?: Array<{ x: number; periodMs: number; laneY?: number }>
  busEvent?: { x0: number; x1: number; durationMs?: number } | null
  fog?: boolean
}

const W = 640
const H = 360

/** Procedural placeholder for the bulldozer's pushed load — a lumpy dirt/rubble heap
 * instead of a flat colour rectangle, so it reads as "ground being shoved" rather than
 * an unexplained brown block. Drawn once and cached under `s4-dirt-heap`. */
function dirtHeapTexture(scene: Phaser.Scene): string {
  const key = 's4-dirt-heap'
  if (scene.textures.exists(key)) return key
  const w = 96
  const h = 50
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  // Shadow base — wide and flat, anchors it to the ground.
  g.fillStyle(0x2a1c10, 0.55).fillEllipse(w / 2, h - 6, w * 0.92, 14)
  // Main mass — an irregular heap, built from overlapping blobs rather than one shape.
  g.fillStyle(0x7a5230, 1)
  g.fillEllipse(w * 0.3, h - 16, w * 0.52, 30)
  g.fillEllipse(w * 0.62, h - 14, w * 0.5, 28)
  g.fillEllipse(w * 0.48, h - 24, w * 0.46, 26)
  // Mid-tone clumps — breaks up the silhouette so it doesn't read as one smooth blob.
  g.fillStyle(0x5c3c22, 1)
  g.fillEllipse(w * 0.22, h - 10, 20, 12)
  g.fillEllipse(w * 0.78, h - 11, 18, 11)
  g.fillEllipse(w * 0.52, h - 30, 16, 10)
  // Lighter rubble chunks on top — broken concrete/stone flecks, catching the light.
  g.fillStyle(0xb8a888, 1)
  g.fillEllipse(w * 0.34, h - 26, 8, 6)
  g.fillEllipse(w * 0.58, h - 22, 7, 5)
  g.fillEllipse(w * 0.46, h - 34, 6, 5)
  g.fillEllipse(w * 0.68, h - 28, 6, 4)
  // Dark cracks for texture.
  g.fillStyle(0x3a2616, 1)
  g.fillRect(w * 0.4, h - 28, 2, 10)
  g.fillRect(w * 0.6, h - 22, 2, 8)
  g.generateTexture(key, w, h)
  g.destroy()
  return key
}

type Dozer = {
  x: number
  period: number
  t: number
  state: 'idle' | 'warn' | 'sweep'
  warnT: number
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null
  light: Phaser.GameObjects.Arc
  hitHeroes: Set<Player>
}

export class Stage4World {
  private ctx: Stage4Ctx
  private dozers: Dozer[] = []
  private bus: { x0: number; x1: number; dur: number; state: 'idle' | 'crossing' | 'done'; t: number; img: Phaser.GameObjects.GameObject | null; wall: Phaser.GameObjects.Rectangle | null; duckedSong: boolean } | null = null
  private rain: Phaser.GameObjects.Rectangle[] = []
  private rainT = 0

  constructor(ctx: Stage4Ctx, d: Stage4Data) {
    this.ctx = ctx
    const s = ctx.scene
    for (const b of d.bulldozers ?? []) {
      const light = s.add.circle(b.x, ctx.floorY - 170, 5, 0xffcc33, 0).setDepth(DEPTH.FX - 2)
      this.dozers.push({ x: b.x, period: b.periodMs, t: Phaser.Math.Between(0, b.periodMs), state: 'idle', warnT: 0, img: null, light, hitHeroes: new Set() })
    }
    if (d.busEvent) {
      this.bus = { x0: d.busEvent.x0, x1: d.busEvent.x1, dur: d.busEvent.durationMs ?? 4200, state: 'idle', t: 0, img: null, wall: null, duckedSong: false }
    }
    if (d.fog) {
      for (let i = 0; i < 10; i++) {
        const r = s.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(40, 220), Phaser.Math.Between(60, 140), 2, 0xc8d0d8, 0.18).setScrollFactor(0.9).setDepth(DEPTH.FX - 3).setAngle(14)
        this.rain.push(r)
      }
    }
  }

  update(dt: number) {
    const s = this.ctx.scene
    const heroes = this.ctx.heroes()
    const lead = heroes.reduce((m, h) => Math.max(m, h.x), 0)

    // ── Bulldozers ──
    for (const dz of this.dozers) {
      if (Math.abs(lead - dz.x) > 420) continue
      dz.t += dt
      if (dz.state === 'idle' && dz.t >= dz.period) {
        dz.t = 0
        dz.state = 'warn'
        dz.warnT = 0
        SFX.siren()
      }
      if (dz.state === 'warn') {
        dz.warnT += dt
        const blink = Math.floor(dz.warnT / 150) % 2 === 0
        dz.light.setAlpha(blink ? 0.9 : 0.2)
        if (dz.warnT > 1500) {
          dz.state = 'sweep'
          dz.warnT = 0
          dz.hitHeroes.clear()
          const key = s.textures.exists('s4-bulldozer') ? 's4-bulldozer' : dirtHeapTexture(s)
          // Bottom-anchored on the floor — matches the old rectangle's footprint (its
          // centre at floorY-24, height 48, put its bottom edge at floorY).
          dz.img = s.add.image(dz.x + 260, this.ctx.floorY, key).setOrigin(0.5, 1).setDepth(DEPTH.PROP - 2)
        }
      } else if (dz.state === 'sweep') {
        dz.light.setAlpha(0)
        dz.warnT += dt
        if (dz.img) dz.img.x -= 420 * (dt / 1000)
        const sweepX = dz.img ? dz.img.x : dz.x
        for (const h of heroes) {
          if (dz.hitHeroes.has(h)) continue
          const grounded = h.y >= this.ctx.floorY - 6
          if (grounded && Math.abs(h.x - sweepX) < 40) {
            dz.hitHeroes.add(h)
            this.ctx.hurt(h, Math.sign(h.x - dz.x) || -1, '推土機！')
          }
        }
        if (dz.warnT > 1300) {
          dz.img?.destroy()
          dz.img = null
          dz.state = 'idle'
          dz.t = 0
        }
      }
    }

    // ── Funeral bus (silent, respectful — no damage, just a soft wait) ──
    const bus = this.bus
    if (bus) {
      if (bus.state === 'idle' && lead > bus.x0 - 60) {
        bus.state = 'crossing'
        bus.t = 0
        stopBgm()
        bus.duckedSong = true
        const key = s.textures.exists('s4-bus') ? 's4-bus' : null
        bus.img = key
          ? s.add.image(bus.x0 - 40, this.ctx.floorY - 32, key).setDepth(DEPTH.PROP - 1)
          : s.add.rectangle(bus.x0 - 40, this.ctx.floorY - 28, 110, 52, 0x4a5058, 1).setDepth(DEPTH.PROP - 1)
        bus.wall = s.add.rectangle(bus.x1 + 20, this.ctx.floorY - 90, 8, 180, 0x000000, 0).setDepth(DEPTH.FX)
        s.physics.add.existing(bus.wall, true)
        for (const h of heroes) s.physics.add.collider(h, bus.wall)
      }
      if (bus.state === 'crossing') {
        bus.t += dt
        const k = Math.min(1, bus.t / bus.dur)
        const img = bus.img as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null
        if (img) img.x = Phaser.Math.Linear(bus.x0 - 40, bus.x1 + 60, k)
        if (k >= 1) {
          bus.state = 'done'
          img?.destroy()
          bus.img = null
          bus.wall?.destroy()
          bus.wall = null
          if (bus.duckedSong) playSong('stage4')
        }
      }
    }

    // ── Fog drizzle (decorative) ──
    if (this.rain.length) {
      this.rainT += dt
      for (const r of this.rain) {
        r.y += 220 * (dt / 1000)
        r.x -= 30 * (dt / 1000)
        if (r.y > H + 20) {
          r.y = -20
          r.x = Phaser.Math.Between(0, W) + s.cameras.main.scrollX
        }
      }
    }
  }

  destroy() {
    for (const dz of this.dozers) {
      dz.img?.destroy()
      dz.light.destroy()
    }
    this.dozers = []
    this.bus?.img?.destroy()
    this.bus?.wall?.destroy()
    this.bus = null
    for (const r of this.rain) r.destroy()
    this.rain = []
  }
}
