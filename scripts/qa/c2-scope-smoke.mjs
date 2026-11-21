/**
 * Scope smoke (Claude 2026-11-22): stage6 boss = mall-scrubber; stage7 boots; map locks 8–10.
 * Injected / automated — not a human playthrough.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47391'
const outDir = 'docs/qa-c2-scope'
fs.mkdirSync(outDir, { recursive: true })
const report = { ok: false, errors: [], checks: {} }

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function bootStage(stageNo) {
  await page.evaluate((n) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', n)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, stageNo)
  const start = Date.now()
  while (Date.now() - start < 25000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    await page.keyboard.press('KeyF')
    const st = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && !s?.storyIntro)
    })
    if (st) return
    await page.waitForTimeout(120)
  }
  throw new Error(`stage ${stageNo} did not start`)
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })

  const kindJson = await page.evaluate(async () => {
    const r = await fetch('/data/levels/stage6.json')
    return (await r.json()).boss?.kind
  })
  report.checks.stage6BossKind = kindJson
  assert.equal(kindJson, 'mall-scrubber')

  await bootStage(6)

  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    Object.getPrototypeOf(s).queenReveal.call(s, { kind: 'mall-scrubber', triggerX: 4680, arenaX0: 4640, arenaX1: 5280 })
  })
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene?.getScene('play')?.queen?.species === 'mall-scrubber', null, { timeout: 10000 })
  const scrub = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const proto = Object.getPrototypeOf(s)
    return {
      species: s.queen?.species ?? null,
      ctor: s.queen?.constructor?.name ?? null,
      act: s.queen?.act ?? null,
      bossName: proto.bossName.call(s),
      hasQueen: !!s.queen,
    }
  })
  report.checks.scrubber = scrub
  assert.equal(scrub.species, 'mall-scrubber')
  assert.equal(scrub.bossName, '商場清潔機械人')
  await page.screenshot({ path: `${outDir}/stage6-scrubber.png` })

  const sight = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const proto = Object.getPrototypeOf(s)
    s.directorSighted = false
    s.bossFight = false
    s.ended = false
    s.started = true
    // Avoid Body.reset (swiftshader frame glitches); only move x for leadX().
    s.boy.x = 4200
    proto.tickDirectorSighting.call(s)
    return { directorSighted: s.directorSighted }
  })
  report.checks.directorSight = sight
  assert.equal(sight.directorSighted, true)

  await bootStage(7)
  const s7 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return { stageNo: s.stageNo, exhibit: s.exhibit, mall: s.mall }
  })
  report.checks.stage7 = s7
  assert.equal(s7.stageNo, 7)
  assert.equal(s7.exhibit, true)
  await page.screenshot({ path: `${outDir}/stage7-boot.png` })

  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('worldmap', { from: 7, to: 7, next: 'play', pick: true })
  })
  await page.waitForFunction(() => {
    const o = window.__SAKE_GAME__?.scene?.getScene('worldmap')?.openStages
    return Array.isArray(o) && o.length > 0
  }, null, { timeout: 20000 })
  const mapOpen = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').openStages)
  report.checks.mapOpen = mapOpen
  assert.ok(mapOpen.includes(6) || mapOpen.includes(7))
  assert.ok(mapOpen.every((n) => n <= 7))
  assert.ok(!mapOpen.includes(8) && !mapOpen.includes(9) && !mapOpen.includes(10))
  await page.screenshot({ path: `${outDir}/map-lock-8-10.png` })

  // Soft-allow known swiftshader WebGL frame noise in this VM
  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  report.ok = report.errors.length === 0
} catch (e) {
  report.ok = false
  report.errors.push(String(e?.stack || e))
} finally {
  fs.writeFileSync(`${outDir}/smoke.json`, JSON.stringify(report, null, 2))
  await browser.close()
}

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}
console.log('PASS', JSON.stringify(report.checks))
