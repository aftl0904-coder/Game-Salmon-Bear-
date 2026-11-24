/**
 * C2 story-depth acceptance:
 * - ST6/ST7: 3 truth fragments each (pickup + on-screen read)
 * - Boss pre/post fight dialogue (no 待補)
 * - ST6 舊相, ST7 批示
 * - ST7 Pupu departure → 「待續」
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.QA_PORT || '47671'
const BASE = `http://127.0.0.1:${PORT}/?c2=1`
const OUT = 'docs/qa-c2-story-depth'
fs.mkdirSync(OUT, { recursive: true })

const depth = JSON.parse(fs.readFileSync('data/c2-story-depth.json', 'utf8'))
const bosses = JSON.parse(fs.readFileSync('data/bosses.json', 'utf8'))

const report = { ok: false, errors: [], checks: {}, shots: [] }

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => {
  const msg = String(e.message)
  if (/drawImage|Cannot read properties of null|WebGL|AudioContext/.test(msg)) return
  report.errors.push(msg)
})

async function shot(name) {
  const p = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: p })
  report.shots.push(p)
}

function fail(msg) {
  throw new Error(msg)
}

async function boot(stageNo) {
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
  while (Date.now() - t0 < 30000) {
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    const ok = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.started && s?.boy?.active)
    })
    if (ok) break
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    s.lastCheckpointX = 99999
    s.stageBeat = 99
    if (s.mallStorySeen) s.mallStorySeen = new Set([0, 1, 2, 3, 4])
    s.s6world?.markElevatorDone?.()
    if (s.s6world) s.s6world.elevDone = true
    s.physics?.resume?.()
  })
  await page.waitForTimeout(200)
}

async function floorY() {
  return page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const top = window.__SAKE_TERRAIN__?.supportTopAt?.(s.boy.x, 400, 80)
    return typeof top === 'number' && Number.isFinite(top) ? top : 285
  })
}

async function place(x) {
  const floor = await floorY()
  await page.evaluate(
    ({ px, floor }) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      if (s.storyIntro?.destroy) s.storyIntro.destroy()
      s.storyIntro = null
      s.coffeeDone = true
      s.memoryDone = true
      s.lastCheckpointX = Math.max(s.lastCheckpointX ?? 0, px + 1)
      // Clear nearby enemies so overlap isn't blocked by hurt / knockback.
      for (const e of [...(s.enemies?.getChildren?.() ?? [])]) {
        if (e.active && Math.abs(e.x - px) < 220) {
          e.disableBody?.(true, true)
          e.destroy?.()
        }
      }
      s.boy.hp = Math.max(s.boy.hp, 6)
      s.boy.graceUntil = s.time.now + 5000
      s.boy.setPosition(px, floor)
      s.boy.body.reset(px, floor)
      s.boy.setVelocity(0, 0)
      s.cameras.main.centerOn(px, floor)
      s.physics?.resume?.()
    },
    { px: x, floor },
  )
  await page.waitForTimeout(120)
}

/** Advance dialogue / overlays until clear or timeout. */
async function dismissDialogue(maxMs = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    const busy = await page.evaluate(() => {
      const s = window.__SAKE_GAME__?.scene?.getScene('play')
      return !!(s?.storyIntro)
    })
    if (!busy) return
    await page.keyboard.press('Space')
    await page.keyboard.press('KeyF')
    await page.waitForTimeout(90)
  }
  // hard skip
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__?.scene?.getScene('play')
    if (s?.storyIntro?.destroy) s.storyIntro.destroy()
    s.storyIntro = null
    s.physics?.resume?.()
  })
}

/** Collect Phaser Text strings currently on the play scene (incl. containers). */
async function visibleTexts() {
  return page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const out = []
    const walk = (nodes) => {
      if (!nodes) return
      for (const o of nodes) {
        if (!o) continue
        if (typeof o.text === 'string' && o.text.trim()) out.push(o.text)
        if (o.list) walk(o.list)
      }
    }
    walk(s.children?.list)
    return out
  })
}

