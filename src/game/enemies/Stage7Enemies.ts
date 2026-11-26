import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { HoneyZombie } from './Stage4Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { isActorFrozen } from '../fx'

/**
 * Stage 7 · 森友展銷中心 enemy variety (B4 + batch7 D5 reskin).
 * Behaviours unchanged; night-warehouse silhouettes distinct from Stage 6 mall skins.
 *   1. ChargeHoneyZombie  鞭手飼養員 — warn → 2.5× charge 200px → rest
 *   2. HopCage            籠車 — hop 140px; only hittable in air
 *   3. ShieldKeeper       鐵閘板看守員 — front blocks; hit from behind
 *   4. CanThrower         拋飼料桶員 — stationary parabolic cans
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

/**
 * s7-look: distinct multiply tints (match scripts/art/gen_s7_look_props.py TINTS).
 * Same honeyzombie body — colour + one prop overlay separates the four.
 */
const C2 = {
  charge: 0xc87840,
  hop: 0x4070b0,
  shield: 0x889098,
  can: 0xb09048,
} as const

function attachProp(
  scene: Phaser.Scene,
  host: Phaser.GameObjects.Sprite,
  key: string,
  depthDelta = 2,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null
  return scene.add.image(host.x, host.y, key).setDepth(host.depth + depthDelta).setOrigin(0.5, 1)
}

/** Non-charge Stage7 walk speed (shield chase uses its own 16/28). Kept exported for QA/docs. */
export const WALK = 40
/** Charge-zombie patrol / charge base speed. */
export const CHARGE_WALK = 48
/** 48 × 4.58 ≈ 220 px/s charge. */
export const CHARGE_MUL = 4.58
export const CHARGE_DIST = 160
export const WARN_MS = 800
export const REST_MS = 1000
/** E2 hop aim */
export const HOP_CROUCH_MS = 800
export const HOP_REST_MS = 900
const HOP_AIM_JITTER = 16
const HOP_MELEE_DIST = 60
const HOP_ARC = 78
/** E1 shield turn */
export const SHIELD_TURN_DELAY_MS = 1000
const SHIELD_TURN_ANIM_MS = 250
const SHIELD_TURN_COOLDOWN_MS = 800
const SHIELD_HINT_MS = 300
export const CAN_INTERVAL_MS = 3000
/** CanThrower visible wind-up before release (≥800ms). */
export const CAN_WIND_MS = 800

// ── 衝鋒蜜僵 ─────────────────────────────────────────────────────────────

