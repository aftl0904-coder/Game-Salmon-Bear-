import { GAME_W, GAME_H } from './display'
import Phaser from 'phaser'
import { playSong, SFX, unlockAudio } from './audio'
import { TouchInput } from './touchInput'
import { mountTouchControls } from './TouchControls'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { animTex, hasAnimSet, markHd, type AnimSetId } from './heroAnims'
import { p2Pad, btn as padBtn, padDir } from './gamepadBridge'
import meta from '../../data/anim/map-bike.json'
import { saveTransitionCoins } from './run'
import { gradeResult, showGradeResult, showSegmentBanner } from './minigameFramework'

/**
 * 單車追逐 — auto-scrolling ride between any two stages (destination + song come from `to`; art is shared).
 * Jump rocks, logs and cones; ramps launch you; bee swarms fly at jump height (stay low);
 * honey puddles slow you. Coins carry over as continues. No damage — a crash just wobbles.
 *
 * Minigame v1 · 6→7 「追籠車」：3 段轉線避障（障礙 6／9／12；速 ×1.0／1.2／1.4；預警 0.8s）。
 * 評級 reaction／medalId cage-chase。2P 共用車線，任一架到終點即成功（唔難過 1P）。
 */
type Kind = 'rock' | 'log' | 'cone' | 'puddle' | 'ramp' | 'swarm' | 'coin' | 'debris' | 'box' | 'trash' | 'cart'
type Lane = 0 | 1 | 2
type Obj = {
  kind: Kind
  x: number
  spr: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
  done: boolean
  y: number
  /** Chase: which road lane the junk sits on. */
  lane?: Lane
  /** Chase: obstacle already scored a hit (avoid 2P double-count). */
  hitLogged?: boolean
  warn?: Phaser.GameObjects.Ellipse
}
type Rider = {
  set: AnimSetId
  spr: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  x: number
  y: number
  vy: number
  air: boolean
  hurtUntil: number
  jumpKeys: () => boolean
  /** Mash this to pedal faster (攻擊鍵). */
  pedalKeys: () => boolean
  lane: Lane
}

export const DEST_NAMES: Record<number, string> = {
  2: '蜜樹丘',
  3: '月影夜市',
  4: '鹽霧工地',
  5: '△畝大廈',
  7: '森友展銷中心',
}
const ROAD_Y = 316
const SPEED = 230
const LENGTH = 9000
/** ~40s chase at base speed (35–45s window). */
const CHASE_LENGTH = 9200
const G = 1500
/** Chase lanes (上／中／下). */
const LANE_YS = [ROAD_Y - 34, ROAD_Y, ROAD_Y + 34] as const
const CHASE_OBS = [6, 9, 12] as const
const CHASE_SPEED = [1.0, 1.2, 1.4] as const
const WARN_S = 0.8
const JUNK: Kind[] = ['trash', 'debris', 'box', 'cart']

/** Course: [distance, kind] — readable rhythm, harder towards the top of the hill. */
const COURSE: Array<[number, Kind]> = [
  [700, 'rock'], [780, 'coin'], [1150, 'cone'], [1500, 'log'], [1560, 'coin'], [1620, 'coin'],
  [2000, 'puddle'], [2300, 'ramp'], [2380, 'coin'], [2440, 'coin'], [2500, 'coin'],
  [2900, 'swarm'], [3300, 'rock'], [3500, 'cone'], [3900, 'log'], [4000, 'coin'],
  [4400, 'swarm'], [4700, 'puddle'], [4800, 'rock'], [5200, 'ramp'], [5280, 'coin'], [5340, 'coin'],
  [5400, 'coin'], [5800, 'cone'], [6000, 'log'], [6250, 'swarm'], [6500, 'rock'], [6620, 'cone'],
  [7000, 'puddle'], [7150, 'log'], [7500, 'ramp'], [7580, 'coin'], [7640, 'coin'], [7700, 'coin'],
  [8000, 'swarm'], [8300, 'rock'], [8420, 'log'],
]

type ChaseSpawn = { d: number; kind: Kind; lane?: Lane; seg: number }

