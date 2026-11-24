import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { bossHitDamage } from '../engine/bossDamage'
import { BossRhythm, RHYTHM } from './BossRhythm'
import { getDifficulty } from '../difficulty'

/**
 * 武者王 — stage 1 mini-boss. PR-F mid: wrapped in BossRhythm (GUARD/WARN/ATTACK/OPENING/BREATHER).
 * Original moves kept; HP tuned for ~3–4 OPENINGs per HP segment (player damage unchanged).
 *
 *  P1  barrel throws (low/high).
 *  P2  throws + telegraphed dash; summons two altar guards (not during OPENING).
 *  P3  fan throw alternating with dash; summons last two guards.
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

export type KingHooks = {
  floorY: () => number
  /** `y` is the absolute spawn height; `high` only picks the telegraph colour. */
  throwBarrel: (x: number, y: number, dir: 1 | -1, vx: number, vy: number, high: boolean) => void
  /** Wake the n-th altar guard from the level's altarAmbush roster. */
  summon: (slot: number) => void
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

export const KING_SCALE = 1.5
export const KING_HP = 50
/**
 * Balance-1: 54 HP (~90–120s clear target). Telegraph lengthened; DASH_SPEED unchanged.
 */
export const KING_HP_RHYTHM = 54
export const THROW_RELEASE_MS = 1000
export const THROW_TOTAL_MS = 1100
export const WINDUP_MS = 1000
export const DASH_SPEED = 340
export const DASH_MAX_MS = 650
const INTRO_MS = 1200

type Act = 'intro' | 'stalk' | 'throw' | 'fan' | 'windup' | 'dash' | 'recover' | 'exposed'

const KING_ANIM: Record<Act, string> = {
  intro: 'walk',
  stalk: 'walk',
  throw: 'throw-low',
  fan: 'throw-high',
  windup: 'throw-high',
  dash: 'walk',
  recover: 'hit',
  exposed: 'hit',
}

