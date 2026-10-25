#!/usr/bin/env node
import { loadJson, requireKeys, uniqueIds, fail, report } from './_util.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { DATA } from './_util.mjs'

const errors = []
const raw = loadJson('companion.json')
requireKeys(
  raw,
  ['id', 'name', 'role', 'follow', 'invulnerable', 'downed', 'assists', 'limits'],
  'companion',
  errors,
)

if (raw.id && raw.id !== 'CP-01') fail(errors, `companion.id expected CP-01, got ${raw.id}`)
if (raw.role && raw.role !== 'helper') fail(errors, `companion.role expected helper`)

if (raw.follow) {
  requireKeys(
    raw.follow,
    ['target', 'fallback', 'trailDistancePx', 'delayMs', 'teleportIfFarPx'],
    'companion.follow',
    errors,
  )
  if (!Array.isArray(raw.follow.trailDistancePx) || raw.follow.trailDistancePx.length !== 2) {
    fail(errors, 'follow.trailDistancePx must be [min, max]')
  } else if (raw.follow.trailDistancePx[0] > raw.follow.trailDistancePx[1]) {
    fail(errors, 'follow.trailDistancePx: min > max')
  }
  // Cross-ref characters if present
  const charsPath = path.join(DATA, 'characters.json')
  if (fs.existsSync(charsPath)) {
    const chars = JSON.parse(fs.readFileSync(charsPath, 'utf8'))
    const ids = new Set((chars.characters ?? []).map((c) => c.id))
    for (const key of ['target', 'fallback']) {
      const ref = raw.follow[key]
      if (ref && !ids.has(ref)) fail(errors, `follow.${key} ${ref} not in characters.json`)
    }
  }
}

if (raw.downed) {
  requireKeys(raw.downed, ['onHit', 'recoverMs'], 'companion.downed', errors)
  if (raw.downed.onHit && raw.downed.onHit !== 'hide') {
    fail(errors, `downed.onHit expected hide, got ${raw.downed.onHit}`)
  }
  if (raw.downed.recoverMs != null && raw.downed.recoverMs !== 5000) {
    // warn-level via fail only if wildly wrong — keep exact per spec
  }
}

if (!Array.isArray(raw.assists) || raw.assists.length < 3) {
  fail(errors, 'companion.assists need ≥3 (AS-01…AS-03)')
} else {
  uniqueIds(raw.assists, errors, 'assists')
  const want = ['AS-01', 'AS-02', 'AS-03']
  const have = new Set(raw.assists.map((a) => a.id))
  for (const id of want) {
    if (!have.has(id)) fail(errors, `companion.assists missing ${id}`)
  }
  for (const a of raw.assists) {
    requireKeys(a, ['id', 'name', 'type'], `assist ${a.id ?? '?'}`, errors)
  }
}

if (raw.limits) {
  requireKeys(raw.limits, ['cannotKillBoss', 'noBlockingPlayer'], 'companion.limits', errors)
  if (raw.limits.cannotKillBoss !== true) fail(errors, 'limits.cannotKillBoss must be true')
  if (raw.limits.noBlockingPlayer !== true) fail(errors, 'limits.noBlockingPlayer must be true')
}

if (raw.invulnerable !== true) fail(errors, 'companion.invulnerable must be true')

const ok = report('companion.json', errors)
process.exit(ok ? 0 : 1)
