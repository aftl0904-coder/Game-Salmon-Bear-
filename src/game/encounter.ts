import Phaser from 'phaser'
import { floatText } from './fx'
import { GAME_W } from './display'
import { FONT_UI } from './ui/fonts'

export type EncounterWave = {
  side: 'L' | 'R'
  /** Original spawn X values from the level (species looked up from enemies[]). */
  from: number[]
}

export type EncounterDef = {
  x0: number
  x1: number
  waves: EncounterWave[]
}

export type EncounterEnemyDef = {
  x: number
  species: string
  elite?: boolean
  product?: boolean
}

type Phase =
  | 'idle'
  | 'locked'
  | 'wave'
  | 'waveClearWait'
  | 'warnNext'
  | 'soloExtra'
  | 'cleared'
  | 'done'

export type EncounterHooks = {
  scene: Phaser.Scene
  worldH: number
  floorY: () => number
  leadX: () => number
  heroes: () => Array<Phaser.Physics.Arcade.Sprite & { alive: boolean; x: number }>
  isSolo: () => boolean
  /** Spawn one enemy walking in from enterX; return the sprite. */
  spawn: (species: string, enterX: number, elite?: boolean, product?: boolean) => Phaser.Physics.Arcade.Sprite | null
  /** Alive encounter-tagged enemies. */
  liveTagged: () => Array<Phaser.Physics.Arcade.Sprite & { active: boolean; x: number; y: number; fsm?: string }>
  destroyTagged: () => void
  setCameraBounds: (x0: number, x1: number) => void
  clearCameraBounds: () => void
  onQuietStart?: () => void
  onQuietEnd?: () => void
}

const STUCK_MS = 8000
const WAVE_GAP_MS = 1000
const BANG_MS = 800
const SOLO_EXTRA_MS = 1000
const QUIET_MS = 600

/**
 * Generic camera-lock encounter (Encounter-1).
 * Enemies walk in from the indicated screen edge; total count comes from level data.
 */
export class EncounterController {
  private def: EncounterDef
  private roster: EncounterEnemyDef[]
  private hooks: EncounterHooks
  private phase: Phase = 'idle'
  private waveIdx = 0
  private timer = 0
  private bang?: Phaser.GameObjects.Text
  private stuckSince = new Map<object, number>()
  private entered = false

  constructor(def: EncounterDef, roster: EncounterEnemyDef[], hooks: EncounterHooks) {
    this.def = def
    this.roster = roster
    this.hooks = hooks
  }

  /** X values claimed by this encounter (skip normal s2Pending unlock). */
  claimedXs(): Set<number> {
    const s = new Set<number>()
    for (const w of this.def.waves) for (const x of w.from) s.add(x)
    return s
  }

  get active(): boolean {
    return this.phase !== 'idle' && this.phase !== 'done'
  }

  get finished(): boolean {
    return this.phase === 'done'
  }

  /** Call when heroes continue after death inside / during the encounter. */
  resetFromCheckpoint() {
    this.clearBang()
    this.hooks.destroyTagged()
    this.hooks.clearCameraBounds()
    this.hooks.onQuietEnd?.()
    this.phase = 'idle'
    this.waveIdx = 0
    this.timer = 0
    this.stuckSince.clear()
    this.entered = false
  }

  update(dt: number) {
    const lead = this.hooks.leadX()
    if (this.phase === 'done') return

    if (this.phase === 'idle') {
      if (lead >= this.def.x0 && lead <= this.def.x1) this.beginLock()
      return
    }

    // Keep heroes inside while locked (reuse boss clamp pattern).
    if (this.phase !== 'cleared') {
      for (const h of this.hooks.heroes()) {
        if (!h.alive) continue
        const x = Phaser.Math.Clamp(h.x, this.def.x0 + 14, this.def.x1 - 14)
        if (x !== h.x) {
          h.x = x
          const body = h.body as Phaser.Physics.Arcade.Body | null
          if (body) body.velocity.x = 0
        }
      }
    }

    if (this.phase === 'wave') {
      this.tickStuck(dt)
      if (this.waveCleared()) {
        this.waveIdx++
        if (this.waveIdx >= this.def.waves.length) {
          this.finishClear()
        } else {
          this.phase = 'waveClearWait'
          this.timer = WAVE_GAP_MS
        }
      }
      return
    }

    if (this.phase === 'waveClearWait') {
      this.timer -= dt
      if (this.timer <= 0) {
        this.phase = 'warnNext'
        this.timer = BANG_MS
        this.showBang()
      }
      return
    }

    if (this.phase === 'warnNext') {
      this.timer -= dt
      if (this.timer <= 0) {
        this.clearBang()
        if (this.hooks.isSolo()) {
          this.phase = 'soloExtra'
          this.timer = SOLO_EXTRA_MS
        } else {
          this.spawnWave(this.waveIdx)
          this.phase = 'wave'
        }
      }
      return
    }

    if (this.phase === 'soloExtra') {
      this.timer -= dt
      if (this.timer <= 0) {
        this.spawnWave(this.waveIdx)
        this.phase = 'wave'
      }
      return
    }

    if (this.phase === 'cleared') {
      this.timer -= dt
      if (this.timer <= 0) {
        this.hooks.onQuietEnd?.()
        this.phase = 'done'
      }
    }
  }