export class WarriorKing extends AnimEnemy {
  qphase: 1 | 2 | 3 = 1
  act: Act = 'intro'
  arenaX0: number
  arenaX1: number
  onDefeated?: () => void
  /** PR-F rhythm helper — other bosses not wired yet (pending Alan). */
  rhythm: BossRhythm
  private t = 0
  private throwN = 0
  private throwsSinceDash = 0
  private p3Step = 0
  private released = false
  private dashDir: 1 | -1 = -1
  private lastHitAt = 0
  private kh: KingHooks
  private summoned = { p2: false, p3: false }
  private moveQueued: 'throw' | 'fan' | 'windup' | null = null
  private weakAnnounced = false

  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, kh: KingHooks) {
    super(scene, x, kh.floorY(), 'hatsoldier', { floorY: kh.floorY }, 'walk')
    this.species = 'warriorking'
    this.kind = 'boss'
    this.boss = true
    this.kh = kh
    this.hp = this.maxHp = KING_HP_RHYTHM
    this.hurtMs = 160
    this.baseScale = KING_SCALE
    this.setScale(KING_SCALE)
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.bodyBox(40, 58)
    this.rhythm = new BossRhythm({
      scene,
      host: this,
      getDifficulty: () => getDifficulty(),
    })
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (!this.rhythm.canHurtPlayer()) return false
    if (this.act === 'intro' || this.act === 'recover' || this.act === 'exposed' || this.act === 'windup') return false
    return this.contactCd <= 0
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (!this.active || this.fsm === 'DEAD') return { killed: false, hp: this.hp }
    if (!this.rhythm.canTakeDamage()) {
      this.rhythm.blockHit()
      return { killed: false, hp: this.hp }
    }
    const now = this.scene?.time?.now || performance.now()
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    // OPENING uses existing weak window (weakBase 3); back/front both open here.
    const hitDmg = bossHitDamage(dmg, { weak: true, weakBase: 3, capNormal: 2, capWeak: 5 })
    const before = { x: this.x, y: this.y }
    let r: EnemyHitResult
    if (!this.body) {
      // Headless / broken-body fallback: still apply HP for rhythm QA.
      this.hp -= hitDmg
      r = this.hp <= 0 ? { killed: true, hp: 0 } : { killed: false, hp: this.hp }
      if (r.killed) this.die(dir)
    } else {
      r = super.receiveHit(hitDmg, dir)
      this.setPosition(before.x, before.y)
      this.setVelocity(0, 0)
      if (this.fsm === 'HURT') this.setFsm('ATTACK')
    }
    if (!r.killed) this.updatePhase()
    return r
  }

  private updatePhase() {
    const f = this.hp / this.maxHp
    const next: 1 | 2 | 3 = f <= 0.34 ? 3 : f <= 0.67 ? 2 : 1
    if (next <= this.qphase) return
    this.qphase = next
    this.kh.bossEvent(next === 2 ? 'phase2' : 'phase3')
    // Leave OPENING before summons (no new minions during OPENING).
    this.rhythm.forceBreather(RHYTHM.phaseBreatherMs)
    this.weakAnnounced = false
    if (next === 2 && !this.summoned.p2) {
      this.summoned.p2 = true
      this.kh.summon(0)
      this.kh.summon(1)
    }
    if (next === 3 && !this.summoned.p3) {
      this.summoned.p3 = true
      this.kh.summon(2)
      this.kh.summon(3)
    }
    this.throwsSinceDash = 0
    this.p3Step = 0
    this.moveQueued = null
    this.setAct('stalk')
  }

  private setAct(a: Act) {
    if (this.act === a && a !== 'throw') {
      // Keep anim; only reset timer/velocity when entering a new act.
      return
    }
    this.act = a
    this.t = 0
    this.released = false
    this.clearTint()
    if (this.body) this.setVelocity(0, 0)
    if (a === 'throw') this.anim(this.throwN % 2 === 0 ? 'throw-low' : 'throw-high')
    else this.anim(KING_ANIM[a])
  }

  /** Force act change even if same (throw low/high flip, windup restart). */
  private go(a: Act) {
    this.act = a
    this.t = 0
    this.released = false
    this.clearTint()
    if (this.body) this.setVelocity(0, 0)
    if (a === 'throw') this.anim(this.throwN % 2 === 0 ? 'throw-low' : 'throw-high')
    else this.anim(KING_ANIM[a])
  }

  protected override die(_dir: number) {
    this.hp = 0
    this.act = 'intro'
    this.boss = false
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.clearTint()
    this.anim('die')
    this.rhythm.destroy()
    this.kh.bossEvent('defeat')
    this.scene.time.delayedCall(1600, () => {
      this.onDefeated?.()
      if (!this.scene) return
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }

  private release(shots: Array<{ vy: number; high: boolean }>, vx: number, dir: 1 | -1) {
    const floor = this.kh.floorY()
    const spd = RHYTHM.attackSpeedMul
    for (const s of shots) {
      this.kh.throwBarrel(this.x + dir * 30, floor - (s.high ? 24 : 9), dir, vx * spd, s.vy * spd, s.high)
    }
  }

  private pickNextMove(): 'throw' | 'fan' | 'windup' {
    if (this.qphase === 1) return 'throw'
    if (this.qphase === 2) return this.throwsSinceDash >= 3 ? 'windup' : 'throw'
    if (this.p3Step === 0) {
      this.p3Step = 1
      return 'fan'
    }
    this.p3Step = 0
    return 'windup'
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.y = this.kh.floorY()
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    const toward = (Math.sign(dx) || -1) as 1 | -1
    const x0 = this.arenaX0 + 24
    const x1 = this.arenaX1 - 24

    // Intro before rhythm arms
    if (!this.rhythm.isArmed) {
      this.t += dt
      this.setFlipX(dx < 0)
      this.anim('walk')
      if (this.t > INTRO_MS) {
        this.go('stalk')
        this.rhythm.arm()
      }
      this.x = Phaser.Math.Clamp(this.x, x0, x1)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      return
    }

    this.rhythm.tick(dt)
    const phase = this.rhythm.phase

    if (phase === 'GUARD') {
      this.setAct('stalk')
      this.setFlipX(dx < 0)
      this.setVelocityX(0)
      this.weakAnnounced = false
      this.x = Phaser.Math.Clamp(this.x, x0, x1)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      return
    }

    if (phase === 'BREATHER') {
      this.setAct('stalk')
      const far = Math.abs(tgt.x - x0) >= Math.abs(tgt.x - x1) ? x0 : x1
      const dir = (Math.sign(far - this.x) || -1) as 1 | -1
      this.setFlipX(dir < 0)
      this.setVelocityX(dir * 70)
      this.weakAnnounced = false
      this.x = Phaser.Math.Clamp(this.x, x0, x1)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      return
    }

    if (phase === 'OPENING') {
      if (this.act !== 'exposed') {
        this.go('exposed')
        if (!this.weakAnnounced) {
          this.weakAnnounced = true
          this.kh.bossEvent('weak')
        }
      }
      this.setTint(0xffe060)
      this.setVelocityX(0)
      this.x = Phaser.Math.Clamp(this.x, x0, x1)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      return
    }

    if (phase === 'WARN') {
      this.t += dt
      if (!this.moveQueued) {
        this.moveQueued = this.pickNextMove()
        this.go(this.moveQueued === 'windup' ? 'windup' : this.moveQueued === 'fan' ? 'fan' : 'throw')
      }
      this.setFlipX(dx < 0)
      if (this.moveQueued === 'windup') {
        this.setTint(0xff9060)
        if (this.t >= WINDUP_MS * RHYTHM.warnMul) {
          this.rhythm.beginAttack()
          this.dashDir = toward
          this.go('dash')
          this.setFsm('ATTACK')
          this.hitThis = false
          this.t = 0
        }
      } else if (this.t >= THROW_RELEASE_MS * RHYTHM.warnMul) {
        this.rhythm.beginAttack()
        this.t = 0
        this.released = false
      }
      this.x = Phaser.Math.Clamp(this.x, x0, x1)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      return
    }

    if (phase === 'ATTACK') {
      this.t += dt
      const move = this.moveQueued
      if (move === 'throw' || (move === null && this.act === 'throw')) {
        this.setFlipX(dx < 0)
        if (!this.released && this.t >= THROW_RELEASE_MS / RHYTHM.attackSpeedMul) {
          this.released = true
          const high = this.throwN % 2 === 1
          this.throwN++
          this.release([{ vy: 0, high }], this.qphase === 1 ? 170 : 190, toward)
        }
        if (this.t >= THROW_TOTAL_MS / RHYTHM.attackSpeedMul) {
          this.throwsSinceDash++
          this.moveQueued = null
          this.rhythm.beginOpening()
        }
      } else if (move === 'fan' || this.act === 'fan') {
        this.setFlipX(dx < 0)
        if (!this.released && this.t >= THROW_RELEASE_MS / RHYTHM.attackSpeedMul) {
          this.released = true
          this.release(
            [
              { vy: -55, high: true },
              { vy: 0, high: true },
              { vy: 25, high: false },
            ],
            190,
            toward,
          )
        }
        if (this.t >= (THROW_TOTAL_MS + 100) / RHYTHM.attackSpeedMul) {
          this.moveQueued = null
          this.rhythm.beginOpening()
        }
      } else {
        this.setFlipX(this.dashDir < 0)
        this.x = Phaser.Math.Clamp(
          this.x + this.dashDir * DASH_SPEED * RHYTHM.attackSpeedMul * (dt / 1000),
          x0,
          x1,
        )
        const wall = this.x <= x0 || this.x >= x1
        if (wall || this.t >= DASH_MAX_MS / RHYTHM.attackSpeedMul) {
          this.throwsSinceDash = 0
          this.moveQueued = null
          this.rhythm.beginOpening()
        }
      }
      this.x = Phaser.Math.Clamp(this.x, x0, x1)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      return
    }

    this.x = Phaser.Math.Clamp(this.x, x0, x1)
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }

  destroy(...args: Parameters<AnimEnemy['destroy']>) {
    this.rhythm?.destroy()
    return super.destroy(...args)
  }
}
