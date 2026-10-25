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
  // 56 keeps soft waist AA bridges; 100+ punched holes through 琪寶寶 torso.
  alphaCut = 56,
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
 * Close vertical holes in opaque silhouette (腰／腿 slice).
 * Soft AA at a natural waist pinch dies under alpha harden — fill runs of
 * up to `maxGap` transparent px between opaque neighbors (multi-pass).
 */
export function closeVerticalAlphaGaps(scene: TexScene, key: string, maxGap = 3) {
  if (!scene.textures.exists(key)) return
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const w = (src as { width: number }).width | 0
  const h = (src as { height: number }).height | 0
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src as CanvasImageSource, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const alpha = (x: number, y: number) => d[(y * w + x) * 4 + 3]
  const fill = (x: number, y: number, ai: number, bi: number, t: number) => {
    const i = (y * w + x) * 4
    d[i] = Math.round(d[ai] * (1 - t) + d[bi] * t)
    d[i + 1] = Math.round(d[ai + 1] * (1 - t) + d[bi + 1] * t)
    d[i + 2] = Math.round(d[ai + 2] * (1 - t) + d[bi + 2] * t)
    d[i + 3] = 255
  }
  // Several passes: 琪寶寶 waist soft band is ~2–3px after harden.
  for (let pass = 0; pass < maxGap; pass++) {
    for (let x = 0; x < w; x++) {
      let y = 0
      while (y < h) {
        while (y < h && alpha(x, y) >= 128) y++
        const gapStart = y
        while (y < h && alpha(x, y) < 128) y++
        const gapEnd = y
        const gapLen = gapEnd - gapStart
        if (gapLen < 1 || gapLen > maxGap) continue
        if (gapStart < 1 || gapEnd >= h) continue
        if (alpha(x, gapStart - 1) < 200 || alpha(x, gapEnd) < 200) continue
        const ai = ((gapStart - 1) * w + x) * 4
        const bi = (gapEnd * w + x) * 4
        for (let gy = gapStart; gy < gapEnd; gy++) {
          fill(x, gy, ai, bi, (gy - gapStart + 1) / (gapLen + 1))
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  if (scene.textures.exists(key)) scene.textures.remove(key)
  scene.textures.addCanvas(key, canvas)
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
}

/**
 * Fill enclosed transparent holes inside a silhouette (e.g. hair AA punch-through).
 * Soft source alpha + alphaCut leaves see-through gaps — fill with neighbor color
 * (prefer dark ink/hair), never leave hollow pixels inside one object.
 */
export function fillInternalAlphaHoles(
  scene: TexScene,
  key: string,
  fallback: [number, number, number] = [40, 34, 38],
) {
  if (!scene.textures.exists(key)) return
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const w = (src as { width: number }).width | 0
  const h = (src as { height: number }).height | 0
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src as CanvasImageSource, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= 160
  for (let pass = 0; pass < 5; pass++) {
    const todo: Array<{ i: number; r: number; g: number; b: number }> = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (d[i + 3] >= 160) continue
        let n = 0
        let dr = 0
        let dg = 0
        let db = 0
        let dn = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const xx = x + dx
            const yy = y + dy
            if (!opaque(xx, yy)) continue
            n++
            const j = (yy * w + xx) * 4
            const sum = d[j] + d[j + 1] + d[j + 2]
            if (sum < 320) {
              dr += d[j]
              dg += d[j + 1]
              db += d[j + 2]
              dn++
            }
          }
        }
        if (n < 4) continue
        todo.push({
          i,
          r: dn > 0 ? Math.round(dr / dn) : fallback[0],
          g: dn > 0 ? Math.round(dg / dn) : fallback[1],
          b: dn > 0 ? Math.round(db / dn) : fallback[2],
        })
      }
    }
    if (!todo.length) break
    for (const t of todo) {
      d[t.i] = t.r
      d[t.i + 1] = t.g
      d[t.i + 2] = t.b
      d[t.i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  if (scene.textures.exists(key)) scene.textures.remove(key)
  scene.textures.addCanvas(key, canvas)
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
}

/**
 * Grow a black outline around opaque silhouette — thicker SNES-style borders.
 */
export function thickenSpriteOutline(
  scene: TexScene,
  key: string,
  radius = 2,
  ink: [number, number, number] = [18, 12, 14],
) {
  if (!scene.textures.exists(key)) return
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const w = (src as { width: number }).width | 0
  const h = (src as { height: number }).height | 0
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src as CanvasImageSource, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const solid = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] >= 140 ? 1 : 0
  const ring: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (solid[idx]) continue
      // skip soft contact-shadow only regions (low alpha already transparent)
      let near = false
      for (let dy = -radius; dy <= radius && !near; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          if (solid[yy * w + xx]) {
            near = true
            break
          }
        }
      }
      if (near) ring.push(idx)
    }
  }
  for (const idx of ring) {
    const i = idx * 4
    d[i] = ink[0]
    d[i + 1] = ink[1]
    d[i + 2] = ink[2]
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  if (scene.textures.exists(key)) scene.textures.remove(key)
  scene.textures.addCanvas(key, canvas)
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
}

