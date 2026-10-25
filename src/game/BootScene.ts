import Phaser from 'phaser'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { registerHoneyArt } from './honeyArt'
import { registerIsoArt } from './isoArt'
import { registerUiArt } from './uiArt'
import { preloadRound1Map } from './levelMap'
import {
  bakeSmoothActorTexture,
  hardenTextureAlpha,
  sealTextureSeamsX,
  thickenSpriteOutline,
  softAaSameSize,
  registerWalkCycle,
  registerIdleBreath,
  registerEnemyCombatFrames,
  stampFanOntoGirl,
  stampCasualClothes,
  setActorLinearFilter,
  WALK_FRAMES,
} from './pixelSnap'


/** Boot — asset preload + stage config into registry, then logo splash. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#3a2818')

    const g = this.add.graphics()
    g.fillGradientStyle(0x4a88b0, 0x4a88b0, 0x3a2818, 0x2a1810, 1)
    g.fillRect(0, 0, width, height)
    g.fillStyle(0xe8b86a, 0.16)
    g.fillCircle(width * 0.85, 60, 140)
    g.fillStyle(0xe07a4f, 0.1)
    g.fillCircle(width * 0.12, height - 50, 90)

    this.add
      .text(width / 2, height / 2 - 48, '鮭鮭熊', {
        fontFamily: 'Mochiy Pop One, Zen Maru Gothic, Noto Sans TC, sans-serif',
        fontSize: '48px',
        color: '#ffe08a',
        stroke: '#3a2010',
        strokeThickness: 8,
      })
      .setOrigin(0.5)

    const barBg = this.add.rectangle(width / 2, height / 2 + 28, 340, 22, 0x6a4228)
    barBg.setStrokeStyle(3, 0xe0b86a)
    const bar = this.add
      .rectangle(width / 2 - 166, height / 2 + 28, 4, 14, 0xe07a4f)
      .setOrigin(0, 0.5)
    this.add
      .text(width / 2, height / 2 + 72, '讀取中…　請稍候', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '15px',
        color: '#f3e6c8',
      })
      .setOrigin(0.5)

    this.load.on('progress', (p: number) => {
      bar.width = Math.max(4, 332 * p)
    })

    // Single-frame hero/enemy art (not spritesheets). Wrong frameWidth/Height
    // would waist-cut 琪寶寶 — keep as full-image textures.
    this.load.image('art-salmon', '/art/salmon-boy.png')
    this.load.image('art-girl', '/art/bear-girl.png')
    this.load.image('art-bear', '/art/kind-bear.png')
    this.load.image('art-enemy', '/art/fish-enemy.png')
    // Pretty wallpaper 貼圖 — Flash/phone look without hand-building mountains
    this.load.image('bg-wallpaper', '/art/bg-wallpaper.jpg')
    this.load.image('bg-sky-wallpaper', '/art/bg-sky-wallpaper.jpg')
    preloadRound1Map(this)
  }

  create() {
    registerTiles(this)
    registerWorldArt(this)
    registerHoneyArt(this)
    registerIsoArt(this)
    registerUiArt(this)
    this.bakeCastTextures()
    this.thickenPropOutlines()
    this.hardenSeamTiles()

    this.registry.set('gameConfig', {
      round: 1,
      stageId: 'creek-path',
      stageTitle: '第一關・百畝樹林',
      stageSub: '奪回蜂蜜・野餐之路',
      cast: ['倫寶', '琪寶寶', '噗噗'] as const,
      maxHp: 6,
      coinsStart: 5,
    })

    this.scene.start('logo')
  }

  /**
   * Actors (heroes/enemies/weapons): higher-res bilinear + LINEAR (AA).
   * Scene/tiles/landmarks stay chunky NEAREST SNES pixel.
   */
  private bakeCastTextures() {
    stampFanOntoGirl(this)
    stampCasualClothes(this)

    const actors = [
      'art-salmon',
      'art-girl',
      'art-bear',
      'art-enemy',
      'art-enemy-barrel',
      'art-enemy-elephant',
    ] as const
    for (const key of actors) {
      // 3× supersample + LINEAR; gameplay uses ACTOR_DISPLAY_SCALE (≈ old 2× size).
      bakeSmoothActorTexture(this, key, 3)
    }
    for (const key of [
      'prop-sword',
      'prop-enemy-knife',
      'prop-enemy-spear',
      'prop-enemy-club',
      'prop-enemy-trunk',
      'fx-salmon-shot',
      'fx-fish-bullet',
      'fan3d',
      'prop-fan',
      // Soft-bake pickups/props so they share cast AA (not harsh NEAREST vs wallpaper)
      'prop-honey-stack',
      'hazard-durian',
      'pickup-sushi',
      'goal3d',
      'pot3d',
      'chest3d',
      'prop-tent',
      'prop-picnic-table',
      'prop-campfire',
      'prop-picnic',
    ]) {
      if (this.textures.exists(key)) bakeSmoothActorTexture(this, key, 2)
    }

    // Outline + soft AA on base frames BEFORE walk/idle bake so anims match.
    for (const key of actors) {
      thickenSpriteOutline(this, key, 2, [18, 14, 12])
      softAaSameSize(this, key, 2)
      setActorLinearFilter(this, key)
    }

    registerWalkCycle(this, 'art-salmon', WALK_FRAMES)
    registerWalkCycle(this, 'art-girl', WALK_FRAMES)
    registerIdleBreath(this, 'art-salmon')
    registerIdleBreath(this, 'art-girl')
    registerIdleBreath(this, 'art-bear')
    registerWalkCycle(this, 'art-bear', WALK_FRAMES)
    registerEnemyCombatFrames(this, 'art-enemy')
    registerEnemyCombatFrames(this, 'art-enemy-barrel')
    registerEnemyCombatFrames(this, 'art-enemy-elephant')

    for (const key of actors) setActorLinearFilter(this, key)
  }

  /**
   * Outline policy — shared cel rim so cast + props align (wallpaper stays soft/far).
   */
  private thickenPropOutlines() {
    const ink: [number, number, number] = [18, 14, 12]
    const interactables = [
      'pot3d',
      'chest3d',
      'goal3d',
      'crate3d',
      'prop-honey-stack',
      'hazard-durian',
      'blk-spike',
      'pickup-sushi',
      'coin',
      'prop-tent',
      'prop-picnic-table',
      'prop-campfire',
      'prop-picnic',
      'prop-shrine',
    ]
    for (const key of interactables) {
      thickenSpriteOutline(this, key, 2, ink)
      softAaSameSize(this, key, 2)
    }
    // Far scenery — thinner rim only
    for (const key of [
      'prop-tree3d',
      'prop-house3d',
      'prop-torii',
      'prop-bridge',
      'prop-banner',
      'prop-lantern3d',
      'prop-owl',
      'lm-mount-1',
      'lm-mount-2',
      'lm-mount-3',
      'lm-mount-4',
      'lm-cloud-1',
      'lm-cloud-2',
      'lm-cloud-3',
      'lm-river',
    ]) {
      thickenSpriteOutline(this, key, 1, ink)
    }
  }

  /** Harden + seal L/R edges so TileSprite repeats leave no vertical seam. */
  private hardenSeamTiles() {
    for (const key of [
      'water-deep',
      'water-mid',
      'water-foam',
      'blk-grass',
      'til-grass',
      'blk-wood',
      'til-wood',
      'blk-stone',
      'blk-spike',
      'til-spike',
      'bg-horizon',
      'bg-sky',
    ]) {
      hardenTextureAlpha(this, key, 80)
      sealTextureSeamsX(this, key)
    }
  }
}
