import Phaser from 'phaser'
import lunboMeta from '../../data/anim/lunbo.json'
import kiboboMeta from '../../data/anim/kibobo.json'
import pupuMeta from '../../data/anim/pupu.json'
import fishMeta from '../../data/anim/fish.json'
import hatsoldierMeta from '../../data/anim/hatsoldier.json'
import mechpigMeta from '../../data/anim/mechpig.json'
import beesoldierMeta from '../../data/anim/beesoldier.json'
import squirrelMeta from '../../data/anim/squirrel.json'
import minibeeMeta from '../../data/anim/minibee.json'
import eggMeta from '../../data/anim/egg.json'
import queenMeta from '../../data/anim/queen.json'
import lobsterMeta from '../../data/anim/lobster.json'
import stallkeeperMeta from '../../data/anim/stallkeeper.json'
import mirrorshadeMeta from '../../data/anim/mirrorshade.json'
import mirrorowlMeta from '../../data/anim/mirrorowl.json'
import tribossMeta from '../../data/anim/triboss.json'

/**
 * Frame-by-frame hero / companion animation from Cursor's action sheets
 * (sliced by scripts/art/slice_anim.py → public/art/anim/<set>.png + data/anim/<set>.json).
 *
 * Texture key: `anim-<set>` (spritesheet, uniform cells, feet on the bottom row, body centred).
 * Animation keys: `<set>-<anim>` e.g. `lunbo-walk`, `kibobo-slash2`, `pupu-tackle`.
 */

export type AnimSetId =
  | 'lunbo' | 'kibobo' | 'pupu' | 'fish' | 'hatsoldier' | 'mechpig'
  | 'beesoldier' | 'squirrel' | 'minibee' | 'egg' | 'queen'
  | 'lobster' | 'stallkeeper' | 'mirrorshade' | 'mirrorowl' | 'triboss'
type Meta = {
  frameWidth: number
  frameHeight: number
  anims: Record<string, { start: number; count: number; fps: number; loop: boolean }>
}

export const ANIM_SETS: Record<AnimSetId, Meta> = {
  lunbo: lunboMeta as Meta,
  kibobo: kiboboMeta as Meta,
  pupu: pupuMeta as Meta,
  fish: fishMeta as Meta,
  hatsoldier: hatsoldierMeta as Meta,
  mechpig: mechpigMeta as Meta,
  beesoldier: beesoldierMeta as Meta,
  squirrel: squirrelMeta as Meta,
  minibee: minibeeMeta as Meta,
  egg: eggMeta as Meta,
  queen: queenMeta as Meta,
  lobster: lobsterMeta as Meta,
  stallkeeper: stallkeeperMeta as Meta,
  mirrorshade: mirrorshadeMeta as Meta,
  mirrorowl: mirrorowlMeta as Meta,
  triboss: tribossMeta as Meta,
}

/** Enemy species (enemyAi) → animation set. */
export const SPECIES_ANIM: Record<string, AnimSetId> = {
  fish: 'fish',
  barrel: 'hatsoldier',
  elephant: 'mechpig',
}

/** Old single-image keys → the set whose idle frame replaces them (menus, HUD, clear card…). */
const STILL_KEYS: Record<string, AnimSetId> = {
  'art-salmon': 'lunbo',
  'art-girl': 'kibobo',
  'art-bear': 'pupu',
}

export function animTex(set: AnimSetId) {
  return `anim-${set}`
}

/** Dialogue portraits (scripts/art/slice_portraits.py): 3 frames, 72×72 — neutral / happy / shocked. */
export const PORTRAITS = ['lunbo', 'kibobo', 'pupu', 'pupu-hollow', 'coffee-mama', 'queen-bee'] as const
export function portraitTex(id: string) {
  return `portrait-${id}`
}

/** Story stills used so far (public/art/story, 640×360). Later stages add theirs here. */
export const STORY_STILLS = ['cover', 'c1-picnic', 'c1-hollow', 'c1-mama', 'c2-note', 'credits-bg', 'c2-bike', 's2-boss-intro', 'c3-queen', 'canopy-far',
  'c3-market', 's3-boss-intro', 'market-far', 'hotspring-far', 'c4-taxi', 'c5-bus', 'c6-screen', 'c7-boss', 'ending-1', 'ending-2',
  'c10-unmask', 'ending-3', 'hq-far', 'rooftop-far'] as const
export function stillTex(id: string) {
  return `story-${id}`
}

export function preloadHeroAnims(scene: Phaser.Scene) {
  for (const id of STORY_STILLS) scene.load.image(stillTex(id), `/art/story/${id}.png`)
  for (const id of PORTRAITS) {
    scene.load.spritesheet(portraitTex(id), `/art/portraits/${id}.png`, { frameWidth: 72, frameHeight: 72 })
  }
  for (const [id, m] of Object.entries(ANIM_SETS)) {
    scene.load.spritesheet(animTex(id as AnimSetId), `/art/anim/${id}.png`, {
      frameWidth: m.frameWidth,
      frameHeight: m.frameHeight,
    })
  }
}

export function hasAnimSet(scene: Phaser.Scene, set: AnimSetId) {
  const first = Object.keys(ANIM_SETS[set].anims)[0]
  return scene.textures.exists(animTex(set)) && !!first && scene.anims.exists(`${set}-${first}`)
}

/** Register every animation + replace the legacy still textures with the new idle frame. */
export function createHeroAnims(scene: Phaser.Scene) {
  for (const [id, m] of Object.entries(ANIM_SETS)) {
    const key = animTex(id as AnimSetId)
    if (!scene.textures.exists(key)) {
      console.error(`[heroAnims] missing ${key}`)
      continue
    }
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    for (const [name, a] of Object.entries(m.anims)) {
      const k = `${id}-${name}`
      if (scene.anims.exists(k)) continue
      scene.anims.create({
        key: k,
        frames: scene.anims.generateFrameNumbers(key, { start: a.start, end: a.start + a.count - 1 }),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      })
    }
  }
  for (const [still, set] of Object.entries(STILL_KEYS)) replaceStill(scene, still, set)
}

/** Still keys replaced by createHeroAnims (already outlined art — skip the legacy bake). */
export const REPLACED_STILLS = new Set<string>()

/** Crop the idle frame to its opaque bounds and install it under the old still key. */
function replaceStill(scene: Phaser.Scene, still: string, set: AnimSetId) {
  const key = animTex(set)
  if (!scene.textures.exists(key)) return
  const m = ANIM_SETS[set]
  const idle = m.anims.idle
  if (!idle) return
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement
  const fw = m.frameWidth
  const fh = m.frameHeight
  const c = document.createElement('canvas')
  c.width = fw
  c.height = fh
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, idle.start * fw, 0, fw, fh, 0, 0, fw, fh)
  const data = ctx.getImageData(0, 0, fw, fh).data
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (data[(y * fw + x) * 4 + 3]! > 0) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 3
  out.height = y1 - y0 + 2
  const octx = out.getContext('2d')!
  octx.imageSmoothingEnabled = false
  octx.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 1, 1, x1 - x0 + 1, y1 - y0 + 1)
  if (scene.textures.exists(still)) scene.textures.remove(still)
  scene.textures.addCanvas(still, out)
  scene.textures.get(still).setFilter(Phaser.Textures.FilterMode.NEAREST)
  REPLACED_STILLS.add(still)
}
