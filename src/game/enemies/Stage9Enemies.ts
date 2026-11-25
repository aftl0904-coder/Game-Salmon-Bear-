/**
 * Stage 9 · 地底監禁層 enemies (s9-2).
 * Numbers locked to the s9-2 ticket — do not retune here.
 * Art: tinted stand-ins until Manus stage9 sheets land.
 *
 *  1. JailGuard  獄卒兵       — close 140 → raise baton 1000ms → swipe 60px → rest 900ms
 *  2. LockBot    鎖匠機械人   — close 200 → warn 1000ms → linear chain 200px; hit → half speed 1000ms; every 3000ms
 */
import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { isActorFrozen, floatText } from '../fx'
import { SFX } from '../audio'

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

const TINT = {
  guard: 0x90b878,
  lockbot: 0xd08060,
} as const

// ── ticket numbers ─────────────────────────────────────────────────────
const GUARD_HP = 6
const GUARD_ENGAGE = 140
const GUARD_WARN_MS = 1000
const GUARD_SWIPE_PX = 60
const GUARD_SWIPE_MS = 280
const GUARD_REST_MS = 900
const GUARD_WALK = 42

const LOCK_HP = 15
const LOCK_ENGAGE = 200
const LOCK_WARN_MS = 1000
const LOCK_RANGE = 200
const LOCK_INTERVAL_MS = 3000
const LOCK_WALK = 28
const LOCK_CHAIN_SPEED = 320
const LOCK_SLOW_MS = 1000

export type LockBotHooks = {
  floorY: () => number
  /** Linear chain shot; on hero hit → half move for LOCK_SLOW_MS (no HP retune here). */
  throwChain: (fromX: number, fromY: number, dir: 1 | -1) => void
}

// ── 獄卒兵 ─────────────────────────────────────────────────────────────

/** Walk in → stop at 140px → raise baton 1000ms → forward swipe 60px → rest 900ms. */
export class JailGuard extends AnimEnemy {
  private phase: 'walk' | 'warn' | 'swipe' | 'rest' = 'walk'
  private t = 0
  private baton: Phaser.GameObjects.Rectangle
  private warnMark: Phaser.GameObjects.Text | null = null
  private swipeDir: 1 | -1 = 1
  private swipeOriginX = 0

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's9guard'
    this.hp = this.maxHp = GUARD_HP
    this.hurtMs = 200
    this.bodyBox(28, 44)
    this.setTint(TINT.guard)
    this.baton = scene.add
      .rectangle(x, this.y - 36, 6, 22, 0x4a3020, 1)
      .setStrokeStyle(1, 0xc8a060)
      .setDepth(this.depth + 3)
      .setOrigin(0.5, 1)
  }

  protected override defaultTint() {
    return TINT.guard
  }

  canHurtPlayer() {
    return this.active && this.phase === 'swipe' && !this.hitThis && this.fsm !== 'DEAD'
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.baton.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.syncBaton(false)
      return
    }
    this.setPosition(this.x, this.s2.floorY())
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.syncBaton(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.t += dt

    if (this.phase === 'walk') {
      this.anim(Math.abs(dx) < GUARD_ENGAGE ? 'reach' : 'walk')
      this.face(dx)
      this.syncBaton(false)
      if (Math.abs(dx) <= GUARD_ENGAGE) {
        this.setVelocity(0, 0)
        if (this.canEngageFromScreen()) {
          this.phase = 'warn'
          this.t = 0
          this.swipeDir = dx >= 0 ? 1 : -1
          this.showWarn()
        }
      } else {
        this.setVelocityX(Math.sign(dx) * GUARD_WALK)
      }
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.anim('reach')
      this.face(this.swipeDir)
      const blink = Math.floor(now / 100) % 2 === 0
      this.setTint(blink ? 0xffe080 : TINT.guard)
      this.syncBaton(true)
      this.warnMark?.setPosition(this.x, this.y - 58)
      if (this.t >= GUARD_WARN_MS) {
        this.setTint(TINT.guard)
        this.clearWarn()
        this.phase = 'swipe'
        this.t = 0
        this.hitThis = false
        this.swipeOriginX = this.x
        this.anim('attack')
        SFX.swing?.()
      }
    } else if (this.phase === 'swipe') {
      this.setTint(TINT.guard)
      // Lunge forward up to 60px during the swipe window.
      const k = Math.min(1, this.t / GUARD_SWIPE_MS)
      const targetX = this.swipeOriginX + this.swipeDir * GUARD_SWIPE_PX * k
      this.setVelocityX(((targetX - this.x) / Math.max(16, dt)) * 1000)
      this.syncBaton(true, true)
      if (this.t >= GUARD_SWIPE_MS) {
        this.setVelocity(0, 0)
        this.phase = 'rest'
        this.t = 0
        this.anim('walk')
      }
    } else {
      this.setVelocity(0, 0)
      this.syncBaton(false)
      this.anims.pause()
      if (this.t >= GUARD_REST_MS) {
        this.anims.resume()
        this.phase = Math.abs(dx) <= GUARD_ENGAGE ? 'warn' : 'walk'
        this.t = 0
        if (this.phase === 'warn') {
          this.swipeDir = dx >= 0 ? 1 : -1
          this.showWarn()
        }
      }
    }
    this.syncDepth()
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 58, '！', {
        fontSize: '16px',
        color: '#ffe08a',
        stroke: '#201808',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 5)
  }

  private clearWarn() {
    this.warnMark?.destroy()
    this.warnMark = null
  }

  private syncBaton(raised: boolean, swinging = false) {
    if (!this.baton) return
    this.baton.setVisible(this.active && this.fsm !== 'DEAD')
    const face = this.flipX ? -1 : 1
    const ox = this.x + face * (swinging ? 22 : raised ? 8 : 14)
    const oy = this.y - (raised || swinging ? 52 : 34)
    this.baton.setPosition(ox, oy)
    this.baton.setAngle(swinging ? face * 55 : raised ? face * -25 : face * 10)
    this.baton.setDepth(this.depth + 3)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.baton.destroy()
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.baton?.destroy()
    super.destroy(fromScene)
  }
}

