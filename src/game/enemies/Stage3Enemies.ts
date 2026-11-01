import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { isActorFrozen } from '../fx'

/**
 * Stage 3 boss 月橋鏡鴞 (mirror owl) and its pieces.
 * Art: public/art/anim/mirrorowl.png (Cursor batch M). Plus the stage-3 cast: 龍蝦兵, 油甘魚攤主 (+ stall), 鏡影雜兵.
 *   Phase 1 羽幕  — flies high, drops a feather curtain with one gap, then rests on the bridge.
 *   Phase 2 分身  — three owls; only the real one has a reflection on the water. Fakes reflect hits back.
 *   Phase 3 鎖箱  — guards a honey crate; break the crate (3 hits) to stun her (×3 damage).
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

export type OwlHooks = {
  floorY: () => number
  /** Feather curtain across the arena with a safe gap centred on gapX. */
  feathers: (gapX: number, opts?: { boss?: boolean; hover?: number; fall?: number }) => void
  /** Pre-warning: light pillar on the safe gap, shown before the feathers appear. */
  warnGap: (gapX: number, ms: number) => void
  /** Pre-warning: red landing zone on the bridge. */
  warnSpot: (x: number, ms: number) => void
  /** Attack cue over the owl ("!" + alarm). */
  cue: (x: number, y: number, label: string) => void
  /** Low ground wave (jump it) travelling in dir from x. */
  wave: (x: number, dir: 1 | -1) => void
  /** A fake was hit: punish the nearest hero. */
  reflect: (x: number) => void
  spawnDecoy: (x: number) => OwlDecoy
  spawnCrate: (x: number) => OwlCrate
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

const SILVER = 0xd8e0ff
/** Above the water/mountain art, below the bridge props and actors. */
const REFLECT_DEPTH = 104
/** Logical y of the water surface behind the bridge rail. */
const WATER_Y = 208

export class OwlDecoy extends AnimEnemy {
  onFake?: (x: number) => void
  constructor(scene: Phaser.Scene, x: number, y: number, hooks: Stage2Hooks) {
    super(scene, x, y, 'mirrorowl', hooks, 'fly')
    this.flying = true
    this.hp = this.maxHp = 1
    this.kind = 'decoy'
    this.bodyBox(70, 84)
    this.setTint(SILVER)
    this.setAlpha(0.92)
    this.corpseOnDeath = false
  }
  protected override defaultTint() {
    return SILVER
  }
  canHurtPlayer() {
    return false
  }
  receiveHit(dmg: number, dir: number): EnemyHitResult {
    this.onFake?.(this.x)
    return super.receiveHit(dmg, dir)
  }
  protected override die(dir: number) {
    // Shatter: a quick white flash, no coin.
    this.scene?.tweens.add({ targets: this, alpha: 0, scale: 1.2, duration: 160 })
    super.die(dir)
  }
  tick(_dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.y = this.s2.floorY() - 40 + Math.sin(this.scene.time.now / 300 + this.x) * 5
    this.setVelocity(0, 0)
    this.anim('fly')
    this.face(pickTarget(this, ctx.boy, ctx.girl).x - this.x)
    this.syncDepth()
  }
}

