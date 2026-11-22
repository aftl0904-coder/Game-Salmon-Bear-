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
  | 'warn-acid'
  | 'acid'
  | 'recover'
type Move = 'charge' | 'acid'
type Pose = 'idle' | 'warn' | 'charge' | 'recover' | 'spray' | 'defeated'
type Hooks = {
  floorY: () => number
  bossEvent: (kind: 'phase2' | 'phase3' | 'weak' | 'defeat') => void
}

/** Work-order numbers (T2) — do not retune without Claude. */
const CHARGE_SPEED = 360
const WARN_CHARGE_MS = 600
const RECOVER_MS = 1500
const RECOVER_P3_MS = 1200
const ACID_NOZZLE_MS = 400
const ACID_WARN_MS = 800
const ACID_LIFE_MS = 3000
const ACID_FADE_MS = 300
const ACID_RECOVER_MS = 1000
const ACID_HALF = 32 // 64px wide
const ACID_HIT_LOCK_MS = 1000
const BLOWER_PERIOD_MS = 6000
const BLOWER_WARN_MS = 600
const BLOWER_BLAST_MS = 2500
const BLOWER_DISABLE_MS = 8000
const BODY_HALF = 48
const ARENA_PAD = 14

type Acid = {
  x: number
  harmFrom: number
  until: number
  g: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  hitAt: WeakMap<object, number>
}

function scrubberTexture(scene: Phaser.Scene, pose: Pose) {
  const key = `mall-scrubber-${pose}`
  if (scene.textures.exists(key)) return key
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  const silver = pose === 'recover' || pose === 'defeated' ? 0x6a7a88 : 0xa8b8c4
  const navy = 0x1a3a5a
  // Chassis ~96×80
  g.fillStyle(navy).fillRoundedRect(8, 34, 88, 30, 8)
  g.fillStyle(silver).fillRoundedRect(12, 16, 68, 34, 8)
  g.fillStyle(0x0e1a28).fillRoundedRect(70, 20, 28, 28, 6)
  // Camera eye (control) — yellow when controlled, dark when defeated
  g.fillStyle(0x0a1018).fillCircle(84, 34, 10)
  const eye =
    pose === 'defeated' ? 0x223040 : pose === 'warn' || pose === 'charge' ? 0xff4040 : pose === 'recover' ? 0x405060 : 0xe8c040
  g.fillStyle(eye).fillCircle(84, 34, 6)
  if (pose !== 'defeated') g.fillStyle(0xfff8e0).fillCircle(86, 32, 2)
  // Front brush (big circle)
  g.fillStyle(0x152030).fillCircle(18, 52, 16)
  g.fillStyle(pose === 'warn' || pose === 'charge' ? 0x90a0b0 : 0x708090).fillCircle(18, 52, 10)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + (pose === 'charge' ? 0.4 : 0)
    g.fillStyle(0x9aa8b4).fillRect(18 + Math.cos(a) * 12 - 1, 52 + Math.sin(a) * 12 - 1, 2, 6)
  }
  // Rear vents
  g.fillStyle(pose === 'recover' ? 0xff8844 : 0x405060).fillRect(92, 26, 8, 20)
  g.fillStyle(pose === 'recover' ? 0xffcc66 : 0x607080).fillRect(94, 28, 4, 16)
  // Nozzle up when spraying
  if (pose === 'spray' || pose === 'warn') {
    g.fillStyle(0x2a4a6a).fillRect(48, pose === 'spray' ? 2 : 8, 8, 14)
    g.fillStyle(0x60c040).fillCircle(52, pose === 'spray' ? 2 : 8, 3)
  }
  // Wheels
  g.fillStyle(0x101820).fillCircle(28, 66, 8).fillCircle(72, 66, 8)
  g.fillStyle(0x7890a0).fillCircle(28, 66, 3).fillCircle(72, 66, 3)
  // Dust / lean for charge
  if (pose === 'charge') {
    g.fillStyle(0xc8b090, 0.5).fillCircle(100, 60, 4).fillCircle(108, 58, 3)
  }
  // Smoke for recover
  if (pose === 'recover') {
    g.fillStyle(0x8899aa, 0.45).fillCircle(40, 10, 5).fillCircle(52, 4, 4)
  }
  // Chip pop for defeated
  if (pose === 'defeated') {
    g.fillStyle(0xffe080).fillRect(78, 2, 10, 8)
    g.fillStyle(0xff4040).fillCircle(83, 6, 2)
  }
  g.generateTexture(key, 112, 80)
  g.destroy()
  return key
}

