/**
 * Stage 8 · 配方控制中心 enemies (s8-2).
 * Numbers locked to the s8-2 ticket — do not retune here.
 * Art: Manus stage8 sheets via art-s8 (JSON `frames`); tinted stand-ins if missing.
 *
 *  1. LabDrone         巡邏無人機 — hover → red warn → dive → open → rise
 *  2. TubeSoldier      試管兵     — close → raise tube → parabolic sticky flask
 *  3. FileCabinet      文件櫃怪   — front shield; door warn → ram → open belly
 *  4. ChiefResearcher  主任研究員 — swipe / flasks / refill weak / P2+ tube summons (s8-3)
 */
import Phaser from 'phaser'
import { type EnemyHitResult } from './Enemy'
import { AnimEnemy, type Stage2Hooks } from './Stage2Enemies'
import { pickTarget, type HeroRef } from '../enemyAi'
import { actorDepth } from '../engine/depth'
import { isActorFrozen, floatText } from '../fx'
import { bossHitDamage } from '../engine/bossDamage'
import { SFX } from '../audio'
import { hasStage8Anim, stage8AnimTex, type Stage8AnimId } from '../stage8Art'
import type { AnimSetId } from '../heroAnims'

type Ctx = { boy: HeroRef; girl: HeroRef | null; leadX: number; prevLeadX: number }

/** Lab-night tints — only when Manus sheets are missing. */
const TINT = {
  drone: 0x6ad0ff,
  tube: 0xc8a0ff,
  cabinet: 0xd0b070,
} as const

function bindStage8Sheet(enemy: AnimEnemy, id: Stage8AnimId, first: string) {
  if (!hasStage8Anim(enemy.scene, id)) return false
  enemy.set = id as AnimSetId
  enemy.setTexture(stage8AnimTex(id), 0)
  enemy.setOrigin(0.5, 1)
  enemy.clearTint()
  ;(enemy as unknown as { animName: string }).animName = ''
  enemy.anim(first)
  return true
}

// ── ticket numbers ─────────────────────────────────────────────────────
const DRONE_HP = 6
const DRONE_HOVER_MIN = 40
const DRONE_HOVER_MAX = 60
const DRONE_ENGAGE = 160
const DRONE_WARN_MS = 1000
const DRONE_DIVE_SPEED = 200
const DRONE_DIVE_MS = 600
const DRONE_OPEN_MS = 1000
const DRONE_PATROL_HALF = 90
const DRONE_PATROL_SPEED = 55

const TUBE_HP = 6
const TUBE_RANGE = 180
const TUBE_WARN_MS = 1000
const TUBE_INTERVAL_MS = 3000
const TUBE_WALK = 36

const CAB_HP = 15
const CAB_WARN_MS = 1000
const CAB_CHARGE_DIST = 120
const CAB_OPEN_MS = 1200
const CAB_ENGAGE = 170
const CAB_WALK = 28
const CAB_CHARGE_SPEED = 220

export type TubeHooks = {
  floorY: () => number
  /** Parabolic tube: lands at most ±180 from thrower; dmg 1 + sticky puddle. */
  throwTube: (fromX: number, fromY: number, targetX: number) => void
}

// ── 巡邏無人機 ─────────────────────────────────────────────────────────

/** Hover patrol → red lamp warn 1000ms → dive 200px/s for 600ms → open 1000ms → rise. */
export class LabDrone extends AnimEnemy {
  private phase: 'patrol' | 'warn' | 'dive' | 'open' | 'rise' = 'patrol'
  private t = 0
  private hoverH: number
  private homeX: number
  private droneDir: 1 | -1 = 1
  private diveTo = { x: 0, y: 0 }
  private lamp: Phaser.GameObjects.Arc | null = null
  private readonly realArt: boolean

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    const h = Phaser.Math.Between(DRONE_HOVER_MIN, DRONE_HOVER_MAX)
    super(scene, x, hooks.floorY() - h, 'beesoldier', hooks, 'fly')
    this.flying = true
    this.species = 's8drone'
    this.hp = this.maxHp = DRONE_HP
    this.hoverH = h
    this.homeX = x
    this.realArt = bindStage8Sheet(this, 's8drone', 'idle')
    this.bodyBox(this.realArt ? 36 : 26, this.realArt ? 28 : 22)
    if (!this.realArt) {
      this.setTint(TINT.drone)
      this.lamp = scene.add.circle(x, this.y - 14, 5, 0x204050, 0.9).setDepth(this.depth + 4)
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : TINT.drone
  }

