import './style.css'
import Phaser from 'phaser'
import { BootScene } from './game/BootScene'
import { LogoScene } from './game/LogoScene'
import { MainMenuScene } from './game/MainMenuScene'
import { GameScene } from './game/GameScene'
import { UIScene } from './game/UIScene'

const root = document.querySelector<HTMLDivElement>('#game-root')!

/**
 * Scene flow: Boot → Logo → MainMenu → GameScene + UIScene (parallel).
 * Scene keys: boot / logo / menu / play / UIScene (menu+play keys keep smoke compat).
 */
const game = new Phaser.Game({
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
      debug: true,
      debugShowBody: true,
      debugShowVelocity: true,
    },
  },
  scene: [BootScene, LogoScene, MainMenuScene, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})

;(window as unknown as { __SAKE_GAME__: Phaser.Game }).__SAKE_GAME__ = game
