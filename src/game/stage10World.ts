/**
 * s10-1 — Stage 10 skeleton systems:
 *  - floodZones: cyclic flood; while high, heroes move at `slow` (no HP damage)
 *  - elevatorArena: camera-lock two-wave fight (species list per side)
 */
import Phaser from 'phaser'
import { LANE_FLOOR_Y } from './engine/lanes'
import { DEPTH } from './engine/depth'
import { floatText } from './fx'
import { GAME_W } from './display'
import { FONT_UI } from './ui/fonts'
import { setBgmDucked } from './audio'

export type FloodZoneDef = {
  x0: number
  x1: number
  periodMs: number
  phaseMs: number
  warnMs: number
  highMs: number
  slow: number
  dmg: number
}

export type ElevatorWave = { side: 'L' | 'R'; from: string[] }

export type ElevatorArenaDef = {
  x0: number
  x1: number
  waves: ElevatorWave[]
}

type FloodRuntime = {
  def: FloodZoneDef
  t: number
  water: Phaser.GameObjects.Rectangle
  warn: Phaser.GameObjects.Rectangle
}

type ElevPhase = 'idle' | 'wave' | 'gap' | 'warn' | 'cleared' | 'done'

export type Stage10Hooks = {
  scene: Phaser.Scene
  leadX: () => number
  heroes: () => Array<Phaser.Physics.Arcade.Sprite & { alive: boolean; x: number; y: number }>
  spawn: (species: string, enterX: number) => Phaser.Physics.Arcade.Sprite | null
  liveTagged: () => Array<Phaser.Physics.Arcade.Sprite & { active: boolean; fsm?: string }>
  destroyTagged: () => void
  setCameraBounds: (x0: number, x1: number) => void
  clearCameraBounds: () => void
}

const WAVE_GAP_MS = 1000
const BANG_MS = 800
const QUIET_MS = 600

export class Stage10World {
  private floods: FloodRuntime[] = []
  private elev: ElevatorArenaDef | null = null
  private elevPhase: ElevPhase = 'idle'
  private elevWave = 0
  private elevTimer = 0
  private elevEntered = false
  private bang: Phaser.GameObjects.Text | null = null
  private hooks: Stage10Hooks

