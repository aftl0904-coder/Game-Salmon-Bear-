/**
 * PR-F mid: WarriorKing BossRhythm K1–K4.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47501'
const outDir = 'docs/qa-boss-rhythm'
fs.mkdirSync(outDir, { recursive: true })
const report = { ok: false, checks: {}, errors: [] }

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function bootStage1() {
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
  throw new Error('stage1 not started')
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  await bootStage1()

  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    Object.getPrototypeOf(s).queenReveal.call(s, {
      kind: 'warriorking',
      triggerX: 2000,
      arenaX0: 1880,
      arenaX1: 2480,
    })
  })
  await page.waitForFunction(
    () => window.__SAKE_GAME__?.scene?.getScene('play')?.queen?.species === 'warriorking',
    null,
    { timeout: 15000 },
  )

  const meta = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    return {
      hp: q.hp,
      maxHp: q.maxHp,
      phase: q.rhythm?.phase,
    }
  })
  report.checks.meta = meta
  assert.equal(meta.hp, 180)
  assert.equal(meta.maxHp, 180)

  // Force GUARD and hit → 0 dmg
  const k1 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    q.rhythm.phase = 'GUARD'
    q.rhythm.t = 0
    const before = q.hp
    const r = q.receiveHit(5, -1)
    return { before, after: q.hp, killed: r.killed, phase: q.rhythm.phase }
  })
  report.checks.k1_guard = k1
  assert.equal(k1.after, k1.before, 'K1 GUARD 0 dmg')

  const k1b = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.rhythm.phase = 'BREATHER'
    q.rhythm.t = 0
    const before = q.hp
    q.receiveHit(5, -1)
    return { before, after: q.hp }
  })
  report.checks.k1_breather = k1b
  assert.equal(k1b.after, k1b.before, 'K1 BREATHER 0 dmg')

  // K2 OPENING → damage
  const k2 = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.rhythm.phase = 'OPENING'
    q.rhythm.t = 0
    q.lastHitAt = 0
    const before = q.hp
    q.receiveHit(2, -1)
    return { before, after: q.hp, phase: q.rhythm.phase }
  })
  report.checks.k2_opening = k2
  assert.ok(k2.after < k2.before, 'K2 OPENING damages')

  // K3 non-ATTACK contact: canHurtPlayer false
  const k3 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    h.hp = 5
    q.rhythm.phase = 'GUARD'
    const can = q.canHurtPlayer()
    const before = h.hp
    Object.getPrototypeOf(s).hurtHero.call(s, h, q)
    return { can, before, after: h.hp }
  })
  report.checks.k3_contact = k3
  assert.equal(k3.can, false)
  assert.equal(k3.after, k3.before, 'K3 no HP loss outside ATTACK')

  // K4: simulate OPENING hits until segment drained — count openings needed for ~33% HP
  const k4 = await page.evaluate(() => {
    const q = window.__SAKE_GAME__.scene.getScene('play').queen
    q.hp = q.maxHp
    q.qphase = 1
    q.lastHitAt = 0
    const segment = Math.ceil(q.maxHp / 3)
    let openings = 0
    let dealt = 0
    // Realistic: ~6 hits per 2500ms OPENING at 380ms CD, base player dmg 3
    while (dealt < segment && openings < 20) {
      openings++
      q.rhythm.phase = 'OPENING'
      q.rhythm.t = 0
      for (let i = 0; i < 6 && dealt < segment; i++) {
        q.lastHitAt = 0
        const before = q.hp
        q.receiveHit(3, -1)
        dealt += before - q.hp
      }
    }
    return { openings, dealt, segment, maxHp: q.maxHp, hp: q.hp }
  })
  report.checks.k4_openings = k4
  assert.ok(k4.openings >= 3 && k4.openings <= 4, `K4 openings 3–4 got ${k4.openings}`)

  await page.screenshot({ path: `${outDir}/01-warrior-rhythm.png`, timeout: 8000, animations: 'disabled' }).catch(() => {})

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'") && !e.includes('glTexture'),
  )
  assert.deepEqual(report.errors, [])
  report.ok = true
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS K1-K4', JSON.stringify(report.checks, null, 2))
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
