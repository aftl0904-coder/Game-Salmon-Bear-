import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { ANIM_SETS, animTex, hasAnimSet, type AnimSetId } from '../heroAnims'
import { actorDepth } from '../engine/depth'
import { pickTarget, type HeroRef } from '../enemyAi'
import { isActorFrozen } from '../fx'

/**
 * Stage 2 · 蜜樹丘 cast: 蜜蜂兵 (diving flyer), 蜜僵松鼠 (slow shambler, groups),
 * 小蜜蜂 (from eggs / swarms), 假蜜蛋 (hatches unless broken) and the boss 蜜冠女王蜂.
 * All share AnimEnemy: Cursor frame animations + a detached death sprite.
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

export type Stage2Hooks = {
  spawnCoin?: (x: number, y: number) => void
  floorY: () => number
  /** Spawn a mini bee (eggs hatching, queen swarm). */
  spawnMiniBee?: (x: number, y: number, dir: 1 | -1) => void
  /** Queen: lay an egg at x. */
  spawnEgg?: (x: number) => void
  /** Queen: fake-honey stream towards dir (hazard + puddle). */
  spray?: (x: number, y: number, dir: 1 | -1) => void
  /** Queen: phase banner / shake. */
  bossEvent?: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat', q: QueenBee) => void
}

export class AnimEnemy extends Enemy {
  set: AnimSetId
  flying = false
  /** Stage-2 hooks (set by GameScene factory). */
  s2: Stage2Hooks
  private animName = ''
  /** Matches PatrolEnemy's fields that GameScene reads. */
  species = 'stage2'
  kind = 'blocker'
  boss = false

  constructor(scene: Phaser.Scene, x: number, y: number, set: AnimSetId, hooks: Stage2Hooks, first: string) {
    const ok = hasAnimSet(scene, set)
    super(scene, x, y, ok ? animTex(set) : 'coin', ok ? ANIM_SETS[set].anims[first]?.start ?? 0 : undefined)
    this.set = set
    this.s2 = hooks
    this.setOrigin(0.5, 1)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    this.anim(first)
  }

  /** Play `<set>-<name>` once per state change (loops loop, one-shots hold their last frame). */
  anim(name: string) {
    if (this.animName === name) return
    const key = `${this.set}-${name}`
    if (!this.scene?.anims.exists(key)) return
    this.animName = name
    this.play(key)
  }

  /** Eggs have their own break frames instead of the shared death sprite. */
  protected corpseOnDeath = true

  protected bodyBox(w: number, h: number) {
    const body = this.body as Phaser.Physics.Arcade.Body
    const fw = this.frame.width
    const fh = this.frame.height
    body.setSize(w, h)
    body.setOffset((fw - w) / 2, fh - h - 2)
  }

  protected face(dir: number) {
    if (dir) this.setFlipX(dir < 0)
  }

  protected target(ctx: Ctx) {
    return pickTarget(this, ctx.boy, ctx.girl)
  }

  protected override die(dir: number) {
    const key = `${this.set}-die`
    if (this.corpseOnDeath && this.scene?.anims.exists(key)) {
      const corpse = this.scene.add
        .sprite(this.x, this.y, animTex(this.set))
        .setOrigin(0.5, 1)
        .setFlipX(this.flipX)
        .setDepth(this.depth)
      corpse.play(key)
      if (this.flying) this.scene.tweens.add({ targets: corpse, y: this.s2.floorY(), duration: 420, ease: 'Quad.in' })
      corpse.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        corpse.scene?.tweens.add({ targets: corpse, alpha: 0, delay: 300, duration: 300, onComplete: () => corpse.destroy() })
      })
    }
    super.die(dir)
    this.setVisible(false)
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const r = super.receiveHit(dmg, dir)
    if (this.flying && this.body) {
      // Flyers get knocked sideways only (no hop into the canopy).
      this.setVelocity(dir * 120, 0)
    }
    if (!r.killed) this.anim('hit')
    return r
  }

  protected syncDepth() {
    this.setDepth(actorDepth('enemy', this.lane, this.flying ? this.s2.floorY() : this.y))
  }
}

// ── 蜜蜂兵 ───────────────────────────────────────────────────────────────

