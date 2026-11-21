// Hidden / background chain-net fairness.
// 1) Try real document.hidden (environment often cannot produce it — that is NOT a pass).
 // 2) Exercise the same path Phaser VisibilityHandler uses: game.loop.pause() on HIDDEN.
 //    Assert chain timers and HP freeze while paused, then resume to finish warn→active≈800ms.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out = 'docs/qa-c2s2'
fs.mkdirSync(out, { recursive: true })
const report = {
  description: 'Chain fairness under background: real document.hidden probe + Phaser loop.pause proxy (same as Game.onHidden). Does not synthesize visibilitychange or override document.hidden.',
  at: new Date().toISOString(),
  cases: [],
  passed: false,
}
const gear = { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }

const browser = await chromium.launch({
  headless: false,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(({ gear }) => {
  if (!sessionStorage.getItem('c2s2-hidden-seeded')) {
    localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
    localStorage.setItem(
      'sake-kuma-run-v1',
      JSON.stringify({
        version: 1,
        runId: 'qa-hidden',
        startStage: 6,
        lastCleared: 6,
        nextStage: 7,
        gear: { boy: gear, girl: gear },
        growth: {},
        eligible: true,
        coins: 50,
        purse: { boy: 20, girl: 20 },
        hp: { boy: 6, girl: 6 },
        friends: [],
        charm: null,
        mode: '1p',
        solo: 'boy',
        puffLeft: false,
      }),
    )
    sessionStorage.setItem('c2s2-hidden-seeded', '1')
  }
}, { gear })
const page = await ctx.newPage()
page.on('pageerror', (e) => report.cases.push({ error: 'pageerror ' + e.message }))

try {
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:47417/?c2=1')
  await page.waitForTimeout(3500)
  for (let i = 0; i < 25; i++) {
    const ok = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene.getScene('play')
      return !!(s && s.stageNo === 7 && s.started && !s.storyIntro)
    })
    if (ok) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
  }
  assert.equal(await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').stageNo), 7)

  await page.evaluate(() => {
    window.__vis = []
    document.addEventListener('visibilitychange', () =>
      window.__vis.push({ hidden: document.hidden, at: performance.now() }),
    )
  })

  // --- Case A: environment probe for real document.hidden (expected fail in this CI) ---
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = true
    s.boy.setPosition(5000, 285)
    s.boy.body.reset(5000, 285)
    s.boy.hp = 6
    s.boy.setVelocity(0, 0)
    s.cameras.main.centerOn(5000, 180)
    if (!s.queen) s.startQueenFight()
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    if (q) {
      q.hp = 35
      q.updatePhase?.()
    }
    for (const o of s.enemies.getChildren()) o.setActive(false)
    window.__chainN = s.stage7Events.length
    s.trainerChain(4640, 5280)
  })
  const other = await ctx.newPage()
  await other.goto('about:blank')
  await other.bringToFront()
  await page.waitForTimeout(2000)
  await page.bringToFront()
  await page.waitForTimeout(500)
  const probe = await page.evaluate(() => ({
    hidden: document.hidden,
    events: window.__vis.slice(),
    chainKinds: window.__SAKE_GAME__.scene
      .getScene('play')
      .stage7Events.slice(window.__chainN)
      .map((e) => e.kind),
  }))
  report.cases.push({
    case: 'real-document-hidden-probe',
    ...probe,
    observedHidden: probe.events.some((e) => e.hidden),
    note: 'Environment often cannot produce document.hidden; failure here is not a product fail.',
  })
  await other.close()

  // Drain any live chain from the probe.
  await page.waitForTimeout(2800)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    for (const o of [...s.enemyShots.getChildren()]) o.destroy()
    s.boy.hp = 6
  })

  // --- Case B: Phaser VisibilityHandler path (loop.pause) during warn ---
  const pauseCase = await page.evaluate(async () => {
    const g = window.__SAKE_GAME__
    const s = g.scene.getScene('play')
    for (const o of s.enemies.getChildren()) o.setActive(false)
    s.boy.setPosition(5000, 285)
    s.boy.body.reset(5000, 285)
    s.boy.hp = 6
    s.boy.grace = 0
    s.boy.hurtCd = 0
    s.boy.setVelocity(0, 0)
    s.cameras.main.centerOn(5000, 180)
    const n0 = s.stage7Events.length
    const wall0 = performance.now()
    s.trainerChain(4640, 5280)
    // Wait until warn event exists, then pause the loop exactly as Game.onHidden does.
    await new Promise((r) => setTimeout(r, 50))
    g.loop.pause()
    const pausedAt = performance.now()
    const sceneAtPause = s.time.now
    const hpAtPause = s.boy.hp
    const kindsAtPause = s.stage7Events.slice(n0).map((e) => e.kind)
    // Wall-clock sleep while game loop is paused — timers must not advance.
    await new Promise((r) => setTimeout(r, 2000))
    const sceneDuring = s.time.now
    const hpDuring = s.boy.hp
    const kindsDuring = s.stage7Events.slice(n0).map((e) => e.kind)
    g.loop.resume()
    const resumedAt = performance.now()
    // Finish the remaining warn + active window.
    await new Promise((r) => setTimeout(r, 2800))
    const events = s.stage7Events.slice(n0)
    const warn = events.find((e) => e.kind === 'chain-warn')
    const active = events.find((e) => e.kind === 'chain-active')
    const end = events.find((e) => e.kind === 'chain-end')
    return {
      wallPauseMs: pausedAt - wall0,
      wallHiddenMs: resumedAt - pausedAt,
      sceneDeltaDuringPause: sceneDuring - sceneAtPause,
      hpAtPause,
      hpDuring,
      hpFinal: s.boy.hp,
      kindsAtPause,
      kindsDuring,
      warnToActive: warn && active ? active.at - warn.at : null,
      activeToEnd: active && end ? end.at - active.at : null,
      kindsFinal: events.map((e) => e.kind),
      loopPausedDuring: kindsDuring.length === kindsAtPause.length && sceneDuring === sceneAtPause && hpDuring === hpAtPause,
    }
  })
  const pauseOk =
    pauseCase.loopPausedDuring === true &&
    pauseCase.sceneDeltaDuringPause === 0 &&
    pauseCase.hpDuring === pauseCase.hpAtPause &&
    pauseCase.warnToActive != null &&
    pauseCase.warnToActive >= 790 &&
    pauseCase.warnToActive <= 950 &&
    pauseCase.activeToEnd != null &&
    pauseCase.activeToEnd >= 1490 &&
    pauseCase.activeToEnd <= 1650
  report.cases.push({
    case: 'phaser-loop-pause-proxy-for-onHidden',
    passed: pauseOk,
    ...pauseCase,
    note: 'game.loop.pause() is what Phaser.Game.onHidden calls when document.hidden becomes true.',
  })
  if (!pauseOk) report.failures = [...(report.failures || []), 'loop-pause proxy timing/HP freeze failed']

  // Real hidden is optional; product path must pass.
  report.passed = pauseOk
  report.realHiddenObserved = report.cases.some((c) => c.case === 'real-document-hidden-probe' && c.observedHidden)
  report.manualStillNeeded = !report.realHiddenObserved
} catch (e) {
  report.failure = e.stack ?? String(e)
}
fs.writeFileSync(`${out}/hidden-chain.json`, JSON.stringify(report, null, 2) + '\n')
console.log(
  JSON.stringify({
    passed: report.passed,
    realHiddenObserved: report.realHiddenObserved,
    manualStillNeeded: report.manualStillNeeded,
    cases: report.cases.map((c) => ({
      case: c.case,
      passed: c.passed,
      observedHidden: c.observedHidden,
      warnToActive: c.warnToActive,
      sceneDeltaDuringPause: c.sceneDeltaDuringPause,
      error: c.error,
    })),
    failure: report.failure,
  }),
)
await browser.close()
if (!report.passed) process.exitCode = 1
