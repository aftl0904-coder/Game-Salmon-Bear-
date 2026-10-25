#!/usr/bin/env node
import { loadJson, requireKeys, fail, report } from './_util.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { DATA } from './_util.mjs'

const errors = []
const cam = loadJson('camera.json')
requireKeys(cam, ['mode', 'deadZonePx', 'lookAheadPx', 'vertical', 'lockZones', 'shake'], 'camera', errors)
if (cam.deadZonePx) requireKeys(cam.deadZonePx, ['x', 'y'], 'camera.deadZonePx', errors)
if (cam.vertical) requireKeys(cam.vertical, ['follow', 'smoothing'], 'camera.vertical', errors)
if (cam.shake) requireKeys(cam.shake, ['hit', 'slam', 'ms'], 'camera.shake', errors)
if (!Array.isArray(cam.lockZones)) fail(errors, 'camera.lockZones must be array')
else {
  let stageIds = null
  const stagesPath = path.join(DATA, 'stages.json')
  if (fs.existsSync(stagesPath)) {
    const stages = JSON.parse(fs.readFileSync(stagesPath, 'utf8'))
    stageIds = new Set((Array.isArray(stages) ? stages : []).map((s) => s.id))
  }
  for (const z of cam.lockZones) {
    requireKeys(z, ['stage', 'fromTile', 'toTile', 'reason'], 'lockZone', errors)
    if (stageIds && z.stage && !stageIds.has(z.stage)) {
      fail(errors, `camera.lockZones: stage ref ${z.stage} not in stages.json`)
    }
    if (z.fromTile != null && z.toTile != null && z.fromTile > z.toTile) {
      fail(errors, `camera.lockZones: fromTile > toTile (${z.stage})`)
    }
  }
}
const ok = report('camera.json', errors)
process.exit(ok ? 0 : 1)