async function waitForText(pred, ms = 12000, label = 'text') {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const texts = await visibleTexts()
    if (pred(texts)) return texts
    await page.waitForTimeout(80)
  }
  fail(`timeout waiting for ${label}; last=${JSON.stringify(await visibleTexts()).slice(0, 400)}`)
}

async function collectFragments(stage) {
  const expected = depth.fragments[String(stage)]
  if (!expected || expected.length !== 3) fail(`depth data stage ${stage} fragments != 3`)

  await boot(stage)
  const info = await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    const truths = s.truthPickups?.getChildren?.()?.filter((o) => o.active) ?? []
    return {
      truthCount: truths.length,
      xs: truths.map((t) => Math.round(t.x)).sort((a, b) => a - b),
      names: truths.map((t) => String(t.getData('truthName') || '')),
    }
  })
  report.checks[`stage${stage}Fragments`] = info
  if (info.truthCount !== 3) fail(`stage ${stage} truths spawned ${info.truthCount}`)

  const gotNames = []
  for (let i = 0; i < info.xs.length; i++) {
    const x = info.xs[i]
    const frag = expected.find((f) => Math.abs(f.x - x) < 40) || expected[i]
    const before = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').truthGot)
    // Stand beside the scrap — landing exactly on x fires overlap and destroys the sprite
    // before takeTruthFragment can run from the QA harness.
    await place(x - 72)
    const opened = await page.evaluate(
      ({ px, before }) => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        // Accidental overlap during place already opened the read?
        if (s.truthGot > before || s.storyIntro) {
          return { ok: true, got: s.truthGot, intro: !!s.storyIntro, via: 'overlap-race' }
        }
        if (s.storyIntro?.destroy) s.storyIntro.destroy()
        s.storyIntro = null
        s.physics.resume()
        const spr = s.truthPickups.getChildren().find((t) => t.active && Math.abs(t.x - px) < 40)
        if (!spr) {
          return {
            ok: false,
            reason: 'missing-sprite',
            remaining: s.truthPickups.getChildren().filter((t) => t.active).map((t) => Math.round(t.x)),
          }
        }
        s.boy.setPosition(px, s.boy.y)
        s.boy.body.reset(px, s.boy.y)
        s.takeTruthFragment(spr)
        return { ok: true, got: s.truthGot, intro: !!s.storyIntro, via: 'takeTruthFragment' }
      },
      { px: x, before },
    )
    if (!opened.ok) {
      // Last chance: step onto scrap and let real overlap fire
      await page.evaluate((px) => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        s.boy.setPosition(px, s.boy.y)
        s.boy.body.reset(px, s.boy.y)
        s.physics.resume()
      }, x)
    }
    const t0 = Date.now()
    let ready = opened.ok && (opened.intro || opened.got > before)
    while (!ready && Date.now() - t0 < 4000) {
      const st = await page.evaluate(() => {
        const s = window.__SAKE_GAME__.scene.getScene('play')
        return { got: s.truthGot, intro: !!s.storyIntro }
      })
      if (st.got > before || st.intro) {
        ready = true
        break
      }
      await page.waitForTimeout(60)
    }
    if (!ready) fail(`stage ${stage} fragment ${i + 1} at x=${x} did not trigger`)

    const texts = await waitForText((ts) => ts.some((t) => t.length > 4), 5000, `frag${i + 1} dialogue`)
    const joined = texts.join('\n')
    if (frag && !joined.includes(frag.content.slice(0, 6)) && !joined.includes(frag.name.slice(0, 4))) {
      fail(`stage ${stage} frag ${i + 1} dialogue missing content; saw=${joined.slice(0, 240)}`)
    }
    gotNames.push(frag?.name || info.names[i])
    await shot(`st${stage}-frag-${i + 1}`)
    await dismissDialogue(10000)
    await page.waitForTimeout(200)
    const floatOk = await page.evaluate((n) => {
      const s = window.__SAKE_GAME__.scene.getScene('play')
      const want = `真相碎片 ${n}/3`
      const walk = (nodes, out = []) => {
        for (const o of nodes || []) {
          if (typeof o.text === 'string') out.push(o.text)
          if (o.list) walk(o.list, out)
        }
        return out
      }
      return walk(s.children.list).some((t) => t.includes(want) || t.includes('真相碎片'))
    }, before + 1)
    report.checks[`stage${stage}Frag${i + 1}Float`] = !!floatOk
  }

  const got = await page.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').truthGot)
  report.checks[`stage${stage}Got`] = got
  if (got !== 3) fail(`stage ${stage} truthGot=${got}`)
  await shot(`st${stage}-frags-done`)
  return gotNames
}

