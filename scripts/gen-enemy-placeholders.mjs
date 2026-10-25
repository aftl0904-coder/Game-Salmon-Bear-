#!/usr/bin/env node
/**
 * Generate dark silhouette enemy sprite sheets + ground tile variants.
 * Placeholders only — replace with real art in art-src/ then art:normalize.
 */
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outEnemies = path.join(root, 'public/art/enemies')
const outTiles = path.join(root, 'public/art/tiles')
const outArtSrc = path.join(root, 'art-src/enemies')
await fs.mkdir(outEnemies, { recursive: true })
await fs.mkdir(outTiles, { recursive: true })
await fs.mkdir(outArtSrc, { recursive: true })

/** Frame plan shared by all enemies (assets.json). */
export const FRAME_PLAN = {
  idle: 4,
  walk: 4,
  telegraph: 2,
  attack: 3,
  hurt: 1,
  die: 3,
}
const FRAME_TOTAL = Object.values(FRAME_PLAN).reduce((a, b) => a + b, 0)

const ENEMIES = [
  { id: 'E-01', name: '紅魚', h: 40, w: 36, label: 'E-01' },
  { id: 'E-02', name: '機械豬', h: 72, w: 64, label: 'E-02' },
  { id: 'E-03', name: '帽仔兵', h: 56, w: 40, label: 'E-03' },
  { id: 'E-04', name: '刺球', h: 40, w: 40, label: 'E-04' },
  { id: 'E-05', name: '蜜蜂', h: 40, w: 40, label: 'E-05' },
  { id: 'E-06', name: '滾動怪', h: 56, w: 48, label: 'E-06' },
]

function silhouetteFrame(fw, fh, label, frameIndex) {
  const raw = Buffer.alloc(fw * fh * 4, 0)
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= fw || y >= fh) return
    const i = (y * fw + x) * 4
    raw[i] = r
    raw[i + 1] = g
    raw[i + 2] = b
    raw[i + 3] = a
  }
  // Body blob (dark slate, not pure black)
  const cx = Math.floor(fw / 2)
  const cy = Math.floor(fh * 0.55)
  const rx = Math.floor(fw * 0.32)
  const ry = Math.floor(fh * 0.38)
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      if (nx * nx + ny * ny <= 1) {
        const shade = 48 + Math.floor(((x + y + frameIndex * 3) % 7) * 4)
        set(x, y, shade, shade - 4, shade + 6)
      }
    }
  }
  // Head bump
  const hx = cx
  const hy = Math.floor(fh * 0.28)
  const hr = Math.floor(Math.min(fw, fh) * 0.18)
  for (let y = hy - hr; y <= hy + hr; y++) {
    for (let x = hx - hr; x <= hx + hr; x++) {
      if ((x - hx) * (x - hx) + (y - hy) * (y - hy) <= hr * hr) set(x, y, 60, 56, 70)
    }
  }
  // 1px outline (neighbor darken)
  const copy = Buffer.from(raw)
  const at = (x, y) => (y * fw + x) * 4
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (copy[at(x, y) + 3] >= 128) continue
      let n = -1
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < fw && ny < fh && copy[at(nx, ny) + 3] >= 128) {
          n = at(nx, ny)
          break
        }
      }
      if (n < 0) continue
      const i = at(x, y)
      raw[i] = Math.round(copy[n] * 0.28)
      raw[i + 1] = Math.round(copy[n + 1] * 0.25)
      raw[i + 2] = Math.round(copy[n + 2] * 0.35)
      raw[i + 3] = 255
    }
  }
  // Tiny ID marker (block letters via 3×5 dots — just a bright corner tag)
  const tag = label.replace('E-', '')
  for (let i = 0; i < tag.length && i < 3; i++) {
    const ox = 2 + i * 5
    for (let yy = 2; yy < 7; yy++) for (let xx = 0; xx < 3; xx++) set(ox + xx, yy, 200, 180, 120)
  }
  // Frame index tick (animation proof)
  for (let i = 0; i <= frameIndex % FRAME_TOTAL; i++) {
    set(fw - 3 - i, fh - 3, 180, 160, 100)
  }
  return raw
}

for (const e of ENEMIES) {
  const fw = e.w
  const fh = e.h
  const sheetW = fw * FRAME_TOTAL
  const sheet = Buffer.alloc(sheetW * fh * 4, 0)
  for (let f = 0; f < FRAME_TOTAL; f++) {
    const frame = silhouetteFrame(fw, fh, e.label, f)
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const si = (y * fw + x) * 4
        const di = (y * sheetW + f * fw + x) * 4
        sheet[di] = frame[si]
        sheet[di + 1] = frame[si + 1]
        sheet[di + 2] = frame[si + 2]
        sheet[di + 3] = frame[si + 3]
      }
    }
  }
  const dest = path.join(outEnemies, `${e.id}.png`)
  const srcDest = path.join(outArtSrc, `${e.id}.png`)
  await sharp(sheet, { raw: { width: sheetW, height: fh, channels: 4 } })
    .png({ palette: true, colors: 32, dither: 0 })
    .toFile(dest)
  await fs.copyFile(dest, srcDest)
  console.log(`✓ ${e.id} ${sheetW}x${fh} (${FRAME_TOTAL} frames @ ${fw}x${fh})`)
}

/** 16px ground tiles: grass top / dirt mid / dark base — 4 variants. */
const TS = 16
for (let v = 0; v < 4; v++) {
  const raw = Buffer.alloc(TS * TS * 4, 0)
  const set = (x, y, r, g, b, a = 255) => {
    const i = (y * TS + x) * 4
    raw[i] = r
    raw[i + 1] = g
    raw[i + 2] = b
    raw[i + 3] = a
  }
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      const n = ((x * 3 + y * 5 + v * 11) % 5) - 2
      if (y <= 2) {
        // grass edge highlight
        set(x, y, 90 + n * 4, 140 + n * 3, 70 + n * 2)
      } else if (y <= 9) {
        set(x, y, 110 + n * 5, 78 + n * 3, 48 + n * 2)
      } else {
        set(x, y, 72 + n * 3, 48 + n * 2, 32 + n)
      }
    }
  }
  // top edge highlight / bottom dark
  for (let x = 0; x < TS; x++) {
    set(x, 0, 140, 180, 100)
    set(x, TS - 1, 40, 28, 18)
  }
  const name = `ground-${v}.png`
  await sharp(raw, { raw: { width: TS, height: TS, channels: 4 } })
    .png({ palette: true, colors: 16, dither: 0 })
    .toFile(path.join(outTiles, name))
  console.log(`✓ tile ${name}`)
}

console.log(`\nPlaceholders: ${ENEMIES.length} enemies, 4 ground tiles`)
