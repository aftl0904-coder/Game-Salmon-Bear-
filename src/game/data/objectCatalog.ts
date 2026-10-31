/**
 * Object database — specs + graphic / action-frame keys for every gameplay asset.
 * Single source of truth for cast, enemies, props, FX. Keep in sync when adding art.
 */

import { WALK_FRAMES } from '../pixelSnap'
import {
  ACTOR_DISPLAY_SCALE,
  HERO_SIZE_MUL,
  GIRL_SCALE_MUL,
  PET_HEIGHT_FRAC,
  PROJ_DISPLAY_SCALE,
  WEAPON_DISPLAY_SCALE,
  PROP_DISPLAY_SCALE,
  BOY_SPEED,
  GIRL_SPEED,
  ENEMY_SPEED,
  MAX_HP,
  PLAYER_ATTACK_DMG,
  ENEMY_ATTACK_DMG,
  FISH_BULLET_DMG,
  SALMON_SHOT_RANGE,
  SALMON_SHOT_SPEED,
  SALMON_SHOT_COOLDOWN_MS,
  SWORD_COOLDOWN_MS,
  SWORD_HIT_W,
  SWORD_HIT_H,
} from '../engine/constants'
import { KIND_STATS, SPECIES_STATS, type EnemyKind, type EnemySpecies } from '../enemyAi'

export type ObjectCategory =
  | 'hero'
  | 'pet'
  | 'enemy'
  | 'weapon'
  | 'projectile'
  | 'pickup'
  | 'hazard'
  | 'prop'
  | 'scenery'
  | 'ui'
  | 'bg'

export type FrameRole =
  | 'base'
  | 'idle'
  | 'run'
  | 'atk-windup'
  | 'atk-strike'
  | 'fx'
  | 'variant'

export type CatalogFrame = {
  /** Texture key registered in Phaser */
  key: string
  role: FrameRole
  /** Optional note (e.g. walk index) */
  note?: string
}

export type CatalogSpecs = {
  hp?: number
  dmg?: number
  speed?: number
  scale?: number
  scaleMul?: number
  cooldownMs?: number
  range?: number
  hitW?: number
  hitH?: number
  displayScale?: number
  species?: EnemySpecies
  kind?: EnemyKind
  notes?: string
}

export type CatalogEntry = {
  id: string
  nameEn: string
  nameZh: string
  category: ObjectCategory
  /** How the base graphic is produced */
  source: 'png' | 'paint' | 'wallpaper' | 'tiles'
  /** Primary texture key */
  texture: string
  /** All related frames (idle/run/attack/variants) */
  frames: CatalogFrame[]
  specs?: CatalogSpecs
}

function heroFrames(base: string): CatalogFrame[] {
  const frames: CatalogFrame[] = [{ key: base, role: 'base' }]
  for (let i = 0; i < 2; i++) frames.push({ key: `${base}-idle-${i}`, role: 'idle', note: `breath ${i}` })
  for (let i = 0; i < WALK_FRAMES; i++) frames.push({ key: `${base}-run-${i}`, role: 'run', note: `walk ${i}` })
  return frames
}

function enemyFrames(base: string): CatalogFrame[] {
  const frames: CatalogFrame[] = [{ key: base, role: 'base' }]
  for (let i = 0; i < WALK_FRAMES; i++) frames.push({ key: `${base}-run-${i}`, role: 'run', note: `walk ${i}` })
  frames.push({ key: `${base}-atk-windup`, role: 'atk-windup' })
  frames.push({ key: `${base}-atk-strike`, role: 'atk-strike' })
  return frames
}

function petFrames(base: string): CatalogFrame[] {
  const frames: CatalogFrame[] = [{ key: base, role: 'base' }]
  for (let i = 0; i < 2; i++) frames.push({ key: `${base}-idle-${i}`, role: 'idle', note: `breath ${i}` })
  for (let i = 0; i < WALK_FRAMES; i++) frames.push({ key: `${base}-run-${i}`, role: 'run', note: `walk ${i}` })
  return frames
}

