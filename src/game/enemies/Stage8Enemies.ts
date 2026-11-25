/**
 * Stage 8 · 配方控制中心 enemies (s8-2).
 * Numbers locked to the s8-2 ticket — do not retune here.
 * Art: tinted stand-ins until Manus stage8 sheets land (#157).
 *
 *  1. LabDrone     巡邏無人機 — hover → red warn → dive → open → rise
 *  2. TubeSoldier  試管兵     — close → raise tube → parabolic sticky flask
 *  3. FileCabinet  文件櫃怪   — front shield; door warn → ram → open belly
 */
import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { isActorFrozen } from '../fx'

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

/** Lab-night tints — distinct from stage7 warehouse browns. */
const TINT = {
  drone: 0x6ad0ff,
  tube: 0xc8a0ff,
  cabinet: 0xd0b070,
} as const

// ── ticket numbers ─────────────────────────────────────────────────────
const DRONE_HP = 6
const DRONE_HOVER_MIN = 40
const DRONE_HOVER_MAX = 60
const DRONE_ENGAGE = 160
const DRONE_WARN_MS = 1000
const DRONE_DIVE_SPEED = 200
const DRONE_DIVE_MS = 600
const DRONE_OPEN_MS = 1000
const DRONE_PATROL_HALF = 90
const DRONE_PATROL_SPEED = 55

const TUBE_HP = 6
const TUBE_RANGE = 180
const TUBE_WARN_MS = 1000
const TUBE_INTERVAL_MS = 3000
const TUBE_WALK = 36

const CAB_HP = 15
const CAB_WARN_MS = 1000
const CAB_CHARGE_DIST = 120
const CAB_OPEN_MS = 1200
const CAB_ENGAGE = 170
const CAB_WALK = 28
const CAB_CHARGE_SPEED = 220

export type TubeHooks = {
  floorY: () => number
  /** Parabolic tube: lands at most ±180 from thrower; dmg 1 + sticky puddle. */
  throwTube: (fromX: number, fromY: number, targetX: number) => void
}

// ── 巡邏無人機 ─────────────────────────────────────────────────────────

/** Hover patrol → red lamp warn 1000ms → dive 200px/s for 600ms → open 1000ms → rise. */
export class LabDrone extends AnimEnemy {
  private phase: 'patrol' | 'warn' | 'dive' | 'open' | 'rise' = 'patrol'
  private t = 0
  private hoverH: number
  private homeX: number
  private droneDir: 1 | -1 = 1
  private diveTo = { x: 0, y: 0 }
  private lamp: Phaser.GameObjects.Arc | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    const h = Phaser.Math.Between(DRONE_HOVER_MIN, DRONE_HOVER_MAX)
    super(scene, x, hooks.floorY() - h, 'beesoldier', hooks, 'fly')
    this.flying = true
    this.species = 's8drone'
    this.hp = this.maxHp = DRONE_HP
    this.hoverH = h
    this.homeX = x
    this.bodyBox(26, 22)
    this.setTint(TINT.drone)
    this.lamp = scene.add.circle(x, this.y - 14, 5, 0x204050, 0.9).setDepth(this.depth + 4)
  }

  protected override defaultTint() {
    return TINT.drone
  }

  canHurtPlayer() {
    return this.active && this.phase === 'dive' && !this.hitThis && this.fsm !== 'DEAD'
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.lamp?.setVisible(false)
      return
    }
    const now = this.scene.time.now
    if (isActorFrozen(this, now)) return
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('PATROL')
      this.syncLamp(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const floor = this.s2.floorY()
    const hoverY = floor - this.hoverH
    this.t += dt

    if (this.phase === 'patrol') {
      this.anim('fly')
      this.setTint(TINT.drone)
      // Bob + left/right around home.
      if (this.x > this.homeX + DRONE_PATROL_HALF) this.droneDir = -1
      if (this.x < this.homeX - DRONE_PATROL_HALF) this.droneDir = 1
      this.setVelocityX(this.droneDir * DRONE_PATROL_SPEED)
      this.y = hoverY + Math.sin(now / 280) * 3
      this.face(tgt.x - this.x)
      this.syncLamp(false)
      if (Math.abs(tgt.x - this.x) <= DRONE_ENGAGE && this.canEngageFromScreen()) {
        this.phase = 'warn'
        this.t = 0
        this.setVelocity(0, 0)
        this.anim('aim')
      }
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.y = hoverY
      this.face(tgt.x - this.x)
      const blink = Math.floor(now / 90) % 2 === 0
      this.setTint(blink ? 0xff4040 : TINT.drone)
      this.syncLamp(true, blink)
      if (this.t >= DRONE_WARN_MS) {
        this.setTint(TINT.drone)
        this.diveTo = { x: tgt.x, y: floor }
        this.phase = 'dive'
        this.t = 0
        this.hitThis = false
        this.anim('dive')
      }
    } else if (this.phase === 'dive') {
      this.syncLamp(false)
      const dx = this.diveTo.x - this.x
      const dy = this.diveTo.y - this.y
      const d = Math.hypot(dx, dy) || 1
      const vx = (dx / d) * DRONE_DIVE_SPEED
      const vy = (dy / d) * DRONE_DIVE_SPEED
      this.setVelocity(vx, 0)
      this.y += vy * (dt / 1000)
      this.face(dx)
      if (this.y >= floor - 1) this.y = floor
      if (this.t >= DRONE_DIVE_MS) {
        this.setVelocity(0, 0)
        this.phase = 'open'
        this.t = 0
        this.anim('stuck')
      }
    } else if (this.phase === 'open') {
      this.setVelocity(0, 0)
      this.syncLamp(false)
      if (this.t >= DRONE_OPEN_MS) {
        this.phase = 'rise'
        this.t = 0
        this.anim('fly')
      }
    } else {
      // rise back to patrol height
      this.setVelocity(0, 0)
      this.y -= 110 * (dt / 1000)
      this.syncLamp(false)
      if (this.y <= hoverY) {
        this.y = hoverY
        this.phase = 'patrol'
        this.t = 0
        this.homeX = this.x
      }
    }
    this.syncDepth()
  }

  private syncLamp(on: boolean, bright = false) {
    if (!this.lamp) return
    this.lamp.setVisible(true)
    this.lamp.setPosition(this.x, this.y - 14)
    this.lamp.setDepth(this.depth + 4)
    this.lamp.setFillStyle(on ? (bright ? 0xff2020 : 0xaa1010) : 0x204050, on ? 1 : 0.85)
    this.lamp.setRadius(on ? 6 : 4)
  }

  protected override die(dir: number) {
    this.lamp?.destroy()
    this.lamp = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.lamp?.destroy()
    this.lamp = null
    super.destroy(fromScene)
  }
}

