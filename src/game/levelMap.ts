import type Phaser from 'phaser'
import { WORLD_W, WORLD_H, GROUND_Y } from './engine'

/** Asset keys for Round 1 Tiled map (public/maps/). */
export const ROUND1_MAP_KEY = 'map-round1-stream'
export const ROUND1_TILESET_KEY = 'tileset-stream'
export const ROUND1_MAP_URL = '/maps/round1-stream.json'
export const ROUND1_TILESET_URL = '/maps/tileset-stream.png'

export type BreakableKind = 'pot' | 'chest'
export type LootKind = 'coin' | 'honey'

export type Breakable = Phaser.Physics.Arcade.Sprite & {
  breakKind: BreakableKind
  loot: LootKind
}

export type LevelMapHandle = {
  map: Phaser.Tilemaps.Tilemap
  background: Phaser.Tilemaps.TilemapLayer | null
  solids: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null
  hazards: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null
  /** Dynamic pots/chests spawned from Entities object layer. */
  breakables: Phaser.Physics.Arcade.Group
  goalFromMap: { x: number; y: number } | null
  spawnP1: { x: number; y: number } | null
  spawnP2: { x: number; y: number } | null
}

/** Preload Tiled JSON + tileset image (call from BootScene.preload). */
export function preloadRound1Map(scene: Phaser.Scene) {
  scene.load.tilemapTiledJSON(ROUND1_MAP_KEY, ROUND1_MAP_URL)
  scene.load.image(ROUND1_TILESET_KEY, ROUND1_TILESET_URL)
}

/**
 * Hybrid Round 1 stream path:
 * - Phaser Tilemap layers Background / Solids / Hazards
 * - Solids: setCollisionByProperty({ collides: true })
 * - Entities object layer → breakable pots/chests (+ spawn/goal markers)
 * Procedural art (trees/torii/water) stays in the scene's drawWorld.
 */
export function createRound1Tilemap(
  scene: Phaser.Scene,
  breakables: Phaser.Physics.Arcade.Group,
  hazardBodies?: Phaser.Physics.Arcade.StaticGroup,
): LevelMapHandle | null {
  if (!scene.cache.tilemap.exists(ROUND1_MAP_KEY)) return null

  const map = scene.make.tilemap({ key: ROUND1_MAP_KEY })
  const tileset = map.addTilesetImage('stream', ROUND1_TILESET_KEY)
  if (!tileset) {
    map.destroy()
    return null
  }

  const background = map.createLayer('Background', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer
  const solids = map.createLayer('Solids', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer
  const hazards = map.createLayer('Hazards', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer

  background?.setDepth(-5).setAlpha(0.85)
  // Solids tiles provide collision; hide visual so procedural blk-* banks remain the art.
  solids?.setDepth(-4).setAlpha(0)
  hazards?.setDepth(2)

  if (solids) {
    solids.setCollisionByProperty({ collides: true })
  }
  // Hazard tiles are sensors (not solid walls) — mirror into StaticGroup for Arcade overlap.
  if (hazards && hazardBodies) {
    hazards.forEachTile((tile) => {
      const props = tile.properties as { hazard?: boolean; kind?: string }
      if (!tile.index || tile.index <= 0 || !props.hazard) return
      const cx = tile.getCenterX()
      const cy = tile.getCenterY()
      const kind = props.kind === 'lava' ? 'lava' : 'spike'
      const tex =
        kind === 'lava'
          ? scene.textures.exists('til-water')
            ? 'til-water'
            : 'blk-spike'
          : scene.textures.exists('blk-spike')
            ? 'blk-spike'
            : 'til-spike'
      const s = hazardBodies.create(cx, cy, tex) as Phaser.Physics.Arcade.Sprite
      s.setVisible(kind === 'lava') // spikes already placed as props; lava uses tile art body
      if (kind === 'lava') {
        s.setTint(0xff5522).setAlpha(0.85).setDepth(2)
      }
      s.setData('hazardKind', kind)
      s.refreshBody()
    })
  }

  let goalFromMap: { x: number; y: number } | null = null
  let spawnP1: { x: number; y: number } | null = null
  let spawnP2: { x: number; y: number } | null = null

  const entLayer = map.getObjectLayer('Entities')
  if (entLayer) {
    for (const obj of entLayer.objects) {
      const name = (obj.name || obj.type || '').toLowerCase()
      const cx = (obj.x ?? 0) + (obj.width ?? 0) / 2
      // Tiled object y is top; sprites use feet / center near ground.
      const bottom = (obj.y ?? 0) + (obj.height ?? 0)
      const props = propsOf(obj)
      const loot = (props.loot === 'honey' ? 'honey' : 'coin') as LootKind

      if (name === 'pot' || name === 'chest') {
        const tex =
          name === 'chest'
            ? scene.textures.exists('chest3d')
              ? 'chest3d'
              : 'pot3d'
            : scene.textures.exists('pot3d')
              ? 'pot3d'
              : 'prop-honey-pot'
        const spr = breakables.create(cx, bottom - 8, tex) as Breakable
        spr.breakKind = name as BreakableKind
        spr.loot = loot
        spr.setScale(name === 'chest' ? 1.35 : 1.45).setDepth(4)
        const body = spr.body as Phaser.Physics.Arcade.Body
        body.allowGravity = false
        body.setSize(spr.width * 0.7, spr.height * 0.7)
        scene.tweens.add({
          targets: spr,
          y: spr.y - 5,
          yoyo: true,
          repeat: -1,
          duration: 700,
        })
      } else if (name === 'goal') {
        goalFromMap = { x: cx, y: GROUND_Y - 50 }
      } else if (name === 'spawn_p1') {
        spawnP1 = { x: cx, y: GROUND_Y }
      } else if (name === 'spawn_p2') {
        spawnP2 = { x: cx, y: GROUND_Y }
      }
    }
  }

  // Ensure world bounds match map pixel size when map is authoritative.
  const mapW = Math.max(WORLD_W, map.widthInPixels)
  const mapH = Math.max(WORLD_H, Math.min(map.heightInPixels, WORLD_H + 40))
  scene.physics.world.setBounds(0, 0, mapW, mapH)
  scene.cameras.main.setBounds(0, 0, mapW, mapH)

  return { map, background: background as Phaser.Tilemaps.TilemapLayer | null, solids: solids as Phaser.Tilemaps.TilemapLayer | null, hazards: hazards as Phaser.Tilemaps.TilemapLayer | null, breakables, goalFromMap, spawnP1, spawnP2 }
}

function propsOf(obj: Phaser.Types.Tilemaps.TiledObject): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  const list = obj.properties as Array<{ name: string; value: string | number | boolean }> | undefined
  if (Array.isArray(list)) {
    for (const p of list) out[p.name] = p.value
  } else if (list && typeof list === 'object') {
    Object.assign(out, list)
  }
  return out
}

/** True when a melee / projectile hitbox overlaps a breakable (AABB, facing-aware). */
export function hitBreakable(
  h: { x: number; y: number; facing: 1 | -1 },
  b: Phaser.GameObjects.GameObject,
  rangeX = 88,
  rangeY = 56,
): boolean {
  const spr = b as Phaser.Physics.Arcade.Sprite
  if (!spr.active) return false
  const dx = spr.x - h.x
  if (Math.sign(dx) !== h.facing && Math.abs(dx) > 12) return false
  return Math.abs(dx) < rangeX && Math.abs(spr.y - h.y) < rangeY
}