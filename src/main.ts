import './style.css'
import Phaser from 'phaser'
import { BootScene } from './game/BootScene'
import { LogoScene } from './game/LogoScene'
import { MenuScene } from './game/MenuScene'
import { PlayScene } from './game/PlayScene'

const root = document.querySelector<HTMLDivElement>('#game-root')!

new Phaser.Game({
  type: Phaser.AUTO,
  parent: root,
  width: 960,
  height: 540,
  backgroundColor: '#1a1428',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1500 },
      debug: false,
    },
  },
  scene: [BootScene, LogoScene, MenuScene, PlayScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
