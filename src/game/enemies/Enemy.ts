import Phaser from 'phaser'
import { LANE_DEFAULT, type LaneId } from '../engine/lanes'

/** Expandable enemy FSM (macro states). */
export type EnemyFsm = 'PATROL' | 'CHASE' | 'ATTACK' | 'HURT' | 'DEAD'
export type AttackMode = 'melee' | 'projectile'
export type EnemyHitResult = { killed: boolean; hp: number }
export type EnemySpawnCoin = (x: number, y: number) => void
export type EnemyHooks = {
  spawnCoin?: EnemySpawnCoin
  floatBang?: (x: number, y: number, msg?: string) => void
  spawnProjectile?: (e: Enemy, dir: 1 | -1) => void
  telegraph?: (e: Enemy, kind: 'windup' | 'ambush') => void
}

/**
 * Base arcade enemy — HP, knockback hurt, death → coin, expandable FSM.
 * Prefer collider for solids; overlap for attack / hurt hitboxes (wired in scene).
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  fsm: EnemyFsm = 'PATROL'
  hp = 1
  maxHp = 1
  baseScale = 1
  patrolDir: 1 | -1 = 1
  hitThis = false
  contactCd = 0
  attackMode: AttackMode = 'melee'
  detectRadius = 300
  aggroRadius = 240
  meleeRadius = 52
  hurtMs = 280
  think = 0
  poseAngle = 0
  label?: Phaser.GameObjects.Text
  lane: LaneId = LANE_DEFAULT
  hooks: EnemyHooks = {}
  groundGroup: Phaser.Physics.Arcade.StaticGroup | null = null
  /** Opening blocker: auto-aggro when heroes enter radius. */
  earlyAggro = false
  /** Altar climax ambusher: longer red telegraph + ambush shout. */
  altarAmbush = false

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture)
    scene.add.existing(this)
    scene.physics.add.existing(this)
  }

  get isDead(): boolean {
    return this.fsm === 'DEAD' || !this.active
  }

  setFsm(next: EnemyFsm) {
    if (this.fsm === next) return
    const prev = this.fsm
    this.fsm = next
    this.onEnterFsm(next, prev)
  }

  protected onEnterFsm(_next: EnemyFsm, _prev: EnemyFsm) {}

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.fsm === 'DEAD') return { killed: false, hp: this.hp }
    this.hp -= dmg
    // Goemon knockback lean — heavier push + white flash pose
    this.setVelocityX(dir * (dmg >= 2 ? 340 : 280))
    this.setVelocityY(dmg >= 2 ? -280 : -230)
    this.setTint(0xffffff)
    this.poseAngle = 0
    this.setAngle(0)
    this.setScale(this.baseScale)
    this.think = this.hurtMs
    this.hitThis = false
    this.setFsm('HURT')
    const tintRestore = this.defaultTint()
    this.scene.time.delayedCall(90, () => {
      if (!this.active || this.fsm === 'DEAD') return
      this.clearTint()
      if (tintRestore !== undefined) this.setTint(tintRestore)
    })
    if (this.hp <= 0) {
      this.die(dir)
      return { killed: true, hp: 0 }
    }
    return { killed: false, hp: this.hp }
  }

  protected defaultTint(): number | undefined {
    return undefined
  }

  protected die(dir: number) {
    this.hp = 0
    this.poseAngle = dir * 85
    this.setAngle(this.poseAngle)
    this.setTint(0x884444)
    this.setVelocity(dir * 80, -120)
    this.setFsm('DEAD')
    const coinX = this.x
    const coinY = this.y - 28
    this.scene.time.delayedCall(280, () => {
      this.hooks.spawnCoin?.(coinX, coinY)
      this.label?.destroy()
      this.label = undefined
      this.disableBody(true, true)
      this.destroy()
    })
  }

  canHurtPlayer(): boolean {
    if (!this.active || this.fsm === 'DEAD' || this.fsm === 'HURT') return false
    if (this.hitThis) return false
    return this.fsm === 'ATTACK' || this.fsm === 'CHASE' || this.fsm === 'PATROL'
  }

  protected hasGroundAhead(lookAhead = 16, drop = 10): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body || !this.groundGroup) return true
    const probeX = this.x + this.patrolDir * (body.width * 0.5 + lookAhead)
    const probeY = body.bottom + drop
    for (const child of this.groundGroup.getChildren()) {
      const tile = child as Phaser.Physics.Arcade.Sprite
      const b = tile.body as Phaser.Physics.Arcade.StaticBody | null
      if (!b) continue
      if (probeX >= b.left && probeX <= b.right && probeY >= b.top - 2 && probeY <= b.bottom + 12) {
        return true
      }
    }
    return false
  }

  protected hitWallAhead(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return false
    if (this.patrolDir < 0 && body.blocked.left) return true
    if (this.patrolDir > 0 && body.blocked.right) return true
    return false
  }

  protected reverseIfBlockedOrCliff() {
    const body = this.body as Phaser.Physics.Arcade.Body | null
    const laneWalk = body && !body.allowGravity
    if (this.hitWallAhead() || (!laneWalk && !this.hasGroundAhead())) {
      this.patrolDir = (this.patrolDir === 1 ? -1 : 1) as 1 | -1
    }
  }

  tick(_dt: number, _ctx: EnemyTickCtx) {}
}

export type EnemyTickCtx = {
  boy: { x: number; y: number; active: boolean; lane?: number }
  girl: { x: number; y: number; active: boolean; lane?: number }
  leadX: number
  prevLeadX: number
}
