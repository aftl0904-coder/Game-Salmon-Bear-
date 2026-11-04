import { RENDER_SCALE } from './display'
import Phaser from 'phaser'
import { playSong, SFX, unlockAudio } from './audio'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import meta from '../../data/anim/map-bike.json'
import { markHd } from './heroAnims'
import versesRaw from '../../data/verses.json'
import { c2Cleared } from './progress'
import { stageTitle } from './stageNames'
import { legsBetween, mapForStage, type ContinentMap, type Leg } from './worldMapData'
import { wrapVerse } from './ui/verseWrap'
import { getRun, iconFor, needsStartChoice, restartWarning, resumeMain, startNewRun, startSideTrip } from './run'

const VERSES = versesRaw as unknown as Record<string, { text: string; ref: string }>
/** How long the verse stays up before the trip starts on its own (any confirm key skips it). */
const VERSE_HOLD_MS = 2600

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

const S = 0.5 // map art is shown at half size (1280×720 → 640×360)

export class MapScene extends Phaser.Scene {
  private data_!: MapData
  private party!: Phaser.GameObjects.Sprite
  private leaving = false
  private walking = false
  private walkTween: Phaser.Tweens.TweenChain | null = null
  /** The continent map this visit shows (null only for the plain title card). */
  private cm!: ContinentMap
  /** Road node the party starts from (0 = the 大陸2 pier). */
  private fromNode = 0
  private bannerBg!: Phaser.GameObjects.Graphics

  /** Stage numbers open for picking (1..max(to,from)), sorted. */
  private openStages: number[] = []
  /** True while waiting for the player to choose a stage before travel starts. */
  private picking = false
  private pickIndex = 1
  private icons: Record<number, Phaser.GameObjects.Image> = {}
  private pickTween: Phaser.Tweens.Tween | null = null
  private bannerLabel!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private versePanel!: Phaser.GameObjects.Container
  private verseBg!: Phaser.GameObjects.Graphics
  private verseText!: Phaser.GameObjects.Text
  /** Set while the verse is showing after a stage was chosen; running it starts the trip. */
  private verseGo: (() => void) | null = null
  /** Set while the plain title card is up (a stage no map knows); running it leaves for the stage. */
  private cardGo: (() => void) | null = null
  private startDialog: { root: Phaser.GameObjects.Container; index: number; labels: Phaser.GameObjects.Text[]; actions: Array<() => void> } | null = null

  constructor() {
    super('worldmap')
  }

  preload() {
    if (!this.textures.exists('map-world')) this.load.image('map-world', '/art/map/world-map.png')
    if (!this.textures.exists('map-icons'))
      this.load.spritesheet('map-icons', '/art/map/icons.png', { frameWidth: meta.icons.frameWidth, frameHeight: meta.icons.frameHeight })
    if (!this.textures.exists('map-walk'))
      this.load.spritesheet('map-walk', '/art/map/walk.png', { frameWidth: meta.walk.frameWidth, frameHeight: meta.walk.frameHeight })
    if (!this.textures.exists('map-c2-dark')) this.load.image('map-c2-dark', '/art/map/c2/world-map-dark.png')
    if (!this.textures.exists('map-c2-green')) this.load.image('map-c2-green', '/art/map/c2/world-map-green.png')
    if (!this.textures.exists('map-icons-c2'))
      this.load.spritesheet('map-icons-c2', '/art/map/c2/icons.png', { frameWidth: meta.c2icons.frameWidth, frameHeight: meta.c2icons.frameHeight })
    if (!this.textures.exists('map-walk-duo'))
      this.load.spritesheet('map-walk-duo', '/art/map/c2/walk-duo.png', { frameWidth: meta.walkDuo.frameWidth, frameHeight: meta.walkDuo.frameHeight })
  }

