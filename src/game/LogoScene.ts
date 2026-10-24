import Phaser from 'phaser'

/** Big logo splash — ~5 seconds then menu */
export class LogoScene extends Phaser.Scene {
  constructor() {
    super('logo')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#2a1a28')
    this.cameras.main.fadeIn(400, 20, 16, 28)

    // atmosphere
    const g = this.add.graphics()
    g.fillStyle(0x3d6a88, 0.35)
    g.fillEllipse(width / 2, height * 0.7, width * 0.9, 180)
    g.fillStyle(0xe07a4f, 0.15)
    g.fillCircle(width * 0.2, height * 0.25, 90)

    this.add.image(width / 2 - 110, height / 2 + 40, 'art-salmon').setScale(2.2)
    this.add.image(width / 2 + 40, height / 2 + 50, 'art-bear').setScale(2.4)
    this.add.image(width / 2 + 120, height / 2 + 30, 'art-girl').setScale(2.0)
    if (this.textures.exists('prop-honey-pot')) {
      this.add.image(width / 2 - 40, height / 2 + 80, 'prop-honey-pot').setScale(2)
    }
    if (this.textures.exists('prop-fan')) {
      this.add.image(width / 2 + 155, height / 2 + 10, 'prop-fan').setScale(2.2).setAngle(-20)
    }

    const logo = this.add
      .text(width / 2, height / 2 - 100, '鮭鮭熊', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '72px',
        color: '#ffe08a',
        stroke: '#2a1a10',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setAlpha(0)

    const sub = this.add
      .text(width / 2, height / 2 - 40, '鮭之力・蜜之心', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '18px',
        color: '#f3e6c8',
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.tweens.add({ targets: logo, alpha: 1, y: logo.y - 8, duration: 700, ease: 'Sine.out' })
    this.tweens.add({ targets: sub, alpha: 1, delay: 250, duration: 600 })

    const skip = this.add
      .text(width / 2, height - 36, '按任意鍵略過', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '14px',
        color: '#c9b896',
      })
      .setOrigin(0.5)
      .setAlpha(0.7)

    const go = () => {
      this.input.off('pointerdown', go)
      this.input.keyboard?.off('keydown', go)
      this.cameras.main.fadeOut(300, 10, 8, 16)
      this.time.delayedCall(300, () => this.scene.start('menu'))
    }

    this.time.delayedCall(5000, go)
    this.input.once('pointerdown', go)
    this.input.keyboard?.once('keydown', go)

    void skip
  }
}