export class OwlCrate extends Enemy {
  flying = false
  species = 'crate'
  kind = 'blocker'
  boss = false
  onBroken?: () => void
  constructor(scene: Phaser.Scene, x: number, y: number) {
    const key = scene.textures.exists('prop-break-pot') ? 'prop-break-pot' : 'pot3d'
    super(scene, x, y, key)
    this.setOrigin(0.5, 1).setScale(1.4).setTint(0xffd070)
    this.hp = this.maxHp = 3
    ;(this.body as Phaser.Physics.Arcade.Body).allowGravity = false
  }
  canHurtPlayer() {
    return false
  }
  receiveHit(_dmg: number, dir: number): EnemyHitResult {
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(1, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    return r
  }
  protected override die(dir: number) {
    this.onBroken?.()
    super.die(dir)
  }
  tick() {
    this.setVelocity(0, 0)
  }
}

export class MirrorOwl extends AnimEnemy {
  qphase: 1 | 2 | 3 = 1
  private act: 'intro' | 'fly' | 'feathers' | 'land' | 'rest' | 'rise' | 'split' | 'tell2' | 'plunge' | 'window2' | 'guard' | 'dive' | 'weak' | 'tell' | 'blast' | 'defeat' = 'intro'
  private t = 0
  private dirX: 1 | -1 = -1
  private hoverY = 0
  arenaX0 = 0
  arenaX1 = 0
  private lastHitAt = 0
  private decoys: OwlDecoy[] = []
  private crate: OwlCrate | null = null
  private reflection: Phaser.GameObjects.Sprite | null = null
  private ripple: Phaser.GameObjects.Ellipse | null = null
  private oh: OwlHooks
  private windowHits = 0
  private cued = false
  private gapX = 0
  private destX = 0
  private after: MirrorOwl['act'] = 'rise'
  onDefeated?: () => void

  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, hooks: Stage2Hooks, owl: OwlHooks) {
    super(scene, x, hooks.floorY() - 96, 'mirrorowl', hooks, 'fly')
    this.oh = owl
    this.flying = true
    this.boss = true
    this.kind = 'boss'
    this.hp = this.maxHp = 36
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.hoverY = this.y
    this.bodyBox(70, 84)
    this.setTint(SILVER)
    // Water reflection (only the real owl has one — the phase-2 tell).
    this.reflection = scene.add
      .sprite(x, hooks.floorY(), this.texture.key, this.frame.name)
      .setOrigin(0.5, 0)
      .setFlipY(true)
      .setScale(this.scaleX, this.scaleY * 0.55)
      .setAlpha(0.85)
      .setTint(0x9fb4ff)
      .setDepth(REFLECT_DEPTH)
    // Moonlit ripples on the water under the real owl: the reflection itself hides behind her body.
    this.ripple = scene.add.ellipse(x, WATER_Y + 26, 230, 22, 0x9fb4ff, 0.3).setStrokeStyle(2, 0xdbe6ff, 0.95).setDepth(REFLECT_DEPTH + 1)
  }

  protected override defaultTint() {
    return SILVER
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (this.act === 'weak' || this.act === 'rest' || this.act === 'defeat' || this.act === 'intro') return false
    if (this.act === 'tell' || this.act === 'blast' || this.act === 'tell2' || this.act === 'window2') return false
    if (this.act === 'rise' || this.act === 'land') return false
    return this.contactCd <= 0
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.act === 'defeat' || this.act === 'intro') return { killed: false, hp: this.hp }
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    void dmg
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(this.act === 'weak' ? 2 : 1, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') this.setFsm('ATTACK')
    if (!r.killed) {
      const before = this.qphase
      this.updatePhase()
      if (this.qphase === before) this.countGreed()
    }
    return r
  }

  /** Counter windows (perched / dazed / weak / observing) allow 3 free hits; the 4th is punished. */
  private countGreed() {
    const free = this.act === 'rest' || this.act === 'window2' || this.act === 'weak' || this.act === 'split'
    if (!free) return
    this.windowHits++
    if (this.windowHits <= 3) return
    this.after = this.act === 'weak' ? 'guard' : 'rise'
    if (this.act === 'weak') this.crate = null
    this.go('tell')
  }

  private updatePhase() {
    const f = this.hp / this.maxHp
    const next = f <= 0.34 ? 3 : f <= 0.67 ? 2 : 1
    if (next !== this.qphase) {
      this.qphase = next
      this.clearDecoys()
      this.oh.bossEvent(next === 2 ? 'phase2' : 'phase3')
      this.go(next === 2 ? 'split' : 'guard')
    }
  }

  private go(a: MirrorOwl['act']) {
    this.act = a
    this.t = 0
    this.windowHits = 0
    this.cued = false
    this.setTint(SILVER)
  }

  private cue(label: string) {
    this.setTint(0xffa060)
    this.oh.cue(this.x, this.y - 60, label)
  }

  private clearDecoys() {
    for (const d of this.decoys) if (d.active) d.destroy()
    this.decoys = []
  }

