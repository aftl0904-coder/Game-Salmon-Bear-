import Phaser from 'phaser'
import { playSong, SFX, unlockAudio } from './audio'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import meta from '../../data/anim/map-bike.json'

/**
 * SNES world map between stages. The party walks the dotted road from one place to the
 * next, then the camera spins and dives into the destination (Mode-7 style).
 * data: { from, to, next } — next is the scene that runs afterwards.
 */
export type MapData = { from: number; to: number; next: 'play' | 'bike' | 'credits'; stageNo?: number }

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
}
const S = 0.5 // map art is shown at half size (1280×720 → 640×360)

export class MapScene extends Phaser.Scene {
  private data_!: MapData
  private party!: Phaser.GameObjects.Sprite
  private leaving = false
  private walking = false
  private walkTween: Phaser.Tweens.TweenChain | null = null

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

    // Place badges: visited/current lit, later ones dim with a lock.
    for (const [k, p] of Object.entries(PLACES)) {
      const i = Number(k)
      const x = p.x * S
      const y = p.y * S
      const open = i <= Math.max(data.to, data.from)
      const ring = this.add.circle(x, y - 14, 11, 0x000000, 0.35)
      void ring
      const icon = this.add.image(x, y - 14, 'map-icons', i - 1).setScale(0.62)
      if (!open) icon.setTint(0x555566).setAlpha(0.8)
      if (i === data.to) this.tweens.add({ targets: icon, scale: 0.72, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      if (!open) this.add.text(x, y - 14, '？', { fontFamily: FONT_UI, fontSize: '10px', color: '#e8e0ff' }).setOrigin(0.5)
      if (i < data.to || (i === data.to && data.from > data.to)) {
        this.add.text(x + 8, y - 26, '★', { fontFamily: FONT_UI, fontSize: '9px', color: '#ffd76a', stroke: '#1a0e06', strokeThickness: 2 })
      }
    }
    // Dotted road for the trip.
    const road = ROADS[`${data.from}-${data.to}`]
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
    }

    const start = PLACES[data.from] ?? PLACES[1]!
    this.party = this.add.sprite(start.x * S, start.y * S + 4, 'map-walk', 0).setOrigin(0.5, 1)
    if (this.anims.exists('map-party-walk')) this.party.play('map-party-walk')

    // Banner
    const dest = PLACES[data.to] ?? start
    const banner = this.add.container(320, 330).setScrollFactor(0)
    const bg = this.add.graphics()
    bg.fillStyle(0xc8902a, 1).fillRect(-122, -15, 244, 30)
    bg.fillStyle(0x1c120c, 0.96).fillRect(-120, -13, 240, 26)
    const label = this.add
      .text(0, 0, data.next === 'credits' ? `下一站：${dest.name}` : dest.name, {
        fontFamily: FONT_TITLE,
        fontSize: '14px',
        color: '#ffd76a',
      })
      .setOrigin(0.5)
    banner.add([bg, label])
    const hint = this.add
      .text(632, 8, 'Enter／A　略過', { fontFamily: FONT_UI, fontSize: '9px', color: '#e8d8b0', backgroundColor: '#00000088', padding: { x: 4, y: 2 } })
      .setOrigin(1, 0)
      .setScrollFactor(0)
    void hint

    if (road) {
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

    const kb = this.input.keyboard
    const skip = () => this.skip()
    kb?.on('keydown-ENTER', skip)
    kb?.on('keydown-SPACE', skip)
    kb?.on('keydown-F', skip)
    this.input.on('pointerdown', skip)
    this.events.once('shutdown', () => {
      kb?.off('keydown-ENTER', skip)
      kb?.off('keydown-SPACE', skip)
      kb?.off('keydown-F', skip)
      this.input.off('pointerdown', skip)
    })
  }

  update() {
    if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.skip()
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
