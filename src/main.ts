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
 * Portrait lock — do not crush 16:9 into a skinny vertical strip.
 * Landscape: Phaser Scale.FIT contain-scales into #game-root.
 */
function updateOrientationUi() {
  const portrait = window.innerHeight > window.innerWidth
  document.body.classList.toggle('portrait', portrait)
  const hint = document.getElementById('rotate-hint')
  if (hint) hint.setAttribute('aria-hidden', portrait ? 'false' : 'true')
}

updateOrientationUi()

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: root,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1a1420',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY_Y }, debug: false } },
  input: { gamepad: true, activePointers: 3 },
  scene: [BootScene, LogoScene, MenuScene, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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

function onViewportChange() {
  updateOrientationUi()
  game.scale.refresh()
}

window.addEventListener('resize', onViewportChange)
window.addEventListener('orientationchange', () => setTimeout(onViewportChange, 120))

game.events.once('ready', () => {
  for (const scene of game.scene.getScenes(false)) {
    scene.cameras?.cameras?.forEach((c) => c.setRoundPixels(true))
  }
  const splash = document.getElementById('boot-splash')
  if (splash) splash.remove()
  onViewportChange()
})
