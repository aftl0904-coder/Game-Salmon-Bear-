import Phaser from 'phaser'
import { createHeroAnims, preloadHeroAnims, REPLACED_STILLS } from './heroAnims'
import { createFxAnims, preloadFxAnims } from './fxAnims'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { registerHoneyArt } from './honeyArt'
import { registerIsoArt } from './isoArt'
import { registerUiArt } from './uiArt'
import { preloadRound1Map } from './levelMap'
import {
  bakePixelTexture,
  bakeFixedSizeTexture,
  hardenTextureAlpha,
  sealTextureSeamsX,
  thickenSpriteOutline,
  nearestFitTextureHeight,
  registerWalkCycle,
  registerIdleBreath,
  registerEnemyCombatFrames,
  setActorNearestFilter,
  WALK_FRAMES,
} from './pixelSnap'
import { OBJECT_CATALOG, allCatalogTextureKeys } from './data/objectCatalog'
import { FONT_TITLE, FONT_UI } from './ui/fonts'
import { applyEnemyPlaceholderTextures, ENEMY_SHEET_MAP } from './enemyPlaceholders'
import { applyArtOverrides, preloadArtOverrides } from './artOverrides'
import { loadCustomSkins, preloadCustomConfig } from './customSkins'
import {
  BAKE_RES_FACTOR,
  OUTLINE_WIDTH,
  OUTLINE_INK,
  TARGET_H_ENEMY_L,
  TARGET_H_ENEMY_M,
  TARGET_H_ITEM,
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
      .text(width / 2, height / 2 - 28, '鮭鮭熊', {
        fontFamily: FONT_TITLE,
        fontSize: '24px',
        color: '#ffe08a',
        stroke: '#3a2010',
        strokeThickness: 4,
      })
      .setOrigin(0.5)

    const barBg = this.add.rectangle(width / 2, height / 2 + 16, 200, 12, 0x6a4228)
    barBg.setStrokeStyle(2, 0xe0b86a)
    const bar = this.add
      .rectangle(width / 2 - 96, height / 2 + 16, 4, 8, 0xe07a4f)
      .setOrigin(0, 0.5)
    this.add
      .text(width / 2, height / 2 + 40, '讀取中…　請稍候', {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#f3e6c8',
      })
      .setOrigin(0.5)

    this.load.on('progress', (p: number) => {
      bar.width = Math.max(4, 192 * p)
    })

    // Single-frame hero/enemy art (not spritesheets). Wrong frameWidth/Height
    // would waist-cut 琪寶寶 — keep as full-image textures.
    this.load.image('art-salmon', '/art/salmon-boy.png')
    this.load.image('art-girl', '/art/bear-girl.png')
    this.load.image('art-bear', '/art/kind-bear.png')
    this.load.image('art-enemy', '/art/fish-enemy.png')
    // Cel coin (salmon emblem) — overrides procedural paint after registers.
    this.load.image('coin-cel', '/art/coin.png')
    // Pixel wallpaper (640×360 ≤64c)
    this.load.image('bg-wallpaper', '/art/bg-wallpaper-px.png')
    this.load.image('bg-sky-wallpaper', '/art/bg-sky-wallpaper.jpg')
    for (const meta of Object.values(ENEMY_SHEET_MAP)) {
      this.load.image(`enemy-sheet-${meta.id}`, `/art/enemies/${meta.id}.png`)
    }
    for (let v = 0; v < 4; v++) {
      this.load.image(`tile-ground-${v}`, `/art/tiles/ground-${v}.png`)
    }
    // Hand-pixelled terrain (scripts/art/gen_terrain.py): grass lip + wide dirt, foreground bushes.
    this.load.image('tile-ground-top', '/art/tiles/ground-top.png')
    this.load.image('bg-bush-strip', '/art/tiles/bush-strip.png')
    // Painted lighting + shadow (scripts/art/slice_light.py); every use falls back if missing.
    for (const f of ['shadow-soft', 'glow-round', 'vignette'] as const) {
      this.load.image(`fx-${f}`, `/art/fx/${f}.png`)
    }
    // 扭蛋機 (ART-REQUEST-10): gacha prop + capsule spritesheet + charm icons.
    this.load.image('gacha-machine', '/art/props/gacha-machine.png')
    this.load.spritesheet('gacha-capsules', '/art/props/gacha-capsules.png', { frameWidth: 64, frameHeight: 64 })
    for (const id of ['omamori', 'speed', 'power', 'stamina', 'luck'] as const) {
      this.load.image(`charm-${id}`, `/art/items/charm-${id}.png`)
    }
    // 朋友仔 (ART batch-06, slice_friends.py): real art for the friends with a vetted,
    // non-infringing design. 虎仔 and any other roster id are deliberately left out here
    // so friends.ts's procedural placeholder keeps drawing them — see slice_friends.py's
    // top comment for why (some delivered sheets turned out to be copyrighted characters).
    for (const id of ['huihui', 'guard', 'denim', 'brownie', 'shiba', 'kuro']) {
      this.load.image(`friend-${id}`, `/art/friends/${id}.png`)
    }
    this.load.image('friend-cage', '/art/friends/cage.png')
    preloadArtOverrides(this)
    preloadHeroAnims(this)
    preloadFxAnims(this)
    preloadRound1Map(this)
    preloadCustomConfig(this)
  }

  create() {
    registerTiles(this)
    registerWorldArt(this)
    registerHoneyArt(this)
    registerIsoArt(this)
    registerUiArt(this)
    const swapped = applyEnemyPlaceholderTextures(this)
    this.registry.set('enemyPlaceholders', swapped)
    this.registry.set('artOverrides', applyArtOverrides(this))
    // Frame-by-frame cast (Cursor action sheets) — also swaps the old stills to the new designs.
    createHeroAnims(this)
    createFxAnims(this)
    this.applyCelCoinTexture()
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

    // Owner-supplied art slots (public/art/custom) load last and override the built-in frames.
    loadCustomSkins(this, () => this.scene.start('studio'))
  }

  /** Prefer cel PNG coin over procedural koban paint (heroes + coin share style). */
  private applyCelCoinTexture() {
    if (!this.textures.exists('coin-cel')) return
    const src = this.textures.get('coin-cel').getSourceImage() as HTMLImageElement | HTMLCanvasElement
    const w = (src as { width: number }).width | 0
    const h = (src as { height: number }).height | 0
    if (w < 4 || h < 4) return
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(src as CanvasImageSource, 0, 0)
    if (this.textures.exists('coin')) this.textures.remove('coin')
    this.textures.addCanvas('coin', canvas)
  }

  /**
   * Shared resolution + outer border for cast / weapons / props.
   * NEAREST bake ×1 + 1px ink — no soft AA (bible stage 3).
   */
  private bakeCastTextures() {
    // Cel hero PNGs already include casual outfits + 琪寶寶背風扇 —
    // do NOT stampCasualClothes / stampFanOntoGirl (would muddy the rebuild).

    const fitH: Record<string, number> = {
      'art-enemy-barrel': TARGET_H_ENEMY_M,
      'art-enemy-elephant': TARGET_H_ENEMY_L,
      'prop-honey-stack': TARGET_H_ITEM + 4,
      'prop-honey-pot': TARGET_H_ITEM,
      'hazard-durian': TARGET_H_ITEM + 4,
    }
    for (const [key, h] of Object.entries(fitH)) {
      if (this.textures.exists(key)) nearestFitTextureHeight(this, key, h)
    }

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
      if (REPLACED_STILLS.has(key)) continue
      bakePixelTexture(this, key, BAKE_RES_FACTOR)
      thickenSpriteOutline(this, key, OUTLINE_WIDTH, OUTLINE_INK)
      setActorNearestFilter(this, key)
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

    for (const key of actors) setActorNearestFilter(this, key)

    // HUD faces / coin at exact px — game uses scale 1 (no setDisplaySize).
    bakeFixedSizeTexture(this, 'art-salmon', 'hud-face-boy', 16)
    bakeFixedSizeTexture(this, 'art-girl', 'hud-face-girl', 16)
    bakeFixedSizeTexture(this, 'coin', 'hud-coin', 12)
  }

  /**
   * Far scenery — same 1px outline ink as play objects (aligned borders).
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
      setActorNearestFilter(this, key)
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
