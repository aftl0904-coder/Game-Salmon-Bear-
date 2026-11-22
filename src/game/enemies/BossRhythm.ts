import Phaser from 'phaser'
import { SFX } from '../audio'
import type { Difficulty } from '../difficulty'

/**
 * Shared boss pacing cycle (T9 / PR-F):
 * GUARD → WARN → ATTACK → OPENING → BREATHER → GUARD
 *
 * Damage only lands in OPENING. Player contact damage only in ATTACK.
 * Wire onto each boss separately — do not copy this state machine.
 */
export type RhythmPhase = 'GUARD' | 'WARN' | 'ATTACK' | 'OPENING' | 'BREATHER'

export const RHYTHM = {
  guardMs: 1500,
  warnMul: 1.3,
  attackSpeedMul: 0.8,
  openingMs: { easy: 3000, normal: 2500, hard: 2000, hell: 2000 } as Record<Difficulty, number>,
  breatherMs: 2000,
  phaseBreatherMs: 2500,
  hpMul: 0.7,
} as const

export type BossRhythmOpts = {
  scene: Phaser.Scene
  /** Boss sprite used as shield/FX anchor. */
  host: Phaser.GameObjects.Sprite
  getDifficulty?: () => Difficulty
}

export class BossRhythm {
  phase: RhythmPhase = 'GUARD'
  /** Set when a non-OPENING hit was dinged (GameScene can show 叮！). */
  lastBlockAt = 0
  private t = 0
  private scene: Phaser.Scene
  private host: Phaser.GameObjects.Sprite
  private getDifficulty: () => Difficulty
  private shield: Phaser.GameObjects.Graphics | null = null
  private pant: Phaser.GameObjects.Container | null = null
  private pantLabel: Phaser.GameObjects.Text | null = null
  private sweat: Phaser.GameObjects.Graphics | null = null
  private forcedBreather = false
  private armed = false

  constructor(opts: BossRhythmOpts) {
    this.scene = opts.scene
    this.host = opts.host
    this.getDifficulty = opts.getDifficulty ?? (() => 'normal')
  }

  /** Call after boss intro so GUARD does not eat the reveal. */
  arm() {
    if (this.armed) return
    this.armed = true
    this.enter('GUARD')
  }

  get isArmed() {
    return this.armed
  }

  openingDuration() {
    return RHYTHM.openingMs[this.getDifficulty()] ?? RHYTHM.openingMs.normal
  }

  canTakeDamage() {
    return this.armed && this.phase === 'OPENING'
  }

  canHurtPlayer() {
    return this.armed && this.phase === 'ATTACK'
  }

  warnMul() {
    return this.phase === 'WARN' ? RHYTHM.warnMul : 1
  }

  attackSpeedMul() {
    return this.phase === 'ATTACK' || this.phase === 'WARN' ? RHYTHM.attackSpeedMul : 1
  }

  isGuarding() {
    return this.phase === 'GUARD' || this.phase === 'BREATHER'
  }

  /** Hit during non-OPENING: ding + 0 damage. */
  blockHit() {
    this.lastBlockAt = this.scene?.time?.now || Date.now()
    try {
      SFX.blip(980)
    } catch {
      /* audio may be unavailable in headless */
    }
    this.flashShield()
  }

  forceBreather(ms = RHYTHM.phaseBreatherMs) {
    if (!this.armed) this.armed = true
    this.forcedBreather = true
    this.enter('BREATHER', ms)
    try {
      this.scene.cameras.main.shake(180, 0.004)
    } catch {
      /* ignore */
    }
  }

  /** Advance internal timer; returns current phase. */
  tick(dt: number): RhythmPhase {
    if (!this.armed) return this.phase
    this.t += dt
    this.layoutFx()
    if (this.phase === 'GUARD' && this.t >= RHYTHM.guardMs) {
      this.enter('WARN')
    } else if (this.phase === 'OPENING' && this.t >= this.openingDuration()) {
      this.enter('BREATHER', RHYTHM.breatherMs)
    } else if (this.phase === 'BREATHER') {
      const need = this.forcedBreather ? RHYTHM.phaseBreatherMs : RHYTHM.breatherMs
      if (this.t >= need) {
        this.forcedBreather = false
        this.enter('GUARD')
      }
    }
    // WARN → ATTACK and ATTACK → OPENING are driven by the boss when its move ends.
    return this.phase
  }

