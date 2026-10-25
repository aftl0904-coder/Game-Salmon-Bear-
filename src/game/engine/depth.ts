/**
 * Draw-order bands for Round 1.
 * BG < ground/water < props/signs < shadows < actors (lane-sorted) < FX < HUD.
 *
 * Lane stride must be > 1 so same-lane heroes/enemies/pet never z-fight with
 * props or with each other when Y overlaps.
 */

export const DEPTH = {
  SKY: -50,
  SKY_BAND: -48,
  CLOUD: -42,
  MOUNT_FAR: -38,
  VILLAGE: -34,
  MOUNT_NEAR: -30,
  WATER_DEEP: 1,
  WATER_MID: 1.5,
  WATER_FOAM: 2,
  HAZARD: 2,
  GROUND: 3,
  PROP_SHADOW: 3.4,
  PROP: 3.6,
  PROP_FG: 3.8,
  BREAKABLE: 4,
  SIGN: 4.5,
  PICKUP: 5,
  SHADOW: 5.5,
  /** Actors start here; lane adds LANE_STRIDE each. */
  ACTOR: 20,
  ACTOR_LANE_STRIDE: 12,
  /** Within a lane: enemy < pet < hero < hero-fx. */
  ACTOR_ENEMY: 0,
  ACTOR_PET: 2,
  ACTOR_HERO: 4,
  ACTOR_FAN: 5,
  ACTOR_SHOT: 8,
  ACTOR_HITBOX: 9,
  FX: 60,
  HUD: 100,
  DEBUG: 200,
} as const

export type ActorKind = 'enemy' | 'pet' | 'hero' | 'fan' | 'shot' | 'hitbox'

const ACTOR_SLOT: Record<ActorKind, number> = {
  enemy: DEPTH.ACTOR_ENEMY,
  pet: DEPTH.ACTOR_PET,
  hero: DEPTH.ACTOR_HERO,
  fan: DEPTH.ACTOR_FAN,
  shot: DEPTH.ACTOR_SHOT,
  hitbox: DEPTH.ACTOR_HITBOX,
}

/** Lane-aware actor depth. Higher lane (下) draws in front. */
export function actorDepth(kind: ActorKind, lane: number): number {
  const laneId = Math.max(0, Math.min(2, Math.round(lane)))
  return DEPTH.ACTOR + laneId * DEPTH.ACTOR_LANE_STRIDE + ACTOR_SLOT[kind]
}
