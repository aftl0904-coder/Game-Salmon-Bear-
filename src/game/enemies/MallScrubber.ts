import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { actorDepth } from '../engine/depth'
import { bossHitDamage } from '../engine/bossDamage'
import { isActorFrozen } from '../fx'
import type { HeroRef } from '../enemyAi'
import { DIRECTOR_HP } from './Stage6Enemies'

type Hero = HeroRef & { alive?: boolean; hurtLock?: number; body?: Phaser.Physics.Arcade.Body }
type Ctx = { boy: Hero; girl: Hero | null; leadX: number; prevLeadX: number }
type Act = 'intro' | 'scan' | 'reposition' | 'warn' | 'charge' | 'brush' | 'recover'
type Move = 'charge' | 'brush'
type Hooks = { floorY: () => number; bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void }

// Temporary original, text-free floor machine: tank, chassis, wheels, front scanner and brush.
// Not the unreviewed #91 spritesheet or a recoloured human.
function scrubberTexture(scene: Phaser.Scene) {
  const key = 'mall-scrubber-placeholder'
  if (scene.textures.exists(key)) return key
  const g = scene.make.graphics({ x: 0, y: 0 })
  g.fillStyle(0x111a2b).fillRoundedRect(6, 49, 101, 26, 9)
  g.fillStyle(0x48586a).fillRoundedRect(12, 22, 77, 39, 8)
  g.fillStyle(0xaebfc7).fillRoundedRect(17, 14, 54, 30, 7)
  g.fillStyle(0xd9e4e5).fillRect(22, 17, 43, 4)
  g.fillStyle(0x263f5c).fillRoundedRect(54, 30, 42, 29, 5)
  g.fillStyle(0x101b2b).fillCircle(87, 35, 10)
  g.fillStyle(0x69d6ea).fillCircle(87, 35, 6)
  g.fillStyle(0xe4faff).fillCircle(89, 33, 2)
  g.fillStyle(0x10131c).fillCircle(28, 69, 10).fillCircle(75, 69, 10)
  g.fillStyle(0x788d9c).fillCircle(28, 69, 4).fillCircle(75, 69, 4)
  g.fillStyle(0x172a41).fillRoundedRect(90, 54, 28, 13, 4)
  g.fillStyle(0x8bb7be).fillRect(91, 67, 25, 5)
  for (let x = 92; x <= 113; x += 5) g.fillStyle(0xd6e7e1).fillRect(x, 70, 2, 7)
  g.generateTexture(key, 120, 80)
  g.destroy()
  return key
}

const P = {
  1: { warn: 2100, charge: 135, recover: 1800 },
  2: { warn: 1900, charge: 150, recover: 1650 },
  3: { warn: 1750, charge: 170, recover: 1500 },
} as const
const CHARGE_DISTANCE = 120
const BODY_HALF = 44
const BRUSH_HALF = 58
const BRUSH_MS = 600

/** Stage 6 only. A warning is locked to a fixed envelope; no projectiles or drones. */
export class MallScrubber extends Enemy {
  species = 'mall-scrubber'
  kind = 'boss'
  boss = true
  flying = false
  qphase: 1 | 2 | 3 = 1
  act: Act = 'intro'
  onDefeated?: () => void
  readonly arenaX0: number
  readonly arenaX1: number
  private hooks6: Hooks
  private elapsed = 0
  private lastHitAt = -1000
  private move: Move = 'charge'
  private dir: 1 | -1 = -1
  private endX = 0
  private warning = { x0: 0, x1: 0 }
  private warnGraphic: Phaser.GameObjects.Graphics
  private marker: Phaser.GameObjects.Text
  private moveCount = 0
  private repositionX = 0
  private hitHeroes = new WeakSet<object>()

