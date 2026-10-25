/**
 * Draw-order bands for Round 1 (Strict QA 2.5D).
 *
 *   Background …… 0–99
 *   Tilemap ……… ~100
 *   Props ……… 110–199
 *   WorldEntity … dynamic via actorDepth = laneIndex * 1000 + y (+ kind slot)
 *   FX …………… 9000+
 *   UI …………… 10000+
 *
 * Actor formula sorts primarily by lane (下 in front), then by feet Y so
 * overlapping cast/enemies never z-fight or stack feet visually.
 */

import { LANE_Y, type LaneId } from './lanes'

export const DEPTH = {
  SKY: 0,
  SKY_BAND: 2,
  CLOUD: 8,
  MOUNT_FAR: 16,
  VILLAGE: 22,
  MOUNT_NEAR: 28,
  /** Tilemap / solids / hazard strip */
  TILEMAP: 100,
  WATER_DEEP: 102,
  WATER_MID: 103,
  WATER_FOAM: 104,
  HAZARD: 106,
  GROUND: 108,
  /** Props sit under all WorldEntity actors (lane0 starts ~364). */
  PROP_SHADOW: 120,
  PROP: 130,
  PROP_FG: 140,
  BREAKABLE: 150,
  SIGN: 160,
  PICKUP: 170,
  SHADOW: 180,
  /** Conceptual WorldEntity band start (actors use lane*1000+y). */
  WORLD_ENTITY: 200,
  FX: 9000,
  UI: 10000,
  DEBUG: 11000,
} as const

export type ActorKind = 'enemy' | 'pet' | 'hero' | 'fan' | 'shot' | 'hitbox'

/** Within a lane+Y cell: enemy < pet < hero < hero-fx. */
const ACTOR_SLOT: Record<ActorKind, number> = {
  enemy: 0,
  pet: 2,
  hero: 4,
  fan: 5,
  shot: 8,
  hitbox: 9,
}

/**
 * Dynamic 2.5D actor depth.
 * `laneIndex * 1000 + y` (+ small kind slot) — higher lane (下) and lower feet
 * draw in front. Pass live `y` each update so jump arcs sort correctly.
 */
export function actorDepth(kind: ActorKind, lane: number, y?: number): number {
  const laneId = Math.max(0, Math.min(4, Math.round(lane))) as LaneId
  const feet = Math.round(y ?? LANE_Y[laneId])
  return laneId * 1000 + feet + ACTOR_SLOT[kind]
}
