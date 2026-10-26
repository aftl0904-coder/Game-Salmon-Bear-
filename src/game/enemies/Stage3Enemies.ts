import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'

/**
 * Stage 3 boss 月橋鏡鴞 (mirror owl) and its pieces.
 * Until Cursor's owl sheets arrive it borrows the queen's flight frames, tinted moon-silver.
 *   Phase 1 羽幕  — flies high, drops a feather curtain with one gap, then rests on the bridge.
 *   Phase 2 分身  — three owls; only the real one has a reflection on the water. Fakes reflect hits back.
 *   Phase 3 鎖箱  — guards a honey crate; break the crate (3 hits) to stun her (×3 damage).
 */

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

export type OwlHooks = {
  floorY: () => number
  /** Feather curtain across the arena with a safe gap centred on gapX. */
  feathers: (gapX: number) => void
  /** A fake was hit: punish the nearest hero. */
  reflect: (x: number) => void
  spawnDecoy: (x: number) => OwlDecoy
  spawnCrate: (x: number) => OwlCrate
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

const SILVER = 0xb8c8ff

export class OwlDecoy extends AnimEnemy {
  onFake?: (x: number) => void
  constructor(scene: Phaser.Scene, x: number, y: number, hooks: Stage2Hooks) {
    super(scene, x, y, 'queen', hooks, 'hover')
    this.flying = true
    this.hp = this.maxHp = 1
    this.kind = 'decoy'
    this.bodyBox(70, 84)
    this.setTint(SILVER)
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
  tick(_dt: number, _ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    this.y = this.s2.floorY() - 40 + Math.sin(this.scene.time.now / 300 + this.x) * 5
    this.setVelocity(0, 0)
  }
}

export class OwlCrate extends Enemy {
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
  private act: 'intro' | 'fly' | 'feathers' | 'land' | 'rest' | 'rise' | 'split' | 'guard' | 'dive' | 'weak' | 'defeat' = 'intro'
  private t = 0
  private dirX: 1 | -1 = -1
  private hoverY = 0
  arenaX0 = 0
  arenaX1 = 0
  private lastHitAt = 0
  private decoys: OwlDecoy[] = []
  private crate: OwlCrate | null = null
  private reflection: Phaser.GameObjects.Sprite | null = null
  private oh: OwlHooks
  onDefeated?: () => void

  constructor(scene: Phaser.Scene, x: number, arenaX0: number, arenaX1: number, hooks: Stage2Hooks, owl: OwlHooks) {
    super(scene, x, hooks.floorY() - 96, 'queen', hooks, 'hover')
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
    this.reflection = scene.add.sprite(x, hooks.floorY(), this.texture.key, this.frame.name).setOrigin(0.5, 0).setFlipY(true).setAlpha(0.28).setTint(0x8aa0ff)
  }

  protected override defaultTint() {
    return SILVER
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (this.act === 'weak' || this.act === 'rest' || this.act === 'defeat' || this.act === 'intro') return false
    return this.contactCd <= 0
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.act === 'defeat' || this.act === 'intro') return { killed: false, hp: this.hp }
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    void dmg
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(this.act === 'weak' ? 3 : 1, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') this.setFsm('ATTACK')
    if (!r.killed) this.updatePhase()
    return r
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
  }

  override destroy(fromScene?: boolean) {
    this.reflection?.destroy()
    this.reflection = null
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
        this.anim('hover')
        this.y = this.hoverY + Math.sin(now / 300) * 5
        if (this.t > 1400) this.go('fly')
        break
      case 'fly':
        this.anim('hover')
        this.x += this.dirX * 80 * (dt / 1000)
        if (this.x < this.arenaX0 + 90) this.dirX = 1
        if (this.x > this.arenaX1 - 90) this.dirX = -1
        this.y = this.hoverY + Math.sin(now / 300) * 6
        this.face(tgt.x - this.x)
        if (this.t > 2400) this.go('feathers')
        break
      case 'feathers':
        this.anim('summon')
        if (this.t > 400 && this.t - dt <= 400) {
          const gap = Phaser.Math.Clamp(tgt.x + Phaser.Math.Between(-120, 120), this.arenaX0 + 60, this.arenaX1 - 60)
          this.oh.feathers(gap)
        }
        if (this.t > 2000) this.go('land')
        break
      case 'land':
        this.anim('land')
        this.y = Math.min(floor, this.y + 180 * (dt / 1000))
        if (this.y >= floor) this.go('rest')
        break
      case 'rest':
        // Perched on the bridge rail: free hits.
        this.y = floor
        if (this.t > 2000) this.go('rise')
        break
      case 'rise':
        this.anim('hover')
        this.y = Math.max(this.hoverY, this.y - 130 * (dt / 1000))
        if (this.y <= this.hoverY) this.go(this.qphase === 1 ? 'fly' : this.qphase === 2 ? 'split' : 'guard')
        break
      case 'split': {
        this.anim('hover')
        // Shuffle the three positions every 4.5 s; only the real one has the reflection.
        if (this.t < dt || this.decoys.every((d) => !d.active) || this.t > 4500) {
          this.t = dt
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
        break
      }
      case 'guard': {
        this.anim('hover')
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
        this.y = floor - 30 + Math.sin(now / 260) * 4
        this.face(tgt.x - this.x)
        if (this.t > 2600) {
          this.go('dive')
          this.dirX = (Math.sign(tgt.x - this.x) || 1) as 1 | -1
        }
        break
      }
      case 'dive':
        this.anim('spray')
        this.x = Phaser.Math.Clamp(this.x + this.dirX * 260 * (dt / 1000), this.arenaX0 + 30, this.arenaX1 - 30)
        this.y = floor - 6
        if (this.t > 650) this.go('guard')
        break
      case 'weak':
        this.anim('weak')
        this.y = floor - 4
        if (this.t > 2500) {
          this.crate = null
          this.go('guard')
        }
        break
    }
    // Reflection follows on the water below the bridge (hidden while she perches on it).
    if (this.reflection) {
      this.reflection.setTexture(this.texture.key, this.frame.name)
      this.reflection.setPosition(this.x, floor + 2 + Math.max(0, floor - this.y) * 0.25)
      this.reflection.setFlipX(this.flipX)
      this.reflection.setVisible(this.y < floor - 8)
    }
    this.syncDepth()
  }
}