/** Hovers above the path, aims, dives at where the hero stood, sticks in the bark (punish!), flies back up. */
export class BeeSoldier extends AnimEnemy {
  private phase: 'hover' | 'aim' | 'dive' | 'stuck' | 'rise' = 'hover'
  private t = 0
  private hoverY = 0
  private diveTo = { x: 0, y: 0 }
  private cd = 1200

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY() - 92, 'beesoldier', hooks, 'fly')
    this.flying = true
    this.hp = this.maxHp = 1
    this.hoverY = this.y
    this.bodyBox(26, 22)
    this.cd = Phaser.Math.Between(900, 1600)
  }

  canHurtPlayer() {
    return this.active && this.phase === 'dive' && !this.hitThis && this.fsm !== 'DEAD'
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    if (isActorFrozen(this, now)) return
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('PATROL')
      return
    }
    const tgt = this.target(ctx)
    const floor = this.s2.floorY()
    this.t += dt
    if (this.phase === 'hover') {
      this.anim('fly')
      // Drift to sit a little ahead of the hero, bob gently.
      const want = tgt.x + (this.x > tgt.x ? 70 : -70)
      this.setVelocityX(Phaser.Math.Clamp((want - this.x) * 1.6, -70, 70))
      this.y = this.hoverY + Math.sin(now / 260) * 4
      this.face(tgt.x - this.x)
      this.cd -= dt
      if (this.cd <= 0 && Math.abs(tgt.x - this.x) < 150) {
        this.phase = 'aim'
        this.t = 0
        this.setVelocityX(0)
        this.anim('aim')
        this.setTint(0xff9090)
      }
    } else if (this.phase === 'aim') {
      this.face(tgt.x - this.x)
      if (this.t > 520) {
        this.clearTint()
        this.diveTo = { x: tgt.x, y: floor }
        this.phase = 'dive'
        this.hitThis = false
        this.t = 0
        this.anim('dive')
      }
    } else if (this.phase === 'dive') {
      const dx = this.diveTo.x - this.x
      const dy = this.diveTo.y - this.y
      const d = Math.hypot(dx, dy) || 1
      const sp = 280
      this.setVelocity((dx / d) * sp, 0)
      this.y += (dy / d) * sp * (dt / 1000)
      this.face(dx)
      if (this.y >= floor - 1 || d < 6) {
        this.y = floor
        this.setVelocity(0, 0)
        this.phase = 'stuck'
        this.t = 0
        this.anim('stuck')
      }
    } else if (this.phase === 'stuck') {
      // Stinger in the bark: free hits.
      if (this.t > 1000) {
        this.phase = 'rise'
        this.t = 0
        this.anim('fly')
      }
    } else if (this.phase === 'rise') {
      this.y -= 90 * (dt / 1000)
      if (this.y <= this.hoverY) {
        this.y = this.hoverY
        this.phase = 'hover'
        this.cd = Phaser.Math.Between(1400, 2200)
      }
    }
    this.syncDepth()
  }
}

// ── 蜜僵松鼠 ─────────────────────────────────────────────────────────────

/** Slow shambling 蜜僵: closes in, short lunge, long recovery. Dangerous in groups. */
export class HoneySquirrel extends AnimEnemy {
  private phase: 'walk' | 'wind' | 'lunge' | 'rest' = 'walk'
  private t = 0
  private speed = 26

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'squirrel', hooks, 'walk')
    this.hp = this.maxHp = 2
    this.speed = Phaser.Math.Between(20, 32)
    this.bodyBox(24, 34)
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD' || this.fsm === 'HURT') return false
    if (this.phase === 'lunge') return !this.hitThis
    return this.contactCd <= 0
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) return
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) {
        this.setFsm('CHASE')
        this.phase = 'walk'
      }
      return
    }
    const tgt = this.target(ctx)
    const dx = tgt.x - this.x
    this.t += dt
    if (this.phase === 'walk') {
      this.anim('walk')
      this.face(dx)
      this.setVelocityX(Math.sign(dx) * this.speed)
      if (Math.abs(dx) < 46) {
        this.phase = 'wind'
        this.t = 0
        this.setVelocityX(0)
        this.setTint(0xffa060)
      }
    } else if (this.phase === 'wind') {
      if (this.t > 420) {
        this.clearTint()
        this.phase = 'lunge'
        this.t = 0
        this.hitThis = false
        this.setFsm('ATTACK')
        this.anim('lunge')
        this.setVelocityX((this.flipX ? -1 : 1) * 150)
      }
    } else if (this.phase === 'lunge') {
      if (this.t > 260) {
        this.setVelocityX(0)
        this.phase = 'rest'
        this.t = 0
        this.setFsm('CHASE')
      }
    } else if (this.t > 700) {
      this.phase = 'walk'
    }
    this.syncDepth()
  }
}

