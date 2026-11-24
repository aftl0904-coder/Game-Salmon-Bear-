import Phaser from 'phaser'
import { Enemy, type EnemyHitResult } from './Enemy'
import { actorDepth, DEPTH } from '../engine/depth'
import { bossHitDamage } from '../engine/bossDamage'
import { isActorFrozen } from '../fx'
import type { HeroRef } from '../enemyAi'
import { DIRECTOR_HP } from './Stage6Enemies'
import { FONT_UI } from '../ui/fonts'

type Hero = HeroRef & { alive?: boolean; hurtLock?: number; body?: Phaser.Physics.Arcade.Body; facing?: number }
type Ctx = { boy: Hero; girl: Hero | null; leadX: number; prevLeadX: number }
type Act =
  | 'intro'
  | 'scan'
  | 'reposition'
  | 'warn-charge'
  | 'charge'
  | 'charge-return'
  | 'warn-acid'
  | 'acid'
  | 'warn-foam'
  | 'foam'
  | 'warn-brush'
  | 'brush'
  | 'warn-cart'
  | 'cart'
  | 'recover'
type Move = 'charge' | 'acid' | 'foam' | 'brush' | 'cart'
type Pose = 'idle' | 'warn' | 'charge' | 'recover' | 'spray' | 'spin' | 'defeated'
type Hooks = {
  floorY: () => number
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

/** Batch6 C1 numbers — do not retune without Claude. */
const CHARGE_SPEED = 360
const WARN_CHARGE_MS = 600
const WARN_CHARGE_UNSAFE_MS = 900
const CHARGE_MAX_DIST = 260
const CHARGE_RETURN_DIST = 140
const RECOVER_MS = 1200
const RECOVER_P3_MS = 900
const ACID_NOZZLE_MS = 400
const ACID_WARN_MS = 800
const ACID_LIFE_MS = 3000
const ACID_FADE_MS = 300
/** E3: puddle width 48px (half 24); was 64. */
const ACID_HALF = 24
const ACID_SPREAD = 170
const ACID_MIN_GAP = 96
const ACID_DROP_IF_GAP = 140
const ACID_HIT_LOCK_MS = 1000
const FOAM_WARN_MS = 500
const FOAM_LIFE_MS = 4000
const FOAM_WIDTH = 160
const FOAM_SLIP_MUL = 0.4
const BRUSH_WARN_MS = 600
const BRUSH_SPIN_MS = 1200
const BRUSH_RANGE = 90
const CART_WARN_MS = 500
const CART_SPEED = 90
const CART_HP = 3
const CART_COOLDOWN_MS = 12000
const HIT_STUN_WINDOW_MS = 3000
const HIT_STUN_CAP_MS = 300
const HIT_STUN_IMMUNE_MS = 2000
const HIT_STUN_PER_HIT_MS = 80
/** E8: phase cadence P1=8s / P2=6s / P3=4.5s */
const BLOWER_PERIOD_P1_MS = 8000
const BLOWER_PERIOD_P2_MS = 6000
const BLOWER_PERIOD_P3_MS = 4500
const BLOWER_WARN_MS = 600
const BLOWER_BLAST_MS = 2500
const BLOWER_DISABLE_MS = 8000
const BLOWER_BEHIND_PX = 50
const BLOWER_FOLLOW_MUL = 0.9
const BODY_HALF = 48
const ARENA_PAD = 14
const REPOSITION_FORCE_ATTACK = 2

type Acid = {
  x: number
  harmFrom: number
  until: number
  g: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  hitAt: WeakMap<object, number>
}

type FoamZone = {
  x0: number
  x1: number
  until: number
  g: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
}

type CleaningCart = {
  img: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  dir: 1 | -1
  hp: number
  hitAt: number
}

/** Manus scrubber-sheet-v2: 12×96 @ 1152×80. Brush/nozzle face LEFT in art. */
const SCRUBBER_SHEET = 'c2-scrubber'
const BLOWER_SHEET = 'c2-blower'
const CART_SHEET = 'c2-clean-cart'
const FOAM_SHEET = 'c2-foam'
const ACID_PUDDLE = 'c2-acid-puddle'
const ACID_DRIP = 'c2-acid-drip'
/** 0–1 idle · 2–3 warn · 4–5 charge · 6–7 recover · 8 spray · 9–10 spin · 11 defeated */
const SCRUBBER_FRAME: Record<Pose, number> = {
  idle: 0,
  warn: 2,
  charge: 4,
  recover: 6,
  spray: 8,
  spin: 9,
  defeated: 11,
}
/** blower-sheet-v2: 0 off · 1 warn · 2–3 on (no stunned frame — reuse off + tint) */
const BLOWER_FRAME: Record<'off' | 'warn' | 'on' | 'stunned', number> = {
  off: 0,
  warn: 1,
  on: 2,
  stunned: 0,
}
const CART_FRAME = { push: 0, broken: 1 } as const
const FOAM_FRAMES = 2

function applyScrubberPose(sprite: Phaser.GameObjects.Sprite, pose: Pose) {
  if (!sprite.scene?.textures?.exists(SCRUBBER_SHEET)) return false
  if (sprite.texture.key !== SCRUBBER_SHEET) sprite.setTexture(SCRUBBER_SHEET, SCRUBBER_FRAME[pose])
  else sprite.setFrame(SCRUBBER_FRAME[pose])
  return true
}

function applyBlowerState(img: Phaser.GameObjects.Image, state: 'off' | 'warn' | 'on' | 'stunned') {
  if (!img.scene?.textures?.exists(BLOWER_SHEET)) return false
  img.setTexture(BLOWER_SHEET, BLOWER_FRAME[state])
  return true
}

/** Pose 2-frame anim: idle/warn/charge/recover/spin use base + 0|1. */
function poseAnimFrame(pose: Pose, elapsedMs: number, period = 280): number {
  const base = SCRUBBER_FRAME[pose]
  if (pose === 'spray' || pose === 'defeated') return base
  return base + (Math.floor(elapsedMs / period) % 2)
}

const ATTACK_ACTS = new Set<Act>([
  'warn-charge',
  'charge',
  'charge-return',
  'warn-acid',
  'acid',
  'warn-foam',
  'foam',
  'warn-brush',
  'brush',
  'warn-cart',
  'cart',
])

/**
 * 深層潔淨 X-9 — batch6 C1 rework:
 * super-armor during attacks, hit-stun cap, 5 moves, face-player.
 */
export class MallScrubber extends Enemy {
  species = 'mall-scrubber'
  kind = 'boss'
  boss = true
  flying = false
  qphase: 1 | 2 | 3 = 1
  act: Act = 'intro'
  onDefeated?: () => void
  readonly arenaX0: number
  readonly arenaX1: number
  private hooks6: Hooks
  private elapsed = 0
  private lastHitAt = -1000
  private dir: 1 | -1 = -1
  private endX = 0
  private returnEndX = 0
  private warning = { x0: 0, x1: 0 }
  private warnGraphic: Phaser.GameObjects.Graphics
  private marker: Phaser.GameObjects.Text
  private hitHeroes = new WeakSet<object>()
  private lastMove: Move | null = null
  private repositionX = 0
  private repositionStreak = 0
  private warnChargeNeed = WARN_CHARGE_MS
  private acids: Acid[] = []
  private acidTargets: number[] = []
  private foams: FoamZone[] = []
  private cart: CleaningCart | null = null
  private lastCartAt = -CART_COOLDOWN_MS
  blower!: Phaser.GameObjects.Image
  private blowerHits = 0
  private blowerDisabledUntil = 0
  private blowerCycle = 0
  private blowerPhase: 'idle' | 'warn' | 'blast' = 'idle'
  private windGfx: Phaser.GameObjects.Graphics
  private pose: Pose = 'idle'
  private chip?: Phaser.GameObjects.Rectangle
  private recoverNeed = RECOVER_MS
  private stunBudget = HIT_STUN_CAP_MS
  private stunWindowStart = 0
  private stunImmuneUntil = 0
  private stunUntil = 0
  private brushHitAt = new WeakMap<object, number>()

  constructor(scene: Phaser.Scene, x: number, x0: number, x1: number, hooks: Hooks) {
    super(scene, x, hooks.floorY(), SCRUBBER_SHEET, SCRUBBER_FRAME.idle)
    this.hooks6 = hooks
    this.arenaX0 = x0
    this.arenaX1 = x1
    this.hp = this.maxHp = DIRECTOR_HP
    this.setOrigin(0.5, 1)
    applyScrubberPose(this, 'idle')
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(BODY_HALF * 2, 58).setOffset(8, 20)
    this.warnGraphic = scene.add.graphics().setDepth(DEPTH.HAZARD + 2)
    this.marker = scene.add
      .text(x, this.y - 100, '', { fontFamily: FONT_UI, fontSize: '16px', color: '#fff2bb', stroke: '#42200b', strokeThickness: 4 })
      .setOrigin(0.5)
      .setVisible(false)
    this.windGfx = scene.add.graphics().setDepth(DEPTH.HAZARD + 1)
    // E8: start on the ground behind the boss (not floating mid-arena).
    const behind0 = Phaser.Math.Clamp(x + BLOWER_BEHIND_PX, x0 + 20, x1 - 20)
    this.blower = scene.add
      .image(behind0, hooks.floorY(), BLOWER_SHEET, BLOWER_FRAME.off)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.PROP + 2)
    applyBlowerState(this.blower, 'off')
  }

  override canHurtPlayer() {
    if (!this.active || this.fsm === 'DEAD') return false
    return this.act === 'charge' || this.act === 'charge-return' || this.act === 'brush'
  }
  canHurtHero(hero: object) {
    return !this.hitHeroes.has(hero)
  }
  markHurtHero(hero: object) {
    this.hitHeroes.add(hero)
  }

  acidZones(): Array<{ x0: number; x1: number; acid: Acid }> {
    const now = this.scene.time.now
    return this.acids
      .filter((a) => a.until > now && now >= a.harmFrom)
      .map((a) => ({ x0: a.x - ACID_HALF, x1: a.x + ACID_HALF, acid: a }))
  }

  foamZones(): Array<{ x0: number; x1: number; mul: number }> {
    const now = this.scene.time.now
    return this.foams.filter((z) => z.until > now).map((z) => ({ x0: z.x0, x1: z.x1, mul: FOAM_SLIP_MUL }))
  }

  brushHurtsHero(hero: object, hx: number): boolean {
    if (this.act !== 'brush') return false
    if (Math.abs(hx - this.x) > BRUSH_RANGE) return false
    const last = this.brushHitAt.get(hero) ?? 0
    if (this.scene.time.now - last < 500) return false
    this.brushHitAt.set(hero, this.scene.time.now)
    return true
  }

  cartHurtZone(): { x0: number; x1: number } | null {
    if (!this.cart) return null
    return { x0: this.cart.img.x - 22, x1: this.cart.img.x + 22 }
  }

  hitCart(hx: number) {
    if (!this.cart) return
    if (Math.abs(hx - this.cart.img.x) > 36) return
    const now = this.scene.time.now
    if (now - this.cart.hitAt < 200) return
    this.cart.hitAt = now
    this.cart.hp -= 1
    this.cart.img.setTint(0xffccaa)
    this.scene.time.delayedCall(60, () => {
      if (this.cart) this.cart.img.clearTint()
    })
    if (this.cart.hp <= 0) {
      if (this.scene.textures.exists(CART_SHEET)) this.cart.img.setFrame(CART_FRAME.broken)
      const dead = this.cart
      this.cart = null
      this.scene.time.delayedCall(220, () => {
        dead.img.destroy()
        dead.label.destroy()
      })
    }
  }

  isBlowerBlasting() {
    return this.blowerPhase === 'blast' && this.scene.time.now >= this.blowerDisabledUntil
  }

  /** True when hero velocity is toward the boss (into the wind from behind-boss blower). */
  intoWind(vx: number, heroX: number) {
    if (!this.isBlowerBlasting()) return false
    const wind = this.blowerWindDir()
    // Moving with the wind direction = walking toward / past boss into the blast.
    if (wind > 0) return vx > 12 && heroX < this.x + 80
    return vx < -12 && heroX > this.x - 80
  }

  hitBlower(hx: number) {
    // E8: available from P1 (was P3-only).
    if (this.fsm === 'DEAD') return
    if (this.scene.time.now < this.blowerDisabledUntil) return
    if (Math.abs(hx - this.blower.x) > 40) return
    this.blowerHits++
    this.blower.setTint(0xffccaa)
    this.scene.time.delayedCall(80, () => this.blower.clearTint())
    if (this.blowerHits >= 3) {
      this.blowerHits = 0
      this.blowerDisabledUntil = this.scene.time.now + BLOWER_DISABLE_MS
      this.blowerPhase = 'idle'
      applyBlowerState(this.blower, 'stunned')
      this.windGfx.clear()
      this.scene.time.delayedCall(BLOWER_DISABLE_MS, () => {
        if (this.active) applyBlowerState(this.blower, 'off')
      })
    }
  }

  override receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.fsm === 'DEAD' || this.scene.time.now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = this.scene.time.now
    const fromFront = (dir > 0 && !this.flipX) || (dir < 0 && this.flipX)
    const backWeak = this.act === 'recover' && !fromFront
    let raw = dmg
    if (backWeak) raw = Math.max(1, Math.round(dmg * 2))
    else if (fromFront && this.act !== 'recover') raw = Math.max(1, Math.floor(dmg * 0.5))
    const hit = bossHitDamage(raw, { weak: this.act === 'recover', weakBase: 3, capNormal: 2, capWeak: 5 })
    const x = this.x
    const y = this.y
    const result = super.receiveHit(hit, dir)
    // Super armor: never knock back / interrupt during attack acts.
    this.setPosition(x, y).setVelocity(0, 0)
    this.setTint(0xffffff)
    this.scene.time.delayedCall(60, () => {
      if (this.active && this.fsm !== 'DEAD') this.clearTint()
    })
    if (result.killed) return result
    this.setFsm('PATROL')
    const fraction = this.hp / this.maxHp
    const phase: 1 | 2 | 3 = fraction < 0.3 ? 3 : fraction <= 0.6 ? 2 : 1
    if (phase > this.qphase) {
      this.qphase = phase
      this.hooks6.bossEvent(phase === 2 ? 'phase2' : 'phase3')
      this.scene.cameras.main.shake(180, 0.004)
      this.marker.setText('（待補）').setVisible(true)
      this.forceRecover(this.recoverMs())
      return result
    }
    // Attack acts: damage + flash only — never recover / stun-lock.
    if (ATTACK_ACTS.has(this.act)) return result
    // Recover (or idle scan): limited hit-stun only.
    this.applyHitStun()
    return result
  }

  private applyHitStun() {
    const now = this.scene.time.now
    if (now < this.stunImmuneUntil) return
    if (now - this.stunWindowStart > HIT_STUN_WINDOW_MS) {
      this.stunWindowStart = now
      this.stunBudget = HIT_STUN_CAP_MS
    }
    if (this.stunBudget <= 0) {
      this.stunImmuneUntil = now + HIT_STUN_IMMUNE_MS
      this.stunBudget = HIT_STUN_CAP_MS
      this.stunWindowStart = now + HIT_STUN_IMMUNE_MS
      return
    }
    const apply = Math.min(HIT_STUN_PER_HIT_MS, this.stunBudget)
    this.stunBudget -= apply
    this.stunUntil = Math.max(this.stunUntil, now + apply)
    if (this.stunBudget <= 0) {
      this.stunImmuneUntil = now + HIT_STUN_IMMUNE_MS
      this.stunBudget = HIT_STUN_CAP_MS
      this.stunWindowStart = now + HIT_STUN_IMMUNE_MS
    }
  }

  private setPose(pose: Pose) {
    if (this.pose === pose) return
    this.pose = pose
    applyScrubberPose(this, pose)
  }
  private setAct(act: Act) {
    this.act = act
    this.elapsed = 0
  }
  private clearWarning() {
    this.warnGraphic.clear()
    this.marker.setVisible(false)
  }
  private syncBody() {
    const body = this.body as Phaser.Physics.Arcade.Body
    body.reset(this.x, this.y)
    body.updateFromGameObject()
    body.prev.copy(body.position)
    body.prevFrame.copy(body.position)
  }
  private recoverMs() {
    return this.qphase === 3 ? RECOVER_P3_MS : RECOVER_MS
  }
  private recover() {
    this.forceRecover(this.recoverMs())
  }
  private forceRecover(ms: number) {
    this.setVelocity(0, 0)
    this.clearWarning()
    this.hitThis = false
    this.setFsm('PATROL')
    this.setAct('recover')
    this.setPose('recover')
    this.recoverNeed = ms
    this.elapsed = 0
    this.hooks6.bossEvent('weak')
  }

  private faceTarget(target: Hero) {
    this.dir = (Math.sign(target.x - this.x) || -1) as 1 | -1
    // Manus art faces LEFT; flipX true when facing right (toward +x).
    this.setFlipX(this.dir > 0)
  }

  private safeForAll(heroes: Hero[], x0: number, x1: number, warnMs: number) {
    const leftLimit = this.arenaX0 + ARENA_PAD
    const rightLimit = this.arenaX1 - ARENA_PAD
    const travel = Math.max(0, (warnMs - 450) * 0.105 - 12)
    return heroes.every((h) => {
      if ((h.hurtLock ?? 0) > 0) return false
      const half = Math.max(6, (h.body?.width ?? 12) / 2)
      const l = x0 - half - 3
      const r = x1 + half + 3
      if (h.x <= l || h.x >= r) return true
      return (l >= leftLimit && h.x - l <= travel) || (r <= rightLimit && r - h.x <= travel)
    })
  }

  private movePool(): Move[] {
    const pool: Move[] = ['charge', 'acid', 'foam']
    if (this.qphase >= 2) pool.push('brush')
    if (this.qphase >= 3) pool.push('cart')
    return pool
  }

  private pickMove(): Move {
    const pool = this.movePool().filter((m) => m !== this.lastMove)
    if (pool.length === 0) return 'charge'
    // Cart cooldown: skip if too soon.
    const filtered =
      this.scene.time.now - this.lastCartAt < CART_COOLDOWN_MS ? pool.filter((m) => m !== 'cart') : pool
    const use = filtered.length ? filtered : pool
    return use[Math.floor(Math.random() * use.length)]!
  }

  private beginCharge(heroes: Hero[], target: Hero) {
    this.faceTarget(target)
    const left = this.arenaX0 + ARENA_PAD
    const right = this.arenaX1 - ARENA_PAD
    this.endX = Phaser.Math.Clamp(this.x + this.dir * CHARGE_MAX_DIST, left, right)
    if (Math.abs(this.endX - this.x) < 30) {
      this.dir = (-this.dir) as 1 | -1
      this.setFlipX(this.dir > 0)
      this.endX = Phaser.Math.Clamp(this.x + this.dir * CHARGE_MAX_DIST, left, right)
    }
    if (Math.abs(this.endX - this.x) < 30) {
      if (this.repositionStreak < REPOSITION_FORCE_ATTACK) {
        this.repositionStreak++
        this.repositionX = Phaser.Math.Clamp(
          this.x - this.dir * 60,
          this.arenaX0 + BODY_HALF,
          this.arenaX1 - BODY_HALF,
        )
        this.setAct('reposition')
        return
      }
      const toLeft = this.x - left
      const toRight = right - this.x
      this.dir = (toRight >= toLeft ? 1 : -1) as 1 | -1
      this.setFlipX(this.dir > 0)
      this.endX = Phaser.Math.Clamp(this.x + this.dir * CHARGE_MAX_DIST, left, right)
    }
    this.repositionStreak = 0
    this.returnEndX = Phaser.Math.Clamp(this.endX + (-this.dir) * CHARGE_RETURN_DIST, left, right)
    this.warning = {
      x0: Math.min(this.x, this.endX, this.returnEndX) - BODY_HALF,
      x1: Math.max(this.x, this.endX, this.returnEndX) + BODY_HALF,
    }
    this.warnChargeNeed = this.safeForAll(heroes, this.warning.x0, this.warning.x1, WARN_CHARGE_MS)
      ? WARN_CHARGE_MS
      : WARN_CHARGE_UNSAFE_MS
    this.lastMove = 'charge'
    this.setPose('warn')
    this.setAct('warn-charge')
    this.warnGraphic
      .clear()
      .fillStyle(0xff2030, 0.32)
      .fillRect(this.warning.x0, this.y - 64, this.warning.x1 - this.warning.x0, 64)
      .lineStyle(3, 0xff6070, 1)
      .strokeRect(this.warning.x0, this.y - 64, this.warning.x1 - this.warning.x0, 64)
    if (this.marker?.scene) this.marker.setText(this.dir < 0 ? '！←' : '！→').setVisible(true)
  }

  beginAcid(heroes: Hero[], target: Hero) {
    if (this.acids.length >= 3) {
      this.beginCharge(heroes, target)
      return
    }
    this.faceTarget(target)
    this.repositionStreak = 0
    this.lastMove = 'acid'
    this.setPose('spray')
    this.setAct('warn-acid')
    this.marker.setText('酸！').setVisible(true)
    // E3: player / −170 / +170; clamp; drop if neighbours <140; enforce ≥96 gap.
    let lands = [target.x, target.x - ACID_SPREAD, target.x + ACID_SPREAD]
    if (this.isBlowerBlasting()) {
      const windDir = this.blowerWindDir()
      lands = lands.map((x) => x + windDir * 40)
    }
    const lo = this.arenaX0 + 30
    const hi = this.arenaX1 - 30
    lands = lands.map((x) => Phaser.Math.Clamp(x, lo, hi))
    lands.sort((a, b) => a - b)
    // Drop one if any adjacent gap < ACID_DROP_IF_GAP after clamp.
    const kept: number[] = []
    for (const x of lands) {
      if (!kept.length || x - kept[kept.length - 1]! >= ACID_DROP_IF_GAP) kept.push(x)
      else if (Math.abs(x - target.x) < Math.abs(kept[kept.length - 1]! - target.x)) {
        // Prefer keeping the puddle closer to the player when dropping a duplicate cluster.
        kept[kept.length - 1] = x
      }
    }
    // Final pass: ensure min gap 96 by dropping extras from the right.
    const spaced: number[] = []
    for (const x of kept) {
      if (!spaced.length || x - spaced[spaced.length - 1]! >= ACID_MIN_GAP) spaced.push(x)
    }
    this.acidTargets = spaced
    for (const x of this.acidTargets) this.spawnAcidWarn(x)
  }

  /** Blow toward player = boss face. Art faces left; flipX true = facing right = +1. */
  blowerWindDir(): 1 | -1 {
    return this.flipX ? 1 : -1
  }

  blowerPeriodMs() {
    if (this.qphase >= 3) return BLOWER_PERIOD_P3_MS
    if (this.qphase >= 2) return BLOWER_PERIOD_P2_MS
    return BLOWER_PERIOD_P1_MS
  }

  private beginFoam(target: Hero) {
    this.faceTarget(target)
    this.repositionStreak = 0
    this.lastMove = 'foam'
    this.setPose('spray')
    this.setAct('warn-foam')
    this.marker.setText('泡沫！').setVisible(true)
    const floor = this.hooks6.floorY()
    const bands = [
      { x0: this.x - FOAM_WIDTH, x1: this.x },
      { x0: this.x, x1: this.x + FOAM_WIDTH },
    ]
    this.warnGraphic.clear()
    for (const b of bands) {
      const x0 = Phaser.Math.Clamp(b.x0, this.arenaX0, this.arenaX1)
      const x1 = Phaser.Math.Clamp(b.x1, this.arenaX0, this.arenaX1)
      this.warnGraphic.fillStyle(0xa0e8ff, 0.35).fillRect(x0, floor - 18, x1 - x0, 16)
    }
  }

  private spawnFoamZones() {
    const floor = this.hooks6.floorY()
    const now = this.scene.time.now
    const bands = [
      { x0: this.x - FOAM_WIDTH, x1: this.x },
      { x0: this.x, x1: this.x + FOAM_WIDTH },
    ]
    for (const b of bands) {
      const x0 = Phaser.Math.Clamp(b.x0, this.arenaX0, this.arenaX1)
      const x1 = Phaser.Math.Clamp(b.x1, this.arenaX0, this.arenaX1)
      if (x1 - x0 < 8) continue
      const mid = (x0 + x1) / 2
      const w = Math.max(8, x1 - x0)
      const g = this.scene.add
        .image(mid, floor - 6, FOAM_SHEET, 0)
        .setOrigin(0.5, 1)
        .setDisplaySize(w, 12)
        .setDepth(DEPTH.HAZARD + 2)
      const label = this.scene.add
        .text(mid, floor - 28, '滑', {
          fontFamily: FONT_UI,
          fontSize: '10px',
          color: '#103040',
          backgroundColor: '#c8f0ff',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.SIGN)
      this.foams.push({ x0, x1, until: now + FOAM_LIFE_MS, g, label })
      this.scene.time.delayedCall(FOAM_LIFE_MS, () => {
        this.scene.tweens.add({
          targets: [g, label],
          alpha: 0,
          duration: 280,
          onComplete: () => {
            g.destroy()
            label.destroy()
          },
        })
      })
    }
  }

  private beginBrush(target: Hero) {
    this.faceTarget(target)
    this.repositionStreak = 0
    this.lastMove = 'brush'
    this.setPose('warn')
    this.setAct('warn-brush')
    this.marker.setText('刷！').setVisible(true)
    this.warnGraphic
      .clear()
      .fillStyle(0xffe080, 0.4)
      .fillCircle(this.x, this.y - 40, BRUSH_RANGE)
      .lineStyle(3, 0xffc040, 1)
      .strokeCircle(this.x, this.y - 40, BRUSH_RANGE)
    this.scene.cameras.main.shake(BRUSH_WARN_MS, 0.0025)
  }

  private beginCart(target: Hero) {
    this.faceTarget(target)
    this.repositionStreak = 0
    this.lastMove = 'cart'
    this.lastCartAt = this.scene.time.now
    this.setPose('warn')
    this.setAct('warn-cart')
    this.marker.setText('清潔車！').setVisible(true)
    const fromLeft = target.x > (this.arenaX0 + this.arenaX1) / 2
    const startX = fromLeft ? this.arenaX0 + 20 : this.arenaX1 - 20
    this.warnGraphic
      .clear()
      .fillStyle(0xff8060, 0.3)
      .fillRect(this.arenaX0, this.hooks6.floorY() - 40, this.arenaX1 - this.arenaX0, 36)
    this.marker.setPosition(startX, this.hooks6.floorY() - 90)
  }

  private spawnCart() {
    this.destroyCart()
    const floor = this.hooks6.floorY()
    const fromLeft = this.dir > 0
    const startX = fromLeft ? this.arenaX0 + 16 : this.arenaX1 - 16
    const dir = (fromLeft ? 1 : -1) as 1 | -1
    const img = this.scene.add
      .image(startX, floor, CART_SHEET, CART_FRAME.push)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.HAZARD + 4)
      .setFlipX(dir < 0)
    const label = this.scene.add
      .text(startX, floor - 48, '清潔車', {
        fontFamily: FONT_UI,
        fontSize: '10px',
        color: '#203040',
        backgroundColor: '#e0e8f0',
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.SIGN)
    this.cart = { img, label, dir, hp: CART_HP, hitAt: 0 }
  }

  private destroyCart() {
    if (!this.cart) return
    this.cart.img.destroy()
    this.cart.label.destroy()
    this.cart = null
  }

  private tickCart(dt: number) {
    if (!this.cart) return
    const step = (CART_SPEED * dt) / 1000
    const nx = this.cart.img.x + this.cart.dir * step
    this.cart.img.setX(nx)
    this.cart.label.setPosition(nx, this.hooks6.floorY() - 48)
    if (nx < this.arenaX0 - 30 || nx > this.arenaX1 + 30) this.destroyCart()
  }

  private spawnAcidWarn(x: number) {
    while (this.acids.length >= 3) {
      const old = this.acids.shift()!
      old.g.destroy()
      old.label.destroy()
    }
    const floor = this.hooks6.floorY()
    const now = this.scene.time.now
    const harmFrom = now + ACID_NOZZLE_MS + ACID_WARN_MS
    const puddleKey = this.scene.textures.exists(ACID_PUDDLE) ? ACID_PUDDLE : ACID_DRIP
    const g = this.scene.add
      .image(x, floor - 2, puddleKey, 0)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.HAZARD + 3)
      .setTint(0xff4060)
      .setAlpha(0.85)
    const label = this.scene.add
      .text(x, floor - 36, '強酸化學劑', {
        fontFamily: FONT_UI,
        fontSize: '11px',
        color: '#ffd0d0',
        backgroundColor: '#401018',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.SIGN)
    this.acids.push({ x, harmFrom, until: harmFrom + ACID_LIFE_MS, g, label, hitAt: new WeakMap() })
    this.scene.time.delayedCall(ACID_NOZZLE_MS + ACID_WARN_MS, () => {
      if (!this.active) return
      g.clearTint().setAlpha(1)
      if (this.scene.textures.exists(ACID_PUDDLE)) g.setTexture(ACID_PUDDLE, 1)
      label.setAlpha(0.35)
    })
    this.scene.time.delayedCall(ACID_NOZZLE_MS + ACID_WARN_MS + ACID_LIFE_MS, () => {
      if (!this.active) return
      this.scene.tweens.add({
        targets: [g, label],
        alpha: 0,
        duration: ACID_FADE_MS,
        onComplete: () => {
          g.destroy()
          label.destroy()
        },
      })
    })
  }

  tickBlower(dt: number) {
    // E8: from P1; grounded; follows behind boss 50px @ 0.9 speed; blows toward face.
    if (this.fsm === 'DEAD') {
      this.blowerPhase = 'idle'
      this.windGfx.clear()
      return
    }
    const floor = this.hooks6.floorY()
    // Behind boss relative to facing: art faces left; flipX true = facing right → behind is −x.
    const behind = this.x + (this.flipX ? -1 : 1) * BLOWER_BEHIND_PX
    const targetX = Phaser.Math.Clamp(behind, this.arenaX0 + 20, this.arenaX1 - 20)
    // Follow at ~boss chase speed ×0.9 (charge ~160 → ~144); catch-up when far.
    const dx = targetX - this.blower.x
    const followSpeed = 144 * BLOWER_FOLLOW_MUL
    const step = Math.sign(dx) * Math.min(Math.abs(dx), followSpeed * (dt / 1000))
    this.blower.setPosition(this.blower.x + step, floor)
    // Outlet faces left in art; match boss flip so wind always aims at the player.
    this.blower.setFlipX(this.flipX)

    if (this.scene.time.now < this.blowerDisabledUntil) {
      this.blowerPhase = 'idle'
      this.windGfx.clear()
      return
    }
    this.blowerCycle += dt
    const period = this.blowerPeriodMs()
    const cycle = this.blowerCycle % period
    const wind = this.blowerWindDir()
    if (cycle < BLOWER_WARN_MS) {
      this.blowerPhase = 'warn'
      applyBlowerState(this.blower, 'warn')
      this.windGfx.clear()
      // Yellow warn lamp
      this.windGfx.fillStyle(0xf2c230, 0.55).fillCircle(this.blower.x, floor - 28, 6)
    } else if (cycle < BLOWER_WARN_MS + BLOWER_BLAST_MS) {
      this.blowerPhase = 'blast'
      const onFrame = BLOWER_FRAME.on + (Math.floor(this.blowerCycle / 120) % 2)
      if (this.scene.textures.exists(BLOWER_SHEET)) this.blower.setTexture(BLOWER_SHEET, onFrame)
      this.windGfx.clear()
      this.windGfx.lineStyle(2, 0xa8d8ff, 0.45)
      for (let i = 0; i < 5; i++) {
        const x0 = this.blower.x + wind * 18
        const y = floor - 8 - i * 5
        this.windGfx.lineBetween(x0, y, x0 + wind * (70 + i * 10), y - 1)
      }
    } else {
      this.blowerPhase = 'idle'
      applyBlowerState(this.blower, 'off')
      this.windGfx.clear()
    }
  }

  private startMove(heroes: Hero[], target: Hero) {
    const move = this.pickMove()
    if (move === 'acid') this.beginAcid(heroes, target)
    else if (move === 'foam') this.beginFoam(target)
    else if (move === 'brush') this.beginBrush(target)
    else if (move === 'cart') this.beginCart(target)
    else this.beginCharge(heroes, target)
  }

  override tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD' || !this.scene) return
    if (isActorFrozen(this, this.scene.time.now)) {
      this.setVelocity(0, 0)
      return
    }
    const step = Math.min(Math.max(dt, 0), 50)
    const now = this.scene.time.now
    // Hit-stun freeze (recover / scan only; attacks never stun-lock).
    if (now < this.stunUntil && !ATTACK_ACTS.has(this.act)) {
      this.setVelocity(0, 0)
      this.y = this.hooks6.floorY()
      this.tickBlower(step)
      this.tickCart(step)
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      this.marker.setPosition(this.x, this.y - 102).setDepth(this.depth + 2)
      return
    }
    this.elapsed += step
    this.setVelocity(0, 0)
    this.y = this.hooks6.floorY()
    // Blower position updated inside tickBlower (follows behind boss).
    this.tickBlower(step)
    this.tickCart(step)

    for (let i = this.acids.length - 1; i >= 0; i--) {
      if (this.acids[i]!.until + ACID_FADE_MS <= now) this.acids.splice(i, 1)
    }
    for (let i = this.foams.length - 1; i >= 0; i--) {
      if (this.foams[i]!.until <= now) this.foams.splice(i, 1)
    }

    const heroes = [ctx.boy, ctx.girl].filter((h): h is Hero => !!h && h.active && h.alive !== false)
    // Foam sheet 0–1 loop while zones live.
    for (const z of this.foams) {
      if (z.g.active) z.g.setFrame(Math.floor(this.elapsed / 160) % FOAM_FRAMES)
    }

    if (this.act === 'intro') {
      this.setPose('idle')
      if (this.scene.textures.exists(SCRUBBER_SHEET)) this.setFrame(poseAnimFrame('idle', this.elapsed))
      if (this.elapsed >= 900) this.setAct('scan')
    } else if (this.act === 'scan') {
      this.setPose('idle')
      if (this.scene.textures.exists(SCRUBBER_SHEET)) this.setFrame(poseAnimFrame('idle', this.elapsed))
      if (heroes.length && this.elapsed >= 500) {
        const target = heroes.reduce((a, b) => (Math.abs(a.x - this.x) <= Math.abs(b.x - this.x) ? a : b))
        this.faceTarget(target)
        this.startMove(heroes, target)
      }
    } else if (this.act === 'reposition') {
      const distance = this.repositionX - this.x
      const dx = Math.sign(distance) * Math.min(Math.abs(distance), (45 * step) / 1000)
      this.setX(this.x + dx)
      this.syncBody()
      if (Math.abs(this.repositionX - this.x) < 0.1) this.setAct('scan')
    } else if (this.act === 'warn-charge') {
      if (this.scene.textures.exists(SCRUBBER_SHEET)) this.setFrame(poseAnimFrame('warn', this.elapsed))
      if (!heroes.length) this.recover()
      else if (this.elapsed >= this.warnChargeNeed) {
        this.clearWarning()
        this.hitThis = false
        this.hitHeroes = new WeakSet()
        this.setFsm('ATTACK')
        this.setPose('charge')
        this.setAct('charge')
      }
    } else if (this.act === 'charge') {
      if (this.scene.textures.exists(SCRUBBER_SHEET)) this.setFrame(poseAnimFrame('charge', this.elapsed, 120))
      const delta = (this.dir * CHARGE_SPEED * step) / 1000
      const nx = this.dir < 0 ? Math.max(this.endX, this.x + delta) : Math.min(this.endX, this.x + delta)
      this.setX(nx)
      this.syncBody()
      if (Math.random() < 0.35) {
        const dust = this.scene.add.circle(this.x - this.dir * 20, this.y - 6, 3 + Math.random() * 3, 0xc8b090, 0.45)
        dust.setDepth(DEPTH.FX)
        this.scene.tweens.add({ targets: dust, alpha: 0, y: dust.y - 8, duration: 280, onComplete: () => dust.destroy() })
      }
      if (Math.abs(this.x - this.endX) < 0.5) {
        // 180° turn + return charge 140px
        this.dir = (-this.dir) as 1 | -1
        this.setFlipX(this.dir > 0)
        this.hitHeroes = new WeakSet()
        this.setAct('charge-return')
      }
    } else if (this.act === 'charge-return') {
      if (this.scene.textures.exists(SCRUBBER_SHEET)) this.setFrame(poseAnimFrame('charge', this.elapsed, 120))
      const delta = (this.dir * CHARGE_SPEED * step) / 1000
      const nx =
        this.dir < 0 ? Math.max(this.returnEndX, this.x + delta) : Math.min(this.returnEndX, this.x + delta)
      this.setX(nx)
      this.syncBody()
      if (Math.abs(this.x - this.returnEndX) < 0.5) this.recover()
    } else if (this.act === 'warn-acid') {
      if (this.elapsed >= ACID_NOZZLE_MS) {
        this.setAct('acid')
        for (const land of this.acidTargets) {
          const dripKey = this.scene.textures.exists(ACID_DRIP) ? ACID_DRIP : ACID_PUDDLE
          const arc = this.scene.add
            .image(this.x, this.y - 70, dripKey, 0)
            .setDepth(DEPTH.FX)
            .setOrigin(0.5, 0.5)
          this.scene.tweens.add({
            targets: arc,
            x: land,
            y: this.hooks6.floorY() - 8,
            duration: 420,
            ease: 'Quad.easeIn',
            onComplete: () => arc.destroy(),
          })
        }
      }
    } else if (this.act === 'acid') {
      if (this.elapsed >= 500) this.recover()
    } else if (this.act === 'warn-foam') {
      if (this.elapsed >= FOAM_WARN_MS) {
        this.clearWarning()
        this.spawnFoamZones()
        this.setAct('foam')
      }
    } else if (this.act === 'foam') {
      if (this.elapsed >= 400) this.recover()
    } else if (this.act === 'warn-brush') {
      if (this.elapsed >= BRUSH_WARN_MS) {
        this.clearWarning()
        this.hitHeroes = new WeakSet()
        this.brushHitAt = new WeakMap()
        this.setFsm('ATTACK')
        this.setPose('spin')
        this.setAct('brush')
      }
    } else if (this.act === 'brush') {
      // M4: spin frames 9–10 (no flip spam — art already has brush whirl).
      if (this.scene.textures.exists(SCRUBBER_SHEET)) this.setFrame(poseAnimFrame('spin', this.elapsed, 80))
      if (this.elapsed >= BRUSH_SPIN_MS) this.recover()
    } else if (this.act === 'warn-cart') {
      if (this.elapsed >= CART_WARN_MS) {
        this.clearWarning()
        this.spawnCart()
        this.setAct('cart')
      }
    } else if (this.act === 'cart') {
      if (this.elapsed >= 600) this.recover()
    } else if (this.act === 'recover') {
      if (this.scene.textures.exists(SCRUBBER_SHEET)) this.setFrame(poseAnimFrame('recover', this.elapsed))
      if (this.elapsed >= this.recoverNeed) {
        this.setPose('idle')
        this.setAct('scan')
      }
    } else if (this.elapsed >= this.recoverNeed) {
      this.setPose('idle')
      this.setAct('scan')
    }

    this.setDepth(actorDepth('enemy', this.lane, this.y))
    this.marker.setPosition(this.x, this.y - 102).setDepth(this.depth + 2)
  }

  protected override die(_dir: number) {
    this.hp = 0
    this.boss = false
    this.clearWarning()
    this.setVelocity(0, 0)
    this.setFsm('DEAD')
    ;(this.body as Phaser.Physics.Arcade.Body).enable = false
    this.blowerPhase = 'idle'
    this.windGfx.clear()
    this.destroyCart()
    this.setPose('defeated')
    this.chip = this.scene.add.rectangle(this.x, this.y - 70, 10, 8, 0xffe080).setDepth(DEPTH.FX)
    this.scene.tweens.add({
      targets: this.chip,
      y: this.y - 110,
      duration: 400,
      yoyo: true,
      onComplete: () => {
        this.chip?.setFillStyle(0x405060)
        this.scene.tweens.add({ targets: this.chip, alpha: 0, duration: 400, onComplete: () => this.chip?.destroy() })
      },
    })
    this.hooks6.bossEvent('defeat')
    this.scene.time.delayedCall(1800, () => {
      this.onDefeated?.()
      if (this.scene) this.scene.tweens.add({ targets: this, alpha: 0, duration: 600, onComplete: () => this.destroy() })
    })
  }

  override destroy(fromScene?: boolean) {
    this.warnGraphic?.destroy()
    this.marker?.destroy()
    this.windGfx?.destroy()
    this.blower?.destroy()
    this.chip?.destroy()
    this.destroyCart()
    for (const a of this.acids) {
      a.g.destroy()
      a.label.destroy()
    }
    this.acids = []
    for (const z of this.foams) {
      z.g.destroy()
      z.label.destroy()
    }
    this.foams = []
    super.destroy(fromScene)
  }
}

export const SCRUBBER_ACID_LOCK_MS = ACID_HIT_LOCK_MS