  protected override die(_dir: number) {
    this.hp = 0
    this.act = 'defeat'
    this.clearDecoys()
    this.crate?.destroy()
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.scene.tweens.add({ targets: this, y: this.s2.floorY(), duration: 600, ease: 'Bounce.out' })
    this.anim('defeat')
    this.oh.bossEvent('defeat')
    // The silver drains away: she is calm again.
    this.scene.time.delayedCall(900, () => this.clearTint())
    this.scene.time.delayedCall(1800, () => this.onDefeated?.())
    this.reflection?.destroy()
    this.reflection = null
    this.ripple?.destroy()
    this.ripple = null
  }

  override destroy(fromScene?: boolean) {
    this.reflection?.destroy()
    this.reflection = null
    this.ripple?.destroy()
    this.ripple = null
    this.clearDecoys()
    super.destroy(fromScene)
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.act === 'defeat') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.t += dt
    const floor = this.s2.floorY()
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const mid = (this.arenaX0 + this.arenaX1) / 2
    switch (this.act) {
      case 'intro':
        this.anim('perch')
        this.y = this.hoverY + Math.sin(now / 300) * 5
        if (this.t > 1400) this.go('fly')
        break
      case 'fly':
        this.anim('fly')
        this.x += this.dirX * 80 * (dt / 1000)
        if (this.x < this.arenaX0 + 90) this.dirX = 1
        if (this.x > this.arenaX1 - 90) this.dirX = -1
        this.y = this.hoverY + Math.sin(now / 300) * 6
        this.face(tgt.x - this.x)
        if (this.t > 2400) this.go('feathers')
        break
      case 'feathers':
        this.anim('feather-curtain')
        if (!this.cued) {
          this.cued = true
          const xs = [ctx.boy, ctx.girl].filter((h): h is HeroRef => !!h && h.active).map((h) => h.x)
          const anchor = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
          const mag = Phaser.Math.Between(55, 85)
          const sign = Math.random() < 0.5 ? -1 : 1
          const pick = (sg: number) => Phaser.Math.Clamp(anchor + sg * mag, this.arenaX0 + 60, this.arenaX1 - 60)
          // Near an arena edge the clamp could drop the gap right on the hero: take the other side then.
          this.gapX = Math.abs(pick(sign) - anchor) >= 45 ? pick(sign) : pick(-sign)
          this.oh.warnGap(this.gapX, 500)
          this.setTint(0xfff0a0)
        }
        if (this.t > 500 && this.t - dt <= 500) {
          this.setTint(SILVER)
          this.oh.feathers(this.gapX, { boss: true, hover: 300, fall: 190 })
        }
        if (this.t > 2300) this.go('land')
        break
      case 'land':
        this.anim('fly')
        this.y = Math.min(floor, this.y + 180 * (dt / 1000))
        if (this.y >= floor) this.go('rest')
        break
      case 'rest':
        // Perched on the bridge rail: free hits.
        this.anim('perch')
        this.y = floor
        if (this.t > 1600) this.go('rise')
        break
      case 'rise':
        this.anim('fly')
        this.y = Math.max(this.hoverY, this.y - 130 * (dt / 1000))
        if (this.y <= this.hoverY) this.go(this.qphase === 1 ? 'fly' : this.qphase === 2 ? 'split' : 'guard')
        break
      case 'split': {
        this.anim('fly')
        // Observe: three owls, only the real one has a reflection. Reshuffle on entry.
        if (!this.cued) {
          this.cued = true
          this.clearDecoys()
          const xs = Phaser.Utils.Array.Shuffle([this.arenaX0 + 130, mid, this.arenaX1 - 130])
          this.x = xs[0]!
          for (const x of xs.slice(1)) {
            const d = this.oh.spawnDecoy(x)
            d.onFake = (fx) => this.oh.reflect(fx)
            this.decoys.push(d)
          }
        }
        this.y = floor - 40 + Math.sin(now / 300 + this.x) * 5
        this.face(tgt.x - this.x)
        if (this.t > 2400) {
          this.destX = Phaser.Math.Clamp(tgt.x, this.arenaX0 + 70, this.arenaX1 - 70)
          this.go('tell2')
        }
        break
      }
      case 'tell2': {
        this.anim('fly')
        if (!this.cued) {
          this.cued = true
          this.cue('！')
          this.oh.warnSpot(this.destX, 650)
        }
        this.x += Phaser.Math.Clamp(this.destX - this.x, -520 * (dt / 1000), 520 * (dt / 1000))
        this.y += (this.hoverY - this.y) * Math.min(1, dt / 120)
        this.face(this.destX - this.x)
        if (this.t > 650) {
          this.setTint(SILVER)
          this.x = this.destX
          this.go('plunge')
        }
        break
      }
      case 'plunge':
        this.anim('fly')
        this.y = Math.min(floor - 6, this.y + 620 * (dt / 1000))
        if (this.y >= floor - 6) {
          this.oh.cue(this.x, floor, '嘭！')
          this.go('window2')
        }
        break
      case 'window2':
        // Missed: dazed on the bridge. 3 free hits, then she bites back.
        this.anim('hurt')
        this.y = floor - 6
        if (this.t > 1200) this.go('rise')
        break
      case 'tell':
        this.anim('fly')
        if (!this.cued) {
          this.cued = true
          this.cue('貪心！')
        }
        if (this.t > 500) this.go('blast')
        break
      case 'blast':
        this.anim('feather-curtain')
        if (!this.cued) {
          this.cued = true
          this.oh.wave(this.x - 24, -1)
          this.oh.wave(this.x + 24, 1)
        }
        if (this.t > 450) this.go(this.after)
        break
      case 'guard': {
        this.anim('perch')
        if (!this.crate || !this.crate.active) {
          this.crate = this.oh.spawnCrate(mid)
          this.crate.onBroken = () => {
            this.go('weak')
            this.oh.bossEvent('weak')
          }
        }
        // Stand between the hero and the crate, then dive at the hero.
        const side = Math.sign(tgt.x - mid) || 1
        const want = mid + side * 60
        this.x += Phaser.Math.Clamp(want - this.x, -120 * (dt / 1000), 120 * (dt / 1000))
        this.y = floor
        this.face(tgt.x - this.x)
        if (this.t > 2150 && !this.cued) {
          this.cued = true
          this.cue('！')
        }
        if (this.t > 2600) {
          this.go('dive')
          this.dirX = (Math.sign(tgt.x - this.x) || 1) as 1 | -1
        }
        break
      }
      case 'dive':
        this.anim('fly')
        this.x = Phaser.Math.Clamp(this.x + this.dirX * 260 * (dt / 1000), this.arenaX0 + 30, this.arenaX1 - 30)
        this.y = floor - 6
        if (this.t > 650) this.go('guard')
        break
      case 'weak':
        this.anim('hurt')
        this.y = floor
        if (this.t > 2500) {
          this.crate = null
          this.go('guard')
        }
        break
    }
    // Reflection follows on the water below the bridge (hidden while she perches on it).
    if (this.reflection) {
      this.reflection.setTexture(this.texture.key, this.frame.name)
      this.reflection.setPosition(this.x, WATER_Y + Math.max(0, floor - this.y) * 0.12)
      this.reflection.setFlipX(this.flipX)
      this.reflection.setVisible(this.y < floor - 8)
    }
    if (this.ripple) {
      const pulse = Math.sin(now / 180)
      this.ripple.setPosition(this.x, WATER_Y + 26)
      this.ripple.setScale(1 + 0.12 * pulse, 1)
      this.ripple.setAlpha(0.75 + 0.25 * pulse)
      this.ripple.setVisible(this.y < floor - 8)
    }
    this.syncDepth()
  }
}

