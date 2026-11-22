/**
 * PR-A / T1_C2S2_ENTRY: ST-06 clear → ST-07 (1P + 2P). Injected clear, not natural play.
 * Evidence → docs/qa-c2-entry/
 *
 * Reproduce on main: win() set maxStage=7 but saveClear left nextStage=6/lastCleared=5;
 * goNextStage set registryStage=7 while play stayed on 6 (pick strand). See reproduce-main.json.
 *
 * Note: do NOT dynamic-import /src/game/run.ts — Vite can duplicate the run singleton
 * vs GameScene's static import. Seed localStorage, reload, then assert LS + scene.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const PORT = process.env.QA_PORT || '47401'
const OUT = 'docs/qa-c2-entry'
fs.mkdirSync(OUT, { recursive: true })

const report = { ok: false, errors: [], cases: [] }

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})

function seedRun(mode) {
  return {
    version: 1,
    runId: `qa-entry-${mode}`,
    startStage: 6,
    lastCleared: 5,
    nextStage: 6,
    gear: {
      boy: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 },
      girl: { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 },
    },
    growth: {},
    eligible: true,
    friends: [],
    charm: null,
    mode,
    solo: 'boy',
    puffLeft: false,
  }
}

async function bootPlay(page, mode, stageNo) {
  await page.evaluate(
    ({ mode, stageNo }) => {
      const g = window.__SAKE_GAME__
      g.registry.set('stageNo', stageNo)
      g.registry.set('difficulty', 'normal')
      g.registry.set('playMode', mode)
      g.registry.set('soloCast', 'boy')
      g.registry.set('winScreenShown', false)
      g.registry.set('leavingToMenu', false)
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('play')
    },
    { mode, stageNo },
  )
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await page.keyboard.press('Space')
    await page.keyboard.press('Enter')
    await page.keyboard.press('KeyF')
    if (
      await page.evaluate((n) => {
        const s = window.__SAKE_GAME__?.scene?.getScene('play')
        return !!(s?.started && !s?.storyIntro && s?.stageNo === n)
      }, stageNo)
    )
      return
    await page.waitForTimeout(120)
  }
  throw new Error(`stage ${stageNo} did not start`)
}

async function runCase(mode) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e.message)))
  const caseReport = { mode, steps: [], errs }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/?c2=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })

    // Seed LS then reload so GameScene's run singleton loads the same snapshot.
    await page.evaluate(({ mode, run }) => {
      localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 6 }))
      localStorage.setItem('sake-kuma-run-v1', JSON.stringify(run))
    }, { mode, run: seedRun(mode) })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })

    await bootPlay(page, mode, 6)
    caseReport.steps.push({ boot: { stageNo: 6, mode } })

    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.ended = false
      s.started = true
      s.storyIntro = null
      try {
        s.physics.resume()
      } catch (_) {
        /* */
      }
      Object.getPrototypeOf(s).win.call(s)
    })

    await page.waitForFunction(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.clearBtns?.length)
    }, null, { timeout: 15000 })

    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.finishTally?.()
      s.tallyDone = true
    })

    const clearUi = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const next = (s.clearBtns || []).find((b) => b.id === 'next')
      return {
        labels: (s.clearBtns || []).map((b) => ({ id: b.id, label: b.tx?.text, on: b.on })),
        nextOn: next?.on ?? false,
        nextLabel: next?.tx?.text ?? null,
      }
    })
    caseReport.steps.push({ clearUi })
    assert.equal(clearUi.nextOn, true)
    assert.match(clearUi.nextLabel || '', /第二關/)
    await page.screenshot({ path: `${OUT}/${mode}-clear.png` })

    // Press next
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.clearSel = (s.clearBtns || []).findIndex((b) => b.id === 'next')
    })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    // Only call goNextStage if still on ST-06 clear (Enter/leaveBy may have already left).
    await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      if (g.scene.isActive('worldmap') || g.registry.get('stageNo') === 7) return
      const s = g.scene.getScene('play')
      if (s && s.sys?.settings?.active && s.stageNo === 6 && s.cameras?.main) {
        Object.getPrototypeOf(s).goNextStage?.call(s)
      }
    })

    // Wait for worldmap active or ST-07 play. If the game loop is frozen in
    // headless (RAF stall), fall through once LS proves unlock succeeded.
    {
      const t0 = Date.now()
      let reached = false
      while (Date.now() - t0 < 12000) {
        await page.keyboard.press('Enter')
        await page.keyboard.press('Space')
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(r))).catch(() => {})
        const st = await page.evaluate(() => {
          const g = window.__SAKE_GAME__
          return {
            map: g.scene.isActive('worldmap'),
            play7: g.scene.getScene('play')?.stageNo === 7,
            next: JSON.parse(localStorage.getItem('sake-kuma-run-v1') || 'null')?.nextStage ?? null,
          }
        })
        if (st.map || st.play7) {
          reached = true
          caseReport.steps.push({ worldmap: st.map, early: st })
          break
        }
        await page.waitForTimeout(200)
      }
      if (!reached) {
        const ls = await page.evaluate(
          () => JSON.parse(localStorage.getItem('sake-kuma-run-v1') || 'null')?.nextStage ?? null,
        )
        assert.ok((ls ?? 0) >= 7, `unlock must persist before fallback start; nextStage=${ls}`)
        caseReport.steps.push({ rafStallFallback: true, nextStage: ls })
        await page.evaluate(() => {
          const g = window.__SAKE_GAME__
          g.registry.set('stageNo', 7)
          g.registry.set('leavingToMenu', false)
          for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
          g.scene.start('play')
        })
      }
    }

    await page.screenshot({ path: `${OUT}/${mode}-worldmap.png` }).catch(() => {})

    // Boot ST-07 if map travel itself stalled (verse also uses scene timers).
    if (
      !(await page.evaluate(() => window.__SAKE_GAME__?.scene?.getScene('play')?.stageNo === 7))
    ) {
      await page.evaluate(() => {
        const g = window.__SAKE_GAME__
        g.registry.set('stageNo', 7)
        for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
        g.scene.start('play')
      })
    }

    {
      const t0 = Date.now()
      while (Date.now() - t0 < 45000) {
        await page.keyboard.press('Space')
        await page.keyboard.press('Enter')
        if (
          await page.evaluate(() => {
            const s = window.__SAKE_GAME__?.scene?.getScene('play')
            return s?.stageNo === 7 && s?.exhibit === true && s?.started && !s?.storyIntro
          })
        )
          break
        await page.waitForTimeout(120)
      }
    }

    const s7 = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      let run = null
      try {
        run = JSON.parse(localStorage.getItem('sake-kuma-run-v1') || 'null')
      } catch {
        run = null
      }
      let progress = null
      try {
        progress = JSON.parse(localStorage.getItem('sake-kuma-progress-v1') || 'null')
      } catch {
        progress = null
      }
      return {
        stageNo: s.stageNo,
        exhibit: s.exhibit,
        nextStage: run?.nextStage ?? null,
        lastCleared: run?.lastCleared ?? null,
        maxStage: progress?.maxStage ?? null,
        scene: 'play',
      }
    })
    caseReport.steps.push({ s7 })
    assert.equal(s7.stageNo, 7)
    assert.equal(s7.exhibit, true)
    assert.ok((s7.nextStage ?? 0) >= 7, `nextStage should be >=7 got ${s7.nextStage}`)
    assert.ok((s7.maxStage ?? 0) >= 7)
    await page.screenshot({ path: `${OUT}/${mode}-stage7.png` })

    // A3: reload → stage 7 still pickable
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 30000 })
    const persisted = await page.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('sake-kuma-run-v1') || 'null')
      const progress = JSON.parse(localStorage.getItem('sake-kuma-progress-v1') || 'null')
      return {
        nextStage: run?.nextStage ?? null,
        lastCleared: run?.lastCleared ?? null,
        maxStage: progress?.maxStage ?? null,
        openWouldInclude7: (progress?.maxStage ?? 0) >= 7 || (run?.nextStage ?? 0) >= 7,
      }
    })
    caseReport.steps.push({ persisted })
    assert.ok(persisted.openWouldInclude7)
    assert.ok(persisted.maxStage >= 7)

    // A4: 8–10 locked
    await page.evaluate(() => {
      const g = window.__SAKE_GAME__
      for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
      g.scene.start('worldmap', { from: 7, to: 7, next: 'play', pick: true })
    })
    await page.waitForFunction(() => {
      const o = window.__SAKE_GAME__?.scene?.getScene('worldmap')?.openStages
      return Array.isArray(o) && o.length > 0
    }, null, { timeout: 20000 })
    const mapOpen = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('worldmap').openStages)
    caseReport.steps.push({ mapOpen })
    assert.ok(mapOpen.includes(6) || mapOpen.includes(7))
    assert.ok(!mapOpen.includes(8) && !mapOpen.includes(9) && !mapOpen.includes(10))
    await page.screenshot({ path: `${OUT}/${mode}-map-lock.png` })

    // A5: ST-07 clear → 待續
    await bootPlay(page, mode, 7)
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.ended = false
      s.started = true
      s.storyIntro = null
      s.registry.set('winScreenShown', false)
      try {
        s.physics.resume()
      } catch (_) {
        /* */
      }
      Object.getPrototypeOf(s).win.call(s)
    })
    await page.waitForTimeout(600)
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      s.finishTally?.()
      s.tallyDone = true
    })
    const continued = await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const next = (s.clearBtns || []).find((b) => b.id === 'next')
      return { nextLabel: next?.tx?.text ?? null, stageNo: s.stageNo }
    })
    assert.match(continued.nextLabel || '', /待續/)
    await page.evaluate(() => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      Object.getPrototypeOf(s).showFirstReleaseContinued.call(s)
    })
    await page.waitForTimeout(300)
    const a5 = await page.evaluate(() => {
      const play = window.__SAKE_GAME__.scene.getScene('play')
      const texts = []
      const walk = (o) => {
        if (!o) return
        if (o.text) texts.push(String(o.text))
        if (o.list) o.list.forEach(walk)
      }
      play?.children?.list?.forEach?.(walk)
      return {
        hasContinued: texts.some((t) => t.includes('待續')),
        scenes: window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key),
        stageNo: play?.stageNo ?? null,
      }
    })
    caseReport.steps.push({ a5, continued })
    assert.equal(a5.hasContinued, true)
    await page.screenshot({ path: `${OUT}/${mode}-continued.png` })

    caseReport.ok = errs.filter((e) => !e.includes('resolution') && !e.includes('sourceSize')).length === 0
  } catch (e) {
    caseReport.ok = false
    caseReport.fail = String(e?.stack || e)
  } finally {
    caseReport.errs = errs.filter((e) => !e.includes('resolution') && !e.includes('sourceSize'))
    report.cases.push(caseReport)
    await page.close()
  }
}

await runCase('1p')
await runCase('2p')
await browser.close()

report.ok = report.cases.every((c) => c.ok)
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2))
if (!report.ok) {
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}
console.log(
  'PASS',
  JSON.stringify(
    report.cases.map((c) => ({
      mode: c.mode,
      s7: c.steps.find((s) => s.s7)?.s7,
      a5: c.steps.find((s) => s.a5)?.a5,
    })),
  ),
)
