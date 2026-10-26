import Phaser from 'phaser'
import { playSong, SFX, unlockAudio } from './audio'
import { TouchInput } from './touchInput'
import { mountTouchControls } from './TouchControls'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { animTex, hasAnimSet, type AnimSetId } from './heroAnims'
import { p2Pad, btn as padBtn } from './gamepadBridge'
import meta from '../../data/anim/map-bike.json'

/**
 * 單車追逐 — auto-scrolling ride uphill from 百畝樹林 to 蜜樹丘 (between stage 1 and 2).
 * Jump rocks, logs and cones; ramps launch you; bee swarms fly at jump height (stay low);
 * honey puddles slow you. Coins carry over as continues. No damage — a crash just wobbles.
 */
type Kind = 'rock' | 'log' | 'cone' | 'puddle' | 'ramp' | 'swarm' | 'coin'
type Obj = { kind: Kind; x: number; spr: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; done: boolean; y: number }
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
}

const ROAD_Y = 316
const SPEED = 230
const LENGTH = 9000
const G = 1500
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

export class BikeScene extends Phaser.Scene {
  private riders: Rider[] = []
  private objs: Obj[] = []
  private dist = 0
  private speedMul = 1
  private slowUntil = 0
  private mid!: Phaser.GameObjects.TileSprite
  private road!: Phaser.GameObjects.TileSprite
  private far!: Phaser.GameObjects.Image
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

  constructor() {
    super('bike')
  }

  preload() {
    const L = (k: string, f: string) => !this.textures.exists(k) && this.load.image(k, `/art/bike/${f}.png`)
    L('bike-far', 'far')
    L('bike-mid', 'mid')
    L('bike-road', 'road')
    for (const n of ['rock', 'log', 'cone', 'puddle', 'ramp']) L(`bike-${n}`, n)
    if (!this.textures.exists('bike-swarm'))
      this.load.spritesheet('bike-swarm', '/art/bike/swarm.png', { frameWidth: meta.swarm.frameWidth, frameHeight: meta.swarm.frameHeight })
  }

