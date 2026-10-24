import type Phaser from 'phaser'

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

/** Pause physics ~50ms on heavy hits (hit freeze). */
export function hitstop(scene: Phaser.Scene, ms = 50) {
  scene.physics.world.pause()
  scene.time.delayedCall(ms, () => {
    if (scene.sys.isActive()) scene.physics.world.resume()
  })
}

export type JuiceKind = 'damage' | 'heavy' | 'land' | 'run' | 'break'

/** Game-feel facade: camera shake, hit freeze, dust, debris. */
export class JuiceManager {
  private runDustCd = 0
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  shakeDamage() {
    this.scene.cameras.main.shake(100, 0.01)
  }

  shakeHeavy() {
    this.scene.cameras.main.shake(100, 0.01)
  }

  freeze(ms = 50) {
    hitstop(this.scene, ms)
  }

  landDust(x: number, y: number) {
    this.dust(x, y + 2, 5, 0xcbb896)
  }

  runDust(x: number, y: number, dt: number, moving: boolean) {
    this.runDustCd = Math.max(0, this.runDustCd - dt)
    if (!moving || this.runDustCd > 0) return
    this.runDustCd = 90
    this.dust(x, y + 2, 2, 0xd4c4a0)
  }

  breakDebris(x: number, y: number, color = 0xc48a48) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
      const sp = 80 + Math.random() * 160
      const size = 2 + Math.random() * 4
      const p = this.scene.add
        .rectangle(x, y, size, size, color, 1)
        .setDepth(15)
        .setAngle(Math.random() * 360)
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * sp,
        y: y + Math.sin(a) * sp + 40,
        alpha: 0,
        angle: p.angle + 180,
        duration: 380 + Math.random() * 220,
        ease: 'Cubic.out',
        onComplete: () => p.destroy(),
      })
    }
    burst(this.scene, x, y, color, 6)
  }

  dust(x: number, y: number, count = 4, color = 0xcbb896) {
    for (let i = 0; i < count; i++) {
      const p = this.scene.add
        .circle(x + (Math.random() - 0.5) * 12, y, 2 + Math.random() * 2, color, 0.7)
        .setDepth(7)
      this.scene.tweens.add({
        targets: p,
        x: p.x + (Math.random() - 0.5) * 28,
        y: y - 8 - Math.random() * 14,
        alpha: 0,
        scale: 0.3,
        duration: 220 + Math.random() * 160,
        onComplete: () => p.destroy(),
      })
    }
  }

  play(kind: JuiceKind, x: number, y: number) {
    switch (kind) {
      case 'damage':
        this.shakeDamage()
        burst(this.scene, x, y, 0xff4466, 8)
        break
      case 'heavy':
        this.shakeHeavy()
        this.freeze(50)
        burst(this.scene, x, y, 0xffe8a0, 10)
        break
      case 'land':
        this.landDust(x, y)
        break
      case 'run':
        this.dust(x, y, 2)
        break
      case 'break':
        this.breakDebris(x, y)
        break
    }
  }
}

/** Brief alpha blink during invulnerability frames. */
export function startIFrameBlink(target: Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, scene: Phaser.Scene, ms = 900) {
  scene.tweens.add({
    targets: target,
    alpha: 0.35,
    duration: 60,
    yoyo: true,
    repeat: Math.max(1, Math.floor(ms / 120)),
    onComplete: () => {
      if ('setAlpha' in target) (target as Phaser.GameObjects.Components.Alpha).setAlpha(1)
    },
  })
}
