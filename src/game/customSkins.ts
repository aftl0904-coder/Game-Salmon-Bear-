import Phaser from 'phaser'
import { ANIM_SETS, animTex, portraitTex, stillTex } from './heroAnims'

/**
 * Owner-supplied art slots (public/art/custom/custom.json + images in that folder).
 * Nothing ships in them; when the owner drops images in and lists them, they replace
 * 噗噗's frames / portrait or any story still at boot. See public/art/custom/README.md.
 */

type PupuSlot = {
  /** Visible height of the bear inside its 88×73 frame (default 60 — same as the built-in one). */
  height?: number
  /** Anim name → list of image files (any size, transparent PNG). Missing anims reuse `idle`. */
  anims?: Partial<Record<'idle' | 'walk' | 'cute-pose' | 'tackle' | 'hollow-idle' | 'wake-up', string[]>>
  /** Dialogue portrait: 1 file (used for all faces) or 3 files: neutral / happy / shocked. */
  portrait?: string | string[]
}
type CustomCfg = { pupu?: PupuSlot | null; stills?: Record<string, string> | null }

const DIR = '/art/custom/'
const k = (file: string) => `custom:${file}`

export function preloadCustomConfig(scene: Phaser.Scene) {
  scene.load.json('custom-skins', `${DIR}custom.json`)
}

function cfgOf(scene: Phaser.Scene): CustomCfg {
  const c = scene.cache.json.get('custom-skins') as CustomCfg | undefined
  return c && typeof c === 'object' ? c : {}
}

/** Load whatever the config lists, apply it, then continue boot. */
export function loadCustomSkins(scene: Phaser.Scene, done: () => void) {
  const cfg = cfgOf(scene)
  const files = new Set<string>()
  for (const list of Object.values(cfg.pupu?.anims ?? {})) for (const f of list ?? []) files.add(f)
  const p = cfg.pupu?.portrait
  for (const f of Array.isArray(p) ? p : p ? [p] : []) files.add(f)
  for (const f of Object.values(cfg.stills ?? {})) if (f) files.add(f)
  if (!files.size) return done()
  for (const f of files) scene.load.image(k(f), `${DIR}${f}`)
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    try {
      applyPupu(scene, cfg.pupu)
      applyStills(scene, cfg.stills)
    } catch (e) {
      console.error('[customSkins] could not apply', e)
    }
    done()
  })
  scene.load.start()
}

function img(scene: Phaser.Scene, file: string): CanvasImageSource | null {
  return scene.textures.exists(k(file)) ? (scene.textures.get(k(file)).getSourceImage() as CanvasImageSource) : null
}

/** Draw `src` bottom-centred into a cell, scaled to `h` px tall (and never wider than the cell). */
function drawFit(ctx: CanvasRenderingContext2D, src: CanvasImageSource, cx: number, cw: number, ch: number, h: number, grey = false) {
  const sw = (src as HTMLImageElement).width
  const sh = (src as HTMLImageElement).height
  if (!sw || !sh) return
  const s = Math.min(h / sh, (cw - 2) / sw)
  const w = Math.round(sw * s)
  const hh = Math.round(sh * s)
  ctx.imageSmoothingEnabled = s < 1
  ctx.filter = grey ? 'grayscale(1) brightness(0.82)' : 'none'
  ctx.drawImage(src, cx + Math.round((cw - w) / 2), ch - hh, w, hh)
  ctx.filter = 'none'
}

function applyPupu(scene: Phaser.Scene, slot: PupuSlot | null | undefined) {
  if (!slot) return
  const meta = ANIM_SETS.pupu
  const fw = meta.frameWidth
  const fh = meta.frameHeight
  const h = Math.min(fh, slot.height ?? 60)
  const names = Object.keys(meta.anims)
  const listFor = (name: string): { files: string[]; grey: boolean } => {
    const a = slot.anims ?? {}
    const own = (a as Record<string, string[] | undefined>)[name]
    if (own?.length) return { files: own, grey: false }
    // Hollow (grey) frames default to the idle frames, desaturated.
    if (name === 'hollow-idle') return { files: a.idle ?? [], grey: true }
    return { files: a.idle ?? [], grey: false }
  }
  const plan = names.map((n) => ({ n, ...listFor(n) })).filter((p) => p.files.some((f) => img(scene, f)))
  if (plan.length) {
    const total = plan.reduce((s, p) => s + p.files.length, 0)
    const c = document.createElement('canvas')
    c.width = fw * total
    c.height = fh
    const ctx = c.getContext('2d')!
    let i = 0
    const starts: Record<string, { start: number; count: number }> = {}
    for (const p of plan) {
      starts[p.n] = { start: i, count: p.files.length }
      for (const f of p.files) {
        const src = img(scene, f)
        if (src) drawFit(ctx, src, i * fw, fw, fh, h, p.grey)
        i++
      }
    }
    const key = animTex('pupu')
    for (const n of names) scene.anims.remove(`pupu-${n}`)
    if (scene.textures.exists(key)) scene.textures.remove(key)
    const tex = scene.textures.addCanvas(key, c)!
    for (let f = 0; f < total; f++) tex.add(f, 0, f * fw, 0, fw, fh)
    for (const n of names) {
      const a = meta.anims[n]!
      const s = starts[n] ?? starts.idle ?? { start: 0, count: 1 }
      scene.anims.create({
        key: `pupu-${n}`,
        frames: Array.from({ length: s.count }, (_, j) => ({ key, frame: s.start + j })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      })
    }
    // Legacy still key used by a few fallbacks.
    const still = document.createElement('canvas')
    still.width = fw
    still.height = fh
    still.getContext('2d')!.drawImage(c, 0, 0, fw, fh, 0, 0, fw, fh)
    if (scene.textures.exists('art-bear')) scene.textures.remove('art-bear')
    scene.textures.addCanvas('art-bear', still)
  }
  // Portrait strip: 3 faces of 72×72 (neutral / happy / shocked), plus a grey copy for the hollow bear.
  const p = slot.portrait
  const faces = (Array.isArray(p) ? p : p ? [p, p, p] : []).map((f) => img(scene, f))
  if (faces.length && faces.every(Boolean)) {
    for (const [id, grey] of [['pupu', false], ['pupu-hollow', true]] as const) {
      const c = document.createElement('canvas')
      c.width = 72 * 3
      c.height = 72
      const ctx = c.getContext('2d')!
      for (let j = 0; j < 3; j++) drawFit(ctx, faces[Math.min(j, faces.length - 1)]!, j * 72, 72, 72, 72, grey)
      const key = portraitTex(id)
      if (scene.textures.exists(key)) scene.textures.remove(key)
      const tex = scene.textures.addCanvas(key, c)!
      for (let j = 0; j < 3; j++) tex.add(j, 0, j * 72, 0, 72, 72)
    }
  }
}

/** Replace story stills (cover, c1-picnic, ...) — the image is scaled to cover 640×360. */
function applyStills(scene: Phaser.Scene, stills: Record<string, string> | null | undefined) {
  for (const [id, file] of Object.entries(stills ?? {})) {
    const src = img(scene, file)
    if (!src) continue
    const sw = (src as HTMLImageElement).width
    const sh = (src as HTMLImageElement).height
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 360
    const s = Math.max(640 / sw, 360 / sh)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(src, (640 - sw * s) / 2, (360 - sh * s) / 2, sw * s, sh * s)
    const key = stillTex(id)
    if (scene.textures.exists(key)) scene.textures.remove(key)
    scene.textures.addCanvas(key, c)
  }
}
