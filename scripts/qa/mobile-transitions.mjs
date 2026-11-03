// Stage-4-to-credits regression: setup uses the debug game object; every user
// action after setup is a real Playwright/CDP touch, never keyboard or mouse.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const OUT = process.env.QA_OUT ?? 'docs/qa-stage4'
const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47313/'
fs.mkdirSync(OUT, { recursive: true })
const profiles = {
  iphone13L: { ...devices['iPhone 13 landscape'] },
  pixel7L: { ...devices['Pixel 7 landscape'] },
  smallAndroidL: { viewport: { width: 640, height: 320 }, screen: { width: 640, height: 320 }, userAgent: devices['Pixel 7'].userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
if (process.env.QA_PROFILE) for (const key of Object.keys(profiles)) if (key !== process.env.QA_PROFILE) delete profiles[key]
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const all = {}
try {
  for (const [name, profile] of Object.entries(profiles)) {
    const context = await browser.newContext(profile)
    await context.addInitScript(() => localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.stack ?? e.message))
    const cdp = await context.newCDPSession(page)
    const point = async (x, y) => {
      const box = await page.locator('canvas').boundingBox()
      assert.ok(box, 'canvas must be visible')
      return { x: box.x + box.width * x / 640, y: box.y + box.height * y / 360 }
    }
    const tap = async (x, y) => { const p = await point(x, y); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(250) }
    const holdStart = async (x, y) => { const p = await point(x, y); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 0 }] }) }
    const holdEnd = async () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const shot = async (label) => { if (name === 'pixel7L') await page.screenshot({ path: `${OUT}/touch-${label}.png`, scale: 'css' }) }
    const state = () => page.evaluate(() => {
      const g = window.__SAKE_GAME__; const s = g.scene.getScene('play')
      return { stage: s.stageNo, modal: s.clearModal, tally: s.tallyDone, camX: s.cameras.main.scrollX,
        hp: [s.boy?.hp, s.girl?.hp], maxHp: [s.heroMaxHp(s.boy), s.girl && s.heroMaxHp(s.girl)],
        purse: { ...s.purse }, scenes: g.scene.getScenes(true).map(x => x.scene.key),
        shop: s.children.list.filter(x => x.depth === 10280 && x.active).map(x => x.list?.filter(y => typeof y.text === 'string').map(y => y.text)),
        popup: s.children.list.filter(x => x.depth === 10290 && x.active).length }
    })
    const button = async (id) => {
      const p = await page.evaluate((id) => { const s = window.__SAKE_GAME__.scene.getScene('play'); const b = s.clearBtns.find(x => x.id === id); return b && { x: s.clearOverlay.x + b.bg.x, y: s.clearOverlay.y + b.bg.y, on: b.on } }, id)
      assert.ok(p?.on, `clear button ${id} must be enabled`); await tap(p.x, p.y)
    }
    try {
      await page.goto(BASE); await page.waitForFunction(() => !!window.__SAKE_GAME__)
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('logo'), null, { timeout: 30000 }); await page.waitForTimeout(800)
      await page.evaluate(() => {
        const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '2p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); g.registry.set('carryPurse', { boy: 100, girl: 100 }); g.registry.set('carryCoins', 200)
        for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
        g.scene.start('play')
      })
      await page.waitForTimeout(3500)
      await tap(615, 14) // the existing on-screen 跳過 control
      await page.waitForFunction(() => { const s = window.__SAKE_GAME__?.scene.getScene('play'); return s?.started && !s.storyIntro }, null, { timeout: 15000 })
      // Reproduce the actual locked boss-camera state; win is injected only to
      // reach the screen quickly (not represented as a completed boss fight).
      await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.cameras.main.setBounds(3160, 0, 640, 360); s.boy.hp = 2; s.girl.hp = 2; s.win() })
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play').tallyDone, null, { timeout: 15000 })
      let st = await state()
      if (process.env.QA_BASELINE === '1') {
        await page.screenshot({ path: `${OUT}/baseline-clear.png`, scale: 'css' })
        const camX = st.camX; await button('shop'); st = await state()
        assert.ok(camX > 0 && !st.modal, 'main must reproduce the locked camera and unresponsive shop touch')
        all[name] = { passed: true, baselineBugReproduced: true, cameraX: camX, shopOpenedByTouch: st.modal, errors }
        assert.deepEqual(errors, []); console.log(name, JSON.stringify(all[name])); continue
      }
      assert.equal(st.camX, 0, 'boss camera bounds must be released'); assert.ok(!st.scenes.includes('UIScene'))
      await shot('01-clear')
      await button('shop'); st = await state(); assert.ok(st.modal && st.shop.length, 'shop opens by touch'); await shot('02-shop')
      assert.ok(st.shop[0].includes('倫寶'), 'first hero is visible')
      await tap(220, 138); st = await state(); assert.ok(st.shop[0].includes('琪寶寶'), 'touch switches second hero')
      const beforeBuy = st.purse.girl; await tap(245, 160); st = await state(); assert.ok(st.purse.girl < beforeBuy, 'touch purchases selected gear')
      // Long-press leave: no click-through even after the old 180ms delay.
      await holdStart(592, 343); await page.waitForTimeout(500); st = await state(); assert.ok(st.modal && !st.shop.length && !st.popup, 'held exit must guard the underlying card')
      await holdEnd(); await page.waitForTimeout(400); st = await state(); assert.ok(!st.modal && !st.popup, 'shop returns to card without opening another modal')
      await button('sleep'); st = await state(); assert.ok(st.modal && st.popup, 'sleep opens by touch'); await shot('03-sleep')
      const coinsBeforeSleep = st.purse.boy + st.purse.girl; await tap(254, 234); await page.waitForTimeout(400); st = await state()
      assert.deepEqual(st.hp, st.maxHp, 'sleep heals both'); assert.equal(coinsBeforeSleep - st.purse.boy - st.purse.girl, 12, 'sleep charges once')
      await page.evaluate(() => { window.__qaRandom = Math.random; Math.random = () => (new Error().stack?.includes('flip (') ? 0.1 : window.__qaRandom()) })
      await button('gamble'); st = await state(); assert.ok(st.modal && st.popup, 'gamble opens by touch'); await shot('04-gamble')
      const beforeBet = (await state()).purse.boy; await tap(254, 234)
      await page.waitForFunction((expected) => window.__SAKE_GAME__.scene.getScene('play').purse.boy === expected, beforeBet + 20, { timeout: 10000 })
      await page.evaluate(() => { Math.random = window.__qaRandom })
      st = await state(); assert.equal(st.purse.boy - beforeBet, 20, 'winning bet changes purse by +20')
      await tap(386, 234); await page.waitForTimeout(400); st = await state(); assert.ok(!st.modal && !st.popup, 'gamble exit returns to card')
      await page.evaluate(() => { Math.random = () => (new Error().stack?.includes('flip (') ? 0.9 : window.__qaRandom()) })
      await button('gamble'); const beforeLoss = (await state()).purse.boy; await tap(254, 234)
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play').children.list.some(x => x.depth === 10290 && x.list?.some(y => y.text?.startsWith('輸晒'))), null, { timeout: 10000 })
      st = await state(); assert.equal(st.purse.boy - beforeLoss, -20, 'losing bet changes purse by -20')
      await tap(386, 234); await page.waitForTimeout(400)
      await page.evaluate(() => { Math.random = window.__qaRandom })
      await button('next'); await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('worldmap'), null, { timeout: 10000 }); await shot('05-worldmap')
      assert.ok(await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').picking), 'world map offers a stage pick')
      await tap(546, 66); assert.ok(!(await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').picking)), 'touch selects stage 5')
      await tap(320, 180); await tap(320, 180)
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('bike') || window.__SAKE_GAME__.scene.isActive('play'), null, { timeout: 12000 })
      if (await page.evaluate(() => window.__SAKE_GAME__.scene.isActive('bike'))) { await tap(610, 52); await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('play'), null, { timeout: 12000 }) }
      await page.waitForTimeout(2200); await tap(615, 14)
      await page.waitForFunction(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.stageNo === 5 && s.started && !s.storyIntro }, null, { timeout: 15000 })
      await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.cameras.main.setBounds(3160, 0, 640, 360); s.win() })
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play').tallyDone, null, { timeout: 15000 })
      await button('credits'); await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('worldmap'), null, { timeout: 10000 }); await tap(320, 180)
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('credits'), null, { timeout: 12000 }); await page.waitForTimeout(1800); await shot('06-credits')
      await tap(320, 180); await page.waitForTimeout(800); await tap(320, 180)
      await page.waitForFunction(() => window.__SAKE_GAME__.scene.isActive('menu'), null, { timeout: 10000 })
      assert.deepEqual(errors, [], 'no uncaught page errors')
      all[name] = { passed: true, actions: ['clear', 'shop-switch-buy-exit-long-touch', 'sleep', 'gamble-win-and-loss', 'worldmap-select', 'bike-skip', 'credits-menu'], errors }
      console.log(name, JSON.stringify(all[name]))
    } catch (e) {
      all[name] = { passed: false, error: e.stack ?? String(e), errors }
      await page.screenshot({ path: `${OUT}/${name}-failure.png`, scale: 'css' }).catch(() => {})
      console.error(name, JSON.stringify(all[name]))
    } finally { await context.close(); fs.writeFileSync(`${OUT}/mobile-transitions.json`, JSON.stringify(all, null, 2) + '\n') }
  }
} finally { await browser.close() }
if (Object.values(all).some((x) => !x.passed)) process.exitCode = 1
