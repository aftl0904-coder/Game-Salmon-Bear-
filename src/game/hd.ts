import Phaser from 'phaser'
import { RENDER_SCALE } from './display'

let installed = false

type Rect = Phaser.Geom.Rectangle
type Vec2 = Phaser.Math.Vector2

/** Runtime shape of Phaser's cameras (several members are absent from its type declarations). */
interface HdCamera {
  _hd?: boolean
  _prevDw?: number
  _prevDh?: number
  width: number
  height: number
  zoomX: number
  zoomY: number
  scrollX: number
  scrollY: number
  originX: number
  originY: number
  rotation: number
  roundPixels: boolean
  renderRoundPixels: boolean
  renderList: unknown[]
  useBounds: boolean
  _bounds: Rect
  _follow: { x: number; y: number } | null
  followOffset: Vec2
  lerp: Vec2
  deadzone: Rect | null
  midPoint: Vec2
  worldView: Rect
  matrix: Phaser.GameObjects.Components.TransformMatrix
  matrixExternal: Phaser.GameObjects.Components.TransformMatrix
  matrixCombined: Phaser.GameObjects.Components.TransformMatrix
  panEffect: { isRunning: boolean }
  shakeEffect: { preRender: () => void }
  x: number
  y: number
  rotationSet?: boolean
  emit: (event: string, ...args: unknown[]) => void
  panEffectIsRunning?: boolean
  clampX: (x: number) => number
  clampY: (y: number) => number
}

type Proto = Record<string, (this: HdCamera, ...args: never[]) => unknown>

/**
 * The game world, physics, level data and every scene are authored for a 640×360 canvas. To render at
 * RENDER_SCALE× sharpness the canvas is physically larger and every scene camera zooms by RENDER_SCALE.
 * Phaser's camera scroll is centre-based (the zoom pivot is the viewport centre), which would make
 * `scrollX` mean "world x of the screen centre minus half the canvas" and break every scrollFactor-0
 * HUD/background object. These patches switch HD cameras to a top-left pivot where scrollX/scrollY keep
 * meaning "world coordinate of the screen's left/top edge" at any zoom, exactly like the 1× game.
 */
