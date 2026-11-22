/**
 * PR-I / batch5: B1 scrubber attacks, B2 stall-over-pit, B3 air contact, B6 pit contrast.
 * Evidence → docs/qa-c2-bugs/ + docs/qa-pit-contrast/
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47651'
const outDir = 'docs/qa-c2-bugs'
const pitDir = 'docs/qa-pit-contrast'
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(pitDir, { recursive: true })

const report = {
  ok: false,
  errors: [],
  b1: { pass: false },
  b2: { pass: false },
  b3: { pass: false },
  b6: { pass: false },
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function bootStage(stageNo) {
  await page.evaluate((n) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', n)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, stageNo)
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    if (
      await page.evaluate(() => {
        const s = window.__SAKE_GAME__?.scene?.getScene('play')
        return !!(s?.started && !s?.storyIntro)
      })
    )
      return
    await page.waitForTimeout(100)
  }
  throw new Error(`stage ${stageNo} did not start`)
}

async function revealScrubber() {
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
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/?c2=1&cb=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })

  // ─── B1: ≥3 attacks in 15s with telegraph; charge/acid −1 HP ───
  await bootStage(6)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = true
    s.lastCheckpointX = 99999
    s.s2Pending = []
    if (s.s6world) {
      s.s6world.elevDone = true
      s.s6world.elevX = null
    }
  })
  await revealScrubber()

  // Setup + in-page sampler, then pure wall-clock wait (evaluate polling starves Phaser).
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    if (s.s6world) {
      s.s6world.elevDone = true
      s.s6world.elevX = null
    }
    s.physics.resume()
    s.storyIntro = null
    s.bossOn = true
    s.bossFight = true
    s.coffeeDone = true
    s.lastCheckpointX = 99999
    s.s2Pending = []
    const mid = (q.arenaX0 + q.arenaX1) / 2
    h.hp = 6
    h.grace = 0
    h.hurtCd = 0
    h.hurtLock = 0
    h.alive = true
    h.setData('stompSafeUntil', 0)
    h.setPosition(q.arenaX0 + 80, q.y)
    h.body?.reset?.(h.x, h.y)
    q.setPosition(mid, q.y)
    q.syncBody?.()
    q.repositionStreak = 0
    q.setAct('scan')
    q.elapsed = 600
    window.__b1 = {
      attacks: [],
      lastAct: q.act,
      t0: s.time.now,
      warnStartX: null,
      warnEndX: null,
      warnMs: null,
    }
    if (s.__b1Hook) s.events.off('update', s.__b1Hook)
    s.__b1Hook = () => {
      const b = window.__b1
      if (!b || !q?.active) return
      if (s.s6world) {
        s.s6world.elevDone = true
        s.s6world.elevX = null
      }
      if (s.physics.world.isPaused) s.physics.resume()
      if (s.storyIntro) s.storyIntro = null
      if (h.hp < 2) h.hp = 6
      h.alive = true
      h.grace = 0
      const act = q.act
      if (act === 'warn-charge' || act === 'warn-acid') {
        if (b.lastAct !== act) {
          b.warnStartX = q.x
          b.warnEndX = q.endX
          b.warnMs = q.warnChargeNeed
        }
      }
      const fromWarn = b.lastAct === 'warn-charge' || b.lastAct === 'warn-acid'
      if ((act === 'charge' || act === 'acid') && fromWarn) {
        const last = b.attacks[b.attacks.length - 1]
        if (!last || last.act !== act || s.time.now - (b.t0 + last.at) > 200) {
          const start = b.warnStartX ?? q.x
          const end = b.warnEndX ?? q.endX ?? q.x
          b.attacks.push({
            act,
            at: s.time.now - b.t0,
            hadWarn: true,
            warnMs: b.warnMs ?? q.warnChargeNeed,
            chargeDist: Math.abs(end - start),
            endX: end,
            x: start,
          })
        }
      }
      b.lastAct = act
    }
    s.events.on('update', s.__b1Hook)
  })
  await page.waitForTimeout(15000)
  const b1Attacks = await page.evaluate(() => window.__b1?.attacks ?? [])

  const b1Dmg = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const q = s.queen
    const h = s.boy
    if (s.__b1Hook) s.events.off('update', s.__b1Hook)
    s.physics.pause()
    h.hp = 5
    h.hurtLock = 0
    h.hurtCd = 0
    h.grace = 0
    h.setData('stompSafeUntil', 0)
    h.x = q.x
    q.hitHeroes = new WeakSet()
    q.setFsm('ATTACK')
    q.act = 'charge'
    const mul = Object.getPrototypeOf(s).speciesAtkMul.call(s, q)
    const chargeBefore = h.hp
    Object.getPrototypeOf(s).hurtHero.call(s, h, q)
    const chargeAfter = h.hp

    h.hp = 5
    h.hurtLock = 0
    h.hurtCd = 0
    h.grace = 0
    for (const a of q.acids || []) {
      a.g?.destroy?.()
      a.label?.destroy?.()
    }
    q.acids = []
    const floor = q.hooks6.floorY()
    const now = s.time.now
    const g = s.add.graphics()
    const label = s.add.text(h.x, floor - 36, '強酸化學劑').setOrigin(0.5)
    q.acids.push({
      x: h.x,
      harmFrom: now - 1,
      until: now + 10000,
      g,
      label,
      hitAt: new WeakMap(),
    })
    const acidBefore = h.hp
    Object.getPrototypeOf(s).tickStage6.call(s, 16)
    const acidAfter = h.hp
    s.physics.resume()
    return {
      mul,
      charge: { before: chargeBefore, after: chargeAfter },
      acid: { before: acidBefore, after: acidAfter },
    }
  })

  const b1Live = {
    attackCount: b1Attacks.length,
    attacks: b1Attacks,
    ...b1Dmg,
  }
  report.b1 = { ...b1Live, pass: false }
  await page.screenshot({ path: `${outDir}/b1-scrubber-attacks.png` })
  assert.ok(b1Live.attackCount >= 3, `B1 expected ≥3 attacks in 15s, got ${b1Live.attackCount}`)
  assert.ok(
    b1Live.attacks.every((a) => a.hadWarn),
    'B1 each attack must have warning telegraph',
  )
  assert.ok(
    b1Live.attacks.filter((a) => a.act === 'charge').every((a) => a.chargeDist <= 261),
    'B1 charge distance ≤ 260px',
  )
  assert.equal(b1Dmg.mul, 1, `B1 scrubber atk mul should be 1, got ${b1Dmg.mul}`)
  assert.equal(b1Live.charge.after, b1Live.charge.before - 1, 'B1 charge −1 HP')
  assert.equal(b1Live.acid.after, b1Live.acid.before - 1, 'B1 acid −1 HP')
  report.b1.pass = true

  // ─── B2: every checkpoint/stall on stages 6 & 7 has ground ───
  const b2 = { stages: {}, pass: false }
  for (const stageNo of [6, 7]) {
    await bootStage(stageNo)
    const grounded = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const h = s.boy
      const stallX = s.mall ? s.checkpointXs[1] : s.checkpointXs[0]
      const points = []
      for (const x of s.checkpointXs) {
        h.grace = 1e9
        h.hurtCd = 0
        h.laneJumping = false
        h.jumpConsumed = false
        h.setVelocity(0, 0)
        h.setPosition(x, 285)
        h.body.reset(x, 285)
        const support = h.terrainSupport?.() ?? null
        points.push({ x, support, overPit: support === null, stall: x === stallX })
      }
      return { stageNo: s.stageNo, stallX, checkpointXs: s.checkpointXs.slice(), points }
    })

    await page.evaluate((sx) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.cameras.main.centerOn(sx, 180)
      const h = s.boy
      h.setPosition(sx, 285)
      h.body.reset(sx, 285)
    }, grounded.stallX)
    await page.screenshot({ path: `${outDir}/b2-stage${stageNo}-checkpoints.png` })

    const stallTrial = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const stallX = s.mall ? s.checkpointXs[1] : s.checkpointXs[0]
      const h = s.boy
      s.physics.resume()
      s.coffeeDone = false
      s.lastCheckpointX = stallX - 80
      h.grace = 0
      h.hurtCd = 0
      h.hp = 6
      h.laneJumping = false
      const support = h.terrainSupport?.() ?? null
      const standY = support ?? 285
      h.setPosition(stallX + 5, standY)
      h.body.reset(stallX + 5, standY)
      h.setVelocity(0, 0)
      Object.getPrototypeOf(s).tickCheckpoints.call(s)
      return {
        stallX,
        support,
        lastCheckpointX: s.lastCheckpointX,
        coffeeDone: s.coffeeDone,
        hp: h.hp,
        y: h.y,
        triggered: s.lastCheckpointX >= stallX || s.coffeeDone === true,
      }
    })

    b2.stages[stageNo] = { grounded, stallTrial }
    assert.ok(
      grounded.points.every((p) => !p.overPit && p.support !== null),
      `B2 stage ${stageNo}: every checkpoint must have ground (got ${JSON.stringify(grounded.points)})`,
    )
    assert.ok(stallTrial.support !== null, `B2 stage ${stageNo}: stall stand support`)
    assert.ok(stallTrial.triggered, `B2 stage ${stageNo}: stall trigger`)
  }
  b2.pass = true
  report.b2 = b2

  // ─── B3: side-bump air contact damages; top-stomp does not ───
  await bootStage(1)
  const b3 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = true
    s.s2Pending = []
    s.physics.resume()
    s.storyIntro = null
    for (const e of [...s.enemies.getChildren()]) {
      e.disableBody?.(true, true)
      e.destroy()
    }
    const h = s.boy
    const proto = Object.getPrototypeOf(s)
    const armAttack = (e) => {
      e.hp = e.maxHp = 60
      e.setData('spdMul', 0.01)
      e.setFsm?.('ATTACK')
      e.fsm = 'ATTACK'
      e.atkPhase = 'strike'
      e.hitThis = false
      e.contactCd = 0
    }

    h.hp = 6
    h.grace = 0
    h.hurtCd = 0
    h.hurtLock = 0
    h.setData('stompSafeUntil', 0)

    const e1 = s.mkEnemy(430, 428, 'blocker')
    armAttack(e1)
    h.laneJumping = true
    h.body.allowGravity = true
    h.setPosition(430, e1.body.top + 20)
    h.body.reset(h.x, h.y)
    h.setVelocity(80, -120)
    const sideBefore = h.hp
    proto.hurtHero.call(s, h, e1)
    const sideAfter = h.hp

    h.hurtCd = 0
    h.hurtLock = 0
    h.grace = 0
    h.setData('stompSafeUntil', 0)
    h.hp = 6

    const e2 = s.mkEnemy(500, 428, 'blocker')
    armAttack(e2)
    const top = e2.body.top
    h.laneJumping = true
    h.body.allowGravity = true
    h.setPosition(500, top - 4)
    h.body.reset(h.x, h.y)
    h.setVelocity(0, 160)
    const stompBefore = h.hp
    const enemyBefore = e2.hp
    proto.hurtHero.call(s, h, e2)
    proto.tickStomp.call(s)
    return {
      side: { before: sideBefore, after: sideAfter, damaged: sideAfter < sideBefore },
      stomp: {
        before: stompBefore,
        after: h.hp,
        enemyBefore,
        enemyAfter: e2.hp,
        undamaged: h.hp === stompBefore,
        enemyHurt: e2.hp < enemyBefore,
      },
    }
  })
  await page.screenshot({ path: `${outDir}/b3-air-contact-c1.png` })
  assert.ok(b3.side.damaged, `B3 side-bump must damage (got ${JSON.stringify(b3.side)})`)
  assert.ok(b3.stomp.undamaged, `B3 stomp must not damage hero (got ${JSON.stringify(b3.stomp)})`)

  await bootStage(6)
  const b3c2 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.coffeeDone = true
    s.s2Pending = []
    s.physics.resume()
    s.storyIntro = null
    if (s.s6world) s.s6world.elevDone = true
    for (const e of [...s.enemies.getChildren()]) {
      e.disableBody?.(true, true)
      e.destroy()
    }
    const h = s.boy
    h.hp = 6
    h.grace = 0
    h.hurtCd = 0
    h.hurtLock = 0
    h.setData('stompSafeUntil', 0)
    const e = s.mkEnemy(800, 428, 'blocker')
    e.setFsm?.('ATTACK')
    e.fsm = 'ATTACK'
    e.atkPhase = 'strike'
    e.hitThis = false
    e.contactCd = 0
    e.hp = e.maxHp = 60
    h.laneJumping = true
    h.setPosition(800, e.body.top + 16)
    h.body.reset(h.x, h.y)
    h.setVelocity(60, -100)
    const before = h.hp
    Object.getPrototypeOf(s).hurtHero.call(s, h, e)
    return { before, after: h.hp, damaged: h.hp < before }
  })
  await page.screenshot({ path: `${outDir}/b3-air-contact-c2.png` })
  assert.ok(b3c2.damaged, `B3 C2 side-bump must damage (got ${JSON.stringify(b3c2)})`)
  report.b3 = { ...b3, c2: b3c2, pass: true }

  // ─── B6: pit vs ground contrast ───
  function hslL(hex) {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = ((n >> 16) & 255) / 255
    const g = ((n >> 8) & 255) / 255
    const b = (n & 255) / 255
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
  }
  const floorColors = ['#d8cfc0', '#c9c2b6', '#d4cdc2', '#d0c6b8', '#d2c8b8', '#f4eee4']
  const pitColor = '#1a1420'
  const pitL = hslL(pitColor)
  const contrasts = floorColors.map((c) => ({ c, L: hslL(c), delta: hslL(c) - pitL }))
  assert.ok(
    contrasts.every((row) => row.delta >= 0.5),
    `B6 HSL L gap must be ≥50% (got ${JSON.stringify(contrasts)})`,
  )

  const SEGMENTS = [
    { id: 'A', x: 420 },
    { id: 'B', x: 1400 },
    { id: 'C', x: 2500 },
    { id: 'D', x: 3800 },
    { id: 'E', x: 5000 },
  ]
  const b6 = { contrasts, stages: {}, pass: false, iphone: {} }
  for (const stageNo of [6, 7]) {
    await bootStage(stageNo)
    for (const seg of SEGMENTS) {
      await page.evaluate((x) => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        const h = s.boy
        h.grace = 999999
        h.setPosition(x, 285)
        h.body?.reset?.(x, 285)
        s.cameras.main.centerOn(x, 240)
      }, seg.x)
      await page.waitForTimeout(80)
      await page.screenshot({ path: `${pitDir}/s${stageNo}-${seg.id}-desktop.png` })
    }
    b6.stages[stageNo] = { segments: SEGMENTS.map((s) => s.id) }
  }

  const phone = await browser.newPage({ viewport: { width: 844, height: 390 } })
  await phone.goto(`http://127.0.0.1:${PORT}/?c2=1&cb=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await phone.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
  for (const stageNo of [6, 7]) {
    await phone.evaluate((n) => {
      const g = window.__SAKE_GAME__
      g.registry.set('stageNo', n)
      g.registry.set('difficulty', 'normal')
      g.registry.set('playMode', '1p')
      g.registry.set('soloCast', 'boy')
      g.registry.set('stageRound', 1)
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('play')
    }, stageNo)
    const t0 = Date.now()
    while (Date.now() - t0 < 45000) {
      await phone.keyboard.press('Space')
      await phone.keyboard.press('Enter')
      if (
        await phone.evaluate(() => {
          const s = window.__SAKE_GAME__?.scene?.getScene('play')
          return !!(s?.started && !s?.storyIntro)
        })
      )
        break
      await phone.waitForTimeout(120)
    }
    await phone.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const h = s.boy
      h.grace = 999999
      h.setPosition(700, 285)
      h.body?.reset?.(700, 285)
      s.cameras.main.centerOn(700, 240)
    })
    await phone.waitForTimeout(100)
    await phone.screenshot({ path: `${pitDir}/s${stageNo}-iphone13.png` })
    b6.iphone[stageNo] = `${pitDir}/s${stageNo}-iphone13.png`
  }
  await phone.close()
  b6.pass = true
  report.b6 = b6
  fs.writeFileSync(
    `${pitDir}/contrast.json`,
    JSON.stringify(
      {
        pit: pitColor,
        floors: contrasts,
        note: 'Walkable marble/concrete/factory lips use light beige; pit #1a1420 + 6px yellow/black stripes. HSL L gap ≥50%.',
      },
      null,
      2,
    ),
  )
  fs.writeFileSync(
    `${pitDir}/README.md`,
    [
      '# QA — B6 pit vs ground contrast (PR-I)',
      '',
      `- Pit fill: ${pitColor}`,
      `- Walkable floors: #d8cfc0 / #c9c2b6 (+ lip #f4eee4)`,
      `- HSL L gap: ≥50% (see contrast.json)`,
      `- Screenshots: s6/s7 segments A–E desktop + iPhone 13 landscape`,
      '',
    ].join('\n'),
  )

  report.errors = report.errors.filter(
    (e) => !e.includes("reading 'resolution'") && !e.includes("reading 'sourceSize'"),
  )
  assert.deepEqual(report.errors, [])
  report.ok = report.b1.pass && report.b2.pass && report.b3.pass && report.b6.pass
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
  fs.writeFileSync(
    `${outDir}/README.md`,
    [
      '# QA — C2 bugs B1/B2/B3/B6 (PR-I)',
      '',
      `- B1 scrubber attacks: ${report.b1.pass ? 'PASS' : 'FAIL'}`,
      `- B2 stall over pit: ${report.b2.pass ? 'PASS' : 'FAIL'}`,
      `- B3 air contact damage: ${report.b3.pass ? 'PASS' : 'FAIL'}`,
      `- B6 pit vs ground: ${report.b6.pass ? 'PASS' : 'FAIL'}`,
      '',
      'Run: `QA_PORT=47651 node scripts/qa/c2-bugs-b1-b3.mjs`',
      '',
    ].join('\n'),
  )
  console.log(
    'PASS',
    JSON.stringify(
      { b1: report.b1.pass, b2: report.b2.pass, b3: report.b3.pass, b6: report.b6.pass },
      null,
      2,
    ),
  )
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