// ── 龍蝦兵 ───────────────────────────────────────────────────────────────

/** Walks slowly with both claws up in front: front hits clang off (GameScene asks `blocks`). Snap has a 0.4 s wind-up. */
export class LobsterGuard extends AnimEnemy {
  private phase: 'walk' | 'wind' | 'snap' | 'rest' = 'walk'
  private t = 0
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'lobster', hooks, 'walk')
    this.species = 'lobster'
    this.hp = this.maxHp = 3
    this.bodyBox(30, 40)
  }
  /** A hit pushing it in `dir` came from the front (claws) → blocked, unless it is recovering. */
  blocks(dir: number) {
    if (this.phase === 'rest' || this.fsm === 'HURT') return false
    const face = this.flipX ? -1 : 1
    return dir === -face
  }
  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD' || this.fsm === 'HURT') return false
    if (this.phase === 'snap') return !this.hitThis
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
        this.phase = 'rest'
        this.t = 0
      }
      return
    }
    const tgt = this.target(ctx)
    const dx = tgt.x - this.x
    this.t += dt
    if (this.phase === 'walk') {
      const near = Math.abs(dx) < 110
      this.anim(near ? 'block' : 'walk')
      this.face(dx)
      this.setVelocityX(Math.sign(dx) * (near ? 14 : 22))
      if (Math.abs(dx) < 44 && Math.abs(tgt.y - this.y) < 30) {
        this.phase = 'wind'
        this.t = 0
        this.setVelocityX(0)
        this.setTint(0xffa060)
      }
    } else if (this.phase === 'wind') {
      if (this.t > 400) {
        this.clearTint()
        this.phase = 'snap'
        this.t = 0
        this.hitThis = false
        this.setFsm('ATTACK')
        this.anim('turn')
        this.setVelocityX((this.flipX ? -1 : 1) * 160)
      }
    } else if (this.phase === 'snap') {
      if (this.t > 240) {
        this.setVelocityX(0)
        this.phase = 'rest'
        this.t = 0
        this.setFsm('CHASE')
      }
    } else {
      // Claws down after a snap: the opening.
      this.anim('walk')
      this.anims.pause()
      this.setVelocityX(0)
      if (this.t > 700) {
        this.anims.resume()
        this.phase = 'walk'
      }
    }
    this.syncDepth()
  }
}

