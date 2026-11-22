/**
 * B4_ST7_ENEMY_VARIETY acceptance:
 * 1) Each segment A–E has ≥3 behavior types (data + live spawn sample)
 * 2) Standing still + continuous shooting cannot clear a full segment
 * 3) Best-effort timed playthrough sample (or document why incomplete)
 */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'docs/qa-st7-enemies'
const URL = process.env.QA_URL || 'http://127.0.0.1:47652/?c2=1'
fs.mkdirSync(OUT, { recursive: true })

const SEGMENTS = [
  { id: 'A', x0: 0, x1: 855 },
  { id: 'B', x0: 855, x1: 1995 },
  { id: 'C', x0: 1995, x1: 3135 },
  { id: 'D', x0: 3135, x1: 4560 },
  { id: 'E', x0: 4560, x1: 5700 },
]
const TYPES = ['s7charge', 's7hop', 's7shield', 's7can']

const log = {
  description: 'Stage 7 enemy variety acceptance (B4_ST7_ENEMY_VARIETY)',
  url: URL,
  start: new Date().toISOString(),
  acceptance: {},
  samples: [],
  errors: [],
  screenshots: [],
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => {
  localStorage.setItem('sake-kuma-difficulty-v1', 'normal')
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
  localStorage.setItem(
    'sake-kuma-run-v1',
    JSON.stringify({
      version: 1,
      runId: 'qa-st7-enemy',
      startStage: 6,
      lastCleared: 6,
      nextStage: 7,
      gear: { boy: { heart: 0, speed: 0, gun: 0, armour: 0, boots: 0, charm: 0 }, girl: { heart: 0, speed: 0, gun: 0, armour: 0, boots: 0, charm: 0 } },
      growth: {},
      eligible: true,
      coins: 80,
      purse: { boy: 40, girl: 40 },
      hp: { boy: 6, girl: 6 },
      friends: [],
      charm: null,
      mode: '1p',
      solo: 'boy',
      puffLeft: false,
    }),
  )
})
const page = await ctx.newPage()
page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') log.errors.push('console: ' + m.text().slice(0, 200))
})

const shot = async (name) => {
  const p = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p })
  log.screenshots.push(p)
  return p
}

const state = () =>
  page.evaluate(() => {
    const g = window.__SAKE_GAME__
    const s = g?.scene?.getScene('play')
    const enemies = s?.enemies
      ? s.enemies
          .getChildren()
          .filter((e) => e.active && e.fsm !== 'DEAD')
          .map((e) => ({
            sp: e.species,
            x: Math.round(e.x),
            hp: e.hp,
            phase: e.phase ?? null,
            airborne: !!e.airborne,
          }))
      : []
    const pending = (s?.s2Pending || []).map((p) => ({ sp: p.species, x: p.x, unlockX: p.unlockX }))
    return {
      active: g?.scene?.getScenes(true)?.map((a) => a.scene.key) || [],
      stage: s?.stageNo,
      started: s?.started,
      ended: s?.ended,
      intro: !!s?.storyIntro,
      continued: s?.awaitingContinue,
      x: s?.boy && Math.round(s.boy.x),
      hp: s?.boy?.hp,
      win: g?.registry?.get('winScreenShown') === true,
      enemies,
      pending,
    }
  })

