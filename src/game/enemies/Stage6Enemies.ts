import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { HoneyZombie } from './Stage4Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { bossHitDamage } from '../engine/bossDamage'
import { isActorFrozen } from '../fx'

/**
 * 第二大陸・購物中心 cast.
 *  - GuardZombie: the stage-4 蜜僵 in a security cap (tint + a drawn cap that follows the sprite).
 *  - RobotArm: a transport arm bolted to the floor. It never moves; it telegraphs, then fires a
 *    low/high bolt (the 帽仔兵 barrel's jump-or-duck read) at the nearest hero in range.
 *  - SecurityDirector: the boss, built on 武者王's three-phase skeleton (Stage1Boss.ts). Art is the
 *    'triboss' anim set recoloured as a uniform — a placeholder until a dedicated sheet exists.
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

const UNIFORM_TINT = 0xa8b8ec

// ── 保安蜜僵 ─────────────────────────────────────────────────────────────

export class GuardZombie extends HoneyZombie {
  private cap: Phaser.GameObjects.Graphics
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks)
    this.species = 'guard'
    this.hp = this.maxHp = 3
    this.setTint(UNIFORM_TINT)
    this.cap = scene.add.graphics().setDepth(this.depth + 1)
    this.cap.fillStyle(0x1c2a44, 1).fillRect(-8, -4, 16, 5).fillRect(-5, -7, 10, 3)
    this.cap.fillStyle(0x0e1626, 1).fillRect(-9, 0, 18, 2)
    this.cap.fillStyle(0xd4af37, 1).fillRect(-2, -5, 4, 3)
  }

  protected override defaultTint() {
    return UNIFORM_TINT
  }

  override tick(dt: number, ctx: Ctx) {
    super.tick(dt, ctx)
    this.syncCap()
  }

  private syncCap() {
    if (!this.cap) return
    this.cap.setVisible(this.active && this.visible && this.fsm !== 'DEAD')
    if (!this.cap.visible) return
    const dir = this.flipX ? -1 : 1
    this.cap.setPosition(this.x + dir * 2, this.y - this.displayHeight + 12)
    this.cap.setScale(dir, 1)
    this.cap.setDepth(this.depth + 1)
  }

  protected override die(dir: number) {
    this.cap?.destroy()
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.cap?.destroy()
    super.destroy(fromScene)
  }
}

// ── 輸送機械臂 ───────────────────────────────────────────────────────────

export type ArmHooks = {
  floorY: () => number
  /** `feet` is the floor line; `high` picks the head-height (duck) bolt over the shin-height (jump) one. */
  shoot: (x: number, feet: number, dir: 1 | -1, high: boolean) => void
}

const ARM_RANGE = 440
const ARM_IDLE_MS = 1500
const ARM_AIM_MS = 600
const ARM_REST_MS = 600

export class RobotArm extends Enemy {
  species = 'robotarm'
  kind = 'blocker'
  boss = false
  flying = false
  readonly stationary = true
  private homeX: number
  private ah: ArmHooks
  private phase: 'idle' | 'aim' | 'rest' = 'idle'
  private t: number
  private shots = 0

  constructor(scene: Phaser.Scene, x: number, hooks: ArmHooks) {
    super(scene, x, hooks.floorY(), scene.textures.exists('s6-robotarm') ? 's6-robotarm' : 'coin')
    this.ah = hooks
    this.homeX = x
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 3
    this.hurtMs = 220
    this.t = Phaser.Math.Between(400, 900)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    const w = 34
    const h = Math.min(60, this.frame.height - 4)
    body.setSize(w, h)
    body.setOffset((this.frame.width - w) / 2, this.frame.height - h)
  }

  canHurtPlayer() {
    return false
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const r = super.receiveHit(dmg, dir)
    this.setPosition(this.homeX, this.ah.floorY())
    this.setVelocity(0, 0)
    this.phase = 'rest'
    this.t = ARM_REST_MS
    return r
  }

