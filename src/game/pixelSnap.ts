import Phaser from 'phaser'

/**
 * Pixel-art render integrity for Phaser 4 + `pixelArt: true`.
 *
 * Phaser 4 `fullAuto` vertex rounding snaps each quad corner independently —
 * with scale ≠ 1 that warps the sprite mid-body (classic PS1 / waist-cut look).
 * `safeAuto` only rounds translation-only draws (scale===1, angle===0).
 *
 * Fix: bake display scale into the texture (NEAREST upsample) so actors run at
 * scale 1, then keep positions + camera scroll on the integer grid.
 *
 * Soft (anti-aliased) source alpha also washes into horizontal “slices” under
 * NEAREST — harden alpha when baking.
 */

type TexScene = Phaser.Scene

/**
 * NEAREST-upsample a texture by an integer factor, harden alpha, replace in-place.
 * Returns the baked display size (source × factor).
 */
export function bakePixelTexture(
  scene: TexScene,
  key: string,
  factor = 2,
  alphaCut = 96,
): { w: number; h: number } | null {
  if (!scene.textures.exists(key)) return null
  const src = scene.textures.get(key).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
  const sw = (src as { width: number }).width | 0
  const sh = (src as { height: number }).height | 0
  if (sw < 1 || sh < 1) return null

  const dw = sw * factor
  const dh = sh * factor
  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const tmp = document.createElement('canvas')
  tmp.width = sw
  tmp.height = sh
  const tctx = tmp.getContext('2d')!
  tctx.imageSmoothingEnabled = false
  tctx.clearRect(0, 0, sw, sh)
  tctx.drawImage(src as CanvasImageSource, 0, 0)
  const srcData = tctx.getImageData(0, 0, sw, sh)
  const out = ctx.createImageData(dw, dh)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      let a = srcData.data[i + 3]
      if (a < alphaCut) a = 0
      else a = 255
      const r = srcData.data[i]
      const g = srcData.data[i + 1]
      const b = srcData.data[i + 2]
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const oi = ((y * factor + dy) * dw + (x * factor + dx)) * 4
          out.data[oi] = r
          out.data[oi + 1] = g
          out.data[oi + 2] = b
          out.data[oi + 3] = a
        }
      }
    }
  }
  ctx.putImageData(out, 0, 0)
  if (scene.textures.exists(key)) scene.textures.remove(key)
  scene.textures.addCanvas(key, canvas)
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
  return { w: dw, h: dh }
}

/** Harden alpha in-place without resizing (for already-correct-size art). */
export function hardenTextureAlpha(scene: TexScene, key: string, alphaCut = 96) {
  if (!scene.textures.exists(key)) return
  const src = scene.textures.get(key).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement
  const w = (src as { width: number }).width | 0
  const h = (src as { height: number }).height | 0
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src as CanvasImageSource, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 3; i < img.data.length; i += 4) {
    img.data[i] = img.data[i] < alphaCut ? 0 : 255
  }
  ctx.putImageData(img, 0, 0)
  if (scene.textures.exists(key)) scene.textures.remove(key)
  scene.textures.addCanvas(key, canvas)
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
}

/**
 * Actors should be scale===1 after bakePixelTexture so safeAuto rounds cleanly.
 * Do NOT use fullAuto — it independently snaps quad corners and shears mid-sprite.
 */
export function enablePixelSprite(
  spr: Phaser.GameObjects.GameObject | null | undefined,
) {
  if (!spr || typeof (spr as Phaser.GameObjects.GameObject).setVertexRoundMode !== 'function') {
    return
  }
  ;(spr as Phaser.GameObjects.GameObject).setVertexRoundMode('safeAuto')
}

type PosLike = {
  x: number
  y: number
  setPosition: (x: number, y: number) => unknown
  body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null
}

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

export function snapCameraScroll(cam: Phaser.Cameras.Scene2D.Camera) {
  cam.scrollX = Math.round(cam.scrollX)
  cam.scrollY = Math.round(cam.scrollY)
}

export function snapTilePosition(
  tile:
    | { tilePositionX: number; tilePositionY?: number }
    | null
    | undefined,
  x: number,
  y = 0,
) {
  if (!tile) return
  tile.tilePositionX = Math.round(x)
  if (tile.tilePositionY !== undefined) tile.tilePositionY = Math.round(y)
}

export function setPixelPose(
  spr: Phaser.GameObjects.Sprite,
  baseScale: number,
  opts: { squashX?: number; squashY?: number; angle?: number } = {},
) {
  const sx = opts.squashX ?? 1
  const sy = opts.squashY ?? 1
  const qx = Math.round(baseScale * sx)
  const qy = Math.round(baseScale * sy)
  spr.setScale(qx === 0 ? 1 : qx, qy === 0 ? 1 : qy)
  spr.setAngle(0)
  void opts.angle
}

export function setRunPose(spr: Phaser.GameObjects.Sprite, baseScale: number, _phase: number) {
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

export function setIdlePose(spr: Phaser.GameObjects.Sprite, baseScale: number, _tMs: number) {
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

export function setJumpPose(spr: Phaser.GameObjects.Sprite, baseScale: number, _facing: number) {
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

export function setHurtPoseVisual(spr: Phaser.GameObjects.Sprite, baseScale: number, _facing: number) {
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

export function setDiePoseVisual(spr: Phaser.GameObjects.Sprite, baseScale: number, _facing: number) {
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

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
