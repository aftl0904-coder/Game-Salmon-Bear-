import Phaser from 'phaser'
import endingData from '../../data/ending-c2.json'
import { GAME_W, GAME_H } from './display'
import { c2Cleared } from './progress'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'

type EndingCard = { id: number; title: string; description: string; image: string | null }
const CARDS: EndingCard[] = endingData

/** Only the C2 epilogue: no stage, boss, credits, or progress mutation. */
export class EndingC2Scene extends Phaser.Scene {
  private index = 0
  private readyAt = 0
  private titleText!: Phaser.GameObjects.Text
  private descText!: Phaser.GameObjects.Text
  private countText!: Phaser.GameObjects.Text
  private image?: Phaser.GameObjects.Image
  private previous?: Phaser.GameObjects.Text
  private next?: Phaser.GameObjects.Text

  constructor() { super('ending-c2') }

  preload() {
    for (const card of CARDS) {
      if (card.image && !this.textures.exists(`ending-c2-${card.id}`)) {
        this.load.image(`ending-c2-${card.id}`, card.image)
      }
    }
  }

  create() {
    if (!c2Cleared()) {
      this.scene.start('menu')
      return
    }
    TouchInput.clearAll()
    this.index = 0
    this.readyAt = this.time.now + 350
    this.cameras.main.setBackgroundColor('#18140e')
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x18140e)
    this.add.rectangle(GAME_W / 2, 165, 492, 220, 0x2b2117).setStrokeStyle(3, 0xc8902a)
    this.add.text(GAME_W / 2, 24, '重溫快樂結局', { fontFamily: FONT_TITLE, fontSize: '22px', color: '#ffd76a' }).setOrigin(0.5)
    this.countText = this.add.text(GAME_W / 2, 45, '', { fontFamily: FONT_UI, fontSize: '11px', color: '#dbc9a2' }).setOrigin(0.5)
    this.titleText = this.add.text(GAME_W / 2, 76, '', { fontFamily: FONT_UI, fontSize: '18px', color: '#ffe9a8' }).setOrigin(0.5)
    this.descText = this.add.text(GAME_W / 2, 158, '', {
      fontFamily: FONT_UI, fontSize: '16px', color: '#fff2d0', align: 'center', wordWrap: { width: 410 }, lineSpacing: 8,
    }).setOrigin(0.5)
    this.previous = this.button(205, 300, '上一張', () => this.move(-1))
    this.next = this.button(435, 300, '下一張', () => this.move(1))
    this.button(GAME_W / 2, 336, '返回選單', () => this.leave(), 128)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') this.move(-1)
      else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ' || event.key.toLowerCase() === 'f') this.move(1)
      else if (event.key === 'Escape' || event.key.toLowerCase() === 'b') this.leave()
    }
    this.input.keyboard?.on('keydown', onKey)
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', onKey)
      TouchInput.clearAll()
    })
    this.showCard()
  }

  update() {
    if (TouchInput.justPressed('left')) this.move(-1)
    if (TouchInput.justPressed('right') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack') || TouchInput.justPressed('start')) this.move(1)
    if (TouchInput.justPressed('menu')) this.leave()
  }

  private button(x: number, y: number, label: string, action: () => void, width = 120) {
    const bg = this.add.rectangle(x, y, width, 28, 0x4a2a14).setStrokeStyle(2, 0xc8902a).setInteractive({ useHandCursor: true })
    const text = this.add.text(x, y, label, { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5)
    bg.on('pointerdown', action)
    return text
  }

  private showCard() {
    const card = CARDS[this.index]!
    this.countText.setText(`${this.index + 1} / ${CARDS.length}`)
    this.titleText.setText(card.title)
    this.image?.destroy()
    this.image = undefined
    const imageKey = `ending-c2-${card.id}`
    if (card.image && this.textures.exists(imageKey)) {
      this.image = this.add.image(GAME_W / 2, 182, imageKey).setDisplaySize(300, 169)
      this.descText.setText('')
    } else {
      this.descText.setText(`圖片待補\n\n${card.description}`)
    }
    this.previous?.setAlpha(this.index === 0 ? 0.4 : 1)
    this.next?.setText(this.index === CARDS.length - 1 ? '完成' : '下一張')
  }

  private move(delta: number) {
    if (this.time.now < this.readyAt) return
    if (delta > 0 && this.index === CARDS.length - 1) return this.leave()
    this.index = Phaser.Math.Clamp(this.index + delta, 0, CARDS.length - 1)
    this.showCard()
  }

  private leave() {
    if (this.time.now < this.readyAt) return
    this.scene.start('menu')
  }
}