  protected override die(dir: number) {
    super.die(dir)
    this.setPosition(this.homeX, this.ah.floorY())
    this.setVelocity(0, 0)
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    if (isActorFrozen(this, now)) return
    this.setPosition(this.homeX, this.ah.floorY())
    this.setVelocity(0, 0)
    this.setDepth(actorDepth('enemy', this.lane, this.y))
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.setFlipX(dx < 0)
    this.t -= dt
    if (this.phase === 'idle') {
      this.setScale(this.baseScale || 1)
      if (this.t <= 0 && Math.abs(dx) < ARM_RANGE) {
        this.phase = 'aim'
        this.t = ARM_AIM_MS
      }
    } else if (this.phase === 'aim') {
      const blink = Math.floor(now / 90) % 2 === 0
      if (blink) this.setTint(0xff9060)
      else this.clearTint()
      this.setScale(1, 1 - 0.06 * (1 - this.t / ARM_AIM_MS))
      if (this.t <= 0) {
        this.clearTint()
        const high = this.shots % 2 === 1
        this.shots++
        this.ah.shoot(this.x + (dx < 0 ? -34 : 34), this.ah.floorY(), dx < 0 ? -1 : 1, high)
        this.phase = 'rest'
        this.t = ARM_REST_MS
      }
    } else if (this.t <= 0) {
      this.phase = 'idle'
      this.t = ARM_IDLE_MS
    }
  }
}

// ── 商場保安總監 ─────────────────────────────────────────────────────────

