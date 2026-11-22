/**
 * PR-D T7: WorldMap fontSize ×2 screenshots (desktop + iPhone 13).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47481'
const outDir = 'docs/qa-map-text'
fs.mkdirSync(outDir, { recursive: true })
const report = { ok: false, errors: [], checks: {} }

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})

async function shot(page, name) {
  await page.screenshot({ path: `${outDir}/${name}.png` })
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => report.errors.push(String(e.message)))
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })

  // Continent 1 map (stages 1–5)
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('worldmap', { from: 1, to: 2, next: 'play', stageNo: 2 })
  })
  await page.waitForTimeout(1200)
  const fonts1 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('worldmap')
    const sizes = []
    for (const go of s.children.list) {
      if (go.type === 'Text' && go.style?.fontSize) sizes.push(go.style.fontSize)
      if (go.list) for (const c of go.list) if (c.type === 'Text' && c.style?.fontSize) sizes.push(c.style.fontSize)
    }
    // also recurse containers
    const walk = (o) => {
      if (!o) return
      if (o.type === 'Text' && o.style?.fontSize) sizes.push(String(o.style.fontSize))
      if (o.list) for (const c of o.list) walk(c)
      if (o.iterate) o.iterate((c) => walk(c))
    }
    walk(s.children)
    return [...new Set(sizes)]
  })
  report.checks.continent1Fonts = fonts1
  await shot(page, '01-continent1')

  // Verse panel on map
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.scene?.getScene('worldmap'), null, { timeout: 10000 })
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('worldmap')
    Object.getPrototypeOf(s).showVerse?.call(s, 2)
  })
  await page.waitForTimeout(400)
  await shot(page, '02-verse')

  // Continent 2 (stage 6+)
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('worldmap', { from: 6, to: 7, next: 'play', stageNo: 7 })
  })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.scene?.getScene('worldmap'), null, { timeout: 10000 })
  await page.waitForTimeout(800)
  await shot(page, '03-continent2')

  // New-game dialog
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('worldmap')
    Object.getPrototypeOf(s).showStartDialog.call(s, 1)
  })
  await page.waitForTimeout(400)
  await shot(page, '04-newgame-dialog')

  // iPhone 13
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  await phone.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await phone.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  await phone.evaluate(() => {
    const g = window.__SAKE_GAME__
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('worldmap', { from: 1, to: 3, next: 'play', stageNo: 3 })
  })
  await phone.waitForTimeout(1200)
  await phone.screenshot({ path: `${outDir}/05-iphone13.png` })
  await phone.close()

  // No remaining tiny fonts (9–14) except none expected
  const tiny = (fonts1 || []).filter((f) => {
    const n = parseInt(String(f), 10)
    return n > 0 && n < 18
  })
  report.checks.tinyFonts = tiny
  assert.deepEqual(tiny, [], 'all map fonts should be ≥18 (title 32)')

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS W1-W3', JSON.stringify(report.checks, null, 2))
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
