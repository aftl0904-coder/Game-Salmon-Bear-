/**
 * Stage 10 · 暴雨大廈 enemies/boss art (art-s9s10).
 * BuildingGuard AI numbers stay JailGuard stand-in until s10-2 retunes.
 * Leon uses data/levels/stage10.json `leon` — art from Manus #173 s10leon sheet.
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

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

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

const TINT_GUARD = 0x78a0c8

// Stand-in until s10-2 (HP 8 / 160 discover / …).
const GUARD_HP = 6
const GUARD_ENGAGE = 140
const GUARD_WARN_MS = 1000
const GUARD_SWIPE_PX = 60
const GUARD_SWIPE_MS = 280
const GUARD_REST_MS = 900
const GUARD_WALK = 42

/** 大廈保安 — Manus s10buildingguard sheet; AI stand-in until s10-2. */
export class BuildingGuard extends AnimEnemy {
  private phase: 'walk' | 'warn' | 'swipe' | 'rest' = 'walk'
  private t = 0
  private baton: Phaser.GameObjects.Rectangle | null = null
  private warnMark: Phaser.GameObjects.Text | null = null
  private swipeDir: 1 | -1 = 1
  private swipeOriginX = 0
  private readonly realArt: boolean

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's10guard'
    this.hp = this.maxHp = GUARD_HP
    this.hurtMs = 200
    this.realArt = bindStage910Sheet(this, 's10buildingguard', 'walk')
    this.bodyBox(this.realArt ? 36 : 28, this.realArt ? 56 : 44)
    if (!this.realArt) {
      this.setTint(TINT_GUARD)
      this.baton = scene.add
        .rectangle(x, this.y - 36, 10, 22, 0x4a6080, 1)
        .setStrokeStyle(1, 0xc0d0e8)
        .setDepth(this.depth + 3)
        .setOrigin(0.5, 1)
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : TINT_GUARD
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
      if (!this.realArt) this.setTint(blink ? 0xffe080 : TINT_GUARD)
      this.syncBaton(true)
      this.warnMark?.setPosition(this.x, this.y - 58)
      if (this.t >= GUARD_WARN_MS) {
        if (!this.realArt) this.setTint(TINT_GUARD)
        this.clearWarn()
        this.phase = 'swipe'
        this.t = 0
        this.hitThis = false
        this.swipeOriginX = this.x
        this.anim('attack')
        SFX.swing?.()
      }
    } else if (this.phase === 'swipe') {
      if (!this.realArt) this.setTint(TINT_GUARD)
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

// ── Leon ───────────────────────────────────────────────────────────────

export type LeonCfg = {
  hp: number
  phase2At: number
  phase3Below: number
  chargeWarnMs: number
  shieldBashWarnMs: number
  callGuardsWarnMs: number
  chargeTiredMs: number
  summonPerCycle: number
  summonMaxAlive: number
  weakBase: number
  capWeak: number
  capNormal: number
}

export type LeonHooks = {
  floorY: () => number
  summonGuards: (per: number, maxAlive: number) => number
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

type LeonAct =
  | 'intro'
  | 'stalk'
  | 'chargeWarn'
  | 'charge'
  | 'tired'
  | 'shieldWarn'
  | 'shieldBash'
  | 'callWarn'
  | 'call'

const LEON_TINT = 0xb8a078
const CHARGE_PX = 160
const CHARGE_MS = 420
const BASH_PX = 90
const BASH_MS = 300

/**
 * Leon — charge / shield bash / call guards → tired weak window.
 * Numbers from stage10.json `leon`. Art: Manus s10leon.
 */
export class Leon extends AnimEnemy {
  qphase: 1 | 2 | 3 = 1
  act: LeonAct = 'intro'
  arenaX0: number
  arenaX1: number
  onDefeated?: () => void
  private t = 0
  private lastHitAt = 0
  private next: 'charge' | 'shield' | 'call' = 'charge'
  private chargeDir: 1 | -1 = -1
  private chargeOriginX = 0
  private lh: LeonHooks
  private cfg: LeonCfg
  private warnMark: Phaser.GameObjects.Text | null = null
  private readonly realArt: boolean

  constructor(
    scene: Phaser.Scene,
    x: number,
    arenaX0: number,
    arenaX1: number,
    cfg: LeonCfg,
    lh: LeonHooks,
  ) {
    super(scene, x, lh.floorY(), 'triboss', { floorY: lh.floorY }, 'idle')
    this.species = 'leon'
    this.kind = 'boss'
    this.boss = true
    this.cfg = cfg
    this.lh = lh
    this.hp = this.maxHp = cfg.hp
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.realArt = bindStage910Sheet(this, 's10leon', 'idle')
    const bw = this.realArt ? 48 : 44
    const bh = this.realArt ? 72 : 56
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(bw, bh)
    body.setOffset((this.frame.width - bw) / 2, this.frame.height - bh - 6)
    if (!this.realArt) this.setTint(LEON_TINT)
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : LEON_TINT
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (this.act === 'intro' || this.act === 'tired') return false
    if (this.act === 'chargeWarn' || this.act === 'shieldWarn' || this.act === 'callWarn') return false
    if (this.act === 'charge' || this.act === 'shieldBash') return this.contactCd <= 0
    return this.contactCd <= 0 && this.act === 'stalk'
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    const weak = this.act === 'tired'
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
    this.lh.bossEvent(next === 2 ? 'phase2' : 'phase3')
    floatText(this.scene, this.x, this.y - 70, next === 2 ? '第二段！' : '第三段！', '#ffe08a', {
      size: 14,
      dur: 1200,
    })
  }

  private go(a: LeonAct) {
    this.act = a
    this.t = 0
    this.setVelocity(0, 0)
    if (a === 'tired') {
      if (!this.realArt) this.setTint(0xffe060)
      this.lh.bossEvent('weak')
    } else if (a === 'chargeWarn' || a === 'shieldWarn' || a === 'callWarn') {
      if (!this.realArt) this.setTint(0xffc080)
      this.showWarn()
    } else {
      if (!this.realArt) this.setTint(LEON_TINT)
      this.clearWarn()
    }
    if (this.realArt) {
      this.anim(
        a === 'chargeWarn'
          ? 'charge_warning'
          : a === 'charge'
            ? 'charge'
            : a === 'tired'
              ? 'exhausted_glow'
              : a === 'shieldWarn'
                ? 'shield_warning'
                : a === 'shieldBash'
                  ? 'shield_bash'
                  : a === 'callWarn' || a === 'call'
                    ? 'call_warning'
                    : 'idle',
      )
    } else {
      this.anim(a === 'tired' ? 'hurt' : a === 'charge' || a === 'shieldBash' ? 'rain' : 'idle')
    }
  }

  protected override die(_dir: number) {
    this.clearWarn()
    this.hp = 0
    this.act = 'intro'
    this.boss = false
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.clearTint()
    this.anim('defeat')
    this.lh.bossEvent('defeat')
    this.scene.time.delayedCall(1800, () => {
      this.onDefeated?.()
      if (!this.scene) return
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    super.destroy(fromScene)
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) return
    this.t += dt
    this.y = this.lh.floorY()
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    const toward = (Math.sign(dx) || -1) as 1 | -1
    const x0 = this.arenaX0 + 24
    const x1 = this.arenaX1 - 24
    const stalkMs = this.qphase === 3 ? 480 : this.qphase === 2 ? 700 : 950

    switch (this.act) {
      case 'intro':
        this.setFlipX(dx < 0)
        if (this.t > 1100) this.go('stalk')
        break

      case 'stalk': {
        this.setFlipX(dx < 0)
        const dist = Math.abs(dx)
        if (this.next === 'charge' && dist > 120) this.setVelocityX(toward * (this.qphase === 3 ? 100 : 72))
        else if (this.next !== 'charge' && dist > 200) this.setVelocityX(toward * 55)
        else this.setVelocityX(0)
        if (this.t >= stalkMs) {
          if (this.qphase >= 2) {
            this.lh.summonGuards(this.cfg.summonPerCycle, this.cfg.summonMaxAlive)
          }
          if (this.next === 'charge') {
            this.chargeDir = toward
            this.go('chargeWarn')
          } else if (this.next === 'shield') {
            this.go('shieldWarn')
          } else {
            this.go('callWarn')
          }
        }
        break
      }

      case 'chargeWarn':
        this.setFlipX(this.chargeDir < 0)
        this.warnMark?.setPosition(this.x, this.y - 72)
        if (this.t >= this.cfg.chargeWarnMs) {
          this.clearWarn()
          this.chargeOriginX = this.x
          this.hitThis = false
          this.go('charge')
          SFX.swing?.()
        }
        break

      case 'charge': {
        const k = Math.min(1, this.t / CHARGE_MS)
        const targetX = this.chargeOriginX + this.chargeDir * CHARGE_PX * k
        this.setVelocityX(((targetX - this.x) / Math.max(16, dt)) * 1000)
        if (this.t >= CHARGE_MS) {
          this.setVelocity(0, 0)
          this.go('tired')
        }
        break
      }

      case 'tired':
        this.setVelocity(0, 0)
        if (this.t >= this.cfg.chargeTiredMs) {
          this.next = 'shield'
          this.go('stalk')
        }
        break

      case 'shieldWarn':
        this.setFlipX(dx < 0)
        this.warnMark?.setPosition(this.x, this.y - 72)
        if (this.t >= this.cfg.shieldBashWarnMs) {
          this.clearWarn()
          this.chargeOriginX = this.x
          this.chargeDir = toward
          this.hitThis = false
          this.go('shieldBash')
          SFX.swing?.()
        }
        break

      case 'shieldBash': {
        const k = Math.min(1, this.t / BASH_MS)
        const targetX = this.chargeOriginX + this.chargeDir * BASH_PX * k
        this.setVelocityX(((targetX - this.x) / Math.max(16, dt)) * 1000)
        if (this.t >= BASH_MS) {
          this.setVelocity(0, 0)
          this.next = 'call'
          this.go('stalk')
        }
        break
      }

      case 'callWarn':
        this.setFlipX(dx < 0)
        this.warnMark?.setPosition(this.x, this.y - 72)
        if (this.t >= this.cfg.callGuardsWarnMs) {
          this.clearWarn()
          this.go('call')
        }
        break

      case 'call':
        if (this.t - dt < 50 && this.t >= 50) {
          this.lh.summonGuards(this.cfg.summonPerCycle, this.cfg.summonMaxAlive)
          SFX.boss?.()
        }
        if (this.t >= 400) {
          this.next = 'charge'
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
}
