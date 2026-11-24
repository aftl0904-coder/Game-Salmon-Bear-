/**
 * Stage 5 photo spot — one-shot polaroid of Alan & 琪琪 (public/art/story/photo-us.jpg).
 * Does not pause gameplay or block heroes.
 */
import Phaser from 'phaser'
import { GAME_W, GAME_H } from './display'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'
import { SFX } from './audio'

export const PHOTO_SPOT_X = 3190
export const PHOTO_TEX = 'photo-us'
/** Display width of the photo inside the frame (native JPEG kept unpixelated). */
const PHOTO_W = 200
const HOLD_MS = 3500
const FLASH_MS = 150

export function preloadPhotoSpot(scene: Phaser.Scene) {
  if (!scene.textures.exists(PHOTO_TEX)) scene.load.image(PHOTO_TEX, '/art/story/photo-us.jpg')
}

/** Keep the real photo smooth — game pixelArt default would NEAREST-filter it. */
export function hardenPhotoTexture(scene: Phaser.Scene) {
  if (!scene.textures.exists(PHOTO_TEX)) return
  scene.textures.get(PHOTO_TEX).setFilter(Phaser.Textures.FilterMode.LINEAR)
}

/**
 * White flash + falling polaroid (top-right, ~4° tilt). Returns true if shown.
 */
export function playPhotoPolaroid(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(PHOTO_TEX)) return false
  hardenPhotoTexture(scene)
  SFX.shutter()

  const flash = scene.add
    .rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 1)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(DEPTH.UI + 400)
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: FLASH_MS,
    ease: 'Quad.out',
    onComplete: () => flash.destroy(),
  })

  const tex = scene.textures.get(PHOTO_TEX).get()
  const aspect = tex.height / Math.max(1, tex.width)
  const photoH = Math.round(PHOTO_W * aspect)
  const padX = 10
  const padTop = 10
  const padBot = 28 // wider bottom for caption
  const frameW = PHOTO_W + padX * 2
  const frameH = photoH + padTop + padBot

  const root = scene.add.container(GAME_W - 28, -frameH - 20).setScrollFactor(0).setDepth(DEPTH.UI + 390)
  root.setAngle(4)

  const frame = scene.add.rectangle(0, 0, frameW, frameH, 0xffffff).setOrigin(1, 0)
  frame.setStrokeStyle(1, 0xe8e0d0)
  const img = scene.add
    .image(-padX, padTop, PHOTO_TEX)
    .setOrigin(1, 0)
    .setDisplaySize(PHOTO_W, photoH)
  // Do not enablePixelSprite / markHd — keep LINEAR photo.
  const caption = scene.add
    .text(-frameW / 2, frameH - 8, '2026・聖誕', {
      fontFamily: FONT_UI,
      fontSize: '10px',
      color: '#5a4a3a',
    })
    .setOrigin(0.5, 1)
  root.add([frame, img, caption])

  const landY = 18
  scene.tweens.add({
    targets: root,
    y: landY,
    duration: 520,
    ease: 'Bounce.out',
  })
  scene.time.delayedCall(HOLD_MS, () => {
    if (!root.active) return
    scene.tweens.add({
      targets: root,
      alpha: 0,
      duration: 450,
      onComplete: () => root.destroy(true),
    })
  })
  return true
}
