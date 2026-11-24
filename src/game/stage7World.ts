import Phaser from 'phaser'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { SFX } from './audio'

export type Stage7Conveyor = { x0: number; x1: number; dir: 1 | -1; pitTail?: boolean; note?: string }
export type Stage7Spotlight = { x: number; x0: number; x1: number; note?: string }
export type Stage7RescueCage = { x: number; animal: 'rabbit' | 'fawn' | 'hedgehog'; note?: string }
export type Stage7CageDrone = { x: number; unlockX?: number; note?: string }

export type Stage7Data = {
  conveyors?: Stage7Conveyor[]
  spotlights?: Stage7Spotlight[]
  rescueCages?: Stage7RescueCage[]
  cageDrones?: Stage7CageDrone[]
}

type Player = Phaser.Physics.Arcade.Sprite & {
  alive?: boolean
  hurtLock?: number
  setPosition: (x: number, y: number) => unknown
}

type Stage7Ctx = {
  scene: Phaser.Scene
  floorY: number
  heroes: () => Player[]
  /** Spawn two whip handlers around the player (spotlight alarm). */
  spawnAlarmPair: (hx: number) => void
  /** Soft drop / coin / enemy bodies to push on conveyors. */
  looseBodies: () => Array<{ x: number; y: number; setPosition?: (x: number, y: number) => void; active?: boolean; flying?: boolean }>
  /** Active (non-dead) enemies on field — spotlight reinforce gate. */
  activeEnemyCount: () => number
  /** Pits for conveyor end deadzone (same idea as Stage5). */
  pits?: Array<{ x: number; w: number }>
}

/** D2 numbers */
export const CONVEYOR_SPEED = 70
/** Polish-1 / clarity-2: stand-firm zone before a pit-adjacent belt end. */
const BELT_PIT_DEADZONE = 40
/** D3 numbers */
const SPOT_HALF = 40 // 80px beam
const SPOT_PERIOD_MS = 4000
const SPOT_ALARM_MS = 500
const SPOT_COOLDOWN_MS = 8000
/** D4 */
const CAGE_LOCK_HP = 3
/** D5 cage drone */
const DRONE_DROP_MS = 3000
const DROP_LIFE_MS = 6000

type ConveyorRuntime = {
  x0: number
  x1: number
  dir: 1 | -1
  pitTail: boolean
  g: Phaser.GameObjects.Graphics
  arrows: Phaser.GameObjects.Graphics
  phase: number
}

type SpotRuntime = {
  x0: number
  x1: number
  beam: Phaser.GameObjects.Rectangle
  t: number
  dwell: number
  cooledUntil: number
  fired: boolean
}

type RescueRuntime = {
  x: number
  animal: Stage7RescueCage['animal']
  hp: number
  root: Phaser.GameObjects.Container
  lock: Phaser.GameObjects.Rectangle
  critter: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  open: boolean
}

type DroneRuntime = {
  x: number
  img: Phaser.GameObjects.Container
  t: number
  drop: Phaser.GameObjects.Rectangle | null
  dropUntil: number
}

const ANIMAL_KEY: Record<Stage7RescueCage['animal'], string> = {
  rabbit: 's7-animal-rabbit',
  fawn: 's7-animal-fawn',
  hedgehog: 's7-animal-hedgehog',
}

/**
 * Stage 7 exclusive systems (batch7): conveyors, spotlights, rescue cages, cage drones.
 * Must not touch Stage 6.
 */
export class Stage7World {
  private ctx: Stage7Ctx
  private conveyors: ConveyorRuntime[] = []
  private spots: SpotRuntime[] = []
  private cages: RescueRuntime[] = []
  private drones: DroneRuntime[] = []
  rescueCount = 0
  readonly rescueTotal = 3
  private hud: Phaser.GameObjects.Text | null = null
  readonly events: Array<{ kind: string; at: number; x?: number }> = []