  create(data: MapData) {
    this.data_ = data
    markHd(this.textures.get('map-icons'), meta.icons.res)
    markHd(this.textures.get('map-walk'), meta.walk.res)
    markHd(this.textures.get('map-icons-c2'), meta.c2icons.res)
    markHd(this.textures.get('map-walk-duo'), meta.walkDuo.res)
    this.leaving = false
    this.walking = false
    this.picking = false
    this.verseGo = null
    this.cardGo = null
    this.startDialog = null
    this.icons = {}
    this.pickTween = null
    const cm = mapForStage(data.to)
    if (!cm) {
      this.showTitleCard(data)
      return
    }
    this.cm = cm
    // 大陸2 is reached by sea: arriving from outside it (or picking its first stage from the menu) starts at the pier.
    const bySea = !!cm.start && (data.from < cm.firstStage || (data.from === data.to && data.to === cm.firstStage))
    this.fromNode = bySea ? 0 : data.from
    const cam = this.cameras.main
    cam.setBackgroundColor('#0a1428')
    cam.setZoom(RENDER_SCALE).setRotation(0)
    cam.centerOn(320, 180)
    cam.fadeIn(500, 0, 0, 0)
    unlockAudio()
    playSong('story')

    const worldKey = cm.tex.worldGreen && c2Cleared() && this.textures.exists(cm.tex.worldGreen) ? cm.tex.worldGreen : cm.tex.world
    if (this.textures.exists(worldKey)) this.add.image(0, 0, worldKey).setOrigin(0).setScale(S)
    if (!this.anims.exists('map-party-walk') && this.textures.exists('map-walk')) {
      this.anims.create({ key: 'map-party-walk', frames: this.anims.generateFrameNumbers('map-walk', { start: 0, end: 3 }), frameRate: 8, repeat: -1 })
    }
    if (!this.anims.exists('map-duo-walk') && this.textures.exists('map-walk-duo')) {
      this.anims.create({ key: 'map-duo-walk', frames: this.anims.generateFrameNumbers('map-walk-duo', { start: 0, end: 3 }), frameRate: 8, repeat: -1 })
    }

    const maxOpen = Math.max(data.to, data.from)
    this.openStages = Object.keys(cm.places)
      .map(Number)
      .filter((i) => i <= maxOpen)
      .sort((a, b) => a - b)
    // Only offer a choice when the caller asked for one (the normal "just cleared a
    // stage" transition) and there's actually more than one open stage to pick from.
    const offerPick = !!data.pick && data.next !== 'credits' && this.openStages.length > 1
    this.pickIndex = data.to

    // Place badges: visited/current lit, later ones dim with a lock.
    for (const [k, p] of Object.entries(cm.places)) {
      const i = Number(k)
      const x = p.x * S
      const y = p.y * S
      const open = i <= maxOpen
      const ring = this.add.circle(x, y - 14, 11, 0x000000, 0.35)
      void ring
      const icon = this.add.image(x, y - 14, cm.tex.icons, i - cm.firstStage).setScale(0.62)
      this.icons[i] = icon
      if (!open) icon.setTint(0x555566).setAlpha(0.8)
      if (!open) this.add.text(x, y - 14, '？', { fontFamily: FONT_UI, fontSize: '10px', color: '#e8e0ff' }).setOrigin(0.5)
      this.add.text(x, y + 1, iconFor(i), { fontFamily: FONT_UI, fontSize: '10px', color: '#ffffff', stroke: '#1a0e06', strokeThickness: 2 }).setOrigin(0.5)
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

    const start = (bySea ? cm.start : cm.places[data.from]) ?? cm.places[data.to]!
    this.party = this.add.sprite(start.x * S, start.y * S + 4, 'map-walk', 0).setOrigin(0.5, 1)
    if (this.anims.exists('map-party-walk')) this.party.play('map-party-walk')

    // Banner (live-updates with the current pick while picking).
    const banner = this.add.container(320, 330).setScrollFactor(0)
    this.bannerBg = this.add.graphics()
    this.bannerLabel = this.add.text(0, 0, '', { fontFamily: FONT_TITLE, fontSize: '14px', color: '#ffd76a' }).setOrigin(0.5)
    banner.add([this.bannerBg, this.bannerLabel])
    this.drawBannerBg()
    this.hint = this.add
      .text(632, 8, '', { fontFamily: FONT_UI, fontSize: '9px', color: '#e8d8b0', backgroundColor: '#00000088', padding: { x: 4, y: 2 } })
      .setOrigin(1, 0)
      .setScrollFactor(0)

    this.verseBg = this.add.graphics()
    this.verseText = this.add
      .text(0, 0, '', { fontFamily: FONT_UI, fontSize: '10px', color: '#fff2d0', align: 'center', lineSpacing: 3 })
      .setOrigin(0.5)
    this.versePanel = this.add.container(320, 50, [this.verseBg, this.verseText]).setScrollFactor(0).setDepth(20)
    this.versePanel.setVisible(false)

    const kb = this.input.keyboard
    const confirm = (e: KeyboardEvent) => { if (!e.repeat) this.startDialog ? this.confirmStartDialog() : this.picking ? this.confirmPick() : this.skip() }
    const left = () => this.startDialog ? this.moveStartDialog(-1) : this.picking && this.movePick(-1)
    const right = () => this.startDialog ? this.moveStartDialog(1) : this.picking && this.movePick(1)
    const up = () => { if (this.startDialog) this.moveStartDialog(-1) }
    const down = () => { if (this.startDialog) this.moveStartDialog(1) }
    kb?.on('keydown-ENTER', confirm)
    kb?.on('keydown-SPACE', confirm)
    kb?.on('keydown-F', confirm)
    kb?.on('keydown-LEFT', left)
    kb?.on('keydown-RIGHT', right)
    kb?.on('keydown-A', left)
    kb?.on('keydown-D', right)
    kb?.on('keydown-UP', up)
    kb?.on('keydown-W', up)
    kb?.on('keydown-DOWN', down)
    kb?.on('keydown-S', down)
    const pointerConfirm = () => {
      // Taps on an interactive badge already call confirmPick via its own handler;
      // this generic pointerdown is for "tap anywhere to confirm/skip" elsewhere.
      if (!this.picking && !this.startDialog) this.skip()
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
      kb?.off('keydown-UP', up)
      kb?.off('keydown-W', up)
      kb?.off('keydown-DOWN', down)
      kb?.off('keydown-S', down)
      this.input.off('pointerdown', pointerConfirm)
    })

    if (offerPick) {
      this.picking = true
      this.updateBanner()
      this.highlightPick()
      this.showVerse(data.to)
    } else {
      this.updateBanner()
      this.travelAfterVerse(data.to)
    }
  }

