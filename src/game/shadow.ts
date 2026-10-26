import Phaser from 'phaser'

export type GroundShadow = Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image

/** Hand-painted soft shadow, when the art for it has loaded. */
const SHADOW_TEX = 'fx-shadow-soft'

/**
 * Ground blob shadow that shrinks / fades when the target leaves the ground.
 * With the painted texture it scales smoothly; without it, an ellipse sized in
 * whole pixels (never a fractional setScale, so ?debug=1 stays clean).
 */
export function addGroundShadow(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  getGroundY: (target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite) => number,
  ratio = 0.7,
): GroundShadow {
  const baseW = Math.max(6, Math.round(target.displayWidth * ratio))
  const baseH = Math.max(3, Math.round(baseW * 0.25))
  const painted = scene.textures.exists(SHADOW_TEX)
  const sh: GroundShadow = painted
    ? scene.add.image(0, 0, SHADOW_TEX).setAlpha(0.5)
    : scene.add.ellipse(0, 0, baseW, baseH, 0x1a1008, 0.35)
  const update = () => {
    if (!target.active) {
      sh.destroy()
      scene.events.off('update', update)
      return
    }
    const gy = getGroundY(target)
    const lift = Math.max(0, gy - target.y)
    const k = Phaser.Math.Clamp(1 - lift / 90, 0.45, 1)
    sh.setPosition(Math.round(target.x), Math.round(gy))
    if (painted) {
      const img = sh as Phaser.GameObjects.Image
      img.setDisplaySize(Math.max(4, Math.round(baseW * 1.25 * k)), Math.max(3, Math.round(baseH * 1.5 * k)))
      img.setAlpha(0.5 * k)
    } else {
      const el = sh as Phaser.GameObjects.Ellipse
      el.setSize(Math.max(4, Math.round(baseW * k)), Math.max(2, Math.round(baseH * k)))
      el.setScale(1)
      el.setAlpha(0.35 * k)
    }
    sh.setDepth(target.depth - 1)
    sh.setVisible(target.visible)
  }
  scene.events.on('update', update)
  update()
  return sh
}

/**
 * 2px dark contact band where feet meet ground / platform tops.
 */
export function addContactShadowBand(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  depth: number,
): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(Math.round(x), Math.round(y), Math.round(width), 2, 0x1a1008, 0.4)
    .setOrigin(0, 0)
    .setDepth(depth)
}