async function checkKenProp(stage, kind) {
  const spec = kind === 'photo' ? depth.kenPhoto : depth.kenMemo
  await boot(stage)
  const has = await page.evaluate(() =>
    window.__SAKE_GAME__.scene
      .getScene('play')
      .children.list.some((o) => o.getData?.('kenProp')),
  )
  report.checks[`stage${stage}KenProp`] = has
  if (!has) fail(`stage ${stage} missing ken prop`)

  // Stand beside, then invoke the same private tick path the update loop uses.
  await place(spec.x - 80)
  const triggered = await page.evaluate((px) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    if (s.storyIntro?.destroy) s.storyIntro.destroy()
    s.storyIntro = null
    s.kenPropRead = false
    s.bossFight = false
    s.ended = false
    s.started = true
    s.physics.resume()
    const near = s.children.list.find((o) => o.getData?.('kenProp'))
    const targetX = near?.x ?? px
    const floor = s.boy.y
    s.boy.setPosition(targetX, floor)
    s.boy.body.reset(targetX, floor)
    s.boy.setVelocity(0, 0)
    // Force the auto-read once; private method is still callable at runtime.
    if (typeof s.tickKenStoryProp === 'function') s.tickKenStoryProp()
    return { intro: !!s.storyIntro, kenPropRead: !!s.kenPropRead, nearX: near?.x ?? null }
  }, spec.x)

  if (!triggered.intro) {
    // Fallback: wait a few frames for update-loop tick
    const t0 = Date.now()
    while (Date.now() - t0 < 4000) {
      const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro)
      if (intro) break
      await page.waitForTimeout(80)
    }
  }
  const texts = await waitForText(
    (ts) => ts.some((t) => t.includes(spec.title) || t.includes(spec.content.slice(0, 6)) || t.includes(spec.presentation.slice(0, 6))),
    8000,
    `stage${stage} ${kind}`,
  )
  report.checks[`stage${stage}${kind === 'photo' ? 'Photo' : 'Memo'}`] = {
    title: spec.title,
    saw: texts.filter((t) => t.includes(spec.title) || t.includes('Ken') || t.includes('批') || t.includes('舊')).slice(0, 6),
  }
  await shot(`st${stage}-${kind === 'photo' ? 'old-photo' : 'memo'}`)
  await dismissDialogue(12000)
}

