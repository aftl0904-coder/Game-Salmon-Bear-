import type Phaser from 'phaser'
import { FRIENDS, type FriendId } from './friends'

/** Cast shown large in front on the loading pile (88px). */
export const LOADING_CAST: ReadonlyArray<{ id: string; name: string; src: string; size: number }> = [
  { id: 'lunbo', name: '倫寶', src: 'art-salmon', size: 88 },
  { id: 'kibobo', name: '琪寶寶', src: 'art-girl', size: 88 },
  { id: 'pupu', name: '噗噗', src: 'art-bear', size: 88 },
]

/** All picnic friends from docs/bible/friends.md (56–72px). */
export const LOADING_FRIENDS: ReadonlyArray<{ id: FriendId; name: string; src: string; size: number }> = (
  Object.keys(FRIENDS) as FriendId[]
).map((id, i) => ({
  id,
  name: FRIENDS[id].name,
  src: `friend-${id}`,
  size: 56 + ((i * 3) % 17), // 56–72
}))

export const LOADING_BOOT_IMAGES: ReadonlyArray<{ key: string; url: string }> = [
  { key: 'art-salmon', url: '/art/salmon-boy.png' },
  { key: 'art-girl', url: '/art/bear-girl.png' },
  { key: 'art-bear', url: '/art/kind-bear.png' },
  { key: 'load-jar', url: '/art/items/jar-real.png' },
  ...LOADING_FRIENDS.map((f) => ({ key: f.src, url: `/art/friends/${f.id}.png` })),
]

/**
 * Crop the upper portion of a full-body / plush sprite into a Q-head texture.
 * Nearest scale 2–3× into `size` px tall — interim until dedicated head art lands.
 */
export function bakeQHead(scene: Phaser.Scene, srcKey: string, outKey: string, size: number) {
  if (!scene.textures.exists(srcKey)) return false
  if (scene.textures.exists(outKey)) scene.textures.remove(outKey)
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const sw = (src as { width: number }).width | 0
  const sh = (src as { height: number }).height | 0
  if (sw < 4 || sh < 4) return false

  // Head crop: top ~52–60% of sprite (friends are already head-heavy).
  const cropH = Math.max(8, Math.round(sh * (sh <= 76 ? 0.62 : 0.52)))
  const cropW = sw
  const cropY = 0
  const scale = Math.max(2, Math.min(3, Math.round(size / Math.max(1, cropH))))
  const midW = cropW * scale
  const midH = cropH * scale
  const th = size
  const tw = Math.max(8, Math.round(midW * (th / midH)))

  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, tw, th)
  ctx.drawImage(src as CanvasImageSource, 0, cropY, cropW, cropH, 0, 0, tw, th)
  scene.textures.addCanvas(outKey, canvas)
  return true
}

export function allLoadingHeadSpecs() {
  return [
    ...LOADING_CAST.map((c) => ({ ...c, out: `qhead-${c.id}` })),
    ...LOADING_FRIENDS.map((f) => ({ ...f, out: `qhead-${f.id}` })),
  ]
}
