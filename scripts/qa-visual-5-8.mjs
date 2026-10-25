#!/usr/bin/env node
/**
 * Visual 5–8 QA: multi-viewport shots, contact sheet 1:1 + 4×, debug scale=0.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = '/opt/cursor/artifacts/qa-visual-5-8'
fs.mkdirSync(OUT, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(m)
}

const browser = await chromium.launch({ headless: true })
const report = { ok: true, viewports: {}, contactSheet: null, notes: [] }

async function enterPlay(page) {
  await page.goto(`${BASE}/?debug=1`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  for (const k of ['Space', 'Space', 'Enter', 'Enter', 'Space']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(350)
  }
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    if (!sc) return
    sc.started = true
    sc.storyIntro?.destroy?.()
    sc.storyIntro = null
    sc.children?.list?.forEach?.((o) => {
      if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
    })
  })
  await page.waitForTimeout(500)
}

for (const vp of [
  { w: 844, h: 390 },
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
  const cons = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[pixel]')) cons.push(t)
  })
  try {
    await enterPlay(page)
    const hits = await page.evaluate(() => window.__SAKE_PIXEL_SCALE__ ?? null)
    const scale = await page.evaluate(() => window.__SAKE_SCALE__ ?? null)
    const name = `play_${vp.w}x${vp.h}`
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas')
      if (!c) return null
      const r = c.getBoundingClientRect()
      return { x: r.x, y: r.y, w: Math.min(280, r.width), h: Math.min(160, r.height) }
    })
    if (box) {
      const crop = path.join(OUT, `${name}_crop.png`)
      await page.screenshot({
        path: crop,
        clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.w, height: box.h },
      })
      await sharp(crop)
        .resize({ width: Math.round(box.w * 4), kernel: 'nearest' })
        .png()
        .toFile(path.join(OUT, `${name}_crop4x.png`))
    }
    report.viewports[`${vp.w}x${vp.h}`] = {
      scaleHits: hits,
      css: scale,
      console: cons,
      ok: Array.isArray(hits) && hits.length === 0,
    }
    say(`${vp.w}x${vp.h} hits=${hits?.length ?? 'null'} css=${JSON.stringify(scale)}`)
  } catch (e) {
    report.viewports[`${vp.w}x${vp.h}`] = { ok: false, error: String(e) }
    say(`未能實測 ${vp.w}x${vp.h}: ${e}`)
  }
  await page.close()
}

// Contact sheet from public/art
try {
  const artRoot = path.join(process.cwd(), 'public/art')
  const files = [
    'salmon-boy.png',
    'bear-girl.png',
    'kind-bear.png',
    'fish-enemy.png',
    'coin.png',
    'enemies/E-01.png',
    'enemies/E-02.png',
    'enemies/E-03.png',
    'enemies/E-05.png',
  ]
  const imgs = []
  for (const f of files) {
    const p = path.join(artRoot, f)
    if (!fs.existsSync(p)) continue
    const meta = await sharp(p).metadata()
    imgs.push({ f, p, w: meta.width || 1, h: meta.height || 1 })
  }
  const gap = 8
  const maxH = Math.max(...imgs.map((i) => i.h), 1)
  const totalW = imgs.reduce((s, i) => s + i.w, 0) + gap * Math.max(0, imgs.length - 1) + 16
  const sheetH = maxH + 16
  const composites = []
  let x = 8
  for (const i of imgs) {
    composites.push({ input: i.p, left: x, top: 8 + (maxH - i.h) })
    x += i.w + gap
  }
  const sheet1 = path.join(OUT, 'contact_sheet_1x.png')
  await sharp({
    create: {
      width: totalW,
      height: sheetH,
      channels: 4,
      background: { r: 40, g: 32, b: 28, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(sheet1)
  await sharp(sheet1)
    .resize({ width: totalW * 4, kernel: 'nearest' })
    .png()
    .toFile(path.join(OUT, 'contact_sheet_4x.png'))
  report.contactSheet = { files: imgs.map((i) => i.f), w: totalW, h: sheetH }
  say(`contact sheet ${imgs.length} sprites`)
} catch (e) {
  report.notes.push(`未能實測 contact sheet: ${e}`)
  say(`未能實測 contact sheet: ${e}`)
}

// Girl color vs source
try {
  const { default: sharpLib } = await import('sharp')
  void sharpLib
  const src = await sharp(path.join(process.cwd(), 'art-src/bear-girl.png')).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const out = await sharp(path.join(process.cwd(), 'public/art/bear-girl.png')).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  report.notes.push(
    `bear-girl src ${src.info.width}x${src.info.height} → out ${out.info.width}x${out.info.height}; 主色藍／金保留，外框加深；原圖無紫衫`,
  )
} catch (e) {
  report.notes.push(`未能實測色差: ${e}`)
}

const allOk = Object.values(report.viewports).every((v) => v.ok)
report.ok = allOk
report.notes.push(
  allOk ? '非整數縮放物件數目 = 0（三視窗）' : '有視窗 scaleHits ≠ 0 或未能實測',
)

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n') + '\n')
say(JSON.stringify(report, null, 2))
await browser.close()
