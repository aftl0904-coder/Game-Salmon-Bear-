/**
 * palette-1 — per-stage sky / tint / fog / light overlays.
 * Does not swap bg art, recolor cast/enemies, or tint UI.
 */
import Phaser from 'phaser'
import { GAME_W, GAME_H, RENDER_SCALE } from './display'
import { DEPTH } from './engine/depth'
import { markHd } from './heroAnims'
import stagePalettesRaw from '../../data/stage-palettes.json'

export type SkyPair = { top: string; bottom: string }
export type FogDef = { color: string; alpha: number }
export type SunriseDef = {
  atX: number
  durationMs: number
  sky: SkyPair
  tint: string | null
  light: number
}
export type StagePaletteRow = {
  stage: number
  name: string
  sky: SkyPair
  tint: string | null
  fog: FogDef | null
  light: number
  sunrise?: SunriseDef
}

const ROWS = (stagePalettesRaw as { stages: StagePaletteRow[] }).stages

export function stagePalette(stageNo: number): StagePaletteRow | undefined {
  return ROWS.find((r) => r.stage === stageNo)
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

function lerpHex(a: string, b: string, t: number): string {
  const ai = hexToInt(a)
  const bi = hexToInt(b)
  const ar = (ai >> 16) & 0xff
  const ag = (ai >> 8) & 0xff
  const ab = ai & 0xff
  const br = (bi >> 16) & 0xff
  const bg = (bi >> 8) & 0xff
  const bb = bi & 0xff
  const k = Math.max(0, Math.min(1, t))
  const r = Math.round(ar + (br - ar) * k)
  const g = Math.round(ag + (bg - ag) * k)
  const bl = Math.round(ab + (bb - ab) * k)
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`
}

function ensureSkyTexture(scene: Phaser.Scene, key: string, sky: SkyPair) {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const tex = scene.textures.createCanvas(key, GAME_W * RENDER_SCALE, GAME_H * RENDER_SCALE)
  if (!tex) return null
  const ctx = tex.getContext()
  ctx.scale(RENDER_SCALE, RENDER_SCALE)
  const g = ctx.createLinearGradient(0, 0, 0, GAME_H)
  g.addColorStop(0, sky.top)
  g.addColorStop(1, sky.bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, GAME_W, GAME_H)
  tex.refresh()
  markHd(tex, RENDER_SCALE)
  return key
}

/** Depth: sky behind all; fog above parallax bg, below tilemap; light below UI. */
const FOG_DEPTH = 50
const LIGHT_DEPTH = DEPTH.UI - 2

export type PaletteHandles = {
  stageNo: number
  row: StagePaletteRow
  skyKey: string
  skyImg: Phaser.GameObjects.Image
  fog: Phaser.GameObjects.Rectangle | null
  light: Phaser.GameObjects.Rectangle | null
  tintTargets: Array<Phaser.GameObjects.Components.Tint & Phaser.GameObjects.GameObject>
  sunriseStarted: boolean
  sunriseT: number
  baseTint: string | null
}

function collectTintTargets(scene: Phaser.Scene): Array<Phaser.GameObjects.Components.Tint & Phaser.GameObjects.GameObject> {
  const out: Array<Phaser.GameObjects.Components.Tint & Phaser.GameObjects.GameObject> = []
  for (const obj of scene.children.list) {
    const any = obj as Phaser.GameObjects.GameObject & {
      depth?: number
      setTint?: (c: number) => void
    }
    const d = any.depth
    if (typeof d !== 'number' || d < DEPTH.SKY_BAND || d >= DEPTH.TILEMAP) continue
    if (typeof any.setTint === 'function') {
      out.push(any as Phaser.GameObjects.Components.Tint & Phaser.GameObjects.GameObject)
    }
  }
  return out
}

function applyTint(
  targets: Array<Phaser.GameObjects.Components.Tint & Phaser.GameObjects.GameObject>,
  tint: string | null,
) {
  if (!tint) return
  const c = hexToInt(tint)
  for (const t of targets) {
    if ((t as Phaser.GameObjects.GameObject).active) t.setTint(c)
  }
}

function setLightOverlay(rect: Phaser.GameObjects.Rectangle | null, light: number) {
  if (!rect) return
  if (Math.abs(light - 1) < 0.001) {
    rect.setVisible(false)
    return
  }
  rect.setVisible(true)
  if (light < 1) {
    rect.setFillStyle(0x000000, Math.min(0.55, 1 - light))
    rect.setBlendMode(Phaser.BlendModes.NORMAL)
  } else {
    // Gentle lift — keep mobile-cheap (no post-FX).
    rect.setFillStyle(0xfff8e8, Math.min(0.45, (light - 1) * 0.9))
    rect.setBlendMode(Phaser.BlendModes.ADD)
  }
}

/**
 * Install sky / fog / light / optional bg tint for the given stage.
 * Call once after drawWorld(). Does not touch UI or actors.
 */
export function installStagePalette(scene: Phaser.Scene, stageNo: number): PaletteHandles | null {
  const row = stagePalette(stageNo)
  if (!row) return null

  const skyKey = `stage-palette-sky-${stageNo}`
  ensureSkyTexture(scene, skyKey, row.sky)
  const skyImg = scene.add
    .image(0, 0, skyKey)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(DEPTH.SKY)
    .setDisplaySize(GAME_W, GAME_H)

  const tintTargets = collectTintTargets(scene)
  applyTint(tintTargets, row.tint)

  let fog: Phaser.GameObjects.Rectangle | null = null
  if (row.fog) {
    fog = scene.add
      .rectangle(0, 0, GAME_W, GAME_H, hexToInt(row.fog.color), row.fog.alpha)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(FOG_DEPTH)
  }

  // Light overlay always allocated so sunrise can tween it; hidden when light≈1.
  const light = scene.add
    .rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(LIGHT_DEPTH)
  setLightOverlay(light, row.light)

  return {
    stageNo,
    row,
    skyKey,
    skyImg,
    fog,
    light,
    tintTargets,
    sunriseStarted: false,
    sunriseT: 0,
    baseTint: row.tint,
  }
}

/** Stage 10: when leadX crosses sunrise.atX, lerp sky/tint/light over durationMs. */
export function tickStagePalette(
  handles: PaletteHandles | null,
  scene: Phaser.Scene,
  leadX: number,
  dt: number,
) {
  if (!handles?.row.sunrise) return
  const sun = handles.row.sunrise
  if (!handles.sunriseStarted) {
    if (leadX < sun.atX) return
    handles.sunriseStarted = true
    handles.sunriseT = 0
  }
  if (handles.sunriseT >= sun.durationMs) return
  handles.sunriseT = Math.min(sun.durationMs, handles.sunriseT + dt)
  const t = handles.sunriseT / sun.durationMs
  const sky: SkyPair = {
    top: lerpHex(handles.row.sky.top, sun.sky.top, t),
    bottom: lerpHex(handles.row.sky.bottom, sun.sky.bottom, t),
  }
  ensureSkyTexture(scene, handles.skyKey, sky)
  handles.skyImg.setTexture(handles.skyKey)

  const tintHex =
    handles.baseTint && sun.tint
      ? lerpHex(handles.baseTint, sun.tint, t)
      : sun.tint ?? handles.baseTint
  applyTint(handles.tintTargets, tintHex)

  const light = handles.row.light + (sun.light - handles.row.light) * t
  setLightOverlay(handles.light, light)
}
