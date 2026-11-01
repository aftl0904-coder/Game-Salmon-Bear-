import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { isActorFrozen } from '../fx'
import { actorDepth } from '../engine/depth'
import { bossHitDamage } from '../engine/bossDamage'

/**
 * Stage 4 · 鹽霧工地 cast: 蜜僵 (slow shambling zombie, groups), 的士怪 (headlight-warn
 * then high-speed charge), 打卡鐘怪 (countdown then a radial paper burst), and the boss
 * 泥鬃 (motorcycle foreman).
 *
 * All four run on real frame animation (art-src/anim/enemies/E-11..E-13 and boss/mudmane →
 * scripts/art/slice_stage4mobs.py / slice_mudmane.py → the 'honeyzombie' / 'taximonster' /
 * 'clockpunch' / 'mudmane' anim sets, via AnimEnemy). They drop in through GameScene.addS2Enemy
 * exactly like the stage 2/3 cast.
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

// ── 蜜僵 ─────────────────────────────────────────────────────────────────

/** Shambles slowly towards the nearest hero; hits leave a sticky honey puddle underfoot. */
export class HoneyZombie extends AnimEnemy {
  onSplatter?: (x: number) => void
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 'honeyzombie'
    this.hp = this.maxHp = 2
    this.hurtMs = 260
    this.bodyBox(30, 44)
  }
  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.fsm !== 'HURT' && this.contactCd <= 0
  }
  receiveHit(dmg: number, dir: number): EnemyHitResult {
    this.onSplatter?.(this.x)
    return super.receiveHit(dmg, dir)
  }
  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) return
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.setFlipX(dx < 0)
    const near = Math.abs(dx) < 46
    this.anim(near ? 'reach' : 'walk')
    this.setVelocityX(Math.sign(dx) * (near ? 8 : 16))
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}

// ── 的士怪 ───────────────────────────────────────────────────────────────

/** Headlights flash as a 0.6 s warning, then a fast charge; stuns itself on the wall. */
export class TaxiMonster extends AnimEnemy {
  private phase: 'idle' | 'warn' | 'charge' | 'stun' = 'idle'
  private t = 0
  private dir: 1 | -1 = 1
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'taximonster', hooks, 'idle')
    this.species = 'taximonster'
    this.hp = this.maxHp = 3
    this.hurtMs = 260
    this.bodyBox(64, 34)
  }
  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.phase === 'charge'
  }
  receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.phase === 'charge') return { killed: false, hp: this.hp }
    const r = super.receiveHit(dmg, dir)
    this.phase = 'idle'
    this.t = 0
    return r
  }
  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) return
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.t += dt
    if (this.phase === 'idle') {
      this.anim('idle')
      this.setVelocity(0, 0)
      this.setFlipX(dx < 0)
      if (Math.abs(dx) < 260 && Math.abs(dx) > 40) {
        this.phase = 'warn'
        this.t = 0
        this.dir = (Math.sign(dx) || 1) as 1 | -1
      }
    } else if (this.phase === 'warn') {
      this.anim('flash')
      if (this.t > 600) {
        this.phase = 'charge'
        this.t = 0
        this.setFsm('ATTACK')
        this.hitThis = false
        this.anim('dash')
        this.setVelocityX(this.dir * 260)
      }
    } else if (this.phase === 'charge') {
      const body = this.body as Phaser.Physics.Arcade.Body
      if (body.blocked.left || body.blocked.right || this.t > 1400) {
        this.phase = 'stun'
        this.t = 0
        this.setFsm('CHASE')
        this.setVelocity(0, 0)
        this.anim('crash')
      }
    } else {
      this.setVelocity(0, 0)
      if (this.t > 1800) {
        this.phase = 'idle'
        this.t = 0
      }
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}

// ── 打卡鐘怪 ─────────────────────────────────────────────────────────────

export type ClockHooks = { burst: (x: number, y: number) => void }