  /** A stage no map knows: plain black card with the verse and the stage name, then straight into the stage. Never throws. */
  private showTitleCard(data: MapData) {
    const to = data.to
    const cam = this.cameras.main
    cam.setBackgroundColor('#000000')
    cam.setZoom(RENDER_SCALE).setRotation(0)
    cam.centerOn(320, 180)
    cam.fadeIn(400, 0, 0, 0)
    unlockAudio()
    playSong('story')
    this.registry.set('stageNo', to)
    data.stageNo = to

    const v = VERSES[String(to)]
    if (v) {
      const body = wrapVerse(v.text, 22)
      const verseText = this.add
        .text(320, 132, `${body}\n— ${v.ref}`, { fontFamily: FONT_UI, fontSize: '13px', color: '#fff2d0', align: 'center', lineSpacing: 6 })
        .setOrigin(0.5)
        .setScrollFactor(0)
      if (verseText.width > 560) verseText.setScale(560 / verseText.width)
    }
    this.add
      .text(320, 252, stageTitle(to), { fontFamily: FONT_TITLE, fontSize: '22px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 5 })
      .setOrigin(0.5)
      .setScrollFactor(0)
    this.hint = this.add
      .text(632, 8, 'Enter／A　繼續　（輕觸畫面亦可）', { fontFamily: FONT_UI, fontSize: '9px', color: '#e8d8b0', backgroundColor: '#00000088', padding: { x: 4, y: 2 } })
      .setOrigin(1, 0)
      .setScrollFactor(0)

    let done = false
    const go = () => {
      if (done) return
      done = true
      this.cardGo = null
      cam.fadeOut(350, 0, 0, 0)
      this.time.delayedCall(380, () => {
        if (data.next === 'credits') this.scene.start('credits')
        else this.scene.start('play')
      })
    }
    this.cardGo = go
    // A finger still down from the previous screen must not skip the card the instant it appears.
    const armedAt = this.time.now + 500
    const tryGo = () => {
      if (this.time.now >= armedAt) go()
    }
    this.time.delayedCall(VERSE_HOLD_MS + 500, go)
    const kb = this.input.keyboard
    kb?.on('keydown-ENTER', tryGo)
    kb?.on('keydown-SPACE', tryGo)
    kb?.on('keydown-F', tryGo)
    this.input.on('pointerdown', tryGo)
    this.events.once('shutdown', () => {
      kb?.off('keydown-ENTER', tryGo)
      kb?.off('keydown-SPACE', tryGo)
      kb?.off('keydown-F', tryGo)
      this.input.off('pointerdown', tryGo)
      this.cardGo = null
    })
  }

  /** Show the stage's verse for a moment (or until a key), then walk. The finale → credits hop has none. */
  private travelAfterVerse(to: number) {
    if (this.data_.next === 'credits' || !VERSES[String(to)]) {
      this.beginTravel(to)
      return
    }
    this.showVerse(to)
    this.hint.setText('Enter／A　繼續')
    let done = false
    const go = () => {
      if (done) return
      done = true
      this.verseGo = null
      this.hint.setText('Enter／A　略過')
      this.beginTravel(to)
    }
    this.verseGo = go
    this.time.delayedCall(VERSE_HOLD_MS, go)
  }

  private showVerse(stage: number) {
    const v = VERSES[String(stage)]
    if (!v) {
      this.versePanel.setVisible(false)
      return
    }
    const body = wrapVerse(v.text, 24)
    this.verseText.setScale(1)
    this.verseText.setText(`${body}\n— ${v.ref}`)
    if (this.verseText.width > 360) this.verseText.setScale(360 / this.verseText.width)
    const w = Math.max(240, this.verseText.displayWidth + 28)
    const h = this.verseText.displayHeight + 16
    this.verseBg.clear()
    this.verseBg.fillStyle(0xc8902a, 1).fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4)
    this.verseBg.fillStyle(0x1c120c, 0.94).fillRect(-w / 2, -h / 2, w, h)
    this.versePanel.setY(10 + h / 2 + 10)
    this.versePanel.setVisible(true)
  }

  update() {
    if (this.startDialog) {
      if (TouchInput.justPressed('left') || TouchInput.justPressed('up')) this.moveStartDialog(-1)
      if (TouchInput.justPressed('right') || TouchInput.justPressed('down')) this.moveStartDialog(1)
      if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.confirmStartDialog()
      return
    }
    if (this.cardGo) {
      if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.cardGo()
      return
    }
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
    if (this.startDialog || !this.openStages.includes(stage) || stage === this.pickIndex) return
    this.pickIndex = stage
    SFX.blip(520)
    this.updateBanner()
    this.showVerse(stage)
    this.highlightPick()
  }

  private highlightPick() {
    this.pickTween?.stop()
    for (const icon of Object.values(this.icons)) icon.setScale(0.62)
    const icon = this.icons[this.pickIndex]
    if (!icon) return
    this.pickTween = this.tweens.add({ targets: icon, scale: 0.72, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  }

  private placeOf(stage: number) {
    return this.cm.places[stage] ?? this.cm.start ?? Object.values(this.cm.places)[0]!
  }

  /** Banner plate: 244 wide as ever, wider only when a long continent-form name needs it. */
  private drawBannerBg(textWidth = 0) {
    const w = Math.max(244, Math.ceil(textWidth) + 28)
    this.bannerBg.clear()
    this.bannerBg.fillStyle(0xc8902a, 1).fillRect(-w / 2 - 2, -15, w + 4, 30)
    this.bannerBg.fillStyle(0x1c120c, 0.96).fillRect(-w / 2, -13, w, 26)
  }

  private updateBanner() {
    const dest = this.placeOf(this.picking ? this.pickIndex : this.data_.to)
    if (this.picking) {
      this.bannerLabel.setText(`◀ ${iconFor(this.pickIndex)} ${dest.name} ▶`)
      this.hint.setText('←→ 揀關卡　Enter／A 出發')
    } else {
      this.bannerLabel.setText(this.data_.next === 'credits' ? `下一站：${dest.name}` : dest.name)
      this.hint.setText('Enter／A　略過')
    }
    this.drawBannerBg(this.bannerLabel.width)
  }

  /** Lock in the highlighted stage and start the trip there. */
  private confirmPick() {
    if (!this.picking || this.startDialog) return
    const chosen = this.pickIndex
    if (getRun()?.nextStage !== chosen && (chosen === 1 || chosen === 6)) {
      if (needsStartChoice()) this.showStartDialog(chosen)
      else this.beginNewRun(chosen, false)
      return
    }
    if (getRun()?.nextStage === chosen) resumeMain(this.registry)
    else startSideTrip(this.registry)
    this.finishPick(chosen)
  }

  private finishPick(chosen: number) {
    this.picking = false
    this.pickTween?.stop()
    for (const icon of Object.values(this.icons)) icon.setScale(0.62)
    SFX.powerUp()
    const wasDefault = chosen === this.data_.to
    this.data_.to = chosen
    // The stage1→2 bike minigame insert only fires on the expected default path —
    // jumping to a different stage from here skips straight into that stage's "play".
    if (!wasDefault && this.data_.next === 'bike') this.data_.next = 'play'
    this.data_.stageNo = chosen
    this.registry.set('stageNo', chosen)
    this.updateBanner()
    this.travelAfterVerse(chosen)
  }

  private showStartDialog(stage: 1 | 6) {
    const warning = restartWarning(stage)
    const root = this.add.container(0, 0).setScrollFactor(0).setDepth(1000)
    const cover = this.add.rectangle(320, 180, 640, 360, 0x000000, 0.8).setInteractive()
    cover.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e?.stopPropagation?.())
    root.add([cover, this.add.rectangle(320, 180, 360, 190, 0x241810).setStrokeStyle(2, 0xc8902a)])
    root.add(this.add.text(320, 104, '開新局：帶唔帶之前嘅裝備同成長？', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5))
    if (warning) root.add(this.add.text(320, 120, warning, { fontFamily: FONT_UI, fontSize: '11px', color: '#ffba99' }).setOrigin(0.5))
    const actions = [() => this.beginNewRun(stage, true), () => this.beginNewRun(stage, false), () => { this.startDialog?.root.destroy(); this.startDialog = null }]
    const labels = ['⚪ 開新局：帶', '⚪ 開新局：唔帶', '取消'].map((text, i) => {
      const y = 145 + i * 31
      const bg = this.add.rectangle(320, y, 300, 26, 0x4a2a14).setStrokeStyle(1, 0xc8902a).setInteractive({ useHandCursor: true })
      const label = this.add.text(320, y, text, { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5)
      bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); actions[i]?.() })
      root.add([bg, label])
      return label
    })
    this.startDialog = { root, index: actions.length - 1, labels, actions }
    this.drawStartDialog()
  }

