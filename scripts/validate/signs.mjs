#!/usr/bin/env node
import { loadJson, requireKeys, uniqueIds, fail, report } from './_util.mjs'

const errors = []
const list = loadJson('signs.json')
if (!Array.isArray(list)) fail(errors, 'signs.json: must be array')
else {
  uniqueIds(list, errors, 'sign')
  for (const s of list) {
    requireKeys(s, ['id', 'name', 'type'], `sign ${s.id ?? '?'}`, errors)
    if (s.id && !/^SG-\d{2}$/.test(s.id)) fail(errors, `sign ${s.id}: id must match SG-##`)
    if (s.type === 'tutorial') {
      requireKeys(s, ['text', 'showMs'], `sign ${s.id}`, errors)
    }
    if (s.type === 'direction') {
      requireKeys(s, ['icon'], `sign ${s.id}`, errors)
    }
  }
}
const ok = report('signs.json', errors)
process.exit(ok ? 0 : 1)