function blowerTexture(scene: Phaser.Scene, state: 'off' | 'warn' | 'on' | 'stunned') {
  const key = `mall-floor-blower-${state}`
  if (scene.textures.exists(key)) return key
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  // Blue snail shell ~48×40, nozzle facing left (blows left)
  g.fillStyle(state === 'stunned' ? 0x3a5a70 : 0x1a6aaa).fillRoundedRect(14, 6, 30, 24, 10)
  g.fillStyle(0x0a3a5a).fillCircle(32, 18, 10)
  g.fillStyle(0x102030).fillCircle(32, 18, 5)
  g.fillStyle(0x1a6aaa).fillTriangle(14, 14, 2, 20, 14, 26) // left nozzle
  const lamp = state === 'warn' ? 0xffe040 : state === 'on' ? 0x80ff80 : state === 'stunned' ? 0x405060 : 0x6080a0
  g.fillStyle(lamp).fillCircle(8, 20, 3)
  g.fillStyle(0x101820).fillCircle(22, 34, 5).fillCircle(36, 34, 5)
  if (state === 'stunned') g.fillStyle(0x8899aa, 0.5).fillCircle(28, 2, 4)
  g.generateTexture(key, 48, 40)
  g.destroy()
  return key
}

/**
 * 深層潔淨 X-9 — work-order T2 kit (2026-11-22 JSON).
 * M1 slide · M2 acid · M3 floor blower (P3). Dialogue slots =「（待補）」.
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
  private warning = { x0: 0, x1: 0 }
  private warnGraphic: Phaser.GameObjects.Graphics
  private marker: Phaser.GameObjects.Text
  private hitHeroes = new WeakSet<object>()
  private lastMove: Move | null = null
  private repositionX = 0
  private acids: Acid[] = []
  private acidTargets: number[] = []
  blower!: Phaser.GameObjects.Image
  private blowerHits = 0
  private blowerDisabledUntil = 0
  private blowerCycle = 0
  private blowerPhase: 'idle' | 'warn' | 'blast' = 'idle'
  private windGfx: Phaser.GameObjects.Graphics
  private pose: Pose = 'idle'
  private chip?: Phaser.GameObjects.Rectangle
  private recoverNeed = RECOVER_MS

  constructor(scene: Phaser.Scene, x: number, x0: number, x1: number, hooks: Hooks) {
    super(scene, x, hooks.floorY(), scrubberTexture(scene, 'idle'))
    this.hooks6 = hooks
    this.arenaX0 = x0
    this.arenaX1 = x1
    this.hp = this.maxHp = DIRECTOR_HP
    this.setOrigin(0.5, 1)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.allowGravity = false
    body.setSize(BODY_HALF * 2, 58).setOffset(8, 20)
    this.warnGraphic = scene.add.graphics().setDepth(DEPTH.HAZARD + 2)
    this.marker = scene.add
      .text(x, this.y - 100, '', { fontFamily: FONT_UI, fontSize: '16px', color: '#fff2bb', stroke: '#42200b', strokeThickness: 4 })
      .setOrigin(0.5)
      .setVisible(false)
    this.windGfx = scene.add.graphics().setDepth(DEPTH.HAZARD + 1)
    this.blower = scene.add
      .image(x1 - 40, hooks.floorY(), blowerTexture(scene, 'off'))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.PROP + 2)
  }

  override canHurtPlayer() {
    return this.active && this.fsm !== 'DEAD' && this.act === 'charge'
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

  isBlowerBlasting() {
    return this.blowerPhase === 'blast' && this.scene.time.now >= this.blowerDisabledUntil
  }

  /** Into-wind = walking toward the fan (right, since fan sits at arenaX1 and blows left). */
  intoWind(vx: number) {
    return this.isBlowerBlasting() && vx > 12
  }

  hitBlower(hx: number) {
    if (this.fsm === 'DEAD' || this.qphase < 3) return
    if (this.scene.time.now < this.blowerDisabledUntil) return
    if (Math.abs(hx - this.blower.x) > 40) return
    this.blowerHits++
    this.blower.setTint(0xffccaa)
    this.scene.time.delayedCall(80, () => this.blower.clearTint())
    if (this.blowerHits >= 3) {
      this.blowerHits = 0
      this.blowerDisabledUntil = this.scene.time.now + BLOWER_DISABLE_MS
      this.blowerPhase = 'idle'
      this.blower.setTexture(blowerTexture(this.scene, 'stunned'))
      this.windGfx.clear()
      this.scene.time.delayedCall(BLOWER_DISABLE_MS, () => {
        if (this.active) this.blower.setTexture(blowerTexture(this.scene, 'off'))
      })
    }
  }

  override receiveHit(dmg: number, dir: number): EnemyHitResult {
    if (this.fsm === 'DEAD' || this.scene.time.now - this.lastHitAt < 380) return { killed: false, hp: this.hp }
    this.lastHitAt = this.scene.time.now
    // Front = brush side (flipX false → facing right → front hits from right / dir>0)
    const fromFront = (dir > 0 && !this.flipX) || (dir < 0 && this.flipX)
    const backWeak = this.act === 'recover' && !fromFront
    let raw = dmg
    if (backWeak) raw = Math.max(1, Math.round(dmg * 2))
    else if (fromFront && this.act !== 'recover') raw = Math.max(1, Math.floor(dmg * 0.5))
    const hit = bossHitDamage(raw, { weak: this.act === 'recover', weakBase: 3, capNormal: 2, capWeak: 5 })
    const x = this.x
    const y = this.y
    const result = super.receiveHit(hit, dir)
    this.setPosition(x, y).setVelocity(0, 0)
    if (result.killed) return result
    this.setFsm('PATROL')
    const fraction = this.hp / this.maxHp
    const phase: 1 | 2 | 3 = fraction < 0.3 ? 3 : fraction <= 0.6 ? 2 : 1
    if (phase > this.qphase) {
      this.qphase = phase
      this.hooks6.bossEvent(phase === 2 ? 'phase2' : 'phase3')
      this.scene.cameras.main.shake(180, 0.004)
      this.marker.setText('（待補）').setVisible(true)
      this.forceRecover(RECOVER_MS)
    } else if (this.act === 'warn-charge' || this.act === 'charge' || this.act === 'warn-acid' || this.act === 'acid') {
      this.recover()
    }
    return result
  }

  private setPose(pose: Pose) {
    if (this.pose === pose) return
    this.pose = pose
    this.setTexture(scrubberTexture(this.scene, pose))
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
    if (this.qphase === 3) return RECOVER_P3_MS // 1500 × 0.8
    return RECOVER_MS
  }
  private recover() {
    this.forceRecover(this.act === 'acid' || this.act === 'warn-acid' ? ACID_RECOVER_MS : this.recoverMs())
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

  private pickMove(): Move {
    if (this.qphase === 1) return 'charge'
    // Alternate; never same move twice in a row
    if (this.lastMove === 'charge') return 'acid'
    if (this.lastMove === 'acid') return 'charge'
    return Math.random() < 0.5 ? 'charge' : 'acid'
  }

  private beginCharge(heroes: Hero[], target: Hero) {
    this.dir = (Math.sign(target.x - this.x) || -1) as 1 | -1
    this.setFlipX(this.dir < 0)
    this.endX = Phaser.Math.Clamp(
      this.dir < 0 ? this.arenaX0 + ARENA_PAD : this.arenaX1 - ARENA_PAD,
      this.arenaX0 + ARENA_PAD,
      this.arenaX1 - ARENA_PAD,
    )
    this.warning = {
      x0: Math.min(this.x, this.endX) - BODY_HALF,
      x1: Math.max(this.x, this.endX) + BODY_HALF,
    }
    if (Math.abs(this.endX - this.x) < 30 || !this.safeForAll(heroes, this.warning.x0, this.warning.x1, WARN_CHARGE_MS)) {
      this.repositionX = Phaser.Math.Clamp(this.x - this.dir * 60, this.arenaX0 + BODY_HALF, this.arenaX1 - BODY_HALF)
      this.setAct('reposition')
      return
    }
    this.lastMove = 'charge'
    this.setPose('warn')
    this.setAct('warn-charge')
    // Red translucent warn band
    this.warnGraphic
      .clear()
      .fillStyle(0xff2030, 0.32)
      .fillRect(this.warning.x0, this.y - 64, this.warning.x1 - this.warning.x0, 64)
      .lineStyle(3, 0xff6070, 1)
      .strokeRect(this.warning.x0, this.y - 64, this.warning.x1 - this.warning.x0, 64)
    this.marker.setText(this.dir < 0 ? '！←' : '！→').setVisible(true)
  }

  private beginAcid(heroes: Hero[]) {
    if (this.acids.length >= 3) {
      this.beginCharge(heroes, heroes[0]!)
      return
    }
    this.lastMove = 'acid'
    this.setPose('spray')
    this.setAct('warn-acid')
    this.marker.setText('（待補）').setVisible(true)
    const target = heroes[0]!
    let lands = [target.x, target.x - 90, target.x + 90]
    if (this.isBlowerBlasting()) lands = lands.map((x) => x - 40)
    this.acidTargets = lands.map((x) => Phaser.Math.Clamp(x, this.arenaX0 + 30, this.arenaX1 - 30))
    // Pre-show red circles for all three landings during nozzle warn
    for (const x of this.acidTargets) this.spawnAcidWarn(x)
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
    const g = this.scene.add.graphics().setDepth(DEPTH.HAZARD + 3)
    g.fillStyle(0xff2030, 0.28).fillEllipse(x, floor - 4, 64, 18)
    g.lineStyle(2, 0xff6070, 1).strokeEllipse(x, floor - 4, 64, 18)
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
      g.clear()
      g.fillStyle(0x70c030, 0.5).fillEllipse(x, floor - 4, 64, 16)
      g.lineStyle(2, 0xa0e050, 1).strokeEllipse(x, floor - 4, 64, 16)
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

  private tickBlower(dt: number) {
    if (this.qphase < 3 || this.fsm === 'DEAD') {
      this.blowerPhase = 'idle'
      this.windGfx.clear()
      return
    }
    if (this.scene.time.now < this.blowerDisabledUntil) {
      this.blowerPhase = 'idle'
      this.windGfx.clear()
      return
    }
    this.blowerCycle += dt
    const cycle = this.blowerCycle % BLOWER_PERIOD_MS
    if (cycle < BLOWER_WARN_MS) {
      this.blowerPhase = 'warn'
      this.blower.setTexture(blowerTexture(this.scene, 'warn'))
      this.windGfx.clear()
    } else if (cycle < BLOWER_WARN_MS + BLOWER_BLAST_MS) {
      this.blowerPhase = 'blast'
      this.blower.setTexture(blowerTexture(this.scene, 'on'))
      this.windGfx.clear()
      this.windGfx.lineStyle(2, 0xa8d8ff, 0.45)
      for (let i = 0; i < 5; i++) {
        const x1 = this.blower.x - 20
        const y = this.hooks6.floorY() - 10 - i * 6
        this.windGfx.lineBetween(x1, y, x1 - 80 - i * 12, y - 2)
      }
    } else {
      this.blowerPhase = 'idle'
      this.blower.setTexture(blowerTexture(this.scene, 'off'))
      this.windGfx.clear()
    }
  }

  override tick(dt: number, ctx: Ctx) {
    if (!this.active || this.fsm === 'DEAD') return
    if (isActorFrozen(this, this.scene.time.now)) {
      this.setVelocity(0, 0)
      return
    }
    const step = Math.min(Math.max(dt, 0), 50)
    this.elapsed += step
    this.setVelocity(0, 0)
    this.y = this.hooks6.floorY()
    this.blower.setPosition(this.arenaX1 - 40, this.hooks6.floorY())
    this.tickBlower(step)

    const now = this.scene.time.now
    for (let i = this.acids.length - 1; i >= 0; i--) {
      if (this.acids[i]!.until + ACID_FADE_MS <= now) this.acids.splice(i, 1)
    }

    const heroes = [ctx.boy, ctx.girl].filter((h): h is Hero => !!h && h.active && h.alive !== false)
    if (this.act === 'intro') {
      this.setPose('idle')
      if (this.elapsed >= 900) this.setAct('scan')
    } else if (this.act === 'scan') {
      this.setPose('idle')
      if (heroes.length && this.elapsed >= 500) {
        const target = heroes.reduce((a, b) => (Math.abs(a.x - this.x) <= Math.abs(b.x - this.x) ? a : b))
        const move = this.pickMove()
        if (move === 'acid' && this.qphase >= 2) this.beginAcid(heroes)
        else this.beginCharge(heroes, target)
      }
    } else if (this.act === 'reposition') {
      const distance = this.repositionX - this.x
      const dx = Math.sign(distance) * Math.min(Math.abs(distance), 45 * step / 1000)
      this.setX(this.x + dx)
      this.syncBody()
      if (Math.abs(this.repositionX - this.x) < 0.1) this.setAct('scan')
    } else if (this.act === 'warn-charge') {
      if (!heroes.length) this.recover()
      else if (this.elapsed >= WARN_CHARGE_MS) {
        this.clearWarning()
        this.hitThis = false
        this.hitHeroes = new WeakSet()
        this.setFsm('ATTACK')
        this.setPose('charge')
        this.setAct('charge')
      }
    } else if (this.act === 'charge') {
      const delta = this.dir * CHARGE_SPEED * step / 1000
      const nx = this.dir < 0 ? Math.max(this.endX, this.x + delta) : Math.min(this.endX, this.x + delta)
      this.setX(nx)
      this.syncBody()
      if (Math.random() < 0.35) {
        const dust = this.scene.add.circle(this.x - this.dir * 20, this.y - 6, 3 + Math.random() * 3, 0xc8b090, 0.45)
        dust.setDepth(DEPTH.FX)
        this.scene.tweens.add({ targets: dust, alpha: 0, y: dust.y - 8, duration: 280, onComplete: () => dust.destroy() })
      }
      if (Math.abs(this.x - this.endX) < 0.5) this.recover()
    } else if (this.act === 'warn-acid') {
      if (this.elapsed >= ACID_NOZZLE_MS) {
        this.setAct('acid')
        this.elapsed = 0
        // Lob visuals toward pre-warned landings
        for (const land of this.acidTargets) {
          const arc = this.scene.add.circle(this.x, this.y - 70, 5, 0xa0e040, 0.9).setDepth(DEPTH.FX)
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
    this.setPose('defeated')
    // Control chip pops out, flashes, extinguishes
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
    for (const a of this.acids) {
      a.g.destroy()
      a.label.destroy()
    }
    this.acids = []
    super.destroy(fromScene)
  }
}

/** Acid hit lock helper for GameScene. */
export const SCRUBBER_ACID_LOCK_MS = ACID_HIT_LOCK_MS