export type DirectorHooks = {
  floorY: () => number
  /** Scanner sweep across the arena; returns warn+run length in ms. */
  sweep: (x0: number, x1: number, dir: 1 | -1, warnMs: number, speed: number) => number
  bolt: (x: number, feet: number, dir: 1 | -1, high: boolean, speed: number, lifeMs: number) => void
  drone: (x0: number, x1: number, dir: 1 | -1, speed: number) => void
  droneCount: () => number
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

export const DIRECTOR_HP = 55
/** P2 starts at ≤66% HP, P3 under 30% (Alan's brief: "P3 at HP<30%"). */
export const DIRECTOR_P2_AT = 0.66
export const DIRECTOR_P3_AT = 0.3

const PHASE = {
  1: { stalk: 1100, warn: 1000, speed: 150, bolts: 3, boltGap: 260, boltSpeed: 210, exposed: 1500 },
  2: { stalk: 850, warn: 900, speed: 175, bolts: 4, boltGap: 220, boltSpeed: 225, exposed: 1300 },
  3: { stalk: 450, warn: 750, speed: 205, bolts: 5, boltGap: 170, boltSpeed: 250, exposed: 1100 },
} as const

type Act = 'intro' | 'stalk' | 'windup' | 'barrage' | 'sweep' | 'exposed'

const ANIM: Record<Act, string> = {
  intro: 'idle',
  stalk: 'idle',
  windup: 'shield',
  barrage: 'point',
  sweep: 'rain',
  exposed: 'hurt',
}

export class SecurityDirector extends AnimEnemy {
  qphase: 1 | 2 | 3 = 1
  act: Act = 'intro'
  arenaX0: number
  arenaX1: number
  onDefeated?: () => void
  private t = 0
  private stalkLeft = 1000
  private step = 0
  private next: 'barrage' | 'sweep' = 'barrage'
  private fired = 0
  private sweepMs = 0
  private lastHitAt = 0
  private dh: DirectorHooks

  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, dh: DirectorHooks) {
    super(scene, x, dh.floorY(), 'triboss', { floorY: dh.floorY }, 'idle')
    this.species = 'securitydirector'
    this.kind = 'boss'
    this.boss = true
    this.dh = dh
    this.hp = this.maxHp = DIRECTOR_HP
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.setTint(UNIFORM_TINT)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(44, 56)
    body.setOffset((this.frame.width - 44) / 2, this.frame.height - 56 - 6)
  }

  protected override defaultTint() {
    return UNIFORM_TINT
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (this.act === 'intro' || this.act === 'exposed') return false
    return this.contactCd <= 0
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    const hitDmg = bossHitDamage(dmg, { weak: this.act === 'exposed', weakBase: 3, capNormal: 2, capWeak: 5 })
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(hitDmg, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') this.setFsm('ATTACK')
    if (!r.killed) this.updatePhase()
    return r
  }

  private updatePhase() {
    const f = this.hp / this.maxHp
    const next: 1 | 2 | 3 = f < DIRECTOR_P3_AT ? 3 : f <= DIRECTOR_P2_AT ? 2 : 1
    if (next <= this.qphase) return
    this.qphase = next
    this.dh.bossEvent(next === 2 ? 'phase2' : 'phase3')
    this.go('stalk')
    this.stalkLeft = 700
  }

  private go(a: Act) {
    this.act = a
    this.t = 0
    this.fired = 0
    this.setTint(UNIFORM_TINT)
    this.setVelocity(0, 0)
    this.anim(ANIM[a])
  }

  protected override die(_dir: number) {
    this.hp = 0
    this.act = 'intro'
    this.boss = false
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.clearTint()
    this.anim('defeat')
    this.dh.bossEvent('defeat')
    this.scene.time.delayedCall(1800, () => {
      this.onDefeated?.()
      if (!this.scene) return
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.t += dt
    const floor = this.dh.floorY()
    this.y = floor
    const P = PHASE[this.qphase]
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    const toward = (Math.sign(dx) || -1) as 1 | -1
    const x0 = this.arenaX0 + 24
    const x1 = this.arenaX1 - 24
    const mid = (this.arenaX0 + this.arenaX1) / 2

    switch (this.act) {
      case 'intro':
        this.setFlipX(dx < 0)
        if (this.t > 1200) {
          this.go('stalk')
          this.stalkLeft = P.stalk
        }
        break

      case 'stalk': {
        this.setFlipX(dx < 0)
        const dist = Math.abs(dx)
        // The barrage is close-range, so he walks up to it; the sweep can start from anywhere.
        const wantClose = this.next === 'barrage'
        if (wantClose && dist > 150) this.setVelocityX(toward * 70)
        else this.setVelocityX(0)
        this.stalkLeft -= dt
        if (this.qphase >= 2 && this.dh.droneCount() === 0 && this.stalkLeft < P.stalk - 200) {
          const dir: 1 | -1 = this.x < mid ? 1 : -1
          this.dh.drone(this.arenaX0, this.arenaX1, dir, this.qphase === 3 ? 105 : 85)
        }
        const ready = this.stalkLeft <= 0 && (!wantClose || dist <= 190 || this.stalkLeft < -2200)
        if (ready) this.go('windup')
        break
      }

      case 'windup':
        this.setFlipX(dx < 0)
        this.setTint(0xffc080)
        if (this.t >= 380) {
          if (this.next === 'barrage') this.go('barrage')
          else {
            const dir: 1 | -1 = this.x < mid ? 1 : -1
            this.sweepMs = this.dh.sweep(this.arenaX0, this.arenaX1, dir, P.warn, P.speed)
            this.go('sweep')
          }
        }
        break

      case 'barrage': {
        this.setFlipX(dx < 0)
        if (this.fired < P.bolts && this.t >= 120 + this.fired * P.boltGap) {
          const dir = toward
          this.dh.bolt(this.x + dir * 30, floor, dir, this.fired % 2 === 1, P.boltSpeed, 2200)
          this.fired++
        }
        if (this.t >= 120 + P.bolts * P.boltGap + 250) {
          this.step++
          this.next = 'sweep'
          // P3: no breathing room between the barrage and the sweep.
          this.stalkLeft = this.qphase === 3 ? 0 : P.stalk
          this.go('stalk')
        }
        break
      }

      case 'sweep':
        if (this.t >= this.sweepMs + 150) {
          this.step++
          this.next = 'barrage'
          this.go('exposed')
          this.dh.bossEvent('weak')
        }
        break

      case 'exposed':
        this.setTint(0xffe060)
        if (this.t >= P.exposed) {
          this.stalkLeft = P.stalk
          this.go('stalk')
        }
        break
    }
    this.x = Phaser.Math.Clamp(this.x, x0, x1)
    void mid
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}