// ── 油甘魚攤主 + 攤檔 ─────────────────────────────────────────────────────

/** The food stall a keeper hides behind: 3 hits and it breaks (no more cover). */
export class MarketStall extends Enemy {
  species = 'stall'
  kind = 'blocker'
  boss = false
  flying = false
  broken = false
  onBroken?: () => void
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, scene.textures.exists('s3-stall') ? 's3-stall' : 'pot3d')
    this.setOrigin(0.5, 1)
    this.hp = this.maxHp = 3
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(Math.min(60, this.width), 40)
    body.setOffset((this.width - Math.min(60, this.width)) / 2, this.height - 42)
  }
  canHurtPlayer() {
    return false
  }
  receiveHit(_dmg: number, dir: number): EnemyHitResult {
    if (this.broken) return { killed: false, hp: 0 }
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(1, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    this.setAngle(dir * 3)
    this.scene.time.delayedCall(90, () => this.active && this.setAngle(0))
    return r
  }
  protected override die(_dir: number) {
    // Stays as wreckage (no corpse / coin burst), just loses its use.
    this.broken = true
    this.setFsm('DEAD')
    if (this.scene.textures.exists('s3-stall-broken')) this.setTexture('s3-stall-broken')
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.setDepth(this.depth - 2)
    this.onBroken?.()
  }
  tick() {
    this.setVelocity(0, 0)
  }
}

export type KeeperHooks = { knife: (x: number, y: number, dir: 1 | -1, high: boolean) => void }

/** Throws a kitchen knife every 1.6 s, alternating high / low; ducks behind the stall (invulnerable) after each throw. */
export class StallKeeper extends AnimEnemy {
  private phase: 'idle' | 'throw' | 'duck' = 'idle'
  private t = 0
  private cd = 900
  private n = 0
  stall: MarketStall | null = null
  private kh: KeeperHooks
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, kh: KeeperHooks) {
    super(scene, x, hooks.floorY(), 'stallkeeper', hooks, 'idle')
    this.species = 'stallkeeper'
    this.kh = kh
    this.hp = this.maxHp = 2
    this.bodyBox(26, 44)
  }
  private covered() {
    return !!this.stall && !this.stall.broken && this.stall.active
  }
  receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.phase === 'duck' && this.covered()) return { killed: false, hp: this.hp }
    const r = super.receiveHit(dmg, dir)
    // Rooted behind the counter.
    this.setVelocity(0, 0)
    return r
  }
  /** GameScene shows 「躲埋咗！」 instead of a hit while this is true. */
  hiding() {
    return this.phase === 'duck' && this.covered()
  }
  canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.contactCd <= 0 && !this.covered()
  }
  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) return
    this.y = this.s2.floorY()
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      return
    }
    const tgt = this.target(ctx)
    const dx = tgt.x - this.x
    this.face(dx)
    this.t += dt
    if (this.phase === 'idle') {
      this.anim('idle')
      this.cd -= dt
      if (this.cd <= 0 && Math.abs(dx) < 300) {
        this.phase = 'throw'
        this.t = 0
        this.anim('throw')
      }
    } else if (this.phase === 'throw') {
      if (this.t > 260 && this.t - dt <= 260) {
        this.n++
        const dir = (Math.sign(dx) || -1) as 1 | -1
        this.kh.knife(this.x + dir * 16, this.y, dir, this.n % 2 === 0)
      }
      if (this.t > 420) {
        this.phase = this.covered() ? 'duck' : 'idle'
        this.t = 0
        this.cd = 1600 - 420
        if (this.phase === 'duck') this.anim('duck')
      }
    } else {
      if (this.t > 700) {
        this.phase = 'idle'
        this.t = 0
      }
    }
    this.syncDepth()
  }
}

