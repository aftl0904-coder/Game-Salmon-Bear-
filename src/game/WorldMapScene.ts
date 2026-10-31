import Phaser from 'phaser'
import { playSong, SFX, unlockAudio } from './audio'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import meta from '../../data/anim/map-bike.json'

/**
 * SNES world map between stages. The party walks the dotted road from one place to the
 * next, then the camera spins and dives into the destination (Mode-7 style).
 * data: { from, to, next } — next is the scene that runs afterwards. `to` is the
 * suggested/default destination (usually "stage just cleared + 1"). When `pick` is set
 * and more than one stage is unlocked, the player can choose a different open stage
 * before travel starts (Alan: map page auto-advanced straight into the next stage with
 * no choice) — callers that already know exactly where they're going (gacha intro, the
 * finale→credits roll, re-entering a stage already chosen on the main menu) leave it
 * unset so nothing changes for them.
 */
export type MapData = { from: number; to: number; next: 'play' | 'bike' | 'credits'; stageNo?: number; pick?: boolean }

/** Places on the 1280×720 map art (index 1–5). */
const PLACES: Record<number, { x: number; y: number; name: string }> = {
  1: { x: 300, y: 470, name: '第一關・百畝樹林' },
  2: { x: 470, y: 262, name: '第二關・蜜樹丘' },
  3: { x: 720, y: 412, name: '第三關・月影夜市' },
  4: { x: 842, y: 196, name: '第四關・鹽霧工地' },
  5: { x: 1092, y: 160, name: '第五關・△畝大廈' },
}
/** Road waypoints between consecutive places. */
const ROADS: Record<string, Array<[number, number]>> = {
  '1-2': [[300, 470], [380, 452], [440, 405], [500, 352], [484, 302], [470, 262]],
  '2-3': [[470, 262], [484, 302], [510, 345], [580, 336], [650, 326], [704, 380], [720, 412]],
  '3-4': [[720, 412], [760, 380], [790, 330], [800, 280], [820, 236], [842, 196]],
}
const S = 0.5 // map art is shown at half size (1280×720 → 640×360)

export class MapScene extends Phaser.Scene {
  private data_!: MapData
  private party!: Phaser.GameObjects.Sprite
  private leaving = false
  private walking = false
  private walkTween: Phaser.Tweens.TweenChain | null = null

  /** Stage numbers open for picking (1..max(to,from)), sorted. */
  private openStages: number[] = []
  /** True while waiting for the player to choose a stage before travel starts. */
  private picking = false
  private pickIndex = 1
  private icons: Record<number, Phaser.GameObjects.Image> = {}
  private pickTween: Phaser.Tweens.Tween | null = null
  private bannerLabel!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text

  constructor() {
    super('worldmap')
  }

  preload() {
    if (!this.textures.exists('map-world')) this.load.image('map-world', '/art/map/world-map.png')
    if (!this.textures.exists('map-icons'))
      this.load.spritesheet('map-icons', '/art/map/icons.png', { frameWidth: meta.icons.frameWidth, frameHeight: meta.icons.frameHeight })
    if (!this.textures.exists('map-walk'))
      this.load.spritesheet('map-walk', '/art/map/walk.png', { frameWidth: meta.walk.frameWidth, frameHeight: meta.walk.frameHeight })
  }

