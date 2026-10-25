/** Side-view dual co-op lanes — Pack3: 5 rows (上→下). */

import { GROUND_Y, LANE_HIT_TOL } from './constants'

export const LANE_COUNT = 5

/**
 * Feet Y for lanes 0..4 (top→bottom).
 * Clear spacing so row swaps read; tied to lowered GROUND_Y.
 */
/** Lane spacing halved with 480×270 layout (was ±36 / ±72 on 540-tall). */
export const LANE_Y = [
  GROUND_Y - 36,
  GROUND_Y - 18,
  GROUND_Y,
  GROUND_Y + 18,
  GROUND_Y + 36,
] as const

export const LANE_DEFAULT = 2 as LaneId

/** Same-lane hit tolerance only used as Y fallback. */
export const LANE_HIT_Y_TOL = 10

/** Cooldown between discrete lane switches while held (ms). */
export const LANE_SWITCH_MS = 110

/** Soft lerp toward target lane Y while grounded (px/s). */
export const LANE_SNAP_SPEED = 290

export const LANE_BAND_PAD = 14

export type LaneId = 0 | 1 | 2 | 3 | 4

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
    const d = Math.abs(y - LANE_Y[i]!)
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
 * Hits connect on same lane OR ±LANE_HIT_TOL (default 1 = 上下差一行都打到).
 */
export function sameLane(
  a: LaneActor,
  b: LaneActor,
  _yTol = LANE_HIT_Y_TOL,
  laneTol = LANE_HIT_TOL,
): boolean {
  void _yTol
  if (a.lane !== undefined && b.lane !== undefined) {
    return sameLaneId(a.lane, b.lane, laneTol)
  }
  return sameLaneId(nearestLane(a.y), nearestLane(b.y), laneTol)
}

export function laneDepth(base: number, lane: LaneId): number {
  return base + lane * 10
}

export const LANE_FLOOR_Y = LANE_Y[LANE_COUNT - 1]!

export const LANE_BAND_TOP = LANE_Y[0]! - LANE_BAND_PAD

export function inLaneBand(y: number): boolean {
  return y >= LANE_BAND_TOP
}
