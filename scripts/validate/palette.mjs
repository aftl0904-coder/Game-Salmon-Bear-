#!/usr/bin/env node
import { loadJson, requireKeys, fail, report } from './_util.mjs'

const STAGE_IDS = ['ST-01', 'ST-02', 'ST-03', 'ST-04', 'ST-05']
const errors = []
const raw = loadJson('palette.json')

requireKeys(raw, ['main', 'perStageTint', 'rules'], 'palette', errors)

if (raw.main) {
  requireKeys(raw.main, ['maxColors', 'colors'], 'palette.main', errors)
  const max = raw.main.maxColors ?? 32
  if (!Array.isArray(raw.main.colors)) {
    fail(errors, 'palette.main.colors must be array')
  } else {
    if (raw.main.colors.length !== max) {
      fail(errors, `palette.main.colors length ${raw.main.colors.length} ≠ maxColors ${max}`)
    }
    const seen = new Set()
    for (const c of raw.main.colors) {
      if (typeof c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c)) {
        fail(errors, `palette.main.colors invalid hex: ${c}`)
        continue
      }
      const low = c.toLowerCase()
      if (seen.has(low)) fail(errors, `palette.main.colors duplicate ${c}`)
      seen.add(low)
      if (raw.rules?.noPureBlack && low === '#000000') {
        fail(errors, 'palette.main.colors must not include pure black (#000000)')
      }
    }
  }
  if (Array.isArray(raw.main.rgb)) {
    if (raw.main.rgb.length !== (raw.main.colors?.length ?? 0)) {
      fail(errors, 'palette.main.rgb length must match colors')
    }
  }
}

if (raw.perStageTint) {
  for (const id of STAGE_IDS) {
    const tint = raw.perStageTint[id]
    if (!tint) fail(errors, `palette.perStageTint missing ${id}`)
    else if (!/^#[0-9a-fA-F]{6}$/.test(tint)) {
      fail(errors, `palette.perStageTint.${id} invalid hex`)
    }
  }
}

if (raw.rules) {
  requireKeys(raw.rules, ['outline', 'lightDirection', 'noPureBlack'], 'palette.rules', errors)
  if (raw.rules.lightDirection && raw.rules.lightDirection !== 'topLeft') {
    fail(errors, 'palette.rules.lightDirection must be topLeft')
  }
  if (raw.rules.noPureBlack !== true) {
    fail(errors, 'palette.rules.noPureBlack must be true')
  }
}

const ok = report('palette.json', errors)
process.exit(ok ? 0 : 1)
