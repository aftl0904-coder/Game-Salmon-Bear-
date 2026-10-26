import Phaser from 'phaser'
import fxMeta from '../../data/anim/fx.json'
import { DEPTH } from './engine/depth'

/**
 * Hand-animated effect strips (Cursor FX sheets → scripts/art/slice_fx.py).
 * Texture `fxa-<name>`, animation `fxa-<name>`. `playFx` spawns a self-destroying sprite.
 */
export type FxName = keyof typeof fxMeta
type FxMeta = { frameWidth: number; frameHeight: number; count: number; fps: number }
const META = fxMeta as Record<string, FxMeta>

export function preloadFxAnims(scene: Phaser.Scene) {
  for (const [name, m] of Object.entries(META)) {
    scene.load.spritesheet(`fxa-${name}`, `/art/fx/${name}.png`, { frameWidth: m.frameWidth, frameHeight: m.frameHeight })
  }
}

export function createFxAnims(scene: Phaser.Scene) {
  for (const [name, m] of Object.entries(META)) {
    const key = `fxa-${name}`
    if (!scene.textures.exists(key) || scene.anims.exists(key)) continue
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: m.count - 1 }),
      frameRate: m.fps,
      repeat: name === 'coin-spin' ? -1 : 0,
    })
    // Looping twin for ambient props (wind vents, puddles, drips).
    scene.anims.create({
      key: `${key}-loop`,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: m.count - 1 }),
      frameRate: m.fps,
      repeat: -1,
    })
  }
}

export function hasFx(scene: Phaser.Scene, name: FxName) {
  return scene.anims.exists(`fxa-${name}`)
}

/** Fire-and-forget effect. Returns the sprite (or null if the strip is missing). */
export function playFx(
  scene: Phaser.Scene,
  name: FxName,
  x: number,
  y: number,
  opts: { flipX?: boolean; depth?: number; scale?: number; angle?: number; originY?: number; alpha?: number } = {},
): Phaser.GameObjects.Sprite | null {
  const key = `fxa-${name}`
  if (!scene.anims.exists(key)) return null
  const s = scene.add
    .sprite(Math.round(x), Math.round(y), key)
    .setOrigin(0.5, opts.originY ?? 0.5)
    .setFlipX(!!opts.flipX)
    .setDepth(opts.depth ?? DEPTH.FX)
    .setScale(opts.scale ?? 1)
    .setAngle(opts.angle ?? 0)
    .setAlpha(opts.alpha ?? 1)
  s.play(key)
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy())
  return s
}
