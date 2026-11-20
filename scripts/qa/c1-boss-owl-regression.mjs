// Injected stage/boss/phase diagnostic: verifies the real stage-3 Owl path remains separate.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out = 'docs/qa-c1-boss'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await context.newPage(), errors = []
page.on('pageerror', e => errors.push(e.message))
try {
  await page.goto(process.env.QA_BASE_URL ?? 'http://127.0.0.1:47327/')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 30000 })
  await page.waitForTimeout(700)
  await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 3); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
  await page.waitForTimeout(3500); await page.keyboard.press('Enter')
  await page.waitForFunction(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.started && !s.storyIntro }, null, { timeout: 20000 })
  await page.evaluate(async () => {
    const s = window.__SAKE_GAME__.scene.getScene('play'); s.s2Pending = []; s.coffeeDone = true
    for (const e of [...s.enemies.getChildren()]) { e.disableBody?.(true, true); e.destroy() }
    s.bossFight = true; const h = s.boy; h.setPosition(3400, 285); h.body.reset(3400, 285); h.laneJumping = false; h.grace = 0; h.hurtCd = 0
    const { MirrorOwl } = await import('/src/game/enemies/Stage3Enemies.ts')
    const q = new MirrorOwl(s, 3650, 3160, 3800, s.s2Hooks(), s.owlHooks()); s.addS2Enemy(q); s.queen = q; q.act = 'feathers'; q.t = 0; q.cued = false
    s.cameras.main.setBounds(3160, 0, 640, 360)
  })
  await page.waitForFunction(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.queen?.cued }, null, { timeout: 5000 })
  const warn = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { boss: s.queen.constructor.name, act: s.queen.act, gap: s.queen.gapX, time: s.time.now } })
  assert.equal(warn.boss, 'MirrorOwl'); assert.equal(warn.act, 'feathers')
  await page.screenshot({ path: `${out}/stage3-owl-warning.png` })
  await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play').enemyShots.countActive() > 0, null, { timeout: 4000 })
  const shots = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { time: s.time.now, gap: s.queen.gapX, xs: s.enemyShots.getChildren().filter(o => o.active).map(o => ({ x: o.x, stage5Mark: o.getData?.('triFeatherX') })) } })
  assert.ok(shots.xs.length > 10); assert.ok(shots.xs.every(o => o.stage5Mark === undefined)); assert.ok(shots.xs.every(o => Math.abs(o.x - shots.gap) >= 40))
  await page.screenshot({ path: `${out}/stage3-owl-feathers.png` })
  await page.waitForTimeout(2300)
  const end = await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { act: s.queen.act, hp: s.boy.hp } })
  assert.notEqual(end.act, 'feathers'); assert.deepEqual(errors, [])
  const report = { setup: 'Stage, position and phase injected; original Owl hook runs normally; not a playthrough.', warn, shots, end, errors }
  fs.writeFileSync(`${out}/owl-regression.json`, JSON.stringify(report, null, 2) + '\n'); console.log('PASS stage3 MirrorOwl', JSON.stringify(report))
} catch (e) { console.error('FAIL owl regression', e.stack); try { await page.screenshot({ path: `${out}/owl-regression-failure.png` }) } catch {} process.exitCode = 1 } finally { await context.close(); await browser.close() }