// ── 試管兵 ─────────────────────────────────────────────────────────────

/** Walk in → stop at 180px → raise tube 1000ms → throw → cooldown 3000ms. */
export class TubeSoldier extends AnimEnemy {
  private phase: 'walk' | 'warn' | 'cool' = 'walk'
  private t = 0
  private th: TubeHooks
  private tubeGfx: Phaser.GameObjects.Graphics
  private warnMark: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, th: TubeHooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's8tube'
    this.th = th
    this.hp = this.maxHp = TUBE_HP
    this.hurtMs = 220
    this.bodyBox(28, 44)
    this.setTint(TINT.tube)
    this.tubeGfx = scene.add.graphics()
  }

  protected override defaultTint() {
    return TINT.tube
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
      this.tubeGfx.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.drawTube(false)
      return
    }
    this.setPosition(this.x, this.th.floorY())
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.drawTube(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.face(dx)
    this.t += dt

    if (this.phase === 'walk') {
      this.anim(Math.abs(dx) < TUBE_RANGE ? 'reach' : 'walk')
      if (Math.abs(dx) <= TUBE_RANGE) {
        this.setVelocity(0, 0)
        if (this.canEngageFromScreen()) {
          this.phase = 'warn'
          this.t = 0
          this.showWarn()
        }
      } else {
        this.setVelocityX(Math.sign(dx) * TUBE_WALK)
      }
      this.drawTube(false)
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.anim('reach')
      const blink = Math.floor(now / 100) % 2 === 0
      this.setTint(blink ? 0xffa0ff : TINT.tube)
      this.drawTube(true)
      this.warnMark?.setPosition(this.x, this.y - 58)
      if (this.t >= TUBE_WARN_MS) {
        this.setTint(TINT.tube)
        this.clearWarn()
        const aim = Phaser.Math.Clamp(tgt.x, this.x - TUBE_RANGE, this.x + TUBE_RANGE)
        this.th.throwTube(this.x + (this.flipX ? -12 : 12), this.y - 40, aim)
        this.phase = 'cool'
        this.t = 0
        this.drawTube(false)
      }
    } else {
      this.setVelocity(0, 0)
      this.anim('walk')
      this.anims.pause()
      this.drawTube(false)
      if (this.t >= TUBE_INTERVAL_MS) {
        this.anims.resume()
        // Re-engage if still in range; else walk again.
        this.phase = Math.abs(dx) <= TUBE_RANGE ? 'warn' : 'walk'
        this.t = 0
        if (this.phase === 'warn') this.showWarn()
      }
    }
    this.syncDepth()
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 58, '！', {
        fontSize: '16px',
        color: '#e8a0ff',
        stroke: '#201028',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 5)
  }

  private clearWarn() {
    this.warnMark?.destroy()
    this.warnMark = null
  }

  private drawTube(raised: boolean) {
    const g = this.tubeGfx
    g.clear()
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      g.setVisible(false)
      return
    }
    g.setVisible(true)
    const face = this.flipX ? -1 : 1
    const cx = this.x + face * (raised ? 10 : 14)
    const cy = this.y - (raised ? 48 : 30)
    // Glass tube stand-in
    g.fillStyle(0xd8f0ff, 0.85).fillRoundedRect(cx - 4, cy - 16, 8, 22, 2)
    g.lineStyle(1, 0x6080a0, 1).strokeRoundedRect(cx - 4, cy - 16, 8, 22, 2)
    g.fillStyle(0xc060ff, 0.9).fillRect(cx - 3, cy - 2, 6, 6)
    g.setDepth(this.depth + 2)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.tubeGfx.destroy()
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.tubeGfx?.destroy()
    super.destroy(fromScene)
  }
}

