import type Phaser from 'phaser'
import { FRIENDS, type FriendId } from './friends'

/**
 * F2 loading poster heads — prefer highest-res portraits / friend sheets.
 * Cast ~134px centre-bottom; friends ~92px fill 640×360 (≥60% cover, no overlap).
 * Friends use public/art/loading-heads/*.png (HD magenta-keyed 256px).
 */

export type LoadingHeadSpec = {
  id: string
  name: string
  /** BootScene texture key */
  src: string
  /** public URL */
  url: string
  size: number
  /** Crop mode for bake */
  crop: 'portrait-cell' | 'top' | 'full'
}

/** 倫／琪／噗 — largest, centre-bottom. */
export const LOADING_CAST: ReadonlyArray<LoadingHeadSpec> = [
  {
    id: 'lunbo',
    name: '倫寶',
    src: 'load-port-lunbo',
    url: '/art/portraits/lunbo.png',
    size: 134,
    crop: 'portrait-cell',
  },
  {
    id: 'kibobo',
    name: '琪寶寶',
    src: 'load-port-kibobo',
    url: '/art/portraits/kibobo.png',
    size: 134,
    crop: 'portrait-cell',
  },
  {
    id: 'pupu',
    name: '噗噗',
    src: 'load-port-pupu',
    url: '/art/custom/pupu-portrait.png',
    size: 134,
    crop: 'full',
  },
]

/** Picnic friends — HD loading-heads; 3×134²+11×92² ≈ 63.8% of 640×360. */
export const LOADING_FRIENDS: ReadonlyArray<LoadingHeadSpec> = (Object.keys(FRIENDS) as FriendId[]).map(
  (id) => ({
    id,
    name: FRIENDS[id].name,
    src: `load-friend-${id}`,
    url: `/art/loading-heads/${id}.png`,
    size: 92,
    crop: 'full' as const,
  }),
)

export const LOADING_BOOT_IMAGES: ReadonlyArray<{ key: string; url: string }> = [
  ...LOADING_CAST.map((c) => ({ key: c.src, url: c.url })),
  ...LOADING_FRIENDS.map((f) => ({ key: f.src, url: f.url })),
  { key: 'load-jar', url: '/art/items/jar-real.png' },
]

/**
 * Bake a clear Q-head from high-res art with smooth downscale (not nearest upscale).
 */
export function bakeQHead(
  scene: Phaser.Scene,
  srcKey: string,
  outKey: string,
  size: number,
  crop: LoadingHeadSpec['crop'] = 'top',
) {
  if (!scene.textures.exists(srcKey)) return false
  if (scene.textures.exists(outKey)) scene.textures.remove(outKey)
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const sw = (src as { width: number }).width | 0
  const sh = (src as { height: number }).height | 0
  if (sw < 4 || sh < 4) return false

  let sx = 0
  let sy = 0
  let cw = sw
  let ch = sh
  if (crop === 'portrait-cell') {
    // 432×144 strip = 3×144 cells — use the first (clearest idle) cell.
    const cell = Math.min(sw, sh) || sh
    cw = cell
    ch = cell
    sx = 0
    sy = 0
  } else if (crop === 'top') {
    ch = Math.max(8, Math.round(sh * (sh <= 96 ? 0.7 : 0.55)))
    cw = sw
    sx = 0
    sy = 0
  } else {
    // full — square crop around upper body for tall portraits
    const side = Math.min(sw, sh)
    cw = side
    ch = side
    sx = Math.max(0, Math.floor((sw - side) / 2))
    sy = 0
  }

  const th = size
  const tw = Math.max(8, Math.round(size * (cw / ch)))
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, tw, th)
  ctx.drawImage(src as CanvasImageSource, sx, sy, cw, ch, 0, 0, tw, th)
  scene.textures.addCanvas(outKey, canvas)
  return true
}

export function allLoadingHeadSpecs() {
  return [
    ...LOADING_CAST.map((c) => ({ ...c, out: `qhead-${c.id}` })),
    ...LOADING_FRIENDS.map((f) => ({ ...f, out: `qhead-${f.id}` })),
  ]
}

/**
 * Fixed poster slots (640×360): cast centre-bottom, friends on all four edges.
 * Gaps ≥4px between boxes; logo / jar / stamp zones left clear.
 * Cover: 3×134² + 11×92² ≈ 63.8%.
 */
const POSTER_SLOTS: ReadonlyArray<{ id: string; x: number; y: number; angle: number }> = [
  // Cast — largest, centre-bottom
  { id: 'lunbo', x: 168, y: 265, angle: -6 },
  { id: 'pupu', x: 320, y: 290, angle: 0 },
  { id: 'kibobo', x: 472, y: 265, angle: 6 },
  // Friends — top band (skip logo centre)
  { id: 'huihui', x: 50, y: 48, angle: -5 },
  { id: 'guard', x: 155, y: 46, angle: 4 },
  { id: 'denim', x: 485, y: 46, angle: -4 },
  { id: 'brownie', x: 590, y: 48, angle: 5 },
  // Mid sides + mid band
  { id: 'snowcat', x: 48, y: 150, angle: -3 },
  { id: 'shiba', x: 592, y: 150, angle: 3 },
  { id: 'ginger', x: 222, y: 148, angle: 6 },
  { id: 'fleecy', x: 418, y: 148, angle: -6 },
  { id: 'kuro', x: 320, y: 162, angle: -2 },
  // Lower sides (avoid jar / stamp)
  { id: 'gnome', x: 48, y: 255, angle: 4 },
  { id: 'tigercub', x: 592, y: 255, angle: -4 },
]

/** Non-overlapping poster layout for 640×360. Returns centre positions + angle. */
export function layoutLoadingPoster(
  specs: ReadonlyArray<{ id: string; size: number }>,
  _W = 640,
  _H = 360,
): Array<{ id: string; x: number; y: number; size: number; angle: number }> {
  const byId = new Map(specs.map((s) => [s.id, s]))
  const out: Array<{ id: string; x: number; y: number; size: number; angle: number }> = []
  for (const slot of POSTER_SLOTS) {
    const s = byId.get(slot.id)
    if (!s) continue
    out.push({ id: slot.id, x: slot.x, y: slot.y, size: s.size, angle: slot.angle })
  }
  for (const s of specs) {
    if (out.some((p) => p.id === s.id)) continue
    out.push({ id: s.id, x: 320, y: 180, size: s.size, angle: 0 })
  }
  return out
}
