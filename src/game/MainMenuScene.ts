import Phaser from 'phaser'
import { unlockAudio, startBgm } from './audio'
import { loadScores } from './score'
import { enablePixelSprite } from './pixelSnap'

type Mode = '1p' | '2p'

/** Title / 1P·2P select — brand-first creek shrine atmosphere */
export class MainMenuScene extends Phaser.Scene {
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
    this.cameras.main.setBackgroundColor('#6a9ec8')
    this.cameras.main.fadeIn(360, 70, 120, 150)
    this.cursor = 0

    this.buildAtmosphere(width, height)
    this.buildBrandHero(width, height)
    this.buildModeSelect(width)
    this.buildFooter(width, height)
    this.wireInput()
    this.refresh()
  }

  /** Full-bleed creek / shrine / honey sky — one composition */
  private buildAtmosphere(width: number, height: number) {
    const g = this.add.graphics().setDepth(0)
    g.fillGradientStyle(0x7ec4e8, 0x7ec4e8, 0xffe2b0, 0xffd090, 1)
    g.fillRect(0, 0, width, height)
    g.fillStyle(0xfff4c8, 0.55)
    g.fillCircle(width * 0.86, 64, 78)
    g.fillStyle(0xffe08a, 1)
    g.fillCircle(width * 0.86, 64, 30)

    if (this.textures.exists('bg-sky')) {
      this.add.tileSprite(width / 2, 120, width, 240, 'bg-sky').setDepth(0).setAlpha(0.45)
    }
    if (this.textures.exists('bg-horizon')) {
      this.add.tileSprite(width / 2, 268, width, 32, 'bg-horizon').setDepth(1).setAlpha(0.5)
    }
    // Sparse discrete landmarks (not tiled mountain / village bands).
    const clouds: Array<[string, number, number, number, boolean?]> = [
      ['lm-cloud-1', width * 0.16, 46, 1.3],
      ['lm-cloud-2', width * 0.48, 34, 1.15, true],
      ['lm-cloud-3', width * 0.78, 52, 1.2],
      ['lm-cloud-1', width * 0.92, 40, 0.95, true],
    ]
    for (const [key, x, y, s, flip] of clouds) {
      if (!this.textures.exists(key)) continue
      const c = this.add.image(x, y, key).setDepth(1).setScale(s).setAlpha(0.88).setFlipX(!!flip)
      this.tweens.add({ targets: c, x: x + 28, duration: 26000, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
    const mounts: Array<[string, number, number, number, boolean?]> = [
      ['lm-mount-2', width * 0.22, 285, 1.5],
      ['lm-mount-1', width * 0.55, 292, 1.3, true],
      ['lm-mount-4', width * 0.82, 300, 1.35],
    ]
    for (const [key, x, y, s, flip] of mounts) {
      if (!this.textures.exists(key)) continue
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(2).setScale(s).setAlpha(0.92).setFlipX(!!flip)
    }

    if (this.textures.exists('water-deep')) {
      const water = this.add.tileSprite(width / 2, height - 64, width, 64, 'water-deep').setDepth(3)
      this.tweens.add({ targets: water, tilePositionX: 64, duration: 6000, repeat: -1 })
    }
    if (this.textures.exists('water-foam')) {
      this.add.tileSprite(width / 2, height - 96, width, 16, 'water-foam').setDepth(4).setAlpha(0.9)
    }

    g.fillStyle(0xc48a48, 1)
    g.fillRect(0, height - 48, width, 48)
    g.fillStyle(0x9a6838, 1)
    for (let x = 0; x < width; x += 36) g.fillRect(x, height - 48, 3, 48)
    g.fillStyle(0xe0b070, 0.45)
    g.fillRect(0, height - 48, width, 5)

    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    if (this.textures.exists('prop-torii')) {
      this.add.image(width / 2, height - 42, shad).setDepth(5).setAlpha(0.6).setScale(2.4, 0.85)
      this.add.image(width / 2, height - 50, 'prop-torii').setOrigin(0.5, 1).setDepth(5).setScale(1.15).setAlpha(0.95)
    }
    if (this.textures.exists('prop-banner')) {
      this.add.image(70, height - 42, shad).setDepth(5).setAlpha(0.5).setScale(0.65, 0.55)
      this.add.image(70, height - 48, 'prop-banner').setOrigin(0.5, 1).setDepth(6).setScale(1.5)
      this.add.image(width - 70, height - 42, shad).setDepth(5).setAlpha(0.5).setScale(0.65, 0.55)
      this.add.image(width - 70, height - 48, 'prop-banner').setOrigin(0.5, 1).setDepth(6).setScale(1.5)
    }
    if (this.textures.exists('prop-lantern3d')) {
      const L = this.add.image(130, height - 48, 'prop-lantern3d').setOrigin(0.5, 1).setDepth(6).setScale(1.6)
      const R = this.add.image(width - 130, height - 48, 'prop-lantern3d').setOrigin(0.5, 1).setDepth(6).setScale(1.6)
      this.add.image(130, height - 42, shad).setDepth(5).setAlpha(0.45).setScale(0.55, 0.5)
      this.add.image(width - 130, height - 42, shad).setDepth(5).setAlpha(0.45).setScale(0.55, 0.5)
      this.tweens.add({ targets: L, angle: { from: -4, to: 4 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      this.tweens.add({ targets: R, angle: { from: 4, to: -4 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }
    if (this.textures.exists('prop-honey-stack')) {
      this.add.image(200, height - 42, shad).setDepth(5).setAlpha(0.5).setScale(0.85, 0.6)
      this.add.image(200, height - 48, 'prop-honey-stack').setOrigin(0.5, 1).setDepth(6).setScale(1.3)
      this.add.image(width - 200, height - 42, shad).setDepth(5).setAlpha(0.5).setScale(0.85, 0.6)
      this.add.image(width - 200, height - 48, 'prop-honey-stack').setOrigin(0.5, 1).setDepth(6).setScale(1.3).setFlipX(true)
    }
    if (this.textures.exists('prop-bridge')) {
      this.add.image(width / 2, height - 38, 'prop-bridge').setDepth(4).setScale(2.4).setAlpha(0.85)
    }

    if (this.textures.exists('ui-noren')) {
      this.add.image(28, 90, 'ui-noren').setDepth(8).setScale(1.25)
      this.add.image(width - 28, 90, 'ui-noren').setDepth(8).setScale(1.25).setFlipX(true)
    }
    if (this.textures.exists('ui-corner')) {
      this.add.image(22, 22, 'ui-corner').setDepth(9).setScale(1.2)
      this.add.image(width - 22, 22, 'ui-corner').setDepth(9).setScale(1.2).setFlipX(true)
    }

    for (let i = 0; i < 8; i++) {
      const sx = 80 + i * 110 + (i % 3) * 20
      const sy = 40 + (i % 4) * 28
      const spark = this.add.circle(sx, sy, 2 + (i % 3), 0xffe08a, 0.55).setDepth(7)
      this.tweens.add({
        targets: spark,
        y: sy - 14,
        alpha: { from: 0.2, to: 0.85 },
        duration: 1600 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
  }

  private buildBrandHero(width: number, height: number) {
    const plaqueKey = this.textures.exists('ui-title-plaque') ? 'ui-title-plaque' : 'ui-scroll'
    const plaque = this.add
      .image(width / 2, 78, plaqueKey)
      .setDepth(10)
      .setScale(plaqueKey === 'ui-title-plaque' ? 1.15 : 1.5)

    const brand = this.add
      .text(width / 2, 68, '鮭鮭熊', {
        fontFamily: 'Mochiy Pop One, Zen Maru Gothic, Noto Sans TC, sans-serif',
        fontSize: '58px',
        color: '#2a1408',
        stroke: '#fff6d0',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(11)

    const sub = this.add
      .text(width / 2, 112, '第一關・溪流小路　｜　奪回春蜜', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '15px',
        color: '#5a3820',
      })
      .setOrigin(0.5)
      .setDepth(11)

    this.tweens.add({
      targets: [plaque, brand],
      y: '+=4',
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })
    this.tweens.add({
      targets: sub,
      alpha: { from: 0.75, to: 1 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    const ly = height - 100
    this.add.image(150, ly + 10, shad).setDepth(6).setAlpha(0.6).setScale(1.6, 0.85)
    enablePixelSprite(this.add.image(150, ly, 'art-salmon').setDepth(7).setScale(2.5))
    this.add.image(270, ly + 8, shad).setDepth(6).setAlpha(0.55).setScale(1.7, 0.85)
    enablePixelSprite(this.add.image(270, ly - 4, 'art-bear').setDepth(7).setScale(2.55))
    this.add.image(width - 150, ly + 8, shad).setDepth(6).setAlpha(0.55).setScale(1.5, 0.85)
    enablePixelSprite(this.add.image(width - 150, ly, 'art-girl').setDepth(7).setScale(2.3))
    if (this.textures.exists('pot3d')) {
      this.add.image(width / 2 + 90, ly + 28, 'pot3d').setDepth(6).setScale(1.7)
    }
  }

  private buildModeSelect(width: number) {
    const items = [
      { mode: '1p' as Mode, text: '１Ｐ　單人（琪寶寶＋噗噗同行）' },
      { mode: '2p' as Mode, text: '２Ｐ　雙人鍵盤同行同行' },
    ]
    this.modes = items.map((i) => i.mode)
    this.panels = []
    this.labels = []
    this.cursorsGfx = []

    items.forEach((item, i) => {
      const y = 168 + i * 68
      const panelKey = this.textures.exists('ui-wood-panel') ? 'ui-wood-panel' : 'ui-scroll'
      const panel = this.add
        .image(width / 2, y, panelKey)
        .setDepth(12)
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
          .setOrigin(0.5)
          .setDepth(13),
      )

      if (this.textures.exists('ui-cursor')) {
        this.cursorsGfx.push(
          this.add.image(width / 2 - 200, y, 'ui-cursor').setDepth(13).setScale(1.6).setVisible(false),
        )
      }
    })
  }

  private buildFooter(width: number, height: number) {
    const scores = loadScores()
    const scoreLines =
      scores.length === 0
        ? '尚無紀錄'
        : scores
            .slice(0, 4)
            .map(
              (s, i) =>
                `${i + 1}. ${s.score}分　${s.timeSec.toFixed(0)}秒　蜜${s.honey}　${s.mode === '1p' ? '單人' : '雙人'}`,
            )
            .join('\n')
    this.add
      .text(width / 2, 308, `★ 高分榜 ★\n${scoreLines}`, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '12px',
        color: '#f7e7c0',
        backgroundColor: '#3a2210cc',
        padding: { x: 14, y: 8 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(12)

    this.add
      .text(
        width / 2,
        height - 28,
        '上下選擇　空白／Enter 開始\n倫寶：ＡＤ左右　ＷＳ換線　ＪＫＵＩ　｜　琪寶寶：←→　↑↓換線　１２４５　｜　噗噗跟線',
        {
          fontFamily: 'Noto Sans TC, sans-serif',
          fontSize: '11px',
          color: '#3a2818',
          align: 'center',
          backgroundColor: '#ffe8b0aa',
          padding: { x: 10, y: 3 },
        },
      )
      .setOrigin(0.5)
      .setDepth(12)
  }

  private wireInput() {
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