/** Force left/right edge columns identical so TileSprite repeats leave no vertical seam. */
export function sealTextureSeamsX(scene: TexScene, key: string) {
  if (!scene.textures.exists(key)) return
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const w = (src as { width: number }).width | 0
  const h = (src as { height: number }).height | 0
  if (w < 2) return
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src as CanvasImageSource, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    const li = (y * w) * 4
    const ri = (y * w + (w - 1)) * 4
    for (let c = 0; c < 4; c++) {
      const v = Math.round((d[li + c] + d[ri + c]) / 2)
      d[li + c] = v
      d[ri + c] = v
    }
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

/**
 * Build 4 run frames from a baked idle texture by shifting the lower leg band.
 * Keeps scale===1 / angle===0 (no shear tear) while feet visibly step.
 */
export function registerWalkCycle(scene: TexScene, baseKey: string, frames = 4) {
  if (!scene.textures.exists(baseKey)) return
  const src = scene.textures.get(baseKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const w = (src as { width: number }).width | 0
  const h = (src as { height: number }).height | 0
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d')!
  tctx.imageSmoothingEnabled = false
  tctx.clearRect(0, 0, w, h)
  tctx.drawImage(src as CanvasImageSource, 0, 0)
  const base = tctx.getImageData(0, 0, w, h)
  const legY0 = Math.floor(h * 0.58)
  const shifts = [0, 3, 0, -3]
  for (let f = 0; f < frames; f++) {
    const key = `${baseKey}-run-${f}`
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const out = ctx.createImageData(w, h)
    out.data.set(base.data)
    const shift = shifts[f % shifts.length]
    if (shift !== 0) {
      // Clear leg band then blit shifted opaque feet.
      for (let y = legY0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          out.data[i + 3] = 0
        }
      }
      for (let y = legY0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const si = (y * w + x) * 4
          if (base.data[si + 3] < 160) continue
          const dx = x + shift
          if (dx < 0 || dx >= w) continue
          const di = (y * w + dx) * 4
          out.data[di] = base.data[si]
          out.data[di + 1] = base.data[si + 1]
          out.data[di + 2] = base.data[si + 2]
          out.data[di + 3] = base.data[si + 3]
        }
      }
    }
    ctx.putImageData(out, 0, 0)
    if (scene.textures.exists(key)) scene.textures.remove(key)
    scene.textures.addCanvas(key, canvas)
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
  }
}


/**
 * Enemy walk + attack poses (scale 1 / angle 0).
 * - run-0..3: footstep
 * - atk-windup: lean back + raise arms (telegraph while still walking)
 * - atk-strike: lunge forward
 */
