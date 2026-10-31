import Phaser from 'phaser'
import { GAME_W, GAME_H, RENDER_SCALE } from './display'
import { markHd } from './heroAnims'

export type StageLightCfg = {
  id: string
  lightX: number
  lightY: number
  shadeColor: string
}

export type PointLightDef = {
  x: number
  y: number
  radius: number
  color: number
  intensity: number
}

/**
 * Full-screen multiply veil: bright near the light, darker at edges.
 * Values come from data/environment.json (per-stage lighting).
 */
export function addStageLighting(
  scene: Phaser.Scene,
  cfg: StageLightCfg,
): Phaser.GameObjects.Image {
  const W = GAME_W
  const H = GAME_H
  const key = `light-${cfg.id}`
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, W * RENDER_SCALE, H * RENDER_SCALE)
    if (!tex) throw new Error(`createCanvas failed for ${key}`)
    const ctx = tex.getContext()
    ctx.scale(RENDER_SCALE, RENDER_SCALE)
    const lx = W * cfg.lightX
    const ly = H * cfg.lightY
    const g = ctx.createRadialGradient(lx, ly, 8, lx, ly, W * 0.95)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, cfg.shadeColor)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    tex.refresh()
    markHd(tex, RENDER_SCALE)
  }
  return scene.add
    .image(0, 0, key)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(900)
    .setBlendMode(Phaser.BlendModes.MULTIPLY)
}

/**
 * Optional WebGL point lights (lantern / moonlight). No-op on Canvas renderer.
 */
export function addPointLights(
  scene: Phaser.Scene,
  sprites: Phaser.GameObjects.GameObject[],
  lights: PointLightDef[],
): void {
  try {
    if (scene.sys.renderer.type !== Phaser.WEBGL) return
    if (!lights.length || !sprites.length) return
    scene.lights.enable().setAmbientColor(0x8a8098)
    for (const l of lights) {
      scene.lights.addLight(l.x, l.y, l.radius, l.color, l.intensity)
    }
    for (const s of sprites) {
      const pipe = s as Phaser.GameObjects.GameObject & {
        active?: boolean
        setPipeline?: (name: string) => void
      }
      if (pipe.active && typeof pipe.setPipeline === 'function') {
        pipe.setPipeline('Light2D')
      }
    }
  } catch {
    /* WebGL Light2D unsupported — skip quietly */
  }
}