  create(data: MapData) {
    this.data_ = data
    this.leaving = false
    this.walking = false
    this.picking = false
    this.icons = {}
    this.pickTween = null
    const cam = this.cameras.main
    cam.setBackgroundColor('#0a1428')
    cam.setZoom(1).setRotation(0)
    cam.centerOn(320, 180)
    cam.fadeIn(500, 0, 0, 0)
    unlockAudio()
    playSong('story')

    if (this.textures.exists('map-world')) this.add.image(0, 0, 'map-world').setOrigin(0).setScale(S)
    if (!this.anims.exists('map-party-walk') && this.textures.exists('map-walk')) {
      this.anims.create({ key: 'map-party-walk', frames: this.anims.generateFrameNumbers('map-walk', { start: 0, end: 3 }), frameRate: 8, repeat: -1 })
    }

    const maxOpen = Math.max(data.to, data.from)
    this.openStages = Object.keys(PLACES)
      .map(Number)
      .filter((i) => i <= maxOpen)
      .sort((a, b) => a - b)
    // Only offer a choice when the caller asked for one (the normal "just cleared a
    // stage" transition) and there's actually more than one open stage to pick from.
    const offerPick = !!data.pick && data.next !== 'credits' && this.openStages.length > 1
    this.pickIndex = data.to

    // Place badges: visited/current lit, later ones dim with a lock.
    for (const [k, p] of Object.entries(PLACES)) {
      const i = Number(k)
      const x = p.x * S
      const y = p.y * S
      const open = i <= maxOpen
      const ring = this.add.circle(x, y - 14, 11, 0x000000, 0.35)
      void ring
      const icon = this.add.image(x, y - 14, 'map-icons', i - 1).setScale(0.62)
      this.icons[i] = icon
      if (!open) icon.setTint(0x555566).setAlpha(0.8)
      if (!open) this.add.text(x, y - 14, '？', { fontFamily: FONT_UI, fontSize: '10px', color: '#e8e0ff' }).setOrigin(0.5)
      if (i < data.to || (i === data.to && data.from > data.to)) {
        this.add.text(x + 8, y - 26, '★', { fontFamily: FONT_UI, fontSize: '9px', color: '#ffd76a', stroke: '#1a0e06', strokeThickness: 2 })
      }
      if (offerPick && open) {
        icon.setInteractive({ useHandCursor: true })
        icon.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
          ev?.stopPropagation?.()
          this.selectPick(i)
          this.confirmPick()
        })
      }
    }

    const start = PLACES[data.from] ?? PLACES[1]!
    this.party = this.add.sprite(start.x * S, start.y * S + 4, 'map-walk', 0).setOrigin(0.5, 1)
    if (this.anims.exists('map-party-walk')) this.party.play('map-party-walk')

    // Banner (live-updates with the current pick while picking).
    const banner = this.add.container(320, 330).setScrollFactor(0)
    const bg = this.add.graphics()
    bg.fillStyle(0xc8902a, 1).fillRect(-122, -15, 244, 30)
    bg.fillStyle(0x1c120c, 0.96).fillRect(-120, -13, 240, 26)
    this.bannerLabel = this.add.text(0, 0, '', { fontFamily: FONT_TITLE, fontSize: '14px', color: '#ffd76a' }).setOrigin(0.5)
    banner.add([bg, this.bannerLabel])
    this.hint = this.add
      .text(632, 8, '', { fontFamily: FONT_UI, fontSize: '9px', color: '#e8d8b0', backgroundColor: '#00000088', padding: { x: 4, y: 2 } })
      .setOrigin(1, 0)
      .setScrollFactor(0)

    const kb = this.input.keyboard
    const confirm = () => (this.picking ? this.confirmPick() : this.skip())
    const left = () => this.picking && this.movePick(-1)
    const right = () => this.picking && this.movePick(1)
    kb?.on('keydown-ENTER', confirm)
    kb?.on('keydown-SPACE', confirm)
    kb?.on('keydown-F', confirm)
    kb?.on('keydown-LEFT', left)
    kb?.on('keydown-RIGHT', right)
    kb?.on('keydown-A', left)
    kb?.on('keydown-D', right)
    const pointerConfirm = () => {
      // Taps on an interactive badge already call confirmPick via its own handler;
      // this generic pointerdown is for "tap anywhere to confirm/skip" elsewhere.
      if (!this.picking) this.skip()
    }
    this.input.on('pointerdown', pointerConfirm)
    this.events.once('shutdown', () => {
      kb?.off('keydown-ENTER', confirm)
      kb?.off('keydown-SPACE', confirm)
      kb?.off('keydown-F', confirm)
      kb?.off('keydown-LEFT', left)
      kb?.off('keydown-RIGHT', right)
      kb?.off('keydown-A', left)
      kb?.off('keydown-D', right)
      this.input.off('pointerdown', pointerConfirm)
    })

    if (offerPick) {
      this.picking = true
      this.updateBanner()
      this.highlightPick()
    } else {
      this.updateBanner()
      this.beginTravel(data.to)
    }
  }

  update() {
    if (this.picking) {
      if (TouchInput.justPressed('left')) this.movePick(-1)
      if (TouchInput.justPressed('right')) this.movePick(1)
      if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.confirmPick()
      return
    }
    if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.skip()
  }

  private movePick(dir: 1 | -1) {
    const n = this.openStages.length
    if (n < 2) return
    const idx = this.openStages.indexOf(this.pickIndex)
    const next = this.openStages[((idx < 0 ? 0 : idx) + dir + n) % n]!
    this.selectPick(next)
  }

  private selectPick(stage: number) {
    if (!this.openStages.includes(stage) || stage === this.pickIndex) return
    this.pickIndex = stage
    SFX.blip(520)
    this.updateBanner()
    this.highlightPick()
  }

  private highlightPick() {
    this.pickTween?.stop()
    for (const icon of Object.values(this.icons)) icon.setScale(0.62)
    const icon = this.icons[this.pickIndex]
    if (!icon) return
    this.pickTween = this.tweens.add({ targets: icon, scale: 0.72, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  }

  private updateBanner() {
    const dest = PLACES[this.picking ? this.pickIndex : this.data_.to] ?? PLACES[1]!
    if (this.picking) {
      this.bannerLabel.setText(`◀　${dest.name}　▶`)
      this.hint.setText('←→ 揀關卡　Enter／A 出發')
    } else {
      this.bannerLabel.setText(this.data_.next === 'credits' ? `下一站：${dest.name}` : dest.name)
      this.hint.setText('Enter／A　略過')
    }
  }

  /** Lock in the highlighted stage and start the trip there. */
  private confirmPick() {
    if (!this.picking) return
    this.picking = false
    this.pickTween?.stop()
    for (const icon of Object.values(this.icons)) icon.setScale(0.62)
    SFX.powerUp()
    const chosen = this.pickIndex
    const wasDefault = chosen === this.data_.to
    this.data_.to = chosen
    // The stage1→2 bike minigame insert only fires on the expected default path —
    // jumping to a different stage from here skips straight into that stage's "play".
    if (!wasDefault && this.data_.next === 'bike') this.data_.next = 'play'
    this.data_.stageNo = chosen
    this.registry.set('stageNo', chosen)
    this.updateBanner()
    this.beginTravel(chosen)
  }

  /** Walk the road to `to` if one's mapped, otherwise a short beat, then arrive(). */
  private beginTravel(to: number) {
    const from = this.data_.from
    const road = ROADS[`${from}-${to}`]
    if (road) {
      const g = this.add.graphics()
      g.fillStyle(0xfff0c0, 0.9)
      for (let j = 0; j < road.length - 1; j++) {
        const [ax, ay] = road[j]!
        const [bx, by] = road[j + 1]!
        const d = Math.hypot(bx - ax, by - ay)
        for (let t = 0; t < d; t += 12) {
          const u = t / d
          g.fillCircle((ax + (bx - ax) * u) * S, (ay + (by - ay) * u) * S, 1.2)
        }
      }
      this.walking = true
      this.walkTween = this.tweens.chain({
        targets: this.party,
        tweens: road.slice(1).map(([x, y], j) => {
          const [px] = road[j]!
          return {
            x: x * S,
            y: y * S + 4,
            duration: Math.hypot(x - road[j]![0], y - road[j]![1]) * 9,
            onStart: () => this.party.setFlipX(x < px),
          }
        }),
        onComplete: () => this.arrive(),
      })
    } else {
      this.time.delayedCall(1300, () => this.arrive())
    }
  }

  private skip() {
    if (this.walking && this.walkTween) {
      this.walkTween.stop()
      const dest = PLACES[this.data_.to]!
      this.party.setPosition(dest.x * S, dest.y * S + 4)
      this.arrive()
    } else if (!this.leaving) {
      this.arrive()
    }
  }

  /** Stop, a little hop, then spin-and-dive into the place. */
  private arrive() {
    if (this.leaving) return
    this.leaving = true
    this.walking = false
    this.party.anims.stop()
    SFX.coin()
    this.tweens.add({ targets: this.party, y: this.party.y - 6, duration: 140, yoyo: true })
    const dest = PLACES[this.data_.to]!
    const cam = this.cameras.main
    this.time.delayedCall(700, () => {
      SFX.powerUp()
      cam.pan(dest.x * S, dest.y * S, 1100, 'Sine.easeIn')
      cam.zoomTo(5, 1200, 'Cubic.easeIn')
      this.tweens.add({ targets: cam, rotation: 0.9, duration: 1200, ease: 'Cubic.easeIn' })
      this.time.delayedCall(850, () => cam.fadeOut(380, 255, 250, 235))
      this.time.delayedCall(1260, () => this.goNext())
    })
  }

  private goNext() {
    const d = this.data_
    const cam = this.cameras.main
    cam.setRotation(0).setZoom(1)
    if (d.stageNo) this.registry.set('stageNo', d.stageNo)
    if (d.next === 'credits') this.scene.start('credits')
    else if (d.next === 'bike') this.scene.start('bike')
    else this.scene.start('play')
  }
}
