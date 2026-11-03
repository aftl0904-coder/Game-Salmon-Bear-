import { GAME_W, GAME_H } from './display'
import Phaser from 'phaser'
import { unlockAudio, playSong, SFX } from './audio'
import { mountMuteButton } from './muteButton'
import { loadScores } from './score'
import { c2Cleared, maxStage } from './progress'
import { stageTitle } from './stageNames'
import { markHd, STORY_RES } from './heroAnims'
import { c2Enabled } from './c2Gate'
import { getRun, iconFor, resumeMain, startNewRun, startSideTrip } from './run'

/** Stages that exist so far (picker + progress). */
const LAST_STAGE = 5
/** Highest stage the picker may land on. */
function pickable(): number {
  return c2Enabled() ? 6 : Math.min(maxStage(), LAST_STAGE)
}
import { mountTouchControls } from './TouchControls'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { versionLabel } from './version'

type Mode = '1p' | '2p'
type SoloCast = 'boy' | 'girl'
type CastId = 'boy' | 'girl' | 'bear'
type MenuChoice = { mode: Mode; solo?: SoloCast; text: string; info: string; lit: CastId[] }

/** Where each hero stands in the cover still (art-src/story/cover.png, 640×360). */
const CAST_BOX: Record<CastId, { x: number; y: number; w: number; h: number }> = {
  boy: { x: 136, y: 78, w: 124, h: 248 },
  girl: { x: 256, y: 82, w: 108, h: 246 },
  bear: { x: 390, y: 136, w: 108, h: 188 },
}

const PLAQUE_W = 134
const PLAQUE_H = 20

/**
 * Character select over the cover illustration: the chosen heroes stay lit,
 * the others sink into shadow; three lacquered plaques along the bottom.
 */