export function registerEnemyCombatFrames(scene: TexScene, baseKey: string) {
  registerWalkCycle(scene, baseKey, 4)
  if (!scene.textures.exists(baseKey)) return
  const src = scene.textures.get(baseKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const w = (src as { width: number }).width | 0
  const h = (src as { height: number }).height | 0
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d')!
  tctx.imageSmoothingEnabled = false
  tctx.drawImage(src as CanvasImageSource, 0, 0)
  const base = tctx.getImageData(0, 0, w, h)

  const bakeShift = (key: string, mode: 'windup' | 'strike') => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const out = ctx.createImageData(w, h)
    // clear
    for (let i = 3; i < out.data.length; i += 4) out.data[i] = 0
    const midY = Math.floor(h * 0.42)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4
        if (base.data[si + 3] < 160) continue
        let dx = 0
        let dy = 0
        if (mode === 'windup') {
          // Pull torso back, lift upper pixels (raise weapon / arms)
          if (y < midY) { dx = -3; dy = -2 }
          else { dx = -1 }
        } else {
          // Strike: whole body lunges forward; arms stretch
          if (y < midY) { dx = 5; dy = 1 }
          else { dx = 4 }
        }
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const di = (yy * w + xx) * 4
        out.data[di] = base.data[si]
        out.data[di + 1] = base.data[si + 1]
        out.data[di + 2] = base.data[si + 2]
        out.data[di + 3] = base.data[si + 3]
      }
    }
    ctx.putImageData(out, 0, 0)
    if (scene.textures.exists(key)) scene.textures.remove(key)
    scene.textures.addCanvas(key, canvas)
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
  }
  bakeShift(`${baseKey}-atk-windup`, 'windup')
  bakeShift(`${baseKey}-atk-strike`, 'strike')
}

export function setRunPose(spr: Phaser.GameObjects.Sprite, baseScale: number, phase: number) {
  const base =
    (spr.getData('baseTex') as string | undefined) ||
    spr.texture.key.replace(/-run-\d+$/, '').replace(/-atk-(windup|strike)$/, '').replace(/-atk-(windup|strike)$/, '')
  const frame = Math.floor(phase) % 4
  const key = `${base}-run-${frame}`
  if (spr.scene.textures.exists(key) && spr.texture.key !== key) {
    spr.setTexture(key)
  }
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

export function setIdlePose(spr: Phaser.GameObjects.Sprite, baseScale: number, _tMs: number) {
  const base = (spr.getData('baseTex') as string | undefined) || spr.texture.key.replace(/-run-\d+$/, '').replace(/-atk-(windup|strike)$/, '').replace(/-atk-(windup|strike)$/, '')
  if (spr.scene.textures.exists(base) && spr.texture.key !== base) {
    spr.setTexture(base)
  }
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

function restoreBaseTex(spr: Phaser.GameObjects.Sprite) {
  const base =
    (spr.getData('baseTex') as string | undefined) ||
    spr.texture.key.replace(/-run-\d+$/, '').replace(/-atk-(windup|strike)$/, '').replace(/-atk-(windup|strike)$/, '')
  if (spr.scene.textures.exists(base) && spr.texture.key !== base) {
    spr.setTexture(base)
  }
}

export function setJumpPose(spr: Phaser.GameObjects.Sprite, baseScale: number, _facing: number) {
  restoreBaseTex(spr)
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

export function setHurtPoseVisual(spr: Phaser.GameObjects.Sprite, baseScale: number, _facing: number) {
  restoreBaseTex(spr)
  setPixelPose(spr, baseScale, { squashX: 1, squashY: 1, angle: 0 })
}

export function setDiePoseVisual(spr: Phaser.GameObjects.Sprite, baseScale: number, _facing: number) {
  // Never rotate — even death tilt shears NEAREST quads into a smear.
  void _facing
  restoreBaseTex(spr)
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
