import Phaser from 'phaser'
import { unlockAudio, startBgm } from './audio'

type Mode = '1p' | '2p'

/** Title menu — 1P / 2P */
export class MenuScene extends Phaser.Scene {
  private cursor = 0
  private labels: Phaser.GameObjects.Text[] = []
  private modes: Mode[] = ['1p', '2p']

  constructor() {
    super('menu')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#1e1830')
    this.cameras.main.fadeIn(350, 16, 12, 28)
    this.cursor = 0

    // soft backdrop
    const g = this.add.graphics()
    g.fillStyle(0x4aa3d4, 0.25)
    g.fillRect(0, 0, width, height)
    g.fillStyle(0xffe08a, 0.08)
    g.fillCircle(width * 0.8, 80, 120)

    this.add.image(160, height - 90, 'art-bear').setScale(2.6)
    this.add.image(width - 140, height - 100, 'art-salmon').setScale(2.3)
    this.add.image(230, height - 120, 'art-girl').setScale(2.0)

    this.add
      .text(width / 2, 70, '鮭鮭熊', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '56px',
        color: '#ffe08a',
        stroke: '#2a1a10',
        strokeThickness: 8,
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 130, '第一關・溪流小路　｜　奪回春蜜', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#f3e6c8',
      })
      .setOrigin(0.5)

    const items = [
      { mode: '1p' as Mode, text: '1P　單人（熊女自動同行）' },
      { mode: '2p' as Mode, text: '2P　雙人鍵盤' },
    ]
    this.modes = items.map((i) => i.mode)
    this.labels = items.map((item, i) => {
      const t = this.add
        .text(width / 2, 220 + i * 56, item.text, {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '24px',
          color: '#f3e6c8',
          backgroundColor: '#2a1a10aa',
          padding: { x: 18, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      t.on('pointerover', () => {
        this.cursor = i
        this.refresh()
      })
      t.on('pointerdown', () => this.startMode(item.mode))
      return t
    })

    this.add
      .text(
        width / 2,
        height - 48,
        '↑↓／滑鼠選擇　Enter／點擊開始\nP1 WASD+F　P2 ←→↑+L　｜　R 重來',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '13px',
          color: '#c9b896',
          align: 'center',
        },
      )
      .setOrigin(0.5)

    const kb = this.input.keyboard!
    kb.on('keydown-UP', () => {
      this.cursor = (this.cursor + this.modes.length - 1) % this.modes.length
      this.refresh()
    })
    kb.on('keydown-DOWN', () => {
      this.cursor = (this.cursor + 1) % this.modes.length
      this.refresh()
    })
    kb.on('keydown-ENTER', () => this.startMode(this.modes[this.cursor]!))
    kb.on('keydown-SPACE', () => this.startMode(this.modes[this.cursor]!))
    // unlock audio on menu interact
    kb.once('keydown', () => {
      unlockAudio()
      startBgm()
    })
    this.input.once('pointerdown', () => {
      unlockAudio()
      startBgm()
    })

    this.refresh()
  }

  private refresh() {
    this.labels.forEach((t, i) => {
      const on = i === this.cursor
      t.setStyle({
        color: on ? '#2a1a10' : '#f3e6c8',
        backgroundColor: on ? '#ffe08a' : '#2a1a10aa',
      })
      t.setScale(on ? 1.06 : 1)
    })
  }

  private startMode(mode: Mode) {
    this.registry.set('playMode', mode)
    this.cameras.main.fadeOut(280, 10, 8, 16)
    this.time.delayedCall(280, () => this.scene.start('play'))
  }
}
