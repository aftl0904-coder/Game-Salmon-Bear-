#!/usr/bin/env node
import { loadJson, requireKeys, uniqueIds, fail, report } from './_util.mjs'

const errors = []
const list = loadJson('enemies.json')
if (!Array.isArray(list)) fail(errors, 'enemies.json: must be array')
else {
  uniqueIds(list, errors, 'enemy')
  for (const e of list) {
    requireKeys(e, ['id', 'name', 'role', 'answer'], `enemy ${e.id ?? '?'}`, errors)
    if (e.id && !/^E-\d{2}$/.test(e.id)) fail(errors, `enemy ${e.id}: id must match E-##`)
    if (e.ai !== undefined && (typeof e.ai !== 'object' || e.ai === null)) {
      fail(errors, `enemy ${e.id}: ai must be object`)
    }
  }
  const ids = new Set(list.map((e) => e.id))
  if (!ids.has('E-06')) fail(errors, 'enemy: missing required E-06 roller')
  const e06 = list.find((e) => e.id === 'E-06')
  if (e06) {
    if (e06.role !== 'roller') fail(errors, 'E-06: role must be roller')
    requireKeys(e06, ['ai'], 'E-06', errors)
    if (e06.ai) requireKeys(e06.ai, ['rollSpeed', 'followsSlope', 'bounceOnWall'], 'E-06.ai', errors)
  }
}
const ok = report('enemies.json', errors)
process.exit(ok ? 0 : 1)
