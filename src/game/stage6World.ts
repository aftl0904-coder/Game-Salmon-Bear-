import Phaser from 'phaser'
import type { Player } from './Player'
import { DEPTH } from './engine/depth'
import { SFX } from './audio'
import { burst } from './fx'
import { FONT_UI } from './ui/fonts'
import { GAME_W, GAME_H } from './display'
import { drawMallProp } from './mallDecor'
import { type Solid } from './engine/terrain'

/**
 * 第二大陸・購物中心 mechanics that are new to stage 6 (the dark veil is Stage3World's own):
 *  - debris: ceiling rubble in the construction zone. A gold light pillar blinks on the floor
 *    (the 月橋鏡鴞 warning-pillar look), then the chunk drops. The fall itself is harmless — only
 *    the landing hurts, and only for a short window, so the pillar is the whole telegraph.
 *  - scanner sweep + patrol drone: the 保安總監's attacks, spawned through GameScene hooks.
 *  - cages: a static silhouette backdrop prop (no entity).
 */

export type Stage6Ctx = {
  scene: Phaser.Scene
  floorY: number
  heroes: () => Player[]
  hurt: (h: Player, dir: number, label: string) => void
  /** A bolt dropped on a hero by the patrol drone. */
  dropShot: (x: number, y: number) => void
  enemyBodies?: () => Array<{ x: number; body: Phaser.Physics.Arcade.Body | null; active: boolean }>
}

export type Stage6Data = {
  debris?: Array<{ x: number; periodMs: number; offsetMs?: number; warnMs?: number }>
  cages?: Array<{ x: number }>
  slipZones?: Array<{ x0: number; x1: number; mul?: number }>
  floorJunk?: Array<{ x: number; w?: number }>
  elevatorX?: number
  /** Floor junk inactive until lead X passes this (teach slip first). */
  junkUnlockX?: number
  teachSlipX0?: number
  teachSlipX1?: number
}

type DebrisPhase = 'idle' | 'warn' | 'fall' | 'land'
type Debris = {
  x: number
  periodMs: number
  warnMs: number
  phase: DebrisPhase
  t: number
  col: Phaser.GameObjects.Rectangle
  base: Phaser.GameObjects.Ellipse
  chunk: Phaser.GameObjects.Image | null
  hit: Set<Player>
}

export type Stage6Event = { kind: 'debris-warn' | 'debris-fall' | 'debris-land' | 'debris-hit' | 'sweep-warn' | 'sweep-run' | 'sweep-hit' | 'drone-lock' | 'drone-shot' | 'slip-enter' | 'junk-hit' | 'elevator'; x: number; at: number }

const FALL_MS = 260
const LAND_HURT_MS = 320
const CHUNK_HALF_W = 20
const BEAM_HALF_W = 14
const BEAM_HEIGHT = 22
const DRONE_Y_OFF = 84
const CONE_HALF_W = 38

/** T3_ESCALATOR — belt along B→C ramp (px/s). */
export const ESCALATOR_BELT_SPEED = 60
/** Visual / collision ramp matching GameScene escalator triangle. */
export const ESCALATOR = { x0: 1860, x1: 1980, h0: 4, h1: 70 } as const

export class Stage6World {
  private ctx: Stage6Ctx
  private debris: Debris[] = []
  private g: Phaser.GameObjects.Graphics
  private sweeps: Array<{
    x0: number
    x1: number
    dir: 1 | -1
    speed: number
    t: number
    warnMs: number
    x: number
    running: boolean
    hit: Set<Player>
    pillars: Phaser.GameObjects.GameObject[]
  }> = []
  private drones: Array<{
    img: Phaser.GameObjects.Image
    dir: 1 | -1
    speed: number
    x1: number
    lock: Map<Player, number>
    cooldown: number
    fireAt: number
    target: Player | null
  }> = []
  /** Recent hazard events (kept short) — what the QA scripts read to check telegraph-before-damage. */
  readonly events: Stage6Event[] = []
  private slips: Array<{ x0: number; x1: number; mul: number; flash: Phaser.GameObjects.Rectangle }> = []
  private junk: Array<{ x: number; w: number; root: Phaser.GameObjects.Container; cd: Map<Player, number> }> = []
  private elevX: number | null = null
  private elevDone = false
  mood = 0
  private moodWash: Phaser.GameObjects.Rectangle | null = null
  private vignette: Phaser.GameObjects.Rectangle | null = null
  private fanGfx: Phaser.GameObjects.Container | null = null
  private fanBlades: Phaser.GameObjects.Graphics | null = null
  fanOn = false
  private fanSpin = 0
  private junkUnlockX = 0
  private teachSlipX0: number | null = null
  private teachSlipX1: number | null = null
  private slipTaught = false
  private junkTaught = false
  /** C5 escalator steps animation. */
  private escRoot: Phaser.GameObjects.Container | null = null
  private escStepsGfx: Phaser.GameObjects.Graphics | null = null
  private escStepPhase = 0
  /** C5 stainless lift doors. */
  private liftRoot: Phaser.GameObjects.Container | null = null
  private liftDoorL: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null = null
  private liftDoorR: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null = null
  private liftFloorLamp: Phaser.GameObjects.Text | null = null

