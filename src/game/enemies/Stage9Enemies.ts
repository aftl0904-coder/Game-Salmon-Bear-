/**
 * Stage 9 · 地底監禁層 enemies (s9-2).
 * Numbers locked to the s9-2 ticket — do not retune here.
 * Art: Manus #173 sheets via art-s9s10 (JSON `frames`); tinted stand-ins if missing.
 *
 *  1. JailGuard  獄卒兵       — close 140 → raise baton 1000ms → swipe 60px → rest 900ms
 *  2. LockBot    鎖匠機械人   — close 200 → warn 1000ms → linear chain 200px; hit → half speed 1000ms; every 3000ms
 */
import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { isActorFrozen, floatText } from '../fx'
import { SFX } from '../audio'
import { bossHitDamage } from '../engine/bossDamage'
import { DEPTH } from '../engine/depth'
import { hasStage910Anim, stage910AnimTex, type Stage910AnimId } from '../stage910Art'
import type { AnimSetId } from '../heroAnims'

function bindStage910Sheet(enemy: AnimEnemy, id: Stage910AnimId, first: string) {
  if (!hasStage910Anim(enemy.scene, id)) return false
  enemy.set = id as AnimSetId
  enemy.setTexture(stage910AnimTex(id), 0)
  enemy.setOrigin(0.5, 1)
  enemy.clearTint()
  ;(enemy as unknown as { animName: string }).animName = ''
  enemy.anim(first)
  return true
}

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

const TINT = {
  guard: 0x90b878,
  lockbot: 0xd08060,
} as const

// ── ticket numbers ─────────────────────────────────────────────────────
const GUARD_HP = 6
const GUARD_ENGAGE = 140
const GUARD_WARN_MS = 1000
const GUARD_SWIPE_PX = 60
const GUARD_SWIPE_MS = 280
const GUARD_REST_MS = 900
const GUARD_WALK = 42

const LOCK_HP = 15
const LOCK_ENGAGE = 200
const LOCK_WARN_MS = 1000
const LOCK_RANGE = 200
const LOCK_INTERVAL_MS = 3000
const LOCK_WALK = 28
const LOCK_CHAIN_SPEED = 320
const LOCK_SLOW_MS = 1000

export type LockBotHooks = {
  floorY: () => number
  /** Linear chain shot; on hero hit → half move for LOCK_SLOW_MS (no HP retune here). */
  throwChain: (fromX: number, fromY: number, dir: 1 | -1) => void
}

// ── 獄卒兵 ─────────────────────────────────────────────────────────────

/** Walk in → stop at 140px → raise baton 1000ms → forward swipe 60px → rest 900ms. */
export class JailGuard extends AnimEnemy {
  private phase: 'walk' | 'warn' | 'swipe' | 'rest' = 'walk'
  private t = 0
  private baton: Phaser.GameObjects.Rectangle | null = null
  private warnMark: Phaser.GameObjects.Text | null = null
  private swipeDir: 1 | -1 = 1
  private swipeOriginX = 0
  private readonly realArt: boolean

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's9guard'
    this.hp = this.maxHp = GUARD_HP
    this.hurtMs = 200
    this.realArt = bindStage910Sheet(this, 's9jailguard', 'walk')
    this.bodyBox(this.realArt ? 32 : 28, this.realArt ? 56 : 44)
    if (!this.realArt) {
      this.setTint(TINT.guard)
      this.baton = scene.add
        .rectangle(x, this.y - 36, 6, 22, 0x4a3020, 1)
        .setStrokeStyle(1, 0xc8a060)
        .setDepth(this.depth + 3)
        .setOrigin(0.5, 1)
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : TINT.guard
  }