  constructor(hooks: Stage10Hooks, floods: FloodZoneDef[], elev: ElevatorArenaDef | null) {
    this.hooks = hooks
    const sc = hooks.scene
    for (const def of floods) {
      const water = sc.add
        .rectangle((def.x0 + def.x1) / 2, LANE_FLOOR_Y, def.x1 - def.x0, 8, 0x4a90c8, 0.55)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.HAZARD)
        .setVisible(false)
      const warn = sc.add
        .rectangle((def.x0 + def.x1) / 2, LANE_FLOOR_Y - 4, def.x1 - def.x0, 6, 0x80c8ff, 0.35)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.HAZARD - 1)
        .setVisible(false)
      this.floods.push({
        def,
        t: ((def.phaseMs % def.periodMs) + def.periodMs) % def.periodMs,
        water,
        warn,
      })
    }
    this.elev = elev
  }

  /**
   * @param opts.skipTagged — when restarting `play`, the enemies group may already
   *   be destroyed; skip iterating it (shutdown path clears tagged while groups live).
   */
  destroy(opts?: { skipTagged?: boolean }) {
    for (const f of this.floods) {
      try {
        f.water.destroy()
      } catch {
        /* already gone */
      }
      try {
        f.warn.destroy()
      } catch {
        /* already gone */
      }
    }
    this.floods = []
    this.clearBang()
    if (!opts?.skipTagged) {
      try {
        this.hooks.destroyTagged()
      } catch {
        /* enemies group already torn down */
      }
    }
    try {
      this.hooks.clearCameraBounds()
    } catch {
      /* camera gone */
    }
    setBgmDucked(false)
  }

  /** Movement multiplier while standing in a high flood (dmg ignored — ticket). */
  speedMul(x: number): number {
    for (const f of this.floods) {
      if (x < f.def.x0 || x > f.def.x1) continue
      const phase = f.t
      const warnEnd = f.def.warnMs
      const highEnd = f.def.warnMs + f.def.highMs
      if (phase >= warnEnd && phase < highEnd) return f.def.slow
    }
    return 1
  }

  update(dt: number) {
    this.tickFloods(dt)
    this.tickElevator(dt)
  }

  private tickFloods(dt: number) {
    for (const f of this.floods) {
      const cfg = f.def
      f.t = (f.t + dt) % cfg.periodMs
      const phase = f.t
      const warnEnd = cfg.warnMs
      const highEnd = cfg.warnMs + cfg.highMs
      if (phase < warnEnd) {
        const k = phase / warnEnd
        f.warn.setVisible(true).setAlpha(0.25 + 0.35 * Math.sin(phase / 80))
        f.warn.setDisplaySize(cfg.x1 - cfg.x0, 4 + k * 10)
        f.water.setVisible(false)
      } else if (phase < highEnd) {
        const k = (phase - warnEnd) / cfg.highMs
        const h = 18 + Math.min(1, k * 1.4) * 52
        f.warn.setVisible(false)
        f.water.setVisible(true).setDisplaySize(cfg.x1 - cfg.x0, h).setAlpha(0.45 + 0.2 * Math.sin(phase / 120))
        // Explicitly never hurt — even if data.dmg drifts.
      } else {
        f.warn.setVisible(false)
        f.water.setVisible(false)
      }
    }
  }

  private tickElevator(dt: number) {
    if (!this.elev) return
    const lead = this.hooks.leadX()
    const def = this.elev

    if (this.elevPhase === 'done') return

    if (this.elevPhase === 'idle') {
      if (lead >= def.x0 && lead <= def.x1) this.beginElev()
      return
    }

    if (this.elevPhase !== 'cleared') {
      for (const h of this.hooks.heroes()) {
        if (!h.alive) continue
        const x = Phaser.Math.Clamp(h.x, def.x0 + 14, def.x1 - 14)
        if (x !== h.x) {
          h.x = x
          const body = h.body as Phaser.Physics.Arcade.Body | null
          if (body) body.velocity.x = 0
        }
      }
    }

    if (this.elevPhase === 'wave') {
      if (this.waveCleared()) {
        this.elevWave++
        if (this.elevWave >= def.waves.length) {
          this.finishElev()
        } else {
          this.elevPhase = 'gap'
          this.elevTimer = WAVE_GAP_MS
        }
      }
      return
    }

    if (this.elevPhase === 'gap') {
      this.elevTimer -= dt
      if (this.elevTimer <= 0) {
        this.elevPhase = 'warn'
        this.elevTimer = BANG_MS
        this.showBang()
      }
      return
    }

    if (this.elevPhase === 'warn') {
      this.elevTimer -= dt
      if (this.elevTimer <= 0) {
        this.clearBang()
        this.spawnWave(this.elevWave)
        this.elevPhase = 'wave'
      }
      return
    }

    if (this.elevPhase === 'cleared') {
      this.elevTimer -= dt
      if (this.elevTimer <= 0) {
        setBgmDucked(false)
        this.elevPhase = 'done'
      }
    }
  }

  private beginElev() {
    if (this.elevEntered || !this.elev) return
    this.elevEntered = true
    this.hooks.setCameraBounds(this.elev.x0, this.elev.x1)
    setBgmDucked(true)
    this.elevWave = 0
    this.spawnWave(0)
    this.elevPhase = 'wave'
    floatText(this.hooks.scene, (this.elev.x0 + this.elev.x1) / 2, LANE_FLOOR_Y - 100, '升降機！', '#c8e8ff', {
      size: 14,
      dur: 900,
    })
  }

  private spawnWave(idx: number) {
    if (!this.elev) return
    const wave = this.elev.waves[idx]
    if (!wave) return
    const cam = this.hooks.scene.cameras.main
    let stagger = 0
    for (const species of wave.from) {
      const enterX =
        wave.side === 'R'
          ? Math.min(this.elev.x1 - 8, cam.scrollX + (cam.displayWidth || GAME_W) + 40 + stagger * 36)
          : Math.max(this.elev.x0 + 8, cam.scrollX - 40 - stagger * 36)
      stagger++
      const e = this.hooks.spawn(species, enterX)
      if (e) {
        e.setData('encounter', true)
        e.setData('s10elev', true)
        e.setFlipX(wave.side === 'R')
      }
    }
  }

  private waveCleared() {
    return this.hooks.liveTagged().length === 0
  }

  private finishElev() {
    this.hooks.clearCameraBounds()
    this.elevPhase = 'cleared'
    this.elevTimer = QUIET_MS
    floatText(this.hooks.scene, this.hooks.leadX(), LANE_FLOOR_Y - 90, '門開咗', '#ffe08a', { size: 12, dur: 800 })
  }

  private showBang() {
    this.clearBang()
    const mid = this.elev ? (this.elev.x0 + this.elev.x1) / 2 : 0
    this.bang = this.hooks.scene.add
      .text(mid, LANE_FLOOR_Y - 120, '！', {
        fontFamily: FONT_UI,
        fontSize: '28px',
        color: '#ffe080',
        stroke: '#201808',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI)
      .setScrollFactor(1)
  }

  private clearBang() {
    this.bang?.destroy()
    this.bang = null
  }

  /** For continue/retry mid-elevator. */
  resetFromCheckpoint() {
    this.clearBang()
    this.hooks.destroyTagged()
    this.hooks.clearCameraBounds()
    setBgmDucked(false)
    this.elevPhase = 'idle'
    this.elevWave = 0
    this.elevTimer = 0
    this.elevEntered = false
  }
}
