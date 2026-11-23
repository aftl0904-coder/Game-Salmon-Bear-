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

/** Night-warehouse palette — deliberately not mall blues/creams (D5). */
const C2 = {
  charge: 0x5a4030,
  hop: 0x3a4450,
  shield: 0x4a5868,
  can: 0x6a5840,
} as const

function attachBadge(scene: Phaser.Scene, host: Phaser.GameObjects.Sprite, key: string) {
  if (!scene.textures.exists(key)) return null
  const img = scene.add.image(host.x, host.y - 20, key).setDepth(host.depth + 2)
  return img
}

const WALK = 40
const CHARGE_MUL = 2.5
const CHARGE_DIST = 200
const WARN_MS = 400
const REST_MS = 800
const HOP_DIST = 140
const CAN_INTERVAL_MS = 2500

// ── 衝鋒蜜僵 ─────────────────────────────────────────────────────────────

/** See player → 400ms warn → charge at 2.5× walk for 200px → rest 800ms. HP 3. */
export class ChargeHoneyZombie extends HoneyZombie {
  private phase: 'idle' | 'warn' | 'charge' | 'rest' = 'idle'
  private t = 0
  private dir: 1 | -1 = 1
  private chargeFrom = 0
  private flash: Phaser.GameObjects.Text | null = null
  private badge: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks)
    this.species = 's7charge'
    this.hp = this.maxHp = 3
    this.setTint(C2.charge)
    this.badge = attachBadge(scene, this, 's7-enemy-whip')
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
      return
    }
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.syncFlash()
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.t += dt

    if (this.phase === 'idle') {
      this.setFlipX(dx < 0)
      this.anim(Math.abs(dx) < 46 ? 'reach' : 'walk')
      const speed = WALK
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
        this.setVelocityX(this.dir * WALK * CHARGE_MUL)
      }
    } else if (this.phase === 'charge') {
      this.setFlipX(this.dir < 0)
      this.setVelocityX(this.dir * WALK * CHARGE_MUL)
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
    if (this.badge) this.badge.setPosition(this.x, this.y - 22).setDepth(this.depth + 2).setFlipX(this.flipX)
  }

  private syncFlash() {
    if (!this.flash) return
    this.flash.setPosition(this.x, this.y - this.displayHeight - 6).setDepth(this.depth + 5)
  }

  protected override die(dir: number) {
    this.flash?.destroy()
    this.flash = null
    this.badge?.destroy()
    this.badge = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.flash?.destroy()
    this.flash = null
    this.badge?.destroy()
    this.badge = null
    super.destroy(fromScene)
  }
}

// ── 籠車 ───────────────────────────────────────────────────────────────

/** Hops forward 140px; only hittable while airborne. HP 2. */
export class HopCage extends HoneyZombie {
  private phase: 'idle' | 'hop' = 'idle'
  private t = 0
  private airborne = false
  private costume: Phaser.GameObjects.Graphics
  private badge: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks)
    this.species = 's7hop'
    this.hp = this.maxHp = 2
    this.setTint(C2.hop)
    this.costume = scene.add.graphics()
    this.drawCage()
    this.badge = attachBadge(scene, this, 's7-enemy-cagecart')
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

  private drawCage() {
    const g = this.costume
    g.clear()
    g.lineStyle(2, 0x8a8680, 1).strokeRect(-14, -40, 28, 26)
    g.lineBetween(-14, -31, 14, -31)
    g.lineBetween(-14, -22, 14, -22)
    g.lineBetween(-5, -40, -5, -14)
    g.lineBetween(5, -40, 5, -14)
    g.fillStyle(0xe8d090, 1).fillRect(-6, -18, 12, 5)
  }

  override tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.costume.setVisible(false)
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.syncCostume()
      return
    }
    if (this.getData('leaping')) {
      this.setVelocity(0, 0)
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
      if (this.t <= 0 && Math.abs(dx) < 420) {
        this.phase = 'hop'
        this.airborne = true
        this.anims.resume()
        this.anim('walk')
        const dir = (Math.sign(dx) || (this.flipX ? -1 : 1)) as 1 | -1
        this.setFlipX(dir < 0)
        const fromX = this.x
        const toX = fromX + dir * HOP_DIST
        const floor = this.s2.floorY()
        const hop = this.scene.tweens.add({
          targets: this,
          x: toX,
          duration: 420,
          ease: 'Sine.easeInOut',
          onUpdate: (tw) => {
            if (!this.active) return
            const p = tw.progress
            this.y = floor - Math.sin(p * Math.PI) * 78
            this.setVelocity(0, 0)
            ;(this.body as Phaser.Physics.Arcade.Body).reset(this.x, this.y)
            this.syncCostume()
          },
          onComplete: () => {
            if (!this.active) return
            this.x = toX
            this.y = floor
            this.airborne = false
            this.phase = 'idle'
            this.t = 700 + Math.random() * 500
            ;(this.body as Phaser.Physics.Arcade.Body).reset(this.x, this.y)
            this.setVelocity(0, 0)
            this.syncCostume()
          },
        })
        this.setData('hopTween', hop)
      }
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
    this.syncCostume()
  }

  private syncCostume() {
    this.costume
      .setPosition(this.x, this.y)
      .setDepth(this.depth + 1)
      .setVisible(this.active && this.visible && this.fsm !== 'DEAD')
      .setScale(this.flipX ? -1 : 1, 1)
    if (this.badge) {
      this.badge
        .setPosition(this.x, this.y - 24)
        .setDepth(this.depth + 2)
        .setVisible(this.active && this.visible && this.fsm !== 'DEAD')
        .setFlipX(this.flipX)
    }
  }

  protected override die(dir: number) {
    const hop = this.getData('hopTween') as Phaser.Tweens.Tween | undefined
    hop?.stop()
    this.airborne = false
    this.costume.destroy()
    this.badge?.destroy()
    this.badge = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    const hop = this.getData('hopTween') as Phaser.Tweens.Tween | undefined
    hop?.stop()
    this.costume?.destroy()
    this.badge?.destroy()
    this.badge = null
    super.destroy(fromScene)
  }
}