// ── 鏡影雜兵 ─────────────────────────────────────────────────────────────

/** Floats and dashes. Splits once into a see-through copy; only the real one has a reflection on the wet floor. */
export class MirrorShade extends AnimEnemy {
  private phase: 'float' | 'dash' | 'split' = 'float'
  private t = 0
  private cd = 2200
  private split = false
  private refl: Phaser.GameObjects.Sprite | null = null
  fake = false
  /** Called when the real one splits: GameScene spawns the copy. */
  onSplit?: (x: number) => void
  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, fake = false) {
    super(scene, x, hooks.floorY() - 2, 'mirrorshade', hooks, 'float')
    this.species = 'mirrorshade'
    this.flying = true
    this.fake = fake
    this.hp = this.maxHp = 1
    this.bodyBox(26, 36)
    this.cd = Phaser.Math.Between(1600, 2600)
    if (fake) {
      this.split = true
      this.setAlpha(0.55)
      this.corpseOnDeath = false
    } else {
      this.refl = scene.add.sprite(x, this.y, this.texture.key, this.frame.name).setOrigin(0.5, 0).setFlipY(true).setAlpha(0.3).setTint(0x8090ff)
    }
  }
  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD' || this.fsm === 'HURT') return false
    return this.phase === 'dash' ? !this.hitThis : this.contactCd <= 0
  }
  protected override die(dir: number) {
    this.refl?.destroy()
    this.refl = null
    if (this.fake) this.scene?.tweens.add({ targets: this, alpha: 0, duration: 160 })
    super.die(dir)
  }
  override destroy(fromScene?: boolean) {
    this.refl?.destroy()
    this.refl = null
    super.destroy(fromScene)
  }
  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) return
    const floor = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
    } else {
      const tgt = this.target(ctx)
      const dx = tgt.x - this.x
      this.t += dt
      if (this.phase === 'float') {
        this.anim('float')
        this.face(dx)
        this.setVelocity(Math.sign(dx) * 34, 0)
        this.cd -= dt
        if (!this.split && Math.abs(dx) < 200) {
          this.split = true
          this.phase = 'split'
          this.t = 0
          this.setVelocity(0, 0)
          this.anim('split')
        } else if (this.cd <= 0 && Math.abs(dx) < 170) {
          this.phase = 'dash'
          this.t = 0
          this.hitThis = false
          this.setFsm('ATTACK')
          this.anim('dash')
          this.setVelocity((Math.sign(dx) || 1) * 190, 0)
        }
      } else if (this.phase === 'split') {
        if (this.t > 420) {
          this.onSplit?.(this.x + (this.flipX ? 40 : -40))
          this.phase = 'float'
        }
      } else if (this.t > 520) {
        this.setVelocity(0, 0)
        this.phase = 'float'
        this.setFsm('CHASE')
        this.cd = Phaser.Math.Between(1800, 2800)
      }
    }
    this.y = floor - 2 + Math.sin(now / 280 + this.x * 0.05) * 3
    if (this.refl) {
      this.refl.setTexture(this.texture.key, this.frame.name)
      this.refl.setPosition(this.x, floor + 1)
      this.refl.setFlipX(this.flipX)
    }
    this.syncDepth()
  }
}
