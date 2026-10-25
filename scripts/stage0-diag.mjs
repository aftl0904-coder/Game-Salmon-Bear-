/**
 * Stage 0 diagnosis — Playwright mobile landscape + portrait.
 * Evidence only; does not modify game code.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = process.env.GAME_URL || 'http://127.0.0.1:4741'
const OUT = '/opt/cursor/artifacts/stage0-diag'
fs.mkdirSync(OUT, { recursive: true })

const logLines = []
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  logLines.push(line)
  console.log(line)
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  log(`SHOT ${name} → ${file}`)
  return file
}

async function waitGame(page, ms = 8000) {
  await page.waitForFunction(() => !!window.__SAKE_GAME__, { timeout: ms }).catch(() => null)
  await page.waitForTimeout(600)
}

async function sceneKeys(page) {
  return page.evaluate(() => {
    const g = window.__SAKE_GAME__
    if (!g) return []
    return g.scene.getScenes(true).map((s) => s.sys.settings.key)
  })
}

async function runLandscape() {
  log('=== LANDSCAPE 812x375 ===')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 812, height: 375 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => log(`PAGEERROR landscape: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') log(`CONSOLEERR landscape: ${m.text()}`)
  })

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await shot(page, 'L00-boot-or-splash')
  await waitGame(page, 15000)
  await page.waitForTimeout(1500)
  await shot(page, 'L01-after-boot')

  // Skip logo if present (Space / click)
  for (let i = 0; i < 6; i++) {
    const keys = await sceneKeys(page)
    log(`scenes@${i}: ${keys.join(',')}`)
    if (keys.includes('menu') || keys.includes('play')) break
    await page.keyboard.press('Space')
    await page.mouse.click(406, 187)
    await page.waitForTimeout(800)
  }
  await shot(page, 'L02-menu-or-logo')

  // Select 1P boy + start
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  await page.keyboard.press('Space')
  await page.waitForTimeout(1200)
  await shot(page, 'L03-after-start')

  // Dismiss intro if any
  await page.keyboard.press('Space')
  await page.waitForTimeout(800)
  await shot(page, 'L04-gameplay-start')

  // Measure game-root size vs viewport (portrait thin-strip analogue for landscape)
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('game-root')
    const r = root?.getBoundingClientRect()
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      rootW: r?.width ?? 0,
      rootH: r?.height ?? 0,
      phonePlay: document.body.classList.contains('phone-play'),
      scenes: window.__SAKE_GAME__
        ? window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.sys.settings.key)
        : [],
    }
  })
  log(`METRICS landscape: ${JSON.stringify(metrics)}`)

  // Simulate play: move right + attack
  for (let i = 0; i < 25; i++) {
    await page.keyboard.down('KeyD')
    if (i % 5 === 0) await page.keyboard.press('KeyF')
    if (i % 8 === 0) await page.keyboard.press('KeyW')
    await page.waitForTimeout(120)
  }
  await page.keyboard.up('KeyD')
  await shot(page, 'L05-mid-run')

  // Touch taps at presumed pad corners (if phone-play)
  await page.touchscreen.tap(70, 300)
  await page.waitForTimeout(100)
  await page.touchscreen.tap(740, 300)
  await page.waitForTimeout(400)
  await shot(page, 'L06-after-touch-taps')

  // HUD / canvas text visibility note via DOM
  const hudProbe = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const c = canvas?.getBoundingClientRect()
    return {
      canvas: c ? { w: c.width, h: c.height, x: c.x, y: c.y } : null,
      bodyClass: document.body.className,
    }
  })
  log(`HUDPROBE landscape: ${JSON.stringify(hudProbe)}`)

  await browser.close()
  return metrics
}

async function runPortrait() {
  log('=== PORTRAIT 375x812 ===')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => log(`PAGEERROR portrait: ${e.message}`))

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await waitGame(page, 15000)
  await page.waitForTimeout(2000)
  await shot(page, 'P00-portrait-boot')

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Space')
    await page.mouse.click(187, 400)
    await page.waitForTimeout(700)
  }
  await shot(page, 'P01-portrait-menu-or-game')

  const metrics = await page.evaluate(() => {
    const root = document.getElementById('game-root')
    const r = root?.getBoundingClientRect()
    const canvas = document.querySelector('canvas')?.getBoundingClientRect()
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      rootW: r?.width ?? 0,
      rootH: r?.height ?? 0,
      canvasW: canvas?.width ?? 0,
      canvasH: canvas?.height ?? 0,
      phonePlay: document.body.classList.contains('phone-play'),
      orientationHintPresent: !!document.getElementById('rotate-hint') ||
        !!document.querySelector('[data-rotate-hint]'),
      scenes: window.__SAKE_GAME__
        ? window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.sys.settings.key)
        : [],
    }
  })
  log(`METRICS portrait: ${JSON.stringify(metrics)}`)

  // Ratio check: thin strip if height fills but width is tiny relative to viewport width unused
  const fillRatioW = metrics.rootW / metrics.vw
  const fillRatioH = metrics.rootH / metrics.vh
  log(`FILL portrait W=${fillRatioW.toFixed(3)} H=${fillRatioH.toFixed(3)}`)
  if (fillRatioW < 0.55 && fillRatioH > 0.4) {
    log('CONFIRM candidate: portrait shows letterboxed/thin game strip (issue a)')
  }

  await page.keyboard.press('Enter')
  await page.waitForTimeout(1000)
  await page.keyboard.press('Space')
  await page.waitForTimeout(1500)
  await shot(page, 'P02-portrait-after-start')

  await browser.close()
  return metrics
}

async function main() {
  log(`BASE ${BASE}`)
  // health
  try {
    const res = await fetch(BASE)
    log(`HTTP ${res.status}`)
  } catch (e) {
    log(`HTTP FAIL ${e}`)
    process.exit(1)
  }

  const L = await runLandscape()
  const P = await runPortrait()

  const summary = {
    base: BASE,
    landscape: L,
    portrait: P,
    outDir: OUT,
  }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(OUT, 'diag.log'), logLines.join('\n') + '\n')
  log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
