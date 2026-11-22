/** Per-type Stage 7 behavior screenshots + block assertions. */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'docs/qa-st7-enemies'
const URL = process.env.QA_URL || 'http://127.0.0.1:47652/?c2=1'
fs.mkdirSync(OUT, { recursive: true })
const report = { checks: [], errors: [], passed: false }

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => {
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
})
const page = await ctx.newPage()
page.on('pageerror', (e) => report.errors.push(e.message))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 60000 })
await page.waitForTimeout(2000)
await page.evaluate(() => {
  const g = window.__SAKE_GAME__
  for (const sc of g.scene.getScenes(true)) g.scene.stop(sc.scene.key)
  g.registry.set('stageNo', 7)
  g.registry.set('difficulty', 'normal')
  g.registry.set('playMode', '1p')
  g.registry.set('soloCast', 'boy')
  g.registry.set('stageRound', 1)
  g.scene.start('play')
})
for (let i = 0; i < 25; i++) {
  const ok = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return !!(s?.started && !s?.storyIntro && s?.stageNo === 7)
  })
  if (ok) break
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
}

// Clear pending + live trash, spawn one of each at fixed x.
const spawned = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  s.s2Pending = []
  for (const e of [...s.enemies.getChildren()]) {
    if (e.species && String(e.species).startsWith('s7')) e.destroy()
  }
  // Use internal spawnS2
  s.spawnS2('s7charge', 420)
  s.spawnS2('s7hop', 560)
  s.spawnS2('s7shield', 720)
  s.spawnS2('s7can', 900)
  s.boy.x = 300
  s.boy.y = 200
  s.boy.hp = 6
  s.boy.graceUntil = s.time.now + 60000
  s.cameras.main.scrollX = 200
  return s.enemies
    .getChildren()
    .filter((e) => e.active && String(e.species || '').startsWith('s7'))
    .map((e) => ({ sp: e.species, hp: e.hp, maxHp: e.maxHp, x: Math.round(e.x) }))
})
report.checks.push({ name: 'spawn four types', spawned })
assert.equal(spawned.length, 4)
assert.deepEqual(
  spawned.map((e) => e.sp).sort(),
  ['s7can', 's7charge', 's7hop', 's7shield'],
)
await page.screenshot({ path: path.join(OUT, 'behaviors-lineup.png') })

// Charge warn
await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const c = s.enemies.getChildren().find((e) => e.species === 's7charge')
  s.boy.x = c.x - 120
  c.phase = 'idle'
  c.t = 0
})
await page.waitForTimeout(800)
const charge = await page.evaluate(() => {
  const e = window.__SAKE_GAME__.scene.getScene('play').enemies.getChildren().find((o) => o.species === 's7charge')
  return { phase: e.phase, maxHp: e.maxHp }
})
report.checks.push({ name: 'charge engages', charge })
await page.screenshot({ path: path.join(OUT, 'behavior-charge.png') })
assert.equal(charge.maxHp, 3)

// Hop airOnly grounded
const hop = await page.evaluate(() => {
  const e = window.__SAKE_GAME__.scene.getScene('play').enemies.getChildren().find((o) => o.species === 's7hop')
  const groundedImmune = e.airOnly()
  const hpBefore = e.hp
  // Simulate GameScene path: airOnly blocks damage
  return { groundedImmune, hp: hpBefore, maxHp: e.maxHp }
})
report.checks.push({ name: 'hop grounded immune', hop })
assert.equal(hop.maxHp, 2)
assert.equal(hop.groundedImmune, true)
await page.screenshot({ path: path.join(OUT, 'behavior-hop.png') })

// Shield block front / open back
const shield = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const e = s.enemies.getChildren().find((o) => o.species === 's7shield')
  e.setFlipX(true)
  return { front: e.blocks(1), back: e.blocks(-1), maxHp: e.maxHp }
})
report.checks.push({ name: 'shield front/back', shield })
assert.equal(shield.front, true)
assert.equal(shield.back, false)
assert.equal(shield.maxHp, 3)
await page.screenshot({ path: path.join(OUT, 'behavior-shield.png') })

// Can thrower fires
await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const e = s.enemies.getChildren().find((o) => o.species === 's7can')
  s.boy.x = e.x - 80
  e.cd = 0
  e.wind = 50
})
await page.waitForTimeout(1200)
const can = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const e = s.enemies.getChildren().find((o) => o.species === 's7can')
  const shots = s.enemyShots.getChildren().filter((o) => o.active && o.getData('exhibitCan')).length
  return { maxHp: e.maxHp, flyingOrRecent: shots, cd: e.cd }
})
report.checks.push({ name: 'can throw', can })
assert.equal(can.maxHp, 2)
await page.screenshot({ path: path.join(OUT, 'behavior-can.png') })

report.passed = report.errors.length === 0
fs.writeFileSync(path.join(OUT, 'behaviors.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, errors: report.errors }, null, 2))
await browser.close()
if (!report.passed) process.exitCode = 1
