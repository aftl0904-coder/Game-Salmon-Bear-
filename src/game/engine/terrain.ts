/**
 * Side-view terrain for single-lane platforming (pits, raised steps, one-way planks).
 * Built from data/levels/stage1.json. Coordinates are native 640×360 world px;
 * "top" is the feet Y of anything standing on it (smaller = higher).
 *
 * Kept as pure math (no Arcade bodies) so heroes / enemies, which hold their own
 * floor, can ask "what's under my feet?" without fighting the lane-floor code.
 */

export type Solid = {
  x0: number
  x1: number
  /** Feet Y at x0 (and across the span when topEnd is unset). */
  top: number
  /** When set, surface height lerps from `top` at x0 to `topEnd` at x1 (escalator / ramp). */
  topEnd?: number
  /** One-way planks: land from above only, walk through from the sides. */
  oneWay: boolean
  kind: 'ground' | 'step' | 'platform' | 'slope'
}

/** Interpolated surface Y for a solid at world x. */
export function solidTopAt(s: Solid, x: number): number {
  if (s.topEnd === undefined || s.x1 <= s.x0) return s.top
  const t = Math.max(0, Math.min(1, (x - s.x0) / (s.x1 - s.x0)))
  return s.top + (s.topEnd - s.top) * t
}

let solids: Solid[] = []
let pits: Array<{ x0: number; x1: number }> = []
let worldFloorY = 0
let enabled = false

/** Feet Y below which a fallen actor counts as lost in a pit. */
export const PIT_DEATH_MARGIN = 90

export function setTerrain(list: Solid[], pitList: Array<{ x0: number; x1: number }>, floorY: number) {
  solids = list.slice().sort((a, b) => a.x0 - b.x0)
  pits = pitList.slice()
  worldFloorY = floorY
  enabled = true
}

export function clearTerrain() {
  solids = []
  pits = []
  enabled = false
}

export function terrainEnabled() {
  return enabled
}

export function terrainSolids(): readonly Solid[] {
  return solids
}

export function terrainPits(): ReadonlyArray<{ x0: number; x1: number }> {
  return pits
}

export function pitDeathY() {
  return worldFloorY + PIT_DEATH_MARGIN
}

function covers(s: Solid, x: number, halfW: number) {
  return x + halfW > s.x0 && x - halfW < s.x1
}

/**
 * Top of a solid the feet are resting on, else null (over a pit / off an edge).
 * `sinkTol`: feet may sit this far *below* the top (physics drift) and still count as standing.
 */
export function supportTopAt(x: number, feetY: number, halfW = 4, sinkTol = 3): number | null {
  if (!enabled) return null
  let best: number | null = null
  for (const s of solids) {
    if (!covers(s, x, halfW)) continue
    const top = solidTopAt(s, x)
    // Slopes (escalator): allow a taller step-on window so feet on the base floor mount the ramp.
    const tol = s.kind === 'slope' ? Math.max(sinkTol, 24) : sinkTol
    if (feetY >= top - 3 && feetY <= top + tol) {
      if (best === null || top < best) best = top
    }
  }
  return best
}

/** While falling from prevFeetY to feetY: the first solid top crossed, else null. */
export function landingTopAt(x: number, prevFeetY: number, feetY: number, halfW = 4): number | null {
  if (!enabled) return null
  let best: number | null = null
  for (const s of solids) {
    if (!covers(s, x, halfW)) continue
    const top = solidTopAt(s, x)
    if (prevFeetY <= top + 1 && feetY >= top - 0.5) {
      if (best === null || top < best) best = top
    }
  }
  return best
}

/** Highest solid top at or below feetY (for shadows / emergency landing), else null. */
export function groundTopBelow(x: number, feetY: number, halfW = 4): number | null {
  if (!enabled) return null
  let best: number | null = null
  for (const s of solids) {
    if (!covers(s, x, halfW)) continue
    const top = solidTopAt(s, x)
    if (top >= feetY - 3 && (best === null || top < best)) best = top
  }
  return best
}

/**
 * Solid (non one-way) wall blocking horizontal movement: a step whose top is
 * higher than the feet. Returns the x the actor must be clamped to, else null.
 */
export function wallClampX(x: number, feetY: number, dir: number, halfW: number, ignoreSteps = false): number | null {
  if (!enabled || !dir) return null
  for (const s of solids) {
    if (s.oneWay) continue
    if (ignoreSteps && s.kind === 'step') continue
    const top = solidTopAt(s, x)
    if (top >= feetY - 3) continue // not taller than the feet → walkable / below
    if (dir > 0 && x + halfW > s.x0 && x - halfW < s.x0) return s.x0 - halfW
    if (dir < 0 && x - halfW < s.x1 && x + halfW > s.x1) return s.x1 + halfW
  }
  return null
}

/** True when x lies inside a pit span (no ground at the base floor). */
export function isOverPit(x: number, halfW = 0): boolean {
  if (!enabled) return false
  return pits.some((p) => x - halfW >= p.x0 && x + halfW <= p.x1)
}

/** For walkers that must not step off: is there floor at the same height a little ahead? */
export function edgeAhead(x: number, feetY: number, dir: number, lookAhead: number): boolean {
  if (!enabled || !dir) return false
  const ax = x + dir * lookAhead
  return supportTopAt(ax, feetY, 1) === null
}

/**
 * Low ledge the actor can simply walk up (SNES-style step-up): top of the blocking step when it
 * rises no more than `maxRise` above the feet, else null.
 */
export function stepUpTop(x: number, feetY: number, dir: number, halfW: number, maxRise: number): number | null {
  if (!enabled || !dir) return null
  for (const s of solids) {
    if (s.oneWay || s.kind !== 'step') continue
    const top = solidTopAt(s, x)
    const rise = feetY - top
    if (rise <= 3 || rise > maxRise) continue
    if (dir > 0 && x + halfW > s.x0 && x - halfW < s.x0) return top
    if (dir < 0 && x - halfW < s.x1 && x + halfW > s.x1) return top
  }
  return null
}

/** True when feet rest on a slope/escalator solid tagged kind === 'slope'. */
export function onSlopeAt(x: number, feetY: number, halfW = 4, sinkTol = 24): Solid | null {
  if (!enabled) return null
  for (const s of solids) {
    if (s.kind !== 'slope') continue
    if (!covers(s, x, halfW)) continue
    const top = solidTopAt(s, x)
    if (feetY >= top - 3 && feetY <= top + sinkTol) return s
  }
  return null
}