/** Build 3-seg chase: 6／9／12 junk + coins; lanes alternate for reaction dodge. */
function buildChaseCourse(): ChaseSpawn[] {
  const out: ChaseSpawn[] = []
  const segEnds = [0.34, 0.67, 1].map((p) => Math.floor(CHASE_LENGTH * p))
  let cursor = 420
  let junkI = 0
  for (let seg = 1; seg <= 3; seg++) {
    const end = segEnds[seg - 1]!
    const n = CHASE_OBS[seg - 1]!
    const span = Math.max(400, end - cursor - 200)
    const step = span / (n + 0.5)
    for (let i = 0; i < n; i++) {
      cursor += step
      const lane = ((junkI + seg) % 3) as Lane
      out.push({ d: Math.round(cursor), kind: JUNK[junkI % JUNK.length]!, lane, seg })
      junkI++
      if (i % 2 === 1 && cursor + 80 < end) {
        out.push({ d: Math.round(cursor + 80), kind: 'coin', seg })
      }
    }
    cursor = end
  }
  return out
}

/** ≤20 chars each (Claude 定案). */
const CHASE_LINES = [
  '倫寶：轆印出咗後門。',
  '琪寶寶：轉線避障！',
  '倫寶：前面就係展銷。',
  '噗噗：噗！',
]

export class BikeScene extends Phaser.Scene {
  private riders: Rider[] = []
  private objs: Obj[] = []
  private dist = 0
  private speedMul = 1
  private slowUntil = 0
  private mid!: Phaser.GameObjects.TileSprite
  private road!: Phaser.GameObjects.TileSprite
  private far!: Phaser.GameObjects.Image
  /** Chase destination (展銷側門) — grows as you near the end. */
  private goalImg: Phaser.GameObjects.Image | null = null
  private coins = 0
  private crashes = 0
  /** Mashing the attack button pedals harder: more speed, and a rising coin multiplier. */
  private mash = 0
  private mult = 1
  private multText!: Phaser.GameObjects.Text
  private speedLines: Phaser.GameObjects.Rectangle[] = []
  private coinText!: Phaser.GameObjects.Text
  private marker!: Phaser.GameObjects.Rectangle
  private finished = false
  private padPrev: Record<string, boolean> = {}
  private toStage = 2
  /** Stage 6→7 cage-truck chase (mall alley). */
  private chase = false
  private chaseJunkTotal = 0
  private chaseJunkHit = 0
  private chaseBaseMul = 1
  private chaseSeg = 1
  private sharedLane: Lane = 1
  private laneCd = 0
  private chaseCourse: ChaseSpawn[] = []
  private bannerBusy = false
  private laneKeys: {
    up: Phaser.Input.Keyboard.Key[]
    down: Phaser.Input.Keyboard.Key[]
  } | null = null

  constructor() {
    super('bike')
  }

  init(data?: { to?: number }) {
    const to = data?.to ?? (this.registry.get('stageNo') as number | undefined) ?? 2
    this.chase = to === 7
    this.toStage = DEST_NAMES[to] ? to : this.chase ? 7 : 2
  }

  private destName() {
    return DEST_NAMES[this.toStage] ?? DEST_NAMES[2]!
  }

  private courseLength() {
    return this.chase ? CHASE_LENGTH : LENGTH
  }

  private laneY(lane: Lane) {
    return LANE_YS[lane] ?? ROAD_Y
  }

  preload() {
    const L = (k: string, f: string) => !this.textures.exists(k) && this.load.image(k, `/art/bike/${f}.png`)
    L('bike-far', 'far')
    L('bike-mid', 'mid')
    L('bike-road', 'road')
    for (const n of ['rock', 'log', 'cone', 'puddle', 'ramp']) L(`bike-${n}`, n)
    if (!this.textures.exists('bike-swarm'))
      this.load.spritesheet('bike-swarm', '/art/bike/swarm.png', { frameWidth: meta.swarm.frameWidth, frameHeight: meta.swarm.frameHeight })
    // Chase plates (Manus M7 / #144) — dedicated keys so they never clash with Boot s6-* props.
    if (this.chase) {
      if (!this.textures.exists('bike-c2-far')) this.load.image('bike-c2-far', '/art/bike-c2/far.png')
      if (!this.textures.exists('bike-c2-mid')) this.load.image('bike-c2-mid', '/art/bike-c2/mid.png')
      if (!this.textures.exists('bike-c2-goal')) this.load.image('bike-c2-goal', '/art/bike-c2/goal.png')
    }
    // Chase obstacles reuse Boot-loaded s6-* / c2-prop-* keys — do not reload (Phaser key clash).
  }