  constructor(scene: Phaser.Scene, x: number, x0: number, x1: number, hooks: Hooks) {
    super(scene, x, hooks.floorY(), scrubberTexture(scene))
    this.hooks6 = hooks
    this.arenaX0 = x0; this.arenaX1 = x1
    this.hp = this.maxHp = DIRECTOR_HP
    this.setOrigin(0.5, 1)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(BODY_HALF * 2, 61).setOffset(16, 19)
    this.warnGraphic = scene.add.graphics().setDepth(30)
    this.marker = scene.add.text(x, this.y - 100, '', { fontSize: '18px', color: '#fff2bb', stroke: '#42200b', strokeThickness: 4 }).setOrigin(0.5).setVisible(false)
  }

  override canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && (this.act === 'charge' || this.act === 'brush')
  }
  canHurtHero(hero: object) { return !this.hitHeroes.has(hero) }
  markHurtHero(hero: object) { this.hitHeroes.add(hero) }

  override receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.fsm === 'DEAD' || this.scene.time.now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = this.scene.time.now
    const hit = bossHitDamage(dmg, { weak: this.act === 'recover', weakBase: 3, capNormal: 2, capWeak: 5 })
    const x = this.x, y = this.y
    const result = super.receiveHit(hit, dir)
    this.setPosition(x, y).setVelocity(0, 0)
    if (result.killed) return result
    this.setFsm('PATROL')
    const fraction = this.hp / this.maxHp
    const phase = fraction < 0.3 ? 3 : fraction <= 0.66 ? 2 : 1
    if (phase > this.qphase) {
      this.qphase = phase
      this.hooks6.bossEvent(phase === 2 ? 'phase2' : 'phase3')
      this.recover()
    } else if (this.act === 'warn' || this.act === 'charge' || this.act === 'brush') this.recover()
    return result
  }

  private setAct(act: Act) { this.act = act; this.elapsed = 0 }
  private clearWarning() { this.warnGraphic.clear(); this.marker.setVisible(false) }
  // Phaser reset() places the body at the sprite top-left, without the offset.
  // Resync immediately and reset the frame snapshots too, so postUpdate does not
  // apply the offset as an extra movement before the next physics step.
  private syncBody() {
    const body = this.body as Phaser.Physics.Arcade.Body
    body.reset(this.x, this.y)
    body.updateFromGameObject()
    body.prev.copy(body.position)
    body.prevFrame.copy(body.position)
  }
  private restoreBody() {
    ;(this.body as Phaser.Physics.Arcade.Body).setSize(BODY_HALF * 2, 61).setOffset(16, 19)
    this.syncBody()
  }
  private recover() {
    this.setVelocity(0, 0); this.restoreBody(); this.clearWarning(); this.hitThis = false
    this.setFsm('PATROL'); this.setAct('recover')
    this.hooks6.bossEvent('weak')
  }

  /** Each live hero has a same-floor exit on either side within a conservative reaction budget.
   * The entire swept body is the danger interval; it is also exactly what is drawn. */
  private safeForAll(heroes: Hero[], x0: number, x1: number, warnMs: number) {
    const leftLimit = this.arenaX0 + 14, rightLimit = this.arenaX1 - 14
    // 105 px/s is the slower unmodified character; reserve 450 ms for reaction/reversal.
    const travel = Math.max(0, (warnMs - 450) * 0.105 - 12)
    return heroes.every((h) => {
      if ((h.hurtLock ?? 0) > 0) return false
      const half = Math.max(6, (h.body?.width ?? 12) / 2)
      const l = x0 - half - 3, r = x1 + half + 3
      if (h.x <= l || h.x >= r) return true
      return (l >= leftLimit && h.x - l <= travel) || (r <= rightLimit && r - h.x <= travel)
    })
  }

  private beginWarning(heroes: Hero[], target: Hero) {
    this.dir = (Math.sign(target.x - this.x) || -1) as 1 | -1
    this.setFlipX(this.dir < 0)
    this.move = this.qphase >= 2 && Math.abs(target.x - this.x) < 100 && this.moveCount % 2 === 1 ? 'brush' : 'charge'
    this.endX = Phaser.Math.Clamp(this.x + this.dir * CHARGE_DISTANCE, this.arenaX0 + BODY_HALF, this.arenaX1 - BODY_HALF)
    const half = this.move === 'brush' ? BRUSH_HALF : BODY_HALF
    const end = this.move === 'brush' ? this.x : this.endX
    this.warning = { x0: Math.min(this.x, end) - half, x1: Math.max(this.x, end) + half }
    if ((this.move === 'charge' && Math.abs(this.endX - this.x) < 30) || !this.safeForAll(heroes, this.warning.x0, this.warning.x1, P[this.qphase].warn)) {
      // No reachable exit: move away harmlessly, then reconsider with a fresh warning.
      this.repositionX = Phaser.Math.Clamp(this.x - this.dir * 60, this.arenaX0 + BODY_HALF, this.arenaX1 - BODY_HALF)
      this.setAct('reposition')
      return
    }
    this.moveCount++
    this.setAct('warn')
    this.warnGraphic.clear().fillStyle(0xffc857, 0.32).fillRect(this.warning.x0, this.y - 64, this.warning.x1 - this.warning.x0, 64)
      .lineStyle(3, 0xffe6a0, 1).strokeRect(this.warning.x0, this.y - 64, this.warning.x1 - this.warning.x0, 64)
    this.marker.setText(this.move === 'charge' ? (this.dir < 0 ? '！←' : '！→') : '！↻').setVisible(true)
  }

  override tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    if (isActorFrozen(this, this.scene.time.now)) { this.setVelocity(0, 0); return }
    // Bound dt for both state clock and movement: a long frame cannot skip a warning or overshoot it.
    const step = Math.min(Math.max(dt, 0), 50)
    this.elapsed += step
    this.setVelocity(0, 0)
    this.y = this.hooks6.floorY()
    const heroes = [ctx.boy, ctx.girl].filter((h): h is Hero => !!h && h.active && h.alive !== false)
    if (this.act === 'intro') {
      if (this.elapsed >= 1200) this.setAct('scan')
    } else if (this.act === 'scan') {
      if (heroes.length && this.elapsed >= 650) {
        const target = heroes.reduce((a, b) => Math.abs(a.x - this.x) <= Math.abs(b.x - this.x) ? a : b)
        this.beginWarning(heroes, target)
      }
    } else if (this.act === 'reposition') {
      const distance = this.repositionX - this.x
      const dx = Math.sign(distance) * Math.min(Math.abs(distance), 45 * step / 1000)
      this.setX(this.x + dx)
      this.syncBody()
      if (Math.abs(this.repositionX - this.x) < 0.1) this.setAct('scan')
    } else if (this.act === 'warn') {
      if (!heroes.length) this.recover()
      else if (this.elapsed >= P[this.qphase].warn) {
        this.clearWarning(); this.hitThis = false; this.hitHeroes = new WeakSet(); this.setFsm('ATTACK')
        if (this.move === 'brush') {
          ;(this.body as Phaser.Physics.Arcade.Body).setSize(BRUSH_HALF * 2, 61).setOffset(2, 19)
          this.syncBody()
        }
        this.setAct(this.move)
      }
    } else if (this.act === 'charge') {
      const delta = this.dir * P[this.qphase].charge * step / 1000
      const nx = this.dir < 0 ? Math.max(this.endX, this.x + delta) : Math.min(this.endX, this.x + delta)
      this.setX(nx)
      this.syncBody()
      if (Math.abs(this.x - this.endX) < 0.1) this.recover()
    } else if (this.act === 'brush') {
      if (this.elapsed >= BRUSH_MS) this.recover()
    } else if (this.elapsed >= P[this.qphase].recover) this.setAct('scan')
    this.setDepth(actorDepth('enemy', this.lane, this.y))
    this.marker.setPosition(this.x, this.y - 102).setDepth(this.depth + 2)
  }

  protected override die(_dir: number) {
    this.hp = 0; this.boss = false; this.clearWarning(); this.setVelocity(0, 0); this.setFsm('DEAD')
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.hooks6.bossEvent('defeat')
    this.scene.time.delayedCall(1800, () => {
      this.onDefeated?.()
      if (this.scene) this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }
  override destroy(fromScene?: boolean) { this.warnGraphic?.destroy(); this.marker?.destroy(); super.destroy(fromScene) }
}
