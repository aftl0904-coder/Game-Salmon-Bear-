// Walk (no teleport) past stage-7 static decor; assert no drag and no 2P clone.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out = 'docs/qa-c2s2'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const gear = { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }
await ctx.addInitScript(({ gear }) => {
  if (!sessionStorage.getItem('c2s2-static-seeded')) {
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
    localStorage.setItem('sake-kuma-run-v1', JSON.stringify({ version: 1, runId: 'qa-static', startStage: 6, lastCleared: 6, nextStage: 7, gear: { boy: gear, girl: gear }, growth: {}, eligible: true, coins: 50, purse: { boy: 20, girl: 20 }, hp: { boy: 5, girl: 5 }, friends: [], charm: null, mode: '2p', solo: 'boy', puffLeft: false }))
    sessionStorage.setItem('c2s2-static-seeded', '1')
  }
}, { gear })
const page = await ctx.newPage()
const report = { description: '2P walk from spawn with keyboard; compare stage7-static display objects. No teleport.', checks: [], errors: [], passed: false }
page.on('pageerror', e => report.errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') report.errors.push('console: ' + m.text()) })
const state = () => page.evaluate(() => {
  const g = window.__SAKE_GAME__, s = g.scene.getScene('play')
  return { active: g.scene.getScenes(true).map(a => a.scene.key), stage: s?.stageNo, started: s?.started, intro: !!s?.storyIntro, x: s?.boy && Math.round(s.boy.x) }
})
const statics = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').children.list.filter(o => o.getData?.('stage7-static')).map(o => ({ name: o.name, type: o.type, x: o.x, y: o.y, body: !!o.body })))
try {
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:47417/?c2=1')
  await page.waitForTimeout(3500)
  for (let i = 0; i < 25; i++) {
    const s = await state()
    if (s.active.includes('play') && s.stage === 7 && s.started && !s.intro) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
  }
  assert.equal((await state()).stage, 7)
  const before = await statics()
  assert.ok(before.length > 10)
  assert.ok(before.every(x => !x.body), 'static must have no physics body')
  await page.keyboard.down('d')
  await page.keyboard.down('ArrowRight')
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('f')
    await page.keyboard.press(',')
    await page.waitForTimeout(250)
  }
  await page.keyboard.up('d')
  await page.keyboard.up('ArrowRight')
  const after = await statics()
  assert.equal(after.length, before.length)
  assert.deepEqual(after, before)
  const s = await state()
  assert.ok(s.x > 280, 'must have walked forward')
  report.checks.push({ name: '2P walk: static count/xy/type unchanged, no bodies, not cloned', count: before.length, walkedTo: s.x })
  await page.screenshot({ path: `${out}/static-walk.png` })
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (e) {
  report.failure = e.stack ?? String(e)
  await page.screenshot({ path: `${out}/static-walk-failure.png` }).catch(() => {})
  console.error(report.failure)
}
fs.writeFileSync(`${out}/static-walk.json`, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, failure: report.failure }))
await browser.close()
if (!report.passed) process.exitCode = 1
