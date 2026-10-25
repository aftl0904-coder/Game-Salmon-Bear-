#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const PORT = process.env.QA_PORT || '4741'
const PHASE = process.env.QA_PHASE || 'before'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = `/opt/cursor/artifacts/qa-visual-1-4/${PHASE}`
fs.mkdirSync(OUT, { recursive: true })
const log = []
const say = (m) => { console.log(m); log.push(m) }

const browser = await chromium.launch({ headless: true })

async function shotScene(name, viewport, setup) {
  const page = await browser.newPage({ viewport })
  const consoleHits = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[pixel]') || t.includes('非整數')) consoleHits.push(t)
  })
  await page.goto(`${BASE}/?debug=1`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  for (const k of ['Space', 'Space']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(500)
  }
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  await page.keyboard.press('Space')
  await page.waitForTimeout(800)
  await setup(page)
  await page.waitForTimeout(600)
  const file = path.join(OUT, `${name}_${viewport.width}x${viewport.height}.png`)
  await page.screenshot({ path: file, fullPage: false })
  // 400% crop of canvas top-left cast/hud area for edge check
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  if (box) {
    const cropW = Math.min(320, box.w)
    const cropH = Math.min(200, box.h)
    const cropPath = path.join(OUT, `${name}_${viewport.width}_crop.png`)
    await page.screenshot({
      path: cropPath,
      clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: cropW, height: cropH },
    })
    await sharp(cropPath)
      .resize({ width: cropW * 4, kernel: 'nearest' })
      .png()
      .toFile(path.join(OUT, `${name}_${viewport.width}_crop4x.png`))
  }
  const scaleHits = await page.evaluate(() => window.__SAKE_PIXEL_SCALE__ ?? null)
  say(`${name} ${viewport.width}x${viewport.height} scaleHits=${JSON.stringify(scaleHits)} console=${JSON.stringify(consoleHits)}`)
  await page.close()
  return { scaleHits, consoleHits }
}

const results = { phase: PHASE, scenes: {} }

// Stage 1 start
results.scenes.stage1 = await shotScene('stage1', { width: 1280, height: 720 }, async (page) => {
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const sc = g?.scene?.getScene('play')
    if (sc) {
      sc.started = true
      // hide intro overlay
      sc.children?.list?.forEach?.((o) => {
        if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
      })
    }
  })
})

// Boss approach — jump camera near end
results.scenes.boss = await shotScene('boss', { width: 1280, height: 720 }, async (page) => {
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const sc = g?.scene?.getScene('play')
    if (!sc) return
    sc.started = true
    sc.children?.list?.forEach?.((o) => {
      if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
    })
    const worldW = sc.physics?.world?.bounds?.width || 7200
    const cam = sc.cameras?.main
    if (cam) {
      cam.stopFollow?.()
      cam.setScroll(Math.max(0, worldW - 700), 0)
    }
    // move players near end if present
    if (sc.boy) { sc.boy.x = worldW - 400; sc.boy.y = sc.boy.y }
    if (sc.girl) { sc.girl.x = worldW - 360; sc.girl.y = sc.girl.y }
  })
})

// Clear / win screen
results.scenes.clear = await shotScene('clear', { width: 1280, height: 720 }, async (page) => {
  const ok = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const sc = g?.scene?.getScene('play')
    if (!sc) return false
    sc.started = true
    sc.registry?.set?.('winScreenShown', false)
    if (typeof sc.win === 'function') {
      sc.win()
      return true
    }
    return false
  })
  say(`clear win() invoked: ${ok}`)
  if (!ok) say('未能實測: GameScene.win() not reachable')
  await page.waitForTimeout(1000)
})

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2))
fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n') + '\n')
say(JSON.stringify(results, null, 2))
await browser.close()
