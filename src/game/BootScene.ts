import Phaser from 'phaser'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { registerHoneyArt } from './honeyArt'
import { registerIsoArt } from './isoArt'
import { registerUiArt } from './uiArt'
import { preloadRound1Map } from './levelMap'
import { bakePixelTexture, hardenTextureAlpha, closeVerticalAlphaGaps } from './pixelSnap'


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
    preloadRound1Map(this)
  }

  create() {
    registerTiles(this)
    registerWorldArt(this)
    registerHoneyArt(this)
    registerIsoArt(this)
    registerUiArt(this)
    this.bakeCastTextures()
    this.hardenSeamTiles()

    this.registry.set('gameConfig', {
      round: 1,
      stageId: 'creek-path',
      stageTitle: '第一關・溪流小路',
      stageSub: '奪回春蜜',
      cast: ['倫寶', '琪寶寶', '噗噗'] as const,
      maxHp: 10,
      coinsStart: 5,
    })

    this.scene.start('logo')
  }

  /**
   * Bake 2× NEAREST into cast/enemy textures so gameplay sprites run at scale 1.
   * Phaser 4 fullAuto on scale≠1 independently snaps quad corners → waist cuts;
   * soft source alpha washes into horizontal slices under NEAREST — harden it.
   * 噗噗 stays 1× (smaller companion) with hardened alpha only.
   */
  private bakeCastTextures() {
    const baked = [
      ['art-salmon', 2] as const,
      ['art-girl', 2] as const,
      ['art-enemy', 2] as const,
      ['art-enemy-barrel', 2] as const,
    ]
    for (const [key, factor] of baked) {
      const size = bakePixelTexture(this, key, factor, 100)
      if (!size) continue
      const frame = this.textures.get(key).get()
      if (frame.width !== size.w || frame.height !== size.h) {
        console.warn(
          `[boot] baked ${key} frame ${frame.width}x${frame.height} ≠ ${size.w}x${size.h}`,
        )
      }
    }
    hardenTextureAlpha(this, 'art-bear', 100)
    // Soft AA bridges at waist/legs die under harden — fill 1px vertical holes.
    for (const key of [
      'art-salmon',
      'art-girl',
      'art-bear',
      'art-enemy',
      'art-enemy-barrel',
    ]) {
      closeVerticalAlphaGaps(this, key)
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
      }
    }
  }

  /** Harden alpha on water/grass tiles to kill NEAREST seam wash. */
  private hardenSeamTiles() {
    for (const key of ['water-deep', 'water-mid', 'water-foam', 'blk-grass', 'til-grass', 'blk-wood', 'til-wood']) {
      hardenTextureAlpha(this, key, 80)
    }
  }
}