/** Full object catalog */
export const OBJECT_CATALOG: CatalogEntry[] = [
  // —— Heroes / pet ——
  {
    id: 'hero-lunbao',
    nameEn: 'Lunbao',
    nameZh: '倫寶',
    category: 'hero',
    source: 'png',
    texture: 'art-salmon',
    frames: heroFrames('art-salmon'),
    specs: {
      hp: MAX_HP,
      dmg: PLAYER_ATTACK_DMG,
      speed: BOY_SPEED,
      scale: ACTOR_DISPLAY_SCALE * HERO_SIZE_MUL,
      cooldownMs: SALMON_SHOT_COOLDOWN_MS,
      range: SALMON_SHOT_RANGE,
      notes: 'Salmon gun; PNG /art/salmon-boy.png → NEAREST×1 + 1px outline + walk/idle',
    },
  },
  {
    id: 'hero-qibao',
    nameEn: 'Qibao',
    nameZh: '琪寶寶',
    category: 'hero',
    source: 'png',
    texture: 'art-girl',
    frames: heroFrames('art-girl'),
    specs: {
      hp: MAX_HP,
      dmg: PLAYER_ATTACK_DMG,
      speed: GIRL_SPEED,
      scale: ACTOR_DISPLAY_SCALE * HERO_SIZE_MUL * GIRL_SCALE_MUL,
      cooldownMs: SWORD_COOLDOWN_MS,
      hitW: SWORD_HIT_W,
      hitH: SWORD_HIT_H,
      notes: 'Sword melee; fan stamped on back; PNG /art/bear-girl.png',
    },
  },
  {
    id: 'pet-pupu',
    nameEn: 'Pupu (honey bear)',
    nameZh: '噗噗',
    category: 'pet',
    source: 'png',
    texture: 'art-bear',
    frames: petFrames('art-bear'),
    specs: {
      scale: PET_HEIGHT_FRAC,
      notes: 'PNG /art/kind-bear.png; bible height 40px (40/48 of 琪寶寶)',
    },
  },

  // —— Enemies (species × frames) ——
  {
    id: 'enemy-fish',
    nameEn: 'Puffer fish',
    nameZh: '刺刺魚',
    category: 'enemy',
    source: 'png',
    texture: 'art-enemy',
    frames: enemyFrames('art-enemy'),
    specs: {
      species: 'fish',
      scale: ACTOR_DISPLAY_SCALE * SPECIES_STATS.fish.scaleMul,
      speed: ENEMY_SPEED * SPECIES_STATS.fish.spdMul,
      dmg: ENEMY_ATTACK_DMG,
      notes: 'Projectile fish; PNG /art/fish-enemy.png',
    },
  },
  {
    id: 'enemy-barrel',
    nameEn: 'Gale barrel',
    nameZh: '疾風桶',
    category: 'enemy',
    source: 'paint',
    texture: 'art-enemy-barrel',
    frames: enemyFrames('art-enemy-barrel'),
    specs: {
      species: 'barrel',
      scale: ACTOR_DISPLAY_SCALE * SPECIES_STATS.barrel.scaleMul,
      speed: ENEMY_SPEED * SPECIES_STATS.barrel.spdMul,
      dmg: ENEMY_ATTACK_DMG,
      notes: 'Hop/lunge; painted isoArt',
    },
  },
  {
    id: 'enemy-elephant',
    nameEn: 'Trunk elephant',
    nameZh: '霸鼻象',
    category: 'enemy',
    source: 'paint',
    texture: 'art-enemy-elephant',
    frames: enemyFrames('art-enemy-elephant'),
    specs: {
      species: 'elephant',
      scale: ACTOR_DISPLAY_SCALE * SPECIES_STATS.elephant.scaleMul,
      speed: ENEMY_SPEED * SPECIES_STATS.elephant.spdMul,
      dmg: ENEMY_ATTACK_DMG,
      notes: 'Tank nose melee; painted isoArt + trunk FX frames',
    },
  },

  // —— Weapons ——
  {
    id: 'weapon-sword',
    nameEn: 'Girl sword',
    nameZh: '琪寶寶劍',
    category: 'weapon',
    source: 'paint',
    texture: 'prop-sword',
    frames: [{ key: 'prop-sword', role: 'base' }],
    specs: { displayScale: WEAPON_DISPLAY_SCALE, hitW: SWORD_HIT_W, hitH: SWORD_HIT_H },
  },
  {
    id: 'weapon-knife',
    nameEn: 'Enemy knife',
    nameZh: '敵刀',
    category: 'weapon',
    source: 'paint',
    texture: 'prop-enemy-knife',
    frames: [{ key: 'prop-enemy-knife', role: 'base' }],
    specs: { displayScale: WEAPON_DISPLAY_SCALE },
  },
  {
    id: 'weapon-spear',
    nameEn: 'Enemy spear',
    nameZh: '敵矛',
    category: 'weapon',
    source: 'paint',
    texture: 'prop-enemy-spear',
    frames: [{ key: 'prop-enemy-spear', role: 'base' }],
    specs: { displayScale: WEAPON_DISPLAY_SCALE },
  },
  {
    id: 'weapon-club',
    nameEn: 'Enemy club',
    nameZh: '敵棒',
    category: 'weapon',
    source: 'paint',
    texture: 'prop-enemy-club',
    frames: [{ key: 'prop-enemy-club', role: 'base' }],
    specs: { displayScale: WEAPON_DISPLAY_SCALE },
  },
  {
    id: 'weapon-trunk',
    nameEn: 'Elephant trunk',
    nameZh: '象鼻',
    category: 'weapon',
    source: 'paint',
    texture: 'fx-elephant-trunk-0',
    frames: [
      { key: 'fx-elephant-trunk-0', role: 'atk-windup', note: 'curl' },
      { key: 'fx-elephant-trunk-1', role: 'atk-strike', note: 'thrust' },
    ],
    specs: { displayScale: WEAPON_DISPLAY_SCALE },
  },

  // —— Projectiles ——
  {
    id: 'proj-salmon',
    nameEn: 'Salmon shot',
    nameZh: '鮭魚彈',
    category: 'projectile',
    source: 'paint',
    texture: 'fx-salmon-shot',
    frames: [{ key: 'fx-salmon-shot', role: 'fx' }],
    specs: {
      dmg: PLAYER_ATTACK_DMG,
      speed: SALMON_SHOT_SPEED,
      range: SALMON_SHOT_RANGE,
      displayScale: PROJ_DISPLAY_SCALE,
    },
  },
  {
    id: 'proj-fish-bullet',
    nameEn: 'Fish bullet',
    nameZh: '刺刺魚彈',
    category: 'projectile',
    source: 'paint',
    texture: 'fx-fish-bullet',
    frames: [{ key: 'fx-fish-bullet', role: 'fx' }],
    specs: { dmg: FISH_BULLET_DMG, displayScale: PROJ_DISPLAY_SCALE },
  },
  {
    id: 'proj-honey-special',
    nameEn: 'Honey special',
    nameZh: '蜂蜜絕招',
    category: 'projectile',
    source: 'paint',
    texture: 'fx-honey',
    frames: [{ key: 'fx-honey', role: 'fx' }],
    specs: { displayScale: PROJ_DISPLAY_SCALE },
  },

  // —— Pickups / hazards ——
  {
    id: 'pickup-honey',
    nameEn: 'Honey jar',
    nameZh: '蜂蜜罐',
    category: 'pickup',
    source: 'paint',
    texture: 'prop-honey-stack',
    frames: [
      { key: 'prop-honey-stack', role: 'base' },
      { key: 'prop-honey-pot', role: 'variant' },
    ],
    specs: { displayScale: PROP_DISPLAY_SCALE, notes: 'Goal tally / special charge' },
  },
  {
    id: 'pickup-sushi',
    nameEn: 'Salmon sushi',
    nameZh: '三文魚壽司',
    category: 'pickup',
    source: 'paint',
    texture: 'pickup-sushi',
    frames: [{ key: 'pickup-sushi', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE, notes: '補75% effective max HP (secret-perch reward)' },
  },
  {
    id: 'pickup-sushi-tamago',
    nameEn: 'Tamago sushi',
    nameZh: '玉子壽司',
    category: 'pickup',
    source: 'paint',
    texture: 'pickup-sushi-tamago',
    frames: [{ key: 'pickup-sushi-tamago', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE, notes: '補25% effective max HP (common breakable drop)' },
  },
  {
    id: 'pickup-sushi-ebi',
    nameEn: 'Ebi sushi',
    nameZh: '蝦壽司',
    category: 'pickup',
    source: 'paint',
    texture: 'pickup-sushi-ebi',
    frames: [{ key: 'pickup-sushi-ebi', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE, notes: '補50% effective max HP (occasional breakable drop)' },
  },
  {
    id: 'pickup-sushi-deluxe',
    nameEn: 'Deluxe sushi boat',
    nameZh: '極上壽司船（大拼盤）',
    category: 'pickup',
    source: 'paint',
    texture: 'pickup-sushi-deluxe',
    frames: [{ key: 'pickup-sushi-deluxe', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE, notes: '補100% effective max HP — one per boss arena entrance' },
  },
  {
    id: 'pickup-coin',
    nameEn: 'Coin',
    nameZh: '金幣',
    category: 'pickup',
    source: 'paint',
    texture: 'coin',
    frames: [{ key: 'coin', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE },
  },
  {
    id: 'hazard-durian',
    nameEn: 'Durian trap',
    nameZh: '榴槤陷阱',
    category: 'hazard',
    source: 'paint',
    texture: 'hazard-durian',
    frames: [{ key: 'hazard-durian', role: 'base' }],
    specs: { dmg: 1, displayScale: PROP_DISPLAY_SCALE },
  },
  {
    id: 'hazard-spike',
    nameEn: 'Spike',
    nameZh: '尖刺',
    category: 'hazard',
    source: 'paint',
    texture: 'blk-spike',
    frames: [
      { key: 'blk-spike', role: 'base' },
      { key: 'til-spike', role: 'variant' },
    ],
    specs: { dmg: 1 },
  },
  {
    id: 'prop-goal',
    nameEn: 'Tree hive goal',
    nameZh: '樹頂蜂巢',
    category: 'prop',
    source: 'paint',
    texture: 'goal3d',
    frames: [{ key: 'goal3d', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE },
  },
  {
    id: 'prop-pot',
    nameEn: 'Breakable pot',
    nameZh: '壺',
    category: 'prop',
    source: 'paint',
    texture: 'pot3d',
    frames: [{ key: 'pot3d', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE },
  },
  {
    id: 'prop-chest',
    nameEn: 'Chest',
    nameZh: '寶箱',
    category: 'prop',
    source: 'paint',
    texture: 'chest3d',
    frames: [{ key: 'chest3d', role: 'base' }],
    specs: { displayScale: PROP_DISPLAY_SCALE },
  },

  // —— Campsite / scenery ——
  {
    id: 'prop-tent',
    nameEn: 'Tent',
    nameZh: '帳篷',
    category: 'scenery',
    source: 'paint',
    texture: 'prop-tent',
    frames: [{ key: 'prop-tent', role: 'base' }],
  },
  {
    id: 'prop-picnic-table',
    nameEn: 'Picnic table',
    nameZh: '野餐枱',
    category: 'scenery',
    source: 'paint',
    texture: 'prop-picnic-table',
    frames: [{ key: 'prop-picnic-table', role: 'base' }],
  },
  {
    id: 'prop-campfire',
    nameEn: 'Campfire',
    nameZh: '營火',
    category: 'scenery',
    source: 'paint',
    texture: 'prop-campfire',
    frames: [{ key: 'prop-campfire', role: 'base' }],
  },
  {
    id: 'bg-wallpaper',
    nameEn: 'Riverside wallpaper',
    nameZh: '遠景壁紙',
    category: 'bg',
    source: 'wallpaper',
    texture: 'bg-wallpaper',
    frames: [
      { key: 'bg-wallpaper', role: 'base' },
      { key: 'bg-sky-wallpaper', role: 'variant', note: 'sky crop' },
    ],
    specs: { notes: 'Upper band only; heavily faded in-game' },
  },
]

/** Enemy kind combat specs (shared across species). */
export const ENEMY_KIND_CATALOG = (Object.keys(KIND_STATS) as EnemyKind[]).map((kind) => ({
  kind,
  ...KIND_STATS[kind],
}))

/** Enemy species kits. */
export const ENEMY_SPECIES_CATALOG = (Object.keys(SPECIES_STATS) as EnemySpecies[]).map((species) => ({
  species,
  ...SPECIES_STATS[species],
}))

export function catalogByCategory(cat: ObjectCategory): CatalogEntry[] {
  return OBJECT_CATALOG.filter((e) => e.category === cat)
}

export function catalogById(id: string): CatalogEntry | undefined {
  return OBJECT_CATALOG.find((e) => e.id === id)
}

/** Flat list of every texture key referenced by the catalog (for boot audits). */
export function allCatalogTextureKeys(): string[] {
  const keys = new Set<string>()
  for (const e of OBJECT_CATALOG) {
    keys.add(e.texture)
    for (const f of e.frames) keys.add(f.key)
  }
  return [...keys]
}
