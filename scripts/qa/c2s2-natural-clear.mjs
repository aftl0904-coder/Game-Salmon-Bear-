// Natural stage-7 clear: keyboard only. No teleport, HP edit, or forced win.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out = 'docs/qa-c2s2'
fs.mkdirSync(out, { recursive: true })
const pits = [{ x: 2320, w: 56 }, { x: 2780, w: 64 }]
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const gear = { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }
await ctx.addInitScript(({ gear }) => {
  if (!sessionStorage.getItem('c2s2-natural-seeded')) {
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
    localStorage.setItem('sake-kuma-run-v1', JSON.stringify({ version: 1, runId: 'qa-natural', startStage: 6, lastCleared: 6, nextStage: 7, gear: { boy: gear, girl: gear }, growth: {}, eligible: true, coins: 100, purse: { boy: 50, girl: 50 }, hp: { boy: 5, girl: 5 }, friends: [], charm: null, mode: '1p', solo: 'boy', puffLeft: false }))
    sessionStorage.setItem('c2s2-natural-seeded', '1')
  }
}, { gear })
const page = await ctx.newPage()
const log = { description: '1P natural keyboard attempt of stage 7 from seeded stage-6 clear; no teleport/HP/forced win. Automated, not human.', start: new Date().toISOString(), samples: [], errors: [], passed: false }
page.on('pageerror', e => log.errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') log.errors.push('console: ' + m.text()) })
const state = () => page.evaluate(() => {
  const g = window.__SAKE_GAME__, s = g.scene.getScene('play')
  return { active: g.scene.getScenes(true).map(a => a.scene.key), stage: s?.stageNo, mode: s?.mode, started: s?.started, ended: s?.ended, intro: !!s?.storyIntro, continued: s?.awaitingContinue, x: s?.boy && Math.round(s.boy.x), y: s?.boy && Math.round(s.boy.y), hp: s?.boy?.hp, phase: s?.queen?.qphase, win: g.registry.get('winScreenShown') === true, events: s?.stage7Events, run: JSON.parse(localStorage.getItem('sake-kuma-run-v1') || 'null') }
})
let held = false
try {
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:47417/?c2=1')
  await page.waitForTimeout(4000)
  for (let i = 0; i < 25; i++) {
    const s = await state()
    if (s.active.includes('play') && s.stage === 7 && s.started && !s.intro) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)
  }
  let s = await state()
  assert.equal(s.stage, 7)
  assert.equal(s.mode, '1p')
  const t0 = Date.now()
  const timeoutMs = Number(process.env.QA_TIMEOUT_MS || 720000)
  let last = 0
  while (Date.now() - t0 < timeoutMs) {
    s = await state()
    if (s.win) break
    if (s.stage !== 7) throw new Error('left stage 7 before clear: ' + s.stage)
    if (s.active.includes('play') && s.started && !s.ended && !s.intro) {
      const nearPit = pits.some(p => s.x >= p.x - 48 && s.x <= p.x + p.w + 8)
      if (!held) { await page.keyboard.down('d'); held = true }
      await page.keyboard.press('f')
      if (nearPit) await page.keyboard.press('g')
      if (s.phase) { await page.keyboard.press('g'); await page.keyboard.press('t') }
    } else {
      if (held) { await page.keyboard.up('d'); held = false }
      await page.keyboard.press(s.continued ? 'Space' : 'Enter')
    }
    if (Date.now() - last > 10000) {
      last = Date.now()
      log.samples.push({ elapsed: Math.round((last - t0) / 1000), ...s, events: s.events?.map(e => e.kind) })
      fs.writeFileSync(`${out}/natural-clear.json`, JSON.stringify(log, null, 2) + '\n')
      console.log('natural', Math.round((last - t0) / 1000), JSON.stringify({ x: s.x, hp: s.hp, phase: s.phase, ended: s.ended, continued: s.continued, win: s.win }))
    }
    if (log.errors.length) throw new Error('browser error')
    await page.waitForTimeout(280)
  }
  s = await state()
  log.final = s
  assert.equal(s.win, true, 'timed out before clear card')
  assert.equal(s.run.lastCleared, 7)
  assert.equal(s.run.puffLeft, true)
  assert.deepEqual(log.errors, [])
  log.passed = true
} catch (e) {
  log.failure = e.stack ?? String(e)
  console.error(log.failure)
}
if (held) await page.keyboard.up('d')
log.durationSec = log.start ? Math.round((Date.now() - Date.parse(log.start)) / 1000) : 0
log.end = new Date().toISOString()
log.final = await state().catch(() => log.final)
await page.screenshot({ path: `${out}/natural-clear-final.png` }).catch(() => {})
fs.writeFileSync(`${out}/natural-clear.json`, JSON.stringify(log, null, 2) + '\n')
console.log(JSON.stringify({ passed: log.passed, durationSec: log.durationSec, x: log.final?.x, win: log.final?.win, failure: log.failure }))
await browser.close()
if (!log.passed) process.exitCode = 1
