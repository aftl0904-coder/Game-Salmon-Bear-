import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { isActorFrozen } from '../fx'

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }
type GuardHooks = { floorY: () => number; spawnCoin?: (x: number, y: number) => void }

/** Temporary, original human silhouette. Not the unapproved #91 spritesheet. */
function guardTexture(scene: Phaser.Scene): string {
  const key = 'mall-human-guard-placeholder'
  if (scene.textures.exists(key)) return key
  const g = scene.make.graphics({ x: 0, y: 0 })
  // Distinct head, cap, jacket, arms and two legs: no zombie artwork or tint.
  g.fillStyle(0x101c31).fillRect(12, 2, 16, 5).fillRect(9, 6, 23, 3)
  g.fillStyle(0xd7a17f).fillRect(13, 9, 14, 11)
  g.fillStyle(0x202f4a).fillRect(10, 20, 20, 20).fillRect(6, 22, 5, 17).fillRect(29, 22, 5, 17)
  g.fillStyle(0x405a7d).fillRect(13, 22, 14, 3).fillRect(18, 25, 2, 12)
  g.fillStyle(0xd7a17f).fillRect(6, 37, 5, 4).fillRect(29, 37, 5, 4)
  g.fillStyle(0x18243a).fillRect(11, 40, 8, 13).fillRect(21, 40, 8, 13)
  g.fillStyle(0x0c1422).fillRect(9, 52, 10, 4).fillRect(21, 52, 10, 4)
  g.generateTexture(key, 40, 58)
  g.destroy()
  return key
}

/** Stage 6 only; separate from GuardZombie to avoid changing stage 7's shared template. */
export class MallGuard extends Enemy {
  species = 'guard'
  kind = 'blocker'
  boss = false
  flying = false
  phase: 'approach' | 'windup' | 'strike' | 'recover' = 'approach'
  private elapsed = 0
  private dir: 1 | -1 = -1
  private marker: Phaser.GameObjects.Text
  private gh: GuardHooks

  constructor(scene: Phaser.Scene, x: number, hooks: GuardHooks) {
    super(scene, x, hooks.floorY(), guardTexture(scene))
    this.gh = hooks
    this.hooks.spawnCoin = hooks.spawnCoin
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 3
    this.hurtMs = 260
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(26, 46).setOffset(7, 12)
    this.marker = scene.add.text(x, this.y - 77, '！', { fontSize: '20px', color: '#fff3ad', stroke: '#402010', strokeThickness: 3 }).setOrigin(0.5).setVisible(false)
    // PATROL prevents the generic pit-hop from taking this human over an edge.
    this.setFsm('PATROL')
  }

  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.fsm !== 'HURT' && this.phase === 'strike' && !this.hitThis
  }

  override receiveHit(dmg: number, dir: number): EnemyHitResult {
    this.marker.setVisible(false)
    this.phase = 'recover'
    this.elapsed = 0
    this.restoreBody()
    const result = super.receiveHit(dmg, dir)
    this.setVelocity(0, 0)
    return result
  }

  private restoreBody() {
    ;(this.body as Phaser.Physics.Arcade.Body).setSize(26, 46).setOffset(7, 12)
  }

  override tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    if (isActorFrozen(this, this.scene.time.now)) return
    this.y = this.gh.floorY()
    if (this.fsm === 'HURT') {
      this.setVelocity(0, 0)
      this.think -= dt
      if (this.think <= 0) this.setFsm('PATROL')
      return
    }
    this.elapsed += Math.min(dt, 50)
    const target = pickTarget(this, ctx.boy, ctx.girl)
    const dx = target.x - this.x
    if (this.phase === 'approach') {
      this.dir = (Math.sign(dx) || -1) as 1 | -1
      this.setFlipX(this.dir < 0)
      this.setVelocityX(Math.abs(dx) < 38 || Math.abs(dx) > 220 ? 0 : this.dir * 38)
      if (Math.abs(dx) < 38) {
        this.setVelocityX(0)
        this.phase = 'windup'
        this.elapsed = 0
        this.marker.setText(this.dir < 0 ? '！←' : '！→')
        this.marker.setVisible(true)
      }
    } else if (this.phase === 'windup') {
      this.setVelocityX(0)
      if (this.elapsed >= 800) {
        this.marker.setVisible(false)
        this.phase = 'strike'
        this.elapsed = 0
        this.hitThis = false
        this.setFsm('ATTACK')
        // A stationary reach: movement integrated by Arcade under a long frame could
        // otherwise extend a nominally short lunge far beyond the warning.
        ;(this.body as Phaser.Physics.Arcade.Body).setSize(40, 46).setOffset(this.dir < 0 ? -7 : 7, 12)
      }
    } else if (this.phase === 'strike') {
      this.setVelocityX(0)
      if (this.elapsed >= 160) {
        this.setVelocityX(0)
        this.restoreBody()
        this.setFsm('PATROL')
        this.phase = 'recover'
        this.elapsed = 0
      }
    } else {
      this.setVelocityX(0)
      if (this.elapsed >= 800) {
        this.phase = 'approach'
        this.elapsed = 0
      }
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
    this.marker.setPosition(this.x, this.y - 77).setDepth(this.depth + 1)
  }

  override destroy(fromScene?: boolean) {
    this.marker?.destroy()
    super.destroy(fromScene)
  }
}
