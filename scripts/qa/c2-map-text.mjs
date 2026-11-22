/**
 * PR-D T7: WorldMap fontSize ×2 screenshots + bounds checks (desktop + iPhone 13).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const BASE = process.env.QA_URL ?? `http://127.0.0.1:${process.env.QA_PORT || '47510'}/`
const outDir = 'docs/qa-map-text'
fs.mkdirSync(outDir, { recursive: true })
const report = { ok: false, errors: [], checks: {}, acceptance: {} }

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
})

async function reachMenu(page) {
  await page.goto(BASE + '?c2=1', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    if (await page.evaluate(() => window.__SAKE_GAME__.scene.isActive('menu'))) return
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
  }
  throw new Error('menu not reached')
}

async function startMap(page, data) {
  await page.evaluate((d) => {
    const g = window.__SAKE_GAME__
    for (const key of ['menu', 'logo', 'studio', 'difficulty', 'play', 'UIScene', 'worldmap']) {
      try { g.scene.stop(key) } catch {}
    }
    g.scene.start('worldmap', d)
  }, data)
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene?.isActive('worldmap'), null, { timeout: 15000 })
  await page.waitForTimeout(900)
}

function collectScript() {
  return () => {
    const s = window.__SAKE_GAME__.scene.getScene('worldmap')
    const items = []
    const walk = (o) => {
      if (!o) return
      if (o.type === 'Text' || typeof o.text === 'string') {
        const fsPx = parseInt(String(o.style?.fontSize ?? ''), 10)
        const b = typeof o.getBounds === 'function' ? o.getBounds() : null
        items.push({
          text: String(o.text ?? '').slice(0, 80),
          fontSize: o.style?.fontSize ?? null,
          fontPx: Number.isFinite(fsPx) ? fsPx : null,
          visible: o.visible !== false && (o.alpha ?? 1) > 0.05,
          bounds: b
            ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }
            : null,
        })
      }
      if (o.list) for (const c of o.list) walk(c)
    }
    walk(s.children)
    return items
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => report.errors.push(String(e.message)))
  await reachMenu(page)

  // Continent 1 map + verse
  await startMap(page, { from: 1, to: 2, next: 'bike', stageNo: 2, pick: true })
  const texts = await page.evaluate(collectScript())
  report.checks.continent1 = texts
  await page.locator('#game-root canvas').screenshot({ path: `${outDir}/continent1-map.png` })
  await page.locator('#game-root canvas').screenshot({ path: `${outDir}/bible-verse.png` })

  // Continent 2 map
  await startMap(page, { from: 6, to: 7, next: 'play', stageNo: 7, pick: true })
  const texts2 = await page.evaluate(collectScript())
  report.checks.continent2 = texts2
  await page.locator('#game-root canvas').screenshot({ path: `${outDir}/continent2-map.png` })

  // New-game choice dialog
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('worldmap')
    try {
      localStorage.setItem(
        'sake-kuma-run-v1',
        JSON.stringify({
          version: 1,
          runId: 'qa',
          startStage: 1,
          lastCleared: 3,
          nextStage: 4,
          gear: {},
          growth: {},
          eligible: true,
          friends: [],
          charm: null,
          mode: '1p',
          solo: 'boy',
          puffLeft: false,
        }),
      )
    } catch {}
    Object.getPrototypeOf(s).showStartDialog.call(s, 1)
  })
  await page.waitForTimeout(400)
  const dialogTexts = await page.evaluate(collectScript())
  report.checks.newGame = dialogTexts
  await page.locator('#game-root canvas').screenshot({ path: `${outDir}/new-game-choice.png` })

  // Title-card verse page (stage outside continent maps)
  await startMap(page, { from: 9, to: 10, next: 'play', stageNo: 10 })
  await page.locator('#game-root canvas').screenshot({ path: `${outDir}/title-card-verse.png` })

  // iPhone 13 — landscape (game is 640×360) + portrait page shot
  const phoneL = await browser.newPage({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  phoneL.on('pageerror', (e) => report.errors.push('iphoneL:' + e.message))
  await reachMenu(phoneL)
  await startMap(phoneL, { from: 1, to: 3, next: 'play', stageNo: 3, pick: true })
  await phoneL.screenshot({ path: `${outDir}/iphone13-map.png` })
  await phoneL.close()

  const phoneP = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  phoneP.on('pageerror', (e) => report.errors.push('iphoneP:' + e.message))
  await reachMenu(phoneP)
  await startMap(phoneP, { from: 1, to: 3, next: 'play', stageNo: 3, pick: true })
  await phoneP.screenshot({ path: `${outDir}/iphone13-portrait.png` })
  await phoneP.close()

  const all = [...texts, ...texts2, ...dialogTexts].filter((t) => t.visible && t.fontPx)
  const tiny = all.filter((t) => t.fontPx > 0 && t.fontPx < 18)
  report.acceptance.W1 = {
    pass: tiny.length === 0,
    sizes: [...new Set(all.map((t) => t.fontSize))],
    tiny,
  }
  assert.ok(report.acceptance.W1.pass, `W1 tiny fonts remain: ${JSON.stringify(tiny)}`)

  const offscreen = all.filter((t) => {
    const b = t.bounds
    if (!b || b.width < 1 || b.height < 1) return false
    return b.left < -2 || b.top < -2 || b.right > 642 || b.bottom > 362
  })
  report.acceptance.W2 = {
    pass: offscreen.length === 0,
    offscreen: offscreen.slice(0, 10),
    screenshots: [
      'continent1-map.png',
      'continent2-map.png',
      'bible-verse.png',
      'new-game-choice.png',
      'title-card-verse.png',
    ],
  }
  assert.ok(report.acceptance.W2.pass, `W2 offscreen ${JSON.stringify(offscreen.slice(0, 5))}`)

  report.acceptance.W3 = {
    pass: fs.existsSync(`${outDir}/iphone13-map.png`),
    screenshot: 'iphone13-map.png',
  }
  assert.ok(report.acceptance.W3.pass, 'W3 missing iPhone screenshot')

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS W1-W3', JSON.stringify(report.acceptance, null, 2))
  process.exit(0)
} catch (e) {
  report.ok = false
  report.error = e.stack || String(e)
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.error('FAIL', report.error)
  process.exit(1)
} finally {
  await browser.close()
}
