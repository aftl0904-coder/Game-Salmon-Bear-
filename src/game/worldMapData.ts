import { C2_FIRST_STAGE, stageTitle } from './stageNames'

export type Place = { x: number; y: number; name: string }
export type Pt = [number, number]

/** One continent's world map: art keys, places (1280×720 art coordinates) and the roads between them. */
export type ContinentMap = {
  id: 1 | 2
  /** Texture keys loaded by WorldMapScene. */
  tex: { world: string; worldGreen?: string; icons: string }
  /** Stage number of icon frame 0. */
  firstStage: number
  places: Record<number, Place>
  /** Where the party starts when it arrives from outside this map (the pier on 大陸2). */
  start?: Place
  roads: Record<string, Pt[]>
  /** Walk through every place in between when no direct road is mapped. */
  chain?: boolean
  /** Straight up the side of a tower instead of a road. */
  lift?: { from: number; to: number; base: Pt; top: Pt }
}

/** 第一大陸 — unchanged: stages 1–5. */
export const C1_MAP: ContinentMap = {
  id: 1,
  tex: { world: 'map-world', icons: 'map-icons' },
  firstStage: 1,
  places: {
    1: { x: 300, y: 470, name: '第一關・百畝樹林' },
    2: { x: 470, y: 262, name: '第二關・蜜樹丘' },
    3: { x: 720, y: 412, name: '第三關・月影夜市' },
    4: { x: 842, y: 196, name: '第四關・鹽霧工地' },
    5: { x: 1092, y: 160, name: '第五關・△畝大廈' },
  },
  roads: {
    '1-2': [[300, 470], [380, 452], [440, 405], [500, 352], [484, 302], [470, 262]],
    '2-3': [[470, 262], [484, 302], [510, 345], [580, 336], [650, 326], [704, 380], [720, 412]],
    '3-4': [[720, 412], [760, 380], [790, 330], [800, 280], [820, 236], [842, 196]],
  },
}

/** 第二大陸 — stages 6–10; coordinates measured on art-src/map/c2/world-map-c2-dark.png (the green map shares them). */
export const C2_MAP: ContinentMap = {
  id: 2,
  tex: { world: 'map-c2-dark', worldGreen: 'map-c2-green', icons: 'map-icons-c2' },
  firstStage: C2_FIRST_STAGE,
  places: {
    6: { x: 375, y: 410, name: stageTitle(6) },
    7: { x: 550, y: 585, name: stageTitle(7) },
    8: { x: 1078, y: 369, name: stageTitle(8) },
    9: { x: 988, y: 300, name: stageTitle(9) },
    10: { x: 1050, y: 74, name: stageTitle(10) },
  },
  start: { x: 250, y: 588, name: '碼頭' },
  roads: {
    '0-6': [[250, 588], [206, 556], [156, 531], [131, 494], [156, 462], [212, 438], [288, 419], [375, 410]],
    '6-7': [[375, 410], [400, 438], [410, 500], [456, 531], [500, 550], [550, 585]],
    '7-8': [[550, 585], [612, 606], [700, 603], [812, 588], [862, 538], [900, 498], [988, 456], [1062, 412], [1078, 369]],
    '8-9': [[1078, 369], [1038, 335], [988, 300]],
  },
  chain: true,
  lift: { from: 9, to: 10, base: [1108, 236], top: [1108, 96] },
}

const MAPS = [C1_MAP, C2_MAP]

/** The map a stage lives on, or null when no map knows it (callers fall back to a plain title card). */
export function mapForStage(stage: number): ContinentMap | null {
  return MAPS.find((m) => m.places[stage] !== undefined) ?? null
}

/** Road nodes of a chained map in walking order (pier = 0). */
function nodesOf(m: ContinentMap): number[] {
  return [0, ...Object.keys(m.places).map(Number).sort((a, b) => a - b)]
}

export type Leg = { kind: 'road'; pts: Pt[] } | { kind: 'lift'; from: Pt; base: Pt; top: Pt; to: Pt }

/** Legs for walking from node `a` to node `b` (0 = the pier). Empty when nothing is mapped. */
export function legsBetween(m: ContinentMap, a: number, b: number): Leg[] {
  const direct = m.roads[`${a}-${b}`]
  if (direct) return [{ kind: 'road', pts: direct }]
  if (!m.chain || a === b) return []
  const nodes = nodesOf(m)
  const i = nodes.indexOf(a)
  const j = nodes.indexOf(b)
  if (i < 0 || j < 0) return []
  const legs: Leg[] = []
  const step = j > i ? 1 : -1
  for (let k = i; k !== j; k += step) {
    const u = nodes[k]!
    const v = nodes[k + step]!
    const fwd = step === 1
    const road = m.roads[fwd ? `${u}-${v}` : `${v}-${u}`]
    if (road) {
      legs.push({ kind: 'road', pts: fwd ? road : [...road].reverse() })
      continue
    }
    const lift = m.lift
    if (lift && ((fwd && u === lift.from && v === lift.to) || (!fwd && u === lift.to && v === lift.from))) {
      const p9 = m.places[lift.from]!
      const p10 = m.places[lift.to]!
      legs.push(
        fwd
          ? { kind: 'lift', from: [p9.x, p9.y], base: lift.base, top: lift.top, to: [p10.x, p10.y] }
          : { kind: 'lift', from: [p10.x, p10.y], base: lift.top, top: lift.base, to: [p9.x, p9.y] },
      )
      continue
    }
    return []
  }
  return legs
}