  private beginNewRun(stage: 1 | 6, carry: boolean) {
    this.startDialog?.root.destroy()
    this.startDialog = null
    const mode = (this.registry.get('playMode') as '1p' | '2p') ?? '1p'
    const solo = (this.registry.get('soloCast') as 'boy' | 'girl') ?? 'boy'
    if (!startNewRun(stage, carry, mode, solo, this.registry)) return
    if (stage === 1) { this.scene.start('gacha'); return }
    this.finishPick(stage)
  }

  private drawStartDialog() {
    this.startDialog?.labels.forEach((label, i) => label.setColor(i === this.startDialog?.index ? '#ffffff' : '#cdbb9c'))
  }
  private moveStartDialog(dir: number) {
    const d = this.startDialog
    if (!d) return
    d.index = (d.index + dir + d.actions.length) % d.actions.length
    this.drawStartDialog()
  }
  private confirmStartDialog() {
    const d = this.startDialog
    if (d) d.actions[d.index]?.()
  }

  /** Walk the road(s) to `to` if mapped (大陸2 chains places and rides the tower lift), otherwise a short beat, then arrive(). */
  private beginTravel(to: number) {
    const cm = this.cm
    const legs = legsBetween(cm, this.fromNode, to)
    if (!legs.length) {
      this.time.delayedCall(1300, () => this.arrive())
      return
    }
    // Trips into 8 and 9 happen while 噗噗 is away: the duo sheet instead of the trio.
    if (cm.id === 2 && (to === 8 || to === 9) && this.textures.exists('map-walk-duo')) {
      this.party.setTexture('map-walk-duo', 0)
      if (this.anims.exists('map-duo-walk')) this.party.play('map-duo-walk')
    }
    const g = this.add.graphics()
    g.fillStyle(0xfff0c0, 0.9)
    const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = []
    let prev = legs[0]!.kind === 'road' ? legs[0]!.pts[0]! : legs[0]!.from
    const goTo = (x: number, y: number, duration: number, extra: Partial<Phaser.Types.Tweens.TweenBuilderConfig> = {}) => {
      const px = prev[0]
      tweens.push({ targets: this.party, x: x * S, y: y * S + 4, duration, onStart: () => this.party.setFlipX(x < px), ...extra })
      prev = [x, y]
    }
    let car: Phaser.GameObjects.Rectangle | null = null
    for (const leg of legs) {
      if (leg.kind === 'road') {
        this.dotRoad(g, leg.pts)
        for (const [x, y] of leg.pts.slice(1)) goTo(x, y, Math.hypot(x - prev[0], y - prev[1]) * 9)
      } else {
        car = this.drawLift(g, leg, car)
        goTo(leg.base[0], leg.base[1], Math.hypot(leg.base[0] - prev[0], leg.base[1] - prev[1]) * 9)
        const lift = car
        tweens.push({
          targets: this.party,
          x: leg.top[0] * S,
          y: leg.top[1] * S + 4,
          duration: 1500,
          ease: 'Sine.inOut',
          onStart: () => SFX.blip(330),
          onUpdate: () => {
            lift?.setPosition(this.party.x, this.party.y - 5).setVisible(true)
          },
        })
        prev = leg.top
        goTo(leg.to[0], leg.to[1], Math.hypot(leg.to[0] - prev[0], leg.to[1] - prev[1]) * 9)
      }
    }
    this.walking = true
    this.walkTween = this.tweens.chain({ targets: this.party, tweens, onComplete: () => this.arrive() })
  }

