import type Phaser from 'phaser'

/** Screen juice helpers — prettier combat feedback */
export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 8,
) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const sp = 60 + Math.random() * 120
    const p = scene.add
      .circle(x, y, 2 + Math.random() * 3, color, 0.95)
      .setDepth(15)
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(a) * sp,
      y: y + Math.sin(a) * sp - 30,
      alpha: 0,
      scale: 0.2,
      duration: 280 + Math.random() * 180,
      onComplete: () => p.destroy(),
    })
  }
}

export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  msg: string,
  color = '#ff3333',
) {
  const t = scene.add
    .text(x, y, msg, {
      fontFamily: 'Noto Sans TC, sans-serif',
      fontSize: '20px',
      color,
      stroke: '#fff8e8',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(16)
  scene.tweens.add({
    targets: t,
    y: y - 36,
    alpha: 0,
    duration: 450,
    onComplete: () => t.destroy(),
  })
}

export function hitstop(scene: Phaser.Scene, ms = 55) {
  scene.physics.world.pause()
  scene.time.delayedCall(ms, () => {
    if (scene.sys.isActive()) scene.physics.world.resume()
  })
}
