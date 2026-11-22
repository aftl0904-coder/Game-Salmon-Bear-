import Phaser from 'phaser'
import { SFX } from '../audio'
import type { Difficulty } from '../difficulty'

/**
 * Shared boss pacing cycle (T9 / PR-F):
 * GUARD → WARN → ATTACK → OPENING → BREATHER → GUARD
 *
 * Damage only lands in OPENING. Player contact damage only in ATTACK.
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
  private t = 0
  private scene: Phaser.Scene
  private host: Phaser.GameObjects.Sprite
  private getDifficulty: () => Difficulty
  private shield: Phaser.GameObjects.Graphics | null = null
  private pant: Phaser.GameObjects.Text | null = null
  private forcedBreather = false

  constructor(opts: BossRhythmOpts) {
    this.scene = opts.scene
    this.host = opts.host
    this.getDifficulty = opts.getDifficulty ?? (() => 'normal')
    this.enter('GUARD')
  }

  openingDuration() {
    return RHYTHM.openingMs[this.getDifficulty()] ?? RHYTHM.openingMs.normal
  }

  canTakeDamage() {
    return this.phase === 'OPENING'
  }

  canHurtPlayer() {
    return this.phase === 'ATTACK'
  }

  /** WARN/ATTACK duration multiplier for windups. */
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
    SFX.blip(980)
    this.flashShield()
  }

  forceBreather(ms = RHYTHM.phaseBreatherMs) {
    this.forcedBreather = true
    this.enter('BREATHER', ms)
    try {
      this.scene.cameras.main.shake(180, 0.004)
    } catch {
      /* ignore */
    }
  }

  /** Advance internal timer; returns true when phase just changed. */
  tick(dt: number): RhythmPhase {
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

  /** Call when WARN telegraph finishes without a separate ATTACK window needed. */
  skipToOpening() {
    this.enter('OPENING')
  }

  destroy() {
    this.shield?.destroy()
    this.pant?.destroy()
    this.shield = null
    this.pant = null
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
    const showShield = this.phase === 'GUARD' || this.phase === 'BREATHER'
    const showPant = this.phase === 'OPENING'
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
    } else if (this.shield) {
      this.shield.setVisible(false)
    }

    if (showPant) {
      if (!this.pant) {
        this.pant = this.scene.add
          .text(this.host.x, this.host.y - 70, '呼…', {
            fontFamily: 'sans-serif',
            fontSize: '12px',
            color: '#ffe8a0',
            stroke: '#201008',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth((this.host.depth || 0) + 3)
      }
      this.pant.setPosition(this.host.x, this.host.y - (this.host.displayHeight || 64) - 8)
      this.pant.setVisible(true)
      this.pant.setAlpha(0.7 + 0.3 * Math.sin(this.t / 120))
    } else if (this.pant) {
      this.pant.setVisible(false)
    }
  }
}

/** Round existing HP × 0.7 for rhythm fights. */
export function rhythmHp(base: number) {
  return Math.round(base * RHYTHM.hpMul)
}
