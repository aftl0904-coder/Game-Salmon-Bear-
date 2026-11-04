// Baseline menu regression only. Scene entry is injected; no growth UI exists yet.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47931/'
const out = process.env.QA_OUT ?? 'docs/qa-first-release-growth'
const mode = process.env.QA_MODE ?? 'desktop'
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
const page = await context.newPage(), errors = []
const report = { mode, setup: 'injected menu scene, fresh isolated browser storage', passed: false, errors }
page.on('pageerror', e => errors.push(e.message))
try {
  await page.goto(base + '?c2=1')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 45000 })
  await page.evaluate(() => {
    const game = window.__SAKE_GAME__
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key)
    game.scene.start('menu')
  })
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('menu'), null, { timeout: 15000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/${mode}-baseline-menu.png`, scale: 'css' })
  if (mode === 'mobile') {
    const box = await page.locator('canvas').boundingBox()
    assert.ok(box)
    const tap = async (x, y) => { await page.touchscreen.tap(box.x + box.width*x/640, box.y + box.height*y/360); await page.waitForTimeout(300) }
    await tap(258, 143)
    await tap(320, 334)
  } else {
    await page.keyboard.press('1')
    await page.keyboard.press('Enter')
  }
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('gacha'), null, { timeout: 20000 })
  const run = await page.evaluate(() => JSON.parse(localStorage.getItem('sake-kuma-run-v1')))
  assert.equal(run.startStage, 1)
  assert.equal(run.eligible, true)
  assert.equal(run.version, 2)
  assert.equal(run.growth.activeId, run.runId)
  assert.equal(run.growth.branches[0].heroes.boy.earned, 5)
  assert.equal(run.growth.branches[0].heroes.girl.earned, 5)
  assert.deepEqual(errors, [])
  await page.screenshot({ path: `${out}/${mode}-baseline-new-run.png`, scale: 'css' })
  const before = await page.evaluate(() => localStorage.getItem('sake-kuma-run-v1'))
  await page.evaluate(() => {
    const game = window.__SAKE_GAME__
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key)
    game.scene.start('menu')
  })
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('menu'))
  await page.waitForTimeout(1200)
  if (mode === 'mobile') {
    const box = await page.locator('canvas').boundingBox()
    const tap = async (x, y) => { await page.touchscreen.tap(box.x + box.width*x/640, box.y + box.height*y/360); await page.waitForTimeout(400) }
    await tap(258, 143); await tap(320, 334)
    await page.waitForFunction(() => !!window.__SAKE_GAME__.scene.getScene('menu').startDialog)
    await tap(320, 194)
  } else {
    await page.keyboard.press('1'); await page.keyboard.press('Enter')
    await page.waitForFunction(() => !!window.__SAKE_GAME__.scene.getScene('menu').startDialog)
    await page.waitForTimeout(350)
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter')
  }
  await page.waitForFunction(() => document.querySelector('#save-warning')?.textContent.includes('取回介面'))
  assert.equal(await page.evaluate(() => localStorage.getItem('sake-kuma-run-v1')), before)
  assert.equal(await page.evaluate(() => window.__SAKE_GAME__.scene.isActive('menu')), true)
  await page.screenshot({ path: `${out}/${mode}-restart-blocked.png`, scale: 'css' })
  report.passed = true
  report.result = 'existing menu creates v2 5+5; restart with existing growth is blocked without changing storage; no growth UI'
  console.log('PASS', mode, report.result)
} catch (e) {
  report.error = e.stack ?? String(e)
  console.error(report.error)
  await page.screenshot({ path: `${out}/${mode}-baseline-failure.png`, scale: 'css' }).catch(() => {})
} finally {
  fs.writeFileSync(`${out}/${mode}-baseline-input.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
if (!report.passed) process.exitCode = 1
