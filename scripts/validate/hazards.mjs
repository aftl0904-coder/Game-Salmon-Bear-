#!/usr/bin/env node
import { loadJson, requireKeys, uniqueIds, fail, report } from './_util.mjs'

const errors = []
const list = loadJson('hazards.json')
if (!Array.isArray(list)) fail(errors, 'hazards.json: must be array')
else {
  uniqueIds(list, errors, 'hazard')
  for (const h of list) {
    requireKeys(h, ['id', 'name', 'type', 'answer'], `hazard ${h.id ?? '?'}`, errors)
    if (h.id && !/^H-\d{2}$/.test(h.id)) fail(errors, `hazard ${h.id}: id must match H-##`)
  }
  const ids = new Set(list.map((h) => h.id))
  if (!ids.has('H-09')) fail(errors, 'hazard: missing required H-09 ceilingCrusher')
  const h09 = list.find((h) => h.id === 'H-09')
  if (h09) {
    requireKeys(
      h09,
      ['restBottomFromGroundPx', 'lowBottomFromGroundPx', 'warnMs', 'downMs', 'stayMs', 'upMs', 'damage'],
      'H-09',
      errors,
    )
    if (h09.type !== 'ceilingCrusher') fail(errors, 'H-09: type must be ceilingCrusher')
  }
}
const ok = report('hazards.json', errors)
process.exit(ok ? 0 : 1)
