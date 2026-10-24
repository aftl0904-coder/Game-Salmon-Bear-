import Phaser from 'phaser'
import { registerTiles } from './tiles'
import { registerWorldArt } from './worldArt'
import { registerHoneyArt } from './honeyArt'

/** Loading page — bake textures then go to logo */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#1a1428')

    const title = this.add
      .text(width / 2, height / 2 - 40, '鮭鮭熊', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '42px',
        color: '#f7e7c0',
      })
      .setOrigin(0.5)

    const barBg = this.add.rectangle(width / 2, height / 2 + 30, 320, 18, 0x3a2a40)
    const bar = this.add.rectangle(width / 2 - 158, height / 2 + 30, 4, 12, 0xe07a4f).setOrigin(0, 0.5)
    const tip = this.add
      .text(width / 2, height / 2 + 70, '讀取中…', {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: '16px',
        color: '#c9b896',
      })
      .setOrigin(0.5)

    this.load.on('progress', (p: number) => {
      bar.width = Math.max(4, 316 * p)
    })

    // character art
    this.load.image('art-salmon', '/art/salmon-boy.png')
    this.load.image('art-girl', '/art/bear-girl.png')
    this.load.image('art-bear', '/art/kind-bear.png')
    this.load.image('art-enemy', '/art/fish-enemy.png')

    void title
    void barBg
    void tip
  }

  create() {
    registerTiles(this)
    registerWorldArt(this)
    registerHoneyArt(this)
    this.scene.start('logo')
  }
}