/** See player → 800ms warn → charge ~220px/s for 160px → rest 1000ms. HP 9. */
export class ChargeHoneyZombie extends HoneyZombie {
  private phase: 'idle' | 'warn' | 'charge' | 'rest' = 'idle'
  private t = 0
  private dir: 1 | -1 = 1
  private chargeFrom = 0
  private flash: Phaser.GameObjects.Text | null = null
  private prop: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks)
    this.species = 's7charge'
    this.hp = this.maxHp = 9
    this.setTint(C2.charge)
    this.prop = attachProp(scene, this, 's7-prop-speedlines', -1)
  }

  protected override defaultTint() {
    return C2.charge
  }

  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.fsm !== 'HURT' && this.phase === 'charge' && this.contactCd <= 0
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const r = super.receiveHit(dmg, dir)
    if (!r.killed && this.phase !== 'charge') {
      this.phase = 'rest'
      this.t = REST_MS * 0.5
      this.setVelocity(0, 0)
    }
    return r
  }

  override tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) return
    if (this.getData('leaping')) {
      this.setVelocity(0, 0)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      this.syncProp()
      return
    }
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.syncFlash()
      this.syncProp()
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.t += dt

    if (this.phase === 'idle') {
      this.setFlipX(dx < 0)
      this.anim(Math.abs(dx) < 46 ? 'reach' : 'walk')
      const speed = CHARGE_WALK
      this.setVelocityX(Math.abs(dx) < 8 ? 0 : Math.sign(dx) * speed)
      if (Math.abs(dx) < 280 && Math.abs(dx) > 36) {
        this.phase = 'warn'
        this.t = 0
        this.dir = (Math.sign(dx) || 1) as 1 | -1
        this.setVelocity(0, 0)
        this.flash?.destroy()
        this.flash = this.scene.add
          .text(this.x, this.y - this.displayHeight - 6, '！', {
            fontSize: '16px',
            color: '#ff6060',
            stroke: '#201008',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(this.depth + 5)
      }
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.setFlipX(this.dir < 0)
      this.anim('reach')
      const blink = Math.floor(now / 80) % 2 === 0
      if (blink) this.setTint(0xff4040)
      else this.setTint(C2.charge)
      this.syncFlash()
      if (this.t >= WARN_MS) {
        this.clearTint()
        this.setTint(C2.charge)
        this.flash?.destroy()
        this.flash = null
        this.phase = 'charge'
        this.t = 0
        this.chargeFrom = this.x
        this.setFsm('ATTACK')
        this.hitThis = false
        this.anim('walk')
        this.setVelocityX(this.dir * CHARGE_WALK * CHARGE_MUL)
      }
    } else if (this.phase === 'charge') {
      this.setFlipX(this.dir < 0)
      this.setVelocityX(this.dir * CHARGE_WALK * CHARGE_MUL)
      const body = this.body as Phaser.Physics.Arcade.Body
      const traveled = Math.abs(this.x - this.chargeFrom)
      if (traveled >= CHARGE_DIST || body.blocked.left || body.blocked.right || this.t > 2800) {
        this.phase = 'rest'
        this.t = 0
        this.setFsm('CHASE')
        this.setVelocity(0, 0)
      }
    } else {
      this.setVelocity(0, 0)
      this.anim('reach')
      this.anims.pause()
      if (this.t >= REST_MS) {
        this.anims.resume()
        this.phase = 'idle'
        this.t = 0
      }
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
    this.syncProp()
  }

  private syncProp() {
    if (!this.prop) return
    const face = this.flipX ? -1 : 1
    // Speed lines trail behind the body
    const ox = this.x - face * 28
    const oy = this.y - 18
    const charging = this.phase === 'charge'
    this.prop
      .setPosition(ox, oy)
      .setDepth(this.depth - 1)
      .setFlipX(this.flipX)
      .setAlpha(charging ? 1 : 0.72)
      .setScale(charging ? 1.15 : 1, charging ? 1.1 : 1)
      .setVisible(this.active && this.visible && this.fsm !== 'DEAD')
  }

  private syncFlash() {
    if (!this.flash) return
    this.flash.setPosition(this.x, this.y - this.displayHeight - 6).setDepth(this.depth + 5)
  }

  protected override die(dir: number) {
    this.flash?.destroy()
    this.flash = null
    this.prop?.destroy()
    this.prop = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.flash?.destroy()
    this.flash = null
    this.prop?.destroy()
    this.prop = null
    super.destroy(fromScene)
  }
}

// ── 籠車 ───────────────────────────────────────────────────────────────

/** E2: aims landing at player (±16); crouch warn + shadow; melee if <60. HP 9. */
export class HopCage extends HoneyZombie {
  private phase: 'idle' | 'crouch' | 'hop' = 'idle'
  private t = 0
  private airborne = false
  private prop: Phaser.GameObjects.Image | null = null
  private shadow: Phaser.GameObjects.Ellipse | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks)
    this.species = 's7hop'
    this.hp = this.maxHp = 9
    this.setTint(C2.hop)
    this.prop = attachProp(scene, this, 's7-prop-cage', 2)
    this.t = Phaser.Math.Between(200, 700)
  }

  protected override defaultTint() {
    return C2.hop
  }

  /** Grounded = immune (GameScene.damageEnemy checks airOnly). */
  airOnly() {
    return this.active && this.fsm !== 'DEAD' && !this.airborne
  }

  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.fsm !== 'HURT' && this.airborne && this.contactCd <= 0
  }

  private clearShadow() {
    this.shadow?.destroy()
    this.shadow = null
  }

  private showShadow(atX: number) {
    this.clearShadow()
    const floor = this.s2.floorY()
    this.shadow = this.scene.add
      .ellipse(atX, floor + 2, 36, 10, 0x101018, 0.45)
      .setDepth(actorDepth('enemy', this.lane, floor) - 1)
  }

  /** E2: crouch warn → hop to player X (±16), or melee bounce if <60px. */
  private beginHop(tgt: HeroRef) {
    const floor = this.s2.floorY()
    const dx = tgt.x - this.x
    const melee = Math.abs(dx) < HOP_MELEE_DIST
    const aim = melee
      ? this.x + (Math.sign(dx) || (this.flipX ? -1 : 1)) * 28
      : tgt.x + Phaser.Math.Between(-HOP_AIM_JITTER, HOP_AIM_JITTER)
    const toX = aim
    this.setFlipX(toX < this.x)
    this.phase = 'crouch'
    this.airborne = false
    this.y = floor
    this.setVelocity(0, 0)
    this.anim('walk')
    this.anims.pause()
    this.showShadow(toX)
    this.scene.time.delayedCall(HOP_CROUCH_MS, () => {
      if (!this.active || this.fsm === 'DEAD') {
        this.clearShadow()
        return
      }
      this.phase = 'hop'
      this.airborne = true
      this.anims.resume()
      this.anim('walk')
      const fromX = this.x
      const hop = this.scene.tweens.add({
        targets: this,
        x: toX,
        duration: melee ? 280 : 420,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          if (!this.active) return
          const p = tw.progress
          this.y = floor - Math.sin(p * Math.PI) * (melee ? 36 : HOP_ARC)
          this.setVelocity(0, 0)
          ;(this.body as Phaser.Physics.Arcade.Body).reset(this.x, this.y)
          this.syncCostume()
        },
          onComplete: () => {
          if (!this.active) return
          this.x = toX
          this.y = floor
          // E2: landing hit — keep airborne flag for one contact window frame.
          this.airborne = true
          this.contactCd = 0
          this.phase = 'idle'
          this.t = HOP_REST_MS
          this.clearShadow()
          ;(this.body as Phaser.Physics.Arcade.Body).reset(this.x, this.y)
          this.setVelocity(0, 0)
          this.syncCostume()
          this.scene.time.delayedCall(120, () => {
            if (this.active) this.airborne = false
          })
        },
      })
      this.setData('hopTween', hop)
      void fromX
    })
  }

  override tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.prop?.setVisible(false)
      this.clearShadow()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.syncCostume()
      return
    }
    if (this.getData('leaping') || this.phase === 'crouch' || this.phase === 'hop') {
      this.setVelocity(0, 0)
      if (this.phase === 'crouch') {
        this.y = this.s2.floorY()
        this.airborne = false
      }
      this.syncCostume()
      return
    }
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      if (!this.airborne) this.y = this.s2.floorY()
      this.setVelocity(0, 0)
      this.syncCostume()
      return
    }

    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.setFlipX(dx < 0)

    if (this.phase === 'idle') {
      this.airborne = false
      this.y = this.s2.floorY()
      this.setVelocity(0, 0)
      this.anim('walk')
      this.anims.pause()
      this.t -= dt
      if (this.t <= 0 && Math.abs(dx) < 420) this.beginHop(tgt)
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
    this.syncCostume()
  }

  private syncCostume() {
    if (!this.prop) return
    // Cage sits on the head
    this.prop
      .setPosition(this.x, this.y - 44)
      .setDepth(this.depth + 2)
      .setVisible(this.active && this.visible && this.fsm !== 'DEAD')
      .setFlipX(this.flipX)
      .setOrigin(0.5, 1)
  }

  protected override die(dir: number) {
    const hop = this.getData('hopTween') as Phaser.Tweens.Tween | undefined
    hop?.stop()
    this.airborne = false
    this.clearShadow()
    this.prop?.destroy()
    this.prop = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    const hop = this.getData('hopTween') as Phaser.Tweens.Tween | undefined
    hop?.stop()
    this.clearShadow()
    this.prop?.destroy()
    this.prop = null
    super.destroy(fromScene)
  }
}