// ── 文件櫃怪 ───────────────────────────────────────────────────────────

/**
 * Front blocks like ShieldKeeper. Door warn 1000ms → ram 120px → open 1200ms
 * (front vulnerable while open).
 */
export class FileCabinet extends AnimEnemy {
  private phase: 'chase' | 'warn' | 'charge' | 'open' = 'chase'
  private t = 0
  private dir: 1 | -1 = 1
  private chargeFrom = 0
  private doorGfx: Phaser.GameObjects.Graphics
  private warnMark: Phaser.GameObjects.Text | null = null

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's8cabinet'
    this.hp = this.maxHp = CAB_HP
    this.hurtMs = 260
    this.bodyBox(34, 48)
    this.setTint(TINT.cabinet)
    this.doorGfx = scene.add.graphics()
  }

  protected override defaultTint() {
    return TINT.cabinet
  }

  /** Front blocks except during the post-charge open window. */
  blocks(dir: number) {
    if (this.fsm === 'HURT' || this.fsm === 'DEAD') return false
    if (this.phase === 'open') return false
    const face = this.flipX ? -1 : 1
    return dir === -face
  }

  canHurtPlayer() {
    return (
      this.active &&
      this.fsm !== 'DEAD' &&
      this.fsm !== 'HURT' &&
      this.phase === 'charge' &&
      this.contactCd <= 0
    )
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.doorGfx.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.drawDoor()
      return
    }
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.drawDoor()
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.t += dt

    if (this.phase === 'chase') {
      this.setFlipX(dx < 0)
      this.anim(Math.abs(dx) < 50 ? 'reach' : 'walk')
      this.setVelocityX(Math.abs(dx) < 10 ? 0 : Math.sign(dx) * CAB_WALK)
      if (Math.abs(dx) <= CAB_ENGAGE && Math.abs(dx) > 40 && this.canEngageFromScreen()) {
        this.phase = 'warn'
        this.t = 0
        this.dir = (Math.sign(dx) || 1) as 1 | -1
        this.setVelocity(0, 0)
        this.showWarn()
      }
      this.drawDoor()
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.setFlipX(this.dir < 0)
      this.anim('reach')
      const blink = Math.floor(now / 90) % 2 === 0
      this.setTint(blink ? 0xffe080 : TINT.cabinet)
      this.warnMark?.setPosition(this.x, this.y - 60)
      this.drawDoor(true)
      if (this.t >= CAB_WARN_MS) {
        this.setTint(TINT.cabinet)
        this.clearWarn()
        this.phase = 'charge'
        this.t = 0
        this.chargeFrom = this.x
        this.hitThis = false
        this.setFsm('ATTACK')
        this.anim('walk')
      }
    } else if (this.phase === 'charge') {
      this.setFlipX(this.dir < 0)
      this.setVelocityX(this.dir * CAB_CHARGE_SPEED)
      this.drawDoor(true)
      const traveled = Math.abs(this.x - this.chargeFrom)
      const body = this.body as Phaser.Physics.Arcade.Body
      if (traveled >= CAB_CHARGE_DIST || body.blocked.left || body.blocked.right || this.t > 2000) {
        this.phase = 'open'
        this.t = 0
        this.setFsm('CHASE')
        this.setVelocity(0, 0)
      }
    } else {
      // open — front is soft
      this.setVelocity(0, 0)
      this.anim('reach')
      this.drawDoor(false, true)
      if (this.t >= CAB_OPEN_MS) {
        this.phase = 'chase'
        this.t = 0
      }
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 60, '！', {
        fontSize: '16px',
        color: '#ffe080',
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

  private drawDoor(ajar = false, open = false) {
    const g = this.doorGfx
    g.clear()
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      g.setVisible(false)
      return
    }
    g.setVisible(true)
    const face = this.flipX ? -1 : 1
    const sx = this.x + face * 18
    const sy = this.y - 30
    const gap = open ? 14 : ajar ? 6 : 0
    // Cabinet face plate
    g.fillStyle(0xb89860, 1).fillRoundedRect(sx - 12, sy - 22, 24, 44, 2)
    g.lineStyle(2, 0x4a3820, 1).strokeRoundedRect(sx - 12, sy - 22, 24, 44, 2)
    // Door swing (gap shows soft belly)
    if (gap > 0) {
      g.fillStyle(0x3a2820, 1).fillRect(sx - face * 2, sy - 18, face * gap, 36)
    } else {
      g.fillStyle(0xc0a040, 1).fillCircle(sx + face * 6, sy, 3)
      g.lineStyle(1, 0x6a5030, 1).lineBetween(sx - 6, sy - 8, sx + 6, sy - 8)
      g.lineBetween(sx - 6, sy + 6, sx + 6, sy + 6)
    }
    g.setDepth(this.depth + 2)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.doorGfx.destroy()
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.doorGfx?.destroy()
    super.destroy(fromScene)
  }
}
