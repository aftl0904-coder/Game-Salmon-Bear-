import Phaser from 'phaser'
import { unlockAudio, startBgm } from './audio'
import { loadScores } from './score'

type Mode = '1p' | '2p'

/** Title / 1P·2P select — Goemon SNES player-select packaging */
export class MenuScene extends Phaser.Scene {
  private cursor = 0
  private labels: Phaser.GameObjects.Text[] = []
  private panels: Phaser.GameObjects.Image[] = []
  private cursorsGfx: Phaser.GameObjects.Image[] = []
  private modes: Mode[] = ['1p', '2p']

  constructor() {
    super('menu')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#5aa0d0')
    this.cameras.main.fadeIn(320, 50, 90, 130)
    this.cursor = 0

    const g = this.add.graphics()
    g.fillGradientStyle(0x8ed0f5, 0x8ed0f5, 0xffe8b8, 0xffd8a0, 1)
    g.fillRect(0, 0, width, height)
    g.fillStyle(0xfff3c8, 0.5)
    g.fillCircle(width * 0.82, 70, 70)
    g.fillStyle(0xc48a48, 1)
    g.fillRect(0, height - 130, width, 130)
    g.fillStyle(0x9a6838, 1)
    for (let x = 0; x < width; x += 40) g.fillRect(x, height - 130, 3, 130)

    if (this.textures.exists('ui-noren')) {
      this.add.image(40, 100, 'ui-noren').setScale(1.3)
      this.add.image(width - 40, 100, 'ui-noren').setScale(1.3).setFlipX(true)
    }
    if (this.textures.exists('ui-corner')) {
      this.add.image(24, 24, 'ui-corner').setScale(1.2)
      this.add.image(width - 24, 24, 'ui-corner').setScale(1.2).setFlipX(true)
    }

    const plaqueKey = this.textures.exists('ui-title-plaque') ? 'ui-title-plaque' : 'ui-scroll'
    this.add.image(width / 2, 70, plaqueKey).setScale(plaqueKey === 'ui-title-plaque' ? 0.95 : 1.35)
    this.add
      .text(width / 2, 62, '鮭鮭熊', {
        fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
        fontSize: '48px',
        color: '#2a1810',
        stroke: '#fff6d8',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
    this.add
      .text(width / 2, 102, '第一關・溪流小路　｜　奪回春蜜', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#5a3820',
      })
      .setOrigin(0.5)

    this.add.image(160, height - 95, 'art-salmon').setScale(2.4)
    this.add.image(280, height - 105, 'art-bear').setScale(2.5)
    this.add.image(width - 150, height - 100, 'art-girl').setScale(2.2)
    if (this.textures.exists('prop-torii')) {
      this.add.image(width / 2, height - 95, 'prop-torii').setScale(0.85).setAlpha(0.9)
    }

    const items = [
      { mode: '1p' as Mode, text: '１Ｐ　單人（熊女＋笑臉熊同行）' },
      { mode: '2p' as Mode, text: '２Ｐ　雙人鍵盤同行同行' },
    ]
    this.modes = items.map((i) => i.mode)
    this.panels = []
    this.labels = []
    this.cursorsGfx = []

    items.forEach((item, i) => {
      const y = 168 + i * 72
      const panelKey = this.textures.exists('ui-wood-panel') ? 'ui-wood-panel' : 'ui-scroll'
      const panel = this.add
        .image(width / 2, y, panelKey)
        .setScale(panelKey === 'ui-wood-panel' ? 1.05 : 1.2)
      panel.setInteractive({ useHandCursor: true })
      panel.on('pointerover', () => {
        this.cursor = i
        this.refresh()
      })
      panel.on('pointerdown', () => this.startMode(item.mode))
      this.panels.push(panel)

      this.labels.push(
        this.add
          .text(width / 2, y, item.text, {
            fontFamily: 'Noto Sans TC, sans-serif',
            fontSize: '22px',
            color: '#2a1810',
          })
          .setOrigin(0.5),
      )

      if (this.textures.exists('ui-cursor')) {
        this.cursorsGfx.push(
          this.add.image(width / 2 - 200, y, 'ui-cursor').setScale(1.6).setVisible(false),
        )
      }
    })

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
      .text(width / 2, 320, `★ 高分榜 ★\n${scoreLines}`, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '13px',
        color: '#f7e7c0',
        backgroundColor: '#4a2a18dd',
        padding: { x: 16, y: 10 },
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.add
      .text(
        width / 2,
        height - 36,
        '上下選擇　空白／Enter 開始\n鮭男：ＷＡＳＤ＋ＪＫＵＩ　｜　熊女：方向鍵＋數字鍵１２４５　｜　笑臉熊：ＡＩ跟隨',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '12px',
          color: '#3a2818',
          align: 'center',
          backgroundColor: '#ffe8b0aa',
          padding: { x: 10, y: 4 },
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
      t.setColor(on ? '#1a1008' : '#3a2818')
      t.setScale(on ? 1.05 : 1)
      const panel = this.panels[i]
      if (panel && this.textures.exists('ui-wood-panel')) {
        panel.setTexture(on ? 'ui-wood-panel-on' : 'ui-wood-panel')
      }
      const cur = this.cursorsGfx[i]
      if (cur) cur.setVisible(on)
    })
  }

  private startMode(mode: Mode) {
    this.registry.set('playMode', mode)
    this.cameras.main.fadeOut(220, 40, 28, 16)
    this.time.delayedCall(220, () => this.scene.start('play'))
  }
}
