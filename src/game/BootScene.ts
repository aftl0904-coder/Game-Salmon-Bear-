import Phaser from 'phaser'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { registerHoneyArt } from './honeyArt'
import { registerIsoArt } from './isoArt'
import { registerUiArt } from './uiArt'
import { preloadRound1Map } from './levelMap'

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
    this.lockCastTextureFrames()

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
   * Guarantee cast/enemy textures stay one full-frame image.
   * If anything re-sliced them (e.g. 64×36 half-height), mid-body would show
   * a rectangular blank cut — the classic spritesheet waist fault.
   */
  private lockCastTextureFrames() {
    const expected: Record<string, { w: number; h: number }> = {
      'art-salmon': { w: 72, h: 72 },
      'art-girl': { w: 64, h: 72 },
      'art-bear': { w: 72, h: 72 },
      'art-enemy': { w: 56, h: 56 },
    }
    for (const [key, size] of Object.entries(expected)) {
      if (!this.textures.exists(key)) continue
      const tex = this.textures.get(key)
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST)
      const frame = tex.get()
      // Source PNGs are single frames; refuse half-height sheet mis-slices.
      if (frame.width !== size.w || frame.height !== size.h) {
        console.warn(
          `[boot] texture ${key} frame ${frame.width}x${frame.height} ≠ expected ${size.w}x${size.h}`,
        )
      }
    }
  }
}
