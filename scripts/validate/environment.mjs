#!/usr/bin/env node
import { loadJson, requireKeys, uniqueIds, fail, report } from './_util.mjs'

const EXPECTED = ['ST-01', 'ST-02', 'ST-03', 'ST-04', 'ST-05']
const errors = []
const raw = loadJson('environment.json')

requireKeys(raw, ['style', 'stages'], 'environment', errors)
if (!Array.isArray(raw.stages)) {
  fail(errors, 'environment.stages must be array')
} else {
  uniqueIds(raw.stages, errors, 'environment.stages')
  const ids = raw.stages.map((s) => s.id)
  for (const id of EXPECTED) {
    if (!ids.includes(id)) fail(errors, `environment: missing stage ${id}`)
  }
  for (const st of raw.stages) {
    const label = `environment ${st.id ?? '?'}`
    requireKeys(st, ['id', 'name', 'ground', 'layers', 'props', 'lighting', 'particles'], label, errors)
    if (st.ground) {
      requireKeys(
        st.ground,
        ['material', 'tileSizePx', 'variants', 'shading', 'edgeHighlight', 'detail', 'dither'],
        `${label}.ground`,
        errors,
      )
      if (st.ground.tileSizePx != null && st.ground.tileSizePx !== 16) {
        fail(errors, `${label}.ground.tileSizePx must be 16`)
      }
      if (st.ground.variants != null && (st.ground.variants < 4 || st.ground.variants > 8)) {
        fail(errors, `${label}.ground.variants should be 4–8 (got ${st.ground.variants})`)
      }
      if (!Array.isArray(st.ground.detail) || st.ground.detail.length < 1) {
        fail(errors, `${label}.ground.detail must be non-empty array`)
      }
    }
    if (!Array.isArray(st.layers) || st.layers.length < 3) {
      fail(errors, `${label}.layers need ≥3 (far/mid/near)`)
    } else {
      uniqueIds(st.layers, errors, `${label}.layers`)
      const types = new Set(['parallax', 'foreground'])
      for (const layer of st.layers) {
        requireKeys(layer, ['id', 'type', 'speed', 'content'], `${label} layer`, errors)
        if (layer.type && !types.has(layer.type)) {
          fail(errors, `${label} layer ${layer.id}: unknown type ${layer.type}`)
        }
        if (typeof layer.speed !== 'number' || layer.speed <= 0) {
          fail(errors, `${label} layer ${layer.id}: speed must be > 0`)
        }
      }
      const speeds = st.layers.map((l) => l.speed)
      for (let i = 1; i < speeds.length; i++) {
        if (speeds[i] < speeds[i - 1]) {
          fail(errors, `${label}: layer speeds should increase far→near (${speeds.join(',')})`)
          break
        }
      }
    }
    if (!Array.isArray(st.props) || st.props.length < 1) {
      fail(errors, `${label}.props must be non-empty array`)
    }
    if (st.lighting) {
      requireKeys(st.lighting, ['ambient', 'light'], `${label}.lighting`, errors)
      if (st.lighting.light && st.lighting.light !== 'topLeft') {
        fail(errors, `${label}.lighting.light must be topLeft (unified)`)
      }
      if (st.lighting.ambient && !/^#[0-9a-fA-F]{6}$/.test(st.lighting.ambient)) {
        fail(errors, `${label}.lighting.ambient invalid hex`)
      }
      if (st.lighting.flicker) {
        requireKeys(st.lighting.flicker, ['everyMs', 'durationMs'], `${label}.flicker`, errors)
      }
      if (st.lighting.fog) {
        requireKeys(st.lighting.fog, ['color', 'density'], `${label}.fog`, errors)
      }
    }
    if (!Array.isArray(st.particles) || st.particles.length < 1) {
      fail(errors, `${label}.particles must be non-empty array`)
    }
  }
}

const ok = report('environment.json', errors)
process.exit(ok ? 0 : 1)
