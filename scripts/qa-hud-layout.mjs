#!/usr/bin/env node
/**
 * HUD layout QA: crop top band 1:1 + 4×; before/after via QA_PHASE.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const PORT = process.env.QA_PORT || '4741'
const BASE = `http://127.0.0.1:${PORT}`
const PHASE = process.env.QA_PHASE || 'after'
const OUT = `/opt/cursor/artifacts/qa-hud/${PHASE}`
fs.mkdirSync(OUT, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(m)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

try {
  const consoleLines = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[hud]') || t.includes('overlap')) consoleLines.push(t)
  })

  await page.goto(`${BASE}/?debug=1`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  for (const k of ['Space', 'Space', 'Enter']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(400)
  }
  await page.mouse.click(640, 360)
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const sc = g?.scene?.getScene('play') || g?.scene?.getScene('game')
    if (sc) {
      sc.started = true
      sc.children?.list?.forEach?.((o) => {
        if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
      })
    }
  })
  // Wait until HUD built after document.fonts.load
  try {
    await page.waitForFunction(
      () => window.__SAKE_HUD_OVERLAPS__ != null && window.__SAKE_HUD_BOUNDS__?.length > 0,
      { timeout: 8000 },
    )
  } catch {
    say('未能實測: HUD bounds not ready after fonts.load wait')
  }
  await page.waitForTimeout(400)

  const full = path.join(OUT, 'play_full.png')
  await page.screenshot({ path: full })

  // Crop HUD band from game canvas (top ~40 CSS px of canvas)
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: Math.min(80, r.height * 0.18), scale: window.__SAKE_SCALE__ }
  })
  say(`canvas box ${JSON.stringify(box)}`)

  if (box) {
    const hud1 = path.join(OUT, 'hud_1x.png')
    await page.screenshot({
      path: hud1,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.w, 1280 - box.x),
        height: box.h,
      },
    })
    await sharp(hud1)
      .resize({ width: Math.round(box.w * 4), kernel: 'nearest' })
      .png()
      .toFile(path.join(OUT, 'hud_4x.png'))
    say('wrote hud_1x + hud_4x')
  }

  const overlap = await page.evaluate(() => {
    return window.__SAKE_HUD_OVERLAPS__ ?? null
  })
  say(`overlaps ${JSON.stringify(overlap)}`)

  // Damage hearts for empty-slot proof (dark pips)
  const hurtOk = await page.evaluate(() => {
    const setHp = window.__SAKE_HUD_SET_HP__
    if (typeof setHp === 'function') {
      setHp(4)
      return true
    }
    return false
  })
  say(`hurt apply: ${hurtOk}`)
  if (!hurtOk) say('未能實測: __SAKE_HUD_SET_HP__ missing')
  await page.waitForTimeout(400)
  if (box) {
    const hurt1 = path.join(OUT, 'hud_hurt_1x.png')
    await page.screenshot({
      path: hurt1,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.w, 1280 - box.x),
        height: box.h,
      },
    })
    await sharp(hurt1)
      .resize({ width: Math.round(box.w * 4), kernel: 'nearest' })
      .png()
      .toFile(path.join(OUT, 'hud_hurt_4x.png'))
    say('wrote hud_hurt_1x + hud_hurt_4x')
  }

  const report = {
    ok: true,
    phase: PHASE,
    overlaps: overlap,
    console: consoleLines,
    shots: ['play_full.png', 'hud_1x.png', 'hud_4x.png', 'hud_hurt_1x.png'],
    notes:
      overlap && overlap.count === 0
        ? ['HUD bounds overlap = 0', ...consoleLines]
        : overlap == null
          ? ['未能實測: __SAKE_HUD_OVERLAPS__ missing']
          : [`overlap count=${overlap.count}`, ...consoleLines],
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'qa.log'), log.join('\n') + '\n')
  say(JSON.stringify(report, null, 2))
} catch (e) {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: false, error: String(e), log }, null, 2))
  throw e
} finally {
  await browser.close()
}
