import Phaser from 'phaser'

/**
 * Ground blob shadow that shrinks / fades when the target leaves the ground.
 * `getGroundY(target)` should return the feet contact Y in world space.
 */
export function addGroundShadow(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  getGroundY: (target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite) => number,
  ratio = 0.7,
): Phaser.GameObjects.Ellipse {
  const w = Math.max(6, Math.round(target.displayWidth * ratio))
  const h = Math.max(3, Math.round(w * 0.25))
  const sh = scene.add.ellipse(0, 0, w, h, 0x000000, 0.35)
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
      .setScale(k)
      .setAlpha(0.35 * k)
      .setDepth(target.depth - 1)
      .setVisible(target.visible)
  }
  scene.events.on('update', update)
  update()
  return sh
}