/** Ticks down for 3 s, then flings documents in eight directions; harmless to touch. */
export class ClockPunch extends AnimEnemy {
  private ch: ClockHooks
  private phase: 'count' | 'burst' | 'cool' = 'count'
  private t = 0
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, ch: ClockHooks) {
    super(scene, x, hooks.floorY(), 'clockpunch', hooks, 'walk')
    this.species = 'clockpunch'
    this.ch = ch
    this.hp = this.maxHp = 2
    this.hurtMs = 220
    this.bodyBox(34, 44)
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
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    if (isActorFrozen(this, now)) return
    this.y = this.s2.floorY()
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('PATROL')
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    this.setFlipX(tgt.x < this.x)
    this.t += dt
    if (this.phase === 'count') {
      // The last second glows: that is the cue to get out of the way.
      this.anim(this.t > 2000 ? 'tick' : 'walk')
      if (this.t > 3000) {
        this.phase = 'burst'
        this.t = 0
        this.anim('burst')
        this.ch.burst(this.x, this.y - 18)
      }
    } else if (this.phase === 'burst') {
      if (this.t > 340) {
        this.phase = 'cool'
        this.t = 0
      }
    } else {
      if (this.t > 900) {
        this.phase = 'count'
        this.t = 0
        this.anim('walk')
      }
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}

// ── 泥鬃 (Boss) ──────────────────────────────────────────────────────────

export type MudHooks = {
  floorY: () => number
  /** A low mud wave sweeps the ground in front of the charge — jump to avoid. */
  mudWave: (x0: number, x1: number, dir: 1 | -1) => void
  spawnZombie: (x: number) => void
  nail: (x: number, y: number, dir: 1 | -1, high: boolean) => void
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

/** Which of the boss's animations each act plays (data/anim/mudmane.json). */
const MUD_ANIM: Record<MudMane['act'], string> = {
  intro: 'ride',
  anticip: 'ride',
  charge: 'charge',
  recover: 'ride',
  platform: 'walk',
  summon: 'summon',
  volley: 'nailgun',
  approach: 'walk',
  windup: 'windup',
  strike: 'strike',
  exposed: 'hurt',
}

export class MudMane extends AnimEnemy {
  qphase: 1 | 2 | 3 = 1
  private act: 'intro' | 'anticip' | 'charge' | 'recover' | 'platform' | 'summon' | 'volley' | 'approach' | 'windup' | 'strike' | 'exposed' = 'intro'
  private t = 0
  private dirX: 1 | -1 = -1
  arenaX0 = 0
  arenaX1 = 0
  private lastHitAt = 0
  private nailsThrown = 0
  private mh: MudHooks
  onDefeated?: () => void
  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, mh: MudHooks) {
    super(scene, x, mh.floorY(), 'mudmane', { floorY: mh.floorY }, 'ride')
    this.species = 'mudmane'
    this.kind = 'boss'
    this.boss = true
    this.mh = mh
    this.hp = this.maxHp = 40
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.box(44, 56)
  }
  /** Hit volume over the torso; the charge swaps in a wide one that covers the bike. */
  private box(w: number, h: number) {
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(w, h)
    body.setOffset((this.frame.width - w) / 2, this.frame.height - h - 4)
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
    if (next !== this.qphase) {
      this.qphase = next
      this.mh.bossEvent(next === 2 ? 'phase2' : 'phase3')
      this.go(next === 2 ? 'platform' : 'approach')
    }
  }
  private go(a: MudMane['act']) {
    this.act = a
    this.t = 0
    this.anim(MUD_ANIM[a])
    this.box(a === 'charge' ? 96 : 44, a === 'charge' ? 50 : 56)
  }
  protected override die(_dir: number) {
    this.hp = 0
    this.act = 'intro'
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.clearTint()
    this.anim('defeat')
    this.mh.bossEvent('defeat')
    this.scene.time.delayedCall(1600, () => this.onDefeated?.())
  }
  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.t += dt
    const floor = this.mh.floorY()
    this.y = floor
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    switch (this.act) {
      case 'intro':
        if (this.t > 1200) this.go('anticip')
        break
      // ── Phase 1: 衝撞 (motorcycle charge) ──
      case 'anticip':
        this.setTint(0xffd8a0)
        this.setFlipX(this.dirX < 0)
        if (this.t > 700) {
          this.clearTint()
          this.dirX = (Math.sign(tgt.x - this.x) || this.dirX) as 1 | -1
          this.mh.mudWave(this.arenaX0, this.arenaX1, this.dirX)
          this.go('charge')
        }
        break
      case 'charge':
        this.setFlipX(this.dirX < 0)
        this.x = Phaser.Math.Clamp(this.x + this.dirX * 300 * (dt / 1000), this.arenaX0 + 20, this.arenaX1 - 20)
        if (this.x <= this.arenaX0 + 20 || this.x >= this.arenaX1 - 20 || this.t > 1600) {
          this.dirX = (this.dirX * -1) as 1 | -1
          this.go('recover')
        }
        break
      case 'recover':
        if (this.t > 500) this.go('anticip')
        break
      // ── Phase 2: 蜜僵潮＋釘槍 ──
      case 'platform':
        this.x += Phaser.Math.Clamp((this.arenaX0 + this.arenaX1) / 2 - this.x, -120 * (dt / 1000), 120 * (dt / 1000))
        this.setFlipX(tgt.x < this.x)
        if (this.t > 400) this.go('summon')
        break
      case 'summon':
        if (this.t > 300 && this.t - dt <= 300) this.mh.spawnZombie(this.arenaX0 + 30)
        if (this.t > 700 && this.t - dt <= 700) this.mh.spawnZombie(this.arenaX1 - 30)
        if (this.t > 1400) {
          this.nailsThrown = 0
          this.go('volley')
        }
        break
      case 'volley':
        if (this.t > 220 * (this.nailsThrown + 1) && this.nailsThrown < 4) {
          const dir = (Math.sign(tgt.x - this.x) || 1) as 1 | -1
          this.mh.nail(this.x, floor - 10, dir, this.nailsThrown % 2 === 0)
          this.nailsThrown++
        }
        if (this.nailsThrown >= 4 && this.t > 1200) this.go('platform')
        break
      // ── Phase 3: 肉搏 ──
      case 'approach': {
        const dx = tgt.x - this.x
        this.setFlipX(dx < 0)
        if (Math.abs(dx) > 50) this.setVelocityX(Math.sign(dx) * 70)
        else {
          this.setVelocityX(0)
          this.go('windup')
        }
        if (this.t > 2200) this.go('windup')
        break
      }
      case 'windup':
        this.setVelocity(0, 0)
        this.setTint(0xff9060)
        if (this.t > 420) {
          this.clearTint()
          this.go('strike')
          this.setFsm('ATTACK')
          this.hitThis = false
          this.setVelocityX((this.flipX ? -1 : 1) * 220)
        }
        break
      case 'strike':
        if (this.t > 260) {
          this.setVelocity(0, 0)
          this.go('exposed')
          this.mh.bossEvent('weak')
        }
        break
      case 'exposed':
        this.setTint(0xffe060)
        if (this.t > 1600) {
          this.clearTint()
          this.go('approach')
        }
        break
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}