export function installHd() {
  if (installed) return
  installed = true

  const camNs = Phaser.Cameras.Scene2D
  const base = camNs.BaseCamera.prototype as unknown as Proto
  const cam = camNs.Camera.prototype as unknown as Proto
  const mgr = camNs.CameraManager.prototype as unknown as { start: () => void; main?: Phaser.Cameras.Scene2D.Camera }

  const wrap = (proto: Proto, name: string, hd: (this: HdCamera, ...args: never[]) => unknown) => {
    const orig = proto[name]
    proto[name] = function (this: HdCamera, ...args: never[]) {
      return this._hd ? hd.apply(this, args) : orig.apply(this, args)
    }
  }

  const dispW = (c: HdCamera) => c.width / c.zoomX
  const dispH = (c: HdCamera) => c.height / c.zoomY

  wrap(base, 'clampX', function (this: HdCamera, x: number) {
    const b = this._bounds
    const dw = dispW(this)
    const max = Math.max(b.x, b.x + b.width - dw)
    return x < b.x ? b.x : x > max ? max : x
  })

  wrap(base, 'clampY', function (this: HdCamera, y: number) {
    const b = this._bounds
    const dh = dispH(this)
    const max = Math.max(b.y, b.y + b.height - dh)
    return y < b.y ? b.y : y > max ? max : y
  })

  wrap(base, 'getScroll', function (this: HdCamera, x: number, y: number, out?: Vec2) {
    const o = out ?? new Phaser.Math.Vector2()
    o.x = x - dispW(this) / 2
    o.y = y - dispH(this) / 2
    if (this.useBounds) {
      o.x = this.clampX(o.x)
      o.y = this.clampY(o.y)
    }
    return o
  })

  wrap(base, 'centerOnX', function (this: HdCamera, x: number) {
    this.midPoint.x = x
    this.scrollX = x - dispW(this) / 2
    if (this.useBounds) this.scrollX = this.clampX(this.scrollX)
    return this
  })

  wrap(base, 'centerOnY', function (this: HdCamera, y: number) {
    this.midPoint.y = y
    this.scrollY = y - dispH(this) / 2
    if (this.useBounds) this.scrollY = this.clampY(this.scrollY)
    return this
  })

  wrap(base, 'centerToBounds', function (this: HdCamera) {
    if (this.useBounds) {
      const b = this._bounds
      this.midPoint.set(b.centerX, b.centerY)
      this.scrollX = b.centerX - dispW(this) / 2
      this.scrollY = b.centerY - dispH(this) / 2
    }
    return this
  })

  wrap(base, 'centerToSize', function (this: HdCamera) {
    this.scrollX = 0
    this.scrollY = 0
    return this
  })

  const origStartFollow = cam.startFollow
  cam.startFollow = function (this: HdCamera, ...args: never[]) {
    const r = origStartFollow.apply(this, args)
    if (this._hd && this._follow) {
      const fx = this._follow.x - this.followOffset.x
      const fy = this._follow.y - this.followOffset.y
      this.midPoint.set(fx, fy)
      this.scrollX = fx - dispW(this) / 2
      this.scrollY = fy - dispH(this) / 2
      if (this.useBounds) {
        this.scrollX = this.clampX(this.scrollX)
        this.scrollY = this.clampY(this.scrollY)
      }
    }
    return r
  }

  const origSetDeadzone = cam.setDeadzone
  cam.setDeadzone = function (this: HdCamera, ...args: never[]) {
    const r = origSetDeadzone.apply(this, args)
    if (this._hd && this._follow && this.deadzone) {
      const fx = this._follow.x - this.followOffset.x
      const fy = this._follow.y - this.followOffset.y
      this.midPoint.set(fx, fy)
      this.scrollX = fx - dispW(this) / 2
      this.scrollY = fy - dispH(this) / 2
      Phaser.Geom.Rectangle.CenterOn(this.deadzone, this.midPoint.x, this.midPoint.y)
    }
    return r
  }

  wrap(cam, 'preRender', function (this: HdCamera) {
    this.renderList.length = 0

    const zoomX = this.zoomX
    const zoomY = this.zoomY
    const dw = this.width / zoomX
    const dh = this.height / zoomY
    this.renderRoundPixels = this.roundPixels && Number.isInteger(zoomX) && Number.isInteger(zoomY)

    // Zoom effects pivot on the viewport centre in the 1× game; keep that when zoom changes.
    if (!this.panEffect.isRunning && this._prevDw !== undefined && this._prevDh !== undefined) {
      this.scrollX += (this._prevDw - dw) / 2
      this.scrollY += (this._prevDh - dh) / 2
    }
    this._prevDw = dw
    this._prevDh = dh

    const follow = this._follow
    const deadzone = this.deadzone
    let sx = this.scrollX
    let sy = this.scrollY

    if (deadzone) Phaser.Geom.Rectangle.CenterOn(deadzone, this.midPoint.x, this.midPoint.y)

    let emitFollow = false
    if (follow && !this.panEffect.isRunning) {
      const lerp = this.lerp
      const fx = follow.x - this.followOffset.x
      const fy = follow.y - this.followOffset.y
      const lin = Phaser.Math.Linear
      if (deadzone) {
        if (fx < deadzone.x) sx = lin(sx, sx - (deadzone.x - fx), lerp.x)
        else if (fx > deadzone.right) sx = lin(sx, sx + (fx - deadzone.right), lerp.x)
        if (fy < deadzone.y) sy = lin(sy, sy - (deadzone.y - fy), lerp.y)
        else if (fy > deadzone.bottom) sy = lin(sy, sy + (fy - deadzone.bottom), lerp.y)
      } else {
        sx = lin(sx, fx - dw / 2, lerp.x)
        sy = lin(sy, fy - dh / 2, lerp.y)
      }
      emitFollow = true
    }

    if (this.useBounds) {
      sx = this.clampX(sx)
      sy = this.clampY(sy)
    }

    this.scrollX = sx
    this.scrollY = sy
    this.midPoint.set(sx + dw / 2, sy + dh / 2)
    this.worldView.setTo(sx, sy, dw, dh)

    const matrix = this.matrix
    const cx = this.width / 2
    const cy = this.height / 2
    matrix.loadIdentity()
    matrix.translate(cx, cy)
    matrix.rotate(this.rotation)
    matrix.translate(-cx, -cy)
    matrix.scale(zoomX, zoomY)
    matrix.translate(-sx, -sy)

    this.matrixExternal.applyITRS(this.x, this.y, 0, 1, 1)
    this.shakeEffect.preRender()
    this.matrixExternal.multiply(matrix, this.matrixCombined)

    if (emitFollow) this.emit('followupdate', this, follow)
  })

  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (...args: unknown[]) => Phaser.GameObjects.Text
  }
  const text = factory.text
  factory.text = function (this: unknown, ...args: unknown[]) {
    const t = text.apply(this, args)
    if (t.style.resolution <= 1) t.setResolution(RENDER_SCALE)
    return t
  }

  type PanFx = { camera: HdCamera; source: Vec2; isRunning: boolean; srcMid?: { x: number; y: number } }
  const pan = camNs.Effects.Pan.prototype as unknown as {
    start: (this: PanFx, ...a: never[]) => unknown
    update: (this: PanFx, ...a: never[]) => unknown
  }
  const panStart = pan.start
  pan.start = function (this: PanFx, ...a: never[]) {
    const r = panStart.apply(this, a)
    const c = this.camera
    if (c._hd) this.srcMid = { x: this.source.x + dispW(c) / 2, y: this.source.y + dispH(c) / 2 }
    return r
  }
  const panUpdate = pan.update
  pan.update = function (this: PanFx, ...a: never[]) {
    const c = this.camera
    if (c._hd && this.isRunning && this.srcMid) this.source.set(this.srcMid.x - dispW(c) / 2, this.srcMid.y - dispH(c) / 2)
    return panUpdate.apply(this, a)
  }

  const start = mgr.start
  mgr.start = function (this: typeof mgr) {
    start.call(this)
    const main = this.main as unknown as (HdCamera & Phaser.Cameras.Scene2D.Camera) | undefined
    if (main) {
      main._hd = true
      main._prevDw = undefined
      main._prevDh = undefined
      main.setOrigin(0, 0)
      main.setZoom(RENDER_SCALE)
    }
  }
}
