#!/usr/bin/env node
/** Resize wallpaper to 640×360 (lanczos3) and quantize to 64 colours. */
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'art-src/bg-wallpaper.jpg')
const alt = path.join(root, 'public/art/bg-wallpaper.jpg')
const input = (await fs.access(src).then(() => src).catch(() => null)) ?? alt
const outJpg = path.join(root, 'public/art/bg-wallpaper.jpg')
const outPng = path.join(root, 'public/art/bg-wallpaper-px.png')

await fs.mkdir(path.join(root, 'art-src'), { recursive: true })
if (input === alt) {
  try {
    await fs.copyFile(alt, src)
  } catch {
    /* ignore */
  }
}

const buf = await sharp(input)
  .resize(640, 360, { fit: 'cover', kernel: 'lanczos3' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { data, info } = buf
await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .png({ palette: true, colors: 64, dither: 0 })
  .toFile(outPng)

// Also write jpg for BootScene current key (from png raster)
await sharp(outPng).jpeg({ quality: 92 }).toFile(outJpg)
console.log(`✓ bg-wallpaper 640×360 ≤64c → ${outPng} + ${outJpg}`)
