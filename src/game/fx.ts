import type Phaser from 'phaser'
import {
  HITFREEZE_MS,
  HIT_SHAKE_MS,
  HIT_SHAKE_INTENSITY,
  HEAVY_HITFREEZE_MS,
  HEAVY_HIT_SHAKE_MS,
  HEAVY_HIT_SHAKE_INTENSITY,
} from './engine/constants'
import { DEPTH } from './engine/depth'
import { FONT_UI } from './ui/fonts'

export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 8,
) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const sp = 70 + Math.random() * 140
    const p = scene.add
      .circle(x, y, 2.5 + Math.random() * 3.5, color, 0.95)
      .setDepth(DEPTH.FX)
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(a) * sp,
      y: y + Math.sin(a) * sp - 34,
      alpha: 0,
      scale: 0.15,
      duration: 300 + Math.random() * 200,
      onComplete: () => p.destroy(),
    })
  }
}

/** Expanding impact ring — readable smash / lunge telegraph. */
export function impactRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color = 0xffe8a0,
  startR = 8,
) {
  const ring = scene.add.circle(x, y, startR, color, 0).setDepth(DEPTH.FX)
  ring.setStrokeStyle(3, color, 0.95)
  scene.tweens.add({
    targets: ring,
    scale: 3.2,
    alpha: 0,
    duration: 220,
    ease: 'Cubic.out',
    onComplete: () => ring.destroy(),
  })
}

