#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const files = [
  'terrain.mjs',
  'hazards.mjs',
  'enemies.mjs',
  'camera.mjs',
  'signs.mjs',
  'environment.mjs',
  'palette.mjs',
  'characters.mjs',
  'companion.mjs',
]
let failed = 0
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' })
  if (r.status !== 0) failed += 1
}
if (failed) {
  console.error(`\n${failed}/${files.length} validators failed`)
  process.exit(1)
}
console.log(`\nAll ${files.length} data validators passed`)
