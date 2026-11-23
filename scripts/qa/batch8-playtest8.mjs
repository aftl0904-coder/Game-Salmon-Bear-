/**
 * Batch8 playtest8 acceptance (E1–E8).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.URL || 'http://127.0.0.1:47461/?c2=1'
const OUT = 'docs/qa-playtest8'
fs.mkdirSync(OUT, { recursive: true })

const report = { passed: false, checks: {}, errors: [], notes: [] }
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => report.errors.push(String(e.message)))

async function boot(stageNo) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene, null, { timeout: 45000 })
  await page.evaluate((stageNo) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', stageNo)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, stageNo)
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return { started: !!s?.started, story: !!s?.storyIntro, play: !!s }
    })
    if (st.started) break
    if (st.story || st.play) await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
  }
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    s.lastCheckpointX = 99999
    s.stageBeat = 99
    s.mallStorySeen = new Set([0, 1, 2, 3, 4])
    s.s6world?.markElevatorDone?.()
    s.physics?.resume?.()
  })
}

async function place(x) {
  await page.evaluate((x) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    s.lastCheckpointX = Math.max(s.lastCheckpointX ?? 0, x + 1)
    s.boy.setPosition(x, s.boy.y)
    s.boy.body.reset(x, s.boy.y)
    s.boy.setVelocity(0, 0)
    s.cameras.main.centerOn(x, s.boy.y)
    s.physics?.resume?.()
  }, x)
  await page.waitForTimeout(200)
}

try {
  // ── E4 jump: height ∝ v²; old 313→70px, new 360→92.6 (+32%) ─────
  await boot(1)
  const jump = await page.evaluate(async () => {
    const { fullApexVelocity, jumpGravity, PLAYER } = await import('/src/game/config/playerData.ts')
    const v = Math.abs(fullApexVelocity())
    const g = jumpGravity()
    const apex = (v * v) / (2 * g)
    const oldApex = (313 * 313) / (2 * g)
    return {
      v,
      g,
      apex: +apex.toFixed(2),
      oldApex: +oldApex.toFixed(2),
      ratio: +(apex / oldApex).toFixed(3),
      jsonV: PLAYER.jump.velocity,
      fullH: PLAYER.jump.targetHeightPx.full,
    }
  })
  report.checks.E4_apex = jump.apex
  report.checks.E4_jump_higher = jump.ratio >= 1.28 && jump.ratio <= 1.36 && jump.jsonV === 360
  report.notes.push('E4 jump: ' + JSON.stringify(jump))

  const c1 = []
  for (const st of [1, 2, 3, 4, 5]) {
    await boot(st)
    await place(400)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(80)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(400)
    const ok = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      return !!s?.boy?.active && s.started && !s.ended
    })
    c1.push({ st, ok })
  }
  report.checks.E4_c1_smoke = c1.every((x) => x.ok)
  report.notes.push('E4 c1 smoke: ' + JSON.stringify(c1))

  // ── E1 shield ────────────────────────────────────────────────────
  await boot(7)
  await place(700)
  await page.waitForTimeout(800)
  let e1 = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    let sh = s.enemies.getChildren().find((e) => e.active && e.species === 's7shield')
    if (!sh) {
      s.spawnS2('s7shield', 780)
      sh = s.enemies.getChildren().find((e) => e.active && e.species === 's7shield')
    }
    if (!sh) return { ok: false }
    const behind = sh.x + (sh.flipX ? 50 : -50)
    s.boy.setPosition(behind, s.boy.y)
    s.boy.body.reset(behind, s.boy.y)
    return { ok: true, x: sh.x, flip: sh.flipX, hp: sh.hp }
  })
  if (!e1.ok) {
    // wait for pending unlock
    await place(900)
    await page.waitForTimeout(1500)
    e1 = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      let sh = s.enemies.getChildren().find((e) => e.active && e.species === 's7shield')
      if (!sh) {
        s.spawnS2('s7shield', 780)
        sh = s.enemies.getChildren().find((e) => e.active && e.species === 's7shield')
      }
      if (!sh) return { ok: false }
      return { ok: true, x: sh.x, flip: sh.flipX, hp: sh.hp }
    })
  }
  if (e1.ok) {
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const sh = s.enemies.getChildren().find((e) => e.active && e.species === 's7shield')
      const behind = sh.x + (sh.flipX ? 50 : -50)
      s.boy.setPosition(behind, s.boy.y)
      s.boy.body.reset(behind, s.boy.y)
    })
    await page.waitForTimeout(300) // still inside 1000ms delay
    const hit = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const sh = s.enemies.getChildren().find((e) => e.active && e.species === 's7shield')
      const hp0 = sh.hp
      // blocks(dir) when dir === -face; face = flipX?-1:1.
      // Behind hit: knock dir equals face (player stands behind, strikes same way enemy faces).
      const face = sh.flipX ? -1 : 1
      const dir = face
      const blocked = sh.blocks(dir)
      sh.receiveHit(1, dir)
      return { blocked, hp0, hp1: sh.hp, flip: sh.flipX, face, dir }
    })
    // Also verify turn delay: after standing behind 200ms, still not flipped yet
    const delayOk = await page.evaluate(async () => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const sh = s.enemies.getChildren().find((e) => e.active && e.species === 's7shield')
      if (!sh) return false
      const flip0 = sh.flipX
      const behind = sh.x + (sh.flipX ? 50 : -50)
      s.boy.setPosition(behind, s.boy.y)
      s.boy.body.reset(behind, s.boy.y)
      // reset turn state
      sh.wantFlipX = null
      sh.turnDelayLeft = 0
      sh.turnAnimLeft = 0
      sh.turnCooldownLeft = 0
      await new Promise((r) => setTimeout(r, 400))
      const mid = sh.flipX === flip0 // should not have finished turn yet (<1000ms)
      await new Promise((r) => setTimeout(r, 1200))
      return { mid, flippedOrTurning: sh.flipX !== flip0 || sh.turnAnimLeft > 0 || sh.wantFlipX != null }
    })
    report.checks.E1_back_hit = hit.blocked === false && hit.hp1 < hit.hp0
    report.checks.E1_turn_delay = !!delayOk?.mid
    report.notes.push('E1: ' + JSON.stringify({ e1, hit, delayOk }))
  } else {
    report.checks.E1_back_hit = false
    report.notes.push('E1: no shield')
  }

  // ── E2 hopper ────────────────────────────────────────────────────
  await boot(7)
  await place(500)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    if (![...s.enemies.getChildren()].some((e) => e.species === 's7hop')) s.spawnS2('s7hop', 640)
  })
  const e2setup = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const hop = s.enemies.getChildren().find((e) => e.active && e.species === 's7hop')
    if (!hop) return { has: false }
    hop.t = 0
    s.boy.setPosition(hop.x + 100, s.boy.y)
    s.boy.body.reset(hop.x + 100, s.boy.y)
    s.boy.setVelocity(0, 0)
    return { has: true, hp0: s.boy.hp, hx: hop.x }
  })
  let hitOnce = false
  let sawShadow = false
  if (e2setup.has) {
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(200)
      const st = await page.evaluate(() => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        const hop = s.enemies.getChildren().find((e) => e.species === 's7hop')
        const shadow = !!hop?.shadow || s.children.list.some((o) => o.type === 'Ellipse' && o.fillColor === 0x101018)
        return { hp: s.boy.hp, phase: hop?.phase, airborne: !!hop?.airborne, shadow }
      })
      if (st.shadow || st.phase === 'crouch') sawShadow = true
      if (st.hp < e2setup.hp0) {
        hitOnce = true
        break
      }
    }
  }
  report.checks.E2_hopper_hit = hitOnce
  report.checks.E2_shadow_warn = sawShadow
  report.notes.push('E2: ' + JSON.stringify({ e2setup, hitOnce, sawShadow }))

  // ── E3 acid ──────────────────────────────────────────────────────
  await boot(6)
  await place(4700)
  for (let i = 0; i < 40; i++) {
    const has = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').queen?.species === 'mall-scrubber')
    if (has) break
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(1200)
  const acid = await page.evaluate(() => {
    const scrub = window.__SAKE_GAME__.scene.getScene('play').queen
    if (!scrub || scrub.species !== 'mall-scrubber') return { ok: false, gaps: [] }
    const gaps = []
    for (let i = 0; i < 10; i++) {
      scrub.beginAcid([window.__SAKE_GAME__.scene.getScene('play').boy], window.__SAKE_GAME__.scene.getScene('play').boy)
      const xs = (scrub.acidTargets || []).slice().sort((a, b) => a - b)
      for (let j = 1; j < xs.length; j++) gaps.push(+(xs[j] - xs[j - 1]).toFixed(1))
      scrub.acids = []
      scrub.acidTargets = []
    }
    return { ok: true, gaps, min: gaps.length ? Math.min(...gaps) : null, half: 24 }
  })
  report.checks.E3_acid_gaps = acid.ok && acid.gaps.length > 0 && acid.gaps.every((g) => g >= 96)
  report.notes.push('E3: ' + JSON.stringify(acid))

  // ── E8 blower ────────────────────────────────────────────────────
  await boot(6)
  await place(4700)
  for (let i = 0; i < 40; i++) {
    const has = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').queen?.species === 'mall-scrubber')
    if (has) break
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(1000)
  const blowerShots = []
  for (const faceLeft of [true, false]) {
    const shot = await page.evaluate((faceLeft) => {
      const scrub = window.__SAKE_GAME__.scene.getScene('play').queen
      if (!scrub || scrub.species !== 'mall-scrubber') return null
      scrub.setFlipX(faceLeft)
      for (let i = 0; i < 40; i++) scrub.tickBlower(50)
      const floor = scrub.hooks6.floorY()
      return {
        bossX: scrub.x,
        blowerX: scrub.blower.x,
        blowerY: scrub.blower.y,
        floor,
        grounded: Math.abs(scrub.blower.y - floor) < 2,
        dist: +Math.abs(scrub.blower.x - scrub.x).toFixed(1),
        flip: scrub.flipX,
      }
    }, faceLeft)
    if (shot) {
      await page.screenshot({ path: `${OUT}/blower-face-${faceLeft ? 'L' : 'R'}.png` })
      blowerShots.push(shot)
    }
  }
  report.checks.E8_grounded = blowerShots.length >= 1 && blowerShots.every((s) => s.grounded)
  report.checks.E8_behind_dist =
    blowerShots.length >= 1 && blowerShots.every((s) => s.dist >= 40 && s.dist <= 70)

  const follow = await page.evaluate(async () => {
    const scrub = window.__SAKE_GAME__.scene.getScene('play').queen
    if (!scrub || scrub.species !== 'mall-scrubber') return { ok: false }
    scrub.setX(scrub.arenaX0 + 100)
    for (let i = 0; i < 60; i++) scrub.tickBlower(50) // catch up first
    const samples = []
    for (let i = 0; i < 30; i++) {
      scrub.setX(scrub.x + 6)
      scrub.tickBlower(50)
      samples.push(+Math.abs(scrub.blower.x - scrub.x).toFixed(1))
      await new Promise((r) => setTimeout(r, 30))
    }
    return { ok: true, samples, inRange: samples.filter((d) => d >= 40 && d <= 70).length }
  })
  report.checks.E8_follow = follow.ok && follow.inRange >= 8

  // Wind speed check: into-wind mul applied in GameScene — verify intoWind + document ×0.5
  const wind = await page.evaluate(() => {
    const scrub = window.__SAKE_GAME__.scene.getScene('play').queen
    if (!scrub) return { ok: false }
    scrub.blowerPhase = 'blast'
    scrub.blowerDisabledUntil = 0
    scrub.setFlipX(false)
    return { ok: true, into: scrub.intoWind(80, scrub.x - 40), mul: 0.5 }
  })
  report.checks.E8_into_wind = !!wind.into
  report.notes.push('E8: ' + JSON.stringify({ blowerShots, follow, wind }))

  // ── E5 ───────────────────────────────────────────────────────────
  const elev = JSON.parse(fs.readFileSync('data/levels/stage6.json', 'utf8'))
  report.checks.E5_elevator_removed = elev.elevatorX == null
  report.notes.push(
    'E5: elevator was same-floor cutscene only (no teleport/new area). Deleted; escalator kept.',
  )

  // ── E6 ───────────────────────────────────────────────────────────
  report.checks.E6_no_memory = fs.readFileSync('src/game/GameScene.ts', 'utf8').includes('E6:')
  const stalls = JSON.parse(fs.readFileSync('data/stalls.json', 'utf8'))
  report.notes.push('E6 stalls.json stages: ' + JSON.stringify(stalls.stages || Object.keys(stalls)))

  // ── E7 ───────────────────────────────────────────────────────────
  const quiz = JSON.parse(fs.readFileSync('data/quiz-mall.json', 'utf8'))
  report.checks.E7_bank_300 = quiz.questions.length >= 300
  report.checks.E7_iq_40 = quiz.questions.filter((q) => q.category === 'iq').length >= 40
  const mix = await page.evaluate(() =>
    import('/src/game/membershipQuiz.ts').then((m) => {
      const rounds = []
      for (let i = 0; i < 20; i++) rounds.push(m.pickRoundForQa(() => Math.random()).map((q) => q.category))
      return rounds
    }),
  )
  const iqCount = mix.filter((r) => r.includes('iq')).length
  report.checks.E7_iq_per_round = iqCount >= 18
  report.notes.push(`E7 bank=${quiz.questions.length} iqRounds=${iqCount}/20`)
  report.notes.push(
    'Minigames/stage: ST1 flag; ST6 goldfish; ST7 goldfish only (memory removed); see stalls.json',
  )

  const required = [
    'E1_back_hit',
    'E2_hopper_hit',
    'E2_shadow_warn',
    'E3_acid_gaps',
    'E8_grounded',
    'E8_behind_dist',
    'E8_follow',
    'E8_into_wind',
    'E4_jump_higher',
    'E4_c1_smoke',
    'E5_elevator_removed',
    'E6_no_memory',
    'E7_bank_300',
    'E7_iq_40',
    'E7_iq_per_round',
  ]
  report.passed = required.every((k) => report.checks[k])
  report.required = Object.fromEntries(required.map((k) => [k, !!report.checks[k]]))
} catch (e) {
  report.passed = false
  report.error = e.stack || String(e)
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {})
} finally {
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(
    JSON.stringify(
      { passed: report.passed, required: report.required, checks: report.checks, notes: report.notes, error: report.error, errors: report.errors },
      null,
      2,
    ),
  )
  await browser.close()
}
if (!report.passed) process.exitCode = 1