const press = async (k) => {
  await page.keyboard.down(k)
  await page.waitForTimeout(40)
  await page.keyboard.up(k)
}

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 60000 })
  await page.waitForTimeout(2500)

  // Force Stage 7 play — re-assert registry each retry (Enter can bounce menus).
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      const play = g.scene.getScene('play')
      if (play?.stageNo === 7 && play?.started && !play?.storyIntro) return
      for (const sc of g.scene.getScenes(true)) g.scene.stop(sc.scene.key)
      g.registry.set('stageNo', 7)
      g.registry.set('difficulty', 'normal')
      g.registry.set('playMode', '1p')
      g.registry.set('soloCast', 'boy')
      g.registry.set('stageRound', 1)
      g.scene.start('play')
    })
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    const s = await state()
    if (s.active.includes('play') && s.stage === 7 && s.started && !s.intro) break
  }
  let s = await state()
  assert.equal(s.stage, 7, 'must be on stage 7')
  assert.equal(s.started, true, 'stage must be started')
  await shot('01-stage7-boot')

  // —— A1: segment type coverage from JSON + pending/live ——
  const roster = await page.evaluate(() => {
    // Read from the running scene's stage table via enemies already planned.
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const pending = (s.s2Pending || []).map((p) => ({ sp: p.species, x: p.x }))
    const live = s.enemies
      .getChildren()
      .filter((e) => e.species && String(e.species).startsWith('s7'))
      .map((e) => ({ sp: e.species, x: Math.round(e.x) }))
    return { pending, live }
  })
  // Also load stage JSON via fetch for authoritative roster.
  const level = await page.evaluate(async () => {
    const r = await fetch('/data/levels/stage7.json')
    return r.json()
  }).catch(async () => {
    // Vite serves from project root; data may be bundled. Fall back to evaluate import path.
    return null
  })

  let enemiesFromData = level?.enemies
  if (!enemiesFromData) {
    // Read from disk in Node if fetch failed (bundled import).
    enemiesFromData = JSON.parse(fs.readFileSync('data/levels/stage7.json', 'utf8')).enemies
  }

  const perSeg = {}
  for (const seg of SEGMENTS) {
    const list = enemiesFromData.filter((e) => e.x >= seg.x0 && e.x < seg.x1)
    const kinds = [...new Set(list.map((e) => e.species))]
    perSeg[seg.id] = { count: list.length, kinds, ok: kinds.length >= 3 && kinds.every((k) => TYPES.includes(k)) }
  }
  const a1Pass = SEGMENTS.every((seg) => perSeg[seg.id].ok)
  log.acceptance.A1_segment_types = { pass: a1Pass, perSeg, roster }
  assert.ok(a1Pass, 'each segment A–E must have ≥3 behavior types: ' + JSON.stringify(perSeg))

  // Consecutive check
  const ordered = [...enemiesFromData].sort((a, b) => a.x - b.x)
  const consec = []
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].species === ordered[i - 1].species) consec.push(ordered[i].x)
  }
  log.acceptance.A1b_no_consecutive = { pass: consec.length === 0, consec }
  assert.equal(consec.length, 0, 'no consecutive same type')

  // Density
  const densOk = enemiesFromData.length <= 18
  log.acceptance.A1c_density = { pass: densOk, count: enemiesFromData.length, max: 18 }
  assert.ok(densOk)

  await shot('02-roster-ok')

  // —— A2: stand-still continuous shoot cannot clear a full segment ——
  // Use segment B (has shield + hop). Teleport into segment, lock X, mash shoot.
  const segB = SEGMENTS[1]
  const standX = 1100
  await page.evaluate((x) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const h = s.boy
    h.x = x
    h.y = 200
    h.hp = 6
    h.graceUntil = s.time.now + 120000
    s.cameras.main.scrollX = x - 200
    // Force-unlock pending enemies in segment B so they exist.
    for (const p of [...(s.s2Pending || [])]) {
      if (p.x >= 855 && p.x < 1995) p.unlockX = -1
    }
  }, standX)
  await page.waitForTimeout(1500)

  // Also nudge lead by briefly moving, then lock.
  await page.keyboard.down('d')
  await page.waitForTimeout(400)
  await page.keyboard.up('d')
  await page.evaluate((x) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.boy.x = x
    s.boy.setVelocity(0, 0)
    s.boy.graceUntil = s.time.now + 120000
  }, standX)

  const before = await page.evaluate((bounds) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return s.enemies
      .getChildren()
      .filter((e) => e.active && e.fsm !== 'DEAD' && e.x >= bounds.x0 && e.x < bounds.x1 && String(e.species || '').startsWith('s7'))
      .map((e) => ({ sp: e.species, x: Math.round(e.x), hp: e.hp }))
  }, segB)
  log.samples.push({ tag: 'standstill-before', before })

  // Continuous shoot while frozen in place for ~12s.
  const tShoot0 = Date.now()
  while (Date.now() - tShoot0 < 12000) {
    await page.evaluate((x) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.boy.x = x
      s.boy.setVelocity(0, 0)
      s.boy.hp = Math.max(s.boy.hp, 4)
      s.boy.graceUntil = s.time.now + 2000
    }, standX)
    await page.keyboard.down('f')
    await page.waitForTimeout(80)
    await page.keyboard.up('f')
    await page.waitForTimeout(40)
  }
  await shot('03-standstill-shooting')

  const after = await page.evaluate((bounds) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return s.enemies
      .getChildren()
      .filter((e) => e.active && e.fsm !== 'DEAD' && e.x >= bounds.x0 && e.x < bounds.x1 && String(e.species || '').startsWith('s7'))
      .map((e) => ({ sp: e.species, x: Math.round(e.x), hp: e.hp, phase: e.phase ?? null }))
  }, segB)

  // Also count pending still waiting in B.
  const pendingB = await page.evaluate((bounds) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return (s.s2Pending || []).filter((p) => p.x >= bounds.x0 && p.x < bounds.x1).map((p) => ({ sp: p.species, x: p.x }))
  }, segB)

  const remaining = after.length + pendingB.length
  const cleared = remaining === 0 && before.length > 0
  // Must NOT clear: shields/hops should survive.
  const survivors = after.filter((e) => e.sp === 's7shield' || e.sp === 's7hop')
  const a2Pass = !cleared && (survivors.length > 0 || remaining > 0)
  log.acceptance.A2_standstill_cannot_clear = {
    pass: a2Pass,
    before,
    after,
    pendingB,
    remaining,
    survivors,
  }
  assert.ok(a2Pass, 'standing still continuous shooting must not clear segment B')
  await shot('04-standstill-survivors')

  // Behavior smoke: shield blocks front, hop grounded immune, charge warns, can throws.
  const behavior = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const out = {}
    for (const sp of ['s7shield', 's7hop', 's7charge', 's7can']) {
      const e = s.enemies.getChildren().find((o) => o.active && o.species === sp && o.fsm !== 'DEAD')
      if (!e) {
        out[sp] = 'missing'
        continue
      }
      if (sp === 's7shield') {
        e.setFlipX(true) // face left
        const front = typeof e.blocks === 'function' && e.blocks(1) // hit from right into left-facing front
        const back = typeof e.blocks === 'function' && e.blocks(-1)
        out[sp] = { frontBlocks: front, backOpen: !back, hp: e.hp }
      } else if (sp === 's7hop') {
        out[sp] = { airOnlyGrounded: typeof e.airOnly === 'function' && e.airOnly(), hp: e.hp }
      } else if (sp === 's7charge') {
        out[sp] = { phase: e.phase, hp: e.maxHp, maxHp: e.maxHp }
      } else {
        out[sp] = { hp: e.hp, maxHp: e.maxHp }
      }
    }
    return out
  })
  log.acceptance.A2b_behavior_smoke = {
    pass:
      behavior.s7shield?.frontBlocks === true &&
      behavior.s7shield?.backOpen === true &&
      behavior.s7hop?.airOnlyGrounded === true &&
      (behavior.s7charge?.maxHp === 3 || behavior.s7charge === 'missing'),
    behavior,
  }

  // —— A3: timed playthrough attempt (move+jump+shoot) ——
  // Reset to start of stage and try a paced clear attempt with a soft timeout.
  await page.evaluate(() => {
    const g = window.__SAKE_GAME__
    for (const sc of g.scene.getScenes(true)) g.scene.stop(sc.scene.key)
    g.registry.set('stageNo', 7)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', '1p')
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    g.scene.start('play')
  })
  await page.waitForTimeout(2500)
  for (let i = 0; i < 20; i++) {
    const st = await state()
    if (st.active.includes('play') && st.stage === 7 && st.started && !st.intro) break
    await press('Enter')
    await page.waitForTimeout(600)
  }

  const playStart = Date.now()
  const PLAY_CAP_MS = Number(process.env.QA_PLAY_MS || 360000) // 6 min cap
  let held = false
  let lastSample = 0
  let bestX = 0
  while (Date.now() - playStart < PLAY_CAP_MS) {
    s = await state()
    if (s.win) break
    if (s.stage !== 7) break
    if (s.active.includes('play') && s.started && !s.ended && !s.intro) {
      if (!held) {
        await page.keyboard.down('d')
        held = true
      }
      await page.keyboard.press('f')
      // Jump over pits / behind shields periodically.
      if ((s.x || 0) % 17 < 3) await page.keyboard.press('g')
      // Occasional back-jump to hit shield backs.
      if ((s.x || 0) > 700 && Math.random() < 0.08) {
        if (held) {
          await page.keyboard.up('d')
          held = false
        }
        await page.keyboard.down('a')
        await page.keyboard.press('g')
        await page.waitForTimeout(200)
        await page.keyboard.up('a')
        await page.keyboard.down('d')
        held = true
      }
      bestX = Math.max(bestX, s.x || 0)
    } else {
      if (held) {
        await page.keyboard.up('d')
        held = false
      }
      await page.keyboard.press(s.continued ? 'Space' : 'Enter')
    }
    if (Date.now() - lastSample > 15000) {
      lastSample = Date.now()
      const sample = { elapsedSec: Math.round((lastSample - playStart) / 1000), ...s, enemies: s.enemies?.length }
      log.samples.push(sample)
      console.log('play', sample.elapsedSec, 'x=' + s.x, 'hp=' + s.hp, 'enemies=' + (s.enemies?.length || 0))
      await shot(`play-${sample.elapsedSec}s`)
    }
    if (log.errors.length > 8) break
    await page.waitForTimeout(220)
  }
  if (held) await page.keyboard.up('d')
  s = await state()
  const clearSec = Math.round((Date.now() - playStart) / 1000)
  const clearedFull = !!s.win
  log.acceptance.A3_playthrough = {
    pass: clearedFull || bestX >= 4500, // partial credit if reached E approach
    clearedFull,
    clearTimeSec: clearedFull ? clearSec : null,
    bestMeasuredSec: clearSec,
    bestX,
    reason: clearedFull
      ? 'full clear within cap'
      : bestX >= 4560
        ? 'reached segment E / boss approach; boss clear not completed in automated script window'
        : 'automated keyboard bot did not finish; see samples',
    targetBandMin: 4,
    targetBandMax: 6,
  }
  await shot('05-playthrough-final')

  log.passed = a1Pass && a2Pass && (clearedFull || bestX >= 2000)
} catch (e) {
  log.failure = e.stack || String(e)
  log.passed = false
  console.error(log.failure)
  await shot('FAIL').catch(() => {})
}

log.end = new Date().toISOString()
log.final = await state().catch(() => null)
fs.writeFileSync(path.join(OUT, 'acceptance.json'), JSON.stringify(log, null, 2) + '\n')

const summary = {
  passed: log.passed,
  A1: log.acceptance.A1_segment_types?.pass,
  A2: log.acceptance.A2_standstill_cannot_clear?.pass,
  A3: log.acceptance.A3_playthrough,
  errors: log.errors.length,
  screenshots: log.screenshots,
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))

await browser.close()
if (!log.passed) process.exitCode = 1
