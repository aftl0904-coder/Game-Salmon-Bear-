import Phaser from 'phaser'
import { unlockAudio, startBgm } from './audio'
import { loadScores } from './score'

type Mode = '1p' | '2p'

/** Title menu — 1P / 2P + high scores */
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

    const g = this.add.graphics()
    g.fillStyle(0x4aa3d4, 0.25)
    g.fillRect(0, 0, width, height)
    g.fillStyle(0xffe08a, 0.08)
    g.fillCircle(width * 0.8, 80, 120)

    this.add.image(160, height - 90, 'art-bear').setScale(2.8)
    this.add.image(width - 140, height - 100, 'art-salmon').setScale(2.5)
    this.add.image(230, height - 120, 'art-girl').setScale(2.2)

    this.add
      .text(width / 2, 58, '鮭鮭熊', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '56px',
        color: '#ffe08a',
        stroke: '#2a1a10',
        strokeThickness: 8,
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 112, '第一關・溪流小路　｜　奪回春蜜', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#f3e6c8',
      })
      .setOrigin(0.5)

    const items = [
      { mode: '1p' as Mode, text: '１Ｐ　單人（琪寶寶自動同行）' },
      { mode: '2p' as Mode, text: '２Ｐ　雙人鍵盤' },
    ]
    this.modes = items.map((i) => i.mode)
    this.labels = items.map((item, i) => {
      const t = this.add
        .text(width / 2, 168 + i * 52, item.text, {
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

    // high scores board
    const scores = loadScores()
    const scoreLines =
      scores.length === 0
        ? '尚無紀錄'
        : scores
            .slice(0, 5)
            .map(
              (s, i) =>
                `${i + 1}. ${s.score}分　${s.timeSec.toFixed(0)}秒　蜜${s.honey}　${s.mode === '1p' ? '單人' : '雙人'}`,
            )
            .join('\n')
    this.add
      .text(width / 2, 300, `高分榜\n${scoreLines}`, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '13px',
        color: '#f7e7c0',
        backgroundColor: '#1a1020cc',
        padding: { x: 14, y: 8 },
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.add
      .text(
        width / 2,
        height - 40,
        '上下選擇　空白開始\n倫寶：移動＋ＪＫＵＩ射擊　｜　琪寶寶：方向鍵＋數字鍵１２４５',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '12px',
          color: '#c9b896',
          align: 'center',
        },
      )
      .setOrigin(0.5)

    const kb = this.input.keyboard!
    const onUp = () => {
      this.cursor = (this.cursor + this.modes.length - 1) % this.modes.length
      this.refresh()
    }
    const onDown = () => {
      this.cursor = (this.cursor + 1) % this.modes.length
      this.refresh()
    }
    const onStart = () => this.startMode(this.modes[this.cursor]!)
    kb.on('keydown-UP', onUp)
    kb.on('keydown-DOWN', onDown)
    kb.on('keydown-ENTER', onStart)
    kb.on('keydown-SPACE', onStart)
    this.events.once('shutdown', () => {
      kb.off('keydown-UP', onUp)
      kb.off('keydown-DOWN', onDown)
      kb.off('keydown-ENTER', onStart)
      kb.off('keydown-SPACE', onStart)
    })

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
    this.cameras.main.fadeOut(220, 10, 8, 16)
    this.time.delayedCall(220, () => this.scene.start('play'))
  }
}
