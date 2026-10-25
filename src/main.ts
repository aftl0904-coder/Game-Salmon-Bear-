import './style.css'
import Phaser from 'phaser'
import { BootScene } from './game/BootScene'
import { LogoScene } from './game/LogoScene'
import { MenuScene } from './game/MenuScene'
import { GameScene } from './game/GameScene'
import { UIScene } from './game/UIScene'
import { GAME_W, GAME_H, phaserConfig } from './game/display'
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

/**
 * Integer zoom when possible (1×, 2×, 3×…).
 * Temporary until fitCanvas.js lands; same contract as Scale.NONE + CSS size.
 */
function applyIntegerZoom() {
  if (!game?.canvas || !root) return
  const availW = Math.max(1, root.clientWidth)
  const availH = Math.max(1, root.clientHeight)
  const fit = Math.min(availW / GAME_W, availH / GAME_H)
  let zoom = Math.floor(fit)
  let fractional = false
  if (zoom < 1) {
    zoom = fit
    fractional = true
  }
  const cssW = GAME_W * zoom
  const cssH = GAME_H * zoom
  const canvas = game.canvas
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.style.imageRendering = 'pixelated'
  ;(canvas.style as CSSStyleDeclaration & { imageRendering: string }).imageRendering = 'pixelated'
  canvas.style.marginLeft = `${Math.floor((availW - cssW) / 2)}px`
  canvas.style.marginTop = `${Math.floor((availH - cssH) / 2)}px`
  canvas.style.display = 'block'
  document.body.dataset.scaleZoom = String(zoom)
  document.body.dataset.scaleFractional = fractional ? '1' : '0'
  ;(window as unknown as { __SAKE_SCALE__: { zoom: number; fractional: boolean; cssW: number; cssH: number } }).__SAKE_SCALE__ =
    { zoom, fractional, cssW, cssH }
}

updateOrientationUi()

let game: Phaser.Game

function onViewportChange() {
  updateOrientationUi()
  applyIntegerZoom()
}

function bootGame() {
  game = new Phaser.Game({
    ...phaserConfig,
    parent: root,
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: jumpGravity() }, debug: false } },
    input: { gamepad: true, activePointers: 3 },
    scene: [BootScene, LogoScene, MenuScene, GameScene, UIScene],
    scale: {
      mode: Phaser.Scale.NONE,
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
}

/** Wait briefly for Fusion Pixel so Phaser text isn't measured with fallback metrics. */
const fontReady = Promise.race([
  document.fonts?.ready ?? Promise.resolve(),
  new Promise<void>((r) => setTimeout(r, 1200)),
])
fontReady.then(() => bootGame())
