/**
 * fix-play-1: mobile landscape stage1 clear → worldmap → transit → stage2.
 * Touch-only. Profiles: iPhone 13 landscape + Pixel 7 landscape.
 */
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4761/'
const OUT = process.env.QA_OUT ?? 'artifacts/fix-play-1'
const ART = '/opt/cursor/artifacts'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ART, { recursive: true })

const profiles = {
  iphone13L: { ...devices['iPhone 13 landscape'] },
  pixel7L: { ...devices['Pixel 7 landscape'] },
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const summary = {}

try {
  for (const [name, profile] of Object.entries(profiles)) {
    const context = await browser.newContext(profile)
    await context.addInitScript(() => {
      localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 2 }))
      localStorage.setItem('sake-kuma-mg-seen-v1', JSON.stringify({ 'transit-bike-climb': true }))
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)))

    const point = async (x, y) => {
      const box = await page.locator('canvas').boundingBox()
      assert.ok(box, 'canvas')
      return { x: box.x + (box.width * x) / 640, y: box.y + (box.height * y) / 360 }
    }
    const tap = async (x, y) => {
      const p = await point(x, y)
      await page.touchscreen.tap(p.x, p.y)
      await page.waitForTimeout(280)
    }
    const shot = async (label) => {
      const file = path.join(OUT, `${name}-${label}.png`)
      await page.screenshot({ path: file, scale: 'css' })
      fs.copyFileSync(file, path.join(ART, `fix-play-1-${name}-${label}.png`))
      console.log('shot', file)
    }
    const scenes = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key))

    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })
      await page.waitForTimeout(500)

      await page.evaluate(() => {
        const g = window.__SAKE_GAME__
        g.registry.set('stageNo', 1)
        g.registry.set('difficulty', 'normal')
        g.registry.set('playMode', '1p')
        g.registry.set('soloCast', 'boy')
        g.registry.set('stageRound', 1)
        g.registry.set('carryPurse', { boy: 40, girl: 40 })
        g.registry.set('carryCoins', 40)
        for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
        g.scene.start('play')
      })
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('play'), null, { timeout: 20000 })
      await page.waitForTimeout(2200)
      await tap(615, 14).catch(() => {})
      await page.waitForTimeout(600)

      await page.evaluate(() => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        if (s.boy) s.boy.hp = Math.max(1, s.boy.hp)
        s.win()
      })
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play')?.tallyDone, null, {
        timeout: 20000,
      })
      await shot('01-clear')

      const nextBtn = await page.evaluate(() => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        const b = (s.clearBtns || []).find((x) => x.id === 'next' && x.on)
        if (!b) return null
        return { x: s.clearOverlay.x + b.bg.x, y: s.clearOverlay.y + b.bg.y }
      })
      assert.ok(nextBtn, 'next clear button')
      await tap(nextBtn.x, nextBtn.y)

      await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('worldmap'), null, {
        timeout: 15000,
      })
      await shot('02-worldmap')
      const mapState = await page.evaluate(() => {
        const m = window.__SAKE_GAME__.scene.getScene('worldmap')
        return { picking: !!m.picking, next: m.data_?.next, from: m.data_?.from, to: m.data_?.to }
      })
      console.log(name, 'map', mapState)
      assert.equal(mapState.next, 'transit')

      // Tap-anywhere confirm (the phone bug Alan hit)
      await tap(320, 200)
      await page.waitForTimeout(350)
      await tap(320, 200)
      await shot('03-worldmap-confirmed')

      await page.waitForFunction(
        () => {
          const g = window.__SAKE_GAME__
          return g.scene.isActive('transit') || (g.scene.isActive('play') && !g.scene.isActive('worldmap'))
        },
        null,
        { timeout: 28000 },
      )
      let sc = await scenes()
      console.log(name, 'after travel', sc)
      await shot('04-left-worldmap')
      assert.ok(!sc.includes('worldmap') || sc.includes('transit'), 'must leave or overlap into transit')

      if (sc.includes('transit')) {
        await shot('05-transit')
        // Skip via on-screen Ⅱ / start, then dismiss grade
        for (let i = 0; i < 14; i++) {
          await tap(610, 52)
          await tap(320, 200)
          sc = await scenes()
          if (sc.includes('play') && !sc.includes('transit')) break
          await page.waitForTimeout(350)
        }
      }

      await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('play'), null, {
        timeout: 30000,
      })
      const stage = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').stageNo)
      assert.equal(stage, 2, 'enter stage 2')
      await shot('06-stage2')

      assert.deepEqual(errors, [], 'no page errors')
      summary[name] = { passed: true, mapState, scenes: await scenes(), errors }
      console.log(name, 'PASS')
    } catch (e) {
      summary[name] = { passed: false, error: String(e.stack ?? e), errors }
      await page.screenshot({ path: path.join(OUT, `${name}-failure.png`), scale: 'css' }).catch(() => {})
      console.error(name, 'FAIL', summary[name].error)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'mobile-1to2.json'), JSON.stringify(summary, null, 2) + '\n')
}

if (Object.values(summary).some((x) => !x.passed)) process.exitCode = 1
console.log(JSON.stringify(summary, null, 2))
