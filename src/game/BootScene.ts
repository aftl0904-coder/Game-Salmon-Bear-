import Phaser from 'phaser'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { registerHoneyArt } from './honeyArt'
import { registerIsoArt } from './isoArt'
import { registerUiArt } from './uiArt'

/** Boot — asset preload + stage config into registry, then logo splash. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#3a2818')

    const g = this.add.graphics()
    g.fillStyle(0x5a8fc4, 0.35)
    g.fillRect(0, 0, width, height)
    g.fillStyle(0xe8b86a, 0.12)
    g.fillCircle(width * 0.85, 60, 140)

    this.add
      .text(width / 2, height / 2 - 48, '鮭鮭熊', {
        fontFamily: 'Mochiy Pop One, Noto Sans TC, sans-serif',
        fontSize: '44px',
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

    this.load.image('art-salmon', '/art/salmon-boy.png')
    this.load.image('art-girl', '/art/bear-girl.png')
    this.load.image('art-bear', '/art/kind-bear.png')
    this.load.image('art-enemy', '/art/fish-enemy.png')
  }

  create() {
    registerTiles(this)
    registerWorldArt(this)
    registerHoneyArt(this)
    registerIsoArt(this)
    registerUiArt(this)

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
}
