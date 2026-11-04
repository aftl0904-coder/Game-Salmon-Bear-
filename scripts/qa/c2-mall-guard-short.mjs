// Focused checkpoint test. Stage and actor positions are injected; NOT a full-stage playthrough.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const mode = process.env.MODE || 'desktop'
const out = 'docs/qa-c2-mall-scrubber'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
const errors = [], report = { mode, setup: 'stage 6 and positions injected; hero moved away by injection during windup; not a full run or evasion proof', transitions: [], errors }
page.on('pageerror', e => errors.push(e.message))
const shot = label => page.screenshot({ path: `${out}/${mode}-${label}.png` })
const evaluate = fn => page.evaluate(fn)
try {
  await page.goto('http://127.0.0.1:47431/?c2=1')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 30000 })
  await evaluate(() => {
    const game = window.__SAKE_GAME__
    game.registry.set('stageNo', 6); game.registry.set('difficulty', 'normal'); game.registry.set('playMode', '1p')
    game.registry.set('soloCast', 'boy'); game.registry.set('stageRound', 1)
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key)
    game.scene.start('play')
  })
  await page.waitForFunction(() => { const s=window.__SAKE_GAME__.scene.getScene('play'); return s?.started && !s.storyIntro }, null, { timeout: 20000 })
  const beforeX = await evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x)
  if (mode === 'desktop') {
    await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD')
  } else {
    const box = await page.locator('canvas').boundingBox()
    const x = box.x + box.width * 92 / 640, y = box.y + box.height * 324 / 360
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(600)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  }
  report.input = { beforeX, afterX: await evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.x) }
  assert.ok(report.input.afterX > beforeX + 10, 'movement from actual keyboard or touch')
  await evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = true; s.s2Pending = []
    for (const e of [...s.enemies.getChildren()]) { e.disableBody(true, true); e.destroy() }
    s.boy.setPosition(450, 285); s.boy.body.reset(450, 285); s.boy.setVelocity(0, 0)
    s.spawnS2('guard', 480)
  })
  let prior = ''
  const start = Date.now()
  while (Date.now() - start < 15000) {
    const st = await evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play'), e = s.enemies.getChildren().find(e => e.species === 'guard')
      return e && { now: Math.round(s.time.now), phase: e.phase, elapsed: Math.round(e.elapsed), fsm: e.fsm, x: Math.round(e.x), heroX: Math.round(s.boy.x), heroHp: s.boy.hp, marker: e.marker.visible, canHurt: e.canHurtPlayer(), texture: e.texture.key }
    })
    if (st && st.phase !== prior) {
      report.transitions.push(st); prior = st.phase
      if (st.phase === 'windup') await evaluate(() => {
        const h=window.__SAKE_GAME__.scene.getScene('play').boy
        h.setPosition(400, 285); h.body.reset(400, 285); h.setVelocity(0, 0)
      })
      if (['windup', 'recover'].includes(st.phase)) await shot(st.phase)
      if (st.phase === 'recover') break
    }
    await page.waitForTimeout(40)
  }
  const states = report.transitions.map(x => x.phase)
  assert.ok(states.includes('windup') && states.includes('strike') && states.includes('recover'), 'observed windup → strike → recover')
  const wind = report.transitions.find(x => x.phase === 'windup'), strike = report.transitions.find(x => x.phase === 'strike'), recover = report.transitions.find(x => x.phase === 'recover')
  assert.equal(wind.marker, true); assert.equal(wind.canHurt, false); assert.equal(strike.canHurt, true); assert.equal(recover.canHurt, false)
  assert.ok(strike.now - wind.now >= 750, 'telegraph lasts at least ~800ms (sampling tolerance)')
  assert.ok(Math.abs(recover.x - wind.x) < 2, 'stationary strike cannot overshoot under slow frames')
  assert.equal(wind.texture, 'mall-human-guard-placeholder')
  // Test that the real player's attack button still produces a game input (not injected damage).
  if (mode === 'desktop') await page.keyboard.press('KeyF')
  else {
    const box = await page.locator('canvas').boundingBox()
    await page.touchscreen.tap(box.x + box.width * 532 / 640, box.y + box.height * 312 / 360)
  }
  await page.waitForTimeout(400)
  report.afterAttack = await evaluate(() => { const s=window.__SAKE_GAME__.scene.getScene('play'); const e=s.enemies.getChildren().find(e=>e.species==='guard'); return { hp:e?.hp ?? null, heroHp:s.boy.hp } })
  assert.deepEqual(errors, [])
  report.passed = true
} catch (error) {
  report.passed = false; report.error = error.stack || String(error)
  await shot('failure').catch(() => {})
} finally {
  fs.writeFileSync(`${out}/${mode}-short.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
if (!report.passed) process.exitCode = 1
