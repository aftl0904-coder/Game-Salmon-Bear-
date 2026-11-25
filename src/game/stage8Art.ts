/**
 * art-s8 — wire Manus stage-8 sheets (#157 assets on main).
 * Backgrounds A–E, enemy/boss atlases (JSON `frames` authoritative), props, S8 story stills.
 */
import Phaser from 'phaser'
import { GAME_H, GAME_W } from './display'
import { DEPTH } from './engine/depth'
import { markHd } from './heroAnims'
import { stage7ViewportSlice } from './stage7BackdropLayout'
import stage8Raw from '../../data/levels/stage8.json'
import s8droneMeta from '../../data/anim/s8drone.json'
import s8tubeMeta from '../../data/anim/s8tube.json'
import s8cabinetMeta from '../../data/anim/s8cabinet.json'
import s8researcherMeta from '../../data/anim/s8researcher.json'

export type Stage8AnimId = 's8drone' | 's8tube' | 's8cabinet' | 's8researcher'

type AnimDef = {
  start?: number
  count?: number
  frames?: number[]
  fps: number
  loop: boolean
}

type SheetMeta = {
  frameWidth: number
  frameHeight: number
  res?: number
  columns?: number
  anims: Record<string, AnimDef>
  /** Extra Phaser anim keys that reuse another anim's frames (stand-in name → real name). */
  aliases?: Record<string, string>
  sheet: string
}

