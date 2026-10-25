import type Phaser from 'phaser'
import { WORLD_W, WORLD_H, GROUND_Y, PROP_DISPLAY_SCALE } from './constants'

export const ROUND1_MAP_KEY = 'map-round1-stream'
export const ROUND1_TILESET_KEY = 'tileset-stream'
export const ROUND1_MAP_URL = '/maps/round1-stream.json'
export const ROUND1_TILESET_URL = '/maps/tileset-stream.png'

export type BreakableKind = 'pot' | 'chest'
export type LootKind = 'coin' | 'honey'
export type Breakable = Phaser.Physics.Arcade.Sprite & { breakKind: BreakableKind; loot: LootKind }
export type LevelMapHandle = {
  map: Phaser.Tilemaps.Tilemap
  background: Phaser.Tilemaps.TilemapLayer | null
  solids: Phaser.Tilemaps.TilemapLayer | null
  hazards: Phaser.Tilemaps.TilemapLayer | null
  breakables: Phaser.Physics.Arcade.Group
  goalFromMap: { x: number; y: number } | null
  spawnP1: { x: number; y: number } | null
  spawnP2: { x: number; y: number } | null
}

export function preloadRound1Map(scene: Phaser.Scene) {
  scene.load.tilemapTiledJSON(ROUND1_MAP_KEY, ROUND1_MAP_URL)
  scene.load.image(ROUND1_TILESET_KEY, ROUND1_TILESET_URL)
}

export function createRound1Tilemap(
  scene: Phaser.Scene,
  breakables: Phaser.Physics.Arcade.Group,
  hazardBodies?: Phaser.Physics.Arcade.StaticGroup,
): LevelMapHandle | null {
  if (!scene.cache.tilemap.exists(ROUND1_MAP_KEY)) return null
  const map = scene.make.tilemap({ key: ROUND1_MAP_KEY })
  const tileset = map.addTilesetImage('stream', ROUND1_TILESET_KEY)
  if (!tileset) { map.destroy(); return null }
  const background = map.createLayer('Background', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer | null
  const solids = map.createLayer('Solids', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer | null
  const hazards = map.createLayer('Hazards', tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer | null
  background?.setDepth(-5).setAlpha(0.85)
  solids?.setDepth(-4).setAlpha(0)
  hazards?.setDepth(2)
  if (solids) solids.setCollisionByProperty({ collides: true })
  if (hazards && hazardBodies) {
    hazards.forEachTile((tile) => {
      const props = tile.properties as { hazard?: boolean; kind?: string }
      if (!tile.index || tile.index <= 0 || !props.hazard) return
      const kind = props.kind === 'lava' ? 'lava' : 'spike'
      const tex = kind === 'lava'
        ? (scene.textures.exists('til-water') ? 'til-water' : 'blk-spike')
        : (scene.textures.exists('blk-spike') ? 'blk-spike' : 'til-spike')
      const s = hazardBodies.create(tile.getCenterX(), tile.getCenterY(), tex) as Phaser.Physics.Arcade.Sprite
      s.setVisible(kind === 'lava')
      if (kind === 'lava') s.setTint(0xff5522).setAlpha(0.85).setDepth(2)
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
      const bottom = (obj.y ?? 0) + (obj.height ?? 0)
      const props: Record<string, string | number | boolean> = {}
      const list = obj.properties as Array<{ name: string; value: string | number | boolean }> | undefined
      if (Array.isArray(list)) for (const p of list) props[p.name] = p.value
      const loot = (props.loot === 'honey' ? 'honey' : 'coin') as LootKind
      if (name === 'pot' || name === 'chest') {
        const tex = name === 'chest'
          ? (scene.textures.exists('chest3d') ? 'chest3d' : 'pot3d')
          : (scene.textures.exists('pot3d') ? 'pot3d' : 'prop-honey-pot')
        const spr = breakables.create(cx, bottom - 8, tex) as Breakable
        spr.breakKind = name as BreakableKind
        spr.loot = loot
        spr.setScale((name === 'chest' ? 1.35 : 1.45) * PROP_DISPLAY_SCALE).setDepth(4)
        ;(spr.body as Phaser.Physics.Arcade.Body).allowGravity = false
        scene.tweens.add({ targets: spr, y: spr.y - 5, yoyo: true, repeat: -1, duration: 700 })
      } else if (name === 'goal') goalFromMap = { x: cx, y: GROUND_Y - 50 }
      else if (name === 'spawn_p1') spawnP1 = { x: cx, y: GROUND_Y }
      else if (name === 'spawn_p2') spawnP2 = { x: cx, y: GROUND_Y }
    }
  }
  const mapW = Math.max(WORLD_W, map.widthInPixels)
  const mapH = Math.max(WORLD_H, Math.min(map.heightInPixels, WORLD_H + 40))
  scene.physics.world.setBounds(0, 0, mapW, mapH)
  scene.cameras.main.setBounds(0, 0, mapW, mapH)
  return { map, background, solids, hazards, breakables, goalFromMap, spawnP1, spawnP2 }
}

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
