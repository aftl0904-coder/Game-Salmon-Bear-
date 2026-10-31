import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { unlockAudio, playSong, SFX } from './audio'
import { mountTouchControls } from './TouchControls'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { difficultyLabel, difficultyOrder, getDifficulty, setDifficulty, type Difficulty } from './difficulty'

/**
 * New first step before character-select: pick 簡單 / 普通 / 挑戰.
 * A honey-jar icon sits to the left of whichever row is currently selected
 * (Alan: "罐蜜糖喺字眼左邊就代表揀緊"). Enter/Space/F/pad-A confirms → 'menu'.
 */
export class DifficultyScene extends Phaser.Scene {
  private cursor = 0
  private rows: Phaser.GameObjects.Text[] = []
  private jar!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
  private starting = false
  private inputReadyAt = 0
  private readonly order = difficultyOrder()

  constructor() {
    super('difficulty')
  }

  create() {
    const width = GAME_W
    const height = GAME_H
    this.cameras.main.setBackgroundColor('#140c08')
    this.cameras.main.fadeIn(260, 0, 0, 0)
    this.starting = false
    this.inputReadyAt = this.time.now + 350
    this.rows = []

    // Alan: this screen was a flat colour, no art — reuse the cover illustration
    // (same as the menu/logo screens either side of it), darkened so rows stay readable.
    if (this.textures.exists('story-cover')) {
      this.add.image(width / 2, height / 2, 'story-cover')
      const dim = this.add.graphics()
      dim.fillStyle(0x0a0603, 0.6).fillRect(0, 0, width, height)
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x2a3a18)
    }

    const cur = getDifficulty()
    this.cursor = Math.max(0, this.order.indexOf(cur))

    this.add
      .text(width / 2 + 2, 52, '鮭鮭熊', { fontFamily: FONT_TITLE, fontSize: '28px', color: '#5a1808' })
      .setOrigin(0.5)
    this.add
      .text(width / 2, 50, '鮭鮭熊', { fontFamily: FONT_TITLE, fontSize: '28px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 5 })
      .setOrigin(0.5)
    this.add
      .text(width / 2, 86, '— 揀難度 —', { fontFamily: FONT_UI, fontSize: '10px', color: '#fff2d0', stroke: '#1a0e06', strokeThickness: 3 })
      .setOrigin(0.5)

    const rowY0 = height / 2 - 20
    const rowGap = 30
    this.order.forEach((d, i) => {
      const y = rowY0 + i * rowGap
      const t = this.add
        .text(width / 2, y, difficultyLabel(d), { fontFamily: FONT_UI, fontSize: '16px', color: '#9a8a78', stroke: '#1a0e06', strokeThickness: 3 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      t.on('pointerover', () => {
        if (this.cursor !== i) {
          this.cursor = i
          this.refresh()
        }
      })
      t.on('pointerdown', () => {
        unlockAudio()
        this.cursor = i
        this.refresh()
        this.confirm()
      })
      this.rows.push(t)
    })

    const jarKey = this.textures.exists('cs-jar-real') ? 'cs-jar-real' : 'coin'
    this.jar = this.add.image(0, 0, jarKey).setDisplaySize(12, 14)
    this.add
      .text(width / 2, rowY0 + (this.order.length - 1) * rowGap + 44, 'Enter／F／手掣 A 揀定　↑↓ 揀難度', {
        fontFamily: FONT_UI,
        fontSize: '9px',
        color: '#e8d8b0',
      })
      .setOrigin(0.5)
      .setAlpha(0.8)

    this.wireInput()
    mountTouchControls(this)
    this.refresh(true)
  }

  private wireInput() {
    const kb = this.input.keyboard!
    const onConfirm = () => this.confirm()
    const map: [string, () => void][] = [
      ['keydown-UP', () => this.move(-1)],
      ['keydown-W', () => this.move(-1)],
      ['keydown-DOWN', () => this.move(1)],
      ['keydown-S', () => this.move(1)],
      ['keydown-ENTER', onConfirm],
      ['keydown-SPACE', onConfirm],
      ['keydown-F', onConfirm],
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

  update() {
    if (TouchInput.justPressed('up')) this.move(-1)
    if (TouchInput.justPressed('down')) this.move(1)
    if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.confirm()
  }

  private move(d: number) {
    unlockAudio()
    this.cursor = (this.cursor + this.order.length + d) % this.order.length
    SFX.blip(660)
    this.refresh()
  }

  private refresh(instant = false) {
    this.rows.forEach((t, i) => t.setColor(i === this.cursor ? '#ffe9a8' : '#9a8a78').setScale(i === this.cursor ? 1.08 : 1))
    const row = this.rows[this.cursor]
    if (!row) return
    const jarX = row.x - row.width / 2 - 14
    if (instant) this.jar.setPosition(jarX, row.y)
    else this.tweens.add({ targets: this.jar, x: jarX, y: row.y, duration: 140, ease: 'Sine.out' })
  }

  private confirm() {
    if (this.starting) return
    if (this.time.now < this.inputReadyAt) return
    const d: Difficulty = this.order[this.cursor] ?? 'normal'
    this.starting = true
    unlockAudio()
    SFX.powerUp()
    setDifficulty(d)
    this.registry.set('difficulty', d)
    this.time.delayedCall(260, () => this.cameras.main.fadeOut(260, 0, 0, 0))
    this.time.delayedCall(520, () => this.scene.start('menu'))
  }
}
