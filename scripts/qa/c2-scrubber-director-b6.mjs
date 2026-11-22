/**
 * PR-B B6: 打保安總監 → Boss 血唔變、玩家血唔變
 * Director sighting is decorative (no combat body). Evidence → docs/qa-c2-scrubber-damage/
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47471'
const outDir = 'docs/qa-c2-scrubber-damage'
fs.mkdirSync(outDir, { recursive: true })
const report = { ok: false, errors: [], checks: {} }

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function bootStage6() {
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', 6)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  })
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    if (await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && !s?.storyIntro)
    })) return
    await page.waitForTimeout(120)
  }
  throw new Error('stage 6 did not start')
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  await bootStage6()

  // Reveal scrubber first so we have a boss HP to assert against
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    Object.getPrototypeOf(s).queenReveal.call(s, {
      kind: 'mall-scrubber',
      triggerX: 4680,
      arenaX0: 4640,
      arenaX1: 5280,
    })
  })
  await page.waitForFunction(
    () => window.__SAKE_GAME__?.scene?.getScene('play')?.queen?.species === 'mall-scrubber',
    null,
    { timeout: 15000 },
  )

  const before = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const hero = s.boy ?? s.girl
    const dirX = 4280
    // Sighting is gated by !bossFight + leadX≥4120; clear briefly for decorative director
    const wasBossFight = s.bossFight
    s.bossFight = false
    s.directorSighted = false
    s.ended = false
    if (s.boy) s.boy.x = 4200
    if (s.girl?.active) s.girl.x = 4200
    s.tickDirectorSighting()
    s.bossFight = wasBossFight
    const heroHp = hero?.hp ?? null
    const bossHp = q?.hp ?? null
    // “打保安總監”: park on sighting x and fire shots toward it
    if (s.boy) s.boy.x = dirX
    if (s.girl?.active) s.girl.x = dirX
    for (let i = 0; i < 10; i++) {
      const shot = s.playerShots?.create?.(dirX - 30 + i * 4, (s.floorY?.() ?? 400) - 40, 'coin')
      if (shot) {
        shot.setData?.('dmg', 1)
        shot.setData?.('owner', 'player')
        shot.setVelocity?.(200, 0)
      }
    }
    // No SecurityDirector combat body should exist on mall scrubber fight
    let directorCombat = 0
    for (const o of s.enemies?.getChildren?.() ?? []) {
      const sp = o.species || o.getData?.('species')
      if (sp === 'securitydirector' || String(o.constructor?.name || '').includes('SecurityDirector')) {
        directorCombat++
        o.receiveHit?.(99, -1)
      }
    }
    // Also try receiveHit on queen while standing at director x (sanity: boss may take hits —
    // B6 only cares that *director* does not change boss/player HP; so we do NOT hit queen here)
    return {
      bossSpecies: q?.species ?? null,
      bossHp,
      heroHp,
      directorSighted: s.directorSighted,
      directorCombat,
      mall: !!s.mall,
    }
  })
  report.checks.before = before
  assert.equal(before.bossSpecies, 'mall-scrubber')
  assert.equal(before.directorSighted, true)
  assert.equal(before.directorCombat, 0)
  assert.equal(before.mall, true)

  await page.waitForTimeout(600)

  const after = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const hero = s.heroes?.getChildren?.()?.[0] ?? s.boy ?? s.girl
    for (const h of s.heroes?.getChildren?.() ?? []) {
      if (h) h.x = 4280
    }
    return {
      bossSpecies: q?.species ?? null,
      bossHp: q?.hp ?? null,
      heroHp: hero?.hp ?? null,
      queenIsDirector: q?.species === 'securitydirector',
    }
  })
  report.checks.after = after
  assert.equal(after.bossHp, before.bossHp, 'boss HP must not change when attacking director sighting')
  assert.equal(after.heroHp, before.heroHp, 'player HP must not change from director sighting')
  assert.equal(after.queenIsDirector, false)
  assert.equal(after.bossSpecies, 'mall-scrubber')

  await page.screenshot({ path: `${outDir}/06-director-b6.png` })

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  fs.writeFileSync(`${outDir}/b6-report.json`, JSON.stringify(report, null, 2))
  console.log('PASS B6', JSON.stringify(report.checks, null, 2))
  process.exit(0)
} catch (e) {
  report.ok = false
  report.error = e.stack || String(e)
  fs.writeFileSync(`${outDir}/b6-report.json`, JSON.stringify(report, null, 2))
  await page.screenshot({ path: `${outDir}/06-director-b6-failure.png` }).catch(() => {})
  console.error('FAIL B6', report.error)
  process.exit(1)
} finally {
  await browser.close()
}
