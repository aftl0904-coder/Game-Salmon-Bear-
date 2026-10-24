import './style.css'
import Phaser from 'phaser'
import { PlayScene } from './game/PlayScene'

const root = document.querySelector<HTMLDivElement>('#game-root')!

new Phaser.Game({
  type: Phaser.AUTO,
  parent: root,
  width: 960,
  height: 540,
  backgroundColor: '#6eb7d6',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1400 },
      debug: false,
    },
  },
  scene: [PlayScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