  beginAttack() {
    if (this.phase === 'WARN' || this.phase === 'GUARD') this.enter('ATTACK')
  }

  beginOpening() {
    if (this.phase === 'ATTACK' || this.phase === 'WARN') this.enter('OPENING')
  }

  skipToOpening() {
    this.enter('OPENING')
  }

  /** Test / debug helpers: jump to a phase and refresh FX. */
  setPhase(p: RhythmPhase) {
    if (!this.armed) this.armed = true
    this.enter(p)
  }

  destroy() {
    this.shield?.destroy()
    this.pant?.destroy()
    this.shield = null
    this.pant = null
    this.pantLabel = null
    this.sweat = null
  }

  private enter(p: RhythmPhase, _overrideMs?: number) {
    this.phase = p
    this.t = 0
    this.layoutFx()
  }

  private flashShield() {
    if (!this.shield) return
    this.scene.tweens.add({
      targets: this.shield,
      alpha: { from: 1, to: 0.35 },
      duration: 80,
      yoyo: true,
    })
  }

  private layoutFx() {
    const showShield = this.armed && (this.phase === 'GUARD' || this.phase === 'BREATHER')
    const showPant = this.armed && this.phase === 'OPENING'
    if (showShield) {
      if (!this.shield) {
        this.shield = this.scene.add.graphics().setDepth((this.host.depth || 0) + 2)
      }
      this.shield.clear()
      this.shield.lineStyle(2, 0xa8e8ff, 0.95)
      this.shield.fillStyle(0x80d0ff, 0.22)
      const r = Math.max(28, (this.host.displayHeight || 64) * 0.55)
      this.shield.fillCircle(this.host.x, this.host.y - r * 0.55, r)
      this.shield.strokeCircle(this.host.x, this.host.y - r * 0.55, r)
      this.shield.setVisible(true)
      this.shield.setDepth((this.host.depth || 0) + 2)
    } else if (this.shield) {
      this.shield.setVisible(false)
    }

    if (showPant) {
      if (!this.pant) {
        this.sweat = this.scene.add.graphics()
        this.pantLabel = this.scene.add
          .text(0, -18, '呼…', {
            fontFamily: 'sans-serif',
            fontSize: '12px',
            color: '#ffe8a0',
            stroke: '#201008',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
        this.pant = this.scene.add
          .container(this.host.x, this.host.y)
          .setDepth((this.host.depth || 0) + 3)
        this.pant.add([this.sweat, this.pantLabel])
      }
      const headY = this.host.y - (this.host.displayHeight || 64) - 4
      this.pant.setPosition(this.host.x, headY)
      this.pant.setVisible(true)
      this.pant.setDepth((this.host.depth || 0) + 3)
      this.pantLabel?.setAlpha(0.65 + 0.35 * Math.sin(this.t / 140))
      // Sweat / puff dots rising
      this.sweat?.clear()
      for (let i = 0; i < 4; i++) {
        const wobble = Math.sin(this.t / 160 + i * 1.7)
        const rise = ((this.t / 18 + i * 11) % 28) - 4
        const x = -10 + i * 7 + wobble * 3
        const y = -rise
        this.sweat!.fillStyle(0xe8f4ff, 0.55 + 0.25 * Math.sin(this.t / 100 + i))
        this.sweat!.fillCircle(x, y, 2.2)
        this.sweat!.fillStyle(0xc0c8d0, 0.25)
        this.sweat!.fillCircle(x + 6, y - 6, 3.5)
      }
    } else if (this.pant) {
      this.pant.setVisible(false)
    }
  }
}

/** Round existing HP × 0.7 for rhythm fights (starting point before per-boss tuning). */
export function rhythmHp(base: number) {
  return Math.max(1, Math.round(base * RHYTHM.hpMul))
}