export class MainMenuScene extends Phaser.Scene {
  private cursor = 0
  private choices: MenuChoice[] = []
  private plaques: { g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; x: number }[] = []
  private shade: Partial<Record<CastId, Phaser.GameObjects.Image>> = {}
  private info!: Phaser.GameObjects.Text
  private arrows: Phaser.GameObjects.Text[] = []
  private arrowBox!: Phaser.GameObjects.Container
  /** Ignore Enter/Space/click-start until this time — same key that left the previous screen. */
  private inputReadyAt = 0
  private starting = false
  /** Start stage (2 only once stage 1 has been cleared in this browser). */
  private stageSel = 1
  private stageText: Phaser.GameObjects.Text | null = null
  private stageRedrawBox: (() => void) | null = null
  private continentButtons: Array<{ stage: number; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = []
  private startDialog: { root: Phaser.GameObjects.Container; choices: Array<{ label: Phaser.GameObjects.Text; action: () => void }>; selected: number } | null = null
  /** Secret code progress (↑↑↓↓←→←→BA). */
  private code: string[] = []

  constructor() {
    super('menu')
  }

  create() {
    const width = GAME_W
    const height = GAME_H
    this.cameras.main.setBackgroundColor('#000000')
    this.cameras.main.fadeIn(300, 0, 0, 0)
    this.cursor = 0
    this.starting = false
    this.plaques = []
    this.arrows = []
    this.shade = {}
    this.registry.set('leavingToMenu', false)
    this.inputReadyAt = this.time.now + 450
    const savedStage = getRun()?.nextStage
    this.stageSel = savedStage && savedStage <= pickable() ? savedStage : Math.min(maxStage(), LAST_STAGE)
    this.stageText = null
    this.stageRedrawBox = null
    this.continentButtons = []
    this.startDialog = null
    this.code = []

    this.choices = [
      { mode: '1p', solo: 'boy', text: '單人・倫寶', info: '倫寶：遠距離射三文魚子　食金鮭升級散射', lit: ['boy'] },
      { mode: '1p', solo: 'girl', text: '單人・琪寶寶', info: '琪寶寶：近身劍擊三連斬　背上扇可以乘風', lit: ['girl', 'bear'] },
      { mode: '2p', text: '雙人合作', info: '兩個人一齊玩：倫寶（WASD）＋琪寶寶（方向鍵）', lit: ['boy', 'girl', 'bear'] },
    ]

    this.buildBackdrop(width, height)
    this.buildTitle(width)
    this.buildPlaques(width, height)
    this.buildScores(width)
    this.buildStagePicker(width)
    this.buildContinentPicker(width)
    this.buildEndingEntry()
    this.wireInput()
    mountTouchControls(this)
    mountMuteButton(this, 14, 8)
    this.add
      .text(width - 4, height - 4, versionLabel(), {
        fontFamily: FONT_UI,
        fontSize: '7px',
        color: '#9a8a70',
      })
      .setOrigin(1, 1)
      .setAlpha(0.75)
    this.refresh(true)
  }

  update() {
    if (this.startDialog) {
      if (TouchInput.justPressed('up') || TouchInput.justPressed('left')) this.moveStartDialog(-1)
      if (TouchInput.justPressed('down') || TouchInput.justPressed('right')) this.moveStartDialog(1)
      if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.activateStartDialog()
      return
    }
    if (TouchInput.justPressed('up')) this.onUp()
    if (TouchInput.justPressed('down')) this.onDown()
    if (TouchInput.justPressed('left')) this.onLeft()
    if (TouchInput.justPressed('right')) this.onRight()
    const b = TouchInput.justPressed('attack')
    const a = TouchInput.justPressed('jump')
    if (b && this.feedCode('B')) return
    if (a && this.feedCode('A')) return
    if (TouchInput.justPressed('start') || a || b) this.confirmStart()
  }

  private onUp() {
    if (this.startDialog) return this.moveStartDialog(-1)
    this.feedCode('U')
    if (pickable() >= 2) this.toggleStage(-1)
    else this.move(-1)
  }
  private onDown() {
    if (this.startDialog) return this.moveStartDialog(1)
    this.feedCode('D')
    if (pickable() >= 2) this.toggleStage(1)
    else this.move(1)
  }
  private onLeft() {
    if (this.startDialog) return this.moveStartDialog(-1)
    this.feedCode('L')
    this.move(-1)
  }
  private onRight() {
    if (this.startDialog) return this.moveStartDialog(1)
    this.feedCode('R')
    this.move(1)
  }

  /** ↑↑↓↓←→←→BA → 秘技: 金鮭 Lv3 from the start and unlimited 絕招. Returns true when it fires. */
  private feedCode(sym: string): boolean {
    const SEQ = ['U', 'U', 'D', 'D', 'L', 'R', 'L', 'R', 'B', 'A']
    this.code.push(sym)
    if (this.code.length > SEQ.length) this.code.shift()
    if (this.code.join() !== SEQ.join()) return false
    this.code = []
    const on = !this.registry.get('cheat')
    this.registry.set('cheat', on)
    SFX.powerUp()
    SFX.sparkle()
    this.cameras.main.flash(300, 255, 230, 140)
    const t = this.add
      .text(GAME_W / 2, 120, on ? '★ 秘技成功！金鮭滿級・無限絕招 ★' : '秘技已關閉', {
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: '#ffe08a',
        stroke: '#1a0e06',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
    this.tweens.add({ targets: t, y: 108, alpha: 0, delay: 1600, duration: 600, onComplete: () => t.destroy() })
    this.inputReadyAt = this.time.now + 300
    return true
  }

  /** "從 第一關 / 第二關 開始" — only shown once stage 1 has been cleared. */
  private buildStagePicker(width: number) {
    if (pickable() < 2) return
    // Alan: make this read clearly as "continue / load progress" rather than
    // an unlabelled stage-picker a returning player might not recognise as
    // their save. The pill below still works the same way (◀▶ cycles every
    // unlocked stage) — this just names what it is.
    this.add
      .text(width / 2, 94, '── 讀取進度 ──', { fontFamily: FONT_UI, fontSize: '9px', color: '#e8d8b0', stroke: '#1a0e06', strokeThickness: 2 })
      .setOrigin(0.5)
      .setAlpha(0.85)
    // Gold-bordered pill (matches the plaques below) so this reads as a real,
    // clickable control rather than a caption easy to miss.
    const y = 112
    const box = this.add.graphics()
    const label = this.add
      .text(width / 2, y, '', {
        fontFamily: FONT_UI,
        fontSize: '15px',
        color: '#ffe9a8',
        stroke: '#1a0e06',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    const redraw = () => {
      const w = Math.ceil(label.width) + 28
      box.clear()
      box.fillStyle(0x1c120c, 0.92).fillRoundedRect(Math.round(width / 2 - w / 2), y - 12, w, 24, 6)
      box.lineStyle(2, 0xc8902a, 1).strokeRoundedRect(Math.round(width / 2 - w / 2), y - 12, w, 24, 6)
    }
    label.on('pointerdown', () => this.toggleStage(1))
    this.stageText = label
    this.stageRedrawBox = redraw
    // Draws under the text but was created after it — fix the order.
    box.setDepth(label.depth - 1)
    this.drawStage()
    // Briefly pulse on first appearance so a returning player notices there's
    // a stage choice now, not just the character picker.
    this.tweens.add({ targets: [box, label], scale: { from: 1.12, to: 1 }, duration: 260, ease: 'Back.out' })
  }

  private drawStage() {
    const name = stageTitle(this.stageSel)
    const icon = iconFor(this.stageSel)
    this.stageText?.setText(`◀ ${icon} ${icon === '✅' ? '繼續' : '選關'}：${name} ▶`)
    this.stageRedrawBox?.()
    this.drawContinents()
  }

  private toggleStage(dir: 1 | -1) {
    const n = pickable()
    if (n < 2) return
    this.stageSel = ((this.stageSel - 1 + dir + n) % n) + 1
    SFX.blip(520)
    this.drawStage()
  }

  /** C2 remains behind the existing browser-persistent ?c2=1 development gate. */
  private buildContinentPicker(width: number) {
    const available = c2Enabled() ? [1, 6] : [1]
    available.forEach((stage, i) => {
      const x = available.length === 1 ? width / 2 : width / 2 + (i === 0 ? -62 : 62)
      const bg = this.add.rectangle(x, 143, 112, 28, 0x241810, 0.94)
        .setStrokeStyle(2, 0x8a7048).setInteractive({ useHandCursor: true })
      const label = this.add.text(x, 143, stage === 1 ? '1 大陸1' : '2 大陸2', {
        fontFamily: FONT_UI, fontSize: '13px', color: '#ffe9a8', stroke: '#1a0e06', strokeThickness: 2,
      }).setOrigin(0.5)
      bg.on('pointerdown', () => this.chooseContinent(stage))
      this.continentButtons.push({ stage, bg, label })
    })
    this.drawContinents()
  }

  private drawContinents() {
    for (const b of this.continentButtons) {
      const selected = b.stage === 1 ? this.stageSel < 6 : this.stageSel >= 6
      b.bg.setFillStyle(selected ? 0x5a341b : 0x241810, 0.94)
      b.bg.setStrokeStyle(2, selected ? 0xffd76a : 0x8a7048)
      b.label.setColor(selected ? '#fff2d0' : '#cdbb9c')
    }
  }

  private chooseContinent(stage: number) {
    if (this.starting || this.startDialog || this.time.now < this.inputReadyAt || (stage === 6 && !c2Enabled())) return
    this.stageSel = stage
    SFX.blip(520)
    this.drawStage()
  }

  private buildEndingEntry() {
    const unlocked = c2Cleared()
    const x = 96
    const bg = this.add.rectangle(x, 143, 158, 28, unlocked ? 0x4a2a14 : 0x282828, 0.94)
      .setStrokeStyle(2, unlocked ? 0xc8902a : 0x696969)
    const label = this.add.text(x, 143, unlocked ? '重溫快樂結局 [R]' : '重溫快樂結局（鎖住）', {
      fontFamily: FONT_UI, fontSize: '11px', color: unlocked ? '#ffe9a8' : '#aaaaaa', stroke: '#1a0e06', strokeThickness: 2,
    }).setOrigin(0.5)
    if (unlocked) bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openEnding())
    label.setAlpha(unlocked ? 1 : 0.7)
  }

  private openEnding() {
    if (this.starting || this.startDialog || this.time.now < this.inputReadyAt || !c2Cleared()) return
    this.starting = true
    unlockAudio()
    this.scene.start('ending-c2')
  }

  private buildBackdrop(width: number, height: number) {
    if (!this.textures.exists('story-cover')) {
      this.add.rectangle(width / 2, height / 2, width, height, 0x2a3a18)
      return
    }
    this.add.image(width / 2, height / 2, 'story-cover')
    for (const id of Object.keys(CAST_BOX) as CastId[]) {
      const key = `menu-shade-${id}`
      this.bakeShade(key, CAST_BOX[id])
      if (this.textures.exists(key)) this.shade[id] = this.add.image(width / 2, height / 2, key).setAlpha(0)
    }
    // Dark band top (logo) and bottom (plaques) so text stays readable.
    const g = this.add.graphics()
    for (let i = 0; i < 20; i++) {
      g.fillStyle(0x0c0804, 0.6 * (1 - i / 20))
      g.fillRect(0, i * 5, width, 5)
      g.fillStyle(0x0c0804, 0.7 * (1 - i / 20))
      g.fillRect(0, height - (i + 1) * 3, width, 3)
    }
    // Light motes drifting in the sunbeam.
    for (let i = 0; i < 16; i++) {
      const m = this.add.circle(Phaser.Math.Between(140, 500), Phaser.Math.Between(110, 300), 1, 0xfff0b0, 0.8)
      this.tweens.add({
        targets: m,
        y: m.y - Phaser.Math.Between(30, 70),
        alpha: { from: 0, to: 0.9 },
        duration: Phaser.Math.Between(2600, 4200),
        delay: i * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
  }

  /** A full-screen copy of the cover, darkened and desaturated, kept only inside one hero's feathered box. */
  private bakeShade(key: string, box: { x: number; y: number; w: number; h: number }) {
    if (this.textures.exists(key)) return
    const src = this.textures.get('story-cover').getSourceImage() as HTMLImageElement | HTMLCanvasElement
    const W = GAME_W * STORY_RES
    const H = GAME_H * STORY_RES
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    ctx.filter = 'grayscale(0.7) brightness(0.45)'
    ctx.drawImage(src, 0, 0, W, H)
    ctx.filter = 'none'
    const m = document.createElement('canvas')
    m.width = W
    m.height = H
    const mc = m.getContext('2d')!
    mc.filter = `blur(${5 * STORY_RES}px)`
    mc.fillStyle = '#fff'
    mc.beginPath()
    mc.ellipse((box.x + box.w / 2) * STORY_RES, (box.y + box.h / 2) * STORY_RES, (box.w / 2) * STORY_RES, (box.h / 2 + 10) * STORY_RES, 0, 0, Math.PI * 2)
    mc.fill()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(m, 0, 0)
    markHd(this.textures.addCanvas(key, c)!, STORY_RES)
  }

  private buildTitle(width: number) {
    this.add
      .text(width / 2 + 2, 30 + 2, '鮭鮭熊', { fontFamily: FONT_TITLE, fontSize: '34px', color: '#5a1808' })
      .setOrigin(0.5)
    const logo = this.add
      .text(width / 2, 30, '鮭鮭熊', {
        fontFamily: FONT_TITLE,
        fontSize: '34px',
        color: '#ffd76a',
        stroke: '#3a1408',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
    this.tweens.add({ targets: logo, y: 28, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.add
      .text(width / 2, 58, '— 揀角色 —', { fontFamily: FONT_UI, fontSize: '10px', color: '#fff2d0', stroke: '#1a0e06', strokeThickness: 3 })
      .setOrigin(0.5)
    this.info = this.add
      .text(width / 2, 78, '', { fontFamily: FONT_UI, fontSize: '11px', color: '#fff2d0', stroke: '#1a0e06', strokeThickness: 3 })
      .setOrigin(0.5)
  }

  private buildPlaques(width: number, height: number) {
    const y = height - 26
    const gap = 172
    this.choices.forEach((c, i) => {
      const x = width / 2 + (i - 1) * gap
      const g = this.add.graphics()
      const label = this.add
        .text(x, y, c.text, { fontFamily: FONT_UI, fontSize: '12px', color: '#fff', stroke: '#1a0e06', strokeThickness: 2 })
        .setOrigin(0.5)
      const hit = this.add.zone(x, y, PLAQUE_W, PLAQUE_H + 6).setInteractive({ useHandCursor: true })
      hit.on('pointerover', () => {
        if (this.cursor !== i) {
          this.cursor = i
          this.refresh()
        }
      })
      hit.on('pointerdown', () => {
        unlockAudio()
        this.cursor = i
        this.refresh()
        this.confirmStart()
      })
      this.plaques.push({ g, label, x })
    })
    // Bouncing arrows either side of the chosen plaque (children of a box that follows the cursor).
    this.arrowBox = this.add.container(0, y)
    for (const dir of [-1, 1]) {
      // Alan: arrow sat right on top of the plaque text — pushed out further (10 → 17px).
      const a = this.add
        .text(dir * (PLAQUE_W / 2 + 17), 0, dir < 0 ? '▶' : '◀', { fontFamily: FONT_UI, fontSize: '11px', color: '#ffd76a', stroke: '#1a0e06', strokeThickness: 2 })
        .setOrigin(0.5)
      this.arrowBox.add(a)
      this.tweens.add({ targets: a, x: `+=${-dir * 3}`, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      this.arrows.push(a)
    }
    this.add
      .text(width / 2, height - 6, '←→ 揀　Enter／F／手掣 A 開始', { fontFamily: FONT_UI, fontSize: '9px', color: '#e8d8b0' })
      .setOrigin(0.5, 1)
      .setAlpha(0.8)
  }

  private buildScores(width: number) {
    const scores = loadScores()
    if (scores.length === 0) return
    const lines = scores
      .slice(0, 3)
      .map((s, i) => `${i + 1}. ${s.score}分 ${s.timeSec.toFixed(0)}秒 ${s.mode === '1p' ? '單' : '雙'}`)
      .join('\n')
    this.add
      .text(width - 8, 8, `★ 最佳紀錄\n${lines}`, {
        fontFamily: FONT_UI,
        fontSize: '9px',
        color: '#f7e7c0',
        backgroundColor: '#1c120ccc',
        padding: { x: 6, y: 4 },
        align: 'left',
      })
      .setOrigin(1, 0)
  }

  private drawPlaque(i: number, on: boolean) {
    const p = this.plaques[i]
    if (!p) return
    const { g, x } = p
    const y = GAME_H - 26
    const x0 = x - PLAQUE_W / 2
    const y0 = y - PLAQUE_H / 2
    g.clear()
    g.fillStyle(0x000000, 0.35).fillRect(x0 + 2, y0 + 2, PLAQUE_W, PLAQUE_H)
    g.fillStyle(on ? 0xc8902a : 0x5a4020, 1).fillRect(x0 - 1, y0 - 1, PLAQUE_W + 2, PLAQUE_H + 2)
    g.fillStyle(on ? 0x4a2a14 : 0x241810, 1).fillRect(x0, y0, PLAQUE_W, PLAQUE_H)
    g.fillStyle(on ? 0x7a4a24 : 0x34241a, 1).fillRect(x0, y0, PLAQUE_W, 3)
    if (on) {
      g.fillStyle(0xffe08a, 1)
      for (const cx of [x0 + 3, x0 + PLAQUE_W - 5]) g.fillRect(cx, y0 + PLAQUE_H / 2 - 1, 2, 2)
    }
    p.label.setColor(on ? '#ffe9a8' : '#9a8a78')
  }

  private move(d: number) {
    unlockAudio()
    playSong('title')
    this.cursor = (this.cursor + this.choices.length + d) % this.choices.length
    SFX.blip(660)
    this.refresh()
  }

  private wireInput() {
    const kb = this.input.keyboard!
    const onStart = (e: KeyboardEvent) => { if (!e.repeat) this.confirmStart() }
    const map: [string, (e: KeyboardEvent) => void][] = [
      ['keydown-UP', () => this.onUp()],
      ['keydown-W', () => this.onUp()],
      ['keydown-DOWN', () => this.onDown()],
      ['keydown-S', () => this.onDown()],
      ['keydown-LEFT', () => this.onLeft()],
      ['keydown-RIGHT', () => this.onRight()],
      ['keydown-D', () => this.onRight()],
      // A is also "left" (WASD) — but as the last key of the code it fires the secret instead.
      ['keydown-A', () => (this.startDialog ? this.moveStartDialog(-1) : this.feedCode('A') ? undefined : this.move(-1))],
      ['keydown-B', () => void this.feedCode('B')],
      ['keydown-ONE', () => this.chooseContinent(1)],
      ['keydown-TWO', () => this.chooseContinent(6)],
      ['keydown-R', () => this.openEnding()],
      ['keydown-ENTER', onStart],
      ['keydown-SPACE', onStart],
      ['keydown-F', onStart],
      ['keydown-J', onStart],
      ['keydown-ESC', () => this.closeStartDialog()],
    ]
    for (const [ev, fn] of map) kb.on(ev, fn)
    this.events.once('shutdown', () => {
      for (const [ev, fn] of map) kb?.off(ev, fn)
    })
    kb.once('keydown', () => {
      unlockAudio()
      playSong('title')
    })
    this.input.once('pointerdown', () => {
      unlockAudio()
      playSong('title')
    })
  }

  private refresh(instant = false) {
    const choice = this.choices[this.cursor]
    if (!choice) return
    this.plaques.forEach((_, i) => this.drawPlaque(i, i === this.cursor))
    const p = this.plaques[this.cursor]
    if (p) {
      this.arrowBox.setX(p.x)
      this.tweens.add({ targets: p.label, scale: { from: 1.15, to: 1 }, duration: 160, ease: 'Back.out' })
    }
    this.info.setText(choice.info)
    for (const id of Object.keys(CAST_BOX) as CastId[]) {
      const img = this.shade[id]
      if (!img) continue
      const alpha = choice.lit.includes(id) ? 0 : 1
      this.tweens.killTweensOf(img)
      if (instant) img.setAlpha(alpha)
      else this.tweens.add({ targets: img, alpha, duration: 220, ease: 'Sine.out' })
    }
  }

  private confirmStart() {
    if (this.starting) return
    if (this.time.now < this.inputReadyAt) return
    if (this.startDialog) return this.activateStartDialog()
    const choice = this.choices[this.cursor]
    if (!choice) return
    if (this.stageSel === 1 || this.stageSel === 6) {
      this.openStartDialog(choice)
      return
    }
    const current = getRun()
    if (current && current.nextStage === this.stageSel) this.begin(choice, 'continue')
    else this.begin(choice, 'side')
  }

  private openStartDialog(choice: MenuChoice) {
    const stage = this.stageSel as 1 | 6
    const root = this.add.container(0, 0).setDepth(1000)
    const cover = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.75).setInteractive()
    cover.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e?.stopPropagation?.())
    root.add(cover)
    root.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, 360, 190, 0x241810, 0.98).setStrokeStyle(2, 0xc8902a))
    root.add(this.add.text(GAME_W / 2, GAME_H / 2 - 76, '開新局：帶唔帶之前嘅裝備同成長？', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5))
    const items: Array<{ text: string; action: () => void }> = []
    if (getRun()?.nextStage === stage) items.push({ text: '✅ 繼續本局', action: () => this.begin(choice, 'continue') })
    items.push({ text: '⚪ 開新局：帶', action: () => this.begin(choice, 'carry') })
    items.push({ text: '⚪ 開新局：唔帶', action: () => this.begin(choice, 'baseline') })
    items.push({ text: '取消', action: () => this.closeStartDialog() })
    const choices = items.map((item, i) => {
      const y = GAME_H / 2 - 48 + i * 31
      const bg = this.add.rectangle(GAME_W / 2, y, 300, 27, 0x4a2a14, 1).setStrokeStyle(1, 0xc8902a).setInteractive({ useHandCursor: true })
      const label = this.add.text(GAME_W / 2, y, item.text, { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5)
      bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e?.stopPropagation?.()
        this.startDialog!.selected = i
        this.activateStartDialog()
      })
      root.add([bg, label])
      return { label, action: item.action }
    })
    this.startDialog = { root, choices, selected: 0 }
    this.drawStartDialog()
    this.inputReadyAt = this.time.now + 250
  }

  private drawStartDialog() {
    this.startDialog?.choices.forEach((c, i) => c.label.setColor(i === this.startDialog?.selected ? '#ffffff' : '#cdbb9c'))
  }
  private moveStartDialog(dir: number) {
    const d = this.startDialog
    if (!d) return
    d.selected = (d.selected + dir + d.choices.length) % d.choices.length
    SFX.blip(520)
    this.drawStartDialog()
  }
  private activateStartDialog() {
    if (!this.startDialog || this.time.now < this.inputReadyAt) return
    this.startDialog.choices[this.startDialog.selected]?.action()
  }
  private closeStartDialog() {
    if (!this.startDialog) return
    this.startDialog.root.destroy()
    this.startDialog = null
    this.inputReadyAt = this.time.now + 250
  }

  private begin(choice: MenuChoice, path: 'continue' | 'side' | 'carry' | 'baseline') {
    if (this.startDialog) { this.startDialog.root.destroy(); this.startDialog = null }
    this.starting = true
    unlockAudio()
    SFX.powerUp()
    const p = this.plaques[this.cursor]
    if (p) this.tweens.add({ targets: p.label, alpha: 0.2, duration: 70, yoyo: true, repeat: 3 })
    this.registry.set('playMode', choice.mode)
    this.registry.set('soloCast', choice.solo ?? 'boy')
    this.registry.set('stageRound', 1)
    this.registry.set('stageNo', this.stageSel)
    if (path === 'continue') resumeMain(this.registry)
    else if (path === 'side') startSideTrip(this.registry)
    else startNewRun(this.stageSel as 1 | 6, path === 'carry', choice.mode, choice.solo ?? 'boy', this.registry)
    // Only a true new run (starting from stage 1) draws a fresh charm —
    // picking up at a later-cleared stage keeps whatever this run already rolled.
    const next = this.stageSel === 1 && (path !== 'continue' || !getRun()?.charm) ? 'gacha' : 'worldmap'
    this.time.delayedCall(360, () => this.cameras.main.fadeOut(300, 0, 0, 0))
    this.time.delayedCall(680, () =>
      next === 'gacha'
        ? this.scene.start('gacha')
        : this.scene.start('worldmap', { from: this.stageSel, to: this.stageSel, next: 'play' }),
    )
  }
}