// ── 鐵閘板看守員 ───────────────────────────────────────────────────────────

/** Front blocks bullets (ding); must jump behind and hit the back. HP 6. E1 turn delay. */
export class ShieldKeeper extends AnimEnemy {
  private prop: Phaser.GameObjects.Image | null = null
  /** Desired face: flipX true = facing left. */
  private wantFlipX: boolean | null = null
  private turnDelayLeft = 0
  private turnAnimLeft = 0
  private turnCooldownLeft = 0
  private hint: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's7shield'
    this.hp = this.maxHp = 6
    this.hurtMs = 240
    this.bodyBox(30, 44)
    this.setTint(C2.shield)
    this.prop = attachProp(scene, this, 's7-prop-shield', 2)
  }

  protected override defaultTint() {
    return C2.shield
  }

  /** Same face-block rule as LobsterGuard / 霸鼻象 armour. */
  blocks(dir: number) {
    if (this.fsm === 'HURT' || this.fsm === 'DEAD') return false
    // During turn anim, shield is rotating — still blocks old face until flip commits.
    const face = this.flipX ? -1 : 1
    return dir === -face
  }

  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.fsm !== 'HURT' && this.contactCd <= 0
  }

  private clearHint() {
    this.hint?.destroy()
    this.hint = null
  }

  private showHint() {
    this.clearHint()
    this.hint = this.scene.add
      .text(this.x, this.y - 56, '？', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffe080',
        stroke: '#201808',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 5)
    this.scene.time.delayedCall(SHIELD_HINT_MS, () => this.clearHint())
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.prop?.setVisible(false)
      this.clearHint()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.turnCooldownLeft = Math.max(0, this.turnCooldownLeft - dt)
    if (isActorFrozen(this, now)) {
      this.drawShield()
      return
    }
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.drawShield()
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    const desiredFlip = dx < 0

    // E1: delayed turn when player is behind.
    if (this.turnAnimLeft > 0) {
      this.turnAnimLeft -= dt
      this.setVelocity(0, 0)
      this.anim('reach')
      if (this.turnAnimLeft <= 0 && this.wantFlipX != null) {
        this.setFlipX(this.wantFlipX)
        this.wantFlipX = null
        this.turnCooldownLeft = SHIELD_TURN_COOLDOWN_MS
      }
      this.syncDepth()
      this.drawShield()
      this.hint?.setPosition(this.x, this.y - 56)
      return
    }

    if (desiredFlip !== this.flipX && this.turnCooldownLeft <= 0) {
      if (this.wantFlipX == null) {
        this.wantFlipX = desiredFlip
        this.turnDelayLeft = SHIELD_TURN_DELAY_MS
        this.showHint()
      }
      this.turnDelayLeft -= dt
      if (this.turnDelayLeft <= 0) {
        this.turnAnimLeft = SHIELD_TURN_ANIM_MS
        // flip commits at end of anim
      }
    } else if (desiredFlip === this.flipX) {
      // Player back in front — cancel pending turn.
      this.wantFlipX = null
      this.turnDelayLeft = 0
      this.clearHint()
    }

    const near = Math.abs(dx) < 100
    this.anim(near ? 'reach' : 'walk')
    // Slow chase while waiting to turn (player behind) — don't spin instantly.
    const chasingFront = desiredFlip === this.flipX
    this.setVelocityX(
      !chasingFront || Math.abs(dx) < 10 ? 0 : Math.sign(dx) * (near ? 16 : 28),
    )
    this.syncDepth()
    this.drawShield()
    this.hint?.setPosition(this.x, this.y - 56)
  }

  private drawShield() {
    if (!this.prop) return
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      this.prop.setVisible(false)
      return
    }
    const face = this.flipX ? -1 : 1
    // Large shield held in front of the body
    this.prop
      .setVisible(true)
      .setPosition(this.x + face * 18, this.y - 8)
      .setDepth(this.depth + 2)
      .setFlipX(this.flipX)
      .setOrigin(0.5, 1)
  }

  protected override die(dir: number) {
    this.clearHint()
    this.prop?.destroy()
    this.prop = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearHint()
    this.prop?.destroy()
    this.prop = null
    super.destroy(fromScene)
  }
}