// ── 小蜜蜂 ───────────────────────────────────────────────────────────────

/** Straight-line flyer (queen swarm / hatched egg). Leaves after `ttl`. */
export class MiniBee extends AnimEnemy {
  private dir: 1 | -1
  private ttl = 6000
  private baseY: number

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1, hooks: Stage2Hooks) {
    super(scene, x, y, 'minibee', hooks, 'fly')
    this.flying = true
    this.dir = dir
    this.baseY = y
    this.hp = this.maxHp = 1
    this.bodyBox(14, 12)
    this.face(dir)
  }

  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.contactCd <= 0
  }

  tick(dt: number, _ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.ttl -= dt
    this.setVelocityX(this.dir * 120)
    this.y = this.baseY + Math.sin(this.scene.time.now / 120 + this.x) * 3
    if (this.ttl <= 0) {
      // Never destroy mid-iteration of the enemies group.
      this.setActive(false).setVisible(false)
      ;(this.body as Phaser.Physics.Arcade.Body).enable = false
      this.scene.time.delayedCall(0, () => this.destroy())
    } else this.syncDepth()
  }
}

// ── 假蜜蛋 ───────────────────────────────────────────────────────────────

/** Fake-honey egg laid by the queen: break it in time or it hatches a mini bee. */
export class HoneyEgg extends AnimEnemy {
  private t = 0
  private hatched = false

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'egg', hooks, 'idle')
    this.hp = this.maxHp = 1
    this.bodyBox(16, 18)
  }

  canHurtPlayer() {
    return false
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD' || this.hatched) return
    this.t += dt
    if (this.t > 3200) {
      this.hatched = true
      this.anim('hatch')
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (!this.active) return
        const tgt = this.target(ctx)
        this.s2.spawnMiniBee?.(this.x, this.y - 18, (Math.sign(tgt.x - this.x) || 1) as 1 | -1)
        this.disableBody(true, true)
        this.destroy()
      })
    } else if (this.t > 2200) {
      // Wobble warning before hatching.
      this.x += Math.sin(this.t / 30) * 0.4
    }
    this.syncDepth()
  }

  protected override die(dir: number) {
    if (this.scene?.anims.exists('egg-break')) {
      const sp = this.scene.add.sprite(this.x, this.y, animTex('egg')).setOrigin(0.5, 1).setDepth(this.depth)
      sp.play('egg-break')
      sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy())
    }
    this.corpseOnDeath = false
    super.die(dir)
  }
}

// ── 蜜冠女王蜂 (Boss) ─────────────────────────────────────────────────────

type QPhase = 1 | 2 | 3

/**
 * Three phases (by HP):
 *  1. hovers side to side, sends swarms of 3 mini bees (jump / crouch them)
 *  2. lands, lays 3 eggs (break them!), takes off again
 *  3. sprays fake honey along the floor (sticky puddle), then is exhausted:
 *     glowing head = weak point, double damage
 */