  canHurtPlayer() {
    return this.active && this.phase === 'dive' && !this.hitThis && this.fsm !== 'DEAD'
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.lamp?.setVisible(false)
      return
    }
    const now = this.scene.time.now
    if (isActorFrozen(this, now)) return
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('PATROL')
      this.syncLamp(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const floor = this.s2.floorY()
    const hoverY = floor - this.hoverH
    this.t += dt

    if (this.phase === 'patrol') {
      this.anim(this.realArt ? 'walk' : 'fly')
      if (!this.realArt) this.setTint(TINT.drone)
      // Bob + left/right around home.
      if (this.x > this.homeX + DRONE_PATROL_HALF) this.droneDir = -1
      if (this.x < this.homeX - DRONE_PATROL_HALF) this.droneDir = 1
      this.setVelocityX(this.droneDir * DRONE_PATROL_SPEED)
      this.y = hoverY + Math.sin(now / 280) * 3
      this.face(tgt.x - this.x)
      this.syncLamp(false)
      if (Math.abs(tgt.x - this.x) <= DRONE_ENGAGE && this.canEngageFromScreen()) {
        this.phase = 'warn'
        this.t = 0
        this.setVelocity(0, 0)
        this.anim(this.realArt ? 'warning' : 'aim')
      }
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.y = hoverY
      this.face(tgt.x - this.x)
      const blink = Math.floor(now / 90) % 2 === 0
      if (!this.realArt) this.setTint(blink ? 0xff4040 : TINT.drone)
      this.syncLamp(true, blink)
      if (this.t >= DRONE_WARN_MS) {
        if (!this.realArt) this.setTint(TINT.drone)
        this.diveTo = { x: tgt.x, y: floor }
        this.phase = 'dive'
        this.t = 0
        this.hitThis = false
        this.anim(this.realArt ? 'attack' : 'dive')
      }
    } else if (this.phase === 'dive') {
      this.syncLamp(false)
      const dx = this.diveTo.x - this.x
      const dy = this.diveTo.y - this.y
      const d = Math.hypot(dx, dy) || 1
      const vx = (dx / d) * DRONE_DIVE_SPEED
      const vy = (dy / d) * DRONE_DIVE_SPEED
      this.setVelocity(vx, 0)
      this.y += vy * (dt / 1000)
      this.face(dx)
      if (this.y >= floor - 1) this.y = floor
      if (this.t >= DRONE_DIVE_MS) {
        this.setVelocity(0, 0)
        this.phase = 'open'
        this.t = 0
        this.anim(this.realArt ? 'idle' : 'stuck')
      }
    } else if (this.phase === 'open') {
      this.setVelocity(0, 0)
      this.syncLamp(false)
      if (this.t >= DRONE_OPEN_MS) {
        this.phase = 'rise'
        this.t = 0
        this.anim(this.realArt ? 'walk' : 'fly')
      }
    } else {
      // rise back to patrol height
      this.setVelocity(0, 0)
      this.y -= 110 * (dt / 1000)
      this.syncLamp(false)
      if (this.y <= hoverY) {
        this.y = hoverY
        this.phase = 'patrol'
        this.t = 0
        this.homeX = this.x
      }
    }
    this.syncDepth()
  }

  private syncLamp(on: boolean, bright = false) {
    if (!this.lamp) return
    this.lamp.setVisible(true)
    this.lamp.setPosition(this.x, this.y - 14)
    this.lamp.setDepth(this.depth + 4)
    this.lamp.setFillStyle(on ? (bright ? 0xff2020 : 0xaa1010) : 0x204050, on ? 1 : 0.85)
    this.lamp.setRadius(on ? 6 : 4)
  }

  protected override die(dir: number) {
    this.lamp?.destroy()
    this.lamp = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.lamp?.destroy()
    this.lamp = null
    super.destroy(fromScene)
  }
}

// ── 試管兵 ─────────────────────────────────────────────────────────────