// ── 鎖匠機械人 ─────────────────────────────────────────────────────────

/** Mid bot: close 200 → warn 1000ms → linear chain 200px; hit slows hero 0.5× for 1000ms; every 3000ms. */
export class LockBot extends AnimEnemy {
  private phase: 'walk' | 'warn' | 'cool' = 'walk'
  private t = 0
  private lh: LockBotHooks
  private arm: Phaser.GameObjects.Rectangle
  private warnMark: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, lh: LockBotHooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's9lockbot'
    this.lh = lh
    this.hp = this.maxHp = LOCK_HP
    this.hurtMs = 220
    this.bodyBox(36, 48)
    this.setTint(TINT.lockbot)
    this.arm = scene.add
      .rectangle(x, this.y - 28, 18, 8, 0x608090, 1)
      .setStrokeStyle(1, 0xd0e0f0)
      .setDepth(this.depth + 3)
      .setOrigin(0, 0.5)
  }

  protected override defaultTint() {
    return TINT.lockbot
  }

  canHurtPlayer() {
    // Body bump still hurts; chain slow is separate via projectile.
    return this.active && this.fsm !== 'DEAD' && this.phase !== 'warn' && !this.hitThis
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(dmg, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    return r
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.arm.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.syncArm(false)
      return
    }
    this.setPosition(this.x, this.lh.floorY())
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.syncArm(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.face(dx)
    this.t += dt

    if (this.phase === 'walk') {
      this.anim(Math.abs(dx) < LOCK_ENGAGE ? 'reach' : 'walk')
      this.syncArm(false)
      if (Math.abs(dx) <= LOCK_ENGAGE) {
        this.setVelocity(0, 0)
        if (this.canEngageFromScreen()) {
          this.phase = 'warn'
          this.t = 0
          this.showWarn()
        }
      } else {
        this.setVelocityX(Math.sign(dx) * LOCK_WALK)
      }
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.anim('reach')
      const blink = Math.floor(now / 100) % 2 === 0
      this.setTint(blink ? 0xffc080 : TINT.lockbot)
      this.syncArm(true)
      this.warnMark?.setPosition(this.x, this.y - 62)
      if (this.t >= LOCK_WARN_MS) {
        this.setTint(TINT.lockbot)
        this.clearWarn()
        const dir: 1 | -1 = dx >= 0 ? 1 : -1
        this.lh.throwChain(this.x + dir * 16, this.y - 36, dir)
        this.phase = 'cool'
        this.t = 0
        this.syncArm(false)
        SFX.swing?.()
      }
    } else {
      this.setVelocity(0, 0)
      this.anim('walk')
      this.anims.pause()
      this.syncArm(false)
      if (this.t >= LOCK_INTERVAL_MS) {
        this.anims.resume()
        this.phase = Math.abs(dx) <= LOCK_ENGAGE ? 'warn' : 'walk'
        this.t = 0
        if (this.phase === 'warn') this.showWarn()
      }
    }
    this.syncDepth()
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 62, '！', {
        fontSize: '16px',
        color: '#ffc080',
        stroke: '#201008',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 5)
  }

  private clearWarn() {
    this.warnMark?.destroy()
    this.warnMark = null
  }

  private syncArm(cocked: boolean) {
    if (!this.arm) return
    this.arm.setVisible(this.active && this.fsm !== 'DEAD')
    const face = this.flipX ? -1 : 1
    this.arm.setPosition(this.x + face * 6, this.y - (cocked ? 40 : 28))
    this.arm.setScale(cocked ? face * 1.2 : face, 1)
    this.arm.setDepth(this.depth + 3)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.arm.destroy()
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.arm?.destroy()
    super.destroy(fromScene)
  }
}

/** Shared: apply chain slow (half speed 1000ms) via stickyUntil used by stickyFeetMul. */
export function applyChainSlow(scene: Phaser.Scene, hero: Phaser.Physics.Arcade.Sprite) {
  const now = scene.time.now
  const was = ((hero.getData('stickyUntil') as number | undefined) ?? 0) > now
  hero.setData('stickyUntil', now + LOCK_SLOW_MS)
  if (!was) {
    floatText(scene, hero.x, hero.y - 52, '鎖鏈！', '#c8d0e0', { size: 12, dur: 900 })
    SFX.gulp?.()
  }
}

export const LOCK_CHAIN = {
  range: LOCK_RANGE,
  speed: LOCK_CHAIN_SPEED,
  slowMs: LOCK_SLOW_MS,
} as const