  constructor(ctx: Stage6Ctx, d: Stage6Data) {
    this.ctx = ctx
    const s = ctx.scene
    this.g = s.add.graphics().setDepth(DEPTH.FX - 3)
    for (const c of d.debris ?? []) {
      const warnMs = c.warnMs ?? 950
      const col = s.add.rectangle(c.x, ctx.floorY / 2, 56, ctx.floorY, 0xfff0a0, 0.75).setDepth(DEPTH.SHADOW + 4).setAlpha(0)
      const base = s.add.ellipse(c.x, ctx.floorY + 2, 60, 9, 0xff9a3c, 1).setDepth(DEPTH.SHADOW + 5).setAlpha(0)
      this.debris.push({ x: c.x, periodMs: c.periodMs, warnMs, phase: 'idle', t: c.offsetMs ?? 0, col, base, chunk: null, hit: new Set() })
    }
    for (const c of d.cages ?? []) this.drawCage(c.x)
    this.elevX = d.elevatorX ?? null
    if (this.elevX != null) this.buildElevator(this.elevX)
    this.junkUnlockX = d.junkUnlockX ?? 0
    this.teachSlipX0 = d.teachSlipX0 ?? null
    this.teachSlipX1 = d.teachSlipX1 ?? null
    for (const z of d.slipZones ?? []) this.buildSlip(z.x0, z.x1, z.mul ?? 1.5)
    for (const j of d.floorJunk ?? []) this.buildJunk(j.x, j.w ?? 36)
    this.moodWash = s.add.rectangle(0, 0, GAME_W, GAME_H, 0x1a2030, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.UI - 40)
    this.vignette = s.add.rectangle(0, 0, GAME_W, GAME_H, 0x100008, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.UI - 39)
    this.buildBossFan()
  }