/** Walk in → stop at 180px → raise tube 1000ms → throw → cooldown 3000ms. */
export class TubeSoldier extends AnimEnemy {
  private phase: 'walk' | 'warn' | 'cool' = 'walk'
  private t = 0
  private th: TubeHooks
  private tubeGfx: Phaser.GameObjects.Graphics | null = null
  private warnMark: Phaser.GameObjects.Text | null = null
  private readonly realArt: boolean

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks, th: TubeHooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's8tube'
    this.th = th
    this.hp = this.maxHp = TUBE_HP
    this.hurtMs = 220
    this.realArt = bindStage8Sheet(this, 's8tube', 'walk')
    this.bodyBox(this.realArt ? 32 : 28, this.realArt ? 56 : 44)
    if (!this.realArt) {
      this.setTint(TINT.tube)
      this.tubeGfx = scene.add.graphics()
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : TINT.tube
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
    if (!this.active || this.fsm === 'DEAD') {
      this.tubeGfx?.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.drawTube(false)
      return
    }
    this.setPosition(this.x, this.th.floorY())
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      if (this.realArt) this.anim('hurt')
      this.drawTube(false)
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.face(dx)
    this.t += dt

    if (this.phase === 'walk') {
      this.anim(Math.abs(dx) < TUBE_RANGE ? (this.realArt ? 'warning' : 'reach') : 'walk')
      if (Math.abs(dx) <= TUBE_RANGE) {
        this.setVelocity(0, 0)
        if (this.canEngageFromScreen()) {
          this.phase = 'warn'
          this.t = 0
          this.showWarn()
        }
      } else {
        this.setVelocityX(Math.sign(dx) * TUBE_WALK)
      }
      this.drawTube(false)
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.anim(this.realArt ? 'warning' : 'reach')
      const blink = Math.floor(now / 100) % 2 === 0
      if (!this.realArt) this.setTint(blink ? 0xffa0ff : TINT.tube)
      this.drawTube(true)
      this.warnMark?.setPosition(this.x, this.y - 58)
      if (this.t >= TUBE_WARN_MS) {
        if (!this.realArt) this.setTint(TINT.tube)
        this.clearWarn()
        if (this.realArt) this.anim('attack')
        const aim = Phaser.Math.Clamp(tgt.x, this.x - TUBE_RANGE, this.x + TUBE_RANGE)
        this.th.throwTube(this.x + (this.flipX ? -12 : 12), this.y - 40, aim)
        this.phase = 'cool'
        this.t = 0
        this.drawTube(false)
      }
    } else {
      this.setVelocity(0, 0)
      this.anim('walk')
      this.anims.pause()
      this.drawTube(false)
      if (this.t >= TUBE_INTERVAL_MS) {
        this.anims.resume()
        // Re-engage if still in range; else walk again.
        this.phase = Math.abs(dx) <= TUBE_RANGE ? 'warn' : 'walk'
        this.t = 0
        if (this.phase === 'warn') this.showWarn()
      }
    }
    this.syncDepth()
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 58, '！', {
        fontSize: '16px',
        color: '#e8a0ff',
        stroke: '#201028',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 5)
  }

  private clearWarn() {
    this.warnMark?.destroy()
    this.warnMark = null
  }

  private drawTube(raised: boolean) {
    const g = this.tubeGfx
    if (!g) return
    g.clear()
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      g.setVisible(false)
      return
    }
    g.setVisible(true)
    const face = this.flipX ? -1 : 1
    const cx = this.x + face * (raised ? 10 : 14)
    const cy = this.y - (raised ? 48 : 30)
    // Glass tube stand-in
    g.fillStyle(0xd8f0ff, 0.85).fillRoundedRect(cx - 4, cy - 16, 8, 22, 2)
    g.lineStyle(1, 0x6080a0, 1).strokeRoundedRect(cx - 4, cy - 16, 8, 22, 2)
    g.fillStyle(0xc060ff, 0.9).fillRect(cx - 3, cy - 2, 6, 6)
    g.setDepth(this.depth + 2)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.tubeGfx?.destroy()
    this.tubeGfx = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.tubeGfx?.destroy()
    super.destroy(fromScene)
  }
}

// ── 文件櫃怪 ───────────────────────────────────────────────────────────

/**
 * Front blocks like ShieldKeeper. Door warn 1000ms → ram 120px → open 1200ms
 * (front vulnerable while open).
 */
