/** Single-lane side-scroller — stage 1 (former 5-row fighter collapsed). */

import { GROUND_Y, LANE_HIT_TOL } from './constants'

/** One walk line only. */
export const LANE_COUNT = 1

/** Feet Y — mid ground reference (art / ribbon unchanged). */
export const LANE_Y = [GROUND_Y] as const

export const LANE_DEFAULT = 0 as LaneId

/** Same-lane hit tolerance (Y fallback). */
export const LANE_HIT_Y_TOL = 10

/** @deprecated lane switch removed in stage 1 */
export const LANE_SWITCH_MS = 110

/** Soft lerp toward ground Y while grounded (px/s). */
export const LANE_SNAP_SPEED = 290

export const LANE_BAND_PAD = 14

/** Legacy ids 0–4 still appear in spawn tables; runtime always clamps to 0. */
export type LaneId = 0 | 1 | 2 | 3 | 4

export function clampLane(_n: number): LaneId {
  return 0
}

export function laneY(_lane: LaneId = 0): number {
  return LANE_Y[0]
}

/** Always the single lane. */
export function nearestLane(_y: number): LaneId {
  return 0
}

export function sameLaneId(_a: number, _b: number, _tol = 0): boolean {
  return true
}

type LaneActor = { lane?: number; y: number }

/** Stage 1: everyone shares the one line — hits always lane-OK. */
export function sameLane(
  _a: LaneActor,
  _b: LaneActor,
  _yTol = LANE_HIT_Y_TOL,
  _laneTol = LANE_HIT_TOL,
): boolean {
  return true
}

export function laneDepth(base: number, _lane: LaneId): number {
  return base
}

export const LANE_FLOOR_Y = LANE_Y[0]!

export const LANE_BAND_TOP = LANE_Y[0]! - LANE_BAND_PAD

export function inLaneBand(y: number): boolean {
  return y >= LANE_BAND_TOP
}
