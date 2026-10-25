#!/usr/bin/env node
/**
 * Per-sprite normalize for 640×360 bible heights.
 * Sources: art-src/ → public/art/
 * lanczos3 height (optional width), binary alpha, 1px neighbor-dark outline,
 * per-sprite palette ≤64, no dither. Skips fonts / tile globs / non-raster.
 */
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsPath = path.join(root, 'data/assets.json')
const srcDir = path.join(root, 'art-src')
const outDir = path.join(root, 'public/art')

const assets = JSON.parse(await fs.readFile(assetsPath, 'utf8'))
if (!Array.isArray(assets) || assets.length < 1) {
  console.error('data/assets.json must be a non-empty array')
  process.exit(1)
}

await fs.mkdir(outDir, { recursive: true })

const RASTER = /\.(png|jpe?g|webp|gif)$/i
let done = 0
let skipped = 0

for (const a of assets) {
  if (a?.skipNormalize) {
    console.log(`· skip ${a.id} (skipNormalize)`)
    skipped++
    continue
  }
  if (!a?.source || typeof a.source !== 'string' || a.source.includes('*')) {
    console.log(`· skip ${a.id ?? '?'} (glob / missing source)`)
    skipped++
    continue
  }
  if (!RASTER.test(a.source)) {
    console.log(`· skip ${a.id} (non-raster ${a.source})`)
    skipped++
    continue
  }
  if (!a.output || typeof a.output !== 'string' || !a.targetHeightPx) {
    console.error('asset missing output/targetHeightPx', a)
    process.exit(1)
  }

  const srcPath = path.join(srcDir, a.source)
  try {
    await fs.access(srcPath)
  } catch {
    console.error(`✗ missing art-src/${a.source}`)
    process.exit(1)
  }

  const colors = Math.min(64, Math.max(2, a.colors ?? 64))
  // Final bitmap (incl. 1px outline) must equal targetHeightPx (± width).
  const bodyH = Math.max(2, a.targetHeightPx - 2)
  const bodyW = a.targetWidthPx ? Math.max(2, a.targetWidthPx - 2) : undefined

  // 1. Resize once to body size, then pad 1px for outline room
  let pipeline = sharp(srcPath).ensureAlpha()
  if (a.trim !== false) pipeline = pipeline.trim()
  const resizeOpts = {
    height: bodyH,
    kernel: 'lanczos3',
    fit: bodyW ? 'fill' : 'inside',
  }
  if (bodyW) resizeOpts.width = bodyW
  const { data, info } = await pipeline
    .resize(resizeOpts)
    .extend({
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const W = info.width
  const H = info.height
  const at = (x, y) => (y * W + x) * 4

  // 2. Binary alpha
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0

  // 3. 1px outline from darkened neighbor (not pure black)
  const out = Buffer.from(data)
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[at(x, y) + 3]) continue
      let n = -1
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && data[at(nx, ny) + 3]) {
          n = at(nx, ny)
          break
        }
      }
      if (n < 0) continue
      const i = at(x, y)
      out[i] = Math.round(data[n] * 0.28)
      out[i + 1] = Math.round(data[n + 1] * 0.25)
      out[i + 2] = Math.round(data[n + 2] * 0.35)
      out[i + 3] = 255
    }
  }

  const dest = path.join(outDir, a.output)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .png({ palette: true, colors, dither: 0 })
    .toFile(dest)

  console.log(`✓ ${a.id} ${a.output} ${W}x${H} ≤${colors}c`)
  done++
}

console.log(`\nNormalized ${done} assets (${skipped} skipped) → public/art/`)