  constructor(ctx: Stage7Ctx, d: Stage7Data) {
    this.ctx = ctx
    for (const c of d.conveyors ?? []) this.buildConveyor(c)
    for (const s of d.spotlights ?? []) this.buildSpotlight(s)
    for (const c of d.rescueCages ?? []) this.buildRescue(c)
    for (const dr of d.cageDrones ?? []) this.buildDrone(dr)
    this.hud = ctx.scene.add
      .text(12, 52, '救出 0/3', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#e8f0c8',
        backgroundColor: '#1a2818',
        padding: { x: 5, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.UI + 20)
      .setVisible((d.rescueCages?.length ?? 0) > 0)
  }

  private buildConveyor(c: Stage7Conveyor) {
    const s = this.ctx.scene
    const f = this.ctx.floorY
    const g = s.add.graphics().setDepth(DEPTH.PROP - 4)
    const arrows = s.add.graphics().setDepth(DEPTH.PROP - 3)
    const w = c.x1 - c.x0
    g.fillStyle(0x2a3038, 1).fillRect(c.x0, f - 10, w, 12)
    g.fillStyle(0x4a5560, 1).fillRect(c.x0, f - 8, w, 8)
    if (c.pitTail) {
      // Yellow/black hazard stripes at tail
      const tx = c.dir > 0 ? c.x1 - 18 : c.x0
      for (let i = 0; i < 6; i++) {
        g.fillStyle(i % 2 === 0 ? 0xf0c020 : 0x101010, 1).fillRect(tx + i * 3, f - 22, 3, 12)
      }
    }
    this.conveyors.push({ x0: c.x0, x1: c.x1, dir: c.dir, pitTail: !!c.pitTail, g, arrows, phase: 0 })
  }

  private buildSpotlight(sp: Stage7Spotlight) {
    const s = this.ctx.scene
    const f = this.ctx.floorY
    // Fixture
    s.add.rectangle(sp.x, f - 130, 16, 10, 0x808890).setDepth(DEPTH.PROP)
    const beam = s.add
      .rectangle(sp.x0, f - 40, SPOT_HALF * 2, f - 40, 0xffe080, 0.28)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.HAZARD + 1)
    this.spots.push({ x0: sp.x0, x1: sp.x1, beam, t: 0, dwell: 0, cooledUntil: 0, fired: false })
  }

  private buildRescue(c: Stage7RescueCage) {
    const s = this.ctx.scene
    const f = this.ctx.floorY
    const root = s.add.container(c.x, f).setDepth(DEPTH.PROP + 3)
    const frame = s.add.graphics()
    frame.fillStyle(0x1a2228, 1).fillRect(-36, -88, 72, 86)
    frame.lineStyle(3, 0xb0a878, 1).strokeRect(-36, -88, 72, 86)
    for (let x = -24; x <= 24; x += 12) frame.lineBetween(x, -86, x, -4)
    frame.lineBetween(-36, -48, 36, -48)
    root.add(frame)
    let critter: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
    const key = ANIMAL_KEY[c.animal]
    if (s.textures.exists(key)) {
      critter = s.add.image(0, -28, key).setOrigin(0.5, 1)
    } else {
      const col = c.animal === 'rabbit' ? 0xe8d8c8 : c.animal === 'fawn' ? 0xc89050 : 0x687060
      critter = s.add.rectangle(0, -36, 22, 28, col)
    }
    root.add(critter)
    const lock = s.add.rectangle(0, -50, 14, 18, 0xd0a030).setStrokeStyle(2, 0x403010)
    root.add(lock)
    this.cages.push({ x: c.x, animal: c.animal, hp: CAGE_LOCK_HP, root, lock, critter, open: false })
  }

  private buildDrone(d: Stage7CageDrone) {
    const s = this.ctx.scene
    const root = s.add.container(d.x, this.ctx.floorY - 120).setDepth(DEPTH.PROP + 4)
    const body = s.add.rectangle(0, 0, 36, 16, 0x607080).setStrokeStyle(2, 0xa0b0c0)
    const blade = s.add.rectangle(0, -10, 48, 4, 0xc0d0e0, 0.7)
    root.add([body, blade])
    this.drones.push({ x: d.x, img: root, t: 0, drop: null, dropUntil: 0 })
  }

  update(dt: number) {
    const step = Math.min(Math.max(dt, 0), 50)
    this.tickConveyors(step)
    this.tickSpots(step)
    this.tickDrones(step)
    this.tickRescueHits()
  }

