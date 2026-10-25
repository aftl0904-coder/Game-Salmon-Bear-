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
  setActorLinearFilter,
  WALK_FRAMES,
} from './pixelSnap'
import { OBJECT_CATALOG, allCatalogTextureKeys } from './data/objectCatalog'
import {
  BAKE_RES_FACTOR,
  OUTLINE_WIDTH,
  OUTLINE_INK,
  SOFT_AA_FACTOR,
} from './engine/constants'


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
    this.auditObjectCatalog()

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
   * Shared resolution + outer border for cast / weapons / props.
   * Same bake factor + same outline width so nothing looks sharper/softer alone.
   */
  private bakeCastTextures() {
    // Cel hero PNGs already include casual outfits + 琪寶寶背風扇 —
    // do NOT stampCasualClothes / stampFanOntoGirl (would muddy the rebuild).

    const actors = [
      'art-salmon',
      'art-girl',
      'art-bear',
      'art-enemy',
      'art-enemy-barrel',
      'art-enemy-elephant',
    ] as const
    const playObjects = [
      ...actors,
      'prop-sword',
      'prop-enemy-knife',
      'prop-enemy-spear',
      'prop-enemy-club',
      'prop-enemy-trunk',
      'fx-salmon-shot',
      'fx-fish-bullet',
      'fx-honey',
      'fx-elephant-trunk-0',
      'fx-elephant-trunk-1',
      'fan3d',
      'prop-fan',
      'prop-honey-stack',
      'prop-honey-pot',
      'hazard-durian',
      'pickup-sushi',
      'goal3d',
      'pot3d',
      'chest3d',
      'crate3d',
      'coin',
      'prop-tent',
      'prop-picnic-table',
      'prop-campfire',
      'prop-picnic',
      'prop-shrine',
      'blk-spike',
    ] as const

    for (const key of playObjects) {
      if (!this.textures.exists(key)) continue
      bakeSmoothActorTexture(this, key, BAKE_RES_FACTOR)
      thickenSpriteOutline(this, key, OUTLINE_WIDTH, OUTLINE_INK)
      softAaSameSize(this, key, SOFT_AA_FACTOR)
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
   * Far scenery — same outline width/ink as play objects (aligned borders).
   */
  private thickenPropOutlines() {
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
      if (!this.textures.exists(key)) continue
      thickenSpriteOutline(this, key, OUTLINE_WIDTH, OUTLINE_INK)
      softAaSameSize(this, key, SOFT_AA_FACTOR)
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

  /**
   * Object DB audit — warn if catalog textures/frames are missing after bake.
   * Registry keeps a snapshot for debug / future tooling.
   */
  private auditObjectCatalog() {
    const missing: string[] = []
    for (const key of allCatalogTextureKeys()) {
      if (!this.textures.exists(key)) missing.push(key)
    }
    this.registry.set('objectCatalog', {
      count: OBJECT_CATALOG.length,
      missing,
      ids: OBJECT_CATALOG.map((e) => e.id),
    })
    if (missing.length) {
      console.warn('[objectCatalog] missing textures after bake:', missing)
    }
  }
}