  private dotRoad(g: Phaser.GameObjects.Graphics, road: Array<[number, number]>) {
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

  /** A thin rail up the tower's side and the little lift car that rides with the party. */
  private drawLift(g: Phaser.GameObjects.Graphics, leg: Extract<Leg, { kind: 'lift' }>, old: Phaser.GameObjects.Rectangle | null) {
    old?.destroy()
    g.lineStyle(1.5, 0xfff0c0, 0.9)
    g.lineBetween(leg.base[0] * S, leg.base[1] * S, leg.top[0] * S, leg.top[1] * S)
    g.fillStyle(0xfff0c0, 0.9).fillCircle(leg.base[0] * S, leg.base[1] * S, 2).fillCircle(leg.top[0] * S, leg.top[1] * S, 2)
    return this.add.rectangle(leg.base[0] * S, leg.base[1] * S, 12, 14, 0x2a2018, 0.9).setStrokeStyle(1, 0xffd76a).setVisible(false)
  }

  private skip() {
    if (this.verseGo) {
      this.verseGo()
      return
    }
    if (this.walking && this.walkTween) {
      this.walkTween.stop()
      const dest = this.placeOf(this.data_.to)
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
    const dest = this.placeOf(this.data_.to)
    const cam = this.cameras.main
    this.time.delayedCall(700, () => {
      SFX.powerUp()
      cam.pan(dest.x * S, dest.y * S, 1100, 'Sine.easeIn')
      cam.zoomTo(5 * RENDER_SCALE, 1200, 'Cubic.easeIn')
      this.tweens.add({ targets: cam, rotation: 0.9, duration: 1200, ease: 'Cubic.easeIn' })
      this.time.delayedCall(850, () => cam.fadeOut(380, 255, 250, 235))
      this.time.delayedCall(1260, () => this.goNext())
    })
  }

  private goNext() {
    const d = this.data_
    const cam = this.cameras.main
    cam.setRotation(0).setZoom(RENDER_SCALE)
    if (d.stageNo) this.registry.set('stageNo', d.stageNo)
    if (d.next === 'credits') this.scene.start('credits')
    else if (d.next === 'bike') this.scene.start(d.from === 2 && d.to === 3 ? 'claw' : 'bike', { to: d.to })
    else this.scene.start('play')
  }
}
