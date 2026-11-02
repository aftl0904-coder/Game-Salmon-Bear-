import Phaser from 'phaser'

/**
 * The enemies' shared hop: a Sine arc from where it stands to `toX` along the floor. GameScene's pit-hop
 * and 蜜僵's lunge both use it. `leaping` is set while it runs so an enemy's own tick must leave `y` / `x` alone.
 */
export function leapEnemy(scene: Phaser.Scene, e: Phaser.GameObjects.Sprite, toX: number, arc: number, durationMs: number) {
  e.setData('leaping', true)
  e.setData('blockedMs', 0)
  const y0 = e.y
  scene.tweens.add({
    targets: e,
    x: toX,
    duration: durationMs,
    ease: 'Sine.inOut',
    onUpdate: (tw) => {
      if (!e.scene) return
      e.y = y0 - Math.sin(tw.progress * Math.PI) * arc
    },
    onComplete: () => {
      if (!e.scene) return
      e.y = y0
      e.setData('leaping', false)
    },
  })
}