  private buildElevator(x: number) {
    // C5: stainless bi-parting doors on the upper deck (h=70 after escalator).
    const s = this.ctx.scene
    const deck = this.ctx.floorY - ESCALATOR.h1
    const root = s.add.container(x, deck).setDepth(DEPTH.PROP + 3)
    const frame = s.add.graphics()
    // Brushed steel frame
    frame.fillStyle(0x9aa8b4, 1).fillRect(-44, -118, 88, 118)
    frame.fillStyle(0x6a7884, 1).fillRect(-40, -114, 80, 110)
    frame.fillStyle(0xc8d4dc, 1).fillRect(-40, -114, 80, 4)
    frame.fillStyle(0x3a4450, 1).fillRect(-36, -108, 72, 100)
    // Floor lamp panel (icon digit, not a brand)
    frame.fillStyle(0x1a2228, 1).fillRoundedRect(-16, -128, 32, 14, 2)
    frame.fillStyle(0x40e080, 1).fillCircle(-8, -121, 2)
    frame.fillStyle(0xe0c040, 1).fillCircle(0, -121, 2)
    frame.fillStyle(0x808890, 1).fillCircle(8, -121, 2)
    root.add(frame)
    const lamp = s.add
      .text(0, -121, 'B2', {
        fontFamily: FONT_UI,
        fontSize: '9px',
        color: '#a8ffc0',
      })
      .setOrigin(0.5)
    root.add(lamp)
    this.liftFloorLamp = lamp
    const mkDoor = (ox: number) => {
      if (s.textures.exists('c2-prop-lift-door')) {
        return s.add.image(ox, -8, 'c2-prop-lift-door').setOrigin(0.5, 1)
      }
      const d = s.add.rectangle(ox, -8, 34, 100, 0xb8c4cc).setOrigin(0.5, 1)
      d.setStrokeStyle(2, 0x708090)
      // Center seam highlight via nested rect
      return d
    }
    this.liftDoorL = mkDoor(-17)
    this.liftDoorR = mkDoor(17)
    root.add(this.liftDoorL)
    root.add(this.liftDoorR)
    // Center seam
    const seam = s.add.rectangle(0, -58, 2, 96, 0x405060, 0.85)
    root.add(seam)
    s.add
      .text(x, deck - 140, '升降機', {
        fontFamily: FONT_UI,
        fontSize: '11px',
        color: '#e8f0f8',
        backgroundColor: '#2a3848',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.SIGN)
    this.liftRoot = root
  }

  /** C5: glass-sided escalator with animated step stripes. */
  buildEscalatorVisual(floorY: number) {
    const s = this.ctx.scene
    if (this.escRoot) {
      this.escRoot.destroy(true)
      this.escRoot = null
    }
    const root = s.add.container(0, 0).setDepth(DEPTH.PROP + 1)
    const g = s.add.graphics()
    // Glass side panels (left & right of ramp)
    g.fillStyle(0xa8c8e0, 0.28)
    g.fillTriangle(ESCALATOR.x0 - 4, floorY - 2, ESCALATOR.x1 - 4, floorY - 2, ESCALATOR.x1 - 4, floorY - ESCALATOR.h1 - 8)
    g.fillStyle(0xd0e8f8, 0.18)
    g.fillTriangle(ESCALATOR.x0 + 8, floorY - 2, ESCALATOR.x1 + 8, floorY - 2, ESCALATOR.x1 + 8, floorY - ESCALATOR.h1 - 8)
    // Silver handrails
    g.lineStyle(3, 0xc8d4e0, 1)
    g.lineBetween(ESCALATOR.x0, floorY - 10, ESCALATOR.x1, floorY - ESCALATOR.h1 - 10)
    g.lineStyle(3, 0xa0b0c0, 1)
    g.lineBetween(ESCALATOR.x0 + 10, floorY - 4, ESCALATOR.x1 + 10, floorY - ESCALATOR.h1 - 4)
    // Dark grey step bed
    g.fillStyle(0x3a424c, 1)
    g.fillTriangle(ESCALATOR.x0, floorY - ESCALATOR.h0, ESCALATOR.x1, floorY - ESCALATOR.h0, ESCALATOR.x1, floorY - ESCALATOR.h1)
    root.add(g)
    const steps = s.add.graphics().setDepth(DEPTH.PROP + 1.5)
    root.add(steps)
    this.escStepsGfx = steps
    this.escRoot = root
    this.escStepPhase = 0
    this.drawEscalatorSteps(floorY, 0)
  }

  private drawEscalatorSteps(floorY: number, phase: number) {
    const g = this.escStepsGfx
    if (!g) return
    g.clear()
    const run = ESCALATOR.x1 - ESCALATOR.x0
    const rise = ESCALATOR.h1 - ESCALATOR.h0
    for (let i = 0; i < 8; i++) {
      const t = ((i + phase) % 8) / 8
      const x = ESCALATOR.x0 + t * run
      const y = floorY - ESCALATOR.h0 - t * rise
      // Grooved step tread
      g.fillStyle(0x5a6570, 1).fillRect(x - 2, y - 5, 14, 5)
      g.fillStyle(0x2a3038, 1).fillRect(x - 2, y - 2, 14, 1)
      g.fillStyle(0x8a98a4, 0.7).fillRect(x - 2, y - 5, 14, 1)
    }
  }

  tickEscalatorVisual(dt: number) {
    if (!this.escStepsGfx) return
    this.escStepPhase = (this.escStepPhase + (dt / 1000) * 2.2) % 8
    this.drawEscalatorSteps(this.ctx.floorY, this.escStepPhase)
  }

  /** Door open → ride → close. Resolves when doors have opened (ride follows). */
  playLiftDoors(): Promise<void> {
    return new Promise((resolve) => {
      const s = this.ctx.scene
      const L = this.liftDoorL
      const R = this.liftDoorR
      if (!L || !R) {
        resolve()
        return
      }
      this.liftFloorLamp?.setColor('#ffe080')
      s.tweens.add({
        targets: L,
        x: (L.x ?? -17) - 28,
        duration: 420,
        ease: 'Quad.easeOut',
      })
      s.tweens.add({
        targets: R,
        x: (R.x ?? 17) + 28,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => resolve(),
      })
    })
  }

  private buildSlip(x0: number, x1: number, mul: number) {
    const s = this.ctx.scene
    const f = this.ctx.floorY
    const mid = (x0 + x1) / 2
    const flash = s.add.rectangle(mid, f - 4, x1 - x0, 10, 0x80e0ff, 0.18).setDepth(DEPTH.PROP - 5)
    s.add.text(mid, f - 78, '⚠ 小心地滑', { fontFamily: FONT_UI, fontSize: '11px', color: '#1a1a10', backgroundColor: '#ffe060', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(DEPTH.SIGN)
    this.slips.push({ x0, x1, mul, flash })
  }

  private buildJunk(x: number, w: number) {
    const s = this.ctx.scene
    const f = this.ctx.floorY
    const root = s.add.container(x, f).setDepth(DEPTH.PROP + 2)
    // Prefer C2 PNG props (PR-K); fall back to T5b Graphics bin (same hurt footprint via w).
    const propKeys = ['c2-prop-barrier', 'c2-prop-cart', 'c2-prop-trash'] as const
    const pick = propKeys[Math.abs(Math.floor(x / 17)) % propKeys.length]!
    if (s.textures.exists(pick)) {
      root.add(s.add.image(0, 0, pick).setOrigin(0.5, 1))
    } else if (s.textures.exists('c2-prop-barrier')) {
      root.add(s.add.image(0, 0, 'c2-prop-barrier').setOrigin(0.5, 1))
    } else {
      const g = s.add.graphics()
      g.fillStyle(0x0a0a0c, 0.45).fillEllipse(0, -2, w + 10, 10)
      drawMallProp(g, 'bin', Math.max(28, Math.min(48, w + 8)), false)
      root.add(g)
    }
    const tag = s.add.text(0, -40, '雜物', { fontFamily: FONT_UI, fontSize: '10px', color: '#ffe0a0', backgroundColor: '#802018', padding: { x: 2, y: 1 } }).setOrigin(0.5)
    root.add(tag)
    s.tweens.add({ targets: tag, alpha: { from: 0.65, to: 1 }, duration: 480, yoyo: true, repeat: -1 })
    this.junk.push({ x, w, root, cd: new Map() })
  }

  /** Feet Y on the painted ramp hypotenuse at world x. */
  static rampY(floorY: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - ESCALATOR.x0) / (ESCALATOR.x1 - ESCALATOR.x0)))
    return floorY - ESCALATOR.h0 + (ESCALATOR.h0 - ESCALATOR.h1) * t
  }

