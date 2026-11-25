/**
 * art-s9s10 — wire Manus #173 stage 9–10 enemy/boss sheets.
 * JSON `frames` lists are authoritative; FPS are preview-only.
 */
import Phaser from 'phaser'
import { markHd } from './heroAnims'
import s9jailguardMeta from '../../data/anim/s9jailguard.json'
import s9lockbotMeta from '../../data/anim/s9lockbot.json'
import s9chiefMeta from '../../data/anim/s9chief.json'
import s10buildingguardMeta from '../../data/anim/s10buildingguard.json'
import s10leonMeta from '../../data/anim/s10leon.json'

export type Stage910AnimId =
  | 's9jailguard'
  | 's9lockbot'
  | 's9chief'
  | 's10buildingguard'
  | 's10leon'

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
  aliases?: Record<string, string>
  sheet: string
}

const SHEETS: Record<Stage910AnimId, SheetMeta> = {
  s9jailguard: {
    ...(s9jailguardMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage9/enemies/s9jailguard.png',
    aliases: {
      // JailGuard stand-in names → sheet anims
      reach: 'warning',
      hit: 'hurt',
      die: 'defeat',
    },
  },
  s9lockbot: {
    ...(s9lockbotMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage9/enemies/s9lockbot.png',
    aliases: {
      reach: 'warning',
      hit: 'hurt',
      die: 'defeat',
    },
  },
  s9chief: {
    ...(s9chiefMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage9/enemies/s9chief.png',
    aliases: {
      // ChiefWarden used triboss names previously
      rain: 'baton_sweep',
      point: 'key_throw',
      hurt: 'hurt',
      hit: 'hurt',
      die: 'defeat',
      idle: 'idle',
      defeat: 'defeat',
      // warn/act pairs used by go()
      slamWarn: 'baton_warning',
      slam: 'baton_sweep',
      keyWarn: 'key_warning',
      keyThrow: 'key_throw',
      gateWarn: 'gate_warning',
      gateDrop: 'gate_action',
      keysDown: 'weakpoint_glow',
      open_cage: 'open_cage',
    },
  },
  s10buildingguard: {
    ...(s10buildingguardMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage10/enemies/s10buildingguard.png',
    aliases: {
      reach: 'warning',
      hit: 'hurt',
      die: 'defeat',
    },
  },
  s10leon: {
    ...(s10leonMeta as Omit<SheetMeta, 'sheet' | 'aliases'>),
    sheet: '/art/stage10/enemies/s10leon.png',
    aliases: {
      idle: 'idle',
      walk: 'idle',
      hurt: 'hurt',
      hit: 'hurt',
      die: 'defeat',
      defeat: 'defeat',
      rain: 'charge',
      point: 'shield_bash',
      // Leon act aliases
      chargeWarn: 'charge_warning',
      charge: 'charge',
      tired: 'exhausted_glow',
      shieldWarn: 'shield_warning',
      shieldBash: 'shield_bash',
      callWarn: 'call_warning',
      unlock: 'unlock',
    },
  },
}

export function stage910AnimTex(id: Stage910AnimId) {
  return `anim-${id}`
}

export function hasStage910Anim(scene: Phaser.Scene, id: Stage910AnimId) {
  const first = Object.keys(SHEETS[id].anims)[0]
  return scene.textures.exists(stage910AnimTex(id)) && !!first && scene.anims.exists(`${id}-${first}`)
}

export function preloadStage910Art(scene: Phaser.Scene) {
  for (const [id, m] of Object.entries(SHEETS) as [Stage910AnimId, SheetMeta][]) {
    scene.load.spritesheet(stage910AnimTex(id), m.sheet, {
      frameWidth: m.frameWidth,
      frameHeight: m.frameHeight,
    })
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

export function createStage910Anims(scene: Phaser.Scene) {
  for (const [id, m] of Object.entries(SHEETS) as [Stage910AnimId, SheetMeta][]) {
    const key = stage910AnimTex(id)
    if (!scene.textures.exists(key)) {
      console.error(`[stage910Art] missing ${key}`)
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
}