// ── 鐵閘板看守員 ───────────────────────────────────────────────────────────

/** Front blocks bullets (ding); must jump behind and hit the back. HP 3. */
export class ShieldKeeper extends AnimEnemy {
  private shieldGfx: Phaser.GameObjects.Graphics
  private badge: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's7shield'
    this.hp = this.maxHp = 3
    this.hurtMs = 240
    this.bodyBox(30, 44)
    this.setTint(C2.shield)
    this.shieldGfx = scene.add.graphics()
    this.badge = attachBadge(scene, this, 's7-enemy-gate')
  }

  protected override defaultTint() {
    return C2.shield
  }

  /** Same face-block rule as LobsterGuard / 霸鼻象 armour. */
  blocks(dir: number) {
    if (this.fsm === 'HURT' || this.fsm === 'DEAD') return false
    const face = this.flipX ? -1 : 1
    return dir === -face
  }

  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.fsm !== 'HURT' && this.contactCd <= 0
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.shieldGfx.setVisible(false)
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
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
    this.face(dx)
    const near = Math.abs(dx) < 100
    this.anim(near ? 'reach' : 'walk')
    this.setVelocityX(Math.abs(dx) < 10 ? 0 : Math.sign(dx) * (near ? 16 : 28))
    this.syncDepth()
    this.drawShield()
  }

  private drawShield() {
    const g = this.shieldGfx
    g.clear()
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      g.setVisible(false)
      return
    }
    g.setVisible(true)
    const face = this.flipX ? -1 : 1
    const sx = this.x + face * 16
    const sy = this.y - 28
    // Iron gate plate (warehouse steel, not mall acrylic)
    g.fillStyle(0x708090, 1).fillRoundedRect(sx - 11, sy - 20, 22, 40, 2)
    g.lineStyle(2, 0x2a3038, 1).strokeRoundedRect(sx - 11, sy - 20, 22, 40, 2)
    g.lineStyle(2, 0xa0b0c0, 1).lineBetween(sx - 7, sy - 10, sx + 7, sy - 10)
    g.lineBetween(sx - 7, sy + 2, sx + 7, sy + 2)
    g.fillStyle(0xc0a040, 1).fillCircle(sx, sy - 2, 3)
    g.setDepth(this.depth + 2)
    if (this.badge) this.badge.setPosition(this.x, this.y - 22).setDepth(this.depth + 3).setFlipX(this.flipX)
  }

  protected override die(dir: number) {
    this.shieldGfx.destroy()
    this.badge?.destroy()
    this.badge = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.shieldGfx?.destroy()
    this.badge?.destroy()
    this.badge = null
    super.destroy(fromScene)
  }
}

// ── 掟罐員 ───────────────────────────────────────────────────────────────

export type CanHooks = {
  floorY: () => number
  throwCan: (x: number, y: number, targetX: number) => void
}

/** Stands still; every 2.5s throws a parabolic feed-bucket that explodes on the ground. HP 2. */
export class CanThrower extends AnimEnemy {
  private cd = 900
  private wind = 0
  private ch: CanHooks
  private canGfx: Phaser.GameObjects.Graphics
  private badge: Phaser.GameObjects.Image | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, ch: CanHooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's7can'
    this.ch = ch
    this.hp = this.maxHp = 2
    this.hurtMs = 220
    this.bodyBox(28, 44)
    this.setTint(C2.can)
    this.canGfx = scene.add.graphics()
    this.badge = attachBadge(scene, this, 's7-enemy-feeder')
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
      this.canGfx.setVisible(false)
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
        this.wind = 380
      }
    }
    this.syncDepth()
    this.drawCan()
  }

  private drawCan() {
    const g = this.canGfx
    g.clear()
    if (!this.active || !this.visible || this.fsm === 'DEAD' || this.wind > 0) {
      g.setVisible(false)
      return
    }
    g.setVisible(true)
    const face = this.flipX ? -1 : 1
    const cx = this.x + face * 14
    const cy = this.y - 34
    // Feed bucket (olive/warehouse), not mall soda can
    g.fillStyle(0x8a9060, 1).fillRoundedRect(cx - 8, cy - 10, 16, 14, 2)
    g.lineStyle(1, 0x303820, 1).strokeRoundedRect(cx - 8, cy - 10, 16, 14, 2)
    g.fillStyle(0xc0b070, 1).fillEllipse(cx, cy - 10, 16, 5)
    if (this.badge) this.badge.setPosition(this.x, this.y - 22).setDepth(this.depth + 2).setFlipX(this.flipX)
    g.fillStyle(0xe8d070, 1).fillRect(cx - 5, cy - 4, 10, 3)
    g.setDepth(this.depth + 2)
  }

  protected override die(dir: number) {
    this.canGfx.destroy()
    this.badge?.destroy()
    this.badge = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.canGfx?.destroy()
    this.badge?.destroy()
    this.badge = null
    super.destroy(fromScene)
  }
}
