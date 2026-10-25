#!/usr/bin/env node
import { loadJson, requireKeys, uniqueIds, fail, report } from './_util.mjs'

const errors = []
const raw = loadJson('terrain.json')
if (!raw.tiles || !Array.isArray(raw.tiles)) fail(errors, 'terrain.json: missing tiles[]')
else {
  uniqueIds(raw.tiles, errors, 'terrain')
  const types = new Set(['solid', 'oneWay', 'slope', 'beam'])
  for (const t of raw.tiles) {
    requireKeys(t, ['id', 'type'], `terrain ${t.id ?? '?'}`, errors)
    if (t.type && !types.has(t.type)) fail(errors, `terrain ${t.id}: unknown type ${t.type}`)
    if (t.type === 'slope') {
      requireKeys(t, ['angleDeg', 'speedMultiplier', 'sliding'], `terrain ${t.id}`, errors)
      if (!Array.isArray(t.angleDeg) || t.angleDeg.length < 1) {
        fail(errors, `terrain ${t.id}: angleDeg must be array`)
      }
    }
  }
}
const ok = report('terrain.json', errors)
process.exit(ok ? 0 : 1)
