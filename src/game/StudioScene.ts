import Phaser from 'phaser'
import { TouchInput } from './touchInput'
import { FONT_TITLE, FONT_UI } from './ui/fonts'

/**
 * Publisher splash before the title — classic arcade "studio logo" beat,
 * branded ALAN FONG. ~2.6s, any key / tap skips.
 */
export class StudioScene extends Phaser.Scene {
  private leaving = false

  constructor() {
    super('studio')
  }

  create() {
    this.leaving = false
    const { width, height } = this.scale
    const cx = Math.round(width / 2)
    const cy = Math.round(height / 2)
    this.cameras.main.setBackgroundColor('#000000')

    // Name in two layers: deep red drop shadow + warm gold face (pixel font, integer px).
    const style = {
      fontFamily: FONT_TITLE,
      fontSize: '48px',
      color: '#ffd76a',
      stroke: '#3a1408',
      strokeThickness: 4,
    }
    const shadow = this.add
      .text(cx + 3, cy - 6 + 3, 'ALAN FONG', { ...style, color: '#a8281c', stroke: '#a8281c' })
      .setOrigin(0.5)
      .setAlpha(0)
    const name = this.add.text(cx, cy - 6, 'ALAN FONG', style).setOrigin(0.5).setAlpha(0)

    // Thin rule + tagline under the name.
    const b = name.getBounds()
    const rule = this.add.rectangle(cx, cy + 26, Math.round(b.width * 0.8), 2, 0xffd76a).setOrigin(0.5).setScale(0, 1)
    const tag = this.add
      .text(cx, cy + 42, 'PRESENTS', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#f3e6c8',
        letterSpacing: 4,
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5)
      .setAlpha(0)

    // Glint: a white copy of the name flashes once (no mask needed).
    const glint = this.add
      .text(cx, cy - 6, 'ALAN FONG', { ...style, color: '#ffffff', stroke: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)

    this.tweens.add({ targets: [shadow, name], alpha: 1, duration: 420, ease: 'Sine.out' })
    this.tweens.add({ targets: rule, scaleX: 1, duration: 420, delay: 300, ease: 'Sine.out' })
    this.tweens.add({ targets: tag, alpha: 1, duration: 360, delay: 520 })
    this.tweens.add({ targets: glint, alpha: 0.7, duration: 140, delay: 760, yoyo: true, ease: 'Sine.out' })
    this.time.delayedCall(2200, () => this.leave())

    this.input.keyboard?.once('keydown', () => this.leave())
    this.input.once('pointerdown', () => this.leave())
  }

  update() {
    if (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack')) this.leave()
  }

  private leave() {
    if (this.leaving) return
    this.leaving = true
    this.cameras.main.fadeOut(360, 0, 0, 0)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('logo'))
  }
}
