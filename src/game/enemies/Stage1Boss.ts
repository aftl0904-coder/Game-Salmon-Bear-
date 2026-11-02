import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { bossHitDamage } from '../engine/bossDamage'

/**
 * 武者王 — stage 1's mini-boss at the altar. He is the ordinary 帽仔兵 (the 'hatsoldier'
 * set, so no new art) blown up to 1.5× and given a three-phase fight written the same way as
 * 泥鬃 (Stage4Enemies.ts): qphase, an act state machine in tick(), a weak window with ×3
 * damage, and the same reveal / HP bar / bossEvent plumbing in GameScene.
 *
 *  P1 (100–67%)  barrel throws every 1.8 s, same low/high rhythm the three barrel soldiers teach.
 *  P2 (67–34%)   throws every 1.2 s, plus a telegraphed dash; calls two altar guards.
 *  P3 (<34%)     berserk: 3-barrel fan alternating with the dash; the dash leaves him exposed;
 *                calls the last two altar guards.
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
const THROW_GAP: Record<1 | 2 | 3, number> = { 1: 1800, 2: 1200, 3: 700 }
const THROW_RELEASE_MS = 250
const THROW_TOTAL_MS = 500
const WINDUP_MS = 400
const DASH_SPEED = 340
const DASH_MAX_MS = 650
const RECOVER_MS = 450
const EXPOSED_MS = 1500

type Act = 'intro' | 'stalk' | 'throw' | 'fan' | 'windup' | 'dash' | 'recover' | 'exposed'

/** hatsoldier has walk / throw-low / throw-high / hit / die — no idle, so he paces while waiting. */
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
  private t = 0
  private stalkLeft = 1400
  private throwN = 0
  private throwsSinceDash = 0
  private p3Step = 0
  private released = false
  private dashDir: 1 | -1 = -1
  private lastHitAt = 0
  private kh: KingHooks
  private summoned = { p2: false, p3: false }

  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, kh: KingHooks) {
    super(scene, x, kh.floorY(), 'hatsoldier', { floorY: kh.floorY }, 'walk')
    this.species = 'warriorking'
    this.kind = 'boss'
    this.boss = true
    this.kh = kh
    this.hp = this.maxHp = KING_HP
    this.hurtMs = 160
    this.baseScale = KING_SCALE
    this.setScale(KING_SCALE)
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.bodyBox(40, 58)
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (this.act === 'intro' || this.act === 'recover' || this.act === 'exposed' || this.act === 'windup') return false
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
    const next: 1 | 2 | 3 = f <= 0.34 ? 3 : f <= 0.67 ? 2 : 1
    if (next <= this.qphase) return
    this.qphase = next
    this.kh.bossEvent(next === 2 ? 'phase2' : 'phase3')
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
    this.go('stalk')
    this.stalkLeft = 900
  }

  private go(a: Act) {
    this.act = a
    this.t = 0
    this.released = false
    this.clearTint()
    this.setVelocity(0, 0)
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
    this.kh.bossEvent('defeat')
    this.scene.time.delayedCall(1600, () => {
      this.onDefeated?.()
      if (!this.scene) return
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }

  private release(shots: Array<{ vy: number; high: boolean }>, vx: number, dir: 1 | -1) {
    const floor = this.kh.floorY()
    for (const s of shots) {
      this.kh.throwBarrel(this.x + dir * 30, floor - (s.high ? 24 : 9), dir, vx, s.vy, s.high)
    }
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.t += dt
    this.y = this.kh.floorY()
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    const toward = (Math.sign(dx) || -1) as 1 | -1
    const x0 = this.arenaX0 + 24
    const x1 = this.arenaX1 - 24

    switch (this.act) {
      case 'intro':
        this.setFlipX(dx < 0)
        if (this.t > 1200) this.go('stalk')
        break

      case 'stalk': {
        this.setFlipX(dx < 0)
        const dist = Math.abs(dx)
        if (dist > 230) this.setVelocityX(toward * 55)
        else if (dist < 130 && this.x > x0 + 4 && this.x < x1 - 4) this.setVelocityX(-toward * 55)
        else this.setVelocityX(0)
        this.stalkLeft -= dt
        if (this.stalkLeft > 0) break
        if (this.qphase === 1) this.go('throw')
        else if (this.qphase === 2) {
          if (this.throwsSinceDash >= 3) this.go('windup')
          else this.go('throw')
        } else if (this.p3Step === 0) {
          this.p3Step = 1
          this.go('fan')
        } else {
          this.p3Step = 0
          this.go('windup')
        }
        break
      }

      case 'throw': {
        this.setFlipX(dx < 0)
        if (!this.released && this.t >= THROW_RELEASE_MS) {
          this.released = true
          const high = this.throwN % 2 === 1
          this.throwN++
          this.release([{ vy: 0, high }], this.qphase === 1 ? 170 : 190, toward)
        }
        if (this.t >= THROW_TOTAL_MS) {
          this.throwsSinceDash++
          this.stalkLeft = Math.max(200, THROW_GAP[this.qphase] - THROW_TOTAL_MS)
          this.go('stalk')
        }
        break
      }

      case 'fan':
        this.setFlipX(dx < 0)
        if (!this.released && this.t >= THROW_RELEASE_MS) {
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
        if (this.t >= THROW_TOTAL_MS + 100) {
          this.stalkLeft = THROW_GAP[3]
          this.go('stalk')
        }
        break

      case 'windup':
        this.setFlipX(dx < 0)
        this.setTint(0xff9060)
        if (this.t >= WINDUP_MS) {
          this.dashDir = toward
          this.go('dash')
          this.setFsm('ATTACK')
          this.hitThis = false
        }
        break

      case 'dash': {
        this.setFlipX(this.dashDir < 0)
        this.x = Phaser.Math.Clamp(this.x + this.dashDir * DASH_SPEED * (dt / 1000), x0, x1)
        const wall = this.x <= x0 || this.x >= x1
        if (wall || this.t >= DASH_MAX_MS) {
          this.throwsSinceDash = 0
          if (this.qphase === 3) {
            this.go('exposed')
            this.kh.bossEvent('weak')
          } else {
            this.go('recover')
          }
        }
        break
      }

      case 'recover':
        if (this.t >= RECOVER_MS) {
          this.stalkLeft = 500
          this.go('stalk')
        }
        break

      case 'exposed':
        this.setTint(0xffe060)
        if (this.t >= EXPOSED_MS) {
          this.stalkLeft = 600
          this.go('stalk')
        }
        break
    }
    this.x = Phaser.Math.Clamp(this.x, x0, x1)
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}