  private tickConveyors(dt: number) {
    for (const c of this.conveyors) {
      c.phase = (c.phase + (dt / 1000) * 3 * c.dir + 8) % 8
      c.arrows.clear()
      const f = this.ctx.floorY
      for (let i = 0; i < 8; i++) {
        const t = ((i + c.phase) % 8) / 8
        const x = c.x0 + 10 + t * (c.x1 - c.x0 - 20)
        c.arrows.fillStyle(0xe8f0a0, 0.85)
        if (c.dir > 0) {
          c.arrows.fillTriangle(x - 4, f - 6, x - 4, f - 2, x + 4, f - 4)
        } else {
          c.arrows.fillTriangle(x + 4, f - 6, x + 4, f - 2, x - 4, f - 4)
        }
      }
      const along = (CONVEYOR_SPEED * c.dir * dt) / 1000
      // Pit-adjacent end deadzone: last 40px before a pit — no push so feet can plant.
      let pushLo = c.x0
      let pushHi = c.x1
      for (const p of this.ctx.pits ?? []) {
        const p0 = p.x
        const p1 = p.x + p.w
        if (c.dir > 0 && p0 <= c.x1 + 8 && p1 >= c.x1 - BELT_PIT_DEADZONE) {
          pushHi = Math.min(pushHi, c.x1 - BELT_PIT_DEADZONE)
        }
        if (c.dir < 0 && p1 >= c.x0 - 8 && p0 <= c.x0 + BELT_PIT_DEADZONE) {
          pushLo = Math.max(pushLo, c.x0 + BELT_PIT_DEADZONE)
        }
      }
      const push = (
        actor: {
          x: number
          y: number
          setPosition?: (x: number, y: number) => void
          body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null
        },
        skipBelt: boolean,
      ) => {
        if (skipBelt) return
        if (actor.x < c.x0 - 2 || actor.x > c.x1 + 2) return
        // Exclusive upper bound matches Stage5 (h.x >= hi → no push).
        if (actor.x < pushLo || actor.x >= pushHi) return
        if (actor.y < this.ctx.floorY - 20 || actor.y > this.ctx.floorY + 8) return
        const nx = Phaser.Math.Clamp(actor.x + along, pushLo, Math.max(pushLo, pushHi - 0.01))
        actor.x = nx
        if (actor.setPosition) actor.setPosition(nx, actor.y)
        const body = actor.body as Phaser.Physics.Arcade.Body | null | undefined
        if (body && 'updateFromGameObject' in body) {
          body.updateFromGameObject()
          body.prev.copy(body.position)
          body.prevFrame.copy(body.position)
        }
      }
      for (const h of this.ctx.heroes()) {
        if (!h?.active || h.alive === false) continue
        // Against-belt: steerHero already applies walk−70 (min 20). Skip belt add
        // so the player can still make slow headway (escalator pattern).
        const body = (h as { body?: Phaser.Physics.Arcade.Body }).body
        const vx = body && 'velocity' in body ? body.velocity.x : 0
        const against =
          (c.dir > 0 && vx < -10) || (c.dir < 0 && vx > 10)
        push(h, against)
      }
      for (const b of this.ctx.looseBodies()) {
        if (b.active === false || b.flying) continue
        push(b, false)
      }
    }
  }

  /** Against-belt walk: same numbers as escalator pattern — walk − 70, min 20. */
  static againstWalkSpeed(walkSpeed: number) {
    return Math.max(20, walkSpeed - CONVEYOR_SPEED)
  }

  conveyorAt(x: number): ConveyorRuntime | null {
    for (const c of this.conveyors) if (x >= c.x0 && x <= c.x1) return c
    return null
  }

  private tickSpots(dt: number) {
    const now = this.ctx.scene.time.now
    const f = this.ctx.floorY
    for (const sp of this.spots) {
      sp.t += dt
      const cycle = (sp.t % SPOT_PERIOD_MS) / SPOT_PERIOD_MS
      // Ping-pong left↔right
      const ping = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2
      const cx = Phaser.Math.Linear(sp.x0, sp.x1, ping)
      sp.beam.setPosition(cx, f)
      let lit = false
      for (const h of this.ctx.heroes()) {
        if (!h?.active || h.alive === false) continue
        if (Math.abs(h.x - cx) <= SPOT_HALF && h.y >= f - 80) {
          lit = true
          break
        }
      }
      if (lit && now >= sp.cooledUntil) {
        sp.dwell += dt
        sp.beam.setFillStyle(0xffc040, 0.45)
        if (sp.dwell >= SPOT_ALARM_MS && !sp.fired) {
          sp.fired = true
          sp.cooledUntil = now + SPOT_COOLDOWN_MS
          const hx = this.ctx.heroes().find((h) => h?.alive !== false)?.x ?? cx
          // Always flash + sound. Reinforce only when fewer than 2 live enemies.
          SFX.spike()
          floatAlarm(this.ctx.scene, cx, f - 100)
          const live = this.ctx.activeEnemyCount()
          if (live >= 2) {
            this.log('spotlight-warn', hx)
          } else {
            this.ctx.spawnAlarmPair(hx)
            this.log('spotlight-alarm', hx)
          }
        }
      } else {
        sp.dwell = 0
        sp.beam.setFillStyle(0xffe080, 0.28)
        if (now >= sp.cooledUntil) sp.fired = false
      }
    }
  }

