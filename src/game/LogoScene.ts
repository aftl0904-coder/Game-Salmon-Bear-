import Phaser from 'phaser'
import { enableActorSprite } from './pixelSnap'

/** Logo splash — brand-first creek shrine packaging (~5s → menu) */
export class LogoScene extends Phaser.Scene {
  constructor() {
    super('logo')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#5a98c8')
    this.cameras.main.fadeIn(420, 50, 90, 130)

    const g = this.add.graphics()
    g.fillStyle(0x6ab4e0, 1)
    g.fillRect(0, 0, width, height)
    // Pretty wallpaper 貼圖 — no hand-built mountains/clouds
    if (this.textures.exists('bg-wallpaper')) {
      this.add
        .image(width / 2, height * 0.38, 'bg-wallpaper')
        .setDisplaySize(width * 1.08, height * 0.85)
        .setAlpha(0.98)
    }

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

    if (this.textures.exists('water-foam')) {
      this.add.tileSprite(width / 2, height - 118, width, 12, 'water-foam').setAlpha(0.85)
    }

    const shad = this.textures.exists('shad') ? 'shad' : 'shadow-blob'
    const lineupY = height - 150
    this.add.image(width / 2 - 130, lineupY + 12, shad).setAlpha(0.5).setScale(1.4, 0.7)
    // Cast heroes are 2× baked — display ~1.2 equals old 2.4 on raw 72px art.
    enableActorSprite(this.add.image(width / 2 - 130, lineupY, 'art-salmon').setScale(1.2))
    this.add.image(width / 2 + 10, lineupY + 14, shad).setAlpha(0.45).setScale(1.5, 0.7)
    // 噗噗 — Pooh-style honey bear (center, hero of cover lineup)
    enableActorSprite(this.add.image(width / 2 + 10, lineupY + 8, 'art-bear').setScale(2.9))
    this.add.image(width / 2 + 130, lineupY + 10, shad).setAlpha(0.45).setScale(1.3, 0.7)
    // Fan is baked onto art-girl's back — no floating prop.
    enableActorSprite(this.add.image(width / 2 + 130, lineupY, 'art-girl').setScale(1.1))
    if (this.textures.exists('pot3d')) {
      this.add.image(width / 2 - 40, lineupY + 36, 'pot3d').setScale(1.85)
    }
    if (this.textures.exists('prop-banner')) {
      this.add.image(90, height - 108, 'prop-banner').setOrigin(0.5, 1).setScale(1.4)
      this.add.image(width - 90, height - 108, 'prop-banner').setOrigin(0.5, 1).setScale(1.4)
    }
    if (this.textures.exists('prop-lantern3d')) {
      const L = this.add.image(160, height - 108, 'prop-lantern3d').setOrigin(0.5, 1).setScale(1.5)
      this.tweens.add({
        targets: L,
        angle: { from: -5, to: 5 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }

    const plaqueKey = this.textures.exists('ui-title-plaque') ? 'ui-title-plaque' : 'ui-scroll'
    const plaque = this.add
      .image(width / 2, 118, plaqueKey)
      .setScale(plaqueKey === 'ui-title-plaque' ? 1.2 : 1.65)
      .setAlpha(0)

    const logo = this.add
      .text(width / 2, 106, '鮭鮭熊', {
        fontFamily: 'Mochiy Pop One, Zen Maru Gothic, Noto Sans TC, sans-serif',
        fontSize: '68px',
        color: '#2a1408',
        stroke: '#fff4d0',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0)

    const sub = this.add
      .text(width / 2, 160, '百畝樹林野餐　｜　奪回蜂蜜與朋友', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '20px',
        color: '#5a3820',
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.tweens.add({ targets: [plaque, logo], alpha: 1, y: '-=8', duration: 750, ease: 'Sine.out' })
    this.tweens.add({ targets: sub, alpha: 1, delay: 240, duration: 560 })
    this.tweens.add({
      targets: [plaque, logo],
      y: '+=5',
      delay: 800,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    for (let i = 0; i < 6; i++) {
      const spark = this.add.circle(120 + i * 140, 50 + (i % 3) * 20, 2.5, 0xffe08a, 0.5)
      this.tweens.add({
        targets: spark,
        y: '-=12',
        alpha: { from: 0.25, to: 0.9 },
        duration: 1500 + i * 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }

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

    let left = false
    const go = () => {
      if (left) return
      left = true
      this.input?.off('pointerdown', go)
      this.input?.keyboard?.off('keydown', go)
      this.cameras?.main?.fadeOut(280, 40, 28, 16)
      this.time.delayedCall(280, () => {
        if (this.sys.isActive()) this.scene.start('menu')
      })
    }

    this.time.delayedCall(3200, go)
    this.input.once('pointerdown', go)
    this.input.keyboard?.once('keydown', go)
  }
}
