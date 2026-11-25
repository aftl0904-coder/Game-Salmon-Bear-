/**
 * Stage 9 · 押送閘 + 閘門掣（s9-1）.
 * Gate cycle: warn (flash) → closed (hazardHit −1 + knock back) → open.
 * Smash a switch `hits` times → every gate with that switch id stays open.
 */
import Phaser from 'phaser'
import { LANE_FLOOR_Y } from './engine/lanes'
import { DEPTH } from './engine/depth'
import { burst } from './fx'
import { SFX } from './audio'
import { FONT_UI } from './ui/fonts'

export type SlidingGateDef = {
  id: string
  x: number
  periodMs: number
  phaseMs: number
  warnMs: number
  closedMs: number
  switch?: string
}

export type GateSwitchDef = {
  id: string
  x: number
  hits: number
}

type GateRuntime = {
  def: SlidingGateDef
  t: number
  /** Permanent open after its switch is broken. */
  lockedOpen: boolean
  blade: Phaser.GameObjects.Rectangle
  lamp: Phaser.GameObjects.Arc
}

type SwitchRuntime = {
  def: GateSwitchDef
  hitsLeft: number
  broken: boolean
  spr: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
}

export type Stage9GateHooks = {
  scene: Phaser.Scene
  hurt: (hero: Phaser.Physics.Arcade.Sprite, dir: number) => void
  heroes: () => Phaser.Physics.Arcade.Sprite[]
}

const GATE_W = 18
const GATE_H = LANE_FLOOR_Y - 24
const HIT_HALF = 22

export class Stage9Gates {
  private gates: GateRuntime[] = []
  private switches: SwitchRuntime[] = []
  private hooks: Stage9GateHooks
  private hitCd = new WeakMap<object, number>()

  constructor(hooks: Stage9GateHooks, gates: SlidingGateDef[], switches: GateSwitchDef[]) {
    this.hooks = hooks
    const sc = hooks.scene
    for (const sw of switches) {
      const spr = sc.add
        .rectangle(sw.x, LANE_FLOOR_Y - 26, 20, 36, 0xc04040, 1)
        .setStrokeStyle(2, 0xffd0a0)
        .setDepth(DEPTH.BREAKABLE)
        .setOrigin(0.5, 1)
      const label = sc.add
        .text(sw.x, LANE_FLOOR_Y - 70, '掣', {
          fontFamily: FONT_UI,
          fontSize: '11px',
          color: '#ffe0c0',
          stroke: '#201008',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.BREAKABLE + 1)
      this.switches.push({ def: sw, hitsLeft: sw.hits, broken: false, spr, label })
    }
    for (const g of gates) {
      const blade = sc.add
        .rectangle(g.x, LANE_FLOOR_Y - GATE_H, GATE_W, 8, 0x8a9aaa, 1)
        .setStrokeStyle(2, 0xd0e0f0)
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.HAZARD)
        .setVisible(false)
      const lamp = sc.add
        .circle(g.x, LANE_FLOOR_Y - GATE_H - 10, 5, 0xff4060, 0.9)
        .setDepth(DEPTH.HAZARD + 1)
        .setVisible(false)
      this.gates.push({
        def: g,
        t: ((g.phaseMs % g.periodMs) + g.periodMs) % g.periodMs,
        lockedOpen: false,
        blade,
        lamp,
      })
    }
  }

  destroy() {
    for (const g of this.gates) {
      g.blade.destroy()
      g.lamp.destroy()
    }
    for (const s of this.switches) {
      s.spr.destroy()
      s.label.destroy()
    }
    this.gates = []
    this.switches = []
  }

  /** Melee / gun near a switch. */
  tryHitSwitch(x: number, _dir: number): boolean {
    for (const s of this.switches) {
      if (s.broken) continue
      if (Math.abs(x - s.def.x) > 40) continue
      s.hitsLeft -= 1
      burst(this.hooks.scene, s.def.x, LANE_FLOOR_Y - 36, 0xffc080, 6)
      SFX.hit()
      s.spr.setFillStyle(0xe07050)
      if (s.hitsLeft <= 0) this.breakSwitch(s)
      return true
    }
    return false
  }

  private breakSwitch(s: SwitchRuntime) {
    s.broken = true
    s.spr.setFillStyle(0x405060)
    s.spr.setAlpha(0.5)
    s.label.setText('開')
    burst(this.hooks.scene, s.def.x, LANE_FLOOR_Y - 40, 0xffe08a, 12)
    SFX.slam()
    SFX.kill()
    for (const g of this.gates) {
      if (g.def.switch === s.def.id) {
        g.lockedOpen = true
        g.blade.setVisible(false)
        g.lamp.setVisible(false)
      }
    }
  }

  update(dt: number) {
    const now = this.hooks.scene.time.now
    for (const g of this.gates) {
      if (g.lockedOpen) {
        g.blade.setVisible(false)
        g.lamp.setVisible(false)
        continue
      }
      const cfg = g.def
      g.t = (g.t + dt) % cfg.periodMs
      const phase = g.t
      const warnEnd = cfg.warnMs
      const closedEnd = cfg.warnMs + cfg.closedMs
      if (phase < warnEnd) {
        // Flash warn lamp; blade still up (visible slit).
        const on = Math.floor(phase / 90) % 2 === 0
        g.lamp.setVisible(true).setFillStyle(on ? 0xff4060 : 0xffc040, on ? 1 : 0.45)
        g.blade
          .setVisible(true)
          .setPosition(cfg.x, LANE_FLOOR_Y - GATE_H)
          .setSize(GATE_W, 10)
          .setDisplaySize(GATE_W, 10)
          .setFillStyle(0xff8060, 0.55)
      } else if (phase < closedEnd) {
        // Gate down — full height hazard.
        const k = (phase - warnEnd) / Math.max(1, cfg.closedMs)
        const h = 10 + Math.min(1, k * 3) * (GATE_H - 10)
        g.lamp.setVisible(false)
        g.blade
          .setVisible(true)
          .setPosition(cfg.x, LANE_FLOOR_Y - h)
          .setSize(GATE_W, h)
          .setDisplaySize(GATE_W, h)
          .setFillStyle(0x6a7a8a, 1)
        for (const hero of this.hooks.heroes()) {
          if (!hero.active) continue
          if (Math.abs(hero.x - cfg.x) > HIT_HALF) continue
          // Only when standing in the blade column (not jumping clear above).
          if (hero.y < LANE_FLOOR_Y - h - 12) continue
          const until = this.hitCd.get(hero) ?? 0
          if (now < until) continue
          this.hitCd.set(hero, now + 500)
          // Knock back away from gate (toward the side the hero is on).
          const dir = hero.x >= cfg.x ? 1 : -1
          this.hooks.hurt(hero, dir)
        }
      } else {
        g.blade.setVisible(false)
        g.lamp.setVisible(false)
      }
    }
  }
}
