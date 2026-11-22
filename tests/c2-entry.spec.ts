/**
 * Work-order T1 acceptance wrapper.
 * Runs the Playwright entry script used by PR-A (scripts/qa/c2-s6-to-s7-entry.mjs).
 * Evidence → docs/qa-c2-entry/
 *
 * Invoke: QA_PORT=47461 node --import tsx tests/c2-entry.spec.ts
 * Or:     QA_PORT=47461 node scripts/qa/c2-s6-to-s7-entry.mjs
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(root, 'scripts/qa/c2-s6-to-s7-entry.mjs')
const r = spawnSync(process.execPath, [script], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
