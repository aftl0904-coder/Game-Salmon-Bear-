/**
 * JSON data pack (stage data 1–4) — loaded at build time, no gameplay rule changes.
 */
import terrainRaw from '../../../data/terrain.json'
import hazardsRaw from '../../../data/hazards.json'
import enemiesRaw from '../../../data/enemies.json'
import cameraRaw from '../../../data/camera.json'
import signsRaw from '../../../data/signs.json'
import stagesRaw from '../../../data/stages.json'

export const TERRAIN = terrainRaw
export const HAZARDS = hazardsRaw
export const ENEMIES = enemiesRaw
export const CAMERA = cameraRaw
export const SIGNS = signsRaw
export const STAGES = stagesRaw

export type HazardDef = (typeof HAZARDS)[number]
export type EnemyDef = (typeof ENEMIES)[number]
export type SignDef = (typeof SIGNS)[number]
export type CameraDef = typeof CAMERA

export function hazardById(id: string): HazardDef | undefined {
  return HAZARDS.find((h) => h.id === id)
}

export function enemyById(id: string): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id)
}

export function signById(id: string): SignDef | undefined {
  return SIGNS.find((s) => s.id === id)
}

/** Tutorial sign (SG-02) if present. */
export function tutorialSign(): SignDef | undefined {
  return SIGNS.find((s) => s.type === 'tutorial')
}
