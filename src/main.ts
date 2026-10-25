import './style.css'
import Phaser from 'phaser'
import { BootScene } from './game/BootScene'
import { LogoScene } from './game/LogoScene'
import { MenuScene } from './game/MenuScene'
import { GameScene } from './game/GameScene'
import { UIScene } from './game/UIScene'
import { GAME_W, GAME_H, phaserConfig } from './game/display'
import { installFit } from './game/fitCanvas'
import { jumpGravity } from './game/config/playerData'

const root = document.querySelector<HTMLDivElement>('#game-root')!

/**
 * Portrait lock — do not crush 16:9 into a skinny vertical strip.
 */
function updateOrientationUi() {
  const portrait = window.innerHeight > window.innerWidth
  document.body.classList.toggle('portrait', portrait)
  const hint = document.getElementById('rotate-hint')
  if (hint) hint.setAttribute('aria-hidden', portrait ? 'false' : 'true')
}

updateOrientationUi()
window.addEventListener('resize', updateOrientationUi)
window.addEventListener('orientationchange', () => setTimeout(updateOrientationUi, 200))
window.visualViewport?.addEventListener('resize', updateOrientationUi)

let game: Phaser.Game

function bootGame() {
  game = new Phaser.Game({
    ...phaserConfig,
    parent: root,
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: jumpGravity() }, debug: false } },
    input: { gamepad: true, activePointers: 3 },
    scene: [BootScene, LogoScene, MenuScene, GameScene, UIScene],
    scale: {
      mode: Phaser.Scale.NONE,
      width: GAME_W,
      height: GAME_H,
      parent: root,
    },
    render: {
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    },
  })
  ;(window as unknown as { __SAKE_GAME__: Phaser.Game }).__SAKE_GAME__ = game

  game.events.once('ready', () => {
    for (const scene of game.scene.getScenes(false)) {
      scene.cameras?.cameras?.forEach((c) => c.setRoundPixels(true))
    }
    const splash = document.getElementById('boot-splash')
    if (splash) splash.remove()
    installFit(game, GAME_W, GAME_H)
    updateOrientationUi()
  })
}

/** Wait briefly for Fusion Pixel so Phaser text isn't measured with fallback metrics. */
const fontReady = Promise.race([
  document.fonts?.ready ?? Promise.resolve(),
  new Promise<void>((r) => setTimeout(r, 1200)),
])
fontReady.then(() => bootGame())
