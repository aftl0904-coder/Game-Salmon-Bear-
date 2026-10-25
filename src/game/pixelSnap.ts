import type Phaser from 'phaser'

/**
 * Pixel-art render integrity for Phaser 4 + `pixelArt: true`.
 *
 * Phaser 4 default `vertexRoundMode: 'safeAuto'` only rounds when a sprite is
 * translation-only (scale === 1, rotation === 0). Our cast uses ~1.8× scale and
 * micro-rotations during run/hit — so vertices stay on fractional pixels while
 * NEAREST sampling runs. That shears columns/rows and reads as 撕裂 / incomplete.
 *
 * Fix: snap world positions after physics, keep poses rotation-light, and prefer
 * integer camera scroll. Shadows must share the same snapped feet point.
 */

type PosLike = {
  x: number
  y: number
  setPosition: (x: number, y: number) => unknown
  body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null
}

/** Round a world position for NEAREST sampling without drifting the Arcade body. */
export function snapSpriteXY(spr: PosLike | null | undefined) {
  if (!spr) return
  const x = Math.round(spr.x)
  const y = Math.round(spr.y)
  if (x === spr.x && y === spr.y) return
  const body = spr.body as Phaser.Physics.Arcade.Body | null | undefined
  if (body && 'position' in body && body.enable !== false) {
    const dx = x - spr.x
    const dy = y - spr.y
    spr.setPosition(x, y)
    body.position.x += dx
    body.position.y += dy
    body.prev.x += dx
    body.prev.y += dy
  } else {
    spr.setPosition(x, y)
  }
}

export function snapXY(
  obj: { x: number; y: number; setPosition: (x: number, y: number) => unknown } | null | undefined,
) {
  if (!obj) return
  const x = Math.round(obj.x)
  const y = Math.round(obj.y)
  if (x !== obj.x || y !== obj.y) obj.setPosition(x, y)
}

/** Snap camera scroll after follow/lerp so the whole view shares one pixel grid. */
export function snapCameraScroll(cam: Phaser.Cameras.Scene2D.Camera) {
  cam.scrollX = Math.round(cam.scrollX)
  cam.scrollY = Math.round(cam.scrollY)
}

/**
 * Discrete squash for pixel art: no continuous micro-rotation.
 * Angles are whole degrees; scale quantized to 1/20 to avoid sampling churn.
 */
export function setPixelPose(
  spr: Phaser.GameObjects.Sprite,
  baseScale: number,
  opts: { squashX?: number; squashY?: number; angle?: number } = {},
) {
  const sx = opts.squashX ?? 1
  const sy = opts.squashY ?? 1
  const qx = Math.round(baseScale * sx * 20) / 20
  const qy = Math.round(baseScale * sy * 20) / 20
  spr.setScale(qx, qy)
  const ang = opts.angle ?? 0
  spr.setAngle(ang === 0 ? 0 : Math.round(ang))
}

/** Run bob: scale-only 2-phase pulse (no ±5° shear that shreds sprites). */
export function setRunPose(spr: Phaser.GameObjects.Sprite, baseScale: number, phase: number) {
  const step = Math.sin(phase) >= 0 ? 1 : -1
  setPixelPose(spr, baseScale, {
    squashX: 1 + step * 0.03,
    squashY: 1 - step * 0.04,
    angle: 0,
  })
}

/** Idle breathe: tiny pulse, angle locked. */
export function setIdlePose(spr: Phaser.GameObjects.Sprite, baseScale: number, tMs: number) {
  const step = Math.sin(tMs / 380) >= 0 ? 1 : -1
  setPixelPose(spr, baseScale, {
    squashX: 1 + step * 0.015,
    squashY: 1 - step * 0.015,
    angle: 0,
  })
}

export function setJumpPose(spr: Phaser.GameObjects.Sprite, baseScale: number, facing: number) {
  setPixelPose(spr, baseScale, { squashX: 0.94, squashY: 1.08, angle: facing * -6 })
}

export function setHurtPoseVisual(spr: Phaser.GameObjects.Sprite, baseScale: number, facing: number) {
  setPixelPose(spr, baseScale, { squashX: 1.1, squashY: 0.86, angle: facing * -18 })
}

export function setDiePoseVisual(spr: Phaser.GameObjects.Sprite, baseScale: number, facing: number) {
  setPixelPose(spr, baseScale, { squashX: 1.05, squashY: 0.7, angle: facing * 90 })
}

/**
 * After actors move: snap heroes / pet / enemies / labels / shadows onto the
 * same integer grid so contact FX never look torn relative to bodies.
 */
export function snapWorldActors(opts: {
  heroes?: Array<PosLike | null | undefined>
  pet?: PosLike | null
  enemies?: Array<
    | (PosLike & {
        label?: { setPosition: (x: number, y: number) => unknown } | null
        kind?: string
      })
    | null
    | undefined
  >
  shadows?: Array<{ setPosition: (x: number, y: number) => unknown } | null | undefined>
  shadowSources?: Array<{ x: number; y: number; ox?: number; oy?: number } | null | undefined>
  extras?: Array<{ x: number; y: number; setPosition: (x: number, y: number) => unknown } | null | undefined>
}) {
  for (const h of opts.heroes ?? []) snapSpriteXY(h)
  snapSpriteXY(opts.pet ?? null)
  for (const e of opts.enemies ?? []) {
    if (!e) continue
    snapSpriteXY(e)
    if (e.label) {
      const ly = e.y - (e.kind === 'boss' ? 56 : 40)
      e.label.setPosition(Math.round(e.x), Math.round(ly))
    }
  }
  const shadows = opts.shadows ?? []
  const sources = opts.shadowSources ?? []
  for (let i = 0; i < shadows.length; i++) {
    const sh = shadows[i]
    const src = sources[i]
    if (!sh || !src) continue
    sh.setPosition(Math.round(src.x + (src.ox ?? 0)), Math.round(src.y + (src.oy ?? 0)))
  }
  for (const ex of opts.extras ?? []) snapXY(ex)
}
