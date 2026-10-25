/**
 * Phase A — enemy AI audit (read-only). No gameplay redesign.
 * Samples live enemy FSM/species/atkPhase for ~60s while player walks forward.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4741/'
const OUT = '/opt/cursor/artifacts/qa-enemy-phase-a'
const SAMPLE_MS = 250
const RUN_MS = 60_000
fs.mkdirSync(OUT, { recursive: true })

async function waitScene(page, key, timeout = 45000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const cur = await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      const live = g?.scene?.getScenes?.(true)
      return live?.[0]?.sys?.settings?.key ?? null
    })
    if (cur === key) return
    await page.waitForTimeout(100)
  }
  throw new Error(`timeout waiting for ${key}`)
}

async function enterPlay(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 45000 })
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await waitScene(page, 'menu')
  await page.waitForTimeout(400)
  await page.keyboard.press('Enter')
  await waitScene(page, 'play')
  // skip intro
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Space')
    await page.keyboard.press('F')
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(400)
  // force start if needed
  await page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    if (play && !play.started) {
      play.started = true
      play.startedAt = play.time.now
    }
  })
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await enterPlay(page)

// Snapshot roster at t0 (including deferred)
const roster = await page.evaluate(() => {
  const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
  if (!play?.enemies) return []
  return play.enemies.getChildren().map((o, i) => {
    const e = o
    return {
      i,
      kind: e.kind,
      species: e.species,
      hp: e.hp,
      maxHp: e.maxHp,
      active: e.active,
      wave: e.getData?.('wave'),
      unlockX: e.getData?.('unlockX'),
      attackMode: e.attackMode,
      x: Math.round(e.x),
      lane: e.lane,
      label: e.species,
    }
  })
})
fs.writeFileSync(path.join(OUT, 'roster.json'), JSON.stringify(roster, null, 2))

const samples = []
const tStart = Date.now()
let movingRight = true

// Walk forward + occasional attack (mirrors "mash F" playstyle observation)
const moveLoop = (async () => {
  while (Date.now() - tStart < RUN_MS) {
    if (movingRight) await page.keyboard.down('D')
    else await page.keyboard.up('D')
    await page.keyboard.press('F')
    await page.waitForTimeout(180)
    // unlock later waves by progressing
    const lead = await page.evaluate(() => {
      const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
      return play?.leadX?.() ?? play?.boy?.x ?? 0
    })
    if (lead > 5200) movingRight = false
  }
  await page.keyboard.up('D')
})()

while (Date.now() - tStart < RUN_MS) {
  const snap = await page.evaluate(() => {
    const play = window.__SAKE_GAME__?.scene?.getScene?.('play')
    if (!play?.enemies) return { t: 0, enemies: [], attacking: 0 }
    const now = play.time?.now ?? 0
    const enemies = play.enemies.getChildren().map((o, i) => {
      const e = o
      return {
        i,
        kind: e.kind,
        species: e.species,
        fsm: e.fsm,
        state: e.state,
        atkPhase: e.atkPhase,
        active: !!e.active,
        hp: e.hp,
        lane: e.lane,
        desiredLane: e.desiredLane,
        laneSliding: !!e.laneSliding,
        x: Math.round(e.x),
        vx: Math.round(e.body?.velocity?.x ?? 0),
        windup: Math.round(e.windup ?? 0),
        atkCd: Math.round(e.atkCd ?? 0),
        attackMode: e.attackMode,
        wave: e.getData?.('wave'),
      }
    })
    const attacking = enemies.filter(
      (e) => e.active && e.fsm === 'ATTACK' && (e.atkPhase === 'windup' || e.atkPhase === 'strike' || e.atkPhase === 'charge'),
    ).length
    return { t: now, leadX: Math.round(play.leadX?.() ?? play.boy?.x ?? 0), attacking, enemies }
  })
  samples.push({ wallMs: Date.now() - tStart, ...snap })
  await page.waitForTimeout(SAMPLE_MS)
}

await moveLoop

await page.screenshot({ path: path.join(OUT, 'phase_a_end.png'), fullPage: false })

// Aggregate state distribution by species (active only)
const bySpecies = {}
const byKind = {}
const fsmCounts = {}
const atkPhaseCounts = {}
let maxSimultaneousAttacking = 0
let samplesWithAttackGt2 = 0
let activeEnemyFrames = 0

for (const s of samples) {
  maxSimultaneousAttacking = Math.max(maxSimultaneousAttacking, s.attacking || 0)
  if ((s.attacking || 0) > 2) samplesWithAttackGt2++
  for (const e of s.enemies || []) {
    if (!e.active) continue
    activeEnemyFrames++
    const sp = e.species || '?'
    const kd = e.kind || '?'
    bySpecies[sp] ??= { frames: 0, fsm: {}, atkPhase: {}, states: {} }
    byKind[kd] ??= { frames: 0, fsm: {}, speciesMix: {} }
    bySpecies[sp].frames++
    bySpecies[sp].fsm[e.fsm] = (bySpecies[sp].fsm[e.fsm] || 0) + 1
    bySpecies[sp].atkPhase[e.atkPhase || 'none'] = (bySpecies[sp].atkPhase[e.atkPhase || 'none'] || 0) + 1
    bySpecies[sp].states[e.state || '?'] = (bySpecies[sp].states[e.state || '?'] || 0) + 1
    byKind[kd].frames++
    byKind[kd].fsm[e.fsm] = (byKind[kd].fsm[e.fsm] || 0) + 1
    byKind[kd].speciesMix[sp] = (byKind[kd].speciesMix[sp] || 0) + 1
    fsmCounts[e.fsm] = (fsmCounts[e.fsm] || 0) + 1
    atkPhaseCounts[e.atkPhase || 'none'] = (atkPhaseCounts[e.atkPhase || 'none'] || 0) + 1
  }
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0)

const speciesDist = Object.fromEntries(
  Object.entries(bySpecies).map(([sp, v]) => [
    sp,
    {
      frames: v.frames,
      fsmPct: Object.fromEntries(Object.entries(v.fsm).map(([k, n]) => [k, pct(n, v.frames)])),
      atkPhasePct: Object.fromEntries(Object.entries(v.atkPhase).map(([k, n]) => [k, pct(n, v.frames)])),
      statePct: Object.fromEntries(Object.entries(v.states).map(([k, n]) => [k, pct(n, v.frames)])),
    },
  ]),
)

const report = {
  at: new Date().toISOString(),
  url: URL,
  runMs: RUN_MS,
  sampleMs: SAMPLE_MS,
  sampleCount: samples.length,
  rosterCount: roster.length,
  rosterBySpecies: roster.reduce((a, e) => ((a[e.species] = (a[e.species] || 0) + 1), a), {}),
  rosterByKind: roster.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {}),
  activeEnemyFrames,
  globalFsmPct: Object.fromEntries(Object.entries(fsmCounts).map(([k, n]) => [k, pct(n, activeEnemyFrames)])),
  globalAtkPhasePct: Object.fromEntries(
    Object.entries(atkPhaseCounts).map(([k, n]) => [k, pct(n, activeEnemyFrames)]),
  ),
  speciesDist,
  byKind: Object.fromEntries(
    Object.entries(byKind).map(([k, v]) => [
      k,
      {
        frames: v.frames,
        fsmPct: Object.fromEntries(Object.entries(v.fsm).map(([f, n]) => [f, pct(n, v.frames)])),
        speciesMix: v.speciesMix,
      },
    ]),
  ),
  attackToken: {
    maxSimultaneousAttacking,
    samplesWithAttackGt2,
    sampleCount: samples.length,
    pctSamplesAttackGt2: pct(samplesWithAttackGt2, samples.length),
  },
  duplicationSignals: {
    note: 'If all species show high CHASE% and low distinct atkPhase patterns, behaviors converge.',
    chaseDominant: Object.fromEntries(
      Object.entries(speciesDist).map(([sp, v]) => [sp, v.fsmPct.CHASE ?? 0]),
    ),
  },
}

fs.writeFileSync(path.join(OUT, 'phase_a_report.json'), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(OUT, 'phase_a_samples.json'), JSON.stringify(samples.slice(0, 40), null, 2))
// keep full samples as ndjson for size
fs.writeFileSync(
  path.join(OUT, 'phase_a_samples.ndjson'),
  samples.map((s) => JSON.stringify(s)).join('\n'),
)

console.log(JSON.stringify(report, null, 2))
await browser.close()
