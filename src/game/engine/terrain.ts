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
  top: number
  /** One-way planks: land from above only, walk through from the sides. */
  oneWay: boolean
  kind: 'ground' | 'step' | 'platform'
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
    if (feetY >= s.top - 3 && feetY <= s.top + sinkTol) {
      if (best === null || s.top < best) best = s.top
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
    if (prevFeetY <= s.top + 1 && feetY >= s.top - 0.5) {
      if (best === null || s.top < best) best = s.top
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
    if (s.top >= feetY - 3 && (best === null || s.top < best)) best = s.top
  }
  return best
}

/**
 * Solid (non one-way) wall blocking horizontal movement: a step whose top is
 * higher than the feet. Returns the x the actor must be clamped to, else null.
 */
export function wallClampX(x: number, feetY: number, dir: number, halfW: number): number | null {
  if (!enabled || !dir) return null
  for (const s of solids) {
    if (s.oneWay) continue
    if (s.top >= feetY - 3) continue // not taller than the feet → walkable / below
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