  create() {
    for (const k of ['far', 'mid', 'road', 'rock', 'log', 'cone', 'puddle', 'ramp', 'swarm']) {
      if (this.textures.exists(`bike-${k}`)) markHd(this.textures.get(`bike-${k}`), meta.swarm.res)
    }
    this.riders = []
    this.objs = []
    this.dist = 0
    this.coins = 0
    this.crashes = 0
    this.finished = false
    this.speedMul = 1
    this.slowUntil = 0
    this.mash = 0
    this.mult = 1
    this.speedLines = []
    this.goalImg = null
    this.chaseJunkTotal = 0
    this.chaseJunkHit = 0
    this.chaseBaseMul = 1
    this.chaseSeg = 1
    this.sharedLane = 1
    this.laneCd = 0
    this.bannerBusy = false
    this.chaseCourse = this.chase ? buildChaseCourse() : []
    const W = GAME_W
    this.cameras.main.fadeIn(400, this.chase ? 20 : 255, this.chase ? 18 : 250, this.chase ? 28 : 235)
    unlockAudio()
    // No dedicated stage6 BGM yet — reuse stage5 for the alley chase.
    playSong(this.chase ? 'stage5' : (`stage${Math.min(5, this.toStage)}` as 'stage2'))

    if (this.chase) {
      // Manus bike-c2 plates (far / seamless mid / side-door goal). Fallback to temp s6 if missing.
      this.add.rectangle(0, 0, W, ROAD_Y + 8, 0x121018).setOrigin(0).setDepth(0)
      const hasC2 = this.textures.exists('bike-c2-far') && this.textures.exists('bike-c2-mid')
      if (hasC2) {
        this.far = this.add.image(W / 2, ROAD_Y - 4, 'bike-c2-far').setOrigin(0.5, 1).setDisplaySize(W, Math.round((GAME_H * 5) / 6))
        const mh = this.textures.get('bike-c2-mid').get().height
        // mid.png L/R columns match — tileSprite scrolls seamlessly.
        this.mid = this.add.tileSprite(0, ROAD_Y + 4 - mh, W, mh, 'bike-c2-mid').setOrigin(0)
        this.road = this.add.tileSprite(0, ROAD_Y - 4, W, 40, 'bike-road').setOrigin(0).setAlpha(0.35).setTint(0x3a3548)
        if (this.textures.exists('bike-c2-goal')) {
          this.goalImg = this.add
            .image(W - 70, ROAD_Y + 2, 'bike-c2-goal')
            .setOrigin(0.5, 1)
            .setScale(0.55)
            .setDepth(5)
        }
      } else {
        const farKey = this.textures.exists('s6-dome') ? 's6-dome' : 'bike-far'
        this.far = this.add.image(W / 2, ROAD_Y - 8, farKey).setOrigin(0.5, 1).setAlpha(0.55).setTint(0x6a6080)
        const midKey = this.textures.exists('s6-factory-wall') ? 's6-factory-wall' : 'bike-mid'
        const mh = this.textures.get(midKey).get().height
        this.mid = this.add.tileSprite(0, ROAD_Y + 4 - Math.min(mh, 120), W, Math.min(mh, 120), midKey).setOrigin(0).setAlpha(0.85)
        this.road = this.add.tileSprite(0, ROAD_Y - 6, W, 52, 'bike-road').setOrigin(0).setTint(0x4a4558)
      }
      // Lane guides
      for (const ly of LANE_YS) {
        this.add.rectangle(W / 2, ly + 4, W, 2, 0xffe08a, 0.12).setDepth(2)
      }
    } else {
      // Far layer stays put (the honey tree is the goal on the horizon); it grows a little as you near it.
      this.far = this.add.image(W / 2, 360, 'bike-far').setOrigin(0.5, 1)
      const mh = this.textures.get('bike-mid').get().height
      this.mid = this.add.tileSprite(0, ROAD_Y + 4 - mh, W, mh, 'bike-mid').setOrigin(0)
      this.road = this.add.tileSprite(0, ROAD_Y - 6, W, 52, 'bike-road').setOrigin(0)
    }
    if (!this.anims.exists('bike-swarm-fly') && this.textures.exists('bike-swarm')) {
      this.anims.create({ key: 'bike-swarm-fly', frames: this.anims.generateFrameNumbers('bike-swarm', { start: 0, end: 2 }), frameRate: 10, repeat: -1 })
    }

    // Riders: 1P = chosen hero (+ 噗噗 in the basket is in the frames); 2P = both, girl a little behind.
    const mode = (this.registry.get('playMode') as '1p' | '2p') || '2p'
    const solo = (this.registry.get('soloCast') as 'boy' | 'girl') || 'boy'
    const kb = this.input.keyboard!
    const k = (c: number) => kb.addKey(c, true)
    const G1 = [k(Phaser.Input.Keyboard.KeyCodes.G), k(Phaser.Input.Keyboard.KeyCodes.K), k(Phaser.Input.Keyboard.KeyCodes.W), k(Phaser.Input.Keyboard.KeyCodes.SPACE)]
    const G2 = [k(Phaser.Input.Keyboard.KeyCodes.PERIOD), k(Phaser.Input.Keyboard.KeyCodes.UP), k(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO)]
    const p1 = () => G1.some((x) => Phaser.Input.Keyboard.JustDown(x)) || TouchInput.justPressed('jump')
    const p2 = () => G2.some((x) => Phaser.Input.Keyboard.JustDown(x)) || this.padJust(0)
    // Pedal (mash): 1P 攻擊鍵 F／J，2P 方向鍵右／手掣 B。
    const A1 = [k(Phaser.Input.Keyboard.KeyCodes.F), k(Phaser.Input.Keyboard.KeyCodes.J), k(Phaser.Input.Keyboard.KeyCodes.D)]
    const A2 = [k(Phaser.Input.Keyboard.KeyCodes.RIGHT), k(Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE)]
    const a1 = () => A1.some((x) => Phaser.Input.Keyboard.JustDown(x)) || TouchInput.justPressed('attack')
    const a2 = () => A2.some((x) => Phaser.Input.Keyboard.JustDown(x)) || this.padJust(1)
    const add = (set: AnimSetId, x: number, keys: () => boolean, pedal: () => boolean) => {
      const ok = hasAnimSet(this, set)
      const y0 = this.chase ? this.laneY(this.sharedLane) : ROAD_Y
      const spr = this.add.sprite(x, y0, ok ? animTex(set) : 'art-salmon').setOrigin(0.5, 1).setScale(set === 'kibobo' ? 1.05 : 1.35)
      if (ok) spr.play(`${set}-bike-ride`)
      const shadow = this.add.ellipse(x, y0 + 2, 46, 6, 0x1a1008, 0.35)
      this.riders.push({
        set,
        spr,
        shadow,
        x,
        y: y0,
        vy: 0,
        air: false,
        hurtUntil: 0,
        jumpKeys: keys,
        pedalKeys: pedal,
        lane: this.sharedLane,
      })
    }
    if (mode === '2p') {
      add('kibobo', 130, p2, a2)
      add('lunbo', 230, p1, a1)
    } else {
      add(solo === 'girl' ? 'kibobo' : 'lunbo', 190, p1, a1)
    }
    if (this.chase) {
      this.laneKeys = {
        up: [
          k(Phaser.Input.Keyboard.KeyCodes.UP),
          k(Phaser.Input.Keyboard.KeyCodes.W),
          k(Phaser.Input.Keyboard.KeyCodes.NUMPAD_EIGHT),
        ],
        down: [
          k(Phaser.Input.Keyboard.KeyCodes.DOWN),
          k(Phaser.Input.Keyboard.KeyCodes.S),
          k(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE),
          k(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO),
        ],
      }
    }

    // HUD: progress road to the honey tree + coins.
    const g = this.add.graphics().setDepth(50)
    g.fillStyle(0x1c120c, 0.85).fillRect(170, 8, 300, 14)
    g.fillStyle(0xc8902a, 1).fillRect(176, 14, 288, 2)
    this.add.text(474, 15, this.destName(), { fontFamily: FONT_UI, fontSize: '9px', color: '#ffd76a' }).setOrigin(0, 0.5).setDepth(51)
    this.marker = this.add.rectangle(176, 15, 6, 8, 0xffe08a).setDepth(51)
    this.coinText = this.add
      .text(12, 8, '◎ 0', { fontFamily: FONT_UI, fontSize: '12px', color: '#ffe08a', stroke: '#1a0e06', strokeThickness: 3 })
      .setDepth(51)
    this.multText = this.add
      .text(12, 26, '', { fontFamily: FONT_UI, fontSize: '12px', color: '#ff9a3a', stroke: '#1a0e06', strokeThickness: 3 })
      .setDepth(51)
    this.add
      .text(W - 6, 26, 'Start／Enter　略過', { fontFamily: FONT_UI, fontSize: '9px', color: '#fff', backgroundColor: '#00000066', padding: { x: 4, y: 2 } })
      .setOrigin(1, 0)
      .setDepth(51)
    const titleMsg = this.chase
      ? '追籠車！↑↓轉線避障\n攻擊鍵踩快　預警閃光'
      : '單車追逐！跳過障礙　蜂群要伏低\n狂撳 攻擊鍵 踩快啲，金幣加倍'
    const title = this.add
      .text(W / 2, 130, titleMsg, { fontFamily: FONT_TITLE, fontSize: '16px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(51)
    this.tweens.add({ targets: title, alpha: 0, delay: this.chase ? 3200 : 2600, duration: 600 })
    if (this.chase) this.playChaseLines()

    // Pre-build the course (positions in course distance; drawn as they come on screen).
    if (this.chase) {
      for (const s of this.chaseCourse) this.spawn(s.kind, s.d, s.lane)
      this.bannerBusy = true
      void showSegmentBanner(this, 1).then(() => {
        this.bannerBusy = false
      })
    } else {
      for (const [d, kind] of COURSE) this.spawn(kind, d)
    }

    kb.on('keydown-ENTER', this.skipAll, this)
    kb.on('keydown-ESC', this.skipAll, this)
    this.events.once('shutdown', () => {
      kb.off('keydown-ENTER', this.skipAll, this)
      kb.off('keydown-ESC', this.skipAll, this)
    })
    mountTouchControls(this)
  }

  private padJust(i: number) {
    const p = p2Pad()
    const down = padBtn(p, i)
    const was = !!this.padPrev[i]
    this.padPrev[i] = down
    return down && !was
  }

  private padAxisJust(key: string, down: boolean) {
    const was = !!this.padPrev[key]
    this.padPrev[key] = down
    return down && !was
  }

  private playChaseLines() {
    let i = 0
    const show = () => {
      if (this.finished || i >= CHASE_LINES.length) return
      const line = CHASE_LINES[i++]!
      const t = this.add
        .text(GAME_W / 2, 210, line, {
          fontFamily: FONT_UI,
          fontSize: '13px',
          color: '#fff6e0',
          backgroundColor: '#1a1210',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(55)
        .setAlpha(0)
      this.tweens.add({
        targets: t,
        alpha: 1,
        duration: 180,
        yoyo: true,
        hold: 1100,
        onComplete: () => {
          t.destroy()
          show()
        },
      })
    }
    this.time.delayedCall(400, show)
  }

  private spawn(kind: Kind, d: number, lane?: Lane) {
    const chaseKey: Partial<Record<Kind, string>> = {
      debris: 's6-debris',
      box: 's6-boxstack',
      trash: 'c2-prop-trash',
      cart: 'c2-prop-cart',
    }
    const key =
      kind === 'coin'
        ? 'fxa-coin-spin'
        : kind === 'swarm'
          ? 'bike-swarm'
          : chaseKey[kind]
            ? chaseKey[kind]!
            : `bike-${kind}`
    if (!this.textures.exists(key)) return
    const isJunk = kind === 'debris' || kind === 'box' || kind === 'trash' || kind === 'cart'
    if (this.chase && isJunk) this.chaseJunkTotal++
    const laneY = lane !== undefined ? this.laneY(lane) : ROAD_Y
    const y =
      kind === 'swarm'
        ? ROAD_Y - 64
        : kind === 'coin'
          ? laneY - 58
          : kind === 'puddle'
            ? ROAD_Y + 3
            : this.chase && isJunk
              ? laneY + 2
              : ROAD_Y + 2
    const spr = this.add.sprite(-100, y, key).setOrigin(0.5, 1).setVisible(false)
    if (kind === 'box') spr.setScale(0.55)
    if (kind === 'debris') spr.setScale(0.9)
    if (kind === 'coin' && this.anims.exists('fxa-coin-spin')) spr.play('fxa-coin-spin')
    if (kind === 'swarm') spr.play('bike-swarm-fly')
    let warn: Phaser.GameObjects.Ellipse | undefined
    if (this.chase && isJunk && lane !== undefined) {
      warn = this.add.ellipse(180, laneY + 2, 52, 14, 0xff8040, 0).setDepth(8)
    }
    this.objs.push({ kind, x: d, spr, done: false, y, lane, hitLogged: false, warn })
  }

  private skipAll() {
    if (this.finished) return
    this.finish(true)
  }

  /** Chase: shared lane for 1P/2P — either seat may steer (唔難過 1P). */
  private tickChaseLane(dt: number) {
    this.laneCd = Math.max(0, this.laneCd - dt)
    if (this.laneCd > 0) return
    const keys = this.laneKeys
    const keyUp = !!keys?.up.some((x) => Phaser.Input.Keyboard.JustDown(x))
    const keyDown = !!keys?.down.some((x) => Phaser.Input.Keyboard.JustDown(x))
    const p2y = padDir(p2Pad(), false)
    const up =
      keyUp ||
      TouchInput.justPressed('up') ||
      TouchInput.justPressed('jump') ||
      this.padAxisJust('p2up', p2y < -0.5)
    const down =
      keyDown ||
      TouchInput.justPressed('down') ||
      TouchInput.justPressed('crouch') ||
      this.padAxisJust('p2down', p2y > 0.5)
    let next = this.sharedLane
    if (up) next = Math.max(0, this.sharedLane - 1) as Lane
    else if (down) next = Math.min(2, this.sharedLane + 1) as Lane
    if (next !== this.sharedLane) {
      this.sharedLane = next
      this.laneCd = 0.18
      SFX.blip(520)
      for (const r of this.riders) {
        r.lane = this.sharedLane
        r.air = false
        r.vy = 0
      }
    }
  }

  private maybeAdvanceSeg(progress: number) {
    if (!this.chase || this.bannerBusy) return
    const next = progress < 0.34 ? 1 : progress < 0.67 ? 2 : 3
    if (next !== this.chaseSeg && next > this.chaseSeg) {
      this.chaseSeg = next
      this.chaseBaseMul = CHASE_SPEED[this.chaseSeg - 1] ?? 1
      this.bannerBusy = true
      void showSegmentBanner(this, this.chaseSeg as 1 | 2 | 3).then(() => {
        this.bannerBusy = false
      })
    }
  }

  update(_t: number, dtMs: number) {
    if (this.finished) return
    if (TouchInput.justPressed('start')) return this.skipAll()
    const dt = Math.min(dtMs, 50) / 1000
    const now = this.time.now
    if (this.chase) this.tickChaseLane(dt)
    // Pedalling: each press tops the mash meter up, it bleeds away on its own.
    for (const r of this.riders) {
      if (r.pedalKeys()) {
        this.mash = Math.min(8, this.mash + 1)
        SFX.step()
      }
    }
    this.mash = Math.max(0, this.mash - dt * 2.6)
    const boost = Phaser.Math.Clamp(this.mash / 6, 0, 1)
    this.mult = 1 + boost
    const len = this.courseLength()
    const progress = Math.min(1, this.dist / len)
    if (this.chase) {
      this.chaseBaseMul = CHASE_SPEED[this.chaseSeg - 1] ?? 1
      this.maybeAdvanceSeg(progress)
    }
    const target = ((now < this.slowUntil ? 0.55 : 1) + boost * 0.5) * (this.chase ? this.chaseBaseMul : 1)
    this.speedMul += (target - this.speedMul) * Math.min(1, dt * 4)
    this.multText.setText(
      this.chase
        ? `第${this.chaseSeg}段 ×${this.chaseBaseMul.toFixed(1)}${boost > 0.05 ? ` 踩×${this.mult.toFixed(1)}` : ''}`
        : boost > 0.05
          ? `踩！ ×${this.mult.toFixed(1)}`
          : '',
    )
    this.multText.setColor(boost > 0.7 ? '#ffd040' : boost > 0.35 ? '#ff9a3a' : '#c88050')
    this.drawSpeedLines(boost)
    const v = SPEED * this.speedMul
    if (!this.bannerBusy) this.dist += v * dt
    const progress2 = Math.min(1, this.dist / len)
    if (this.chase && this.goalImg) {
      // Side door grows as you near the exhibit entrance.
      this.goalImg.setScale(0.55 + progress2 * 0.7)
      this.goalImg.setX(GAME_W - 70 - progress2 * 30)
      this.far.setAlpha(0.85 + progress2 * 0.15)
    } else {
      this.far.setScale(1 + progress2 * 0.18)
    }
    this.mid.tilePositionX += v * dt * (this.chase ? 0.85 : 0.45)
    this.road.tilePositionX += v * dt
    this.marker.x = 176 + progress2 * 288

    for (const r of this.riders) {
      if (this.chase) {
        // Snap to shared lane (2P cooperative — same difficulty as 1P).
        r.lane = this.sharedLane
        const ty = this.laneY(r.lane)
        r.y += (ty - r.y) * Math.min(1, dt * 14)
        r.air = false
        r.vy = 0
      } else {
        if (r.jumpKeys() && !r.air) {
          r.vy = -470
          r.air = true
          SFX.jump()
          if (this.anims.exists(`${r.set}-bike-jump`)) r.spr.play(`${r.set}-bike-jump`)
        }
        if (r.air) {
          r.vy += G * dt
          r.y += r.vy * dt
          if (r.y >= ROAD_Y) {
            r.y = ROAD_Y
            r.vy = 0
            r.air = false
            SFX.land()
            if (this.anims.exists(`${r.set}-bike-ride`)) r.spr.play(`${r.set}-bike-ride`)
          }
        }
      }
      const hurt = now < r.hurtUntil
      r.spr.setPosition(r.x, Math.round(r.y)).setAlpha(hurt && Math.floor(now / 80) % 2 ? 0.4 : 1)
      r.spr.setAngle(hurt ? Math.sin(now / 40) * 6 : r.air ? -6 : 0)
      r.spr.anims.timeScale = this.speedMul
      r.shadow.setPosition(r.x, Math.round(r.y) + 2).setScale(1.2 * (1 - Math.min(0.6, (ROAD_Y - r.y) / 150)))
    }

    // Course objects: screen x = rider line + (course distance − travelled).
    for (const o of this.objs) {
      if (o.done) continue
      const sx = 200 + (o.x - this.dist) + (o.kind === 'swarm' ? -(this.time.now % 100000) * 0 : 0)
      if (sx > 700) continue
      if (sx < -80) {
        o.done = true
        o.spr.destroy()
        o.warn?.destroy()
        continue
      }
      o.spr.setVisible(true).setX(sx)
      if (o.kind === 'swarm') o.spr.setY(o.y + Math.sin(now / 160 + o.x) * 4)
      // 追籠車：障礙預警 0.8 秒（橘閃 + 車線影子）
      if (this.chase && o.lane !== undefined && (o.kind === 'debris' || o.kind === 'box' || o.kind === 'trash' || o.kind === 'cart')) {
        const leadX = this.riders[0]?.x ?? 160
        const eta = (sx - leadX) / Math.max(1, v)
        if (eta > 0 && eta <= WARN_S) {
          o.spr.setTint(0xffaa66)
          if (o.warn) {
            o.warn.setAlpha(0.35 + 0.35 * Math.sin(now / 80))
            o.warn.setPosition(leadX + 40, this.laneY(o.lane) + 2)
          }
        } else {
          o.spr.clearTint()
          o.warn?.setAlpha(0)
        }
      }
      for (const r of this.riders) this.collide(r, o, sx)
    }

    if (this.dist >= this.courseLength()) this.finish(false)
  }

  /** Streaks along the road edge so the speed is felt, not just counted. */
  private drawSpeedLines(boost: number) {
    const want = Math.round(boost * 7)
    while (this.speedLines.length < want) {
      const y = Phaser.Math.Between(120, ROAD_Y - 10)
      const line = this.add.rectangle(Phaser.Math.Between(0, 640), y, Phaser.Math.Between(20, 60), 2, 0xfff0d0, 0.5).setOrigin(0, 0.5).setDepth(49)
      this.speedLines.push(line)
    }
    while (this.speedLines.length > want) this.speedLines.pop()?.destroy()
    for (const l of this.speedLines) {
      l.x -= 14 + boost * 22
      if (l.x < -70) {
        l.x = 660
        l.y = Phaser.Math.Between(120, ROAD_Y - 10)
      }
    }
  }

  private collide(r: Rider, o: Obj, sx: number) {
    if (o.done) return
    const dx = Math.abs(sx - r.x)
    const feet = r.y
    const now = this.time.now
    switch (o.kind) {
      case 'coin':
        if (dx < 18 && feet - 60 < o.y && feet > o.y - 34) {
          o.done = true
          o.spr.destroy()
          o.warn?.destroy()
          const got = Math.max(1, Math.round(this.mult))
          this.coins += got
          this.coinText.setText(`◎ ${this.coins}`)
          SFX.coin()
          if (got > 1) this.floatAt(o.spr.x, o.y - 30, `×${got}`, '#ffd040')
        }
        break
      case 'ramp':
        if (dx < 14 && !r.air) {
          r.vy = -640
          r.air = true
          SFX.powerUp()
          if (this.anims.exists(`${r.set}-bike-jump`)) r.spr.play(`${r.set}-bike-jump`)
        }
        break
      case 'puddle':
        if (dx < 12 && !r.air && now > this.slowUntil) {
          this.slowUntil = now + 900
          SFX.gulp()
          this.floatAt(r.x, r.y - 70, '黐住！', '#ffcc44')
        }
        break
      case 'swarm':
        // Flies at jump height: being in the air under it gets you stung.
        if (dx < 22 && feet < ROAD_Y - 26 && now > r.hurtUntil) this.crash(r, '叮！')
        break
      case 'debris':
      case 'box':
      case 'trash':
      case 'cart':
        // Chase junk: same-lane hit only; slow only (never HP). 2P shared lane → same as 1P.
        if (this.chase && o.lane !== undefined && r.lane !== o.lane) break
        if (dx < 20 && feet > (o.lane !== undefined ? this.laneY(o.lane) : ROAD_Y) - 22 && now > r.hurtUntil) {
          if (this.chase && !o.hitLogged) {
            o.hitLogged = true
            this.chaseJunkHit++
          }
          this.crash(r, '撞到！')
        }
        break
      default:
        if (dx < 16 && feet > ROAD_Y - 18 && now > r.hurtUntil) this.crash(r, '撞到！')
    }
  }

  private crash(r: Rider, msg: string) {
    // Crashing costs the speed you built up — that is the whole tension of mashing.
    this.mash = 0
    this.mult = 1
    r.hurtUntil = this.time.now + 1100
    this.crashes++
    this.slowUntil = this.time.now + 600
    SFX.hurt()
    this.cameras.main.shake(160, 0.006)
    this.floatAt(r.x, r.y - 70, msg, '#ff8a6a')
  }

  private floatAt(x: number, y: number, s: string, color: string) {
    const t = this.add
      .text(x, y, s, { fontFamily: FONT_UI, fontSize: '12px', color, stroke: '#1a0e06', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(60)
    this.tweens.add({ targets: t, y: y - 20, alpha: 0, duration: 700, onComplete: () => t.destroy() })
  }

  private finish(skipped: boolean) {
    if (this.finished) return
    this.finished = true
    const total = Math.max(1, this.chaseJunkTotal || CHASE_OBS.reduce((a, b) => a + b, 0))
    const good = skipped ? 0 : Math.max(0, total - this.chaseJunkHit)
    const graded = this.chase ? gradeResult(good, total, 'reaction', skipped, 'cage-chase') : null
    // Coins collected become extra continues for 蜜樹丘.
    const carry = ((this.registry.get('carryCoins') as number | undefined) ?? 5) + this.coins
    this.registry.set('carryCoins', carry)
    saveTransitionCoins(this.toStage, carry)
    this.registry.set('stageNo', this.toStage)
    const W = GAME_W
    const goPlay = () => {
      this.cameras.main.fadeOut(500, 0, 0, 0)
      this.time.delayedCall(550, () => this.scene.start('play'))
    }
    if (graded) {
      // 2P：共用進度，任一架到終點即成功（略過除外）。
      if (!skipped) SFX.win()
      void showGradeResult(this, graded, { title: '追籠車' }).then(goPlay)
      return
    }
    if (!skipped) {
      SFX.win()
      const box = this.add.container(W / 2, 150).setDepth(70)
      const bg = this.add.graphics()
      bg.fillStyle(0xc8902a, 1).fillRect(-132, -40, 264, 80)
      bg.fillStyle(0x1c120c, 0.96).fillRect(-130, -38, 260, 76)
      const arrive = `到咗${this.destName()}！`
      const a = this.add.text(0, -18, arrive, { fontFamily: FONT_TITLE, fontSize: '18px', color: '#ffd76a' }).setOrigin(0.5)
      const b = this.add
        .text(0, 14, `金幣 ＋${this.coins}　撞到 ${this.crashes} 次${this.crashes === 0 ? '　完美！' : ''}`, {
          fontFamily: FONT_UI,
          fontSize: '12px',
          color: '#ffe9a8',
        })
        .setOrigin(0.5)
      box.add([bg, a, b])
    }
    this.time.delayedCall(skipped ? 100 : 2400, () => this.cameras.main.fadeOut(500, 0, 0, 0))
    this.time.delayedCall(skipped ? 650 : 2950, () => this.scene.start('play'))
  }
}