export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  msg: string,
  color = '#ff3333',
  opts: { size?: number; rise?: number; dur?: number } = {},
) {
  const t = scene.add
    .text(x, y, msg, {
      fontFamily: FONT_UI,
      fontSize: `${opts.size ?? 20}px`,
      color,
      stroke: '#fff8e8',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.FX)
  scene.tweens.add({
    targets: t,
    y: y - (opts.rise ?? 36),
    alpha: 0,
    scale: 1.15,
    duration: opts.dur ?? 450,
    onComplete: () => t.destroy(),
  })
  return t
}

/** Arcade score pop — big gold numbers. */
export function scorePop(scene: Phaser.Scene, x: number, y: number, pts: number) {
  return floatText(scene, x, y - 8, `＋${pts}`, '#ffe08a', { size: 26, rise: 52, dur: 620 })
}

/** Pause physics + tweens on solid hits (hit freeze).
 * Tweens must freeze too — otherwise mid-squash/angle frames capture as 撕裂.
 * Non-reentrant: stacked hits must not leave world paused forever.
 * Prefer {@link freezeActors} for attack commit so projectiles keep flying. */
let hitstopLock = false
export function hitstop(scene: Phaser.Scene, ms = HITFREEZE_MS) {
  if (hitstopLock) return
  hitstopLock = true
  scene.physics.world.pause()
  scene.tweens.pauseAll()
  scene.time.delayedCall(ms, () => {
    hitstopLock = false
    if (!scene.sys.isActive()) return
    if (scene.physics.world.isPaused) scene.physics.world.resume()
    scene.tweens.resumeAll()
  })
}

const FREEZE_KEY = 'actorFreezeUntil'

/** Freeze only listed actors (velocity zeroed). Projectiles / world keep running. */
export function freezeActors(
  scene: Phaser.Scene,
  actors: Array<Phaser.Physics.Arcade.Sprite | null | undefined>,
  ms: number,
) {
  if (ms <= 0) return
  const until = scene.time.now + ms
  for (const a of actors) {
    if (!a || !a.active) continue
    // Never stop an airborne hero mid-jump — it kills the arc and feels like lag.
    if ((a as { laneJumping?: boolean }).laneJumping) continue
    if (scene.time.now < ((a.getData('superArmorUntil') as number | undefined) ?? 0)) continue
    const prev = (a.getData(FREEZE_KEY) as number) || 0
    a.setData(FREEZE_KEY, Math.max(prev, until))
    const body = a.body as Phaser.Physics.Arcade.Body | null
    if (body) body.setVelocity(0, 0)
  }
}

export function isActorFrozen(
  a: Phaser.GameObjects.GameObject | null | undefined,
  now: number,
): boolean {
  if (!a) return false
  return now < ((a.getData(FREEZE_KEY) as number) || 0)
}

export type JuiceKind = 'damage' | 'heavy' | 'land' | 'run' | 'break' | 'hit'

type HitTarget = Phaser.GameObjects.Sprite & {
  setTint?: (c: number) => unknown
  clearTint?: () => unknown
  setAngle?: (a: number) => unknown
  setScale?: (x: number, y?: number) => unknown
  scaleX?: number
  scaleY?: number
}

/** Game-feel facade: camera shake, hit freeze, white flash, knockback lean. */
export class JuiceManager {
  private runDustCd = 0
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  shakeDamage() {
    const cam = this.scene.cameras.main
    cam.setRoundPixels(true)
    cam.shake(HIT_SHAKE_MS, HIT_SHAKE_INTENSITY)
  }

  shakeHeavy() {
    const cam = this.scene.cameras.main
    cam.setRoundPixels(true)
    cam.shake(HEAVY_HIT_SHAKE_MS, HEAVY_HIT_SHAKE_INTENSITY)
  }

  freeze(ms = HITFREEZE_MS) {
    hitstop(this.scene, ms)
  }

  /** Screen white flash — Goemon one-blade hit read. */
  whiteFlash(heavy = false) {
    this.scene.cameras.main.flash(heavy ? 90 : 55, 255, 255, 255, false, undefined, heavy ? 0.55 : 0.4)
  }

  /**
   * Knockback lean on the struck body (enemy or pot stand-in).
   * Same visual language for player hits AND pot smash.
   */
  knockLean(target: HitTarget | undefined, dir: number, heavy = false) {
    if (!target?.active) return
    // Tint-only hit read — any angle/scale tween shears NEAREST into enemy smear.
    void dir
    void heavy
    this.scene.tweens.killTweensOf(target)
    target.setAngle?.(0)
    target.setScale?.(1, 1)
    // Soft flash (not full white) — full white + burst particles read as a smear ghost.
    target.setTint?.(0xffccaa)
    this.scene.time.delayedCall(70, () => {
      if (target.active) target.clearTint?.()
    })
  }

  /**
   * Unified solid-hit language (hits + pot smash):
   * short hitstop + camera shake + white flash + particles + ring (+ optional lean).
   */
  solidHit(
    x: number,
    y: number,
    heavy = false,
    target?: HitTarget,
    dir: number = 1,
  ) {
    if (heavy) {
      this.freeze(HEAVY_HITFREEZE_MS)
      this.shakeHeavy()
      burst(this.scene, x, y, 0xffe8a0, 8)
    } else {
      this.freeze(HITFREEZE_MS)
      this.shakeDamage()
      burst(this.scene, x, y, 0xffe8a0, 6)
    }
    this.whiteFlash(heavy)
    impactRing(this.scene, x, y - 12, heavy ? 0xffcc66 : 0xffe8a0, 8)
    this.knockLean(target, dir, heavy)
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
        .setDepth(DEPTH.FX)
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
        .setDepth(DEPTH.FX)
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
        burst(this.scene, x, y, 0xff4466, 10)
        break
      case 'heavy':
        this.solidHit(x, y, true)
        break
      case 'hit':
        this.solidHit(x, y, false)
        break
      case 'land':
        this.landDust(x, y)
        break
      case 'run':
        this.dust(x, y, 2)
        break
      case 'break':
        this.breakDebris(x, y)
        this.solidHit(x, y, false)
        break
    }
  }
}

/** Brief alpha blink during invulnerability frames. */
export function startIFrameBlink(
  a: Phaser.Scene | (Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject),
  b: Phaser.Scene | (Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject),
  ms = 1500,
) {
  const scene = ('sys' in a ? a : b) as Phaser.Scene
  const target = ('sys' in a ? b : a) as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject
  scene.tweens.killTweensOf(target)
  scene.tweens.add({
    targets: target,
    alpha: 0.35,
    duration: 60,
    yoyo: true,
    repeat: Math.max(1, Math.floor(ms / 120)),
    onComplete: () => target.setAlpha(1),
  })
}
