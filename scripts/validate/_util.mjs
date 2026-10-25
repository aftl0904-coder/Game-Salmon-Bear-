import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')

export function loadJson(name) {
  const p = path.join(DATA, name)
  if (!fs.existsSync(p)) throw new Error(`missing ${name}`)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

export function fail(errors, msg) {
  errors.push(msg)
}

export function requireKeys(obj, keys, label, errors) {
  for (const k of keys) {
    if (obj[k] === undefined || obj[k] === null) fail(errors, `${label}: missing required "${k}"`)
  }
}

export function uniqueIds(items, errors, label = 'id') {
  const seen = new Map()
  for (const it of items) {
    const id = it?.id
    if (!id) {
      fail(errors, `${label}: entry missing id`)
      continue
    }
    if (seen.has(id)) fail(errors, `${label}: duplicate id ${id}`)
    seen.set(id, true)
  }
  return seen
}

export function report(name, errors) {
  if (errors.length) {
    console.error(`FAIL ${name} (${errors.length})`)
    for (const e of errors) console.error(`  - ${e}`)
    return false
  }
  console.log(`OK   ${name}`)
  return true
}
