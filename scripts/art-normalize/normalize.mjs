#!/usr/bin/env node
/** Thin wrapper — real work is Pillow in run.py (reliable in this VM). */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const r = spawnSync('python3', [path.join(dir, 'run.py')], { stdio: 'inherit' })
process.exit(r.status ?? 1)
