import type Phaser from 'phaser'
import type { Creep } from '../enemyAi'

/**
 * Lightweight entity registry — keeps gameplay actors out of HUD/UI code.
 * Scene still owns spawn; this owns iteration / queries.
 */
export type EntityKind = 'player' | 'enemy' | 'collectible' | 'hazard' | 'projectile' | 'pet'

export type ManagedSprite = Phaser.Physics.Arcade.Sprite & {
  entityKind?: EntityKind
  entityId?: string
}

let nextId = 1

export function tagEntity(sprite: ManagedSprite, kind: EntityKind): ManagedSprite {
  sprite.entityKind = kind
  sprite.entityId = `${kind}-${nextId++}`
  return sprite
}

export class EntityManager {
  players: ManagedSprite[] = []
  enemies: ManagedSprite[] = []
  projectiles: ManagedSprite[] = []
  collectibles: ManagedSprite[] = []
  hazards: ManagedSprite[] = []
  pets: ManagedSprite[] = []

  clear() {
    this.players = []
    this.enemies = []
    this.projectiles = []
    this.collectibles = []
    this.hazards = []
    this.pets = []
  }

  add(sprite: ManagedSprite, kind: EntityKind) {
    tagEntity(sprite, kind)
    switch (kind) {
      case 'player':
        this.players.push(sprite)
        break
      case 'enemy':
        this.enemies.push(sprite)
        break
      case 'projectile':
        this.projectiles.push(sprite)
        break
      case 'collectible':
        this.collectibles.push(sprite)
        break
      case 'hazard':
        this.hazards.push(sprite)
        break
      case 'pet':
        this.pets.push(sprite)
        break
    }
    return sprite
  }

  /** Sync enemy list from a Phaser group (after spawn / death cull). */
  syncEnemiesFromGroup(group: Phaser.Physics.Arcade.Group) {
    this.enemies = group.getChildren().filter((o) => {
      const e = o as Creep & { fsm?: string; isDead?: boolean }
      if (!e.active) return false
      if (e.isDead) return false
      if (e.fsm === 'DEAD') return false
      if (e.state === 'die') return false
      return true
    }) as ManagedSprite[]
  }

  activeEnemies(): Creep[] {
    return this.enemies.filter((e) => e.active) as Creep[]
  }

  destroy() {
    this.clear()
  }
}