  onEscalator(actor: { x: number; y: number }, sinkTol = 28): boolean {
    if (actor.x < ESCALATOR.x0 - 6 || actor.x > ESCALATOR.x1 + 6) return false
    const top = Stage6World.rampY(this.ctx.floorY, actor.x)
    // Allow a little float above the ramp (Arcade / snap drift) as well as below.
    return actor.y >= top - 16 && actor.y <= top + sinkTol
  }

  /**
   * Belt push for a grounded actor on the escalator.
   * Position nudge only (no lasting velocity) so a jump leaves the belt after ≤1 frame.
   */
  pushEscalator(
    actor: { x: number; y: number; setPosition?: (x: number, y: number) => void },
    dt: number,
    grounded = true,
  ): number {
    if (!grounded) return 0
    if (!this.onEscalator(actor, 28)) return 0
    const run = ESCALATOR.x1 - ESCALATOR.x0
    const rise = ESCALATOR.h0 - ESCALATOR.h1 // negative world-Y rise when going up
    const len = Math.hypot(run, rise) || 1
    const ux = run / len
    const along = ESCALATOR_BELT_SPEED * Math.min(Math.max(dt, 0), 50) / 1000
    const nx = Phaser.Math.Clamp(actor.x + ux * along, ESCALATOR.x0, ESCALATOR.x1)
    const ny = Stage6World.rampY(this.ctx.floorY, nx)
    if (actor.setPosition) actor.setPosition(nx, ny)
    else {
      actor.x = nx
      actor.y = ny
    }
    return 1
  }

  /** Against-belt walk cap: walk − 60, min 20 (T3 numbers). */
  static againstWalkSpeed(walkSpeed: number): number {
    return Math.max(20, walkSpeed - ESCALATOR_BELT_SPEED)
  }

  /** Invisible slope Solid matching the painted B→C ramp (T3 collision). */
  static escalatorSolid(floorY: number): Solid {
    return {
      x0: ESCALATOR.x0,
      x1: ESCALATOR.x1,
      top: floorY - ESCALATOR.h0,
      topEnd: floorY - ESCALATOR.h1,
      oneWay: true,
      kind: 'slope',
    }
  }

