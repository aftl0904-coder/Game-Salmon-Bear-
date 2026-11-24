#!/usr/bin/env node
/**
 * Encounter-1 smoke: stage 6 lock → wave1 from R → clear → bang → wave2 → 呼…
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '4532'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve('docs/qa-encounter-1')
fs.mkdirSync(OUT, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(m)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('pageerror', (e) => say(`PAGEERROR ${e.message}`))

try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 30000 })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 6)
    g.registry.set('difficulty', 'easy')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    g.registry.set('cheat', true)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  })
  await page.waitForTimeout(1000)
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    if (!sc) return
    sc.started = true
    sc.startedAt = sc.time.now
    sc.storyIntro?.destroy?.()
    sc.storyIntro = null
  })

  const claimed = await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    return {
      encCount: sc.encounters?.length ?? -1,
      claimed: [...(sc.encounterClaimedXs ?? [])],
      pendingHasClaimed: (sc.s2Pending ?? []).some((p) => [2440, 2620, 2780, 2940].includes(p.x)),
    }
  })
  say(`setup ${JSON.stringify(claimed)}`)

  // Jump into encounter zone
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    sc.boy.x = 2450
    sc.boy.snapToLane?.(0, 2450)
    sc.cameras.main.centerOn(2450, sc.boy.y)
  })
  // Drive updates for a few seconds
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      const sc = window.__SAKE_GAME__.scene.getScene('play')
      for (const enc of sc.encounters ?? []) enc.update(100)
    })
    await page.waitForTimeout(50)
  }
  const locked = await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    const enc = sc.encounters?.[0]
    const cam = sc.cameras.main
    const tagged = sc.enemies.getChildren().filter((e) => e.active && e.getData('encounter'))
    return {
      phase: enc?.phase,
      waveIdx: enc?.waveIdx,
      bounds: { x: cam.worldView?.x ?? cam.scrollX, w: cam.worldView?.width },
      tagged: tagged.map((e) => ({ species: e.species, x: Math.round(e.x) })),
    }
  })
  say(`locked ${JSON.stringify(locked)}`)
  await page.screenshot({ path: path.join(OUT, '01-wave1.png') })

  // Kill wave 1 tagged
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    for (const o of [...sc.enemies.getChildren()]) {
      const e = o
      if (e.getData('encounter')) {
        e.hp = 0
        e.fsm = 'DEAD'
        e.setData('encounter', false)
        e.disableBody?.(true, true)
        e.destroy?.()
      }
    }
  })
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => {
      const sc = window.__SAKE_GAME__.scene.getScene('play')
      for (const enc of sc.encounters ?? []) enc.update(100)
    })
    await page.waitForTimeout(40)
  }
  const wave2 = await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    const enc = sc.encounters?.[0]
    const tagged = sc.enemies.getChildren().filter((e) => e.active && e.getData('encounter'))
    return { phase: enc?.phase, waveIdx: enc?.waveIdx, tagged: tagged.length, bang: !!enc?.bang }
  })
  say(`after-w1 ${JSON.stringify(wave2)}`)
  await page.screenshot({ path: path.join(OUT, '02-wave2-or-warn.png') })

  // Kill remaining + finish
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    for (const o of [...sc.enemies.getChildren()]) {
      if (o.getData('encounter')) {
        o.setData('encounter', false)
        o.disableBody?.(true, true)
        o.destroy?.()
      }
    }
  })
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      const sc = window.__SAKE_GAME__.scene.getScene('play')
      for (const enc of sc.encounters ?? []) enc.update(100)
    })
    await page.waitForTimeout(40)
  }
  const done = await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    const enc = sc.encounters?.[0]
    return {
      phase: enc?.phase,
      finished: enc?.finished,
      camFull: sc.cameras.main.getBounds?.()?.width ?? sc.cameras.main._bounds?.width,
    }
  })
  say(`done ${JSON.stringify(done)}`)
  await page.screenshot({ path: path.join(OUT, '03-cleared.png') })

  const ok =
    claimed.encCount === 1 &&
    !claimed.pendingHasClaimed &&
    locked.tagged.length >= 1 &&
    (done.phase === 'cleared' || done.phase === 'done' || done.finished)
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ ok, claimed, locked, wave2, done }, null, 2))
  fs.writeFileSync(path.join(OUT, 'run-log.txt'), log.join('\n'))
  say(`ok=${ok}`)
  process.exit(ok ? 0 : 1)
} catch (e) {
  say(`FAIL ${e?.stack || e}`)
  fs.writeFileSync(path.join(OUT, 'run-log.txt'), log.join('\n'))
  process.exit(1)
} finally {
  await browser.close()
}
