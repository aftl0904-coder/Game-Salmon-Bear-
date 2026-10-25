import Phaser from 'phaser'

/**
 * Ground blob shadow that shrinks / fades when the target leaves the ground.
 * Uses ellipse size + alpha (never fractional setScale) so ?debug=1 stays clean.
 */
export function addGroundShadow(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  getGroundY: (target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite) => number,
  ratio = 0.7,
): Phaser.GameObjects.Ellipse {
  const baseW = Math.max(6, Math.round(target.displayWidth * ratio))
  const baseH = Math.max(3, Math.round(baseW * 0.25))
  const sh = scene.add.ellipse(0, 0, baseW, baseH, 0x1a1008, 0.35)
  const update = () => {
    if (!target.active) {
      sh.destroy()
      scene.events.off('update', update)
      return
    }
    const gy = getGroundY(target)
    const lift = Math.max(0, gy - target.y)
    const k = Phaser.Math.Clamp(1 - lift / 90, 0.45, 1)
    // Integer pixel size — no fractional setScale
    const w = Math.max(4, Math.round(baseW * k))
    const h = Math.max(2, Math.round(baseH * k))
    sh.setPosition(Math.round(target.x), Math.round(gy))
    sh.setSize(w, h)
    sh.setScale(1)
    sh.setAlpha(0.35 * k)
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
