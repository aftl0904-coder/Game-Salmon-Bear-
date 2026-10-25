/** Side-view dual co-op lanes (上／中／下) — same X progress, different Y tracks. */

import { GROUND_Y } from './constants'

export const LANE_COUNT = 3

/** Feet Y for 上=0／中=1／下=2 (classic beat-em-up tracks). */
export const LANE_Y = [GROUND_Y - 36, GROUND_Y, GROUND_Y + 36] as const

export const LANE_DEFAULT = 1 as LaneId

/** Same-lane hit / hurt: exact id match, or feet Y within this tolerance (jump arcs). */
export const LANE_HIT_Y_TOL = 28

/** Cooldown between discrete lane switches (ms). */
export const LANE_SWITCH_MS = 140

/** Soft lerp toward target lane Y while grounded (px/s). */
export const LANE_SNAP_SPEED = 520

export type LaneId = 0 | 1 | 2

export function clampLane(n: number): LaneId {
  return Math.max(0, Math.min(LANE_COUNT - 1, Math.round(n))) as LaneId
}

export function laneY(lane: LaneId): number {
  return LANE_Y[lane]
}

/** Nearest lane id for a feet Y (ground band). */
export function nearestLane(y: number): LaneId {
  let best: LaneId = LANE_DEFAULT
  let bestD = Infinity
  for (let i = 0; i < LANE_COUNT; i++) {
    const d = Math.abs(y - LANE_Y[i])
    if (d < bestD) {
      bestD = d
      best = i as LaneId
    }
  }
  return best
}

export function sameLaneId(a: number, b: number, tol = 0): boolean {
  return Math.abs(a - b) <= tol
}

type LaneActor = { lane?: number; y: number }

/**
 * Hits connect only on shared lane (or overlapping Y while jumping).
 * Wrong lane = miss.
 */
export function sameLane(a: LaneActor, b: LaneActor, yTol = LANE_HIT_Y_TOL): boolean {
  if (a.lane !== undefined && b.lane !== undefined && sameLaneId(a.lane, b.lane)) return true
  return Math.abs(a.y - b.y) <= yTol
}

/** Draw order: 下 in front of 中 in front of 上. */
export function laneDepth(base: number, lane: LaneId): number {
  return base + lane
}

/** Lowest walk surface — physical floor that catches hop landings. */
export const LANE_FLOOR_Y = LANE_Y[LANE_COUNT - 1]

/** Top of the lane walk band (anything above is elevated platform territory). */
export const LANE_BAND_TOP = LANE_Y[0] - 24

export function inLaneBand(y: number): boolean {
  return y >= LANE_BAND_TOP
}