  private beginLock() {
    if (this.entered) return
    this.entered = true
    this.hooks.setCameraBounds(this.def.x0, this.def.x1)
    this.waveIdx = 0
    this.spawnWave(0)
    this.phase = 'wave'
  }

  private spawnWave(idx: number) {
    const wave = this.def.waves[idx]
    if (!wave) return
    const cam = this.hooks.scene.cameras.main
    const side = wave.side
    let stagger = 0
    for (const homeX of wave.from) {
      const def = this.roster.find((r) => r.x === homeX)
      if (!def) continue
      const enterX =
        side === 'R'
          ? Math.min(this.def.x1 - 8, cam.scrollX + (cam.displayWidth || GAME_W) + 40 + stagger * 36)
          : Math.max(this.def.x0 + 8, cam.scrollX - 40 - stagger * 36)
      stagger++
      const e = this.hooks.spawn(def.species, enterX, def.elite, def.product)
      if (e) {
        e.setData('encounter', true)
        e.setData('encounterHomeX', homeX)
        e.setFlipX(side === 'R')
        this.stuckSince.set(e, 0)
      }
    }
  }

  private waveCleared(): boolean {
    return this.hooks.liveTagged().length === 0
  }

  private tickStuck(dt: number) {
    const live = this.hooks.liveTagged()
    const floor = this.hooks.floorY()
    for (const e of live) {
      const out =
        e.y > floor + 80 ||
        e.x < this.def.x0 - 120 ||
        e.x > this.def.x1 + 120 ||
        !e.active ||
        e.fsm === 'DEAD'
      const prev = this.stuckSince.get(e) ?? 0
      if (out) {
        const next = prev + dt
        this.stuckSince.set(e, next)
        if (next >= STUCK_MS) {
          // Auto-clear stuck / fallen-out enemy.
          e.setData('encounter', false)
          try {
            ;(e as Phaser.Physics.Arcade.Sprite).disableBody?.(true, true)
            e.destroy?.()
          } catch {
            /* already gone */
          }
          this.stuckSince.delete(e)
        }
      } else {
        this.stuckSince.set(e, 0)
      }
    }
  }

  private showBang() {
    this.clearBang()
    const wave = this.def.waves[this.waveIdx]
    if (!wave) return
    const cam = this.hooks.scene.cameras.main
    const x =
      wave.side === 'R'
        ? cam.scrollX + (cam.displayWidth || GAME_W) - 36
        : cam.scrollX + 36
    const y = this.hooks.floorY() - 100
    this.bang = this.hooks.scene.add
      .text(x, y, '！', {
        fontFamily: FONT_UI,
        fontSize: '28px',
        color: '#ff3030',
        stroke: '#fff0a0',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(6000)
    this.hooks.scene.tweens.add({
      targets: this.bang,
      alpha: { from: 1, to: 0.35 },
      y: y - 12,
      duration: BANG_MS,
      yoyo: true,
      repeat: 0,
    })
  }

  private clearBang() {
    this.bang?.destroy()
    this.bang = undefined
  }

  private finishClear() {
    this.clearBang()
    this.hooks.destroyTagged()
    this.hooks.clearCameraBounds()
    const cam = this.hooks.scene.cameras.main
    floatText(this.hooks.scene, cam.scrollX + GAME_W / 2, this.hooks.floorY() - 120, '呼…', '#ffe08a', {
      size: 22,
      dur: 1400,
    })
    this.hooks.onQuietStart?.()
    this.phase = 'cleared'
    this.timer = QUIET_MS
  }
}

/** Collect enemy defs whose x appears in encounter wave.from lists. */
export function rosterForEncounter(
  enemies: EncounterEnemyDef[],
  def: EncounterDef,
): EncounterEnemyDef[] {
  const claim = new Set<number>()
  for (const w of def.waves) for (const x of w.from) claim.add(x)
  return enemies.filter((e) => claim.has(e.x))
}
