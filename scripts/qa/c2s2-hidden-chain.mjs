// Hidden chain-net: try to observe real document.hidden while a chain is live. Never synthesizes hidden.
import { chromium } from 'playwright'
import fs from 'node:fs'
const out = 'docs/qa-c2s2'
fs.mkdirSync(out, { recursive: true })
const report = { description: 'Attempt real document.hidden during an injected trainer chain. Does not override hidden or dispatch fake visibilitychange.', at: new Date().toISOString(), cases: [], passed: false }
const gear = { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }

async function setupPlay(page) {
  await page.addInitScript(({ gear }) => {
    if (!sessionStorage.getItem('c2s2-hidden-seeded')) {
      localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
      localStorage.setItem('sake-kuma-run-v1', JSON.stringify({ version: 1, runId: 'qa-hidden', startStage: 6, lastCleared: 6, nextStage: 7, gear: { boy: gear, girl: gear }, growth: {}, eligible: true, coins: 50, purse: { boy: 20, girl: 20 }, hp: { boy: 6, girl: 6 }, friends: [], charm: null, mode: '1p', solo: 'boy', puffLeft: false }))
      sessionStorage.setItem('c2s2-hidden-seeded', '1')
    }
  }, { gear })
  page.on('pageerror', e => report.cases.push({ error: 'pageerror ' + e.message }))
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:47417/?c2=1')
  await page.waitForTimeout(3500)
  for (let i = 0; i < 25; i++) {
    const ok = await page.evaluate(() => {
      const g = window.__SAKE_GAME__, s = g?.scene.getScene('play')
      return !!(s && s.stageNo === 7 && s.started && !s.storyIntro)
    })
    if (ok) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
  }
}

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await ctx.newPage()
try {
  await setupPlay(page)
  await page.evaluate(() => {
    window.__vis = []
    document.addEventListener('visibilitychange', () => window.__vis.push({ hidden: document.hidden, at: performance.now() }))
  })
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = true
    s.boy.setPosition(5000, 285); s.boy.body.reset(5000, 285); s.boy.hp = 6; s.boy.setVelocity(0, 0)
    s.cameras.main.centerOn(5000, 180)
    if (!s.queen) s.startQueenFight()
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    if (q) { q.hp = 35; q.updatePhase?.() }
    for (const o of s.enemies.getChildren()) o.setActive(false)
    window.__chainN = s.stage7Events.length
    s.trainerChain(4640, 5280)
  })
  const other = await ctx.newPage()
  await other.goto('about:blank')
  await other.bringToFront()
  await page.waitForTimeout(2000)
  await page.bringToFront()
  await page.waitForTimeout(1800)
  let vis = await page.evaluate(() => ({ hidden: document.hidden, events: window.__vis.slice(), chain: window.__SAKE_GAME__.scene.getScene('play').stage7Events.slice(window.__chainN), hp: window.__SAKE_GAME__.scene.getScene('play').boy.hp }))
  report.cases.push({ case: 'second-tab-bringToFront', ...vis, observedHidden: vis.events.some(e => e.hidden) })

  try {
    const cdp = await ctx.newCDPSession(page)
    await page.evaluate(() => { window.__vis.length = 0; window.__chainN = window.__SAKE_GAME__.scene.getScene('play').stage7Events.length; window.__SAKE_GAME__.scene.getScene('play').trainerChain(4640, 5280) })
    let cdpOk = false
    try {
      await cdp.send('Page.setWebLifecycleState', { state: 'hidden' })
      cdpOk = true
    } catch (e) {
      report.cases.push({ case: 'cdp-setWebLifecycleState-hidden', error: String(e) })
    }
    await page.waitForTimeout(2000)
    if (cdpOk) {
      try { await cdp.send('Page.setWebLifecycleState', { state: 'active' }) } catch { /* ignore */ }
    }
    vis = await page.evaluate(() => ({ hidden: document.hidden, events: window.__vis.slice(), chain: window.__SAKE_GAME__.scene.getScene('play').stage7Events.slice(window.__chainN), hp: window.__SAKE_GAME__.scene.getScene('play').boy.hp }))
    report.cases.push({ case: 'cdp-lifecycle', cdpOk, ...vis, observedHidden: vis.events.some(e => e.hidden) })
    await cdp.detach()
  } catch (e) {
    report.cases.push({ case: 'cdp', error: e.stack ?? String(e) })
  }
} catch (e) {
  report.failure = e.stack ?? String(e)
}
report.passed = report.cases.some(c => c.observedHidden)
fs.writeFileSync(`${out}/hidden-chain.json`, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.map(c => ({ case: c.case, observedHidden: c.observedHidden, error: c.error })) }))
await browser.close()
if (!report.passed) process.exitCode = 1
