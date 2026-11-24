/**
 * Stage 8 · fake-honey pipe sprays + smashable valves (s8-1).
 * Cycle: warn (shake + drip) → on (hurt column, hazardHit −1) → idle.
 * Breaking a valve permanently shuts every pipe that references its id.
 */
import Phaser from 'phaser'
import { LANE_FLOOR_Y } from './engine/lanes'
import { DEPTH } from './engine/depth'
import { burst } from './fx'
import { SFX } from './audio'

export type PipeSprayDef = {
  x: number
  w: number
  periodMs: number
  phaseMs: number
  warnMs: number
  onMs: number
  valve?: string
}

export type ValveDef = {
  id: string
  x: number
  hits: number
}

type PipeRuntime = {
  def: PipeSprayDef
  t: number
  column: Phaser.GameObjects.Rectangle
  drip: Phaser.GameObjects.Rectangle
  shut: boolean
}

type ValveRuntime = {
  def: ValveDef
  hitsLeft: number
  broken: boolean
  spr: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
}

export type Stage8PipeHooks = {
  scene: Phaser.Scene
  hurt: (hero: Phaser.Physics.Arcade.Sprite, dir: number) => void
  heroes: () => Phaser.Physics.Arcade.Sprite[]
}

export class Stage8Pipes {
  private pipes: PipeRuntime[] = []
  private valves: ValveRuntime[] = []
  private hooks: Stage8PipeHooks
  private hitCd = new WeakMap<object, number>()

  constructor(hooks: Stage8PipeHooks, sprays: PipeSprayDef[], valves: ValveDef[]) {
    this.hooks = hooks
    const sc = hooks.scene
    for (const v of valves) {
      const spr = sc.add
        .rectangle(v.x, LANE_FLOOR_Y - 28, 22, 40, 0x6a8a9a, 1)
        .setStrokeStyle(2, 0xc8e0f0)
        .setDepth(DEPTH.BREAKABLE)
        .setOrigin(0.5, 1)
      const label = sc.add
        .text(v.x, LANE_FLOOR_Y - 72, '閥', {
          fontSize: '11px',
          color: '#dff6ff',
          stroke: '#102028',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.BREAKABLE + 1)
      this.valves.push({ def: v, hitsLeft: v.hits, broken: false, spr, label })
    }
    for (const p of sprays) {
      const column = sc.add
        .rectangle(p.x, LANE_FLOOR_Y, p.w, 8, 0xf0c040, 0.55)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.HAZARD)
        .setVisible(false)
      const drip = sc.add
        .rectangle(p.x, LANE_FLOOR_Y - 110, 4, 10, 0xffe08a, 0.9)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.HAZARD + 1)
        .setVisible(false)
      this.pipes.push({
        def: p,
        t: ((p.phaseMs % p.periodMs) + p.periodMs) % p.periodMs,
        column,
        drip,
        shut: false,
      })
    }
  }

  destroy() {
    for (const p of this.pipes) {
      p.column.destroy()
      p.drip.destroy()
    }
    for (const v of this.valves) {
      v.spr.destroy()
      v.label.destroy()
    }
    this.pipes = []
    this.valves = []
  }

  /** Sword / gun near a valve — 1P or 2P, no sync required. */
  tryHitValve(x: number, dir: number): boolean {
    for (const v of this.valves) {
      if (v.broken) continue
      if (Math.abs(x - v.def.x) > 40) continue
      v.hitsLeft -= 1
      burst(this.hooks.scene, v.def.x, LANE_FLOOR_Y - 36, 0xc8e8ff, 6)
      SFX.hit()
      v.spr.setFillStyle(0x8ab0c0)
      if (v.hitsLeft <= 0) this.breakValve(v, dir)
      return true
    }
    return false
  }

  private breakValve(v: ValveRuntime, dir: number) {
    v.broken = true
    v.spr.setFillStyle(0x304048)
    v.spr.setAlpha(0.45)
    v.label.setText('開')
    burst(this.hooks.scene, v.def.x, LANE_FLOOR_Y - 40, 0xffe08a, 14)
    burst(this.hooks.scene, v.def.x + dir * 8, LANE_FLOOR_Y - 24, 0xffaa44, 8)
    SFX.slam()
    SFX.kill()
    for (const p of this.pipes) {
      if (p.def.valve === v.def.id) {
        p.shut = true
        p.column.setVisible(false)
        p.drip.setVisible(false)
      }
    }
  }

  update(dt: number) {
    const now = this.hooks.scene.time.now
    for (const p of this.pipes) {
      if (p.shut) continue
      const cfg = p.def
      p.t = (p.t + dt) % cfg.periodMs
      const phase = p.t
      const warnEnd = cfg.warnMs
      const onEnd = cfg.warnMs + cfg.onMs
      if (phase < warnEnd) {
        const shake = Math.floor(phase / 40) % 2 === 0 ? -1 : 1
        p.drip.setVisible(true).setPosition(cfg.x + shake, LANE_FLOOR_Y - 100 - (phase / warnEnd) * 16)
        p.column.setVisible(false)
      } else if (phase < onEnd) {
        const k = (phase - warnEnd) / cfg.onMs
        const h = 16 + Math.min(1, k * 2) * (LANE_FLOOR_Y - 40)
        p.column.setVisible(true).setPosition(cfg.x, LANE_FLOOR_Y).setSize(cfg.w, h).setDisplaySize(cfg.w, h)
        p.drip.setVisible(false)
        const half = cfg.w * 0.55
        for (const hero of this.hooks.heroes()) {
          if (!hero.active) continue
          if (Math.abs(hero.x - cfg.x) > half) continue
          if (hero.y < LANE_FLOOR_Y - h - 8) continue
          const until = this.hitCd.get(hero) ?? 0
          if (now < until) continue
          this.hitCd.set(hero, now + 450)
          const dir = hero.x >= cfg.x ? 1 : -1
          this.hooks.hurt(hero, dir)
        }
      } else {
        p.column.setVisible(false)
        p.drip.setVisible(false)
      }
    }
  }
}
