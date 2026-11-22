/**
 * PR-B / T2: scrubber damage + kit smoke (work-order numbers).
 * Evidence → docs/qa-c2-scrubber-damage/
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

  const meta = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    return {
      name: Object.getPrototypeOf(s).bossName.call(s),
      canHurtIdle: q.canHurtPlayer(),
      idleTex: s.textures.exists('mall-scrubber-idle'),
      blower: !!q.blower?.active,
      blowerX: q.blower?.x,
      arenaX1: q.arenaX1,
    }
  })
  report.checks.meta = meta
  assert.equal(meta.name, '深層潔淨 X-9')
  assert.equal(meta.canHurtIdle, false)
  assert.equal(meta.idleTex, true)
  assert.equal(meta.blower, true)
  assert.ok(Math.abs(meta.blowerX - (meta.arenaX1 - 40)) < 1)
  await page.screenshot({ path: `${outDir}/01-spawn.png` })

  // B1 charge hurts
  const charge = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    h.hp = 5
    h.hurtLock = 0
    h.hurtCd = 0
    h.setData('stompSafeUntil', 0)
    h.x = (q.arenaX0 + q.arenaX1) / 2
    q.x = h.x + 10
    q.hitHeroes = new WeakSet()
    q.setFsm('ATTACK')
    q.act = 'charge'
    const before = h.hp
    const can = q.canHurtPlayer()
    Object.getPrototypeOf(s).hurtHero.call(s, h, q)
    return { before, after: h.hp, can, marked: !q.canHurtHero(h) }
  })
  report.checks.charge = charge
  assert.equal(charge.can, true)
  assert.ok(charge.after < charge.before)
  await page.screenshot({ path: `${outDir}/02-charge-hit.png` })

  // B2 recover safe
  const recover = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    h.hp = 5
    h.hurtLock = 0
    h.hurtCd = 0
    q.hitHeroes = new WeakSet()
    q.act = 'recover'
    q.setFsm('PATROL')
    const before = h.hp
    const can = q.canHurtPlayer()
    Object.getPrototypeOf(s).hurtHero.call(s, h, q)
    return { before, after: h.hp, can }
  })
  report.checks.recoverSafe = recover
  assert.equal(recover.can, false)
  assert.equal(recover.after, recover.before)
  await page.screenshot({ path: `${outDir}/03-recover-safe.png` })

  // B3 acid: warn zones empty, live zones hurt
  const acid = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    s.bossOn = true
    s.bossFight = true
    h.hp = 5
    h.alive = true
    h.hurtLock = 0
    h.hurtCd = 0
    for (const a of q.acids || []) {
      a.g?.destroy()
      a.label?.destroy()
    }
    q.acids = []
    const x = h.x
    const floor = q.hooks6.floorY()
    const now = s.time.now
    const g = s.add.graphics()
    const label = s.add.text(x, floor - 36, '強酸化學劑').setOrigin(0.5)
    q.acids.push({
      x,
      harmFrom: now + 5000,
      until: now + 10000,
      g,
      label,
      hitAt: new WeakMap(),
    })
    const zonesWarn = q.acidZones().length
    Object.getPrototypeOf(s).tickStage6.call(s, 16)
    const hpWarn = h.hp
    q.acids[0].harmFrom = now - 1
    const zonesLive = q.acidZones().length
    Object.getPrototypeOf(s).tickStage6.call(s, 16)
    return { zonesWarn, zonesLive, hpWarn, after: h.hp, before: 5 }
  })
  report.checks.acid = acid
  assert.equal(acid.zonesWarn, 0)
  assert.ok(acid.zonesLive >= 1)
  assert.equal(acid.hpWarn, 5)
  assert.ok(acid.after < acid.before)
  await page.screenshot({ path: `${outDir}/04-acid-hit.png` })

  // B4 blower cycle + disable
  const blower = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    q.hp = Math.floor(q.maxHp * 0.2)
    q.lastHitAt = -99999
    q.act = 'scan'
    q.receiveHit(1, -1)
    const p3 = q.qphase
    q.blowerCycle = 0
    q.blowerDisabledUntil = 0
    q.tickBlower(100)
    const warn = q.blowerPhase
    q.tickBlower(600)
    const blast = q.blowerPhase
    const into = q.intoWind(100)
    q.hitBlower(q.blower.x)
    q.hitBlower(q.blower.x)
    q.hitBlower(q.blower.x)
    const disabled = s.time.now < q.blowerDisabledUntil
    return { p3, warn, blast, into, disabled }
  })
  report.checks.blower = blower
  assert.equal(blower.p3, 3)
  assert.equal(blower.warn, 'warn')
  assert.equal(blower.blast, 'blast')
  assert.equal(blower.into, true)
  assert.equal(blower.disabled, true)
  await page.screenshot({ path: `${outDir}/05-p3-blower.png` })

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS', JSON.stringify(report.checks, null, 2))
  process.exit(0)
} catch (e) {
  report.ok = false
  report.error = e.stack || String(e)
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  await page.screenshot({ path: `${outDir}/failure.png` }).catch(() => {})
  console.error('FAIL', report.error)
  process.exit(1)
} finally {
  await browser.close()
}