const SHEETS: Record<Stage8AnimId, SheetMeta> = {
  s8drone: {
    ...(s8droneMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage8/enemies/s8drone.png',
    aliases: {
      // Stage8Enemies stand-in names → sheet anims
      fly: 'idle',
      aim: 'warning',
      dive: 'attack',
      stuck: 'idle',
      hit: 'hurt',
      die: 'defeat',
      walk: 'walk',
    },
  },
  s8tube: {
    ...(s8tubeMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage8/enemies/s8tube.png',
    aliases: {
      reach: 'warning',
      hit: 'hurt',
      die: 'defeat',
    },
  },
  s8cabinet: {
    ...(s8cabinetMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage8/enemies/s8cabinet-draft.png',
    aliases: {
      reach: 'warning',
      hit: 'hurt',
      die: 'defeat',
    },
  },
  s8researcher: {
    ...(s8researcherMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage8/enemies/s8researcher-draft.png',
    aliases: {
      // ChiefResearcher used triboss names previously
      rain: 'board_sweep',
      point: 'bottle_throw',
      hurt: 'hurt',
      hit: 'hurt',
      die: 'defeat',
      defeat: 'defeat',
      idle: 'idle',
    },
  },
}

/** Eight story stills — texture key `story-<filename-without-ext>`. */
export const STAGE8_STORY_STILLS = [
  'S8_A_無人接待全景',
  'S8_B_真蜜腳印與假蜜管道對照',
  'S8_C_監視器內噗噗舔掌',
  'S8_C_監視器內噗噗離開',
  'S8_D_原稿與摘要並排',
  'S8_D_下層門前蜜印',
  'S8_E_綠色進度與受傷動物',
  'S8_E_主任擋住報告',
] as const

/** Section enter still (one plate each). C uses pupu monitor mid stills instead. */
export const STAGE8_SECTION_ENTER_STILL: Record<string, string> = {
  A: 'S8_A_無人接待全景',
  B: 'S8_B_真蜜腳印與假蜜管道對照',
  D: 'S8_D_原稿與摘要並排',
  E: 'S8_E_綠色進度與受傷動物',
}

export const STAGE8_SECTION_MID_STILL: Record<string, string> = {
  D: 'S8_D_下層門前蜜印',
}

/** Pre-boss still. */
export const STAGE8_BOSS_STILL = 'S8_E_主任擋住報告'

const BG_KEYS = {
  A: 's8-bg-reception',
  B: 's8-bg-pipes',
  C: 's8-bg-machine',
  D: 's8-bg-records',
  E: 's8-bg-control',
} as const

const BG_FILES: Record<keyof typeof BG_KEYS, string> = {
  A: 'bg-reception',
  B: 'bg-pipes',
  C: 'bg-machine',
  D: 'bg-records',
  E: 'bg-control',
}

export function stage8AnimTex(id: Stage8AnimId) {
  return `anim-${id}`
}

export function hasStage8Anim(scene: Phaser.Scene, id: Stage8AnimId) {
  const first = Object.keys(SHEETS[id].anims)[0]
  return scene.textures.exists(stage8AnimTex(id)) && !!first && scene.anims.exists(`${id}-${first}`)
}

export function preloadStage8Art(scene: Phaser.Scene) {
  for (const [id, m] of Object.entries(SHEETS) as [Stage8AnimId, SheetMeta][]) {
    scene.load.spritesheet(stage8AnimTex(id), m.sheet, {
      frameWidth: m.frameWidth,
      frameHeight: m.frameHeight,
    })
  }
  for (const [seg, file] of Object.entries(BG_FILES) as [keyof typeof BG_FILES, string][]) {
    scene.load.image(BG_KEYS[seg], `/art/stage8/${file}.png`)
  }
  for (const name of [
    'bookshelf',
    'cart',
    'pipe-normal',
    'pipe-shake',
    'pipe-shake-left',
    'pipe-shake-right',
    'pipe-spray',
    'server-platform',
    'valve-normal',
    'valve-broken',
  ] as const) {
    scene.load.image(`s8-prop-${name}`, `/art/stage8/props/${name}.png`)
  }
  for (const id of STAGE8_STORY_STILLS) {
    scene.load.image(`story-${id}`, `/art/story/${id}.png`)
  }
}

function framesFor(scene: Phaser.Scene, texKey: string, a: AnimDef): Phaser.Types.Animations.AnimationFrame[] {
  if (a.frames?.length) {
    return a.frames.map((frame) => ({ key: texKey, frame }))
  }
  const start = a.start ?? 0
  const count = a.count ?? 1
  return scene.anims.generateFrameNumbers(texKey, { start, end: start + count - 1 })
}

export function createStage8Anims(scene: Phaser.Scene) {
  for (const [id, m] of Object.entries(SHEETS) as [Stage8AnimId, SheetMeta][]) {
    const key = stage8AnimTex(id)
    if (!scene.textures.exists(key)) {
      console.error(`[stage8Art] missing ${key}`)
      continue
    }
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    markHd(scene.textures.get(key), m.res ?? 1)
    for (const [name, a] of Object.entries(m.anims)) {
      const animKey = `${id}-${name}`
      if (scene.anims.exists(animKey)) continue
      scene.anims.create({
        key: animKey,
        frames: framesFor(scene, key, a),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      })
    }
    for (const [alias, target] of Object.entries(m.aliases ?? {})) {
      const aliasKey = `${id}-${alias}`
      if (scene.anims.exists(aliasKey)) continue
      const srcDef = m.anims[target]
      if (!srcDef) continue
      scene.anims.create({
        key: aliasKey,
        frames: framesFor(scene, key, srcDef),
        frameRate: srcDef.fps,
        repeat: srcDef.loop ? -1 : 0,
      })
    }
  }
  for (const id of STAGE8_STORY_STILLS) {
    const key = `story-${id}`
    if (scene.textures.exists(key)) markHd(scene.textures.get(key), 2)
  }
  for (const k of Object.values(BG_KEYS)) {
    if (scene.textures.exists(k)) markHd(scene.textures.get(k), 1)
  }
}

export type LabFarPlates = Record<'A' | 'B' | 'C' | 'D' | 'E', Phaser.GameObjects.Image | null>

/** Mount A–E far plates (640×360). Call updateLabBackdrops each frame. */
export function mountLabFarPlates(scene: Phaser.Scene): LabFarPlates {
  const far = (seg: keyof typeof BG_KEYS) => {
    const key = BG_KEYS[seg]
    if (!scene.textures.exists(key)) return null
    return scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.SKY_BAND)
      .setDisplaySize(GAME_W, GAME_H)
      .setVisible(false)
      .setName(`stage8-bg-${seg}`)
  }
  return { A: far('A'), B: far('B'), C: far('C'), D: far('D'), E: far('E') }
}

export function updateLabBackdrops(plates: LabFarPlates, scrollX: number) {
  const segments = (stage8Raw as { segments?: Array<{ id: string; x0: number; x1: number }> }).segments
  if (!segments?.length) return
  const ids = ['A', 'B', 'C', 'D', 'E'] as const
  for (let i = 0; i < ids.length; i++) {
    const image = plates[ids[i]!]
    const segment = segments[i]
    if (!image || !segment) continue
    const slice = stage7ViewportSlice(segment.x0, segment.x1, scrollX, GAME_W)
    image.setVisible(!!slice)
    if (!slice) continue
    image.setCrop()
    image.setPosition(slice.x, 0)
    image.setDisplaySize(slice.width, GAME_H)
  }
}

/** Place non-collision décor: bookshelf on D moving shelf, server on C shelf. Carts use checkpoint path. */
export function placeLabProps(
  scene: Phaser.Scene,
  floorY: number,
  opts: { shelfX?: number; movingX?: number },
) {
  if (scene.textures.exists('s8-prop-server-platform') && opts.shelfX != null) {
    scene.add
      .image(opts.shelfX, floorY - 140, 's8-prop-server-platform')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.PROP - 1)
      .setName('stage8-server')
  }
  if (scene.textures.exists('s8-prop-bookshelf') && opts.movingX != null) {
    scene.add
      .image(opts.movingX, floorY - 16, 's8-prop-bookshelf')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.PROP)
      .setName('stage8-bookshelf')
  }
}