  private buildBossFan() {
    const s = this.ctx.scene
    const c = s.add.container(4960, this.ctx.floorY - 150).setDepth(DEPTH.PROP - 6)
    const g = s.add.graphics()
    g.fillStyle(0x3a4450, 1).fillCircle(0, 0, 48)
    g.lineStyle(3, 0x90a0b0, 1).strokeCircle(0, 0, 48)
    g.fillStyle(0x202830, 1).fillCircle(0, 0, 10)
    c.add(g)
    const blades = s.add.graphics()
    c.add(blades)
    c.add(s.add.text(0, 58, '風機', { fontFamily: FONT_UI, fontSize: '11px', color: '#c0d0e0' }).setOrigin(0.5))
    this.fanGfx = c
    this.fanBlades = blades
  }

  setFan(on: boolean) {
    this.fanOn = on
  }

  updateMood(leadX: number) {
    let m = 0
    if (leadX < 855) m = 0
    else if (leadX < 1995) m = 0.15 + ((leadX - 855) / 1140) * 0.2
    else if (leadX < 3135) m = 0.4 + ((leadX - 1995) / 1140) * 0.25
    else if (leadX < 4560) m = 0.7 + ((leadX - 3135) / 1425) * 0.2
    else m = 0.95
    this.mood = m
    this.moodWash?.setFillStyle(m < 0.45 ? 0x1a2840 : m < 0.75 ? 0x181028 : 0x280810, m * 0.55)
    this.vignette?.setFillStyle(0x080000, Math.max(0, (m - 0.35) * 0.5))
  }

  checkElevator(leadX: number): boolean {
    if (this.elevDone || this.elevX == null) return false
    if (leadX >= this.elevX - 20) {
      this.elevDone = true
      this.log('elevator', this.elevX)
      return true
    }
    return false
  }

  /** QA / cutscene helper — mark B→C elevator as already ridden. */
  markElevatorDone() {
    this.elevDone = true
  }

  slipMulAt(x: number): number {
    for (const z of this.slips) if (x >= z.x0 && x <= z.x1) return z.mul
    return 1
  }

  headwindMul(heroX: number, movingRight: boolean): number {
    if (!this.fanOn || !movingRight || heroX < 4600) return 1
    return 0.45
  }


  private log(kind: Stage6Event['kind'], x: number) {
    this.events.push({ kind, x, at: this.ctx.scene.time.now })
    if (this.events.length > 80) this.events.shift()
  }

