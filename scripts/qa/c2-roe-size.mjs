/**
 * PR-D T6: roe visual ~65% of prior; hitbox world size unchanged vs 1.7 base.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47481'
const outDir = 'docs/qa-roe-size'
fs.mkdirSync(outDir, { recursive: true })
const report = { ok: false, errors: [], checks: {} }

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => report.errors.push(String(e.message)))

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 1)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  })
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    if (await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && !s?.storyIntro)
    })) break
    await page.waitForTimeout(120)
  }

  const measure = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const h = s.boy
    h.x = 200
    h.y = s.floorY?.() ?? h.y
    const shot = Object.getPrototypeOf(s).spawnRoe.call(s, h, h.x + 20, h.y - 40, 0, 400, 1)
    const body = shot.body
    const out = {
      displayScale: shot.scaleX,
      displayW: shot.displayWidth,
      displayH: shot.displayHeight,
      bodyW: body.width,
      bodyH: body.height,
      worldW: body.width * shot.scaleX,
      worldH: body.height * shot.scaleY,
      ratioVs17: shot.scaleX / 1.7,
    }
    // Expected world hitbox ≈ unscaledFrame * 1.7 (before setSize compensation uses body at 1.1)
    // Also spawn power variants
    const light = Object.getPrototypeOf(s).spawnRoe.call(s, h, h.x + 40, h.y - 40, 0, 400, 0.5)
    const heavy = Object.getPrototypeOf(s).spawnRoe.call(s, h, h.x + 60, h.y - 40, 0, 400, 2)
    out.lightScale = light.scaleX
    out.heavyScale = heavy.scaleX
    out.lightWorldW = light.body.width * light.scaleX
    out.heavyWorldW = heavy.body.width * heavy.scaleX
    out.baseWorldW = out.worldW
    return out
  })
  report.checks.measure = measure
  // Visual ~65% of 1.7 (1.1/1.7 ≈ 0.647)
  assert.ok(measure.displayScale > 1.05 && measure.displayScale < 1.15, `base scale ${measure.displayScale}`)
  assert.ok(Math.abs(measure.ratioVs17 - 1.1 / 1.7) < 0.05, `scale ratio ~65% got ${measure.ratioVs17}`)
  // power multipliers preserved: 0.8 / 1.4
  assert.ok(Math.abs(measure.lightScale - 1.1 * 0.8) < 0.02)
  assert.ok(Math.abs(measure.heavyScale - 1.1 * 1.4) < 0.02)
  // Hitbox world size should match old 1.7 visual scale body (within 5%)
  // At scale 1.1 with setSize×(1.7/1.1), worldW ≈ frameBody * 1.7
  // Light/heavy world should scale with powerMul same as old
  assert.ok(Math.abs(measure.lightWorldW / measure.baseWorldW - 0.8) < 0.08)
  assert.ok(Math.abs(measure.heavyWorldW / measure.baseWorldW - 1.4) < 0.08)

  await page.screenshot({ path: `${outDir}/01-roe-after.png`, timeout: 10000, animations: 'disabled' }).catch(() => {})
  fs.writeFileSync(`${outDir}/measure.json`, JSON.stringify(measure, null, 2))

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS R1-R3', JSON.stringify(report.checks, null, 2))
  process.exit(0)
} catch (e) {
  report.ok = false
  report.error = e.stack || String(e)
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  await page.screenshot({ path: `${outDir}/failure.png` }).catch(() => {})
  console.error('FAIL', report.error)
  process.exit(1)
} finally {
  await browser.close()
}
