import type Phaser from 'phaser'
import { FRIENDS, type FriendId } from './friends'

/**
 * Loading poster heads — prefer Manus public/art/qhead/*.png (nearest integer scale).
 * Fallback: legacy portrait / loading-heads crop via bakeQHead.
 */

export type LoadingHeadSpec = {
  id: string
  name: string
  /** BootScene texture key (final display key is also qhead-<id>) */
  src: string
  /** public URL for Manus PNG (preferred) */
  url: string
  /** Legacy fallback URL if Manus PNG missing */
  fallbackUrl?: string
  /** Layout target size (before integer snap to PNG native) */
  size: number
  /** Native PNG edge (88 cast / 64 friends) */
  native: number
  crop: 'portrait-cell' | 'top' | 'full'
}

/** 倫／琪／噗 — largest, centre-bottom. */
export const LOADING_CAST: ReadonlyArray<LoadingHeadSpec> = [
  {
    id: 'lunbo',
    name: '倫寶',
    src: 'qhead-lunbo',
    url: '/art/qhead/qhead-lunbo.png',
    fallbackUrl: '/art/portraits/lunbo.png',
    size: 134,
    native: 88,
    crop: 'portrait-cell',
  },
  {
    id: 'kibobo',
    name: '琪寶寶',
    src: 'qhead-kibobo',
    url: '/art/qhead/qhead-kibobo.png',
    fallbackUrl: '/art/portraits/kibobo.png',
    size: 134,
    native: 88,
    crop: 'portrait-cell',
  },
  {
    id: 'pupu',
    name: '噗噗',
    src: 'qhead-pupu',
    url: '/art/qhead/qhead-pupu.png',
    fallbackUrl: '/art/custom/pupu-portrait.png',
    size: 134,
    native: 88,
    crop: 'full',
  },
]

/** Picnic friends — Manus 64×64 qheads. */
export const LOADING_FRIENDS: ReadonlyArray<LoadingHeadSpec> = (Object.keys(FRIENDS) as FriendId[]).map(
  (id) => ({
    id,
    name: FRIENDS[id].name,
    src: `qhead-${id}`,
    url: `/art/qhead/qhead-${id}.png`,
    fallbackUrl: `/art/loading-heads/${id}.png`,
    size: 92,
    native: 64,
    crop: 'full' as const,
  }),
)

export const LOADING_BOOT_IMAGES: ReadonlyArray<{ key: string; url: string }> = [
  ...LOADING_CAST.map((c) => ({ key: c.src, url: c.url })),
  ...LOADING_FRIENDS.map((f) => ({ key: f.src, url: f.url })),
  { key: 'load-jar-empty', url: '/art/qhead/load-jar-empty.png' },
  { key: 'load-jar-full', url: '/art/qhead/load-jar-full.png' },
  // Legacy jar fallback for older UI paths
  { key: 'load-jar', url: '/art/items/jar-real.png' },
]

/** Legacy fallback sources (portraits) — loaded only if qhead PNG failed. */
export const LOADING_FALLBACK_IMAGES: ReadonlyArray<{ key: string; url: string }> = [
  ...LOADING_CAST.filter((c) => c.fallbackUrl).map((c) => ({
    key: `load-port-${c.id}`,
    url: c.fallbackUrl!,
  })),
  ...LOADING_FRIENDS.filter((f) => f.fallbackUrl).map((f) => ({
    key: `load-friend-${f.id}`,
    url: f.fallbackUrl!,
  })),
]

/**
 * Bake a clear Q-head from high-res art with smooth downscale (not nearest upscale).
 * Used only when Manus qhead PNG is missing.
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

/** Integer nearest scale so display = native × N (no blur). */
export function integerDisplaySize(native: number, target: number): number {
  const n = Math.max(1, Math.round(target / Math.max(1, native)))
  return native * n
}

/**
 * Fixed poster slots (640×360): cast centre-bottom, friends on all four edges.
 */
const POSTER_SLOTS: ReadonlyArray<{ id: string; x: number; y: number; angle: number }> = [
  { id: 'lunbo', x: 168, y: 265, angle: -6 },
  { id: 'pupu', x: 320, y: 290, angle: 0 },
  { id: 'kibobo', x: 472, y: 265, angle: 6 },
  { id: 'huihui', x: 50, y: 48, angle: -5 },
  { id: 'guard', x: 155, y: 46, angle: 4 },
  { id: 'denim', x: 485, y: 46, angle: -4 },
  { id: 'brownie', x: 590, y: 48, angle: 5 },
  { id: 'snowcat', x: 48, y: 150, angle: -3 },
  { id: 'shiba', x: 592, y: 150, angle: 3 },
  { id: 'ginger', x: 222, y: 148, angle: 6 },
  { id: 'fleecy', x: 418, y: 148, angle: -6 },
  { id: 'kuro', x: 320, y: 162, angle: -2 },
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