  private drawCage(x: number) {
    const s = this.ctx.scene
    const key = 's6-cage'
    if (!s.textures.exists(key)) return
    const img = s.add.image(x, this.ctx.floorY + 1, key).setOrigin(0.5, 1).setDepth(DEPTH.PROP - 1).setTint(0xb0a098)
    img.setScale(img.scaleX * 1.3, img.scaleY * 1.3)
    img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    const eyes = s.add.graphics().setDepth(DEPTH.PROP)
    eyes.fillStyle(0xffe08a, 1).fillRect(x - 10, this.ctx.floorY - 28, 2, 2).fillRect(x + 6, this.ctx.floorY - 28, 2, 2)
    s.tweens.add({ targets: eyes, alpha: { from: 0.15, to: 0.9 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  }

  /** Warn → beam → gone. `speed` px/s. Returns the total length in ms (warn + run). */
  sweep(x0: number, x1: number, dir: 1 | -1, warnMs: number, speed: number): number {
    const s = this.ctx.scene
    const startX = dir > 0 ? x0 + 12 : x1 - 12
    const pillars: Phaser.GameObjects.GameObject[] = []
    const col = s.add.rectangle(startX, this.ctx.floorY / 2, 36, this.ctx.floorY, 0x8ac8ff, 0.2).setDepth(DEPTH.SHADOW + 4)
    const base = s.add.ellipse(startX, this.ctx.floorY + 2, 44, 9, 0xfff0a0, 0.7).setDepth(DEPTH.SHADOW + 5)
    const lane = s.add.rectangle((x0 + x1) / 2, this.ctx.floorY + 2, x1 - x0, 3, 0xff5030, 0.25).setDepth(DEPTH.SHADOW + 5)
    s.tweens.add({ targets: [col, base], alpha: { from: 0.2, to: 0.75 }, duration: 140, yoyo: true, repeat: Math.max(1, Math.round(warnMs / 280)) })
    pillars.push(col, base, lane)
    this.sweeps.push({ x0, x1, dir, speed, t: 0, warnMs, x: startX, running: false, hit: new Set(), pillars })
    this.log('sweep-warn', startX)
    SFX.siren()
    return warnMs + ((x1 - x0 - 24) / speed) * 1000
  }

  /** A patrol drone crosses the arena; any hero held in its light for a beat gets a bolt dropped on them. */
  drone(x0: number, x1: number, dir: 1 | -1, speed: number) {
    const s = this.ctx.scene
    const key = s.textures.exists('s6-drone') ? 's6-drone' : 'coin'
    const img = s.add.image(dir > 0 ? x0 : x1, this.ctx.floorY - DRONE_Y_OFF, key).setDepth(DEPTH.FX - 2)
    s.tweens.add({ targets: img, y: img.y - 4, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' })
    this.drones.push({ img, dir, speed, x1: dir > 0 ? x1 : x0, lock: new Map(), cooldown: 0, fireAt: 0, target: null })
  }

  droneCount() {
    return this.drones.length
  }

  update(dt: number) {
    const s = this.ctx.scene
    const now = s.time.now
    const heroes = this.ctx.heroes()
    const cam = s.cameras.main
    const floor = this.ctx.floorY
    const g = this.g
    g.clear()
    this.tickMallExtras(dt, heroes)

    for (const d of this.debris) {
      d.t -= dt
      const onScreen = d.x > cam.scrollX - 60 && d.x < cam.scrollX + 700
      if (d.phase === 'idle' && d.t <= 0) {
        d.phase = 'warn'
        d.t = d.warnMs
        d.hit.clear()
        if (onScreen) this.log('debris-warn', d.x)
        s.tweens.add({ targets: [d.col, d.base], alpha: { from: 0.25, to: 1 }, duration: 150, yoyo: true, repeat: Math.max(1, Math.round(d.warnMs / 300)) })
        if (onScreen) SFX.siren()
      } else if (d.phase === 'warn' && d.t <= 0) {
        d.phase = 'fall'
        d.t = FALL_MS
        const key = s.textures.exists('s6-debris') ? 's6-debris' : 'coin'
        d.chunk = s.add.image(d.x, -20, key).setOrigin(0.5, 1).setDepth(DEPTH.FX - 2)
        s.tweens.add({ targets: d.chunk, y: floor + 2, duration: FALL_MS, ease: 'Quad.in' })
        if (onScreen) this.log('debris-fall', d.x)
      } else if (d.phase === 'fall' && d.t <= 0) {
        d.phase = 'land'
        d.t = LAND_HURT_MS
        s.tweens.killTweensOf([d.col, d.base])
        d.col.setAlpha(0)
        d.base.setAlpha(0)
        if (onScreen) {
          this.log('debris-land', d.x)
          SFX.slam()
          cam.shake(110, 0.004)
          burst(s, d.x - 12, floor - 2, 0xc8b898, 6)
          burst(s, d.x + 12, floor - 2, 0xc8b898, 6)
        }
        const chunk = d.chunk
        if (chunk) s.tweens.add({ targets: chunk, alpha: 0, delay: 1100, duration: 400, onComplete: () => chunk.destroy() })
        d.chunk = null
      } else if (d.phase === 'land' && d.t <= 0) {
        d.phase = 'idle'
        d.t = d.periodMs
      }
      if (d.phase === 'land') {
        for (const h of heroes) {
          if (d.hit.has(h) || !h.alive) continue
          if (Math.abs(h.x - d.x) < CHUNK_HALF_W && h.y > floor - 30) {
            d.hit.add(h)
            this.log('debris-hit', d.x)
            this.ctx.hurt(h, Math.sign(h.x - d.x) || 1, '碎石 -1')
          }
        }
      }
    }

    for (let i = this.sweeps.length - 1; i >= 0; i--) {
      const w = this.sweeps[i]!
      w.t += dt
      if (!w.running && w.t >= w.warnMs) {
        w.running = true
        this.log('sweep-run', w.x)
        SFX.slam()
        cam.shake(120, 0.003)
      }
      if (w.running) {
        w.x += w.dir * w.speed * (dt / 1000)
        const end = w.dir > 0 ? w.x >= w.x1 - 12 : w.x <= w.x0 + 12
        const [col, base] = w.pillars as [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Ellipse]
        col.setPosition(w.x, floor / 2).setFillStyle(0xfff0a0, 0.55)
        base.setPosition(w.x, floor + 2)
        g.fillStyle(0xff7040, 0.9).fillRect(w.x - BEAM_HALF_W, floor - BEAM_HEIGHT, BEAM_HALF_W * 2, BEAM_HEIGHT)
        g.fillStyle(0xfff0c0, 0.9).fillRect(w.x - 2, floor - BEAM_HEIGHT, 4, BEAM_HEIGHT)
        for (const h of heroes) {
          if (w.hit.has(h) || !h.alive) continue
          if (Math.abs(h.x - w.x) < BEAM_HALF_W + 6 && h.y > floor - BEAM_HEIGHT) {
            w.hit.add(h)
            this.log('sweep-hit', w.x)
            this.ctx.hurt(h, w.dir, '掃描 -1')
          }
        }
        if (end) {
          for (const p of w.pillars) p.destroy()
          this.sweeps.splice(i, 1)
        }
      }
    }

    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i]!
      d.img.x += d.dir * d.speed * (dt / 1000)
      d.cooldown = Math.max(0, d.cooldown - dt)
      let lit: Player | null = null
      for (const h of heroes) if (h.alive && Math.abs(h.x - d.img.x) < CONE_HALF_W) lit = h
      const locking = !!lit && d.cooldown <= 0
      if (lit && locking) {
        const t = (d.lock.get(lit) ?? 0) + dt
        d.lock.set(lit, t)
        if (t > 120 && d.target !== lit) {
          d.target = lit
          this.log('drone-lock', d.img.x)
        }
        if (t >= 420) {
          d.lock.clear()
          d.target = null
          d.cooldown = 1500
          this.log('drone-shot', lit.x)
          this.ctx.dropShot(lit.x, floor - DRONE_Y_OFF + 10)
        }
      } else {
        d.lock.clear()
        d.target = null
      }
      const red = !!d.target
      const tip = d.img.y + 8
      g.fillStyle(red ? 0xff4030 : 0xfff0a0, red ? 0.3 : 0.16)
      g.fillTriangle(d.img.x, tip, d.img.x - CONE_HALF_W, floor + 2, d.img.x + CONE_HALF_W, floor + 2)
      const gone = d.dir > 0 ? d.img.x >= d.x1 : d.img.x <= d.x1
      if (gone) {
        d.img.destroy()
        this.drones.splice(i, 1)
      }
    }
    void now
  }


  private tickMallExtras(dt: number, heroes: Player[]) {
    for (const z of this.slips) {
      let hot = false
      for (const h of heroes) {
        if (!h.active) continue
        if (h.x >= z.x0 && h.x <= z.x1) {
          hot = true
          const body = h.body as Phaser.Physics.Arcade.Body | null
          if (body && Math.abs(body.velocity.x) > 20) {
            body.setVelocityX(Phaser.Math.Clamp(body.velocity.x * (1 + (z.mul - 1) * 0.045), -220, 220))
          }
        }
      }
      z.flash.setAlpha(hot ? 0.5 : 0.12 + 0.1 * Math.sin(this.ctx.scene.time.now / 180))
      z.flash.setFillStyle(hot ? 0xa0f0ff : 0x80e0ff, hot ? 0.5 : 0.18)
    }
    for (const e of this.ctx.enemyBodies?.() ?? []) {
      if (!e.active || !e.body) continue
      const mul = this.slipMulAt(e.x)
      if (mul > 1.01 && Math.abs(e.body.velocity.x) > 10) {
        e.body.setVelocityX(e.body.velocity.x * (1 + (mul - 1) * 0.05))
      }
    }
    // Teach slip once in atrium — only new mechanic for the opening beat.
    if (!this.slipTaught && this.teachSlipX0 != null && this.teachSlipX1 != null) {
      for (const h of heroes) {
        if (!h.active) continue
        if (h.x >= this.teachSlipX0 && h.x <= this.teachSlipX1) {
          this.slipTaught = true
          const s = this.ctx.scene
          const tip = s.add
            .text(h.x, this.ctx.floorY - 110, '新機制：地滑！地面閃就會加速', {
              fontFamily: FONT_UI,
              fontSize: '14px',
              color: '#1a1a10',
              backgroundColor: '#ffe060',
              padding: { x: 6, y: 4 },
            })
            .setOrigin(0.5)
            .setDepth(DEPTH.UI + 20)
          s.tweens.add({ targets: tip, y: tip.y - 12, alpha: 0, delay: 2200, duration: 500, onComplete: () => tip.destroy() })
          break
        }
      }
    }
    const junkOn = heroes.some((h) => h.active && h.x >= this.junkUnlockX)
    if (junkOn && !this.junkTaught) {
      this.junkTaught = true
      const lead = heroes.find((h) => h.active) ?? heroes[0]
      if (lead) {
        const s = this.ctx.scene
        const tip = s.add
          .text(lead.x, this.ctx.floorY - 110, '新機制：地下雜物！要跳過，踩中會扣血', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#fff8e0',
            backgroundColor: '#802018',
            padding: { x: 6, y: 4 },
          })
          .setOrigin(0.5)
          .setDepth(DEPTH.UI + 20)
        s.tweens.add({ targets: tip, y: tip.y - 12, alpha: 0, delay: 2200, duration: 500, onComplete: () => tip.destroy() })
      }
    }
    for (const j of this.junk) {
      j.root.setVisible(junkOn)
      if (!junkOn) continue
      for (const h of heroes) {
        if (!h.active) continue
        const left = j.cd.get(h) ?? 0
        if (left > 0) {
          j.cd.set(h, left - dt)
          continue
        }
        const airborne = !!(h as unknown as { laneJumping?: boolean }).laneJumping
        if (airborne) continue
        if (Math.abs(h.x - j.x) < j.w * 0.55) {
          j.cd.set(h, 900)
          this.ctx.hurt(h, h.x < j.x ? -1 : 1, '雜物 -1')
          burst(this.ctx.scene, j.x, this.ctx.floorY - 20, 0xff8060, 6)
          SFX.hurt()
          this.log('junk-hit', j.x)
        }
      }
    }
    if (this.fanBlades) {
      this.fanSpin += dt * (this.fanOn ? 0.02 : 0.004)
      this.fanBlades.clear()
      this.fanBlades.fillStyle(this.fanOn ? 0xb0c4d8 : 0x607080, this.fanOn ? 0.95 : 0.55)
      for (let i = 0; i < 3; i++) {
        const a = this.fanSpin + (i * Math.PI * 2) / 3
        this.fanBlades.fillTriangle(
          0,
          0,
          Math.cos(a) * 40,
          Math.sin(a) * 40,
          Math.cos(a + 0.35) * 18,
          Math.sin(a + 0.35) * 18,
        )
      }
    }
    void this.fanGfx
  }

  /** Boss down: drop any beam / drone still in flight. */
  clearHazards() {
    for (const w of this.sweeps) for (const p of w.pillars) p.destroy()
    for (const d of this.drones) d.img.destroy()
    this.sweeps = []
    this.drones = []
  }

  destroy() {
    this.g.destroy()
    for (const d of this.debris) {
      d.col.destroy()
      d.base.destroy()
      d.chunk?.destroy()
    }
    for (const w of this.sweeps) for (const p of w.pillars) p.destroy()
    for (const d of this.drones) d.img.destroy()
    for (const z of this.slips) z.flash.destroy()
    for (const j of this.junk) j.root.destroy()
    this.moodWash?.destroy()
    this.vignette?.destroy()
    this.fanGfx?.destroy()
    this.escRoot?.destroy(true)
    this.escRoot = null
    this.escStepsGfx = null
    this.liftRoot?.destroy(true)
    this.liftRoot = null
    this.liftDoorL = null
    this.liftDoorR = null
    this.liftFloorLamp = null
    this.debris = []
    this.sweeps = []
    this.drones = []
  }
}

/** Short faux-3D elevator ride at B→C. */
export function playElevatorRide(scene: Phaser.Scene): Promise<void> {
  return new Promise((resolve) => {
    const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.UI + 200)
    const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070a, 0.92).setOrigin(0).setInteractive()
    root.add(dim)
    const g = scene.add.graphics()
    root.add(g)
    let tms = 0
    let floor = 1
    const label = scene.add
      .text(GAME_W / 2, 48, '電梯直落…', { fontFamily: FONT_UI, fontSize: '16px', color: '#ffe08a' })
      .setOrigin(0.5)
    root.add(label)
    root.add(
      scene.add
        .text(GAME_W / 2, GAME_H - 30, '撳一下 Skip', { fontFamily: FONT_UI, fontSize: '12px', color: '#8a9aaa' })
        .setOrigin(0.5),
    )
    let done = false
    const end = () => {
      if (done) return
      done = true
      timer.remove(false)
      root.destroy(true)
      resolve()
    }
    const timer = scene.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        tms += 40
        const sway = Math.sin(tms / 180) * 6
        g.clear()
        g.fillStyle(0x1c2430, 1).fillRect(160 + sway, 70, 320, 220)
        g.fillStyle(0x10161e, 1).fillTriangle(160 + sway, 70, 480 + sway, 70, 320, 40)
        g.fillStyle(0x2a3544, 1).fillRect(180 + sway, 100, 120, 160).fillRect(340 + sway, 100, 120, 160)
        g.lineStyle(2, 0xc0d8f0, 0.8).strokeRect(160 + sway, 70, 320, 220)
        if (tms % 600 < 40) floor = Math.min(2, floor + 1)
        label.setText(floor >= 2 ? 'B2・陰層' : '直落中…')
        if (tms >= 2800) end()
      },
    })
    dim.on('pointerdown', end)
    scene.input.keyboard?.once('keydown-ENTER', end)
    scene.input.keyboard?.once('keydown-SPACE', end)
  })
}

