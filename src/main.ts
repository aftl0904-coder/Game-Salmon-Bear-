import './style.css'
import Phaser from 'phaser'
import { BootScene } from './game/BootScene'
import { LogoScene } from './game/LogoScene'
import { MenuScene } from './game/MenuScene'
import { GameScene } from './game/GameScene'
import { UIScene } from './game/UIScene'
import { GRAVITY_Y } from './game/engine/constants'
import { isPhonePlay } from './game/touchInput'

const GAME_W = 960
const GAME_H = 540

const root = document.querySelector<HTMLDivElement>('#game-root')!

/**
 * Desktop: integer CSS zoom (NEAREST-safe).
 * Phone landscape: fractional fit so 960×540 fills the screen.
 */
function fitGameScale() {
  const phone = isPhonePlay()
  document.body.classList.toggle('phone-play', phone)
  const padX = phone ? 0 : 16
  const padY = phone ? 0 : 28
  const availW = Math.max(1, window.innerWidth - padX)
  const availH = Math.max(1, window.innerHeight - padY)
  let zoom = Math.min(availW / GAME_W, availH / GAME_H)
  if (!phone && zoom >= 1) zoom = Math.floor(zoom)
  zoom = Math.max(phone ? 0.2 : 1, zoom)
  root.style.width = `${GAME_W * zoom}px`
  root.style.height = `${GAME_H * zoom}px`
}

fitGameScale()
window.addEventListener('resize', fitGameScale)
window.addEventListener('orientationchange', () => setTimeout(fitGameScale, 120))

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
  input: { gamepad: true, activePointers: 3 },
  scene: [BootScene, LogoScene, MenuScene, GameScene, UIScene],
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
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
  fitGameScale()
})