// ── 掟罐員 ───────────────────────────────────────────────────────────────

export type CanHooks = {
  floorY: () => number
  throwCan: (x: number, y: number, targetX: number) => void
}

/** Stands still; every 3s throws a parabolic feed-bucket that explodes on the ground. HP 9. */
export class CanThrower extends AnimEnemy {
  private cd = 900
  private wind = 0
  private ch: CanHooks
  private prop: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, ch: CanHooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's7can'
    this.ch = ch
    this.hp = this.maxHp = 9
    this.hurtMs = 220
    this.bodyBox(28, 44)
    this.setTint(C2.can)
    // Bag of cans on the back (behind body)
    this.prop = attachProp(scene, this, 's7-prop-canbag', -1)
    this.cd = Phaser.Math.Between(600, 1200)
    this.anims.pause()
  }

  protected override defaultTint() {
    return C2.can
  }

  canHurtPlayer() {
    return false
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
      this.prop?.setVisible(false)
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.drawCan()
      return
    }
    this.setPosition(this.x, this.ch.floorY())
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.drawCan()
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.face(dx)
    if (this.wind > 0) {
      this.wind -= dt
      this.anims.resume()
      this.anim('reach')
      this.setTint(0xffa060)
      if (this.wind <= 0) {
        this.setTint(C2.can)
        this.ch.throwCan(this.x + (this.flipX ? -12 : 12), this.y - 36, tgt.x)
        this.cd = CAN_INTERVAL_MS
        this.anim('walk')
        this.anims.pause()
      }
    } else {
      this.anim('walk')
      this.anims.pause()
      this.cd -= dt
      if (this.cd <= 0 && Math.abs(dx) < 460) {
        this.wind = CAN_WIND_MS
      }
    }
    this.syncDepth()
    this.drawCan()
  }

  private drawCan() {
    if (!this.prop) return
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      this.prop.setVisible(false)
      return
    }
    const face = this.flipX ? -1 : 1
    // Sack of cans on the back (trail side)
    this.prop
      .setVisible(true)
      .setPosition(this.x - face * 14, this.y - 10)
      .setDepth(this.depth - 1)
      .setFlipX(this.flipX)
      .setOrigin(0.5, 1)
      .setAlpha(this.wind > 0 ? 0.85 : 1)
  }

  protected override die(dir: number) {
    this.prop?.destroy()
    this.prop = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.prop?.destroy()
    this.prop = null
    super.destroy(fromScene)
  }
}
