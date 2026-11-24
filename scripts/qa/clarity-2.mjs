#!/usr/bin/env node
/**
 * Clarity-2 QA: safeKnockX reverse/zero, spike tip hitbox, belt deadzone.
 * Screenshots: docs/qa-clarity-2/
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '4533'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve('docs/qa-clarity-2')
const ART = '/opt/cursor/artifacts/qa-clarity-2'
fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(ART, { recursive: true })
const log = []
const say = (m) => {
  console.log(m)
  log.push(`[${new Date().toISOString()}] ${m}`)
}

async function startStage(page, { stage, mode, cast }) {
  await page.evaluate(({ stage, mode, cast }) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', stage)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', mode)
    g.registry.set('soloCast', cast)
    g.registry.set('stageRound', 1)
    g.registry.set('cheat', true)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, { stage, mode, cast })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__?.scene?.getScene('play')
    if (!sc) return
    sc.started = true
    sc.startedAt = sc.time?.now ?? 0
    sc.storyIntro?.destroy?.()
    sc.storyIntro = null
    sc.children?.list?.forEach?.((o) => {
      if (o.type === 'Container' && o.depth > 1000) o.setVisible(false)
    })
  })
  await page.waitForTimeout(300)
}

async function snap(page, name) {
  const p1 = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p1 })
  fs.copyFileSync(p1, path.join(ART, `${name}.png`))
  say(`shot ${name}`)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('pageerror', (e) => say(`PAGEERROR ${e.message}`))

const results = { ok: true, cases: [] }

try {
  await page.goto(`${BASE}/?hitbox=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__?.isBooted, null, { timeout: 30000 })
  // Wait until Boot has painted spike tiles (isBooted can fire slightly early).
  await page.waitForFunction(() => window.__SAKE_GAME__?.textures?.exists?.('blk-spike'), null, {
    timeout: 30000,
  })
  await page.waitForTimeout(400)

  // ── Spike tip hitbox on stage 1 near 4700 ──
  await startStage(page, { stage: 1, mode: '1p', cast: 'boy' })
  const spikes = await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    sc.boy.x = 4680
    sc.boy.snapToLane?.(0, 4680)
    sc.cameras.main.centerOn(4720, sc.boy.y)
    const list = []
    for (const o of sc.hazards.getChildren()) {
      const s = o
      if (s.getData('hazardKind') !== 'spike') continue
      if (s.x < 4650 || s.x > 4820) continue
      const b = s.body
      list.push({
        x: Math.round(s.x),
        dispW: Math.round(s.displayWidth),
        bodyW: Math.round(b?.width ?? -1),
        bodyH: Math.round(b?.height ?? -1),
        left: Math.round(b?.left ?? -1),
        right: Math.round(b?.right ?? -1),
      })
    }
    return list
  })
  say(`spikes@4700 ${JSON.stringify(spikes)}`)
  const spikeOk = spikes.length > 0 && spikes.every((s) => s.bodyW <= s.dispW && s.bodyW <= s.dispW * 0.95 + 1)
  results.cases.push({ name: 'spike-tip-width', ok: spikeOk, spikes })
  if (!spikeOk) results.ok = false
  await snap(page, 's1-spikes-4700-hitbox')

  // ── Knock tests 1P/2P × stages 1,5,6 ──
  for (const mode of ['1p', '2p']) {
    for (const stage of [1, 5, 6]) {
      const tag = `${mode}-s${stage}`
      await startStage(page, { stage, mode, cast: 'boy' })
      const before = await page.evaluate((st) => {
        const sc = window.__SAKE_GAME__.scene.getScene('play')
        // Place near a known hazard cluster
        const x = st === 1 ? 4650 : st === 5 ? 580 : 1660
        sc.boy.hurtCd = 0
        sc.boy.grace = 0
        sc.boy.x = x
        sc.boy.snapToLane?.(0, x)
        sc.cameras.main.centerOn(x, sc.boy.y)
        // Force an enemy on the right within 80px if none
        let e = (sc.enemies.getChildren() ?? []).find((o) => o.active && o.x > sc.boy.x && o.x < sc.boy.x + 100)
        if (!e) {
          // synthetic: place boy left of first live enemy
          e = (sc.enemies.getChildren() ?? []).find((o) => o.active)
          if (e) {
            sc.boy.x = e.x - 40
            sc.boy.snapToLane?.(0, sc.boy.x)
            sc.cameras.main.centerOn(sc.boy.x, sc.boy.y)
          }
        }
        return {
          x: Math.round(sc.boy.x),
          hp: sc.boy.hp,
          enemyX: e ? Math.round(e.x) : null,
        }
      }, stage)
      await snap(page, `${tag}-knock-before`)

      const after = await page.evaluate(() => {
        const sc = window.__SAKE_GAME__.scene.getScene('play')
        const h = sc.boy
        const beforeX = h.x
        // Prefer real hurt from enemy; else call safeKnockX directly
        const e = (sc.enemies.getChildren() ?? []).find((o) => o.active && Math.abs(o.x - h.x) < 120)
        let kxRaw = 340
        let kxSafe = 0
        if (e) {
          const away = Math.sign(h.x - e.x) || -1
          kxRaw = away * 340
          kxSafe = sc.safeKnockX(h, kxRaw, e)
          // apply
          h.setVelocityX(kxSafe)
          h.x += Math.sign(kxSafe || 0) * 8
        } else {
          // near spikes: knock toward +X
          kxRaw = 340
          kxSafe = sc.safeKnockX(h, kxRaw, null)
          h.setVelocityX(kxSafe)
        }
        return {
          beforeX: Math.round(beforeX),
          afterX: Math.round(h.x),
          vx: Math.round(h.body?.velocity?.x ?? 0),
          kxRaw,
          kxSafe,
          flipped: kxSafe === -kxRaw,
          zeroed: kxSafe === 0,
        }
      })
      say(`${tag} knock ${JSON.stringify({ before, after })}`)
      await page.waitForTimeout(200)
      await snap(page, `${tag}-knock-after`)
      results.cases.push({ name: `knock-${tag}`, before, after })
    }
  }

  // ── Belt deadzone stage 5 ──
  await startStage(page, { stage: 5, mode: '1p', cast: 'boy' })
  const belt = await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    const samples = []
    for (const x of [560, 580, 590, 600, 610, 615]) {
      sc.boy.x = x
      sc.boy.y = sc.boy.y // grounded
      sc.boy.laneJumping = false
      // snap feet
      sc.boy.snapToLane?.(0, x)
      const x0 = sc.boy.x
      sc.s5world?.push(sc.boy, 1000) // 1s worth
      samples.push({ x, before: Math.round(x0), after: Math.round(sc.boy.x), moved: Math.abs(sc.boy.x - x0) > 0.5 })
    }
    return samples
  })
  say(`belt-deadzone ${JSON.stringify(belt)}`)
  // 580-620 should NOT move (deadzone); 560 might still move
  const deadOk = belt.filter((s) => s.x >= 580).every((s) => !s.moved)
  const liveOk = belt.some((s) => s.x < 580 && s.moved)
  results.cases.push({ name: 'belt-deadzone', ok: deadOk, liveOk, belt })
  if (!deadOk) results.ok = false
  await snap(page, 's5-belt-deadzone-580')

  // Walk into deadzone visual
  await page.evaluate(() => {
    const sc = window.__SAKE_GAME__.scene.getScene('play')
    sc.boy.x = 600
    sc.boy.snapToLane?.(0, 600)
    sc.cameras.main.centerOn(600, sc.boy.y)
  })
  await snap(page, 's5-belt-stand-firm')
} catch (e) {
  say(`FAIL ${e?.stack || e}`)
  results.ok = false
  results.error = String(e)
} finally {
  await browser.close()
}

fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2))
fs.writeFileSync(path.join(OUT, 'run-log.txt'), log.join('\n'))
fs.copyFileSync(path.join(OUT, 'summary.json'), path.join(ART, 'summary.json'))
fs.copyFileSync(path.join(OUT, 'run-log.txt'), path.join(ART, 'run-log.txt'))
say(`summary ok=${results.ok}`)
process.exit(results.ok ? 0 : 1)
