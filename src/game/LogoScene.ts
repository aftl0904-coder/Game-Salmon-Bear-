import Phaser from 'phaser'
import { TouchInput } from './touchInput'
import { unlockAudio } from './audio'
import { enableActorSprite } from './pixelSnap'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { animTex, hasAnimSet } from './heroAnims'

/** Splash lineup: Cursor's painted sprite when it's loaded, else the old placeholder. */
function castTex(scene: Phaser.Scene, set: 'lunbo' | 'kibobo' | 'pupu', fallback: string) {
  return hasAnimSet(scene, set) ? animTex(set) : fallback
}

/** Logo splash — brand-first creek shrine packaging (~5s → menu) */
export class LogoScene extends Phaser.Scene {
  /** Controllers send no key/pointer events: poll the virtual pad and call the current exit. */
  private padGo: (() => void) | null = null

  update() {
    if (this.padGo && (TouchInput.justPressed('start') || TouchInput.justPressed('jump') || TouchInput.justPressed('attack'))) {
      unlockAudio()
      this.padGo()
    }
  }
  constructor() {
    super('logo')
  }

  create() {
    if (this.textures.exists('story-cover')) return this.createCover()
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#5a98c8')
    this.cameras.main.fadeIn(420, 50, 90, 130)

    const g = this.add.graphics()
    g.fillStyle(0x6ab4e0, 1)
    g.fillRect(0, 0, width, height)
    // Far upper wallpaper — warm fog, no blue veil
    if (this.textures.exists('bg-wallpaper')) {
      this.add
        .image(width / 2, height * 0.28, 'bg-wallpaper')
        .setScale(1)
        .setAlpha(0.7)
    }

    if (this.textures.exists('ui-noren')) {
      this.add.image(36, 120, 'ui-noren').setScale(1)
      this.add.image(width - 36, 120, 'ui-noren').setScale(1).setFlipX(true)
    }
    if (this.textures.exists('ui-corner')) {
      this.add.image(28, 28, 'ui-corner').setScale(1)
      this.add.image(width - 28, 28, 'ui-corner').setScale(1).setFlipX(true)
      this.add.image(28, height - 28, 'ui-corner').setScale(1).setFlipY(true)
      this.add.image(width - 28, height - 28, 'ui-corner').setScale(1).setFlipX(true).setFlipY(true)
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
    // Cast at bible px heights (hero 48 / pet 40) — slight bump for logo presence.
    const lineupY = Math.round(height * 0.62)
    const gap = 56
    const cx = width / 2
    const boyS = 1
    const girlS = 1
    const bearS = 1
    this.add.image(cx - gap, lineupY + 4, shad).setAlpha(0.45).setScale(1, 1)
    const boySpr = this.add.sprite(cx - gap, lineupY, castTex(this, 'lunbo', 'art-salmon')).setOrigin(0.5, 1).setScale(boyS)
    enableActorSprite(boySpr)
    this.add.image(cx, lineupY + 5, shad).setAlpha(0.4).setScale(1, 1)
    const bearSpr = this.add.sprite(cx, lineupY + 2, castTex(this, 'pupu', 'art-bear')).setOrigin(0.5, 1).setScale(bearS)
    enableActorSprite(bearSpr)
    this.add.image(cx + gap, lineupY + 4, shad).setAlpha(0.4).setScale(1, 1)
    const girlSpr = this.add.sprite(cx + gap, lineupY, castTex(this, 'kibobo', 'art-girl')).setOrigin(0.5, 1).setScale(girlS)
    enableActorSprite(girlSpr)
    if (hasAnimSet(this, 'lunbo')) boySpr.play('lunbo-idle')
    if (hasAnimSet(this, 'pupu')) bearSpr.play('pupu-idle')
    if (hasAnimSet(this, 'kibobo')) girlSpr.play('kibobo-idle')
    if (this.textures.exists('pot3d')) {
      this.add.image(cx - 22, lineupY + 2, 'pot3d').setOrigin(0.5, 1).setScale(1)
    }
    if (this.textures.exists('prop-banner')) {
      this.add.image(70, height - 54, 'prop-banner').setOrigin(0.5, 1).setScale(1)
      this.add.image(width - 70, height - 54, 'prop-banner').setOrigin(0.5, 1).setScale(1)
    }
    if (this.textures.exists('prop-lantern3d')) {
      const L = this.add.image(120, height - 54, 'prop-lantern3d').setOrigin(0.5, 1).setScale(1)
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
      .image(width / 2, 56, plaqueKey)
      .setScale(1)
      .setAlpha(0)

    const logo = this.add
      .text(width / 2, 50, '鮭鮭熊', {
        fontFamily: FONT_TITLE,
        fontSize: '24px',
        color: '#2a1408',
        stroke: '#fff4d0',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0)

    const sub = this.add
      .text(width / 2, 78, '百畝樹林野餐　｜　奪回蜂蜜與朋友', {
        fontFamily: FONT_UI,
        fontSize: '12px',
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
      .text(width / 2, height - 18, '按任意鍵略過', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#3a2818',
        backgroundColor: '#ffe08acc',
        padding: { x: 8, y: 3 },
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
    this.padGo = go
  }

  /** Title over the cover illustration (art-src/story/cover.png). */
  private createCover() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#000000')
    this.cameras.main.fadeIn(600, 0, 0, 0)
    const cover = this.add.image(width / 2, height / 2, 'story-cover')
    // Slow push-in so the still breathes.
    this.tweens.add({ targets: cover, scale: 1.04, duration: 9000, ease: 'Sine.inOut', yoyo: true, repeat: -1 })
    // Dark band on top for the logo.
    const g = this.add.graphics()
    for (let i = 0; i < 24; i++) {
      g.fillStyle(0x0c0804, 0.62 * (1 - i / 24))
      g.fillRect(0, i * 5, width, 5)
    }
    const shadow = this.add
      .text(width / 2 + 3, 46 + 3, '鮭鮭熊', { fontFamily: FONT_TITLE, fontSize: '44px', color: '#5a1808' })
      .setOrigin(0.5)
      .setAlpha(0)
    const logo = this.add
      .text(width / 2, 46, '鮭鮭熊', { fontFamily: FONT_TITLE, fontSize: '44px', color: '#ffd76a', stroke: '#3a1408', strokeThickness: 6 })
      .setOrigin(0.5)
      .setAlpha(0)
    const sub = this.add
      .text(width / 2, 84, '五罐真蜂蜜，救返噗噗', { fontFamily: FONT_UI, fontSize: '13px', color: '#fff2d0', stroke: '#1a0e06', strokeThickness: 3 })
      .setOrigin(0.5)
      .setAlpha(0)
    this.tweens.add({ targets: [logo, shadow], alpha: 1, y: '-=6', duration: 900, ease: 'Sine.out' })
    this.tweens.add({ targets: sub, alpha: 1, delay: 500, duration: 700 })
    // Glint across the logo.
    const glint = this.add
      .text(width / 2, 40, '鮭鮭熊', { fontFamily: FONT_TITLE, fontSize: '44px', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: glint, alpha: 0.6, delay: 1100, duration: 160, yoyo: true })
    // Drifting light motes in the sunbeam.
    for (let i = 0; i < 14; i++) {
      const m = this.add.circle(Phaser.Math.Between(200, 440), Phaser.Math.Between(110, 300), 1, 0xfff0b0, 0.8)
      this.tweens.add({
        targets: m,
        y: m.y - Phaser.Math.Between(30, 70),
        alpha: { from: 0, to: 0.9 },
        duration: Phaser.Math.Between(2600, 4200),
        delay: i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
    const press = this.add
      .text(width / 2, height - 22, '按任意鍵開始', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffe08a', stroke: '#1a0e06', strokeThickness: 3 })
      .setOrigin(0.5)
    this.tweens.add({ targets: press, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 })
    this.add
      .text(width - 8, height - 8, 'ALAN FONG', { fontFamily: FONT_UI, fontSize: '9px', color: '#e8d8b0' })
      .setOrigin(1, 1)
      .setAlpha(0.7)

    let left = false
    const go = () => {
      if (left) return
      left = true
      this.cameras?.main?.fadeOut(320, 0, 0, 0)
      this.time.delayedCall(320, () => {
        if (this.sys.isActive()) this.scene.start('menu')
      })
    }
    // Title waits for the player (no auto-skip); ignore the press that skipped the studio splash.
    this.time.delayedCall(500, () => {
      this.input.once('pointerdown', go)
      this.input.keyboard?.once('keydown', go)
      this.padGo = go
    })
  }
}