async function captureBossDialogue(stage, kind) {
  await boot(stage)
  await place(stage === 6 ? 5020 : 5000)

  // Start boss sequence
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro = null
    s.coffeeDone = true
    s.memoryDone = true
    if (s.mallStorySeen) s.mallStorySeen = new Set([0, 1, 2, 3, 4])
    s.s2Pending = []
    s.physics.resume()
    s.startQueenFight()
  })

  const preExpected = depth.bossDialogue[kind].preFight
  const sawPre = []
  const tPre = Date.now()
  while (Date.now() - tPre < 25000) {
    const texts = await visibleTexts()
    for (const line of preExpected) {
      const body = line.replace(/^[^：:]+[：:]/, '').trim()
      if (texts.some((t) => t.includes(body.slice(0, 10)) || t.includes(line.slice(0, 12)))) {
        if (!sawPre.includes(line)) sawPre.push(line)
      }
    }
    if (sawPre.length >= Math.min(2, preExpected.length)) {
      await shot(`st${stage}-boss-pre`)
      break
    }
    // advance overlays (warning / card / dialogue)
    await page.keyboard.press('Space')
    await page.keyboard.press('KeyF')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(120)
  }
  report.checks[`stage${stage}PreFight`] = { saw: sawPre.length, need: preExpected.length }
  if (sawPre.length < 1) fail(`stage ${stage} preFight dialogue not seen`)

  // Skip through to fight ready, then force defeat → postFight
  await dismissDialogue(15000)
  // Ensure queen exists; if not, reveal directly
  await page.evaluate(() => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro?.destroy?.()
    s.storyIntro = null
    if (!s.queen) {
      try {
        s.queenReveal?.(s.constructor ? undefined : undefined)
      } catch {
        /* ignore */
      }
    }
    // Prefer public path: force defeat handlers
    if (s.stageNo === 6 && typeof s.mallDefeated === 'function') {
      /* private — call via queen hook if present */
    }
  })

  // Access private methods via bracket after ensuring boss object; call defeat path directly.
  const postExpected = depth.bossDialogue[kind].postFight
  await page.evaluate((stageNo) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    s.storyIntro?.destroy?.()
    s.storyIntro = null
    s.physics.pause()
    // Call private methods — Phaser scenes keep them on the instance.
    if (stageNo === 6) s.mallDefeated()
    else s.trainerDefeated()
  }, stage)

  const sawPost = []
  const tPost = Date.now()
  while (Date.now() - tPost < 20000) {
    const texts = await visibleTexts()
    for (const line of postExpected) {
      const body = line.replace(/^[^：:]+[：:]/, '').trim()
      if (texts.some((t) => t.includes(body.slice(0, 10)))) {
        if (!sawPost.includes(line)) sawPost.push(line)
      }
    }
    if (sawPost.length >= 1) {
      await shot(`st${stage}-boss-post`)
      break
    }
    await page.keyboard.press('Space')
    await page.keyboard.press('KeyF')
    await page.waitForTimeout(100)
  }
  report.checks[`stage${stage}PostFight`] = { saw: sawPost.length, need: postExpected.length }
  if (sawPost.length < 1) fail(`stage ${stage} postFight dialogue not seen`)

  if (stage === 7) {
    // Advance postFight → departure narration → 待續
    const tDep = Date.now()
    let sawContinued = false
    while (Date.now() - tDep < 35000) {
      const texts = await visibleTexts()
      if (texts.some((t) => t.includes('待續') || t.includes(depth.pupuDeparture.continued))) {
        sawContinued = true
        await shot('st7-departure-continued')
        break
      }
      // departure lines
      if (texts.some((t) => t.includes('維修口') || t.includes('樹枝') || t.includes('氣味'))) {
        await shot('st7-departure-lines')
      }
      await page.keyboard.press('Space')
      await page.keyboard.press('KeyF')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(120)
    }
    report.checks.stage7DepartureContinued = sawContinued
    if (!sawContinued) fail('stage 7 待續 not seen after departure')
  } else {
    await dismissDialogue(12000)
  }
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!window.__SAKE_GAME__, null, { timeout: 45000 })

  // Boss card data (Node-side — Vite does not serve /data/*.json)
  const scrubber = bosses.bosses['mall-scrubber']
  const trainer = bosses.bosses.trainer
  const scrubberJson = JSON.stringify(scrubber)
  const trainerJson = JSON.stringify(trainer)
  report.checks.cards = {
    scrubberHasDaibu: scrubberJson.includes('待補'),
    trainerHasDaibu: trainerJson.includes('待補'),
    scrubberName: scrubber?.name,
    trainerName: trainer?.name,
  }
  if (report.checks.cards.scrubberHasDaibu) fail('mall-scrubber card still has 待補')
  if (report.checks.cards.trainerHasDaibu) fail('trainer card still has 待補')

  await collectFragments(6)
  await checkKenProp(6, 'photo')
  await captureBossDialogue(6, 'mall-scrubber')

  await collectFragments(7)
  await checkKenProp(7, 'memo')
  await captureBossDialogue(7, 'trainer')

  report.ok = report.errors.length === 0
} catch (e) {
  report.errors.push(String(e?.stack || e))
  report.ok = false
  try {
    await shot('error')
  } catch {
    /* ignore */
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