export class QueenBee extends AnimEnemy {
  qphase: QPhase = 1
  private act: 'intro' | 'hover' | 'summon' | 'land' | 'eggs' | 'rise' | 'spray' | 'weak' | 'defeat' = 'intro'
  private t = 0
  private dirX: 1 | -1 = -1
  private hoverY = 0
  arenaX0 = 0
  arenaX1 = 0
  private eggsLaid = 0
  private lastHitAt = 0
  onDefeated?: () => void

  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, hooks: Stage2Hooks) {
    // Hovers above shot height: ground shots pass under her, jump to hit (or wait for her to land).
    super(scene, x, hooks.floorY() - 56, 'queen', hooks, 'hover')
    this.flying = true
    this.boss = true
    this.kind = 'boss'
    this.hp = this.maxHp = 36
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.hoverY = this.y
    this.bodyBox(70, 84)
  }

  /** Touching her hurts except while she is exhausted on the ground. */
  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD' || this.act === 'weak' || this.act === 'defeat') return false
    return this.contactCd <= 0
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.act === 'defeat' || this.act === 'intro') return { killed: false, hp: this.hp }
    // Boss HP counts hits, not weapon damage: one point per hit (three on the glowing weak spot),
    // then ~0.4s of boss i-frames (spread volleys and mashing count once).
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    dmg = 1
    const mult = this.act === 'weak' ? 3 : 1
    // Bosses don't fly across the arena when hit.
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(dmg * mult, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') this.setFsm('ATTACK')
    if (!r.killed) this.updatePhase()
    return r
  }

  private updatePhase() {
    const f = this.hp / this.maxHp
    const next: QPhase = f <= 0.34 ? 3 : f <= 0.67 ? 2 : 1
    if (next !== this.qphase) {
      this.qphase = next
      this.s2.bossEvent?.(next === 2 ? 'phase2' : 'phase3', this)
    }
  }

  protected override die(_dir: number) {
    // No pop-and-vanish for the boss: defeat animation, crown falls, she calms down.
    this.hp = 0
    this.act = 'defeat'
    this.clearTint()
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.scene.tweens.add({ targets: this, y: this.s2.floorY(), duration: 600, ease: 'Bounce.out' })
    this.anim('defeat')
    this.s2.bossEvent?.('defeat', this)
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.onDefeated?.())
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.act === 'defeat') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.t += dt
    const floor = this.s2.floorY()
    const tgt = this.target(ctx)
    const go = (a: typeof this.act) => {
      this.act = a
      this.t = 0
    }
    switch (this.act) {
      case 'intro':
        this.anim('hover')
        this.y = this.hoverY + Math.sin(now / 300) * 5
        if (this.t > 1400) go('hover')
        break
      case 'hover': {
        this.anim('hover')
        const sp = this.qphase === 1 ? 70 : 90
        this.x += this.dirX * sp * (dt / 1000)
        if (this.x < this.arenaX0 + 90) this.dirX = 1
        if (this.x > this.arenaX1 - 90) this.dirX = -1
        this.y = this.hoverY + Math.sin(now / 300) * 6
        this.face(tgt.x - this.x)
        const wait = this.qphase === 1 ? 2600 : 2000
        if (this.t > wait) {
          if (this.qphase === 1) go('summon')
          else if (this.qphase === 2) go('land')
          else go(Math.random() < 0.6 ? 'spray' : 'summon')
        }
        break
      }
      case 'summon':
        this.anim('summon')
        if (this.t > 500 && this.t - dt <= 500) {
          // A line of three bees across the arena at hero height (jump) or head height (crouch).
          const fromRight = tgt.x < this.x
          const sx = fromRight ? this.arenaX1 + 10 : this.arenaX0 - 10
          const high = Math.random() < 0.5
          const y = high ? floor - 46 : floor - 16
          for (let i = 0; i < 3; i++) {
            this.scene.time.delayedCall(i * 260, () => this.s2.spawnMiniBee?.(sx, y, fromRight ? -1 : 1))
          }
        }
        if (this.t > 1300) go('hover')
        break
      case 'land':
        this.anim('land')
        this.y = Math.min(floor, this.y + 160 * (dt / 1000))
        if (this.y >= floor) {
          this.eggsLaid = 0
          go('eggs')
        }
        break
      case 'eggs':
        this.anim('lay-eggs')
        // Three eggs, spread out, one every 0.5s.
        if (this.eggsLaid < 3 && this.t > 400 + this.eggsLaid * 500) {
          const spread = [-70, 60, -140][this.eggsLaid]!
          const ex = Phaser.Math.Clamp(this.x + spread * (this.flipX ? -1 : 1), this.arenaX0 + 30, this.arenaX1 - 30)
          this.s2.spawnEgg?.(ex)
          this.eggsLaid++
        }
        if (this.t > 3400) go('rise')
        break
      case 'rise':
        this.anim('hover')
        this.y = Math.max(this.hoverY, this.y - 120 * (dt / 1000))
        if (this.y <= this.hoverY) go('hover')
        break
      case 'spray':
        // Drop to the floor and spray along it.
        this.anim('spray')
        this.y = Math.min(floor - 6, this.y + 200 * (dt / 1000))
        this.face(tgt.x - this.x)
        if (this.t > 600 && this.t - dt <= 600) this.s2.spray?.(this.x, floor, this.flipX ? -1 : 1)
        if (this.t > 1500) {
          go('weak')
          this.s2.bossEvent?.('weak', this)
        }
        break
      case 'weak':
        this.anim('weak')
        this.y = floor - 4
        if (this.t > 2400) go('rise')
        break
    }
    this.syncDepth()
  }
}

export type Stage2Enemy = BeeSoldier | HoneySquirrel | MiniBee | HoneyEgg | QueenBee