  create() {
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
    const W = this.scale.width
    this.cameras.main.fadeIn(400, 255, 250, 235)
    unlockAudio()
    playSong('stage1')

    // Far layer stays put (the honey tree is the goal on the horizon); it grows a little as you near it.
    this.far = this.add.image(W / 2, 360, 'bike-far').setOrigin(0.5, 1)
    const mh = this.textures.get('bike-mid').get().height
    this.mid = this.add.tileSprite(0, ROAD_Y + 4 - mh, W, mh, 'bike-mid').setOrigin(0)
    this.road = this.add.tileSprite(0, ROAD_Y - 6, W, 52, 'bike-road').setOrigin(0)
    if (!this.anims.exists('bike-swarm-fly')) {
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
      const spr = this.add.sprite(x, ROAD_Y, ok ? animTex(set) : 'art-salmon').setOrigin(0.5, 1).setScale(set === 'kibobo' ? 1.05 : 1.35)
      if (ok) spr.play(`${set}-bike-ride`)
      const shadow = this.add.ellipse(x, ROAD_Y + 2, 46, 6, 0x1a1008, 0.35)
      this.riders.push({ set, spr, shadow, x, y: ROAD_Y, vy: 0, air: false, hurtUntil: 0, jumpKeys: keys, pedalKeys: pedal })
    }
    if (mode === '2p') {
      add('kibobo', 130, p2, a2)
      add('lunbo', 230, p1, a1)
    } else {
      add(solo === 'girl' ? 'kibobo' : 'lunbo', 190, p1, a1)
    }

    // HUD: progress road to the honey tree + coins.
    const g = this.add.graphics().setDepth(50)
    g.fillStyle(0x1c120c, 0.85).fillRect(170, 8, 300, 14)
    g.fillStyle(0xc8902a, 1).fillRect(176, 14, 288, 2)
    this.add.text(474, 15, '蜜樹丘', { fontFamily: FONT_UI, fontSize: '9px', color: '#ffd76a' }).setOrigin(0, 0.5).setDepth(51)
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
    const title = this.add
      .text(W / 2, 130, '單車追逐！跳過障礙　蜂群要伏低\n狂撳 攻擊鍵 踩快啲，金幣加倍', { fontFamily: FONT_TITLE, fontSize: '16px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(51)
    this.tweens.add({ targets: title, alpha: 0, delay: 2600, duration: 600 })

    // Pre-build the course (positions in course distance; drawn as they come on screen).
    for (const [d, kind] of COURSE) this.spawn(kind, d)

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

  private spawn(kind: Kind, d: number) {
    const key = kind === 'coin' ? 'fxa-coin-spin' : kind === 'swarm' ? 'bike-swarm' : `bike-${kind}`
    if (!this.textures.exists(key)) return
    const y = kind === 'swarm' ? ROAD_Y - 64 : kind === 'coin' ? ROAD_Y - 58 : kind === 'puddle' ? ROAD_Y + 3 : ROAD_Y + 2
    const spr = this.add.sprite(-100, y, key).setOrigin(0.5, 1).setVisible(false)
    if (kind === 'coin' && this.anims.exists('fxa-coin-spin')) spr.play('fxa-coin-spin')
    if (kind === 'swarm') spr.play('bike-swarm-fly')
    this.objs.push({ kind, x: d, spr, done: false, y })
  }

  private skipAll() {
    if (this.finished) return
    this.finish(true)
  }

  update(_t: number, dtMs: number) {
    if (this.finished) return
    if (TouchInput.justPressed('start')) return this.skipAll()
    const dt = Math.min(dtMs, 50) / 1000
    const now = this.time.now
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
    const target = (now < this.slowUntil ? 0.55 : 1) + boost * 0.5
    this.speedMul += (target - this.speedMul) * Math.min(1, dt * 4)
    this.multText.setText(boost > 0.05 ? `踩！ ×${this.mult.toFixed(1)}` : '')
    this.multText.setColor(boost > 0.7 ? '#ffd040' : boost > 0.35 ? '#ff9a3a' : '#c88050')
    this.drawSpeedLines(boost)
    const v = SPEED * this.speedMul
    this.dist += v * dt
    this.far.setScale(1 + Math.min(1, this.dist / LENGTH) * 0.18)
    this.mid.tilePositionX += v * dt * 0.45
    this.road.tilePositionX += v * dt
    this.marker.x = 176 + Math.min(1, this.dist / LENGTH) * 288

    for (const r of this.riders) {
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
      const hurt = now < r.hurtUntil
      r.spr.setPosition(r.x, Math.round(r.y)).setAlpha(hurt && Math.floor(now / 80) % 2 ? 0.4 : 1)
      r.spr.setAngle(hurt ? Math.sin(now / 40) * 6 : r.air ? -6 : 0)
      r.spr.anims.timeScale = this.speedMul
      r.shadow.setPosition(r.x, ROAD_Y + 2).setScale(1.2 * (1 - Math.min(0.6, (ROAD_Y - r.y) / 150)))
    }

    // Course objects: screen x = rider line + (course distance − travelled).
    for (const o of this.objs) {
      if (o.done) continue
      const sx = 200 + (o.x - this.dist) + (o.kind === 'swarm' ? -(this.time.now % 100000) * 0 : 0)
      if (sx > 700) continue
      if (sx < -80) {
        o.done = true
        o.spr.destroy()
        continue
      }
      o.spr.setVisible(true).setX(sx)
      if (o.kind === 'swarm') o.spr.setY(o.y + Math.sin(now / 160 + o.x) * 4)
      for (const r of this.riders) this.collide(r, o, sx)
    }

    if (this.dist >= LENGTH) this.finish(false)
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
    this.finished = true
    // Coins collected become extra continues for 蜜樹丘.
    const carry = ((this.registry.get('carryCoins') as number | undefined) ?? 5) + this.coins
    this.registry.set('carryCoins', carry)
    this.registry.set('stageNo', 2)
    const W = this.scale.width
    if (!skipped) {
      SFX.win()
      const box = this.add.container(W / 2, 150).setDepth(70)
      const bg = this.add.graphics()
      bg.fillStyle(0xc8902a, 1).fillRect(-132, -40, 264, 80)
      bg.fillStyle(0x1c120c, 0.96).fillRect(-130, -38, 260, 76)
      const a = this.add.text(0, -18, '到咗蜜樹丘！', { fontFamily: FONT_TITLE, fontSize: '18px', color: '#ffd76a' }).setOrigin(0.5)
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
