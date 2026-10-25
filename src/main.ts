import './style.css'
import Phaser from 'phaser'
import { BootScene } from './game/BootScene'
import { LogoScene } from './game/LogoScene'
import { MenuScene } from './game/MenuScene'
import { GameScene } from './game/GameScene'
import { UIScene } from './game/UIScene'
import { GRAVITY_Y } from './game/engine/constants'

const GAME_W = 960
const GAME_H = 540

const root = document.querySelector<HTMLDivElement>('#game-root')!

/**
 * Integer CSS scale for the canvas parent so NEAREST up/downscale never
 * invents uneven columns (the classic “vertical strip tear” look).
 */
function fitIntegerScale() {
  const padX = 16
  const padY = 28
  const availW = Math.max(GAME_W, window.innerWidth - padX)
  const availH = Math.max(GAME_H, window.innerHeight - padY)
  const zoom = Math.max(1, Math.floor(Math.min(availW / GAME_W, availH / GAME_H)))
  root.style.width = `${GAME_W * zoom}px`
  root.style.height = `${GAME_H * zoom}px`
}

fitIntegerScale()
window.addEventListener('resize', fitIntegerScale)

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: root,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1a1428',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY_Y }, debug: false } },
  scene: [BootScene, LogoScene, MenuScene, GameScene, UIScene],
  // NONE: we own integer CSS zoom above. FIT would stretch to non-integer sizes.
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: {
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    powerPreference: 'high-performance',
    // Needed so canvas.toDataURL / screenshots see the last frame.
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
})
