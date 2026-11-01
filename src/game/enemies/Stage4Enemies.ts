import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import type { Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { isActorFrozen } from '../fx'
import { actorDepth } from '../engine/depth'
import { bossHitDamage } from '../engine/bossDamage'

/**
 * Stage 4 · 鹽霧工地 cast: 蜜僵 (slow shambling zombie, groups), 的士怪 (headlight-warn
 * then high-speed charge), 打卡鐘怪 (countdown then a radial paper burst), and the boss
 * 泥鬃 (motorcycle foreman).
 *
 * No Cursor art delivered yet for this batch, so every look here is a small procedurally
 * drawn placeholder (same approach as friends.ts before batch-06) — a code-drawn silhouette
 * that reads clearly at game scale, swapped for real art once ART-REQUEST-14 comes back.
 * Everything still runs through the shared Stage2Hooks plumbing (floorY/spawnCoin) so these
 * drop in via GameScene.addS2Enemy exactly like the stage 2/3 cast.
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  draw(g)
  g.generateTexture(key, w, h)
  g.destroy()
}

// ── 蜜僵 ─────────────────────────────────────────────────────────────────

/** Shambles slowly towards the nearest hero; hits leave a sticky honey puddle underfoot. */
export class HoneyZombie extends Enemy {
  flying = false
  species = 'honeyzombie'
  kind = 'blocker'
  boss = false
  s2: Stage2Hooks
  onSplatter?: (x: number) => void
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    makeTexture(scene, 'stage4-honeyzombie', 30, 38, (g) => {
      const out = 0x1a1210
      g.fillStyle(out, 1).fillEllipse(15, 30, 24, 16).fillCircle(15, 17, 11).fillRect(3, 9, 7, 16).fillRect(20, 9, 7, 16)
      g.fillStyle(0x8a9a5a, 1).fillEllipse(15, 29, 20, 13).fillCircle(15, 17, 9)
      g.fillStyle(0xc0b878, 1).fillRect(4, 10, 5, 13).fillRect(21, 10, 5, 13)
      g.fillStyle(0xd8a040, 0.6).fillEllipse(15, 34, 16, 6)
      g.fillStyle(out, 1).fillRect(10, 14, 2, 2).fillRect(18, 14, 2, 2)
      g.fillStyle(0xe8e060, 0.5).fillCircle(10, 15, 3).fillCircle(18, 15, 3)
    })
    super(scene, x, hooks.floorY(), 'stage4-honeyzombie')
    this.s2 = hooks
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 2
    this.hurtMs = 260
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(22, 30)
    body.setOffset(4, 8)
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
    this.setVelocityX(Math.sign(dx) * 16)
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
}

// ── 的士怪 ───────────────────────────────────────────────────────────────

/** Headlights flash twice as a 0.6 s warning, then a fast charge; stuns itself on the wall. */
export class TaxiMonster extends Enemy {
  flying = false
  species = 'taximonster'
  kind = 'blocker'
  boss = false
  s2: Stage2Hooks
  private phase: 'idle' | 'warn' | 'charge' | 'stun' = 'idle'
  private t = 0
  private dir: 1 | -1 = 1
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    makeTexture(scene, 'stage4-taximonster', 40, 26, (g) => {
      const out = 0x1a1210
      g.fillStyle(out, 1).fillRoundedRect(1, 3, 38, 20, 6)
      g.fillStyle(0xd8b038, 1).fillRoundedRect(3, 5, 34, 16, 5)
      g.fillStyle(0x1a1210, 1).fillRect(3, 17, 34, 3)
      g.fillStyle(0xf0f0f0, 1).fillCircle(34, 13, 4).fillCircle(34, 13, 4)
      g.fillStyle(0x303030, 1).fillCircle(10, 23, 4).fillCircle(28, 23, 4)
    })
    super(scene, x, hooks.floorY(), 'stage4-taximonster')
    this.s2 = hooks
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 3
    this.hurtMs = 260
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(34, 20)
    body.setOffset(3, 3)
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
      this.setVelocity(0, 0)
      this.setFlipX(dx < 0)
      if (Math.abs(dx) < 260 && Math.abs(dx) > 40) {
        this.phase = 'warn'
        this.t = 0
        this.dir = (Math.sign(dx) || 1) as 1 | -1
      }
    } else if (this.phase === 'warn') {
      const blink = Math.floor(this.t / 150) % 2 === 0
      this.setTint(blink ? 0xffffff : 0xffffff00)
      this.clearTint()
      this.setTint(blink ? 0xfff0a0 : 0xd8b038)
      if (this.t > 600) {
        this.clearTint()
        this.phase = 'charge'
        this.t = 0
        this.setFsm('ATTACK')
        this.hitThis = false
        this.setVelocityX(this.dir * 260)
      }
    } else if (this.phase === 'charge') {
      const body = this.body as Phaser.Physics.Arcade.Body
      if (body.blocked.left || body.blocked.right || this.t > 1400) {
        this.phase = 'stun'
        this.t = 0
        this.setFsm('CHASE')
        this.setVelocity(0, 0)
        this.setTint(0xa0a0a0)
      }
    } else {
      this.setVelocity(0, 0)
      if (this.t > 1800) {
        this.clearTint()
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
export class ClockPunch extends Enemy {
  flying = false
  species = 'clockpunch'
  kind = 'blocker'
  boss = false
  s2: Stage2Hooks
  private ch: ClockHooks
  private phase: 'count' | 'burst' | 'cool' = 'count'
  private t = 0
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, ch: ClockHooks) {
    makeTexture(scene, 'stage4-clockpunch', 30, 34, (g) => {
      const out = 0x1a1210
      g.fillStyle(out, 1).fillCircle(15, 17, 15)
      g.fillStyle(0xe8e0c8, 1).fillCircle(15, 17, 12)
      g.fillStyle(out, 1).fillRect(14, 7, 2, 10).fillRect(15, 16, 7, 2)
      g.fillStyle(0xb02828, 1).fillRect(10, 1, 10, 4)
      g.fillStyle(0x303030, 1).fillCircle(9, 29, 3).fillCircle(21, 29, 3)
    })
    super(scene, x, hooks.floorY(), 'stage4-clockpunch')
    this.s2 = hooks
    this.ch = ch
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 2
    this.hurtMs = 220
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(24, 26)
    body.setOffset(3, 6)
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
      const tick = Math.floor(this.t / 500) % 2 === 0
      this.setTint(tick ? 0xffd0a0 : 0xffffff)
      if (this.t > 3000) {
        this.clearTint()
        this.phase = 'burst'
        this.t = 0
        this.ch.burst(this.x, this.y - 18)
      }
    } else if (this.phase === 'burst') {
      if (this.t > 200) {
        this.phase = 'cool'
        this.t = 0
      }
    } else {
      if (this.t > 900) {
        this.phase = 'count'
        this.t = 0
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

export class MudMane extends Enemy {
  flying = false
  species = 'mudmane'
  kind = 'boss'
  boss = true
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
    makeTexture(scene, 'stage4-mudmane', 56, 62, (g) => {
      const out = 0x140e0a
      g.fillStyle(out, 1).fillEllipse(28, 56, 46, 10)
      g.fillStyle(0x201812, 1).fillRoundedRect(4, 44, 48, 12, 4)
      g.fillStyle(0x3a2c20, 1).fillCircle(14, 56, 7).fillCircle(42, 56, 7)
      g.fillStyle(out, 1).fillCircle(14, 56, 3).fillCircle(42, 56, 3)
      g.fillStyle(0x6a5030, 1).fillEllipse(28, 30, 22, 28)
      g.fillStyle(0x8a6a3c, 1).fillCircle(28, 14, 10)
      g.fillStyle(out, 1).fillRect(20, 8, 16, 7)
      g.fillStyle(0xd8a020, 1).fillTriangle(22, 26, 34, 26, 28, 14)
      g.fillStyle(out, 1).fillTriangle(24, 25, 32, 25, 28, 16)
    })
    super(scene, x, mh.floorY(), 'stage4-mudmane')
    this.mh = mh
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 40
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(44, 44)
    body.setOffset(6, 10)
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
  }
  protected override die(_dir: number) {
    this.hp = 0
    this.act = 'intro'
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.scene.tweens.add({ targets: this, y: this.mh.floorY(), angle: 8, duration: 600, ease: 'Bounce.out' })
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