export class FileCabinet extends AnimEnemy {
  private phase: 'chase' | 'warn' | 'charge' | 'open' = 'chase'
  private t = 0
  private dir: 1 | -1 = 1
  private chargeFrom = 0
  private doorGfx: Phaser.GameObjects.Graphics | null = null
  private warnMark: Phaser.GameObjects.Text | null = null
  private readonly realArt: boolean

  constructor(scene: Phaser.Scene, x: number, hooks: Stage2Hooks) {
    super(scene, x, hooks.floorY(), 'honeyzombie', hooks, 'walk')
    this.species = 's8cabinet'
    this.hp = this.maxHp = CAB_HP
    this.hurtMs = 260
    this.realArt = bindStage8Sheet(this, 's8cabinet', 'walk')
    this.bodyBox(this.realArt ? 40 : 34, this.realArt ? 60 : 48)
    if (!this.realArt) {
      this.setTint(TINT.cabinet)
      this.doorGfx = scene.add.graphics()
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : TINT.cabinet
  }

  /** Front blocks except during the post-charge open window. */
  blocks(dir: number) {
    if (this.fsm === 'HURT' || this.fsm === 'DEAD') return false
    if (this.phase === 'open') return false
    const face = this.flipX ? -1 : 1
    return dir === -face
  }

  canHurtPlayer() {
    return (
      this.active &&
      this.fsm !== 'DEAD' &&
      this.fsm !== 'HURT' &&
      this.phase === 'charge' &&
      this.contactCd <= 0
    )
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.doorGfx?.setVisible(false)
      this.clearWarn()
      return
    }
    const now = this.scene.time.now
    this.contactCd = Math.max(0, this.contactCd - dt)
    if (isActorFrozen(this, now)) {
      this.drawDoor()
      return
    }
    this.y = this.s2.floorY()
    if (this.fsm === 'HURT') {
      this.think -= dt
      if (this.think <= 0) this.setFsm('CHASE')
      this.setVelocity(0, 0)
      if (this.realArt) this.anim('hurt')
      this.drawDoor()
      return
    }
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    this.t += dt

    if (this.phase === 'chase') {
      this.setFlipX(dx < 0)
      this.anim(Math.abs(dx) < 50 ? (this.realArt ? 'warning' : 'reach') : 'walk')
      this.setVelocityX(Math.abs(dx) < 10 ? 0 : Math.sign(dx) * CAB_WALK)
      if (Math.abs(dx) <= CAB_ENGAGE && Math.abs(dx) > 40 && this.canEngageFromScreen()) {
        this.phase = 'warn'
        this.t = 0
        this.dir = (Math.sign(dx) || 1) as 1 | -1
        this.setVelocity(0, 0)
        this.showWarn()
      }
      this.drawDoor()
    } else if (this.phase === 'warn') {
      this.setVelocity(0, 0)
      this.setFlipX(this.dir < 0)
      this.anim(this.realArt ? 'warning' : 'reach')
      const blink = Math.floor(now / 90) % 2 === 0
      if (!this.realArt) this.setTint(blink ? 0xffe080 : TINT.cabinet)
      this.warnMark?.setPosition(this.x, this.y - 60)
      this.drawDoor(true)
      if (this.t >= CAB_WARN_MS) {
        if (!this.realArt) this.setTint(TINT.cabinet)
        this.clearWarn()
        this.phase = 'charge'
        this.t = 0
        this.chargeFrom = this.x
        this.hitThis = false
        this.setFsm('ATTACK')
        this.anim(this.realArt ? 'attack' : 'walk')
      }
    } else if (this.phase === 'charge') {
      this.setFlipX(this.dir < 0)
      this.setVelocityX(this.dir * CAB_CHARGE_SPEED)
      if (this.realArt) this.anim('attack')
      this.drawDoor(true)
      const traveled = Math.abs(this.x - this.chargeFrom)
      const body = this.body as Phaser.Physics.Arcade.Body
      if (traveled >= CAB_CHARGE_DIST || body.blocked.left || body.blocked.right || this.t > 2000) {
        this.phase = 'open'
        this.t = 0
        this.setFsm('CHASE')
        this.setVelocity(0, 0)
      }
    } else {
      // open — front is soft; hold attack end pose on real art
      this.setVelocity(0, 0)
      this.anim(this.realArt ? 'attack' : 'reach')
      this.drawDoor(false, true)
      if (this.t >= CAB_OPEN_MS) {
        this.phase = 'chase'
        this.t = 0
      }
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }

  private showWarn() {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 60, '！', {
        fontSize: '16px',
        color: '#ffe080',
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

  private drawDoor(ajar = false, open = false) {
    const g = this.doorGfx
    if (!g) return
    g.clear()
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      g.setVisible(false)
      return
    }
    g.setVisible(true)
    const face = this.flipX ? -1 : 1
    const sx = this.x + face * 18
    const sy = this.y - 30
    const gap = open ? 14 : ajar ? 6 : 0
    // Cabinet face plate
    g.fillStyle(0xb89860, 1).fillRoundedRect(sx - 12, sy - 22, 24, 44, 2)
    g.lineStyle(2, 0x4a3820, 1).strokeRoundedRect(sx - 12, sy - 22, 24, 44, 2)
    // Door swing (gap shows soft belly)
    if (gap > 0) {
      g.fillStyle(0x3a2820, 1).fillRect(sx - face * 2, sy - 18, face * gap, 36)
    } else {
      g.fillStyle(0xc0a040, 1).fillCircle(sx + face * 6, sy, 3)
      g.lineStyle(1, 0x6a5030, 1).lineBetween(sx - 6, sy - 8, sx + 6, sy - 8)
      g.lineBetween(sx - 6, sy + 6, sx + 6, sy + 6)
    }
    g.setDepth(this.depth + 2)
  }

  protected override die(dir: number) {
    this.clearWarn()
    this.doorGfx?.destroy()
    this.doorGfx = null
    super.die(dir)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.doorGfx?.destroy()
    super.destroy(fromScene)
  }
}


// ── 主任研究員（s8-3）──────────────────────────────────────────────────

export type ResearcherCfg = {
  hp: number
  phase2At: number
  phase3Below: number
  swipeWarnMs: number
  flaskWarnMs: number
  flaskCount: number
  puddleMs: number
  refillExposedMs: number
  summonPerCycle: number
  summonMaxAlive: number
  weakBase: number
  capWeak: number
  capNormal: number
}

export type ResearcherHooks = {
  floorY: () => number
  /** Parabolic fake-honey flask → sticky puddle lasting cfg.puddleMs. */
  throwFlask: (fromX: number, fromY: number, targetX: number) => void
  /** Spawn up to summonPerCycle tubes; returns how many were spawned. */
  summonTubes: (per: number, maxAlive: number) => number
  tubeCount: () => number
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

type Act =
  | 'intro'
  | 'stalk'
  | 'swipeWarn'
  | 'swipe'
  | 'flaskWarn'
  | 'flask'
  | 'refill'

/**
 * 主任研究員 — clipboard swipe, 3 sticky flasks, refill weak window.
 * Phase 2+ summons TubeSoldiers each cycle (ticket numbers from researcher cfg).
 */
export class ChiefResearcher extends AnimEnemy {
  qphase: 1 | 2 | 3 = 1
  act: Act = 'intro'
  arenaX0: number
  arenaX1: number
  onDefeated?: () => void
  private t = 0
  private lastHitAt = 0
  private flasksThrown = 0
  private next: 'swipe' | 'flask' = 'swipe'
  private dir: 1 | -1 = -1
  private swipeFrom = 0
  private rh: ResearcherHooks
  private cfg: ResearcherCfg
  private board: Phaser.GameObjects.Graphics | null = null
  private warnMark: Phaser.GameObjects.Text | null = null
  private readonly realArt: boolean

  constructor(
    scene: Phaser.Scene,
    x: number,
    arenaX0: number,
    arenaX1: number,
    cfg: ResearcherCfg,
    rh: ResearcherHooks,
  ) {
    super(scene, x, rh.floorY(), 'triboss', { floorY: rh.floorY }, 'idle')
    this.species = 'researcher'
    this.kind = 'boss'
    this.boss = true
    this.cfg = cfg
    this.rh = rh
    this.hp = this.maxHp = cfg.hp
    this.hurtMs = 160
    this.arenaX0 = arenaX0
    this.arenaX1 = arenaX1
    this.realArt = bindStage8Sheet(this, 's8researcher', 'idle')
    const bw = this.realArt ? 48 : 44
    const bh = this.realArt ? 72 : 56
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(bw, bh)
    body.setOffset((this.frame.width - bw) / 2, this.frame.height - bh - 6)
    if (!this.realArt) {
      this.setTint(0xb8d0e8)
      this.board = scene.add.graphics()
    }
  }

  protected override defaultTint() {
    return this.realArt ? 0xffffff : 0xb8d0e8
  }

  canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    if (this.act === 'intro' || this.act === 'refill' || this.act === 'swipeWarn' || this.act === 'flaskWarn') return false
    if (this.act === 'swipe') return this.contactCd <= 0
    return this.contactCd <= 0 && this.act === 'stalk'
  }

  receiveHit(dmg: number, dir: number): EnemyHitResult {
    const now = this.scene.time.now
    if (now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = now
    const weak = this.act === 'refill'
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
    this.rh.bossEvent(next === 2 ? 'phase2' : 'phase3')
    floatText(this.scene, this.x, this.y - 70, next === 2 ? '第二段！' : '第三段！', '#ffe08a', { size: 14, dur: 1200 })
  }

  private go(a: Act) {
    this.act = a
    this.t = 0
    this.flasksThrown = 0
    this.setVelocity(0, 0)
    if (!this.realArt) {
      if (a === 'refill') {
        this.setTint(0xffe060)
      } else if (a === 'swipeWarn' || a === 'flaskWarn') {
        this.setTint(0xffc080)
      } else {
        this.setTint(0xb8d0e8)
      }
    }
    if (a === 'refill') this.rh.bossEvent('weak')
    if (this.realArt) {
      const map: Record<Act, string> = {
        intro: 'idle',
        stalk: 'idle',
        swipeWarn: 'board_warning',
        swipe: 'board_sweep',
        flaskWarn: 'bottle_warning',
        flask: 'bottle_throw',
        refill: 'weakpoint_glow',
      }
      this.anim(map[a])
    } else {
      this.anim(
        a === 'swipe' || a === 'swipeWarn'
          ? 'rain'
          : a === 'flask' || a === 'flaskWarn'
            ? 'point'
            : a === 'refill'
              ? 'hurt'
              : 'idle',
      )
    }
  }

  protected override die(_dir: number) {
    this.clearWarn()
    this.board?.destroy()
    this.board = null
    this.hp = 0
    this.act = 'intro'
    this.boss = false
    this.setFsm('DEAD')
    this.setVelocity(0, 0)
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.clearTint()
    this.anim('defeat')
    this.rh.bossEvent('defeat')
    this.scene.time.delayedCall(1800, () => {
      this.onDefeated?.()
      if (!this.scene) return
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }

  tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.board?.setVisible(false)
      return
    }
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.t += dt
    const floor = this.rh.floorY()
    this.y = floor
    const tgt = pickTarget(this, ctx.boy, ctx.girl)
    const dx = tgt.x - this.x
    const toward = (Math.sign(dx) || -1) as 1 | -1
    const x0 = this.arenaX0 + 24
    const x1 = this.arenaX1 - 24
    const stalkMs = this.qphase === 3 ? 500 : this.qphase === 2 ? 700 : 900

    switch (this.act) {
      case 'intro':
        this.setFlipX(dx < 0)
        this.drawBoard(false)
        if (this.t > 1100) this.go('stalk')
        break

      case 'stalk': {
        this.setFlipX(dx < 0)
        const dist = Math.abs(dx)
        // Close in for clipboard swipe; flasks can start from mid-range.
        if (this.next === 'swipe' && dist > 120) this.setVelocityX(toward * (this.qphase === 3 ? 95 : 70))
        else if (this.next === 'flask' && dist > 200) this.setVelocityX(toward * 55)
        else this.setVelocityX(0)
        this.drawBoard(false)
        if (this.t >= stalkMs) {
          // Phase 2+: summon tubes once per cycle before the attack.
          if (this.qphase >= 2) {
            this.rh.summonTubes(this.cfg.summonPerCycle, this.cfg.summonMaxAlive)
          }
          if (this.next === 'swipe') {
            this.dir = toward
            this.go('swipeWarn')
            this.showWarn('！')
          } else {
            this.go('flaskWarn')
            this.showWarn('瓶！')
          }
        }
        break
      }

      case 'swipeWarn':
        this.setVelocity(0, 0)
        this.setFlipX(this.dir < 0)
        this.drawBoard(true)
        this.warnMark?.setPosition(this.x, this.y - 64)
        if (this.t >= this.cfg.swipeWarnMs) {
          this.clearWarn()
          this.swipeFrom = this.x
          this.hitThis = false
          this.go('swipe')
          SFX.siren()
          floatText(this.scene, this.x, this.y - 56, '紀錄板！', '#ffe08a', { size: 12, dur: 600 })
        }
        break

      case 'swipe': {
        this.setFlipX(this.dir < 0)
        // Short forward sweep with the clipboard (~110px).
        this.setVelocityX(this.dir * 260)
        this.drawBoard(true, true)
        const traveled = Math.abs(this.x - this.swipeFrom)
        if (traveled >= 110 || this.t > 500) {
          this.setVelocity(0, 0)
          this.next = 'flask'
          this.go('stalk')
        }
        break
      }

      case 'flaskWarn':
        this.setVelocity(0, 0)
        this.setFlipX(dx < 0)
        this.drawBoard(false, false, true)
        this.warnMark?.setPosition(this.x, this.y - 64)
        if (this.t >= this.cfg.flaskWarnMs) {
          this.clearWarn()
          this.go('flask')
        }
        break

      case 'flask': {
        this.setVelocity(0, 0)
        this.setFlipX(dx < 0)
        this.drawBoard(false, false, true)
        const gap = 220
        while (this.flasksThrown < this.cfg.flaskCount && this.t >= 80 + this.flasksThrown * gap) {
          const i = this.flasksThrown
          // Spread landings around the player (±40 per flask), clamped to arena.
          const aim = Phaser.Math.Clamp(tgt.x + (i - 1) * 50, this.arenaX0 + 30, this.arenaX1 - 30)
          this.rh.throwFlask(this.x + (this.flipX ? -14 : 14), this.y - 40, aim)
          this.flasksThrown++
        }
        if (this.flasksThrown >= this.cfg.flaskCount && this.t >= 80 + this.cfg.flaskCount * gap + 100) {
          this.next = 'swipe'
          this.go('refill')
        }
        break
      }

      case 'refill':
        this.setVelocity(0, 0)
        this.drawBoard(false)
        // Glow pulse while bottles are refilled — weak window.
        if (!this.realArt) {
          const blink = Math.floor(this.scene.time.now / 120) % 2 === 0
          this.setTint(blink ? 0xfff0a0 : 0xffd050)
        }
        if (this.t >= this.cfg.refillExposedMs) {
          if (!this.realArt) this.setTint(0xb8d0e8)
          this.go('stalk')
        }
        break
    }
    this.x = Phaser.Math.Clamp(this.x, x0, x1)
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }

  private showWarn(label: string) {
    this.clearWarn()
    this.warnMark = this.scene.add
      .text(this.x, this.y - 64, label, {
        fontSize: '16px',
        color: '#ffe080',
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

  private drawBoard(raised: boolean, sweeping = false, holdingFlask = false) {
    const g = this.board
    if (!g) return
    g.clear()
    if (!this.active || !this.visible || this.fsm === 'DEAD') {
      g.setVisible(false)
      return
    }
    g.setVisible(true)
    const face = this.flipX ? -1 : 1
    if (holdingFlask) {
      const cx = this.x + face * 16
      const cy = this.y - 44
      g.fillStyle(0xe8d080, 1).fillRoundedRect(cx - 6, cy - 10, 12, 16, 2)
      g.fillStyle(0xc060ff, 0.85).fillRect(cx - 4, cy - 2, 8, 6)
      g.setDepth(this.depth + 2)
      return
    }
    const bx = this.x + face * (sweeping ? 28 : raised ? 18 : 14)
    const by = this.y - (raised || sweeping ? 36 : 28)
    const w = sweeping ? 34 : 22
    const h = sweeping ? 10 : 28
    g.fillStyle(0xe8d8b0, 1).fillRoundedRect(bx - w / 2, by - h / 2, w, h, 2)
    g.lineStyle(2, 0x6a5030, 1).strokeRoundedRect(bx - w / 2, by - h / 2, w, h, 2)
    g.lineStyle(1, 0x8a7050, 1)
    for (let i = -2; i <= 2; i++) g.lineBetween(bx - w / 2 + 3, by + i * 5, bx + w / 2 - 3, by + i * 5)
    g.setDepth(this.depth + 2)
  }

  override destroy(fromScene?: boolean) {
    this.clearWarn()
    this.board?.destroy()
    super.destroy(fromScene)
  }
}