  canHurtPlayer() {
    return this.active && this.phase === 'swipe' && !this.hitThis && this.fsm !== 'DEAD'
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.baton?.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.syncBaton(false)
      return
    }
    this.setPosition(this.x, this.s2.floorY())
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.syncBaton(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.t += dt

    if (this.phase === 'walk') {
      this.anim(Math.abs(dx) < GUARD_ENGAGE ? (this.realArt ? 'warning' : 'reach') : 'walk')
      this.face(dx)
      this.syncBaton(false)
      if (Math.abs(dx) <= GUARD_ENGAGE) {
        this.setVelocity(0, 0)
        if (this.canEngageFromScreen()) {
          this.phase = 'warn'
          this.t = 0
          this.swipeDir = dx >= 0 ? 1 : -1
          this.showWarn()
        }
      } else {
        this.setVelocityX(Math.sign(dx) * GUARD_WALK)
      }
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.anim(this.realArt ? 'warning' : 'reach')
      this.face(this.swipeDir)
      const blink = Math.floor(now / 100) % 2 === 0
      if (!this.realArt) this.setTint(blink ? 0xffe080 : TINT.guard)
      this.syncBaton(true)
      this.warnMark?.setPosition(this.x, this.y - 58)
      if (this.t >= GUARD_WARN_MS) {
        if (!this.realArt) this.setTint(TINT.guard)
        this.clearWarn()
        this.phase = 'swipe'
        this.t = 0
        this.hitThis = false
        this.swipeOriginX = this.x
        this.anim('attack')
        SFX.swing?.()
      }
    } else if (this.phase === 'swipe') {
      if (!this.realArt) this.setTint(TINT.guard)
      // Lunge forward up to 60px during the swipe window.
      const k = Math.min(1, this.t / GUARD_SWIPE_MS)
      const targetX = this.swipeOriginX + this.swipeDir * GUARD_SWIPE_PX * k
      this.setVelocityX(((targetX - this.x) / Math.max(16, dt)) * 1000)
      this.syncBaton(true, true)
      if (this.t >= GUARD_SWIPE_MS) {
        this.setVelocity(0, 0)
        this.phase = 'rest'
        this.t = 0
        this.anim('walk')
      }
    } else {
      this.setVelocity(0, 0)
      this.syncBaton(false)
      this.anims.pause()
      if (this.t >= GUARD_REST_MS) {
        this.anims.resume()
        this.phase = Math.abs(dx) <= GUARD_ENGAGE ? 'warn' : 'walk'
        this.t = 0
        if (this.phase === 'warn') {
          this.swipeDir = dx >= 0 ? 1 : -1
          this.showWarn()
        }
      }
    }
    this.syncDepth()
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 58, '！', {
        fontSize: '16px',
        color: '#ffe08a',
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

  private syncBaton(raised: boolean, swinging = false) {
    if (!this.baton) return
    this.baton.setVisible(this.active && this.fsm !== 'DEAD')
    const face = this.flipX ? -1 : 1
    const ox = this.x + face * (swinging ? 22 : raised ? 8 : 14)
    const oy = this.y - (raised || swinging ? 52 : 34)
    this.baton.setPosition(ox, oy)
    this.baton.setAngle(swinging ? face * 55 : raised ? face * -25 : face * 10)
    this.baton.setDepth(this.depth + 3)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.baton?.destroy()
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.baton?.destroy()
    super.destroy(fromScene)
  }
}

// ── 鎖匠機械人 ─────────────────────────────────────────────────────────

/** Mid bot: close 200 → warn 1000ms → linear chain 200px; hit slows hero 0.5× for 1000ms; every 3000ms. */
export class LockBot extends AnimEnemy {
  private phase: 'walk' | 'warn' | 'cool' = 'walk'
  private t = 0
  private lh: LockBotHooks
  private arm: Phaser.GameObjects.Rectangle | null = null
  private warnMark: Phaser.GameObjects.Text | null = null
  private readonly realArt: boolean

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, lh: LockBotHooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's9lockbot'
    this.lh = lh
    this.hp = this.maxHp = LOCK_HP
    this.hurtMs = 220
    this.realArt = bindStage910Sheet(this, 's9lockbot', 'walk')
    this.bodyBox(this.realArt ? 40 : 36, this.realArt ? 56 : 48)
    if (!this.realArt) {
      this.setTint(TINT.lockbot)
      this.arm = scene.add
        .rectangle(x, this.y - 28, 18, 8, 0x608090, 1)
        .setStrokeStyle(1, 0xd0e0f0)
        .setDepth(this.depth + 3)
        .setOrigin(0, 0.5)
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : TINT.lockbot
  }

  canHurtPlayer() {
    // Body bump still hurts; chain slow is separate via projectile.
    return this.active && this.fsm !== 'DEAD' && this.phase !== 'warn' && !this.hitThis
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
      this.arm?.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.syncArm(false)
      return
    }
    this.setPosition(this.x, this.lh.floorY())
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      this.syncArm(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.face(dx)
    this.t += dt

    if (this.phase === 'walk') {
      this.anim(Math.abs(dx) < LOCK_ENGAGE ? (this.realArt ? 'warning' : 'reach') : 'walk')
      this.syncArm(false)
      if (Math.abs(dx) <= LOCK_ENGAGE) {
        this.setVelocity(0, 0)
        if (this.canEngageFromScreen()) {
          this.phase = 'warn'
          this.t = 0
          this.showWarn()
        }
      } else {
        this.setVelocityX(Math.sign(dx) * LOCK_WALK)
      }
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.anim(this.realArt ? 'warning' : 'reach')
      const blink = Math.floor(now / 100) % 2 === 0
      if (!this.realArt) this.setTint(blink ? 0xffc080 : TINT.lockbot)
      this.syncArm(true)
      this.warnMark?.setPosition(this.x, this.y - 62)
      if (this.t >= LOCK_WARN_MS) {
        if (!this.realArt) this.setTint(TINT.lockbot)
        this.clearWarn()
        const dir: 1 | -1 = dx >= 0 ? 1 : -1
        this.lh.throwChain(this.x + dir * 16, this.y - 36, dir)
        this.phase = 'cool'
        this.t = 0
        this.syncArm(false)
        if (this.realArt) this.anim('attack')
        SFX.swing?.()
      }
    } else {
      this.setVelocity(0, 0)
      this.anim('walk')
      this.anims.pause()
      this.syncArm(false)
      if (this.t >= LOCK_INTERVAL_MS) {
        this.anims.resume()
        this.phase = Math.abs(dx) <= LOCK_ENGAGE ? 'warn' : 'walk'
        this.t = 0
        if (this.phase === 'warn') this.showWarn()
      }
    }
    this.syncDepth()
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 62, '！', {
        fontSize: '16px',
        color: '#ffc080',
        stroke: '#201008',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 5)
  }

  private clearWarn() {
    this.warnMark?.destroy()
    this.warnMark = null
  }

  private syncArm(cocked: boolean) {
    if (!this.arm) return
    this.arm.setVisible(this.active && this.fsm !== 'DEAD')
    const face = this.flipX ? -1 : 1
    this.arm.setPosition(this.x + face * 6, this.y - (cocked ? 40 : 28))
    this.arm.setScale(cocked ? face * 1.2 : face, 1)
    this.arm.setDepth(this.depth + 3)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.arm?.destroy()
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.arm?.destroy()
    super.destroy(fromScene)
  }
}

/** Shared: apply chain slow (half speed 1000ms) via stickyUntil used by stickyFeetMul. */
export function applyChainSlow(scene: Phaser.Scene, hero: Phaser.Physics.Arcade.Sprite) {
  const now = scene.time.now
  const was = ((hero.getData('stickyUntil') as number | undefined) ?? 0) > now
  hero.setData('stickyUntil', now + LOCK_SLOW_MS)
  if (!was) {
    floatText(scene, hero.x, hero.y - 52, '鎖鏈！', '#c8d0e0', { size: 12, dur: 900 })
    SFX.gulp?.()
  }
}

export const LOCK_CHAIN = {
  range: LOCK_RANGE,
  speed: LOCK_CHAIN_SPEED,
  slowMs: LOCK_SLOW_MS,
} as const


// ── 首席獄卒（s9-3）───────────────────────────────────────────────────

export type WardenCfg = {
  hp: number
  phase2At: number
  phase3Below: number
  slamWarnMs: number
  keyThrowWarnMs: number
  gateDropWarnMs: number
  keysDroppedMs: number
  summonPerCycle: number
  summonMaxAlive: number
  weakBase: number
  capWeak: number
  capNormal: number
}

export type WardenHooks = {
  floorY: () => number
  /** Linear key-ring projectile. */
  throwKeys: (fromX: number, fromY: number, dir: 1 | -1) => void
  /** Arena gate slam hazard (warn already done by boss). */
  dropGate: (x: number) => void
  /** Spawn JailGuards; returns how many spawned. */
  summonGuards: (per: number, maxAlive: number) => number
  guardCount: () => number
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

type WardenAct =
  | 'intro'
  | 'stalk'
  | 'slamWarn'
  | 'slam'
  | 'keyWarn'
  | 'keyThrow'
  | 'gateWarn'
  | 'gateDrop'
  | 'keysDown'

const WARDEN_TINT = 0xa0b0c8
const SLAM_PX = 90
const SLAM_MS = 320

/**
 * 首席獄卒 — slam baton / throw keys / drop gate → keys-down weak window.
 * Numbers locked to data/levels/stage9.json `warden` — do not retune here.
 */
export class ChiefWarden extends AnimEnemy {
  qphase: 1 | 2 | 3 = 1
  act: WardenAct = 'intro'
  arenaX0: number
  arenaX1: number
  onDefeated?: () => void
  private t = 0
  private lastHitAt = 0
  private next: 'slam' | 'key' | 'gate' = 'slam'
  private slamDir: 1 | -1 = -1
  private slamOriginX = 0
  private wh: WardenHooks
  private cfg: WardenCfg
  private baton: Phaser.GameObjects.Rectangle | null = null
  private warnMark: Phaser.GameObjects.Text | null = null
  private keyPile: Phaser.GameObjects.Rectangle | null = null
  private readonly realArt: boolean

  constructor(
    scene: Phaser.Scene,
    x: number,
    arenaX0: number,
    arenaX1: number,
    cfg: WardenCfg,
    wh: WardenHooks,
  ) {
    super(scene, x, wh.floorY(), 'triboss', { floorY: wh.floorY }, 'idle')
    this.species = 'warden'
    this.kind = 'boss'
    this.boss = true
    this.cfg = cfg
    this.wh = wh
    this.hp = this.maxHp = cfg.hp
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.realArt = bindStage910Sheet(this, 's9chief', 'idle')
    const bw = this.realArt ? 48 : 44
    const bh = this.realArt ? 72 : 56
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(bw, bh)
    body.setOffset((this.frame.width - bw) / 2, this.frame.height - bh - 6)
    if (!this.realArt) {
      this.setTint(WARDEN_TINT)
      this.baton = scene.add
        .rectangle(x, this.y - 40, 8, 28, 0x3a3028, 1)
        .setStrokeStyle(1, 0xc8a060)
        .setDepth(this.depth + 3)
        .setOrigin(0.5, 1)
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : WARDEN_TINT
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (this.act === 'intro' || this.act === 'keysDown') return false
    if (this.act === 'slamWarn' || this.act === 'keyWarn' || this.act === 'gateWarn') return false
    if (this.act === 'slam') return this.contactCd <= 0
    return this.contactCd <= 0 && this.act === 'stalk'
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    const weak = this.act === 'keysDown'
    const hitDmg = bossHitDamage(dmg, {
      weak,
      weakBase: this.cfg.weakBase,
      capNormal: this.cfg.capNormal,
      capWeak: this.cfg.capWeak,
    })
    const before = { x: this.x, y: this.y }
    const r = super.receiveHit(hitDmg, dir)
    this.setPosition(before.x, before.y)
    this.setVelocity(0, 0)
    if (this.fsm === 'HURT') this.setFsm('ATTACK')
    if (!r.killed) this.updatePhase()
    return { ...r, weak }
  }

  private updatePhase() {
    const f = this.hp / this.maxHp
    const next: 1 | 2 | 3 =
      f < this.cfg.phase3Below ? 3 : f <= this.cfg.phase2At ? 2 : 1
    if (next <= this.qphase) return
    this.qphase = next
    this.wh.bossEvent(next === 2 ? 'phase2' : 'phase3')
    floatText(this.scene, this.x, this.y - 70, next === 2 ? '第二段！' : '第三段！', '#ffe08a', { size: 14, dur: 1200 })
  }

  private go(a: WardenAct) {
    this.act = a
    this.t = 0
    this.setVelocity(0, 0)
    if (a === 'keysDown') {
      if (!this.realArt) this.setTint(0xffe060)
      this.wh.bossEvent('weak')
      this.showKeyPile(true)
    } else if (a === 'slamWarn' || a === 'keyWarn' || a === 'gateWarn') {
      if (!this.realArt) this.setTint(0xffc080)
      this.showWarn()
    } else {
      if (!this.realArt) this.setTint(WARDEN_TINT)
      this.clearWarn()
      if (a !== 'gateDrop') this.showKeyPile(false)
    }
    if (this.realArt) {
      this.anim(
        a === 'slamWarn'
          ? 'baton_warning'
          : a === 'slam'
            ? 'baton_sweep'
            : a === 'keyWarn'
              ? 'key_warning'
              : a === 'keyThrow'
                ? 'key_throw'
                : a === 'gateWarn'
                  ? 'gate_warning'
                  : a === 'gateDrop'
                    ? 'gate_action'
                    : a === 'keysDown'
                      ? 'weakpoint_glow'
                      : 'idle',
      )
    } else {
      this.anim(
        a === 'slam' || a === 'slamWarn'
          ? 'rain'
          : a === 'keyThrow' || a === 'keyWarn'
            ? 'point'
            : a === 'keysDown'
              ? 'hurt'
              : 'idle',
      )
    }
  }

  protected override die(_dir: number) {
    this.clearWarn()
    this.showKeyPile(false)
    this.baton?.destroy()
    this.hp = 0
    this.act = 'intro'
    this.boss = false
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.clearTint()
    this.anim('defeat')
    this.wh.bossEvent('defeat')
    this.scene.time.delayedCall(1800, () => {
      this.onDefeated?.()
      if (!this.scene) return
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.showKeyPile(false)
    this.baton?.destroy()
    super.destroy(fromScene)
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.baton?.setVisible(false)
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.syncBaton(false)
      return
    }
    this.t += dt
    const floor = this.wh.floorY()
    this.y = floor
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    const toward = (Math.sign(dx) || -1) as 1 | -1
    const x0 = this.arenaX0 + 24
    const x1 = this.arenaX1 - 24
    const stalkMs = this.qphase === 3 ? 480 : this.qphase === 2 ? 700 : 950

    switch (this.act) {
      case 'intro':
        this.setFlipX(dx < 0)
        this.syncBaton(false)
        if (this.t > 1100) this.go('stalk')
        break

      case 'stalk': {
        this.setFlipX(dx < 0)
        const dist = Math.abs(dx)
        if (this.next === 'slam' && dist > 110) this.setVelocityX(toward * (this.qphase === 3 ? 100 : 72))
        else if (this.next !== 'slam' && dist > 220) this.setVelocityX(toward * 55)
        else this.setVelocityX(0)
        this.syncBaton(false)
        if (this.t >= stalkMs) {
          if (this.qphase >= 2) {
            this.wh.summonGuards(this.cfg.summonPerCycle, this.cfg.summonMaxAlive)
          }
          if (this.next === 'slam') {
            this.slamDir = toward
            this.go('slamWarn')
          } else if (this.next === 'key') {
            this.go('keyWarn')
          } else {
            this.go('gateWarn')
          }
        }
        break
      }

      case 'slamWarn':
        this.setFlipX(this.slamDir < 0)
        this.syncBaton(true)
        this.warnMark?.setPosition(this.x, this.y - 72)
        if (this.t >= this.cfg.slamWarnMs) {
          this.clearWarn()
          this.slamOriginX = this.x
          this.hitThis = false
          this.go('slam')
          SFX.swing?.()
        }
        break

      case 'slam': {
        const k = Math.min(1, this.t / SLAM_MS)
        const targetX = this.slamOriginX + this.slamDir * SLAM_PX * k
        this.setVelocityX(((targetX - this.x) / Math.max(16, dt)) * 1000)
        this.syncBaton(true, true)
        if (this.t >= SLAM_MS) {
          this.setVelocity(0, 0)
          this.next = 'key'
          this.go('stalk')
        }
        break
      }

      case 'keyWarn':
        this.setFlipX(dx < 0)
        this.syncBaton(true)
        this.warnMark?.setPosition(this.x, this.y - 72)
        if (this.t >= this.cfg.keyThrowWarnMs) {
          this.clearWarn()
          this.go('keyThrow')
        }
        break

      case 'keyThrow':
        this.setFlipX(dx < 0)
        this.syncBaton(false)
        if (this.t - dt < 50 && this.t >= 50) {
          this.wh.throwKeys(this.x + toward * 18, this.y - 36, toward)
          SFX.swing?.()
        }
        if (this.t >= 280) {
          this.next = 'gate'
          this.go('stalk')
        }
        break

      case 'gateWarn':
        this.setFlipX(dx < 0)
        this.syncBaton(true)
        this.warnMark?.setPosition(this.x, this.y - 72)
        if (this.t >= this.cfg.gateDropWarnMs) {
          this.clearWarn()
          this.go('gateDrop')
        }
        break

      case 'gateDrop':
        this.syncBaton(false)
        if (this.t - dt < 50 && this.t >= 50) {
          // Drop mid-arena toward the player.
          const gx = Phaser.Math.Clamp(tgt.x, this.arenaX0 + 80, this.arenaX1 - 80)
          this.wh.dropGate(gx)
          SFX.slam?.()
          SFX.cageClank?.()
        }
        if (this.t >= 400) {
          this.go('keysDown')
        }
        break

      case 'keysDown':
        this.setVelocity(0, 0)
        this.syncBaton(false)
        this.keyPile?.setPosition(this.x, this.y - 8)
        if (this.t >= this.cfg.keysDroppedMs) {
          this.next = 'slam'
          this.showKeyPile(false)
          this.go('stalk')
        }
        break
    }
    this.x = Phaser.Math.Clamp(this.x, x0, x1)
    this.syncDepth()
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 72, '！', {
        fontSize: '18px',
        color: '#ffe08a',
        stroke: '#201808',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.FX)
  }

  private clearWarn() {
    this.warnMark?.destroy()
    this.warnMark = null
  }

  private showKeyPile(on: boolean) {
    if (!on) {
      this.keyPile?.destroy()
      this.keyPile = null
      return
    }
    if (this.keyPile) return
    this.keyPile = this.scene.add
      .rectangle(this.x, this.y - 8, 28, 10, 0xd0c060, 1)
      .setStrokeStyle(1, 0xfff0a0)
      .setDepth(DEPTH.PROP + 2)
      .setOrigin(0.5, 1)
  }

  private syncBaton(raised: boolean, swinging = false) {
    if (!this.baton) return
    this.baton.setVisible(this.active && this.fsm !== 'DEAD')
    const face = this.flipX ? -1 : 1
    const ox = this.x + face * (swinging ? 26 : raised ? 10 : 16)
    const oy = this.y - (raised || swinging ? 56 : 36)
    this.baton.setPosition(ox, oy)
    this.baton.setAngle(swinging ? face * 60 : raised ? face * -30 : face * 12)
    this.baton.setDepth(this.depth + 3)
  }
}
