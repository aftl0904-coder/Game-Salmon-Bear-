import Phaser from 'phaser'

/** Logo splash — Goemon packaging plaque + cast lineup (~5s → menu) */
export class LogoScene extends Phaser.Scene {
  constructor() {
    super('logo')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#4a90c8')
    this.cameras.main.fadeIn(400, 40, 80, 120)

    const g = this.add.graphics()
    g.fillGradientStyle(0x7ec8f0, 0x7ec8f0, 0xffe6b0, 0xffd090, 1)
    g.fillRect(0, 0, width, height)
    g.fillStyle(0xfff0c0, 0.55)
    g.fillCircle(width * 0.18, 70, 56)
    g.fillStyle(0xffe08a, 1)
    g.fillCircle(width * 0.18, 70, 28)
    g.fillStyle(0x6ab070, 0.55)
    g.fillEllipse(width * 0.3, height * 0.72, 420, 120)
    g.fillStyle(0x4e9860, 0.5)
    g.fillEllipse(width * 0.75, height * 0.74, 380, 110)

    if (this.textures.exists('ui-noren')) {
      this.add.image(36, 120, 'ui-noren').setScale(1.4)
      this.add.image(width - 36, 120, 'ui-noren').setScale(1.4).setFlipX(true)
    }
    if (this.textures.exists('ui-corner')) {
      this.add.image(28, 28, 'ui-corner').setScale(1.4)
      this.add.image(width - 28, 28, 'ui-corner').setScale(1.4).setFlipX(true)
      this.add.image(28, height - 28, 'ui-corner').setScale(1.4).setFlipY(true)
      this.add.image(width - 28, height - 28, 'ui-corner').setScale(1.4).setFlipX(true).setFlipY(true)
    }

    g.fillStyle(0xc48a48, 1)
    g.fillRect(0, height - 110, width, 110)
    g.fillStyle(0xa06a30, 1)
    for (let x = 0; x < width; x += 48) g.fillRect(x, height - 110, 4, 110)
    g.fillStyle(0xe0b070, 0.5)
    g.fillRect(0, height - 110, width, 6)

    const lineupY = height - 150
    this.add.image(width / 2 - 130, lineupY, 'art-salmon').setScale(2.35)
    this.add.image(width / 2 + 10, lineupY + 8, 'art-bear').setScale(2.5)
    this.add.image(width / 2 + 130, lineupY, 'art-girl').setScale(2.15)
    if (this.textures.exists('fan3d')) {
      this.add.image(width / 2 + 170, lineupY - 20, 'fan3d').setScale(2.2).setAngle(-18)
    }
    if (this.textures.exists('pot3d')) {
      this.add.image(width / 2 - 40, lineupY + 36, 'pot3d').setScale(1.8)
    }

    const plaqueKey = this.textures.exists('ui-title-plaque') ? 'ui-title-plaque' : 'ui-scroll'
    const plaque = this.add
      .image(width / 2, 118, plaqueKey)
      .setScale(plaqueKey === 'ui-title-plaque' ? 1.15 : 1.6)
      .setAlpha(0)

    const logo = this.add
      .text(width / 2, 108, '鮭鮭熊', {
        fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
        fontSize: '64px',
        color: '#2a1810',
        stroke: '#fff4d0',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0)

    const sub = this.add
      .text(width / 2, 158, '鮭之力・蜜之心', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '18px',
        color: '#5a3820',
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.tweens.add({ targets: [plaque, logo], alpha: 1, y: '-=6', duration: 700, ease: 'Sine.out' })
    this.tweens.add({ targets: sub, alpha: 1, delay: 220, duration: 550 })

    this.add
      .text(width / 2, height - 28, '按任意鍵略過', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#3a2818',
        backgroundColor: '#ffe08acc',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setAlpha(0.85)

    const go = () => {
      this.input.off('pointerdown', go)
      this.input.keyboard?.off('keydown', go)
      this.cameras.main.fadeOut(280, 40, 28, 16)
      this.time.delayedCall(280, () => this.scene.start('menu'))
    }

    this.time.delayedCall(5000, go)
    this.input.once('pointerdown', go)
    this.input.keyboard?.once('keydown', go)
  }
}
