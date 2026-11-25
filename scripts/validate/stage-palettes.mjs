#!/usr/bin/env node
import { loadJson, requireKeys, fail, report } from './_util.mjs'

const errors = []
const raw = loadJson('stage-palettes.json')
requireKeys(raw, ['stages'], 'stage-palettes', errors)

if (!Array.isArray(raw.stages) || raw.stages.length !== 10) {
  fail(errors, `stage-palettes.stages must be array of 10 (got ${raw.stages?.length})`)
} else {
  const seen = new Set()
  for (const row of raw.stages) {
    requireKeys(row, ['stage', 'name', 'sky', 'light'], `stage-palettes[${row?.stage}]`, errors)
    // tint / fog may be null (= 原色 / 無)
    if (!('tint' in (row ?? {}))) fail(errors, `stage-palettes[${row?.stage}]: missing key "tint"`)
    if (!('fog' in (row ?? {}))) fail(errors, `stage-palettes[${row?.stage}]: missing key "fog"`)
    if (typeof row.stage !== 'number' || row.stage < 1 || row.stage > 10) {
      fail(errors, `invalid stage number: ${row.stage}`)
    }
    if (seen.has(row.stage)) fail(errors, `duplicate stage ${row.stage}`)
    seen.add(row.stage)
    if (!row.sky || typeof row.sky.top !== 'string' || typeof row.sky.bottom !== 'string') {
      fail(errors, `stage ${row.stage} sky.top/bottom required`)
    } else {
      for (const [k, v] of Object.entries(row.sky)) {
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) fail(errors, `stage ${row.stage} sky.${k} invalid hex`)
      }
    }
    if (row.tint != null && !/^#[0-9a-fA-F]{6}$/.test(row.tint)) {
      fail(errors, `stage ${row.stage} tint invalid hex`)
    }
    if (row.fog != null) {
      requireKeys(row.fog, ['color', 'alpha'], `stage ${row.stage} fog`, errors)
      if (row.fog && !/^#[0-9a-fA-F]{6}$/.test(row.fog.color)) {
        fail(errors, `stage ${row.stage} fog.color invalid hex`)
      }
      if (row.fog && (typeof row.fog.alpha !== 'number' || row.fog.alpha < 0 || row.fog.alpha > 1)) {
        fail(errors, `stage ${row.stage} fog.alpha must be 0..1`)
      }
    }
    if (typeof row.light !== 'number' || row.light <= 0) {
      fail(errors, `stage ${row.stage} light must be positive number`)
    }
    if (row.stage === 10) {
      if (!row.sunrise) fail(errors, 'stage 10 must have sunrise')
      else {
        // tint may be null (= 原色) when Manus far plates already carry the wash (bg-wire-1).
        requireKeys(row.sunrise, ['atX', 'durationMs', 'sky', 'light'], 'stage 10 sunrise', errors)
        if (!('tint' in row.sunrise)) fail(errors, 'stage 10 sunrise: missing key "tint"')
        if (row.sunrise.tint != null && !/^#[0-9a-fA-F]{6}$/.test(row.sunrise.tint)) {
          fail(errors, 'stage 10 sunrise.tint invalid hex')
        }
        if (row.sunrise.atX !== 4560) fail(errors, 'stage 10 sunrise.atX must be 4560')
        if (row.sunrise.durationMs !== 3000) fail(errors, 'stage 10 sunrise.durationMs must be 3000')
      }
    }
  }
  for (let i = 1; i <= 10; i++) {
    if (!seen.has(i)) fail(errors, `missing stage ${i}`)
  }
}

const ok = report('stage-palettes.json', errors)
process.exit(ok ? 0 : 1)