  private tickDrones(dt: number) {
    const now = this.ctx.scene.time.now
    const f = this.ctx.floorY
    for (const d of this.drones) {
      d.t += dt
      d.img.y = f - 120 + Math.sin(d.t / 400) * 6
      d.img.list[1] && ((d.img.list[1] as Phaser.GameObjects.Rectangle).rotation = d.t / 80)
      if (d.drop && now >= d.dropUntil) {
        d.drop.destroy()
        d.drop = null
      }
      if (d.t >= DRONE_DROP_MS && !d.drop) {
        d.t = 0
        const drop = this.ctx.scene.add
          .rectangle(d.img.x, f - 8, 40, 28, 0x6a5848)
          .setStrokeStyle(2, 0xc0a878)
          .setDepth(DEPTH.HAZARD + 2)
        d.drop = drop
        d.dropUntil = now + DROP_LIFE_MS
        this.log('drone-drop', d.img.x)
      }
    }
  }

  /** Obstacle hitboxes for dropped cages (solid-ish for heroes). */
  dropZones(): Array<{ x0: number; x1: number }> {
    return this.drones
      .filter((d) => d.drop)
      .map((d) => ({ x0: d.drop!.x - 22, x1: d.drop!.x + 22 }))
  }

  private tickRescueHits() {
    for (const c of this.cages) {
      if (c.open) continue
      for (const h of this.ctx.heroes()) {
        if (!h?.active || h.alive === false) continue
        const atk = (h as { attackHitbox?: Phaser.Physics.Arcade.Sprite }).attackHitbox
        if (!atk?.active) continue
        const ab = atk.body as Phaser.Physics.Arcade.Body | undefined
        if (!ab) continue
        if (ab.right < c.x - 20 || ab.left > c.x + 20) continue
        // One hit per attack activation via lock tint flash debounce
        if (c.lock.getData('hitAt') && this.ctx.scene.time.now - (c.lock.getData('hitAt') as number) < 280) continue
        c.lock.setData('hitAt', this.ctx.scene.time.now)
        c.hp -= 1
        c.lock.setFillStyle(0xffe080)
        this.ctx.scene.time.delayedCall(80, () => {
          if (!c.open) c.lock.setFillStyle(0xd0a030)
        })
        if (c.hp <= 0) this.openCage(c)
      }
    }
  }

  /** QA / scripted: hit a cage lock once at x. */
  hitCageAt(x: number) {
    const c = this.cages.find((k) => !k.open && Math.abs(k.x - x) < 40)
    if (!c) return false
    c.hp -= 1
    if (c.hp <= 0) this.openCage(c)
    return true
  }

  private openCage(c: RescueRuntime) {
    if (c.open) return
    c.open = true
    c.lock.destroy()
    this.rescueCount++
    this.hud?.setText(`救出 ${this.rescueCount}/${this.rescueTotal}`)
    this.log('rescue', c.x)
    SFX.cageClank()
    // Nod then run away
    this.ctx.scene.tweens.add({
      targets: c.critter,
      angle: { from: -12, to: 12 },
      duration: 120,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.ctx.scene.tweens.add({
          targets: c.critter,
          x: 220,
          alpha: 0,
          duration: 900,
          onComplete: () => c.critter.destroy(),
        })
      },
    })
    // Open bars fade
    this.ctx.scene.tweens.add({ targets: c.root, alpha: 0.35, duration: 400 })
  }

  private log(kind: string, x?: number) {
    this.events.push({ kind, at: this.ctx.scene.time.now, x })
    if (this.events.length > 80) this.events.shift()
  }

  destroy() {
    for (const c of this.conveyors) {
      c.g.destroy()
      c.arrows.destroy()
    }
    for (const s of this.spots) s.beam.destroy()
    for (const c of this.cages) c.root.destroy()
    for (const d of this.drones) {
      d.img.destroy()
      d.drop?.destroy()
    }
    this.hud?.destroy()
  }
}

function floatAlarm(scene: Phaser.Scene, x: number, y: number) {
  const t = scene.add
    .text(x, y, '警報！', {
      fontFamily: FONT_UI,
      fontSize: '14px',
      color: '#ffd0a0',
      backgroundColor: '#602018',
      padding: { x: 4, y: 2 },
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.SIGN)
  scene.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: 900, onComplete: () => t.destroy() })
}
