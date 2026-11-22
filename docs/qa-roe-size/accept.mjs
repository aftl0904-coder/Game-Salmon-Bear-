/**
 * PR-D T6 acceptance: roe visual ~65% of before; hitbox world size unchanged;
 * light/heavy power multipliers 0.8 / 1.4 still apply.
 */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const BASE = process.env.QA_URL ?? 'http://127.0.0.1:47510/'
const OUT = 'docs/qa-roe-size'
fs.mkdirSync(OUT, { recursive: true })

const REF = JSON.parse(fs.readFileSync(`${OUT}/before-body.json`, 'utf8'))
assert.ok(REF.powers?.p1?.worldW, 'missing before-body.json powers')

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
})
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))

await page.goto(BASE + '?c2=0', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 60000 })
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
await page.waitForFunction(() => window.__SAKE_GAME__?.scene.getScene('play')?.scene.isActive(), null, { timeout: 60000 })
await page.waitForTimeout(800)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
await page.keyboard.press('Enter')
await page.waitForTimeout(500)

const after = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  if (s.storyIntro) s.storyIntro = null
  s.started = true
  const hero = s.boy
  const spawn = Object.getPrototypeOf(s).spawnRoe.bind(s)
  function info(spr) {
    const b = spr.body
    return {
      scaleX: spr.scaleX,
      displayW: spr.displayWidth,
      displayH: spr.displayHeight,
      worldW: b.right - b.left,
      worldH: b.bottom - b.top,
      bodyW: b.width,
      sourceW: b.sourceWidth,
    }
  }
  const out = { powers: {} }
  for (const [name, power] of [['p1', 1], ['light', 0.5], ['heavy', 2.2]]) {
    const shot = spawn(hero, hero.x + 40, hero.y - 40, 0, 220, power)
    s.physics.world.update(0, 16)
    out.powers[name] = info(shot)
    if (name !== 'p1') shot.destroy()
    else shot.setVelocity(0, 0)
  }
  // Same-distance hitbox probe (frozen shot)
  const probe = spawn(hero, hero.x + 80, hero.y - 40, 0, 400, 1)
  probe.setVelocity(0, 0)
  s.physics.world.update(0, 16)
  out.hitProbe = {
    left: probe.body.left,
    right: probe.body.right,
    top: probe.body.top,
    bottom: probe.body.bottom,
    worldW: probe.body.right - probe.body.left,
    worldH: probe.body.bottom - probe.body.top,
  }
  return out
})

fs.writeFileSync(`${OUT}/after-body.json`, JSON.stringify(after, null, 2))
await page.locator('#game-root canvas').screenshot({ path: `${OUT}/after-shot.png` })

const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps
const results = { R1: null, R2: null, R3: null, errors }

const ratio = after.powers.p1.displayW / REF.powers.p1.displayW
results.R1 = {
  pass: ratio > 0.60 && ratio < 0.70,
  ratio,
  beforeDisplay: REF.powers.p1.displayW,
  afterDisplay: after.powers.p1.displayW,
  expectedScale: '1.7→1.1 (~65%)',
}

results.R2 = {
  pass:
    near(after.powers.p1.worldW, REF.powers.p1.worldW) &&
    near(after.powers.p1.worldH, REF.powers.p1.worldH) &&
    near(after.powers.light.worldW, REF.powers.light.worldW) &&
    near(after.powers.heavy.worldW, REF.powers.heavy.worldW) &&
    near(after.hitProbe.worldW, REF.powers.p1.worldW),
  before: { p1: REF.powers.p1.worldW, light: REF.powers.light.worldW, heavy: REF.powers.heavy.worldW },
  after: { p1: after.powers.p1.worldW, light: after.powers.light.worldW, heavy: after.powers.heavy.worldW },
  hitProbe: after.hitProbe,
}

const s1 = after.powers.p1.scaleX
const sL = after.powers.light.scaleX
const sH = after.powers.heavy.scaleX
results.R3 = {
  pass: near(s1, 1.1) && near(sL, 1.1 * 0.8) && near(sH, 1.1 * 1.4),
  scales: { p1: s1, light: sL, heavy: sH },
  expected: { p1: 1.1, light: 0.88, heavy: 1.54 },
}

assert.equal(errors.length, 0, `page errors: ${errors.join('; ')}`)
assert.ok(results.R1.pass, `R1 fail ratio=${ratio}`)
assert.ok(results.R2.pass, `R2 fail hitbox ${JSON.stringify(results.R2)}`)
assert.ok(results.R3.pass, `R3 fail scales ${JSON.stringify(results.R3)}`)

fs.writeFileSync(`${OUT}/accept.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
console.log('T6 ACCEPT PASS')
await browser.close()
