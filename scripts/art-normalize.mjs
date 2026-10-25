#!/usr/bin/env node
/**
 * Per-sprite normalize for 640×360 bible heights.
 * Sources: art-src/ → public/art/ (lanczos3 height, binary alpha, 1px neighbor-dark outline, ≤64 palette, no dither).
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

for (const a of assets) {
  if (!a?.source || !a?.output || !a?.targetHeightPx) {
    console.error('asset missing source/output/targetHeightPx', a)
    process.exit(1)
  }
  if (!a.license) {
    console.warn(`⚠ ${a.id ?? a.output}: missing license field`)
  }

  const srcPath = path.join(srcDir, a.source)
  try {
    await fs.access(srcPath)
  } catch {
    console.error(`✗ missing art-src/${a.source}`)
    process.exit(1)
  }

  // 1. 一次過縮放到目標高度（之後遊戲入面 scale = 1）
  const { data, info } = await sharp(srcPath)
    .trim()
    .resize({ height: a.targetHeightPx, kernel: 'lanczos3' })
    .extend({
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const W = info.width
  const H = info.height
  const at = (x, y) => (y * W + x) * 4

  // 2. alpha 二值化，去走半透明毛邊
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0

  // 3. 1px 外框：顏色取相鄰像素加深，唔用純黑
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

  // 4. 每個 sprite 各自量化（唔用全域 32 色）
  const dest = path.join(outDir, a.output)
  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .png({ palette: true, colors: a.colors ?? 64, dither: 0 })
    .toFile(dest)

  console.log(`✓ ${a.id} ${a.output} ${W}x${H}`)
}

console.log(`\nNormalized ${assets.length} assets → public/art/`)
