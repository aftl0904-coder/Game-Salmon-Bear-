/**
 * PR-D T6: roe visual ~65% of prior; hitbox world size unchanged vs 1.7 base.
 * Before baseline @ frame 11: world 18.7 / display 18.7 @ scale 1.7
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const BASE = process.env.QA_URL ?? `http://127.0.0.1:${process.env.QA_PORT || '47510'}/`
const outDir = 'docs/qa-roe-size'
fs.mkdirSync(outDir, { recursive: true })

const report = { ok: false, errors: [], checks: {}, acceptance: {} }
const near = (a, b, eps = 0.08) => Math.abs(a - b) <= eps

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function reachMenu() {
  await page.goto(BASE + '?c2=0', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    if (await page.evaluate(() => window.__SAKE_GAME__.scene.isActive('menu'))) return
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
  }
  throw new Error('menu not reached')
}

async function startPlay() {
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 1)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const key of ['menu', 'logo', 'studio', 'difficulty', 'worldmap']) {
      if (g.scene.isActive(key) || g.scene.getScene(key)) g.scene.stop(key)
    }
    g.scene.start('play')
  })
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    if (await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && !s?.storyIntro)
    })) return
    await page.waitForTimeout(120)
  }
  throw new Error('play not started')
}

try {
  await reachMenu()
  await startPlay()

  // Confirm texture present
  const texOk = await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    if (!g.textures.exists('fx-salmon-shot')) return { ok: false }
    return { ok: true, w: g.textures.get('fx-salmon-shot').getSourceImage().width }
  })
  assert.ok(texOk.ok, 'fx-salmon-shot texture missing')
  report.checks.tex = texOk

  // BEFORE visual: temporarily scale a shot to 1.7 for screenshot
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const h = s.boy
    const shot = s.shots.create(h.x + 48, h.y - 48, 'fx-salmon-shot')
    shot.setScale(1.7)
    shot.setVelocity(0, 0)
    ;(shot.body).allowGravity = false
    window.__roeBefore = shot
  })
  await page.locator('#game-root canvas').screenshot({ path: `${outDir}/before-shot.png` })
  await page.evaluate(() => {
    window.__roeBefore?.destroy()
    window.__roeBefore = null
  })

  const measure = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const h = s.boy
    const spawn = Object.getPrototypeOf(s).spawnRoe.bind(s)
    function info(shot) {
      s.physics.world.update(0, 16)
      const b = shot.body
      return {
        scale: shot.scaleX,
        displayW: shot.displayWidth,
        displayH: shot.displayHeight,
        frameW: shot.frame.width,
        bodyW: b.width,
        sourceW: b.sourceWidth,
        worldW: b.right - b.left,
        worldH: b.bottom - b.top,
        texKey: shot.texture.key,
      }
    }
    const out = {}
    for (const [name, power] of [['p1', 1], ['light', 0.5], ['heavy', 2.2]]) {
      const shot = spawn(h, h.x + 40, h.y - 40, 0, 280, power)
      out[name] = info(shot)
      if (name === 'p1') shot.setVelocity(0, 0)
      else shot.destroy()
    }
    // Expected before world sizes from same frame
    const f = out.p1.frameW
    out.expectedBefore = {
      p1: f * 1.7,
      light: f * 1.7 * 0.8,
      heavy: f * 1.7 * 1.4,
      displayP1: f * 1.7,
    }
    return out
  })
  report.checks.measure = measure
  fs.writeFileSync(`${outDir}/after-measure.json`, JSON.stringify(measure, null, 2))
  fs.writeFileSync(
    `${outDir}/before-baseline.json`,
    JSON.stringify(
      {
        note: 'Derived from same frame size × old scale 1.7 (power muls 0.8/1.4)',
        frameW: measure.p1.frameW,
        ...measure.expectedBefore,
      },
      null,
      2,
    ),
  )

  await page.locator('#game-root canvas').screenshot({ path: `${outDir}/after-shot.png` })

  assert.equal(measure.p1.texKey, 'fx-salmon-shot')

  // R1 visual ~65%
  const ratio = measure.p1.displayW / measure.expectedBefore.displayP1
  report.acceptance.R1 = {
    pass: ratio > 0.60 && ratio < 0.70 && near(measure.p1.scale, 1.1),
    ratio,
    beforeDisplay: measure.expectedBefore.displayP1,
    afterDisplay: measure.p1.displayW,
  }
  assert.ok(report.acceptance.R1.pass, `R1 fail ${JSON.stringify(report.acceptance.R1)}`)

  // R2 hitbox matches old 1.7 world size
  report.acceptance.R2 = {
    pass:
      near(measure.p1.worldW, measure.expectedBefore.p1) &&
      near(measure.light.worldW, measure.expectedBefore.light) &&
      near(measure.heavy.worldW, measure.expectedBefore.heavy),
    before: measure.expectedBefore,
    after: { p1: measure.p1.worldW, light: measure.light.worldW, heavy: measure.heavy.worldW },
  }
  assert.ok(report.acceptance.R2.pass, `R2 fail ${JSON.stringify(report.acceptance.R2)}`)

  // R3 power multipliers
  report.acceptance.R3 = {
    pass: near(measure.p1.scale, 1.1) && near(measure.light.scale, 0.88) && near(measure.heavy.scale, 1.54),
    scales: { p1: measure.p1.scale, light: measure.light.scale, heavy: measure.heavy.scale },
  }
  assert.ok(report.acceptance.R3.pass, `R3 fail ${JSON.stringify(report.acceptance.R3)}`)

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS R1-R3', JSON.stringify(report.acceptance, null, 2))
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
